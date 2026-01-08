from sentence_transformers import util
import torch

def predict(query, direct_ids, courses_df, books_df, course_embeddings, book_embeddings, model, top_k=6):
    """
    Predice recursos (Cursos + Libros) basados en similitud semántica.
    Combina ambos datasets y devuelve los top K resultados mixtos.
    """
    if not query:
        return []
        
    # Convert query to embedding
    query_embedding = model.encode(query, convert_to_tensor=True)
    
    results = []
    
    # 1. Analizar Cursos
    if course_embeddings is not None and len(courses_df) > 0:
        # Calcular Similitud Coseno
        c_scores = util.cos_sim(query_embedding, course_embeddings)[0]
        
        # Obtener Top K candidatos (tomamos más para filtrar después)
        k_courses = min(top_k * 2, len(courses_df))
        top_results_c = torch.topk(c_scores, k=k_courses)
        
        for score, idx in zip(top_results_c.values, top_results_c.indices):
            idx = int(idx)
            course = courses_df.iloc[idx]
            c_id = str(course['id'])
            
            # Filtrado simple de IDs directos (asumiendo que direct_ids contiene IDs puros)
            # Idealmente manejar tipos, pero por ahora evitamos duplicados obvios si coincide
            if c_id not in direct_ids:
                results.append({
                    "id": int(course['id']),
                    "name": course['name'],
                    "description": course.get('description', ''),
                    "type": "course",
                    "confidence": int(score * 100)
                })

    # 2. Analizar Libros
    if book_embeddings is not None and len(books_df) > 0:
        b_scores = util.cos_sim(query_embedding, book_embeddings)[0]
        
        k_books = min(top_k * 2, len(books_df))
        top_results_b = torch.topk(b_scores, k=k_books)
        
        for score, idx in zip(top_results_b.values, top_results_b.indices):
            idx = int(idx)
            book = books_df.iloc[idx]
            b_id = str(book['id'])
            
            # Validación básica para libros
            if b_id not in direct_ids: 
                results.append({
                    "id": int(book['id']),
                    "name": book['name'],
                    "author": book.get('author', ''),
                    "publisher": book.get('publisher', ''),
                    "type": "book",
                    "confidence": int(score * 100)
                })

    # 3. Unificar y Ordenar
    # Ordenamos por confianza descendente
    results.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Retornar Solo los Top K globales
    return results[:top_k]
