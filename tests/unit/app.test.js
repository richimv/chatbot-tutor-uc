/**
 * app.test.js
 * Pruebas unitarias para las funciones modulares y lógica de presentación de app.js
 */

describe('app.js Presentation Orchestrator', () => {
    let mockStorage = {};
    let appModule;

    afterEach(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        mockStorage = {};

        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(key => mockStorage[key] || null),
            setItem: jest.fn((key, value) => {
                mockStorage[key] = String(value);
            }),
            removeItem: jest.fn(key => {
                delete mockStorage[key];
            }),
            clear: jest.fn(() => {
                mockStorage = {};
            })
        };

        // Mock sessionStorage
        global.sessionStorage = {
            getItem: jest.fn(key => mockStorage[key] || null),
            setItem: jest.fn((key, value) => {
                mockStorage[key] = String(value);
            }),
            removeItem: jest.fn(key => {
                delete mockStorage[key];
            }),
            clear: jest.fn(() => {
                mockStorage = {};
            })
        };

        // Mock navigator
        global.navigator = {
            onLine: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        };

        // Mock window & AppConfig
        global.window = {
            location: {
                hostname: 'localhost',
                pathname: '/',
                search: '',
                href: 'http://localhost:3000/'
            },
            history: {
                replaceState: jest.fn()
            },
            AppConfig: {
                API_URL: 'http://localhost:3000'
            },
            NetworkService: {
                fetch: jest.fn()
            },
            addEventListener: jest.fn()
        };

        global.fetch = jest.fn().mockResolvedValue({ ok: true });

        // Mock document
        global.document = {
            getElementById: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => []),
            addEventListener: jest.fn(),
            createElement: jest.fn(() => ({
                setAttribute: jest.fn(),
                innerHTML: ''
            })),
            body: {
                addEventListener: jest.fn()
            }
        };

        jest.isolateModules(() => {
            appModule = require('../../src/presentation/public/js/app');
        });
    });

    describe('getTierBadgeConfig()', () => {
        test('debe retornar Plan Gratuito y tier-free para usuario nulo o indefinido', () => {
            const resultNull = appModule.getTierBadgeConfig(null);
            expect(resultNull).toEqual({
                tierLabel: 'Plan Gratuito',
                tierClass: 'tier-free'
            });

            const resultUndef = appModule.getTierBadgeConfig(undefined);
            expect(resultUndef).toEqual({
                tierLabel: 'Plan Gratuito',
                tierClass: 'tier-free'
            });
        });

        test('debe retornar Plan Gratuito si el estado de suscripción no es active', () => {
            const userPending = {
                subscriptionTier: 'advanced',
                subscriptionStatus: 'pending'
            };
            expect(appModule.getTierBadgeConfig(userPending)).toEqual({
                tierLabel: 'Plan Gratuito',
                tierClass: 'tier-free'
            });

            const userExpired = {
                subscriptionTier: 'pro',
                subscriptionStatus: 'expired'
            };
            expect(appModule.getTierBadgeConfig(userExpired)).toEqual({
                tierLabel: 'Plan Gratuito',
                tierClass: 'tier-free'
            });
        });

        test('debe retornar Plan Avanzado y tier-advanced para suscripción activa advanced/avanzado', () => {
            const userAdvanced = {
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active'
            };
            expect(appModule.getTierBadgeConfig(userAdvanced)).toEqual({
                tierLabel: 'Plan Avanzado',
                tierClass: 'tier-advanced'
            });

            const userAvanzado = {
                subscriptionTier: 'avanzado',
                subscriptionStatus: 'active'
            };
            expect(appModule.getTierBadgeConfig(userAvanzado)).toEqual({
                tierLabel: 'Plan Avanzado',
                tierClass: 'tier-advanced'
            });
        });

        test('debe retornar Plan Básico y tier-basic para suscripción activa basic', () => {
            const userBasic = {
                subscriptionTier: 'basic',
                subscriptionStatus: 'active'
            };
            expect(appModule.getTierBadgeConfig(userBasic)).toEqual({
                tierLabel: 'Plan Básico',
                tierClass: 'tier-basic'
            });
        });

        test('debe retornar Administrador y tier-admin para usuario con role admin', () => {
            const userAdmin = {
                role: 'admin',
                subscriptionTier: 'free',
                subscriptionStatus: 'pending'
            };
            expect(appModule.getTierBadgeConfig(userAdmin)).toEqual({
                tierLabel: 'Administrador',
                tierClass: 'tier-admin'
            });
        });

        test('debe retornar Plan Gratuito para cuentas con status pending o tier free', () => {
            const userPending = {
                subscriptionTier: 'basic',
                subscriptionStatus: 'pending'
            };
            expect(appModule.getTierBadgeConfig(userPending)).toEqual({
                tierLabel: 'Plan Gratuito',
                tierClass: 'tier-free'
            });
        });
    });

    describe('syncPendingSubmissions()', () => {
        test('no debe realizar peticiones si no hay token de autenticación activo', async () => {
            mockStorage['authToken'] = null;
            mockStorage['simulator_pending_submissions'] = JSON.stringify([
                { quizId: 'q-1', context: 'EDUCACION', payload: {} }
            ]);

            await appModule.syncPendingSubmissions();

            expect(global.window.NetworkService.fetch).not.toHaveBeenCalled();
        });

        test('no debe realizar peticiones si la lista de pendientes está vacía', async () => {
            mockStorage['authToken'] = 'valid-jwt-token';
            mockStorage['simulator_pending_submissions'] = '[]';

            await appModule.syncPendingSubmissions();

            expect(global.window.NetworkService.fetch).not.toHaveBeenCalled();
        });

        test('debe sincronizar simulacros de EDUCACION en /api/docente/submit', async () => {
            mockStorage['authToken'] = 'valid-jwt-token';
            mockStorage['simulator_pending_submissions'] = JSON.stringify([
                { quizId: 'doc-123', context: 'EDUCACION', payload: { score: 18 } }
            ]);

            global.window.NetworkService.fetch.mockResolvedValueOnce({ ok: true, status: 200 });

            await appModule.syncPendingSubmissions();

            expect(global.window.NetworkService.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/docente/submit',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ score: 18 })
                })
            );

            // Al ser exitoso, la lista guardada debe quedar vacía
            expect(mockStorage['simulator_pending_submissions']).toBe('[]');
        });

        test('debe sincronizar simulacros de MEDICINA en /api/medico/submit', async () => {
            mockStorage['authToken'] = 'valid-jwt-token';
            mockStorage['simulator_pending_submissions'] = JSON.stringify([
                { quizId: 'med-456', context: 'MEDICINA', payload: { score: 15 } }
            ]);

            global.window.NetworkService.fetch.mockResolvedValueOnce({ ok: true, status: 200 });

            await appModule.syncPendingSubmissions();

            expect(global.window.NetworkService.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/medico/submit',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ score: 15 })
                })
            );

            expect(mockStorage['simulator_pending_submissions']).toBe('[]');
        });

        test('debe retener los ítems fallidos para reintento posterior', async () => {
            mockStorage['authToken'] = 'valid-jwt-token';
            const pendingItem = { quizId: 'fail-1', context: 'EDUCACION', payload: { score: 10 } };
            mockStorage['simulator_pending_submissions'] = JSON.stringify([pendingItem]);

            global.window.NetworkService.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

            await appModule.syncPendingSubmissions();

            const saved = JSON.parse(mockStorage['simulator_pending_submissions']);
            expect(saved).toHaveLength(1);
            expect(saved[0].quizId).toBe('fail-1');
        });
    });

    describe('initTrafficTracking()', () => {
        test('debe enviar el token actual sin activar el interceptor global', async () => {
            mockStorage['authToken'] = 'jwt-token';
            jest.useFakeTimers();

            appModule.initTrafficTracking();
            await jest.advanceTimersByTimeAsync(5000);

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/analytics/pulse',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer jwt-token'
                    }),
                    credentials: 'include'
                })
            );
            expect(global.window.NetworkService.fetch).not.toHaveBeenCalled();
        });
    });

    describe('updateHeaderUI()', () => {
        test('debe renderizar el botón Acceder si el usuario es null', () => {
            const mockContainer = { innerHTML: '' };
            global.document.getElementById.mockReturnValue(mockContainer);

            appModule.updateHeaderUI(null);

            expect(mockContainer.innerHTML).toContain('open-login-modal');
            expect(mockContainer.innerHTML).toContain('Acceder');
        });

        test('debe renderizar el avatar, nombre, badge y dropdown si el usuario está autenticado', () => {
            const mockContainer = {
                innerHTML: '',
                contains: jest.fn(() => false)
            };
            const mockToggle = { onclick: null };
            const mockDropdown = { style: { display: 'none' } };
            const mockLogout = { onclick: null };

            global.document.getElementById.mockImplementation(id => {
                if (id === 'user-session-controls') return mockContainer;
                if (id === 'user-menu-toggle') return mockToggle;
                if (id === 'user-menu-dropdown') return mockDropdown;
                if (id === 'logout-btn-action') return mockLogout;
                return null;
            });

            const user = {
                name: 'Carlos Docente',
                email: 'carlos@example.com',
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active',
                role: 'admin'
            };

            appModule.updateHeaderUI(user);

            expect(mockContainer.innerHTML).toContain('Carlos Docente');
            expect(mockContainer.innerHTML).toContain('carlos@example.com');
            expect(mockContainer.innerHTML).toContain('Plan Avanzado');
            expect(mockContainer.innerHTML).toContain('tier-advanced');
            expect(mockContainer.innerHTML).toContain('/admin'); // Role admin panel
            expect(mockContainer.innerHTML).toContain('logout-btn-action');
        });
    });
});
