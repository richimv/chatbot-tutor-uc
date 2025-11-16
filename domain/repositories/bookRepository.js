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
        const { title, author, url } = bookData;
        // ✅ SOLUCIÓN: Generar el 'resource_id' de texto que la base de datos requiere.
        const resourceId = `RES_${Date.now()}`;
        const { rows } = await db.query(
            'INSERT INTO resources (resource_id, title, author, url) VALUES ($1, $2, $3, $4) RETURNING *',
            [resourceId, title, author, url]
        );
        return rows[0];
    }

    async update(id, bookData) {
        const { title, author, url } = bookData;
        const { rows } = await db.query(
            'UPDATE resources SET title = $1, author = $2, url = $3 WHERE id = $4 RETURNING *',
            [title, author, url, id]
        );
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
}

module.exports = BookRepository;