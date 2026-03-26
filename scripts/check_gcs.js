const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function listBuckets() {
    try {
        console.log('🔍 Buscando Buckets en Google Cloud Storage...');
        const [buckets] = await storage.getBuckets();
        console.log('📂 Buckets encontrados:');
        buckets.forEach(bucket => {
            console.log(` - ${bucket.name}`);
        });
        
        if (buckets.length === 0) {
            console.log('⚠️ No se encontraron buckets. Asegúrate de tener permisos de Storage Admin / Viewer.');
        }
    } catch (error) {
        console.error('❌ Error accediendo a GCS:', error.message);
    }
}

listBuckets();
