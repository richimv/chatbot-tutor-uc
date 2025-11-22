# 📦 Guía de Instalación - Chatbot Tutor UC

Esta guía te ayudará a configurar el proyecto en un nuevo equipo desde cero.

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

1. **Node.js** (versión 16 o superior)
   - Descargar desde: https://nodejs.org/
   - Verificar instalación: `node --version`

2. **Python** (versión 3.8 o superior)
   - Descargar desde: https://www.python.org/downloads/
   - Verificar instalación: `python --version` o `python3 --version`
   - **Importante**: Durante la instalación, marcar la opción "Add Python to PATH"

3. **PostgreSQL** (versión 12 o superior)
   - Descargar desde: https://www.postgresql.org/download/
   - Durante la instalación, anota la contraseña del usuario `postgres`

4. **Git**
   - Descargar desde: https://git-scm.com/
   - Verificar instalación: `git --version`

---

## 🚀 Pasos de Instalación

### 1️⃣ Clonar el Repositorio

```bash
git clone <URL_DE_TU_REPOSITORIO_GITHUB>
cd chatbot-tutor-uc
```

---

### 2️⃣ Instalar Dependencias de Node.js

```bash
npm install
```

Esto instalará automáticamente todas las dependencias listadas en `package.json`:
- `express` - Framework web
- `@google-cloud/vertexai` - SDK de Google Vertex AI
- `pg` - Cliente PostgreSQL
- `bcryptjs` - Encriptación de contraseñas
- `jsonwebtoken` - Autenticación JWT
- `cors` - Middleware CORS
- `dotenv` - Variables de entorno
- `axios` - Cliente HTTP
- Y más...

---

### 3️⃣ Configurar Python y Dependencias de ML

#### Crear un entorno virtual (recomendado):

**En Windows:**
```bash
python -m venv venv
.\venv\Scripts\activate
```

**En macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### Crear archivo `requirements.txt` en la raíz del proyecto:

```txt
Flask==3.0.0
pandas==2.1.4
nltk==3.8.1
scikit-learn==1.3.2
requests==2.31.0
```

#### Instalar dependencias de Python:

```bash
pip install -r requirements.txt
```

---

### 4️⃣ Configurar PostgreSQL

1. **Crear la base de datos:**

```sql
CREATE DATABASE chatbot_tutor_uc;
```

2. **Crear las tablas necesarias** (ejecutar los scripts SQL que tienes en tu proyecto)
   - Usuarios
   - Carreras
   - Cursos
   - Secciones
   - Temas
   - Historial de búsquedas
   - Chats

3. **Habilitar extensiones necesarias:**

```sql
-- Conectarse a la base de datos
\c chatbot_tutor_uc

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

---

### 5️⃣ Configurar Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatbot_tutor_uc
DB_USER=postgres
DB_PASSWORD=tu_contraseña_postgresql

# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=tu-proyecto-google-cloud
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# JWT
JWT_SECRET=tu_secreto_super_seguro_aqui

# ML Service
ML_SERVICE_URL=http://localhost:5000
```

---

### 6️⃣ Configurar Google Cloud (Vertex AI)

1. **Crear un proyecto en Google Cloud Console:**
   - Ir a: https://console.cloud.google.com/
   - Crear un nuevo proyecto

2. **Habilitar la API de Vertex AI:**
   - En el proyecto, ir a "APIs y Servicios" > "Biblioteca"
   - Buscar "Vertex AI API" y habilitarla

3. **Crear una cuenta de servicio:**
   - Ir a "IAM y administración" > "Cuentas de servicio"
   - Crear cuenta de servicio
   - Asignar rol: "Vertex AI User" o "Vertex AI Administrator"
   - Crear una clave JSON

4. **Descargar la clave JSON:**
   - Guardarla como `service-account-key.json` en la raíz del proyecto
   - **IMPORTANTE**: NO subir este archivo a GitHub (ya está en `.gitignore`)

---

### 7️⃣ Verificar la Instalación

#### Iniciar el servidor Node.js:

```bash
npm start
```

Deberías ver:
```
🚀 Inicializando Server...
💾 PostgreSQL conectado exitosamente
✅ Proyecto de Google Cloud cargado: <tu-proyecto>
🌐 Servidor corriendo en http://localhost:3000
```

#### Iniciar el servicio de ML (en otra terminal):

**Activar el entorno virtual primero:**
```bash
# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

**Iniciar Flask:**
```bash
python -m ml_service.app
```

O alternativamente:
```bash
cd ml_service
python app.py
```

Deberías ver:
```
* Running on http://127.0.0.1:5000
```

---

## 🔍 Solución de Problemas Comunes

### Error: "Puerto 3000 ya en uso"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <NUMERO_PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### Error: "Cannot find module 'X'"
```bash
npm install
```

### Error: "ModuleNotFoundError: No module named 'flask'"
```bash
pip install -r requirements.txt
```

### Error de conexión a PostgreSQL
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `.env`
- Verificar que la base de datos exista

### Error de Google Cloud Authentication
- Verificar que `service-account-key.json` exista
- Verificar variable `GOOGLE_APPLICATION_CREDENTIALS` en `.env`
- Verificar que la API de Vertex AI esté habilitada

---

## 📝 Notas Adicionales

### Archivos que NO deben estar en GitHub:
- `.env` (configuración local)
- `service-account-key.json` (credenciales de Google Cloud)
- `node_modules/` (dependencias de Node.js)
- `venv/` o `env/` (entorno virtual de Python)
- `__pycache__/` (caché de Python)

### Scripts útiles en `package.json`:
- `npm start` - Inicia el servidor en modo producción
- `npm run dev` - Inicia el servidor con auto-reload (requiere `nodemon`)

### Estructura del Proyecto:
```
chatbot-tutor-uc/
├── application/          # Controladores
├── domain/              # Lógica de negocio
├── infrastructure/      # Configuración (DB, servidor)
├── presentation/        # Frontend (HTML, CSS, JS)
├── ml_service/          # Servicio de Machine Learning (Python/Flask)
├── .env                 # Variables de entorno (NO en GitHub)
├── package.json         # Dependencias de Node.js
├── requirements.txt     # Dependencias de Python
└── service-account-key.json  # Credenciales Google Cloud (NO en GitHub)
```

---

## ✅ Checklist de Instalación

- [ ] Node.js instalado
- [ ] Python instalado
- [ ] PostgreSQL instalado y corriendo
- [ ] Repositorio clonado
- [ ] `npm install` ejecutado exitosamente
- [ ] Entorno virtual de Python creado
- [ ] `pip install -r requirements.txt` ejecutado
- [ ] Base de datos PostgreSQL creada
- [ ] Extensiones PostgreSQL habilitadas
- [ ] Archivo `.env` configurado
- [ ] Proyecto de Google Cloud creado
- [ ] API Vertex AI habilitada
- [ ] `service-account-key.json` descargado
- [ ] Servidor Node.js inicia sin errores
- [ ] Servicio ML (Flask) inicia sin errores

---

**¡Listo! 🎉** El proyecto debería estar funcionando correctamente.

Para acceder a la aplicación, abre tu navegador en: **http://localhost:3000**
