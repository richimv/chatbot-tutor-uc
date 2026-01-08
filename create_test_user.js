const fs = require('fs');
const path = require('path');

// 1. Leer el archivo .env manualmente para obtener el token real
const envPath = path.join(__dirname, '.env');
let accessToken = null;

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MP_ACCESS_TOKEN=(.+)/);
    if (match && match[1]) {
        accessToken = match[1].trim();
        console.log('✅ Token encontrado en .env:', accessToken.substring(0, 10) + '...');
    } else {
        console.error('❌ No se encontró MP_ACCESS_TOKEN en el archivo .env');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Error leyendo archivo .env:', error.message);
    process.exit(1);
}

// 2. Crear el usuario de prueba
async function createTestUser() {
    try {
        const response = await fetch('https://api.mercadopago.com/users/test_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                site_id: 'MPE',
                description: 'Test User for Librarian'
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('\n=================================================');
            console.log('✅   USUARIO DE COMPRA (TEST) GENERADO   ✅');
            console.log('=================================================');
            console.log('📧 EMAIL:    ', data.email);
            console.log('🔑 PASSWORD: ', data.password);
            console.log('-------------------------------------------------');
            console.log('👉 COPIA estos datos. Cuando Mercado Pago pida login, usa estos.');
            console.log('👉 NO uses tu cuenta personal.');
            console.log('=================================================\n');
        } else {
            console.error('❌ Error de la API de Mercado Pago:', data);
        }

    } catch (error) {
        console.error('Error de red:', error);
    }
}

createTestUser();
