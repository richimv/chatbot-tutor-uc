const UserPreferencesService = require('../../domain/services/userPreferencesService');

class UserPreferencesController {
    constructor() {
        this.preferencesService = new UserPreferencesService();
    }

    /**
     * GET /api/users/preferences?domain=medicine
     */
    async getPreferences(req, res) {
        try {
            const userId = req.user.id; // From verifyToken middleware
            const { domain } = req.query;

            if (!domain) {
                return res.status(400).json({ error: 'Domain query parameter is mandatory.' });
            }

            const config = await this.preferencesService.getPreferences(userId, domain);

            if (!config) {
                // Return 200 with null explicitly to tell the client nothing is saved yet
                return res.json({ message: 'No preferences found', data: null });
            }

            res.json({ message: 'Preferences retrieved', data: config });
        } catch (error) {
            console.error('Error in getPreferences:', error);
            res.status(500).json({ error: 'Failed to retrieve user preferences.' });
        }
    }

    /**
     * POST /api/users/preferences
     * Body: { domain: 'medicine', config_json: { target: 'ENARM', difficulty: 'Avanzado', areas: [...] } }
     */
    async savePreferences(req, res) {
        try {
            const userId = req.user.id;
            const { domain, config_json } = req.body;

            if (!domain || !config_json) {
                return res.status(400).json({ error: 'Domain and config_json are mandatory parameters.' });
            }

            const updatedConfig = await this.preferencesService.savePreferences(userId, domain, config_json);

            res.json({ message: 'Preferences updated successfully', data: updatedConfig });
        } catch (error) {
            console.error('Error in savePreferences:', error);
            res.status(500).json({ error: 'Failed to save user preferences.' });
        }
    }
}

module.exports = new UserPreferencesController();
