const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require("firebase-admin");
const app = express();
const port = 3000;

// ======================
// 🔹 Middleware CORS
// ======================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());

// ======================
// 🔹 Rutas del frontend
// ======================
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ======================
// 🔹 Base de datos JSON local
// ======================
const dbPath = path.join(__dirname, 'database.json');

function loadDB() {
    if (!fs.existsSync(dbPath)) return { cursos: [], historial: [] };
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}
function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ======================
// 🔹 Firebase Realtime Database
// ======================
let firebaseEnabled = false;
let rtdb = null;
try {
    const serviceAccount = require("./appchatbot-d941d-firebase-adminsdk-fbsvc-f9ff06be2b.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://appchatbot-d941d-default-rtdb.firebaseio.com/"
    });
    rtdb = admin.database();
    firebaseEnabled = true;
    console.log("🔥 Firebase Realtime Database conectado correctamente");
} catch (err) {
    console.warn("⚠️ Firebase no configurado, se usará database.json local");
}

// ======================
// 🔹 API ENDPOINTS DE CURSOS
// ======================

// ✅ Obtener todos los cursos
app.get('/api/cursos', async (req, res) => {
    try {
        if (firebaseEnabled) {
            const snapshot = await rtdb.ref("cursos").once("value");
            const data = snapshot.val() || {};
            const cursos = Object.keys(data).map(id => ({ id, ...data[id] }));
            return res.json(cursos);
        } else {
            return res.json(loadDB().cursos);
        }
    } catch (error) {
        console.error('❌ Error al leer cursos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Buscar cursos y registrar historial
app.get('/api/buscar', async (req, res) => {
    try {
        const query = (req.query.q || '').toLowerCase();
        await registrarBusqueda(query);

        if (firebaseEnabled) {
            const snapshot = await rtdb.ref("cursos").once("value");
            const data = snapshot.val() || {};
            const cursos = Object.keys(data).map(id => ({ id, ...data[id] }));
            const resultados = cursos.filter(c =>
                c.nombre.toLowerCase().includes(query) ||
                c.carrera.toLowerCase().includes(query) ||
                (c.temas || []).some(t => t.toLowerCase().includes(query))
            );
            return res.json(resultados);
        } else {
            const data = loadDB();
            const resultados = data.cursos.filter(c =>
                c.nombre.toLowerCase().includes(query) ||
                c.carrera.toLowerCase().includes(query) ||
                c.temas.some(t => t.toLowerCase().includes(query))
            );
            return res.json(resultados);
        }
    } catch (error) {
        console.error('❌ Error en la búsqueda:', error);
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

// ✅ Registrar historial de búsqueda (función auxiliar)
async function registrarBusqueda(query) {
    try {
        const busqueda = { consulta: query, fecha: new Date().toISOString() };

        if (firebaseEnabled) {
            await rtdb.ref("historial").push(busqueda);
        } else {
            const data = loadDB();
            if (!data.historial) data.historial = [];
            data.historial.push(busqueda);
            saveDB(data);
        }
    } catch (error) {
        console.error("❌ Error al registrar historial:", error);
    }
}

// ✅ CRUD de cursos (añadir, editar, eliminar, obtener por ID)
app.post('/api/add-curso', async (req, res) => {
    try {
        const nuevoCurso = req.body;
        if (!nuevoCurso.nombre || !nuevoCurso.carrera)
            return res.status(400).json({ error: 'El curso debe tener nombre y carrera' });

        if (firebaseEnabled) {
            const ref = await rtdb.ref("cursos").push(nuevoCurso);
            return res.status(201).json({ id: ref.key, ...nuevoCurso });
        } else {
            const data = loadDB();
            const cursoConId = { id: Date.now().toString(), ...nuevoCurso };
            data.cursos.push(cursoConId);
            saveDB(data);
            return res.status(201).json(cursoConId);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.put('/api/edit-curso/:id', async (req, res) => {
    try {
        const cursoId = req.params.id;
        const datos = req.body;

        if (firebaseEnabled) {
            await rtdb.ref(`cursos/${cursoId}`).update(datos);
            return res.json({ id: cursoId, ...datos });
        } else {
            const data = loadDB();
            const idx = data.cursos.findIndex(c => c.id === cursoId);
            if (idx === -1) return res.status(404).json({ error: 'Curso no encontrado' });
            data.cursos[idx] = { ...data.cursos[idx], ...datos };
            saveDB(data);
            return res.json(data.cursos[idx]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api/delete-curso/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (firebaseEnabled) {
            await rtdb.ref(`cursos/${id}`).remove();
            return res.json({ message: 'Eliminado en Firebase' });
        } else {
            const data = loadDB();
            data.cursos = data.cursos.filter(c => c.id !== id);
            saveDB(data);
            return res.json({ message: 'Eliminado localmente' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ✅ Obtener curso por ID
app.get('/api/curso/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (firebaseEnabled) {
            const snapshot = await rtdb.ref(`cursos/${id}`).once('value');
            if (!snapshot.exists()) return res.status(404).json({ error: 'Curso no encontrado' });
            return res.json({ id, ...snapshot.val() });
        } else {
            const data = loadDB();
            const curso = data.cursos.find(c => c.id === id);
            if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });
            return res.json(curso);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ======================
// 🔹 HISTORIAL Y PREDICCIÓN
// ======================
const historialPath = path.join(__dirname, 'historial.json');

function loadHistorial() {
    if (!fs.existsSync(historialPath)) return { historial: [] };
    return JSON.parse(fs.readFileSync(historialPath, 'utf8'));
}
function saveHistorial(data) {
    fs.writeFileSync(historialPath, JSON.stringify(data, null, 2));
}

// 📈 Guardar búsqueda
app.post('/api/historial', async (req, res) => {
    const { usuario, consulta } = req.body;
    if (!consulta) return res.status(400).json({ error: 'Consulta requerida' });

    const historial = loadHistorial();
    const registro = { id: Date.now(), usuario: usuario || "anónimo", consulta, fecha: new Date().toISOString() };
    historial.historial.push(registro);
    saveHistorial(historial);

    if (firebaseEnabled) await rtdb.ref("historial").push(registro);

    res.json({ message: 'Búsqueda registrada', registro });
});

// 📜 Obtener historial
app.get('/api/historial', async (req, res) => {
    try {
        if (firebaseEnabled) {
            const snapshot = await rtdb.ref("historial").once("value");
            const data = snapshot.val() || {};
            return res.json(Object.values(data));
        } else {
            return res.json(loadHistorial().historial);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 🔮 Predicción top 5 cursos más buscados
app.get('/api/prediccion', async (req, res) => {
    try {
        let historial = [];

        if (firebaseEnabled) {
            const snapshot = await rtdb.ref("historial").once("value");
            historial = Object.values(snapshot.val() || {});
        } else {
            historial = loadHistorial().historial;
        }

        const conteo = {};
        historial.forEach(item => {
            const palabra = item.consulta.toLowerCase();
            conteo[palabra] = (conteo[palabra] || 0) + 1;
        });

        const top = Object.entries(conteo)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nombre, veces]) => ({ nombre, veces }));

        res.json({ top });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ======================
// 🔹 Iniciar servidor
// ======================
app.listen(port, () => {
    console.log('🚀 Servidor iniciado correctamente!');
    console.log(`📡 http://localhost:${port}`);
});

// ======================
// 🔹 Sincronización con Firebase (opcional)
// ======================
if (firebaseEnabled) {
    const dbFile = path.join(__dirname, 'database.json');
    async function syncFirebaseToLocal() {
        try {
            const snapshot = await rtdb.ref("cursos").once("value");
            const data = snapshot.val() || {};
            fs.writeFileSync(dbFile, JSON.stringify({ cursos: Object.values(data) }, null, 2));
            console.log("💾 [SYNC] Firebase sincronizado con base local");
        } catch (e) { console.error("❌ Error al sincronizar:", e); }
    }
    syncFirebaseToLocal();
}
