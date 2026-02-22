import os
import fitz  # PyMuPDF
import sys

def split_pdf(input_path, output_dir, pages_per_split=500):
    """
    Divide un PDF gigante en varios PDFs más pequeños.
    """
    if not os.path.exists(input_path):
        print(f"❌ Error: No se encontró el archivo {input_path}")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"📖 Abriendo documento gigante: {input_path}")
    doc = fitz.open(input_path)
    total_pages = len(doc)
    print(f"📊 Total de páginas detectadas: {total_pages}")

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    
    start_page = 0
    part_num = 1

    while start_page < total_pages:
        end_page = min(start_page + pages_per_split, total_pages)
        
        # Crear un nuevo documento PDF vacío para esta partición
        new_doc = fitz.open()
        
        # Insertar el rango de páginas del documento original al nuevo
        new_doc.insert_pdf(doc, from_page=start_page, to_page=end_page - 1)
        
        # Guardar la partición
        output_filename = f"{base_name}_Parte{part_num}.pdf"
        output_filepath = os.path.join(output_dir, output_filename)
        new_doc.save(output_filepath)
        
        print(f"✅ Guardado: {output_filename} (Páginas {start_page + 1} a {end_page})")
        
        new_doc.close()
        
        start_page += pages_per_split
        part_num += 1

    doc.close()
    print("🎉 División completada con éxito.")

if __name__ == "__main__":
    print("=== Herramienta para Dividir PDFs Masivos ===")
    print("Esta herramienta es ideal para libros como el Harrison (> 3000 pags).")
    
    # Ruta por defecto donde el usuario podría poner el libro gigante
    default_input = os.path.join("biblioteca_medica", "05_Libros_y_Manuales", "Harrison.pdf")
    
    # Si se pasa un argumento por consola, usarlo, si no, preguntar
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = input(f"Introduce la ruta del PDF gigante (Enter para usar '{default_input}'): ").strip()
        if not pdf_path:
            pdf_path = default_input

    # Preguntar cuántas páginas por tomo
    try:
        pages_input = input("¿Cuántas páginas por tomo quieres? (Enter para 500): ").strip()
        chunk_size = int(pages_input) if pages_input else 500
    except ValueError:
        print("Valor inválido. Usando 500 por defecto.")
        chunk_size = 500
        
    output_folder = os.path.dirname(pdf_path)
    if not output_folder: output_folder = "."

    split_pdf(pdf_path, output_folder, chunk_size)
