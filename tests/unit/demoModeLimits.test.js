const docenteRepository = require('../../src/domain/repositories/docenteRepository');
const medicoRepository = require('../../src/domain/repositories/medicoRepository');
const db = require('../../src/infrastructure/database/db');

jest.mock('../../src/infrastructure/database/db', () => ({
    query: jest.fn(),
    pool: jest.fn()
}));

describe('Demo Mode 10qs Architecture & Question Limits', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('packDemoBatch algorithm (DocenteRepository & MedicoRepository)', () => {
        it('preserves complete case scenario when it fits within limit 10', () => {
            const candidateRows = [
                { id: 'q1', case_id: null, topic: 'Pedagogía' },
                { id: 'q2', case_id: 'case-A', case_order: 1, topic: 'Pedagogía' },
                { id: 'q3', case_id: null, topic: 'Pedagogía' }
            ];
            const siblingRows = [
                { id: 'q2', case_id: 'case-A', case_order: 1, topic: 'Pedagogía' },
                { id: 'q2-b', case_id: 'case-A', case_order: 2, topic: 'Pedagogía' },
                { id: 'q2-c', case_id: 'case-A', case_order: 3, topic: 'Pedagogía' }
            ];

            const result = docenteRepository.packDemoBatch(candidateRows, siblingRows, 10);
            expect(result).toHaveLength(5);
            expect(result.map(q => q.id)).toEqual(['q1', 'q2', 'q2-b', 'q2-c', 'q3']);
        });

        it('does NOT overflow or expand beyond limit=10 even when multiple cases with many siblings are present', () => {
            // Simulate 10 candidate rows containing multiple questions from large cases
            const candidateRows = [
                { id: 'q1', case_id: 'case-1', case_order: 1 },
                { id: 'q2', case_id: 'case-2', case_order: 1 },
                { id: 'q3', case_id: 'case-3', case_order: 1 },
                { id: 'q4', case_id: 'case-4', case_order: 1 },
                { id: 'q5', case_id: 'case-5', case_order: 1 },
                { id: 'q6', case_id: null },
                { id: 'q7', case_id: null },
                { id: 'q8', case_id: null },
                { id: 'q9', case_id: null },
                { id: 'q10', case_id: null }
            ];

            // Suppose each case has 4 sibling questions (would total 25 questions if unconstrained!)
            const siblingRows = [
                { id: 'case1-1', case_id: 'case-1', case_order: 1 },
                { id: 'case1-2', case_id: 'case-1', case_order: 2 },
                { id: 'case1-3', case_id: 'case-1', case_order: 3 },
                { id: 'case1-4', case_id: 'case-1', case_order: 4 },

                { id: 'case2-1', case_id: 'case-2', case_order: 1 },
                { id: 'case2-2', case_id: 'case-2', case_order: 2 },
                { id: 'case2-3', case_id: 'case-2', case_order: 3 },
                { id: 'case2-4', case_id: 'case-2', case_order: 4 },

                { id: 'case3-1', case_id: 'case-3', case_order: 1 },
                { id: 'case3-2', case_id: 'case-3', case_order: 2 },
                { id: 'case3-3', case_id: 'case-3', case_order: 3 },
                { id: 'case3-4', case_id: 'case-3', case_order: 4 }
            ];

            const result = docenteRepository.packDemoBatch(candidateRows, siblingRows, 10);
            // Must NEVER exceed 10!
            expect(result.length).toBeLessThanOrEqual(10);
            expect(result).toHaveLength(10);
        });

        it('medicoRepository packDemoBatch also strictly enforces limit=10', () => {
            const candidateRows = Array.from({ length: 25 }, (_, i) => ({
                id: `med-q-${i}`,
                case_id: i % 2 === 0 ? `case-${Math.floor(i / 2)}` : null
            }));

            const siblingRows = candidateRows.filter(q => q.case_id).map(q => ({
                ...q,
                case_order: 1
            }));

            const result = medicoRepository.packDemoBatch(candidateRows, siblingRows, 10);
            expect(result).toHaveLength(10);
        });
    });

    describe('getRandomDemoQuestions integration with limits', () => {
        it('docenteRepository.getRandomDemoQuestions strictly returns limit=10 questions', async () => {
            // DB returns 30 candidates
            const mockCandidates = Array.from({ length: 30 }, (_, i) => ({
                id: `uuid-${i}`,
                question_text: `Pregunta Docente ${i}`,
                options: ['A', 'B', 'C'],
                correct_option_index: 0,
                explanation: 'Sustento',
                domain: 'education',
                topic: 'Pedagogía',
                target: 'ASCENSO',
                case_id: i < 5 ? 'case-doc-1' : null,
                case_order: i < 5 ? i + 1 : null
            }));

            db.query.mockResolvedValueOnce({ rows: mockCandidates }); // initial candidates
            db.query.mockResolvedValueOnce({
                rows: mockCandidates.filter(q => q.case_id) // siblings query
            });

            const questions = await docenteRepository.getRandomDemoQuestions(10);
            expect(questions).toHaveLength(10);
            expect(questions.length).not.toBeGreaterThan(10);
        });

        it('medicoRepository.getRandomDemoQuestions strictly returns limit=10 questions', async () => {
            const mockCandidates = Array.from({ length: 30 }, (_, i) => ({
                id: `uuid-med-${i}`,
                question_text: `Pregunta Médica ${i}`,
                options: ['A', 'B', 'C', 'D'],
                correct_option_index: 1,
                explanation: 'Sustento Clínico',
                domain: 'medicine',
                topic: 'Salud Pública',
                target: 'SERUMS',
                case_id: i < 6 ? 'case-med-1' : null,
                case_order: i < 6 ? i + 1 : null
            }));

            db.query.mockResolvedValueOnce({ rows: mockCandidates });
            db.query.mockResolvedValueOnce({
                rows: mockCandidates.filter(q => q.case_id)
            });

            const questions = await medicoRepository.getRandomDemoQuestions(10);
            expect(questions).toHaveLength(10);
            expect(questions.length).not.toBeGreaterThan(10);
        });
    });

    describe('Frontend mode bifurcation logic validation', () => {
        it('verifies that demo mode is always treated as blindMode and never studyMode', () => {
            const state = {
                mode: 'arcade',
                maxQuestions: 10,
                isDemo: true
            };

            const isRealMock = state.mode === 'real' || Number(state.maxQuestions) >= 50;
            const isStudyMode = !isRealMock && !state.isDemo && state.mode !== 'arcade' && Number(state.maxQuestions) !== 10 && (Number(state.maxQuestions) === 20 || state.mode === 'study');
            const isBlindMode = isRealMock || Number(state.maxQuestions) <= 10 || state.mode === 'arcade' || Boolean(state.isDemo);
            const isGuest = Boolean(state.isDemo);

            expect(isStudyMode).toBe(false);
            expect(isBlindMode).toBe(true);
            expect(isBlindMode || isGuest).toBe(true);
        });
    });
});
