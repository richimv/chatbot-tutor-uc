-- stored_procedures.sql

-- Procedimiento Almacenado para obtener todos los cursos con sus detalles agregados.
-- Este procedimiento reemplaza la lógica que estaba en `courseRepository.findAll()`.

-- Usamos CREATE OR REPLACE FUNCTION para poder actualizar la función fácilmente en el futuro.
-- RETURNS TABLE define la estructura exacta de la tabla que devolverá la función.
CREATE OR REPLACE FUNCTION get_all_courses_with_details()
RETURNS TABLE(
    id INT,
    course_id VARCHAR,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" INT[]
) AS $$
BEGIN
    -- La palabra clave RETURN QUERY ejecuta la consulta y devuelve sus resultados
    -- con el formato definido en RETURNS TABLE.
    RETURN QUERY
    SELECT 
        c.id,
        c.course_id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (SELECT COALESCE(ARRAY_AGG(DISTINCT sc.career_id), '{}') FROM sections s JOIN section_careers sc ON s.id = sc.section_id WHERE s.course_id = c.id) as "careerIds"
    FROM 
        courses c
    GROUP BY 
        c.id
    ORDER BY 
        c.name;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento Almacenado para la búsqueda principal de cursos.
-- Reemplaza la lógica que estaba en `courseRepository.search()`.
-- Acepta un parámetro de entrada `p_search_term` para el término de búsqueda.
CREATE OR REPLACE FUNCTION search_courses(p_search_term TEXT)
RETURNS TABLE(
    id INT,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" JSON
) AS $$
DECLARE
    -- Variable para almacenar el término de búsqueda con comodines para ILIKE.
    normalized_query TEXT;
BEGIN
    normalized_query := '%' || p_search_term || '%';

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (
            SELECT COALESCE(json_agg(json_build_object('id', car.id, 'name', car.name)), '[]'::json)
            FROM (
                SELECT DISTINCT car.id, car.name
                FROM sections s
                JOIN section_careers sc ON s.id = sc.section_id
                JOIN careers car ON sc.career_id = car.id
                WHERE s.course_id = c.id
            ) car
        ) as "careerIds"
    FROM courses c
    WHERE c.id IN (
        -- Subconsulta para encontrar los IDs de cursos relevantes.
        SELECT DISTINCT c_inner.id
        FROM courses c_inner
        LEFT JOIN course_topics ct_inner ON c_inner.id = ct_inner.course_id
        LEFT JOIN topics t_inner ON ct_inner.topic_id = t_inner.id
        LEFT JOIN sections s_inner ON c_inner.id = s_inner.course_id
        LEFT JOIN instructors i_inner ON s_inner.instructor_id = i_inner.id
        WHERE
            unaccent(c_inner.name) ILIKE unaccent(normalized_query)
            OR unaccent(t_inner.name) ILIKE unaccent(normalized_query)
            OR unaccent(i_inner.name) ILIKE unaccent(normalized_query)
    )
    ORDER BY
        c.name;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento Almacenado para buscar cursos por categoría de carrera (con tolerancia a errores).
-- Reemplaza la lógica que estaba en `courseRepository.findByCareerCategory()`.
-- Acepta un parámetro de entrada `p_category_name` para el nombre de la carrera.
CREATE OR REPLACE FUNCTION find_courses_by_career_category(p_category_name TEXT)
RETURNS TABLE(
    id INT,
    course_id VARCHAR,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" JSON,
    relevance_score BIGINT
) AS $$
DECLARE
    -- Variable para el patrón de búsqueda LIKE
    like_pattern TEXT;
BEGIN
    like_pattern := '%' || p_category_name || '%';

    RETURN QUERY
    SELECT 
        c.id,
        c.course_id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (SELECT COALESCE(json_agg(json_build_object('id', car_inner.id, 'name', car_inner.name)), '[]'::json)
         FROM (SELECT DISTINCT car_data.id, car_data.name FROM sections s_inner JOIN section_careers sc_inner ON s_inner.id = sc_inner.section_id JOIN careers car_data ON sc_inner.career_id = car_data.id WHERE s_inner.course_id = c.id) car_inner) as "careerIds",
        MIN(car.relevance_score)::BIGINT as relevance_score
    FROM courses c
    INNER JOIN (
        SELECT DISTINCT s.course_id, MIN(levenshtein(lower(unaccent(car.name)), lower(unaccent(p_category_name)))) as relevance_score
        FROM sections s
        INNER JOIN section_careers sc ON s.id = sc.section_id
        INNER JOIN careers car ON sc.career_id = car.id
        WHERE levenshtein(lower(unaccent(car.name)), lower(unaccent(p_category_name))) < 3 OR unaccent(lower(car.name)) LIKE unaccent(lower(like_pattern))
        GROUP BY s.course_id
    ) as car ON c.id = car.course_id
    GROUP BY c.id
    ORDER BY relevance_score ASC, c.name ASC;
END;
$$ LANGUAGE plpgsql;