import pandas as pd
import numpy as np
import math
import re
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
# --- CORRECCIÓN DE IMPORTACIÓN ---
import sys
import os

# Agregamos la raíz del proyecto al path para poder importar 'ml_service'
# Esto funciona tanto para Flask como para el script batch
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

try:
    from ml_service.utils import normalize_text
except ImportError:
    # Fallback por si se ejecuta desde otra ubicación
    from utils import normalize_text
# ---------------------------------

def calculate_decay_weight(date_obj, lambda_val=0.05):
    """
    Calcula el peso basado en decaimiento exponencial.
    Fórmula: e^(-lambda * días_transcurridos)
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
    """
    Tokeniza el texto usando normalize_text y elimina stopwords.
    """
    if not isinstance(text, str): return set()
    
    # Usamos la utilidad existente para normalizar (minúsculas, sin acentos, alfanumérico)
    norm_text = normalize_text(text)
    
    # Stopwords para cursos (ajustado al contexto académico)
    stopwords = {
        'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'y', 'o', 'en', 
        'curso', 'taller', 'clase', 'introduccion', 'fundamentos', 'basico', 'avanzado',
        'teoria', 'practica', 'i', 'ii', 'iii', 'iv', 'v', '1', '2', '3' # Números romanos/arabigos comunes en nombres
    }
    
    words = norm_text.split()
    return {w for w in words if w not in stopwords and len(w) > 1}

def calculate_jaccard_similarity(set1, set2):
    if not set1 or not set2: return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def predict(courses_df, trends_df, course_embeddings, model):
    """
    Predice el curso más popular usando True ML + Lógica de Negocio Estricta (V3).
    """
    print(f"\n--- 🕵️ AUDITORÍA ML: TENDENCIAS DE CURSOS (V3 EXACTITUD) ---")
    
    if trends_df.empty or courses_df.empty or course_embeddings is None:
        print("⚠️ Datos insuficientes para predicción.")
        return {"predictedCourse": None, "confidence": 0, "reason": "Sin datos"}

    # 1. Preparar Scores
    course_scores = np.zeros(len(courses_df))
    course_counts = np.zeros(len(courses_df))
    
    # 2. Agrupar Queries
    unique_queries = []
    query_weights = []
    query_raw_counts = []

    print(f"📊 Procesando historial de búsquedas...")
    
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
        return {"predictedCourse": None, "confidence": 0, "reason": "Sin queries válidas"}

    # 3. Vectorización
    print(f"🧠 Vectorizando {len(unique_queries)} queries únicas...")
    query_embeddings = model.encode(unique_queries)

    # 4. Similitud Semántica
    similarity_matrix = cosine_similarity(query_embeddings, course_embeddings)

    # 5. Asignación de Puntos con Lógica "Winner-Takes-All" Modificada
    SEMANTIC_THRESHOLD = 0.50 

    for i, query_text in enumerate(unique_queries):
        scores = similarity_matrix[i]
        best_course_idx = np.argmax(scores)
        best_similarity = scores[best_course_idx]
        
        candidate_course_name = courses_df.iloc[best_course_idx]['name']
        
        # --- LÓGICA V3: FILTRO JACCARD & BOOST EXACTO ---
        
        impact = 0
        
        # Tokenización
        query_tokens = tokenize_to_set(query_text)
        course_tokens = tokenize_to_set(candidate_course_name)
        jaccard_score = calculate_jaccard_similarity(query_tokens, course_tokens)
        
        norm_query = normalize_text(query_text)
        norm_course = normalize_text(candidate_course_name)
        
        # CASO 1: Match Exacto o Muy Fuerte (Prioridad Absoluta)
        # Si la query está contenida en el nombre del curso (ej: "tasa de interes" en "Tasa de Interés")
        # O Jaccard es muy alto.
        is_substring_match = (len(norm_query) > 3 and norm_query in norm_course)
        
        if jaccard_score >= 0.5 or is_substring_match:
            # BOOST X5: Priorizamos el volumen directo.
            # Esto asegura que 70 búsquedas de "Tasa de Interés" valgan 350 puntos.
            impact = query_weights[i] * 5.0
            # print(f"   💎 Match Directo: '{query_text}' -> '{candidate_course_name}'")
            
        # CASO 2: Match Semántico (Solo si no es directo)
        elif best_similarity > SEMANTIC_THRESHOLD:
            # FILTRO ANTI-RUIDO:
            # Si no comparten NINGUNA palabra clave (Jaccard = 0), penalizamos severamente.
            # Esto evita que "Calculo" (80) sume a "Derivadas" (27) solo por cercanía vectorial.
            if jaccard_score < 0.01:
                # Si la similitud es EXTREMA (>0.85), permitimos un paso pequeño (sinónimos raros)
                if best_similarity > 0.85:
                    impact = query_weights[i] * best_similarity * 0.5
                else:
                    # BLOQUEO TOTAL: Son temas distintos.
                    impact = 0.0
                    # print(f"   ⛔ Bloqueo Semántico: '{query_text}' vs '{candidate_course_name}' (Sim: {best_similarity:.2f}, Jaccard: 0)")
            else:
                # Si comparten algo (Jaccard > 0), dejamos pasar el score semántico normal
                impact = query_weights[i] * best_similarity

        if impact > 0:
            course_scores[best_course_idx] += impact
            course_counts[best_course_idx] += query_raw_counts[i]

    # 6. Determinar Ganador
    best_idx = np.argmax(course_scores)
    top_score = course_scores[best_idx]
    top_course_name = courses_df.iloc[best_idx]['name']
    
    # 7. Calcular Confianza (Ajustada para V3)
    confidence = 0.0
    
    if top_score > 0.1:
        # Ordenar scores
        sorted_indices = np.argsort(course_scores)[::-1]
        score_1st = course_scores[sorted_indices[0]]
        score_2nd = course_scores[sorted_indices[1]] if len(course_scores) > 1 else 0.0
        
        # A. Dominancia
        if score_1st > 0:
            dominance = (score_1st - score_2nd) / score_1st
        else:
            dominance = 0.0
        
        # B. Volumen
        # Con el boost x5, los scores serán más altos. Ajustamos el divisor.
        # Antes / 6.0. Ahora / 4.0 para que 15 búsquedas (Score 75 -> log 4.3) den confianza alta.
        volume = min(1.0, math.log1p(top_score) / 4.0)
        
        # Ponderación
        # Si hay mucho volumen, confiamos más en el volumen que en la dominancia
        if volume > 0.8:
             confidence = (volume * 0.7) + (dominance * 0.3)
        else:
             confidence = (volume * 0.6) + (dominance * 0.4)

        if top_score < 5.0: confidence *= 0.5 

    print(f"🏆 GANADOR: {top_course_name} (Score: {top_score:.2f}, Confianza: {confidence:.2f})")
    
    return {
        "predictedCourse": top_course_name if top_score > 1.0 else None,
        "confidence": round(confidence, 2),
        "reason": f"Tendencia basada en {int(course_counts[best_idx])} búsquedas directas.",
        "searchCount": int(course_counts[best_idx])
    }