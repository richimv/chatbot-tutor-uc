# ml_service/predictors/popular_course_predictor.py
from ..utils import normalize_text

def predict(courses_df, trends_df):
    """
    Predice el curso más popular basado en las tendencias de búsqueda.
    """
    if trends_df.empty or courses_df.empty:
        return {"predictedCourse": None, "confidence": 0, "reason": "Sin datos suficientes", "searchCount": 0}

    course_scores = {}
    # Crear una copia para no modificar el DataFrame original
    trends_copy = trends_df.copy()
    trends_copy['normalized_query'] = trends_copy['query'].apply(normalize_text)

    for _, course in courses_df.iterrows():
        course_name = course['nombre']
        normalized_course_name = normalize_text(course_name)
        
        # Puntuación por coincidencia con el nombre del curso (muy alta)
        name_matches = trends_copy[trends_copy['normalized_query'].str.contains(normalized_course_name, na=False)]
        score = name_matches['count'].sum() * 5  # Multiplicador alto para el nombre

        # Puntuación por coincidencia con los temas del curso (menor)
        if 'temas' in course and isinstance(course['temas'], list):
            for topic in course['temas']:
                normalized_topic = normalize_text(topic)
                if normalized_topic:
                    topic_matches = trends_copy[trends_copy['normalized_query'].str.contains(normalized_topic, na=False)]
                    score += topic_matches['count'].sum()
        
        if score > 0:
            course_scores[course_name] = score

    if not course_scores:
        return {"predictedCourse": None, "confidence": 0, "reason": "No se encontraron coincidencias.", "searchCount": 0}

    top_course_name = max(course_scores, key=course_scores.get)
    top_score = course_scores[top_course_name]
    total_score_sum = sum(course_scores.values())
    
    # --- Lógica de Confianza Definitiva (Softmax) ---
    # Esta técnica convierte las puntuaciones en una distribución de probabilidad,
    # amplificando la confianza del ganador si es claramente dominante.
    if total_score_sum > 0:
        # Normalizamos las puntuaciones para evitar overflow en la exponencial
        max_score = max(course_scores.values())
        exp_scores = {name: pow(2.71828, score - max_score) for name, score in course_scores.items()}
        sum_exp_scores = sum(exp_scores.values())
        confidence = exp_scores[top_course_name] / sum_exp_scores
    else:
        confidence = 0

    # Contar las búsquedas que contribuyeron a la puntuación del curso ganador
    normalized_top_course = normalize_text(top_course_name)
    search_count = trends_copy[trends_copy['normalized_query'].str.contains(normalized_top_course, na=False)]['count'].sum()

    return {
        "predictedCourse": top_course_name,
        "confidence": min(confidence, 0.95),
        "reason": f"Basado en una puntuación de popularidad de {int(top_score)}.",
        "searchCount": int(search_count)
    }