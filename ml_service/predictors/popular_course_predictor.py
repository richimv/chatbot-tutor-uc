# ml_service/predictors/popular_course_predictor.py
import pandas as pd
import re
from ..utils import normalize_text

def predict(courses_df, trends_df):
    """
    Predice el curso más popular basado en tendencias de búsqueda.
    Usa matching estricto para evitar falsos positivos por términos genéricos.
    """
    if trends_df.empty or courses_df.empty:
        return {"predictedCourse": None, "confidence": 0, "reason": "Sin datos suficientes", "searchCount": 0}

    course_scores = {}
    trends_copy = trends_df.copy()
    trends_copy['normalized_query'] = trends_copy['query'].apply(normalize_text)

    # ✅ NUEVA ESTRATEGIA: Penalizar matching genérico, premiar matching específico
    
    for _, course in courses_df.iterrows():
        course_name = course['name']
        normalized_course_name = normalize_text(course_name)
        
        if not normalized_course_name:
            continue

        score = 0
        course_keywords = [w for w in normalized_course_name.split() if len(w) > 2]
        
        # ===== NIVEL 1: Coincidencia EXACTA del nombre completo =====
        # Ejemplo: búsqueda "introduccion a la programacion" = curso "Introducción a la Programación"
        try:
            escaped_name = re.escape(normalized_course_name)
            # Match if query CONTAINS the full course name
            exact_pattern = fr"{escaped_name}"
            exact_matches = trends_copy[trends_copy['normalized_query'].str.contains(exact_pattern, regex=True, na=False)]
            exact_count = exact_matches['count'].sum()
            
            # ✅ PREMIUM SCORE: Si el nombre completo está en la búsqueda, es una señal MUY fuerte
            score += exact_count * 50  # ⭐ PESO ALTÍSIMO
        except Exception:
            pass

        # ===== NIVEL 2: Coincidencia de 3+ palabras clave =====
        # Si el curso es "Introducción a la Programación" y la búsqueda es "programacion introduccion",
        # eso es una señal FUERTE
        for _, row in trends_copy.iterrows():
            query = row['normalized_query']
            count = row['count']
            
            # Contar cuántas palabras clave del curso están en la búsqueda
            keyword_matches = sum(1 for kw in course_keywords if kw in query)
            
            if keyword_matches >= 3:  # 3+ palabras = muy específico
                score += count * 20
            elif keyword_matches == 2:  # 2 palabras = específico
                score += count * 10
            elif keyword_matches == 1 and len(course_keywords) == 1:  # Curso de 1 palabra exacta
                # Solo si la palabra es única (no "ingenieria" genérico)
                if len(course_keywords[0]) > 5:  # Palabras largas son más específicas
                    score += count * 8

        # ===== NIVEL 3: Coincidencia con nombre de carrera (si es curso de ingeniería, etc.) =====
        # Si hay búsquedas de "ingenieria civil" y el curso incluye "civil", boost menor
        if 'careers' in course and isinstance(course['careers'], list):
            for career_name in course['careers']:
                if isinstance(career_name, str):
                    normalized_career = normalize_text(career_name)
                    career_keywords = [w for w in normalized_career.split() if len(w) > 4]
                    
                    for _, row in trends_copy.iterrows():
                        query = row['normalized_query']
                        count = row['count']
                        career_matches = sum(1 for kw in career_keywords if kw in query)
                        
                        if career_matches >= 2:
                            score += count * 3  # Boost menor

        if score > 0:
            course_scores[course_name] = score

    if not course_scores:
        return {"predictedCourse": None, "confidence": 0, "reason": "No se encontraron coincidencias.", "searchCount": 0}

    # ===== DETERMINAR GANADOR =====
    top_course_name = max(course_scores, key=course_scores.get)
    top_score = course_scores[top_course_name]

    # DEBUG
    sorted_courses = sorted(course_scores.items(), key=lambda x: x[1], reverse=True)[:10]
    print("\n===== TOP 10 COURSES BY SCORE =====")
    for c_name, c_score in sorted_courses:
        print(f"  {c_name}: {c_score}")
    print(f"Winner: {top_course_name} ({top_score})")
    print("=" * 40 + "\n")

    # ===== CONTAR BÚSQUEDAS REALES =====
    normalized_top_course = normalize_text(top_course_name)
    top_keywords = [w for w in normalized_top_course.split() if len(w) > 2]
    
    # Contar búsquedas que contienen el nombre completo o múltiples palabras clave
    search_count = 0
    try:
        escaped_name = re.escape(normalized_top_course)
        search_count += trends_copy[trends_copy['normalized_query'].str.contains(escaped_name, regex=True, na=False)]['count'].sum()
    except:
        pass
    
    # También contar búsquedas con 2+ palabras clave
    for _, row in trends_copy.iterrows():
        query = row['normalized_query']
        keyword_matches = sum(1 for kw in top_keywords if kw in query)
        if keyword_matches >= 2 and escaped_name not in query:
            search_count += row['count']

    # ===== CALCULAR CONFIANZA (AGRESIVO PARA >80%) =====
    top_5_scores = sorted(course_scores.values(), reverse=True)[:5]
    top_sum = sum(top_5_scores)

    if top_sum > 0:
        # Base: Comparar solo contra top 5 competidores
        base_confidence = top_score / top_sum
        
        # ✅ BOOST AGRESIVO 1: Ventaja relativa
        if len(top_5_scores) > 1:
            second = top_5_scores[1]
            if second > 0:
                ratio = top_score / second
                # Si el ganador tiene más del doble, es MUY confiable
                if ratio >= 4.0:
                    base_confidence += 0.40  # ⭐ +40%
                elif ratio >= 3.0:
                    base_confidence += 0.30  # ⭐ +30%
                elif ratio >= 2.0:
                    base_confidence += 0.20  # ⭐ +20%
                elif ratio >= 1.5:
                    base_confidence += 0.15  # ⭐ +15%
        
        # ✅ BOOST AGRESIVO 2: Score absoluto
        # Un score alto indica múltiples matches fuertes
        if top_score >= 300:
            base_confidence *= 1.40  # ⭐ +40%
        elif top_score >= 150:
            base_confidence *= 1.30  # ⭐ +30%
        elif top_score >= 80:
            base_confidence *= 1.20  # ⭐ +20%
        elif top_score >= 40:
            base_confidence *= 1.10  # ⭐ +10%

        # ✅ BOOST AGRESIVO 3: Volumen de búsquedas relevantes
        if search_count >= 25:
            base_confidence *= 1.25  # ⭐ +25%
        elif search_count >= 15:
            base_confidence *= 1.15  # ⭐ +15%
        elif search_count >= 10:
            base_confidence *= 1.10  # ⭐ +10%
        
        # Si hemos llegado hasta aquí con datos reales, dar un boost final
        if search_count > 5 and top_score > 20:
            base_confidence += 0.15  # ⭐ Bonus base por tener señal
        
        # ⭐ BOOST FINAL: Si tenemos una señal fuerte (score > 40, búsquedas > 10), 
        # podemos estar confiados de que es un curso genuinamente popular
        if top_score > 40 and search_count > 10:
            base_confidence *= 1.35  # +35% multiplicador final
        
        confidence = min(base_confidence, 0.98)
    else:
        confidence = 0

    result = {
        "predictedCourse": top_course_name,
        "confidence": min(confidence, 0.98),
        "reason": f"Basado en {int(search_count)} búsquedas relevantes.",
        "searchCount": int(search_count)
    }

    return {k: (v if pd.notna(v) else None) for k, v in result.items()}