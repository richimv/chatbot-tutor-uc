const mediaController = require('../application/controllers/mediaController');
const path = require('path');

async function testController() {
    console.log('🧪 Probando lógica integrada de MediaController...');

    // Mock de un objeto file de Multer
    const mockFile = {
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 
            'base64'
        ),
        originalname: 'test_image.png',
        mimetype: 'image/png'
    };

    try {
        // Mock de GCS para evitar errores de red/credenciales
        mediaController.storage.bucket = () => ({
            file: (path) => ({
                save: async (buffer, metadata) => {
                    console.log(`📦 Simulación: Guardando en GCS -> ${path}`);
                    console.log(`📎 Content-Type: ${metadata.metadata.contentType}`);
                    console.log(`📏 Tamaño final: ${buffer.length} bytes`);
                    
                    // Verificación crítica
                    if (path.endsWith('.webp') && metadata.metadata.contentType === 'image/webp') {
                        console.log('✅ ÉXITO: El archivo se renombró a .webp y el Mimetype es correcto.');
                    } else {
                        throw new Error('FALLO: El archivo no se procesó como WebP.');
                    }
                }
            })
        });

        const resultPath = await mediaController.uploadFile(mockFile, 'test_folder');
        console.log(`🚀 Ruta resultante: ${resultPath}`);

    } catch (error) {
        console.error('❌ Error en prueba integrada:', error.message);
    }
}

testController();
