const express = require('express');
const cors = require('cors');
const path = require('path');

class Server {
    constructor() {
        console.log('🚀 Inicializando Server...');
        
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
            // Realizar una consulta simple para verificar la conexión
            const client = await db.query('SELECT NOW()'); // query() ahora llama a getPool() internamente

            // ✅ SOLUCIÓN DEFINITIVA: Asegurar que la extensión 'unaccent' exista.
            // Esto garantiza que la función esté disponible para todas las conexiones del pool.
            await db.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
            console.log('🔧 Extensión "unaccent" verificada.');
            // ✅ SOLUCIÓN CRÍTICA: Habilitar la extensión para búsquedas con tolerancia a errores (fuzzy search).
            await db.query('CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch"');
            console.log('🔧 Extensión "fuzzystrmatch" (para Levenshtein) verificada.');

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
        
        // ✅ CORS SIMPLIFICADO
        this.app.use(cors());
        
        // ✅ EXPRESS.JSON MÍNIMO Y SEGURO
        this.app.use(express.json({
            limit: '1mb',
            verify: (req, res, buf) => {
                req.rawBody = buf.toString();
            }
        }));
        
        // ✅ MIDDLEWARE DE LOG SIMPLIFICADO
        this.app.use((req, res, next) => {
            if (req.method === 'POST' && req.path === '/api/chat') {
                console.log('📥 CHAT REQUEST:', {
                    method: req.method,
                    path: req.path,
                    body: req.body,
                    rawBody: req.rawBody
                });
            }
            next();
        });
    }

    configureStaticFiles() {
        // ✅ Servir archivos estáticos (CSS, JS, imágenes) desde la carpeta 'public'
        this.app.use(express.static(path.join(__dirname, '../../presentation/public')));
    }

    configureRoutes() {
         console.log('🔧 Configurando rutas...');
        // Importar y usar los enrutadores modulares
        const { globalApiLimiter, authLimiter } = require('./rateLimiters');
        const apiRoutes = require('./apiRoutes');
        const authRoutes = require('../../presentation/routes/authRoutes');

        // ======================
        // 🔗 RUTAS API
        // ======================
        // Aplicar el limitador global a todas las rutas que comiencen con /api
        this.app.use('/api', globalApiLimiter);
        this.app.use('/api', apiRoutes); // Las rutas generales de la API

        // Aplicar el limitador más estricto específicamente a las rutas de autenticación
        this.app.use('/api/auth', authLimiter, authRoutes);

        // ======================
        // 🌐 RUTAS FRONTEND
        // ======================
        // ✅ MEJORA DE ESTRUCTURA: Servir archivos HTML desde la carpeta 'views'.
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/views/index.html'));
        });

        this.app.get('/login.html', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/views/login.html'));
        });

        this.app.get('/register.html', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/views/register.html'));
        });

        this.app.get('/admin.html', (req, res) => {
            // Aquí podrías añadir un middleware de 'auth' para proteger la ruta de admin.
            res.sendFile(path.join(__dirname, '../../presentation/views/admin.html'));
        });

        // Ruta para servir el componente de chat
        this.app.get('/chat.html', (req, res) => {
            res.sendFile(path.join(__dirname, '../../presentation/views/chat.html'));
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