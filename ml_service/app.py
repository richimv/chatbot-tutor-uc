# ml_service/app.py
import pandas as pd
from flask import Flask, request, jsonify
import nltk
import requests # ✅ 1. Importar la librería para hacer peticiones HTTP

# Usamos importaciones relativas para que Python encuentre los módulos dentro del paquete ml_service
from .predictors import popular_course_predictor, popular_topic_predictor, related_course_predictor, related_topic_predictor

app = Flask(__name__)
NODE_API_URL = "http://localhost:3000" # ✅ 2. Definir la URL de nuestro servidor Node.js

# --- Inicialización de recursos al arrancar ---
# Descargar los recursos de NLTK si no existen (solo la primera vez que se inicia el servidor)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    print("Descargando recursos de NLTK ('punkt')...")
    nltk.download('punkt')


# --- Endpoint de la API ---

@app.route('/recommendations', methods=['POST'])
def handle_recommendations():
    """
    Endpoint de RECOMENDACIONES. Recibe una consulta y un contexto (resultados directos)
    y devuelve recomendaciones de cursos y temas relacionados.
    """
    try:
        # Obtener datos de la petición
        data = request.get_json()
        query = data.get('query', '')
        direct_results_ids = data.get('directResultsIds', [])

        # ✅ SOLUCIÓN: Cargar datos del catálogo desde la API de Node.js
        try:
            print("🧠 ML Service: Obteniendo datos del catálogo desde la API de Node.js...")
            courses_res = requests.get(f"{NODE_API_URL}/api/courses")
            topics_res = requests.get(f"{NODE_API_URL}/api/topics")
            sections_res = requests.get(f"{NODE_API_URL}/api/sections")
            careers_res = requests.get(f"{NODE_API_URL}/api/careers")
            
            courses_list = courses_res.json()
            topics_list = topics_res.json()
            sections_list = sections_res.json()
            careers_list = careers_res.json()
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener datos del catálogo desde Node.js: {e}")
            return jsonify({"error": "No se pudieron cargar los datos del catálogo."}), 500

        if not courses_list:
            return jsonify({"error": "No se pudieron cargar los datos de los cursos."}), 500

        # ✅ SOLUCIÓN ARQUITECTURAL: Cargar y procesar los datos en cada petición.
        # Esto evita la "contaminación de datos" entre llamadas, que era la causa raíz del error.
        courses_df = pd.DataFrame(courses_list)
        topics_df = pd.DataFrame(topics_list if topics_list else [])

        # --- LÓGICA DE ENRIQUECIMIENTO DE DATOS (VERSIÓN FINAL Y ROBUSTA) ---
        if topics_list:
            topics_map = {topic['id']: topic['name'] for topic in topics_list}
            def get_topic_names(topic_ids):
                if not isinstance(topic_ids, list): return []
                return [topics_map.get(tid) for tid in topic_ids if tid in topics_map]
            courses_df['topics'] = courses_df['topicIds'].apply(get_topic_names)

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

        # ✅ CORRECCIÓN FINAL Y DEFINITIVA: Reemplazar cualquier NaN que se haya generado
        # durante el enriquecimiento de datos. Esto asegura que los predictores reciban datos limpios.
        courses_df = courses_df.where(pd.notnull(courses_df), None)
        topics_df = topics_df.where(pd.notnull(topics_df), None)

        # --- Lógica de Recomendación ---
        # Los predictores solo se ejecutan si hay un contexto (direct_results_ids).
        course_recommendations = related_course_predictor.predict(query, direct_results_ids, courses_df)
        topic_recommendations = related_topic_predictor.predict(query, direct_results_ids, courses_df, topics_df)

        return jsonify({
            "relatedCourses": course_recommendations,
            "relatedTopics": topic_recommendations
        })

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
        # ✅ SOLUCIÓN: Cargar datos del catálogo desde la API de Node.js
        try:
            print("🧠 ML Service (Trends): Obteniendo datos del catálogo desde la API de Node.js...")
            courses_res = requests.get(f"{NODE_API_URL}/api/courses")
            topics_res = requests.get(f"{NODE_API_URL}/api/topics")
            sections_res = requests.get(f"{NODE_API_URL}/api/sections")
            careers_res = requests.get(f"{NODE_API_URL}/api/careers")

            courses_list = courses_res.json()
            topics_list = topics_res.json()
            sections_list = sections_res.json()
            careers_list = careers_res.json()
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener datos del catálogo desde Node.js: {e}")
            return jsonify({"error": "No se pudieron cargar los datos del catálogo."}), 500

        if not courses_list:
            return jsonify({"error": "No se pudieron cargar los datos de los cursos."}), 500

        # ✅ 3. Cargar datos de analytics desde la API de Node.js
        try:
            response = requests.get(f"{NODE_API_URL}/api/internal/analytics-data")
            response.raise_for_status() # Lanza un error si la respuesta no es 2xx
            analytics_data = response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener datos de analítica desde Node.js: {e}")
            return jsonify({"error": "No se pudieron cargar los datos de analítica."}), 500

        search_history = analytics_data.get('searchHistory', [])
        trends_counts = {}
        for record in search_history:
            q = record.get('query')
            if q: trends_counts[q] = trends_counts.get(q, 0) + 1
        trends_list = [{'query': q, 'count': c} for q, c in trends_counts.items()]
        trends_df = pd.DataFrame(trends_list) if trends_list else pd.DataFrame(columns=['query', 'count'])

        # ✅ SOLUCIÓN: Aplicar el mismo patrón de carga inmutable que en /recommendations.
        courses_df = pd.DataFrame(courses_list)
        if topics_list:
            topics_map = {topic['id']: topic['name'] for topic in topics_list}
            def get_topic_names(topic_ids):
                if not isinstance(topic_ids, list): return []
                return [topics_map.get(tid) for tid in topic_ids if tid in topics_map]
            courses_df['topics'] = courses_df['topicIds'].apply(get_topic_names)

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
