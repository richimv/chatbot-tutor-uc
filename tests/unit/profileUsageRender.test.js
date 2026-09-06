/**
 * @file profileUsageRender.test.js
 * Pruebas unitarias para el renderizado de cuotas de uso en el perfil (Basic, Advanced, Free, Admin).
 */

describe('Profile Usage Rendering', () => {
    let mockContainer;
    let mockCard;
    let mockPlanTag;
    let mockTitle;
    let mockSubtitle;
    let profileModule;

    beforeEach(() => {
        mockContainer = { innerHTML: '' };
        mockCard = { style: {} };
        mockPlanTag = { textContent: '' };
        mockTitle = { textContent: '' };
        mockSubtitle = { textContent: '' };

        global.document = {
            getElementById: jest.fn((id) => {
                switch (id) {
                    case 'premium-usage-container':
                        return mockContainer;
                    case 'premium-usage-card':
                        return mockCard;
                    case 'usage-plan-tag':
                        return mockPlanTag;
                    case 'usage-section-title':
                        return mockTitle;
                    case 'usage-section-subtitle':
                        return mockSubtitle;
                    default:
                        return { addEventListener: jest.fn(), style: {}, replaceChildren: jest.fn() };
                }
            }),
            addEventListener: jest.fn(),
            createElement: jest.fn(() => ({
                setAttribute: jest.fn(),
                addEventListener: jest.fn(),
                style: {}
            }))
        };

        global.window = {
            sessionManager: {
                initialize: jest.fn(),
                getUser: jest.fn()
            },
            location: { href: '' }
        };

        jest.isolateModules(() => {
            profileModule = require('../../src/presentation/public/js/profile');
        });
    });

    test('createUsageCardHTML debe retornar un string HTML valido con titulo, valores y porcentaje', () => {
        const html = profileModule.createUsageCardHTML({
            title: 'Tutor de IA Est\u00e1ndar',
            colorHex: '#3b82f6',
            badge: 'Diario',
            countVal: '15 / 50',
            percentage: 30,
            labelLeft: 'Interacciones con Tutor IA',
            labelRight: 'Disponibles: 35'
        });

        expect(typeof html).toBe('string');
        expect(html).toContain('Tutor de IA');
        expect(html).toContain('15 / 50');
        expect(html).toContain('width: 30%');
        expect(html).toContain('Disponibles: 35');
    });

    test('renderUsageDetails debe renderizar metricas para usuario con Plan Basic sin lanzar ReferenceError', () => {
        const userBasic = {
            subscriptionTier: 'basic',
            subscriptionStatus: 'active',
            dailyAiUsage: 12,
            dailySimulatorUsage: 3,
            limits: {
                chat_standard: 50,
                simulator: 15
            }
        };

        expect(() => profileModule.renderUsageDetails(userBasic)).not.toThrow();
        expect(mockTitle.textContent).toBe('Consumo de Servicios IA');
        expect(mockPlanTag.textContent).toBe('PLAN BASIC');
        expect(mockContainer.innerHTML).toContain('Tutor de IA');
        expect(mockContainer.innerHTML).toContain('Simulacros');
        expect(mockContainer.innerHTML).not.toContain('Consultas RAG Especializadas');
        expect(mockContainer.innerHTML).not.toContain('Generador de Flashcards');
    });

    test('renderUsageDetails debe renderizar metricas completas para usuario con Plan Advanced', () => {
        const userAdvanced = {
            subscriptionTier: 'advanced',
            subscriptionStatus: 'active',
            dailyAiUsage: 25,
            dailyRagUsage: 5,
            dailySimulatorUsage: 10,
            monthlyFlashcardsUsage: 8,
            limits: {
                chat_standard: 100,
                daily_rag_limit: 25,
                simulator: 50,
                monthly_flashcards: 30
            }
        };

        expect(() => profileModule.renderUsageDetails(userAdvanced)).not.toThrow();
        expect(mockTitle.textContent).toBe('Consumo de Servicios IA');
        expect(mockPlanTag.textContent).toBe('PLAN ADVANCED');
        expect(mockContainer.innerHTML).toContain('Tutor de IA');
        expect(mockContainer.innerHTML).toContain('Consultas RAG Especializadas');
        expect(mockContainer.innerHTML).toContain('Simulacros');
        expect(mockContainer.innerHTML).toContain('Generador de Flashcards');
        expect(mockContainer.innerHTML).toContain('5 / 25');
    });

    test('renderUsageDetails debe renderizar acceso ilimitado para Administrador', () => {
        const userAdmin = {
            role: 'admin',
            subscriptionTier: 'free',
            subscriptionStatus: 'pending'
        };

        profileModule.renderUsageDetails(userAdmin);
        expect(mockTitle.textContent).toBe('Acceso de Administrador');
        expect(mockContainer.innerHTML).toContain('Acceso Ilimitado de Administrador');
    });

    test('renderUsageDetails debe renderizar creditos de vidas semanales para usuario Plan Gratuito', () => {
        const userFree = {
            subscriptionTier: 'free',
            subscriptionStatus: 'pending',
            usageCount: 4,
            maxFreeLimit: 10
        };

        profileModule.renderUsageDetails(userFree);
        expect(mockTitle.textContent).toContain('Vidas Semanales');
        expect(mockPlanTag.textContent).toBe('PLAN GRATUITO');
        expect(mockContainer.innerHTML).toContain('Disponibles');
        expect(mockContainer.innerHTML).toContain('6 / 10');
    });
});
