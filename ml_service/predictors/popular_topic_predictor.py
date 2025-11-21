# ml_service/predictors/popular_topic_predictor.py
import sys
import json
import pandas as pd
import re # ✅ Importar re para expresiones regulares
from ..utils import normalize_text

def predict(courses_df, trends_df, topics_df):
    """
    Predice el tema emergente más popular basado en las tendencias de búsqueda.
    Valida estrictamente contra la lista de temas existentes en la BD.
    """
    if trends_df.empty or topics_df.empty:
        return {"predictedTopic": None, "confidence": 0, "reason": "Sin datos suficientes", "searchCount": 0}

    topic_scores = {}
    trends_copy = trends_df.copy()
    trends_copy['normalized_query'] = trends_copy['query'].apply(normalize_text)

    for _, topic in topics_df.iterrows():
        topic_name = topic['name']
        normalized_topic_name = normalize_text(topic_name)
        
        if not normalized_topic_name:
            continue

        # ✅ MEJORA CRÍTICA: Usar límites de palabra (\b) para evitar coincidencias parciales falsas.
        # Ejemplo: Evita que el tema "Mac" coincida con la búsqueda "Macroeconomía".
        # Solo coincidirá si la búsqueda contiene "Mac" como palabra completa.
        try:
            escaped_name = re.escape(normalized_topic_name)
            pattern = fr"\b{escaped_name}\b"
            name_matches = trends_copy[trends_copy['normalized_query'].str.contains(pattern, regex=True, na=False)]
            score = name_matches['count'].sum() * 10
        except Exception:
            # Fallback seguro por si falla el regex
            name_matches = trends_copy[trends_copy['normalized_query'].str.contains(normalized_topic_name, na=False)]
            score = name_matches['count'].sum() * 5

        if score > 0:
            topic_scores[topic_name] = score

    if not topic_scores:
        return {"predictedTopic": None, "confidence": 0, "reason": "No se encontraron temas populares.", "searchCount": 0}

    top_topic_name = max(topic_scores, key=topic_scores.get)
    top_score = topic_scores[top_topic_name]
    total_score_sum = sum(topic_scores.values())

    # Calcular confianza (Softmax simplificado)
    if total_score_sum > 0:
        confidence = top_score / total_score_sum
    else:
        confidence = 0

    # Contar búsquedas reales para mostrar al usuario
    normalized_top_topic = normalize_text(top_topic_name)
    # Usar la misma lógica de conteo estricto para el reporte
    try:
        escaped_name = re.escape(normalized_top_topic)
        pattern = fr"\b{escaped_name}\b"
        search_count = trends_copy[trends_copy['normalized_query'].str.contains(pattern, regex=True, na=False)]['count'].sum()
    except:
        search_count = trends_copy[trends_copy['normalized_query'].str.contains(normalized_top_topic, na=False)]['count'].sum()

    result = {
        "predictedTopic": top_topic_name,
        "confidence": min(confidence + 0.2, 0.95), # Boost de confianza por ser un tema validado
        "reason": f"Tendencia basada en {int(search_count)} búsquedas relacionadas.",
        "searchCount": int(search_count)
    }

    return {k: (v if pd.notna(v) else None) for k, v in result.items()}