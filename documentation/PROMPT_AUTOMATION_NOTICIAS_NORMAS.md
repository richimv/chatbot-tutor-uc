# 📰 Configuración de Scheduled Tasks en Antigravity 2.0: Curaduría Semanal de Noticias, Normas y Publicaciones (MINEDU & MINSA)

## 📌 ¿Qué son estas tareas programadas?
En **Antigravity 2.0**, las **Scheduled Tasks** permiten programar agentes autónomos especializados en segundo plano mediante expresiones **Cron**.

El sistema cuenta con **dos tareas programadas independientes y especializadas**:
1. **Sector Salud (MINSA):** Monitorea noticias, normas legales e informes/publicaciones sobre **SERUMS**, **ENAM** y **Residentado Médico**.
2. **Sector Educación (MINEDU):** Monitorea noticias, normas legales e informes/publicaciones sobre **Nombramiento**, **Ascenso Docente** y **Acceso a Cargos Directivos**.

### 🗓️ Modalidad de Ejecución Semanal (Blindaje contra Fallos Diarios)
Ambas tareas se ejecutan **cada domingo por la noche** y analizan toda la información oficial publicada en los **últimos 7 días** (la semana transcurrida). Esto garantiza que no se pierda ninguna novedad crítica ante cortes de energía, reinicios o fallas de programación diaria.

Si en los últimos 7 días no hubo publicaciones oficiales relevantes sobre los temas clave, el agente finaliza limpiamente sin alterar la base de datos (política estricta de cero inserciones forzadas).

---

## 🏥 TAREA 1: Sector Salud (MINSA - Noticias, Normas y Publicaciones)

### ⚙️ Parámetros de Configuración en Antigravity
| Campo | Valor |
| :--- | :--- |
| **Nombre de la Tarea** | `Curaduría Semanal de Noticias, Normas y Publicaciones - Salud (MINSA)` |
| **Cron Expression** | `0 20 * * 0` *(Cada domingo a las 8:00 PM)* |
| **IsDaemon** | `true` |
| **Herramientas requeridas** | `read_url_content`, `run_command` |

### 🤖 Prompt para Antigravity (Salud)
```text
Actúa como un Curador Oficial de Noticias, Normas e Informes Oficiales de Salud para Hub Academia. Tu objetivo es descubrir, verificar e inyectar exclusivamente las NOTICIAS, NORMAS LEGALES e INFORMES/PUBLICACIONES emitidas por el Ministerio de Salud (MINSA) durante los ÚLTIMOS 7 DÍAS (la semana transcurrida) relacionadas estrictamente a: SERUMS, ENAM o RESIDENTADO.

PASO 1: FUENTES OFICIALES Y NAVEGACIÓN
Utiliza tu herramienta read_url_content para navegar en tiempo real a las 3 secciones oficiales del MINSA:
1. Portal de Noticias:
   https://www.gob.pe/institucion/minsa/noticias
2. Normas y Documentos Legales:
   https://www.gob.pe/institucion/minsa/normas-legales
3. Informes y Publicaciones Oficiales (Cronogramas, Comunicados, Guías Serums):
   https://www.gob.pe/institucion/minsa/informes-publicaciones

PASO 2: FILTRADO ESTRICTO POR VENTANA SEMANAL (7 DÍAS ATRÁS) Y TEMÁTICA OBLIGATORIA
Aplica un doble filtro excluyente para cada publicación detectada:
1. Filtro Temporal (Últimos 7 días): Identifica la fecha actual de ejecución (domingo) y retrocede 7 días. La publicación debe haber sido emitida dentro de ese rango de fechas (última semana).
2. Filtro Temático Específico: La publicación (su título, descripción/sumilla o cuerpo) DEBE mencionar explícita y directamente al menos uno de los siguientes temas:
   - SERUMS (Servicio Rural y Urbano Marginal de Salud, Evaluación Serums, Cronogramas, Plazas, Subsanaciones o Comunicados).
   - ENAM (Examen Nacional de Medicina / ASPEFAM).
   - RESIDENTADO (Residentado Médico / Conareme / Residentado en Salud).
3. Regla de Descarte y Cero Ingesta Forzada:
   - Si una noticia, norma o informe NO trata sobre SERUMS, ENAM o Residentado, o fue publicada fuera de los últimos 7 días, DESCÁRTALA de inmediato.
   - Si tras revisar las fuentes NO existe ninguna publicación semanal que cumpla estos criterios, NO inventes datos, NO fuerces ingestas y finaliza respondiendo:
     "✅ Monitoreo Semanal de Salud al día. No se registraron nuevas noticias, normas ni publicaciones oficiales sobre SERUMS, ENAM o Residentado en los últimos 7 días."

PASO 3: VERIFICACIÓN DE URLS REALES
- Para cada elemento filtrado que califique positivamente, ingresa con read_url_content a su enlace individual en gob.pe para confirmar que cargue el contenido completo y no sea un error 404 ni Soft-404.

PASO 4: CONSTRUCCIÓN DEL ARRAY JSON DE INGESTA
Para cada recurso válido de la semana, genera el siguiente objeto JSON con su respectivo resource_type:

Para Noticias:
{
  "title": "[Título exacto de la noticia oficial]",
  "author": "MINSA Perú",
  "url": "[URL pública verificada de la noticia en gob.pe]",
  "resource_type": "noticia",
  "domain": "medicine",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Primer párrafo o resumen factual de 2 a 3 líneas del comunicado oficial.]</p>"
}

Para Normas Legales (Resoluciones / Decretos / Directivas):
{
  "title": "[Título exacto de la norma, ej: Resolución Ministerial N.° ... / Resolución Directoral N.° ...]",
  "author": "MINSA Perú",
  "url": "[URL pública de la norma en gob.pe o enlace de descarga oficial]",
  "resource_type": "norma",
  "domain": "medicine",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Sumilla o descripción exacta de la resolución/norma legal oficial.]</p>"
}

Para Informes, Comunicados Oficiales y Guías (Cronogramas, Comunicados Serums, Bases):
{
  "title": "[Título exacto del informe o publicación oficial]",
  "author": "MINSA Perú",
  "url": "[URL pública del informe/publicación en gob.pe]",
  "resource_type": "guia",
  "domain": "medicine",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Descripción o extracto informativo oficial de la publicación/comunicado.]</p>"
}

PASO 5: EJECUCIÓN DEL SCRIPT DE INGESTA EN BACKEND
Si se encontraron recursos válidos de la semana, ejecuta mediante run_command en el directorio del proyecto:

node scripts/autoIngestResources.js --data='[...ARRAY_JSON_ESCAPADO...]'

El backend validará duplicados por URL y guardará los registros en PostgreSQL destacándolos de inmediato en Hub Academia.
```

---

## 🎓 TAREA 2: Sector Educación (MINEDU - Noticias, Normas y Publicaciones)

### ⚙️ Parámetros de Configuración en Antigravity
| Campo | Valor |
| :--- | :--- |
| **Nombre de la Tarea** | `Curaduría Semanal de Noticias, Normas y Publicaciones - Educación (MINEDU)` |
| **Cron Expression** | `0 20 * * 0` *(Cada domingo a las 8:00 PM)* |
| **IsDaemon** | `true` |
| **Herramientas requeridas** | `read_url_content`, `run_command` |

### 🤖 Prompt para Antigravity (Educación)
```text
Actúa como un Curador Oficial de Noticias, Normas e Informes Oficiales de Educación para Hub Academia. Tu objetivo es descubrir, verificar e inyectar exclusivamente las NOTICIAS, NORMAS LEGALES e INFORMES/PUBLICACIONES emitidas por el Ministerio de Educación (MINEDU) durante los ÚLTIMOS 7 DÍAS (la semana transcurrida) relacionadas estrictamente a: NOMBRAMIENTO, ASCENSO DOCENTE o ACCESO A CARGOS DIRECTIVOS.

PASO 1: FUENTES OFICIALES Y NAVEGACIÓN
Utiliza tu herramienta read_url_content para navegar en tiempo real a las 3 secciones oficiales del MINEDU:
1. Portal de Noticias:
   https://www.gob.pe/institucion/minedu/noticias
2. Normas y Documentos Legales:
   https://www.gob.pe/institucion/minedu/normas-legales
3. Informes y Publicaciones Oficiales (Plazas, Padrones, Comunicados, Guías Magisteriales):
   https://www.gob.pe/institucion/minedu/informes-publicaciones

PASO 2: FILTRADO ESTRICTO POR VENTANA SEMANAL (7 DÍAS ATRÁS) Y TEMÁTICA OBLIGATORIA
Aplica un doble filtro excluyente para cada publicación detectada:
1. Filtro Temporal (Últimos 7 días): Identifica la fecha actual de ejecución (domingo) y retrocede 7 días. La publicación debe haber sido emitida dentro de ese rango de fechas (última semana).
2. Filtro Temático Específico: La publicación (su título, descripción/sumilla o cuerpo) DEBE mencionar explícita y directamente al menos uno de los siguientes temas magisteriales:
   - NOMBRAMIENTO (Concurso de Nombramiento Docente / Ingreso a la Carrera Pública Magisterial).
   - ASCENSO (Concurso de Ascenso Docente / Ascenso de Escala Magisterial).
   - ACCESO A CARGOS DIRECTIVOS (Acceso a Cargos Directivos y de Especialistas / Directores de IIEE, UGEL o DRE).
3. Regla de Descarte y Cero Ingesta Forzada:
   - Si una noticia, norma o informe NO trata sobre Nombramiento, Ascenso o Acceso a Cargos Directivos, o fue publicada fuera de los últimos 7 días, DESCÁRTALA de inmediato.
   - Si tras revisar las fuentes NO existe ninguna publicación semanal que cumpla estos criterios, NO inventes datos, NO fuerces ingestas y finaliza respondiendo:
     "✅ Monitoreo Semanal de Educación al día. No se registraron nuevas noticias, normas ni publicaciones oficiales sobre Nombramiento, Ascenso o Cargos Directivos en los últimos 7 días."

PASO 3: VERIFICACIÓN DE URLS REALES
- Para cada elemento filtrado que califique positivamente, ingresa con read_url_content a su enlace individual en gob.pe para confirmar que cargue el contenido completo y no sea un error 404 ni Soft-404.

PASO 4: CONSTRUCCIÓN DEL ARRAY JSON DE INGESTA
Para cada recurso válido de la semana, genera el siguiente objeto JSON con su respectivo resource_type:

Para Noticias:
{
  "title": "[Título exacto de la noticia oficial]",
  "author": "MINEDU Perú",
  "url": "[URL pública verificada de la noticia en gob.pe]",
  "resource_type": "noticia",
  "domain": "education",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Primer párrafo o resumen factual de 2 a 3 líneas del comunicado oficial.]</p>"
}

Para Normas Legales (Resoluciones / Decretos / Directivas):
{
  "title": "[Título exacto de la norma, ej: Resolución Viceministerial N.° ... / Resolución Ministerial N.° ...]",
  "author": "MINEDU Perú",
  "url": "[URL pública de la norma en gob.pe o enlace de descarga oficial]",
  "resource_type": "norma",
  "domain": "education",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Sumilla o descripción exacta de la resolución/norma legal oficial.]</p>"
}

Para Informes, Comunicados Oficiales y Guías (Plazas, Padrones, Cronogramas Magisteriales):
{
  "title": "[Título exacto del informe o publicación oficial]",
  "author": "MINEDU Perú",
  "url": "[URL pública del informe/publicación en gob.pe]",
  "resource_type": "guia",
  "domain": "education",
  "visible": true,
  "open_directly": true,
  "is_premium": false,
  "content_html": "<p>[Descripción o extracto informativo oficial de la publicación/comunicado.]</p>"
}

PASO 5: EJECUCIÓN DEL SCRIPT DE INGESTA EN BACKEND
Si se encontraron recursos válidos de la semana, ejecuta mediante run_command en el directorio del proyecto:

node scripts/autoIngestResources.js --data='[...ARRAY_JSON_ESCAPADO...]'

El backend validará duplicados por URL y guardará los registros en PostgreSQL destacándolos de inmediato en Hub Academia.
```

---

## 🛠️ Notas de Base de Datos y Compatibilidad
- Se soporta `resource_type: "noticia"`, `resource_type: "norma"` y `resource_type: "guia"` con validación automática de duplicados por URL en la tabla `resources`.

---

## ☁️ Versión Universal para Automatizaciones en la Nube (Cloud Schedules Diarios sin Backend / MCP)

Estas variantes están optimizadas para ejecutarse en plataformas en la nube (ej. **ChatGPT Custom GPT / Scheduled Actions**, **Claude Workspaces / Web Fetch**, **Google Workspace / Gemini Spark**, etc.) que **se ejecutan de manera 100% autónoma en servidores cloud sin depender de tener la PC o Antigravity encendidos**.

### ⏰ Estrategia Óptima de Ejecución Diaria Nocturna
- **Horario Recomendado:** Todos los días entre las **8:30 PM y 10:30 PM** (hora de Perú / GMT-5).
- **Razón Técnica:** Las instituciones públicas (MINSA, MINEDU, El Peruano) publican resoluciones y notas de prensa durante su jornada laboral (8:00 AM – 7:00 PM). Ejecutar la automatización al final de la noche garantiza capturar el 100% de las publicaciones oficiales del día en un solo barrido limpio.
- **Salida:** Emite un informe estructurado con los hallazgos del día o confirma con total certeza si no hubo publicaciones sobre los temas clave, sin alucinaciones.

### 🩺 Prompt Universal Cloud: Salud (Diario Nocturno)
```text
Actúa como un Monitor de Inteligencia y Convocatorias Oficiales de Salud para Hub Academia. Tu objetivo es rastrear y reportar las publicaciones, normas, cronogramas y noticias oficiales emitidas durante el día de HOY relacionadas estrictamente a: SERUMS, ENAM o RESIDENTADO MÉDICO.

FUENTES OFICIALES A MONITOREAR:
Navega e inspecciona las siguientes URLs en tiempo real:
1. https://www.gob.pe/institucion/minsa/noticias
2. https://www.gob.pe/institucion/minsa/normas-legales
3. https://www.gob.pe/institucion/minsa/informes-publicaciones
<!-- Puedes agregar aquí más enlaces oficiales si lo deseas, ej.:
- https://www.conareme.org.pe/
- https://aspefam.org.pe/
- https://elperuano.pe/
-->

REGLAS DE FILTRADO ESTRICTO:
1. Ventana Temporal (Diaria): Considera únicamente publicaciones emitidas en la fecha del día de HOY (o las últimas 24 horas si la fecha exacta aún está procesándose).
2. Filtro Temático Mandatario: El título, descripción o contenido DEBE mencionar explícitamente:
   - SERUMS (Servicio Rural y Urbano Marginal de Salud, sorteos, cronogramas, evaluación, plazas, subsanaciones, listas de aptos).
   - ENAM (Examen Nacional de Medicina).
   - RESIDENTADO (Residentado Médico, Conareme, campos clínicos, adjudicación).
3. Descarte: Cualquier publicación ajena a estos temas o con fecha anterior al día de hoy debe ser descartada de inmediato.

FORMATO DEL INFORME DE SALIDA:

Si se encontraron novedades relevantes de HOY:
Presenta un reporte claro y estructurado con el siguiente formato para cada recurso:
### 📌 [Título exacto de la publicación]
- 🗓️ **Fecha:** [Fecha exacta de publicación de hoy]
- 🏷️ **Tipo:** [Noticia | Norma Legal | Informe / Comunicado]
- 🏢 **Entidad / Fuente:** MINSA Perú (o la entidad correspondiente)
- 🔗 **Enlace Oficial:** [URL directa verificada]
- 📝 **Resumen / Puntos Clave:** [2 a 3 líneas explicando el impacto para el postulante o profesional]

Si NO se encontraron novedades durante el día de hoy:
Responde de forma clara y directa:
"✅ Monitoreo Diario de Salud al día: No se registraron nuevas noticias, normas legales ni publicaciones oficiales sobre SERUMS, ENAM o Residentado Médico durante el día de hoy."
```

### 📚 Prompt Universal Cloud: Educación (Diario Nocturno)
```text
Actúa como un Monitor de Inteligencia y Carrera Magisterial para Hub Academia. Tu objetivo es rastrear y reportar las publicaciones, normas, cronogramas, plazas y noticias oficiales emitidas durante el día de HOY relacionadas estrictamente a: NOMBRAMIENTO DOCENTE, ASCENSO DE ESCALA o ACCESO A CARGOS DIRECTIVOS.

FUENTES OFICIALES A MONITOREAR:
Navega e inspecciona las siguientes URLs en tiempo real:
1. https://www.gob.pe/institucion/minedu/noticias
2. https://www.gob.pe/institucion/minedu/normas-legales
3. https://www.gob.pe/institucion/minedu/informes-publicaciones
<!-- Puedes agregar aquí más enlaces oficiales si lo deseas, ej.:
- https://evaluaciondocente.perueduca.pe/
- https://elperuano.pe/
-->

REGLAS DE FILTRADO ESTRICTO:
1. Ventana Temporal (Diaria): Considera únicamente publicaciones emitidas en la fecha del día de HOY (o las últimas 24 horas si la fecha exacta aún está procesándose).
2. Filtro Temático Mandatario: El título, descripción o contenido DEBE mencionar explícitamente:
   - NOMBRAMIENTO (Concurso de Nombramiento Docente, Ingreso a la Carrera Pública Magisterial, plazas, resultados, comités).
   - ASCENSO (Concurso de Ascenso Docente, Ascenso de Escala Magisterial, etapas, temarios).
   - ACCESO A CARGOS DIRECTIVOS (Cargos Directivos de IIEE, Especialistas, Directores de UGEL o DRE).
3. Descarte: Cualquier publicación ajena a estos temas o con fecha anterior al día de hoy debe ser descartada de inmediato.

FORMATO DEL INFORME DE SALIDA:

Si se encontraron novedades relevantes de HOY:
Presenta un reporte claro y estructurado con el siguiente formato para cada recurso:
### 📌 [Título exacto de la publicación]
- 🗓️ **Fecha:** [Fecha exacta de publicación de hoy]
- 🏷️ **Tipo:** [Noticia | Norma Legal | Informe / Comunicado]
- 🏢 **Entidad / Fuente:** MINEDU Perú (o la entidad correspondiente)
- 🔗 **Enlace Oficial:** [URL directa verificada]
- 📝 **Resumen / Puntos Clave:** [2 a 3 líneas explicando el impacto para el postulante o docente]

Si NO se encontraron novedades durante el día de hoy:
Responde de forma clara y directa:
"✅ Monitoreo Diario de Educación al día: No se registraron nuevas noticias, normas legales ni publicaciones oficiales sobre Nombramiento, Ascenso Docente o Acceso a Cargos Directivos durante el día de hoy."
```

---

## 📋 Registro de Ejecución y Noticias Ingestadas (Logs)
- **Fecha:** 07 de septiembre de 2026 (Curaduría Semanal MINEDU: 31/08/2026 al 07/09/2026)
- **Responsable:** Antigravity AI Curador Oficial
- **Estado de Ingesta:** ✅ Exitosa (2 recursos ingestados)
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Evaluación Nacional del Concurso de Ascenso Docente se aplicará el 25 de octubre](https://www.gob.pe/institucion/minedu/noticias/1440040-evaluacion-nacional-del-concurso-de-ascenso-docente-se-aplicara-el-25-de-octubre) (Noticia)
  2. **MINEDU (education):** [Resolución Viceministerial N.° 157-2026-MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/8563323-157-2026-minedu) (Norma Legal)
- **Recursos Descartados (Filtro temático/temporal):**
  - 1 Noticia de la semana descartada (*Evaluaciones docentes no provocarán despido de maestros, asegura ministro de Educación*) por versar sobre evaluación periódica de desempeño docente ordinario y no sobre concursos de Nombramiento, Ascenso o Cargos Directivos.
  - Otras noticias de la semana descartadas por temáticas no magisteriales (conectividad satelital en Loreto, violencia escolar, sismo en Ayacucho, proyectos de innovación escolar).
  - 22 Normas Legales emitidas en la semana descartadas (RVM 158-2026 sobre Institutos Tecnológicos; RM 526, 525, 524, 522, 521, 520, 519, 518, 517, 516, 514, 513, 512, 511, 510, 509, 508, 507 por materias de presupuesto, personal de confianza ministerial, licenciamientos y concursos de proyectos escolares).
  - 28 Informes/Publicaciones de la semana descartados por corresponder a licitaciones de compras de la Unidad Ejecutora 118 y obras de infraestructura universitaria.
- **Detalle:** Se incorporó la reprogramación oficial de la Evaluación Nacional del Concurso de Ascenso Docente 2026 fijada para el domingo 25 de octubre de 2026 para más de 162 000 postulantes, respaldada jurídicamente por la Resolución Viceministerial N.° 157-2026-MINEDU.

- **Fecha:** 31 de agosto de 2026
- **MINSA (medicine):** Sin nuevas noticias ni normas legales sobre SERUMS, ENAM o Residentado publicadas durante el día de hoy (6 noticias oficiales descartadas por temática general/asistencial: *Hospital Lima Este atención digital, trasplante renal asistido por robot en Hospital Dos de Mayo, farmacovigilancia DIGEMID, primeros auxilios psicológicos Fenómeno El Niño, campaña 10 minutos contra el dengue, equipamiento tecnológico Diris Lima Norte*; 9 normas legales descartadas: Resoluciones Ministeriales N.° 754, 753, 742, 741-2026 y Resoluciones Directorales N.° 308, 307, 305, 304, 303-2026-OGA sobre trámites administrativos, presupuestos y afectaciones en uso).
- **Estado de Ingesta:** ✅ Monitoreo de Salud al día. 0 recursos ingestados por estricta política de cero inserciones forzadas.

- **Fecha:** 31 de agosto de 2026
- **MINEDU (education):** Sin nuevas noticias ni normas sobre Nombramiento, Ascenso Docente o Acceso a Cargos Directivos publicadas durante el día de hoy (1 noticia oficial descartada por temática no docente: *Minedu envía más domos para colegios afectados por sismo en Ayacucho*; 7 normas legales descartadas por tratarse de renuncias administrativas, infraestructura, cese de IES, resoluciones presupuestales o felicitaciones a asesores de concursos escolares).
- **Estado de Ingesta:** ✅ Monitoreo de Educación al día. 0 recursos ingestados por política estricta de cero inserciones forzadas.

- **Fecha:** 30 de agosto de 2026
- **MINEDU (education):** Sin nuevas noticias ni normas sobre Nombramiento, Ascenso Docente o Acceso a Cargos Directivos publicadas durante el día de hoy (1 noticia oficial descartada por temática no magisterial: *Minedu refuerza prevención de violencia escolar en Huancayo*).
- **Estado de Ingesta:** ✅ Monitoreo de Educación al día. 0 recursos ingestados por política estricta de cero inserciones forzadas.

- **Fecha:** 7 de setiembre de 2026
- **MINSA (medicine):** Curaduría semanal (últimos 7 días: 31 de agosto al 7 de setiembre de 2026). Se evaluaron exhaustivamente las 3 fuentes oficiales de MINSA (Noticias, Normas Legales e Informes/Publicaciones).
  - *Descartes:* Más de 50 noticias oficiales (campañas de vacunación, donación de órganos, salud mental, Fenómeno El Niño, etc.) y 25 resoluciones ministeriales/directorales descartadas por temática ajena a SERUMS, ENAM o Residentado Médico.
  - *Calificados e Ingestados (4 recursos oficiales sobre SERUMS 2026-II):*
    1. **Noticia:** [Minsa publica lista de postulantes aptos y observados para el Proceso de Adjudicación de Plazas Serums 2026-II](https://www.gob.pe/institucion/minsa/noticias/1438313-minsa-publica-lista-de-postulantes-aptos-y-observados-para-el-proceso-de-adjudicacion-de-plazas-serums-2026-ii) (2 de setiembre de 2026).
    2. **Guía/Informe Oficial:** [Lista de Postulantes Aptos y Observados al Proceso SERUMS 2026 – II](https://www.gob.pe/institucion/minsa/informes-publicaciones/8551838-lista-de-postulantes-aptos-y-observados-al-proceso-serums-2026-ii) (2 de setiembre de 2026).
    3. **Guía Oficial:** [Guía De Subsanación para los postulantes Observados al Proceso SERUMS 2026 – II](https://www.gob.pe/institucion/minsa/informes-publicaciones/8551841-guia-de-subsanacion-para-los-postulantes-observados-al-proceso-serums-2026-ii) (2 de setiembre de 2026).
    4. **Guía/Comunicado Oficial:** [Subsanación de Observaciones – SERUMS 2026-II](https://www.gob.pe/institucion/minsa/informes-publicaciones/8551851-subsanacion-de-observaciones-serums-2026-ii) (2 de setiembre de 2026).
- **Estado de Ingesta:** ✅ 4/4 Recursos oficiales verificados (HTTP 200, validación anti-Soft 404, deduplicación en BD) e ingestados exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 28 de agosto de 2026
- **MINSA (medicine):** Sin nuevas noticias ni normas legales sobre SERUMS, ENAM o Residentado publicadas durante el día de hoy (4 noticias oficiales publicadas hoy descartadas por temática general no relacionada: cardiopatías congénitas, SAMU emergencias, PIAS aérea Loreto, DIGESA/Unicef; normas legales: ninguna publicada hoy).
- **Estado de Ingesta:** ✅ Monitoreo de Salud al día. 0 recursos ingestados por estricta política de cero inserciones forzadas.

- **Fecha:** 28 de agosto de 2026
- **MINEDU (education):** Sin nuevas noticias ni normas sobre Nombramiento, Ascenso Docente o Cargos Directivos publicadas durante el día de hoy (1 noticia oficial descartada por temática no docente: *Minedu refuerza prevención en 44 universidades públicas ante posibles efectos del fenómeno El Niño*).
- **Estado de Ingesta:** ✅ Monitoreo de Educación al día. 0 recursos ingestados por política de cero inserciones forzadas.

- **Fecha:** 25 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Minedu impulsará titulación de colegios de Ica para mejorar su infraestructura](https://www.gob.pe/institucion/minedu/noticias/1434484-minedu-impulsara-titulacion-de-colegios-de-ica-para-mejorar-su-infraestructura)
  2. **MINSA (medicine):** [Ministro Dyer premia a los “Bebés Mamoncitos 2026” y destaca la lactancia materna como el mejor alimento](https://www.gob.pe/institucion/minsa/noticias/1434638-ministro-dyer-premia-a-los-bebes-mamoncitos-2026-y-destaca-la-lactancia-materna-como-el-mejor-alimento)
  3. **MINSA (medicine):** [Ministro de Salud recorre el San Bartolomé y anuncia acciones para mejorar la atención](https://www.gob.pe/institucion/minsa/noticias/1434614-ministro-de-salud-recorre-el-san-bartolome-y-anuncia-acciones-para-mejorar-la-atencion)
  4. **MINSA (medicine):** [Diris Lima Este reconoce a 33 brigadistas de la Municipalidad de Santa Anita por fortalecer su preparación ante emergencias](https://www.gob.pe/institucion/minsa/noticias/1434496-diris-lima-este-reconoce-a-33-brigadistas-de-la-municipalidad-de-santa-anita-por-fortalecer-su-preparacion-ante-emergencias)
  5. **MINSA (medicine):** [En jornada de 24 horas, especialistas del Hospital Nacional Cayetano Heredia salvan la vida de 14 pacientes con arritmias](https://www.gob.pe/institucion/minsa/noticias/1434481-en-jornada-de-24-horas-especialistas-del-hospital-nacional-cayetano-heredia-salvan-la-vida-de-14-pacientes-con-arritmias)
  6. **MINSA (medicine):** [Semana de lactancia materna: conoce a los bebés mamoncitos Minsa](https://www.gob.pe/institucion/minsa/noticias/1434282-semana-de-lactancia-materna-conoce-a-los-bebes-mamoncitos-minsa)
- **Estado de Ingesta:** ✅ 6/6 Noticias verificadas e ingestadas exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 15 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Minedu alista beca para mejores talentos de los COAR](https://www.gob.pe/institucion/minedu/noticias/1430869-minedu-alista-beca-para-mejores-talentos-de-los-coar)
  2. **MINEDU (education):** [Minedu y Sunarp se unen para destrabar títulos de propiedad de colegios](https://www.gob.pe/institucion/minedu/noticias/1430817-minedu-y-sunarp-se-unen-para-destrabar-titulos-de-propiedad-de-colegios)
  3. **MINSA (medicine):** [Día del Niño: Minsa Cuentos lleva mensajes de prevención en salud a niños de Villa María del Triunfo](https://www.gob.pe/institucion/minsa/noticias/1430885-dia-del-nino-minsa-cuentos-lleva-mensajes-de-prevencion-en-salud-a-ninos-de-villa-maria-del-triunfo)
  4. **MINSA (medicine):** [Minsa realiza jornada de salud por el Día del Niño en Villa María del Triunfo](https://www.gob.pe/institucion/minsa/noticias/1430873-minsa-realiza-jornada-de-salud-por-el-dia-del-nino-en-villa-maria-del-triunfo)
  5. **MINSA (medicine):** [Más de 1200 personas accedieron a servicios gratuitos para la detección de tuberculosis en Lima Norte](https://www.gob.pe/institucion/minsa/noticias/1430860-mas-de-1200-personas-accedieron-a-servicios-gratuitos-para-la-deteccion-de-tuberculosis-en-lima-norte)
  6. **MINSA (medicine):** [Minsa fortalece la vigilancia sanitaria de juguetes por campaña del Día del Niño](https://www.gob.pe/institucion/minsa/noticias/1430826-minsa-fortalece-la-vigilancia-sanitaria-de-juguetes-por-campana-del-dia-del-nino)
- **Estado de Ingesta:** ✅ 6/6 Noticias verificadas e ingestadas exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 12 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Minedu aprueba expediente técnico para nueva infraestructura de la IE Juan Pablo II de San Genaro](https://www.gob.pe/institucion/minedu/noticias/1429624-minedu-aprueba-expediente-tecnico-para-nueva-infraestructura-de-la-ie-juan-pablo-ii-de-san-genaro)
  2. **MINSA (medicine):** [Minsa resalta las bondades del consumo de frutas verdes](https://www.gob.pe/institucion/minsa/noticias/1429677-minsa-resalta-las-bondades-del-consumo-de-frutas-verdes)
  3. **MINSA (medicine):** [Ministerio de Salud brinda atención médica y soporte psicológico a ciudadano afectado por hecho de violencia](https://www.gob.pe/institucion/minsa/noticias/1429600-ministerio-de-salud-brinda-atencion-medica-y-soporte-psicologico-a-ciudadano-afectado-por-hecho-de-violencia)
  4. **MINSA (medicine):** [Día Internacional de la Juventud: Minsa promueve el cuidado Integral para los jóvenes en el Perú](https://www.gob.pe/institucion/minsa/noticias/1429538-dia-internacional-de-la-juventud-minsa-promueve-el-cuidado-integral-para-los-jovenes-en-el-peru)
  5. **MINSA (medicine):** [Ministro Luis Dyer y representantes del Colegio Médico del Perú trabajarán juntos para mejorar la gestión administrativa en el sector Salud](https://www.gob.pe/institucion/minsa/noticias/1429526-ministro-luis-dyer-y-representantes-del-colegio-medico-del-peru-trabajaran-juntos-para-mejorar-la-gestion-administrativa-en-el-sector-salud)
  6. **MINSA (medicine):** [‘Kallpa’: puesto médico de avanzada implementado por Diris Lima Este para responder ante emergencias](https://www.gob.pe/institucion/minsa/noticias/1429307-kallpa-puesto-medico-de-avanzada-implementado-por-diris-lima-este-para-responder-ante-emergencias)
  7. **MINSA (medicine):** [Minsa: Instituto de Salud Mental y Colegio Médico obtienen certificación de Buena Práctica en Gestión Pública 2026](https://www.gob.pe/institucion/minsa/noticias/1429291-minsa-instituto-de-salud-mental-y-colegio-medico-obtienen-certificacion-de-buena-practica-en-gestion-publica-2026)
  8. **MINSA (medicine):** [INSN Breña obtiene certificación de Buena Práctica en Gestión Pública 2026 por innovador sistema de terapia de infusión](https://www.gob.pe/institucion/minsa/noticias/1429190-insn-brena-obtiene-certificacion-de-buena-practica-en-gestion-publica-2026-por-innovador-sistema-de-terapia-de-infusion)
- **Estado de Ingesta:** ✅ 8/8 Noticias verificadas e ingestadas exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 8 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Minedu refuerza la educación hospitalaria en las 25 regiones del país](https://www.gob.pe/institucion/minedu/noticias/1427360-minedu-refuerza-la-educacion-hospitalaria-en-las-25-regiones-del-pais)
  2. **MINSA (medicine):** [Minsa: llevamos prevención a estudiantes de Villa El Salvador para protegerse frente al fenómeno El Niño](https://www.gob.pe/institucion/minsa/noticias/1427408-minsa-llevamos-prevencion-a-estudiantes-de-villa-el-salvador-para-protegerse-frente-al-fenomeno-el-nino)
  3. **MINSA (medicine):** [Serums 2026-II: Consulta el lugar donde rendirán la evaluación este domingo 9 de agosto](https://www.gob.pe/institucion/minsa/noticias/1427398-serums-2026-ii-consulta-el-lugar-donde-rendiran-la-evaluacion-este-domingo-9-de-agosto)
  4. **MINSA (medicine):** [Cesantes y jubilados del Minsa fueron reconocidos por su trayectoria y años de servicio](https://www.gob.pe/institucion/minsa/noticias/1427390-cesantes-y-jubilados-del-minsa-fueron-reconocidos-por-su-trayectoria-y-anos-de-servicio)
  5. **MINSA (medicine):** [Junín: ministro de Salud cumplió jornada de trabajo supervisando avances del nuevo Hospital El Carmen y entregando una ambulancia a Chupaca](https://www.gob.pe/institucion/minsa/noticias/1427388-junin-ministro-de-salud-cumplio-jornada-de-trabajo-supervisando-avances-del-nuevo-hospital-el-carmen-y-entregando-una-ambulancia-a-chupaca)
  6. **MINSA (medicine):** [Ministerio de Salud reafirma atención integral y basada en evidencia para personas con trastorno del espectro autista](https://www.gob.pe/institucion/minsa/noticias/1427369-ministerio-de-salud-reafirma-atencion-integral-y-basada-en-evidencia-para-personas-con-trastorno-del-espectro-autista)
  7. **MINSA (medicine):** [Serums 2026-II: ¿Qué debes tener en cuenta para la evaluación que se realizará este domingo 9 de agosto?](https://www.gob.pe/institucion/minsa/noticias/1427351-serums-2026-ii-que-debes-tener-en-cuenta-para-la-evaluacion-que-se-realizara-este-domingo-9-de-agosto)
- **Estado de Ingesta:** ✅ 7/7 Noticias verificadas e ingestas exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 9 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINSA (medicine):** [Más de 23 mil profesionales de la salud participaron en la Evaluación para el SERUMS 2026-II](https://www.gob.pe/institucion/minsa/noticias/1427423-mas-de-23-mil-profesionales-de-la-salud-participaron-en-la-evaluacion-para-el-serums-2026-ii)
- **MINEDU (education):** Sin nuevas publicaciones oficiales durante el día de hoy.
- **Estado de Ingesta:** ✅ 1/1 Noticia verificada e ingestada exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 7 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Gobierno cumple compromiso y entrega primeros domos en Chongos Bajo, en la región Junín](https://www.gob.pe/institucion/minedu/noticias/1427112-gobierno-cumple-compromiso-y-entrega-primeros-domos-en-chongos-bajo-en-la-region-junin)
  2. **MINSA (medicine):** [Minsa Móvil inició atención médica especializada en Carhuapaccha, Junín en beneficio de la población afectada por sismos en esta zona](https://www.gob.pe/institucion/minsa/noticias/1427314-minsa-movil-inicio-atencion-medica-especializada-en-carhuapaccha-junin-en-beneficio-de-la-poblacion-afectada-por-sismos-en-esta-zona)
  3. **MINSA (medicine):** [SIS es reconocido por modelo de traslados aeromédicos que acerca atención especializada a pacientes críticos](https://www.gob.pe/institucion/minsa/noticias/1427310-sis-es-reconocido-por-modelo-de-traslados-aeromedicos-que-acerca-atencion-especializada-a-pacientes-criticos)
  4. **MINSA (medicine):** [Minsa refuerza toma de pruebas moleculares para el diagnóstico oportuno de tuberculosis en todo el país](https://www.gob.pe/institucion/minsa/noticias/1427283-minsa-refuerza-toma-de-pruebas-moleculares-para-el-diagnostico-oportuno-de-tuberculosis-en-todo-el-pais)
  5. **MINSA (medicine):** [Minsa: la construcción del nuevo Centro de Salud Materno Infantil Santa Rosa en Puente Piedra tiene un avance del 97.3 %](https://www.gob.pe/institucion/minsa/noticias/1427091-minsa-la-construccion-del-nuevo-centro-de-salud-materno-infantil-santa-rosa-en-puente-piedra-tiene-un-avance-del-97-3)
  6. **MINSA (medicine):** [Minsa lleva servicios de salud ocular pediátrica gratuita a niños de la región Tumbes](https://www.gob.pe/institucion/minsa/noticias/1426935-minsa-lleva-servicios-de-salud-ocular-pediatrica-gratuita-a-ninos-de-la-region-tumbes)
- **Estado de Ingesta:** ✅ 6/6 Noticias verficadas e ingestas exitosamente en la tabla `resources` de PostgreSQL.

- **Fecha:** 6 de agosto de 2026
- **Recursos Ingestados:**
  1. **MINEDU (education):** [Minedu: espacios alquilados en instituciones educativas públicas serán inspeccionados](https://www.gob.pe/institucion/minedu/noticias/1426850-minedu-espacios-alquilados-en-instituciones-educativas-publicas-seran-inspeccionados)
  2. **MINSA (medicine):** [Minsa: Especialistas en Salud Ambiental brindan asistencia técnica y capacitación sobre agua segura en Carabayllo](https://www.gob.pe/institucion/minsa/noticias/1426838-minsa-especialistas-en-salud-ambiental-brindan-asistencia-tecnica-y-capacitacion-sobre-agua-segura-en-carabayllo)
- **Estado de Ingesta:** ✅ 2/2 Noticias verified & ingested successfully in PostgreSQL `resources` table.




