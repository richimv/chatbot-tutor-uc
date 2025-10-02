const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// ======================
// 🔹 Middleware CORS
// ======================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// ======================
// 🔹 Rutas del frontend
// ======================
app.use(express.static(path.join(__dirname, '../frontend')));

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ======================
// 🔹 Base de datos JSON
// ======================
const dbPath = path.join(__dirname, 'database.json');

function loadDB() {
    if (!fs.existsSync(dbPath)) return { cursos: [] };
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ======================
// 🔹 API ENDPOINTS
// ======================

// ✅ Obtener todos los cursos
app.get('/api/cursos', (req, res) => {
    try {
        const data = loadDB();
        console.log('📤 Se enviaron todos los cursos');
        res.json(data.cursos);
    } catch (error) {
        console.error('❌ Error al leer la base de datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Buscar cursos por nombre, carrera o tema
app.get('/api/buscar', (req, res) => {
    try {
        const query = (req.query.q || '').toLowerCase();
        const data = loadDB();

        const resultados = data.cursos.filter(curso =>
            curso.nombre.toLowerCase().includes(query) ||
            curso.carrera.toLowerCase().includes(query) ||
            curso.temas.some(tema => tema.toLowerCase().includes(query))
        );

        console.log(`🔎 Búsqueda realizada: "${query}" - Resultados: ${resultados.length}`);
        res.json(resultados);
    } catch (error) {
        console.error('❌ Error en la búsqueda:', error);
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

// ✅ Agregar un nuevo curso
app.post('/api/add-curso', (req, res) => {
    try {
        const nuevoCurso = {
            id: Date.now().toString(), // siempre como string
            ...req.body
        };

        if (!nuevoCurso.nombre || !nuevoCurso.carrera) {
            return res.status(400).json({ error: 'El curso debe tener al menos nombre y carrera' });
        }

        const data = loadDB();
        data.cursos.push(nuevoCurso);
        saveDB(data);

        console.log('✅ Nuevo curso agregado:', nuevoCurso);
        res.status(201).json({ message: 'Curso agregado exitosamente', curso: nuevoCurso });
    } catch (error) {
        console.error('❌ Error al agregar curso:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Editar un curso existente
app.put('/api/edit-curso/:id', (req, res) => {
    try {
        const cursoId = req.params.id;
        const datosEditados = req.body;
        const data = loadDB();

        const index = data.cursos.findIndex(curso => String(curso.id) === String(cursoId));
        if (index === -1) {
            return res.status(404).json({ error: 'Curso no encontrado' });
        }

        data.cursos[index] = { ...data.cursos[index], ...datosEditados };
        saveDB(data);

        console.log('✏️ Curso editado:', data.cursos[index]);
        res.json({ message: 'Curso editado exitosamente', curso: data.cursos[index] });
    } catch (error) {
        console.error('❌ Error al editar curso:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Eliminar un curso
app.delete('/api/delete-curso/:id', (req, res) => {
    try {
        const cursoId = req.params.id;
        const data = loadDB();

        const index = data.cursos.findIndex(curso => String(curso.id) === String(cursoId));
        if (index === -1) {
            return res.status(404).json({ error: 'Curso no encontrado' });
        }

        const eliminado = data.cursos.splice(index, 1);
        saveDB(data);

        console.log('🗑️ Curso eliminado:', eliminado[0]);
        res.json({ message: 'Curso eliminado exitosamente', curso: eliminado[0] });
    } catch (error) {
        console.error('❌ Error al eliminar curso:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Obtener un curso por ID
app.get('/api/curso/:id', (req, res) => {
    try {
        const cursoId = req.params.id;
        const data = loadDB();

        const curso = data.cursos.find(curso => String(curso.id) === String(cursoId));
        if (!curso) {
            return res.status(404).json({ error: 'Curso no encontrado' });
        }

        res.json(curso);
    } catch (error) {
        console.error('❌ Error al obtener curso:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ message: '✅ El servidor del chatbot tutor está funcionando correctamente!' });
});

// ======================
// 🔹 Iniciar servidor
// ======================
app.listen(port, () => {
    console.log('🚀 Servidor iniciado correctamente!');
    console.log(`📡 Backend corriendo en: http://localhost:${port}`);
    console.log(`🌐 Frontend accesible en: http://localhost:${port}`);
    console.log(`🔗 API de prueba: http://localhost:${port}/api/test`);
    console.log('Presiona Ctrl + C para detener el servidor');
});
