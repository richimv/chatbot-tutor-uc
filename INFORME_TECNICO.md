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

## 7. 🌐 Infraestructura de Dominios y Correo

### 7.1. Dominios (Namecheap)
*   **Principal:** `hubacademia.com` (Adquirido y configurado).
*   **Subdominios:** Apuntan a los servicios desplegados en Vercel/Render.

### 7.2. Servicio de Email (Resend)
*   **Proveedor:** Se utiliza **Resend** como API transaccional para el envío de correos.
*   **Flujos:**
    1.  **Verificación de Cuenta:** Para usuarios generales (`@gmail.com`, `@hotmail.com`, etc.).
    2.  **Recuperación de Contraseña:** Envío de enlaces seguros con tokens temporales.
*   **Estrategia "Dominio Ficticio" (@hubacademia.com):**
    *   Para facilitar el *onboarding* inmediato en entornos institucionales o de prueba, se implementó una lógica de **Auto-Verificación**.
    *   Cualquier registro bajo el dominio `@hubacademia.com` omite el envío de correo por Resend y activa la cuenta instantáneamente mediante la Admin API de Supabase. Esto permite el acceso directo a funcionalidades sin fricción.

---

## 8. 🔮 Próximos Pasos (Roadmap)

*   [ ] **Modo Voz:** Implementación de STT/TTS para interactuar hablando con el tutor.
*   [ ] **App Móvil Nativa:** Wrapper en React Native o Flutter.
*   [ ] **Grupos de Estudio:** Funcionalidad social para compartir resúmenes.

---

**Autor:** Equipo de Desarrollo Hub Academia  
**Estado:** Producción (MVP Avanzado) - Despliegue en Render/Vercel Activo.

---

## 9. 🛡️ Seguridad y Protección de Datos

La seguridad ha sido una prioridad desde el diseño inicial ("Security by Design"). A continuación, se detallan las medidas implementadas para proteger la integridad del sistema y los datos de los usuarios.

### 8.1. Autenticación y Gestión de Identidad
*   **Sistema Híbrido Robusto:** Utilizamos **Supabase Auth** como proveedor principal de identidad (IdP), delegando la gestión segura de sesiones y _tokens_ (JWT).
*   **Validación de Contraseñas (OWASP):** 
    *   **Complejidad:** Se exige longitud mínima, mayúsculas, minúsculas y números.
    *   **HIBP Check:** Integración con la API de _"Have I Been Pwned"_ para impedir el uso de contraseñas previamente filtradas en brechas de seguridad conocidas.
*   **Encriptación Redundante:** Aunque Supabase gestiona las credenciales, mantenemos un hash local (bcrypt salt rounds=10) para redundancia y validación de doble factor en operaciones críticas (como eliminación de cuenta).
*   **Roles y Permisos:** Sistema de control de acceso basado en roles (RBAC) con tipos: `student`, `teacher`, `admin`.

### 8.2. Protección de Base de Datos
*   **Prevención de SQL Injection:** Uso estricto de **Consultas Parametrizadas** en todas las interacciones con PostgreSQL (driver `pg`). Nunca se concatenan cadenas directamente en las consultas SQL.
*   **Integridad Referencial:** Uso de claves foráneas con `ON DELETE CASCADE` para asegurar que al eliminar un usuario, se eliminen recursivamente todos sds datos asociados (historial, favoritos, notas) sin dejar registros huérfanos.
*   **Aislamiento:** La base de datos opera bajo una VPC virtual (en producción) con acceso restringido solo al backend mediante variables de entorno seguras.

### 8.3. Seguridad en el Frontend
*   **Sanitización:** Limpieza de inputs en formularios para prevenir XSS (Cross-Site Scripting).
*   **Manejo de Errores:** Los mensajes de error expuestos al usuario son genéricos ("Credenciales inválidas") para no revelar si un correo existe o no (Enumeration Attacks), mientras que los logs internos mantienen detalle completo para debugging.

### 8.4. Hardening y Auditoría
*   **Protección de Consola:** En entornos de producción, se deshabilitan automáticamente los logs de consola (`console.log`, `debug`, `info`) para prevenir la fuga de información técnica o de arquitectura a través de las herramientas de desarrollador del navegador.
*   **Auditoría de Inyección SQL:** Se verificó exhaustivamente el uso de consultas parametrizadas en todos los repositorios críticos (`userRepository`, `authService`), confirmando la inmunidad contra ataques de inyección SQL estándar.
*   **Validación de Identidad:** La eliminación de cuentas y operaciones sensibles están protegidas contra *ID Spoofing* al confiar únicamente en el `sub` (Subject ID) del token JWT verificado, ignorando cualquier manipulacion del cuerpo de la petición.
*   **Resiliencia de Backend (Retry Pattern):** Se implementó un mecanismo de reintento automático en `authMiddleware.js` para manejar errores de red transitorios (`ECONNRESET`, `ETIMEDOUT`) contra Supabase. Esto asegura una alta disponibilidad incluso ante microcortes de conexión, reintentando la validación del token hasta 3 veces antes de fallar.

---

## 10. 👤 Ciclo de Vida del Usuario y Suscripciones

El sistema maneja diferentes estados de usuario para ofrecer una experiencia escalonada y monetizable.

### 9.1. Visitante (No Registrado)
*   **Acceso:** Limitado exclusivamente a la _Landing Page_, información institucional ("Sobre Nosotros") y vista previa de precios.
*   **Restricciones:** Bloqueo total al Chatbot, Biblioteca y Quiz Arena.
*   **Objetivo:** Conversión a registro mediante CTAs (Call to Actions) claros.

### 9. Usuario Free (Registrado)
*   **Registro Estándar vs. Corporativo:**
    *   **Usuarios Generales (@gmail, etc.):** Requieren validación de correo electrónico obligatoria para activar la cuenta.
    *   **Usuarios Hub Academia (@hubacademia.com):** Proceso de **Auto-Verificación** mediante Admin API. Sus cuentas se activan inmediatamente al registrarse, eliminando fricción.
*   **Límites (Freemium):**
    *   **Consultas al Tutor:** Limitadas a **3 interacciones diarias**. Controlado por `UsageService`.
    *   **Biblioteca:** Acceso de lectura, pero restricción en descargas o funcionalidades avanzadas.
*   **Interacción:** Al alcanzar el límite, se muestra un *Paywall Modal* invitando a suscribirse.

### 9.2. Usuario Premium
*   **Conversión:** Se logra mediante pago procesado por MercadoPago. El webhook actualiza el estado `subscription_status` a `active` en tiempo real.
*   **Beneficios:**
    *   **Consultas Ilimitadas:** El `UsageService` omite el conteo de tokens/interacciones.
    *   **Soporte Prioritario:** (Roadmap)
    *   **Acceso anticipado:** Nuevas características (como el futuro modo voz).
*   **Gestión:** Panel de perfil para ver estado de suscripción y facturación.

---

## 11. ⚠️ Notas de Despliegue Críticas

### 10.1. Variables de Entorno Adicionales
Para el correcto funcionamiento de las funciones administrativas (como la eliminación definitiva de cuentas y la auto-verificación de usuarios corporativos), es **OBLIGATORIO** configurar la siguiente variable en el entorno de producción (Render, Vercel, etc.):

*   `SUPABASE_SERVICE_ROLE_KEY`: Clave secreta con privilegios de super-admin (bypass RLS).
    *   **Ubicación:** Supabase Dashboard -> Project Settings -> API -> `service_role` secret.
    *   **Riesgo:** Nunca debe exponerse en el frontend ni en repositorios públicos.

### 10.2. Eliminación de Cuenta (Danger Zone)
Esta funcionalidad es irreversible y desencadena una limpieza en cascada:
1.  **Doble Verificación:** El usuario debe reingresar su contraseña actual.
2.  **Validación Auth:** Se verifica la identidad contra Supabase Auth.
3.  **Borrado Admin:** Se utiliza la `SUPABASE_SERVICE_ROLE_KEY` para eliminar el usuario del proveedor de identidad.
4.  **Limpieza DB:** Gracias a `ON DELETE CASCADE` en PostgreSQL, se eliminan automáticamente todos los registros dependientes (chats, favoritos, historial).

