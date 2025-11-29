import pandas as pd
import numpy as np
import torch
from sentence_transformers import util
from ..utils import normalize_text

# Intentar importar Stemmer, si falla no es crítico
try:
    from nltk.stem.snowball import SnowballStemmer
    stemmer = SnowballStemmer('spanish')
except:
    stemmer = None

def predict(query, direct_results_ids, courses_df, topics_df, topic_embeddings=None, model=None):
    """
    Predictor de Temas Híbrido (True ML + Grafo de Conocimiento).
    Recomienda temas basados en:
    1. Contexto (Temas de los cursos encontrados).
    2. Semántica (Temas similares a la búsqueda).
    3. Relación Carrera-Tema.
    """
    if topics_df.empty: return []
    
    print(f"\n--- 🕵️ AUDITORÍA ML: RECOMENDACIÓN DE TEMAS ---")

    normalized_query = normalize_text(query)
    query_keywords = set()
    if stemmer:
        query_keywords = {stemmer.stem(w) for w in normalized_query.split() if len(w) > 2}

    # --- Estrategia 1: Recomendaciones Contextuales (Alta Confianza) ---
    # Si ya encontramos cursos directos (ej: "Curso de Java"), los temas de esos cursos son ORO.
    contextual_topics = []
    
    if direct_results_ids and len(direct_results_ids) > 0 and not courses_df.empty:
        source_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        
        if not source_courses.empty:
            # Extraer nombres de temas de los cursos encontrados
            # Asumimos que 'topics' es una lista de strings
            found_topics = set()
            for topics_list in source_courses['topics']:
                if isinstance(topics_list, list):
                    for t in topics_list:
                        if t: found_topics.add(t)
            
            if found_topics:
                # Filtrar del DF de temas
                contextual_matches = topics_df[topics_df['name'].isin(found_topics)].copy()
                if not contextual_matches.empty:
                    contextual_matches['confidence'] = 95 # Confianza casi total
                    contextual_topics = contextual_matches.to_dict('records')
                    print(f"🐍 Temas Contextuales encontrados: {len(contextual_topics)}")

    # Si tenemos suficientes temas contextuales (ej: > 2), devolvemos eso y listo.
    # Esto es "Precision" sobre "Recall".
    if len(contextual_topics) >= 2:
        return contextual_topics[:4]

    # --- Estrategia 2: Búsqueda Semántica (IA) ---
    semantic_scores = {}
    
    if topic_embeddings is not None and model is not None:
        # print(f"🧠 Calculando similitud semántica para temas...")
        
        # 1. Vectorizar Query
        query_vec = model.encode(query, convert_to_tensor=True)
        
        # 2. Calcular Similitud
        # topic_embeddings debe ser un tensor o ndarray
        if not isinstance(topic_embeddings, torch.Tensor):
            topic_embeddings = torch.tensor(topic_embeddings)
            
        # Similitud coseno
        cos_scores = util.cos_sim(query_vec, topic_embeddings)[0]
        
        # Mapear a índices del DF
        # Asumimos que el orden de topic_embeddings corresponde al índice de topics_df
        for idx, score in enumerate(cos_scores):
            semantic_scores[idx] = float(score) * 100 # Escala 0-100

    # --- Estrategia 3: Relación Carrera-Tema (Grafo Implícito) ---
    # Si la query menciona una carrera, buscar cursos de esa carrera y sus temas.
    career_boost_scores = {}
    
    if not courses_df.empty:
        # Buscar cursos cuya carrera coincida con la query
        # Esto es lento (iterar todo), optimizamos con vectorización simple o contención
        
        relevant_courses_indices = []
        for idx, course in courses_df.iterrows():
            course_careers = course.get('careers', [])
            if isinstance(course_careers, list):
                for c in course_careers:
                    c_name = c.get('name') if isinstance(c, dict) else str(c)
                    if c_name and (normalized_query in normalize_text(c_name)):
                        relevant_courses_indices.append(idx)
                        break
        
        if relevant_courses_indices:
            # Obtener temas de estos cursos
            courses_in_career = courses_df.loc[relevant_courses_indices]
            for _, course in courses_in_career.iterrows():
                topics = course.get('topics', [])
                if isinstance(topics, list):
                    for t_name in topics:
                        # Dar puntos a este tema
                        career_boost_scores[t_name] = career_boost_scores.get(t_name, 0) + 15

    # --- Consolidación de Puntajes ---
    final_scores = []
    
    for idx, topic in topics_df.iterrows():
        topic_name = topic['name']
        
        # Score Semántico
        score = semantic_scores.get(idx, 0)
        
        # Score por Carrera (Boost)
        score += career_boost_scores.get(topic_name, 0)
        
        # Score Léxico (Fallback/Bonus)
        normalized_name = normalize_text(topic_name)
        if normalized_query in normalized_name:
            score += 30 # Bonus por contención exacta
        
        # Filtro de calidad
        if score > 35:
            confidence = int(min(score, 99))
            
            # Evitar duplicados si ya estaba en contextual
            is_duplicate = False
            for ct in contextual_topics:
                if ct['name'] == topic_name:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                topic_record = topic.to_dict()
                topic_record['confidence'] = confidence
                final_scores.append(topic_record)

    # Unir Contextuales + Semánticos
    # Priorizar contextuales
    all_results = contextual_topics + sorted(final_scores, key=lambda x: x['confidence'], reverse=True)
    
    # Limpiar NaNs para JSON
    clean_results = []
    seen_names = set()
    
    for res in all_results:
        if res['name'] not in seen_names:
            # Sanitizar valores nulos
            clean_res = {k: (v if pd.notnull(v) else None) for k, v in res.items()}
            clean_results.append(clean_res)
            seen_names.add(res['name'])
            
    return clean_results[:4] # Top 4