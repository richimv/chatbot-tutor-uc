# 🤖 Specs Técnicas: Chat Tutor IA (V6.2 - Gemini 3.1 Flash Lite & Pinecone)

## 1. Visión General
El Chat Tutor de Hub Academia es un motor conversacional multi-dominio diseñado para responder dudas especializadas en tiempo real, utilizando una arquitectura **RAG Semántica Pura**.

- **Motor Semántico (Pinecone):** Recuperación vectorial de alta fidelidad basada en significado profundo.
- **Acceso por Tier:** El acceso a RAG vectorial (Pinecone) está reservado exclusivamente para suscriptores **Advanced / Elite** (hasta 25 consultas RAG/día). Los usuarios Basic/Free operan con IA generativa experta optimizada sin sobrecarga vectorial.
- **Aislamiento por Namespaces:** Separación total entre conocimiento médico (`medicine`) y educativo (`education`).
- **Rigor Técnico:** Fundamentación en fuentes oficiales (MINSA/MINEDU/CNEB).

## 2. Arquitectura de Modelos
El sistema utiliza **Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`) como motor principal de inferencia, optimizado para latencia mínima y razonamiento multimodal.

- **Orquestación:** `TutorAiService.js` gestiona el routing dinámico, la inyección de contexto y la sanitización de payloads.
- **UI Desacoplada de Marcas:** Las interfaces móviles y web no muestran nombres de modelos comerciales ("Gemini 2.5", etc.), manteniendo una experiencia de usuario limpia y enfocada en el sustento pedagógico y clínico.
- **Semantic Expansion:** Motor de re-escritura en `RagService.js` que expande la consulta del usuario en temas técnicos.
- **Embeddings:** Vertex AI `text-multilingual-embedding-002` (768 dimensiones).

## 3. Modalidades y Especializaciones Reales del Chat

El ecosistema de chat de Hub Academia se divide en 3 modalidades con arquitecturas y propósitos específicos:

### 3.1 🌐 Modalidad 1: Asistente Guía Hub Academia (Chat General Flotante - `neutral`)
- **Implementación:** `chat.js` (Frontend) ↔ `chatController.js` / `asistenteGuiaKnowledge.js` (Backend).
- **Mecánica:** **100% Estático y Efímero** con **latencia de 0ms** y **costo $0 de inferencia IA o base de datos**. Procesa consultas mediante coincidencia inteligente de intención contra la base de conocimiento oficial.
- **Propósito:** Orientación de la plataforma, explicación de los dos pilares oficiales (**SERUMS** para Salud y **ASCENSO** para Educación), información de planes y precios (Free, Basic, Advanced), sustento oficial y guía de registro.
- **Cuotas y Vidas:** **0 consumo de vidas y 0 consumo de límites diarios** para todos los usuarios (visitantes y autenticados).
- **Persistencia:** Cero escrituras en base de datos (las tablas `conversations` y `chat_messages` no se usan para este chat).

### 3.2 📝 Modalidad 2: Quiz Tutor (Tutor en Simuladores de Examen - `quiz_tutor`)
- **Implementación:** `quiz.html` / `quiz-tutor.js` (Frontend) ↔ `chatController.js` / `tutorAiService.js` (Backend).
- **Activación:** Se abre directamente en la pregunta activa del examen ante dudas del estudiante.
- **Inyección de Contexto:** Recibe el reactivo completo (enunciado, opciones A-D, opción correcta, respuesta marcada por el estudiante, acierto/error y justificación oficial), junto con la configuración del examen (`examContext`: `MEDICINA` o `EDUCACION`, `target`: `SERUMS`, `ASCENSO`, etc., carrera, dificultad y áreas).
- **Especializaciones:**
  - **Tutor Clínico (`medicine`):** Especialista en Medicina Peruana (MINSA, EsSalud, SERUMS, ENAM, Residentado). Consulta en el namespace `medicine` de Pinecone (NTS, GPC, Harrison).
  - **Tutor Pedagógico (`education`):** Especialista en Educación Peruana (MINEDU, CNEB, Ley 29944, RVM 094-2020). Consulta en el namespace `education` de Pinecone.
- **Acceso a RAG Vectorial por Tier:**
  - **Admin:** RAG Semántico Puro 100% activo en Quiz Tutor con exención de límites de cuota diaria (cuenta activa garantizada independientemente de los valores de `subscription_tier` o `subscription_status` en la base de datos).
  - **Advanced / Elite:** RAG Semántico Puro activo en Pinecone (hasta 25 consultas RAG/día). Si se agota, degrada automáticamente a IA generativa estándar sin RAG hasta los 100 mensajes diarios.
  - **Basic:** IA generativa experta optimizada **sin RAG** (50 mensajes/día).
  - **Free:** IA generativa experta **sin RAG**, descontando 1 vida por consulta de su pool de 10 vidas.
- **Aislamiento de Semilla Semántica (ragQuerySeed):** La búsqueda vectorial en Pinecone y la extracción de temas técnicos se alimentan exclusivamente del enunciado del reactivo, área/tema y la duda específica del estudiante (`filters.rawUserMessage`), evitando inyectar el prompt con meta-instrucciones del sistema para prevenir la dilución y contaminación de embeddings.
- **Blindaje de Conexión y Retención de Sesión:**
  - `SessionManager`: Refresco proactivo de sesión y token JWT mediante listeners de `visibilitychange` y `focus` al regresar a la pestaña tras periodos de inactividad prolongada (> 1 hora).
  - `QuizTutor`: Verificación proactiva de token válido antes de emitir llamadas a `/api/chat` para prevenir degradación silenciosa a modo visitante por expiración de JWT.
  - `Postgres Pool (db.js)`: Configuración con `keepAliveInitialDelayMillis: 10000` y reintentos defensivos transparentes para evitar caídas ante timeouts del pooler transaccional de Supabase.
- **Capacidades Visuales Proactivas:** Capacidad de insertar hasta 3 imágenes/esquemas del catálogo visual de Postgres/GCS cuando el tema clínico o pedagógico lo amerite.

### 3.3 🧠 Modalidad 3: Flashcard Tutor (Tutor en Módulo de Repaso - `flashcard_tutor`)
- **Implementación:** `flashcards.html` / `tutor-chat.js` (Frontend) ↔ `chatController.js` / `tutorAiService.js` (Backend).
- **Activación:** Se abre durante la sesión de repaso espaciado de flashcards (SM-2).
- **Inyección de Contexto:** Recibe el contexto exacto de la tarjeta: disciplina (`deckCategory`), nombre del mazo (`deckName`), tema específico (`topic`), anverso (`front`), reverso (`back`) y recursos visuales adjuntos.
- **Especialización Multidisciplinaria Pura:** Adapta automáticamente su terminología, marco analítico y rigor pedagógico a la disciplina de la tarjeta:
  - **Derecho:** Doctrina jurídica, preceptos normativos y jurisprudencia.
  - **Medicina / Salud:** Fisiopatología, diagnóstico, clínica y farmacología.
  - **Educación:** Didáctica, enfoque por competencias y lineamientos CNEB.
  - **Tecnología / Programación:** Arquitectura de software, algoritmos, redes, bases de datos y buenas prácticas de código.
  - **Matemáticas, Historia, Ciencias y General:** Marco conceptual y analítico de la materia.
- **Aislamiento Temático Estricto (CERO CONTAMINACIÓN):**
  - **Sin RAG en Pinecone:** No ejecuta búsquedas vectoriales médicas ni educativas en materias ajenas, garantizando **cero contaminación temática**.
  - Prohibición estricta de emitir descargos médicos o citas del MINSA en materias ajenas a medicina.
- **Cuotas:** Descuenta de la cuota diaria de IA (`daily_ai_usage`) en planes premium o 1 vida en planes Free.

## 4. Capacidades Multimedia e Inteligencia Visual
El sistema gestiona una arquitectura de apoyo visual proactivo y especializado:

### 4.1 Multimodal Vision en Quiz y Flashcard
- **Visión Multimodal Nativa en Tiempo Real (Simulador y Repaso):**
  - Orquestado en `tutorAiService.js` (`_extractMultimodalParts`) y `chatController.js`.
  - Cuando una pregunta de examen, casuística o tarjeta mnemotécnica contiene imágenes (vía `imageUrl`, `caseImageUrl`, `explanationImageUrl` o etiquetas `<img src="...">`), el backend resuelve y descarga internamente el buffer desde Google Cloud Storage (GCS) en ~30ms y lo inyecta como `inlineData` directamente en la llamada multimodal a Gemini (`gemini-2.5-flash-lite` / Vertex AI).
  - Permite al Tutor IA leer textos en imágenes (OCR), interpretar cuadros sinópticos, analizar guiones teatrales, curvas estadísticas, esquemas anatómicos o cerámicas artísticas con fidelidad milimétrica.
  - **Límite de Seguridad:** Hasta **4 imágenes de entrada por consulta** con deduplicación automática y tolerancia a fallos.
- **Catálogo Visual Dinámico:** Integración con Postgres para buscar recursos tipo `other` (infografías, esquemas) en tiempo real.
- **Proactividad Visual:** La IA decide autónomamente cuándo insertar una imagen del catálogo. No requiere que el usuario la pida explícitamente si el tema es complejo.
- **Límite de Recursos Salientes:** Hasta **3 imágenes por respuesta** si la complejidad del tema lo amerita (exclusivo para Medicina y Educación).
- **Tablas Proactivas:** Capacidad universal (todos los dominios) para generar tablas comparativas y cuadros sinópticos en Markdown para estructurar información técnica.
- **Renderizado Premium:** Procesador DOM en `markdown-renderer.js` que envuelve tablas en wrappers responsivos y resuelve URLs de GCS mediante el proxy `/api/media/gcs`.

### 4.2 Motor Universal de Renderizado Matemático y Científico (KaTeX LaTeX)
- **Parseo y Aislamiento Tipográfico:**
  - En `src/presentation/public/js/utils/markdown-renderer.js`, se implementó una fase de pre-extracción de fórmulas LaTeX (`_extractMath`) que aísla expresiones inline (`$...$`, `\(...\)`) y display en bloque (`$$...$$`, `\[...\]`), protegiendo subíndices (`_`), asteriscos (`*`) y backslashes de ser alterados por el analizador Markdown (`marked.js`).
  - Distinción inteligente de sintaxis monetaria (ej. `$100 ni $50`) para evitar falsos positivos de renderizado en textos financieros o comerciales.
- **Renderizado KaTeX Nativo:**
  - Las ecuaciones matemáticas (ej. $\int x^2 dx$, $\frac{x^{n+1}}{n+1} + C$) y fórmulas químicas (ej. $\mathrm{H_2O + CO_2 \rightarrow H_2CO_3}$) se compilan a HTML/MathML de alta fidelidad tipográfica mediante `window.katex.renderToString`.
  - Mecanismo de **carga perezosa y fallback defensivo** (`_ensureKaTeXLoaded` y `renderMathInElement`) para garantizar que las ecuaciones se rendericen fluidamente en todas las vistas (`quiz.html`, `flashcards.html`, `repaso.html`, `resource.html`, `course.html`, `index.html`, `admin.html`).

## 4. Flujo de Procesamiento RAG
1. **Routing:** El controlador detecta la especialidad enviada desde la UI.
2. **Retrieval:** `RagService` consulta Pinecone usando el namespace correspondiente.
3. **Augmentation:** Se inyecta el contexto recuperado en el prompt de `chatPrompts.js`.
4. **Generation:** Gemini genera una respuesta estructurada en JSON con Markdown.

## 5. Estructura de Respuesta (JSON Nativo)
Todas las respuestas del tutor siguen este esquema para ser renderizadas por el frontend:
```json
{
  "intencion": "consulta_especializada",
  "respuesta": "Texto en Markdown pedagógico...",
  "sugerencias": ["Pregunta 1", "Pregunta 2", "Pregunta 3"]
}
```
- `responseMimeType: "application/json"` fuerza a Gemini a devolver JSON válido.
- Parsing en `TutorAiService.js` con fallback de limpieza de bloques ```` ```json ````

## 6. Evolución Técnica: De FTS a Pinecone Puro
El sistema ha migrado de una búsqueda basada en palabras clave (FTS) a una arquitectura **100% basada en Contexto Semántico**. Esto garantiza que el tutor entienda sinónimos, pedagogía y relaciones clínicas complejas sin depender de una base de datos local.

---

## 7. Pipeline de Renderizado de Texto (V3 — Unificado)

### 7.1 Problema Original
El texto de la IA se mostraba con formato inconsistente, JSON crudo visible, `\n` literales, y espaciado excesivo entre párrafos y viñetas.

### 7.2 Causa Raíz
Dos sistemas conflictivos preservaban el whitespace simultáneamente:
- `white-space: pre-wrap` en `.message` (CSS) → preservaba cada `\n` como espacio visual.
- `marked.js` con `breaks: true` → convertía cada `\n` en `<br>`.
- **Resultado:** cada salto de línea se renderizaba **dos veces**.
- Además, `marked.js` no estaba cargado en la mayoría de páginas (solo `flashcards.html` y `quiz.html`).

### 7.3 Arquitectura Actual

```
Gemini API → JSON { respuesta: "Markdown..." }
    ↓
TutorAiService.js → Parsea JSON, extrae "respuesta"
    ↓
ChatController.js → enrichResponse() → res.json({ respuesta, sugerencias })
    ↓
Frontend (chat.js / tutor-chat.js)
    ↓
formatMessage(text)
    ├─ JSON Safety Net: detecta JSON crudo → extrae "respuesta"
    └─ MarkdownRenderer.render(text)
         ├─ JSON Safety Net (centralizado)
         ├─ marked.js parse (breaks: true, gfm: true)
         ├─ wrapTables() → responsividad horizontal
         ├─ resolveImageUrl() → resolución de paths de GCS vía proxy
         └─ referrerpolicy="no-referrer" → bypass contra bloqueo de hotlinking externo
    ↓
<div class="message-body markdown-content">HTML renderizado</div>
    ↓
markdown-content.css → Tipografía premium unificada
```

### 7.4 Archivos Clave

| Archivo | Rol |
|---------|-----|
| `css/markdown-content.css` | **CSS único** para todo contenido Markdown de la IA |
| `js/utils/markdown-renderer.js` | Motor de parsing centralizado (marked.js + fallback regex) |
| `js/chat.js` → `formatMessage()` | Renderiza mensajes del chat general |
| `js/tutor-chat.js` → `addMessage()` | Renderiza mensajes del tutor de flashcards |

| `js/ui/libraryUI.js` | Renderiza notas guardadas en el visor |

### 7.5 JSON Safety Net
Si por algún motivo el texto contiene un JSON crudo (fallo de parsing backend, mensajes históricos corruptos):
```javascript
if (typeof text === 'string' && text.trimStart().startsWith('{')) {
    try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.respuesta) text = parsed.respuesta;
    } catch(e) {}
}
```
Implementado en: `markdown-renderer.js`, `chat.js`, y `tutor-chat.js`.

### 7.6 Dependencias CDN (marked.js)
`marked.min.js` **DEBE** cargarse ANTES de `markdown-renderer.js` en cada HTML:
- ✅ `index.html`
- ✅ `resource.html`
- ✅ `course.html`
- ✅ `flashcards.html`
- ✅ `repaso.html`
- ✅ `simulator-dashboard.html`
- ✅ `quiz.html`

### 7.7 Configuración de marked.js
```javascript
marked.setOptions({
    gfm: true,        // GitHub Flavored Markdown (tablas, strikethrough)
    breaks: true,      // \n → <br> (seguro porque pre-wrap fue removido)
    headerIds: false,  // Sin IDs auto-generados en headings
    mangle: false      // Sin ofuscación de emails
});
```

---

## 8. Diseño CSS Unificado (`markdown-content.css`)

### 8.1 Clases CSS
| Clase | Uso |
|-------|-----|
| `.markdown-content` | Contenedor base para texto IA (paragraphs, lists, code, tables) |
| `.markdown-compact` | Modificador para paneles pequeños (Audio, Tutor Flashcard) |

### 8.2 Paleta de Colores
| Elemento | Color | Token |
|----------|-------|-------|
| Headings H1, H2 | `#93c5fd` | Blue 300 |
| Headings H3 | `#a5b4fc` | Indigo 300 |
| Bold/Strong | `#60a5fa` | Blue 400 (accent keywords) |
| List markers | `#60a5fa` | Blue 400 |
| Blockquote border | `#6366f1` | Indigo 500 |
| Code blocks bg | `#020617` | Slate 950 |
| Inline code bg | `rgba(0,0,0,0.35)` | — |

### 8.3 Spacing
- **Párrafos:** `margin-bottom: 0.6em`
- **Listas:** `margin: 0.4em 0 0.7em`, items `margin-bottom: 0.25em`
- **Headings:** `margin-top: 1.1em`, `margin-bottom: 0.4em`
- **Code blocks:** `margin: 0.75em 0`
- **Compact variant:** Reduce ~15% todos los espaciados

### 8.4 Ancho de Mensajes
- **Bot messages:** `max-width: 95%` — Aprovecha casi todo el ancho del chat.
- **User messages:** `max-width: 85%` — Distinción visual del remitente.

---

## 9. Interfaces del Chat

### 9.1 Chat General (Widget flotante)
- **Archivo:** `js/chat.js`
- **Persistencia:** Conversaciones guardadas en PostgreSQL vía `ChatService`.
- **Historial:** Carga completa al cambiar de conversación.
- **Sugerencias:** Pastillas clickeables generadas por la IA o fallback predefinido.

### 9.2 Asistente de Voz (Audio Assistant) [ELIMINADO - JULIO 2026]
- **Estado**: Eliminado en su totalidad tanto del frontend como del backend por motivos de reducción de costos y reestructuración de límites.
- **Acción**: Los archivos `audio-assistant.js` y `audio-assistant.css` han sido removidos y sus cuotas asociadas eliminadas de la base de datos.

### 9.3 Tutor de Flashcards
- **Archivo:** `js/tutor-chat.js`
- **Modo:** Efímero con historial de sesión en cliente.
- **Contexto:** Inyecta `front`, `back`, `topic` de la tarjeta activa.
- **Estilo:** `.markdown-compact` para panel lateral compacto.

---

## 10. Prompts del Sistema (`chatPrompts.js`)

### 10.1 Directrices de Formato (Globales)
Inyectadas a TODOS los prompts vía `buildPrompt()`:
1. Markdown rico: `**negrita**` para conceptos clave.
2. Viñetas `- o *` para clasificaciones.
3. Doble salto de línea entre párrafos.
4. `## o ###` para subtítulos en explicaciones extensas.
5. **Tablas Proactivas:** La IA decide crear tablas para fundamentar y dar claridad profesional.
6. **NUNCA** envolver la respuesta en bloques de código.

### 10.2 Rol de Curador Visual (Medicina/Edu)
1. **Selección:** Elegir hasta 3 imágenes del catálogo si son altamente relevantes.
2. **Integración:** Sintaxis `![Descripción](URL)` integrada naturalmente en el flujo.
3. **No alucinar:** Si el catálogo no aplica, ignorarlo sin mencionarlo.

### 10.3 Reglas de Citación
- **Fuentes oficiales (MINSA, MINEDU):** Citar explícitamente (NTS, GPC, RVM).
- **Literatura comercial (Harrison, CTO):** Camuflar como "literatura médica estándar".

### 10.3 Sugerencias Activas
- 3 preguntas cortas (máx 45 caracteres) en el array `sugerencias`.
- Escritas en primera persona del usuario: "Quiero saber más", "Dame un ejemplo".
- **NUNCA** incluirlas dentro del texto de la `respuesta`.

---

## 11. Archivo Deprecado
- **`chat.html`**: Página standalone legacy que usa Bootstrap 5. **NO se usa** en la aplicación actual. El chat vive como widget flotante inyectado por `chat.js` en todas las páginas. Solo existe una ruta legacy en `vercel.json`. Candidato a eliminación.

---

## 12. Interfaz del Selector de Modos (Model Selector UI)
Para maximizar el espacio útil de lectura en el widget de chat y profesionalizar la interfaz visual, se rediseñó el selector de especialidades:
- **Selector de Cabecera (`#chatbot-persona-trigger`)**: Reemplaza el contenedor de pestañas por una cápsula interactiva dentro del encabezado que muestra el modo activo ("Neutro", "Médico" o "Educación") como subtítulo dinámico y un chevron de rotación.
- **Menú Desplegable Flotante (`#chatbot-persona-dropdown`)**: Un popover glassmorphic con desenfoque de fondo al 94%, sombras pronunciadas y acentos de color contextuales según la especialidad seleccionada (Azul para General, Cian para Médico, Verde para Educación).
- **Controlador de Cierre Automático**: Cierra el selector al cambiar de modo o si el usuario hace clic fuera de la cabecera o el panel desplegable.

---

## 13. Burbuja de Invitación Animada (Chat Tooltip UX)
Para guiar al usuario e invitarlo a interactuar con el Tutor IA de manera amigable, se implementó una burbuja de diálogo interactiva, diferida y optimizada para rendimiento extremo (60 FPS):
- **Inyección HTML (`#chat-invitation-bubble`)**: El widget flotante inyecta el contenedor de la burbuja como elemento hermano directo (fuera de `#chatbot-toggle`). Esto elimina el acoplamiento de renderizado, evitando que la burbuja sufra las transformaciones de escala y rotación aplicadas al botón durante el hover.
- **Despliegue Diferido (3 segundos)**: Al cargar cualquier página que instancie `ChatComponent`, se activa un temporizador de 3 segundos antes de mostrar la burbuja de invitación.
- **Persistencia de Descarte (Local Storage)**: Si el usuario pulsa la "X" de cierre de la burbuja, se detiene la propagación para evitar abrir el chat, se oculta la burbuja de inmediato y se guarda en `localStorage` la clave `chat_invitation_dismissed: 'true'`, previniendo futuras activaciones de la invitación para no perturbar su experiencia de estudio.
- **Acceso Rápido Integrado**: Si el usuario pulsa en cualquier otra parte de la burbuja, se inicia automáticamente el flujo de apertura del chat y se remueve la clase activa de la burbuja.
- **Aceleración por Hardware y Fluidez a 60 FPS (`chat.css`)**:
  - Posicionamiento `position: fixed` fijo en pantalla con override responsivo para móviles (`bottom: 95px; right: 24px` en escritorio, `bottom: 86px; right: 20px` en móvil) para evitar recálculos de flujo (reflow).
  - Uso de las directivas `will-change: transform, opacity;` y `transform-style: preserve-3d;` con `backface-visibility: hidden;` para forzar la composición en capas independientes de la GPU.
  - La animación `@keyframes bubble-float` mantiene explícitamente la escala constante (`scale(1)`) en sus keyframes, evitando colisiones con el estado inicial de escalado en la transición de entrada.

---

## 14. Tutor de Simulador de Examen (Quiz Tutor)
- **Archivos:** [quiz-tutor.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz-tutor.js) (cliente), [quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html), [quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) y [components.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js).
- **Modo:** Efímero con envío de historial de sesión por cliente (`history`) y cero escrituras relacionales en BD.
- **Flujo de Acceso e Interfaz de Examen**:
  - **Durante el Examen (Modos 10q y 20q)**: Se habilita únicamente una vez que el usuario ha respondido la pregunta activa (tras hacer clic en una opción y desplegarse el botón Siguiente).
  - **En Simulacros Reales (100 preguntas)**: Se deshabilita durante la ejecución para preservar las condiciones de evaluación oficial.
  - **En Culminación y Revisión de Examen (`showExamReview`)**: Cada tarjeta de pregunta integra el botón disparador del Tutor IA (`.btn-review-tutor-trigger` / `window.openTutorForReviewQuestion`) para profundizar en casuísticas individuales, con aislamiento de eventos para evitar interferencias con el visor Lightbox.
- **Modo Pantalla Completa en Escritorio (PC)**:
  - Integra la clase `.tutor-chat-panel.chat-fullscreen` accionada por el botón `#quiz-tutor-expand`, permitiendo expandir la ventana a `100vw x 100vh` en PC para la lectura cómoda de tablas comparativas y esquemas técnicos.
- **Contexto RAG de Alta Fidelidad:**
  - El cliente captura los metadatos de la pregunta en curso (enunciado, opciones de respuesta, opción correcta, opción elegida por el usuario, resultado de acierto/error, explicación oficial, tema técnico y examen objetivo) y los transmite en el campo `context` con tipo `quiz_tutor`.
  - El backend (`chatController.js`) detecta este contexto e inyecta dinámicamente el prompt al modelo Gemini 2.5 Flash Lite.
### 7.2 Causa Raíz
Dos sistemas conflictivos preservaban el whitespace simultáneamente:
- `white-space: pre-wrap` en `.message` (CSS) → preservaba cada `\n` como espacio visual.
- `marked.js` con `breaks: true` → convertía cada `\n` en `<br>`.
- **Resultado:** cada salto de línea se renderizaba **dos veces**.
- Además, `marked.js` no estaba cargado en la mayoría de páginas (solo `flashcards.html` y `quiz.html`).

### 7.3 Arquitectura Actual

```
Gemini API → JSON { respuesta: "Markdown..." }
    ↓
TutorAiService.js → Parsea JSON, extrae "respuesta"
    ↓
ChatController.js → enrichResponse() → res.json({ respuesta, sugerencias })
    ↓
Frontend (chat.js / tutor-chat.js)
    ↓
formatMessage(text)
    ├─ JSON Safety Net: detecta JSON crudo → extrae "respuesta"
    └─ MarkdownRenderer.render(text)
         ├─ JSON Safety Net (centralizado)
         ├─ marked.js parse (breaks: true, gfm: true)
         ├─ wrapTables() → responsividad horizontal
         ├─ resolveImageUrl() → resolución de paths de GCS vía proxy
         └─ referrerpolicy="no-referrer" → bypass contra bloqueo de hotlinking externo
    ↓
<div class="message-body markdown-content">HTML renderizado</div>
    ↓
markdown-content.css → Tipografía premium unificada
```

### 7.4 Archivos Clave

| Archivo | Rol |
|---------|-----|
| `css/markdown-content.css` | **CSS único** para todo contenido Markdown de la IA |
| `js/utils/markdown-renderer.js` | Motor de parsing centralizado (marked.js + fallback regex) |
| `js/chat.js` → `formatMessage()` | Renderiza mensajes del chat general |
| `js/tutor-chat.js` → `addMessage()` | Renderiza mensajes del tutor de flashcards |

| `js/ui/libraryUI.js` | Renderiza notas guardadas en el visor |

### 7.5 JSON Safety Net
Si por algún motivo el texto contiene un JSON crudo (fallo de parsing backend, mensajes históricos corruptos):
```javascript
if (typeof text === 'string' && text.trimStart().startsWith('{')) {
    try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.respuesta) text = parsed.respuesta;
    } catch(e) {}
}
```
Implementado en: `markdown-renderer.js`, `chat.js`, y `tutor-chat.js`.

### 7.6 Dependencias CDN (marked.js)
`marked.min.js` **DEBE** cargarse ANTES de `markdown-renderer.js` en cada HTML:
- ✅ `index.html`
- ✅ `resource.html`
- ✅ `course.html`
- ✅ `flashcards.html`
- ✅ `repaso.html`
- ✅ `simulator-dashboard.html`
- ✅ `quiz.html`

### 7.7 Configuración de marked.js
```javascript
marked.setOptions({
    gfm: true,        // GitHub Flavored Markdown (tablas, strikethrough)
    breaks: true,      // \n → <br> (seguro porque pre-wrap fue removido)
    headerIds: false,  // Sin IDs auto-generados en headings
    mangle: false      // Sin ofuscación de emails
});
```

---

## 8. Diseño CSS Unificado (`markdown-content.css`)

### 8.1 Clases CSS
| Clase | Uso |
|-------|-----|
| `.markdown-content` | Contenedor base para texto IA (paragraphs, lists, code, tables) |
| `.markdown-compact` | Modificador para paneles pequeños (Audio, Tutor Flashcard) |

### 8.2 Paleta de Colores
| Elemento | Color | Token |
|----------|-------|-------|
| Headings H1, H2 | `#93c5fd` | Blue 300 |
| Headings H3 | `#a5b4fc` | Indigo 300 |
| Bold/Strong | `#60a5fa` | Blue 400 (accent keywords) |
| List markers | `#60a5fa` | Blue 400 |
| Blockquote border | `#6366f1` | Indigo 500 |
| Code blocks bg | `#020617` | Slate 950 |
| Inline code bg | `rgba(0,0,0,0.35)` | — |

### 8.3 Spacing
- **Párrafos:** `margin-bottom: 0.6em`
- **Listas:** `margin: 0.4em 0 0.7em`, items `margin-bottom: 0.25em`
- **Headings:** `margin-top: 1.1em`, `margin-bottom: 0.4em`
- **Code blocks:** `margin: 0.75em 0`
- **Compact variant:** Reduce ~15% todos los espaciados

### 8.4 Ancho de Mensajes
- **Bot messages:** `max-width: 95%` — Aprovecha casi todo el ancho del chat.
- **User messages:** `max-width: 85%` — Distinción visual del remitente.

---

## 9. Interfaces del Chat

### 9.1 Chat General (Widget flotante)
- **Archivo:** `js/chat.js`
- **Persistencia:** Conversaciones guardadas en PostgreSQL vía `ChatService`.
- **Historial:** Carga completa al cambiar de conversación.
- **Sugerencias:** Pastillas clickeables generadas por la IA o fallback predefinido.

### 9.2 Asistente de Voz (Audio Assistant) [ELIMINADO - JULIO 2026]
- **Estado**: Eliminado en su totalidad tanto del frontend como del backend por motivos de reducción de costos y reestructuración de límites.
- **Acción**: Los archivos `audio-assistant.js` y `audio-assistant.css` han sido removidos y sus cuotas asociadas eliminadas de la base de datos.

### 9.3 Tutor de Flashcards
- **Archivo:** `js/tutor-chat.js`
- **Modo:** Efímero con historial de sesión en cliente.
- **Contexto:** Inyecta `front`, `back`, `topic` de la tarjeta activa.
- **Estilo:** `.markdown-compact` para panel lateral compacto.

---

## 10. Prompts del Sistema (`chatPrompts.js`)

### 10.1 Directrices de Formato (Globales)
Inyectadas a TODOS los prompts vía `buildPrompt()`:
1. Markdown rico: `**negrita**` para conceptos clave.
2. Viñetas `- o *` para clasificaciones.
3. Doble salto de línea entre párrafos.
4. `## o ###` para subtítulos en explicaciones extensas.
5. **Tablas Proactivas:** La IA decide crear tablas para fundamentar y dar claridad profesional.
6. **NUNCA** envolver la respuesta en bloques de código.

### 10.2 Rol de Curador Visual (Medicina/Edu)
1. **Selección:** Elegir hasta 3 imágenes del catálogo si son altamente relevantes.
2. **Integración:** Sintaxis `![Descripción](URL)` integrada naturalmente en el flujo.
3. **No alucinar:** Si el catálogo no aplica, ignorarlo sin mencionarlo.

### 10.3 Reglas de Citación
- **Fuentes oficiales (MINSA, MINEDU):** Citar explícitamente (NTS, GPC, RVM).
- **Literatura comercial (Harrison, CTO):** Camuflar como "literatura médica estándar".

### 10.3 Sugerencias Activas
- 3 preguntas cortas (máx 45 caracteres) en el array `sugerencias`.
- Escritas en primera persona del usuario: "Quiero saber más", "Dame un ejemplo".
- **NUNCA** incluirlas dentro del texto de la `respuesta`.

---

## 11. Archivo Deprecado
- **`chat.html`**: Página standalone legacy que usa Bootstrap 5. **NO se usa** en la aplicación actual. El chat vive como widget flotante inyectado por `chat.js` en todas las páginas. Solo existe una ruta legacy en `vercel.json`. Candidato a eliminación.

---

## 12. Interfaz del Selector de Modos (Model Selector UI)
Para maximizar el espacio útil de lectura en el widget de chat y profesionalizar la interfaz visual, se rediseñó el selector de especialidades:
- **Selector de Cabecera (`#chatbot-persona-trigger`)**: Reemplaza el contenedor de pestañas por una cápsula interactiva dentro del encabezado que muestra el modo activo ("Neutro", "Médico" o "Educación") como subtítulo dinámico y un chevron de rotación.
- **Menú Desplegable Flotante (`#chatbot-persona-dropdown`)**: Un popover glassmorphic con desenfoque de fondo al 94%, sombras pronunciadas y acentos de color contextuales según la especialidad seleccionada (Azul para General, Cian para Médico, Verde para Educación).
- **Controlador de Cierre Automático**: Cierra el selector al cambiar de modo o si el usuario hace clic fuera de la cabecera o el panel desplegable.

---

## 13. Burbuja de Invitación Animada (Chat Tooltip UX)
Para guiar al usuario e invitarlo a interactuar con el Tutor IA de manera amigable, se implementó una burbuja de diálogo interactiva, diferida y optimizada para rendimiento extremo (60 FPS):
- **Inyección HTML (`#chat-invitation-bubble`)**: El widget flotante inyecta el contenedor de la burbuja como elemento hermano directo (fuera de `#chatbot-toggle`). Esto elimina el acoplamiento de renderizado, evitando que la burbuja sufra las transformaciones de escala y rotación aplicadas al botón durante el hover.
- **Despliegue Diferido (3 segundos)**: Al cargar cualquier página que instancie `ChatComponent`, se activa un temporizador de 3 segundos antes de mostrar la burbuja de invitación.
- **Persistencia de Descarte (Local Storage)**: Si el usuario pulsa la "X" de cierre de la burbuja, se detiene la propagación para evitar abrir el chat, se oculta la burbuja de inmediato y se guarda en `localStorage` la clave `chat_invitation_dismissed: 'true'`, previniendo futuras activaciones de la invitación para no perturbar su experiencia de estudio.
- **Acceso Rápido Integrado**: Si el usuario pulsa en cualquier otra parte de la burbuja, se inicia automáticamente el flujo de apertura del chat y se remueve la clase activa de la burbuja.
- **Aceleración por Hardware y Fluidez a 60 FPS (`chat.css`)**:
  - Posicionamiento `position: fixed` fijo en pantalla con override responsivo para móviles (`bottom: 95px; right: 24px` en escritorio, `bottom: 86px; right: 20px` en móvil) para evitar recálculos de flujo (reflow).
  - Uso de las directivas `will-change: transform, opacity;` y `transform-style: preserve-3d;` con `backface-visibility: hidden;` para forzar la composición en capas independientes de la GPU.
  - La animación `@keyframes bubble-float` mantiene explícitamente la escala constante (`scale(1)`) en sus keyframes, evitando colisiones con el estado inicial de escalado en la transición de entrada.

---

## 14. Tutor de Simulador de Examen (Quiz Tutor)
- **Archivos:** [quiz-tutor.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz-tutor.js) (cliente), [quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html), [quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) y [components.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js).
- **Modo:** Efímero con envío de historial de sesión por cliente (`history`) y cero escrituras relacionales en BD.
- **Flujo de Acceso e Interfaz de Examen**:
  - **Durante el Examen (Modos 10q y 20q)**: Se habilita únicamente una vez que el usuario ha respondido la pregunta activa (tras hacer clic en una opción y desplegarse el botón Siguiente).
  - **En Simulacros Reales (100 preguntas)**: Se deshabilita durante la ejecución para preservar las condiciones de evaluación oficial.
  - **En Culminación y Revisión de Examen (`showExamReview`)**: El botón de Tutor IA se **remueve/oculta por completo** de las tarjetas de corrección de preguntas y de la interfaz final. Cada pregunta en la fase de revisión ya exhibe su explicación técnica y sustento oficial directamente, evitando redundancia.
- **Modo Pantalla Completa en Escritorio (PC)**:
  - Integra la clase `.tutor-chat-panel.chat-fullscreen` accionada por el botón `#quiz-tutor-expand`, permitiendo expandir la ventana a `100vw x 100vh` en PC para la lectura cómoda de tablas comparativas y esquemas técnicos.
- **Contexto RAG de Alta Fidelidad:**
  - El cliente captura los metadatos de la pregunta en curso (enunciado, opciones de respuesta, opción correcta, opción elegida por el usuario, resultado de acierto/error, explicación oficial, tema técnico y examen objetivo) y los transmite en el campo `context` con tipo `quiz_tutor`.
  - El backend (`chatController.js`) detecta este contexto e inyecta dinámicamente el prompt al modelo Gemini 2.5 Flash Lite.
  - Activa RAG semántico consultando Pinecone en el namespace correspondiente (`medicine` o `education`) basándose en la pregunta y temas técnicos.
- **Monetización y Límites:**
  - **Usuarios Free/Pending:** Consumen 1 vida global (`usage_count`) por consulta.
  - **Usuarios Active (Basic/Advanced):** Incrementan la cuota diaria (`daily_ai_usage` / `daily_rag_usage`), bloqueando el acceso en el middleware de cuota si se excede el límite asignado.

---

## 15. Iconografía y Branding de Hubi (`hubi.png` & `hubifrente.png`)
Para consolidar una identidad visual unificada, moderna y profesional del Asistente Guía e IA de Hub Academia:
- **`hubi.png` (Avatar Flotante Global)**:
  - Implementado como la imagen distintiva del botón flotante global `#chatbot-toggle` en `chat.js` y `chat.css`.
  - Dimensionado a `44px x 44px` con sombra suave y micro-interacción de rotación/escalado al hacer hover.
- **`hubifrente.png` (Vista Frontal del Asistente)**:
  - **Encabezado del Chat General (`chat.js`)**: Renderizado en el elemento `<img id="chatbot-icon" src="/assets/hubifrente.png">` (`32px x 32px`).
  - **Burbuja de Invitación (`#chat-invitation-bubble`)**: Incorpora el avatar mini de Hubi de frente (`30px x 30px`) acompañando la llamada a la acción.
  - **Tutor de Quiz / Simuladores (`quiz-tutor.js`, `quiz.html`)**: Encabezado del panel lateral y botón "Consultar Tutor IA".
  - **Tutor de Repaso / Flashcards (`tutor-chat.js`, `flashcards.js`)**: Encabezado del panel lateral y botón "Dudas con esta respuesta".
  - **Landing Page Mockup (`index.html`)**: Avatar del Asistente en la ventana conversacional de demostración.
- **Restablecimiento y Estabilidad de la Burbuja Tooltip en PC & Móvil**:
  - Se removieron las directivas de renderizado 3D (`transform-style: preserve-3d` y `backface-visibility: hidden`) en `chat.css` que generaban desacoplamiento de capas en aceleración por hardware de Chrome/Edge en PC.
  - El `z-index` de `.chat-invitation-bubble` se elevó a `10050` para garantizar que la invitación flote visiblemente por encima de cualquier otro componente tanto en escritorio como en dispositivos móviles.

---

## 16. Asistente Guía: Base de Conocimientos 100% Estática de Alta Velocidad (Agosto 2026)

Para optimizar costos de cómputo, reducir las llamadas a la API de Gemini a 0 en el widget flotante general y ofrecer tiempos de respuesta instantáneos (0ms), se reestructuró la arquitectura del **Asistente Guía (Chat General)**:

### 16.1 Módulo `asistenteGuiaKnowledge.js`
Servicio en la capa de dominio (`src/domain/services/asistenteGuiaKnowledge.js`) que centraliza la información oficial de la plataforma:
- **Especialidades Oficiales**: Información centrada exclusivamente en **SERUMS (Salud/Medicina)** y **ASCENSO (Educación Magisterial)**.
- **Categorías de Respuestas Precisas**:
  - `servicios`: Detalla simuladores de SERUMS y ASCENSO, Módulo Repaso (Flashcards) y Mi Biblioteca con enlaces Markdown directos (`[🎯 Ver Simuladores](/simulators)`, `[🎴 Ir a Módulo Repaso](/repaso)`, `[📚 Ir a Mi Biblioteca](/library)`).
  - `precios`: Estructura transparente de Planes Free (10 vidas), Basic y Advanced (`[💎 Ver Tabla de Planes y Precios](/pricing)`).
  - `acceso`: Explicación exacta del acceso en 1 clic mediante Google (botón **"Acceder"** de la barra superior o **"Continuar con Google"**, sin formularios de registro) (`[🔑 Acceder con Google](#acceder)`).
  - `ventajas`: Explicación del sustento técnico oficial (NTS MINSA / CNEB y RVM 094-2020-MINEDU).

### 16.2 Flujo 100% Estático y Efímero para Todos los Usuarios (Basic, Advanced, Free, Visitantes)
1. **0 Llamadas a Gemini**: Toda interacción en el Chat General es despachada instantáneamente (0ms) en memoria de cliente/servidor sin invocar modelos generativos.
2. **4 Píldoras Principales Siempre Visibles**: Se removió la opción redundante de "finalizar conversación". El usuario siempre cuenta con 4 opciones limpias para navegar por la información clave de la plataforma.
3. **Manejador de Acceso Directo con Google**: Al hacer clic en un enlace `[Acceder con Google](#acceder)`, la interfaz abre directamente el modal/diálogo de autenticación con Google (`window.triggerGoogleLogin()`).

---

## 17. Corrección de Resiliencia IA y Persistencia de Exámenes (Agosto 2026)

### 17.1 Fallback Multimodelo en `TutorAiService` y Solución `resourceContext`
- **Resiliencia de Modelos**: Se implementó una cadena de contingencia multimodelo (`['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash']`) en `_callModelResilient`. En caso de respuesta `400/404` por inconsistencia en el endpoint, se conmuta de forma transparente al siguiente modelo de la cadena sin interrumpir al usuario.
- **Corrección en `ChatController.processMessage`**: Se declaró `resourceContext = null` en la desestructuración de `req.body`, eliminando la excepción `ReferenceError` que ocasionaba respuestas HTTP 500 en Quiz Tutor y Flashcards.

### 17.2 Ciclo de Vida y Limpieza de Sesiones de Examen (`quiz.js`)
- **Fusión de Atributos de Conteo (`totalQuestions` & `total_questions`)**: Los repositorios `docenteRepository` y `medicoRepository` resuelven el conteo de preguntas de forma resiliente (`totalQ = quizData.totalQuestions || quizData.total_questions`), garantizando que tanto exámenes finalizados de corrido como retomados registren sus resultados en `quiz_history` y se reflejen en los KPIs.
- **Purga de Sesiones de Examen en `clearSession()`**: La función realiza un barrido de todas las claves con prefijo `simulator_active_session_*` en `localStorage`, impidiendo la reaparición del modal "Continuar examen anterior" tras culminar un examen.
- **Reanudación de Exámenes Interrumpidos**: Al reanudar una sesión en progreso, `initApp()` posiciona automáticamente la interfaz en la primera pregunta sin responder (`firstUnanswered`), permitiendo al usuario continuar fluidamente.

---

## 18. Optimización del Asistente Guía: Opciones Numeradas, Disparo Directo de Modal Google y Desbloqueo Permanente (Agosto 2026)

### 18.1 Delegación de Eventos e Intercepción de Botones de Opción
- **Recepción Instantánea de Clics**: Se expandió el selector de eventos en `chat.js` a `e.target.closest('a, button, li, .chat-option-btn, .suggestion-btn')`. Cliquear cualquiera de las 4 opciones dentro del cuerpo del mensaje del bot dispara automáticamente la consulta al chat sin bloqueos ni retrasos.
- **Instrucción Clara de Registro**: Se removió el botón flotante redundante de `"Registrarme con Google"` en la respuesta del Asistente Guía y en la delegación de eventos del chat. En su lugar, el bot orienta claramente al usuario a pulsar el botón oficial **"Acceder"** de la barra superior para iniciar sesión o registrarse con Google en 1 clic.

### 18.2 Navegación por Números (1, 2, 3, 4) y Formato de Lista Limpia sin Botones Redundantes
- **Lista de Texto Numerada**: Las 4 opciones iniciales se despliegan como una lista de texto en negrita sin sintaxis de hipervínculo (`1. **🚀 Servicios y Simuladores**`, `2. **💳 Planes y Precios**`, etc.), evitando confusiones visuales y eliminando la redundancia de botones dentro del mensaje inicial.
- **Coincidencia Exacta por Entrada de Texto**: `AsistenteGuiaKnowledge.matchIntent` valida de forma limpia entradas simples como `"1"`, `"2"`, `"3"`, `"4"` o `"1."`.
- **Manejo de Entrada No Válida**: Si el usuario envía un número fuera del rango o un texto irrelevante, el bot responde indicando amablemente que ingrese una opción válida (1 al 4) o seleccione las sugerencias de la barra inferior.

### 18.3 Detalle Explicativo de Módulo Repaso y Mi Biblioteca (con Noticias Oficiales)
- **Módulo Repaso (Flashcards Inteligentes)**: Se incorporó la explicación detallada sobre la memorización activa basada en el algoritmo SM-2 (*Olvidé*, *Difícil*, *Bien*, *Fácil*), la generación automatizada de mazos con IA a partir de simulacros y la asistencia del Tutor IA Contextual en cada tarjeta.
- **Mi Biblioteca (Centro de Recursos, Apuntes y Noticias)**: Se especificó la gestión unificada de notas personales y la integración de **Noticias Oficiales y Novedades Normativas** actualizadas del **MINSA (Salud)** y **MINEDU (Educación)**.

### 18.4 Alcance Exclusivo y Formato Singular de Enlaces
- **Exclusividad en Salud (SERUMS)**: Se eliminó cualquier mención de ENAM o Residentado del módulo de respuestas del Asistente Guía, alineándolo al 100% con los dos pilares oficiales actuales (**SERUMS** y **ASCENSO**).
- **Enlaces en Singular**: Todos los hipervínculos hacia simuladores adoptan la estructura en singular: `[🩺 Ver simulador de SERUMS](/simulator-dashboard?context=MEDICINA)` y `[🎓 Ver simulador de ASCENSO](/simulator-dashboard?context=EDUCACION)`.

### 18.5 Desbloqueo Definitivo de la Barra de Búsqueda del Chat General
- **Remoción del Candado para Visitantes**: Se desactivó la restricción que bloqueaba el textarea con el mensaje `"⚠️ Regístrate gratis para continuar."`. La función `setVisitorLockState` mantiene la barra de texto activa y accesible en todo momento con el placeholder `"Pregunta sobre la plataforma..."`.

---

## 19. Auditoría y Corrección de Consumos y RAG por Nivel de Suscripción (Agosto 2026)

### 19.1 Unificación de Tutores Activos en Middleware (`checkLimitsMiddleware.js`)
- **Detección Resiliente de Tutores (`isTutorChat`)**: Se integró la verificación combinada de `context.type === 'quiz_tutor'` y `context.type === 'flashcard_tutor'` (así como `specialization === 'flashcard_tutor'`), garantizando que tanto el **Quiz Tutor** (simulacros) como el **Repaso Tutor** (tarjetas/flashcards) ejecuten el control estricto de consumos y cuotas.

### 19.2 Reglas de Cobro y Bloqueo (Paywall 403)
- **Usuarios Basic (`subscription_tier === 'basic'`)**:
  - Consumen de la cuota diaria `daily_ai_usage` (límite de **50 msgs/día**).
  - Al alcanzar 50 mensajes, el middleware devuelve `403 Forbidden` (`DAILY_LIMIT_EXHAUSTED`), abriendo la modal Paywall.
  - **Uso de RAG**: Estrictamente **deshabilitado (`useRag = false`)**. Responden mediante inferencia generativa experta directa.
- **Usuarios Advanced (`subscription_tier === 'advanced'`)**:
  - Consumen de la cuota diaria `daily_ai_usage` (límite de **100 msgs/día**).
  - **Uso de RAG**: Habilitado hasta **25 consultas RAG/día** (`daily_rag_usage`). Al realizar una consulta con RAG activo, se incrementan simultáneamente los contadores `daily_ai_usage` y `daily_rag_usage`.
  - **Fallback Generativo Grácil**: Si el usuario Advanced supera las 25 consultas RAG, el sistema desactiva RAG (`useRag = false`) y le permite continuar realizando hasta 100 consultas al día en modo generativo estándar.
- **Usuarios Free / Pending (`subscription_tier === 'free'` o `subscription_status === 'pending'`)**:
  - Consumen **1 vida de prueba** (`usage_count`) por cada consulta enviada al Quiz Tutor o Repaso Tutor, hasta alcanzar las 10 vidas asignadas (`max_free_limit`).
  - Al agotar las 10 vidas, el middleware devuelve `403 Forbidden` (`FREE_LIVES_EXHAUSTED`), bloqueando la consulta y mostrando la modal Paywall.
  - **Uso de RAG**: Estrictamente **deshabilitado (`useRag = false`)**.

---

## 20. Normalización Resiliente de Respuestas de la IA (Agosto 2026)

### 20.1 Extracción Limpia y Desescape (`MarkdownRenderer._extractCleanResponse`)
- **Extracción Automática de Bloques JSON**: Se implementó una rutina que detecta bloques ```` ```json ... ``` ```` o estructuras JSON incrustadas y extrae directamente la propiedad `respuesta`, evitando que corchetes `{ }`, claves `"intencion"` o bloques de código sin procesar se filtren a la interfaz de usuario.
- **Desescape de Saltos de Línea y Caracteres Literales**: Se normalizan las secuencias `\n` y `\"` que lleguen como cadenas literales desde respuestas en streaming o JSON mal escapado, transformándolas en saltos de línea reales y tipografía pulida.
- **Backend Ultra-Resiliente (`TutorAiService`)**: Si el modelo Gemini responde con texto previo o posterior al bloque JSON, una extracción por expresiones regulares y búsqueda de delimitadores `{` / `}` recupera el objeto válido y formatea la respuesta de forma consistente.

---

## 21. Optimización del Tutor IA de Flashcards y Extensión de Contexto (Agosto 2026)

### 21.1 Ampliación del Límite de Contexto (`LIMITS.CONTEXT_TEXT = 12000`)
- **Prevención de Truncamiento**: Se extendió la longitud máxima permitida en `securityUtils.js` de 2,000 a 12,000 caracteres (`CONTEXT_TEXT`). Esto garantiza que prompts extensos que incluyen anverso (`front_content`), reverso (`back_content`), metadatos del mazo, área temática y preguntas complejas del estudiante lleguen completos al modelo Gemini sin truncar las instrucciones ni la duda del usuario.

### 21.2 Integración Multimedia Completa (Audio y Modo Escucha)
- **Metadatos Enriquecidos**: El frontend (`flashcards.js`, `tutor-chat.js`) y backend (`chatController.js`) transmiten de forma transparente:
  - Indicadores de recursos de audio (`audioUrlFront`, `audioUrlBack`).
  - Estado del modo escucha / ocultación de texto (`hideTextFront`, `hideTextBack`).
  - Nombre del mazo (`deckName`) y categoría exacta (`deckCategory`).
- **Persistencia de Contexto en Estudio Individual**: En `repaso.js`, al iniciar el estudio directo de una tarjeta individual (`/flashcards?deckId=...&cardId=...`), los parámetros `deckName` y `category` se incluyen en la URL para evitar que el Tutor de caiga en la categoría por defecto ('General').

---

## 22. Blindaje Anti-Truncamiento de Respuestas y Extracción por Límites Semánticos (Septiembre 2026)

### 22.1 Causa Raíz del Truncamiento de Respuestas Extensas
Durante consultas con explicaciones pedagógicas o clínicas detalladas donde la IA citaba opciones o testimonios utilizando comillas dobles sin escapar (por ejemplo: `proponiendo una posible respuesta ("los animalitos")`), el motor JSON fallaba con `SyntaxError`. En la fase de recuperación de emergencia, expresiones regulares no codiciosas tradicionales (`/"respuesta"\s*:\s*"((?:\\.|[^"\\])*)"/`) detenían la captura en la primera comilla doble no escapada (`"` tras `(`), cortando la explicación a mitad de frase y perdiendo todo el contenido posterior.

### 22.2 Extracción por Delimitación Semántica (`TutorAiService._parseAiResponse`)
Se rediseñó el flujo de extracción en `src/domain/services/tutorAiService.js` mediante una estrategia en dos tiempos:
1. **Parseo Estándar Primario**: `JSON.parse` para respuestas con sintaxis JSON estricta y limpia.
2. **Delimitador de Límites Semánticos (Boundary Regex)**: Si el JSON contiene comillas internas sin escapar, se localiza el inicio del campo `"respuesta": "` y se delimita su cierre no mediante la siguiente comilla arbitraria, sino identificando la clave subsecuente del esquema (`",\s*"(?:sugerencias|idioma_detectado|intencion|confianza|sources|contextUsed)"\s*:|"\s*\}\s*$/i`).
3. **Preservación Total del Payload**: Garantiza la recuperación íntegra de explicaciones de 500+ palabras, tablas, listas y sugerencias activas.

### 22.3 Blindaje en Origen (`src/domain/prompts/chatPrompts.js`)
Se añadió la directiva de formato N° 6 en `formatInstructions` instruyendo explícitamente a los modelos de todos los dominios (`medicine`, `education`, `flashcard_tutor`, `neutral`) a emplear preferentemente comillas simples (`'...'`) o angulares (`«...»`) al citar alternativas o texto de los ejercicios, o a escapar con `\"` las comillas dobles, previniendo rupturas de formato desde la generación.

### 22.4 Simetría en el Cliente (`MarkdownRenderer._extractCleanResponse`)
Se replicó la extracción semántica en `src/presentation/public/js/utils/markdown-renderer.js` para asegurar que el frontend nunca corte respuestas en caso de recibir payloads históricos o sin procesar.

### 22.5 Protección de Comandos LaTeX (`\neq`, `\nabla`, `\nu`, `\neg`)
Se corrigió la expresión regular en `_cleanResponseText` y `_normalizeText` (`\\\\n(?!(?:eq|abla|eg|u|otin|i|ull|exists|rightarrow|leftarrow|subseteq|supseteq|less|gtr|leq|geq|sim|cong|mid|atural)\b)`). Al consumir `\n`, el lookahead negativo valida el remanente del comando LaTeX, evitando que comandos matemáticos como `\neq` se transformen erróneamente en un salto de línea seguido de `eq`.

### 22.6 Suite de Pruebas Unitarias
Se integró `tests/unit/tutorAiResponseIntegrity.test.js`, validando contra el caso real reportado, variaciones con citas múltiples, fórmulas científicas complejas y estructuras Markdown.

---
*Última actualización: 4 de septiembre de 2026 (Blindaje anti-truncamiento de respuestas por límites semánticos, protección tipográfica LaTeX y mitigación de comillas en Tutor IA)*
