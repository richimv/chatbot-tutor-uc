# 🩺 Specs Técnicas: Simulador Médico (Hub Academia)

## 1. Visión General
El **Simulador Médico** es el motor de entrenamiento de alto rendimiento de Hub Academia. Permite realizar simulacros personalizados (ENAM, SERUMS, Residentado) con una mezcla de preguntas de banco y generación por IA (RAG) en tiempo real.

---

## 2. Arquitectura de Archivos

### 🖥️ Frontend (Presentation)
- **`simulator-dashboard.html`**: Tablero de mando con KPIs y analíticas. Presenta un diseño de interfaz de usuario limpia (*Clean UI/Flat Design*) y utiliza gráficas renderizadas de forma nativa (HTML/CSS) sin pesadas librerías externas para visualización en móviles.
- **`quiz.html`**: Interfaz de ejecución del examen (Motor de Quiz)4. **Monitor Visual**: El **Status Pill** global alerta al usuario si sus repasos están siendo guardados localmente a la espera de señal.
5. **Control de Concurrencia (Anti double-tap)**: Bloqueo semafórico (`_isRating`) en el motor de flashcards para prevenir múltiples peticiones accidentales durante microcortes de red, garantizando una calificación única y limpia.

---
*Documentación técnica oficial - Actualizada Abril 2026*
se renderiza usando gráficos **SVG** nativos vectoriales, proporcionando animaciones `stroke-dashoffset` muy fluidas e interactivas.
- **`js/simulator-dash.js`**: Lógica del dashboard: inicialización de charts, manejo de configuración y stats local/API. Contiene visualización *Empty State* para los usuarios sin historial (Demo).
- **`js/quiz.js`**: Motor de interacción: manejo de estados (pregunta actual, respuestas), cronómetros, y batch loading. Permite la **creación manual e interactiva de Flashcards** desde el panel de revisión de desempeño.

### ⚙️ Backend (Application & Domain)
- **`QuizController.js`**: Orquestador de peticiones. Maneja la lógica de inicio, entrega y límites.
- **`TrainingService.js`**: El "cerebro" del módulo. Implementa la lógica híbrida: Banco -> IA Fallback.
- **`mlService.js`**: Interface con Gemini 2.5 Flash Lite para generación RAG y análisis de rendimiento.

### 🗄️ Infraestructura (Persistence)
- **`TrainingRepository.js`**: Consultas SQL puras para `question_bank` y `quiz_history`.
- **Tablas Críticas:**
  - `question_bank`: Repositorio global indexado por `target` y `topic`.
  - `quiz_history`: Almacena puntajes y el objeto **JSONB `area_stats`**.
  - `user_question_history`: Tabla de anti-repetición (seen_at, times_seen).

---

## 3. Sistemas Core

El usuario puede cruzar variables fundamentales:
1. **Target**: ENAM, SERUMS (Medicina/Enfermería/Obstetricia), Residentado Médico (CONAREME).
2. **Áreas**: Multi-selección de 22 especialidades médicas agrupadas por categorías.

### 🧠 Motor Híbrido RAG (AI Agéntica)
1. **Fase 1 (Balanced Bank First)**: Intenta llenar el buffer de 5 preguntas desde el banco local balanceadamente (Max 2 por área).
2. **Fase 2 (Pro-Active AI Replenishment)**: Si el banco devuelve < 5 preguntas o no puede cumplir la cuota de balanceo (área agotada), se considera el stock como insuficiente.
3. **Fase 3 (RAG Maestro Flow)**: Invoca a Gemini 2.5 Flash Lite inyectando:
   - **Muestreo Aleatorio**: Máximo 5 áreas por lote para optimizar el contexto RAG.
   - **Guías Clínicas (RAG)**: Contexto extraído de Normas Técnicas/GPCs mediante búsqueda SQL ILIKE local.
   - **Deduplicación Semántica**: Scaneo de los últimos 200 temas generados.
   - **Estilo de Examen**: Adaptación al Target (ENAM, SERUMS, Residentado).

### 📊 Real-Feel Analytics (JSONB Intelligence)
- Al finalizar, el sistema calcula el desempeño por cada una de las 22 áreas.
- Estos datos se inyectan en una columna **JSONB** (`area_stats`).
- El dashboard lee esta estructura para renderizar un diagrama semántico ultra-rápido en barras HTML/CSS, permitiendo identificar fortalezas y debilidades subatómicas. A su vez, el **Motor IA Fallback** simula la presencia de Inteligencia Artificial para cuentas "Guest/Demo" imprimiendo evaluaciones y diagnósticos extendidos de la casuística particular de cada alumno.

---

## 4. Modos de Ejecución
- ⚡ **Simulacro Rápido (10 q)**: Feedback instantáneo + Justificación Médica. *(Modo accesible también para cuentas Invitadas/Demo con contadores de uso estricto para incentivar registro)*.
- 📚 **Modo Estudio (20 q)**: Enfoque formativo sin presión de tiempo.
- 🎯 **Simulacro Real (100 q)**: "Modo Ciego" (sin feedback), cronómetro de 120min y revisión diferida al final con generación de Flashcards selectivas.

---

## 🛡️ Integridad y Seguridad
- **Anti-Repetición**: Ciclo de enfriamiento de 24 horas (`seen_at`).
- **Validación server-side**: Los resultados se auditan en el backend para evitar manipulación de puntajes.
- **Deduplicación MD5**: Cada pregunta generada o inyectada tiene un hash único para evitar redundancia en el banco global.

---

## 📡 Resiliencia y Offline UX (NUEVO)
Para garantizar la continuidad en exámenes de alta exigencia (100q), el simulador incorpora un sistema de resiliencia avanzada:

1. **Persistencia de Sesión (Local Storage)**: Cada respuesta marcada se serializa instantáneamente en el navegador. En caso de recarga accidental (F5) o pérdida de suministro eléctrico, al reabrir la ventana el examen se6.  **Estabilidad UX (Pulse & Sync):** Se corrigió el estado de 'falso negativo' del monitor de conexión mediante la sincronización del constructor de `UIManager` con `navigator.onLine`. Se resolvieron interferencias visuales aplicando `components.css` y se eliminó la necesidad de doble clic en flashcards mediante un bloqueo semafórico de interactividad durante la sincronización. Se erradicó el `ReferenceError` en el simulador mediante la estandarización de bloques catch y la invalidación de caché vía `v=20240410`.
 **Exponential Backoff**. Si el envío de un simulacro falla, el sistema reintenta automáticamente con intervalos crecientes (1s, 2s, 4s).
4. **Validación de Integridad**: Al restaurar una sesión, el sistema verifica que el `quizId` y el mazo coincidan con la configuración actual para evitar colisiones de datos.
5. **Batching Resiliente (v3.0)**: La carga de lotes (`fetchNextBatch`) ha sido refactorizada para ser tolerante a fallos. Si un lote falla por red, el sistema no aborta el examen; en su lugar, notifica al usuario vía Toast y permite reintentos, ajustando dinámicamente el progreso para garantizar que el alumno pueda finalizar su sesión sin pérdida de datos.
6. **Estandarización de Errores**: Se eliminaron los `ReferenceError` mediante la migración a bloques `catch (error)` unificados y la invalidación de caché forzada (`v=20240410`).
