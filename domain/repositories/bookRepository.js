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
        // Mantenemos el query original para el replace, solo añadimos %
        const searchTerm = `%${query}%`;

        // Función helper para construir la parte SQL de normalización
        const normalize = (col) => `translate(lower(${col}), 'áéíóúÁÉÍÓÚüÜ', 'aeiouaeiouuu')`;

        const sqlQuery = `
            SELECT * FROM resources 
            WHERE 
                ${normalize('title')} LIKE ${normalize('$1')} OR 
                ${normalize('author')} LIKE ${normalize('$1')} OR 
                ${normalize('publisher')} LIKE ${normalize('$1')} OR
                isbn ILIKE $1
            ORDER BY title
        `;

        // Usamos LIKE porque ya estamos normalizando todo a minúsculas
        const { rows } = await db.query(sqlQuery, [searchTerm]);
        return rows;
    }
}

module.exports = BookRepository;