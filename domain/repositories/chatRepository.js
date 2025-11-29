const pool = require('../../infrastructure/database/db');

class ChatRepository {
    /**
     * Crea una nueva conversación para un usuario.
     * @param {number} userId - El ID del usuario.
     * @param {string} title - El título inicial de la conversación.
     * @returns {Promise<object>} La conversación creada.
     */
    async createConversation(userId, title) {
        const query = `
            INSERT INTO conversations (user_id, title)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [userId, title]);
        return rows[0];
    }

    /**
     * Añade un mensaje a una conversación existente.
     * @param {number} conversationId - El ID de la conversación.
     * @param {string} sender - Quién envía el mensaje ('user' o 'bot').
     * @param {string} content - El contenido del mensaje.
     * @returns {Promise<object>} El mensaje añadido.
     */
    async addMessage(conversationId, sender, content) {
        const query = `
            INSERT INTO chat_messages (conversation_id, sender, content)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [conversationId, sender, content]);
        // También actualizamos la fecha de la conversación principal
        await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
        return rows[0];
    }

    /**
     * Obtiene todas las conversaciones de un usuario, ordenadas por la más reciente.
     * @param {number} userId - El ID del usuario.
     * @returns {Promise<Array<object>>} Una lista de conversaciones.
     */
    async getConversationsByUserId(userId) {
        const query = `
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE user_id = $1
            ORDER BY updated_at DESC;
        `;
        const { rows } = await pool.query(query, [userId]);
        return rows;
    }

    /**
     * Obtiene todos los mensajes de una conversación específica, verificando que pertenezca al usuario.
     * @param {number} conversationId - El ID de la conversación.
     * @param {number} userId - El ID del usuario (para verificación de seguridad).
     * @returns {Promise<Array<object>>} Una lista de mensajes.
     */
    async getMessagesByConversationId(conversationId, userId) {
        const query = `
            SELECT 
                cm.id, 
                cm.sender, 
                cm.content, 
                cm.created_at,
                f.is_helpful
            FROM chat_messages cm
            JOIN conversations c ON cm.conversation_id = c.id
            LEFT JOIN feedback f ON cm.id = f.message_id AND f.user_id = c.user_id
            WHERE cm.conversation_id = $1 AND c.user_id = $2
            ORDER BY cm.created_at ASC;
        `;
        const { rows } = await pool.query(query, [conversationId, userId]);
        return rows;
    }

    /**
     * Actualiza el título de una conversación específica, verificando la propiedad del usuario.
     * @param {number} conversationId - El ID de la conversación.
     * @param {string} newTitle - El nuevo título.
     * @param {number} userId - El ID del usuario propietario.
     * @returns {Promise<object>} La conversación actualizada.
     */
    async updateTitle(conversationId, newTitle, userId) {
        const query = `
            UPDATE conversations
            SET title = $1, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [newTitle, conversationId, userId]);
        return rows[0];
    }

    /**
     * Elimina una conversación y sus mensajes asociados (en cascada).
     * La política RLS asegura que un usuario solo puede borrar sus propias conversaciones.
     * @param {number} conversationId - El ID de la conversación a eliminar.
     * @param {number} userId - El ID del usuario para verificación de seguridad.
     * @returns {Promise<boolean>} True si se eliminó, false si no se encontró.
     */
    async deleteConversation(conversationId, userId) {
        const query = `
            DELETE FROM conversations
            WHERE id = $1 AND user_id = $2;
        `;
        const result = await pool.query(query, [conversationId, userId]);
        return result.rowCount > 0;
    }
}

module.exports = ChatRepository;