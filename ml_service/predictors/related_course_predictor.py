# ml_service/predictors/related_items_predictor.py
# ml_service/predictors/related_course_predictor.py
import sys
import json
import pandas as pd
from ml_service.utils import normalize_text
from nltk.stem.snowball import SnowballStemmer

# --- Inicialización ---
stemmer = SnowballStemmer('spanish')

def predict(query, direct_results_ids, courses_df):
    """
    ✅ REFACTORIZACIÓN COMPLETA: Encuentra cursos relacionados basados en la superposición de palabras clave (stems)
    entre la consulta del usuario y el contenido del curso (nombre + temas).
    Ahora funciona incluso si no hay resultados de búsqueda directos.
    """
    # 1. Extraer palabras clave de la consulta usando stemming
    normalized_query = normalize_text(query)
    # ✅ LÓGICA SIMPLIFICADA: Eliminar la frágil lista de FILLER_WORDS y solo filtrar por longitud.
    # ✅ SOLUCIÓN FINAL: Eliminar el filtro de longitud. Es demasiado agresivo y causa errores.
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}

    if not query_keywords:
        return []

    # 2. Excluir cursos que ya se mostraron en los resultados directos
    candidate_courses = courses_df[~courses_df['id'].isin(direct_results_ids)]
    
    course_scores = {}
    for _, course in candidate_courses.iterrows():
        # 3. Extraer palabras clave del contenido del curso (nombre + temas) usando la MISMA lógica
        # ✅ CORRECCIÓN DE ROBUSTEZ: Filtrar valores None de la lista de temas antes de unir.
        course_name = course.get('name', '')
        topic_names = [t for t in course.get('topics', []) if isinstance(t, str)]
        course_content_text = normalize_text(course_name + ' ' + ' '.join(topic_names))
        course_keywords = {stemmer.stem(w) for w in course_content_text.split() if w}
        
        # --- LÓGICA DE PUNTUACIÓN MEJORADA ---
        common_keywords = query_keywords.intersection(course_keywords)
        score = len(common_keywords)

        # Dar un gran impulso a la puntuación si la coincidencia ocurre en el nombre del curso.
        # Esto hará que "Redes de Computadoras" gane por mucho cuando se busque "redes".
        normalized_course_name_only = normalize_text(course_name)
        name_keywords = {stemmer.stem(w) for w in normalized_course_name_only.split() if w}
        if query_keywords.intersection(name_keywords):
            score += 5 # Bonus por coincidencia en el nombre

        if score > 0:
            course_scores[course['name']] = score
    
    sorted_courses = sorted(course_scores.items(), key=lambda item: item[1], reverse=True)
    return [course_name for course_name, score in sorted_courses[:2]]

# --- Bloque de Ejecución ---
if __name__ == '__main__':
    """
    Este bloque se ejecuta cuando el script es llamado desde la línea de comandos.
    Lee los datos de stdin, los procesa y devuelve el resultado como JSON a stdout.
    """
    try:
        input_data = json.load(sys.stdin)
        query = input_data['query']
        direct_results_ids = input_data['direct_results_ids']
        courses_df = pd.DataFrame(input_data['courses'])

        result = predict(query, direct_results_ids, courses_df)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)