# Guía Maestro: Arquitectura RAG Local y Generación de Preguntas

Este documento es la referencia definitiva del motor de IA implementado en **Hub Academia**. Detalla el flujo de datos desde que un administrador solicita preguntas hasta que estas se validan y guardan, garantizando un sistema **100% Local en búsqueda, seguro y de bajo costo**.

---

## 1. Filosofía del Sistema (Cero Costo de Infraestructura)

Para proteger la economía del proyecto, el sistema ha sido auditado y re-estructurado para eliminar dependencias costosas de Google Cloud:
*   **Búsqueda Sin Embeddings:** No se usa la IA de Google para "buscar" (ahorro de cuota de `text-embedding-004`).
*   **Deduplicación Local:** Se comparan preguntas nuevas contra las antiguas usando SQL directo.
*   **RAG FTS (Full Text Search - V3):** Se ha migrado de `ILIKE` a una arquitectura de búsqueda vectorial nativa de PostgreSQL usando `tsvector` y `tsquery`.
    - **Indexación Bilingüe:** Soporte nativo para términos en Español e Inglés (crítico en medicina).
    - **Salva-vidas Médico:** Los acrónimos cortos (TB, VIH, NTS, GPC) no se ignoran, se protegen en la búsqueda.
    - **Ranking por Relevancia:** Usa `ts_rank` para ordenar fragmentos por qué tan bien coinciden con la consulta, además de la prioridad por "carpetas de negocio" (Normas > Guías > Libros).
    - **Costo $0:** Todo ocurre dentro de la base de datos local sin llamar a APIs externas.

---

## 🏗️ Flujo de Generación (FTS Edition)
 Paso a Paso

### Paso 1: Solicitud desde el Chat / Admin
El usuario define los parámetros en el frontend o vía chat:
- **Estilo de Generación**: Evaluación integral centrada en el rigor clínico-normativo. Explicación de **3 párrafos analíticos** con sustento bibliográfico detallado.

### Paso 2: Escaneo de Duplicidad (SQL Local)
En `mlService.js`, antes de llamar a la IA, el sistema ejecuta:
```sql
SELECT topic, question_text FROM question_bank 
WHERE target = $1 AND domain = $2 ... 
LIMIT 200;
```
Esto recupera los últimos 200 temas generados. El sistema inyecta esta lista en el prompt como **"RESTRICCIÓN DE DUPLICIDAD"**, obligando a la IA a no repetir conceptos.

### Paso 3: Motor de Búsqueda RAG Local (ILIKE)
El archivo `ragService.js` toma los términos de búsqueda y realiza una búsqueda mecánica en la tabla `documents`:
- **Lógica:** Se extraen palabras clave y se busca mediante `ILIKE %palabra%`.
- **Resultado:** El sistema extrae fragmentos reales de texto (párrafos) de los libros y manuales cargados.
- **Log de Verificación:** Verás en consola: `🔍 RAG Local: Buscando palabras clave: [...]`.

### Paso 4: Inyección de Contexto y Procesamiento IA
La IA (Gemini) recibe un "Prompt Maestro" que contiene:
1.  **Reglas de Oro** (Jerarquía de fuentes, extensiones, cantidad de opciones).
2.  **Restricción de Duplicidad** (Preguntas que ya existen).
3.  **Datos de Apoyo RAG Local** (Los fragmentos reales encontrados en el paso anterior).
4.  **Regla de Oro de Opciones:** Las opciones deben tener longitud similar para evitar sesgo visual (la correcta no debe resaltar).
5.  **Cantidad de Opciones (MANDATORIO):** 
    - **ENAM / SERUMS:** 4 opciones.
    - **RESIDENTADO:** 5 opciones.
6.  **Sin Prefijos:** Las opciones NO deben incluir "A)", "B)", etc. Solo el texto en el array.
7.  **Explicación Robusta (SINTETIZADA):** Cada explicación DEBE integrar y citar explícitamente al menos **DOS (2) fuentes** médicas oficiales basándose en la jerarquía del perfil.

### Paso 5: Generación de la Pregunta (JSON)
La IA actúa como un redactor experto. Lee los fragmentos y redacta la pregunta citando la fuente exacta. La respuesta se devuelve en un formato JSON estricto:

```json
{
  "topic": "Área de estudio",
  "difficulty": "Senior",
  "question_text": "Cuerpo de la pregunta...",
  "options": ["Opción A", "Opción B", ...],
  "correct_option_index": 0,
  "explanation": "2-3 párrafos según nivel, citando fuentes locales y externas.",
  "domain": "medicine",
  "target": "El tipo de Examen (SERUMS, ENAM, RESIDENTADO)",
  "career": "La carrera profesional (para SERUMS)",
  "subtopic": "Sub temas (Opcional)"
}
```

---

## 3. Jerarquía de Fuentes por Examen

El motor de IA prioriza las fuentes según el "Target" solicitado para asegurar que la fundamentación sea válida para el examen específico:

| Examen | Perfil y Enfoque | Jerarquía de Fuentes (ESTRICTA) |
| :--- | :--- | :--- |
| **ENAM** | Clínica general, diagnóstico diferencial y manejo inicial. | 1. GPC Oficiales > 2. Libros Clínicos > 3. Manuales Especialidad > 4. NTS/RM/Leyes. |
| **SERUMS** | Salud Pública y Gestión Comunitaria (**ENCAPS**). Contexto: Primer nivel de atención (I-1 al I-4). | 1. LEY: NTS y RM (Cadena de Frío, Dengue, PAI, etc) > 2. OFICIAL: GPC Minsa > 3. SOPORTE: Libros/Manuales. |
| **RESIDENTADO** | Especialidad, libros y evidencia clínica. | 1. LIBROS (Harrison, Nelson, etc) + GPC Clínicas > 2. Manuales Especialidad > 3. NTS/RM/Leyes. |

---

## 4. Casos de Prueba (Auditoría Exitosa)

A continuación, se documentan los ejercicios de prueba que validaron esta arquitectura:

### Caso A: SERUMS (Gestión de Salud)
*   **Fragmentos RAG**: Se recuperaron guías de Salud Ambiental.
*   **Resultado**: Pregunta sobre intoxicación por plomo. Citó el **Harrison (Cap. 458)** y el **Manual CTO de Salud Pública**, cumpliendo con los 2 párrafos de explicación requeridos para el nivel Intermedio.

### Caso B: ENAM (Obstetricia)
*   **Fragmentos RAG**: Información sobre Esteatosis Hepática Aguda.
*   **Resultado**: Pregunta de caso clínico complejo. Citó el **Manual de Gastroenterología 2020** y el **Harrison 21 Edición**, diferenciando el Síndrome HELLP de la AFLP mediante datos técnicos inyectados.

### Caso C: RESIDENTADO (Anatomía/Fisiología)
*   **Fragmentos RAG**: Mecanismos de motilidad gástrica.
*   **Resultado**: Pregunta de 5 opciones (Nivel Especialidad). Explicación profunda citando a **Maldonado Valdés** y el **Washington**, fundamentando el control intrínseco vs extrínseco del estómago.

---

## 5. Mantenimiento y "Modo Candado"
*   **Seguridad:** El `usedRAG` ahora es `true` solo cuando el motor local inyecta fragmentos reales.
*   **Estabilidad:** El modo `thinking: { disable: true }` es obligatorio para todas las llamadas de generación masiva.
*   **Inviolabilidad:** No se deben reactivar las APIs de `text-embedding` para evitar romper el esquema de cero costo.

## 6. Recomendaciones de Uso y Escalabilidad (Puntaje de Oro)

Para mantener el sistema como un **Gold Standard** (Máxima Calidad), se deben seguir las siguientes recomendaciones al generar lotes de preguntas:

### 6.1 Límite de Áreas por Lote
*   **Recomendación:** Seleccionar un máximo de **3 a 5 áreas** simultáneas.
*   **Razón Técnica:** El motor RAG recupera 8 fragmentos por búsqueda. Si seleccionas 23 áreas, la mayoría no tendrá apoyo documental real, provocando que la IA alucine o generalice sin citar. Al limitar las áreas, nos aseguramos de que cada una tenga fragmentos técnicos dedicados.

### 6.2 Agrupamiento de Áreas Relacionadas
Es óptimo agrupar áreas que comparten bibliografía para que los fragmentos recuperados se refuercen entre sí:
*   **Grupo Salud Pública:** Gestión + Bioestadística + Medicina Legal + Epidemiología. (Inyecta automáticamente NTS/Leyes).
*   **Grupo Clínico Adulto:** Medicina Interna + Farmacología + Fisiología. (Inyecta automáticamente GPC/Harrison).
*   **Grupo Especialidades:** Pediatría + Obstetricia + Cirugía. (Inyecta automáticamente GPC/Guías).

*   **Sustento de Citas**: Exigencia obligatoria de citar al menos **DOS (2) fuentes** oficiales (NTS, GPC o Tratados) por cada pregunta, con análisis profundo de la casuística.

### 6.4 Escenarios de Búsqueda y Palabras Clave
Para entender cómo el sistema "piensa" al buscar fragmentos, aquí tienes los tres escenarios principales basados en el motor de inyección automática:

#### **Escenario A: SERUMS (Básico)**
*   **Palabras Clave Generadas:** `salud`, `pública`, `nts`, `norma`, `ley`, `resolución`, `rm`.
*   **Resultado:** El sistema barre las **NTS** (Normas Técnicas de Salud) y Leyes Generales simultáneamente.

#### **Escenario B: ENAM (Intermedio)**
*   **Palabras Clave Generadas:** `medicina`, `interna`, `gpc`, `guía`, `clínica`, `nts`.
*   **Resultado:** Se priorizan las **Guías de Práctica Clínica (GPC)** y fragmentos de libros de especialidad.

#### **Escenario C: RESIDENTADO (Intermedio)**
*   **Palabras Clave Generadas:** `anatomía`, `fisiología`, `farmacología`, `microbiología`.
*   **Resultado:** El motor se enfoca exclusivamente en **Tratados de Referencia** para evitar "ruido" legal o administrativo.

## 7. Resultados de Auditoría y Verificación Final

Tras las pruebas de fuego realizadas el **09 de Marzo de 2026**, se certifica que el sistema cumple con los siguientes estándares:

## 8. Mimetización de Estilo Real (Few-Shot v2.0)

Para lograr que la IA genere preguntas idénticas a los exámenes reales del MINSA, se ha implementado un sistema de **Mimetización Orgánica**:

### 8.1 Extracción de Ejemplos Reales (`getStyleExamples`)
El motor RAG ahora posee una función especializada que busca en la tabla `documents` fragmentos de exámenes pasados específicos:
-   **Criterio de Selección (CRÍTICO):** La selección del patrón de estilo se basa en la **Carrera Profesional** (parámetro `career`) y NO en el área de estudio. Esto garantiza que si un enfermero solicita "Salud Pública", la IA emule exámenes de Enfermería y no de Medicina.
-   **Patrones de búsqueda:** `%SERUMS-medicina%`, `%SERUMS-enfermeria%`, `%SERUMS-obstetricia%`.
-   **Inyección:** Se extraen 4 preguntas reales aleatorias y se inyectan en el prompt bajo la sección `[EJEMPLOS DE ESTILO REAL]`. Esto permite que la IA "copie" el tono, la brevedad y la estructura sin necesidad de reglas rígidas.

### 8.2 Reglas de Redacción "Telegrama"
Se han establecido restricciones inviolables en el prompt maestro:
*   **Opciones (1 a 15 palabras):** Prohibido el uso de párrafos o explicaciones dentro de la opción.
*   **Formato Híbrido:** La IA debe alternar obligatoriamente entre Casos Clínicos, Definiciones Directas y **Completar Espacios ( _____ )**.
*   **Geografía Real:** Uso de distritos y departamentos reales de Perú (Loreto, Cusco, Puno, Huancavelica) para inmersión total.

---

## 9. Resultados de Auditoría Final (18 de Marzo, 2026)

Tras la última actualización, se certifica el cumplimiento del estándar **MINSA 2025**:

### 9.1 Auditoría SERUMS (Medicina Humana)
*   **Resultado:** Generación de preguntas sobre **Gestión de Brotes** y **Medicina Legal**.
*   **Estilo:** Opciones breves (ej: "Inmediata (menos de 24 horas)").
*   **Precisión:** Cita exacta de la **Ley 26842** y **NTS 161**.
*   **Mimetización:** Estructura idéntica al examen real aplicado el 24 de agosto de 2025.

---

**Documentación Finalizada y Auditada - 18 de Marzo, 2026.**
