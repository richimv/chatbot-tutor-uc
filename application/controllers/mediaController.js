const { Storage } = require('@google-cloud/storage');
const path = require('path');
const db = require('../../infrastructure/database/db');

class MediaController {
    constructor() {
        this.storage = new Storage({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        this.bucketName = process.env.GCS_BUCKET_NAME || 'chatbot-tutor-medical-images';
    }

    /**
     * Proxy para servir imágenes de explicaciones médicas desde GCS.
     * GET /api/media/explanation/:id
     */
    async serveExplanationImage(req, res) {
        try {
            const { id } = req.params;

            // ✅ VALIDACIÓN: Evitar error de PostgreSQL si el ID no es un UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return res.status(400).send('ID de pregunta inválido (Debe ser un UUID válido).');
            }

            // 1. Buscar la URL en la base de datos
            const result = await db.query('SELECT explanation_image_url FROM question_bank WHERE id = $1', [id]);
            
            if (result.rows.length === 0 || !result.rows[0].explanation_image_url) {
                return res.status(404).send('Imagen no encontrada o no asignada.');
            }

            const imageUrl = result.rows[0].explanation_image_url;

            // 2. Si es una URL externa (http), redirigir o proxy simple
            if (imageUrl.startsWith('http')) {
                return res.redirect(imageUrl);
            }

            // 3. Si es una ruta de GCS (ej: 'explanations/image.png')
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(imageUrl);

            const [exists] = await file.exists();
            if (!exists) {
                console.error(`❌ Archivo GCS no encontrado: ${imageUrl} en bucket ${this.bucketName}`);
                return res.status(404).send('Archivo no encontrado en el almacenamiento.');
            }

            // Detectar Content-Type básico
            const ext = path.extname(imageUrl).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache persistente por seguridad y velocidad

            // Pipe el stream directo al cliente
            file.createReadStream()
                .on('error', (err) => {
                    console.error('Error streaming from GCS:', err);
                    res.status(500).send('Error al procesar la imagen.');
                })
                .pipe(res);

        } catch (error) {
            console.error('❌ Error en el Proxy de Medios:', error);
            res.status(500).send('Error interno del servidor.');
        }
    }

    /**
     * Proxy para servir imágenes de Recursos (Infografías)
     * GET /api/media/resource/:id
     */
    async serveResourceImage(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user ? req.user.id : null;

            // 1. Buscar recurso y verificar si es gratuito o premium
            const resData = await db.query('SELECT image_url, is_premium FROM resources WHERE id = $1', [id]);

            if (resData.rows.length === 0 || !resData.rows[0].image_url) {
                return res.status(404).send('Recurso no encontrado.');
            }

            const { image_url, is_premium } = resData.rows[0];

            // 2. Validación de acceso (Solo si es Premium)
            if (is_premium) {
                if (!userId) return res.status(401).send('Se requiere autenticación para ver este recurso premium.');
                
                const userRes = await db.query('SELECT subscription_status FROM users WHERE id = $1', [userId]);
                const status = userRes.rows[0]?.subscription_status;

                if (status !== 'active') {
                    return res.status(403).send('Este recurso es exclusivo para usuarios Premium.');
                }
            }

            // 3. Servir desde GCS (Misma lógica que explicación)
            if (image_url.startsWith('http')) {
                return res.redirect(image_url);
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(image_url);

            const [exists] = await file.exists();
            if (!exists) return res.status(404).send('Imagen de recurso no encontrada.');

            const ext = path.extname(image_url).toLowerCase();
            res.setHeader('Content-Type', ext === '.png' ? 'image/png' : 'image/jpeg');
            
            file.createReadStream().pipe(res);

        } catch (error) {
            console.error('❌ Error sirviendo imagen de recurso:', error);
            res.status(500).send('Error interno.');
        }
    }
}

module.exports = new MediaController();
