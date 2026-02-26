const trainingRepository = require('../../infrastructure/repositories/trainingRepository');

class DeckService {
    async getUserDecks(userId, parentId = null) {
        return await trainingRepository.getDecks(userId, parentId);
    }

    async getDeckById(userId, deckId) {
        return await trainingRepository.getDeckById(userId, deckId);
    }

    async createDeck(userId, name, icon, parentId = null) {
        // Default to USER created manual deck
        return await trainingRepository.createDeck(userId, name, 'USER', 'MANUAL', icon, parentId);
    }

    async getDueCards(userId, deckId) {
        return await trainingRepository.getDueFlashcards(userId, deckId);
    }

    async getDeckCards(deckId) {
        return await trainingRepository.getDeckCards(deckId);
    }

    async addCard(userId, deckId, front, back) {
        return await trainingRepository.createFlashcard(userId, deckId, front, back);
    }

    async updateCard(userId, cardId, front, back) {
        return await trainingRepository.updateFlashcardContent(userId, cardId, front, back);
    }

    async deleteCard(userId, cardId) {
        return await trainingRepository.deleteFlashcard(userId, cardId);
    }

    async updateDeck(userId, deckId, name, icon) {
        return await trainingRepository.updateDeck(userId, deckId, name, icon);
    }

    async deleteDeck(userId, deckId) {
        return await trainingRepository.deleteDeck(userId, deckId);
    }
}

module.exports = new DeckService();
