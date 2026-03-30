# 📘 Informe Técnico Profesional: Chatbot Tutor UC

**Versión del Documento:** 1.0  
**Fecha de Generación:** 30 de Marzo de 2026  
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

    **Nota:** La plataforma utiliza una arquitectura híbrida inteligente. Mientras que la interacción en tiempo real y la IA generativa (Gemini) residen en **Node.js nativo**, el procesamiento analítico pesado de tendencias se mantiene en un microservicio de **Python Local** (`/ml_service`). Esto permite aprovechar librerías científicas superiores (Scikit-Learn, Pandas) para el cálculo de similitudes semánticas y decaimiento temporal sin costos de nube.

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
| **Machine Learning** | Python Local + Node.js | Análisis de tendencias, Similitud Coseno/Jaccard y Predicción de Demanda. |
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
    *   **Rotación Dinámica de Opciones:** Los simulacros para ENAM y SERUMS operan con 4 opciones. Aquellos tipificados como **RESIDENTADO** fuerzan la generación y renderizado de **5 opciones** para simular la rigurosidad del examen CONAREME real.
    *   **Rastreo de Datos Granular:** Envío de metadata avanzada on-submit (target, áreas, dificultad, respuestas por pregunta) hacia el backend para analítica JSONB.

3.  **Configuración de Examen (`simulator-dash.js` - Modal v2.0)**

    Sistema de personalización del simulacro alineado con el sistema educativo médico peruano:

    **Tipos de Examen Objetivo:**

    | Target | Descripción | Opciones | Estilo IA |
    | :--- | :--- | :--- | :--- |
    | **ENAM** | Examen Nacional de Medicina (ASPEFAM). Obligatorio para egresados. 180-200 preguntas | 4 | Clínica general, fisiopatología, diagnóstico clásico. **Incluye NTS básicas** de Salud Pública (Vacunas, TB, Materno-Perinatal, MAIS-BFC). Certificado de Defunción (fijo). Enfoque: "El Médico de Posta" |
    | **SERUMS** | Evaluación SERUMS (ENCAPS) del MINSA para médicos, enfermeras, obstetras, odontólogos, etc. | 4 | Prioriza Seguridad del Paciente, Medicina Preventiva/Comunitaria, Categorización de establecimientos (I-1 al III-2), triaje, y ciencias básicas aplicadas a la salud pública. Enfoque holístico de atención primaria. |
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

    **UX del Modal:** Renderizado dinámico con sub-headers por grupo, scrollable (`max-height: 85vh`). Tooltip de primera visita (15s) + efecto neón pulsante en el botón "Configurar Examen" hasta que el usuario guarde una configuración.

#### C. Lógica de Generación Híbrida y Reposición Equilibrada (v2.5)
Estrategia costo-eficiente para generar contenido infinito y altamente preciso sin sesgos estadísticos:
1.  **Balanced Bank First (Cost $0):** Consulta masiva al `question_bank` aplicando un **Sistema de Cuotas Estricto**. Se seleccionan hasta 5 áreas (muestreo proactivo) y se extraen preguntas respetando un **máximo de 2 por área** en cada tanda de 5.
2.  **Disparador Proactivo de Emergencia:** Si el banco no logra surtir un lote completo de 5 (debido a agotamiento de una área específica o falta de stock balanceado), el sistema activa inmediatamente el flujo de reposición.
3.  **Smart Filtering (Anti-Repetición 24h):** Excluye preguntas vistas por el usuario en las últimas 24 horas (`user_question_history`).
4.  **AI Fallback Dinámico (RAG Maestro Flow):** Si el banco local tiene stock crítico o desbalanceado, se invoca a Gemini 2.5 Flash inyectando:
    *   **Muestreo Aleatorio de Áreas:** Máximo 5 áreas por lote para optimizar el contexto RAG.
    *   **Contexto RAG Local:** Búsqueda SQL `ILIKE` en documentos reales del MINSA.
    *   **Deduplicación Semántica:** Scaneo de los últimos 200 temas generados.
    *   **Estilo de Examen:** Adaptación según Target (ENAM, SERUMS, Residentado).
5.  **Auto-Learning Global:** Las nuevas preguntas generadas se persisten en el Banco Global y se marcan como vistas para el usuario de forma inmediata.
6.  **Protección Financiera (Mock Test):** En simulacros masivos (100+ q), se bloquea la generación IA para proteger la rentabilidad, sirviendo solo desde el banco estático.

#### D. Analítica de Rendimiento Profunda y JSONB (v2.0)
El sistema migró de reportes estáticos ("Tema general del Quiz") hacia un modelo granular subatómico alimentado por base de datos híbrida (Relacional/NoSQL Documental en PostgreSQL):
*   **Inyección JSONB:** Al emitir el examen (`submitQuizResult`), el backend recorre cada pregunta iterando Arrays, calculando cuántas preguntas se acertaron y fallaron *por Sub-Tema específico* dentro de un mismo simulacro multidisciplinario. El resultado compreso se guarda en la nueva columna `area_stats (JSONB)` de la tabla `quiz_history`.
*   **Motor KPI:** El endpoint `getStats` dispara queries analíticas sobre la nube estructurada JSON (`jsonb_object_keys`, `SUM`), lo que entrega agregaciones estadísticas vitales sin sobrecargar la estructura de la base de datos PostgreSQL.
*   **Dashboard Visual (Bar Chart UX):** El ecosistema Frontend intercepta dicho pipeline mediante el propio motor de renderizado HTML/CSS nativo de la plataforma, dibujando un gráfico de **Barras Horizontales** responsivo que señala visual y matemáticamente las Fortalezas (ej. Pediatría: 85%) y Fallas (ej. Cirugía: 20%) de un Doctor.

#### E. Base de Datos (Schema)
*   `question_bank`: Repositorio global de preguntas (compartido). Columnas clave: `domain`, `target` (ENAM/SERUMS/RESIDENTADO), `topic`, `difficulty`, `times_used`.
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

### 10.1. Usuario Free (Registrado)
*   **Registro Estándar vs. Corporativo:**
    *   **Usuarios Generales (@gmail, etc.):** Requieren validación de correo electrónico obligatoria para activar la cuenta (o intervención manual vía Admin).
    *   **Usuarios Hub Academia (@hubacademia.com):** Proceso de **Auto-Verificación** mediante Admin API. Sus cuentas se activan inmediatamente al registrarse, eliminando fricción.
*   **Límites (Versión 2.0):**
    *   **Consultas al Tutor:** Limitadas a **3 interacciones diarias**.
    *   **Quiz Arena:** Hasta **3 partidas diarias**.
    *   **Flashcards:** Límite de **1 bloque de generación (5 tarjetas)** al mes.
*   **Interacción:** Al alcanzar el límite, se muestra un *Paywall Modal* ("Soft Block") invitando a suscribirse. El control de este bloqueo se realiza tanto en frontend (`chat.js`) como en backend (`checkLimitsMiddleware.js`).

### 10.2. Usuario Premium (Basic y Advanced)
El sistema ofrece dos niveles de pago procesados por MercadoPago, con beneficios escalonados:

| Característica | **Plan Básico (Entry)** | **Plan Avanzado (Pro/Premium)** |
| :--- | :--- | :--- |
| **Costo / Duración** | S/ 9.90 (2 Meses) | S/ 24.90 (6 Meses) |
| **Tutor IA (Chat)** | Estándar (15 mensajes/día) | Pro con Biblioteca Médica RAG (50 mensajes/día) |
| **Quiz Arena (IA)** | 5 partidas/día | 10 partidas/día |
| **Analítica de Patrones** | Estático (Sin IA) | Diagnóstico Clínico IA (Consume chat_standard) |
| **Flashcards (IA)** | 10 intentos / mes | 30 intentos / mes |
| **Simulador Médico** | Banco Local (ILIMITADO) | Banco Local + Generación RAG (ILIMITADO) |

*   **Conversión:** Se activa mediante Webhook de MercadoPago. El servidor actualiza `subscription_tier` ('basic' o 'advanced') y establece `subscription_expires_at = NOW() + INTERVAL 'X months'`.
*   **Reseteo Híbrido:** Al activarse un plan, todos los contadores de uso se reinician a cero para garantizar el acceso inmediato.

### 10.3. Arquitectura Técnica de Cuotas (Middleware Cerbero)
La protección de rentabilidad del sistema se basa en un guardián central: `checkLimitsMiddleware.js`.

1.  **Validación en Cascada:**
    *   **Vencimiento:** Compara `Date.now() > subscription_expires_at`. Si venció, rebaja automáticamente al usuario a `'free'`.
    *   **Ciclo de Día:** Utiliza `last_usage_reset` para determinar si es un nuevo día y resetear contadores diarios (`daily_ai_usage`, `daily_arena_usage`).
    *   **Ciclo de Mes:** Resetea los consumos mensuales (`monthly_flashcards_usage`) cuando cambia el mes calendario o se renueva la suscripción.
2.  **Unificación de Inteligencia (Costo Cero):** El sistema RAG ahora opera de forma 100% local en base de datos. En vez de bloquear a los usuarios con límites arbitrarios mensuales, los usuarios del Plan Avanzado pueden invocar a la IA Clínica con RAG la cantidad de veces que deseen dentro de su tope masivo de 50 chats al día.
3.  **Protección de Base de Datos:** Las peticiones al simulador que requieren RAG (IA generadora) están restringidas en el backend para usuarios de Plan Básico, obligando al sistema a servir únicamente desde el `question_bank` estático, asegurando un margen de utilidad gigantesco.

---

## 11. ⚠️ Notas de Despliegue Críticas

### 11.1. Variables de Entorno y Secret Files (Render / Producción)
Para garantizar la operatividad de los servicios de IA (Gemini), Almacenamiento (GCS), Pagos (Mercado Pago) y Base de Datos (Supabase), se han configurado las siguientes variables en el entorno de producción según las capturas de auditoría:

| Variable | Descripción |
| :--- | :--- |
| `APP_URL` | URL base de la aplicación (ej: `https://hubacademia.com`). |
| `GCS_BUCKET_NAME` | Nombre del cubo en Google Cloud Storage para imágenes médicas. |
| `GEMINI_API_KEY` | Llave de acceso a la API de Vertex AI / Gemini 2.5. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta absoluta al archivo de credenciales (`/etc/secrets/service-account-key.json`). |
| `GOOGLE_CLOUD_LOCATION` | Región del proyecto en Google Cloud (ej: `us-central1`). |
| `GOOGLE_CLOUD_PROJECT` | ID del proyecto en Google Cloud Console. |
| `JWT_SECRET` | Firma secreta para la validación de tokens de sesión. |
| `MP_ACCESS_TOKEN` | Token de acceso para la API de Mercado Pago. |
| `NODE_DATABASE_URL` | String de conexión directa a PostgreSQL (Supabase). |
| `PORT` | Puerto de escucha del servidor (generalmente `10000` en Render). |
| `SUPABASE_KEY` | Public Anon Key de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (Bypass RLS) para tareas administrativas. |
| `SUPABASE_URL` | URL del endpoint de Supabase. |

#### Configuración de Secret Files (Render)
El archivo `service-account-key.json` (que contiene las llaves de la Service Account de Google) **NO** se incluye en el repositorio de GitHub por seguridad. En su lugar, se gestiona mediante el módulo de **Secret Files** de Render:
*   **Nombre del Archivo:** `service-account-key.json`
*   **Acceso:** Montado automáticamente por Render en el directorio raíz o en `/etc/secrets/` segun configuración. La variable `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a la ruta correcta para que las librerías de Google realicen la autenticación automática.

### 10.2. Eliminación de Cuenta (Danger Zone)
Esta funcionalidad es irreversible y desencadena una limpieza en cascada:
1.  **Doble Verificación:** El usuario debe reingresar su contraseña actual.
2.  **Validación Auth:** Se verifica la identidad contra Supabase Auth.
3.  **Borrado Admin:** Se utiliza la `SUPABASE_SERVICE_ROLE_KEY` para eliminar el usuario del proveedor de identidad.
4.  **Limpieza DB:** Gracias a `ON DELETE CASCADE` en PostgreSQL, se eliminan automáticamente todos los registros dependientes (chats, favoritos, historial).

#### 11.2. Arquitectura Multi-Cloud y Proxy (Vercel -> Render)
El proyecto utiliza una arquitectura distribuida para maximizar la velocidad de carga y estabilidad:
*   **Vercel (Frontend):** Procesa el dominio `hubacademia.com` y sirve HTML/CSS/JS.
*   **Render (Backend):** Aloja el servidor Node.js en `https://tutor-ia-backend.onrender.com`.

**Configuración de Rewrites (vercel.json):**
Para que las llamadas a `/api/*` lleguen correctamente al backend, se utiliza una regla de **Rewrite** con la sintaxis de comodines de Vercel. 
> [!IMPORTANT]
> La regla `/api/:path*` debe ser la **primera** en el array de `rewrites`. Esta sintaxis garantiza que tanto la ruta como los parámetros de consulta (`?fileId=...`) se transfieran íntegramente de Vercel a Render.

---

## 11.3 Persistencia de Miniaturas (Drive -> GCS)
Para garantizar una carga instantánea y eliminar la fragilidad del proxy de Vercel, el sistema utiliza un flujo de **Almacenamiento Persistente Optimizado**.

**Flujo de Trabajo de Élite:**
1.  **Escaneo:** El administrador sincroniza carpetas desde el Panel.
2.  **Descarga Cruda:** Render descarga la miniatura de Drive en alta resolución (`s800`).
3.  **Optimización WebP (Sharp):** El sistema convierte la imagen al formato WebP de Google, reduciendo el peso en ~70% sin pérdida visual perceptible.
4.  **Caché Agresivo (Cache-Control):** Al subir a GCS, se inyecta la cabecera `public, max-age=31536000` (1 año).
5.  **Entrega Directa:** Los alumnos descargan la imagen desde una URL estática de GCS.

**Impacto en la Experiencia de Usuario (UX):**
-   **Velocidad de Carga:** Tras la primera visita, las imágenes se recuperan de la **Memoria Local/Caché** del dispositivo del alumno (celular o PC) en milisegundos.
-   **Ahorro de Datos:** La optimización WebP reduce significativamente el consumo de datos móviles para los estudiantes.
-   **Resiliencia:** El sistema es inmune a caídas temporales de la API de Drive o problemas de red en proxies intermedios.

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

### 14.3. Persistencia de Resultados y Analíticas Sensibles al Contexto (Auditoría de Integridad)

El sistema garantiza que cada respuesta se asigne a su especialidad real, resolviendo el "Fallo de la Primera Área" mediante un pipeline de datos blindado:

1.  **Integridad en el Origen (Repository Level):** Se auditó que las funciones `findQuestionsInBank` y `findQuestionsInBankBatch` en `TrainingRepository.js` recuperaban el tema de la BD pero lo omitían en el mapeo hacia el objeto JSON. Se corrigió esto para asegurar que el campo `topic` viaje siempre desde PostgreSQL hasta el Frontend.
2.  **Sanitización Inteligente (Service Level):** En `TrainingService.js`, la función `submitQuizResult` fue refactorizada para:
    *   **Respeto a la Especialidad:** Si la pregunta trae un tema específico (ej. "Neurología"), este se preserva intacto.
    *   **Tratamiento de Genéricos:** Solo si el tema es genérico ("MEDICINA", "General") o está vacío, el sistema lo mapea inteligente al primer área seleccionada por el usuario para evitar inconsistencias.
    *   **Normalización:** Limpia temas combinados (ej. "Pediatría, Neonatología" -> "Pediatría") para mantener el Radar Chart limpio.
3.  **Trazabilidad en Flashcards:** El repositorio ahora utiliza el `q.topic` individual de cada error para crear tarjetas, permitiendo que el mazo de "Repaso Médico" se categorice por sub-especialidades reales y no por el título global del examen.
*   **Etiquetado del Examen Padre:** Para no contaminar el historial del usuario (`quiz_history`) con el nombre de una sola especialidad cuando se abarcan varias, el frontend evalúa la longitud del arreglo de áreas seleccionadas (`state.areas.length`). Si es mayor a 1, la "carátula" del examen se grabará permanentemente en base de datos como **"Multi-Área"**.
*   **Columna JSONB `area_stats`:** En la tabla `quiz_history`, se crea de manera dinámica un objeto JSON que agrupa aciertos y errores por especialidad. Por ejemplo:
    ```json
    {
      "Cardiología": { "correct": 4, "total": 5 },
      "Pediatría": { "correct": 2, "total": 5 }
    }
    ```
*   **Desagregación Lateral en PostgreSQL:** Para leer este JSONB de cara al Dashboard, se utiliza la función `jsonb_each()` de manera lateral en el bloque `FROM` (`FROM quiz_history, jsonb_each(area_stats)`). Esto descompone la matriz JSON limpiamente, permitiendo sumar aciertos globales por materia mediante funciones agregadas `SUM()`. (Nota: utilizar `jsonb_object_keys()` directamente dentro de `SUM()` arroja un fatal error SQL al ser una *set-returning function*).
*   **Visualización en UX (Bar Chart):** El endpoint `/api/quiz/stats` extrae las llaves de este JSONB, suma los valores y calcula la Precisión (Accuracy %). Estos datos se envían de vuelta al Frontend, alimentando el **Gráfico de Barras Horizontales (Dominio por Áreas)**. Así, el estudiante diagnostica visualmente qué especialidad exacta dentro de su mix de estudio está fallando más y dónde sus fortalezas son sólidas.

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

### 16.1. Capa 1: Exclusión Histórica Estricta (Base de Datos a Prompt)
A nivel de arquitectura, antes de que el backend solicite la confección de 20 preguntas nuevas, el servicio (`mlService.js`) escudriña atómicamente la base de datos PostgreSQL, extrayendo las **últimas 200 preguntas previamente inyectadas** bajo esa misma configuración exacta (Target + Área + Dificultad + Carrera). Esta ráfaga de datos reales se incrusta textualmente como una "Restricción Absoluta" en el System Prompt de Gemini, forzando matemáticamente a la IA a virar su creatividad hacia patologías, tratamientos o casos clínicos completamente vírgenes y no tocar nunca la lista de temas "Bloqueados".

### 16.2. Capa 2: Contexto Negativo Aleatorio (Randomized RAG Constraint)
Cada vez que el backend (`trainingService.js`) invoca a Gemini, `trainingRepository.js` extrae en paralelo un bloque ligero de 15 preguntas *aleatorias* del banco histórico pertenecientes a esa misma área (Ej. "Cardiología"). Estas se inyectan en el prompt maestro bajo una directiva restrictiva absoluta ("Regla de Oro de Deduplicación"), prohibiéndole a la IA evaluar o retornar los escenarios clínicos contenidos en este extracto, forzando matemáticamente la novedad.

### 16.3. Capa 3: Rotación Dinámica de Enfoque (Semantic Sub-Drift)
Se instauró un sistema de "Entropía Clínica". El array `clinicalFocuses` elige aleatoriamente un ángulo de evaluación (Ej. "Etiología y Fisiopatología", "Tratamiento de Primera Línea", "Diagnóstico por Imágenes"). El prompt le ordena a Gemini que concentre un alto porcentaje de las preguntas requeridas específicamente bajo ese prisma diagnóstico, evitando que la IA cicle crónicamente alrededor de las mismas patologías típicas.

---

## 17. 📦 Escalabilidad de Dominio Múltiple y Panel de Inyección

Para transformar el motor de "Simulador Médico" a un "Hub Académico Multi-Dominio" (Ej. Medicina, Inglés, etc.) de forma sostenible, se rediseñó la ingesta y persistencia de datos:

### 17.1. Hydration Activa (Configuración JSONB) 
Se erradicó la gestión de estado basada puramente en el `localStorage` del navegador. Se implementó la tabla `user_simulator_preferences` utilizando el tipo de dato **JSONB** nativo de PostgreSQL. Al cargar el Dashboard, el Frontend consume la API REST `GET /api/users/preferences?domain=medicine` y restaura exactamente el *Target*, *Dificultad* y selección multi-área transversal a todos los dispositivos móviles y navegadores del usuario (Cross-Device Sync).

### 17.2. Inyección Masiva Profesional (Upload Excel/CSV)
En el portal `/admin`, se implementó una interfaz gráfica avanzada sustituyendo la antigua caja de texto JSON por un cargador nativo de archivos binarios tabulares.
*   **Motor Interpretativo en Cliente:** Se integró la librería **SheetJS** (`xlsx`) vía CDN para que el propio navegador del administrador descifre asíncronamente archivos `.xlsx`, `.xls` y `.csv` pesados.
*   **Estructura Estricta:** El sistema valida y transfiere un mapa de 13 columnas rígido (`pregunta, dominio, target, carrera, tema, dificultad, opt0... explicacion`). Adicionalmente, cuenta con un botón interactivo para generar y descargar dinámicamente una "Plantilla Oficial" preformateada lista para el llenado en Excel.
*   **Backend Bulk:** Tras ser convertido silenciosamente a JSON por SheetJS, este es capturado por `/api/admin/questions/bulk` y ejecutado sobre una única transacción SQL (`BEGIN/COMMIT`) minimizando la carga de red.

### 17.3. Motor de Imágenes Estáticas Desacoplado (CDN jsDelivr)
Para reducir agresivamente el consumo de Ancho de Banda (Transferencia) de la capa gratuita del servidor Backend (Supabase/Vercel) al cargar casos clínicos radiológicos o multimedia, se integró soporte nativo para `image_url` en los esquemas de visualización del Quiz (`quiz.html`). Como directiva oficial, el Administrador aloja directamente los pesados *assets* de imagen en un branch de infraestructura de GitHub y propaga estas imágenes instantáneamente al frontend mediante la red de Edge Caching global de **jsDelivr**, resultando en un costo marginal de transferencia de $0 para la institución educativa.

### 17.4. Gestión de Preguntas Individuales y UI de Administración (CRUD Full)
Como evolución lógica a la inyección masiva, se desarrolló una suite completa de administración unitaria (`GET`, `POST`, `PUT`, `DELETE` en `/api/admin/questions`). En el portal Admin, la pestaña "Preguntas" ahora presenta un Grid dinámico robusto que renderiza metadatos médicos (`domain`, `target`). Se construyó un modal de edición avanzado que permite a los supervisores importar JSON o utilizar un formulario generativo para corregir sobre la marcha opciones o explicaciones de la IA sin depender exclusivamente de operaciones masivas (Bulk).

### 17.5. Especialización Profiláctica (Careers Mapping para SERUMS)
Ante la necesidad legal de adaptar el examen SERUMS (ENCAPS) a múltiples carreras de ciencias de la salud, el modelo de datos PostgreSQL de `question_bank` y de `quiz_history` fue alterado para alojar la columna `career`.
*   **Comportamiento Dinámico UI:** Tanto en el Dashboard del Alumno como en el portal Admin, seleccionar "SERUMS" como Target despliega reactivamente un menú secundario bloqueando o revelando 3 carreras (Medicina Humana, Enfermería).
*   **RAG Profiláctico:** Al generar preguntas con IA para SERUMS, la variable `career` viaja hacia el Cerebro LLM, el cual adapta su léxico, prioridades y escenarios clínicos en exclusiva sintonía a las competencias legales de la carrera elegida.

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

### 18.4. Auditoría de Integridad Temática (Anti-Anatomía Bug)
Se detectó y resolvió un fallo de "atrapamiento" donde el sistema asumía que todas las respuestas de un multi-examen pertenecían al primer tema de la lista (ej. Anatomía).
*   **Causa Raíz:** El repositorio recuperaba el `topic` de la base de datos pero lo omitía en la transferencia. Esto forzaba al servicio a "adivinar" el tema, fallando hacia el valor por defecto.
*   **Blindaje:** Se forzó la inclusión de `topic` en todas las consultas del Banco Global y se implementó una sanitización inteligente que prioriza el tema médico de la pregunta sobre el tema general del examen.

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

---

## 21. Nuevos Módulos, UI/UX y Sistema Premium

### 21.1 Single Source of Truth para UI de Recursos

Previamente, las tarjetas de recursos (*Documents*, *Books*, *Videos*) se generaban de formas dispersas en diferentes archivos (`category.js`, `course.js`, `search.js`), lo que generaba inconsistencias visuales y parches de seguridad.

**Solución Implementada:**
Hemos consolidado la lógica en dos funciones maestras ubicadas en `/js/ui/components.js`:
- `createUnifiedResourceCardHTML(item)`: Empleada para *Libros*, *Documentos* y *Papers*.
- `createVideoCardHTML(video)`: Empleada estrictamente para *Videos*.

**Impacto:** Cualquier cambio de diseño, icono premium (👑), candado (🔒) o comportamiento al hacer click, se propaga instantáneamente a todas las carruseles, búsquedas y páginas de cursos de la plataforma.

### 21.2 Seguridad Síncrona vs Race Conditions

Anteriormente, la plataforma mostraba el icono de candado basándose en estados asíncronos que provocaban un "parpadeo" o mostraban el candado a usuarios Premium por milisegundos.

**Solución (`uiManager.js` & `components.js`):**
Ahora la renderización evalúa *síncronamente* el estado de autenticación leyendo directamente de `localStorage` al momento de dibujar el HTML garantizando que los candados premium jamás fastidien a quienes tienen una suscripción o pase válido.

### 21.3 Delegación de Eventos: `unlockResource`

Antes los usuarios podían bypassear el "Paywall" si hacían "click derecho -> abrir enlace".

**Solución:**
Ninguna tarjeta expone la etiqueta `href` directa hacia su contenido subyacente de ser *is_premium = true*. 
En su lugar, inyectan el evento: `onclick="window.uiManager.unlockResource(id, type, isPremium)"`

Esta función intermedia en `uiManager.js` actúa como el **Gran Guardián**:
1. Comprueba si el usuario está Logueado. Si no, lanza el modal *"Únete a Hub Academia"*.
2. Comprueba si el recurso es Premium.
3. Si lo es, revisa si es *Freemium*. Si lo es, evalúa si tiene *vidas* (`free_trials`).
4. **Cero vidas?** Lanza el modal *"Te encantó la prueba"* (Membresía).
5. **Tiene vidas?** Resta 1 vida, y navega recién al visualizador de PDF/Video.

### 21.4 Fix del Payload Backend en Repositorio de Cursos

Un bug crítico causaba que dentro del detalle de los cursos, los recursos no funcionaran a pesar de tener la función `unlockResource`. 

**Solución en `CourseRepository.js`:**
El backend construía un `JSON_BUILD_OBJECT` en PostgreSQL omitiendo declarar la llave `r.is_premium`. Se parcheó la base de datos para que la Query inyecte `'is_premium', r.is_premium` asegurando que el Frontend entienda cuándo detener al usuario.

### 21.5 Reorganización de Módulos (UI)

Se reasignó la sección *"Cursos Populares"* al lugar ideal sugerido (`search.js`), intermedio entre la invocación del *"Hub Quiz Arena"* y las *"Áreas de Estudio"*. También, los botones principales del centro de llamadas *"Bibliotecas Oficiales"* se actualizaron utilizando portadas en `background-image` fotográficas consumidas sobre la red con efecto graduado lineal (Linear Gradient) para denotar calidad y esteticidad superior.

---

## 22. Refactorización UX/UI del Módulo de Repaso (Flashcards)

Se implementaron mejoras sustanciales en la interacción y experiencia de usuario para la pantalla principal de estudio y gestión de mazos (`repaso.html` y `repaso.js`).

### 22.1 Reordenamiento Inteligente (Drag & Drop)
Los usuarios ahora pueden cambiar el orden de las tarjetas (Flashcards) arrastrando desde un ícono (`fa-grip-vertical`).
- **Arquitectura Backend:** Se agregó la columna `sort_order` en `user_flashcards` y un nuevo endpoint batch (`PUT /api/decks/:id/cards/reorder`).
- **Interacción Móvil Híbrida:** Dado que el estándar Drag & Drop de HTML5 no soporta dispositivos táctiles nativamente, se integró el *Polyfill* `mobile-drag-drop`. Esto permite que con un simple gesto sostenido ("Long Press") sobre la agarradera, los usuarios móviles puedan reordenar tarjetas con fluidez.

### 22.2 Selección Masiva y Modos Táctiles (Bulk Actions)
Para la eliminación en bloque de flashcards ("estilo Gmail"), se construyó un "Modo de Selección" seguro:
- **Checkbox y Tap (Escritorio/Móvil):** El modo selección se activa al hacer clic en un Checkbox o al mantener presionada cualquier parte de una tarjeta en celular.
- Una vez en *Modo Selección*, toda la tarjeta física se vuelve un botón gigantesco que alterna el estado (seleccionado / no seleccionado), previniendo que clicks accidentales abran modales indeseados.

### 22.3 Search Bar Reactiva (Búsqueda Real-Time)
Se incorporó un `input type="search"` que filtra síncronamente los arrays cargados en memoria. Se evaluó que la paginación backend no era necesaria asumiendo mazos locales (decenas/cientos de tarjetas), privilegiando la velocidad y el feedback visual instantáneo con un `input` interconectado al Render DOM.

### 22.4 Solución de Fallas Estructurales de UI (CSS Overlaps)
- **Desbordamiento del Explorador de Mazos:** Los nombres de los sub-mazos anidados no se truncan cortando el texto. El panel lateral (`.explorer-sidebar`) ahora ostenta `overflow-x: auto` con fondos Flex elásticos que expanden su horizonte según la profundidad del nivel del árbol.
- **Bug Fatal del Menú Desplegable:** El menú principal superior ("Cerrar Sesión") se veía tapado por las tarjetas secundarias a causa de la propiedad `backdrop-filter` (Glassmorphism) que forzaba un nuevo contexto de apilamiento en el HTML. Se aplicó `position: relative` interconstruido con `z-index: 2147483647` al header principal, aislando al menú de cualquier conflicto z-index en la aplicación.

---

## 23. 🎨 Mega-Refactorización Visual y Comportamental (UI/UX Absoluta)

Para consolidar a **Hub Academia** como una plataforma EdTech de rango Premium, se realizó una reestructuración dramática de las reglas CSS globales, layouts responsivos y mecánicas emergentes (Modales) a través de todos los módulos.

### 23.1. Layout "True Edge-to-Edge" y Eliminación de Cajas Duras
Históricamente, los contenedores principales (`.main-container`, `.dashboard-container`) estaban restringidos por un bloqueo máximo de `1200px` (`max-width: 1200px`), provocando que subpáginas como el Buscador o Cursos se vieran truncadas o atrapadas en el medio de monitores grandes.
- **Liberación Absoluta:** Se erradicaron estas limitantes rígidas de `search.css`, `course.css` y `dashboard.css`. Todos los contenedores respiran horizontalmente al **100% de la pantalla**, limitados armónicamente por la variable fluida `--page-padding-x`.
- **Headers/Footers Aislados (Single Source of Truth):** Se identificó que vistas internas críticas (ej. Simulador Médico, Editor de Mazos) poseían cabeceras `<header>` codificadas directamente (`<header class="header-glass">`), causando diseños asimétricos. Fueron purgados e inyectadós con los bloques universales `<header class="main-header">` y `<footer class="main-footer">`.

### 23.2. Formulación Geométrica Estricta en Cuadrículas
- **El 6x3 Grid:** En listados panorámicos enormes (Ej. Pestañas Biblioteca y Cursos), CSS *Grid Auto-Fill* variaba impredeciblemente tamaños de libros perdiendo la estética. En Escritorio, el `browse.css` restringe la exhibición a exactamente **6 columnas inquebrantables**. En dispositivos móviles (Smartphones), la proporción es forzada milimétricamente a **3 columnas verticales**, garantizando que las portadas tengan la perfecta silueta tipo *Spotify* o *Netflix*.
- **Cierre Semántico de Recursos:** Los tópicos de separación ya no tienen márgenes inmensos abajo (`marginBottom: 0.25rem`), lo que empalma visualmente las portadas de los recursos directamente bajo su temática, condensando drásticamente el uso visual de pantalla e impidiendo la necesidad de `scroll` interminable al alumno.

### 23.3. Tema "Manta Black" (Erradicación del Slate Residual)
Originalmente, el dashboard principal ostentaba un profundo Negro Mate (`#141414`), pero módulos independientes como el **Quiz Arena**, la interfaz del **Examen Simulado** (`quiz.html`), y el Repaso (`flashcards.html`) mantenían variables duras nativas heredadas de esquemas grises azulados pasados (*Slate*: `#0f172a`, `#1e293b`).
- **Inyección Acromática:** Se ejecutó una purga del espectro azul en `quiz.css`, `dashboard.css` y `components.css`. 
- **Fondo Global (Main):** Estandarizado implacablemente a `--bg-main: #141414`.
- **Elevación de Superficies (Cards/Modals):** Modificado a `--bg-tertiary: #1f1f1f`.
- **Bordes Invisibles:** Transiciones azules (`#334155`) neutralizadas a `rgba(255, 255, 255, 0.05)`, fusionándose enteramente en la oscuridad armónica dictada inicialmente por el *footer*.

### 23.4. Motor Interactivo API "PopState" (Back-Button UX)
El fallo técnico más frustrante en *Mobile Web Apps* es perder la página entera cuando el usuario despliega un menú modal y presiona el gesto "Atrás" en Android, ocasionando que retroceda la historia de navegación del navegador en lugar de solo ocultar la ventana.
- **Inyección Histórica Transversal:** `uiManager.js` fue fortificado con dos comandos: `pushModalState` y `popModalState`.
- **Registro Ficticio:** Cada vez que el motor abre el Paywall, el modal Generador IA de Flashcards, o el Configurador Crítico de Simulacros, empuja un "estado oculto" (`window.history.pushState`) al navegador de internet. 
- **Interceptación Segura:** El listener central `handlePopState` entra en acción cuando el usuario ejecuta físicamente el "Volver". Dicho comando identifica modales vivos por su ID en el `openModals Set` y remueve sus trazos (sean `style.display="none"` o `.classList.remove('active')`) cerrándolos instantáneamente sin expulsar al usuario fuera de su progreso formativo. 

### 23.5. Apilamiento Universal Z-Index (Z-Stack Bug)
Inesperadamente, menús descolgables nativos del Header (Ej. Caja de Cuenta de Usuario) colapsaban al desplegarse solapados por Cajas Modales gigantescas (Ej. "Suscríbete" u "Opinión IA"), creando la imposibilidad gráfica de interactuar si el usuario ignoraba dicho modal. 
- **Cálculo Físico Definitivo:** En lugar de malabares de 1000 en 1000, los Modales y overlays transparentes ostentan rigidez matemática extrema: `z-index: 2147483647;`.
- **Evasión Contextual:** Para contrarrestar apilamiento irresoluble del HTML (`stacking context`), el nav-bar decreció forituitamente a `z-index: 999;` brindándole prioridad absoluta a modales de importancia crítica transversalmente para salvar flujos de transaccionalidad interrumpidos en Desktop y Mobile.

### 23.6. Simplificación de la UX del Tutor IA
Para reducir la carga cognitiva del usuario al abrir el chat, se simplificó el mensaje de bienvenida inicial.
- **Reducción de Mensaje:** El saludo inicial fue refinado a una única pregunta directa: "¿En qué puedo ayudarte hoy?".
- **Sugerencias de Contexto:** Se actualizaron las `defaultSuggestions` para incluir accesos rápidos a Simulacros y Repasos, alineando el chat con las funcionalidades principales de la plataforma.

### 23.7. Visibilidad de Botones de Acción sobre Fondos Oscuros
Con la implementación del tema **Manta Black**, ciertos iconos heredados (Editar y Eliminar) que carecían de color definido se volvieron invisibles al mostrarse como negro sobre negro.
- **Corrección Croma Global:** Se inyectó `color: var(--text-main, #ffffff)` en los selectores `.edit-btn-small` y `.delete-btn-small` de `admin.css`.
- **Refinamiento en Chat:** Los controles de gestión de conversaciones en `chat.css` fueron ajustados a un blanco translúcido (`rgba(255, 255, 255, 0.7)`), garantizando legibilidad sin romper la estética minimalista del sidebar.

### 23.8. Exactitud Matemática e Interfaz del Algoritmo Anki (SM-2)
Se identificó y resolvió una desconexión crítica profunda entre la persistencia de datos visuales y los cálculos matemáticos estructurales del motor Spaced Repetition (SM-2) embebido en la plataforma.
- **Traductor de Métricas (Mapper Visual-Algorítmico):** El motor SM-2 exige matemáticamente los valores de calidad `0, 3, 4, 5` para originar su curva del olvido. Sin embargo, el Frontend esperaba la indexación estándar `1 (Rojo), 2 (Naranja), 3 (Azul), 4 (Verde)` para renderizar el coloreado CSS `srs-status`. Se programó una capa middleware de traducción directa antes de la inyección PostgreSQL, permitiendo a la UI usar índices ordenados inalterando el coeficiente EF de SuperMemo.
- **Sincronización de Semilla Inicial (First-Rep UI Bind):** El SM-2 original castigaba toda tarjeta nueva/fallada (`reps = 0`) agendándola a 24 horas (1 día) como bloque inicial de hielo, ignorando pasivamente los marcadores de `3 días` (Bien) o `7 días` (Fácil) descritos por el front. Se reescribió el escalón base del algoritmo algorítmico para forzar la adopción milimétrica del indicador textual de los botones HTML para el primer intervalo. Las repeticiones subsecuentes mantienen inalterada la rigurosidad multiplicativa.
- **Condicionamiento Analítico (Mastery > 21):** Para purificar las métricas del "Mastered Cards" (Dominadas), se purgaron los atajos falsos (ej. `last_quality = 4`). Hoy, el Dashboard General y el Backend SQL filtran como Masterizadas estrictamente solo aquellas tarjetas que empíricamente han sobrevivido la barrera del "Intervalo Maduro (> 21 días al futuro sin fallar)".
- **Indicador Focus Glow:** Se implementó visualmente la clase CSS `.is-due-glow` combinada con `@keyframes duePulseGlow`. Suscitada condicionalmente desde el DOM javascript (`repaso.js` y `deck-details.js`), inyecta un suave campo de fuerza resplandeciente pulsante alrededor del borde azul-neón de toda aquella tarjeta puntual cuya fecha `next_review_at` ha caducado y solicita estudio inmediato el día de hoy.

---

## 24. 📂 Integración Avanzada de Google Drive y Smart Routing (v2.6)

Se implementó un sistema robusto para la gestión y visualización de recursos alojados en Google Drive, optimizando la carga visual y garantizando la compatibilidad con las políticas de seguridad de los navegadores.

### 24.1. Drive Thumbnail Proxy (Backend)
Para mostrar miniaturas de documentos de Drive sin exponer las URLs originales y evitar bloqueos de CORS:
*   **Servicio (`driveService.js`):** Utiliza `google-auth-library` para autenticarse con una Service Account y solicitar el `thumbnailLink` de archivos específicos vía Google Drive API v3.
*   **Endpoint Proxy (`/api/media/drive-thumbnail`):** Actúa como un puente seguro que descarga la miniatura desde los servidores de Google y la sirve al cliente, permitiendo el almacenamiento en caché y protegiendo las credenciales del servidor.

### 24.2. Smart Cover en Tarjetas (UI Components)
Las tarjetas de recursos en la biblioteca ahora poseen inteligencia visual (`components.js`):
*   **Priorización:** 1. Imagen manual del Admin -> 2. Miniatura de Drive -> 3. Icono de Fallback.
*   **Detección de Carpetas:** El sistema identifica si el enlace de Drive es una carpeta (Folder). Si es así, omite la petición de miniatura (ya que Drive no genera miniaturas para carpetas) y muestra el icono de carpeta automáticamente, evitando errores de red.
*   **Manejo de Errores (Self-Healing):** Si una miniatura falla al cargar, la imagen se oculta silenciosamente y activa el icono de fallback mediante un ID único por tarjeta, manteniendo la estética impecable.

### 24.3. Smart Routing del Visor (Security First)
Se rediseñó el motor de visualización en `uiManager.js` para resolver problemas de `Content Security Policy (CSP)` de Google Drive:
*   **Documentos (PDF, Drive, Externos):** Dado que Google bloquea el incrustado en `iframes` por seguridad, el sistema ahora detecta estos archivos y los abre automáticamente en una **Pestaña Nueva** (`_blank`), permitiendo el uso de los potentes visores nativos de Drive y del navegador.
*   **Imágenes (GCS/Locales):** Mantienen su comportamiento inmersivo abriéndose dentro del **Modal de la plataforma**, garantizando velocidad y fluidez visual para diagramas o esquemas médicos.

### 24.5. Sincronización Masiva (Drive Folder Scanner)
Se integró un motor de escaneo masivo para poblar la biblioteca de recursos directamente desde carpetas de Google Drive, optimizando la gestión administrativa:
*   **Endpoint:** `POST /api/admin/drive/sync-folder`.
*   **Lógica de Upsert:** El sistema identifica cada archivo por su Drive File ID. Si el recurso ya existe en la base de datos (basado en la URL), actualiza el título y tipo; si es nuevo, genera un `resource_id` único y lo inserta.
*   **Procesamiento de Títulos:** Elimina automáticamente las extensiones de archivo (ej: ".pdf", ".mp4") para mantener la limpieza visual en la plataforma.
*   **Atribución Dinámica:** Permite definir un autor global y el tipo de recurso (Libro, Guía, Norma, etc.) para todo el lote sincronizado.

---

## 25. 📂 Estructura de Carpetas Detallada (Actualizada)

---

## 25. 💰 Análisis de Costos e Infraestructura de Almacenamiento (GCS vs Drive)

Para optimizar la rentabilidad del proyecto, se ha definido una estrategia dual de almacenamiento basada en el tipo de recurso y su nivel de exclusividad.

### 25.1. Google Cloud Storage (GCS) - Almacenamiento Propietario
*   **Uso:** Recursos de autoría propia, materiales Premium exclusivos e imágenes de perfil.
*   **Modelo de Costos:**
    *   **Almacenamiento:** Pago por GB/mes (aprox. $0.02 USD/GB).
    *   **Transferencia (Egress):** Costo por descarga fuera de la red de Google tras superar el primer 1GB gratuito mensual.
*   **Seguridad:** Permite un control de acceso granular y firmado (Signed URLs), siendo ideal para contenido que **no debe ser público** fuera de la plataforma.

### 25.2. Google Drive - Almacenamiento Público/Semipúblico
*   **Uso:** Material bibliográfico general, normas técnicas públicas y recursos de apoyo masivos.
*   **Modelo de Costos:** **$0 USD** (Dentro de los límites de cuota de la cuenta de Google y la API).
*   **Limitación Estratégica:** Drive requiere que los archivos sean "Públicos con el enlace" para que el visor y las miniaturas funcionen fluidamente. 
*   **Riesgo de Exposición:** Al ser enlaces públicos, si un usuario copia la URL, podría compartirla externamente, lo que debilita el valor de un "Recurso Premium".

### 25.3. Estrategia "Safe-Profit" Recomendada
1.  **Material Gratuito/Público:** Alojar en **Google Drive** para ahorrar costos de almacenamiento y transferencia en GCS.
2.  **Material Premium/Propio:** Alojar en **GCS**. Aunque genera un costo marginal, garantiza que el archivo solo sea accesible a través de los guardias de nuestra plataforma (`unlockResource`), protegiendo la propiedad intelectual y el modelo de negocio de suscripciones.

---
