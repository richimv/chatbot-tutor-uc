const db = require('../../infrastructure/database/db');

class TopicRepository {

    async findAll() {
        // ✅ SOLUCIÓN: Hacer que findAll() obtenga también los IDs de los libros/recursos asociados.
        const { rows } = await db.query(`
            SELECT 
                t.*,
                (
                    SELECT COALESCE(ARRAY_AGG(tr.resource_id), '{}')
                    FROM topic_resources tr
                    WHERE tr.topic_id = t.id
                ) as "bookIds"
            FROM topics t
            ORDER BY t.name;
        `);
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM topics WHERE id = $1', [id]);
        return rows[0];
    }

    async create(topicData) {
        // ✅ SOLUCIÓN: La lógica de creación debe manejar la tabla de unión 'topic_resources'.
        const { name, description, bookIds } = topicData; // 'bookIds' viene del formulario de admin.
        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            // ✅ SOLUCIÓN TEMPORAL: Generar un 'topic_id' de texto para satisfacer la restricción NOT NULL.
            // La solución ideal es eliminar la columna 'topic_id' de la tabla 'topics' en la base de datos.
            const tempTopicId = `TOPIC_${Date.now()}`;
            const topicRes = await client.query('INSERT INTO topics (topic_id, name, description) VALUES ($1, $2, $3) RETURNING *', [tempTopicId, name, description]);
            const newTopic = topicRes.rows[0];

            if (bookIds && bookIds.length > 0) {
                const insertPromises = bookIds.map(bookId =>
                    client.query('INSERT INTO topic_resources (topic_id, resource_id) VALUES ($1, $2)', [newTopic.id, bookId])
                );
                await Promise.all(insertPromises);
            }
            await client.query('COMMIT');
            return newTopic;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async update(id, topicData) {
        // ✅ SOLUCIÓN: La lógica de actualización debe manejar la tabla de unión 'topic_resources'.
        const { name, description, bookIds } = topicData;
        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            // ✅ SOLUCIÓN: Eliminar la actualización de 'updated_at' porque la columna no existe en la tabla 'topics'.
            const topicRes = await client.query('UPDATE topics SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description, id]);
            const updatedTopic = topicRes.rows[0];

            await client.query('DELETE FROM topic_resources WHERE topic_id = $1', [id]); // Limpiar relaciones antiguas
            if (bookIds && bookIds.length > 0) {
                const insertPromises = bookIds.map(bookId => client.query('INSERT INTO topic_resources (topic_id, resource_id) VALUES ($1, $2)', [id, bookId]));
                await Promise.all(insertPromises);
            }
            await client.query('COMMIT');
            return updatedTopic;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM topics WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Tema con ID ${id} no encontrado para eliminar.`);
        }
        return { success: true };
    }
}

module.exports = TopicRepository;