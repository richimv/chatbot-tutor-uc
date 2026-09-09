const db = require('../../infrastructure/database/db');
const { validateCSVExportParams } = require('../utils/securityUtils');

function formatPlainTextToHtml(text) {
    if (!text) return '';
    const str = String(text);
    // Si ya empieza con tags HTML, lo dejamos tal cual
    if (str.trimStart().startsWith('<')) {
        return str;
    }
    
    // Normalizar saltos de línea a \n
    const clean = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Dividir por doble salto de línea (o más) para párrafos
    const paragraphs = clean.split(/\n\n+/);
    
    // Para cada párrafo, reemplazar saltos de línea simples con <br> y envolver en <p>
    const html = paragraphs.map(p => {
        const pClean = p.trim().replace(/\n/g, '<br>');
        return pClean ? `<p>${pClean}</p>` : '';
    }).filter(Boolean).join('');
    
    return html;
}

function decodeHtmlEntities(str) {
    if (!str) return '';
    return String(str)
        .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
        .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
        .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
        .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
        .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
        .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
        .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
        .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&iquest;/g, '¿')
        .replace(/&iexcl;/g, '¡');
}

class AdminRepository {
    async getOverallStats() {
        const [usersRes, premiumRes, searchesRes, chatsRes, topCoursesRes, topResourcesRes] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM users'),
            db.query("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'"),
            db.query('SELECT COUNT(*) as count FROM search_history'),
            db.query('SELECT 0 as count'),
            db.query(`SELECT c.name, COUNT(*) as visits FROM page_views pv JOIN courses c ON pv.entity_id = c.id WHERE pv.entity_type = 'course' GROUP BY c.name ORDER BY visits DESC LIMIT 5`),
            db.query(`
                SELECT 
                    r.title || ' (' || r.resource_type || ')' as name, 
                    COUNT(*) as visits 
                FROM page_views pv 
                JOIN resources r ON pv.entity_id = r.id 
                WHERE pv.entity_type = r.resource_type
                GROUP BY r.title, r.resource_type 
                ORDER BY visits DESC 
                LIMIT 5
            `)
        ]);

        return {
            usersCount: parseInt(usersRes.rows[0].count, 10),
            premiumCount: parseInt(premiumRes.rows[0].count, 10),
            searchesCount: parseInt(searchesRes.rows[0].count, 10),
            chatsCount: parseInt(chatsRes.rows[0].count, 10),
            topCourses: topCoursesRes.rows,
            topResources: topResourcesRes.rows
        };
    }

    async getAllQuestions(domain, search, page = 1, limit = 100, caseFilter = 'all') {
        let query = `
            SELECT qb.id, qb.question_text, qb.domain, qb.target, qb.career, qb.topic, qb.subtopic, 
                   qb.difficulty, qb.created_at, qb.options, qb.correct_option_index as correct_answer, 
                   qb.explanation, qb.explanation_image_url, qb.image_url,
                   qb.case_id, qb.case_order,
                   cs.code as case_code, cs.title as case_title, cs.description_text as case_description
            FROM question_bank qb
            LEFT JOIN case_scenarios cs ON qb.case_id = cs.id
        `;
        const params = [];
        const conditions = [];

        if (domain && domain !== 'all') {
            params.push(domain);
            conditions.push(`qb.domain = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(qb.question_text ILIKE $${params.length} OR qb.topic ILIKE $${params.length} OR qb.subtopic ILIKE $${params.length} OR cs.code ILIKE $${params.length} OR cs.title ILIKE $${params.length})`);
        }

        if (caseFilter === 'linked') {
            conditions.push(`qb.case_id IS NOT NULL`);
        } else if (caseFilter === 'unlinked') {
            conditions.push(`qb.case_id IS NULL`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const safeOffset = Math.max((parseInt(page, 10) - 1) * safeLimit, 0);

        params.push(safeLimit, safeOffset);
        query += ` ORDER BY qb.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async getAllCases(domain = 'all', search = '', page = 1, limit = 100) {
        let query = `
            SELECT cs.id, cs.code, cs.title, cs.description_text, cs.image_url,
                   cs.domain, cs.target, cs.topic, cs.created_at, cs.updated_at,
                   COUNT(qb.id)::int as questions_count
            FROM case_scenarios cs
            LEFT JOIN question_bank qb ON cs.id = qb.case_id
        `;
        const params = [];
        const conditions = [];

        if (domain && domain !== 'all') {
            params.push(domain);
            conditions.push(`cs.domain = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(cs.code ILIKE $${params.length} OR cs.title ILIKE $${params.length} OR cs.description_text ILIKE $${params.length} OR cs.topic ILIKE $${params.length})`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        query += ` GROUP BY cs.id `;

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const safeOffset = Math.max((parseInt(page, 10) - 1) * safeLimit, 0);

        params.push(safeLimit, safeOffset);
        query += ` ORDER BY cs.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async getCaseById(id) {
        const caseQuery = `SELECT * FROM case_scenarios WHERE id = $1`;
        const caseRes = await db.query(caseQuery, [id]);
        if (caseRes.rows.length === 0) return null;

        const caseData = caseRes.rows[0];
        const questionsQuery = `
            SELECT id, question_text, options, correct_option_index as correct_answer, 
                   explanation, explanation_image_url, image_url, topic, subtopic, difficulty, 
                   case_order, created_at
            FROM question_bank 
            WHERE case_id = $1
            ORDER BY case_order ASC, created_at ASC
        `;
        const questionsRes = await db.query(questionsQuery, [id]);
        caseData.questions = questionsRes.rows;
        return caseData;
    }

    async createCase({ code, title, description_text = '', image_url = null, domain = 'education', target = 'N/A', topic = 'General' }) {
        const query = `
            INSERT INTO case_scenarios (code, title, description_text, image_url, domain, target, topic, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *;
        `;
        const values = [
            code ? String(code).trim() : null,
            title ? decodeHtmlEntities(String(title).trim()) : '',
            description_text ? decodeHtmlEntities(formatPlainTextToHtml(description_text)) : '',
            image_url,
            domain || 'education',
            target || 'N/A',
            topic || 'General'
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async updateCase(id, data = {}) {
        const fields = [];
        const values = [];
        let idx = 1;

        if (data.code !== undefined) {
            fields.push(`code = $${idx++}`);
            values.push(data.code ? String(data.code).trim() : null);
        }
        if (data.title !== undefined) {
            fields.push(`title = $${idx++}`);
            values.push(data.title ? decodeHtmlEntities(String(data.title).trim()) : null);
        }
        if (data.description_text !== undefined) {
            fields.push(`description_text = $${idx++}`);
            values.push(data.description_text ? decodeHtmlEntities(formatPlainTextToHtml(data.description_text)) : '');
        }
        if (data.image_url !== undefined) {
            fields.push(`image_url = $${idx++}`);
            values.push(data.image_url);
        }
        if (data.domain !== undefined) {
            fields.push(`domain = $${idx++}`);
            values.push(data.domain || 'education');
        }
        if (data.target !== undefined) {
            fields.push(`target = $${idx++}`);
            values.push(data.target || 'N/A');
        }
        if (data.topic !== undefined) {
            fields.push(`topic = $${idx++}`);
            values.push(data.topic || 'General');
        }

        if (fields.length === 0) {
            const current = await this.getCaseById(id);
            return current;
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE case_scenarios 
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *;
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async saveBulkCasesAdmin(casesArray) {
        if (!casesArray || !Array.isArray(casesArray) || casesArray.length === 0) {
            return { success: false, inserted: 0 };
        }

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            let insertedCount = 0;

            const canonicalDomain = (val) => {
                const allowed = ['medicine', 'education'];
                const v = String(val || '').toLowerCase().trim().replace(/\s+/g, '_');
                return allowed.includes(v) ? v : 'education';
            };

            for (const c of casesArray) {
                const code = c.code || c.codigo_caso || c.CODIGO_CASO || c.caso_codigo;
                if (!code || !String(code).trim()) continue;

                const cleanCode = String(code).trim();
                const title = decodeHtmlEntities(String(c.title || c.titulo_caso || c.TITULO_CASO || cleanCode).trim());
                const desc = decodeHtmlEntities(formatPlainTextToHtml(String(c.description_text || c.enunciado_caso || c.ENUNCIADO_CASO || c.descripcion_caso || '')));
                const image_url = c.image_url || c.imagen_caso || c.IMAGEN_CASO || null;
                const domain = canonicalDomain(c.domain || c.dominio);
                const target = c.target || c.examen_objetivo || 'N/A';
                const topic = c.topic || c.area_estudio || c.area || 'General';

                const existingRes = await client.query('SELECT id FROM case_scenarios WHERE code = $1', [cleanCode]);
                if (existingRes && existingRes.rows && existingRes.rows.length > 0) {
                    await client.query(
                        `UPDATE case_scenarios 
                         SET title = COALESCE($1, title),
                             description_text = CASE WHEN $2 <> '' THEN $2 ELSE description_text END,
                             image_url = COALESCE($3, image_url),
                             domain = $4, target = $5, topic = $6, updated_at = NOW()
                         WHERE id = $7`,
                        [title, desc, image_url, domain, target, topic, existingRes.rows[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO case_scenarios (code, title, description_text, image_url, domain, target, topic, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                        [cleanCode, title, desc, image_url, domain, target, topic]
                    );
                }
                insertedCount++;
            }

            await client.query('COMMIT');
            return { success: true, inserted: insertedCount };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error insertando bulk cases:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteCase(id) {
        // Questions will automatically have case_id set to NULL due to ON DELETE SET NULL
        const result = await db.query('DELETE FROM case_scenarios WHERE id = $1 RETURNING id', [id]);
        return result.rowCount > 0;
    }

    async linkQuestionsToCase(caseId, questionIdsWithOrder) {
        if (!Array.isArray(questionIdsWithOrder) || questionIdsWithOrder.length === 0) {
            return { success: false, updated: 0 };
        }

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            let count = 0;
            for (let i = 0; i < questionIdsWithOrder.length; i++) {
                const item = questionIdsWithOrder[i];
                const qId = typeof item === 'object' ? item.id : item;
                const order = (typeof item === 'object' && item.order !== undefined) ? parseInt(item.order, 10) : (i + 1);
                
                await client.query(
                    `UPDATE question_bank SET case_id = $1, case_order = $2 WHERE id = $3`,
                    [caseId, order, qId]
                );
                count++;
            }
            await client.query('COMMIT');
            return { success: true, updated: count };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async unlinkQuestionFromCase(questionId) {
        const result = await db.query(
            `UPDATE question_bank SET case_id = NULL, case_order = 1 WHERE id = $1 RETURNING id`,
            [questionId]
        );
        return result.rowCount > 0;
    }

    async addQuestion({ question_text, options, correct_answer, explanation, explanation_image_url, domain, target, career, topic, subtopic, difficulty, image_url, hash, case_id = null, case_order = 1 }) {
        const insertQuery = `
            INSERT INTO question_bank (
                question_text, options, correct_option_index, explanation, explanation_image_url, 
                domain, target, career, topic, subtopic, difficulty, image_url, question_hash,
                case_id, case_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id;
        `;
        const values = [
            decodeHtmlEntities(question_text), JSON.stringify(options), correct_answer, decodeHtmlEntities(explanation), explanation_image_url,
            domain, target, career, topic, subtopic, difficulty, image_url, hash,
            case_id || null, parseInt(case_order, 10) || 1
        ];

        const result = await db.query(insertQuery, values);
        return result.rows[0].id;
    }

    async getQuestionImages(id) {
        const result = await db.query('SELECT image_url, explanation_image_url, career, question_text, explanation FROM question_bank WHERE id = $1', [id]);
        return result.rows[0];
    }

    async updateQuestion(id, { question_text, options, correct_answer, explanation, explanation_image_url, domain, target, career, topic, subtopic, difficulty, image_url, hash, case_id = null, case_order = 1 }) {
        const updateQuery = `
            UPDATE question_bank 
            SET question_text = $1, options = $2, correct_option_index = $3, 
                explanation = $4, explanation_image_url = $5, domain = $6, 
                target = $7, career = $8, topic = $9, subtopic = $10, difficulty = $11, image_url = $12, question_hash = $13,
                case_id = $14, case_order = $15
            WHERE id = $16
            RETURNING id;
        `;
        const values = [
            decodeHtmlEntities(question_text), JSON.stringify(options), correct_answer, decodeHtmlEntities(explanation), explanation_image_url,
            domain, target, career, topic, subtopic, difficulty, image_url, hash,
            case_id || null, parseInt(case_order, 10) || 1, id
        ];

        const result = await db.query(updateQuery, values);
        return result.rowCount > 0;
    }

    async deleteQuestion(id) {
        const result = await db.query('DELETE FROM question_bank WHERE id = $1 RETURNING id', [id]);
        return result.rowCount > 0;
    }

    async getResourceByUrl(url) {
        const result = await db.query('SELECT id, image_url FROM resources WHERE url = $1 LIMIT 1', [url]);
        return result.rows[0];
    }

    async updateResource(id, title, resourceType, imageUrl, domain = 'medicine', isPremium = false, visible = true, openDirectly = false) {
        await db.query(
            'UPDATE resources SET title = $1, resource_type = $2, image_url = $3, domain = $4, is_premium = $5, visible = $6, open_directly = $7 WHERE id = $8',
            [title, resourceType, imageUrl, domain, isPremium, visible, openDirectly, id]
        );
    }

    async addResource(resourceId, title, author, url, resourceType, imageUrl, domain = 'medicine', isPremium = false, visible = true, openDirectly = false) {
        await db.query(
            'INSERT INTO resources (resource_id, title, author, url, resource_type, is_premium, image_url, domain, visible, open_directly) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [resourceId, title, author, url, resourceType, isPremium, imageUrl, domain, visible, openDirectly]
        );
    }

    async exportTableToCSVBuffer(tableName, columns = '*') {
        validateCSVExportParams(tableName, columns);
        const res = await db.query(`SELECT ${columns} FROM ${tableName}`);
        if (res.rows.length === 0) return null;

        const headers = Object.keys(res.rows[0]).join(',');
        const rows = res.rows.map(row =>
            Object.values(row).map(val => {
                if (val === null) return '';
                if (val instanceof Date) return `"${val.toISOString()}"`;
                const cleanVal = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
                return `"${cleanVal}"`;
            }).join(',')
        ).join('\n');

        return headers + "\n" + rows;
    }

    async saveBulkQuestionBankAdmin(questionsArray) {
        if (!questionsArray || questionsArray.length === 0) return { success: false, inserted: 0 };

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            let insertedCount = 0;
            const crypto = require('crypto');

            const canonicalDifficulty = () => 'Senior';

            const canonicalDomain = (val) => {
                const allowed = ['medicine', 'education'];
                const v = String(val || '').toLowerCase().trim().replace(/\s+/g, '_');
                return allowed.includes(v) ? v : 'medicine';
            };

            // Pre-process case scenarios for questions that have case code/description
            const caseCodeToIdMap = new Map();
            const caseOrderCounters = new Map();

            // 1. Recolectar y consolidar la información más completa de cada código de caso
            const caseDefinitions = new Map();
            for (const q of questionsArray) {
                const rawCaseCode = q.codigo_caso || q.case_code || q.code_caso || q.CODIGO_CASO || q.caso_codigo;
                if (rawCaseCode && String(rawCaseCode).trim()) {
                    const cleanCode = String(rawCaseCode).trim();
                    const normKey = cleanCode.toUpperCase();
                    const desc = String(q.enunciado_caso || q.case_description || q.descripcion_caso || q.ENUNCIADO_CASO || q.caso_enunciado || q.caso_descripcion || '').trim();
                    const title = String(q.titulo_caso || q.case_title || q.TITULO_CASO || '').trim();
                    const img = q.imagen_caso || q.case_image_url || q.IMAGEN_CASO || null;

                    if (!caseDefinitions.has(normKey)) {
                        caseDefinitions.set(normKey, {
                            code: cleanCode,
                            title: title || cleanCode,
                            desc: desc,
                            img: img,
                            domain: q.domain,
                            target: q.target,
                            topic: 'General'
                        });
                    } else {
                        const def = caseDefinitions.get(normKey);
                        // Si una fila subsiguiente trae un enunciado más largo/completo, priorizarlo
                        if (desc && desc.length > (def.desc || '').length) {
                            def.desc = desc;
                        }
                        if (title && (!def.title || def.title === def.code)) {
                            def.title = title;
                        }
                        if (img && !def.img) {
                            def.img = img;
                        }
                    }
                }
            }

            // 2. Crear o resolver en DB cada casuística única consolidada
            for (const [normKey, def] of caseDefinitions.entries()) {
                const existingCaseRes = await client.query('SELECT id, description_text FROM case_scenarios WHERE UPPER(code) = $1', [normKey]);
                if (existingCaseRes.rows.length > 0) {
                    const existingId = existingCaseRes.rows[0].id;
                    caseCodeToIdMap.set(normKey, existingId);
                    // Si el caso existente en DB no tenía enunciado y el Excel sí lo provee, enriquecerlo
                    if ((!existingCaseRes.rows[0].description_text || existingCaseRes.rows[0].description_text.trim() === '') && def.desc) {
                        const formattedDesc = decodeHtmlEntities(formatPlainTextToHtml(def.desc));
                        await client.query('UPDATE case_scenarios SET description_text = $1, updated_at = NOW() WHERE id = $2', [formattedDesc, existingId]);
                    }
                } else {
                    const formattedDesc = decodeHtmlEntities(formatPlainTextToHtml(def.desc || 'Situación del caso'));
                    const title = def.title || def.code;
                    const domain = canonicalDomain(def.domain);
                    const target = def.target || 'N/A';
                    const topic = 'General';

                    const insertCaseRes = await client.query(
                        `INSERT INTO case_scenarios (code, title, description_text, image_url, domain, target, topic, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                         RETURNING id`,
                        [def.code, title, formattedDesc, def.img, domain, target, topic]
                    );
                    caseCodeToIdMap.set(normKey, insertCaseRes.rows[0].id);
                }
            }

            const BATCH_SIZE = 50;
            for (let i = 0; i < questionsArray.length; i += BATCH_SIZE) {
                const batch = questionsArray.slice(i, i + BATCH_SIZE);
                const values = [];
                const valuePlaceholders = [];

                batch.forEach((q, idx) => {
                    const domain = canonicalDomain(q.domain);
                    const target = q.target || 'N/A';
                    const exactTopic = q.topic || 'General';
                    const exactSubtopic = q.subtopic || null;
                    const difficulty = canonicalDifficulty(q.difficulty);
                    const question_text = decodeHtmlEntities(formatPlainTextToHtml(String(q.question_text || q.question || '')));

                    let options = q.options;
                    if (!Array.isArray(options)) {
                        const a = q.option_a || q.opcion_a || q.OPCION_A || q.optionA || q.opcionA || '';
                        const b = q.option_b || q.opcion_b || q.OPCION_B || q.optionB || q.opcionB || '';
                        const c = q.option_c || q.opcion_c || q.OPCION_C || q.optionC || q.opcionC || '';
                        const d = q.option_d || q.opcion_d || q.OPCION_D || q.optionD || q.opcionD || '';
                        const e = q.option_e || q.opcion_e || q.OPCION_E || q.optionE || q.opcionE || '';
                        if (a || b || c) {
                            options = [a, b, c];
                            if (d) options.push(d);
                            if (e) options.push(e);
                        } else {
                            options = [];
                        }
                    }
                    const optionsStr = JSON.stringify(options || []);
                    const correct_option_index = parseInt(q.correct_option_index !== undefined ? q.correct_option_index : (q.correct_answer !== undefined ? q.correct_answer : (q.correctAnswerIndex || 0)), 10);
                    const explanation = decodeHtmlEntities(formatPlainTextToHtml(q.explanation || ''));
                    const explanation_image_url = q.explanation_image_url || q.EXPLICACION_IMAGEN || null;
                    const image_url = q.image_url || null;
                    const career = q.career || null;

                    // Resolve case_id and case_order
                    const rawCaseCode = q.codigo_caso || q.case_code || q.code_caso || q.CODIGO_CASO || q.caso_codigo;
                    let case_id = q.case_id || null;
                    if (rawCaseCode && caseCodeToIdMap.has(String(rawCaseCode).trim().toUpperCase())) {
                        case_id = caseCodeToIdMap.get(String(rawCaseCode).trim().toUpperCase());
                    }

                    let case_order = 1;
                    if (case_id) {
                        const explicitOrder = q.orden_caso || q.case_order || q.ORDEN_CASO || q.caso_orden;
                        if (explicitOrder !== undefined && !isNaN(parseInt(explicitOrder, 10))) {
                            case_order = parseInt(explicitOrder, 10);
                        } else {
                            const currentCount = caseOrderCounters.get(case_id) || 0;
                            case_order = currentCount + 1;
                            caseOrderCounters.set(case_id, case_order);
                        }
                    }

                    const normTopic = String(exactTopic || 'General').toLowerCase().trim();
                    const normText = String(question_text || '').toLowerCase().trim();
                    const rawStringForHash = `${normTopic}-${normText}-${optionsStr}-${case_id || ''}-${case_order}`;
                    const hash = crypto.createHash('md5').update(rawStringForHash).digest('hex');

                    const offset = idx * 15;
                    valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15})`);

                    values.push(domain, target, exactTopic, exactSubtopic, difficulty, question_text, optionsStr, correct_option_index, explanation, explanation_image_url, image_url, hash, career, case_id, case_order);
                });

                const batchQuery = `
                    INSERT INTO question_bank (domain, target, topic, subtopic, difficulty, question_text, options, correct_option_index, explanation, explanation_image_url, image_url, question_hash, career, case_id, case_order)
                    VALUES ${valuePlaceholders.join(', ')}
                    ON CONFLICT (question_hash) DO UPDATE SET 
                        target = EXCLUDED.target,
                        image_url = EXCLUDED.image_url,
                        explanation = EXCLUDED.explanation,
                        explanation_image_url = EXCLUDED.explanation_image_url,
                        options = EXCLUDED.options,
                        career = EXCLUDED.career,
                        subtopic = EXCLUDED.subtopic,
                        case_id = EXCLUDED.case_id,
                        case_order = EXCLUDED.case_order;
                `;

                await client.query(batchQuery, values);
                insertedCount += batch.length;
            }

            await client.query('COMMIT');
            return { success: true, inserted: insertedCount };
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Error insertando bulk questions:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    formatPlainTextToHtml(text) {
        return formatPlainTextToHtml(text);
    }

    decodeHtmlEntities(text) {
        return decodeHtmlEntities(text);
    }
}

module.exports = new AdminRepository();
