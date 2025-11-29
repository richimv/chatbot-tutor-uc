# ml_service/predictors/popular_topic_predictor.py
import pandas as pd
import numpy as np
import math
import re
from datetime import datetime
from unidecode import unidecode
from sklearn.metrics.pairwise import cosine_similarity

def calculate_decay_weight(date_obj, lambda_val=0.01): 
    try:
        if isinstance(date_obj, str): date_obj = pd.to_datetime(date_obj)
        now = datetime.now()
        if isinstance(date_obj, pd.Timestamp): date_obj = date_obj.to_pydatetime()
        if date_obj.tzinfo: date_obj = date_obj.replace(tzinfo=None)
        days_diff = (now - date_obj).days
        if days_diff < 0: days_diff = 0
        return math.exp(-lambda_val * days_diff)
    except: return 0.1

def tokenize_to_set(text):
    """
    Normaliza y tokeniza el texto eliminando stopwords.
    """
    if not isinstance(text, str): return set()
    
    # 1. Normalización (minúsculas y sin acentos)
    text = unidecode(text.lower())
    
    # 2. Eliminar caracteres no alfanuméricos
    text = re.sub(r'[^a-z0-9\s]', '', text)
    
    # 3. Stopwords (Lista negra)
    stopwords = {
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'de', 'del', 'al', 'y', 'o', 'en', 'por', 'para', 'con',
        'sobre', 'entre', 'sin', 'curso', 'tema', 'clase', 'taller',
        'ejercicios', 'problemas', 'resueltos', 'teoria', 'introduccion'
    }
    
    words = text.split()
    return {w for w in words if w not in stopwords and len(w) > 1}

def calculate_jaccard_similarity(set1, set2):
    """
    Calcula la similitud de Jaccard entre dos conjuntos de tokens.
    """
    if not set1 or not set2: return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def predict(courses_df, trends_df, topics_df, topic_embeddings, model):
    print(f"\n--- 🕵️ AUDITORÍA ML: TENDENCIAS DE TEMAS (V8 STRICT ORDER) ---")
    
    if trends_df.empty or topics_df.empty or topic_embeddings is None:
        return {"predictedTopic": None, "confidence": 0, "reason": "Sin datos"}

    topic_scores = np.zeros(len(topics_df))
    topic_counts = np.zeros(len(topics_df))
    
    unique_queries = []
    query_weights = []
    query_raw_counts = []

    # 1. Preprocesamiento
    for _, row in trends_df.iterrows():
        query = row['query']
        if not query: continue
        
        dates = row.get('dates', [])
        total_weight = 0.0
        if isinstance(dates, list):
            for d in dates: total_weight += calculate_decay_weight(d)
        else:
            total_weight = row.get('count', 1) * 0.1

        unique_queries.append(query)
        query_weights.append(total_weight)
        query_raw_counts.append(row.get('count', 0))

    if not unique_queries: return {"predictedTopic": None, "confidence": 0, "reason": "Sin queries"}

    # 2. Vectorización
    query_embeddings = model.encode(unique_queries)
    similarity_matrix = cosine_similarity(query_embeddings, topic_embeddings)
    
    for i, query_text in enumerate(unique_queries):
        scores = similarity_matrix[i]
        best_topic_idx = np.argmax(scores)
        best_similarity = scores[best_topic_idx]
        
        candidate_topic_name = topics_df.iloc[best_topic_idx]['name']
        
        # --- LÓGICA V8: ORDEN DE PRECEDENCIA CORREGIDO ---
        
        impact = 0
        
        # 1. Tokenización Avanzada
        query_tokens = tokenize_to_set(query_text)
        topic_tokens = tokenize_to_set(candidate_topic_name)
        
        # 2. Cálculo de Jaccard
        jaccard_score = calculate_jaccard_similarity(query_tokens, topic_tokens)
        
        # 3. Reglas de Puntuación (El orden importa: Filtros primero, Boosts después)
        
        # Regla A: FILTRO DE CONTENCIÓN (Veto a genéricos)
        # Si el tema es más específico (más tokens) y la query es un subconjunto estricto.
        # Ej: Query="programacion" (1) vs Topic="Programación Dinámica" (2) -> VETO
        is_subset = len(topic_tokens) > len(query_tokens) and query_tokens.issubset(topic_tokens)
        
        if is_subset:
             impact = 0.0
             # print(f"   ⛔ Veto por Generalidad: '{query_text}' es subconjunto de '{candidate_topic_name}'")
        
        # Regla B: Match EXACTO (Prioridad Absoluta)
        # Solo si NO fue vetado (aunque el veto mata subsets, el exacto requiere igualdad o superconjunto query)
        else:
            norm_query = unidecode(query_text.lower())
            norm_topic = unidecode(candidate_topic_name.lower())
            
            # Match literal o Query contiene al Topic (al revés del veto)
            # Ej: "tasa de interes nominal" (query) vs "tasa de interes" (topic) -> OK
            if norm_query == norm_topic or (len(norm_query) > len(norm_topic) and norm_topic in norm_query):
                 impact = query_weights[i] * 10.0
                 # print(f"   🚀 Match Exacto: '{query_text}' -> '{candidate_topic_name}'")

            # Regla C: Match Jaccard Alto
            elif jaccard_score >= 0.8:
                impact = query_weights[i] * 5.0
                
            # Regla D: Match Semántico con Veto Jaccard
            elif best_similarity > 0.6: 
                if jaccard_score < 0.2:
                    impact = 0.0 # Veto semántico sin palabras clave
                else:
                    impact = query_weights[i] * best_similarity
        
        if impact > 0:
            topic_scores[best_topic_idx] += impact
            topic_counts[best_topic_idx] += query_raw_counts[i]

    # 3. Determinar Ganador
    best_idx = np.argmax(topic_scores)
    top_score = topic_scores[best_idx]
    top_topic_name = topics_df.iloc[best_idx]['name']

    # 4. Confianza
    confidence = 0.0
    if top_score > 0.1:
        volume = min(1.0, math.log1p(top_score) / 5.0) 
        confidence = volume 

    print(f"🏆 TEMA GANADOR: {top_topic_name} (Score: {top_score:.2f})")

    return {
        "predictedTopic": top_topic_name if top_score > 1.0 else None,
        "confidence": round(confidence, 2),
        "searchCount": int(topic_counts[best_idx]),
        "reason": f"Tendencia basada en {int(topic_counts[best_idx])} búsquedas directas."
    }