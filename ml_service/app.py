# ml_service/app.py
import pandas as pd
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

# ✅ 1. IMPORTACIONES RELATIVAS (Necesarias para ejecutar como módulo)
from .db_connector import get_courses_data, get_search_trends_data, get_all_topics
from .predictors import (
    popular_course_predictor, 
    popular_topic_predictor,
    related_course_predictor, 
    related_topic_predictor
)

app = Flask(__name__)

# --- 🧠 2. INICIALIZACIÓN DE RECURSOS (Al arrancar) ---
print("⏳ Iniciando servicio de ML...")

# Variable global para caché en memoria (Evita consultar DB en cada click)
global_data = {
    "courses_df": pd.DataFrame(),
    "topics_df": pd.DataFrame(),
    "embeddings": None,        # Vectores de Cursos
    "topic_embeddings": None   # Vectores de Temas
}

# Modelo de IA (Singleton)
ml_model = None

def initialize_app():
    global ml_model
    try:
        print("   🧠 Cargando modelo de lenguaje (all-MiniLM-L6-v2)...")
        # Modelo L3 (3 capas en vez de 6): Mucho menos RAM, precisión similar para tu caso
        ml_model = SentenceTransformer('sentence-transformers/paraphrase-MiniLM-L3-v2')
        print("   ✅ Modelo IA cargado.")
        
        refresh_data() # Cargar datos iniciales
    except Exception as e:
        print(f"   ❌ Error crítico inicializando: {e}")

def refresh_data():
    """Descarga datos frescos de SQL y recalcula vectores"""
    print("   🔄 Conectando a Supabase...")
    global_data["courses_df"] = get_courses_data()
    global_data["topics_df"] = get_all_topics()
    
    if ml_model:
        # A. Vectorizar Cursos
        if not global_data["courses_df"].empty:
            df = global_data["courses_df"]
            # Feature Engineering: Concatenar Título + Descripción + Temas para mayor contexto
            df['soup'] = (
                df['name'] + " " + 
                df['description'].fillna('') + " " + 
                df['topics_soup'].fillna('')
            )
            print(f"   🧠 Vectorizando {len(df)} cursos...")
            global_data["embeddings"] = ml_model.encode(df['soup'].tolist())

        # B. Vectorizar Temas
        if not global_data["topics_df"].empty:
            df_t = global_data["topics_df"]
            print(f"   🧠 Vectorizando {len(df_t)} temas...")
            global_data["topic_embeddings"] = ml_model.encode(df_t['name'].fillna('').tolist())

# Ejecutar carga inicial
initialize_app()


# --- 3. ENDPOINTS (RUTAS API) ---

@app.route('/api/recommendations', methods=['POST'])
def recommendations():
    """
    🔍 RECOMENDADOR SEMÁNTICO (Búsqueda)
    Usa: related_course_predictor + related_topic_predictor
    """
    data = request.json
    query = data.get('query', '')
    direct_ids = data.get('directResultsIds', []) # IDs que ya mostró el buscador normal

    if not query:
        return jsonify({"relatedCourses": [], "relatedTopics": []})

    # Objeto caché para pasar al predictor
    # (Simulamos la estructura que espera el refactor anterior)
    class CacheWrapper:
        def __init__(self):
            self.model = ml_model
            self.course_embeddings = global_data["embeddings"]
            self.course_ids = global_data["courses_df"]['id'].tolist() if not global_data["courses_df"].empty else []
            self.initialized = True

    cache_wrapper = CacheWrapper()

    # 1. Predecir Cursos Relacionados
    rec_courses = related_course_predictor.predict(
        query, 
        direct_ids, 
        global_data["courses_df"], 
        cache_wrapper
    )

    # 2. Predecir Temas Relacionados
    rec_topics = related_topic_predictor.predict(
        query,
        direct_ids,
        global_data["courses_df"],
        global_data["topics_df"],
        global_data["topic_embeddings"],
        ml_model
    )

    return jsonify({
        "relatedCourses": rec_courses,
        "relatedTopics": rec_topics
    })


@app.route('/api/trends', methods=['GET'])
def trends():
    """
    📈 TENDENCIAS (Popularidad)
    Usa: popular_course_predictor + popular_topic_predictor
    """
    try:
        days = request.args.get('days', default=30, type=int)
        
        # 1. Obtener historial crudo de SQL
        print(f"📊 Obteniendo tendencias para los últimos {days} días...")
        raw_history = get_search_trends_data(days)
        
        if raw_history.empty:
            print("⚠️ No hay historial de búsquedas reciente.")
            return jsonify({
                "period": f"Last {days} days",
                "popularCourse": {"predictedCourse": None, "reason": "Sin datos"},
                "popularTopic": {"predictedTopic": None, "reason": "Sin datos"}
            })

        # 2. Preprocesamiento
        # Aseguramos que created_at sea datetime
        raw_history['created_at'] = pd.to_datetime(raw_history['created_at'])
        
        # Agrupar por query
        grouped_trends = raw_history.groupby('query')['created_at'].apply(list).reset_index()
        grouped_trends.rename(columns={'created_at': 'dates'}, inplace=True)
        grouped_trends['count'] = grouped_trends['dates'].apply(len)
        
        print(f"📊 Historial procesado: {len(grouped_trends)} queries únicas.")

        # 3. Predecir Curso Popular
        pop_course = popular_course_predictor.predict(
            global_data["courses_df"],
            grouped_trends,
            global_data["embeddings"],
            ml_model
        )

        # 4. Predecir Tema Popular
        pop_topic = popular_topic_predictor.predict(
            global_data["courses_df"],
            grouped_trends,
            global_data["topics_df"],
            global_data["topic_embeddings"],
            ml_model
        )

        return jsonify({
            "period": f"Last {days} days",
            "popularCourse": pop_course,
            "popularTopic": pop_topic
        })

    except Exception as e:
        import traceback
        traceback.print_exc() # Imprime el error real en la consola
        print(f"❌ Error en /api/trends: {e}")
        return jsonify({"error": str(e)}), 500