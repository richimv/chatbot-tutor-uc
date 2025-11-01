import sys
import json
import pandas as pd
from ml_service.utils import normalize_text
from nltk.stem.snowball import SnowballStemmer

stemmer = SnowballStemmer('spanish')

def predict(query, direct_results_ids, courses_df):
    """
    Encuentra cursos relacionados utilizando una estrategia híbrida y robusta.
    1. (Prioridad Alta) Si hay resultados directos, busca otros cursos que compartan temas.
    2. (Respaldo) Si no, busca cursos que coincidan con las palabras clave de la consulta.
    """
    # --- Preparación de la Consulta (se usará en ambas estrategias) ---
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}
    if not query_keywords:
        return []

    # --- Estrategia 1: Recomendaciones Contextuales (si hay resultados directos) ---
    # ✅ SOLUCIÓN ARQUITECTÓNICA: El predictor AHORA solo se ejecuta si hay contexto.
    # Si hay 'direct_results_ids', procede a recomendar. Si no, no hace nada.
    if direct_results_ids:
        # ✅ SOLUCIÓN FINAL: Si el contexto es demasiado amplio (más de 3 cursos),
        # la recomendación contextual no tiene sentido y solo introduce ruido.
        # Devolvemos una lista vacía para evitar recomendaciones irrelevantes.
        if len(direct_results_ids) > 3:
            return []

        source_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        candidate_courses = courses_df[~courses_df['id'].isin(direct_results_ids)].copy()

        # --- LÓGICA DE RECOMENDACIÓN HÍBRIDA Y PONDERADA ---
        course_scores = {}
        source_topic_names = {normalize_text(t) for t in source_courses['topics'].explode().dropna()}
        source_career_names = {normalize_text(c) for c in source_courses['careers'].explode().dropna()}
        source_name_keywords = {stemmer.stem(w) for w in source_courses['name'].apply(normalize_text).str.cat(sep=' ').split() if w}

        # --- Listas de palabras a ignorar para una puntuación más inteligente ---
        generic_careers = {'tronco comun', 'ciclo basico', 'estudios generales', 'humanidades'}
        title_stop_words = {stemmer.stem(w) for w in ['introduccion', 'fundamentos', 'i', 'ii', 'iii', 'iv', 'general', 'avanzado']}

        for _, course in candidate_courses.iterrows():
            course_name = course['name']

            # --- Calcular señales individuales ---
            course_topics = {normalize_text(t) for t in course.get('topics', []) if isinstance(t, str)}
            topic_matches = len(source_topic_names.intersection(course_topics))

            course_careers = {normalize_text(c) for c in course.get('careers', []) if isinstance(c, str)}
            specific_career_matches = len((source_career_names.intersection(course_careers)) - generic_careers)

            course_name_keywords = {stemmer.stem(w) for w in normalize_text(course_name).split() if w}
            # Ignorar palabras comunes en los títulos para la similitud de nombre
            name_matches = len((source_name_keywords.intersection(course_name_keywords)) - title_stop_words)

            # --- Puntuación Final Ponderada y con Bonificación ---
            score = (topic_matches * 10) + (specific_career_matches * 5) + (name_matches * 2)

            # ✅ BONIFICACIÓN POR COHERENCIA: Si coincide en múltiples dimensiones, es una gran recomendación.
            if topic_matches > 0 and specific_career_matches > 0:
                score *= 1.5 # Multiplicador de bonificación

            if specific_career_matches > 0 and name_matches > 0:
                score *= 1.2

            if score > 0:
                course_scores[course_name] = score

        # Ordenar y devolver los mejores resultados combinados
        sorted_courses = sorted(course_scores.items(), key=lambda item: item[1], reverse=True)
        return [course_name for course_name, score in sorted_courses[:2]]

    return []
