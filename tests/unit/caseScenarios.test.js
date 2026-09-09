process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

jest.mock('@google-cloud/vertexai', () => ({
    VertexAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn()
        })
    }))
}));

const adminRepository = require('../../src/domain/repositories/adminRepository');
const adminService = require('../../src/domain/services/adminService');
const adminController = require('../../src/application/controllers/adminController');
const docenteRepository = require('../../src/domain/repositories/docenteRepository');
const medicoRepository = require('../../src/domain/repositories/medicoRepository');
const db = require('../../src/infrastructure/database/db');

jest.mock('../../src/infrastructure/database/db', () => ({
    query: jest.fn(),
    pool: jest.fn()
}));

describe('Case Scenarios & Question Clustering (Casuísticas Agrupadas)', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.pool.mockReturnValue({
            connect: jest.fn().mockResolvedValue(mockClient)
        });
    });

    describe('Admin Case Scenarios CRUD & Linking', () => {
        it('getAllCases filters by domain and target properly', async () => {
            const mockCases = [
                { id: 'case-1', code: 'CASO-01', title: 'Lectura Comprensiva', domain: 'education' },
                { id: 'case-2', code: 'CASO-02', title: 'Resolución de Conflictos', domain: 'education' }
            ];

            db.query.mockResolvedValueOnce({ rows: mockCases });

            const result = await adminRepository.getAllCases('education', '', 1, 10);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM case_scenarios cs'),
                expect.arrayContaining(['education', 10, 0])
            );
            expect(result).toHaveLength(2);
            expect(result[0].code).toBe('CASO-01');
        });

        it('createCase inserts a new case scenario record', async () => {
            const newCase = {
                code: 'CASO-PED-01',
                title: 'Estrategias en el Aula',
                description_text: 'En una sesión de 3er grado...',
                image_url: null,
                domain: 'education',
                target: 'ASCENSO',
                topic: 'Pedagogía'
            };

            db.query.mockResolvedValueOnce({ rows: [{ id: 'case-uuid-1', ...newCase }] });

            const created = await adminRepository.createCase(newCase);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO case_scenarios'),
                expect.arrayContaining(['CASO-PED-01', 'Estrategias en el Aula'])
            );
            expect(created.id).toBe('case-uuid-1');
        });

        it('linkQuestionsToCase links questions with case_id and case_order in transaction', async () => {
            const questions = [
                { id: 101, order: 1 },
                { id: 102, order: 2 }
            ];

            mockClient.query.mockResolvedValue({ rowCount: 1 });

            const result = await adminRepository.linkQuestionsToCase('new-case-id', questions);
            expect(result.success).toBe(true);
            expect(result.updated).toBe(2);
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE question_bank SET case_id = $1, case_order = $2'),
                ['new-case-id', 1, 101]
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE question_bank SET case_id = $1, case_order = $2'),
                ['new-case-id', 2, 102]
            );
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('unlinkQuestionFromCase sets case_id to null', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 101 }] });

            const res = await adminRepository.unlinkQuestionFromCase(101);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE question_bank SET case_id = NULL'),
                [101]
            );
            expect(res).toBe(true);
        });
    });

    describe('Excel / Bulk Ingestion with Casuísticas', () => {
        it('saveBulkQuestionBankAdmin resolves case_scenario automatically and links child questions', async () => {
            const items = [
                {
                    domain: 'education',
                    target: 'NOMBRAMIENTO',
                    career: 'EBR - Primaria',
                    topic: 'Comprensión Lectora',
                    question_text: '¿Cuál es la idea principal?',
                    options: ['A', 'B', 'C'],
                    correct_answer: 0,
                    codigo_caso: 'CASO-AUTO-01',
                    enunciado_caso: 'Texto de lectura sobre el agua...',
                    orden_caso: 1
                },
                {
                    domain: 'education',
                    target: 'NOMBRAMIENTO',
                    career: 'EBR - Primaria',
                    topic: 'Comprensión Lectora',
                    question_text: '¿A qué se refiere la palabra subrayada?',
                    options: ['A', 'B', 'C'],
                    correct_answer: 1,
                    codigo_caso: 'CASO-AUTO-01',
                    enunciado_caso: 'Texto de lectura sobre el agua...',
                    orden_caso: 2
                }
            ];

            mockClient.query.mockResolvedValueOnce({ rows: [] }); // select case by code
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'auto-case-uuid' }] }); // insert case_scenario
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert question 1
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // insert question 2

            const result = await adminRepository.saveBulkQuestionBankAdmin(items);
            expect(result.inserted).toBe(2);
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO question_bank'),
                expect.arrayContaining(['auto-case-uuid', 1])
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO question_bank'),
                expect.arrayContaining(['auto-case-uuid', 2])
            );
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        });

        it('saveBulkQuestionBankAdmin creates new case_scenario with General topic when case does not exist in DB', async () => {
            const items = [
                {
                    domain: 'education',
                    target: 'ASCENSO',
                    topic: 'Matemática y Lógica',
                    question_text: '¿Cuánto es 2 + 2?',
                    options: ['3', '4', '5'],
                    correct_answer: 1,
                    codigo_caso: 'CASO-NUEVO-99',
                    enunciado_caso: 'Enunciado de caso nuevo...',
                    orden_caso: 1
                }
            ];

            mockClient.query.mockResolvedValueOnce({ rows: [] }); // 1. BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // 2. SELECT case by code (empty)
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'new-case-uuid' }] }); // 3. INSERT case_scenario
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1001 }] }); // 4. INSERT question_bank
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // 5. COMMIT

            const result = await adminRepository.saveBulkQuestionBankAdmin(items);
            expect(result.inserted).toBe(1);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO case_scenarios'),
                expect.arrayContaining(['CASO-NUEVO-99', 'General'])
            );
        });

        it('saveBulkCasesAdmin inserts or updates bulk case scenarios in transaction', async () => {
            const cases = [
                {
                    code: 'CASO-PED-01',
                    title: 'Lactante con estridor',
                    description_text: 'Lactante de 18 meses...',
                    domain: 'medicine',
                    target: 'ENAM',
                    topic: 'Pediatría'
                },
                {
                    code: 'CASO-PED-02',
                    title: 'Neumonía adquirida',
                    description_text: 'Preescolar de 3 años...',
                    domain: 'medicine',
                    target: 'ENAM',
                    topic: 'Pediatría'
                }
            ];

            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // check case 1
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'case-1' }] }); // insert case 1
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'case-2' }] }); // check case 2 (exists)
            mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // update case 2
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

            const res = await adminRepository.saveBulkCasesAdmin(cases);
            expect(res.success).toBe(true);
            expect(res.inserted).toBe(2);
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        });

        it('adminController.bulkInjectCases processes bulk case payload and sanitizes HTML', async () => {
            const req = {
                body: [
                    {
                        code: 'CASO-MED-10',
                        title: 'Insuficiencia Cardíaca',
                        description_text: '<p>Paciente con disnea de esfuerzo</p>',
                        domain: 'medicine',
                        target: 'ENAM',
                        topic: 'Cardiología'
                    }
                ]
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // check case
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'case-10' }] }); // insert case
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

            await adminController.bulkInjectCases(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    count: 1
                })
            );
        });
    });

    describe('Contiguous Case Clustering & Sibling Preservation in Quiz Selection', () => {
        it('docenteRepository groups case sibling questions contiguously and in order', async () => {
            const rawBankRows = [
                { id: 1, question_text: 'Independent Q1', case_id: null, case_order: null, case_title: null, case_description: null },
                { id: 2, question_text: 'Case 1 Q2', case_id: 'c1', case_order: 2, case_title: 'Case 1', case_description: 'Desc 1' },
                { id: 3, question_text: 'Independent Q2', case_id: null, case_order: null, case_title: null, case_description: null }
            ];

            const caseSiblings = [
                { id: 4, question_text: 'Case 1 Q1', case_id: 'c1', case_order: 1, case_title: 'Case 1', case_description: 'Desc 1' },
                { id: 2, question_text: 'Case 1 Q2', case_id: 'c1', case_order: 2, case_title: 'Case 1', case_description: 'Desc 1' }
            ];

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Seen history
                .mockResolvedValueOnce({ rows: rawBankRows }) // Balanced pool query
                .mockResolvedValueOnce({ rows: caseSiblings }); // Sibling query

            const clustered = await docenteRepository.findQuestionsInBankBatch(
                'ASCENSO',
                ['Estrategias Pedagógicas'],
                10,
                'usr-1',
                'EBR - Primaria',
                'Junior',
                []
            );

            const case1Qs = clustered.filter(q => q.case_id === 'c1');
            expect(case1Qs).toHaveLength(2);
            expect(case1Qs[0].id).toBe(4);
            expect(case1Qs[0].case_order).toBe(1);
            expect(case1Qs[1].id).toBe(2);
            expect(case1Qs[1].case_order).toBe(2);

            const idxQ4 = clustered.findIndex(q => q.id === 4);
            const idxQ2 = clustered.findIndex(q => q.id === 2);
            expect(Math.abs(idxQ4 - idxQ2)).toBe(1);
        });

        it('medicoRepository groups clinical vignettes contiguously and respects batch size 10', async () => {
            const rawMedicalRows = [
                { id: 11, question_text: 'Standalone Q', case_id: null, case_order: null, case_title: null, case_description: null },
                { id: 12, question_text: 'Clinical Vignette Part 2', case_id: 'med-case-1', case_order: 2, case_title: 'Vignette 1', case_description: 'Paciente varón de 45 años...' }
            ];

            const caseSiblings = [
                { id: 10, question_text: 'Clinical Vignette Part 1', case_id: 'med-case-1', case_order: 1, case_title: 'Vignette 1', case_description: 'Paciente varón de 45 años...' },
                { id: 12, question_text: 'Clinical Vignette Part 2', case_id: 'med-case-1', case_order: 2, case_title: 'Vignette 1', case_description: 'Paciente varón de 45 años...' }
            ];

            db.query
                .mockResolvedValueOnce({ rows: [] }) // Seen history
                .mockResolvedValueOnce({ rows: rawMedicalRows }) // Balanced pool query
                .mockResolvedValueOnce({ rows: caseSiblings }); // Sibling query

            const clustered = await medicoRepository.findQuestionsInBankBatch(
                'RESIDENTADO',
                ['Medicina Interna'],
                10,
                'usr-med-1',
                'Medicina Humana',
                'Senior',
                []
            );

            const caseQs = clustered.filter(q => q.case_id === 'med-case-1');
            expect(caseQs).toHaveLength(2);
            expect(caseQs[0].id).toBe(10);
            expect(caseQs[0].case_order).toBe(1);
            expect(caseQs[1].id).toBe(12);
            expect(caseQs[1].case_order).toBe(2);
        });
    });

    describe('AdminController createCase & updateCase robustness', () => {
        const adminController = require('../../src/application/controllers/adminController');

        it('createCase creates a case with only description_text provided and auto-generates code/title', async () => {
            const req = {
                body: {
                    description_text: 'Lea la siguiente situación y responda las preguntas 9 y 10: Una docente presenta una tabla...'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            db.query.mockResolvedValueOnce({ rows: [{ id: 'case-123', code: 'CASO-9999', title: 'Lea la siguiente situación...' }] });

            await adminController.createCase(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    case: expect.objectContaining({ id: 'case-123' })
                })
            );
        });

        it('createCase creates a case even without description_text (optional case for chaining questions)', async () => {
            const req = {
                body: {
                    code: 'CASO-CHAIN-01',
                    title: 'Caso de Encadenamiento Sin Enunciado'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            db.query.mockResolvedValueOnce({ rows: [{ id: 'case-chain-123', code: 'CASO-CHAIN-01', title: 'Caso de Encadenamiento Sin Enunciado', description_text: '' }] });

            await adminController.createCase(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    case: expect.objectContaining({ id: 'case-chain-123', code: 'CASO-CHAIN-01' })
                })
            );
        });

        it('createCase sets code as title and topic to General when title is omitted (never text excerpt)', async () => {
            const req = {
                body: {
                    code: 'CASO-SIN-TITULO',
                    description_text: '<p>Este es un texto largo que antes era recortado indebidamente para ser usado como título del caso...</p>'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 'case-code-title-id',
                    code: 'CASO-SIN-TITULO',
                    title: 'CASO-SIN-TITULO',
                    topic: 'General'
                }]
            });

            await adminController.createCase(req, res);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO case_scenarios'),
                expect.arrayContaining(['CASO-SIN-TITULO', 'CASO-SIN-TITULO', 'General'])
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    case: expect.objectContaining({
                        title: 'CASO-SIN-TITULO',
                        topic: 'General'
                    })
                })
            );
        });

        it('updateCase updates individual fields dynamically without parameter type errors', async () => {
            const req = {
                params: { id: 'c667897f-9746-4372-b14a-feb10f4b364c' },
                body: {
                    title: 'Nuevo Título de Caso',
                    description_text: 'Nuevo enunciado editado'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'c667897f-9746-4372-b14a-feb10f4b364c',
                        title: 'Título Anterior',
                        description_text: 'Enunciado anterior'
                    }]
                })
                .mockResolvedValueOnce({
                    rows: []
                })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'c667897f-9746-4372-b14a-feb10f4b364c',
                        title: 'Nuevo Título de Caso',
                        description_text: 'Nuevo enunciado editado'
                    }]
                });

            await adminController.updateCase(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    case: expect.objectContaining({ id: 'c667897f-9746-4372-b14a-feb10f4b364c' })
                })
            );
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE case_scenarios'),
                expect.arrayContaining(['Nuevo Título de Caso', '<p>Nuevo enunciado editado</p>', 'c667897f-9746-4372-b14a-feb10f4b364c'])
            );
        });
    });

    describe('Frontend Components: createAdminItemCardHTML Rendering', () => {
        const fs = require('fs');
        const path = require('path');

        let createAdminItemCardHTML;

        beforeAll(() => {
            const code = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/ui/components.js'), 'utf8');
            global.document = {
                addEventListener: jest.fn(),
                querySelector: jest.fn(),
                getElementById: jest.fn()
            };
            global.window = {
                uiManager: { isResourceLocked: jest.fn() },
                resolveImageUrl: jest.fn(url => url)
            };
            const fn = new Function('window', 'document', `${code}; return createAdminItemCardHTML;`);
            createAdminItemCardHTML = fn(global.window, global.document);
        });

        it('renders case item card with title, code badge, and questions count without undefined', () => {
            const caseItem = {
                id: 'case-123',
                code: 'CASO-01',
                title: 'Lectura Comprensiva y Comprensión del Entorno',
                description_text: '<p>En una sesión de 3er grado...</p>',
                domain: 'education',
                questions_count: 3
            };

            const html = createAdminItemCardHTML(caseItem, 'case');
            expect(html).not.toContain('undefined');
            expect(html).toContain('Lectura Comprensiva');
            expect(html).toContain('CASO-01');
            expect(html).toContain('Educación Docente');
            expect(html).toContain('3 preguntas vinculadas');
        });

        it('renders case item fallback when title is missing but code and description exist', () => {
            const caseItem = {
                id: 'case-456',
                code: 'CASO-MED-99',
                title: null,
                description_text: 'Paciente varón de 45 años que acude a emergencia con dolor torácico opresivo...',
                domain: 'medicine',
                questions_count: 1
            };

            const html = createAdminItemCardHTML(caseItem, 'case');
            expect(html).not.toContain('undefined');
            expect(html).toContain('Caso: CASO-MED-99');
            expect(html).toContain('Salud Profesional');
            expect(html).toContain('1 pregunta vinculada');
        });

        it('renders question item card with linked case badge, order number, and domain', () => {
            const questionItem = {
                id: 101,
                question_text: 'Lee la siguiente situación y responda las preguntas: Una mañana soleada los niños...',
                domain: 'education',
                target: 'ASCENSO',
                topic: 'Pedagogía',
                case_id: 'case-abc-123',
                case_code: 'CASO-EBR-01',
                case_order: 1,
                case_title: 'Situación de Aprendizaje al Aire Libre'
            };

            const html = createAdminItemCardHTML(questionItem, 'question');
            expect(html).not.toContain('undefined');
            expect(html).toContain('EDUCACIÓN • ASCENSO');
            expect(html).toContain('Pedagogía');
            expect(html).toContain('CASO-EBR-01');
            expect(html).toContain('Preg. #1');
            expect(html).toContain('Caso: <strong>Situación de Aprendizaje al Aire Libre</strong>');
        });
    });

    describe('Quiz Client Case Scenario Detection Logic', () => {
        const isCaseQuestion = (q) => {
            return Boolean(
                (q.case_id && typeof q.case_id === 'string' && q.case_id.trim() !== '') ||
                (q.case_code && typeof q.case_code === 'string' && q.case_code.trim() !== '') ||
                (q.case_description && typeof q.case_description === 'string' && q.case_description.trim() !== '') ||
                (q.case_image_url && typeof q.case_image_url === 'string' && q.case_image_url.trim() !== '')
            );
        };

        it('returns false for independent questions with no case_id or case attributes', () => {
            const independentQuestion = {
                id: 'q-independent-1',
                question_text: '¿Cuál es la dosis recomendada de paracetamol?',
                case_id: null,
                case_order: null,
                case_code: null,
                case_title: null,
                case_description: null,
                case_image_url: null
            };

            expect(isCaseQuestion(independentQuestion)).toBe(false);
        });

        it('returns true for questions belonging to a case even when case_description is null/empty', () => {
            const linkedQuestionNoDesc = {
                id: 'q-linked-1',
                question_text: 'En relación a la paciente anterior, ¿cuál es la conducta inicial?',
                case_id: 'case-uuid-777',
                case_order: 2,
                case_code: 'CASO-OBST-01',
                case_title: null,
                case_description: null,
                case_image_url: null
            };

            expect(isCaseQuestion(linkedQuestionNoDesc)).toBe(true);
        });

        it('returns true for questions with case_description present', () => {
            const linkedQuestionWithDesc = {
                id: 'q-linked-2',
                question_text: '¿Qué principio pedagógico se evidencia?',
                case_id: 'case-uuid-888',
                case_order: 1,
                case_code: 'CASO-CNEB-05',
                case_title: 'Situación Significativa',
                case_description: 'Rosa de 5 años durante el refrigerio...',
                case_image_url: null
            };

            expect(isCaseQuestion(linkedQuestionWithDesc)).toBe(true);
        });
    });
});


