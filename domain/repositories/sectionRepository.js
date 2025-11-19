const db = require('../../infrastructure/database/db');

class SectionRepository {

    async findAll() {
        // ✅ CORRECCIÓN: Agrupar por la clave primaria 's.id' es suficiente en PostgreSQL
        // para permitir otras columnas de la misma tabla en el SELECT.
        const { rows } = await db.query(`
            SELECT 
                -- ✅ SOLUCIÓN: Seleccionar explícitamente las columnas para asegurar que el 'id' siempre esté presente.
                s.id,
                s.course_id AS "courseId",
                s.instructor_id AS "instructorId",
                s.schedule,
                COALESCE(ARRAY_AGG(sc.career_id) FILTER (WHERE sc.career_id IS NOT NULL), '{}') as "careerIds"
            FROM sections s
            LEFT JOIN section_careers sc ON s.id = sc.section_id
            GROUP BY s.id
            ORDER BY s.id;
        `);
        return rows;
    }

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM sections WHERE id = $1', [id]);
        return rows[0];
    }

    async create(sectionData) {
        const { courseId, instructorId, schedule, careerIds } = sectionData;
        // ✅ SOLUCIÓN: Generar un 'section_id' temporal para satisfacer la restricción NOT NULL.
        const tempSectionId = `SEC-${Date.now()}`;

        // Esto debería ser una transacción para ser seguro
        const { rows } = await db.query(
            'INSERT INTO sections (course_id, instructor_id, schedule, section_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [courseId, instructorId, JSON.stringify(schedule), tempSectionId]
        );
        const newSection = rows[0];
        // Insertar en la tabla de unión section_careers
        if (careerIds && careerIds.length > 0) {
            const insertPromises = careerIds.map(careerId =>
                    db.query('INSERT INTO section_careers (section_id, career_id) VALUES ($1, $2)', [newSection.id, careerId])
            );
            await Promise.all(insertPromises);
        }
        return newSection;
    }

    async update(id, sectionData) {
        const { courseId, instructorId, schedule, careerIds } = sectionData;

        // Iniciar transacción
        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');

            // 1. Actualizar la tabla principal 'sections'
            const { rows } = await client.query(
                'UPDATE sections SET course_id = $1, instructor_id = $2, schedule = $3 WHERE id = $4 RETURNING *',
                [courseId, instructorId, JSON.stringify(schedule), id]
            );
            const updatedSection = rows[0];

            if (!updatedSection) {
                throw new Error(`Sección con ID ${id} no encontrada.`);
            }

            // 2. Actualizar la tabla de unión 'section_careers'
            // Primero, eliminar las asociaciones de carreras existentes para esta sección
            await client.query('DELETE FROM section_careers WHERE section_id = $1', [id]);

            // Luego, insertar las nuevas asociaciones de carreras
            if (careerIds && careerIds.length > 0) {
                const insertPromises = careerIds.map(careerId =>
                    client.query('INSERT INTO section_careers (section_id, career_id) VALUES ($1, $2)', [id, careerId])
                );
                await Promise.all(insertPromises);
            }

            // Confirmar la transacción
            await client.query('COMMIT');
            return updatedSection;

        } catch (error) {
            // Si algo sale mal, revertir la transacción
            await client.query('ROLLBACK');
            throw error; // Re-lanzar el error para que sea manejado por el servicio/controlador
        } finally {
            // Liberar el cliente de vuelta al pool
            client.release();
        }
    }

    async delete(id) {
        const { rowCount } = await db.query('DELETE FROM sections WHERE id = $1', [id]);
        if (rowCount === 0) {
            throw new Error(`Sección con ID ${id} no encontrada.`);
        }
        return { success: true };
    }
}

module.exports = SectionRepository;