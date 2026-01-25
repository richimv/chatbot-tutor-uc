const db = require('./infrastructure/database/db');

async function checkExtensions() {
    try {
        const { rows } = await db.query('SELECT extname FROM pg_extension');
        console.log('Extensions:', rows.map(r => r.extname));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkExtensions();
