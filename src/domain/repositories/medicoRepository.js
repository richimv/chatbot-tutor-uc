const db = require('../../infrastructure/database/db');
const crypto = require('crypto');

class MedicoRepository {

    async findQuestionsInBankBatch(target, topics, limit = 10, userId, career = null, difficulty = null, sessionSeenIds = [], mode = null) {
        let seenIds = [];
        const isRealMock = mode === 'real' || limit >= 50;

        if (!isRealMock && userId) {
            const seenQuery = `SELECT question_id FROM user_question_history WHERE user_id = $1 AND seen_at > NOW() - INTERVAL '24 hours'`;
            const seenRes = await db.query(seenQuery, [userId]);
            seenIds = seenRes.rows.map(r => r.question_id);
        }

        if (sessionSeenIds && Array.isArray(sessionSeenIds) && sessionSeenIds.length > 0) {
            seenIds = [...new Set([...seenIds, ...sessionSeenIds])];
        }

        // Sanitize to only valid UUID strings
        seenIds = seenIds.filter(id => id && typeof id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id));

        console.log(`🔎 [MedicoRepo] Usuario ${userId} solicitando lote de ${limit} (${isRealMock ? 'Simulacro Real: anti-repetición 24h omitido' : seenIds.length + ' vistas excluidas'}).`);

        const filterTopics = topics && topics.length > 0 && !topics.includes('*') && !topics.includes('ALL') && !topics.includes('all');
        let whereClauses = `WHERE qb.domain = 'medicine' AND ($2::text IS NULL OR qb.target = $2)`;
        if (filterTopics) {
            whereClauses += ` AND unaccent(UPPER(qb.topic)) = ANY(SELECT unaccent(UPPER(unnest($1::text[]))))`;
        }

        const params = [topics, target];
        let paramIdx = 3;

        if (career) {
            whereClauses += ` AND (qb.career IS NULL OR qb.career = $${paramIdx}) `;
            params.push(career);
            paramIdx++;
        }

        const isMixtoDifficulty = !difficulty || ['MIXTO', 'TODOS', 'ALL', 'MIXED', 'DEFAULT', 'GENERAL'].includes(String(difficulty).toUpperCase().trim());
        if (!isMixtoDifficulty) {
            whereClauses += ` AND qb.difficulty = $${paramIdx} `;
            params.push(difficulty);
            paramIdx++;
        }

        if (seenIds.length > 0) {
            whereClauses += ` AND qb.id <> ALL($${paramIdx}::uuid[]) `;
            params.push(seenIds);
            paramIdx++;
        }

        const query = `
            WITH BalancedPool AS (
                SELECT qb.id, qb.question_text, qb.options, qb.correct_option_index, qb.explanation, 
                       qb.explanation_image_url, qb.image_url, qb.domain, qb.topic,
                       qb.case_id, qb.case_order,
                       cs.code as case_code, cs.title as case_title, cs.description_text as case_description,
                       cs.image_url as case_image_url,
                       ROW_NUMBER() OVER(PARTITION BY qb.topic ORDER BY RANDOM()) as rn
                FROM question_bank qb
                LEFT JOIN case_scenarios cs ON qb.case_id = cs.id
                ${whereClauses}
            )
            SELECT id, question_text, options, correct_option_index, explanation, explanation_image_url, 
                   image_url, domain, topic, case_id, case_order,
                   case_code, case_title, case_description, case_image_url
            FROM BalancedPool 
            WHERE rn <= CASE 
                WHEN $1::text[] IS NULL OR $1::text[] = ARRAY['*']::text[] THEN $${paramIdx} 
                ELSE GREATEST(3, CEIL(($${paramIdx}::float / GREATEST(1, array_length($1::text[], 1))) * 1.5)) 
            END
            ORDER BY RANDOM() 
            LIMIT $${paramIdx}
        `;
        params.push(limit);

        const res = await db.query(query, params);
        let questions = res.rows;

        // If any question in batch belongs to a case, retrieve and cluster all its sibling questions consecutively
        const caseIdsInBatch = [...new Set(questions.filter(q => q.case_id).map(q => q.case_id))];
        if (caseIdsInBatch.length > 0) {
            try {
                let siblingQuery = `
                    SELECT qb.id, qb.question_text, qb.options, qb.correct_option_index, qb.explanation, 
                           qb.explanation_image_url, qb.image_url, qb.domain, qb.topic,
                           qb.case_id, qb.case_order,
                           cs.code as case_code, cs.title as case_title, cs.description_text as case_description,
                           cs.image_url as case_image_url
                    FROM question_bank qb
                    JOIN case_scenarios cs ON qb.case_id = cs.id
                    WHERE qb.case_id = ANY($1::uuid[])
                `;
                const siblingParams = [caseIdsInBatch];
                if (filterTopics) {
                    siblingParams.push(topics);
                    siblingQuery += ` AND unaccent(UPPER(qb.topic)) = ANY(SELECT unaccent(UPPER(unnest($2::text[]))))`;
                }
                siblingQuery += ` ORDER BY qb.case_id, qb.case_order ASC, qb.created_at ASC`;

                const siblingRes = await db.query(siblingQuery, siblingParams);

                const siblingMap = new Map();
                siblingRes.rows.forEach(sq => {
                    if (!siblingMap.has(sq.case_id)) siblingMap.set(sq.case_id, []);
                    siblingMap.get(sq.case_id).push(sq);
                });

                const processedCaseIds = new Set();
                const reassembled = [];

                for (const q of questions) {
                    if (!q.case_id) {
                        reassembled.push(q);
                    } else if (!processedCaseIds.has(q.case_id)) {
                        processedCaseIds.add(q.case_id);
                        const siblings = siblingMap.get(q.case_id) || [q];
                        reassembled.push(...siblings);
                    }
                }
                questions = reassembled;
            } catch (caseErr) {
                console.error("⚠️ Error clusterizando preguntas de caso en MedicoRepo:", caseErr.message);
            }
        }

        return questions.map(row => ({
            id: row.id,
            question_text: row.question_text,
            options: row.options,
            correct_option_index: row.correct_option_index,
            explanation: row.explanation,
            explanation_image_url: row.explanation_image_url,
            image_url: row.image_url,
            topic: row.topic,
            case_id: row.case_id || null,
            case_order: row.case_id ? (parseInt(row.case_order, 10) || 1) : null,
            case_code: row.case_code || null,
            case_title: row.case_title || null,
            case_description: row.case_description || null,
            case_image_url: row.case_image_url || null
        }));
    }

    packDemoBatch(candidateRows, siblingRows, limit) {
        if (!candidateRows || candidateRows.length === 0) return [];

        const siblingMap = new Map();
        (siblingRows || []).forEach(sq => {
            if (!siblingMap.has(sq.case_id)) siblingMap.set(sq.case_id, []);
            siblingMap.get(sq.case_id).push(sq);
        });

        siblingMap.forEach(siblings => {
            siblings.sort((a, b) => (a.case_order || 1) - (b.case_order || 1));
        });

        const processedCaseIds = new Set();
        const reassembled = [];

        // 1. Empacar respetando la integridad del caso y el límite estricto
        for (const q of candidateRows) {
            if (reassembled.length >= limit) break;

            if (!q.case_id) {
                if (limit - reassembled.length >= 1) {
                    reassembled.push(q);
                }
            } else if (!processedCaseIds.has(q.case_id)) {
                processedCaseIds.add(q.case_id);
                const siblings = siblingMap.get(q.case_id) || [q];
                const spaceLeft = limit - reassembled.length;
                if (siblings.length <= spaceLeft) {
                    reassembled.push(...siblings);
                }
            }
        }

        // 2. Si quedan cupos libres (porque hubo casos que excedían el espacio restante), rellenar con preguntas sueltas
        if (reassembled.length < limit) {
            const addedIds = new Set(reassembled.map(r => r.id));
            for (const q of candidateRows) {
                if (reassembled.length >= limit) break;
                if (!q.case_id && !addedIds.has(q.id)) {
                    addedIds.add(q.id);
                    reassembled.push(q);
                }
            }
        }

        // 3. Salvaguarda final: si aún no se alcanza el límite y quedan candidatas no añadidas
        if (reassembled.length < limit) {
            const addedIds = new Set(reassembled.map(r => r.id));
            for (const q of candidateRows) {
                if (reassembled.length >= limit) break;
                if (!addedIds.has(q.id)) {
                    addedIds.add(q.id);
                    reassembled.push(q);
                }
            }
        }

        return reassembled.slice(0, limit);
    }

    async getRandomDemoQuestions(limit = 10, excludeIds = [], target = null, career = null, difficulty = null, areas = null) {
        let sanitizedExcludeIds = [];
        if (excludeIds && Array.isArray(excludeIds)) {
            sanitizedExcludeIds = excludeIds.filter(id => id && typeof id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id));
        }

        let query = `
            SELECT qb.id, qb.question_text, qb.options, qb.correct_option_index, qb.explanation, 
                   qb.explanation_image_url, qb.image_url, qb.domain, qb.topic, qb.target,
                   qb.case_id, qb.case_order,
                   cs.code as case_code, cs.title as case_title, cs.description_text as case_description,
                   cs.image_url as case_image_url
            FROM question_bank qb
            LEFT JOIN case_scenarios cs ON qb.case_id = cs.id
            WHERE qb.domain = 'medicine'
        `;
        const params = [];
        let paramIdx = 1;

        if (target) {
            query += ` AND qb.target = $${paramIdx} `;
            params.push(target);
            paramIdx++;
        }

        if (career) {
            query += ` AND (qb.career IS NULL OR qb.career = $${paramIdx}) `;
            params.push(career);
            paramIdx++;
        }

        const isMixtoDifficulty = !difficulty || ['MIXTO', 'TODOS', 'ALL', 'MIXED', 'DEFAULT', 'GENERAL'].includes(String(difficulty).toUpperCase().trim());
        if (!isMixtoDifficulty) {
            query += ` AND qb.difficulty = $${paramIdx} `;
            params.push(difficulty);
            paramIdx++;
        }

        if (areas) {
            const areasArray = Array.isArray(areas) ? areas : String(areas).split(',').map(a => a.trim()).filter(Boolean);
            if (areasArray.length > 0) {
                query += ` AND unaccent(UPPER(qb.topic)) = ANY(SELECT unaccent(UPPER(unnest($${paramIdx}::text[])))) `;
                params.push(areasArray);
                paramIdx++;
            }
        }

        if (sanitizedExcludeIds.length > 0) {
            query += ` AND qb.id <> ALL($${paramIdx}::uuid[]) `;
            params.push(sanitizedExcludeIds);
            paramIdx++;
        }

        const candidatePoolLimit = Math.max(limit * 3, 30);
        query += ` ORDER BY RANDOM() LIMIT $${paramIdx}`;
        params.push(candidatePoolLimit);

        const res = await db.query(query, params);
        const candidateRows = res.rows;

        let siblingRows = [];
        const caseIdsInBatch = [...new Set(candidateRows.filter(q => q.case_id).map(q => q.case_id))];
        if (caseIdsInBatch.length > 0) {
            try {
                const siblingRes = await db.query(`
                    SELECT qb.id, qb.question_text, qb.options, qb.correct_option_index, qb.explanation, 
                           qb.explanation_image_url, qb.image_url, qb.domain, qb.topic, qb.target,
                           qb.case_id, qb.case_order,
                           cs.code as case_code, cs.title as case_title, cs.description_text as case_description,
                           cs.image_url as case_image_url
                    FROM question_bank qb
                    JOIN case_scenarios cs ON qb.case_id = cs.id
                    WHERE qb.case_id = ANY($1::uuid[])
                    ORDER BY qb.case_id, qb.case_order ASC, qb.created_at ASC
                `, [caseIdsInBatch]);
                siblingRows = siblingRes.rows;
            } catch (e) {
                console.error("⚠️ Error consultando demo case siblings en MedicoRepo:", e.message);
            }
        }

        const questions = this.packDemoBatch(candidateRows, siblingRows, limit);

        return questions.map(row => ({
            id: row.id,
            question_text: row.question_text,
            options: row.options,
            correct_option_index: row.correct_option_index,
            explanation: row.explanation,
            explanation_image_url: row.explanation_image_url,
            image_url: row.image_url,
            topic: row.topic,
            target: row.target,
            case_id: row.case_id || null,
            case_order: row.case_id ? (parseInt(row.case_order, 10) || 1) : null,
            case_code: row.case_code || null,
            case_title: row.case_title || null,
            case_description: row.case_description || null,
            case_image_url: row.case_image_url || null
        }));
    }

    async saveQuestionBankBatch(questions, defaultTopic, target, defaultCareer = null) {
        if (!questions || questions.length === 0) return [];

        const query = `
            INSERT INTO question_bank (topic, domain, target, difficulty, question_text, options, correct_option_index, explanation, explanation_image_url, image_url, question_hash, times_used, career)
            VALUES ($1, 'medicine', $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
            ON CONFLICT (question_hash) DO UPDATE SET 
                times_used = question_bank.times_used + 1,
                career = EXCLUDED.career,
                explanation_image_url = EXCLUDED.explanation_image_url,
                image_url = EXCLUDED.image_url
            RETURNING id;
        `;

        const newIds = [];

        for (const q of questions) {
            const exactTopic = q.topic || defaultTopic;
            const exactCareer = q.career || defaultCareer;
            const difficultyVal = q.difficulty || 'Senior';

            const normTopic = String(exactTopic || 'General').toLowerCase().trim();
            const normText = String(q.question_text || '').toLowerCase().trim();
            const rawString = `${normTopic}-${normText}-${JSON.stringify(q.options)}`;
            const hash = crypto.createHash('md5').update(rawString).digest('hex');

            try {
                const res = await db.query(query, [
                    exactTopic,
                    target,
                    difficultyVal,
                    q.question_text,
                    JSON.stringify(q.options),
                    q.correct_option_index,
                    q.explanation,
                    q.explanation_image_url || null,
                    q.image_url || null,
                    hash,
                    exactCareer
                ]);
                if (res.rows.length > 0) {
                    newIds.push(res.rows[0].id);
                } else {
                    newIds.push(null);
                }
            } catch (e) {
                console.error("Error guardando pregunta de medicina:", e.message);
                newIds.push(null);
            }
        }
        return newIds;
    }

    async saveQuizHistory(userId, quizData) {
        const totalQ = quizData.totalQuestions || quizData.total_questions || (quizData.questions ? quizData.questions.length : 10);
        const scoreInt = Math.round(Number(quizData.score) || 0);
        const finalTopic = quizData.topic || 'Multi-Área';
        const weakPoints = scoreInt < totalQ ? [finalTopic] : [];
        const finalDifficulty = (quizData.difficulty && quizData.difficulty !== 'MIXTO') ? quizData.difficulty : 'Senior';
        const values = [
            userId,
            finalTopic,
            finalDifficulty,
            scoreInt,
            totalQ,
            weakPoints,
            quizData.areaStats || '{}',
            quizData.target || 'SERUMS',
            quizData.career || null
        ];
        let query = `
            INSERT INTO quiz_history (user_id, topic, difficulty, score, total_questions, weak_points, area_stats, target, career)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, TRUE AS inserted;
        `;
        if (quizData.sourceSessionId) {
            values.push(quizData.sourceSessionId);
            query = `
                WITH inserted_row AS (
                    INSERT INTO quiz_history (
                        user_id, topic, difficulty, score, total_questions, weak_points,
                        area_stats, target, career, source_session_id
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (source_session_id) WHERE source_session_id IS NOT NULL DO NOTHING
                    RETURNING id
                )
                SELECT id, TRUE AS inserted FROM inserted_row
                UNION ALL
                SELECT id, FALSE AS inserted FROM quiz_history WHERE source_session_id = $10
                LIMIT 1;
            `;
        }
        const res = await db.query(query, values);
        const quizHistoryId = res.rows[0].id;
        const wasCreated = res.rows[0].inserted === true;

        const isRealMock = quizData.mode === 'real' || totalQ >= 50;

        if (wasCreated && quizData.questions && Array.isArray(quizData.questions)) {
            if (isRealMock) {
                console.log(`ℹ️ [MedicoRepo] Simulacro Real (${totalQ}qs): No se marca bloqueo anti-repetición 24h para permitir práctica libre e ilimitada.`);
            } else {
                for (const q of quizData.questions) {
                    if (q.id) {
                        try {
                            const checkQuery = `SELECT id, times_seen FROM user_question_history WHERE user_id = $1 AND question_id = $2`;
                            const checkRes = await db.query(checkQuery, [userId, q.id]);
                            if (checkRes.rows.length > 0) {
                                const row = checkRes.rows[0];
                                await db.query(
                                    `UPDATE user_question_history SET seen_at = NOW(), times_seen = $1 WHERE id = $2`,
                                    [row.times_seen + 1, row.id]
                                );
                            } else {
                                await db.query(
                                    `INSERT INTO user_question_history (user_id, question_id, seen_at, times_seen) VALUES ($1, $2, NOW(), 1)`,
                                    [userId, q.id]
                                );
                            }
                        } catch (err) {
                            console.error("❌ Error actualizando user_question_history en MedicoRepo:", err.message);
                        }
                    }
                }
            }
        }

        return { attemptId: quizHistoryId, wasCreated };
    }

    async getQuizEvolution(userId, target, limit, timeFilter = '', areas = null, career = null) {
        let filter = '';
        const params = [userId];

        if (target) {
            params.push(target);
            filter += ` AND (target = $${params.length} OR (target IS NULL AND difficulty = $${params.length}))`;
        } else {
            filter += ` AND difficulty IN ('ENAM', 'SERUMS', 'ENARM', 'Básico', 'Intermedio', 'Avanzado')`;
        }

        if (career) {
            params.push(career);
            if (career === 'Medicina Humana') {
                filter += ` AND (career = $${params.length} OR career IS NULL)`;
            } else {
                filter += ` AND career = $${params.length}`;
            }
        }

        if (limit) {
            if (limit === 'real' || limit === '100') {
                filter += ` AND total_questions >= 50`;
            } else if (parseInt(limit, 10) === 10 || limit === 'arcade') {
                filter += ` AND total_questions <= 15`;
            } else if (parseInt(limit, 10) === 20 || limit === 'study') {
                filter += ` AND total_questions > 15 AND total_questions < 50`;
            } else {
                params.push(parseInt(limit, 10));
                filter += ` AND total_questions = $${params.length}`;
            }
        }

        if (areas && Array.isArray(areas) && areas.length > 0) {
            params.push(areas);
            filter += ` AND jsonb_typeof(area_stats) = 'object' AND EXISTS (
                SELECT 1 FROM jsonb_each(area_stats) 
                WHERE unaccent(UPPER(key)) = ANY(SELECT unaccent(UPPER(unnest($${params.length}::text[]))))
            )`;
        }

        const query = `
            SELECT 
                to_char(created_at, 'DD/MM') as date_label,
                score,
                total_questions,
                (score::float / NULLIF(total_questions, 0)) * 20 as score_20
            FROM quiz_history
            WHERE user_id = $1 ${filter} ${timeFilter}
            ORDER BY created_at DESC
            LIMIT 10
        `;

        const res = await db.query(query, params);
        return res.rows.reverse();
    }

    async incrementSimulatorUsage(userId) {
        const query = `UPDATE users SET daily_simulator_usage = daily_simulator_usage + 1 WHERE id = $1`;
        await db.query(query, [userId]);
    }

    async getBasicQuizStats(userId, topicFilter, params, timeFilter = '', areas = null) {
        const queryParams = [...params];
        let areaFilter = '';
        if (areas && Array.isArray(areas) && areas.length > 0) {
            queryParams.push(areas);
            areaFilter = ` AND jsonb_typeof(area_stats) = 'object' AND EXISTS (
                SELECT 1 FROM jsonb_each(area_stats) 
                WHERE unaccent(UPPER(key)) = ANY(SELECT unaccent(UPPER(unnest($${queryParams.length}::text[]))))
            )`;
        }

        const query = `
            SELECT 
                COALESCE(SUM(total_questions), 0) as total_questions,
                COALESCE(SUM(score), 0) as total_correct,
                COUNT(*) as total_games
            FROM quiz_history
            WHERE user_id = $1 ${topicFilter} ${timeFilter} ${areaFilter}
        `;
        const res = await db.query(query, queryParams);
        return res.rows[0];
    }

    async getTopicAnalysis(userId, topicFilter, params, timeFilter = '', areas = null) {
        const queryParams = [...params];
        let areaFilter = '';
        if (areas && Array.isArray(areas) && areas.length > 0) {
            queryParams.push(areas);
            areaFilter = ` AND unaccent(UPPER(key)) = ANY(SELECT unaccent(UPPER(unnest($${queryParams.length}::text[]))))`;
        }

        const query = `
            SELECT 
                key as subtema,
                SUM((value->>'correct')::int) as correct_answers,
                SUM((value->>'total')::int) as total_answers
            FROM quiz_history, jsonb_each(area_stats)
            WHERE user_id = $1 ${topicFilter} ${timeFilter} ${areaFilter} AND jsonb_typeof(area_stats) = 'object'
            GROUP BY key
            HAVING SUM((value->>'total')::int) > 0
            ORDER BY (SUM((value->>'correct')::int)::float / SUM((value->>'total')::int)) DESC
        `;
        const res = await db.query(query, queryParams);
        return res.rows;
    }

    async getTopicAnalysisFallback(userId, topicFilter, params) {
        const query = `
            SELECT topic, AVG(score) as avg_s 
            FROM quiz_history 
            WHERE user_id = $1 ${topicFilter} 
            GROUP BY topic 
            ORDER BY avg_s DESC
        `;
        const res = await db.query(query, params);
        return res.rows;
    }

    async getLeaderboard() {
        const query = `
            WITH RankedScores AS (
                SELECT 
                    u.name,
                    qs.score,
                    qs.topic,
                    qs.difficulty,
                    qs.created_at,
                    ROW_NUMBER() OVER(PARTITION BY qs.user_id ORDER BY qs.score DESC) as rn
                FROM quiz_history qs
                JOIN users u ON qs.user_id = u.id
                WHERE qs.difficulty IN ('ENAM', 'SERUMS', 'ENARM', 'Básico', 'Intermedio', 'Avanzado')
            )
            SELECT * FROM RankedScores WHERE rn = 1
            ORDER BY score DESC
            LIMIT 10;
        `;
        const result = await db.query(query);
        return result.rows;
    }
}

module.exports = new MedicoRepository();
