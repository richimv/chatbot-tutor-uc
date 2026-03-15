# 🎮 Documentación Técnica: Módulo Quiz Arena (Battle Mode)

El **Quiz Arena** es el componente gamificado de HubAcademia, diseñado para ofrecer una experiencia de trivia rápida y competitiva sobre cultura general o temas específicos, alejada del rigor clínico del simulador médico principal.

---

## 1. Arquitectura del Módulo

El módulo sigue una estructura desacoplada:
- **Frontend (SPA-lite)**: `arena.html` + `arena.js`. Gestiona el estado de la partida, temporizadores y animaciones.
- **API Controller**: `quizGameController.js`. Gestiona el inicio de sesión, el cobro de "vidas diarios" y la persistencia en DB.
- **Game Engine**: `TrainingService.js`. Provee las preguntas (vía Banco o IA Lite).

---

## 2. Flujo de Juego (Game Loop)

1.  **Lobby**: El usuario selecciona un tema y dificultad.
2.  **Validación de Tier**: La API descuenta una unidad de `daily_arena_usage`. Si el usuario agotó sus vidas del plan, se bloquea el inicio.
3.  **Partida (20 Rondas)**:
    - Se cargan 5 preguntas iniciales.
    - Cada pregunta tiene un **timer de 20 segundos**.
    - El puntaje se calcula dinámicamente: `Bonus Velocidad + Base`.
4.  **Infinite Preload (Táctico)**: Cuando quedan 4 preguntas en el pool local, el frontend solicita un lote extra en segundo plano para evitar pausas.
5.  **Hard Stop**: El juego termina por derrota (0 vidas) o por victoria absoluta (20 rondas).

---

## 3. Mecánicas de Juego

### 💘 Sistema de Vidas
- Cada partida inicia con **3 vidas**.
- Se pierde una vida por error en la respuesta o por agotamiento del tiempo.

### 🍀 Comodines (Wildcards)
- **50/50**: Elimina dos opciones incorrectas. Solo disponible una vez por partida.
- **Skip**: Salta la pregunta actual sin costo de vida. Solo disponible una vez por partida.

### 📊 Nivelación
- El "Nivel" se calcula cada 5 preguntas: `Math.floor(currIdx / 5) + 1`.
- Sirve como marcador visual de progreso y dificultad percibida.

---

## 5. UI/UX Premium & Accesibilidad

### 🎨 Carrusel de Temas (Quick Tags)
- **Implementación**: Hilera scrollable con `scroll-snap-type: x proximity`.
- **Accesibilidad PC**: Soporte para **Mouse Drag Scroll** (clic y arrastre) para simular experiencia móvil.
- **Estética**: Glassmorphism avanzado (`backdrop-filter`) y máscaras de degradado lateral (`mask-image`) para indicar continuidad.

### 👥 Manejo de Visitantes
- **Interceptación de Sesión**: Detección proactiva de `authToken` previo al inicio.
- **Conversión de Usuarios**: Integración con `UIManager.showAuthPromptModal()` para invitar al registro en lugar de mostrar errores técnicos.

---

## 4. Persistencia y Ranking

- **Tabla de Puntajes**: Los resultados se guardan en `quiz_scores` (SQL).
- **Ranking Global**: Se calcula en tiempo real mediante un CTE de PostgreSQL que filtra el mejor puntaje único por usuario para mostrar el **Top 10**.
- **Seguridad**: Solo se guardan puntajes si el usuario completó al menos una ronda válida para evitar "basura" en la DB por abortos accidentales.

---

## 5. Auditoría de Código (Estado Actual)

| Hallazgo | Estado | Nota |
| :--- | :--- | :--- |
| **Mismatch de Llaves** | ✅ CORREGIDO | Sincronizado `question_text` y `correct_option_index`. |
| **Redundancia en Frontend** | ✅ LIMPIADO | Se eliminaron duplicados de `showFeedback` y `showCustomModal`. |
| **Fuga de Costos IA** | ✅ SELLADO | Implementada lógica de "Banco Primero" en TrainingService. |
| **Repetición Preguntas** | ✅ CORREGIDO | Normalización de temas en backend y registro de historial. |
| **Fallo Comodín 50/50** | ✅ REPARADO | Corregida lógica de modales para evitar saltos de pregunta. |
| **UX Visitantes** | ✅ MEJORADO | Reemplazado error de sesión por modal de invitación amigable. |
| **UI Carousel Stretch** | ✅ FIJADO | Contención de grid corregida para evitar deformación de la tarjeta. |
| **Caché Residual** | ✅ SELLADO | Implementado versionado `?v=1.1` en recursos críticos. |

---
*Documentación oficial - Marzo 2026*
