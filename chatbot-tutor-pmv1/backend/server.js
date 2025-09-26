const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Middleware para permitir CORS (comunicación entre frontend y backend)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta principal - sirve el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Ruta para obtener todos los cursos
app.get('/api/cursos', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'database.json');
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        console.log('✅ Se enviaron todos los cursos');
        res.json(data.cursos);
    } catch (error) {
        console.error('❌ Error al leer la base de datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para buscar cursos por nombre o tema
app.get('/api/buscar', (req, res) => {
    try {
        const query = req.query.q.toLowerCase();
        const dbPath = path.join(__dirname, 'database.json');
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        console.log(`🔍 Búsqueda realizada: "${query}"`);

        const resultados = data.cursos.filter(curso => 
            curso.nombre.toLowerCase().includes(query) ||
            curso.temas.some(tema => tema.toLowerCase().includes(query)) ||
            curso.carrera.toLowerCase().includes(query)
        );

        console.log(`✅ Se encontraron ${resultados.length} resultados`);
        res.json(resultados);
    } catch (error) {
        console.error('❌ Error en la búsqueda:', error);
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

// Ruta de prueba para verificar que el servidor funciona
app.get('/api/test', (req, res) => {
    res.json({ message: '✅ El servidor del chatbot tutor está funcionando correctamente!' });
});

// Iniciar servidor
app.listen(port, () => {
    console.log('🚀 Servidor iniciado correctamente!');
    console.log(`📡 Backend corriendo en: http://localhost:${port}`);
    console.log(`🌐 Frontend accesible en: http://localhost:${port}`);
    console.log(`🔗 API de prueba: http://localhost:${port}/api/test`);
    console.log('Presiona Ctrl + C para detener el servidor');
});