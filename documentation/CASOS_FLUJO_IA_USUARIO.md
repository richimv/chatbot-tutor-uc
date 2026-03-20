# 🧪 Casos de Uso: Selección, Optimización y Distribución IA

Este documento describe el motor de inteligencia de Hub Academia para la gestión de stocks de preguntas. El sistema opera bajo un principio de **Eficiencia de Costos y Balance Estadístico**, priorizando el banco local antes de recurrir a la IA para los usuarios advanced.

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

### 📉 Escenario 3: Reposición con Pocas Áreas (< 5 áreas)
1.  **Distribución Equitativa**: Se distribuyen las 5 preguntas entre las áreas disponibles (ej: 2 áreas -> 3 y 2 preguntas respectivamente).
2.  **Repetición Permitida**: Aquí la repetición es necesaria para alcanzar la cuota de 5.

---

## 🛠️ Resumen de Implementación Técnica

-   **trainingService.js**: Responsable del Escaneo Global y la decisión de disparo de IA.
-   **mlService.js**: Responsable de la orquestación 1:1 (Determinismo de Tópicos) para que la IA cumpla la cuota de áreas asignada.
-   **Propósito Final**: Que la estadística del usuario (Radar de Rendimiento) se vea bien distribuida y no sesgada a unos pocos temas.
