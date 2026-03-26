const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

async function diagnose() {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const bucketName = process.env.GCS_BUCKET_NAME;

    console.log(`🔍 Iniciando diagnóstico de GCS...`);
    console.log(`keyFile: ${keyPath}`);
    console.log(`Bucket: ${bucketName}`);

    const storage = new Storage({
        keyFilename: keyPath
    });

    try {
        const [metadata] = await storage.bucket(bucketName).getMetadata();
        console.log(`✅ Conexión al bucket OK.`);
        console.log(`ID del Proyecto del Bucket: ${metadata.projectNumber}`);
        console.log(`Ubicación: ${metadata.location}`);

        // Intentar una subida de prueba pequeña
        const testFile = storage.bucket(bucketName).file('diagnostico_test.txt');
        await testFile.save('Prueba de escritura desde el sistema de tutoría.', {
            resumable: false,
            contentType: 'text/plain'
        });
        console.log(`✅ Escritura de prueba exitosa.`);
        
        // Limpiar
        await testFile.delete();
        console.log(`✅ Eliminación de prueba exitosa.`);

    } catch (err) {
        console.error(`❌ ERROR DE DIAGNÓSTICO:`);
        console.error(err.message);
        if (err.code === 403) {
            console.error(`👉 Causa probable: El Service Account no tiene permisos en ESTE bucket específico.`);
        } else if (err.code === 404) {
            console.error(`👉 Causa probable: El bucket '${bucketName}' no existe.`);
        }
    }
}

diagnose();
