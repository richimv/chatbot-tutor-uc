const db = require('../../infrastructure/database/db');

class BookRepository {

    async findAll() {
        const { rows } = await db.query('SELECT * FROM resources ORDER BY title');
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
        // ✅ BÚSQUEDA AVANZADA (Libros): Tokens & Ranking
        const { normalizeText } = require('../utils/textUtils'); // Lazy require para evitar ciclos si fuera necesario
        const cleanQuery = normalizeText(query || '').trim();
        if (!cleanQuery) return [];

        const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 2);
        const searchTerms = tokens.length > 0 ? tokens : [cleanQuery];

        const normalize = (col) => `unaccent(lower(${col}))`;
        const params = [cleanQuery];

        // Condiciones dinámicas para tokens
        const tokenConditions = searchTerms.map((_, index) => {
            const paramIdx = index + 2;
            return `
                ${normalize('r.title')} LIKE ${normalize(`$${paramIdx}`)} OR 
                ${normalize('r.author')} LIKE ${normalize(`$${paramIdx}`)} OR
                ${normalize('t.name')} LIKE ${normalize(`$${paramIdx}`)}
            `;
        });

        searchTerms.forEach(t => params.push(`%${t}%`));

        const sqlQuery = `
            SELECT DISTINCT r.*,
                (
                    CASE 
                        WHEN ${normalize('r.title')} LIKE '%' || ${normalize('$1')} || '%' THEN 100
                        WHEN ${normalize('t.name')} LIKE '%' || ${normalize('$1')} || '%' THEN 80
                        ${tokenConditions.length > 0 ? `WHEN (${tokenConditions.join(' AND ')}) THEN 60` : ''}
                        ELSE 20
                    END
                ) as relevance_score
            FROM resources r
            LEFT JOIN topic_resources tr ON r.id = tr.resource_id
            LEFT JOIN topics t ON t.id = tr.topic_id
            WHERE 
                (${normalize('r.title')} LIKE '%' || ${normalize('$1')} || '%') OR 
                (${normalize('r.author')} LIKE '%' || ${normalize('$1')} || '%') OR
                (${normalize('t.name')} LIKE '%' || ${normalize('$1')} || '%') OR
                r.isbn ILIKE $1
                ${tokenConditions.length > 0 ? `OR (${tokenConditions.join(' OR ')})` : ''}
            ORDER BY relevance_score DESC, r.title
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