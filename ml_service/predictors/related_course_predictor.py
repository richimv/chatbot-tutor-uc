import pandas as pd
from ml_service.utils import normalize_text
from Levenshtein import distance as levenshtein_distance # Importar la función
from nltk.stem.snowball import SnowballStemmer

stemmer = SnowballStemmer('spanish')

def predict(query, direct_results_ids, courses_df):
    """
    Encuentra cursos para la sección de RECOMENDACIONES.
    Utiliza la consulta de búsqueda para encontrar hasta 3 cursos relevantes.
    """
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}
    
    if not query_keywords:
        return []

    # Considerar todos los cursos que no estén ya en los resultados principales.
    candidate_courses = courses_df[~courses_df['id'].isin(direct_results_ids)].copy()

    # ✅ MEJORA: Lógica de puntuación más robusta.
    course_scores = {}
    for _, course in candidate_courses.iterrows():
        score = 0
        normalized_course_name = normalize_text(course['name'])
        course_name_keywords = {stemmer.stem(w) for w in normalized_course_name.split() if w}
        
        course_topics_list = course.get('topics', [])
        # ✅ CORRECCIÓN: Normalizar y aplicar stemming a los temas para una mejor coincidencia.
        course_topics_keywords = {stemmer.stem(w) for t in course_topics_list if isinstance(t, str) for w in normalize_text(t).split() if w}
        
        # ✅ SOLUCIÓN CRÍTICA: Asegurarse de que 'careers' sea una lista, incluso si es nulo o NaN.
        # Esto evita que el servicio de ML falle si un curso no tiene carreras asignadas.
        course_careers_list = course.get('careers') if isinstance(course.get('careers'), list) else []
        # ✅ CORRECCIÓN: Normalizar y aplicar stemming a las carreras.
        course_careers_keywords = {stemmer.stem(w) for c in course_careers_list if isinstance(c, str) for w in normalize_text(c).split() if w}

        # Puntuación por coincidencia de palabras clave
        # ✅ MEJORA DE BÚSQUEDA INTELIGENTE: Puntuación por palabras clave en nombre, temas y carreras.
        # Esto permite que "programacion" encuentre cursos que tengan ese tema.
        score += len(query_keywords.intersection(course_name_keywords)) * 15 # Coincidencia en nombre es muy importante
        score += len(query_keywords.intersection(course_topics_keywords)) * 10  # Coincidencia en temas es muy relevante
        score += len(query_keywords.intersection(course_careers_keywords)) * 5 # Coincidencia en carrera es relevante

        # ✅ MEJORA DE TOLERANCIA A ERRORES: Puntuación por similitud de Levenshtein.
        # Esto ayuda a que "ingenieriaa" coincida con "ingenieria de software".
        lev_dist = levenshtein_distance(normalized_query, normalized_course_name)
        if lev_dist < 3: # Si hay pocos errores de tipeo
            score += (3 - lev_dist) * 10 # Más puntos cuanto menor sea el error

        # ✅ MEJORA CLAVE: Bonificación si la consulta está contenida en el nombre del curso.
        # Esto hace que "ingenieria" coincida con "Ingenieria de Software".
        if normalized_query in normalized_course_name and len(normalized_query) > 3:
            score += 20 # Bonificación alta por coincidencia parcial en el nombre

        if score > 0:
            course_scores[course['id']] = score

    sorted_courses = sorted(course_scores.items(), key=lambda item: item[1], reverse=True)
    # ✅ MEJORA: Aumentar el límite a 4 para dar más opciones.
    top_course_ids = [course_id for course_id, score in sorted_courses[:4]]
    result_df = courses_df[courses_df['id'].isin(top_course_ids)]

    # Devolver el objeto completo para que el frontend pueda usarlo
    clean_df = result_df[['id', 'name', 'careers']].where(pd.notnull(result_df[['id', 'name', 'careers']]), None)
    return clean_df.to_dict('records')
