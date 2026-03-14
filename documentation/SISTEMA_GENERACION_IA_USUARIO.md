# Documentación: Sistema de Generación de preguntas por IA y RAG Local

Este documento detalla la arquitectura de emergencia implementada para garantizar que el **Simulador Médico** nunca se quede sin preguntas, manteniendo una distribución estadística equilibrada y un costo de infraestructura de **Cero Dólares ($0.00)**.

---

## 1. Arquitectura de Reposición (Trigger < 5)

Para evitar que el usuario experimente interrupciones por "Banco Agotado", el sistema monitoriza activamente el stock disponible en cada solicitud.

### El Disparador de Emergencia (Fallo de Cuota)
*   **Condición:** Se activa si el banco devuelve **menos de 5 preguntas** para la configuración actual.
*   **Inteligencia de Cuotas**: Si el usuario tiene 5 o más áreas elegidas, el sistema exige **exactamente 1 pregunta por área**. Si el banco no puede surtir este 1-a-1, el lote se considera "fallido" y se dispara la IA.
*   **Proactividad:** El sistema no muestra lotes incompletos; repone el stock balanceadamente de inmediato para asegurar que el usuario siempre reciba 5 preguntas distribuidas.

---

## 2. Motor RAG Local (Paso a Paso)

La generación de emergencia sigue estrictamente la `RAG_FLOW_GUIDE` para asegurar fidelidad médica:

1.  **Deduplicación (SQL):** Escanea los últimos 200 temas generados para prohibir repeticiones conceptuales a la IA.
2.  **Búsqueda RAG (ILIKE):** Realiza búsquedas mecánicas en la base de datos de documentos locales usando `ILIKE` (sin embeddings pagados).
3.  **Inyección de Jerarquía:**
    *   **SERUMS:** Prioriza NTS y RM (Salud Pública).
    *   **RESIDENTADO:** Prioriza Libros de Referencia (Harrison, Nelson).
    *   **ENAM:** Equilibrio Clínico-GPC.
4.  **Generación Flash:** Usa `gemini-2.5-flash` con el modo `thinking` desactivado para control de costos.

---

## 3. Lógica de Distribución Equilibrada (Anti-Sesgo)

El objetivo es que las estadísticas de dominio del usuario reflejen un conocimiento real y variado, no acumulado en una sola área.

### Regla de Oro: Muestreo 5x5 y Distribución 1-a-1
*   **Muestreo Dinámico**: Si se seleccionan > 5 áreas, el sistema toma **5 áreas al azar cada lote** de 5 preguntas.
*   **Balanceo (DB Partitioning)**: El repositorio usa `ROW_NUMBER() OVER(PARTITION BY topic)` para garantizar que el pool inicial tenga una mezcla de todas las áreas antes del ensamblaje.
*   **Ensamblaje Estricto**: 
    - **Caso 5 Áreas**: Se toma exactamente **1 por área**. Prohibido duplicar área si hay 5 disponibles.
    - **Caso < 5 Áreas**: El sistema es "inteligente" y permite hasta 2 preguntas por área para llegar al total de 5 (ej: 2-2-1 para 3 áreas).
*   **IA Alineada**: La IA generadora tiene prohibido el sesgo; debe emitir exactamente 1 pregunta por cada área solicitada en el lote.
*   **Objetivo:** Garantizar que las estadísticas de dominio del usuario sean precisas y que el contenido sea variado desde la primera pregunta.

---

## 4. Persistencia y Anti-Repetición (24h)

*   **Guardado Inmediato:** Cada pregunta generada por IA se inserta en `question_bank` con un hash único.
*   **Marcado como Visto:** Los IDs se registran en el historial del usuario al instante.
*   **Bloqueo de 24h:** El repositorio excluye automáticamente cualquier pregunta vista en las últimas 24 horas, maximizando la rotación del contenido.

---
**Certificado como Estándar de Oro - Marzo 2026**
