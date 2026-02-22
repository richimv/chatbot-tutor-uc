import os
import re
import fitz  # PyMuPDF
import psycopg2
import json
from vertexai.preview.language_models import TextEmbeddingModel
import vertexai
from dotenv import load_dotenv

# Dependencias OCR
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

# Configuración de ruta Tesseract para Windows (Ajustar si es necesario)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Cargar variables de entorno
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
load_dotenv(dotenv_path=os.path.join(root_dir, '.env'))

# Configuración DB
DB_CONNECTION_STRING = os.getenv("NODE_DATABASE_URL")
if not DB_CONNECTION_STRING:
    DB_HOST = os.getenv("SUPABASE_DB_HOST", "db.supabase.co")
    DB_USER = os.getenv("SUPABASE_DB_USER", "postgres")
    DB_PASS = os.getenv("SUPABASE_DB_PASSWORD")
    DB_NAME = "postgres"
    if not DB_PASS:
        print("Error: Faltan credenciales de Base de Datos en .env")
        exit(1)
    DB_CONNECTION_STRING = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

# Vertex AI
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
vertexai.init(project=PROJECT_ID, location=LOCATION)
model = TextEmbeddingModel.from_pretrained("text-embedding-004")

LIBRARY_PATH = os.path.join(root_dir, "biblioteca_medica")

def get_embedding(text):
    try:
        embeddings = model.get_embeddings([text])
        return embeddings[0].values
    except Exception as e:
        print(f"Error generando embedding: {e}")
        return None

def extract_metadata(file_path):
    """
    Deduce metadatos basados en la ruta del archivo.
    Ej: /biblioteca_medica/01_Normas_Tecnicas/NTS_Tuberculosis_2023.pdf
    """
    filename = os.path.basename(file_path)
    folder = os.path.basename(os.path.dirname(file_path))
    
    # Categoría basada en carpeta
    category_map = {
        "01_Normas_Tecnicas": "Norma Técnica",
        "02_Guias_Practica_Clinica": "Guía Clínica",
        "03_Examenes_Pasados": "Examen Pasado",
        "04_Legal": "Legal",
        "05_Libros_y_Manuales": "Libro / Manual"
    }
    category = category_map.get(folder, "General")

    # Año (buscar 4 dígitos en el nombre)
    year_match = re.search(r'(20\d{2})', filename)
    year = year_match.group(1) if year_match else "Desconocido"

    # Título limpio
    title = filename.replace(".pdf", "").replace("_", " ")

    return {
        "source": filename,
        "title": title,
        "type": category,
        "year": year,
        "folder": folder
    }

def smart_chunking(file_path):
    """
    Estrategia Semántica + OCR Híbrido:
    Intenta sacar texto nativo. Si es muy pobre (< 50 caracteres validos por pagina), 
    asume que es un escáner y aplica Tesseract OCR.
    """
    chunks = []
    buffer_text = ""
    
    doc = fitz.open(file_path)
    
    for page_num, page in enumerate(doc):
        # 1. Intento de extracción de texto estándar
        text = page.get_text()
        text = text.replace('\n', ' ').strip()
        
        # 2. Lógica OCR Híbrida
        chars_only = re.sub(r'\s+', '', text)
        if len(chars_only) < 50:
            print(f"   [!] Página {page_num + 1} requiere OCR (Escáner detectado). Aplicando Tesseract...", flush=True)
            try:
                # IMPORTANT: convert_from_path needs the string path, not the fitz object
                # On Windows, we must explicitly point to the poppler bin directory
                images = convert_from_path(file_path, first_page=page_num+1, last_page=page_num+1, dpi=300, poppler_path=r'C:\poppler\Library\bin')
                if images:
                    ocr_text = pytesseract.image_to_string(images[0], lang='spa')
                    text = ocr_text.replace('\n', ' ').strip()
                    print(f"       [OK] OCR exitoso. {len(text)} caracteres extraídos.", flush=True)
            except Exception as e:
                import traceback
                print(f"   [Error] Falló el OCR en la página {page_num +1}: {e}", flush=True)
                traceback.print_exc()
        else:
             print(f"   [i] Página {page_num + 1} leída correctamente (Texto Nativo).", flush=True)
        
        if not text:
            continue

        # Lógica de buffer (si el texto es muy corto, unimos al siguiente)
        if len(text) < 500:
            buffer_text += " " + text
        else:
            full_chunk = (buffer_text + " " + text).strip()
            buffer_text = "" 
            
            # Cortar si es excesivamente gigante
            if len(full_chunk) > 3000:
                mid = len(full_chunk) // 2
                chunks.append(full_chunk[:mid])
                chunks.append(full_chunk[mid:])
            else:
                chunks.append(full_chunk)
    
    # Remanente final
    if buffer_text:
        chunks.append(buffer_text.strip())
        
    doc.close()
    return chunks

def ingest_library():
    if not os.path.exists(LIBRARY_PATH):
        print(f"⚠️ No se encontró la carpeta {LIBRARY_PATH}")
        return

    print(f"Iniciando ingesta desde: {LIBRARY_PATH}")

    for root, dirs, files in os.walk(LIBRARY_PATH):
        for file in files:
            if file.endswith(".pdf"):
                file_path = os.path.join(root, file)
                metadata = extract_metadata(file_path)
                
                print(f"Procesando: {metadata['title']} ({metadata['type']})")
                
                try:
                    # Pasamos file_path en lugar de doc para que OCR funcione
                    chunks = smart_chunking(file_path)
                    
                    if not chunks:
                        print("   [!] Archivo vacío o ilegible.")
                        continue
                        
                    # Conectar a Supabase JUSTO antes de insertar para evitar "Connection timeout"
                    conn = psycopg2.connect(DB_CONNECTION_STRING)
                    cur = conn.cursor()
                    
                    for i, chunk in enumerate(chunks):
                        vector = get_embedding(chunk)
                        
                        if vector:
                            # Enriquecer metadatos con el chunk id
                            chunk_meta = metadata.copy()
                            chunk_meta['chunk_index'] = i
                            
                            cur.execute(
                                "INSERT INTO documents (content, metadata, embedding) VALUES (%s, %s, %s)",
                                (chunk, json.dumps(chunk_meta), vector)
                            )
                            print(f"   - Chunk {i+1}/{len(chunks)} guardado.")
                    
                    conn.commit()
                    cur.close()
                    conn.close()
                        
                except Exception as e:
                    print(f"Error procesando {file}: {e}")

    print("Ingesta Masiva Completada.")

if __name__ == "__main__":
    ingest_library()
