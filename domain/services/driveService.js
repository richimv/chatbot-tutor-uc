const { google } = require('googleapis');
const path = require('path');

/**
 * DriveService: Gestiona la comunicación con la API de Google Drive v3
 * Utiliza la Service Account configurada en el root del proyecto.
 */
class DriveService {
    constructor() {
        // ✅ DEBUGLOG: Verificación de entorno en Producción
        console.log('📡 [DriveService] Inicializando con Env:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'EXISTENTE' : 'VACÍO');
        
        const authOptions = {
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        };

        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            authOptions.keyFile = path.join(__dirname, '../../service-account-key.json');
            console.log('📁 [DriveService] Usando fallback local:', authOptions.keyFile);
        } else {
            console.log('🔑 [DriveService] Usando credenciales de variable de entorno.');
        }

        this.auth = new google.auth.GoogleAuth(authOptions);
        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    /**
     * Extrae el File ID de una URL de Google Drive
     */
    extractFileId(url) {
        if (!url) return null;
        const match = url.match(/\/d\/(.+?)(\/|$)/) || url.match(/id=(.+?)(&|$)/);
        return match ? match[1] : null;
    }

    /**
     * Obtiene el enlace de la miniatura de un archivo
     */
    async getThumbnailLink(fileId) {
        try {
            console.log(`📡 [DriveService] Consultando miniatura para: ${fileId}`);
            const response = await this.drive.files.get({
                fileId: fileId,
                fields: 'thumbnailLink, name, mimeType',
                supportsAllDrives: true
            });

            if (!response.data.thumbnailLink) {
                console.log(`⚠️ [DriveService] Google no devolvió link para (${fileId}):`, response.data.mimeType);
            }

            return {
                thumbnailUrl: response.data.thumbnailLink,
                name: response.data.name,
                mimeType: response.data.mimeType
            };
        } catch (error) {
            console.error(`❌ [DriveService] Error FATAL (${fileId}):`, {
                message: error.message,
                code: error.code,
                errors: error.errors || 'N/A'
            });
            return null;
        }
    }

    /**
     * Obtiene todos los archivos dentro de una carpeta específica
     * @param {string} folderId - ID de la carpeta de Google Drive
     */
    async getFilesFromFolder(folderId) {
        try {
            console.log(`📡 [DriveService] Escaneando carpeta: ${folderId}`);
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, size, webViewLink)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });

            return response.data.files || [];
        } catch (error) {
            console.error(`❌ [DriveService] Error al listar carpeta (${folderId}):`, error.message);
            throw error;
        }
    }
}

module.exports = new DriveService();
