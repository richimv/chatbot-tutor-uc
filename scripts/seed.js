const fs = require('fs').promises;
const path = require('path');
const db = require('../infrastructure/database/db');

const DB_PATH = path.join(__dirname, '../infrastructure/database');
const ANALYTICS_DB_PATH = path.join(DB_PATH, 'analytics.json'); // Ruta al archivo analytics.json

async function readJsonFile(fileName) {
    const filePath = path.join(DB_PATH, fileName);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Error al leer el archivo ${fileName}:`, error.message);
        // Si el archivo no se puede leer, devolvemos un array vacío para no detener el script
        return [];
    }
}

async function seedDatabase() {
    console.log('🌱 Iniciando el script de sembrado de la base de datos...');

    // Usaremos un cliente único para manejar la transacción
    const client = await db.pool().connect();

    try {
        // Iniciar transacción
        await client.query('BEGIN');
        console.log('🔛 Transacción iniciada.');

        // 1. Cargar todos los datos desde los archivos JSON
        const careers = await readJsonFile('careers.json');
        const instructors = await readJsonFile('instructors.json');
        const resources = await readJsonFile('books.json');
        const topics = await readJsonFile('topics.json');
        const courses = await readJsonFile('courses.json');
        const sections = await readJsonFile('sections.json');
        const analyticsData = await readJsonFile('analytics.json'); // Leer analytics.json
        console.log('📂 Archivos JSON leídos correctamente.');

        // 2. Insertar datos en tablas principales y guardar los mapeos de IDs
        console.log('... Insertando carreras...');
        const careerIdMap = new Map();
        for (const career of careers) {
            const res = await client.query(
                'INSERT INTO careers(career_id, name, curriculum_url) VALUES($1, $2, $3) RETURNING id, career_id',
                [career.id, career.name, career.curriculumUrl]
            );
            careerIdMap.set(res.rows[0].career_id, res.rows[0].id);
        }

        console.log('... Insertando docentes...');
        const instructorIdMap = new Map();
        for (const instructor of instructors) {
            const res = await client.query(
                'INSERT INTO instructors(instructor_id, name) VALUES($1, $2) RETURNING id, instructor_id',
                [instructor.id, instructor.name]
            );
            instructorIdMap.set(res.rows[0].instructor_id, res.rows[0].id);
        }

        console.log('... Insertando recursos (libros)...');
        const resourceIdMap = new Map();
        for (const resource of resources) {
            const res = await client.query(
                'INSERT INTO resources(resource_id, title, author, url) VALUES($1, $2, $3, $4) RETURNING id, resource_id',
                [resource.id, resource.title, resource.author, resource.url]
            );
            resourceIdMap.set(res.rows[0].resource_id, res.rows[0].id);
        }

        console.log('... Insertando temas...');
        const topicIdMap = new Map();
        for (const topic of topics) {
            const res = await client.query(
                'INSERT INTO topics(topic_id, name, description) VALUES($1, $2, $3) RETURNING id, topic_id',
                [topic.id, topic.name, topic.description || null]
            );
            topicIdMap.set(res.rows[0].topic_id, res.rows[0].id);
        }

        console.log('... Insertando cursos...');
        const courseIdMap = new Map();
        for (const course of courses) {
            const res = await client.query(
                'INSERT INTO courses(course_id, name, description) VALUES($1, $2, $3) RETURNING id, course_id',
                [course.id, course.name, course.description || null]
            );
            courseIdMap.set(res.rows[0].course_id, res.rows[0].id);
        }

        console.log('... Insertando secciones...');
        const sectionIdMap = new Map();
        for (const section of sections) {
            const coursePgId = courseIdMap.get(section.courseId);
            const instructorPgId = instructorIdMap.get(section.instructorId);

            if (!coursePgId) {
                console.warn(`⚠️ Saltando sección "${section.id}" porque su curso "${section.courseId}" no fue encontrado.`);
                continue;
            }

            const res = await client.query(
                'INSERT INTO sections(section_id, course_id, instructor_id, schedule) VALUES($1, $2, $3, $4) RETURNING id, section_id',
                [section.id, coursePgId, instructorPgId || null, JSON.stringify(section.schedule || [])]
            );
            sectionIdMap.set(res.rows[0].section_id, res.rows[0].id);
        }

        console.log('... Insertando relaciones (tablas de unión)...');

        // 3. Insertar relaciones en tablas de unión usando los mapeos
        for (const course of courses) {
            const coursePgId = courseIdMap.get(course.id);
            if (course.topicIds && coursePgId) {
                for (const topicId of course.topicIds) {
                    const topicPgId = topicIdMap.get(topicId);
                    if (topicPgId) {
                        await client.query('INSERT INTO course_topics(course_id, topic_id) VALUES($1, $2) ON CONFLICT DO NOTHING', [coursePgId, topicPgId]);
                    }
                }
            }
        }

        for (const section of sections) {
            const sectionPgId = sectionIdMap.get(section.id);
            if (section.careerIds && sectionPgId) {
                for (const careerId of section.careerIds) {
                    const careerPgId = careerIdMap.get(careerId);
                    if (careerPgId) {
                        await client.query('INSERT INTO section_careers(section_id, career_id) VALUES($1, $2) ON CONFLICT DO NOTHING', [sectionPgId, careerPgId]);
                    }
                }
            }
        }

        // 4. Insertar datos de analítica
        console.log('... Insertando historial de búsquedas...');
        const searchHistory = analyticsData.searchHistory || [];
        for (const record of searchHistory) {
            await client.query(
                'INSERT INTO search_history(query, results_count, is_educational_query, created_at) VALUES($1, $2, $3, $4)',
                [record.query, record.resultsCount || 0, record.isEducationalQuery || false, record.timestamp || new Date()]
            );
        }
        console.log(`✅ ${searchHistory.length} registros de historial de búsqueda insertados.`);

        console.log('... Insertando feedback...');
        const feedback = analyticsData.feedback || [];
        for (const record of feedback) {
            await client.query(
                'INSERT INTO feedback(query, response, is_helpful, created_at) VALUES($1, $2, $3, $4)',
                [record.query, record.response, record.isHelpful, record.timestamp || new Date()]
            );
        }
        console.log(`✅ ${feedback.length} registros de feedback insertados.`);

        // 5. Eliminar el archivo analytics.json después de la migración exitosa
        try {
            await fs.unlink(ANALYTICS_DB_PATH);
            console.log('🗑️ Archivo analytics.json eliminado después de la migración exitosa.');
        } catch (unlinkError) {
            if (unlinkError.code !== 'ENOENT') { // Ignorar si el archivo ya no existe
                console.warn('⚠️ No se pudo eliminar analytics.json:', unlinkError.message);
            }
        }

        // Confirmar transacción
        await client.query('COMMIT');
        console.log('✅ ¡Éxito! Todos los datos han sido importados a la base de datos PostgreSQL.');

    } catch (error) {
        // Si algo falla, deshacer todo
        await client.query('ROLLBACK');
        console.error('❌ Error durante el sembrado. La transacción ha sido revertida.');
        console.error(error);
    } finally {
        // Liberar el cliente de vuelta al pool
        client.release();
        console.log('🔚 Script de sembrado finalizado.');
    }
}

seedDatabase().catch(err => console.error('Error fatal ejecutando el script:', err));
