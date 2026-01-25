import sys
import os

# TRUCO: Agregamos la carpeta actual al path para importar 'predictors' y 'utils' sin problemas
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

import pandas as pd
import json

from sentence_transformers import SentenceTransformer
# Importamos tus predictores existentes
from predictors import popular_course_predictor
# from predictors import popular_resource_predictor # Descomentar cuando actives libros
from utils import normalize_text

# Rutas configuradas según tu estructura
# Node.js pondrá los CSVs en una carpeta temporal 'data_dump' en la raíz
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Raíz del proyecto
DATA_DIR = os.path.join(BASE_DIR, "data_dump")
OUTPUT_FILE = os.path.join(DATA_DIR, "ai_predictions.json")

def main():
    print("🚀 [ML SERVICE] Iniciando análisis batch...")

    try:
        # 1. Cargar Datos (CSVs generados por Node)
        search_path = os.path.join(DATA_DIR, "search_history.csv")
        courses_path = os.path.join(DATA_DIR, "courses.csv")
        
        if not os.path.exists(search_path) or not os.path.exists(courses_path):
            print("⚠️ Faltan archivos CSV. Ejecuta primero la exportación desde Node.")
            return

        search_df = pd.read_csv(search_path)
        search_df['created_at'] = pd.to_datetime(search_df['created_at'])
        
        # Adaptar formato para tus predictores (agrupar queries)
        trends_df = search_df.groupby('query').agg(
            dates=('created_at', list),
            count=('query', 'count')
        ).reset_index()

        courses_df = pd.read_csv(courses_path)
        
        print(f"📊 Datos cargados: {len(trends_df)} búsquedas, {len(courses_df)} cursos.")

        # 2. Cargar Modelo
        print("🧠 Cargando modelo SentenceTransformer...")
        model = SentenceTransformer('all-MiniLM-L6-v2')

        results = {
            "generated_at": pd.Timestamp.now().isoformat(),
            "course_prediction": None
        }

        # 3. Predicción de Cursos (Usando TU lógica existente)
        if not courses_df.empty and not trends_df.empty:
            print("🔮 Ejecutando popular_course_predictor...")
            course_embeddings = model.encode(courses_df['name'].tolist())
            
            # Llamada a tu script original
            prediction = popular_course_predictor.predict(
                courses_df, trends_df, course_embeddings, model
            )
            results['course_prediction'] = prediction

        # 4. Guardar JSON
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"✅ Resultados guardados en: {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Error crítico en Python: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()