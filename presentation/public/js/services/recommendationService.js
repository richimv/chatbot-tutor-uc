const API_URL = window.AppConfig ? window.AppConfig.API_URL : 'http://localhost:3000';

class RecommendationService {
    /**
     * Obtiene las predicciones de cursos y temas populares.
     * @returns {Promise<object>}
     */
    static async getPredictions() {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('No autenticado');

        const response = await fetch(`${API_URL}/api/analytics/predictions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener predicciones');
        }
        return response.json();
    }

    /**
     * Obtiene recomendaciones personalizadas basadas en el historial del usuario.
     * (Este endpoint puede ser implementado en el futuro)
     */
    static async getPersonalizedRecommendations() {
        // Implementación futura
        console.warn('getPersonalizedRecommendations no está implementado aún.');
        return [];
    }
}
