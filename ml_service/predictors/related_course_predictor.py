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

def calculate_display_confidence(score):
    """
    Ajusta la confianza visual para no ser demasiado castigadora en rangos medios.
    """
    # Curva suave: Si el score es > 50, lo empujamos un poco hacia arriba visualmente
    if score > 98: return 98
    if score < 0: return 0
    
    # Boost visual para scores medios-altos (50-80)
    # Ejemplo: 60 -> 60 + (40 * 0.2) = 68
    # Pero el boost principal viene de la lógica de negocio (+20 puntos)
    return int(score)

def predict(query, direct_results_ids, courses_df, embedding_cache=None):
    """
    Predictor Semántico Híbrido (True ML + Reglas de Negocio).
    
    Args:
        query: Texto buscado por el usuario.
        direct_results_ids: IDs de cursos que ya se mostraron como resultado directo.
        courses_df: Catálogo completo de cursos.
        embedding_cache: Objeto GlobalCache con modelo y vectores pre-calculados.
    """
    print(f"\n--- 🕵️ AUDITORÍA ML: RECOMENDACIÓN DE CURSOS (V2 AREA BOOST) ---")
    
    if courses_df.empty:
        return []

    # 1. Búsqueda Semántica (El Núcleo de IA)
    semantic_scores_map = {}
    
    if embedding_cache and embedding_cache.model and embedding_cache.initialized:
        print(f"🧠 Calculando similitud semántica para: '{query}'")
        
        # Codificar la consulta del usuario a vector
        query_embedding = embedding_cache.model.encode(query, convert_to_tensor=True)
        
        # Obtener vectores de todos los cursos (ya en caché)
        corpus_embeddings = embedding_cache.course_embeddings
        
        # Calcular similitud coseno (rápido en GPU/CPU optimizada)
        # Devuelve tensor de shape [1, N_cursos]
        cos_scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
        
        # Convertir a diccionario {course_id: score (0.0 - 1.0)}
        # Aseguramos convertir tensor a float de Python
        scores_list = cos_scores.cpu().tolist()
        semantic_scores_map = {
            cid: score for cid, score in zip(embedding_cache.course_ids, scores_list)
        }
    else:
        print("⚠️ Cache de embeddings no disponible. Usando fallback léxico.")

    # 2. Análisis de Contexto (Tu Regla de Negocio Original)
    # ¿Qué está viendo el usuario ya? (Para mantener coherencia de carrera/área)
    source_career_names = set()
    source_areas = set()
    normalized_query = normalize_text(query)
    
    if direct_results_ids:
        # Extraer contexto de los resultados directos
        direct_courses = courses_df[courses_df['id'].isin(direct_results_ids)]
        
        # Contar carreras y áreas más frecuentes en los resultados directos
        career_counts = {}
        area_counts = {}
        
        for _, course in direct_courses.iterrows():
            course_careers = course.get('careers', [])
            if isinstance(course_careers, list):
                for career in course_careers:
                    # Manejo robusto de estructura (dict o string)
                    c_name = career.get('name') if isinstance(career, dict) else str(career)
                    c_area = career.get('area') if isinstance(career, dict) else None
                    
                    if c_name: career_counts[c_name] = career_counts.get(c_name, 0) + 1
                    if c_area: area_counts[c_area] = area_counts.get(c_area, 0) + 1
        
        # Seleccionar Top Carreras/Áreas para filtrar
        if career_counts:
            top_careers = sorted(career_counts.items(), key=lambda x: x[1], reverse=True)[:2]
            source_career_names = {c[0] for c in top_careers}
            # print(f"   Contexto Carreras: {source_career_names}")

        if area_counts:
            top_area = sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[0][0]
            source_areas.add(top_area)
            # print(f"   Contexto Área: {top_area}")
    
    # --- NUEVA LÓGICA: Inferencia de Área por Query ---
    # Si no hay resultados directos (búsqueda nueva), intentamos adivinar el área
    if not source_areas:
        # Buscamos si la query coincide con el nombre de alguna carrera
        # Recorremos el DF de cursos para ver todas las carreras disponibles
        # (Esto podría optimizarse con un mapa pre-calculado, pero para el volumen actual está bien)
        found_area = None
        for _, course in courses_df.iterrows():
            course_careers = course.get('careers', [])
            if isinstance(course_careers, list):
                for career in course_careers:
                    if isinstance(career, dict) and career.get('name'):
                        c_name_norm = normalize_text(career['name'])
                        # Coincidencia exacta o muy fuerte ("ingenieria civil" in "ingenieria civil industrial")
                        if normalized_query == c_name_norm or (len(normalized_query) > 5 and normalized_query in c_name_norm):
                            if career.get('area'):
                                found_area = career['area']
                                break
            if found_area: break
        
        if found_area:
            source_areas.add(found_area)
            # print(f"   🔍 Área Inferida por Query: {found_area}")

    # 3. Scoring y Filtrado Híbrido
    # Candidatos: Todos los cursos MENOS los que ya salieron directos
    candidate_courses = courses_df[~courses_df['id'].isin(direct_results_ids or [])].copy()
    
    final_results = []

    for _, course in candidate_courses.iterrows():
        course_id = course['id']
        
        # --- A. Score Base Semántico (0-100) ---
        # Escalamos de 0.0-1.0 a 0-100 para facilitar lectura
        raw_similarity = semantic_scores_map.get(course_id, 0)
        
        # ✅ MEJORA: Escalamiento No Lineal para UX
        # Convertimos un raw similarity de 0.4 (decente) en algo más visible (~60%)
        # Fórmula: score = raw * 100 + (raw * 30)
        score = (raw_similarity * 100) + (raw_similarity * 30)
        
        # Filtro de Ruido Semántico: Si es menor a 25%, descartar
        # (Salvo que haya match de texto exacto)
        if score < 25:
            # Chequeo de emergencia: ¿Contiene la palabra clave exacta?
            if normalized_query in normalize_text(course['name']):
                score = 60 # Rescatarlo con buena confianza
            else:
                continue 

        # --- B. Refinamiento por Reglas de Negocio ---
        # Bonus por coincidencia de Carrera/Área (Contexto)
        course_careers = course.get('careers', [])
        course_c_names = set()
        course_c_areas = set()
        
        if isinstance(course_careers, list):
            for c in course_careers:
                if isinstance(c, dict):
                    if c.get('name'): course_c_names.add(c['name'])
                    if c.get('area'): course_c_areas.add(c['area'])
                else:
                    course_c_names.add(str(c))

        # Aplicar Bonus
        has_career_match = bool(source_career_names.intersection(course_c_names))
        has_area_match = bool(source_areas.intersection(course_c_areas))
        
        # --- NUEVA LÓGICA DE BOOST ---
        if has_area_match:
            score += 20 # Boost Fuerte por Área (+20)
            
            if has_career_match:
                score += 10 # Boost Adicional por Carrera (+10) -> Total +30
        else:
            # Penalización por cambio de contexto brusco
            # Si el semántico no es altísimo (>65), penalizamos por ser de otra área
            if score < 65 and (source_career_names or source_areas):
                score -= 5 
        
        # Bonus por coincidencia léxica parcial (Keyword en título)
        # "Programación" en "Programación Web"
        if normalized_query in normalize_text(course['name']):
            score += 20 

        # ✅ MEJORA: Bonus por coincidencia en TEMAS del curso
        # Si la query menciona un tema que el curso enseña, ¡es un match fuerte!
        course_topics = course.get('topics', [])
        if isinstance(course_topics, list):
            for topic in course_topics:
                if topic and normalized_query in normalize_text(topic):
                    score += 25 # Boost muy fuerte por tema
                    # print(f"   🚀 Boost por tema '{topic}' en curso '{course['name']}'")
                    break

        # Guardar resultado si pasa el corte final
        if score > 40: # Corte ligeramente más alto por el boost general
            final_results.append({
                'id': course_id,
                'name': course['name'],
                'score': score,
                # Normalizamos la confianza visualmente para el usuario (max 98%)
                'confidence': calculate_display_confidence(score),
                'careers': course_careers
            })

    # 4. Ordenar y Recortar
    # Ordenamos por score descendente
    final_results.sort(key=lambda x: x['score'], reverse=True)
    
    # Top 4 recomendaciones
    top_results = final_results[:4]
    
    if top_results:
        print(f"✅ {len(top_results)} recomendaciones encontradas.")
        # print(f"   Top: {[r['name'] for r in top_results]}")
    else:
        print("⚠️ No se encontraron recomendaciones relevantes.")

    return top_results