const DeckService = require('../../domain/services/deckService');

class DeckController {
    /**
     * Helper to get common user context.
     */
    _getUserContext = (req) => {
        return {
            userId: req.user ? req.user.id : 'GUEST',
            isGuest: !req.user
        };
    }

    /**
     * GET /api/decks
     * Query Params: ?parentId=uuid (optional)
     */
    listDecks = async (req, res) => {
        try {
            const { userId } = this._getUserContext(req);
            const { parentId } = req.query;
            const decks = await DeckService.getUserDecks(userId, parentId || null);
            res.json({ success: true, decks });
        } catch (error) {
            console.error('[listDecks] Error:', error);
            res.status(500).json({ error: 'Error al obtener los mazos' });
        }
    }

    /**
     * GET /api/decks/:deckId
     */
    getDeckById = async (req, res) => {
        try {
            const { userId, isGuest } = this._getUserContext(req);
            const { deckId } = req.params;
            const deck = await DeckService.getDeckById(userId, deckId);

            if (!deck) return res.status(404).json({ error: 'Mazo no encontrado' });

            // Security: Guests only for SYSTEM decks
            if (isGuest && deck.type !== 'SYSTEM') {
                return res.status(403).json({ error: 'Acceso denegado: Inicia sesión para ver este mazo' });
            }

            res.json({ success: true, deck });
        } catch (error) {
            console.error('[getDeckById] Error:', error);
            res.status(500).json({ error: 'Error al obtener el mazo' });
        }
    }

    /**
     * POST /api/decks
     */
    createDeck = async (req, res) => {
        try {
            const { name, icon, parentId } = req.body;
            const { userId, isGuest } = this._getUserContext(req);

            if (isGuest) return res.status(403).json({ error: 'Debes iniciar sesión para crear mazos' });
            if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

            const deck = await DeckService.createDeck(userId, name, icon || 'fas fa-layer-group', parentId || null);
            res.json({ success: true, deck });
        } catch (error) {
            console.error('[createDeck] Error:', error);
            res.status(500).json({ error: 'Error al crear el mazo' });
        }
    }

    /**
     * PUT /api/decks/:deckId
     */
    updateDeck = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { name, icon } = req.body;
            const { userId } = this._getUserContext(req);

            if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

            const deck = await DeckService.updateDeck(userId, deckId, name, icon);
            res.json({ success: true, deck });
        } catch (error) {
            console.error('[updateDeck] Error:', error);
            res.status(500).json({ error: 'Error al actualizar el mazo' });
        }
    }

    /**
     * GET /api/decks/:deckId/cards/due
     */
    getDueCards = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { userId } = this._getUserContext(req);
            const cards = await DeckService.getDueCards(userId, deckId);
            res.json({ success: true, cards });
        } catch (error) {
            console.error('[getDueCards] Error:', error);
            res.status(500).json({ error: 'Error al obtener tarjetas pendientes' });
        }
    }

    /**
     * GET /api/decks/:deckId/cards
     */
    listCards = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { userId, isGuest } = this._getUserContext(req);

            // Security: If Guest, ensure it's a SYSTEM deck
            if (isGuest) {
                const deck = await DeckService.getDeckById('GUEST', deckId);
                if (!deck || deck.type !== 'SYSTEM') {
                    return res.status(403).json({ error: 'Acceso denegado: No puedes ver estas tarjetas' });
                }
            }

            const cards = await DeckService.getDeckCards(deckId);
            res.json({ success: true, cards });
        } catch (error) {
            console.error('[listCards] Error:', error);
            res.status(500).json({ error: 'Error al listar tarjetas' });
        }
    }

    /**
     * POST /api/decks/:deckId/cards
     */
    addCard = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { front, back } = req.body;
            const { userId } = this._getUserContext(req);

            if (!front || !back) return res.status(400).json({ error: 'Faltan datos de la tarjeta' });

            const card = await DeckService.addCard(userId, deckId, front, back);
            res.json({ success: true, card });
        } catch (error) {
            console.error('[addCard] Error:', error);
            res.status(500).json({ error: 'Error al añadir tarjeta' });
        }
    }

    /**
     * PUT /api/decks/:deckId/cards/reorder
     */
    reorderCards = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { sortedIds } = req.body;
            const { userId } = this._getUserContext(req);

            if (!sortedIds || !Array.isArray(sortedIds)) {
                return res.status(400).json({ error: 'Se requiere una lista de IDs para reordenar' });
            }

            await DeckService.updateCardsOrder(userId, deckId, sortedIds);
            res.json({ success: true });
        } catch (error) {
            console.error('[reorderCards] Error:', error);
            res.status(500).json({ error: 'Error al reordenar tarjetas' });
        }
    }

    /**
     * DELETE /api/cards/batch
     */
    deleteBulkCards = async (req, res) => {
        try {
            const { cardIds } = req.body;
            const { userId } = this._getUserContext(req);

            if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
                return res.status(400).json({ error: 'Se requieren IDs de tarjetas' });
            }

            await DeckService.deleteBulkCards(userId, cardIds);
            res.json({ success: true, deletedCount: cardIds.length });
        } catch (error) {
            console.error('[deleteBulkCards] Error:', error);
            res.status(500).json({ error: 'Error al eliminar tarjetas masivamente' });
        }
    }

    /**
     * PUT /api/cards/:cardId
     */
    updateCard = async (req, res) => {
        try {
            const { cardId } = req.params;
            const { front, back } = req.body;
            const { userId } = this._getUserContext(req);

            if (!front || !back) return res.status(400).json({ error: 'Faltan datos de la tarjeta' });

            const card = await DeckService.updateCard(userId, cardId, front, back);
            res.json({ success: true, card });
        } catch (error) {
            console.error('[updateCard] Error:', error);
            res.status(500).json({ error: 'Error al actualizar tarjeta' });
        }
    }

    /**
     * DELETE /api/cards/:cardId
     */
    deleteCard = async (req, res) => {
        try {
            const { cardId } = req.params;
            const { userId } = this._getUserContext(req);
            await DeckService.deleteCard(userId, cardId);
            res.json({ success: true });
        } catch (error) {
            console.error('[deleteCard] Error:', error);
            res.status(500).json({ error: 'Error al eliminar tarjeta' });
        }
    }

    /**
     * DELETE /api/decks/:deckId
     */
    deleteDeck = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { userId } = this._getUserContext(req);
            await DeckService.deleteDeck(userId, deckId);
            res.json({ success: true });
        } catch (error) {
            console.error('[deleteDeck] Error:', error);
            res.status(500).json({ error: 'Error al eliminar el mazo' });
        }
    }

    /**
     * POST /api/decks/:deckId/generate
     */
    generateCards = async (req, res) => {
        try {
            const { deckId } = req.params;
            const { topic } = req.body;
            const { userId } = this._getUserContext(req);

            if (!topic) return res.status(400).json({ error: 'El tema es obligatorio' });

            const TrainingService = require('../../domain/services/trainingService');
            const cards = await TrainingService.generateFlashcardsFromTopic(topic, 5);

            const savedCards = [];
            for (const card of cards) {
                const saved = await DeckService.addCard(userId, deckId, card.front, card.back);
                savedCards.push(saved);
            }

            // Sync Usage Limits
            try {
                const db = require('../../infrastructure/database/db');
                if (req.usageType) {
                    await db.query(
                        `UPDATE users SET ${req.usageType} = ${req.usageType} + 1 WHERE id = $1`,
                        [userId]
                    );
                }
            } catch (limitErr) {
                console.warn("Could not sync AI limits, continuing...", limitErr.message);
            }

            res.json({ success: true, count: savedCards.length, cards: savedCards });
        } catch (error) {
            console.error('[generateCards] Error:', error);
            res.status(500).json({ error: 'Error al generar tarjetas con IA' });
        }
    }
}

module.exports = new DeckController();
