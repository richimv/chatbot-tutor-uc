const DeckService = require('../../src/domain/services/deckService');
const trainingRepository = require('../../src/domain/repositories/flashcardRepository');
const db = require('../../src/infrastructure/database/db');
const fs = require('fs');
const path = require('path');

jest.mock('../../src/domain/repositories/flashcardRepository');
jest.mock('../../src/infrastructure/database/db');

describe('Deck Clone Reactive Sync & Code Health Auditing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Backend: DeckService.cloneDeck Clean Architecture', () => {
        it('clones deck cleanly without executing dead redundant queries (Clean Code)', async () => {
            db.query.mockImplementation((sql, params) => {
                if (sql.includes('SELECT * FROM decks WHERE id = $1 AND is_public = true')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'public-deck-1',
                            name: 'Neuroanatomía Clínica',
                            icon: 'fas fa-brain',
                            description: 'Guía de neuro',
                            color: '#f472b6',
                            category: 'Medicina'
                        }]
                    });
                }
                if (sql.includes('SELECT id FROM decks WHERE user_id = $1')) {
                    return Promise.resolve({ rows: [] }); // Not yet cloned
                }
                if (sql.includes('SELECT COUNT(*) as count FROM decks')) {
                    return Promise.resolve({ rows: [{ count: '0' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            trainingRepository.createDeck.mockResolvedValue({
                id: 'cloned-deck-uuid',
                name: 'Neuroanatomía Clínica (Clon)',
                category: 'Medicina'
            });
            trainingRepository.getDeckCards.mockResolvedValue([
                { front_content: '¿Función del cerebelo?', back_content: 'Coordinación motora' }
            ]);
            trainingRepository.getDeckById.mockResolvedValue({ id: 'cloned-deck-uuid' });
            trainingRepository.createFlashcardsManualBatch.mockResolvedValue({ inserted: 1 });
            trainingRepository.incrementDeckSaves.mockResolvedValue();

            const cloned = await DeckService.cloneDeck('user-test-uuid', 'public-deck-1');

            expect(cloned.id).toBe('cloned-deck-uuid');
            expect(cloned.name).toBe('Neuroanatomía Clínica (Clon)');

            // Verificación de Clean Code (@code-health-rules):
            // No debe llamarse a getDeckById con 'GUEST' (código muerto eliminado)
            expect(trainingRepository.getDeckById).not.toHaveBeenCalledWith('GUEST', 'public-deck-1');

            // Debe llamarse a createDeck con la categoría original
            expect(trainingRepository.createDeck).toHaveBeenCalledWith(
                'user-test-uuid',
                'Neuroanatomía Clínica (Clon)',
                'USER',
                'MANUAL',
                'fas fa-brain',
                null,
                'Guía de neuro',
                '#f472b6',
                'Medicina'
            );
        });
    });

    describe('Frontend: repaso.js Cache Invalidation & In-flight Cleanup', () => {
        const repasoJsPath = path.join(__dirname, '../../src/presentation/public/js/repaso.js');
        const code = fs.readFileSync(repasoJsPath, 'utf8');

        it('cloneDeck must immediately invoke invalidateCache to prevent stale lists', () => {
            const cloneDeckMatch = code.match(/async cloneDeck\([^\)]*\)\s*\{[\s\S]*?\n    \}/);
            expect(cloneDeckMatch).not.toBeNull();
            const cloneDeckBody = cloneDeckMatch[0];

            expect(cloneDeckBody).toContain('this.invalidateCache();');
            expect(cloneDeckBody).toContain('await this.explorer.loadTree();');
        });

        it('fetchDecksShared must not use an artificial 5000ms delay to retain stale promises', () => {
            const fetchSharedMatch = code.match(/async fetchDecksShared\([^\)]*\)\s*\{[\s\S]*?\n    \}/);
            expect(fetchSharedMatch).not.toBeNull();
            const fetchSharedBody = fetchSharedMatch[0];

            // Debe eliminar la promesa inmediatamente en finally
            expect(fetchSharedBody).toMatch(/finally\s*\{[\s\S]*?delete\s+this\._sharedRequests\.decks\[key\];/);
            // No debe tener setTimeout de 5000ms
            expect(fetchSharedBody).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*delete\s+this\._sharedRequests\.decks\[key\],\s*5000\)/);
        });

        it('handleCreateDeck must synchronize the sidebar tree with await loadTree', () => {
            const handleCreateMatch = code.match(/async handleCreateDeck\([^\)]*\)\s*\{[\s\S]*?\n    \}/);
            expect(handleCreateMatch).not.toBeNull();
            const handleCreateBody = handleCreateMatch[0];

            expect(handleCreateBody).toContain('await this.explorer.loadTree();');
        });
    });
});
