# 📘 Informe Técnico Profesional: Chatbot Tutor UC

**Versión del Documento:** 1.0  
**Fecha de Generación:** 06 de Febrero de 2026  
**Proyecto:** Hub Academia - Chatbot Tutor UC

---

## 1. 🚀 Resumen Ejecutivo

**Hub Academia** es una plataforma educativa integral diseñada para apoyar a estudiantes universitarios mediante tecnologías de vanguardia. El sistema combina una **biblioteca digital** centralizada, un **tutor inteligente (IA)** basado en el modelo Gemini 2.5 de Google, y un módulo de **gamificación (Quiz Arena)** para reforzar el aprendizaje.

El objetivo principal es democratizar el acceso a recursos académicos de calidad y proporcionar asistencia personalizada 24/7, reduciendo la brecha de conocimiento en cursos complejos.

---

## 2. 🏗️ Arquitectura del Sistema

El proyecto sigue una arquitectura de software moderna y escalable, basada en principios de **Clean Architecture** y una separación estricta de responsabilidades en cuatro capas.

### 2.1. Diagrama de Capas

```mermaid
graph TD
    P[Presentation Layer] --> A[Application Layer]
    A --> D[Domain Layer]
    A --> I[Infrastructure Layer]
    I --> EXT[External Services (Google AI, Supabase, MercadoPago)]
```

### 2.2. Descripción de Componentes

1.  **Presentation Layer (`/presentation`)**:
    *   **Responsabilidad:** Interfaz de usuario (UI) y experiencia de usuario (UX).
    *   **Tecnologías:** HTML5 Semántico, CSS3 Moderno (Variables, Glassmorphism), Vanilla JavaScript (ES6+).
    *   **Componentes Clave:**
        *   `index.html`: Punto de entrada único (SPA/MPA híbrido).
        *   `js/search.js`: Motor de búsqueda y renderizado dinámico de contenido.
        *   `js/chat.js`: Cliente de Websocket/REST para comunicación con el Tutor IA.
        *   `js/ui/`: Gestores de componentes reutilizables (Modales, Tarjetas, Alertas).

2.  **Application Layer (`/application`)**:
    *   **Responsabilidad:** Casos de uso y reglas de orquestación de la aplicación.
    *   **Componentes Clave:**
        *   `controllers/`: Controladores que manejan las peticiones HTTP (e.g., `chatController.js`, `contentController.js`).
        *   `middleware/`: Lógica intermedia para autenticación (`authMiddleware.js`) y manejo de errores.

3.  **Domain Layer (`/domain`)**:
    *   **Responsabilidad:** Lógica de negocio pura y entidades del sistema.
    *   **Componentes Clave:**
        *   `services/`: Servicios de negocio (e.g., `geminiService.js` para lógica de IA, `userService.js`).
        *   `repositories/`: Interfaces abstractas para acceso a datos.

4.  **Infrastructure Layer (`/infrastructure`)**:
    *   **Responsabilidad:** Implementación técnica y comunicación con servicios externos.
    *   **Componentes Clave:**
        *   `database/`: Conexión inicial con Supabase (`supabaseClient.js`).
        *   `repositories/`: Implementación concreta de los repositorios (e.g., `supabaseUserRepository.js`).
        *   `server.js`: Configuración del servidor Express y rutas.

---

## 3. 🛠️ Stack Tecnológico

La selección de tecnologías prioriza el rendimiento, la escalabilidad y la experiencia de usuario.

| Área | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express | Servidor API RESTful rápido y ligero. |
| **Frontend** | Vanilla JS / CSS3 | Interfaz reactiva sin la sobrecarga de frameworks pesados. |
| **Base de Datos** | PostgreSQL (Supabase) | Gestión relacional robusta de usuarios y contenidos. |
| **Inteligencia Artificial** | Google Vertex AI (Gemini 2.5) | Motor de razonamiento y generación de respuestas (RAG). |
| **Machine Learning** | Python (Scikit-Learn) | Microservicio de análisis de tendencias y recomendaciones (`/ml_service`). |
| **Pagos** | Mercado Pago | Pasarela segura para suscripciones Premium. |
| **Despliegue** | Render / Vercel | Hosting de alta disponibilidad. |

---

## 4. ✨ Módulos y Funcionalidades Clave

### 4.1. Tutor Académico IA (RAG)
El núcleo inteligente de la plataforma. Utiliza **Retrieval Augmented Generation (RAG)** para grounded truth.
*   **Funcionamiento:** Cuando un usuario hace una pregunta, el sistema busca fragmentos relevantes en la base de datos de libros antes de enviarlos a Gemini.
*   **Capacidad:** Resúmenes, explicaciones paso a paso, creación de cuestionarios y citas bibliográficas reales.

### 4.2. Biblioteca Digital
Sistema de gestión de contenidos (CMS) personalizado.
*   **Organización:** Jerarquía de `Áreas -> Carreras -> Cursos -> Temas -> Libros`.
*   **Búsqueda:** Motor de búsqueda en tiempo real con filtrado por categoría.

### 4.3. Quiz Arena (Gamificación)
Módulo competitivo para validar conocimientos.
*   **Mecánica:** Cuestionarios cronometrados generados dinámicamente o predefinidos.
*   **Power-ups:** "50/50", "Congelar Tiempo", "Salto".
*   **Sistemas:** Puntuación, Vidas (Sistema de energía) y Ranking Global.

### 4.4. Analytics & Dashboard
Microservicio Python para inteligencia de datos.
*   **Funciones:** Análisis de engagement, temas más buscados, predicción de tendencias de estudio.

---

## 5. 📂 Estructura de Carpetas Detallada

```path
chatbot-tutor-uc/
├── application/            # Lógica de aplicación
│   └── controllers/        # Controladores (Chat, Auth, Content)
├── domain/                 # Reglas de negocio
│   ├── services/           # Lógica compleja (Gemini, Gamification)
│   └── models/             # Definiciones de tipos/entidades
├── infrastructure/         # Implementación técnica
│   ├── database/           # Clientes DB (Supabase)
│   ├── repositories/       # Acceso a datos (SQL queries)
│   └── routes/             # Definición de endpoints API
├── presentation/           # Frontend Público
│   ├── public/
│   │   ├── css/            # Estilos modulares (Glassmorphism)
│   │   ├── js/             # Lógica UI (Modules, Services)
│   │   └── assets/         # Imágenes y recursos estáticos
├── ml_service/             # Microservicio Python
│   ├── predictors/         # Modelos de ML
│   └── app.py              # API Flask/FastAPI para ML
└── tests/                  # Pruebas automatizadas
```

---

## 6. ⚙️ Guía de Instalación y Despliegue

### Requisitos Previos
*   Node.js v16+
*   Python 3.8+
*   Cuenta Google Cloud (Vertex AI)
*   Instancia Supabase

### Pasos de Instalación

1.  **Clonar Repositorio:**
    ```bash
    git clone https://github.com/tu-org/chatbot-tutor-uc.git
    cd chatbot-tutor-uc
    ```

2.  **Backend (Node.js):**
    ```bash
    npm install
    # Configurar .env con credenciales
    npm run dev
    ```

3.  **Servicio ML (Python):**
    ```bash
    cd ml_service
    python -m venv venv
    source venv/bin/activate  # o .\venv\Scripts\activate en Windows
    pip install -r requirements.txt
    python app.py
    ```

---

## 7. 🔮 Próximos Pasos (Roadmap)

*   [ ] **Modo Voz:** Implementación de STT/TTS para interactuar hablando con el tutor.
*   [ ] **App Móvil Nativa:** Wrapper en React Native o Flutter.
*   [ ] **Grupos de Estudio:** Funcionalidad social para compartir resúmenes.

---

**Autor:** Equipo de Desarrollo Hub Academia  
**Estado:** Producción (MVP Avanzado)
