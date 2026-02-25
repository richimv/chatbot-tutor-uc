const DeckService = require('../../domain/services/deckService');

class DeckController {
    /**
     * GET /api/decks
     * Query Params: ?parentId=uuid (optional)
     */
    async listDecks(req, res) {
        try {
            const userId = req.user.id;
            const { parentId } = req.query; // Supports null or undefined for Roots
            const decks = await DeckService.getUserDecks(userId, parentId || null);
            res.json({ success: true, decks });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error fetching decks' });
        }
    }

    /**
     * GET /api/decks/:deckId
     */
    async getDeckById(req, res) {
        try {
            const userId = req.user.id;
            const { deckId } = req.params;
            const deck = await DeckService.getDeckById(userId, deckId);

            if (!deck) return res.status(404).json({ error: 'Mazo no encontrado' });

            res.json({ success: true, deck });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error fetching deck' });
        }
    }

    /**
     * POST /api/decks
     */
    async createDeck(req, res) {
        try {
            const { name, icon, parentId } = req.body;
            const userId = req.user.id;

            if (!name) return res.status(400).json({ error: 'Name is required' });

            const deck = await DeckService.createDeck(userId, name, icon || 'fas fa-layer-group', parentId || null);
            res.json({ success: true, deck });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error creating deck' });
        }
    }

    /**
     * PUT /api/decks/:deckId
     */
    async updateDeck(req, res) {
        try {
            const { deckId } = req.params;
            const { name } = req.body;
            const userId = req.user.id;

            if (!name) return res.status(400).json({ error: 'Name is required' });

            const deck = await DeckService.updateDeck(userId, deckId, name);
            res.json({ success: true, deck });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error updating deck' });
        }
    }

    /**
     * GET /api/decks/:deckId/cards/due
     */
    async getDueCards(req, res) {
        try {
            const { deckId } = req.params;
            const userId = req.user.id;
            const cards = await DeckService.getDueCards(userId, deckId);
            res.json({ success: true, cards });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error fetching cards' });
        }
    }

    /**
     * GET /api/decks/:deckId/cards
     */
    async listCards(req, res) {
        try {
            const { deckId } = req.params;
            const cards = await DeckService.getDeckCards(deckId);
            res.json({ success: true, cards });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error listing cards' });
        }
    }

    /**
     * POST /api/decks/:deckId/cards
     */
    async addCard(req, res) {
        try {
            const { deckId } = req.params;
            const { front, back } = req.body;
            const userId = req.user.id;

            if (!front || !back) return res.status(400).json({ error: 'Data missing' });

            const card = await DeckService.addCard(userId, deckId, front, back);
            res.json({ success: true, card });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error adding card' });
        }
    }

    /**
     * PUT /api/cards/:cardId
     */
    async updateCard(req, res) {
        try {
            const { cardId } = req.params;
            const { front, back } = req.body;
            const userId = req.user.id;

            if (!front || !back) return res.status(400).json({ error: 'Data missing' });

            const card = await DeckService.updateCard(userId, cardId, front, back);
            res.json({ success: true, card });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error updating card' });
        }
    }

    /**
     * DELETE /api/cards/:cardId
     */
    async deleteCard(req, res) {
        try {
            const { cardId } = req.params;
            const userId = req.user.id;
            await DeckService.deleteCard(userId, cardId);
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error deleting card' });
        }
    }

    /**
     * DELETE /api/decks/:deckId
     */
    async deleteDeck(req, res) {
        try {
            const { deckId } = req.params;
            const userId = req.user.id;
            await DeckService.deleteDeck(userId, deckId);
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error deleting deck' });
        }
    }

    /**
     * POST /api/decks/:deckId/generate
     * Genera tarjetas con IA y las añade al mazo.
     */
    async generateCards(req, res) {
        try {
            const { deckId } = req.params;
            const { topic } = req.body;
            const userId = req.user.id;

            if (!topic) return res.status(400).json({ error: 'Topic is required' });

            const TrainingService = require('../../domain/services/trainingService');

            // 1. Generar con IA
            const cards = await TrainingService.generateFlashcardsFromTopic(topic, 5);

            // 2. Guardar en Base de Datos
            const savedCards = [];
            for (const card of cards) {
                // Reutilizamos addCard del servicio de Decks
                const saved = await DeckService.addCard(userId, deckId, card.front, card.back);
                savedCards.push(saved);
            }

            res.json({ success: true, count: savedCards.length, cards: savedCards });

        } catch (error) {
            console.error('Error in generateCards:', error);
            res.status(500).json({ error: 'Error generando tarjetas con IA.' });
        }
    }
}

module.exports = new DeckController();
