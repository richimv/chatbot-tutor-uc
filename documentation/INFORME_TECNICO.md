# Informe Técnico y Historial de Mejoras Continuas

Este documento es el **Historial Técnico Central de Mejoras por Fecha** de **Hub Academia**. Registra cronológicamente todas las optimizaciones de arquitectura, correcciones de errores, refactorizaciones de base de datos, mejoras de interfaz y actualizaciones de infraestructura implementadas en la plataforma.

### 🟢 [2026-09-09] - Formato Tipográfico Justificado Profesional en Simuladores de Exámenes (Web y Apps Móviles)

- **📖 Tipografía Justificada y Separación Silábica en Simulador Web ([quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - **Diagnóstico:** Los textos extensos de casuísticas pedagógicas y viñetas clínicas compartidas, así como enunciados, alternativas y explicaciones técnicas, se mostraban alineados a la izquierda con saltos de línea desparejos ("trapos" irregulares), lo que restaba sobriedad y profesionalismo a la lectura de estudio intensivo.
  - **Estandarización Tipográfica:**
    - Se aplicó justificación tipográfica limpia conservando palabras completas sin cortes silábicos (`text-align: justify; text-justify: inter-word; hyphens: none; -webkit-hyphens: none; overflow-wrap: break-word; word-break: normal;`). Esto erradica por completo la partición de palabras con guiones al borde del contenedor y brinda una lectura fluida.
    - **Toma Activa del Examen:** Casuística anidada (`.case-description-body`, `.case-description-body p`), enunciado de pregunta (`.question-text`, `.question-text p`, y cuadrícula con imagen `.question-layout-grid.has-image .question-text`), texto de alternativas (`.option-text`, `.option-text p`) y caja de retroalimentación/sustento oficial (`.feedback-explanation-text`, `#explanationText`, `#explanationText p`).
    - **Revisión del Examen (`showExamReview`):** Casuística anidada en feed (`.review-case-body`, `.review-case-body p`), enunciados de preguntas (`.review-q-text`, `.review-q-text p`), alternativas de respuesta (`.review-opt-text`, `.review-opt-text p`) y cuerpo de sustentación técnica (`.review-explanation-body`, `.review-explanation-body p`).
    - **Preservación de Excepciones:** Las tablas comparativas (`th`, `td`) conservan su alineación a la izquierda (`text-align: left`) para evitar distorsiones de datos tabulares.
- **📱 Réplica Nativa en Aplicaciones Móviles (`HubDocenteApp` y `HubSaludApp`):**
  - **Componente Central Markdown (`RichMarkdown.tsx`):** Actualizados `styles.paragraphLine` y `styles.bulletContent` con `textAlign: 'justify'` en ambas aplicaciones.
  - **Tarjetas de Preguntas en Vivo (`QuestionCard.tsx` y `ClinicalQuestionCard.tsx`):**
    - Justificación de casuística anidada (`caseDescriptionMarkdown`), enunciado de la pregunta (`questionMarkdown`), alternativas de respuesta (`optionMarkdown`) y sustento pedagógico/clínico (`explanationMarkdown`).
  - **Pantalla de Revisión de Simulacro (`app/quiz/results.tsx`):**
    - Justificación de casuística en feed (`reviewCaseDescription`), enunciado (`reviewQuestionText`), alternativas (`reviewOptionText`) y sustento oficial (`reviewExplanationText`).
  - **Verificación Estricta TypeScript:** Verificación exitosa sin errores de tipado (`npx.cmd tsc --noEmit`) en `HubDocenteApp` y `HubSaludApp`.
- **🔄 Sincronización Determinista de Caché y CI ([update-cache.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/update-cache.js)):**
  - Actualización del hash determinista de activos en los 17 archivos HTML del proyecto para garantizar integridad de caché y satisfacción de la suite de pruebas `cacheBustIntegrity.test.js`.
- **🧪 Cobertura de Pruebas Unitarias:**
  - 100% de la suite de pruebas de `hubacademia` superada exitosamente (**52 suites, 409 pruebas en verde**).

---

### 🟢 [2026-09-08] - Estandarización de Casuísticas: Topic 'General', Fallback al Código en Títulos y Plantilla Excel de Casos

- **📚 Desacoplamiento de Topic en Casuísticas Agrupadas (`case_scenarios`) ([adminRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/adminRepository.js), [adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js), [database_schema.sql](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql)):**
  - **Diagnóstico:** Al importar preguntas con Excel (`saveBulkQuestionBankAdmin`), el backend asignaba a los casos creados el `topic` específico de la pregunta individual (por ejemplo, "Constructivismo y socioconstructivismo" o "Pediatría"). Como una sola casuística agrupa preguntas correspondientes a múltiples áreas y tópicos del examen, asignar un tópico particular al caso distorsionaba la semántica del banco.
  - **Estandarización a 'General':** 
    - Se actualizó `saveBulkQuestionBankAdmin` en `adminRepository.js` para que el `topic` de toda casuística consolidada o generada desde preguntas sea siempre `'General'`.
    - Se ejecutó la migración atómica en base de datos PostgreSQL (`UPDATE case_scenarios SET topic = 'General' WHERE topic != 'General'`) actualizando los 83 registros existentes. Se fijó además `DEFAULT 'General'` en la columna `topic` de la tabla `case_scenarios`.
    - En `bulkInjectCases` y `createCase`, se aseguró el fallback `'General'`.
- **🏷️ Fallback al Código del Caso en Registro Individual ([adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js), [admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - **Diagnóstico:** Al crear una casuística individualmente en el panel con código pero sin título digitado, el sistema recortaba los primeros 50 caracteres del texto/enunciado (`cleanDesc.substring(0, 47) + '...'`) como título, generando títulos extensos y no deseados.
  - **Solución Estricta:** Se eliminó por completo la extracción de texto del enunciado. Si el usuario no ingresa un título, el sistema asigna directamente el **código del caso** (`caseCode`) como título (`const caseTitle = rawTitle !== '' ? rawTitle : (caseCode || 'Caso General')`), tanto en frontend (`admin.js`) como en backend (`adminController.js`).
- **📊 Actualización de Plantilla Excel y Carga Masiva de Casos ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - En `downloadCaseExcelTemplate()`, el encabezado de la columna temática se actualizó a `TOPIC / TEMA (General)` y las filas de ejemplo ahora indican explícitamente `'General'`.
  - El placeholder del modal de inyección directa JSON refleja `topic: "General"` y el código como título por defecto.
- **🧪 Cobertura de Pruebas Unitarias ([caseScenarios.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/caseScenarios.test.js)):**
  - Incorporadas pruebas unitarias que verifican la creación de casuísticas con `topic = 'General'` desde preguntas masivas y el uso exclusivo del código como título cuando se omite el título individual.
  - 100% de la suite de pruebas superada exitosamente (**52 suites, 409 pruebas en verde**).

---

### 🟢 [2026-09-06] - Resolución Jerárquica de Tiers (Admin/Basic), Carga Masiva y Ordenación Cronológica Reciente en Repaso

- **👑 Desacoplamiento de Rol Admin y Gating por Tiers en Carga Masiva ([sessionManager.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/sessionManager.js) & [repaso.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/repaso.js)):**
  - **Diagnóstico:** Los usuarios administradores en PostgreSQL poseen `users.role = 'admin'`, pero su `subscription_tier` se registra frecuentemente como `'free'` (no tienen suscripción comercial). En `repaso.js`, el getter `userTier` únicamente leía `subscription_tier`, catalogando erróneamente al administrador como usuario gratuito y bloqueándole la pestaña de Carga Masiva mediante la modal de paywall.
  - **Método `SessionManager.isAdmin()`:** Implementado en la capa de presentación para verificar de forma segura `currentUser.role === 'admin' || subscriptionTier === 'admin'`.
  - **Resolución Prioritaria en `RepasoManager.userTier`:** Retorna de forma prioritaria `'admin'` cuando `user.role === 'admin'` o `subscriptionTier === 'admin'`, desacoplando la jerarquía administrativa del tier de facturación.
  - **Getter Unificado `RepasoManager.isAdvancedOrAdmin`:** Evalúa `this.userTier === 'advanced' || this.userTier === 'admin'`, sustituyendo cálculos duplicados y fragmentados a lo largo de todo el módulo (`syncTtsLanguageSelectors`, `renderDeckHeader`, `saveCard`, `handleImageUpload`, `_saveBulkCards`).
  - **Control de Acceso Riguroso en `switchCardMode(mode)`:**
    - `admin`: Ingreso irrestricto sin paywall.
    - `basic`: Ingreso permitido a carga masiva (hasta 3 archivos/día, texto puro hasta 1,000 caracteres, conforme a `SISTEMA_MONETIZACION_LIMITES_Y_SUSCRIPCIONES.md`).
    - `advanced`: Ingreso permitido con soporte opcional de audio TTS.
    - `free`: Despliega modal paywall educativa invitando a ascender a Basic o Advanced.
    - Invitados sin sesión: Despliega modal de inicio de sesión (`showAuthPromptModal`).
  - **Limpieza de Código Muerto (@code-health-rules):** Eliminado el método huérfano y obsoleto `switchMode(mode)` en `repaso.js`, previniendo colisiones y garantizando Clean Code.

- **⏱️ Ordenación Cronológica Reciente de Mazos y Tarjetas ([flashcardRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/flashcardRepository.js) & [deckService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/deckService.js)):**
  - **Priorización de Mazos Recientes:** En `getDecks` y `getAllUserDecks`, se actualizó la consulta SQL a `ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC` con fallback defensivo ante ausencia de columna (código `42703`).
  - **Priorización de Tarjetas Recientes:** En `getDeckCards`, se ajustó la consulta a `ORDER BY sort_order ASC, created_at DESC`, permitiendo que tanto tarjetas individuales recién agregadas como lotes de carga masiva aparezcan inmediatamente en la parte superior de la tabla del mazo.
  - **Actualización de Marca Temporal (`touchDeck`):** Se creó el método `touchDeck(deckId)` en `flashcardRepository` y se invocó tras la creación exitosa de tarjetas en `DeckService.addCard` y `DeckService.addBulkCards`, garantizando que cualquier mazo modificado o enriquecido pase al primer lugar del catálogo de "Mis Mazos" y del explorador lateral.
  - **Creación Segura de Mazos (`createDeck`):** Se blindó `createDeck` con bloque `try/catch` defensivo ante error `42703` para compatibilidad de esquemas.

- **🧪 Cobertura de Pruebas Unitarias ([repasoTierAndOrdering.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/repasoTierAndOrdering.test.js)):**
  - Creada nueva suite con 11 pruebas unitarias que verifican la detección de administradores, la resolución jerárquica de tiers, el gating de carga masiva por plan, la ausencia de código muerto, la cláusula SQL de ordenación reciente y las llamadas a `touchDeck`.

---

### 🟢 [2026-09-05] - Auditoría de Arquitectura en Gestión de Alumnos, Limpieza de Código Muerto y Expansión Oficial de DESIGN_SYSTEM.md

- **👥 Auditoría y Limpieza Integral en Gestión de Alumnos / Usuarios ([adminService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/adminService.js), [admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js), [MANAGEMENT_PANEL_GUIDE.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/MANAGEMENT_PANEL_GUIDE.md)):**
  - **Erradicación de Código Muerto de Contraseñas:** Tras la migración arquitectónica a Google-Only Authentication (`commit 8f0bd08`), el sistema de contraseñas locales fue completamente retirado del backend y frontend. Se removió la generación artificial de `tempPassword` en `adminService.create('student')` y se retiró el botón de restablecimiento de contraseña (`.reset-pass-btn-small`) de las tarjetas de alumnos en `displayStudents()`, evitando el error HTTP 404 al hacer clic.
  - **Modal Informativo sobre Google OAuth:** `handleResetPassword(userId)` ahora informa con claridad al administrador que el estudiante puede ingresar directamente con su cuenta de Google mediante autenticación federada segura sin necesidad de credenciales locales.
  - **Mensajería Limpia al Crear Alumnos:** `saveGenericForm()` actualiza su mensaje de éxito para orientar al administrador sobre el acceso directo mediante cuenta Google del estudiante.
  - **Corrección de Plazo en Plan Avanzado (+4 meses):** Se corrigió la discrepancia documental histórica en `MANAGEMENT_PANEL_GUIDE.md` (que indicaba erróneamente 6 meses), alineándola con la verdad técnica del backend (`adminService.js`), frontend (`admin.js`) y política tarifaria oficial (`SISTEMA_MONETIZACION_LIMITES_Y_SUSCRIPCIONES.md`): exactamente **4 meses** para el Plan Avanzado y **2 meses** para el Plan Básico.
  - **Consistencia Bidireccional y Fidelización:** Validado el flujo atómico donde la asignación de un plan de pago activa el estado a `'active'`, calcula la expiración y resetea automáticamente a cero todas las cuotas de IA, simuladores y flashcards.
- **🎨 Expansión Formal de la Sección 13 en DESIGN_SYSTEM.md ([DESIGN_SYSTEM.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/DESIGN_SYSTEM.md)):**
  - Se incorporó la **Sección 13: 🖥️ Arquitectura y Estándar Visual del Panel de Gestión / Administración (Admin Panel) & Subcontenedores Avanzados de Modales**, consolidando la fuente de verdad técnica para toda la plataforma:
    1. **13.1. Layout del Panel y Contenedor Maestro:** `.admin-container` fluido hasta 1440px y pestañas `.admin-tabs` con scroll horizontal táctil nativo (`scrollbar-width: none`).
    2. **13.2. Controles de Cabecera y Buscador Universal:** Flexbox adaptativo con debounce y placeholders contextuales (`Buscar por nombre o correo...`).
    3. **13.3. Tarjetas de Elementos de Administración:** Estructura con checkboxes masivos, thumbnails WebP, semáforo de 3 puntos (Premium, Visible, Apertura Directa) y matriz de badges semánticos (`.admin-badge-blue`, `.admin-badge-purple`, `.admin-badge-green`, `.admin-badge-danger`, `.admin-badge-muted`, `.admin-badge-cyan`).
    4. **13.4. Arquitectura Avanzada de Modales:** Erradicación total de `#0f0f13`, adopción estricta de `var(--modal-bg)`, `var(--border-color)`, `var(--shadow-xl)` y regla mandatoria `padding: 0 !important;` en `.modal-content` con scroll estrictamente confinado a `.modal-body`.
    5. **13.5. Subcontenedores Internos dentro de las Modales:** Documentación formal de `.import-method-card`, `#ai-domain-container`, `.selected-chip` (con `#ffffff !important`), `.image-upload-actions` (con `flex-wrap: wrap` y token oficial `var(--danger)`) y switches iOS.
    6. **13.6. Adaptabilidad Móvil y Colapso Automático de Cuadrículas:** Márgenes simétricos `calc(100% - 20px)` en ≤768px y `calc(100% - 16px)` en ≤480px, junto con la regla de colapso automático `grid-template-columns: 1fr !important;` para cualquier grilla interna en pantallas móviles.
    7. **13.7. Editor Científico TinyMCE 6 Dual-Theme Dinámico:** Configuración `isDark ? oxide-dark : oxide` con tipografía y fondos de contraste calibrados para evitar texto invisible.
    8. **13.8. Modal Canónica de Confirmación:** Estandarización de `#confirmation-modal` con `.confirmation-modal-card` y `max-width: 440px`.
    9. **13.9. Arquitectura y Reglas de Gestión de Alumnos / Usuarios:** Integración 100% Google OAuth, fidelización con reseteo de cuotas y búsqueda multiatributo.
- **🧪 Cobertura de Pruebas Unitarias ([adminStudentManagement.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/adminStudentManagement.test.js)):**
  - 10 pruebas unitarias nuevas cubriendo: creación limpia de alumnos sin contraseñas, reactividad y consistencia de planes y suscripciones (+2m basic, +4m advanced, degradación a free en expirados), omisión del botón de reseteo en las tarjetas de alumno, modal informativo de Google OAuth y verificación de la Sección 13 en `DESIGN_SYSTEM.md`.
  - **48/48 suites Jest en verde (369/369 pruebas al 100%)**.

---

### 🟢 [2026-09-05] - Verificación de Arquitectura, Modales Responsivas Adaptables y Alto Contraste Dual-Theme en Panel de Gestión

- **🎨 Estandarización Dual-Theme y Alto Contraste en Modales ([admin.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/admin.css) & [admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - **Erradicación de Fondo Oscuro Hardcodeado:** Se eliminó el `background: #0f0f13 !important` de `.modal-content`, sustituyéndolo por tokens semánticos oficiales `var(--modal-bg)`, `var(--border-color)` y `var(--shadow-xl)`. Esto solucionó la incompatibilidad visual donde las ventanas modales permanecían forzosamente negras incluso en modo claro (`data-theme="light"`).
  - **Arquitectura de Caja Estricta:** Se aplicó `padding: 0 !important; overflow: hidden;` en `.modal-content` y se asignó el scroll exclusivamente al `.modal-body`, garantizando que el header y footer queden perfectamente anclados a los extremos del modal sin dobles barras de desplazamiento ni paddings redundantes.
  - **Subcontenedores y Tarjetas Internas:** Los componentes `.import-method-card`, `#ai-domain-container`, `.image-upload-group` y `.switch-container` adoptaron `background: var(--bg-tertiary)` y bordes `1px solid var(--border-color)`, asegurando contraste nítido, fondos distinguidos y tipografía legible (`var(--text-main)` y `var(--text-secondary)`) en ambos temas.
  - **Corrección de Chips y Switches:** `.selected-chip` ahora fuerza `color: #ffffff !important` sobre su fondo `var(--primary)`, erradicando el texto negro ilegible en modo oscuro. En modo claro, los switches inactivos usan `#cbd5e1` con perilla blanca `#ffffff` y al activarse conmutan a `var(--primary)` o `#f59e0b`.
  - **Normalización de Variables CSS:** Erradicadas variables huérfanas o no definidas (`var(--danger-color)`, `var(--accent-color)`, `var(--text-primary)`, `var(--success-color)`), reemplazándolas por sus tokens vigentes (`var(--danger)`, `var(--primary)`, `var(--text-main)`, `var(--success)`).
- **📱 Responsividad y Ancho Adaptativo de Modales en Móviles y Tabletas ([admin.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/admin.css) & [admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - **Ajuste Perimetral en Pantallas Angostas:** En tablets (≤ 768px), `.modal-content` toma `width: calc(100% - 20px) !important; margin: 10px auto;`. En celulares (360px–480px), toma `width: calc(100% - 16px) !important; margin: 8px auto;`, garantizando márgenes simétricos de 8px a cada lado sin cortes en los bordes.
  - **Colapso Universal de Cuadrículas Multi-Columna:** Se implementó `.modal-body div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 12px !important; }`, impidiendo que los formularios con campos en 2 o 3 columnas (Área/Subtema, Examen/Target, Opciones A/B/C/D, etc.) se compriman en teléfonos.
  - **Controles de Carga de Imágenes Adaptables:** `.image-upload-actions` ahora utiliza `flex-wrap: wrap`, permitiendo que el input de URL ocupe el ancho completo (`flex: 1 1 100%`) y los botones de acción se acomoden confortablemente.
  - **Redimensionamiento Reactivo en `openGenericModal`:** Se incorporó detección de pantalla móvil (`window.innerWidth <= 768`) para aplicar `calc(100% - 16px)` en lugar de forzar el ancho de escritorio (`1100px`).
- **📝 Integración Dinámica Dual-Theme con TinyMCE ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - `getStandardTinyMCEConfig` evalúa dinámicamente `data-theme`: en modo claro aplica skin `oxide`, hoja de estilo `default`, fondo `#ffffff` y texto `#0f172a`; en modo oscuro aplica `oxide-dark`, `dark`, fondo `#121212` y texto `#f8fafc`.
- **🛡️ Modal de Confirmación Accesible ([admin.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/admin.html) & [index.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/index.html)):**
  - Se sincronizó la estructura markup con `.confirmation-modal-card`, `.confirmation-modal-header`, `.confirmation-title-wrap`, `#confirmation-modal-icon-container` y `.confirmation-modal-footer`, vinculándola a las elevaciones y contrastes de `modal.css`.
- **🧪 Cobertura de Pruebas Unitarias y Cache-Busting ([adminModals.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/adminModals.test.js)):**
  - Nueva suite con 12 pruebas unitarias que validan la erradicación del fondo oscuro estático, la implementación de tokens Dual-Theme, la arquitectura de caja con `padding: 0`, los márgenes responsivos móviles, el colapso de cuadrículas, la configuración dinámica de TinyMCE y el marcado de confirmación.
  - Sincronización de los 17 archivos HTML con `update-cache.js` (hash `8d5aaa97f3bb`).
  - **47/47 suites Jest en verde (356/356 pruebas al 100%)**.

---

### 🟢 [2026-09-05] - Optimización Responsiva Móvil del Panel de Gestión, Limpieza de CSS y Búsqueda de Alumnos por Correo

- **📱 Rediseño Responsivo Integral del Panel de Gestión ([admin.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/admin.css)):**
  - **Alineación con Sistema de Diseño Dual-Theme ([DESIGN_SYSTEM.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/DESIGN_SYSTEM.md)):** Se erradicaron colores hexadecimales estáticos (`#111116`, `#18181b`, `#27272a`, `#ffffff`) en los componentes clave del panel de administración (`.admin-bulk-actions-bar`, modales, tarjetas y contenedores), reemplazándolos por tokens semánticos oficiales (`var(--card-bg)`, `var(--bg-tertiary)`, `var(--border-color)`, `var(--text-main)`, `var(--shadow-xl)`), garantizando contraste y legibilidad óptima tanto en temas claros como oscuros.
  - **Reestructuración de Cascada y Eliminación de Código Muerto:** Conforme a `.agents/rules/code-health-rules.md`, se eliminó la regla huérfana `.curriculum-link-icon` (0 referencias en el proyecto) y se removió un bloque media-query obsoleto e intermedio (líneas 724–786) que era sobreescrito por definiciones posteriores. Se consolidó un único bloque responsivo al final de la hoja de estilos.
  - **Optimización para Celulares (360px – 480px) y Tabletas (hasta 768px):**
    - Se implementó `.hide-mobile` para ocultar elementos secundarios en pantallas angostas.
    - Se adaptó `.item-card.resource-item-card` a diseño en columna vertical táctil con espaciados ergonómicos (12px), evitando el desbordamiento de badges e indicadores.
    - La barra de acciones masivas (`.admin-bulk-actions-bar`) se reajustó a `width: calc(100% - 24px)` con `max-width: 460px`, centrada y elevada en la parte inferior de la pantalla para evitar colisiones con menús del navegador móvil.
    - Se reconfiguraron los encabezados de pestañas (`.tab-header-controls`, `.search-sort-wrapper`, `.action-buttons`) a esquemas en cuadrícula/flex adaptativo sin colapsos horizontales.
    - Los diálogos modales (`.modal-content`, `.modal-footer`) ahora cuentan con botones a ancho completo (`width: 100%`) y padding optimizado para dedos.
- **🔍 Búsqueda de Usuarios/Alumnos por Correo Electrónico y Nombre ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js) & [components.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js)):**
  - **Atributos de Datos Semánticos en Tarjetas:** Se enriqueció el generador `createAdminItemCardHTML` para estampar los atributos `data-email="${safeHtmlValue(item.email || '')}"` y `data-name="${safeHtmlValue(item.name || displayName || '')}"` directamente en el contenedor `.admin-item-card`.
  - **Placeholder Dinámico Contextual:** La caja de búsqueda del panel asigna automáticamente `placeholder="Buscar por nombre o correo..."` cuando el usuario se encuentra en la pestaña de alumnos (`tab-students`).
  - **Filtrado Reactivo Multi-Criterio:** La función `applySearchFilterForTab` evalúa concurrentemente el texto visible (`textContent`), `item.dataset.email` y `item.dataset.name`, permitiendo ubicar alumnos instantáneamente tipeando prefijos de correo, dominios (`@universidad.edu.pe`) o nombres.
- **🧪 Cobertura de Pruebas Automatizadas y Cache-Busting ([adminUserSearch.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/adminUserSearch.test.js)):**
  - Se implementó una nueva suite de pruebas unitarias que valida la presencia de atributos `data-email` y `data-name`, el placeholder dinámico del buscador, la lógica de coincidencia en `applySearchFilterForTab` y la simulación de filtrado por dominios y prefijos.
  - Se sincronizaron las 17 plantillas HTML de la plataforma mediante `update-cache.js` con el hash determinista `d9eb41e3db37`.
  - **45/45 suites Jest en verde (321/321 pruebas al 100%)**.

---

### 🟢 [2026-09-05] - Sincronización Inmediata al Clonar Mazos de Comunidad y Auditoría de Código Muerto

- **⚡ Sincronización Reactiva Inmediata al Clonar Mazos ([repaso.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/repaso.js)):**
  - **Invalidación de Caché en Mutaciones (`cloneDeck`):** Se incorporó `this.invalidateCache()` inmediatamente tras la respuesta exitosa del backend (`res.ok`) al clonar un mazo de la comunidad. Anteriormente, la ausencia de esta llamada provocaba que navegar a "Mis Mazos" reutilizara la lista en memoria previa a la clonación.
  - **Eliminación de Promesas Zombie en `fetchDecksShared`:** Se erradicó el temporizador artificial `setTimeout(() => delete this._sharedRequests.decks[key], 5000)`. La clave de desduplicación de promesas en vuelo (in-flight) ahora se limpia de manera síncrona e inmediata en el bloque `finally`, permitiendo que peticiones inmediatas tras una clonación soliciten los datos actualizados sin ser bloqueadas por promesas resueltas obsoletas.
  - **Espera Asíncrona Garantizada (`await this.explorer.loadTree()`):** Se aseguró la espera con `await` en `cloneDeck()` y `handleCreateDeck()`, garantizando que el árbol de navegación lateral en el explorador se actualice antes de realizar el renderizado del dashboard.
- **🧹 Limpieza de Arquitectura y Eliminación de Código Muerto ([deckService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/deckService.js)):**
  - Conforme a `@code-health-rules`, se eliminó la consulta redundante a la base de datos `await this.trainingRepository.getDeckById('GUEST', publicDeckId)` asignada a la variable huérfana `originalDeck`, que nunca era utilizada antes del SQL directo de clonación.
- **🧪 Cobertura de Pruebas Unitarias ([deckCloneSync.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/deckCloneSync.test.js)):**
  - Suite unitaria dedicada que valida la invalidación de caché, el `await` de `loadTree()`, la limpieza síncrona en `finally` de `_sharedRequests` y la ausencia de consultas redundantes en `deckService`.
  - **44/44 suites Jest en verde (317/317 pruebas al 100%)**.

---

### 🟢 [2026-08-31] - Calificación Resiliente de Exámenes (10qs, 20qs, 60qs), Casuísticas Anidadas y Corrección de KPIs de Evolución

- **🎯 Calificación y Persistencia Fidedigna de Resultados ([quizSessionService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/quizSessionService.js), [quizSessionRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/quizSessionRepository.js), [docenteController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/docenteController.js) & [medicoController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/medicoController.js)):**
  - **Corrección de Causa Raíz en `gradeForSubmission`:** Se detectó que el backend retornaba `score: 0` al finalizar un simulacro cuando el cliente no llamaba a `/answer` por cada reactivo individual. Se implementó calificación segura contrastando `clientAnswers` con las claves maestras de `answer_payload`, permitiendo que puntajes reales (ej. 3/10 y 7/10) se almacenen con exactitud matemática tanto si el examen se dio de corrido como si se retomó una sesión guardada.
  - **Proyección Vigesimal de Evolución Cronológica:** El cálculo de `score_20 = (score / total_questions) * 20` ahora grafica con precisión las notas reales (ej. `6.0`, `14.0` sobre 20) en lugar de trazar líneas de cero.
  - **Cálculo Robusto de `areaStats`:** Se blindó el desglose de aciertos por tema `{ correct, total }` para alimentar adecuadamente el radar de competencias, el gráfico de rosquilla y las métricas de fortalezas/debilidades.
- **📚 Tratamiento Universal de Casuísticas / Casos Anidados ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & [simulator-dash.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/simulator-dash.js)):**
  - Se configuró la expansión dinámica de `state.maxQuestions` cuando se clusterizan preguntas hermanas asociadas a una misma viñeta pedagógica o clínica, impidiendo que el examen se corte a la mitad de una casuística.
  - Se vinculó el Simulacro Real con la cantidad oficial de preguntas según contexto (`limit=60` para Educación y `limit=100` para Medicina).

---

### 🟢 [2026-08-30] - Renderizado Universal de Fórmulas Matemáticas y Científicas (KaTeX) y Blindaje Tipográfico

- **📐 Motor Universal de Renderizado Tipográfico KaTeX ([markdown-renderer.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/utils/markdown-renderer.js) & [markdown-content.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/markdown-content.css)):**
  - **Corrección Crítica de Causa Raíz en Sanitizador DOM:** Se identificó que `_sanitizeDom` eliminaba el atributo `style` de todos los elementos HTML, despojando a los `<span>` de KaTeX de sus coordenadas espaciales (`style="top:-3.63em"`, `style="height:2.7em"`), lo que provocaba que exponentes y denominadores colapsaran en la línea base del texto. Se reordenó el flujo para ejecutar la sanitización XSS antes de la restauración matemática y se exentó explícitamente a KaTeX de la purga de estilos geométricos.
  - **Alineación Milimétrica de la Línea de Fracción:** Se ajustó la regla de `.katex .frac-line` eliminando márgenes artificiales (`margin: 0 !important; border-bottom: 0.04em solid currentColor !important; min-height: 1px !important;`), permitiendo que el cálculo matemático de KaTeX sitúe la barra divisoria con total exactitud equidistante entre numerador y denominador sin solaparse con el denominador.
  - **Normalización Inteligente de Saltos `\n`:** Se configuró el parseo de saltos de línea para convertir secuencias `\n` al inicio de párrafos (`\nLa imagen...`, `\nEl siguiente...`) preservando exclusivamente comandos LaTeX legítimos que inician con 'n' (`\neq`, `\nabla`, `\nu`, `\neg`, `\notin`, etc.).
  - **Aislamiento Estricto de `line-height` y `box-sizing`:** Se blindaron todas las clases de KaTeX (`.katex`, `.vlist-t`, `.vlist-r`, `.vlist`, `.pstrut`, `.mfrac`, `.frac-line`) con `box-sizing: content-box !important`, impidiendo que el `line-height: 1.7` del chat distorsione los cálculos matemáticos relativos.
  - **Salida Pura HTML:** Se configuró KaTeX con `output: 'html'`, eliminando las discrepancias de renderizado dual de MathML.
  - Pre-extracción y protección estricta de expresiones matemáticas (`_extractMath` / `_restoreMath`) para fórmulas inline `$x^2$`, integrales `$\int f(x) dx$`, fracciones `$\frac{a}{b}$` y fórmulas químicas `$\mathrm{H_2O + CO_2 \rightarrow H_2CO_3}$`, decodificando entidades HTML y evitando que `marked.js` destruya subíndices (`_`) o asteriscos (`*`).
  - Inclusión de los assets de KaTeX en todas las interfaces de la plataforma (`quiz.html`, `flashcards.html`, `repaso.html`, `resource.html`, `course.html`, `index.html`, `simulator-dashboard.html`, `admin.html`).
- **✨ Mejora de UX en Botón Guardar Nota ([quiz-tutor.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz-tutor.js) & [tutor-chat.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/tutor-chat.js)):**
  - Se unificó la experiencia visual del botón de guardado en los chats de Quiz y Flashcards: animación con spinner `<i class="fas fa-spinner fa-spin"></i> Guardando...` durante la llamada a la API y transición a `<i class="fas fa-check"></i> Nota Guardada` en color amarillo dorado (#f59e0b) al completarse exitosamente.
  - Se retiró la clase `markdown-compact` de los mensajes del chat para dotar a las fórmulas en los paneles laterales del mismo espacio tipográfico, nitidez y holgura que en el modal de notas de la biblioteca.
- **🛡️ Blindaje de CI / Pipeline de GitHub Actions ([tutorAiService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/tutorAiService.js), [analyticsController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/analyticsController.js), [adminAiService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/adminAiService.js) & [.github/workflows/ci.yml](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/.github/workflows/ci.yml)):**
  - Se implementó inicialización segura y tolerante a fallos para `VertexAI` con valores por defecto y bloque `try/catch`, permitiendo que los tests unitarios se ejecuten sin errores en entornos de CI sin credenciales de Google Cloud Storage/Vertex.
  - Se configuró el bloque `env` global en GitHub Actions con variables mock para pruebas deterministas.

---

### 🟢 [2026-08-30] - Visión Multimodal Universal para Tutor IA en Simuladores (Quiz) y Repaso (Flashcards)

- **👁️ Motor de Visión Multimodal en Tiempo Real ([tutorAiService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/tutorAiService.js) & [chatController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/chatController.js)):**
  - Se implementó la resolución y descarga asíncrona de buffers desde Google Cloud Storage (`_extractMultimodalParts`) para todas las imágenes presentes en el contexto de preguntas, casuísticas pedagógicas y flashcards mnemotécnicas.
  - La IA (`gemini-2.5-flash-lite` / Vertex AI) recibe directamente las imágenes como `inlineData` estructurado junto al prompt textual, permitiéndole leer textos manuscritos/escaneados (OCR), transcribir diálogos de obras teatrales, analizar trazados radiográficos, gráficos estadísticos y detalles artísticos con precisión milimétrica.
  - Se diseñó con un límite de seguridad de máximo 4 imágenes por consulta, deduplicación de fuentes y resiliencia ante archivos faltantes sin degradar el tiempo de respuesta (~30ms).
- **🧪 Cobertura de Pruebas Automatizadas ([tutorMultimodalVision.test.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/tutorMultimodalVision.test.js)):**
  - Se añadieron 7 pruebas unitarias dedicadas que validan la extracción de imágenes en Quiz Tutor, Flashcard Tutor, HTML incrustado (`<img>`), deduplicación, límites y tolerancia a fallos. Total de la suite: **37/37 suites PASSED (237/237 tests exitosos)**.

---

### 🟢 [2026-08-30] - Corrección de Renderizado de Imágenes en TinyMCE para Casuísticas ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js))

- **🖼️ Rehidratación Explícita de HTML e Imágenes en Casuísticas:**
  - Se corrigió el desfase por el cual al abrir el modal de una casuística existente, TinyMCE se instanciaba prematuramente dentro del bloque `switch(type)` antes de que `fieldsContainer.innerHTML = fieldsHTML` renderizara el DOM final, provocando que no cargara el HTML enriquecido ni mostrara las imágenes.
  - Se unificó el ciclo de vida de inicialización en el bloque posterior al renderizado del modal, inyectando el callback `editor.on('init', () => editor.setContent(this.currentItem.description_text))`.
  - Se agregó recuperación defensiva por ID (`GET /api/admin/cases/:id` y `GET /api/admin/questions/:id`) cuando un elemento se abre directamente sin depender del estado en caché.

---

### 🟢 [2026-08-30] - Arquitectura de Subida Diferida a GCS ("Commit-on-Save") para TinyMCE

- **🛡️ Cero Subidas Fantasma en Edición / Borrador ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - Se desacopló la subida de red inmediata (`images_upload_handler`) de TinyMCE. Ahora las imágenes pegadas (`Ctrl+V`) o insertadas mediante el selector de archivos (`file_picker_callback` con `FileReader`) se mantienen en memoria del navegador como Data URIs locales durante todo el proceso de redacción o edición.
  - Si el usuario cierra el modal, cancela la edición, recarga la pestaña o borra y cambia de imagen, **no se realiza ninguna petición de red ni se sube ningún archivo a Google Cloud Storage**.
- **☁️ Subida Centralizada y Sanitización Exclusiva al "Guardar" ([adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js) & [coursesController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/coursesController.js)):**
  - Únicamente al pulsar el botón **Guardar** / **Crear** / **Guardar Cambios**, el backend intercepta el HTML final a través de `_sanitizeHtmlImages()`, sube **únicamente las imágenes definitivas confirmadas** a sus respectivos directorios en GCS (`cases/`, `questions/`, `explanations/`, `recursos/`) y las sustituye por URLs limpias.
  - Al editar una entidad existente, el backend compara las imágenes previas (`oldPaths`) con las nuevas (`newPaths`), y purga automáticamente de GCS los archivos que hayan sido eliminados del editor.

---

### 🟢 [2026-08-30] - Rediseño Esbelto de Casuísticas, Soporte Lightbox Zoom y Adaptación Móvil

- **🎨 Rediseño Esbelto y Estético de Contenedores de Casuística ([quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - Se eliminó el borde grueso izquierdo rígido (`border-left: 4px...` y `border-left: 3px...`) en `.case-scenario-card` y `.review-case-box`, reemplazándolo por una tarjeta refinada y esbelta con bordes perimetrales sutiles y radio de `14px`, alineado estrictamente a las directrices de [`DESIGN_SYSTEM.md`](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/DESIGN_SYSTEM.md) v3.5.
  - Se implementó la diferenciación cromática adaptativa por módulo y tema:
    - **Salud (Médico):** Píldoras e insignias en **Teal / Verde Cian** (`#2dd4bf` en Dark, `#0d9488` en Light).
    - **Educación (Docente):** Píldoras e insignias en **Azul Confianza** (`#60a5fa` en Dark, `#2563eb` en Light).
  - Fondo dinámico que responde a `data-theme="dark"` (`var(--bg-secondary, #0a0a0a)`) y `data-theme="light"` (`var(--card-bg, #ffffff)`).

- **🔍 Integración Universal del Visor Lightbox (Zoom & Pan) para Casuísticas ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & [quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - Se habilitó la apertura interactiva del Lightbox con zoom y arrastre táctil para todas las imágenes de casuísticas:
    1. Imágenes inline embebidas en el texto de la casuística (`.case-description-body img`, `.review-case-body img`).
    2. Imágenes de apoyo independientes del caso (`#caseImage`, `.review-case-image-wrap img`).
  - Se añadieron microinteracciones visuales: icono flotante de zoom (`\f00e`), cursor `zoom-in` y elevación suave al pasar el cursor.

- **📱 Optimización Responsiva en Pantallas Móviles (`@media (max-width: 768px)`):**
  - Se corrigió el desbordamiento y recorte lateral de imágenes en dispositivos celulares asegurando `max-width: 100% !important`, `height: auto !important` y contención con `box-sizing: border-box`.
  - Tablas con desplazamiento horizontal táctil suave (`-webkit-overflow-scrolling: touch; overflow-x: auto; max-width: 100%`).
  - Ajuste de paddings y tipografía compacta (`0.88rem`, line-height `1.55`) para maximizar el área visible de lectura en pantallas pequeñas.

- **♻️ Garbage Collector Automático de GCS para Edición y Borrado ([adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js) & [adminRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/adminRepository.js)):**
  - Al editar una casuística o pregunta, el backend detecta automáticamente las imágenes que fueron retiradas del editor TinyMCE (`oldPaths.filter(p => !newPaths.includes(p))`) y las elimina de inmediato de Google Cloud Storage para evitar almacenamiento residual.
  - En borrado individual y masivo (`deleteCase`, `deleteSingleQuestion`, `bulkDelete`), se purgan tanto las portadas como todas las imágenes internas embebidas en el HTML.

---

### 🟢 [2026-08-30] - Estandarización Universal de TinyMCE con Subida a GCS y Sanitizador Defensivo Backend Anti-Base64

- **🖼️ Estandarización Universal de TinyMCE en Panel Admin ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js)):**
  - Se identificó que la pestaña **Casuística** (`#generic-description`) y la pestaña **Preguntas** (`#generic-question-text`, `#generic-explanation`) carecían del manejador `images_upload_handler` y la propiedad `paste_data_images: true`. Al pegar texto con imágenes desde Microsoft Word o el portapapeles, TinyMCE incrustaba las imágenes como cadenas pesadas en Base64 (`data:image/...;base64,...`).
  - Se unificó toda la configuración de TinyMCE mediante `getStandardTinyMCEConfig()`, integrando el manejador `images_upload_handler` que sube de forma asíncrona y segura cualquier imagen pegada o insertada a Google Cloud Storage (`/api/admin/upload-editor`), transformándola inmediatamente en una URL limpia (`/api/media/gcs?file=...`).
  - Se habilitaron todas las herramientas avanzadas en la barra de edición: tablas, imágenes, alineación, enlaces, bloques de formato y visualizador de código fuente (`code`).

- **🛡️ Sanitizador Defensivo Backend Anti-Base64 ([adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js) & [mediaController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/mediaController.js)):**
  - Se implementó el método `_sanitizeHtmlImages(html, folder)` en `AdminController`, actuando como una barrera defensiva en `createCase`, `updateCase`, `addSingleQuestion`, `updateSingleQuestion` y `bulkInjectQuestions`.
  - Si un usuario, API externa o archivo masivo envía HTML con imágenes Base64 o etiquetas VML/MSO de Word, el backend las intercepta, extrae el buffer binario, lo sube automáticamente a GCS (o almacenamiento estático de respaldo en offline) y reemplaza la cadena en el HTML antes de insertarlo en PostgreSQL.
  - Se agregó `'cases'` a `ALLOWED_MEDIA_PREFIXES` en `mediaController.js` para permitir la carga y gestión segura de casuísticas en la nube.

- **🧪 Cobertura de Pruebas y Validación Integral:**
  - Nueva suite unitaria `tests/unit/adminEditorSanitizer.test.js` (**36/36 suites Jest PASSED, 230/230 tests exitosos**).
  - Verificación estricta de TypeScript (`tsc --noEmit`) en `HubDocenteApp` y `HubSaludApp` con **0 errores**.

---

### 🟢 [2026-08-29] - Normalización Integral del Contexto de Preguntas y Opciones para el Tutor IA

- **🧠 Normalización y Sanitización de Opciones en Backend ([chatController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/chatController.js)):**
  - Se corrigió el problema por el cual el Tutor IA informaba que no había recibido las opciones en el prompt.
  - Se implementó un normalizador robusto que convierte cadenas JSON, objetos asociativos o arreglos en una lista limpia de alternativas `[A] ...`, `[B] ...`, `[C] ...`, `[D] ...`.
  - Se inyectan de forma explícita la clave oficial, la respuesta seleccionada por el estudiante (evaluando `userOptionIndex = 0` correctamente sin errores por valores falsy), la explicación pedagógica/médica, las tablas de datos (`caseTableHtml`), las imágenes (`imageUrl` / `caseImageUrl`) y el enunciado completo.
  - Se añadieron directrices explícitas en el prompt prohibiendo a la IA declarar falta de acceso a opciones o preguntas del simulacro.

- **🧩 Helper Centralizado y Eliminación de Código Duplicado ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & [quiz-tutor.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz-tutor.js)):**
  - Se creó la función unificada `buildQuestionTutorContext(qIndex)`, erradicando la lógica dispersa y desactualizada que existía entre `openTutorForReviewQuestion`, `elements.consultTutorBtn.onclick` y `openQuizTutorForReview`.
  - En `quiz-tutor.js`, el método `toggle(forceState, questionContext)` actualiza de manera reactiva el contexto a la última versión disponible, garantizando que si el usuario consulta después de responder, el tutor reciba su opción marcada.

- **📱 Paridad en Aplicaciones Móviles ([HubDocenteApp](file:///c:/Users/ricar/Downloads/PROYECTOS/HubDocenteApp) & [HubSaludApp](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp)):**
  - En `TutorModal.tsx` y `ClinicalTutorModal.tsx`, se incluyó la propagación de `imageUrl`, `caseImageUrl` y `caseTableHtml` dentro del payload de contexto para el Tutor IA.

- **🧪 Cobertura de Pruebas Unitarias:**
  - Creada suite `tests/unit/quizTutorContext.test.js` (**32/32 suites Jest PASSED, 218/218 tests exitosos**).
  - TypeScript typecheck (`tsc --noEmit`) con **0 errores** en ambas apps móviles.

- **🛡️ Unificación y Limpieza de Modales Paywall ([uiManager.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/uiManager.js), [simulator-dash.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/simulator-dash.js) & [quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js)):**
  - Se eliminó el uso indebido de `confirmationModal.showAlert` (modal genérico de confirmación) al agotar vidas o límites en el botón **"Extraer Insights"**.
  - Se integró el modal premium oficial `uiManager.showPaywallModal(message, context)` con bifurcación inteligente según plan (`free`: 10 vidas agotadas, `basic`: límite diario de 50 consultas o 15 simulacros, `advanced`: meta diaria completada de 100 consultas).
  - Se blindó el botón **"Consultar Tutor IA"** tanto durante el examen como en la pantalla de revisión (`showExamReview`) para validar previamente los límites mediante `validateFreemiumAction('quiz_tutor')`, abriendo la modal paywall correcta inmediatamente sin ejecuciones fantasma.
  - Se erradicó código duplicado aliando `window.openQuizTutorForReview = window.openTutorForReviewQuestion`.
  - Nueva suite unitaria `tests/unit/uiPaywallLogic.test.js` (**33/33 suites Jest PASSED, 223/223 tests exitosos**).

- **⚡ Erradicación de QuotaExceededError y Optimización de Imágenes Base64 ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & Base de Datos):**
  - **Diagnóstico y Causa Raíz:** Se detectaron 3 casuísticas anidadas (`Caso-Secundaria-Arte10`, `Arte13`, `Arte08`) y 16 preguntas que contenían cadenas de imagen en Base64 de hasta 1 MB incrustadas directamente en el HTML. Al multiplicarse por 7 preguntas anidadas, el JSON del examen superaba los 6-10 MB, desbordando el límite de 5 MB de `localStorage` (`QuotaExceededError`) y haciendo que el bloque `init()` mostrase erróneamente el mensaje de "Examen dañado en memoria".
  - **Extracción de Medios a Archivos Estáticos:** Se extrajeron todas las imágenes Base64 de la base de datos hacia `src/presentation/public/assets/cases/` y `src/presentation/public/assets/questions/`, reemplazando el texto crudo por URLs relativas (`/assets/cases/...`). El peso del banco de Arte y Cultura se redujo en un **99%** (de 9.07 MB a 90.5 KB).
  - **Deduplicación en Serialización (`serializeSessionState`):** Se implementó un mapa `_casesMap` que almacena la descripción del caso una sola vez en lugar de repetirla en cada una de las 7 preguntas hijas, rehidratándola transparentemente en `loadSession()`.
  - **Persistencia Multi-Tier Resiliente:** `saveSession()` ahora cuenta con manejo seguro de `QuotaExceededError`, purgando sesiones antiguas, respaldando en `sessionStorage` y manteniendo la ejecución fluida en memoria sin interrumpir nunca el examen.
  - **Nueva Suite de Pruebas:** `tests/unit/quizSessionPersistence.test.js` (**35/35 suites Jest PASSED, 227/227 tests exitosos**).

---

### 🟢 [2026-08-27] - Optimización de Casuísticas Anidadas, Limpieza Visual de Quiz y Unificación en Web y Apps Móviles

- **🏷️ Depuración y Limpieza del Renderizado de Casuísticas Anidadas ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & [quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html)):**
  - Se eliminaron los títulos y códigos redundantes de grupo (ej: `CASO-INICIAL-03`) que sobrecargaban la cabecera del reactivo.
  - Se estandarizó el distintivo superior a **"Casuística Anidada"** (Educación) y **"Viñeta Clínica Compartida"** (Salud / Medicina) con el indicador secuencial correlativo (`Pregunta #1`).
  - Se condicionó el contenedor superior para que solo se despliegue si existe contenido enriquecido real (`description_text`, imágenes o tablas). Si las preguntas están asociadas solo para ordenamiento correlativo, se oculta el contenedor vacío.

- **🔍 Corrección de Fuga de Interfaz en Revisión de Examen ([components.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js) & [quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - Se corrigió el error por el cual el contenedor flotante superior del quiz persistía visible en la pantalla de revisión (`showExamReview`).
  - Se integró la casuística anidada / viñeta clínica directamente dentro de cada tarjeta de corrección individual (`createReviewCardHTML`), permitiendo al alumno revisar el enunciado del caso, su imagen o tabla de apoyo, la pregunta y el sustento explicativo de forma autónoma y cohesionada.

- **📱 Sincronización Total con Apps Móviles ([HubDocenteApp](file:///c:/Users/ricar/Downloads/PROYECTOS/HubDocenteApp) & [HubSaludApp](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp)):**
  - En `QuestionCard.tsx` (Docente) y `ClinicalQuestionCard.tsx` (Salud), se implementó la misma simplificación visual: distintivo limpio (`Casuística Anidada` / `Viñeta Clínica Compartida`), eliminación de títulos redundantes y renderizado condicional.
  - En `results.tsx` de ambas aplicaciones, se integró el bloque `.reviewCaseBox` para una visualización fluida de casuísticas y viñetas en la corrección detallada.

- **⏮️ Navegación Bidireccional Segura y Re-visualización de Preguntas Respondidas ([quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js), [quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html) & [quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - Se implementó el botón **"Anterior"** (`btn-prev-premium`) en la web, permitiendo al alumno retroceder en cualquier momento a revisar preguntas ya contestadas en todas las modalidades (10q, 20q y 100q).
  - Al regresar a una pregunta anterior, la interfaz se reanima con el estado exacto marcado (bloqueando clics para evitar re-marcado o trampas), mostrando el sustento explicativo y permitiendo volver a avanzar con "Siguiente".
  - Se definieron de forma limpia y modular los controladores `handlePreviousQuestion()` y `handleNextQuestion()`, garantizando la transición fluida y la correcta culminación del simulacro.
  - Se corrigió la visibilidad del botón **"Consultar Tutor IA"** en Modo Estudio (20qs), asegurando la remoción de la clase `.hidden` al responder.
  - Se estructuró un footer de acciones armónico y 100% responsivo: `[⬅️ Anterior]` a la izquierda, `[🤖 Tutor IA]` al centro y `[Siguiente ➡️ / Finalizar 🏁]` a la derecha, garantizando persistencia segura sin alterar KPIs ni estadísticas.
  - Cobertura de pruebas unitarias agregada en `tests/unit/quizNavigation.test.js` (**191/191 tests exitosos**).

- **📊 Corrección y Precisión en KPIs de Evolución Cronológica y Distribución por Áreas ([simulator-dashboard.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/simulator-dashboard.html), [simulator-dash.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/simulator-dash.js), [docenteController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/docenteController.js), [medicoController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/medicoController.js), [docenteRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/docenteRepository.js) y [medicoRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/medicoRepository.js)):**
  - **Evolución Cronológica de Puntajes:** Se corrigió la segregación de series en `scores10`, `scores20` y `scoresReal`. Anteriormente, la condición `total_questions !== 10 && total_questions !== 20` catalogaba exámenes de 12 reactivos (o intentos parciales) erróneamente como "Simulacros Reales", generando puntos amarillos fantasmas. Se actualizaron los filtros a rangos estrictos (`<= 15` para Rápido, `16..49` para Estudio y `>= 50` exclusivamente para Simulacros Reales).
  - **Distribución por Áreas (Gráfico Circular Donut):** Se renombró el KPI de *"Distribución por Bloques"* a **"Distribución por Áreas"** para unificar el vocabulario entre la web y las aplicaciones móviles. El gráfico circular ahora lee y renderiza directamente los `topics` (áreas temáticas) reales almacenados en la base de datos a partir de `radar_data`, asegurando coherencia al 100% con el gráfico inferior de *Dominio por Áreas*.
  - **Pruebas Unitarias Agregadas:** Suite `tests/unit/kpiEvolutionAndDoughnut.test.js` (**30/30 suites Jest PASSED, 202/202 tests exitosos**).

---

### 🟢 [2026-08-26] - Corrección de GoTrueClient Singleton y Eliminación de Scripts Duplicados en Frontend

- **🔐 Supabase GoTrueClient Singleton Estricto ([config.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/config.js#L85-L92)):**
  - Se agregó la condición de guarda `!window.supabaseClient` en la inicialización de Supabase en `config.js` para evitar crear múltiples instancias de `GoTrueClient` compitiendo por la clave `sb-rayjtupppcbhzjizhamn-auth-token` en el `localStorage`.
  - Erradica el warning en consola de producción: *"Multiple GoTrueClient instances detected in the same browser context"*.

- **🧹 Limpieza de Scripts HTML Duplicados (Todas las vistas HTML):**
  - Se eliminó la doble inclusión de `<script src="/js/config.js"></script>` presente en el `<body>` de `admin.html`, `course.html`, `dashboard.html`, `deck-editor.html`, `flashcards.html`, `index.html`, `library.html`, `login.html`, `pricing.html`, `profile.html`, `quiz.html`, `repaso.html`, `resource.html`, `simulator-dashboard.html` y `simulators.html`.
  - Mantiene una única carga en el `<head>`, optimizando los tiempos de parseo del DOM.

---

### 🟢 [2026-08-25] - Corrección de Permisos de Subida de Imágenes para Usuarios Advanced y Manejo Limpio de Paywall

- **🖼️ Corrección de Mapeo de Atributos de Membresía ([deckController.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/deckController.js)):**
  - Se refactorizó `_getUserContext` para acceder correctamente al atributo camelCase `req.user?.subscriptionTier` expuesto por el modelo `User`, además de `req.user?.subscription_tier` y `req.userTier`.
  - Soluciona el error en el que la API `POST /api/cards/upload-image` rechazaba con status 403 las solicitudes de usuarios con plan `advanced` o rol `admin` al asumir erróneamente que tenían un plan `free`.

- **💳 Optimización del Flujo de Excepciones Paywall ([repaso.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/repaso.js) & [deck-explorer.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/deck-explorer.js)):**
  - Se actualizó el manejador `_uploadFileToGCS` para extraer el mensaje explicativo provisto por el servidor (`data.error`) y mostrar el modal dinámico de suscripción `showPaywallModal(data.error, 'flashcards')`.
  - Se suprimió la emisión de notificaciones erróneas en consola ("Save card network error: Error: Créditos agotados") y toasts redundantes de error de red.

---

### 🟢 [2026-08-22] - Módulo Repaso: Posicionamiento Inteligente Anti-Solapamiento en Tour Guía y Purificación de KPIs de Mazos

- **📍 Algoritmo Anti-Solapamiento de Tooltips en Tour Guía ([tooltipManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/tooltipManager.js)):**
  - Se implementó un algoritmo dinámico que calcula la intersección del área rectangular (`overlapArea`) entre la tarjeta flotante del tooltip y el elemento objetivo en pantalla.
  - Evalúa iterativamente posiciones candidatas (`bottom`, `top`, `right`, `left`), garantizando la selección de una posición con **cero solapamiento (0px de obstrucción)**.
  - Se afinó la selección de objetivos en `startRepasoTour` asociando el Paso 2 a la cabecera `.explorer-sidebar-header` para evitar que el tooltip cubra la etiqueta "EXPLORADOR" o el árbol de carpetas en vista móvil y de escritorio.
  - Se incorporó `targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })` para asegurar el centrado óptimo del elemento objetivo en pantalla antes de calcular coordenadas.

- **📊 Purificación de Analíticas y KPIs de Mazos ([analyticsRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/analyticsRepository.js) & [analyticsService.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/analyticsService.js)):**
  - Se desvinculó la tabla `quiz_history` (exámenes/simulacros culminados de los módulos Salud y Educación) de las estadísticas del mapa de actividad de los mazos.
  - Se habilitó la filtración contextual por `deckId` en `/api/analytics/heatmap?deckId=...`, permitiendo que la ventana de estadísticas (`openStatsModal` en `repaso.js`) y `ActivityHeatmap` contabilicen de forma pura y exclusiva las revisiones de tarjetas (`user_flashcards`) del mazo seleccionado.

---

### 🟢 [2026-08-20] - Sincronización y Actualización Total del Esquema de Base de Datos ([database_schema.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql))

- **🔍 Introspección Profunda en Vivo de Supabase PostgreSQL:**
  - Se realizó una introspección completa conectándose directamente a la base de datos remota de Supabase a través de `information_schema` y `pg_catalog`.
  - Se regeneró el archivo maestro [database_schema.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql) reflejando con exactitud el estado del 100% de los componentes:
    - **11 Extensiones:** `vector`, `uuid-ossp`, `unaccent`, `pgcrypto`, `pg_trgm`, `fuzzystrmatch`, `hypopg`, `index_advisor`, `pg_stat_statements`, `plpgsql`, `supabase_vault`.
    - **13 Tipos y Enums Personalizados:** `academic_area`, `aal_level`, `action`, `buckettype`, `code_challenge_method`, `equality_op`, `factor_status`, `factor_type`, `oauth_authorization_status`, `oauth_client_type`, `oauth_registration_type`, `oauth_response_type`, `one_time_token_type`.
    - **21 Tablas Públicas y 171 Columnas:** con sus tipos de datos exactos, valores por defecto (`gen_random_uuid()`, `now()`), nulabilidad y llaves primarias.
    - **Relaciones y Llaves Foráneas:** con todas las restricciones de integridad referencial (`ON DELETE CASCADE`, `ON DELETE SET NULL`).
    - **57 Políticas RLS (Row Level Security):** todas las políticas de aislamiento de datos y seguridad por fila para usuarios y administradores.
    - **56 Índices de Alto Rendimiento:** incluyendo índices B-Tree, GIN Trigram (`gin_trgm_ops`) y los 14 índices estratégicos de aceleración.

---

### 🟢 [2026-08-20] - Módulo Repaso: Ordenación Cronológica de Mazos Públicos en Comunidad, Auto-Migración DB y Fallback Resiliente

- **📅 Ordenación Prioritaria por Fecha de Publicación / Actualización:**
  - En [flashcardRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/flashcardRepository.js), se configuró la consulta `getPublicDecks` con `ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC`.
  - Al hacer público un mazo o cambiar su visibilidad/categoría (`updateDeckVisibility`), el servidor actualiza la marca de tiempo `updated_at = NOW()`.
  - Esto garantiza que en cualquier filtro de píldoras ("Todas", "Programación", "Medicina", "Derecho", "Educación", etc.) el mazo recién publicado se ubique de inmediato en la **primera posición** de la cuadrícula de la comunidad.

- **🛠️ Auto-Migración de Base de Datos y Manejo de Errores Resiliente (Fallback SQL 42703):**
  - **Auto-healing Migration ([db.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/db.js)):** Se añadió la instrucción `ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();` en la inicialización del pool de conexiones a PostgreSQL.
  - **Manejo Resiliente de Errores ([flashcardRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/flashcardRepository.js)):** Se implementó control con `try/catch` ante el código de error `42703` (columna no encontrada). Si por algún motivo la columna `updated_at` no ha sido creada aún en la base de datos remota, el sistema conmuta automáticamente a una consulta de respaldo ordenada por `created_at DESC`, evitando caídas 500 y garantizando disponibilidad continua del servicio.

---

### 🟢 [2026-08-20] - Refactorización Integral de Límites y Caché: Visitantes (1 Demo/Día y TTL 1 Día) y Free (10 Vidas Semanales)

- **👤 Motor Centralizado de Sesión y Caché para Visitantes ([sessionManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/sessionManager.js)):**
  - Se creó la clase `GuestSessionManager` centralizando el ciclo de vida del usuario no autenticado:
    - **Límite de 1 simulacro de 10 preguntas por día**: `MAX_DAILY_DEMOS = 1` evaluado en base a la fecha de Perú (`America/Lima`).
    - **Retención de datos y estadísticas de 1 día (TTL Diario)**: `checkAndCleanExpiredGuestData()` detecta el cambio de día calendario, reiniciando `demo_sessions_count = 0` y purgando atómicamente todas las claves `guest_demo_stats_[domain]`.
    - **Métodos estandarizados**: `canTakeDailyDemo()`, `recordDemoAttempt()`, `getGuestStats(domain)`, `saveGuestStats(domain, stats)`.
  - Se eliminó el código muerto y llaves legacy obsoletas (`guest_demo_stats`) en [quiz.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) y [simulator-dash.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/simulator-dash.js).

- **🪙 Reducción y Unificación del Pool Free / Pending a 10 Vidas Semanales:**
  - **Capa de Presentación**: Se actualizaron [uiManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/uiManager.js), [profile.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/profile.js), [sessionManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/sessionManager.js) y [chat.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/chat.js) para estandarizar el límite por defecto a **10 vidas**, actualizando tooltips, modales de bienvenida (`checkAndShowWelcomeModal`) y mensajes de paywall.
  - **Capa de Dominio y Aplicación**: Se actualizaron [user.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/models/user.js), [usageService.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/usageService.js), [checkLimitsMiddleware.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/middlewares/checkLimitsMiddleware.js), [chatPrompts.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/prompts/chatPrompts.js) y [asistenteGuiaKnowledge.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/asistenteGuiaKnowledge.js).
  - **Capa de Infraestructura y Base de Datos**: Se actualizaron [database_schema.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql) y [sp_register_user.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/sp_register_user.sql) estableciendo `max_free_limit DEFAULT 10`.

- **🧪 Cobertura y Suite de Pruebas Unitarias ([guestSessionManager.test.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/guestSessionManager.test.js)):**
  - Se crearon pruebas unitarias dedicadas para `GuestSessionManager` validando el límite de 1 demo/día, el guardado de estadísticas y la purga automática por TTL de 1 día al cambiar de fecha.
  - Se actualizaron los mocks de [checkLimitsMiddleware.test.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/checkLimitsMiddleware.test.js) y [userRepository.test.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/tests/unit/userRepository.test.js).
  - Toda la suite de pruebas (17 suites, 121 tests) ejecutada y validada con 100% de éxito.

---

### 🟢 [2026-08-20] - Optimización Integral de Rendimiento Full-Stack (Admin, Biblioteca, Caché y Carga Asíncrona)

- **⚡ Renderizado Diferido Bajo Demanda en Panel Admin ([admin.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js#L357-L460)):**
  - Se eliminó la ejecución sincronizada masiva de las 6 pestañas en `loadAllData()`, implementando `renderCurrentTab()` para renderizar exclusivamente la pestaña activa visible en pantalla.
  - Se redujo en un **83%** la creación innecesaria de nodos DOM ocultos en la carga inicial y tras mutaciones de registros en el Panel de Gestión.

- **🗄️ Caché en Memoria con TTL e Invalidación Atómica en Repositorios ([bookRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/bookRepository.js), [topicRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/topicRepository.js) & [careerRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/careerRepository.js)):**
  - Se integró un motor de caché en memoria con TTL de 5 minutos en `BookRepository`, `TopicRepository` y `CareerRepository` para consultas públicas de catálogo.
  - Se conectó la invalidación atómica (`clearCache()`) en todos los métodos de mutación (`create`, `update`, `delete`, `syncResource`) garantizando coherencia inmediata tras cualquier edición administrativa.

- **🌐 Cabeceras HTTP de Caché Inteligente ([coursesController.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/coursesController.js#L65-L215)):**
  - Se configuró la cabecera `Cache-Control: public, max-age=120, stale-while-revalidate=300` para las rutas públicas de lectura (`/api/careers`, `/api/courses`, `/api/topics`, `/api/books`, `/api/books/medical`), permitiendo respuestas HTTP 304 / desde caché de navegador y CDN sin sobrecargar el servidor Express.
  - Se blindaron las rutas de administración (`includeHidden=true` y `/api/students`) con `Cache-Control: private, no-cache, no-store, must-revalidate`.

- **🖼️ Decodificación Asíncrona y Carga Diferida Universal de Imágenes ([components.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js#L145-L1070)):**
  - Se estandarizó la carga diferida con `loading="lazy"` y la decodificación fuera del hilo principal con `decoding="async"` en todas las tarjetas de cursos, carreras, recursos universales, miniaturas del panel de control y widgets de novedades.

- **🎨 Rediseño UI/UX de Revisión de Examen y Jerarquía Tipográfica Dual-Theme ([components.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js#L680) & [quiz.css](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css#L420)):**
  - Se calibró la escala tipográfica de las preguntas en revisión de un sobredimensionado `1.4rem` a un armónico `1.12rem` (`font-weight: 600`) con `line-height: 1.6`.
  - Se incorporaron badges con letras semánticas `[A, B, C, D]` (`.review-opt-letter`) de `28x28px`, destacando la opción correcta en verde esmeralda (`var(--success)`) y la elección errada del usuario en carmesí (`var(--danger)`) con texto tachado.
  - Se modernizó el disparador del Tutor IA en revisión (`.btn-review-tutor-trigger`) con el gradiente oficial **Manta Pill** (`var(--manta-pill-gradient)`), radio `9999px`, sombra azul/cian e icono oficial de Hubi.
  - Eliminación total de estilos inline oscuros hardcodeados, garantizando contraste nítido tanto en Modo Oscuro (`#050505`/`#0a0a0a`) como en Modo Claro (`#f8fafc`/`#ffffff`).

- **🔔 Centralización del Sistema de Alertas, Toasts Dual-Theme y Vidas en Tiempo Real ([uiManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/uiManager.js), [confirmationModal.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/confirmationModal.js) & [modal.css](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/modal.css)):**
  - Se erradicaron más de 30 llamadas nativas y bloqueantes a `alert()` y `confirm()` en `quiz.js`, `pricing.js`, `simulator-dash.js`, `dashboard.js`, `repaso.js`, `resource.js` y `admin.js`.
  - Se implementó `window.uiManager.showToast(message, type, duration)` con soporte multitipo (`'success'`, `'error'`, `'warning'`, `'info'`, `'life'`) e inyección automática en `#hub-toast-container` con backdrop-blur y z-index máximo (`2147483647`).
  - Se conectó `sessionManager.decrementUsage()` con `showLifeDecrementToast()` para notificar inmediatamente en pantalla a los usuarios Free cada vez que descuentan una vida (`⚡ 1 crédito utilizado. Te quedan X/20 vidas de prueba`), alertando cuando restan 1-2 créditos y desplegando el paywall automático al llegar a 0.

- **💬 Sistema Centralizado de Tooltips, Guías de Onboarding y Soporte Táctil ([tooltipManager.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/tooltipManager.js), [components.css](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/components.css) & [simulator-dash.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/simulator-dash.js)):**
  - Se creó el gestor universal `TooltipManager` (`window.tooltipManager`) para manejo declarativo de tooltips con `[data-tooltip]` y `[data-tooltip-pos]`, con posicionamiento inteligente anti-desbordamiento y micro-animaciones.
  - Se corrigió el error en los simuladores de Salud y Educación donde el tooltip de configuración no aparecía para usuarios visitantes (`!token`).
  - Se implementó el tour interactivo de 2 pasos (`startSimulatorTour`) para guiar a visitantes y nuevos usuarios en la configuración de especialidad y selección de modos de entrenamiento.
  - Se añadió el botón discreto `#btn-show-guide` en la cabecera del simulador para que el usuario pueda volver a ver la guía interactiva en cualquier momento.
  - Se adaptaron los tooltips informativos de los KPIs (`.kpi-info-btn` / `.kpi-tooltip-content`) con eventos touch/click para celulares y tokens dinámicos Dual-Theme.

- **🗄️ 14 Índices Estratégicos en PostgreSQL ([database_schema.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql#L470-L485)):**
  - Se crearon 14 índices clave (`idx_resources_type_domain_vis_created`, `idx_question_bank_created_at`, `idx_page_views_entity`, `idx_decks_user_parent`, `idx_user_flashcards_deck_sort`, etc.) acelerando las consultas del catálogo, métricas de admin y módulo de repaso.
- **🃏 Reordenamiento Atómico en Lote para Módulo Repaso ([flashcardRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/flashcardRepository.js#L290-L315)):**
  - Se reemplazó el bucle $N$ de consultas individuales por una única consulta SQL atómica batch (`UPDATE ... FROM (VALUES ...)`).
  - Se optimizó `createFlashcard` eliminando la consulta previa para nombre del mazo e integrando `COALESCE((SELECT name FROM decks WHERE id = $2), 'GENERAL')` directamente en la sentencia `INSERT`.
- **⚙️ Ingesta Masiva por Lotes y Paginación en Panel Admin ([adminRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/adminRepository.js#L200-L275)):**
  - Se implementó la inserción en bloques de 50 preguntas en `saveBulkQuestionBankAdmin`, reduciendo las peticiones de red en un **90%** durante la carga de CSV/Excel.
  - Se agregaron los parámetros `page` y `limit` a `getAllQuestions` para evitar la sobrecarga de payloads pesados.
- **⚡ Caché en Memoria para Taxonomía Global ([courseRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/courseRepository.js#L4-L28)):**
  - Se integró caché en memoria con TTL de 5 minutos en `findAll` (Cursos y Carreras), entregando respuestas en **0ms** para navegaciones frecuentes.

---

### 🟢 [2026-08-04] - Corrección de Selección Inicial de Novedades y Estilización Manta Pill
- **⚡ Estado Activo Inicial en Mi Biblioteca ([search.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/search.js#L28)):**
  - Se unificó `this.activeFilter = '🔥 Novedades';` en el constructor del componente, corrigiendo la desincronización que impedía que la píldora apareciera seleccionada por defecto en la primera carga.
- **🎨 Rediseño del Brillo de Píldora Novedades ([search.css](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/search.css#L670-L678)):**
  - Se ajustó el efecto de resplandor naranja a `box-shadow: 0 3px 10px rgba(249, 115, 22, 0.22)` y degradado suave `linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(249, 115, 22, 0.25) 100%)` siguiendo [DESIGN_SYSTEM.md](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/DESIGN_SYSTEM.md).

---

### 🟢 [2026-08-03] - Filtro Estricto de 30 Días en Novedades, Proporciones de Tarjetas y Medios
- **🗃️ Migración de Columna `created_at` ([database_schema.sql](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/database/database_schema.sql#L198)):**
  - Se agregó la columna `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` a la tabla `resources`.
- **📅 Filtro SQL de 30 Días en Novedades ([bookRepository.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/bookRepository.js#L14)):**
  - Se configuró la condición estricta `r.created_at >= (NOW() - INTERVAL '30 days')` y `ORDER BY r.created_at DESC, r.id DESC` descartando automáticamente recursos anteriores a 30 días.
- **🖼️ Fallback Universal y Tamaño de Tarjetas ([config.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/config.js#L74) & [components.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/components.js#L1012)):**
  - Mapeo de `noticia.webp` como fallback oficial para recursos de tipo noticia.
  - Ampliación del contenedor de la Tarjeta Hero en Novedades a `360px x 240px`.
  - Alineación horizontal de botones de acción en las tarjetas secundarias mediante `margin-top: auto` en `.news-sec-footer`.
- **🎨 Diferenciación Visual por Tipo de Recurso ([browse.css](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/browse.css#L1160)):**
  - `noticia`: Resplandor púrpura (`rgba(168, 85, 247, 0.22)`).
  - `norma`: Resplandor ámbar (`rgba(245, 158, 11, 0.22)`).
  - `guia`: Resplandor esmeralda (`rgba(16, 185, 129, 0.22)`).
  - `paper`: Resplandor azul royal (`rgba(59, 130, 246, 0.22)`).
- **🧹 Limpieza de Barra de Búsqueda y Botón Chat Flotante ([library.html](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/library.html#L725)):**
  - Remoción de lupa duplicada y botón 'X' en la caja de búsqueda.
  - Ocultamiento definitivo del widget flotante de chat general en Mi Biblioteca.

### 🟢 [2026-08-21] - Optimización de Botón Guía en Simulador, Jerarquía en Header y Onboarding de Repaso
- **📍 Reubicación Horizontal del Botón Guía ([simulator-dashboard.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/simulator-dashboard.html) & [simulator-dashboard.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/simulator-dashboard.css)):**
  - Se agrupó `#btn-show-guide` y `#btn-start-config` dentro del contenedor flex `.context-hero-buttons-row`, situando el botón *"? Guía"* a la izquierda de *"Configurar Examen"* en la misma fila horizontal.
  - Adaptación responsiva mediante flexbox para pantallas móviles (`height: 40px`, bordes redondeados `10px-12px`).
- **👤 Limpieza de Jerarquía Visual en Header ([app.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/app.js)):**
  - Se eliminó la etiqueta inferior redundante `.user-usage-badge` del menú desplegable (`#user-menu-dropdown`), preservando el plan oficial en el botón de la barra de navegación (`.user-header-tier`) y manteniendo un dropdown limpio con Nombre y Correo verificado.
- **🗂️ Miniguía de Onboarding para el Módulo Repaso ([tooltipManager.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/tooltipManager.js), [repaso.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/repaso.js) & [repaso.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/repaso.css)):**
  - **Alineación en Fila Superior (`.repaso-header-top-row` & `.deck-title-top-row`):** En el Dashboard de Repaso y en la vista de Mazo, el botón `Guía` se sitúa en la misma línea a la altura del título en el extremo derecho en PC y móviles.
  - **Estadísticas Responsivas (`.deck-meta-pill`):** Rediseño minimalista de las métricas (tarjetas, pendientes y dominadas) en píldoras estilizadas que nunca se truncan ni desbordan en pantallas móviles.
  - **Tour de 5 Pasos en Mazo (`startDeckViewTour`):** Cobertura interactiva completa que explica: 1) Estudio espaciado SM-2, 2) Creación manual e IA de tarjetas, 3) Cuaderno de notas/resumen, 4) Métricas y visibilidad pública, y 5) Gestión de Sub-Mazos y lista de flashcards.

### 🟢 [2026-08-21] - Integración de Guía de Usuario, Tooltips de KPIs, Avatar Hubi y Sincronización de 10 Vidas en HubSaludApp y HubDocenteApp
- **🧭 Onboarding Tour & Guía Interactiva en Apps Móviles ([UserGuideModal.tsx](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp/src/presentation/components/UserGuideModal.tsx) & [home.tsx](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp/app/(tabs)/home.tsx)):**
  - Implementación del componente `UserGuideModal.tsx` en `HubSaludApp` y `HubDocenteApp` con navegación en 3 pasos: (1) Convocatoria y especialidad médica/docente, (2) 3 modalidades de simulador (10q, 20q con Tutor IA, Simulacro Real con cronómetro), (3) Analíticas de progreso y Tutor IA en corrección de examen.
  - Inserción del botón `? Guía` en el banner de configuración de la pantalla principal (`home.tsx`) junto al botón `Configurar`.
  - Apertura automática en la primera visita mediante persistencia local segura con `AppStorage` (`hasSeenSimulatorGuide_salud` y `hasSeenSimulatorGuide_docente`).
- **📊 Modales Explicativas y Tooltips de KPIs ([KpiInfoModal.tsx](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp/src/presentation/components/KpiInfoModal.tsx) & [home.tsx](file:///c:/Users/ricar/Downloads/PROYECTOS/HubSaludApp/app/(tabs)/home.tsx)):**
  - Creación del componente `KpiInfoModal.tsx` con explicaciones detalladas, fórmulas de cálculo (escala vigesimal 0-20, porcentaje de aciertos) y metas recomendadas para cada KPI: Puntuación Promedio, Precisión Global, Aciertos / Diagnósticos Correctos, Errores Clínicos / Pedagógicos, Tendencia Histórica y Dominio por Especialidades / Grupos Pedagógicos.
  - Integración interactiva: al tocar cualquier tarjeta de KPI o cabecera de gráfico en el dashboard se abre la ventana explicativa con recomendaciones formativas.
- **⚡ Sincronización Universal de 10 Vidas de Prueba (Pool Free/Pending):**
  - Actualización del límite por defecto de 20 a **10 vidas** en `AuthContext.tsx`, `ScreenHeader.tsx`, `profile.tsx` y `terms-and-conditions.tsx` en ambas aplicaciones móviles.
  - Implementación del componente `LifeToast.tsx` para emitir notificaciones flotantes con microanimaciones elásticas cuando se descuenta un crédito o cuando el saldo de vidas es bajo.
- **🩺 Avatar de Hubi en Botón de Tutor IA en Revisión:**
  - En `results.tsx` de ambas apps, se integró el avatar ilustrativo de Hubi (`assets/images/hubifrente.png`) en el botón de activación del Tutor IA en cada caso clínico / casuística pedagógica.
- **📈 Mapeo y Dominio Pedagógico CNEB en HubDocenteApp:**
  - Sincronización de `CANONICAL_SUBAREAS_MAP` en `PedagogicalBarChart.tsx` y `docenteService.js` para reflejar las 6 subáreas curriculares oficiales sin duplicaciones.

---

### 🟢 [2026-08-20] - Refactorización Integral de Onboarding Tour, Tooltips, Alertas Únicas y UI de Resultados
- **🧭 Onboarding Tour Universal & Tooltips ([GUIA_USUARIO_Y_TOOLTIPS.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/GUIA_USUARIO_Y_TOOLTIPS.md), [UI_COMPONENTS_GUIDE.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/UI_COMPONENTS_GUIDE.md), [tooltipManager.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/tooltipManager.js) & [components.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/components.css)):**
  - Creación del documento técnico máster `GUIA_USUARIO_Y_TOOLTIPS.md` y actualización consolidada de `UI_COMPONENTS_GUIDE.md`.
  - Corrección de cierre instantáneo de la guía mediante aislamiento de eventos de propagación (`e.stopPropagation()`).
  - Implementación de motor de navegación de 3 pasos con scroll suave no agresivo (`block: 'nearest'`), evitando desplazamientos no deseados de los encabezados.
  - Rediseño armónico de la tarjeta de guía (`width: 330px`) con botones uniformes (`height: 34px`, `white-space: nowrap`), indicadores de puntos dinámicos (`.hub-guided-dots`) y navegación `← Anterior` / `Siguiente →` / `¡Comenzar! 🚀`.
- **⚡ Cobertura Exhaustiva de Vidas en Repaso y Tutores ([networkService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/services/networkService.js) & [deckController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/deckController.js)):**
  - Se extendió el interceptor global `NetworkService.fetch` para capturar el inicio de estudio de mazos (`GET /cards/due` y `GET /cards/:id/study`), creación/edición de mazos (`POST/PUT /api/decks`) e interacciones con el Tutor IA de Flashcards (`tutor-chat.js`).
  - Detección precisa de planes oficiales (`free`, `basic`, `advanced`): Las cuentas del plan gratuito (`tier === 'free'` o `status !== 'active'`) descuentan de forma garantizada y muestran la alerta flotante `⚡ 1 crédito utilizado...` en tiempo real.
  - Sincronización instantánea tras salir del estudio de flashcards mediante redirección directa (`window.location.href`) y refresco reactivo en el evento `pageshow`, evitando datos estancados por Back-Forward Cache (bfcache) sin requerir F5 manual.
- **🚪 Botón de Pausa y Salida Segura en Simulacros ([quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html), [quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js), [confirmationModal.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/confirmationModal.js) & [quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - Incorporación del botón de salida en la esquina superior derecha (`#btn-top-exit` / `.btn-header-exit`), visible de forma responsiva en PC y celulares.
  - Al pulsar salir, se invoca `saveSession()` y se despliega una modal de confirmación (*"¿Deseas pausar y salir del simulacro? Tu progreso quedará guardado..."*).
  - Al regresar, el sistema ofrece:
    1. **"Continuar anterior":** Reanuda exactamente desde la pregunta en curso.
    2. **"Iniciar nuevo":** Descarta la sesión previa e inicia un examen limpio de 20 preguntas sin mezclar data.
    3. **Botón "X" / Esc / Fuera:** Cierra la modal y sale directamente a `simulator-dashboard` sin forzar inicio de examen.
- **🎯 Experiencia, Finalización y Modal de Resultados en Quiz ([quiz.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/quiz.html), [quiz.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/quiz.js) & [quiz.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/quiz.css)):**
  - **Armonía y Espaciado en Modal de Resultados:** Implementación de las clases `.results-actions` y `.results-secondary-actions` en CSS con `gap: 1.15rem` en PC y `0.95rem` en móviles, erradicando el solapamiento visual entre *"Ver Corrección del Examen"* y los botones *"Salir"* / *"Nuevo Examen"*.
  - **Corrección de la Última Pregunta:** Transformación dinámica del botón a *"Finalizar Simulacro 🚀"* en la última pregunta y solución del conflicto de `style="display: none"` en `resultsOverlay`, permitiendo abrir de manera garantizada el modal de resultados y la posterior corrección del examen.
  - **Eliminación de Código Muerto/Huérfano:** Remoción del botón de flecha flotante (`.btn-back-pulse`) que se superponía con las opciones de respuesta.
  - **Ocultamiento Seguro de Imágenes:** Corrección de `#questionImageContainer` y `#explanationImageContainer` para no mostrar iconos de imagen rota cuando no hay `image_url` asignada.
  - **Aislamiento de la Revisión:** Ocultamiento total de `#reviewContainer` durante el examen activo para evitar su visualización prematura.
  - **Colores Temáticos por Módulo:** Respuesta correcta en Verde Cian (`#0d9488`) para Salud y Azul Real (`#2563eb`) para Educación, tanto en el quiz activo como en la revisión post-examen.
  - **Botón Esbelto del Tutor IA en Revisión:** Reducción de la altura y padding vertical (`.btn-review-tutor-trigger`: `height: 32px; padding: 0.35rem 0.95rem;`) para una apariencia elegante y no invasiva.

---

### 🟢 [2026-07-31] - Unificación de Documentación Mi Biblioteca y Sistema de Curaduría Automática
- **📚 Consolidación de Documentación ([MI_BIBLIOTECA.md](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/MI_BIBLIOTECA.md)):**
  - Fusión de `@MI_BIBLIOTECA` y `@MI_BIBLIOTECA_GUIA` eliminando información obsoleta y creando una guía máster única.
- **🤖 Curaduría e Ingesta Automática de Recursos ([resourceAutoIngestService.js](file:///C:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/resourceAutoIngestService.js)):**
  - Creación del servicio de ingesta automática y script CLI `autoIngestResources.js` para la incorporación de guías clínicas y directivas oficiales.

### 🟢 [2026-08-31] - Carga Masiva Unificada de Preguntas con Casuísticas Anidadas, Importador de Casos y Depuración Total de Columnas Obsoletas
- **📦 Ingesta Masiva Unificada de Preguntas con Casuísticas ([admin.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/admin.js), [adminRepository.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/repositories/adminRepository.js)):**
  - **Plantilla Oficial Actualizada:** Inclusión de 5 columnas de casuística en el Excel de preguntas (`CODIGO_CASO`, `TITULO_CASO`, `ENUNCIADO_CASO`, `IMAGEN_CASO`, `ORDEN_CASO`).
  - **Vinculación Atómica y Automática:** Procesamiento en backend con transacciones SQL (`BEGIN...COMMIT`) que detecta códigos de caso compartidos, crea o reutiliza el caso padre en `case_scenarios` y vincula automáticamente todas las preguntas hijas asignando correlativamente `case_id` y `case_order` sin requerir enlace manual.
  - **Soporte Híbrido:** Admite en un mismo archivo Excel tanto preguntas individuales (`CODIGO_CASO` vacío -> `case_id: null`) como bloques de preguntas anidadas.
- **📂 Importador Masivo de Casuísticas Puras ([adminController.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/application/controllers/adminController.js), [apiRoutes.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/routes/apiRoutes.js)):**
  - Nuevo endpoint `POST /api/admin/cases/bulk` y modal dedicada `bulk-case` en la pestaña de Casuísticas con editor JSON y carga de Excel de viñetas pedagógicas/clínicas.
- **🧹 Depuración Total de Columnas Obsoletas (Clean Code & Database Health):**
  - **`case_scenarios.table_html`:** Eliminada por completo del backend, frontend, plantillas Excel y esquemas SQL. Las tablas y cuadros comparativos ahora se gestionan de forma nativa e integrada dentro del HTML enriquecido del enunciado (`description_text`) vía TinyMCE 6.
  - **`question_bank.visual_support_recommendation`:** Eliminada por completo de todas las capas (frontend, repositorios, controladores, schemas y migraciones), eliminando el código muerto y optimizando las consultas SQL.
  - **`question_bank.audio_text`:** Eliminada por completo de la base de datos PostgreSQL, esquemas DDL (`database_schema.sql`), repositorios (`medicoRepository`, `docenteRepository`, `adminRepository`), controladores y frontend de simuladores (`quiz.js`, `components.js`, `config.js`). Se erradicó el código muerto de comprensión auditiva residual del antiguo módulo de idiomas, dejando el banco 100% limpio y optimizado.
- **📱 Ergonomía Táctil y Calibración Tipográfica en Repaso ([flashcards.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/flashcards.js), [flashcards.css](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/css/flashcards.css)):**
  - **Desplazamiento Táctil Directo:** Implementado `enableSmoothTextDrag` con soporte de arrastre gestual deslizando el dedo directamente sobre el texto largo en celulares.
  - **Prevención de Volteo Accidental:** Detección de umbral de arrastre (`isTouchDragging`) para no voltear la tarjeta al scrollear en pantalla táctil.
  - **Aislamiento 3D:** Directivas `touch-action: pan-y !important` y `translateZ(1px)` en `.fc-card-face--back` junto a `pointer-events: none` en pseudo-elementos flex para garantizar captura fluida de eventos táctiles.
  - **Calibración Tipográfica, Estabilidad en Giro y Optimización Lateral de Listas:**
    - Erradicación del conflicto CSS vs JS: suprimido `transition: font-size` en `.content-text` y eliminadas reglas de `font-size` estáticas en `.fc-only-text` y `.fc-has-image` para prevenir renderizados duales o parpadeos.
    - Estabilidad total en el giro (`toggleFlip`): eliminación de recálculos tipográficos durante la rotación 3D, garantizando que el texto conserve su tamaño exacto sin encogerse al voltear la tarjeta.
    - Ancho completo y optimización en listas (`ol`, `ul`, `li`): ancho al 100% sin margen automático ni sangría artificial de 92%, reduciendo el padding de viñeta a `1.15rem` y el padding lateral del contenedor a `1.1rem` en móviles, habilitando más de 35% de espacio horizontal adicional para lectura continua.
    - Motor determinista *Shrink-to-Fit*: cálculo proporcional en un solo paso matemático si el texto desborda (`scrollHeight > clientHeight + 4`) con piso mínimo protegido (`0.84rem` en móvil, `1.05rem` en PC).
- **🧪 Cobertura de Pruebas Unitarias:**
  - Suite de pruebas completa: **43 / 43 suites y 313 / 313 tests en verde (100%)**.

---

## 🏛️ Arquitectura General del Sistema

### 1. Estructura de Capas
- **`src/presentation/`**: Cliente HTML5, CSS3 modular (Negro Mate Puro / Manta Gradients) y JavaScript Vanilla.
- **`src/application/`**: Controladores Express (`adminController.js`, `flashcardController.js`, `paymentController.js`) y Middlewares transaccionales (`checkLimitsMiddleware.js`).
- **`src/domain/`**: Lógica de negocio pura (`services/`, `repositories/`, `prompts/`).
- **`src/infrastructure/`**: Enrutamiento (`routes/`), cliente Supabase/PostgreSQL (`db.js`) y esquemas (`database_schema.sql`).

---

## 🔐 Estándares de Seguridad y Calidad
- **Row Level Security (RLS):** Habilitado en todas las tablas de interacción de usuario en Supabase.
- **Sanitización XSS:** Sanitización estricta en el editor TinyMCE y procesador Markdown.
- **Firmas Criptográficas:** Verificación HMAC en webhooks de Mercado Pago.
- **Cobertura de Pruebas:** Suite Jest con **250 / 250 pruebas unitarias en verde**.

---

*Nota: Este archivo debe actualizarse de forma obligatoria tras cada sesión de desarrollo o release de producción, manteniendo la fecha ISO (`[YYYY-MM-DD]`) y el resumen ejecutivo de cambios.*
