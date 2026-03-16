# Sistema de Analíticas y Estadísticas Administrativas

El sistema de analíticas de Hub Academia está diseñado siguiendo una arquitectura de tres capas (Frontend, Backend y Servicios de Datos), integrando procesamiento en tiempo real con análisis predictivo por lotes.

## 1. Arquitectura de Datos

### Capas de Monitoreo
1.  **Tráfico en Tiempo Real (Heartbeat):**
    -   **Captura:** `app.js` (`initTrafficTracking`).
    -   **Flujo:** Envía un pulso cada 2.5 minutos con el `session_id` y `is_mobile`.
    -   **Tabla:** `web_traffic` (almacena el `last_ping`).
2.  **Vistas de Contenido:**
    -   **Captura:** `app.js` (Interceptor de rutas).
    -   **Flujo:** Registra cada visita a Carreras, Cursos o Temas.
    -   **Tabla:** `page_views`.
3.  **Historial de Búsquedas e Interacción IA:**
    -   **Captura:** `mlService.js` y `chatController.js`.
    -   **Flujo:** Registra cada query del usuario, resultados obtenidos y feedback (thumbs up/down).
    -   **Tablas:** `search_history`, `feedback`, `chat_messages`.

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
    -   *Valor:* Mide el alcance real de tu marca. Si tienes 100 visitas únicas pero 0 registros, indica que necesitas optimizar el mensaje de tu página de inicio.

### C. Métricas de Engagement (Uso)
*   **Búsquedas Totales:** 
    -   *Propósito:* Acumulado histórico de palabras clave buscadas.
    -   *Valor:* Identifica si la herramienta de búsqueda es útil para los alumnos.
*   **Interacciones IA:** 
    -   *Propósito:* Conteo de mensajes procesados por el Tutor IA.
    -   *Valor:* Mide la adopción de la Inteligencia Artificial. Es el corazón del proyecto; un número alto aquí significa que la IA está aportando valor real al estudio.

### D. Métricas Estratégicas y de Contenido
*   **Top 5 Cursos/Libros (Gráficos):** 
    -   *Propósito:* Ranking de los recursos con más "clics" o vistas.
    -   *Valor:* Te dice qué contenido es el más valioso para tus alumnos. Puedes usar esto para decidir qué nuevos libros comprar o qué áreas reforzar en tu banco de preguntas.
*   **Predicciones de IA (Tendencias):** 
    -   *Propósito:* Análisis matemático de búsquedas que no devolvieron resultados.
    -   *Valor:* **Predicción de demanda.** Te dice qué es lo que los usuarios están buscando y que tú *aún no tienes*. Es tu hoja de ruta para contenido futuro.

### E. Métricas Financieras
*   **Ingresos Estimados:** 
    -   *Propósito:* Cálculo basado en suscripciones activas por el costo del Plan Avanzado.
    -   *Valor:* Visibilidad financiera rápida para medir la rentabilidad del proyecto sin necesidad de entrar a plataformas de pago externas.
