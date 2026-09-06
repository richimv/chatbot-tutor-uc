const checkAILimits = require('../../src/application/middlewares/checkLimitsMiddleware');
const pool = require('../../src/infrastructure/database/db');

// Mock database pool
jest.mock('../../src/infrastructure/database/db');

describe('Check Limits Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let dbUser;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            user: { id: 1 },
            body: {},
            path: '',
            originalUrl: ''
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();

        const todayPer = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });

        // Default mock user
        dbUser = {
            subscription_tier: 'free',
            subscription_status: 'pending',
            usage_count: 5,
            max_free_limit: 10,
            daily_ai_usage: 0,
            last_usage_reset: todayPer,
            last_free_renewal: new Date().toISOString() // Avoid weekly reset block in middleware
        };

        pool.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT') && sql.includes('subscription_tier')) {
                return { rows: [dbUser] };
            }
            if (sql.includes('SELECT') && sql.includes('last_free_renewal')) {
                return { rows: [{ usage_count: dbUser.usage_count, last_free_renewal: dbUser.last_free_renewal }] };
            }
            return { rows: [] };
        });
    });

    it('should set req.usageType to null and req.cost to 0 for chat_standard (General Chat zero consumption)', async () => {
        dbUser.subscription_tier = 'free';
        dbUser.usage_count = 10; // Exhausted lives

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBeNull();
        expect(mockReq.cost).toBe(0);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set req.usageType to null for active basic user in chat_standard', async () => {
        dbUser.subscription_tier = 'basic';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 50; // Max usage

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBeNull();
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set req.usageType to null for active advanced user in chat_standard', async () => {
        dbUser.subscription_tier = 'advanced';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 100;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBeNull();
        expect(mockNext).toHaveBeenCalled();
    });

    it('should enforce limits for monthly_flashcards for free user with lives exhausted', async () => {
        mockReq.path = '/generate';
        dbUser.subscription_tier = 'free';
        dbUser.usage_count = 10;

        const middleware = checkAILimits('monthly_flashcards');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should charge 1 life for free user with remaining lives in monthly_flashcards', async () => {
        mockReq.path = '/create';
        dbUser.subscription_tier = 'free';
        dbUser.usage_count = 5;

        const middleware = checkAILimits('monthly_flashcards');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBe('usage_count');
        expect(mockNext).toHaveBeenCalled();
    });

    it('should allow Basic active user in Quiz/Repaso tutor without RAG and consume daily_ai_usage', async () => {
        mockReq.body = { context: { type: 'quiz_tutor' } };
        dbUser.subscription_tier = 'basic';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 10;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBe('daily_ai_usage');
        expect(mockReq.useRag).toBe(false);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should block Basic active user in Quiz/Repaso tutor when daily_ai_usage reaches 50', async () => {
        mockReq.body = { context: { type: 'flashcard_tutor' } };
        dbUser.subscription_tier = 'basic';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 50;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Advanced active user in Quiz tutor with RAG when under 25 daily_rag_usage', async () => {
        mockReq.body = { context: { type: 'quiz_tutor' } };
        dbUser.subscription_tier = 'advanced';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 10;
        dbUser.daily_rag_usage = 5;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBe('daily_ai_usage');
        expect(mockReq.useRag).toBe(true);
        expect(mockReq.incrementRag).toBe(true);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should allow Advanced user in Flashcard tutor without consuming daily_rag_usage', async () => {
        mockReq.body = { context: { type: 'flashcard_tutor' } };
        dbUser.subscription_tier = 'advanced';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 10;
        dbUser.daily_rag_usage = 5;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBe('daily_ai_usage');
        expect(mockReq.useRag).toBe(false);
        expect(mockReq.incrementRag).toBe(false);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should fallback Advanced user to non-RAG in Quiz tutor when daily_rag_usage reaches 25', async () => {
        mockReq.body = { context: { type: 'quiz_tutor' } };
        dbUser.subscription_tier = 'advanced';
        dbUser.subscription_status = 'active';
        dbUser.daily_ai_usage = 30;
        dbUser.daily_rag_usage = 25;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockReq.usageType).toBe('daily_ai_usage');
        expect(mockReq.useRag).toBe(false);
        expect(mockReq.incrementRag).toBe(false);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should block Free Pending user in Quiz/Repaso tutor when lives are exhausted', async () => {
        mockReq.body = { context: { type: 'quiz_tutor' } };
        dbUser.subscription_tier = 'free';
        dbUser.subscription_status = 'pending';
        dbUser.usage_count = 10;

        const middleware = checkAILimits('chat_standard');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
    });

    describe('AI Diagnostic Routing & Quotas (/api/analytics/diagnostic)', () => {
        it('should charge 1 life (usage_count) for Free users with remaining lives requesting diagnostic', async () => {
            mockReq.path = '/api/analytics/diagnostic';
            dbUser.subscription_tier = 'free';
            dbUser.subscription_status = 'pending';
            dbUser.usage_count = 5;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageType).toBe('usage_count');
            expect(mockReq.cost).toBe(1);
            expect(mockReq.fallbackToStatic).toBe(true);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should block Free users requesting diagnostic when all 10 lives are exhausted', async () => {
            mockReq.path = '/api/analytics/diagnostic';
            dbUser.subscription_tier = 'free';
            dbUser.subscription_status = 'pending';
            dbUser.usage_count = 10;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should NOT charge tokens for Basic active users requesting diagnostic (heuristic static fallback)', async () => {
            mockReq.path = '/api/analytics/diagnostic';
            dbUser.subscription_tier = 'basic';
            dbUser.subscription_status = 'active';
            dbUser.daily_ai_usage = 10;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageType).toBeNull();
            expect(mockReq.cost).toBe(0);
            expect(mockReq.fallbackToStatic).toBe(true);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should charge 1 daily_ai_usage for Advanced active users requesting diagnostic with Gemini', async () => {
            mockReq.path = '/api/analytics/diagnostic';
            dbUser.subscription_tier = 'advanced';
            dbUser.subscription_status = 'active';
            dbUser.daily_ai_usage = 10;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageType).toBe('daily_ai_usage');
            expect(mockReq.cost).toBe(1);
            expect(mockReq.fallbackToStatic).toBeUndefined();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should fallback to static heuristic without error for Advanced users when daily_ai_usage is exhausted (100)', async () => {
            mockReq.path = '/api/analytics/diagnostic';
            dbUser.subscription_tier = 'advanced';
            dbUser.subscription_status = 'active';
            dbUser.daily_ai_usage = 100;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.usageType).toBeNull();
            expect(mockReq.cost).toBe(0);
            expect(mockReq.fallbackToStatic).toBe(true);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Admin Privileges and RAG Access', () => {
        it('should activate RAG for Admin even if subscription_tier is free or status is pending in Quiz Tutor', async () => {
            mockReq.body = { context: { type: 'quiz_tutor' } };
            dbUser.role = 'admin';
            dbUser.subscription_tier = 'free';
            dbUser.subscription_status = 'pending';
            dbUser.daily_ai_usage = 0;
            dbUser.daily_rag_usage = 0;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.userTier).toBe('admin');
            expect(mockReq.useRag).toBe(true);
            expect(mockReq.incrementRag).toBe(false);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should NOT block Admin when daily_ai_usage exceeds standard limit and keep RAG active', async () => {
            mockReq.body = { context: { type: 'quiz_tutor' } };
            dbUser.role = 'admin';
            dbUser.subscription_tier = 'admin';
            dbUser.subscription_status = 'active';
            dbUser.daily_ai_usage = 500; // Well above standard 100
            dbUser.daily_rag_usage = 100;

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.userTier).toBe('admin');
            expect(mockReq.useRag).toBe(true);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalledWith(403);
        });

        it('should keep Flashcard Tutor without RAG for Admin (0% Pinecone pollution)', async () => {
            mockReq.body = { context: { type: 'flashcard_tutor' } };
            dbUser.role = 'admin';
            dbUser.subscription_tier = 'admin';
            dbUser.subscription_status = 'active';

            const middleware = checkAILimits('chat_standard');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.userTier).toBe('admin');
            expect(mockReq.useRag).toBe(false);
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
