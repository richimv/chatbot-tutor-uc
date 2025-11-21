# ml_service/predictors/popular_course_predictor.py
import pandas as pd
from ..utils import normalize_text

def predict(courses_df, trends_df):
    """
    Predice el curso más popular basado en las tendencias de búsqueda.
    """
    if trends_df.empty or courses_df.empty:
        return {"predictedCourse": None, "confidence": 0, "reason": "Sin datos suficientes", "searchCount": 0}

    course_scores = {}
    trends_copy = trends_df.copy()
    trends_copy['normalized_query'] = trends_copy['query'].apply(normalize_text)

    for _, course in courses_df.iterrows():
        course_name = course['name']
        normalized_course_name = normalize_text(course_name)
        
        if not normalized_course_name:
            continue
            
        # 1. Coincidencia Exacta o Parcial con el Nombre (Peso Alto)
        # "Sistemas Operativos" en "Examen de Sistemas Operativos"
        name_matches = trends_copy[trends_copy['normalized_query'].str.contains(normalized_course_name, na=False)]
        score = name_matches['count'].sum() * 5 

        # 2. Coincidencia con Temas del Curso (Peso Medio)
        if 'topics' in course and isinstance(course['topics'], list):
            for topic in course['topics']:
                if isinstance(topic, str):
                    normalized_topic = normalize_text(topic)
                    if normalized_topic:
                        topic_matches = trends_copy[trends_copy['normalized_query'].str.contains(normalized_topic, na=False)]
                        score += topic_matches['count'].sum() * 1
        
        if score > 0:
            course_scores[course_name] = score

    if not course_scores:
        return {"predictedCourse": None, "confidence": 0, "reason": "No se encontraron coincidencias.", "searchCount": 0}

    top_course_name = max(course_scores, key=course_scores.get)
    top_score = course_scores[top_course_name]
    total_score_sum = sum(course_scores.values())
    
    # Calcular confianza
    if total_score_sum > 0:
        confidence = top_score / total_score_sum
    else:
        confidence = 0

    # Contar búsquedas reales
    normalized_top_course = normalize_text(top_course_name)
    search_count = trends_copy[trends_copy['normalized_query'].str.contains(normalized_top_course, na=False)]['count'].sum()

    result = {
        "predictedCourse": top_course_name,
        "confidence": min(confidence + 0.1, 0.98),
        "reason": f"Basado en una puntuación de popularidad de {int(top_score)}.",
        "searchCount": int(search_count)
    }

    return {k: (v if pd.notna(v) else None) for k, v in result.items()}