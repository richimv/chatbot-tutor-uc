const GeminiService = require('../../domain/services/mlService');
const ChatRepository = require('../../domain/repositories/chatRepository');

class ChatService {
    constructor() {
        this.chatRepository = new ChatRepository();
    }

    /**
     * Procesa un mensaje entrante, obtiene una respuesta de la IA y lo guarda todo en la BD.
     * @param {number} userId - El ID del usuario que envía el mensaje.
     * @param {string} messageText - El texto del mensaje del usuario.
     * @param {number|null} conversationId - El ID de la conversación actual, o null si es nueva.
     * @returns {Promise<object>} Un objeto con la respuesta y el ID de la conversación.
     */
    async processMessage(userId, messageText, conversationId) {
        let convId = conversationId;

        // 1. Si no hay ID de conversación, es un chat nuevo. Lo creamos.
        if (!convId) {
            // Generamos un título a partir del primer mensaje del usuario.
            const title = messageText.substring(0, 50) + (messageText.length > 50 ? '...' : '');
            const newConversation = await this.chatRepository.createConversation(userId, title);
            convId = newConversation.id;
        }

        // 2. Guardar el mensaje del usuario en la base de datos.
        await this.chatRepository.addMessage(convId, 'user', messageText);

        // 3. Obtener el historial de la conversación para dar contexto a la IA.
        const history = await this.chatRepository.getMessagesByConversationId(convId, userId);

        // 4. Llamar al servicio de IA para obtener una respuesta.
        const botResponse = await GeminiService.getChatResponse(messageText, history);

        // 5. Guardar la respuesta del bot en la base de datos.
        const savedBotMessage = await this.chatRepository.addMessage(convId, 'bot', botResponse.respuesta);

        // 6. Devolver la respuesta y el ID de la conversación (importante si era nueva).
        return {
            ...botResponse,
            conversationId: convId,
            messageId: savedBotMessage.id // ✅ NUEVO: Devolver el ID del mensaje del bot
        };
    }

    /**
     * Obtiene todas las conversaciones de un usuario.
     */
    async getConversations(userId) {
        return this.chatRepository.getConversationsByUserId(userId);
    }

    /**
     * Obtiene todos los mensajes de una conversación específica.
     */
    async getMessages(conversationId, userId) {
        return this.chatRepository.getMessagesByConversationId(conversationId, userId);
    }

    /**
     * Actualiza el título de una conversación.
     */
    async updateConversationTitle(conversationId, newTitle, userId) {
        return this.chatRepository.updateTitle(conversationId, newTitle, userId);
    }

    /**
     * Elimina una conversación.
     */
    async deleteConversation(conversationId, userId) {
        return this.chatRepository.deleteConversation(conversationId, userId);
    }
}

module.exports = ChatService;