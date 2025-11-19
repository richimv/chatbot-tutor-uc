# ml_service/predictors/popular_topic_predictor.py
from ..utils import normalize_text
import nltk
import pandas as pd

def predict(courses_df, trends_df):
    """
    Predice el tema más popular basado en las tendencias de búsqueda,
    excluyendo los nombres de los cursos.
    """
    if trends_df.empty or courses_df.empty:
        return {"predictedTopic": None, "confidence": 0, "reason": "Sin datos suficientes", "searchCount": 0}

    # ✅ CORRECTION: The column is 'name', not 'nombre'
    all_course_names_normalized = set(courses_df['name'].apply(normalize_text))

    topic_scores = {}
    # Palabras comunes a ignorar en las búsquedas para encontrar "temas"
    # ✅ MEJORA: Añadir más palabras de relleno para obtener temas más limpios.
    filler_words = {
        'quiero', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las',
        'que', 'es', 'explicame', 'como', 'funciona', 'necesito', 'informacion', 'dame', 'acerca', 'del', 'tema',
        'qué', 'cómo', 'información', 'podrias', 'de', 'y', 'o', 'a', 'en', 'con', 'por', 'sin', 'ayuda', 'horario', 'docente'
    }

    # 1. Filtrar búsquedas que no son nombres de cursos
    for _, trend in trends_df.iterrows():
        normalized_query = normalize_text(trend['query'])
        if normalized_query not in all_course_names_normalized:
            # 2. Extraer conceptos (n-gramas), pero de forma más inteligente.
            words = normalized_query.split()
            if len(words) > 1: # Solo procesar si hay más de una palabra
                # Generar bigramas (pares) y trigramas (tríos)
                bigrams = [' '.join(gram) for gram in nltk.bigrams(words)]
                trigrams = [' '.join(gram) for gram in nltk.ngrams(words, 3)]
                
                # Un concepto es válido si NO empieza o termina con una palabra de relleno.
                for concept in bigrams + trigrams:
                    if not concept.split()[0] in filler_words and not concept.split()[-1] in filler_words:
                        topic_scores[concept] = topic_scores.get(concept, 0) + trend['count']

    if not topic_scores:
        return {"predictedTopic": None, "confidence": 0, "reason": "No se encontraron temas populares.", "searchCount": 0}

    top_topic_name = max(topic_scores, key=topic_scores.get)
    top_score = topic_scores[top_topic_name]
    total_score_sum = sum(topic_scores.values())

    # --- Lógica de Confianza Definitiva (Softmax) ---
    # Convierte las puntuaciones en una distribución de probabilidad.
    if total_score_sum > 0:
        max_score = max(topic_scores.values())
        exp_scores = {name: pow(2.71828, score - max_score) for name, score in topic_scores.items()}
        sum_exp_scores = sum(exp_scores.values())
        confidence = exp_scores[top_topic_name] / sum_exp_scores
    else:
        confidence = 0

    # Contar las búsquedas que contienen el tema ganador
    search_count = 0
    if not trends_df.empty:
        search_count = trends_df[trends_df['query'].str.contains(top_topic_name, case=False, na=False)]['count'].sum()

    result = {
        "predictedTopic": top_topic_name.capitalize(),
        "confidence": min(confidence, 0.90),
        "reason": f"Basado en {top_score} menciones en búsquedas.",
        "searchCount": int(search_count)
    }

    # ✅ CORRECCIÓN FINAL: Limpiar cualquier posible valor NaN del diccionario de resultados.
    # Esto convierte los NaN a None, que se serializa a 'null' en JSON.
    return {k: (v if pd.notna(v) else None) for k, v in result.items()}