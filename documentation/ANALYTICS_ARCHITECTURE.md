# Sistema de Analíticas y Estadísticas Administrativas

El sistema de analíticas de Hub Academia está diseñado siguiendo una arquitectura de tres capas (Frontend, Backend y Servicios de Datos), integrando procesamiento en tiempo real con análisis predictivo por lotes.

## 1. Arquitectura de Datos

### Capas de Monitoreo
1.  **Tráfico en Tiempo Real (Heartbeat):**
    -   **Captura:** `app.js` (`initTrafficTracking`).
    -   **Flujo:** Envía un primer pulso con retraso de 5 segundos (para mitigar errores durante el cold start del servidor en Render), luego repite cada 3 minutos con `session_id` e `is_mobile`. Usa `fetch` nativo silencioso (no `NetworkService`) para evitar reintentos ruidosos y toasts de error por telemetría secundaria, pero conserva el `Authorization` del token vigente para asociar usuarios autenticados.
    -   **Disponibilidad:** El retraso del cliente reduce la probabilidad de una carrera con el cold start, pero no reemplaza un backend disponible ni corrige por sí mismo respuestas `503` del proveedor.
    -   **Rutas:** Consolidadas en `infrastructure/routes/analyticsRoutes.js` (`POST /api/analytics/pulse`).
    -   **Tabla:** `web_traffic` (almacena el `last_ping`).
2.  **Vistas de Contenido:**
    -   **Captura:** `app.js` (Interceptor de rutas).
    -   **Flujo:** Registra cada visita a Carreras, Cursos o Temas.
    -   **Tabla:** `page_views`.
3.  **Clics en Recursos (Multimedia/Videos):**
    -   **Captura:** `uiManager.js` (`unlockResource`) y `recordResourceClick`.
    -   **Lógica:** Dispara un evento asíncrono hacia el backend antes de abrir el recurso.
    -   **Distinción de Usuarios:**
        *   **Logueados:** Se asocia al `user_id` y afecta su contador de pases/vidas si es premium.
        *   **Visitantes:** Registra clics anónimos pero asociados a una `session_id`, permitiendo medir la popularidad real de los recursos frente a nuevos prospectos.
    -   **Tablas:** `resource_interactions`, `analytics_events`.

## 2. Componentes del Backend

### Repositorios (`domain/repositories`)
- **`analyticsRepository.js`**: Centraliza las consultas SQL complejas, incluyendo las series temporales (Time Series) y el análisis de similitud de Jaccard para agrupar términos de búsqueda.

### Servicios (`domain/services`)
- **`analyticsService.js`**: Orquestador principal. Realiza clasificaciones de términos (Curso/Tema/Docente) y gestiona la lógica de KPIs.
- **`mlService.js`**: Registra eventos analíticos específicos de IA (impresiones, clicks en explicaciones).

### Controladores (`application/controllers`)
- **`analyticsController.js`**: Expone endpoints para el Dashboard de Admin. Maneja el diagnóstico preventivo (antiguo Thinking) transformado en IA Clínica.
- **`adminController.js`**: Gestiona las "Estadísticas Maestras" y el proceso de Batch de IA (Exportación CSV -> Python).

## 3. Motor de IA Predictiva Local (Python)

Ubicado en `ml_service/run_batch.py`, este motor es activado manualmente por el administrador. A diferencia del chat que usa LLMs externos, este análisis es **100% Local**, garantizando costo $0 y privacidad de datos.

### Algoritmo de Predicción (Cursos y Libros)
Para determinar qué es "Tendencia", el motor utiliza una arquitectura híbrida de NLP:

1.  **Decaimiento Exponencial Temporal:** 
    -   No todas las búsquedas valen lo mismo. Una búsqueda de hoy tiene más peso que una de hace un mes.
    -   *Fórmula:* `e^(-0.05 * días_antigüedad)`. Esto asegura que los KPIs reflejen el interés **actual** del alumno.
2.  **Similitud Semántica (Coseno):**
    -   Usa modelos de *Sentence Embeddings* locales para entender que si un alumno busca "corazón", el sistema debe sugerir el curso de "Cardiología", aunque las palabras no sean idénticas.
3.  **Filtro de Relevancia Híbrido (Jaccard):**
    -   Para evitar "alucinaciones" semánticas (ej: que la IA asocie temas médicos con temas legales por error), el motor aplica una validación de **Similitud de Jaccard**.
    -   Si el texto de la búsqueda y el nombre del curso no comparten al menos un núcleo de palabras clave, el peso semántico se penaliza severamente.
4.  **Boost de Match Directo (Prioridad Absoluta):**
    -   Si el alumno escribe el nombre exacto de un libro o curso (o una parte significativa), el sistema aplica un multiplicador **x5** al score. Esto garantiza que la intención clara del usuario siempre sea la métrica número uno.
5.  **Cálculo de Confianza:**
    -   La "Confidence" visible en el panel se calcula cruzando la **Dominancia** (qué tanto le gana el 1er lugar al 2do) con el **Volumen** total de interés. Solo aparece una tendencia si hay suficiente masa crítica de datos.

## 4. Visualización (Admin Dashboard)

El archivo `dashboard.js` se encarga de transformar la data cruda en visualizaciones:
- **KPIs Animados:** Usuarios, Búsquedas e Interacciones.
- **En Vivo (Nuevo):** Contador activo basado en la ventana de 5 minutos de la tabla `web_traffic`.
- **Gráficos (Chart.js):** Consumo de series temporales para ver la evolución de cursos y libros populares.

## 5. Escalabilidad y Rendimiento

- **Índices Estratégicos:** Las tablas de tráfico poseen índices en `last_ping` y `created_at` para asegurar consultas rápidas incluso con miles de registros.
- **Cero Latencia en Cliente:** El tracking de vistas y pulsos ocurre de forma asíncrona, sin bloquear la experiencia del usuario.
- **Seguridad (RLS):** Las políticas de Supabase garantizan que solo el rol `admin` pueda visualizar el tráfico global, mientras que el registro de pulsos es público pero restringido por sesión.

## 6. Diccionario de KPIs y Propósito de Negocio

A continuación se detalla el significado estratégico de cada métrica visible en el Panel de Administración:

### A. Métricas de Crecimiento y Comunidad
*   **Usuarios Totales:** 
    -   *Propósito:* Mide el tamaño de la base de datos de usuarios registrados.
    -   *Valor:* Indica el éxito de tus campañas de captación y el crecimiento de tu comunidad académica.
*   **Suscripciones Activas:** 
    -   *Propósito:* Conteo real de usuarios con el Plan Avanzado/Elite.
    -   *Valor:* Es tu métrica de conversión principal (Conversion Rate). Te dice cuántos usuarios gratuitos están pasando a pago.

### B. Métricas de Visibilidad (Tráfico)
*   **🔥 En Vivo Ahora:** 
    -   *Propósito:* Muestra la cantidad de personas conectadas en los últimos 5 minutos.
    -   *Valor:* Te da una sensación de "pulso" real. Ideal para medir el impacto inmediato cuando lanzas una notificación o publicidad.
*   **Visitas Únicas (Hoy):** 
    -   *Propósito:* Cuenta dispositivos distintos que entraron a la web hoy (anónimos + logueados).
    -   *Lógica:* Utiliza la función SQL `CURRENT_DATE` para filtrar sesiones generadas desde las 00:00:00 del día actual (servidor).
    -   *Valor:* Mide el alcance real de tu marca. Si tienes 100 visitas únicas pero 0 registros, indica que necesitas optimizar el mensaje de tu página de inicio.

### C. Métricas de Engagement (Uso)
*   **Búsquedas Totales:** 
    -   *Propósito:* Acumulado histórico de palabras clave buscadas.
    -   *Valor:* Identifica si la herramienta de búsqueda es útil para los alumnos.
*   **Interacciones IA:** 
    -   *Propósito:* Conteo de mensajes procesados por el Tutor IA.
    -   *Valor:* Mide la adopción de la Inteligencia Artificial. Es el corazón del proyecto; un número alto aquí significa que la IA está aportando valor real al estudio.

### D. Métricas Estratégicas y de Contenido
*   **Top 5 Recursos Más Visitados (Visualización Diferenciada):** 
    -   *Propósito:* Ranking de los recursos con más interacción.
    -   *Lógica:* El backend agrupa por `resource_type` para mostrar la distribución real (ej. 70% Videos, 30% PDFs).
    -   *Valor:* Identifica qué formato prefiere tu audiencia. Si los videos dominan, la estrategia de contenidos debe priorizar YouTube.
*   **Predicciones de IA (Tendencias):** 
    -   *Propósito:* Análisis matemático de búsquedas que no devolvieron resultados.
    -   *Valor:* **Predicción de demanda.** Te dice qué es lo que los usuarios están buscando y que tú *aún no tienes*. Es tu hoja de ruta para contenido futuro.

### E. Métricas Financieras
*   **Ingresos Estimados:** 
    -   *Propósito:* Cálculo basado en suscripciones activas por el costo del Plan Avanzado.
    -   *Valor:* Visibilidad financiera rápida para medir la rentabilidad del proyecto sin necesidad de entrar a plataformas de pago externas.

## 7. Diagnósticos Inteligentes y Fallback Estático por Dominio

El sistema de diagnósticos profundos asistidos por IA está estructurado para optimizar costos de API (Vertex AI) y garantizar una experiencia de usuario fluida sin paywalls intrusivos.

### A. Dominios soportados
Los diagnósticos se adaptan dinámicamente al contexto activo del estudiante:
*   **MEDICINA (Default):** Evalúa áreas clínicas clave como Ginecología, Pediatría, Medicina Interna, etc.
*   **EDUCACION:** Evalúa competencias pedagógicas y de escala magisterial (Comprensión Lectora, Razonamiento Lógico, Convivencia Escolar, etc.).

### B. Flujo de Control de Cuotas y Fallback
Para evitar el consumo desmedido de cuotas de LLM y prevenir errores 403 blocks visibles al usuario:
1.  **Detección de Endpoint:** La ruta `/api/analytics/diagnostic` es interceptada por el `checkLimitsMiddleware`.
2.  **Omisión de Bloqueo 403:** Si el usuario pertenece a un plan no Premium (`free`, `pending`, `demo`) o ha alcanzado su límite diario de IA, en lugar de recibir un error 403:
    - Se establece `req.usageType = null` (no se descuentan créditos ni se incrementa su uso).
    - Se establece `req.fallbackToStatic = true` en la petición.
3.  **Generación de Fallback Estático:** El `analyticsController` detecta la bandera `req.fallbackToStatic` o el tier del usuario y retorna un diagnóstico clínico/pedagógico/lingüístico en formato HTML/CSS limpio directamente desde el backend.
4.  **Clientes Invitados (Guest):** El dashboard (`simulator-dash.js`) maneja a los usuarios sin sesión de forma local en el cliente, adaptando sus KPIs y gráficos de evolución demo según el módulo activo.

## 8. Gráficos Analíticos Avanzados (Nuevas Integraciones v3.0)

### A. Gráfico de Tendencia Histórica Multi-Línea
El gráfico lineal de evolución (`evolutionChart`) ha sido repotenciado para trazar hasta tres series cronológicas de forma paralela usando `spanGaps: true`:
1.  **Línea Verde (`scores10`):** Representa los simulacros rápidos de 10 preguntas.
2.  **Línea Azul (`scores20`):** Representa los simulacros de estudio de 20 preguntas.
3.  **Línea Ámbar (`scoresReal`):** Representa los **Simulacros Reales** (evaluaciones completas de 50 o más preguntas según target).
*   **Filtros de Toggles:** Integrados en la cabecera mediante la botonera de Modos ("Todos", "Rápido", "Estudio", "Simulacros") que controlan la visibilidad de los datasets del gráfico dinámicamente en el cliente mediante `chart.setDatasetVisibility()`.

Los diagnósticos se adaptan dinámicamente al contexto activo del estudiante:
*   **MEDICINA (Default):** Evalúa áreas clínicas clave como Ginecología, Pediatría, Medicina Interna, etc.
*   **EDUCACION:** Evalúa competencias pedagógicas y de escala magisterial (Comprensión Lectora, Razonamiento Lógico, Convivencia Escolar, etc.).

### B. Flujo de Control de Cuotas y Fallback
Para evitar el consumo desmedido de cuotas de LLM y prevenir errores 403 blocks visibles al usuario:
1.  **Detección de Endpoint:** La ruta `/api/analytics/diagnostic` es interceptada por el `checkLimitsMiddleware`.
2.  **Omisión de Bloqueo 403:** Si el usuario pertenece a un plan no Premium (`free`, `pending`, `demo`) o ha alcanzado su límite diario de IA, en lugar de recibir un error 403:
    - Se establece `req.usageType = null` (no se descuentan créditos ni se incrementa su uso).
    - Se establece `req.fallbackToStatic = true` en la petición.
3.  **Generación de Fallback Estático:** El `analyticsController` detecta la bandera `req.fallbackToStatic` o el tier del usuario y retorna un diagnóstico clínico/pedagógico/lingüístico en formato HTML/CSS limpio directamente desde el backend.
4.  **Clientes Invitados (Guest):** El dashboard (`simulator-dash.js`) maneja a los usuarios sin sesión de forma local en el cliente, adaptando sus KPIs y gráficos de evolución demo según el módulo activo.

## 8. Gráficos Analíticos Avanzados (Nuevas Integraciones v3.0)

### A. Gráfico de Tendencia Histórica Multi-Línea
El gráfico lineal de evolución (`evolutionChart`) ha sido repotenciado para trazar hasta tres series cronológicas de forma paralela usando `spanGaps: true`:
1.  **Línea Verde (`scores10`):** Representa los simulacros rápidos de 10 preguntas.
2.  **Línea Azul (`scores20`):** Representa los simulacros de estudio de 20 preguntas.
3.  **Línea Ámbar (`scoresReal`):** Representa los **Simulacros Reales** (evaluaciones completas de 50 o más preguntas según target).
*   **Filtros de Toggles:** Integrados en la cabecera mediante la botonera de Modos ("Todos", "Rápido", "Estudio", "Simulacros") que controlan la visibilidad de los datasets del gráfico dinámicamente en el cliente mediante `chart.setDatasetVisibility()`.

### B. Gráfico de Dona de Distribución por Temas
Ubicado de manera responsiva a la derecha del gráfico lineal, el nuevo gráfico circular (`topicDoughnutChart`) muestra la distribución volumétrica de preguntas respondidas por el alumno:
*   **MEDICINA (SERUMS):** Agrupa y muestra exclusivamente los 5 subtemas del **Grupo D (Salud Pública y Gestión)**: *Salud Pública*, *Cuidado Integral de Salud*, *Ética e Interculturalidad*, *Investigación* y *Gestión de Servicios de Salud*.
*   **EDUCACION:** Consolida la sumatoria de preguntas agrupadas bajo los 4 ejes principales de la especialidad: *Enfoques y Principios del CNEB*, *Teorías y Procesos del Aprendizaje*, *Planificación y Evaluación* y *Clima Escolar e Inclusión*.
*   **Diseño Limpio:** El gráfico no pinta nombres en los segmentos del lienzo, sino a través de una leyenda de colores y valores numéricos + porcentajes. El nombre de cada tema/grupo solo se expone al posar el cursor encima (hover) mediante el atributo `title` nativo y la interacción con tooltips.

### C. Sincronización y Resiliencia en Simulacros Reales
*   **Evasión de Filtro de Áreas:** En el inicio de un examen de Simulacro Real (`mode = 'real'`), los servicios de generación omiten la configuración guardada del usuario para forzar la selección equitativa de preguntas de todas las áreas disponibles de ese target.
*   **Propagación de Áreas en Backend:** Los controladores devuelven en la respuesta de inicio (`start`) y lote (`next-batch`) el set completo de áreas evaluadas. Esto evita que el cliente mande un set recortado al guardar el examen.
*   **Cola Offline (`simulator_pending_submissions`):** Si falla el envío final del examen debido a una caída de conexión a internet, se encolan los resultados localmente y se liberan recursos de inmediato. El despachador asíncrono `syncPendingSubmissions()` los procesará y subirá en cuanto regrese la conectividad.

### D. Diagnóstico Inteligente por IA (Patrones de Error) — "Extraer Insights IA"
Integrado en la tarjeta `#ai-diagnosis-card` del panel de simuladores, este módulo detecta brechas cognitivas, sesgos de razonamiento y recomendaciones personalizadas segmentadas por nivel de suscripción:

1. **Visitantes (Modo Prueba / Guest):**
   - Procesa los resultados en memoria de su prueba demo (`GuestSessionManager`).
   - Calcula el *Índice de Preparación Inicial* (Readiness Index) y clasifica su nivel de competencia.
   - Genera un diagnóstico con fortalezas, áreas de intervención, un *Sprint Táctico en 3 Pasos* orientado al registro y un llamado a desbloquear el **Plan Avanzado**.

2. **Usuarios Gratuitos (Free) y Básicos (Basic) — Diagnóstico Heurístico Enriquecido:**
   - En el backend (`/api/analytics/diagnostic`), `AnalyticsService.generateHeuristicDiagnostic(stats, context)` procesa la matriz real de especialidades (`radar_data`), notas promedio y precisión global.
   - **Índice de Preparación Oficial (`readinessIndex` & `readinessLevel`):** Pondera la nota (0-20) y efectividad global para emitir un badge de competencia (`Nivel Sobresaliente`, `Nivel Competente`, `Nivel en Desarrollo`, `Nivel Inicial`).
   - **Auditoría de Fortalezas & Focos Críticos:** Tarjetas con conteo exacto de reactivos correctos/fallados, porcentajes reales y directivas de normas oficiales (MINSA/ASPEFAM o CNEB/Minedu).
   - **Sprint Táctico en 3 Pasos:** Pasos estructurados de acción inmediata (Refuerzo Conceptual, Práctica Focalizada en Modo Estudio 20q, y Consolidación de Velocidad).
   - **Cuotas:** Consume 1 vida de prueba en Free (`usage_count`) y 0 tokens diarios en Basic (`req.usageType = null`, estático).

3. **Usuarios Avanzados (Advanced) y Administradores (Admin) — Deep Reasoning Cognitivo:**
   - Invoca al motor de IA mediante canal dual resiliente `_callGeminiDiagnostic()`:
     - **Canal Primario (Google Cloud Vertex AI SDK - Gemini Enterprise Agent Platform):** Ejecución directa en GCP (`us-central1`) con `gemini-2.5-flash-lite` (y `gemini-2.5-flash`), con facturación enterprise integrada y sin dependencia de saldos prepago de AI Studio.
     - **Canal Secundario de Contingencia (Google AI Studio REST):** Soporte opcional con modelos Flash Lite (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`).
   - **Detección de Sesgos Diagnósticos:** Identifica patrones de confusión sistemática frente a distractores (ej. sesgo de anclaje, no reconocimiento de signos de alarma, confusión entre retroalimentación formativa y descriptiva).
   - **Píldora High-Yield Oficial:** Provee un concepto clave de alta recurrencia en las pruebas oficiales de medicina (ENAM/SERUMS/Residentado) o docencia (Nombramiento/Ascenso).
   - **Sprint Táctico IA:** 3 acciones tácticas de estudio personalizadas a la medida del usuario.
   - **Cuotas:** Consume 1 token de su cuota diaria (`daily_ai_usage`) de 100 mensajes/día.

4. **Resiliencia y Fallback Silencioso:**
   - Si la llamada a los proveedores externos excede el tiempo o genera un error de red, conmuta silenciosa y automáticamente al motor heurístico enriquecido sin arrojar errores 404/500 ni interrumpir la experiencia del usuario.

### E. Calificación y Registro Resiliente de Exámenes (Offline-First y Casuísticas)
*   **Calificación Híbrida de Respuestas (`gradeForSubmission`):** El backend sincroniza de forma segura las respuestas enviadas en lote (`clientAnswers`) contra las claves maestras (`answer_payload.correct_option_index`) almacenadas en base de datos. Si el cliente respondió de forma local/offline, se evalúa y persiste el estado `is_correct` en `quiz_session_questions`, garantizando que puntajes legítimos (ej. 3/10 o 7/10) se almacenen con exactitud matemática y se proyecten en el KPI de evolución vigesimal (`6.0` y `14.0` sobre 20).
*   **Preservación de Casuísticas / Casos Anidados:** Al agrupar preguntas encadenadas a una misma viñeta clínica o situación pedagógica (`case_id`), el sistema incluye todas las preguntas hermanas consecutivamente y ajusta dinámicamente el límite del examen (`state.maxQuestions`) para que ninguna pregunta del caso sea omitida ni cortada intempestivamente.

### F. Rediseño Minimalista y Coherencia Visual de Analíticas (v3.1 - Septiembre 2026)
1. **Tarjetas KPI Principales (`simulator-dashboard.html`):**
   - Se removieron los iconos decorativos redundantes de la esquina superior derecha (`.stat-icon`) en las tres tarjetas analíticas (*Puntuación Promedio*, *Precisión Global* y *Volumen de Respuestas*). Las ilustraciones temáticas de fondo ya proveen identidad visual limpia y reducen la carga cognitiva.
2. **Diagnóstico Inteligente por IA (Patrones de Error):**
   - **Eliminación de Colores Arcoíris:** Se eliminaron los colores estridentes y no contextuales (`#10b981`, `#f87171`, `#34d399`, `#fbbf24`, `#8b5cf6`, `#c4b5fd`).
   - **Tokens de Diseño Cohesivos:** Toda la tarjeta (`#ai-diagnosis-card`), sus badges de estado, el anillo de preparación (`.ai-readiness-ring`), las áreas de fortalezas/debilidades y el bloque de upgrade utilizan las variables del sistema (`var(--primary)`, `var(--surface-hover)`, `var(--border-color)`, `var(--text-muted)`).
   - **Adaptabilidad Modular:** El diagnóstico respeta la identidad cromática del módulo en curso: Verde Esmeralda/Teal (`#0d9488`) para **Salud (Medicina)** y Azul Cobalto (`#3b82f6`) para **Educación**.
   - **Tipografía y Jerarquía:** Badges de micro-temas y focos prioritarios en tipografía uppercase con padding refinado (`0.25rem 0.65rem`) y bordes sutiles.

---
> [!IMPORTANT]
> Esta arquitectura ha sido verificada y respaldada con 51 suites de tests unitarios (401 tests pasando) al 7 de septiembre de 2026.
