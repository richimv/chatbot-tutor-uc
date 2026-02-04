const db = require('../../infrastructure/database/db');

class BookRepository {

    async findAll(filters = {}) {
        // ✅ MEJORA: Incluir Áreas Académicas para agrupación en catálogo.
        const { type } = filters;

        const whereClause = type ? `WHERE r.resource_type = '${type}'` : ''; // Simple sanitization, ideally use params but for fixed types it's ok or use param array.
        // Better security: use params. But findAll query is complex with subquery.
        // Let's use string template for now as 'type' comes from strict set in controller or empty.

        const query = `
            SELECT 
                r.id, r.title, r.author, r.image_url, r.url, r.resource_type, 
                r.isbn, r.publication_year, r.publisher, r.edition, r.city,
                (
                    SELECT COALESCE(JSON_AGG(DISTINCT car.area), '[]')
                    FROM course_books cb
                    JOIN course_careers cc ON cb.course_id = cc.course_id
                    JOIN careers car ON cc.career_id = car.id
                    WHERE cb.resource_id = r.id AND car.area IS NOT NULL
                ) as areas
            FROM resources r
            ${type ? 'WHERE r.resource_type = $1' : ''}
            ORDER BY r.title
        `;

        const params = type ? [type] : [];
        const { rows } = await db.query(query, params);
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM resources WHERE id = $1', [id]);
        return rows[0];
    }

    async create(bookData) {
        const { title, author, url, size, image_url, publication_year, publisher, edition, city, isbn, resource_type } = bookData;
        // ✅ SOLUCIÓN: Generar el 'resource_id' de texto que la base de datos requiere.
        const resourceId = `RES_${Date.now()}`;
        const { rows } = await db.query(
            'INSERT INTO resources (resource_id, title, author, url, size, image_url, publication_year, publisher, edition, city, isbn, resource_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
            [resourceId, title, author, url, size || null, image_url || null, publication_year || null, publisher || null, edition || null, city || null, isbn || null, resource_type || 'book']
        );
        return rows[0];
    }

    async update(id, bookData) {
        // ✅ MEJORA ROBUSTA: Construcción dinámica de la query.
        const { title, author, url, size, image_url, publication_year, publisher, edition, city, isbn, resource_type } = bookData;

        const fields = [
            'title = $1', 'author = $2', 'url = $3', 'size = $4',
            'publication_year = $5', 'publisher = $6', 'edition = $7', 'city = $8', 'isbn = $9', 'resource_type = $10'
        ];
        const params = [
            title, author, url, size || null,
            publication_year || null, publisher || null, edition || null, city || null, isbn || null, resource_type || 'book'
        ];

        if (image_url !== undefined) {
            params.push(image_url);
            fields.push(`image_url = $${params.length}`);
        }

        params.push(id);
        const query = `UPDATE resources SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`;

        console.log('📚 Updating Resource:', { id, type: resource_type, query });

        const { rows } = await db.query(query, params);

        if (rows.length === 0) {
            throw new Error(`Recurso (libro) con ID ${id} no encontrado.`);
        }
        return rows[0];
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM resources WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Recurso (libro) con ID ${id} no encontrado para eliminar.`);
        }
        return { success: true };
    }
    /**
     * Búsqueda de libros/recursos (Inteligente: insensible a acentos/mayúsculas).
     * @param {string} query - Término de búsqueda.
     * @returns {Promise<Array>} - Lista de libros que coinciden.
     */
    async search(query) {
        // ✅ BÚSQUEDA AVANZADA (Libros): Tokens & Ranking + CONTEXTO DE CURSO + CONTEXTO DE CARRERA
        const textUtils = require('../utils/textUtils');
        const cleanQuery = textUtils.normalizeText(query || '').trim();
        if (!cleanQuery) return [];

        /*
            ESTRATEGIA "CONTEXT-AWARE" V2:
            1. Match Título/Autor/Tema (Directo)
            2. Match Curso (Relación Directa): "Cardio" -> Curso Cardiología -> Libro Manual AMIR
            3. Match Carrera (Relación Profunda): "Ingeniería" -> Carrera Ingeniería Civil -> Curso X -> Libro Y
            4. ✅ NUEVO: Match por Tipo de Recurso ("Libro", "Articulo")
        */

        // Detección de intención de tipo (Type Intent)
        const typeMap = {
            'libro': 'book', 'libros': 'book', 'book': 'book', 'books': 'book',
            'articulo': 'article', 'articulos': 'article', 'article': 'article', 'paper': 'article',
            'video': 'video', 'videos': 'video'
        };

        // Verificamos si la query completa es una palabra clave de tipo (ej: "libros")
        // O si contiene la palabra (ej: "libros de anatomia" -> intent: book + query: anatomia)
        // Por ahora, mantendremos la query completa pero impulsaremos el score si coincide el tipo.
        const detectedType = typeMap[cleanQuery.toLowerCase()] || null;

        const params = [cleanQuery];
        if (detectedType) params.push(detectedType);

        const sqlQuery = `
            SELECT DISTINCT 
                r.id, 
                r.title, 
                r.author, 
                r.image_url, 
                r.url, 
                r.resource_type, 
                r.isbn,
                (
                    CASE 
                        -- Prioridad 0: Match Exacto de TIPO (Usuario busca "Libros") -> 50 pts base
                        -- Esto asegura que aparezcan, pero títulos específicos seguirán ganando.
                        ${detectedType ? `WHEN r.resource_type = $2 THEN 50` : ''}

                        -- Prioridad 1: Match Exacto Título Libro (100 pts)
                        WHEN unaccent(lower(r.title)) LIKE unaccent(lower('%' || $1 || '%')) THEN 100
                        
                        -- Prioridad 2: Match Exacto Nombre Curso (95 pts)
                        WHEN unaccent(lower(c.name)) LIKE unaccent(lower('%' || $1 || '%')) THEN 95

                        -- Prioridad 3: Match Exacto Tema (80 pts)
                        WHEN unaccent(lower(t.name)) LIKE unaccent(lower('%' || $1 || '%')) THEN 80
                        
                        -- Prioridad 4: Match Exacto Carrera (70 pts)
                        WHEN unaccent(lower(car.name)) LIKE unaccent(lower('%' || $1 || '%')) THEN 70

                        -- Prioridad 5: Match Difuso (Typos) en Título (Score variable)
                        ELSE (similarity(unaccent(lower(r.title)), unaccent(lower($1))) * 60)
                    END
                ) as relevance_score
            FROM resources r
            LEFT JOIN topic_resources tr ON r.id = tr.resource_id
            LEFT JOIN topics t ON t.id = tr.topic_id
            LEFT JOIN course_books cb ON r.id = cb.resource_id
            LEFT JOIN courses c ON c.id = cb.course_id
            -- ✅ NUEVOS JOINS para contexto de carrera (Deep Search)
            LEFT JOIN course_careers cc ON c.id = cc.course_id
            LEFT JOIN careers car ON car.id = cc.career_id
            WHERE 
                -- ✅ Match TIPO (Si se detectó)
                ${detectedType ? `(r.resource_type = $2) OR` : ''}

                -- Match Título Libro
                (unaccent(lower(r.title)) LIKE unaccent(lower('%' || $1 || '%'))) OR 
                (word_similarity(unaccent(lower($1)), unaccent(lower(r.title))) > 0.3) OR
                
                -- Match Autor
                (unaccent(lower(r.author)) LIKE unaccent(lower('%' || $1 || '%'))) OR

                -- Match Tema
                (unaccent(lower(t.name)) LIKE unaccent(lower('%' || $1 || '%'))) OR
                (word_similarity(unaccent(lower($1)), unaccent(lower(t.name))) > 0.3) OR

                -- Match Contexto Curso
                (unaccent(lower(c.name)) LIKE unaccent(lower('%' || $1 || '%'))) OR
                (word_similarity(unaccent(lower($1)), unaccent(lower(c.name))) > 0.3) OR

                -- ✅ NUEVO Match: Contexto Carrera (STRICT MODE)
                -- Solo si coincide MUCHO con el nombre de la carrera (evitar "Humana" -> "Medicina Humana" -> traer todo)
                (unaccent(lower(car.name)) LIKE unaccent(lower('%' || $1 || '%'))) OR
                (word_similarity(unaccent(lower($1)), unaccent(lower(car.name))) > 0.75) OR

                r.isbn ILIKE $1
            ORDER BY relevance_score DESC, r.title
            LIMIT 60
        `;

        try {
            const { rows } = await db.query(sqlQuery, params);
            return rows;
        } catch (error) {
            console.error("Error en búsqueda avanzada libros:", error);
            return [];
        }
    }
}

module.exports = BookRepository;