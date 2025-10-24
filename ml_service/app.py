# ml_service/app.py
import os
import pandas as pd
from flask import Flask, request, jsonify
import nltk

# Usamos importaciones relativas para que Python encuentre los módulos dentro del paquete ml_service
from .predictors import popular_course_predictor, popular_topic_predictor, related_items_predictor
from .utils import load_json_data

app = Flask(__name__)

# --- Inicialización de recursos al arrancar ---
# Descargar los recursos de NLTK si no existen (solo la primera vez que se inicia el servidor)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    print("Descargando recursos de NLTK ('punkt')...")
    nltk.download('punkt')

# --- Lógica de Negocio / ML ---

def get_recommendations(query, direct_results_ids, courses_df, trends_df):
    """Función principal que genera todas las recomendaciones y predicciones."""

    # 1. Predicciones generales (no dependen de la consulta actual)
    popular_course = popular_course_predictor.predict(courses_df, trends_df)
    # --- Fallback para Curso Popular ---
    if not popular_course.get("predictedCourse"):
        first_course = courses_df.iloc[0]
        popular_course = {
            "predictedCourse": first_course['nombre'],
            "confidence": 0.1, # Confianza baja para indicar que es un fallback
            "reason": "Sugerencia por defecto."
        }

    popular_topic = popular_topic_predictor.predict(courses_df, trends_df)
    # --- Fallback para Tema Popular ---
    if not popular_topic.get("predictedTopic"):
        first_topic = courses_df.iloc[0]['temas'][0] if 'temas' in courses_df.iloc[0] and courses_df.iloc[0]['temas'] else "Conceptos Básicos"
        popular_topic["predictedTopic"] = first_topic.capitalize()
        popular_topic["reason"] = "Sugerencia por defecto."
        popular_topic["confidence"] = 0.1

    # 2. Recomendaciones contextuales (dependen de la consulta y resultados)
    related_courses = related_items_predictor.get_related_courses(query, direct_results_ids, courses_df)
    related_topics = related_items_predictor.get_related_topics(query, direct_results_ids, courses_df)

    return {
        "popularCourse": popular_course,
        "popularTopic": popular_topic,
        "relatedCourses": related_courses,
        "relatedTopics": related_topics
    }


# --- Endpoint de la API ---

@app.route('/recommendations', methods=['POST'])
def handle_recommendations():
    """
    Endpoint que recibe una consulta y devuelve un paquete completo de recomendaciones.
    """
    try:
        # Obtener datos de la petición
        data = request.get_json()
        query = data.get('query', '')
        direct_results_ids = data.get('directResultsIds', [])

        # Rutas a los archivos de datos (relativas a la ubicación de app.py)
        base_path = os.path.dirname(__file__)
        courses_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'courses.json'))
        analytics_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'analytics.json'))

        # Cargar los datos
        courses_df = pd.DataFrame(load_json_data(courses_path) or [])

        if courses_df.empty:
            return jsonify({"error": "No se pudieron cargar los datos de los cursos."}), 500

        # Cargar los datos de analytics y procesar las tendencias
        analytics_data = load_json_data(analytics_path)
        search_history = analytics_data.get('searchHistory', [])

        trends_counts = {}
        for record in search_history:
            q = record.get('query')
            if q:
                trends_counts[q] = trends_counts.get(q, 0) + 1
        
        trends_list = [{'query': q, 'count': c} for q, c in trends_counts.items()]
        trends_df = pd.DataFrame(trends_list)
        
        if trends_df.empty:
            trends_df = pd.DataFrame(columns=['query', 'count'])

        # Obtener las recomendaciones
        recommendations = get_recommendations(query, direct_results_ids, courses_df, trends_df)

        return jsonify(recommendations)

    except Exception as e:
        print(f"Error en /recommendations: {e}")
        return jsonify({"error": "Ocurrió un error interno en el servicio de ML."}), 500


if __name__ == '__main__':
    # El puerto 5000 es estándar para Flask
    app.run(debug=True, port=5000)
