const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../infrastructure/database/analytics.json');

class AnalyticsRepository {
    constructor() {
        this.dbPath = DB_PATH;
    }

    loadDatabase() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                return {
                    searchHistory: [],
                    chatConversations: [],
                    userFeedback: [],
                    popularityMetrics: { courses: {}, topics: {}, trends: {} }
                };
            }
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Error cargando analytics:', error);
            return this.getDefaultStructure();
        }
    }

    saveDatabase(data) {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Error guardando analytics:', error);
            return false;
        }
    }

    getDefaultStructure() {
        return {
            searchHistory: [],
            chatConversations: [],
            userFeedback: [],
            popularityMetrics: { courses: {}, topics: {}, trends: {} }
        };
    }

    // Búsquedas
    async recordSearch(query, resultsCount, userId = 'anonymous') {
        const data = this.loadDatabase();
        const searchRecord = {
            id: Date.now().toString(),
            query,
            resultsCount,
            userId,
            timestamp: new Date().toISOString(),
            type: 'search'
        };

        data.searchHistory.push(searchRecord);
        
        // Actualizar métricas de popularidad
        this.updatePopularityMetrics(data, query, resultsCount);
        
        return this.saveDatabase(data);
    }

    // Conversaciones de Chat
    async recordChatMessage(userMessage, botResponse, intent, confidence) {
        const data = this.loadDatabase();
        const conversationRecord = {
            id: Date.now().toString(),
            userMessage,
            botResponse,
            intent,
            confidence,
            timestamp: new Date().toISOString(),
            type: 'chat'
        };

        data.chatConversations.push(conversationRecord);
        return this.saveDatabase(data);
    }

    // Feedback de usuarios
    async recordFeedback(conversationId, rating, comments = '') {
        const data = this.loadDatabase();
        const feedbackRecord = {
            id: Date.now().toString(),
            conversationId,
            rating, // 1-5 estrellas
            comments,
            timestamp: new Date().toISOString(),
            type: 'feedback'
        };

        data.userFeedback.push(feedbackRecord);
        return this.saveDatabase(data);
    }

    // Métricas de popularidad
    updatePopularityMetrics(data, query, resultsCount) {
        const metrics = data.popularityMetrics;
        
        // Actualizar cursos populares (simplificado)
        if (resultsCount > 0) {
            // Aquí se podría hacer análisis más complejo
            metrics.trends[query] = (metrics.trends[query] || 0) + 1;
        }

        // Mantener solo últimos 3 meses de datos
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        data.searchHistory = data.searchHistory.filter(record => 
            new Date(record.timestamp) > threeMonthsAgo
        );
    }

    // Obtener datos para análisis
    async getSearchTrends(limit = 10) {
        const data = this.loadDatabase();
        const trends = {};
        
        data.searchHistory.forEach(record => {
            trends[record.query] = (trends[record.query] || 0) + 1;
        });

        return Object.entries(trends)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([query, count]) => ({ query, count }));
    }

    async getChatAnalytics() {
        const data = this.loadDatabase();
        const recentChats = data.chatConversations.slice(-100); // Últimas 100 conversaciones
        
        const intentStats = {};
        recentChats.forEach(chat => {
            intentStats[chat.intent] = (intentStats[chat.intent] || 0) + 1;
        });

        return {
            totalConversations: data.chatConversations.length,
            recentConversations: recentChats.length,
            intentDistribution: intentStats,
            averageConfidence: recentChats.reduce((acc, chat) => acc + chat.confidence, 0) / recentChats.length
        };
    }
}

module.exports = AnalyticsRepository;