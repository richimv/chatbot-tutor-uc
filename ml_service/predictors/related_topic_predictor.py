# ml_service/predictors/related_topic_predictor.py
import sys
import json
import pandas as pd
from ml_service.utils import normalize_text
from nltk.stem.snowball import SnowballStemmer

# --- Inicialización ---
stemmer = SnowballStemmer('spanish')

def predict(query, direct_results_ids, courses_df):
    """
    Encuentra temas relacionados utilizando una estrategia híbrida y contextual.
    1. (Prioridad Alta) Recomienda los temas de los cursos encontrados en la búsqueda directa.
    2. (Respaldo) Si no hay resultados directos, busca temas que coincidan con las palabras clave de la consulta.
    """
    # --- 1. Preparación de la Consulta ---
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}
    if not query_keywords:
        return []

    # --- Estrategia 1: Recomendaciones Contextuales (si hay resultados directos) ---
    if direct_results_ids:
        source_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        if not source_courses.empty:
            # Usamos 'explode' para convertir la lista de listas de temas en una sola serie
            # y 'dropna' y 'unique' para obtener una lista limpia de nombres de temas.
            contextual_topics = source_courses['topics'].explode().dropna().unique().tolist()
            if contextual_topics:
                # Si encontramos temas contextuales, los devolvemos y terminamos.
                return contextual_topics[:3]

    # --- Estrategia 2: Respaldo por Palabra Clave (si la Estrategia 1 falla) ---
    recommended_topics = set()
    all_topics_flat = courses_df['topics'].explode().dropna().unique()
    
    for topic_name in all_topics_flat:
        topic_keywords = {stemmer.stem(w) for w in normalize_text(topic_name).split() if w}
        if query_keywords.intersection(topic_keywords): # Si hay coincidencia de palabras clave
            recommended_topics.add(topic_name)

    # --- 4. Filtrado y Devolución ---
    # Excluir temas que sean idénticos a la consulta para evitar redundancia.
    final_topics = {t for t in recommended_topics if normalize_text(t) != normalized_query}
    return list(final_topics)[:3]