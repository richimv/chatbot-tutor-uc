const db = require('../../infrastructure/database/db');
const { normalizeText } = require('../utils/textUtils');

class CourseRepository {

    async findAll() {
        // ✅ ARQUITECTURA: Ahora llamamos al procedimiento almacenado (función) en la base de datos.
        // La lógica compleja de la consulta SQL ya no reside en la aplicación, sino en la BD.
        // Esto desacopla aún más la lógica de negocio de la estructura de datos.
        const { rows } = await db.query('SELECT * FROM get_all_courses_with_details();');
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM courses WHERE id = $1', [id]);
        return rows[0];
    }

    /**
     * Búsqueda principal de cursos.
     * Busca en nombres de cursos, códigos, nombres de temas y nombres de docentes.
     * @param {string} query - Término de búsqueda.
     * @returns {Promise<Array>} - Lista de cursos que coinciden.
     */
    async search(query) {
        // ✅ ARQUITECTURA: La lógica de normalización de texto ahora se delega a la base de datos.
        // La aplicación solo necesita pasar el término de búsqueda en crudo.
        const normalizedQuery = normalizeText(query);

        // Llamamos al procedimiento almacenado `search_courses` y le pasamos el término de búsqueda.
        // La base de datos se encarga de toda la complejidad de los JOINs y subconsultas.
        const sqlQuery = 'SELECT * FROM search_courses($1)';

        const { rows } = await db.query(sqlQuery, [normalizedQuery]);
        return rows;
    }
        async findByCareerName(careerName) {
        const normalizedQuery = `%${normalizeText(careerName)}%`;
        const { rows } = await db.query(`
            SELECT 
                c.*,
                -- Subconsulta para obtener los datos completos de las carreras.
                -- Esto asegura que los resultados de esta búsqueda sean consistentes con la búsqueda principal.
                (
                    SELECT COALESCE(json_agg(json_build_object('id', car.id, 'name', car.name)), '[]'::json)
                    FROM (
                        SELECT DISTINCT car.id, car.name
                        FROM sections s_inner
                        JOIN section_careers sc_inner ON s_inner.id = sc_inner.section_id
                        JOIN careers car ON sc_inner.career_id = car.id
                        WHERE s_inner.course_id = c.id
                    ) AS car
                ) as "careerIds"
            FROM courses c
            INNER JOIN sections s ON c.id = s.course_id
            INNER JOIN section_careers sc ON s.id = sc.section_id
            INNER JOIN careers car_main ON sc.career_id = car_main.id
            WHERE unaccent(car_main.name) ILIKE unaccent($1) -- ✅ CORRECCIÓN: Usar GROUP BY en lugar de DISTINCT
            GROUP BY c.id
            ORDER BY c.name;
        `, [normalizedQuery]); // El alias 'car' estaba en conflicto, se cambió a 'car_main'
        return rows;
    }
    
    async create(courseData) {
        // ✅ LÓGICA REHECHA: Esta función ahora es simple y correcta.
        const { name, description, topicIds, bookIds } = courseData;

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            // 1. Insertar el curso principal.
            const tempCourseId = `C-${Date.now()}`; // Valor temporal para satisfacer la restricción NOT NULL.
            const courseRes = await client.query('INSERT INTO courses (name, description, course_id) VALUES ($1, $2, $3) RETURNING *', [name, description || '', tempCourseId]);
            const newCourse = courseRes.rows[0];

            if (topicIds && topicIds.length > 0) {
                const topicPromises = topicIds.map(topicId => client.query('INSERT INTO course_topics (course_id, topic_id) VALUES ($1, $2)', [newCourse.id, topicId]));
                await Promise.all(topicPromises);
            }

            // 3. Insertar las relaciones con los libros en la tabla de unión.
            if (bookIds && bookIds.length > 0) {
                const bookPromises = bookIds.map(bookId => client.query('INSERT INTO course_books (course_id, resource_id) VALUES ($1, $2)', [newCourse.id, bookId]));
                await Promise.all(bookPromises);
            }

            // 4. Confirmar la transacción si todo fue exitoso.
            await client.query('COMMIT');
            return newCourse;
        } catch (e) {
            // 5. Si algo falla, revertir todos los cambios.
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async update(id, courseData) {
        // ✅ SOLUCIÓN: Usar una transacción para actualizar el curso y sus relaciones.
        const { name, description, topicIds, bookIds } = courseData;
        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            // ✅ SOLUCIÓN: Eliminar 'updated_at' de la consulta.
            const courseRes = await client.query('UPDATE courses SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description || '', id]);
            const updatedCourse = courseRes.rows[0];

            await client.query('DELETE FROM course_topics WHERE course_id = $1', [id]);
            if (topicIds && topicIds.length > 0) {
                const topicPromises = topicIds.map(topicId => client.query('INSERT INTO course_topics (course_id, topic_id) VALUES ($1, $2)', [id, topicId]));
                await Promise.all(topicPromises);
            }
            await client.query('DELETE FROM course_books WHERE course_id = $1', [id]);
            if (bookIds && bookIds.length > 0) {
                const bookPromises = bookIds.map(bookId => client.query('INSERT INTO course_books (course_id, resource_id) VALUES ($1, $2)', [id, bookId]));
                await Promise.all(bookPromises);
            }
            await client.query('COMMIT');
            return updatedCourse;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM courses WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Curso con ID ${id} no encontrado para eliminar.`);
        }
        return { success: true };
    }

        /**
         * Encuentra todos los cursos que pertenecen a carreras que coinciden parcialmente con un nombre.
         * Ej: "ingenieria" encontrará cursos de "Ingeniería de Software" e "Ingeniería Civil".
         * @param {string} categoryName - El nombre parcial de la categoría de carrera.
         * @returns {Promise<Array>} - Una lista de cursos.
         */
    async findByCareerCategory(categoryName) {
            // ✅ ARQUITECTURA: Llamamos al procedimiento almacenado `find_courses_by_career_category`.
            // La lógica compleja de búsqueda con Levenshtein ahora está encapsulada en la base de datos.
            const query = 'SELECT * FROM find_courses_by_career_category($1)';
            const values = [categoryName];
            try {
                const { rows } = await db.query(query, values);
                return rows;
            } catch (error) {
                console.error(`Error en findByCareerCategory buscando "${categoryName}":`, error);
                return [];
            }
    }
}

module.exports = CourseRepository;
