const db = require('../../infrastructure/database/db');

class AdminRepository {
    async getOverallStats() {
        const [usersRes, premiumRes, searchesRes, chatsRes, topCoursesRes, topResourcesRes] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM users'),
            db.query("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'"),
            db.query('SELECT COUNT(*) as count FROM search_history'),
            db.query('SELECT COUNT(*) as count FROM chat_messages'),
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

    async getAllQuestions(domain, search) {
        let query = `
            SELECT id, question_text, domain, target, career, topic, subtopic, difficulty, created_at, options, correct_option_index as correct_answer, explanation, explanation_image_url, image_url, visual_support_recommendation
            FROM question_bank 
        `;
        const params = [];
        const conditions = [];

        if (domain && domain !== 'all') {
            params.push(domain);
            conditions.push(`domain = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(question_text ILIKE $${params.length} OR topic ILIKE $${params.length} OR subtopic ILIKE $${params.length})`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        query += ` ORDER BY created_at DESC LIMIT 1000`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async addQuestion({ question_text, options, correct_answer, explanation, explanation_image_url, domain, target, career, topic, subtopic, difficulty, image_url, hash, visual_support_recommendation }) {
        const insertQuery = `
            INSERT INTO question_bank (
                question_text, options, correct_option_index, explanation, explanation_image_url, 
                domain, target, career, topic, subtopic, difficulty, image_url, question_hash, visual_support_recommendation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id;
        `;
        const values = [
            question_text, JSON.stringify(options), correct_answer, explanation, explanation_image_url,
            domain, target, career, topic, subtopic, difficulty, image_url, hash, visual_support_recommendation
        ];

        const result = await db.query(insertQuery, values);
        return result.rows[0].id;
    }

    async getQuestionImages(id) {
        const result = await db.query('SELECT image_url, explanation_image_url FROM question_bank WHERE id = $1', [id]);
        return result.rows[0];
    }

    async updateQuestion(id, { question_text, options, correct_answer, explanation, explanation_image_url, domain, target, career, topic, subtopic, difficulty, image_url, hash, visual_support_recommendation }) {
        const updateQuery = `
            UPDATE question_bank 
            SET question_text = $1, options = $2, correct_option_index = $3, 
                explanation = $4, explanation_image_url = $5, domain = $6, 
                target = $7, career = $8, topic = $9, subtopic = $10, difficulty = $11, image_url = $12, question_hash = $13, visual_support_recommendation = $14
            WHERE id = $15
            RETURNING id;
        `;
        const values = [
            question_text, JSON.stringify(options), correct_answer, explanation, explanation_image_url,
            domain, target, career, topic, subtopic, difficulty, image_url, hash, visual_support_recommendation, id
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

    async updateResource(id, title, resourceType, imageUrl) {
        await db.query(
            'UPDATE resources SET title = $1, resource_type = $2, image_url = $3 WHERE id = $4',
            [title, resourceType, imageUrl, id]
        );
    }

    async addResource(resourceId, title, author, url, resourceType, imageUrl) {
        await db.query(
            'INSERT INTO resources (resource_id, title, author, url, resource_type, is_premium, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [resourceId, title, author, url, resourceType, false, imageUrl]
        );
    }

    async exportTableToCSVBuffer(tableName, columns = '*') {
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
}

module.exports = new AdminRepository();
