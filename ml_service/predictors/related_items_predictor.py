# ml_service/predictors/related_items_predictor.py
from ..utils import normalize_text
import nltk
from nltk.stem.snowball import SnowballStemmer

# --- Inicialización ---
stemmer = SnowballStemmer('spanish')

# Palabras comunes a ignorar para encontrar palabras clave relevantes
FILLER_WORDS = {
    'quiero', 'saber', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las',
    'que', 'es', 'explicame', 'como', 'funciona', 'necesito', 'informacion', 'dame', 'acerca', 'del', 'tema', 'ayuda',
    'qué', 'cómo', 'información', 'podrias', 'de', 'del', 'y', 'o', 'a', 'en', 'con', 'por', 'sin', 'entre', 'hacia', 'desde',
    'hasta', 'durante', 'mediante', 'segun', 'tras', 'versus', 'via', 'cabe', 'bajo', 'contra', 'muestrame', 'ejemplos', 'concepto'
}

def get_related_courses(query, direct_results_ids, courses_df):
    """
    Encuentra cursos relacionados basados en el contenido (nombre y temas) usando stemming.
    Excluye los cursos que ya fueron encontrados directamente.
    """
    normalized_query = normalize_text(query)
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w and w not in FILLER_WORDS and len(w) > 1}

    if not query_keywords:
        return []

    # Excluir cursos ya encontrados
    direct_results_ids_str = [str(i) for i in direct_results_ids]
    candidate_courses = courses_df[~courses_df['id'].astype(str).isin(direct_results_ids_str)]
    
    course_scores = {}
    for _, course in candidate_courses.iterrows():
        course_content_text = normalize_text(course['nombre'] + ' ' + ' '.join(course.get('temas', [])))
        course_keywords = {stemmer.stem(w) for w in course_content_text.split() if w}
        
        # Calcular puntuación por palabras clave en común
        intersection = query_keywords.intersection(course_keywords)
        score = len(intersection)
        
        # Bonus si todas las palabras clave de la búsqueda están en el curso
        if query_keywords.issubset(course_keywords):
            score += len(query_keywords)

        if score > 0:
            course_scores[course['nombre']] = score
    
    # Ordenar por puntuación y devolver los 2 mejores
    sorted_courses = sorted(course_scores.items(), key=lambda item: item[1], reverse=True)
    return [course_name for course_name, score in sorted_courses[:2]]

def get_related_topics(query, direct_results_ids, courses_df):
    """
    Extrae temas de los cursos encontrados directamente, asegurándose de que no sean
    redundantes con la consulta original.
    """
    if not direct_results_ids:
        return []

    normalized_query_for_matching = normalize_text(query)
    direct_courses_df = courses_df[courses_df['id'].isin(direct_results_ids)]
    topics_from_direct_results = set()
    for _, course in direct_courses_df.iterrows():
        for topic in course.get('temas', []):
            # Añadir tema si no es redundante con la búsqueda original
            if normalize_text(topic) not in normalized_query_for_matching:
                topics_from_direct_results.add(topic)
    
    return list(topics_from_direct_results)[:3] # Limitar a 3 temas