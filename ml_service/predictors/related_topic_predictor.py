# ml_service/predictors/related_topic_predictor.py
import sys
import json
import pandas as pd
from ml_service.utils import normalize_text
from Levenshtein import distance as levenshtein_distance # Importar la función
from nltk.stem.snowball import SnowballStemmer

# --- Inicialización ---
stemmer = SnowballStemmer('spanish')

def predict(query, direct_results_ids, courses_df, topics_df):
    """
    Encuentra temas relacionados utilizando una estrategia híbrida y contextual.
    1. (Prioridad Alta) Recomienda los temas de los cursos encontrados en la búsqueda directa.
    2. (Respaldo) Si no hay resultados directos, busca temas que coincidan con las palabras clave de la consulta.
    """
    if topics_df.empty: return []
    # --- 1. Preparación de la Consulta ---
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}
    if not query_keywords:
        return []

    # --- Estrategia 1: Recomendaciones Contextuales (si hay resultados directos) ---
    contextual_topics = []
    if direct_results_ids:
        source_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        if not source_courses.empty:
            # Usamos 'explode' para convertir la lista de listas de temas en una sola serie
            # y 'dropna' y 'unique' para obtener una lista limpia de nombres de temas.
            contextual_topic_names = source_courses['topics'].explode().dropna().unique().tolist()
            # ✅ MEJORA: Buscar los objetos de tema completos a partir de los nombres
            if contextual_topic_names:
                contextual_topics = topics_df[topics_df['name'].isin(contextual_topic_names)].to_dict('records')
    
    if contextual_topics:
        return contextual_topics[:3] # Devuelve [{id, name}, ...]

    # --- Estrategia 2: Búsqueda por palabra clave con puntuación (si no hay contexto o la estrategia 1 no arrojó nada) ---
    topic_scores = {}
    for _, topic in topics_df.iterrows():
        score = 0
        topic_name = topic['name']
        normalized_topic_name = normalize_text(topic_name)
        topic_keywords = {stemmer.stem(w) for w in normalized_topic_name.split() if w}
        
        # Evitar recomendar la propia consulta como tema.
        if normalized_topic_name == normalized_query:
            continue

        # ✅ MEJORA DE INTELIGENCIA CONTEXTUAL: Añadir puntuación si el tema pertenece a cursos relevantes.
        # Buscamos todos los cursos que contienen este tema.
        relevant_courses = courses_df[courses_df['topics'].apply(lambda x: isinstance(x, list) and topic_name in x)]
        if not relevant_courses.empty:
            for _, course in relevant_courses.iterrows():
                # Extraer palabras clave del nombre y carreras del curso asociado
                course_name_keywords = {stemmer.stem(w) for w in normalize_text(course.get('name', '')).split() if w}
                course_careers_list = course.get('careers') if isinstance(course.get('careers'), list) else []
                course_careers_keywords = {stemmer.stem(w) for c in course_careers_list for w in normalize_text(c).split() if w}
                
                # Dar puntos si la consulta coincide con el nombre o carrera del curso que contiene este tema
                score += len(query_keywords.intersection(course_name_keywords)) * 2 # Puntuación indirecta

        # Puntuación por intersección de palabras clave
        # ✅ MEJORA DE BÚSQUEDA INTELIGENTE: Aumentar el peso de la coincidencia de palabras clave.
        score += len(query_keywords.intersection(topic_keywords)) * 5

        # ✅ MEJORA DE TOLERANCIA A ERRORES: Puntuación por similitud de Levenshtein.
        # Esto ayuda a que "programacionn" coincida con "programacion orientada a objetos".
        lev_dist = levenshtein_distance(normalized_query, normalized_topic_name)
        if lev_dist < 3:
            score += (3 - lev_dist) * 10

        # ✅ MEJORA CLAVE: Bonificación si la consulta está contenida en el nombre del tema.
        # Esto hace que "ingenieria" coincida con temas como "Ingenieria de Software".
        # Y "programacion" con "Programacion Orientada a Objetos".
        if normalized_query in normalized_topic_name and len(normalized_query) > 3:
            score += 20 # Bonificación alta por coincidencia parcial

        if score > 0:
            topic_scores[topic_name] = score

    # Ordenar y obtener los mejores resultados
    sorted_topics = sorted(topic_scores.items(), key=lambda item: item[1], reverse=True)
    top_topic_names = [topic_name for topic_name, score in sorted_topics[:4]]
    result_df = topics_df[topics_df['name'].isin(top_topic_names)]
    clean_df = result_df.where(pd.notnull(result_df), None)
    return clean_df.to_dict('records')