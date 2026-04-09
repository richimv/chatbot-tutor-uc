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

### ✨ Generación Agéntica y UI Premium
1. **Generación Manual por Usuario**: Al finalizar un simulacro, el alumno selecciona qué preguntas convertir en Flashcards.
    - **Estrategia "Solo Respuesta"**: Para optimizar la velocidad de estudio y evitar desbordamientos, las tarjetas derivadas de simulacros solo almacenan la **respuesta correcta** en el dorso, omitiendo explicaciones extensas.
    - **Layout Responsivo (Side-by-Side)**: El frente de la tarjeta utiliza un diseño de dos columnas en PC (Imagen izquierda / Texto derecha) para maximizar el uso del espacio, similar al simulador.
2. **Generación IA por Tema**: Permite al usuario crear un mazo completo sobre un tema específico usando Gemini 2.5 Flash Lite.

### 📁 Organización y Visualización
- Soporte para sub-mazos (carpetas) con iconografía vibrante y mapeo de emojis.
- Las imágenes en flashcards se sirven mediante el proxy de GCS, asegurando carga rápida y optimización WebP activa.

---

## 4. Flujos de Trabajo
- **Estudio Diario**: El sistema prioriza las tarjetas con `due_date <= NOW()`.
- **Modo Explorador**: Permite editar, mover y borrar tarjetas de forma masiva.
- **Sincronización Multi-Simulador**: Las tarjetas creadas desde el simulador heredan el `topic` y `target` del examen original.

---

## 5. Modo Offline y Sincronización Diferida (NUEVO) 📡
Para asegurar un estudio fluido en cualquier entorno, el módulo de repaso incorpora una arquitectura de resiliencia:

1. **Estudio Offline**: El lote de tarjetas pendientes se precarga localmente. El usuario puede calificar su desempeño sin conexión.
2. **Cola de Sincronización (Sync Queue)**: Las calificaciones se guardan en una cola de fondo. El sistema intenta subirlas al servidor automáticamente usando la utilidad `safeFetch`.
3. **Reintentos Inteligentes**: Si la sincronización falla debido a un microcorte, el sistema aplica **Exponential Backoff** (reintentos a los 1s, 2s, 4s...) hasta confirmar que la curva de aprendizaje del usuario ha sido actualizada en la base de datos.
4. **Monitor Visual**: El **Status Pill** global alerta al usuario si sus repasos están siendo guardados localmente a la espera de señal.

---
*Documentación técnica oficial - Actualizada Abril 2026*
