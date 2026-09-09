# 🛠️ Guía Técnica: Panel de Gestión - Hub Academia

Este documento detalla el funcionamiento técnico, flujos de datos y lógica de negocio de los módulos que componen el Panel de Administración de Hub Academia. Toda la información ha sido auditada directamente del código fuente.

---

## 1. 📊 Dashboard y Análisis de Tendencias
El Dashboard es el centro de control donde se visualiza la salud de la plataforma.

*   **KPIs de Tráfico:** 
    *   **Visitas en Vivo:** Rastrea usuarios activos en tiempo real (Socket/Analytics).
    *   **Visitas Únicas (Hoy):** Cuenta usuarios distintos que han accedido en las últimas 24 horas.
*   **Ranking de Recursos:** 
    *   Se calcula mediante el conteo de clics/vistas (`recordView`).
    *   **Audiencia:** Registra métricas de dos perfiles:
        1.  **Usuarios Registrados:** Conteo vinculado a su `user_id` para historiales personalizados.
        2.  **Visitantes (Invitados):** Conteo basado en `session_id` persistente para medir el interés del tráfico orgánico.
    *   **Alcance:** El ranking de "Top Recursos" diferencia tipos automáticamente (PDFs, Guías, Videos, Libros) permitiendo identificar qué formato genera más engagement.
*   **IA de Tendencias:** 
    *   **Funcionamiento Local:** El sistema exporta la base de datos a CSV y ejecuta un script en Python (`run_batch.py`) de forma local para predecir temas en tendencia y libros recomendados.
    *   **Seguridad:** Toda la data se procesa en el servidor local (`data_dump/`), protegiendo la privacidad del usuario.

---

## 2. 📑 Módulo de Recursos (Multimedia y Documentación)
El sistema ha evolucionado de una "Biblioteca de Libros" a un repositorio multimedia versátil.

### Tipos de Contenido Soportados:
1.  **Videos (YouTube/Vimeo):**
    *   **Detección:** El sistema extrae automáticamente el ID de los enlaces de YouTube.
    *   **Visualización:** Se abren en un **Modal de Video** personalizado con soporte `autoplay` e interfaz cinematográfica.
    *   **Interfaz Premium:** Las tarjetas de video cuentan con un diseño distintivo, etiquetas de "Premium" (coroncica) y estados de bloqueo sugerentes (desenfoque ligero) que incitan a la suscripción sin ocultar el valor.
    *   **Móvil:** Diseño responsivo que optimiza el tamaño del reproductor y asegura que los controles de YouTube (adelantar/retroceder) sean siempre accesibles mediante un "Safe Area" inferior.
    *   **Tipos de Recursos:** Se clasifican específicamente en *Normas Técnicas*, *Guías de Práctica Clínica*, *Papers/Artículos*, *Libros Históricos*, *Videos Explicativos*, e *Infografías/Otros*.
3.  **Seguridad y Acceso:**
    *   **Ofuscación:** Las URLs reales no se exponen en el HTML; se gestionan mediante un registro seguro en `uiManager.js`.
    *   **Pases (Vidas):** Los recursos marcados como **Premium** descuentan pases a usuarios gratuitos cada vez que se desbloquean.
    *   **Interceptación Directa (UI):** Para los recursos con página web dedicada (`/resource.html`), el candado Premium actúa directamente al intentar hacer clic en la tarjeta (`components.js`). Si el usuario es visitante o agotó sus vidas, el sistema levanta nativamente el **Modal de Autenticación** o el **Paywall Modal** bloqueando el acceso a la vista dedicada sin consumos de base de datos innecesarios ni filtraciones de links.

### Administración de Recursos:
*   **Editor Pro (TinyMCE 6):** Migración completa de Quill.js a **TinyMCE 6** (Mini-Word) para la gestión de resúmenes enriquecidos.
    *   **Tablas de Datos:** Soporte nativo para crear y editar tablas complejas (estilo Excel) con control de celdas, bordes y alineación.
    *   **Estética Pro:** Selector de colores de fuente/fondo, encabezados jerárquicos y formato de listas avanzadas.
    *   **Modo Oscuro Editorial:** Configuración `oxide-dark` que garantiza que el texto sea perfectamente legible (blanco) durante el proceso de edición, eliminando el problema del texto invisible.
    *   **Espacio de Trabajo:** El modal de edición se ha ampliado a **1100px** de ancho y **95vh** de alto para maximizar el área de redacción científica.
*   **Buscador con Filtro Dual:** El panel `admin.js` ahora incorpora filtrado en tiempo real por el tipo exacto (`book`, `paper`, `guia`, `norma`, `video`, `other`), combinándose instantáneamente con la barra de texto (`admin-search-input`) permitiendo curar catálogos sin latencias de red.
*   **Mejoras de Visualización UI/UX en Recursos:**
    *   **Diseño Expandido de Ancho Completo:** La interfaz del panel se ha rediseñado para aprovechar casi todo el ancho de la pantalla, alineándose con la estética general del sitio web y optimizando la distribución espacial de la información.
    *   **Mini-Imagen de Portada (Mini-thumbnail):** Cada recurso muestra una pequeña previsualización circular/cuadrada en la parte exterior izquierda de la tarjeta, permitiendo validar rápidamente si el recurso cuenta con una imagen asignada en GCS o local.
    *   **Indicadores Rápidos (Semáforo de Tres Puntos):** Se añadieron indicadores visuales dinámicos en forma de tres puntos de color:
        *   **Punto Dorado (Premium):** Indica si el recurso es de pago o consume vidas/pases.
        *   **Punto Verde (Visible):** Indica si el recurso está activo y es visible públicamente para los estudiantes.
        *   **Punto Azul (Apertura Inmersiva):** Indica si el recurso omite la página de detalles y abre directamente el visor de PDF/contenido.

---

## 3. 🧠 Módulo de Preguntas e IA (Multi-Dominio)
Es el core académico de la plataforma, diseñado para simular exámenes de alto nivel tanto en **Ciencias de la Salud** (Medicina, Enfermería, Obstetricia) como en **Educación** (Docente Pro).

### 3.1 Soporte de Dominios
El panel detecta el contexto y ajusta los formularios automáticamente:
*   **Medicina:** Targets como ENAM, SERUMS, RESIDENTADO. Áreas clínicas (Medicina Interna, Pediatría, etc.).
*   **Educación:** Targets como NOMBRAMIENTO, ASCENSO, ACCESO A CARGOS. Áreas pedagógicas (Comprensión Lectora, Currículo Nacional, Evaluación Formativa).

### 3.2 Generador RAG (Retrieval-Augmented Generation)
*   **Fuentes de Medicina:** Bibliografía de élite (Harrison, CTO) y Normas Técnicas MINSA.
*   **Fuentes de Educación:** Currículo Nacional (CNEB), Marco del Buen Desempeño Docente y Resoluciones Viceministeriales del MINEDU.
*   **Control de Calidad:** 
    *   **Anti-duplicidad:** Escaneo de los últimos 25 registros antes de inyectar.
    *   **Enfoque Constructivista:** Para el dominio educativo, la IA tiene prohibido generar respuestas conductistas o puramente memorísticas.
*   **Inyección Masiva (3 Botones):**
    1.  **Importar:** Permite subir archivos Excel/CSV con el campo `domain` definido para clasificar preguntas automáticamente.
    2.  **Generar IA:** Motor basado en **Gemini 2.5 Flash Lite**. Permite seleccionar el dominio y las áreas de estudio específicas para generar lotes de 5 preguntas de alta fidelidad.
    3.  **Nueva:** Formulario manual que cambia sus opciones de target y carrera según el dominio seleccionado en tiempo real.

### 3.3 Optimización Masiva de Ingesta y Paginación (Agosto 2026)
*   **Ingesta por Lotes (Bulk Batch Insert):** `saveBulkQuestionBankAdmin` procesa la carga masiva en bloques de 50 preguntas por instrucción SQL `INSERT INTO question_bank ... VALUES (...)`, reduciendo los viajes de red en un **90%** (de 500 consultas a solo 10).
*   **Paginación Eficiente:** `getAllQuestions` soporta los parámetros `page` y `limit` para evitar transferencias innecesarias de payloads pesados.
*   **Índices Compuestos:** Búsquedas optimizadas mediante `idx_question_bank_created_at`, `idx_question_bank_domain_topic_sub` y `idx_question_bank_career`.

### 3.4 Gestión de Casuísticas Agrupadas y Encadenamiento de Preguntas (Agosto 2026)
*   **Concepto de Casuística (Case Scenario):** Permite agrupar reactivos del examen oficial MINEDU / MINSA donde varias preguntas se presentan de forma consecutiva o comparten un contexto común.
*   **Enunciado y Título Opcionales con Fallback al Código:** Si el docente no digita un título explícito al crear una casuística, el sistema adopta como título directamente el **código del caso** (`code`), garantizando que nunca se use un fragmento o extracto del enunciado como título.
*   **Topic Desacoplado ('General'):** Las casuísticas pueden agrupar preguntas pertenecientes a múltiples y diversas áreas temáticas. Por tanto, su columna `topic` se estandariza en `'General'` a nivel de base de datos, API, parser y plantillas descargables de Excel, evitando que un caso herede incorrectamente el tópico restrictivo de una pregunta individual.
*   **Integración Completa con TinyMCE 6:** El campo de situación del caso cuenta con el editor profesional **TinyMCE** en modo oscuro, permitiendo:
    1.  **Tablas Visuales:** Creación de tablas complejas y pegado directo desde Microsoft Word o Excel (`Ctrl+V`), eliminando la necesidad de textareas HTML manuales.
    2.  **Imágenes y Gráficos:** Carga automática y pegado de imágenes en el cuerpo del texto con almacenamiento seguro en Google Cloud Storage (GCS).
*   **Tabla `case_scenarios` (Seguridad RLS):** Almacena `id`, `code` (único autogenerado si no se ingresa), `title`, `description_text` (opcional con soporte TinyMCE para tablas e imágenes), `image_url`, `domain`, `target`, `topic` (por defecto `'General'`).
*   **Encadenamiento Visual desde el Panel:**
    1.  El administrador selecciona 2 o más preguntas desde los checkboxes de la pestaña *Preguntas*.
    2.  Aparece el botón flotante **"🔗 Encadenar en Caso (# seleccionadas)"**.
    3.  Se abre el modal `link-case` donde se puede asignar o crear un caso y definir el orden relativo de cada pregunta (`case_order`: 1, 2, 3...).
    4.  Al guardar, las preguntas quedan vinculadas a `case_id` de forma atómica en una transacción PostgreSQL.
*   **Clustering Contiguo en Simulacros:** Los simulacros solicitan preguntas en lotes de 10. Si una pregunta pertenece a una casuística, el repositorio agrupa y trae todas sus preguntas hermanas juntas de manera contigua y ordenada, respetando la secuencia del caso.

---

## 4. 🎓 Módulo de Carreras y Cursos
Gestión de la malla curricular y su relación con el material de estudio.

*   **Carreras:** Clasificadas por Áreas (Salud, Ingeniería, etc.) con portadas personalizadas.
*   **Cursos:** 
    *   **Gestor de Unidades:** Permite estructurar el contenido en Unidades (I, II, III).
    *   **Asociación Inteligente:** Un curso se vincula a múltiples carreras y temas específicos.
*   **Temas:** Actúan como el "puente" que vincula los cursos con los recursos bibliográficos.

---

## 5. 👥 Módulo de Alumnos
Administración de la base de usuarios de la plataforma y control administrativo de membresías.

*   **Registro Admin y Autenticación Segura (Google OAuth):** Permite dar de alta alumnos manualmente vinculando su correo electrónico. Dado que la plataforma opera bajo una arquitectura de autenticación exclusiva mediante **Google OAuth**, el estudiante accede de forma instantánea y segura haciendo clic en *"Continuar con Google"*; no se requieren contraseñas locales ni links de reseteo manual.
*   **Buscador Rápido por Nombre y Correo Electrónico:** La barra de búsqueda (`admin-search-input`) cuenta con placeholder contextual (*"Buscar por nombre o correo..."*) y evalúa en tiempo real `data-name`, `data-email` y el contenido textual para localizar estudiantes instantáneamente sin recarga de página.
*   **Gestión Manual de Suscripciones (Campos de Plan y Fechas):** Al crear o editar a cualquier estudiante desde el modal del panel, el administrador puede modificar:
    *   **Nivel de Membresía:** `Gratuito (Free)`, `Plan Básico` o `Plan Avanzado`.
    *   **Estado de Suscripción:** `Inactivo`, `Activo` o `Expirado`.
    *   **Fecha de Expiración:** Selector tipo `date` para asignar el término exacto de la membresía.
*   **Cálculo Dinámico e Interactividad (Frontend):** 
    *   Al seleccionar **Plan Básico**, el sistema cambia automáticamente el estado a **Activo** y calcula el término sumando exactamente **2 meses** a la fecha actual.
    *   Al seleccionar **Plan Avanzado**, el sistema cambia automáticamente el estado a **Activo** y calcula el término sumando exactamente **4 meses** a la fecha actual (alineado con la política oficial de tarifas de 4 meses).
    *   Al seleccionar **Gratuito (Free)**, el sistema cambia automáticamente el estado a **Inactivo / Pending** y borra el campo de fecha de expiración.
    *   Si se cambia manualmente el estado de suscripción a **Expirado** o **Inactivo/Pending**, el sistema degrada automáticamente el Nivel de Membresía a **Gratuito (Free)** y borra la fecha de expiración.
*   **Reglas de Consistencia Blindadas (Backend):**
    *   Como red de seguridad, el backend (`adminService.js`) re-valida y fuerza la integridad de los datos: no se permiten estados inconsistentes (como un plan Premium con estado `pending` o un plan Free con estado `active`).
    *   Si el tier es Premium y no se proporciona fecha de expiración, el backend la calcula automáticamente (+2 meses para Básico y +4 meses para Avanzado).
*   **Auditoría Visual (Badges Dinámicos):** Cada tarjeta de alumno en la lista muestra badges distintivos:
    *   *Plan:* Gris para `FREE`, azul para `BASIC`, morado para `ADVANCED`.
    *   *Estado:* Verde para `ACTIVE`, rojo para `EXPIRED`, amarillo para `PENDING`.
    *   *Fecha:* Muestra la fecha exacta formateada en `es-ES` (ej: `📅 Expira: 25/12/2026`).
*   **Lógica de Fidelización (Reseteo Automático):** Cuando el administrador activa el estado de la suscripción a `'active'`, el backend (`adminService.js`) automáticamente restablece a `0` todas las vidas y cuotas de consumo diario/mensual del estudiante (`usageCount`, `dailyAiUsage`, `dailyRagUsage`, `dailySimulatorUsage`, `monthlyFlashcardsUsage`) e inicializa su última renovación para que inicie su membresía con el pool de recursos libre y limpio.

---

## 6. 🔄 Sincronización Masiva (Google Drive)
Optimización de la carga de bibliografía y guías clínicas mediante el escaneo de carpetas de Drive.

*   **Funcionamiento:** 
    *   Permite importar decenas de archivos (PDFs, Videos, Documentos) en un solo paso.
    *   **Identificador de Carpeta:** Se obtiene de la URL de Drive (ej: `https://drive.google.com/drive/folders/ID_AQUI`).
    *   **Lógica de Actualización:** Si agregas archivos nuevos a una carpeta ya sincronizada, el sistema los detecta e inserta sin duplicar los existentes (Upsert).
*   **Controles de Lote Pre-Sincronización (Switches iOS Modernos) 👑👁️⚡:**
    *   **Acceso Premium:** Configura todo el lote importado como contenido Premium con descuento de pases/vidas para usuarios gratuitos.
    *   **Visible al Público:** Permite activar o desactivar la visibilidad de todo el lote en los buscadores y catálogos de estudiantes al instante.
    *   **Apertura Inmersiva:** Si se activa, todos los archivos del lote sincronizado se configurarán para omitir la página de detalles y abrirse instantáneamente al hacer un clic en el visor modal.
*   **Persistencia de Miniaturas (GCS):** 
    *   **Generación Automática:** Durante el escaneo, el sistema descarga la miniatura de alta resolución de Drive.
    *   **Optimización WebP:** La imagen se procesa con Sharp para reducir su peso y se sube permanentemente al Bucket de Google Cloud Storage (`/thumbnails`).
    *   **Estabilidad:** Al estar guardadas en GCS, las miniaturas ya no dependen de la API de Drive para visualizarse, eliminando errores de carga (404) en el frontend.
*   **Atribución de Autor:** Permite definir un autor universal (ej: "MINSA", "AMIR") para todo el lote sincronizado.

---

## 7. 🛠️ Reglas de Operación (Resumen Técnico)
*   **Imágenes:** Portadas y miniaturas se optimizan a WebP y se guardan permanentemente en Google Cloud Storage (GCS) mediante `mediaController.js`. La carpeta local `assets/` del servidor solo almacena portadas y contenedores de la página principal estáticos por defecto (usados como fallback).
*   **KPI Financiero:** El panel estima ganancias basándose en la suscripción activa (s/ 9.90 mensual).
*   **Ofuscación de Enlaces:** Implementada para proteger la integridad de los recursos compartidos.

---

## 8. 🗑️ Acciones Masivas y Persistencia de Filtros
Para acelerar la curaduría y administración de recursos, se incorporaron controles de selección masiva y persistencia de estado UX.

*   **Borrado Masivo (Bulk Delete):**
    *   **Casillas de Selección:** Cada tarjeta de recurso (en todas las pestañas: Carreras, Cursos, Alumnos, Temas, Recursos, Preguntas) incluye un checkbox de selección.
    *   **Barra de Acciones Flotante:** Al seleccionar uno o más elementos, aparece una barra inferior `#admin-bulk-actions-bar` con el conteo de elementos seleccionados, la opción de deseleccionarlos todos o eliminarlos en bloque con confirmación previa.
    *   **Limpieza de GCS en Cascada:** Al eliminar masivamente recursos o preguntas, el backend purga automáticamente tanto sus archivos de portada/miniatura en el bucket de Google Cloud Storage (GCS) como cualquier imagen embebida dentro de su contenido HTML guardado por TinyMCE.
*   **Soporte de Selección en Rango (Shift + Click):**
    *   Los administradores pueden marcar un checkbox inicial y luego presionar la tecla `Shift` mientras hacen clic en otro checkbox posterior para seleccionar (o deseleccionar) de forma automática y masiva todos los elementos intermedios.
*   **Persistencia de Filtros y Búsqueda (Cero Reset de Inputs):**
    *   El buscador y los filtros de tipo y ordenamiento se almacenan en el estado global (`this.searchState` y `this.tabSortState`).
    *   Al guardar cambios tras editar, añadir nuevos ítems o refrescar la base de datos, el buscador ya no se borra. La vista se vuelve a filtrar de forma automática conservando las consultas de búsqueda y las selecciones de tipo/ordenamiento que el administrador tenía configuradas previamente.

## 9. 🎨 Sistema Visual Dual-Theme y Badges Semánticos de Alto Contraste (Agosto 2026)
Para asegurar legibilidad óptima tanto en **Modo Oscuro (Dark Matte)** como en **Modo Claro (Light Slate)**:
*   **Contraste y Nitidez en Modo Claro:** Se rediseñó el sistema de etiquetas (*pills*) `.admin-badge`, reemplazando colores pastel pálidos por tokens de contraste estricto (azul cobalto `#1d4ed8`, esmeralda `#047857`, índigo profundo `#4338ca`, violeta `#6d28d9`, cian `#0e7490` y carmesí `#b91c1c` en fondo claro; y sus variantes luminosas `#60a5fa`, `#34d399`, `#a5b4fc`, `#c084fc`, `#67e8f9` y `#f87171` en fondo oscuro).
*   **Diseño Tipográfico Limpio (Sin Sobrecarga de Iconos):** Siguiendo `DESIGN_SYSTEM.md`, se eliminaron iconos innecesarios dentro de cada badge para reducir la fatiga visual.
*   **Interruptor de Tema Global:** Integración de `#theme-toggle-btn` en el encabezado del panel de administración para alternar entre ambos modos al instante.
*   **Jerarquía en el Modal de Preguntas:** El bloque de asignación de **Casuística Agrupada / Caso Clínico (Opcional)** se ubica en la parte superior del formulario antes del cuerpo de la pregunta, permitiendo definir primero el contexto padre y el orden del ítem (`case_order`) de manera lógica y natural.

---
> [!IMPORTANT]
> Esta guía ha sido verificada contra el código fuente al 27 de agosto de 2026. Toda la arquitectura se mantiene desacoplada y validada en la suite de 29 tests unitarios (194 tests pasando).
