const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function testSharp() {
    console.log('🧪 Iniciando prueba de Sharp...');
    
    // 1. Crear un buffer de imagen simple (1x1 rojo PNG)
    const redPngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 
        'base64'
    );

    try {
        console.log('1. Probando conversión a WebP...');
        const optimizedBuffer = await sharp(redPngBuffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        console.log('✅ Buffer optimizado generado.');
        console.log(`📏 Tamaño original: ${redPngBuffer.length} bytes`);
        console.log(`📏 Tamaño optimizado: ${optimizedBuffer.length} bytes`);

        // 2. Verificar que el buffer resultante es WebP (firma RIFF...WEBP)
        const header = optimizedBuffer.slice(0, 12).toString('binary');
        if (header.includes('RIFF') && header.includes('WEBP')) {
            console.log('✅ El buffer resultante es un archivo WebP válido.');
        } else {
            console.log('❌ El buffer no parece ser WebP válido.');
        }

    } catch (error) {
        console.error('❌ Fallo en la prueba de Sharp:', error);
    }
}

testSharp();
