const db = require('../../infrastructure/database/db');
const crypto = require('crypto');

class TrainingRepository {

    /**
     * Busca preguntas en el Banco Global (Optimización de Costos).
     * @param {string} topic - Tema normalizado (ej: 'CARDIOLOGIA')
     * @param {string} domain - 'GENERAL' o 'MEDICINA'
     * @param {string} difficulty - Dificultad
     * @param {number} limit - Cantidad requerida
     * @param {string} excludeIds - Array de IDs a excluir (ya vistos por el usuario)
     */
    async findQuestionsInBank(topic, domain, limit = 5, userId) {
        // 1. Obtener IDs que el usuario ya vio (solo en las últimas 24 horas)
        // Lógica de "Olvido Saludable": Si hace más de 1 día que la vio, se puede reutilizar para ahorrar tokens.
        const seenQuery = `SELECT question_id FROM user_question_history WHERE user_id = $1 AND seen_at > NOW() - INTERVAL '24 hours'`;
        const seenRes = await db.query(seenQuery, [userId]);
        const seenIds = seenRes.rows.map(r => r.question_id);

        console.log(`🔎 [Repo] Usuario ${userId} ha visto ${seenIds.length} preguntas en las últimas 24h.`);

        // 2. Query Dinámico con Exclusión
        let query = `
            SELECT id, question_text, options, correct_option_index, explanation, explanation_image_url, domain, topic
            FROM question_bank
            WHERE topic = $1 
            AND domain = $2
        `;

        const params = [topic, domain];
        let paramIdx = 3;

        if (seenIds.length > 0) {
            // NOTA: Usamos != ALL para excluir arrays en Postgres
            query += ` AND id <> ALL($${paramIdx}::uuid[]) `;
            params.push(seenIds);
            paramIdx++;
        }

        query += ` ORDER BY RANDOM() LIMIT $${paramIdx}`;
        params.push(limit);

        const res = await db.query(query, params);

        console.log(`🔎 [Repo] Encontradas ${res.rows.length} preguntas disponibles en Banco (excluyendo vistas).`);

        // Mapear al formato frontend
        return res.rows.map(row => ({
            id: row.id, // Guardamos ID para registrar historial
            question_text: row.question_text,
            options: row.options,
            correct_option_index: row.correct_option_index,
            explanation: row.explanation,
            explanation_image_url: row.explanation_image_url, // ✅ NUEVO
            topic: row.topic // ✅ NUEVO: Preservar tema para estadísticas y flashcards
        }));
    }

    /**
     * Busca preguntas en el Banco Global basadas en MULTIPLES TEMAS (Areas).
     * @param {string} domain - Target (ej: 'SERUMS', 'ENAM', 'ENARM', o 'MEDICINA' default)
     * @param {string[]} topics - Array de temas (ej: ['Cardiología', 'Pediatría'])
     * @param {string} difficulty - Dificultad (ej: 'Básico', 'Avanzado')
     * @param {number} limit - Cantidad requerida
     * @param {string} userId - ID del usuario para excluir vistas recientes
     * @param {string} career - Carrera seleccionada para filtrado específico (Opcional, mayormente SERUMS)
     */
    async findQuestionsInBankBatch(domain, target, topics, limit = 5, userId, career = null) {
        // 1. Obtener IDs que el usuario ya vio (últimas 24 horas)
        const seenQuery = `SELECT question_id FROM user_question_history WHERE user_id = $1 AND seen_at > NOW() - INTERVAL '24 hours'`;
        const seenRes = await db.query(seenQuery, [userId]);
        const seenIds = seenRes.rows.map(r => r.question_id);

        console.log(`🔎 [Repo] Usuario ${userId} ha visto ${seenIds.length} preguntas cruzadas en las últimas 24h.`);

        // 2. Construcción Dinámica de Cláusulas WHERE
        let whereClauses = `WHERE UPPER(topic) = ANY($1::text[]) 
                            AND domain = $2 
                            AND ($3::text IS NULL OR target = $3)`;
        
        const params = [topics, domain, target];
        let paramIdx = 4;

        // Filtro de Carrera (SERUMS)
        if (target === 'SERUMS' && career) {
            whereClauses += ` AND (career IS NULL OR career = $${paramIdx}) `;
            params.push(career);
            paramIdx++;
        }

        // Exclusión de Vistas Recientes
        if (seenIds.length > 0) {
            whereClauses += ` AND id <> ALL($${paramIdx}::uuid[]) `;
            params.push(seenIds);
            paramIdx++;
        }

        // 3. Query Final con Balanceo de Áreas (rn <= 3 asegura diversidad)
        const query = `
            WITH BalancedPool AS (
                SELECT id, question_text, options, correct_option_index, explanation, explanation_image_url, domain, topic,
                       ROW_NUMBER() OVER(PARTITION BY topic ORDER BY RANDOM()) as rn
                FROM question_bank
                ${whereClauses}
            )
            SELECT id, question_text, options, correct_option_index, explanation, explanation_image_url, domain, topic
            FROM BalancedPool 
            WHERE rn <= 3
            ORDER BY RANDOM() 
            LIMIT $${paramIdx}
        `;
        params.push(limit);

        const res = await db.query(query, params);

        console.log(`🔎 [Repo-Simulador] Encontradas ${res.rows.length} preguntas balanceadas disponibles.`);

        if (res.rows.length > 0) {
            try {
                const fetchedIds = res.rows.map(r => r.id);
                const updateQuery = `UPDATE question_bank SET times_used = times_used + 1 WHERE id = ANY($1::uuid[])`;
                await db.query(updateQuery, [fetchedIds]);
            } catch (err) {
                console.error("❌ Error actualizando times_used:", err.message);
            }
        }

        return res.rows.map(row => ({
            id: row.id,
            question_text: row.question_text,
            options: row.options,
            correct_option_index: row.correct_option_index,
            explanation: row.explanation,
            explanation_image_url: row.explanation_image_url, // ✅ NUEVO
            topic: row.topic 
        }));
    }

    /**
     * @senior_refactor ⚔️ MÉTODO EXCLUSIVO PARA QUIZ ARENA 
     * Optimizado para agotar el banco local antes de usar IA.
     * Elimina el sub-muestreo restrictivo (rn <= 3) del Simulador.
     */
    async findArenaQuestions(domain, target, topic, limit = 5, userId) {
        // 1. IDs vistos (24h)
        const seenQuery = `SELECT question_id FROM user_question_history WHERE user_id = $1 AND seen_at > NOW() - INTERVAL '24 hours'`;
        const seenRes = await db.query(seenQuery, [userId]);
        const seenIds = seenRes.rows.map(r => r.question_id);

        console.log(`🔎 [Repo-Arena] User ${userId} ha visto ${seenIds.length} preguntas recientemente.`);

        // 2. Query Directo (Prioridad Absoluta al Stock Local)
        // 🚨 NORMALIZACIÓN: Usamos TRIM/UPPER y permitimos target NULL para trivia
        let query = `
            SELECT id, question_text, options, correct_option_index, explanation, explanation_image_url, domain, topic
            FROM question_bank
            WHERE TRIM(UPPER(topic)) = TRIM(UPPER($1)) 
              AND domain = $2 
              AND (target IS NULL OR target = $3)
        `;

        const params = [topic, domain, target];
        let paramIdx = 4;

        // Exclusión
        if (seenIds.length > 0) {
            query += ` AND id <> ALL($${paramIdx}::uuid[]) `;
            params.push(seenIds);
            paramIdx++;
        }

        query += ` ORDER BY RANDOM() LIMIT $${paramIdx}`;
        params.push(limit);

        const res = await db.query(query, params);

        console.log(`⚔️ [Repo-Arena] Banco entregó ${res.rows.length}/${limit} preguntas para el tema '${topic}'.`);

        // Actualizar estadísticas de uso
        if (res.rows.length > 0) {
            try {
                const fetchedIds = res.rows.map(r => r.id);
                await db.query(`UPDATE question_bank SET times_used = times_used + 1 WHERE id = ANY($1::uuid[])`, [fetchedIds]);
            } catch (err) { console.error("❌ Repo-Arena usage counter err:", err.message); }
        }

        return res.rows.map(row => ({
            id: row.id,
            question_text: row.question_text,
            options: row.options,
            correct_option_index: row.correct_option_index,
            explanation: row.explanation,
            explanation_image_url: row.explanation_image_url, // ✅ NUEVO
            topic: row.topic
        }));
    }

    /**
     * Obtiene N preguntas aleatorias de la BD para inyectarlas como Contexto de Deduplicación a la IA.
     * @param {string} domain 
     * @param {string[]} topics 
     * @param {number} limit Cuántas preguntas de contexto traer (ej: 15)
     * @returns {Promise<string[]>} Array de strings con el texto de la pregunta original.
     */
    async getRandomQuestionsContext(domain, target, topics, limit = 15, career = null) {
        try {
            let query = `
                SELECT question_text 
                FROM question_bank 
                WHERE domain = $1 
                AND ($2::text IS NULL OR target = $2)
                AND UPPER(topic) = ANY($3::text[])
            `;
            const params = [domain, target, topics];
            let paramIdx = 4;

            if (career) {
                query += ` AND (career IS NULL OR career = $${paramIdx}) `;
                params.push(career);
                paramIdx++;
            }

            query += ` ORDER BY RANDOM() LIMIT $${paramIdx} `;
            params.push(limit);

            const res = await db.query(query, params);

            if (res.rows.length > 0) {
                console.log(`🧠 [Deduplication] Extraídas ${res.rows.length} preguntas aleatorias para contexto (Filtro: ${target} - ${career}).`);
                return res.rows.map(r => r.question_text);
            }
            return [];
        } catch (error) {
            console.error("Error obteniendo contexto de deduplicación:", error);
            return [];
        }
    }

    /**
     * Guarda un lote de nuevas preguntas en el question_bank.
     * @returns {Promise<string[]>} Array de IDs insertados
     */
    async saveQuestionBankBatch(questions, defaultTopic, domain, target, defaultCareer = null) {
        if (!questions || questions.length === 0) return [];

        console.log(`💾 Guardando ${questions.length} preguntas en el Banco (Fallback T: ${defaultTopic} | C: ${defaultCareer} - ${domain} - ${target})...`);

        const query = `
            INSERT INTO question_bank (topic, domain, target, difficulty, question_text, options, correct_option_index, explanation, explanation_image_url, question_hash, times_used, career)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
            ON CONFLICT (question_hash) DO UPDATE SET 
                times_used = question_bank.times_used + 1,
                career = EXCLUDED.career,
                explanation_image_url = EXCLUDED.explanation_image_url
            RETURNING id;
        `;

        const newIds = [];

        for (const q of questions) {
            const exactTopic = q.topic || defaultTopic;
            const exactCareer = q.career || defaultCareer;
            const difficulty = 'Senior'; // Hardcoded standard

            const rawString = `${exactTopic}-${q.question_text}-${JSON.stringify(q.options)}`;
            const hash = crypto.createHash('md5').update(rawString).digest('hex');

            try {
                const res = await db.query(query, [
                    exactTopic,
                    domain,
                    target,
                    difficulty,
                    q.question_text,
                    JSON.stringify(q.options),
                    q.correct_option_index,
                    q.explanation,
                    q.explanation_image_url || null,
                    hash,
                    exactCareer
                ]);
                if (res.rows.length > 0) {
                    newIds.push(res.rows[0].id);
                }
            } catch (e) {
                console.error("Error guardando pregunta individual:", e.message);
            }
        }
        return newIds;
    }

    /**
     * Guarda un lote masivo de preguntas (Data Importer) con transacción.
     * Soporta URLs de imágenes directas. Auto-cura la BD si faltan columnas.
     */
    async saveBulkQuestionBankAdmin(questionsArray) {
        if (!questionsArray || questionsArray.length === 0) return { success: false, inserted: 0 };

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            let insertedCount = 0;
            const crypto = require('crypto');

            /**
             * Sanitizador Canónico de Dificultad:
             * La IA puede devolver valores verbose como "Básico - Memoria pura" o "Intermedio (Análisis Clínico)".
             * Normalizamos al valor canónico estricto para evitar violaciones de VARCHAR en PostgreSQL.
             */
            const canonicalDifficulty = (val) => {
                return 'Senior'; // Unificado
            };

            /**
             * Sanitizador de Dominio:
             * El dominio debe ser siempre un valor canónico de la lista permitida.
             * La IA no debería alterar este valor (ya lo recibe fijado en el prompt),
             * pero añadimos esta guarda de seguridad para garantizarlo.
             */
            const canonicalDomain = (val) => {
                const allowed = ['medicine', 'english', 'general_trivia'];
                const v = String(val || '').toLowerCase().trim().replace(/\s+/g, '_');
                return allowed.includes(v) ? v : 'medicine'; // Fallback seguro a medicine
            };

            const query = `
                INSERT INTO question_bank (domain, target, topic, subtopic, difficulty, question_text, options, correct_option_index, explanation, explanation_image_url, image_url, question_hash, career)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (question_hash) DO UPDATE SET 
                    target = EXCLUDED.target,
                    image_url = EXCLUDED.image_url,
                    explanation = EXCLUDED.explanation,
                    explanation_image_url = EXCLUDED.explanation_image_url,
                    options = EXCLUDED.options,
                    career = EXCLUDED.career,
                    subtopic = EXCLUDED.subtopic
                RETURNING id;
            `;

            for (const q of questionsArray) {
                /**
                 * Mapeo definitivo Domain / Topic / Subtopic:
                 * - domain:   Dominio global del banco (medicine | english | general_trivia).
                 *             Se sanitiza para garantizar que siempre sea un valor canónico,
                 *             incluso si la IA devuelve algo inesperado.
                 * - topic:    Área de Estudio específica (Pediatría, Salud Pública, etc.).
                 *             La IA la genera según las áreas seleccionadas en el modal Admin.
                 * - subtopic: Subtema clínico preciso (Triaje Comunitario, Vacunación, etc.).
                 *             La IA lo genera independientemente como campo separado.
                 */
                const domain = canonicalDomain(q.domain);          // Siempre canónico
                const target = q.target || 'N/A';
                const exactTopic = q.topic || 'General';            // Área de estudio
                const exactSubtopic = q.subtopic || null;           // Subtema clínico (nullable)
                const difficulty = canonicalDifficulty(q.difficulty);
                const question_text = String(q.question_text || q.question);
                const optionsStr = JSON.stringify(q.options || []);
                const correct_option_index = q.correct_option_index !== undefined ? q.correct_option_index : (q.correctAnswerIndex || 0);
                const explanation = q.explanation || '';
                const explanation_image_url = q.explanation_image_url || q.EXPLICACION_IMAGEN || null;
                const image_url = q.image_url || null;
                const career = q.career || null;

                // Hash único basado en topic + texto + opciones
                const rawString = `${exactTopic}-${question_text}-${optionsStr}`;
                const hash = crypto.createHash('md5').update(rawString).digest('hex');

                await client.query(query, [
                    domain, target, exactTopic, exactSubtopic, difficulty, question_text, optionsStr,
                    correct_option_index, explanation, explanation_image_url, image_url, hash, career
                ]);
                insertedCount++;
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

    /**
     * Registra que un usuario vio ciertas preguntas (Batch Optimizado).
     */
    async markQuestionsAsSeen(userId, questionIds) {
        if (!userId || !questionIds || questionIds.length === 0) return;

        // Dedup ids in memory just in case
        const uniqueIds = [...new Set(questionIds)];

        // Construir valores para insert multiple: ($1, $2), ($1, $3)...
        const values = [];
        const placeholders = [];
        let idx = 1;

        uniqueIds.forEach(qId => {
            values.push(userId, qId);
            placeholders.push(`($${idx}, $${idx + 1})`);
            idx += 2;
        });

        const query = `
            INSERT INTO user_question_history (user_id, question_id)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (user_id, question_id) 
            DO UPDATE SET 
                seen_at = CURRENT_TIMESTAMP,
                times_seen = user_question_history.times_seen + 1;
        `;

        try {
            await db.query(query, values);
            console.log(`👁️ [Repo] Marcadas ${uniqueIds.length} preguntas como vistas por user ${userId}`);
        } catch (e) {
            console.error("❌ Error marcando preguntas como vistas:", e.message);
        }
    }

    /**
     * Guarda el historial de un examen.
     */
    async saveQuizHistory(userId, quizData) {
        const query = `
            INSERT INTO quiz_history (user_id, topic, difficulty, score, total_questions, weak_points, area_stats, target, career)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id;
        `;

        const weakPoints = quizData.score < quizData.totalQuestions ? [quizData.topic] : [];

        const values = [
            userId,
            quizData.topic,
            'Senior',
            quizData.score,
            quizData.totalQuestions,
            weakPoints,
            quizData.areaStats || '{}', 
            quizData.target || 'ENAM',  
            quizData.career || null     
        ];

        const res = await db.query(query, values);
        return res.rows[0].id;
    }

    /**
     * Crea un lote de flashcards nuevas (Inicializadas para repaso inmediato o corto).
     */
    // --- DECKS MANAGEMENT ---

    async getDecks(userId, parentId = null) {
        // Auto-heal DB
        await db.query('ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS last_quality INT DEFAULT 0').catch(() => null);

        if (userId === 'GUEST') {
            // Guest mode: return unique system decks by name
            const query = `
                SELECT DISTINCT ON (d.name)
                    d.id, d.name, d.type, d.icon, d.source_module, d.parent_id,
                    0 as total_cards, 0 as due_cards, 
                    (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                    0 as mastery_percentage
                FROM decks d
                WHERE d.type = 'SYSTEM' AND (d.parent_id = $1 OR ($1 IS NULL AND d.parent_id IS NULL))
                ORDER BY d.name, d.created_at DESC
            `;
            const result = await db.query(query, [parentId]);
            return result.rows;
        }

        // Standard user query
        let query = `
            SELECT 
                d.id, d.name, d.type, d.icon, d.source_module, d.parent_id,
                COUNT(uf.id) as total_cards,
                COUNT(uf.id) FILTER (WHERE uf.next_review_at <= NOW()) as due_cards,
                (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                ROUND((COUNT(uf.id) FILTER (WHERE uf.interval_days > 21)::float / NULLIF(COUNT(uf.id), 0)) * 100) as mastery_percentage
            FROM decks d
            LEFT JOIN user_flashcards uf ON d.id = uf.deck_id
            WHERE d.user_id = $1
        `;

        const params = [userId];
        if (parentId) {
            query += ` AND d.parent_id = $2`;
            params.push(parentId);
        } else {
            query += ` AND d.parent_id IS NULL`;
        }

        query += ` GROUP BY d.id ORDER BY d.created_at DESC`;
        const result = await db.query(query, params);
        return result.rows;
    }

    async getDeckById(userId, deckId) {
        await db.query('ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS last_quality INT DEFAULT 0').catch(() => null);

        const query = `
            SELECT 
                d.id, d.name, d.type, d.icon, d.source_module, d.parent_id,
                COUNT(uf.id) as total_cards,
                COUNT(uf.id) FILTER (WHERE uf.next_review_at <= NOW()) as due_cards,
                (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                ROUND((COUNT(uf.id) FILTER (WHERE uf.interval_days > 21)::float / NULLIF(COUNT(uf.id), 0)) * 100) as mastery_percentage
            FROM decks d
            LEFT JOIN user_flashcards uf ON d.id = uf.deck_id
            WHERE ${userId === 'GUEST' ? "d.type = 'SYSTEM'" : "d.user_id = $1"} AND d.id = ${userId === 'GUEST' ? '$1' : '$2'}
            GROUP BY d.id
        `;
        const params = userId === 'GUEST' ? [deckId] : [userId, deckId];
        const result = await db.query(query, params);
        return result.rows[0];
    }

    async createDeck(userId, name, type = 'USER', sourceModule = 'MANUAL', icon = '📚', parentId = null) {
        const query = `
            INSERT INTO decks (user_id, name, type, source_module, icon, parent_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, icon, parent_id
        `;
        const result = await db.query(query, [userId, name, type, sourceModule, icon, parentId]);
        return result.rows[0];
    }

    async updateDeck(userId, deckId, name, icon) {
        const query = `
            UPDATE decks 
            SET name = $3, icon = $4
            WHERE id = $2 AND user_id = $1
            RETURNING id, name, icon
        `;
        const result = await db.query(query, [userId, deckId, name, icon]);
        return result.rows[0];
    }

    // Helper to find or create a system deck for a module
    async ensureSystemDeck(userId, moduleName) {
        // Try to find existing SYSTEM deck for this module
        // Normalizing names: 'MEDICINA' -> 'Repaso Medicina'
        let deckName = `Repaso ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1).toLowerCase()}`;
        let icon = 'fas fa-brain';

        if (moduleName === 'MEDICINA') icon = 'fas fa-stethoscope';
        if (moduleName === 'IDIOMAS') icon = 'fas fa-comments';

        const findQuery = `
            SELECT id FROM decks 
            WHERE user_id = $1 AND type = 'SYSTEM' AND source_module = $2
            LIMIT 1
        `;
        const findRes = await db.query(findQuery, [userId, moduleName]);

        if (findRes.rows.length > 0) return findRes.rows[0].id;

        // Create if not exists
        return (await this.createDeck(userId, deckName, 'SYSTEM', moduleName, icon)).id;
    }

    // --- FLASHCARDS ---

    async createFlashcardsBatch(userId, questions, topic, attemptId, moduleName = 'MEDICINA') {
        if (!questions || questions.length === 0) return;

        // 1. Determine Deck based on Module Context (Scalable)
        const deckId = await this.ensureSystemDeck(userId, moduleName);

        // 2. Fetch existing flashcards in this deck to prevent duplication
        const existingQuery = `
            SELECT front_content FROM user_flashcards 
            WHERE user_id = $1 AND deck_id = $2
        `;
        const existingRes = await db.query(existingQuery, [userId, deckId]);
        const existingFronts = new Set(existingRes.rows.map(r => r.front_content.trim()));

        // Construir valores para insert masivo
        const values = [];
        const placeholders = [];
        let insertCount = 0;

        questions.forEach((q) => {
            const front = q.question_text.trim();

            // Si la flashcard ya existe en este mazo, la saltamos para evitar duplicados
            if (existingFronts.has(front)) {
                return;
            }

            // Back: La respuesta correcta + explicación
            const correctOption = q.options[q.correct_option_index];
            const back = `${correctOption}\n\n💡 ${q.explanation || ''}`;

            // ($1, $2, $3, $4, $5, $6) ...
            const offset = insertCount * 6;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
            values.push(userId, front, back, q.topic || topic, attemptId, deckId);
            insertCount++;
        });

        if (insertCount === 0) {
            console.log("No new flashcards to insert (all were duplicates).");
            return;
        }

        const query = `
            INSERT INTO user_flashcards (user_id, front_content, back_content, topic, source_quiz_id, deck_id)
            VALUES ${placeholders.join(', ')}
        `;

        await db.query(query, values);
        console.log(`✅ Saved ${insertCount} new UNIQUE flashcards with individual topics.`);
    }

    /**
     * Comprueba qué flashcards (por front_content) ya existen para un usuario en un mazo.
     */
    async checkExistingFlashcards(userId, deckId, fronts = []) {
        if (!fronts || fronts.length === 0) return [];

        const query = `
            SELECT front_content FROM user_flashcards
            WHERE user_id = $1 AND deck_id = $2 AND front_content = ANY($3::text[])
        `;
        const result = await db.query(query, [userId, deckId, fronts]);
        return result.rows.map(r => r.front_content);
    }

    /**
     * Obtener Flashcards pendientes de repaso (Due)
     */
    async getDueFlashcards(userId, deckId = null) {
        // Filter by deckId if provided
        let query = `
            SELECT * FROM user_flashcards
            WHERE user_id = $1 
            AND next_review_at <= NOW()
        `;
        const params = [userId];

        if (deckId) {
            query += ` AND deck_id = $2`;
            params.push(deckId);
        }

        query += ` ORDER BY sort_order ASC, next_review_at ASC LIMIT 50`; // Limit batch size

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Actualizar Flashcard tras repaso (Algoritmo fuera, aquí solo update)
     */
    async updateFlashcard(cardId, interval, ef, reps, nextDate, lastQuality = 0) {
        // Auto-heal DB column
        await db.query('ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS last_quality INT DEFAULT 0').catch(() => null);

        const query = `
            UPDATE user_flashcards
            SET interval_days = $2, easiness_factor = $3, repetition_number = $4, 
                next_review_at = $5, last_reviewed_at = NOW(), last_quality = $6
            WHERE id = $1
        `;
        await db.query(query, [cardId, interval, ef, reps, nextDate, lastQuality]);
    }

    // --- CRUD CARDS (Anki-Style) ---

    async getDeckCards(deckId) {
        const query = `
            SELECT * FROM user_flashcards 
            WHERE deck_id = $1 
            ORDER BY sort_order ASC, created_at ASC
        `;
        const result = await db.query(query, [deckId]);
        return result.rows;
    }

    async createFlashcard(userId, deckId, front, back) {
        // 1. Fetch Deck Name for Topic Strategy
        const deckQuery = `SELECT name FROM decks WHERE id = $1`;
        const deckRes = await db.query(deckQuery, [deckId]);
        const topic = deckRes.rows[0]?.name || 'GENERAL';

        // 2. Insert Card
        const query = `
            INSERT INTO user_flashcards (user_id, deck_id, front_content, back_content, topic, interval_days, easiness_factor, repetition_number, next_review_at)
            VALUES ($1, $2, $3, $4, $5, 0, 2.5, 0, NOW())
            RETURNING id, front_content, back_content, topic
        `;
        const result = await db.query(query, [userId, deckId, front, back, topic]);
        return result.rows[0];
    }

    async updateFlashcardContent(userId, cardId, front, back) {
        const query = `
            UPDATE user_flashcards 
            SET front_content = $3, back_content = $4 
            WHERE id = $2 AND user_id = $1
            RETURNING id, front_content, back_content
        `;
        const result = await db.query(query, [userId, cardId, front, back]);
        return result.rows[0];
    }

    async deleteFlashcard(userId, cardId) {
        // Ensure ownership
        const query = `DELETE FROM user_flashcards WHERE id = $1 AND user_id = $2`;
        await db.query(query, [cardId, userId]);
    }

    async updateFlashcardsOrder(userId, deckId, sortedIds) {
        // Ensure ownership of the deck first
        const checkQuery = `SELECT id FROM decks WHERE id = $1 AND user_id = $2`;
        const checkRes = await db.query(checkQuery, [deckId, userId]);
        if (checkRes.rows.length === 0) throw new Error("Deck not found or access denied");

        const client = await db.pool().connect();
        try {
            await client.query('BEGIN');
            const updateQuery = `
                UPDATE user_flashcards 
                SET sort_order = $1 
                WHERE id = $2 AND deck_id = $3 AND user_id = $4
            `;

            for (let i = 0; i < sortedIds.length; i++) {
                await client.query(updateQuery, [i, sortedIds[i], deckId, userId]);
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async deleteBulkFlashcards(userId, cardIds) {
        if (!cardIds || cardIds.length === 0) return;
        // Postgres IN with parameter array using = ANY($1::uuid[])
        const query = `DELETE FROM user_flashcards WHERE id = ANY($1::uuid[]) AND user_id = $2`;
        await db.query(query, [cardIds, userId]);
    }

    async deleteDeck(userId, deckId) {
        // 1. Fetch all descendants with depth to ensure safe bottom-up deletion
        // This avoids Foreign Key violations if "ON DELETE CASCADE" is missing on parent_id
        const fetchTreeQuery = `
            WITH RECURSIVE deck_tree AS (
                SELECT id, 1 as depth FROM decks WHERE id = $1 AND user_id = $2
                UNION ALL
                SELECT d.id, dt.depth + 1 FROM decks d
                INNER JOIN deck_tree dt ON d.parent_id = dt.id
            )
            SELECT id FROM deck_tree ORDER BY depth DESC;
        `;

        try {
            const { rows } = await db.query(fetchTreeQuery, [deckId, userId]);

            if (rows.length === 0) return; // Deck not found or not owned

            // 2. Delete strictly sequentially from bottom (deepest) to top (root)
            for (const row of rows) {
                await db.query('DELETE FROM decks WHERE id = $1', [row.id]);
            }
        } catch (error) {
            console.error("Error deleting deck tree:", error);
            throw error; // Re-throw to be caught by controller
        }
    }

    // --- ANALYTICS & EVOLUTION ---

    async getQuizEvolution(userId, context, target) {
        // Context filter logic matching Controller
        let filter = '';
        const params = [userId];

        if (context === 'MEDICINA') {
            if (target) {
                params.push(target);
                filter = `AND (target = $2 OR (target IS NULL AND difficulty = $2))`;
            } else {
                filter = `AND difficulty IN ('ENAM', 'SERUMS', 'ENARM', 'Básico', 'Intermedio', 'Avanzado')`;
            }
        } else if (context) {
            filter = `AND topic ILIKE $2`;
            params.push(`%${context}%`);
        }

        // Get last 10 attempts, ordered by date ASC specifically for Chart
        const query = `
            SELECT 
                to_char(created_at, 'DD/MM') as date_label,
                score,
                total_questions,
                (score::float / NULLIF(total_questions, 0)) * 20 as score_20 -- Projected to 0-20 scale
            FROM quiz_history
            WHERE user_id = $1 ${filter}
            ORDER BY created_at ASC
            LIMIT 10
        `;

        const res = await db.query(query, params);
        return res.rows;
    }
}

module.exports = new TrainingRepository();
