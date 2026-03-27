# 🧠 Specs Técnicas: Módulo de Repaso (Flashcards)

## 1. Visión General
El **Módulo de Repaso** es el sistema de memorización a largo plazo de Hub Academia. Utiliza tarjetas de aprendizaje dinámicas (Flashcards) organizadas en mazos (Decks) y un algoritmo de repetición espaciada para optimizar la retención de conocimientos médicos.

---

## 2. Arquitectura de Archivos

### 🖥️ Frontend (Presentation)
- **`repaso.js`**: Gestor principal de la UI de repaso. Maneja la navegación entre mazos, la renderización de carpetas y la integración con el explorador de archivos.
- **`flashcards.js`**: Motor de estudio interactivo. Maneja la lógica de voltear tarjetas, calificación de dificultad y temporizadores.
- **`deck-explorer.js`**: Componente de navegación lateral para la jerarquía de mazos.

### ⚙️ Backend (Application & Domain)
- **`deckController.js`**: Maneja las peticiones API para CRUD de mazos y tarjetas, incluyendo la generación masiva por IA.
- **`deckService.js`**: Implementa la lógica de negocio, incluyendo el cálculo de intervalos de repetición espaciada.

### 🗄️ Infraestructura (Persistence)
- **`user_flashcards`**: Tabla principal que almacena el contenido (frente/dorso) y los metadatos de estudio (`interval_days`, `easiness_factor`, `last_reviewed`).
- **`decks`**: Tabla de organización jerárquica de mazos.

---

## 3. Sistemas Core

### ⏳ Algoritmo de Repetición Espaciada (SM-2 Modified)
El sistema utiliza una variante del algoritmo SM-2 para calcular cuándo debe reaparecer una tarjeta:
1. **Calificación del Usuario**: El usuario califica su recuerdo (Fácil, Bien, Difícil, Repetir).
2. **Intervalo de Repetición**: Se calcula basado en el `easiness_factor` y el número de repasos exitosos consecutivos.
3. **Olvido Saludable**: Integrado con el sistema global para asegurar que el usuario no se abrume con repasos acumulados.

### ✨ Generación Agéntica de Tarjetas
1. **Generación Manual por Usuario**: Al finalizar un simulacro, el alumno selecciona qué preguntas convertir en Flashcards.
    - **Estrategia "Solo Respuesta"**: Para optimizar la velocidad de repaso y evitar desbordamientos de UI, las tarjetas derivadas de simulacros solo almacenan la **respuesta correcta** en el dorso, omitiendo explicaciones extensas e imágenes de resolución.
2. **Generación IA por Tema**: Permite al usuario crear un mazo completo sobre un tema específico usando Gemini 2.5 Flash Lite.

### 📁 Organización Jerárquica
- Soporte para sub-mazos (carpetas) para organizar el estudio por especialidades médicas siguiendo la lógica de los simuladores.
- Iconografía vibrante y mapeo de emojis a FontAwesome para una UX premium.

---

## 4. Flujos de Trabajo
- **Estudio Diario**: El sistema prioriza las tarjetas con `due_date <= NOW()`.
- **Modo Explorador**: Permite editar, mover y borrar tarjetas de forma masiva.
- **Sincronización Multi-Simulador**: Las tarjetas creadas desde el simulador heredan el `topic` y `target` del examen original.

---

## 🛡️ Integridad y Seguridad
- **Validación de Propiedades**: Alineado con el estándar global `question_text` y `correct_option_index` para mantener la coherencia con el banco de preguntas.
- **Control de Límites**: Integrado con `checkLimitsMiddleware` para limitar la generación de tarjetas por IA según el plan del usuario.
