const db = require('../../infrastructure/database/db');

class UserPreferencesService {
    /**
     * Retrieves the simulator configuration for a user in a specific domain.
     * @param {string} userId - UUID matching auth.users
     * @param {string} domain - E.g. 'medicine', 'english'
     * @returns {Object} JSON configuration object or null if not found
     */
    async getPreferences(userId, domain) {
        if (!userId || !domain) throw new Error('user_id and domain are required.');

        const query = `
            SELECT config_json
            FROM user_simulator_preferences
            WHERE user_id = $1 AND domain = $2;
        `;
        const res = await db.query(query, [userId, domain]);

        if (res.rows.length > 0) {
            return res.rows[0].config_json;
        }
        return null;
    }

    /**
     * Upserts (Inserts or Updates) the simulator configuration for a user.
     * @param {string} userId - UUID
     * @param {string} domain - Domain name (e.g. 'medicine')
     * @param {Object} configJson - The state to persist
     */
    async savePreferences(userId, domain, configJson) {
        if (!userId || !domain || !configJson) {
            throw new Error('user_id, domain, and config_json are required.');
        }

        const query = `
            INSERT INTO user_simulator_preferences (user_id, domain, config_json, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, domain)
            DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = EXCLUDED.updated_at
            RETURNING config_json;
        `;

        // Ensure config_json is properly stringified if pg doesn't auto-handle it
        const serializedJson = typeof configJson === 'object' ? JSON.stringify(configJson) : configJson;

        const res = await db.query(query, [userId, domain, serializedJson]);
        return res.rows[0].config_json;
    }
}

module.exports = UserPreferencesService;
