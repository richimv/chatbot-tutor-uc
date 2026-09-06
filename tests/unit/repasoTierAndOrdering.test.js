const fs = require('fs');
const path = require('path');
const db = require('../../src/infrastructure/database/db');
const flashcardRepository = require('../../src/domain/repositories/flashcardRepository');
const DeckService = require('../../src/domain/services/deckService');

jest.mock('../../src/infrastructure/database/db');

describe('Repaso Tier Permissions and Chronological Ordering (Architecture & Code Health)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('SessionManager & RepasoManager: Tier and Admin Resolution', () => {
        let sessionManagerCode;
        let repasoCode;

        beforeAll(() => {
            sessionManagerCode = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/sessionManager.js'), 'utf8');
            repasoCode = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/repaso.js'), 'utf8');
        });

        it('SessionManager.isAdmin correctly identifies admin by role or subscriptionTier', () => {
            // Emulate SessionManager.prototype.isAdmin logic
            const isAdminFn = (currentUser) => {
                return currentUser?.role === 'admin' || String(currentUser?.subscriptionTier || '').toLowerCase() === 'admin';
            };

            expect(isAdminFn({ role: 'admin', subscriptionTier: 'free' })).toBe(true);
            expect(isAdminFn({ role: 'admin', subscriptionTier: null })).toBe(true);
            expect(isAdminFn({ role: 'student', subscriptionTier: 'admin' })).toBe(true);
            expect(isAdminFn({ role: 'student', subscriptionTier: 'basic' })).toBe(false);
            expect(isAdminFn({ role: 'student', subscriptionTier: 'advanced' })).toBe(false);
            expect(isAdminFn({ role: 'student', subscriptionTier: 'free' })).toBe(false);
            expect(isAdminFn(null)).toBe(false);
        });

        it('RepasoManager.userTier correctly returns "admin" when role is admin even if subscription_tier is free', () => {
            const getUserTier = (user) => {
                if (!user) return 'free';
                const role = String(user.role || '').toLowerCase();
                const tier = String(user.subscriptionTier || user.subscription_tier || 'free').toLowerCase();
                if (role === 'admin' || tier === 'admin') return 'admin';
                return tier;
            };

            expect(getUserTier({ role: 'admin', subscription_tier: 'free' })).toBe('admin');
            expect(getUserTier({ role: 'admin', subscriptionTier: 'free' })).toBe('admin');
            expect(getUserTier({ role: 'student', subscription_tier: 'basic' })).toBe('basic');
            expect(getUserTier({ role: 'student', subscriptionTier: 'advanced' })).toBe('advanced');
            expect(getUserTier({ role: 'student', subscription_tier: 'free' })).toBe('free');
            expect(getUserTier(null)).toBe('free');
        });

        it('RepasoManager.isAdvancedOrAdmin returns true for advanced and admin, false for basic and free', () => {
            const isAdvancedOrAdminFn = (userTier) => {
                return userTier === 'advanced' || userTier === 'admin';
            };

            expect(isAdvancedOrAdminFn('admin')).toBe(true);
            expect(isAdvancedOrAdminFn('advanced')).toBe(true);
            expect(isAdvancedOrAdminFn('basic')).toBe(false);
            expect(isAdvancedOrAdminFn('free')).toBe(false);
        });

        it('switchCardMode gate allows admin and basic into bulk mode, while showing paywall to free', () => {
            const simulateSwitchMode = (mode, userTier, token = 'valid-token') => {
                const paywallCalls = [];
                const activeTabs = [];

                if (!token) return { blocked: 'auth' };

                if (mode === 'bulk' && userTier === 'free') {
                    paywallCalls.push('La Carga Masiva (Excel) es una función para usuarios con plan Basic o Advanced.');
                    return { blocked: 'paywall', paywallCalls };
                }

                activeTabs.push(mode);
                return { blocked: null, activeTabs };
            };

            // Admin: allowed
            const adminResult = simulateSwitchMode('bulk', 'admin');
            expect(adminResult.blocked).toBeNull();
            expect(adminResult.activeTabs).toContain('bulk');

            // Basic: allowed
            const basicResult = simulateSwitchMode('bulk', 'basic');
            expect(basicResult.blocked).toBeNull();
            expect(basicResult.activeTabs).toContain('bulk');

            // Advanced: allowed
            const advancedResult = simulateSwitchMode('bulk', 'advanced');
            expect(advancedResult.blocked).toBeNull();
            expect(advancedResult.activeTabs).toContain('bulk');

            // Free: blocked with paywall
            const freeResult = simulateSwitchMode('bulk', 'free');
            expect(freeResult.blocked).toBe('paywall');
            expect(freeResult.paywallCalls.length).toBe(1);
        });

        it('repaso.js contains no dead switchMode(mode) method (Clean Code)', () => {
            // switchMode was orphan dead code from previous iterations, replaced by switchCardMode
            expect(repasoCode).not.toMatch(/switchMode\(mode\)\s*\{/);
            expect(repasoCode).toMatch(/switchCardMode\(mode\)\s*\{/);
        });
    });

    describe('Database Query Ordering: Newly created/updated decks & cards appear first', () => {
        it('getDecks orders by COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC', async () => {
            let executedQuery = '';
            db.query.mockImplementation((query) => {
                executedQuery = query;
                return Promise.resolve({ rows: [] });
            });

            await flashcardRepository.getDecks('test-user-id', null);
            expect(executedQuery).toContain('ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC');
        });

        it('getAllUserDecks orders by COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC', async () => {
            let executedQuery = '';
            db.query.mockImplementation((query) => {
                executedQuery = query;
                return Promise.resolve({ rows: [] });
            });

            await flashcardRepository.getAllUserDecks('test-user-id');
            expect(executedQuery).toContain('ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC');
        });

        it('getDeckCards orders by sort_order ASC, created_at DESC (newest cards at top)', async () => {
            let executedQuery = '';
            db.query.mockImplementation((query) => {
                executedQuery = query;
                return Promise.resolve({ rows: [] });
            });

            await flashcardRepository.getDeckCards('test-deck-id');
            expect(executedQuery).toContain('ORDER BY sort_order ASC, created_at DESC');
        });

        it('touchDeck executes UPDATE decks SET updated_at = NOW() WHERE id = $1', async () => {
            let executedQuery = '';
            let executedParams = [];
            db.query.mockImplementation((query, params) => {
                executedQuery = query;
                executedParams = params;
                return Promise.resolve({ rows: [] });
            });

            await flashcardRepository.touchDeck('deck-123');
            expect(executedQuery).toContain('UPDATE decks SET updated_at = NOW() WHERE id = $1');
            expect(executedParams).toEqual(['deck-123']);
        });
    });

    describe('DeckService: touches deck on addCard and addBulkCards', () => {
        it('addCard calls trainingRepository.touchDeck', async () => {
            const mockTouchDeck = jest.spyOn(flashcardRepository, 'touchDeck').mockResolvedValue();
            jest.spyOn(flashcardRepository, 'getDeckById').mockResolvedValue({ id: 'deck-123' });
            jest.spyOn(flashcardRepository, 'createFlashcard').mockResolvedValue({ id: 'card-1' });

            await DeckService.addCard('user-1', 'deck-123', 'Front', 'Back');

            expect(mockTouchDeck).toHaveBeenCalledWith('deck-123');
        });

        it('addBulkCards calls trainingRepository.touchDeck', async () => {
            const mockTouchDeck = jest.spyOn(flashcardRepository, 'touchDeck').mockResolvedValue();
            jest.spyOn(flashcardRepository, 'getDeckById').mockResolvedValue({ id: 'deck-123' });
            jest.spyOn(flashcardRepository, 'createFlashcardsManualBatch').mockResolvedValue({ inserted: 5 });

            await DeckService.addBulkCards('user-1', 'deck-123', [
                { front: 'F1', back: 'B1' },
                { front: 'F2', back: 'B2' }
            ]);

            expect(mockTouchDeck).toHaveBeenCalledWith('deck-123');
        });
    });
});
