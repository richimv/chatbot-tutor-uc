# Documentación: Sistema de Generación de preguntas por IA y RAG Local, tanto del USUARIO y ADMIN.

Este documento detalla la arquitectura de emergencia implementada para garantizar que el **Simulador Médico** nunca se quede sin preguntas, manteniendo una distribución estadística equilibrada y un costo de infraestructura de **Cero Dólares ($0.00)**.

---

## 0. Modal de Configuración (Identidad del Examen)

Tanto el **Simulador Médico** (visto por el alumno) como el **Panel de Gestión IA** (visto por el administrador) comparten un núcleo de configuración idéntico. Este modal es el que instruye al motor RAG sobre qué bibliografía usar y qué tono mimetizar.

### 0.1 Parámetros de Configuración
La configuración se divide en los siguientes apartados críticos:

*   **Dominio (`domain`):** Define el contexto macro. Por defecto es `medicine` (de momento).
*   **Examen Objetivo (`target`):** Define la jerarquía bibliográfica y el formato de opciones.
    *   **ENAM:** 4 opciones. Enfoque clínico-diagnóstico.
    *   **SERUMS:** 4 opciones. Enfoque normativo (RM/NTS).
    *   **RESIDENTADO:** 5 opciones. Enfoque de especialidad y tratados.
*   **Carrera Profesional (`career`):** *Exclusivo para entornos SERUMS*.
    *   **Medicina Humana:** Estilo MINSA Medicina.
    *   **Enfermería:** Estilo MINSA Enfermería (Tipos A y B).
    *   **Obstetricia:** Estilo MINSA Obstetricia.
*   **Dificultad (`difficulty`):**
    *   **Básico:** Preguntas directas, teoría pura y definiciones.
    *   **Intermedio:** Casos clínicos centrados en el diagnóstico inicial.
    *   **Avanzado:** Casos complejos de tratamiento, complicaciones y gestión de salud (ASIS/Normas).
*   **Áreas de Estudio (`topics`):** El sistema agrupa **23+ áreas académicas** en 4 bloques funcionales:
    1.  **CIENCIAS BÁSICAS:** Anatomía, Fisiología, Farmacología, Microbiología y Parasitología.
    2.  **LAS 4 GRANDES:** Medicina Interna, Pediatría, Ginecología y Obstetricia, Cirugía General.
    3.  **ESPECIALIDADES CLÍNICAS:** Cardiología, Gastroenterología, Neurología, Nefrología, Neumología, Endocrinología, Hematología, Reumatología, Infectología, Dermatología, Psiquiatría.
    4.  **SALUD PÚBLICA Y GESTIÓN (SERUMS):** Salud Pública y Epidemiología, Gestión de Servicios de Salud, Ética Deontología e Interculturalidad, Medicina Legal, Investigación y Bioestadística, Cuidado Integral.

### 0.2 Bindeo con el Motor de IA
Cuando el usuario presiona "Configurar Simulacro" o el administrador "Generar con IA", estos parámetros se encapsulan en un objeto JSON que viaja a `mlService.js`. Este servicio utiliza el **Target** para elegir los recursos vectorizados y la **Carrera** para inyectar los ejemplos de estilo (Few-Shot) recuperados por el RAG.
Ojo: No se debe cambiar el estilo title-case de topic, subtopic, difficulty y career. Target en mayuscula.
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
4.  **Generación Flash Dual:** 
    *   **Todos los Niveles (User/Admin):** Usan exclusivamente `gemini-2.5-flash-lite` (Velocidad máxima y Costos controlados). 

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

## 5. Mimetización de Estilo (v2.0)

Para asegurar que el simulador sea indistinguible del examen real, se ha implementado:
*   **Few-Shot por Carrera:** Inyección de preguntas reales basadas epecíficamente en la **Carrera Profesional** (Medicina, Enfermería u Obstetricia), asegurando que el tono y los ejemplos sean coherentes con la profesión técnica del usuario.
*   **Restricción de Concisión:** Opciones limitadas a un máximo de 15 palabras.
*   **Formatos Híbridos:** Alternancia entre casos, definiciones y "completar espacios".
*   **Generación 1-a-1 (Medical Target):** Para SERUMS, ENAM y RESIDENTADO, el sistema fuerza la generación de 1 en 1. Cada pregunta tiene su propio barrido RAG de 8 fragmentos, garantizando fundamento bibliográfico máximo.

---
**Certificado como Estándar de Oro - 18 de Marzo, 2026**
