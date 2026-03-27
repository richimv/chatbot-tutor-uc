# 🧪 Casos de Uso: Selección, Optimización y Distribución IA

Este documento describe el motor de inteligencia de Hub Academia para la gestión de stocks de preguntas. El sistema opera bajo un principio de **Eficiencia de Costos y Balance Estadístico**, priorizando el banco local antes de recurrir a la IA para **todos** los usuarios (Mode Fast para Free/Basic/Advanced, RAG para Admin).

---

## 📦 Fase 1: Optimización de Stock Local (Banco)

Antes de activar la IA, el sistema intenta completar el lote de 5 preguntas usando el contenido existente en la base de datos para **todas** las áreas seleccionadas por el usuario.

### 🔝 Caso A: Muchas Áreas seleccionadas (> 5 áreas)
**Configuración:** ENAM - Básico - [15 áreas seleccionadas].

1.  **Escaneo Global**: El sistema busca en el banco preguntas para las **15 áreas** simultáneamente.
2.  **Identificación de Stock**: Identifica cuáles de esas áreas tienen preguntas disponibles (no vistas por el usuario).
3.  **Swapping Inteligente**: Si hay stock suficiente en el conjunto de las 15 áreas:
    - Selecciona 5 preguntas priorizando la diversidad (1 de cada área con stock).
    - Si una área tiene mucho stock y otras poco, intenta balancear.
4.  **Entrega**: Entrega 5 preguntas del banco.
5.  **Resultado**: **IA NO SE ACTIVA**. Se ahorra latencia y se maximiza el valor del contenido propio.

---

## 🤖 Fase 2: Distribución de Áreas IA (Reposición)

Solo cuando el Escaneo Global detecta que el banco local es insuficiente para completar el lote de 5 preguntas, se activa la IA.

### 🔝 Escenario 1: Reposición con Muchas Áreas (> 5 áreas)
**Configuración:** Usuario elige 15 áreas, pero el banco está casi agotado.

1.  **Muestreo para IA**: El sistema elige **5 áreas aleatorias de las 15 originales** (sin repetir).
2.  **Generación Determinista**: Se le ordena a la IA generar **exactamente 1 pregunta por cada una** de esas 5 áreas.
3.  **Resultado**: Lote de 5 preguntas de alta calidad con 5 tópicos distintos, inyectados al banco para futuras sesiones.

### 📊 Escenario 2: Reposición con Exactamente 5 Áreas
1.  **Muestreo Fiel**: Se toman las 5 áreas.
2.  **Distribución 1:1**: 1 pregunta por área.

### 📉 Escenario 3: Reposición con Pocas Áreas (< 5 ejes MINSA)
1.  **Distribución Equitativa**: Se distribuyen las 5 preguntas entre los ejes disponibles (ej: 2 ejes -> 3 y 2 preguntas respectivamente).
2.  **Repetición Permitida**: Aquí la repetición es necesaria para alcanzar la cuota de 5.

---

## 🛠️ Resumen de Implementación Técnica

- **trainingService.js**: Responsable del Escaneo Global y la reposición IA transparente.
- **userAiService.js**: Generación experta (Modo Fast) para usuarios Free, Basic y Advanced.
- **mlService.js**: Orquestación RAG (Modo High-Fidelity) exclusiva para Administradores.

---

## 🚦 Lógica de Activación IA (Triggers)

El sistema activa la IA de reposición **SOLO** en los siguientes casos:

1.  **Déficit de Stock Absoluto**: Cuando el Banco Local tiene menos de 5 preguntas disponibles (no vistas por el usuario en las últimas 24h) para el conjunto de áreas seleccionadas.
2.  **Déficit de Diversidad Estadística**: Si el usuario selecciona 5 o más áreas (ej: Simulacro ENAM completo), pero el banco solo tiene stock para 4 áreas o menos. Se fuerza la IA para garantizar que el examen tenga al menos una pregunta de cada eje temático.
3.  **Optimización Post-Fix**: Tras la corrección del "Cuello de Botella (rn <= 3)", el sistema ahora permite que un solo tema agote su stock completo del banco (hasta 5) antes de llamar a la IA.

### 🚫 ¿Cuándo NO se activa la IA?
- Si el banco tiene stock suficiente (5+ preguntas) y variado para la configuración del usuario.
- Si el usuario es **Free** y ha agotado sus vidas diarias (bloqueo preventivo en el middleware).

### 💡 Beneficio del Fix
Se evita la redundancia: Antes, el sistema "cegaba" la búsqueda a solo 3 preguntas por área. Ahora, el sistema es capaz de "ver" hasta 5 preguntas por área, permitiendo que las áreas populares se sirvan 100% del banco sin costo de IA.

---

## 🛠️ Mecanismo de Selección Local (Garantía de No-Sesgo)

Para evitar que las preguntas se "agoten" para todos los usuarios simultáneamente, el sistema implementa **Aislamiento por Usuario**:

1.  **user_question_history**: Las preguntas se marcan como "vistas" **solo** para el usuario que las realizó. Una pregunta respondida por el `Usuario A` sigue estando 100% disponible para el `Usuario B`.
2.  **Olvido Saludable (24h Window)**: El sistema solo excluye preguntas vistas en las últimas 24 horas. Si el usuario realizó una pregunta hace más de un día, esta vuelve a ser elegible para el banco local, optimizando el stock y reforzando el aprendizaje a largo plazo.
3.  **times_used (Metadata)**: La columna `times_used` en la tabla `question_bank` es puramente estadística (para saber cuáles son las preguntas más populares). **NO** se utiliza como filtro de exclusión global.
4.  **rn Adaptive Sampling**: El motor utiliza `ROW_NUMBER()` dinámico. Si eliges pocos temas, te da el stock completo. Si eliges muchos, te obliga a tomar 1 de cada uno para que tus gráficas de rendimiento sean equilibradas y representativas de todas las áreas clínicas.
