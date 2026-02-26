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
        *   🎯 **Simulacro Real:** 100 preguntas (Mock Test oficial, dificultad forzada).
        *   🧠 **Flashcards:** Acceso directo al sistema de Repaso Espaciado.

2.  **Motor de Examen (`quiz.js`)**
    *   **Estado Reactivo:** Gestión de preguntas, respuestas y progreso en el cliente.
    *   **Batch Loading:** Carga preguntas en lotes de 5 en segundo plano (`fetchNextBatch`) para mantener rendimiento fluido.
    *   **Rotación Dinámica de Opciones:** Los simulacros para ENAM y PRE-INTERNADO operan con 4 opciones. Aquellos tipificados como **RESIDENTADO** fuerzan la generación y renderizado de **5 opciones** para simular la rigurosidad del examen CONAREME real.
    *   **Rastreo de Datos Granular:** Envío de metadata avanzada on-submit (target, áreas, dificultad, respuestas por pregunta) hacia el backend para analítica JSONB.

3.  **Configuración de Examen (`simulator-dash.js` - Modal v2.0)**

    Sistema de personalización del simulacro alineado con el sistema educativo médico peruano:

    **Tipos de Examen Objetivo:**

    | Target | Descripción | Opciones | Estilo IA |
    | :--- | :--- | :--- | :--- |
    | **ENAM** | Examen Nacional de Medicina (ASPEFAM). Obligatorio para egresados. 180-200 preguntas | 4 | Clínica general, fisiopatología, diagnóstico clásico. **Incluye NTS básicas** de Salud Pública (Vacunas, TB, Materno-Perinatal, MAIS-BFC). Certificado de Defunción (fijo). Enfoque: "El Médico de Posta" |
    | **PRE-INTERNADO** | Examen de ingreso al internado médico (EsSalud) | 4 | Seguridad del paciente. Categorización de establecimientos (I-1 al III-2), triaje, Consentimiento Informado. Ciencias básicas aplicadas (ej. anatomía de fracturas). Enfoque: "Seguridad del Paciente" |
    | **RESIDENTADO** | Examen Nacional de Residentado Médico (CONAREME) | 5 | Especialidad avanzada: diagnóstico diferencial exhaustivo, Gold Standard, tratamiento 2da/3ra línea. Investigación: RR, OR, sesgos. Gestión: Ishikawa, FODA. 90% casos clínicos. Enfoque: "El Médico Científico/Gerente" |

    **Niveles de Dificultad (Basados en exigencia cognitiva, NO en materia):**

    | Nivel | Evalúa | Ejemplo |
    | :--- | :--- | :--- |
    | **Básico** | Memoria pura: etiologías, definiciones, mecanismos | "¿Cuál es el agente causal de la sífilis?" |
    | **Intermedio** | Análisis clínico: viñetas diagnósticas | Caso con fiebre + manchas → pedir diagnóstico |
    | **Avanzado** | Toma de decisiones: manejo terapéutico, excepciones | Tratamiento alternativo en alérgico a 1ra línea |

    **23 Áreas de Estudio en 4 Grupos:**

    *   **Grupo A — Ciencias Básicas:** Anatomía, Fisiología, Farmacología, Microbiología y Parasitología.
    *   **Grupo B — Las 4 Grandes:** Medicina Interna, Pediatría, Ginecología y Obstetricia, Cirugía General.
    *   **Grupo C — Especialidades Clínicas:** Cardiología, Gastroenterología, Neurología, Nefrología, Neumología, Endocrinología, Infectología, Reumatología, Traumatología.
    *   **Grupo D — Salud Pública y Gestión:** Salud Pública y Epidemiología, Gestión de Servicios de Salud, Ética Deontología e Interculturalidad, Medicina Legal, Investigación y Bioestadística, Cuidado Integral.

    Las áreas son idénticas para los 3 tipos de examen. Lo que cambia es el estilo del prompt de IA y las directrices de generación.

    **UX del Modal:** Renderizado dinámico con sub-headers azules por grupo, scrollable (`max-height: 85vh`). Tooltip de primera visita (15s) + efecto neón pulsante en el botón "Configurar Examen" hasta que el usuario guarde una configuración.

#### C. Lógica de Generación Híbrida (TrainingService v2.0)
Estrategia costo-eficiente para generar contenido infinito y altamente preciso usando Inteligencia Artificial Agéntica:
1.  **Bank First (Cost $0):** Consulta masiva al `question_bank` filtrando por Target (ENAM/PRE-INTERNADO/RESIDENTADO), Arrays de Áreas Médicas (23 áreas), Dificultad y exclusión de preguntas vistas.
2.  **Smart Filtering (Anti-Repetición 24h):** Excluye preguntas vistas por el usuario en las últimas 24 horas (`user_question_history`) con query `seen_at > NOW() - INTERVAL '24 hours'`. Después de 24h, las preguntas pueden reaparecer ("Olvido Saludable").
3.  **AI Fallback Dinámico (Gemini 2.5 Flash):** Si el banco local no tiene suficientes preguntas frescas, se conecta al LLM con un prompt que incluye:
    *   **Directrices por tipo de examen:** Diferentes instrucciones para ENAM (clínico universal), PRE-INTERNADO (atención primaria/NTS) y RESIDENTADO (especialidad avanzada).
    *   **Contexto RAG:** Documentos reales del MINSA buscados semánticamente en el vector store.
    *   **Deduplicación por Contexto Negativo:** 15 preguntas previas del banco inyectadas como "preguntas prohibidas" en el prompt.
    *   **Semantic Sub-Drift:** Rotación aleatoria de enfoque clínico (etiología, diagnóstico, tratamiento, complicaciones, prevención) para garantizar diversidad temática.
4.  **Auto-Learning Global:** Las nuevas preguntas generadas por IA se persisten atómicamente en el Banco Global (con `ON CONFLICT` contra duplicidad) y se marcan como vistas para el usuario.
5.  **Protección Financiera (Mock Test):** En simulacros de 100+ preguntas, se bloquea la generación masiva por IA y se retorna solo preguntas del banco existente.

#### D. Analítica de Rendimiento Profunda y JSONB (v2.0)
El sistema migró de reportes estáticos ("Tema general del Quiz") hacia un modelo granular subatómico alimentado por base de datos híbrida (Relacional/NoSQL Documental en PostgreSQL):
*   **Inyección JSONB:** Al emitir el examen (`submitQuizResult`), el backend recorre cada pregunta iterando Arrays, calculando cuántas preguntas se acertaron y fallaron *por Sub-Tema específico* dentro de un mismo simulacro multidisciplinario. El resultado compreso se guarda en la nueva columna `area_stats (JSONB)` de la tabla `quiz_history`.
*   **Motor KPI:** El endpoint `getStats` dispara queries analíticas sobre la nube estructurada JSON (`jsonb_object_keys`, `SUM`), lo que entrega agregaciones estadísticas vitales sin sobrecargar la estructura de la base de datos PostgreSQL.
*   **Dashboard Visual (Radar Chart UX):** El ecosistema Frontend intercepta dicho pipeline mediante la biblioteca `Chart.js`, renderizando un gráfico Poligonal tipo Radar (Spider) responsivo que señala visual y matemáticamente las Fortalezas (ej. Pediatría: 85%) y Fallas (ej. Cirugía: 20%) de un Doctor.

#### E. Base de Datos (Schema)
*   `question_bank`: Repositorio global de preguntas (compartido). Columnas clave: `domain`, `target` (ENAM/PRE-INTERNADO/RESIDENTADO), `topic`, `difficulty`, `times_used`.
*   `quiz_history`: Registro de intentos, puntajes y `area_stats` JSONB granular.
*   `user_question_history`: Anti-repetición por usuario (`user_id`, `question_id`, `seen_at`, `times_seen`).
*   `user_flashcards`: Tarjetas generadas automáticamente a partir de errores en simulacros.
*   `decks`: Contenedores lógicos para tarjetas (System Decks vs Custom Decks).

#### F. Funcionalidades Clave
*   **Flashcards Automáticas:** Al fallar una pregunta en Simulacro Médico, se crea una flashcard automáticamente en el mazo "Repaso Medicina" (front = pregunta, back = explicación correcta).
*   **Simulacro Rápido / Estudio / Real:** Configuración dinámica de límites (`limit=10` / `limit=20` / `limit=100`) desde el backend.
*   **Sistema Freemium de Vidas Globales:** 3 vidas de por vida para usuarios gratuitos. Se consume 1 vida al iniciar un examen (Ronda 1) o al usar funciones de Repaso (Estudiar/Generar IA). Verificación server-side vía `UsageService.checkAndIncrementUsage()`. Paywall modal con corona dorada al agotar vidas.
*   **Navegación Contextual:** Flujo fluido entre Dashboard -> Quiz -> Resultados -> Dashboard, manteniendo el contexto (ej: Medicina).
*   **Mazos Anidados (Nested Decks):** Sistema de gestión de mazos híbrida en árbol (Estilo Anki: `Categoría::Curso::Tema`) con soporte para sub-mazos infinitos.
*   **Gráfico de Retención:** Visualización analítica de barras ("Activity Chart") en el modal de estadísticas para rastrear la constancia diaria de estudio del usuario sobre los últimos 14 días.

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

### 5.1. Modo Voz (Speech-to-Text / TTS)
Implementar interacción directa conversando con el tutor usando WebRTC o un wrapper para reconocimiento.

### 5.2. App Móvil Nativa
Wrapper en React Native o Flutter para potenciar notificaciones push de repaso espaciado.

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

---

## 14. ⚙️ Flujo Avanzado: Simulacros Personalizados (Examen, Dificultad y Áreas)

El sistema de Simulador Médico permite a los usuarios crear exámenes altamente granulares, combinando el Examen Objetivo (Ej. ENAM, SERUMS), la Dificultad técnica, y múltiples Áreas de Estudio simultáneas. Este es el flujo completo de datos desde la UI hasta las analíticas:

### 14.1. Configuración Frontend y Persistencia
*   **Selección:** A través del Modal de Configuración en el Dashboard, el usuario elige:
    *   `target`: ENAM, SERUMS, o ENARM.
    *   `difficulty`: Básico (teórico), Intermedio (casos clínicos), o Avanzado (complejo).
    *   `areas`: Un arreglo dinámico de especialidades (ej: `['Cardiología', 'Pediatría', 'Salud Pública']`).
*   **Persistencia:** La configuración se almacena en `localStorage` (como `simActiveConfig`) para sobrevivir navegaciones o recargas de página, garantizando que el usuario no pierda sus filtros al iniciar un "Simulacro Rápido" o "Modo Estudio".
*   **Envío:** Al iniciar el examen, estos parámetros se envían mediante un POST al endpoint `/api/quiz/start`.

### 14.2. Procesamiento Backend e Híbrido Artificial (IA)
El `quizController` recibe los parámetros y delega la tarea al `TrainingService`.
1.  **Consulta a Base de Datos (Prioridad #1):** El sistema intenta primero extraer preguntas del `question_bank` que coincidan exactamente con el `target`, la `difficulty` y *cualquiera* de las `areas` solicitadas (`topic = ANY($1::text[])`).
2.  **Fallback a Vertex AI (Prioridad #2):** Si el banco local no tiene suficientes preguntas inéditas (excluyendo las ya vistas por el usuario), entra en acción el motor LLM (Gemini 2.5 Flash).
3.  **Prompt Condicional Dinámico:**
    *   **Contexto RAG:** La IA utiliza Búsqueda Vectorial para inyectar guías clínicas reales basándose en el "Target" (ej: Normas del MINSA para SERUMS) y en la lista de áreas combinadas.
    *   **Especificidad del Target (Exámenes Médicos):**
        *   **ENAM (Examen Nacional de Medicina):** Avalúa el conocimiento clínico teórico general de un interno. Se prohíbe explícitamente a la IA incluir preguntas sobre flujogramas puramente administrativos o aspectos específicos de las Normas Técnicas de Salud (NTS). Enfoque en diagnóstico clásico y clínica.
        *   **SERUMS (Servicio Rural):** Enfocado enteramente en el trabajo de primer nivel de atención (Puesto y Centro de Salud), requiriendo un enfoque 100% en las Normas Técnicas de Salud (NTS) vigentes del MINSA y programas de salud pública peruanos.
        *   **ENARM (Residentado Médico):** Examen para futuros especialistas. Obliga a la IA a proveer casos clínicos complejos, manejo de excepciones, tratamientos de segunda línea y uso de "Gold Standards" diagnósticos.
    *   **Dificultad Estricta:** El prompt varía drásticamente. Si el usuario elige "Básico", se prohíbe la redacción de viñetas o casos clínicos largos, forzando preguntas de opciones directas, conceptos y etiologías. Para "Intermedio/Avanzado", se fuerza el uso de casos clínicos progresivamente más complejos.
    *   **Etiquetado Exacto:** Se le exige a la IA que retorne, como parte del JSON de cada pregunta generada, el sub-atributo `"topic"` indicando a cuál de las áreas seleccionadas corresponde la pregunta inventada.

### 14.3. Persistencia de Resultados y Analíticas Sensibles al Contexto
*   **Guardado en DB (El Fallo Fundamental de Multi-Área):** Históricamente, al enviar las respuestas (`/api/quiz/submit`), el backend forzaba ciegamente el nombre de la *primera* área seleccionada a las 10, 20 o 50 preguntas del lote (Ej. guardando todo como "Cardiología").
    *   *Solución Implementada:* El repositorio fue modificado (`trainingRepository.js`) para extraer dinámicamente el `q.topic` generado individualmente por la IA, guardando de forma granular el origen de cada pregunta.
*   **Etiquetado del Examen Padre:** Para no contaminar el historial del usuario (`quiz_history`) con el nombre de una sola especialidad cuando se abarcan varias, el frontend evalúa la longitud del arreglo de áreas seleccionadas (`state.areas.length`). Si es mayor a 1, la "carátula" del examen se grabará permanentemente en base de datos como **"Multi-Área"**.
*   **Columna JSONB `area_stats`:** En la tabla `quiz_history`, se crea de manera dinámica un objeto JSON que agrupa aciertos y errores por especialidad. Por ejemplo:
    ```json
    {
      "Cardiología": { "correct": 4, "total": 5 },
      "Pediatría": { "correct": 2, "total": 5 }
    }
    ```
*   **Desagregación Lateral en PostgreSQL:** Para leer este JSONB de cara al Dashboard, se utiliza la función `jsonb_each()` de manera lateral en el bloque `FROM` (`FROM quiz_history, jsonb_each(area_stats)`). Esto descompone la matriz JSON limpiamente, permitiendo sumar aciertos globales por materia mediante funciones agregadas `SUM()`. (Nota: utilizar `jsonb_object_keys()` directamente dentro de `SUM()` arroja un fatal error SQL al ser una *set-returning function*).
*   **Visualización en UX (Radar Chart):** El endpoint `/api/quiz/stats` extrae las llaves de este JSONB, suma los valores y calcula la Precisión (Accuracy %). Estos datos se envían de vuelta al Frontend, alimentando el **Gráfico de Radar (Dominio por Áreas)**. Así, el estudiante diagnostica visualmente qué especialidad exacta dentro de su mix de estudio está fallando más y dónde sus fortalezas son sólidas.

### 14.4. Análisis de Patrones de Error e Inteligencia Artificial
Como capa final del dashboard, se cuenta con una herramienta de **Diagnóstico de Rendimiento por IA**:
*   **Funcionamiento:** Tras completar varios simulacros, el sistema acumula los KPIs (incluyendo las áreas más fuertes y más débiles detectadas en el JSONB).
*   **Motor de Insights:** Al hacer clic en "Generar Análisis", la plataforma procesa estas estadísticas cacheadas en `simulator-dash.js`.
*   **Resultados Visibles:** Emite recomendaciones naturalizadas (UX Conversacional) resaltando:
    *   *Puntos Fuertes:* Reconoce el área con mayor dominio (ej. `strongest_topic`) para mantener la motivación.
    *   *Áreas de Mejora:* Identifica el cuello de botella técnico (ej. `weakest_topic`) y aconseja enfocar las siguientes rondas de estudio y configuración de simulacros en dicha especialidad médica para nivelar el Gráfico Radial.

---

## 15. 🏛️ Arquitectura del Ecosistema de Simulacros

Para ofrecer versatilidad extrema al proceso de estudio, la plataforma divide el flujo del motor de preguntas en tres **Modos de Examen** distintos, cada uno con reglas de negocio asimétricas para la interfaz (UX) y el procesamiento en la Base de Datos.

### 15.1. Tipos de Examen y Modos de Ejecución

1.  **Simulacro Rápido (Fast Mode)**
    *   **Propósito:** Repasos de micro-momentos (microlearning) en transporte público o salas de espera.
    *   **Volumen:** Fijo a 10 preguntas.
    *   **UX del Feedback:** Interfaz amigable. Tras presionar una alternativa, el sistema revela instantáneamente si es correcta (verde) o incorrecta (roja), y despliega una tarjeta de justificación médica inferior.
    *   **Métricas:** Sus resultados nutren de forma ligera a las estadísticas agregadas sin desbalancear la retención profunda.

2.  **Modo Estudio (Study Mode)**
    *   **Propósito:** Anclaje de conocimiento a mediano plazo y estudio focalizado.
    *   **Volumen:** Configurable (10, 20 o 50 preguntas).
    *   **UX del Feedback:** Idéntico al Simulacro Rápido (revelación inmediata + justificación clínica). El estudiante toma su tiempo para leer las explicaciones largas generadas por la IA después de cada decisión.
    *   **Cronómetro:** Relajado / Invisible, priorizando precisión sobre velocidad.

3.  **Simulacro Real (Real Mock - Examen Oficial)**
    *   **Propósito:** Simulador de presión extrema para certificar viabilidad de aprobación en ENAM/SERUMS/ENARM.
    *   **Volumen:** Obligatoriamente anclado a 100 preguntas.
    *   **Cronómetro:** Temporizador de Barra Superior rígido de 120 minutos (7200 segundos). Al llegar a `00:00`, intercepta al usuario arrebatándole el control y forzando la evaluación.

### 15.2. El "Modo Ciego" (Blind Mode) y la UI de Revisión
Como eje central de la experiencia del **Simulacro Real**, interviene el algoritmo de *Blind Mode*:
*   **Aislamiento Psicológico:** Cuando el módulo `quiz.js` detecta `limit === 100`, apaga automáticamente *toda* la colorimetría de feedback y desactiva el renderizado de la "Justificación IA".
*   **Flujo Estocástico:** El clic del estudiante (ej. opción C) solo genera un pulso azul pasivo de 600ms e inmediatamente lo expulsa hacia la siguiente pregunta. Esto impide al alumno saber si está aprobando o reprobando durante el transcurso del certamen de 120 minutos.
*   **Corrección (Exam Review UI):** Dado que la información clínica estuvo oculta, al presionar "Salir" o agotar el cronómetro, la medalla final de resultado ofrece un botón **"Ver Corrección del Examen"**. Este botón destruye visualmente el juego e inyecta dinámicamente ("Infinite Scroll") un *feed* vertical reconstruyendo la totalidad del examen donde, por primera vez, el estudiante puede visualizar qué marco (en rojo si erró), la respuesta dorada real, y la justificación médica.

### 15.3. El Motor de Forzado de Dificultad (Override System)
Para evitar que un estudiante adultere las estadísticas rindiendo un "Simulacro Real" de 100 preguntas con un filtro artificial suavizado en su Dashboard (Ej: Configurar "ENARM" pero en dificultad "Básico"), el backend implementa un mecanismo de **Forzado Oficial**:
*   En `trainingService.js`, cuando se procesa un flujo de `limit >= 100`, el sistema **sobrescribe ignominiosamente** el `difficulty` enviado por el navegador.
*   Si el `target` solicitado es `ENARM`, se sobreescribe rígidamente a **Avanzado** (Alta complejidad, gold standards).
*   Si el `target` es `ENAM` o `SERUMS`, se ancla irreversiblemente a **Intermedio** (Casos clínicos estándar, NTS).
Esto certifica matemáticamente el rigor de la plataforma frente a sus usuarios.

### 15.4. Impacto Dual en la Base de Datos (100 Preguntas Simultáneas)
El volumen masivo del "Simulacro Real" opera a dos niveles asíncronos bajo la superficie (`analyticsController` & `trainingRepository`):
1.  **Explosión en el Dashboard:** La calificación de las 100 variables segmentadas choca contra la BD, provocando un rediseño inmediato, drástico y preciso de las fortalezas y debilidades del estudiante, evidenciables de inmediato en el *Gráfico Radial* y en las *Tendencias Lineales*.
2.  **Generación de Fallos (Flashcards):** Durante la corrección silenciosa, cada una de las preguntas que el estudiante falló en el Modo Ciego son depositadas automáticamente por la rutina `saveStudyCards()` en su `flashcards_deck` predeterminado (Centro de Repaso), obligándolo a lidiar a corto plazo con los vacíos conceptuales que mermaron su nota oficial.

---

## 16. 🧠 Deduplicación Avanzada de IA y Semantic Sub-Drift

Para resolver el problema del LLM repitiendo conceptos clínicos a través de múltiples simulacros generados secuencialmente, se implementó una arquitectura de deduplicación de 3 capas en la inyección de contexto:

### 16.1. Capa 1: Exclusión en Base de Datos
El sistema intenta primero extraer preguntas no vistas en las últimas 24 horas del banco de datos. Solo llama al modelo GenAI (Gemini) si el banco local se queda sin preguntas suficientes para satisfacer el requisito del examen actual, reduciendo activamente el consumo de tokens y latencia.

### 16.2. Capa 2: Contexto Negativo Aleatorio (Randomized RAG Constraint)
Cada vez que el backend (`trainingService.js`) invoca a Gemini, `trainingRepository.js` extrae en paralelo un bloque ligero de 15 preguntas *aleatorias* del banco histórico pertenecientes a esa misma área (Ej. "Cardiología"). Estas se inyectan en el prompt maestro bajo una directiva restrictiva absoluta ("Regla de Oro de Deduplicación"), prohibiéndole a la IA evaluar o retornar los escenarios clínicos contenidos en este extracto, forzando matemáticamente la novedad.

### 16.3. Capa 3: Rotación Dinámica de Enfoque (Semantic Sub-Drift)
Se instauró un sistema de "Entropía Clínica". El array `clinicalFocuses` elige aleatoriamente un ángulo de evaluación (Ej. "Etiología y Fisiopatología", "Tratamiento de Primera Línea", "Diagnóstico por Imágenes"). El prompt le ordena a Gemini que concentre un alto porcentaje de las preguntas requeridas específicamente bajo ese prisma diagnóstico, evitando que la IA cicle crónicamente alrededor de las mismas patologías típicas.

---

## 17. 📦 Escalabilidad de Dominio Múltiple y Panel de Inyección

Para transformar el motor de "Simulador Médico" a un "Hub Académico Multi-Dominio" (Ej. Medicina, Inglés, etc.) de forma sostenible, se rediseñó la ingesta y persistencia de datos:

### 17.1. Hydration Activa (Configuración JSONB) 
Se erradicó la gestión de estado basada puramente en el `localStorage` del navegador. Se implementó la tabla `user_simulator_preferences` utilizando el tipo de dato **JSONB** nativo de PostgreSQL. Al cargar el Dashboard, el Frontend consume la API REST `GET /api/users/preferences?domain=medicine` y restaura exactamente el *Target*, *Dificultad* y selección multi-área transversal a todos los dispositivos móviles y navegadores del usuario (Cross-Device Sync).

### 17.2. Inyección Masiva (Bulk Admin Panel)
En el portal `/admin`, se implementó una interfaz gráfica JSON habilitando a los administradores a volcar miles de preguntas pre-elaboradas hacia el `question_bank` en segundos. Esto se respalda con un controlador asíncrono robusto (`/api/admin/questions/bulk`) ejecutado sobre una única transacción SQL (`BEGIN/COMMIT`) capaz de soportar operaciones atómicas de ingestión masiva mitigando el consumo en la API de Google Vertex AI.

### 17.3. Motor de Imágenes Estáticas Desacoplado (CDN jsDelivr)
Para reducir agresivamente el consumo de Ancho de Banda (Transferencia) de la capa gratuita del servidor Backend (Supabase/Vercel) al cargar casos clínicos radiológicos o multimedia, se integró soporte nativo para `image_url` en los esquemas de visualización del Quiz (`quiz.html`). Como directiva oficial, el Administrador aloja directamente los pesados *assets* de imagen en un branch de infraestructura de GitHub y propaga estas imágenes instantáneamente al frontend mediante la red de Edge Caching global de **jsDelivr**, resultando en un costo marginal de transferencia de $0 para la institución educativa.

### 17.4. Gestión de Preguntas Individuales y UI de Administración (CRUD Full)
Como evolución lógica a la inyección masiva, se desarrolló una suite completa de administración unitaria (`GET`, `POST`, `PUT`, `DELETE` en `/api/admin/questions`). En el portal Admin, la pestaña "Preguntas" ahora presenta un Grid dinámico robusto que renderiza metadatos médicos (`domain`, `target`). Se construyó un modal de edición avanzado que permite a los supervisores importar JSON o utilizar un formulario generativo para corregir sobre la marcha opciones o explicaciones de la IA sin depender exclusivamente de operaciones masivas (Bulk).

---

## 18. 🛡️ Integridad de Datos y Reparación de Caché Infinito (Anti-Repetición)

Se detectó una falla crítica estructural en la persistencia del historial de usuario y la indexación criptográfica que permitía a la plataforma ciclar sobre las mismas preguntas repetidamente ignorando el periodo de enfriamiento de 24 horas. 

### 18.1. Restauración de Restricciones y Caché "Time Capsule" (DDL PostgreSQL)
*   **Problema Dual:** La transacción optimista `ON CONFLICT (user_id, question_id) DO NOTHING` presentaba dos fallas fatales. Primero, PostgreSQL **carecía** de una restricción `UNIQUE` en la tabla `user_question_history`, lanzando excepciones silenciosas. Segundo, incluso si la inserción funcionaba, la instrucción `DO NOTHING` congelaba mecánicamente el campo `seen_at` en el pasado. Esto creaba una "Cápsula de Tiempo" donde el algoritmo de exclusión (`seen_at > NOW() - INTERVAL '24 hours'`) percibía que el estudiante no había visto la pregunta recientemente, atrapándolo en un bucle infinito que repetía las mismas métricas una y otra vez.
*   **Solución:** Se intervino en vivo el esquema añadiendo `ALTER TABLE user_question_history ADD CONSTRAINT unique_user_question UNIQUE (user_id, question_id);` y se recodificó el Driver en NodeJS reemplazando `DO NOTHING` por `DO UPDATE SET seen_at = CURRENT_TIMESTAMP, times_seen = user_question_history.times_seen + 1;`. Al restaurarse el índice y obligar al reloj a actualizarse, la API filtró existosamente todas las repeticiones rindiendo una tasa efímera del 100%.

### 18.2. Mapeo Ortogonal de Variables (Domain vs Target)
*   **Problema:** El backend enviaba invariablemente `domain="ENAM"`, bloqueando a la IA RAG la lectura del propio banco, permitiendo infinitas repeticiones temáticas.
*   **Solución:** En `trainingService.js` se instauró un riguroso desacoplamiento léxico creando variables `dbDomain` ('medicine') y `dbTarget` ('ENAM'). Esta dicotomía unificó el RAG alimentador (15 preguntas límite excluyentes) a lo largo de todos los motores (Simulador Nativo y Quiz Arena).

### 18.3. Analytics Unitarios y Hashes Criptográficos
*   **Métricas Dinámicas (`times_used`):** Se interceptó lógicamente el *query* de recolección principal (`findQuestionsInBankBatch`). Ahora el motor PostgreSQL realiza una operación atómica sub-query actualizando `UPDATE question_bank SET times_used = times_used + 1` de manera transparente para cada bloque recuperado, sirviendo para futuras proyecciones de popularidad y desgaste de banco.
*   **Huellas MD5 Manuales:** Las preguntas añadidas individualmente por administradores carecían de Hash, generando tuplas Null. El `adminController.js` ahora importa `crypto` (Node.js nativo) y forja de manera imperativa una huella Hexagonal `MD5` (`Topic + Pregunta + Opciones`) asegurando la estabilidad global del motor transaccional `ON CONFLICT`.

---

## 19. 🎨 Refinamientos Arquitectónicos y Lógicos en "Quiz Arena"
Se implementaron una serie de mejoras estructurales para la variante "Arcade" del simulador (Quiz Arena) orientadas a la retención de usuarios, corrección de desincronizaciones de Estado (UI vs JS) y optimización del lienzo visual.

### 19.1. Sincronización de Estado y Adaptabilidad (State Sync)
*   **Desincronización de Dificultad:** Existía un falso positivo donde un usuario inciaba la Arena en Dificultad "Básica" pero el motor JS (`arena.js`) mantenía un estado interno `state.difficulty='Profesional'`, forzando llamados a Vertex AI altamente complejos. Se acopló y forzó la inicialización del objeto `state` para reflejar el DOM visible de las tarjetas seleccionadas.
*   **Fluidez Háptica:** El reloj de cuenta regresiva (Progress Bar) exhibía un descenso entrecortado (100ms Javascript Ticks). Se inyectó una propiedad arquitectónica CSS `transition: width 0.1s linear` transfiriéndole la interpolación del relleno numérico directamente a la tarjeta de video (GPU Rendering) logrando 60 FPS líquidos en la barra.

### 19.2. Bloqueo Elegante para Visitantes (Auth Guards)
La arena intentaba cargar agresivamente *Leaderboards* y perfiles incluso si el visitante no tenía cuenta, disparando errores tipo "Cargando..." y colapsos de Consola.
*   **Intercepción Condicional (`startMatch`):** Se re-ordenó la validación arquitectónica. La existencia de Token (Login) ahora se valida estrictamente **antes** que la selección del Tema. Si el usuario es un visitante, la interfaz aborta el juego y lanza reactivamente la tarjeta `uiManager.showAuthPromptModal()` invitándolo a unirse a Hub Academia sin expulsarlo de la ruta actual.
*   **Ruteo Limpio de Controles:** El botón "Iniciar Sesión" del Header fue redirigido formalmente hacia `/login.html` en lugar de abrir la caja de "Registro Invitado", respetando la convención de UX global.

---

## 20. 🔑 Cierre de Brecha de Seguridad: Supabase Password Recovery Interceptor
Se descubrió un "Punto Ciego" crítico en la arquitectura de autenticación cuando un correo registrado enviaba la petición de `"Olvidé mi contraseña"`.

### 20.1. El Bucle Silencioso de Autologueo
**El Problema:** Al hacer clic en el correo de recuperación, Supabase generaba un enlace con `type=recovery` y un Token Seguro inyectado en el Fragmento Decimal (`#access_token=...`). Sin embargo, los `onAuthStateChange` listeners (ubicados en `app.js`) detectaban ese Token, asumían credenciales correctas, arrojaban un evento **SIGNED_IN**, y logueaban automáticamente al usuario *sin mostrar jamás la pantalla para escribir una nueva contraseña*.

### 20.2. First-Line Hash Interceptor
**La Solución:** En lugar de parchar las interacciones profundas de `SessionManager`, se instaló un interceptor bloqueante en las primeras líneas del evento DOM `DOMContentLoaded` dentro de `app.js` y `login.html`.
*   Apenas la aplicación arranca, verifica si el objeto `window.location.hash` contiene `type=recovery`.
*   Si arroja `true`, se bloquea de inmediato cualquier rastro de inicialización, interrumpiendo el ciclo natural de Supabase, y el navegador ejecuta un redirect manual: `window.location.href = '/update-password.html' + window.location.hash`.
*   Esto captura el Token ileso y lo translada a la vista donde se forza al usuario a redefinir y guardar criptográficamente su clave.

**Efecto Secundario Positivo (Supabase Account Linking):** Esta arquitectura no solo beneficia a las cuentas estándar (User/Password), sino que también autoriza a usuarios originalmente registrados velozmente mediante el puente de Google OAuth a "setear" por primera vez una contraseña si lo desean, convirtiendo su perfil silenciosamente a una cuenta "Híbrida" (Dual Login).