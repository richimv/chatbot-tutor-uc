# 🌲 Guía Maestro: Arquitectura RAG Vectorial (V6.5)

Este documento define el funcionamiento del motor de Inteligencia Artificial de **Hub Academia**. Detalla cómo el sistema utiliza la búsqueda semántica en la nube para garantizar que cada respuesta y cada pregunta generada tenga un sustento técnico irrefutable (Médico o Pedagógico).

---

## 1. Filosofía V6.1: Precisión sobre Volumen
Tras la migración a **Pinecone**, el sistema ha priorizado la **calidad del fragmento** sobre el costo. 
- **Búsqueda Semántica**: Entiende la intención, no solo palabras clave.
- **Namespaces Estancos**: Separación total entre la biblioteca médica (`medicine`) y la magisterial (`education`).
- **Aislamiento de Errores**: Si el motor vectorial falla, el sistema recurre al conocimiento experto interno de Gemini (V6.1 Safety Mode).

---

## 2. Roles del RAG por Servicio

El RAG no se aplica igual a todos, para optimizar el rendimiento y la experiencia de usuario:

| Servicio | Uso del RAG | Motor | Objetivo |
| :--- | :--- | :--- | :--- |
| **`TutorAiService` (Chat)** | ✅ **Activo** | Pinecone (Semantic) | Responder dudas con citas exactas de NTS/CNEB. |
| **`AdminAiService` (Banco)** | ✅ **Activo** | Pinecone (Semantic) | Generar preguntas basadas en exámenes reales. |

---

## 3. El Flujo "Smart Search" (Paso a Paso)

### Paso 1: Agentic Rewriter
Antes de buscar en Pinecone, el sistema utiliza un sub-proceso de Gemini para traducir la consulta del usuario en **términos técnicos puros**.
- **Ejemplo Médico**: "dolor de barriga fuerte" -> `apendicitis aguda, signos peritoneales, ecografía`.
- **Ejemplo Pedagógico**: "evaluar en inicial" -> `evaluación formativa, retroalimentación, RVM 094-2020`.

### Paso 2: Vectorización (Embeddings)
Los términos limpios se convierten en un vector de **768 dimensiones** usando el modelo `text-multilingual-embedding-002` de Google Vertex AI.

### Paso 3: Búsqueda en Namespace
Se consulta a Pinecone filtrando por el namespace correspondiente (`education` o `medicine`). El sistema recupera hasta **20 fragmentos más relevantes** para garantizar máxima profundidad técnica y cobertura curricular/clínica (V6.5).

### Paso 4: Inyección Contextual
La IA recibe un prompt estructurado según el servicio:
1.  **TutorAiService (Chat en Exámenes y Repaso):** Inyecta los fragmentos RAG recuperados, las citas oficiales (documento, página) y los esquemas del catálogo visual de imágenes de la plataforma junto a la pregunta y opciones.
2.  **AdminAiService (Generador de Reactivos):** Inyecta 2-3 preguntas reales recuperadas de Pinecone como ejemplos Few-Shot para que la IA replique el tono del examen oficial (Nombramiento, ENAM, etc.).

---

## 4. Jerarquía de Fuentes (Estructura de Autoridad)

El sistema obliga a la IA a priorizar la información según el Target:

### 🏥 Dominio Médico (MINSA)
1. **Leyes y NTS**: Normas Técnicas de Salud y Resoluciones Ministeriales.
2. **GPC**: Guías de Práctica Clínica oficiales.
3. **Tratados**: Harrison, Nelson, Williams (Uso como soporte clínico).

### 🍎 Dominio Educativo (MINEDU)
1. **CNEB**: Currículo Nacional de la Educación Básica.
2. **Leyes**: Ley de Reforma Magisterial (29944), Ley General de Educación.
3. **RVM**: Resoluciones Viceministeriales (Ej: RVM 094-2020 para evaluación).
4. **Pruebas de Ascenso**: Usadas como base para el estilo de casuística.

---

## 5. Auditoría de Calidad
Cada pregunta generada por el `AdminAiService` debe cumplir:
- **Explicación Robusta**: Mínimo 2 párrafos analíticos.
- **Cita Directa**: Referencia al documento y, si es posible, a la página.
- **Opciones Balanceadas**: Longitud similar para evitar sesgos de extensión.

---
**Documentación Sincronizada: Septiembre 2026 - Versión 6.5 (Inmersive Pure Vector Architecture)**
