# 🚀 Guía de Instalación Rápida - Chatbot Tutor UC

Esta guía resume los pasos esenciales para levantar el proyecto en un nuevo entorno.

## 📋 Requisitos Previos
*   **Node.js** (v16+)
*   **Python** (v3.8+)
*   **PostgreSQL** (v12+)
*   **Cuenta de Google Cloud** (con Vertex AI habilitado)

## 🛠️ Instalación Paso a Paso

### 1. Clonar y Dependencias
```bash
git clone <URL_DEL_REPO>
cd chatbot-tutor-uc

# Instalar dependencias del Backend (Node.js)
npm install

# Instalar dependencias de ML (Python)
# Recomendado: Usar un entorno virtual (venv)
python -m venv venv
# Windows: .\venv\Scripts\activate  |  Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Abre dos terminales:

**Terminal 1: Backend & Frontend**
```bash
npm start
# El servidor iniciará en http://localhost:3000
```

**Terminal 2: Servicio de ML**
```bash
# Asegúrate de tener el entorno virtual activado
python -m ml_service.app
# El servicio iniciará en http://localhost:5000
# Nota: La primera vez descargará el modelo de IA (puede tardar unos minutos).
```
