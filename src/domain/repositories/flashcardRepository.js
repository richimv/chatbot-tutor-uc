const db = require('../../infrastructure/database/db');

class FlashcardRepository {

    async getDecks(userId, parentId = null) {
        if (userId === 'GUEST') {
            return [];
        }

        const buildQuery = (orderByClause) => `
            SELECT 
                d.id, d.name, d.type, d.icon, d.color, d.source_module, d.parent_id,
                COALESCE(d.category, 'General') as category,
                d.is_public, d.saves_count, d.likes_count, d.cloned_from_id,
                COUNT(uf.id) as total_cards,
                COUNT(uf.id) FILTER (WHERE uf.next_review_at <= NOW()) as due_cards,
                (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                ROUND((COUNT(uf.id) FILTER (WHERE uf.interval_days > 21)::float / NULLIF(COUNT(uf.id), 0)) * 100) as mastery_percentage
            FROM decks d
            LEFT JOIN user_flashcards uf ON d.id = uf.deck_id
            WHERE d.user_id = $1 AND d.type <> 'SYSTEM'
            ${parentId ? 'AND d.parent_id = $2' : 'AND d.parent_id IS NULL'}
            GROUP BY d.id ${orderByClause}
        `;

        const params = parentId ? [userId, parentId] : [userId];
        try {
            const result = await db.query(buildQuery('ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC'), params);
            return result.rows;
        } catch (error) {
            if (error.code === '42703') {
                const fallbackResult = await db.query(buildQuery('ORDER BY d.created_at DESC'), params);
                return fallbackResult.rows;
            }
            throw error;
        }
    }

    async getAllUserDecks(userId) {
        if (userId === 'GUEST') {
            return [];
        }

        const buildQuery = (orderByClause) => `
            SELECT 
                d.id, d.name, d.type, d.icon, d.color, d.source_module, d.parent_id,
                COALESCE(d.category, 'General') as category,
                d.is_public, d.saves_count, d.likes_count, d.cloned_from_id,
                COUNT(uf.id) as total_cards,
                COUNT(uf.id) FILTER (WHERE uf.next_review_at <= NOW()) as due_cards,
                (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                ROUND((COUNT(uf.id) FILTER (WHERE uf.interval_days > 21)::float / NULLIF(COUNT(uf.id), 0)) * 100) as mastery_percentage
            FROM decks d
            LEFT JOIN user_flashcards uf ON d.id = uf.deck_id
            WHERE d.user_id = $1 AND d.type <> 'SYSTEM'
            GROUP BY d.id 
            ${orderByClause}
        `;

        try {
            const result = await db.query(buildQuery('ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC'), [userId]);
            return result.rows;
        } catch (error) {
            if (error.code === '42703') {
                const fallbackResult = await db.query(buildQuery('ORDER BY d.created_at DESC'), [userId]);
                return fallbackResult.rows;
            }
            throw error;
        }
    }

    async getDeckById(userId, deckId) {
        const query = `
            SELECT 
                d.id, d.name, d.type, d.icon, d.color, d.source_module, d.parent_id,
                COALESCE(d.category, 'General') as category,
                d.is_public, d.saves_count, d.likes_count, d.cloned_from_id,
                COUNT(uf.id) as total_cards,
                COUNT(uf.id) FILTER (WHERE uf.next_review_at <= NOW()) as due_cards,
                (SELECT COUNT(*) FROM decks children WHERE children.parent_id = d.id) as children_count,
                ROUND((COUNT(uf.id) FILTER (WHERE uf.interval_days > 21)::float / NULLIF(COUNT(uf.id), 0)) * 100) as mastery_percentage
            FROM decks d
            LEFT JOIN user_flashcards uf ON d.id = uf.deck_id
            WHERE ${userId === 'GUEST' ? "d.is_public = true" : "d.user_id = $1 AND d.type <> 'SYSTEM'"} AND d.id = ${userId === 'GUEST' ? '$1' : '$2'}
            GROUP BY d.id
        `;
        const params = userId === 'GUEST' ? [deckId] : [userId, deckId];
        const result = await db.query(query, params);
        return result.rows[0];
    }

    async getDeckGuide(userId, deckId) {
        const query = `
            SELECT description FROM decks 
            WHERE (user_id = $1 OR is_public = true) AND id = $2
        `;
        const result = await db.query(query, [userId, deckId]);
        return result.rows[0] ? result.rows[0].description : null;
    }

    async createDeck(userId, name, type = 'USER', sourceModule = 'MANUAL', icon = '📚', parentId = null, description = null, color = null, category = 'General') {
        try {
            const query = `
                INSERT INTO decks (user_id, name, type, source_module, icon, parent_id, description, color, category, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id, name, icon, color, parent_id, description, category, created_at, updated_at
            `;
            const result = await db.query(query, [userId, name, type, sourceModule, icon, parentId, description, color, category || 'General']);
            return result.rows[0];
        } catch (error) {
            if (error.code === '42703') {
                const fallbackQuery = `
                    INSERT INTO decks (user_id, name, type, source_module, icon, parent_id, description, color, category)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id, name, icon, color, parent_id, description, category, created_at
                `;
                const fallbackResult = await db.query(fallbackQuery, [userId, name, type, sourceModule, icon, parentId, description, color, category || 'General']);
                return fallbackResult.rows[0];
            }
            throw error;
        }
    }

    async updateDeck(userId, deckId, name, icon, description = null, color = null, category = 'General') {
        try {
            const query = `
                UPDATE decks 
                SET name = $3, icon = $4, description = $5, color = $6, category = $7, updated_at = NOW()
                WHERE id = $2 AND user_id = $1
                RETURNING id, name, icon, color, description, category, updated_at
            `;
            const result = await db.query(query, [userId, deckId, name, icon, description, color, category || 'General']);

            if (result.rows.length > 0) {
                const updateCardsQuery = `
                    UPDATE user_flashcards 
                    SET topic = $1 
                    WHERE deck_id = $2 AND user_id = $3
                `;
                await db.query(updateCardsQuery, [name, deckId, userId]);
            }

            return result.rows[0];
        } catch (error) {
            if (error.code === '42703') {
                const query = `
                    UPDATE decks 
                    SET name = $3, icon = $4, description = $5, color = $6, category = $7
                    WHERE id = $2 AND user_id = $1
                    RETURNING id, name, icon, color, description, category
                `;
                const result = await db.query(query, [userId, deckId, name, icon, description, color, category || 'General']);

                if (result.rows.length > 0) {
                    const updateCardsQuery = `
                        UPDATE user_flashcards 
                        SET topic = $1 
                        WHERE deck_id = $2 AND user_id = $3
                    `;
                    await db.query(updateCardsQuery, [name, deckId, userId]);
                }

                return result.rows[0];
            }
            throw error;
        }
    }

    async updateDeckVisibility(userId, deckId, isPublic, category = null) {
        try {
            let query = `
                UPDATE decks 
                SET is_public = $3, updated_at = NOW()
            `;
            const params = [userId, deckId, isPublic];

            if (category) {
                query += `, category = $4 WHERE id = $2 AND user_id = $1 RETURNING id, is_public, category, updated_at`;
                params.push(category);
            } else {
                query += ` WHERE id = $2 AND user_id = $1 RETURNING id, is_public, COALESCE(category, 'General') as category, updated_at`;
            }

            const result = await db.query(query, params);
            return result.rows[0];
        } catch (error) {
            if (error.code === '42703') {
                let query = `
                    UPDATE decks 
                    SET is_public = $3
                `;
                const params = [userId, deckId, isPublic];

                if (category) {
                    query += `, category = $4 WHERE id = $2 AND user_id = $1 RETURNING id, is_public, category`;
                    params.push(category);
                } else {
                    query += ` WHERE id = $2 AND user_id = $1 RETURNING id, is_public, COALESCE(category, 'General') as category`;
                }

                const result = await db.query(query, params);
                return result.rows[0];
            }
            throw error;
        }
    }

    async getPublicDecks(page = 1, limit = 20, category = 'ALL') {
        const offset = (page - 1) * limit;
        try {
            const query = `
                SELECT 
                    d.id, d.name, d.icon, d.description, d.color, COALESCE(d.category, 'General') as category,
                    d.saves_count, d.likes_count, d.created_at, d.updated_at,
                    u.name as author_name,
                    (SELECT COUNT(*) FROM user_flashcards uf WHERE uf.deck_id = d.id) as total_cards
                FROM decks d
                LEFT JOIN users u ON d.user_id = u.id
                WHERE d.is_public = true AND ($3 = 'ALL' OR COALESCE(d.category, 'General') = $3)
                ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC
                LIMIT $1 OFFSET $2
            `;
            const result = await db.query(query, [limit, offset, category || 'ALL']);
            return result.rows;
        } catch (error) {
            if (error.code === '42703') {
                const fallbackQuery = `
                    SELECT 
                        d.id, d.name, d.icon, d.description, d.color, COALESCE(d.category, 'General') as category,
                        d.saves_count, d.likes_count, d.created_at,
                        u.name as author_name,
                        (SELECT COUNT(*) FROM user_flashcards uf WHERE uf.deck_id = d.id) as total_cards
                    FROM decks d
                    LEFT JOIN users u ON d.user_id = u.id
                    WHERE d.is_public = true AND ($3 = 'ALL' OR COALESCE(d.category, 'General') = $3)
                    ORDER BY d.created_at DESC
                    LIMIT $1 OFFSET $2
                `;
                const fallbackResult = await db.query(fallbackQuery, [limit, offset, category || 'ALL']);
                return fallbackResult.rows;
            }
            throw error;
        }
    }

    async incrementDeckSaves(deckId) {
        const query = `UPDATE decks SET saves_count = saves_count + 1 WHERE id = $1`;
        await db.query(query, [deckId]);
    }

    async createFlashcardsManualBatch(userId, deckId, cards) {
        if (!cards || cards.length === 0) return { inserted: 0 };

        const deckQuery = `SELECT name FROM decks WHERE id = $1`;
        const deckRes = await db.query(deckQuery, [deckId]);
        const deckName = deckRes.rows[0]?.name || 'Manual Import';

        const existingQuery = `
            SELECT front_content FROM user_flashcards 
            WHERE user_id = $1 AND deck_id = $2
        `;
        const existingRes = await db.query(existingQuery, [userId, deckId]);
        const existingFronts = new Set(existingRes.rows.map(r => r.front_content.trim()));

        const values = [];
        const placeholders = [];
        let insertCount = 0;

        cards.forEach((c) => {
            const front = c.front.trim();
            const back = c.back.trim();

            if (existingFronts.has(front)) return;

            const offset = insertCount * 10;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
            values.push(userId, deckId, front, back, deckName, new Date(), c.image_url || null, c.explanation_image_url || null, c.audioUrlFront || null, c.audioUrlBack || null);
            insertCount++;
        });

        if (insertCount === 0) return { inserted: 0 };

        const query = `
            INSERT INTO user_flashcards (user_id, deck_id, front_content, back_content, topic, created_at, image_url, explanation_image_url, audio_url_frente, audio_url_dorso)
            VALUES ${placeholders.join(', ')}
        `;

        await db.query(query, values);
        return { inserted: insertCount };
    }

    async checkExistingFlashcards(userId, deckId, fronts = []) {
        if (!fronts || fronts.length === 0) return [];

        const query = `
            SELECT front_content FROM user_flashcards
            WHERE user_id = $1 AND deck_id = $2 AND front_content = ANY($3::text[])
        `;
        const result = await db.query(query, [userId, deckId, fronts]);
        return result.rows.map(r => r.front_content);
    }

    async getDueFlashcards(userId, deckId = null) {
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

        query += ` ORDER BY sort_order ASC, next_review_at ASC LIMIT 50`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async updateFlashcard(cardId, interval, ef, reps, nextDate, lastQuality = 0) {
        const query = `
            UPDATE user_flashcards
            SET interval_days = $2, easiness_factor = $3, repetition_number = $4, 
                next_review_at = $5, last_reviewed_at = NOW(), last_quality = $6
            WHERE id = $1
        `;
        await db.query(query, [cardId, interval, ef, reps, nextDate, lastQuality]);
    }

    async getFlashcardById(cardId) {
        const query = `SELECT * FROM user_flashcards WHERE id = $1`;
        const result = await db.query(query, [cardId]);
        return result.rows[0];
    }

    async getDeckCards(deckId) {
        const query = `
            SELECT * FROM user_flashcards 
            WHERE deck_id = $1 
            ORDER BY sort_order ASC, created_at DESC
        `;
        const result = await db.query(query, [deckId]);
        return result.rows;
    }

    async touchDeck(deckId) {
        if (!deckId) return;
        try {
            await db.query('UPDATE decks SET updated_at = NOW() WHERE id = $1', [deckId]);
        } catch (e) {
            // Silencioso si la columna updated_at no existe o fallo temporal
        }
    }

    async createFlashcard(userId, deckId, front, back, imageUrl = null, backImageUrl = null, audioUrlFront = null, audioUrlBack = null, ttsLangFront = 'es-ES', ttsLangBack = 'es-ES', hideTextFront = false, hideTextBack = false) {
        const query = `
            INSERT INTO user_flashcards (user_id, deck_id, front_content, back_content, topic, interval_days, easiness_factor, repetition_number, next_review_at, image_url, explanation_image_url, audio_url_frente, audio_url_dorso, tts_lang_frente, tts_lang_dorso, hide_text_frente, hide_text_dorso)
            VALUES (
                $1, $2, $3, $4, 
                COALESCE((SELECT name FROM decks WHERE id = $2), 'GENERAL'), 
                0, 2.5, 0, NOW(), $5, $6, $7, $8, $9, $10, $11, $12
            )
            RETURNING id, front_content, back_content, topic, image_url, explanation_image_url, audio_url_frente, audio_url_dorso, tts_lang_frente, tts_lang_dorso, hide_text_frente, hide_text_dorso
        `;
        const result = await db.query(query, [userId, deckId, front, back, imageUrl, backImageUrl, audioUrlFront, audioUrlBack, ttsLangFront, ttsLangBack, hideTextFront, hideTextBack]);
        return result.rows[0];
    }

    async updateFlashcardContent(userId, cardId, front, back, imageUrl = null, backImageUrl = null, audioUrlFront = null, audioUrlBack = null, ttsLangFront = 'es-ES', ttsLangBack = 'es-ES', hideTextFront = false, hideTextBack = false) {
        const query = `
            UPDATE user_flashcards 
            SET front_content = $3, back_content = $4, image_url = $5, explanation_image_url = $6, audio_url_frente = $7, audio_url_dorso = $8, tts_lang_frente = $9, tts_lang_dorso = $10, hide_text_frente = $11, hide_text_dorso = $12
            WHERE id = $2 AND user_id = $1
            RETURNING id, front_content, back_content, image_url, explanation_image_url, audio_url_frente, audio_url_dorso, tts_lang_frente, tts_lang_dorso, hide_text_frente, hide_text_dorso
        `;
        const result = await db.query(query, [userId, cardId, front, back, imageUrl, backImageUrl, audioUrlFront, audioUrlBack, ttsLangFront, ttsLangBack, hideTextFront, hideTextBack]);
        return result.rows[0];
    }

    async deleteFlashcard(userId, cardId) {
        const query = `DELETE FROM user_flashcards WHERE id = $1 AND user_id = $2`;
        await db.query(query, [cardId, userId]);
    }

    async updateFlashcardsOrder(userId, deckId, sortedIds) {
        if (!sortedIds || sortedIds.length === 0) return;

        const checkQuery = `SELECT id FROM decks WHERE id = $1 AND user_id = $2`;
        const checkRes = await db.query(checkQuery, [deckId, userId]);
        if (checkRes.rows.length === 0) throw new Error("Deck not found or access denied");

        const valuesClause = sortedIds.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::int)`).join(', ');
        const params = [];
        sortedIds.forEach((id, index) => {
            params.push(id, index);
        });

        params.push(deckId, userId);
        const deckIdParamIndex = params.length - 1;
        const userIdParamIndex = params.length;

        const batchQuery = `
            UPDATE user_flashcards AS uf
            SET sort_order = v.ord
            FROM (VALUES ${valuesClause}) AS v(id, ord)
            WHERE uf.id = v.id AND uf.deck_id = $${deckIdParamIndex} AND uf.user_id = $${userIdParamIndex}
        `;

        await db.query(batchQuery, params);
    }

    async deleteBulkFlashcards(userId, cardIds) {
        if (!cardIds || cardIds.length === 0) return;
        const query = `DELETE FROM user_flashcards WHERE id = ANY($1::uuid[]) AND user_id = $2`;
        await db.query(query, [cardIds, userId]);
    }

    async deleteDeck(userId, deckId) {
        const fetchTreeQuery = `
            WITH RECURSIVE deck_tree AS (
                SELECT id, 1 as depth FROM decks WHERE id = $1 AND user_id = $2
                UNION ALL
                SELECT d.id, dt.depth + 1 FROM decks d
                INNER JOIN deck_tree dt ON d.parent_id = dt.id
                WHERE d.user_id = $2
            )
            SELECT id FROM deck_tree ORDER BY depth DESC;
        `;

        try {
            const { rows } = await db.query(fetchTreeQuery, [deckId, userId]);

            if (rows.length === 0) return;

            for (const row of rows) {
                await db.query('DELETE FROM decks WHERE id = $1 AND user_id = $2', [row.id, userId]);
            }
        } catch (error) {
            console.error("Error deleting deck tree:", error);
            throw error;
        }
    }

    async getCardsImages(userId, cardIds) {
        if (!cardIds || cardIds.length === 0) return [];
        const query = `
            SELECT image_url, explanation_image_url, audio_url_frente, audio_url_dorso 
            FROM user_flashcards 
            WHERE id = ANY($1::uuid[]) AND user_id = $2
            AND (image_url IS NOT NULL OR explanation_image_url IS NOT NULL OR audio_url_frente IS NOT NULL OR audio_url_dorso IS NOT NULL);
        `;
        const { rows } = await db.query(query, [cardIds, userId]);
        return rows;
    }

    async getDeckTreeImages(userId, deckId) {
        const query = `
            WITH RECURSIVE deck_tree AS (
                SELECT id, description FROM decks WHERE id = $1 AND user_id = $2
                UNION ALL
                SELECT d.id, d.description FROM decks d
                INNER JOIN deck_tree dt ON d.parent_id = dt.id
                WHERE d.user_id = $2
            )
            SELECT 
                uf.image_url, 
                uf.explanation_image_url,
                uf.audio_url_frente,
                uf.audio_url_dorso,
                dt.description as deck_description
            FROM deck_tree dt
            LEFT JOIN user_flashcards uf ON dt.id = uf.deck_id
            WHERE (uf.image_url IS NOT NULL OR uf.explanation_image_url IS NOT NULL OR uf.audio_url_frente IS NOT NULL OR uf.audio_url_dorso IS NOT NULL OR dt.description IS NOT NULL);
        `;
        const { rows } = await db.query(query, [deckId, userId]);
        return rows;
    }
}

module.exports = new FlashcardRepository();
