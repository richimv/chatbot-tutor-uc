const GoogleOneTapService = require('../../src/presentation/public/js/services/googleOneTapService.js');

describe('GoogleOneTapService - Pruebas Unitarias', () => {
    let mockStorage = {};
    let mockSupabaseClient;
    let mockGoogle;

    beforeEach(() => {
        mockStorage = {};
        GoogleOneTapService.isInitialized = false;

        global.localStorage = {
            getItem: jest.fn((key) => mockStorage[key] || null),
            setItem: jest.fn((key, val) => { mockStorage[key] = String(val); }),
            removeItem: jest.fn((key) => { delete mockStorage[key]; }),
            clear: jest.fn(() => { mockStorage = {}; }),
        };

        mockSupabaseClient = {
            auth: {
                signInWithIdToken: jest.fn().mockResolvedValue({
                    data: { session: { access_token: 'fake-jwt-token' } },
                    error: null
                })
            }
        };

        mockGoogle = {
            accounts: {
                id: {
                    initialize: jest.fn(),
                    prompt: jest.fn(),
                    cancel: jest.fn()
                }
            }
        };

        global.window = {
            AppConfig: {
                GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com'
            },
            supabaseClient: mockSupabaseClient,
            location: { hash: '', pathname: '/', origin: 'https://hubacademia.com' },
            sessionManager: {
                isLoggedIn: jest.fn().mockReturnValue(false),
                onStateChange: jest.fn()
            },
            _isAuthenticating: false
        };

        global.google = mockGoogle;
    });

    afterEach(() => {
        delete global.window;
        delete global.google;
        delete global.localStorage;
    });

    describe('getClientId()', () => {
        test('retorna el ID configurado en window.AppConfig', () => {
            expect(GoogleOneTapService.getClientId()).toBe('test-client-id.apps.googleusercontent.com');
        });

        test('retorna el ID por defecto si AppConfig no está disponible', () => {
            delete global.window.AppConfig;
            expect(GoogleOneTapService.getClientId()).toBe('244839077130-pmqphk8eu7j78qq9icc6folabo5437ga.apps.googleusercontent.com');
        });
    });

    describe('canPrompt()', () => {
        test('retorna false si ya existe authToken en localStorage', () => {
            mockStorage['authToken'] = 'existing-token';
            expect(GoogleOneTapService.canPrompt()).toBe(false);
        });

        test('retorna false si sessionManager indica que el usuario está logueado', () => {
            global.window.sessionManager.isLoggedIn.mockReturnValue(true);
            expect(GoogleOneTapService.canPrompt()).toBe(false);
        });

        test('retorna false si hay un flujo de autenticación en curso (_isAuthenticating)', () => {
            global.window._isAuthenticating = true;
            expect(GoogleOneTapService.canPrompt()).toBe(false);
        });

        test('retorna false si el hash de la URL contiene access_token o id_token', () => {
            global.window.location.hash = '#access_token=xyz&token_type=bearer';
            expect(GoogleOneTapService.canPrompt()).toBe(false);

            global.window.location.hash = '#id_token=xyz';
            expect(GoogleOneTapService.canPrompt()).toBe(false);
        });

        test('retorna false si el SDK de Google no está cargado', () => {
            delete global.google;
            expect(GoogleOneTapService.canPrompt()).toBe(false);
        });

        test('retorna true cuando no hay sesión activa, no hay flujo OAuth y Google está disponible', () => {
            expect(GoogleOneTapService.canPrompt()).toBe(true);
        });
    });

    describe('handleCredential()', () => {
        test('retorna false si la respuesta o credential es nula/vacía', async () => {
            const result1 = await GoogleOneTapService.handleCredential(null);
            const result2 = await GoogleOneTapService.handleCredential({});
            expect(result1).toBe(false);
            expect(result2).toBe(false);
            expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
        });

        test('autentica con Supabase y retorna true si la sesión se crea', async () => {
            const response = { credential: 'google-id-token-abc' };
            const result = await GoogleOneTapService.handleCredential(response);

            expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
                provider: 'google',
                token: 'google-id-token-abc'
            });
            expect(result).toBe(true);
        });

        test('captura errores de Supabase, restablece _isAuthenticating y retorna false', async () => {
            mockSupabaseClient.auth.signInWithIdToken.mockRejectedValue(new Error('Invalid token'));
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const response = { credential: 'invalid-token' };
            const result = await GoogleOneTapService.handleCredential(response);

            expect(result).toBe(false);
            expect(global.window._isAuthenticating).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });
    });

    describe('cancel()', () => {
        test('invoca google.accounts.id.cancel() de forma segura', () => {
            GoogleOneTapService.cancel();
            expect(mockGoogle.accounts.id.cancel).toHaveBeenCalled();
        });

        test('no produce excepciones si google es undefined', () => {
            delete global.google;
            expect(() => GoogleOneTapService.cancel()).not.toThrow();
        });
    });

    describe('initialize()', () => {
        test('inicializa google.accounts.id con configuración blindada (sin itp_support ni ux_mode popup)', () => {
            const success = GoogleOneTapService.initialize();

            expect(success).toBe(true);
            expect(mockGoogle.accounts.id.initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    client_id: 'test-client-id.apps.googleusercontent.com',
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    context: 'signin'
                })
            );

            // Verificar que NUNCA se pasa itp_support ni ux_mode popup
            const initArgs = mockGoogle.accounts.id.initialize.mock.calls[0][0];
            expect(initArgs.itp_support).toBeUndefined();
            expect(initArgs.ux_mode).toBeUndefined();

            // Verificar que prompt se invoca con un callback de notificación
            expect(mockGoogle.accounts.id.prompt).toHaveBeenCalledWith(expect.any(Function));
        });

        test('ejecuta momentListener de forma segura sin arrojar errores', () => {
            GoogleOneTapService.initialize();
            const promptCallback = mockGoogle.accounts.id.prompt.mock.calls[0][0];

            // Simular notificaciones
            expect(() => {
                promptCallback({ isNotDisplayed: () => true, getNotDisplayedReason: () => 'opt_out_or_no_session' });
                promptCallback({ isNotDisplayed: () => false, isSkippedMoment: () => true, getSkippedReason: () => 'user_cancel' });
                promptCallback({ isNotDisplayed: () => false, isSkippedMoment: () => false, isDismissedMoment: () => true });
            }).not.toThrow();
        });

        test('no inicializa repetidamente si ya fue inicializado', () => {
            GoogleOneTapService.initialize();
            GoogleOneTapService.initialize();
            expect(mockGoogle.accounts.id.initialize).toHaveBeenCalledTimes(1);
        });

        test('retorna false si canPrompt() evalúa a false', () => {
            mockStorage['authToken'] = 'active';
            const success = GoogleOneTapService.initialize();
            expect(success).toBe(false);
            expect(mockGoogle.accounts.id.initialize).not.toHaveBeenCalled();
        });
    });
});
