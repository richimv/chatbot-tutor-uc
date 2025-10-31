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
    # --- Estrategia 1: Recomendaciones Contextuales (si hay resultados directos) ---
    if direct_results_ids:
        source_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        candidate_courses = courses_df[~courses_df['id'].isin(direct_results_ids)].copy()

        # --- Nivel 1: Búsqueda por Temas Compartidos (la señal más fuerte) ---
        source_topic_names = {normalize_text(t) for t in source_courses['topics'].explode().dropna()}
        if source_topic_names:
            candidate_courses['topic_score'] = candidate_courses['topics'].apply(
                lambda topics: len(source_topic_names.intersection({normalize_text(t) for t in topics if isinstance(t, str)})) if isinstance(topics, list) else 0
            )
            top_topic_matches = candidate_courses[candidate_courses['topic_score'] > 0]
            if not top_topic_matches.empty:
                print("✅ Recomendación Nivel 1: Por temas compartidos.")
                return top_topic_matches.sort_values('topic_score', ascending=False)['name'].head(2).tolist()

        # --- Nivel 2: Búsqueda por Carreras Compartidas (si no hay temas en común) ---
        source_career_names = {normalize_text(c) for c in source_courses['careers'].explode().dropna()}
        if source_career_names:
            candidate_courses['career_score'] = candidate_courses['careers'].apply(
                lambda careers: len(source_career_names.intersection({normalize_text(c) for c in careers if isinstance(c, str)})) if isinstance(careers, list) else 0
            )
            top_career_matches = candidate_courses[candidate_courses['career_score'] > 0]
            if not top_career_matches.empty:
                print("✅ Recomendación Nivel 2: Por carreras compartidas.")
                # Esto conectará "Programación" con "Desarrollo Web"
                return top_career_matches.sort_values('career_score', ascending=False)['name'].head(2).tolist()

    # --- Estrategia de Respaldo (si no hay contexto o no se encontraron recomendaciones) ---
    print("⚠️ Usando estrategia de respaldo por palabras clave.")
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}
    if not query_keywords:
        return []

    # Usar todos los cursos como candidatos si la estrategia de temas falló
    candidate_courses_fallback = courses_df[~courses_df['id'].isin(direct_results_ids)].copy()
    course_scores = {}
    for _, course in candidate_courses_fallback.iterrows():
        course_name = course.get('name', '')
        topic_names = [t for t in course.get('topics', []) if isinstance(t, str)]
        course_content_text = normalize_text(course_name + ' ' + ' '.join(topic_names))
        course_keywords = {stemmer.stem(w) for w in course_content_text.split() if w}
        
        score = len(query_keywords.intersection(course_keywords))

        course_name_stems = {stemmer.stem(w) for w in normalize_text(course_name).split() if w}
        if query_keywords.intersection(course_name_stems):
            score += 10 # Un bonus significativo que hace la diferencia.

        if score > 0:
            if 'humana' in normalize_text(course_name) and 'sistema' in normalized_query:
                score *= 0.1 # Reducir drásticamente el score.
            
            course_scores[course['name']] = score # Usar el nombre del curso como clave

    # --- 3. Devolver Resultados ---
    sorted_courses = sorted(course_scores.items(), key=lambda item: item[1], reverse=True)
    return [course_name for course_name, score in sorted_courses[:2]]
