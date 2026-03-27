const { Storage } = require('@google-cloud/storage');
const path = require('path');
const sharp = require('sharp'); // ✅ NUEVO: Procesamiento de imágenes
const db = require('../../infrastructure/database/db');

class MediaController {
    constructor() {
        this.storage = new Storage({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        this.bucketName = process.env.GCS_BUCKET_NAME || 'chatbot-tutor-medical-images';
    }

    /**
     * ✅ NUEVO: Optimiza un buffer de imagen y lo convierte a WebP.
     */
    async _optimizeImage(buffer) {
        try {
            return await sharp(buffer)
                .resize({ width: 1600, withoutEnlargement: true }) // ✅ MEJORA: Aumentado de 1200 a 1600 para mayor detalle
                .webp({ 
                    quality: 85, // ✅ MEJORA: Calidad superior a 80
                    smartSubsampling: true // ✅ MEJORA: Bordes más nítidos para texto y diagramas
                })
                .withMetadata() // ✅ MEJORA: Preservar perfiles de color y orientación
                .toBuffer();
        } catch (error) {
            console.error('❌ Error optimizando imagen con Sharp:', error);
            return buffer; // Fallback al original si falla
        }
    }

    /**
     * Sube un archivo a GCS con optimización automática a WebP.
     * Retorna su ruta relativa (ej: 'explanations/nombre.webp')
     */
    async uploadFile(file, folder = 'explanations', optimize = true) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            
            let buffer = file.buffer;
            let fileName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            let contentType = file.mimetype;

            // ✅ OPTIMIZACIÓN A WEBP
            if (optimize && contentType.startsWith('image/')) {
                buffer = await this._optimizeImage(buffer);
                // Cambiar extensión a .webp
                const baseName = path.parse(fileName).name;
                fileName = `${baseName}.webp`;
                contentType = 'image/webp';
            }

            const finalFileName = `${Date.now()}-${fileName}`;
            const gcsPath = `${folder}/${finalFileName}`;
            const gcsFile = bucket.file(gcsPath);

            await gcsFile.save(buffer, {
                metadata: { contentType }
            });

            console.log(`✅ Archivo subido y optimizado a GCS: ${gcsPath}`);
            return gcsPath;
        } catch (error) {
            console.error('❌ Error subiendo a GCS:', error);
            throw new Error('Error al subir el archivo al almacenamiento en la nube.');
        }
    }

    /**
     * ✅ NUEVO: Elimina un archivo de GCS de forma segura.
     */
    async deleteFile(gcsPath) {
        if (!gcsPath || gcsPath.startsWith('http')) return;
        
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(gcsPath);
            const [exists] = await file.exists();
            
            if (exists) {
                await file.delete();
                console.log(`🗑️ Archivo eliminado de GCS: ${gcsPath}`);
            }
        } catch (error) {
            console.error(`⚠️ Error eliminando archivo de GCS (${gcsPath}):`, error.message);
        }
    }

    /**
     * Proxy de previsualización para el Administrador.
     */
    async serveGCSPreview(req, res) {
        return this._serveGCSByPath(req, res, true);
    }

    /**
     * Proxy general para servir imágenes de GCS por ruta (Capa de Usuarios).
     * GET /api/media/gcs?path=...
     */
    async serveGCSGeneral(req, res) {
        return this._serveGCSByPath(req, res, false);
    }

    /**
     * Lógica interna compartida para servir archivos de GCS por ruta.
     */
    async _serveGCSByPath(req, res, isAdminOnly = false) {
        try {
            const { path: gcsPath } = req.query;
            if (!gcsPath) return res.status(400).send('Falta el parámetro "path".');
            if (gcsPath.startsWith('http')) return res.redirect(gcsPath);

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(gcsPath);

            const [exists] = await file.exists();
            if (!exists) {
                // Silencioso o 404 estándar
                return res.status(404).send('Archivo no encontrado en GCS.');
            }

            const ext = path.extname(gcsPath).toLowerCase();
            const contentTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml'
            };

            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', isAdminOnly ? 'no-cache' : 'public, max-age=86400'); // Cache 24h para usuarios
            
            file.createReadStream().pipe(res);
        } catch (error) {
            console.error('❌ Error sirviendo GCS por ruta:', error);
            res.status(500).send('Error interno.');
        }
    }
}

module.exports = new MediaController();
