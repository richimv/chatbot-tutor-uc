# ml_service/predictors/related_topic_predictor.py
import sys
import json
import pandas as pd
from ml_service.utils import normalize_text
from nltk.stem.snowball import SnowballStemmer

# --- Inicialización ---
stemmer = SnowballStemmer('spanish')

def predict(query, courses_df):
    """
    Encuentra temas relacionados basados en palabras clave comunes (stems) entre la consulta
    y la lista de todos los temas disponibles.
    """
    # 1. Extraer palabras clave de la consulta usando stemming
    normalized_query = normalize_text(query)
    # ✅ LÓGICA SIMPLIFICADA: Eliminar la frágil lista de FILLER_WORDS y solo filtrar por longitud.
    # ✅ SOLUCIÓN FINAL: Eliminar el filtro de longitud para máxima flexibilidad.
    query_keywords = {stemmer.stem(w) for w in normalized_query.split() if w}

    if not query_keywords:
        return []

    all_topics = set()
    # 2. Recopilar todos los temas únicos de todos los cursos
    for topics_list in courses_df['topics']:
        if isinstance(topics_list, list):
            for topic in topics_list:
                # ✅ CORRECCIÓN DE ROBUSTEZ: Asegurarse de que solo se añaden temas que son cadenas de texto.
                if isinstance(topic, str) and topic:
                    all_topics.add(topic)

    related_topics = set()
    for topic in all_topics:
        # 3. Extraer palabras clave de cada tema usando la MISMA lógica que en la consulta
        normalized_topic = normalize_text(topic or "") # Usar "" si el tema es None
        topic_keywords = {stemmer.stem(w) for w in normalized_topic.split() if w}

        # 4. Si hay coincidencia de raíces de palabras, añadir el tema a los resultados
        if query_keywords.intersection(topic_keywords):
            related_topics.add(topic)

    # 5. Lógica de filtrado MEJORADA para evitar redundancia sin perder recomendaciones.
    # Si hay más de una recomendación, eliminamos la que sea idéntica a la búsqueda.
    # Si solo hay una, la conservamos para no dejar la sección de recomendaciones vacía.
    if len(related_topics) > 1:
        final_topics = {t for t in related_topics if normalize_text(t) != normalized_query}
    else:
        final_topics = related_topics

    return list(final_topics)[:3]

# --- Bloque de Ejecución ---
if __name__ == '__main__':
    """
    Este bloque se ejecuta cuando el script es llamado desde la línea de comandos.
    Lee los datos de stdin, los procesa y devuelve el resultado como JSON a stdout.
    """
    try:
        input_data = json.load(sys.stdin)
        query = input_data['query']
        courses_df = pd.DataFrame(input_data['courses'])

        result = predict(query, courses_df)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)