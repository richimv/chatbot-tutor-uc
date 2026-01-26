import sys
import os
import io

# 1. ARREGLO DE EMOJIS EN WINDOWS (Vital)
if sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 2. Configuración de Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.append(root_dir)

import pandas as pd
import json
from sentence_transformers import SentenceTransformer
from ml_service.predictors import popular_course_predictor, popular_resource_predictor
from ml_service.utils import normalize_text

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data_dump")
OUTPUT_FILE = os.path.join(DATA_DIR, "ai_predictions.json")

def main():
    print("🚀 [ML SERVICE] Iniciando análisis batch...")

    try:
        search_path = os.path.join(DATA_DIR, "search_history.csv")
        courses_path = os.path.join(DATA_DIR, "courses.csv")
        resources_path = os.path.join(DATA_DIR, "resources.csv")
        
        if not os.path.exists(search_path) or not os.path.exists(courses_path):
            print("⚠️ Faltan archivos CSV.")
            return

        search_df = pd.read_csv(search_path)
        
        # 3. ARREGLO DE FECHAS (El error principal)
        # errors='coerce' convierte fechas malas en NaT (Not a Time) en lugar de fallar
        search_df['created_at'] = pd.to_datetime(search_df['created_at'], errors='coerce')
        # Eliminamos filas que no tengan fecha válida
        search_df = search_df.dropna(subset=['created_at'])

        # Agrupar queries
        trends_df = search_df.groupby('query').agg(
            dates=('created_at', list),
            count=('query', 'count')
        ).reset_index()

        courses_df = pd.read_csv(courses_path)
        
        # Cargar libros si existen
        books_df = pd.DataFrame()
        if os.path.exists(resources_path):
            books_df = pd.read_csv(resources_path)
            if 'title' in books_df.columns:
                books_df = books_df.rename(columns={'title': 'name'})

        print(f"📊 Datos cargados: {len(trends_df)} búsquedas, {len(courses_df)} cursos, {len(books_df)} libros.")

        print("🧠 Cargando modelo SentenceTransformer...")
        model = SentenceTransformer('all-MiniLM-L6-v2')

        results = {
            "generated_at": pd.Timestamp.now().isoformat(),
            "course_prediction": None,
            "book_prediction": None
        }

        if not courses_df.empty and not trends_df.empty:
            print("🔮 Ejecutando popular_course_predictor...")
            course_embeddings = model.encode(courses_df['name'].tolist())
            
            prediction = popular_course_predictor.predict(
                courses_df, trends_df, course_embeddings, model
            )
            results['course_prediction'] = prediction

        # Predicción de Libros
        if not books_df.empty and not trends_df.empty:
            print("🔮 Ejecutando popular_resource_predictor...")
            book_embeddings = model.encode(books_df['name'].tolist())
            
            book_pred = popular_resource_predictor.predict(
                books_df, trends_df, book_embeddings, model
            )
            results['book_prediction'] = book_pred

        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"✅ Resultados guardados en: {OUTPUT_FILE}")

    except Exception as e:
        # Quitamos el emoji aquí para evitar errores si el paso 1 fallara
        print(f"[ERROR CRITICO]: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()