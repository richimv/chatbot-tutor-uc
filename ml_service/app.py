# ml_service/app.py
import os
import pandas as pd
from flask import Flask, request, jsonify
import nltk

# Usamos importaciones relativas para que Python encuentre los módulos dentro del paquete ml_service
from .predictors import popular_course_predictor, popular_topic_predictor, related_course_predictor, related_topic_predictor
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

def get_contextual_recommendations(query, direct_results_ids, courses_df):
    """Función optimizada que solo genera recomendaciones contextuales para la búsqueda del usuario."""
    if courses_df.empty:
        return {
            "relatedCourses": [],
            "relatedTopics": []
        }

    related_courses = related_course_predictor.predict(query, direct_results_ids, courses_df)
    related_topics = related_topic_predictor.predict(query, direct_results_ids, courses_df)

    return {
        "relatedCourses": related_courses,
        "relatedTopics": related_topics
    }


# --- Endpoint de la API ---

@app.route('/recommendations', methods=['POST'])
def handle_recommendations():
    """
    Endpoint OPTIMIZADO que recibe una consulta y devuelve solo recomendaciones contextuales.
    """
    try:
        # Obtener datos de la petición
        data = request.get_json()
        query = data.get('query', '')
        direct_results_ids = data.get('directResultsIds', [])

        # Rutas a los archivos de datos (relativas a la ubicación de app.py)
        base_path = os.path.dirname(__file__)
        courses_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'courses.json'))
        sections_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'sections.json'))
        careers_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'careers.json'))
        topics_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'topics.json'))

        # Cargar los datos
        courses_list = load_json_data(courses_path) or []
        topics_list = load_json_data(topics_path) or []
        # Nota: La información de carreras ya está unificada en el lado de Node.js, aquí solo la usamos.
        sections_list = load_json_data(sections_path) or []
        careers_list = load_json_data(careers_path) or []

        if not courses_list:
            return jsonify({"error": "No se pudieron cargar los datos de los cursos."}), 500

        # Convertir a DataFrame INMEDIATAMENTE para evitar mutar la lista original.
        courses_df = pd.DataFrame(courses_list)

        # --- LÓGICA DE ENRIQUECIMIENTO DE DATOS (VERSIÓN FINAL Y ROBUSTA) ---
        # Este enfoque es inmutable y seguro para un entorno de servidor.
        # No modifica la 'courses_list' original cargada en memoria.
        if topics_list:
            topics_map = {topic['id']: topic['name'] for topic in topics_list}
            # La función 'get_topic_names' se define localmente para asegurar que no haya cierres (closures) problemáticos.
            def get_topic_names(topic_ids):
                if not isinstance(topic_ids, list): return []
                return [topics_map.get(tid) for tid in topic_ids if tid in topics_map]
            # Usamos .apply() en la columna 'topicIds' para crear una NUEVA columna 'topics'.
            courses_df['topics'] = courses_df['topicIds'].apply(get_topic_names)

        # ✅ LÓGICA DE ENRIQUECIMIENTO DE DATOS: Añadir la columna 'careers'
        if sections_list and careers_list:
            sections_by_course_id = {}
            for section in sections_list:
                sections_by_course_id.setdefault(section.get('courseId'), []).append(section)
            
            careers_map = {career['id']: career['name'] for career in careers_list}

            def get_course_careers(course_id):
                course_sections = sections_by_course_id.get(course_id, [])
                all_career_names = set()
                for section in course_sections:
                    for career_id in section.get('careerIds', []):
                        if career_id in careers_map:
                            all_career_names.add(careers_map[career_id])
                return list(all_career_names)
            courses_df['careers'] = courses_df['id'].apply(get_course_careers)

        # Obtener solo las recomendaciones contextuales
        recommendations = get_contextual_recommendations(query, direct_results_ids, courses_df)

        return jsonify(recommendations)

    except Exception as e:
        print(f"Error en /recommendations: {e}")
        return jsonify({"error": "Ocurrió un error interno en el servicio de ML."}), 500


@app.route('/analytics/trends', methods=['GET'])
def handle_analytics_trends():
    """
    NUEVO Endpoint para obtener predicciones de popularidad generales.
    Este es un cálculo más pesado y no debe ser llamado en cada búsqueda de usuario.
    """
    try:
        # Rutas a los archivos de datos
        base_path = os.path.dirname(__file__)
        courses_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'courses.json'))
        topics_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'topics.json'))
        sections_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'sections.json'))
        careers_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'careers.json'))
        analytics_path = os.path.abspath(os.path.join(base_path, '..', 'infrastructure', 'database', 'analytics.json'))

        # Cargar datos de cursos y temas
        courses_list = load_json_data(courses_path) or []
        topics_list = load_json_data(topics_path) or []

        sections_list = load_json_data(sections_path) or []
        careers_list = load_json_data(careers_path) or []
        if not courses_list:
            return jsonify({"error": "No se pudieron cargar los datos de los cursos."}), 500

        # ✅ SOLUCIÓN: Aplicar el mismo patrón de carga inmutable que en /recommendations.
        # Esto evita la mutación de datos en memoria que causaba la contaminación.
        courses_df = pd.DataFrame(courses_list)
        if topics_list:
            topics_map = {topic['id']: topic['name'] for topic in topics_list}
            def get_topic_names(topic_ids):
                if not isinstance(topic_ids, list): return []
                return [topics_map.get(tid) for tid in topic_ids if tid in topics_map]
            courses_df['topics'] = courses_df['topicIds'].apply(get_topic_names)

        # ✅ LÓGICA DE ENRIQUECIMIENTO DE DATOS: Añadir la columna 'careers' también para analytics
        if sections_list and careers_list:
            sections_by_course_id = {}
            for section in sections_list:
                sections_by_course_id.setdefault(section.get('courseId'), []).append(section)
            
            careers_map = {career['id']: career['name'] for career in careers_list}

            def get_course_careers(course_id):
                course_sections = sections_by_course_id.get(course_id, [])
                all_career_names = set()
                for section in course_sections:
                    for career_id in section.get('careerIds', []):
                        if career_id in careers_map:
                            all_career_names.add(careers_map[career_id])
                return list(all_career_names)
            courses_df['careers'] = courses_df['id'].apply(get_course_careers)

        # Cargar y procesar datos de analytics para tendencias
        analytics_data = load_json_data(analytics_path)
        search_history = analytics_data.get('searchHistory', [])
        trends_counts = {}
        for record in search_history:
            q = record.get('query')
            if q: trends_counts[q] = trends_counts.get(q, 0) + 1
        trends_list = [{'query': q, 'count': c} for q, c in trends_counts.items()]
        trends_df = pd.DataFrame(trends_list) if trends_list else pd.DataFrame(columns=['query', 'count'])

        # Calcular las predicciones de popularidad
        popular_course = popular_course_predictor.predict(courses_df, trends_df)
        popular_topic = popular_topic_predictor.predict(courses_df, trends_df)

        return jsonify({
            "popularCourse": popular_course,
            "popularTopic": popular_topic
        })

    except Exception as e:
        print(f"Error en /analytics/trends: {e}")
        return jsonify({"error": "Ocurrió un error al procesar las tendencias."}), 500


if __name__ == '__main__':
    # El puerto 5000 es estándar para Flask
    app.run(debug=True, port=5000)
