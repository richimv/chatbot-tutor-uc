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

        # Calcular puntuación por temas y carreras compartidos
        source_topic_names = {normalize_text(t) for t in source_courses['topics'].explode().dropna()}
        source_career_names = {normalize_text(c) for c in source_courses['careers'].explode().dropna()}

        def calculate_score(row):
            # Puntuación por temas compartidos (alta prioridad)
            candidate_topics = {normalize_text(t) for t in row['topics'] if isinstance(t, str)}
            topic_score = len(source_topic_names.intersection(candidate_topics)) * 5

            # Puntuación por carreras compartidas (prioridad media)
            candidate_careers = {normalize_text(c) for c in row['careers'] if isinstance(c, str)}
            career_score = len(source_career_names.intersection(candidate_careers)) * 2
            
            return topic_score + career_score

        candidate_courses['score'] = candidate_courses.apply(calculate_score, axis=1)
        
        top_matches = candidate_courses[candidate_courses['score'] > 0].sort_values('score', ascending=False)

        if not top_matches.empty:
            print(f"✅ Recomendación contextual encontrada. Puntuación máxima: {top_matches['score'].iloc[0]}")
            return top_matches['name'].head(2).tolist()

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
