const path = require('path');
require('events').EventEmitter.defaultMaxListeners = 50;
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
const express = require('express');
const cors = require('cors');
const compression = require('compression');

class Server {
    constructor() {
        console.log('🚀 Inicializando Server (Restauración de Servicio)...');
        // Restart Trigger: Heatmap Fix
        this.app = express();
        this.port = process.env.PORT || 3000;
    }

    async setup() {
        this.setupGlobalErrorHandlers();
        await this.testDBConnection();
        this.configureMiddleware();
        this.configureStaticFiles();
        this.configureRoutes();
    }

    async testDBConnection() {
        try {
            // ✅ CORRECCIÓN: Importar 'db' aquí para asegurar que .env se haya cargado.
            const db = require('../database/db');

            // Producción usa ADC; el archivo local solo se admite en desarrollo/test.
            require('./googleCredentials').resolveGoogleAuthOptions('ServerAuth');

            // Realizar una consulta simple para verificar la conexión
            const client = await db.query('SELECT NOW()'); // query() ahora llama a getPool() internamente

            // ✅ CORRECCIÓN: Ahora que db.query devuelve el objeto de resultado completo, volvemos a usar client.rows[0].now
            console.log('💾 PostgreSQL conectado exitosamente. Hora del servidor de BD:', client.rows[0].now);
        } catch (error) {
            console.error('❌ Error al conectar con la base de datos PostgreSQL:', error.message);
            process.exit(1); // Detener la aplicación si no se puede conectar a la BD
        }
    }

    setupGlobalErrorHandlers() {
        // ✅ CATCH GLOBAL PARA ERRORES NO MANEJADOS
        process.on('uncaughtException', (error) => {
            console.error('💥 UNCAUGHT EXCEPTION:', error);
            console.error('💥 Stack:', error.stack);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
        });
    }

    configureMiddleware() {
        console.log('🔧 Configurando middleware...');

        // ✅ RENDIMIENTO Y SEO: Compresión Gzip/Deflate para respuestas rápidas y Core Web Vitals
        this.app.use(compression());

        // ✅ FIX: Habilitar trust proxy para Render (necesario para rate-limit)
        this.app.set('trust proxy', 1);
        this.app.disable('x-powered-by');

        // CSP inicia en report-only para medir compatibilidad con scripts inline/CDN.
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
            res.setHeader('Content-Security-Policy-Report-Only', [
                "default-src 'self'",
                "base-uri 'self'",
                "object-src 'none'",
                "frame-ancestors 'self'",
                "form-action 'self' https://accounts.google.com",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://accounts.google.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://accounts.google.com",
                "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://accounts.google.com",
                "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://accounts.google.com",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https: wss:",
                "media-src 'self' blob: https:",
                "frame-src 'self' https://accounts.google.com https://*.google.com https://*.youtube.com https://www.youtube-nocookie.com",
                "worker-src 'self' blob:"
            ].join('; '));
            if (process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
                res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            }
            next();
        });

        // ✅ CORS CONFIGURADO PARA VERCEL, DOMINIO PROPIO Y PREVISUALIZACIONES MÓVILES (EXPO)
        this.app.use(cors({
            origin: (origin, callback) => {
                const allowedOrigins = [
                    'http://localhost:3000',
                    'https://chatbot-tutor-uc.vercel.app',
                    'https://hubacademia.vercel.app',
                    'https://hubacademia.com',
                    'https://www.hubacademia.com'
                ];
                
                // Las peticiones sin origen (ej. apps móviles nativas, curl, postman) se permiten
                if (!origin) return callback(null, true);
                
                // Permitir orígenes locales para desarrollo y pruebas (Expo, etc.)
                const isLocal = origin.startsWith('http://localhost:') || 
                                origin.startsWith('http://127.0.0.1:') || 
                                /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin);
                                
                if (isLocal || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
            credentials: true
        }));

        // ✅ EXPRESS.JSON Y URLENCODED CON LÍMITE HOLGADO
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logs de telemetría sin body, prompt, token ni rawBody.
        this.app.use((req, res, next) => {
            if (req.method === 'POST' && req.path === '/api/chat') {
                console.log('📥 CHAT REQUEST', { method: req.method, path: req.path });
            }
            next();
        });
    }

    configureStaticFiles() {
        // ✅ Servir archivos estáticos con CACHÉ agresivo para assets inmutables
        const publicPath = path.join(__dirname, '../../presentation/public');

        // 1. Caché largo para recursos estáticos (CSS, JS, imágenes, fuentes) — 7 días
        this.app.use('/css', express.static(path.join(publicPath, 'css'), {
            maxAge: '7d',
            immutable: true
        }));
        this.app.use('/js', express.static(path.join(publicPath, 'js'), {
            maxAge: '7d',
            immutable: true
        }));
        this.app.use('/assets', express.static(path.join(publicPath, 'assets'), {
            maxAge: '30d',
            immutable: true
        }));

        // ✅ SEO: Servir robots.txt con tipo de contenido exacto
        this.app.get('/robots.txt', (req, res) => {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.sendFile(path.join(publicPath, 'robots.txt'));
        });

        // ✅ SEO: Servir sitemap.xml con tipo de contenido XML exacto
        this.app.get('/sitemap.xml', (req, res) => {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.sendFile(path.join(publicPath, 'sitemap.xml'));
        });

        // 2. Sin caché para HTML (siempre la versión más reciente)
        this.app.use(express.static(publicPath, {
            maxAge: 0,
            etag: true,
            lastModified: true
        }));

        // ✅ Servir favicon.ico desde la raíz del proyecto
        this.app.get('/favicon.ico', (req, res) => {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 días
            res.sendFile(path.join(__dirname, '../../../favicon.ico'));
        });
    }

    configureRoutes() {
        console.log('🔧 Configurando rutas...');
        // Importar y usar los enrutadores modulares
        const { globalApiLimiter } = require('./rateLimiters');
        const apiRoutes = require('../routes/apiRoutes');

        // ✅ HEALTH CHECK (Anti Cold Start)
        // Este endpoint es ultraligero y NO toca la base de datos.
        // Se usa para mantener el servidor "despierto" o verificar que responde.
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // ======================
        // 🔗 RUTAS API
        // ======================
        // Aplicar el limitador global a todas las rutas que comiencen con /api
        this.app.use('/api', globalApiLimiter);
        // ✅ REFACTORIZACIÓN: Registrar un único enrutador principal para /api.
        // apiRoutes.js ahora se encarga de delegar a authRoutes y chatRoutes.
        this.app.use('/api', apiRoutes);

        // ======================
        // 🌐 RUTAS FRONTEND
        // ======================
        // ✅ MEJORA: Rutas con "Clean URLs" (sin .html)
        const pages = [
            'login', 'admin', 'chat', 'dashboard',
            'pricing', 'privacy', 'terms', 'quiz', 'course', 'career', 'category',
            'profile', 'deck-editor', 'flashcards', 'repaso', 'simulator-dashboard',
            'simulators', 'resource', 'library'
        ];

        pages.forEach(page => {
            // Ruta Limpia (ej. /pricing)
            this.app.get(`/${page}`, (req, res) => {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.sendFile(path.join(__dirname, `../../presentation/public/${page}.html`));
            });
            // Soporte Legacy (ej. /pricing.html) - Opcional: Redirigir a limpia
            this.app.get(`/${page}.html`, (req, res) => {
                res.redirect(301, `/${page}`);
            });
        });

        // ✅ Ruta Raíz
        this.app.get('/', (req, res) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.sendFile(path.join(__dirname, '../../presentation/public/index.html'));
        });

        // Manejar rutas no encontradas (DEBE IR AL FINAL)
        this.app.get('*', (req, res) => {
            res.status(404).json({ error: 'Ruta no encontrada' });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('🚀 Servidor iniciado - DEBUG MODE');
            console.log(`📡 http://localhost:${this.port}`);
        });
    }
}


module.exports = Server;
// Iniciar servidor de forma asíncrona
if (require.main === module) {
    (async () => {
        const server = new Server();
        await server.setup();
        server.start();
    })();
}
