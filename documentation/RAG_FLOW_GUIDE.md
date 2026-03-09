# Guía Maestro: Arquitectura RAG Local y Generación de Preguntas

Este documento es la referencia definitiva del motor de IA implementado en **Hub Academia**. Detalla el flujo de datos desde que un administrador solicita preguntas hasta que estas se validan y guardan, garantizando un sistema **100% Local en búsqueda, seguro y de bajo costo**.

---

## 1. Filosofía del Sistema (Cero Costo de Infraestructura)

Para proteger la economía del proyecto, el sistema ha sido auditado y re-estructurado para eliminar dependencias costosas de Google Cloud:
*   **Búsqueda Sin Embeddings:** No se usa la IA de Google para "buscar" (ahorro de cuota de `text-embedding-004`).
*   **Deduplicación Local:** Se comparan preguntas nuevas contra las antiguas usando SQL directo.
*   **Gemini Flash (No Thinking):** Se utiliza el modelo `gemini-2.5-flash` con el modo de razonamiento extendido desactivado para evitar cargos por tokens de 'Thinking'.

---

## 2. Flujo de Generación Paso a Paso

### Paso 1: Solicitud desde el Chat / Admin
El usuario define los parámetros en el frontend o vía chat:
- **Básico:** Evaluación de memoria directa (Definiciones, Triadas) o datos normativos (Dosis, Plazos). Explicación: **2 párrafos**.
- **Intermedio:** Razonamiento clínico simple o aplicación de normas en comunidad (I-1 al I-4). Explicación: **2 párrafos detallados**.
- **Avanzado:** Manejo terapéutico de 2da línea, complicaciones raras o gestión de brotes. Explicación: **3 párrafos analíticos**.

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
  "difficulty": "Nivel",
  "question_text": "Cuerpo de la pregunta...",
  "options": ["Opción A", "Opción B", ...],
  "correct_option_index": 0,
  "explanation": "2-3 párrafos según nivel, citando fuentes locales.",
  "subtopic": "Tema clínico específico"
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

### 6.3 Flujo de Citas (Auditado)
*   **Nivel Básico/Intermedio:** Exigencia de al menos 2 fuentes.
*   **Nivel Avanzado:** Exigencia de 3-4 fuentes con análisis de casos complejos.

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

### 7.1 Prueba SERUMS (Salud Pública/Gestión)
*   **Pedido:** 5 preguntas, Nivel Básico.
*   **Jerarquía:** Citó correctamente **NTS 134, 120, 169, 161 y 192**.
*   **Extensión:** Explicaciones de **exactamente 2 párrafos** cada una.
*   **ENCAPS:** Casos adaptados al primer nivel de atención (I-1 al I-4).

### 7.2 Prueba RESIDENTADO (Fisiología/Gastro)
*   **Pedido:** 3 preguntas, Nivel Básico.
*   **Jerarquía:** Priorizó **Harrison, Guyton y Washington Manual**.
*   **Extensión:** Explicaciones de **exactamente 2 párrafos**.
*   **Formato:** 5 opciones (A-E) obligatorias para Residentado.

### 7.3 Métricas de Eficiencia (Cero Costo IA)
*   **Búsqueda RAG:** Ejecutada localmente en milisegundos. **Costo de Búsqueda: $0.00**.
*   **Razonamiento:** Modo `thinking` desactivado. **Costo de Razonamiento: Mínimo**.

### 7.4 Regla de Transparencia de Salida (Chat/IA)
- **Prohibición de Truncamiento:** La IA (Asistente) DEBE mostrar SIEMPRE el JSON íntegro en el chat.
- **Sin Resúmenes:** Queda prohibido el uso de "... (puntos suspensivos)" en las opciones o explicaciones durante el proceso de auditoría y entrega de lotes.
- **Formato Estricto:** Cada pregunta, opción y párrafo de explicación debe ser visible para su validación final por el administrador.

---

**Documentación Finalizada y Auditada - 09 de Marzo, 2026.**
