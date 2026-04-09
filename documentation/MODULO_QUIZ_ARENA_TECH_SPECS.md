# 🎮 Documentación Técnica: Módulo Quiz Arena (Battle Mode)

El **Quiz Arena** es el componente gamificado y universal de Hub Academia. Ofrece una experiencia de trivia rápida y competitiva sobre diversos temas, integrando inteligencia artificial para la generación infinita de desafíos.

---

## 1. Arquitectura del Módulo 🏛️

- **Frontend**: `arena.html` + `arena.js`. Gestiona el estado de la partida, temporizadores (`20s`), vidas y renderizado responsivo.
- **API Controller**: `quizGameController.js`. Punto de entrada para el inicio de partidas, obtención de preguntas extra y persistencia de puntajes.
- **Game Engine**: `TrainingService.js`. Orquesta la obtención de preguntas desde el Banco Local o la Generación Agéntica (IA).
- **Repositorio**: `trainingRepository.js`. Maneja la persistencia y la lógica de deduplicación de contexto.

---

## 2. Flujo de Juego End-to-End (The Game Loop) 🔄

### Fase 1: Lobby y Preparación 🏟️
1.  **Selección de Tema**: El usuario elige un desafío a través de los *Quick Tags* (Carrusel responsivo).
    - **Temas Disponibles**: Cultura General, Medicina, Matemáticas, Química, Ciencias, Informática, Tecnología, Actualidad, Historia, Geografía, Deportes, Cine.
2.  **Validación de Tier (Vidas)**: Al hacer clic en "Iniciar", el sistema verifica el plan del usuario:
    - Se descuenta una "Vida de Arena" (`daily_arena_usage`).
    - Si el límite diario se ha alcanzado, se muestra el `PaywallModal` o `BankExhaustedModal`.

### Fase 2: Inicio de Partida 🚀
1.  **Carga de Lote Inicial**: Se solicitan 5 preguntas al backend.
2.  **Selección Híbrida**:
    - Primero se busca en el **Banco de Preguntas** (`question_bank`) usando el tema normalizado (soporta tildes via `unaccent`).
    - Si el banco tiene menos de 5 preguntas, se activa la **IA Agéntica (Gemini 2.5 Flash Lite)** para completar el lote.

### Fase 3: Gameplay (20 Rondas) ⚔️
- **Renderizado Responsivo**:
    - **PC**: Layout de 2 columnas (Imagen izquierda / Pregunta derecha).
    - **Móvil**: Layout apilado (Imagen arriba / Pregunta abajo).
- **Temporizador**: 20 segundos para responder.
- **Vidas**: El jugador inicia con 3 vidas. Un error o agotamiento de tiempo resta una vida.
- **Puntaje**: Se calcula según la velocidad de respuesta: `100 * (Tiempo Restante / 5)`.

### Fase 4: Sistemas de Inteligencia 🧠
- **Anti-Repetición (User History)**: Cada pregunta entregada se registra en `user_question_history`. El sistema sincroniza los IDs generados por IA en tiempo real para asegurar que el marcado de "visto" sea efectivo y la pregunta no se repita en la siguiente ronda.
- **Deduplicación Semántica (Contexto IA)**: Al generar preguntas nuevas, la IA recibe las **30/75 preguntas más recientes** (`created_at DESC`) para evitar solapamientos temáticos o bucles de repetición.

### Fase 5: Finalización y Ranking 🏆
1.  **Guardado de Score**: Al terminar (por victoria o derrota), se envía el puntaje a `/api/arena/submit`.
2.  **Persistencia**: Se guarda en la tabla `quiz_scores`.
3.  **Ranking Global**: La interfaz actualiza el **Top 10 Global** mediante una consulta recursiva (CTE) que garantiza que solo aparezca el *High Score* único de cada usuario.

---

## 3. Mecánicas y Comodines 🍀

- **50/50**: Elimina dos opciones incorrectas (1 uso por partida).
- **Skip**: Salta la ronda sin perder vida (1 uso por partida).
- **Infinite Preload**: Cuando el pool local baja de 4 preguntas, el sistema solicita un lote extra en segundo plano para garantizar un flujo sin esperas.

---

## 4. Auditoría de Estabilidad (Estado Actual) ✅

- **Integridad de Datos**: Sanitización universal de `target`, `career` y `difficulty`.
- **Dificultad Unificada**: Soporte para niveles dinámicos sin forzar el antiguo estándar "Senior".
- **Visualización GCS**: Integración completa con el proxy de Google Cloud Storage para imágenes WebP.

## 5. Resiliencia de Red (NUEVO) 📡
Dado el carácter competitivo de la Arena, se ha implementado un sistema para evitar la pérdida de récords por inestabilidad:

- **safeFetch con Backoff**: Todas las comunicaciones críticas (Inicio, Carga de lotes, Envío de Score) utilizan reintentos automáticos (1s, 2s, 4s).
- **Consistencia de Score**: El envío final del puntaje es idempotente y se reintenta hasta asegurar la sincronización con el servidor.
- **Modo Offline**: Si la conexión se pierde durante una pregunta, el temporizador se pausa visualmente y el **Status Pill** informa al usuario, reanudando la carga en cuanto vuelve la señal.

---
*Documentación técnica oficial - Actualizada Abril 2026*

## 4. 🎮 Modo Especial: Quiz Arena (Review Battle)
La **Quiz Arena** es el modo de repaso gamificado. A diferencia del estudio lineal de flashcards, la Arena extrae preguntas del banco global para un repaso dinámico:
1.  **Lobby**: Selección de temas (Cultura General, Medicina, Historia, etc.).
2.  **Mecánica**: 20 rondas cronometradas con sistema de 3 vidas y comodines (50/50, Skip).
3.  **Deduplicación Agéntica**: La IA genera nuevos retos basados en un contexto de **30 preguntas más recientes** (`created_at DESC`) y sincronización de IDs en tiempo real para garantizar un "visto" inmediato.
4.  **Ranking**: Los mejores promedios de acierto por velocidad se publican en el Top 10 Global mediante consultas recursivas (CTE).