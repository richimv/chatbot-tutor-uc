class AnalyticsApiService {
    /**
     * Registra el feedback del usuario sobre una respuesta del bot.
     * @param {string} query - La pregunta original del usuario.
     * @param {string} response - La respuesta que dio el bot.
     * @param {boolean} isHelpful - Si el usuario la marcó como útil.
     * @returns {Promise<void>}
     */
    static async recordFeedback(query, response, isHelpful, messageId) {
        const token = localStorage.getItem('authToken');
        // No es necesario un token para el feedback, pero es bueno tener el contexto del usuario si está logueado.
        const headers = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch('/api/analytics/feedback', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ query, response, isHelpful, messageId }),
            });
            if (!res.ok) {
                console.error('Error al enviar el feedback:', await res.text());
            }
        } catch (error) {
            console.error('Error de red al enviar el feedback:', error);
        }
    }

    // ✅ CORRECCIÓN: Este método debe estar dentro de la clase.
    // Es un método genérico para hacer peticiones GET autenticadas.
    static async _get(endpoint) {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('No autenticado');
    
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al obtener datos de ${endpoint}`);
        }
        return response.json();
    }
    
    /**
     * Obtiene las métricas principales para el dashboard (KPIs).
     * @returns {Promise<object>}
     */
    static async getDashboardAnalytics(days = 7) {
        // ✅ SOLUCIÓN: Añadir el parámetro 'days' a la URL de la petición.
        return this._get(`/api/analytics?days=${days}`);
    }
    
    /**
     * Obtiene las tendencias de búsqueda para los gráficos.
     * @returns {Promise<object>}
     */
    static async getSearchTrends(days = 7) {
        // ✅ SOLUCIÓN: Pasar el parámetro 'days' a la API para que el filtro de tiempo funcione.
        return this._get(`/api/analytics/trends?days=${days}`);
    }

    /**
     * ✅ SOLUCIÓN: Nuevo método para obtener las tendencias de interacción por canal.
     * @param {number} days - El número de días a consultar.
     */
    static async getInteractionTrends(days = 7) {
        return this._get(`/api/analytics/interaction-trends?days=${days}`);
    }
    
    /**
     * Obtiene las predicciones de los modelos de ML.
     * @returns {Promise<object>}
     */
    static async getPredictions() {
        return this._get('/api/analytics/predictions');
    }
    
    /**
     * Obtiene todos los registros de feedback.
     * @returns {Promise<Array>}
     */
    static async getFeedback() {
        return this._get('/api/analytics/feedback');
    }
    
    /**
     * ✅ NUEVO: Registra una vista de página.
     * Se envía en modo "fire-and-forget", no necesitamos esperar la respuesta.
     * @param {string} entityType - 'course', 'topic', 'career'.
     * @param {number} entityId - El ID de la entidad.
     */
    static recordView(entityType, entityId) {
        const token = localStorage.getItem('authToken');
        if (!token) return; // No registrar vistas para usuarios no logueados.

        fetch('/api/analytics/view', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entityType, entityId }),
            // ✅ MEJORA: keepalive permite que esta petición se complete incluso si el usuario navega a otra página.
            keepalive: true 
        }).catch(error => {
            // No hacemos nada en caso de error para no interrumpir la experiencia del usuario.
            console.warn('Advertencia: No se pudo registrar la vista de página.', error);
        });
    }
}