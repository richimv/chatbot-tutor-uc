# 🩺 Specs Técnicas: Simulador Médico (Hub Academia)

## 1. Visión General
El **Simulador Médico** es el motor de entrenamiento de alto rendimiento de Hub Academia. Permite realizar simulacros personalizados (ENAM, SERUMS, Residentado) con una mezcla de preguntas de banco y generación por IA (RAG) en tiempo real.

---

## 2. Arquitectura de Archivos

### 🖥️ Frontend (Presentation)
- **`simulator-dashboard.html`**: Tablero de mando con KPIs y analíticas. Presenta un diseño de interfaz de usuario limpia (*Clean UI/Flat Design*) y utiliza gráficas renderizadas de forma nativa (HTML/CSS) sin pesadas librerías externas para visualización en móviles.
- **`quiz.html`**: Interfaz de ejecución del examen (Motor de Quiz). Minimiza la fatiga visual al omitir bordes 3D o sombras redundantes. Además, la puntuación obtenida al finalizar se renderiza usando gráficos **SVG** nativos vectoriales, proporcionando animaciones `stroke-dashoffset` muy fluidas e interactivas.
- **`js/simulator-dash.js`**: Lógica del dashboard: inicialización de charts, manejo de configuración y stats local/API. Contiene visualización *Empty State* para los usuarios sin historial (Demo).
- **`js/quiz.js`**: Motor de interacción: manejo de estados (pregunta actual, respuestas), cronómetros, y batch loading. Permite la **creación manual e interactiva de Flashcards** desde el panel de revisión de desempeño.

### ⚙️ Backend (Application & Domain)
- **`QuizController.js`**: Orquestador de peticiones. Maneja la lógica de inicio, entrega y límites.
- **`TrainingService.js`**: El "cerebro" del módulo. Implementa la lógica híbrida: Banco -> IA Fallback.
- **`mlService.js`**: Interface con Gemini 2.5 Flash para generación RAG y análisis de rendimiento.

### 🗄️ Infraestructura (Persistence)
- **`TrainingRepository.js`**: Consultas SQL puras para `question_bank` y `quiz_history`.
- **Tablas Críticas:**
  - `question_bank`: Repositorio global indexado por `target`, `topic` y `difficulty`.
  - `quiz_history`: Almacena puntajes y el objeto **JSONB `area_stats`**.
  - `user_question_history`: Tabla de anti-repetición (seen_at, times_seen).

---

## 3. Sistemas Core

### 🎯 Configuración Dinámica (Matrix Mode)
El usuario puede cruzar 3 variables fundamentales:
1. **Target**: ENAM, SERUMS (Medicina/Enfermería), Residentado Médico (CONAREME).
2. **Dificultad**: Básico (Teórico), Intermedio (Casos Clínicos), Avanzado (Gold Standard).
3. **Áreas**: Multi-selección de 23 especialidades médicas agrupadas por categorías.

### 🧠 Motor Híbrido RAG (AI Agéntica)
1. **Fase 1 (Bank First)**: Intenta llenar el buffer de preguntas desde el banco local excluyendo las vistas en las últimas 24h.
2. **Fase 2 (AI Fallback)**: Si faltan preguntas, invoca a Gemini 2.5 Flash inyectando:
   - **Guías Clínicas (RAG)**: Contexto extraído de Normas Técnicas/GPCs.
   - **Deduplicación Semántica**: Se le envían 15 preguntas previas para evitar repeticiones de conceptos.
   - **Estilo de Examen**: Diferencia entre el enfoque "Médico de Posta" (SERUMS) vs "Médico Científico" (Residentado).

### 📊 Real-Feel Analytics (JSONB Intelligence)
- Al finalizar, el sistema calcula el desempeño por cada una de las 23 áreas.
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
