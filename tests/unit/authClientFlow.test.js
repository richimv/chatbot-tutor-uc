describe('Flujo de autenticación del cliente', () => {
    const futureToken = [
        'eyJhbGciOiJIUzI1NiJ9',
        Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
        'signature'
    ].join('.');

    beforeEach(() => {
        jest.resetModules();

        const storage = {};
        global.localStorage = {
            getItem: jest.fn(key => storage[key] ?? null),
            setItem: jest.fn((key, value) => { storage[key] = String(value); }),
            removeItem: jest.fn(key => { delete storage[key]; })
        };
        global.sessionStorage = { clear: jest.fn() };
        global.FormData = class FormData {};
        global.atob = value => Buffer.from(value, 'base64').toString('binary');
    });

    afterEach(() => {
        delete global.window;
        delete global.localStorage;
        delete global.sessionStorage;
        delete global.FormData;
        delete global.fetch;
        delete global.atob;
        delete global.AuthApiService;
    });

    test('syncGoogleUser envía el token recién emitido y no confía en id/email del body', async () => {
        const response = {
            ok: true,
            json: jest.fn().mockResolvedValue({ user: { id: 'local-user' } })
        };
        const getSession = jest.fn();
        const networkFetch = jest.fn().mockResolvedValue(response);

        global.window = {
            AppConfig: { API_URL: 'http://localhost:3000' },
            NetworkService: { fetch: networkFetch },
            supabaseClient: { auth: { getSession } }
        };

        const AuthApiService = require('../../src/presentation/public/js/services/authApiService.js');
        await AuthApiService.syncGoogleUser({
            id: 'supabase-user',
            email: 'persona@example.com',
            user_metadata: { full_name: 'Persona Prueba' }
        }, futureToken);

        expect(getSession).not.toHaveBeenCalled();
        expect(networkFetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/auth/sync',
            expect.objectContaining({
                method: 'POST',
                headers: { Authorization: `Bearer ${futureToken}` },
                body: JSON.stringify({ name: 'Persona Prueba' })
            })
        );
        expect(global.window.AuthApiService).toBe(AuthApiService);
    });

    test('NetworkService conserva Authorization explícito sin volver a consultar Supabase', async () => {
        const getValidToken = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        global.window = {
            AuthApiService: { getValidToken },
            sessionManager: null
        };

        require('../../src/presentation/public/js/services/networkService.js');
        await global.window.NetworkService.fetch('http://localhost:3000/api/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${futureToken}` },
            body: JSON.stringify({ name: 'Persona Prueba' })
        });

        expect(getValidToken).not.toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/auth/sync',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Bearer ${futureToken}`,
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    test.each(['SIGNED_IN', 'INITIAL_SESSION'])(
        'SessionManager entrega al sync el token del evento %s cuando requiere sincronización',
        async event => {
            let authStateCallback;
            const syncGoogleUser = jest.fn().mockResolvedValue({
                user: { id: 'local-user', email: 'persona@example.com' }
            });
            global.window = {
                AuthApiService: { syncGoogleUser },
                supabaseClient: {
                    auth: {
                        onAuthStateChange: jest.fn(callback => {
                            authStateCallback = callback;
                        })
                    }
                },
                location: { hash: '', pathname: '/' },
                history: { replaceState: jest.fn() }
            };

            require('../../src/presentation/public/js/sessionManager.js');
            const session = {
                access_token: futureToken,
                user: { id: 'supabase-user', email: 'persona@example.com' }
            };

            await authStateCallback(event, session);

            expect(syncGoogleUser).toHaveBeenCalledWith(session.user, futureToken);
            expect(global.localStorage.setItem).toHaveBeenCalledWith('authToken', futureToken);
            expect(global.window.sessionManager.getUser()).toEqual({
                id: 'local-user',
                email: 'persona@example.com',
                _isOptimistic: false
            });
        }
    );

    test('SessionManager actualiza el token renovado sin repetir /auth/sync', async () => {
        let authStateCallback;
        const syncGoogleUser = jest.fn();
        global.window = {
            AuthApiService: { syncGoogleUser },
            supabaseClient: {
                auth: {
                    onAuthStateChange: jest.fn(callback => {
                        authStateCallback = callback;
                    })
                }
            },
            location: { hash: '', pathname: '/' },
            history: { replaceState: jest.fn() }
        };

        require('../../src/presentation/public/js/sessionManager.js');
        await authStateCallback('TOKEN_REFRESHED', { access_token: futureToken });

        expect(global.localStorage.setItem).toHaveBeenCalledWith('authToken', futureToken);
        expect(syncGoogleUser).not.toHaveBeenCalled();
    });

    test('SessionManager limita eventos repetidos aunque el primer sync falle', async () => {
        let authStateCallback;
        const syncGoogleUser = jest.fn().mockRejectedValue(new Error('Servicio temporal'));
        global.window = {
            AuthApiService: { syncGoogleUser },
            supabaseClient: {
                auth: {
                    onAuthStateChange: jest.fn(callback => {
                        authStateCallback = callback;
                    })
                }
            },
            location: { hash: '', pathname: '/' },
            history: { replaceState: jest.fn() }
        };

        require('../../src/presentation/public/js/sessionManager.js');
        const session = {
            access_token: futureToken,
            user: { id: 'supabase-user', email: 'persona@example.com' }
        };

        await authStateCallback('SIGNED_IN', session);
        await authStateCallback('SIGNED_IN', session);

        expect(syncGoogleUser).toHaveBeenCalledTimes(1);
    });
});
