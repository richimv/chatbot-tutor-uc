# 🧪 Casos de Uso: Selección y Reposición IA (Simulador Médico)

Este documento describe detalladamente cómo el sistema gestiona la selección de preguntas y la activación de la IA bajo diferentes configuraciones de usuario.

---

## 🔄 Nuevo Flujo: Muestreo con Reemplazo Dinámico (Optimizado)

Este sistema prioriza el agotamiento total del banco local antes de recurrir a la IA, asegurando eficiencia de costos y variedad estadística.

### 🔝 Caso: Muchas Áreas seleccionadas (> 5)
**Configuración:** ENAM - Básico - [15 áreas seleccionadas].

1.  **Escaneo Global**: El sistema busca en el banco preguntas para las **15 áreas** simultáneamente.
2.  **Identificación de Stock**: Descubre que solo 8 de esas áreas tienen preguntas disponibles (excluyendo vistas).
3.  **Swapping Inteligente**: El sistema elige **5 áreas aleatorias de las 8 que sí tienen stock**.
4.  **Entrega**: Entrega 5 preguntas (1 de cada área con stock).
5.  **Resultado**: **IA NO SE ACTIVA**. Se ahorra latencia y se maximiza el uso del banco.

---

### 📊 Caso: Agotamiento Progresivo
**Situación:** Al usuario solo le quedan preguntas en 3 áreas de todas las seleccionadas.

1.  **Escaneo Global**: Detecta stock solo en esas 3 áreas.
2.  **Recolección Exhaustiva**: Toma todas las preguntas posibles de esas 3 áreas (ej: 2 de Cardiología, 2 de Nefrología, 1 de Cirugía) para completar el lote de 5.
3.  **Evaluación**: Si logra juntar **5 preguntas**, el examen inicia sin IA.
4.  **IA como Último Recurso**: Solo si el total sumado de **todas** las áreas con stock es **menor a 5**, se dispara la IA para completar el lote.

---

### 🤖 Caso: Activación de IA por "Fallo de Cuota Global"
**Situación:** Incluso revisando todas las áreas factibles, el sistema solo encuentra 2 preguntas.

1.  **Reposición IA**: Se activan 5 nuevas preguntas balanceadas.
2.  **Lógica IA**: La IA genera preguntas para las áreas muestreadas (ej: 1 para cada una de las 5 áreas seleccionadas para esta tanda).
3.  **Resultado**: El usuario siempre recibe un lote de 5 preguntas perfecto.

---

## 💡 Resumen Lógico del Motor
-   **Prioridad 1**: Agotar el stock de *cualquier* área seleccionada por el usuario antes de pedir IA.
-   **Prioridad 2**: Mantener el balance estadístico (no saturar una sola área si hay otras disponibles).
-   **IA de Emergencia**: Es el seguro de vida del sistema cuando la base de datos realmente ya no tiene contenido inédito para la configuración del médico.
