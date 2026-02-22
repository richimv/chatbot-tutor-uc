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
        *   `services/`: Servicios de negocio (e.g., `mlService.js` como cliente directo de Vertex AI, `userService.js`).
        *   `repositories/`: Interfaces abstractas para acceso a datos.

    **Nota:** Originalmente se concibió un microservicio en Python (`/ml_service`), pero en la versión actual (v2.0), la lógica de IA ha sido migrada exitosamente a **Node.js nativo** utilizando el SDK `@google-cloud/vertexai`, reduciendo latencia y complejidad operativa. La carpeta `/ml_service` se mantiene como *deprecated* para scripts de batch legacy.

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
| **Inteligencia Artificial** | Google Vertex AI (Gemini 2.5 Flash) | Motor de razonamiento y generación de respuestas con **Function Calling**. |
| **Machine Learning** | Node.js (Jaccard Similarity) | Análisis de tendencias y clustering de términos de búsqueda (Migrado de Python). |
| **Pagos** | Mercado Pago | Pasarela segura para suscripciones Premium. |
| **Despliegue** | Render / Vercel | Hosting de alta disponibilidad. |

---

## 4. ✨ Módulos y Funcionalidades Clave

### 4.1. Tutor Académico IA (Advanced RAG Absoluto)
El núcleo inteligente de la plataforma ha evolucionado hacia una arquitectura robusta de Generación Aumentada por Recuperación (RAG) pura:
*   **Extracción Híbrida de Documentos:** Mediante un motor de ingesta backend (Python), usamos bibliotecas avanzadas como **Poppler (pdftocairo v25.12.0)** para el rasterizado de altísima resolución de documentos médicos y **Tesseract OCR** para extraer todo el texto encerrado en diagramas o fotocopias escaneadas.
*   **Fragmentación y Vectorización (Embeddings):** Los libros gigantes y Normas Técnicas son divididos en "chunks" algorítmicos. Cada pedazo es traducido a una matriz numérica usando la API comercial `text-embedding-004` u homólogas de OpenAI/Google.
*   **Almacenamiento y Recuperación Vectorial de Baja Latencia:** Usamos **Supabase con pgvector**. La búsqueda semántica (Búsqueda Vectorial) no consume tokens de LLM. Almacenamos millones de vectores y cuando el alumno pregunta, una consulta RPC (matemática relacional) en la DB extrae los 5 fragmentos más útiles en 0.2 segundos.
*   **Cero Alucinaciones:** El texto extraído de la BD se inyecta en el Prompt de Gemini 2.5 Flash con restricciones absolutas para basar su respuesta estrictamente en los libros oficiales extraídos.
*   **Agentic Capabilities:** Sigue utilizando **Function Calling** para consultar la base de datos de la plataforma e identificar información del usuario/cursos en vivo.

### 4.1.1. Estructura de Datos RAG y BD Vectors (`pgvector`)
Para posibilitar la búsqueda de información médica de manera semántica y el inyectado preciso de contexto, la tabla `documents` almacena los PDFs previamente fragmentados ("chunked") bajo el siguiente esquema fundamental:
*   **`content`**: Almacena el texto extraído y en crudo (raw text) de una porción del PDF (generalmente entre 500 y 1000 caracteres, ej: un párrafo largo del Harrison). Es **esta columna exacta** la que se inyecta en el Prompt oculto para que la IA lea y emita el diagnóstico clínico del paciente.
*   **`embedding`**: Almacena una matriz matemática (Array tridimensional de floats, como `[0.033, 0.057, -0.062...]`). Esta matriz es la traducción numérica de los significados que contiene la columna `content`. **La IA nunca lee el embedding**; el embedding es utilizado velozmente por la base de datos PostgreSQL (`pgvector`) para cruzar matemáticamente la similitud con la pregunta tecleada por el usuario (la cual también se vuelve vector fugazmente).
*   **`metadata`**: Objeto JSON que preserva el hilo conductor: almacena el nombre del PDF de origen, su categoría, la ruta original y el `chunk_index` (en qué número de orden cortamos este pedazo del libro), proveyendo trazabilidad bibliográfica para citas y referencias precisas.

### 4.2. Biblioteca Digital
Sistema de gestión de contenidos (CMS) personalizado.
*   **Organización:** Jerarquía de `Áreas -> Carreras -> Cursos -> Temas -> Libros`.
*   **Búsqueda:** Motor de búsqueda en tiempo real con filtrado por categoría.

### 4.3. Centro de Entrenamiento (Training Hub)
Módulo integral para el refuerzo del aprendizaje mediante práctica activa, refactorizado en v2.0 para escalabilidad y UX.

#### A. Arquitectura del Simulador (Clean Architecture)
El sistema utiliza un flujo unidireccional de datos con responsabilidades claras:
*   **Frontend (`quiz.js`, `simulator-dash.js`):** Gestiona el estado local, temporizadores y renderizado reactivo.
*   **Backend (`QuizController.js`):** Orquestador que valida reglas de negocio (Límites Freemium, Contextos).
*   **Dominio (`TrainingService.js`):** Núcleo inteligente que decide la estrategia de generación de preguntas (Híbrida).
*   **Infraestructura (`TrainingRepository.js`):** Abstracción de base de datos y optimización de consultas SQL.

#### B. Componentes Principales

1.  **Dashboard del Simulador (`simulator-dashboard.html`)**
    *   **Diseño Modular:** "Command Center" con 3 zonas: KPIs (Tope), Analítica (Centro) y Acción (Fondo).
    *   **Analítica Avanzada:**
        *   **Gráfico de Evolución:** Visualización de tendencias (`Chart.js`) basada en los últimos 10 intentos, normalizando puntajes a escala 0-20.
        *   **Diagnóstico IA:** Tarjeta con trigger manual que analiza patrones de error y sugiere áreas de refuerzo (Cards Mastered vs Weak Topics).
    *   **Modos de Entrenamiento (Grid Dinámico):**
        *   ⚡ **Simulacro Rápido:** 10 preguntas (Arcade).
        *   📚 **Modo Estudio:** 20 preguntas (Feedback inmediato).
        *   🧠 **Flashcards:** Acceso directo al sistema de Repaso Espaciado.

2.  **Motor de Examen (`quiz.js`)**
    *   **Estado Reactivo:** Gestión de preguntas, respuestas y progreso en el cliente.
    *   **Batch Loading:** Carga preguntas en lotes en segundo plano (`fetchNextBatch`) para mantener rendimiento fluido.
    *   **Constructor de Examen Custom (v2.0):** Modal avanzado (UI Glassmorphism) que permite al estudiante armar simulacros a la carta. Envía los parámetros `target` (ENAM, ENARM, SERUMS), `difficulty` y `areas` múltiples al backend.
    *   **Rotación Dinámica de Opciones (v2.0):** Ajuste algorítmico paramétrico en UI. Los simulacros base operan con 4 opciones clínicas. Aquellos tipificados como **ENARM** fuerzan la generación y renderizado de 5 opciones para simular rigurosidad real.
    *   **Rastreo de Datos Granular:** Capacidad de enviar metadata avanzada on-submit hacia el backend (ej. Array multidimensional y mapeo de sub-tópicos resueltos por cada pregunta exacta).

#### C. Lógica de Generación Híbrida (TrainingService v2.0)
Estrategia costo-eficiente para generar contenido infinito y altamente preciso usando Inteligencia Artificial Agéntica:
1.  **Bank First (Cost $0):** Consulta masiva al `question_bank` filtrando por Target, Arrays de Áreas Médicas, Dificultad y Contexto.
2.  **Smart Filtering:** Excluye preguntas vistas históricamente por el usuario (`user_question_history`) para garantizar novedad en cada intento.
3.  **AI Fallback Dinámico (Gemini 2.5 Flash):** Si el banco local es insolvente en preguntas "frescas", se conecta a un motor LLM pasándole en el *Prompt* perfiles estrictos ("Residente Junior/Senior"). El LLM genera preguntas estilo USMLE adaptadas, inyectando respuestas falsas pero patológicamente plausibles (Diagnósticos Diferenciales) y una explicación exhaustiva.
4.  **Auto-Learning Global:** Las nuevas preguntas incubadas por IA se persisten atómicamente en el Banco Global para futuros estudiantes (con indexación MD5 contra duplicidad).

#### D. Analítica de Rendimiento Profunda y JSONB (v2.0)
El sistema migró de reportes estáticos ("Tema general del Quiz") hacia un modelo granular subatómico alimentado por base de datos híbrida (Relacional/NoSQL Documental en PostgreSQL):
*   **Inyección JSONB:** Al emitir el examen (`submitQuizResult`), el backend recorre cada pregunta iterando Arrays, calculando cuántas preguntas se acertaron y fallaron *por Sub-Tema específico* dentro de un mismo simulacro multidisciplinario. El resultado compreso se guarda en la nueva columna `area_stats (JSONB)` de la tabla `quiz_history`.
*   **Motor KPI:** El endpoint `getStats` dispara queries analíticas sobre la nube estructurada JSON (`jsonb_object_keys`, `SUM`), lo que entrega agregaciones estadísticas vitales sin sobrecargar la estructura de la base de datos PostgreSQL.
*   **Dashboard Visual (Radar Chart UX):** El ecosistema Frontend intercepta dicho pipeline mediante la biblioteca `Chart.js`, renderizando un gráfico Poligonal tipo Radar (Spider) responsivo que señala visual y matemáticamente las Fortalezas (ej. Pediatría: 85%) y Fallas (ej. Cirugía: 20%) de un Doctor.

#### D. Base de Datos (Schema)
*   `question_bank`: Repositorio global de preguntas (compartido).
*   `quiz_history`: Registro de intentos, puntajes y puntos débiles.
*   `user_flashcards`: Tarjetas generadas automáticamente a partir de errores.
*   `decks`: Contenedores lógicos para tarjetas (System Decks vs Custom Decks).

#### E. Funcionalidades Clave
*   **Flashcards Automáticas:** Al fallar una pregunta en Simulacro Médico, se crea una flashcard automáticamente en el mazo "Repaso Medicina".
*   **Simulacro Rápido vs Estudio:** Configuración dinámica de límites (`limit=10` vs `limit=20`) desde el backend.
*   **Navegación Contextual:** Flujo fluido entre Dashboard -> Quiz -> Resultados -> Dashboard, manteniendo el contexto (ej: Medicina).

### 4.4. Analytics & Dashboard (Node.js Native)
Sistema de inteligencia de datos completamente integrado en el backend principal.
*   **Algoritmo de Clustering:** Se implementó el **Índice de Jaccard** (Similitud de conjuntos) para agrupar términos de búsqueda similares (ej: "ing sistemas" ≈ "ingeniería de sistemas") y generar series de tiempo precisas.
*   **KPIs:** Métricas de adopción del chat, tasa de "búsquedas educativas" (vs navegacionales) y CTR de sugerencias de IA.

### 4.5. Pivote Productivo a EdTech Médico
Estratégicamente, la plataforma ha dado un giro desde fungir como una amplia "biblioteca genérica masiva" (riesgosa comercialmente por copyright) hacia un **Hub Formativo EdTech** de alto rigor académico. 
*   **Foco en Material Público y Vital:** Reestructuración de la base de conocimiento para priorizar **GPC (Guías de Práctica Clínica), NTS (Normas Técnicas Sanitarias)** de MINSA/EsSalud, Regulaciones Legales y Bancos de preguntas oficiales (ENAM, Residentado, SERUMS), ofreciendo un ecosistema blindado a reclamos de terceros.
*   **Gamificación Formativa:** Potenciación del esfuerzo mental mediante un entorno que obliga a interactuar y competir en lugar de consumir pasivamente la lectura.

---

## 5. Roadmap & Mejoras Futuras

### 5.1. Gráfico de Retención (Heatmap)
Implementación de una visualización de actividad diaria estilo GitHub ("Contribution Graph").
*   **Objetivo:** Gamificar la constancia del estudio.
*   **Fuente de Datos:** Agregación de `quiz_history` (intentos de quiz) y `user_flashcards` (repasos realizados).

### 5.2. Mazos Anidados (Nested Decks)
Evolución del sistema de gestión de mazos para soportar jerarquías profundas (Estilo Anki: `Categoría::Curso::Tema`).
*   **Propuesta Técnica:** Adopción de modelo híbrido (Parent ID en base de datos + UI de Árbol).
*   **Funcionalidad:**
    *   **Sub-mazos Infinitos:** Organización granular del conocimiento.
    *   **Repaso Agregado:** Posibilidad de estudiar un nodo padre (ej: "Inglés") y recibir tarjetas de todos sus sub-mazos mezcladas.
    *   **Gestión:** Interfaz de Explorador de Archivos para mover y reorganizar mazos.

---

## 6. 📂 Estructura de Carpetas Detallada

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
    # El servidor verificará automáticamente extensiones de PostgreSQL (unaccent, fuzzystrmatch).
    ```

    # NOTA: Este servicio está marcado como DEPRECATED en la arquitectura actual.
    # La lógica de ML reside ahora en `application/domain/services/mlService.js`.
    # Solo necesario si se requiere ejecutar scripts de mantenimiento antiguos.
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
*   **Extensiones de Base de Datos:** Se habilitaron `unaccent` (para búsquedas insensibles a tildes) y `fuzzystrmatch` (para algoritmo Levenshtein) en PostgreSQL para robustecer la búsqueda y evitar errores por typos.

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
*   **Interacción:** Al alcanzar el límite, se muestra un *Paywall Modal* ("Soft Block") invitando a suscribirse. El control de este bloqueo se realiza tanto en frontend (`chat.js`) como en backend (Middleware).

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

---

## 12. 🗑️ Guía de Funcionalidad: Eliminación de Cuenta

Esta sección detalla el flujo de eliminación de cuenta ("Danger Zone"), diseñado para ser seguro, irreversible y adaptativo según el método de autenticación del usuario.

### 12.1. Visión General
La funcionalidad permite a cualquier usuario registrado eliminar permanentemente su cuenta y todos los datos asociados (historial de chats, progreso, suscripción) de la plataforma.
*   **Ubicación:** Perfil de Usuario (`/profile`) -> Tarjeta "Zona de Peligro".
*   **Consecuencia:** Eliminación física de datos en PostgreSQL y baja en Supabase Auth (`Hard Delete`).

### 12.2. Flujo A: Usuarios con Correo y Contraseña
Para usuarios que se registraron manualmente usando email/password.
1.  **Solicitud:** El usuario hace clic en "Eliminar Cuenta".
2.  **Verificación:** Aparece un modal solicitando la **contraseña actual**.
3.  **Validación Backend:**
    *   Se envía la contraseña al endpoint `/api/auth/delete-account`.
    *   El backend verifica la contraseña re-autenticando con Supabase (`signInWithPassword`).
    *   Si es correcta, procede con la eliminación.
4.  **Limpieza:** Se fuerza el cierre de sesión (`signOut`) y limpieza de almacenamiento local.

### 12.3. Flujo B: Usuarios OAuth (Google)
Para usuarios que inician sesión con Google, quienes **no tienen** una contraseña establecida en la plataforma.
1.  **Detección:** El frontend detecta automáticamente si el usuario es de tipo OAuth (Provider: `google`).
2.  **Verificación Adaptativa:**
    *   En lugar de pedir contraseña (que no tienen), el modal solicita una **Confirmación Textual**.
    *   **Instrucción:** "Escribe 'ELIMINAR' para confirmar".
3.  **Validación Backend:**
    *   El servicio `authService.js` verifica en Supabase (vía Admin API) que el usuario efectivamente provenga de Google.
    *   Si el proveedor es correcto, se omite el chequeo de contraseña ("bypass") y se autoriza la eliminación.
4.  **Seguridad:** Este flujo impide que un usuario de email intente borrar su cuenta sin contraseña fingiendo ser de Google, ya que la validación del proveedor es del lado del servidor (Source of Truth).

### 12.4. Prevención de "Cuentas Zombie"
Se implementó un mecanismo de cierre de sesión atómico (`Async Logout`) para evitar que una cuenta recién borrada se regenere automáticamente:
*   Al confirmar el borrado, el sistema **espera** (`await`) a que la sesión en la nube se destruya completamente.
*   Posteriormente, elimina agresivamente el `authToken` local.
*   Finalmente, redirige a la página de inicio como usuario anónimo.

---

## 13. 📉 Análisis de Rendimiento y Diagnóstico de Latencia

Este apartado documenta las causas externas identificadas que afectan la percepción de carga ("Infinite Loading") y la visualización de activos en el entorno de producción (Split Deployment: Vercel + Render).

### 13.1. Factor Crítico: "Cold Start" en Render (Backend)
*   **Descripción:** El servicio gratuito de Render entra en suspensión tras 15 minutos de inactividad.
*   **Impacto:** La primera "llamada" para despertar al servidor tarda entre **50 a 90 segundos**.
*   ** Síntoma en Frontend:** El usuario ve la estructura estática (HTML/CSS servido por Vercel) inmediatamente, pero los datos dinámicos (lista de libros, cursos) dejan el spinner de carga activo indefinidamente ("Cargando...").
*   **Causa del "Cuelgue":** Si el frontend lanza múltiples peticiones simultáneas (`Promise.all` con `/api/books`, `/api/courses`, `/api/careers`) *mientras* el servidor despierta, puede saturar la instancia mínima (0.5 CPU), provocando un *timeout* o reinicio del proceso antes de responder.

### 13.2. Latencia de Red y Límites del Navegador
*   **Límite de Conexiones:** Los navegadores (Chrome/Edge) limitan a **6 conexiones simultáneas** por dominio (HTTP/1.1).
*   **Cuello de Botella:** Al recibir la lista de 50+ libros del backend, el navegador intenta descargar 50 imágenes de `hubacademia.vercel.app` al mismo tiempo. Esto crea una cola de espera (Waterfall), haciendo que las últimas imágenes tarden mucho en aparecer, simulando una "carga infinita".

### 13.3. Inconsistencia de Rutas Estáticas (Vercel - GitHub)
*   **Case Sensitivity:** Vercel (Linux) distingue mayúsculas/minúsculas, mientras que Windows (Desarrollo local) no.
    *   *Ejemplo:* Si la BD dice `assets/Libro1.JPG` pero en GitHub el archivo es `assets/libro1.jpg`, en local funciona, pero en Vercel devolverá **404 Not Found**.
*   **Sincronización:** Si se añaden registros a la Base de Datos (Backend) pero no se suben las imágenes correspondientes a la carpeta `public/assets` del repositorio GitHub, Vercel no tendrá qué servir.

### 13.4. Agotamiento de Conexiones a Base de Datos
*   **Pool Limit:** Supabase (Capa Gratuita) tiene un límite estricto de conexiones concurrentes.
*   **Riesgo:** Si el backend abre una conexión nueva por cada petición de la API sin reutilizarlas (Singleton Pattern), el pool se llena rápidamente durante el "despertar" del servidor, haciendo que las siguientes consultas queden en espera indefinida (*hanging*), resultando en una página que nunca termina de cargar los datos.