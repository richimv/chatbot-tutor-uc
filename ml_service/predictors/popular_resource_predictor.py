import pandas as pd
import numpy as np
import math
import re
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from ..utils import normalize_text

def calculate_decay_weight(date_obj, lambda_val=0.05):
    """
    Calcula el peso basado en decaimiento exponencial.
    """
    try:
        if isinstance(date_obj, str):
            date_obj = pd.to_datetime(date_obj)
        
        now = datetime.now()
        if isinstance(date_obj, pd.Timestamp):
            date_obj = date_obj.to_pydatetime()
            
        if date_obj.tzinfo:
            date_obj = date_obj.replace(tzinfo=None)
            
        days_diff = (now - date_obj).days
        if days_diff < 0: days_diff = 0
        
        weight = math.exp(-lambda_val * days_diff)
        return weight
    except Exception as e:
        return 0.1

def tokenize_to_set(text):
    if not isinstance(text, str): return set()
    norm_text = normalize_text(text)
    words = norm_text.split()
    return {w for w in words if len(w) > 3}

def calculate_jaccard_similarity(set1, set2):
    if not set1 or not set2: return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def predict(books_df, trends_df, book_embeddings, model):
    """
    Predice el libro más popular usando tendencias de búsqueda.
    """
    print(f"\n--- 🕵️ AUDITORÍA ML: TENDENCIAS DE LIBROS ---")
    
    if trends_df.empty or books_df.empty or book_embeddings is None:
        return {"predictedBook": None, "confidence": 0, "reason": "Sin datos"}

    # 1. Preparar Scores
    book_scores = np.zeros(len(books_df))
    book_counts = np.zeros(len(books_df))
    
    # 2. Agrupar Queries
    unique_queries = []
    query_weights = []
    query_raw_counts = []

    for _, row in trends_df.iterrows():
        query = row['query']
        dates = row.get('dates', [])
        
        if not query: continue

        total_weight = 0.0
        if isinstance(dates, list):
            for d in dates: total_weight += calculate_decay_weight(d)
        else:
            total_weight = row.get('count', 1) * 0.1

        unique_queries.append(query)
        query_weights.append(total_weight)
        query_raw_counts.append(row.get('count', 0))

    if not unique_queries:
        return {"predictedBook": None, "confidence": 0, "reason": "Sin queries válidas"}

    # 3. Vectorización
    query_embeddings = model.encode(unique_queries)

    # 4. Similitud Semántica
    similarity_matrix = cosine_similarity(query_embeddings, book_embeddings)

    # 5. Asignación de Puntos
    SEMANTIC_THRESHOLD = 0.50 

    for i, query_text in enumerate(unique_queries):
        scores = similarity_matrix[i]
        best_book_idx = np.argmax(scores)
        best_similarity = scores[best_book_idx]
        
        candidate_book_name = books_df.iloc[best_book_idx]['name']
        
        # Filtro Jaccard
        query_tokens = tokenize_to_set(query_text)
        book_tokens = tokenize_to_set(candidate_book_name)
        jaccard_score = calculate_jaccard_similarity(query_tokens, book_tokens)
        
        impact = 0
        if jaccard_score >= 0.3: # Umbral más bajo para libros
             impact = query_weights[i] * 5.0
        elif best_similarity > SEMANTIC_THRESHOLD:
             impact = query_weights[i] * best_similarity

        if impact > 0:
            book_scores[best_book_idx] += impact
            book_counts[best_book_idx] += query_raw_counts[i]

    # 6. Determinar Ganador
    best_idx = np.argmax(book_scores)
    top_score = book_scores[best_idx]
    top_book_name = books_df.iloc[best_idx]['name']
    
    # 7. Calcular Confianza
    confidence = min(1.0, math.log1p(top_score) / 4.0)
    if top_score < 3.0: confidence *= 0.5 

    print(f"🏆 LIBRO TOP: {top_book_name} (Score: {top_score:.2f})")
    
    return {
        "predictedBook": top_book_name if top_score > 0.5 else None,
        "confidence": round(confidence, 2),
        "reason": f"Popularidad en {int(book_counts[best_idx])} búsquedas."
    }
