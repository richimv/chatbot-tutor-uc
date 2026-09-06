# 🧠 Specs Técnicas: Módulo de Repaso (Flashcards)

## 1. Visión General
El **Módulo de Repaso** es el sistema de memorización a largo plazo de Hub Academia. Utiliza tarjetas de aprendizaje dinámicas (Flashcards) organizadas en mazos (Decks) y un algoritmo de repetición espaciada para optimizar la retención de conocimientos médicos.

## Estado de Implementación (Abril 2026)

### ✅ Finalizado: Edición Visual de Tarjetas
- **Persistencia**: Se ha extendido el backend (`flashcardRepository`, `deckService`, `deckController`) para soportar el campo `image_url` en flashcards de usuario.
- **Carga de Medios**: Integración con GCS mediante el proxy `/api/media/gcs`. Implementación de carga directa desde el modal de edición con optimización visual.
- **UI/UX**: 
  - Las tarjetas en la lista de repaso ahora muestran una miniatura si contienen imagen.
  - El modal de edición incluye previsualización en tiempo real y gestión de archivos.
  - El modo estudio (`flashcards.html`) renderiza correctamente las imágenes en el anverso.

### ✅ Corrección de Errores y Refactorización
- **Bug de Navegación**: Se corrigió el error donde editar un mazo (nombre/icono) redirigía al usuario a la raíz (`loadDashboard`). Ahora el sistema refresca la vista actual (`loadFolder`) manteniendo el contexto.
- **Reducción de Redundancia**: Se unificaron los flujos de apertura de modales entre `RepasoManager` y `DeckExplorer`.
- **Resiliencia**: Mejora en la captura de errores en `loadFolder` para evitar estados de carga infinitos.

### ✅ Garbage Collection y Métricas Visuales
- **Eliminación en Cascada (GCS)**: Se implementó un sistema de recolección de basura donde al eliminar un mazo (o grupo de tarjetas), el backend recopila recursivamente (mediante CTE en SQL) todas las URLs de imágenes asociadas y las elimina físicamente de Google Cloud Storage antes de borrar los registros de la base de datos.
- **Estadísticas Dinámicas**:
  - Se reparó la inicialización del `ActivityHeatmap` para que consuma datos reales del endpoint `/api/analytics/heatmap`.
  - Se introdujo un **Gráfico de Anillo (Chart.js)** en el modal de estadísticas que desglosa el estado de las tarjetas del mazo actual en tres categorías: "Nuevas/Aprendiendo", "Por Repasar" (Due) y "Dominadas".

## 2. Componentes Clave

### A. Gestión de Mazos (Decks)
- **DeckExplorer**: Componente lateral que gestiona la navegación en árbol. Implementa carga perezosa (lazy loading) para sub-mazos.
- **RepasoManager**: Controlador principal de la vista de contenido. Maneja el renderizado de cabeceras, cuadrículas de mazos y listas de tarjetas.

### C. Sistema de Audio Premium (TTS Neural)
- **Motor de Voz**: Integración con **Google Cloud Text-to-Speech (Neural Voices)** para generar pronunciaciones de alta fidelidad en múltiples idiomas (ES, EN, IT, FR, DE).
- **Consumo Inteligente**: Los audios se generan una sola vez, se optimizan en el backend y se sirven desde GCS para minimizar la latencia.
- **Modo Escucha (Listening)**: Permite ocultar el texto de la tarjeta para forzar el entrenamiento auditivo, centrando automáticamente el botón de audio.

### D. Generación con IA
- **IA Assistant**: Integración con modelos de lenguaje para generar flashcards automáticamente a partir de temas médicos específicos. Soporta la creación de hasta **20 tarjetas por intento**.

---

## 3. Optimizaciones de Seguridad y Control de Uso (Sprint Final - Mayo 2026)

Se ha implementado un sistema estricto de cuotas y protección de recursos para garantizar la sostenibilidad del almacenamiento y el modelo de negocio.

### A. Límites de Imágenes Universales
Para evitar el abuso del almacenamiento en Google Cloud Storage (GCS), se han establecido límites globales:
- **Guía de Estudio**: Máximo de **2 imágenes** por mazo.
- **Flashcards**: Máximo de **1 imagen por cara** (Anverso/Reverso).
- **Validación Dual**: El sistema valida estos límites tanto en el frontend (TinyMCE images_upload_handler) como en el backend (`DeckController`) con respuestas 400/403.

### B. Sistema de "Vidas" para Usuarios Free (Tier Pending)
Los usuarios sin suscripción activa consumen su saldo global de 20 vidas para las siguientes operaciones de gestión:
- **Operaciones de CRUD**: Crear mazo, editar mazo, añadir tarjetas, editar tarjetas.
- **Operaciones de IA**: La generación masiva de tarjetas con IA está **deshabilitada** para Free y Basic (exclusiva del Plan Avanzado).
- **Carga de Archivos**: Cada subida de imagen consume una vida.
- **Sincronización en Tiempo Real**: Tras cada acción exitosa, el sistema invoca `sessionManager.refreshUser()` para actualizar el contador de vidas en el header sin recargar la página.

### C. Modernización del Editor (TinyMCE 6)
- **Editor de Guías**: Integración de TinyMCE con soporte para tablas complejas (importadas de Word/Excel).
- **Control de Activos**: Seguimiento de imágenes de sesión (`sessionImages`). Si el usuario cancela la edición, el sistema elimina automáticamente de GCS las imágenes subidas durante esa sesión que no fueron persistidas.
- **Responsive Design**: Modal de guía optimizado para escritorio (1000px) y móviles, con scroll interno y barra de herramientas oscura.

### D. Cascada de Eliminación Progresiva
El método `deleteDeck` ahora recorre jerárquicamente la estructura de mazos, eliminando imágenes de:
1. La descripción (Guía) del mazo actual.
2. Las tarjetas contenidas.
3. Recursivamente, todos los sub-mazos y sus respectivas tarjetas.

---

## 4. Flujos de Datos Principales

### Creación de Tarjeta con Imagen
1. El usuario selecciona un archivo en el modal.
2. `repaso.js` envía el archivo a `POST /api/cards/upload-image`.
3. El backend optimiza a WebP y sube a Google Cloud Storage.
4. Se retorna la ruta GCS y se guarda en la base de datos junto con el contenido textual.

### Sincronización de Repaso
1. Durante el estudio, el usuario califica una tarjeta.
2. `flashcards.js` calcula localmente el progreso y lo envía a `POST /api/training/flashcards/review`.
3. El backend actualiza los parámetros SRS en la base de datos.

---

## 5. UX, Persistencia y Estabilidad (Mayo 2026 - Actualización Crítica)

Se ha realizado una reingeniería del flujo de navegación y persistencia para soportar estructuras de datos complejas y mejorar la resiliencia del sistema.

### A. Persistencia de Explorador Multinivel (8+ Niveles)
- **Restauración Recursiva**: Refactorización de `DeckExplorer` para soportar la reapertura automática de carpetas anidadas sin límite de profundidad. Se utiliza un `Set` en `localStorage` (`repaso_explorer_expanded`) para rastrear nodos abiertos.
- **Lazy Loading Sincronizado**: El sistema ahora espera la carga de hijos antes de intentar expandir niveles inferiores, garantizando que el árbol se reconstruya perfectamente tras un refresco de página.

### B. Navegación Inteligente (Smart Navigation)
- **Estrategia Push vs Replace**: `RepasoManager` ahora decide dinámicamente si añadir una entrada al historial (`pushState`) o sustituir la actual (`replaceState`).
  - **Navegación entre Hermanos**: Si el usuario salta entre mazos del mismo nivel, se usa `replace`.
  - **Navegación Profunda**: Si entra en una subcarpeta, se usa `push`.
- **Botón Atrás Optimizado**: Esta lógica permite que el botón "Atrás" del dispositivo funcione como un botón de "Subir un Nivel", evitando que el usuario tenga que retroceder uno a uno por todos los mazos visitados.

### C. Estabilidad y Blindaje de Red
- **Mitigación de Error 429**: Implementación de un **Throttling Atómico de 5 segundos** en `sessionManager.js`. Se bloquean ráfagas de peticiones de sincronización de Supabase/Google Auth, protegiendo al usuario de bloqueos por IP.
- **Integridad de Sesión de Estudio**:
  - Salida de flashcards mediante `window.location.replace()` para eliminar la página de estudio de la pila del historial, previniendo bucles infinitos al retroceder.
  - Resolución de errores de referencia global (`deckId` -> `currentDeckId`) para garantizar que el endpoint de estudio siempre sea válido.
  - Invalidadación de caché mediante versionamiento agresivo de scripts (`?v=v12`) en el HTML.

### D. Asistencia IA: Tutor Contextual (Modo Efímero)
- **Motor**: Gemini 2.5 Flash Lite para latencia mínima.
- **Personalidad de Mentor**: Evolución de "asistente conciso" a "tutor proactivo". El sistema ahora permite explicaciones extensas, ejemplos prácticos y expansión de conocimientos (gramática, dosis, etimología, etc.) aunque no estén en la tarjeta.
- **Contexto Dinámico**: El sistema inyecta el contenido de la tarjeta como punto de partida, pero el tutor utiliza su conocimiento interno completo para resolver dudas laterales.
- **Memoria de Sesión**: Historial volátil gestionado por el frontend que se resetea al cambiar de flashcard, manteniendo el enfoque en el tema actual.
- **Versatilidad Disciplinaria**: El tutor adapta su lenguaje y rigor técnico según la materia (Medicina, Educación, Derecho, Tecnología, etc.).
- **Descubrimiento de UX (Neon Glow Pulse)**: Animación sutil de borde neón (tonos azul/púrpura) y pulsación de brillo en el botón flotante al revelar la respuesta. Este diseño minimalista reemplaza al antiguo sistema de partículas, garantizando un TTI (Time To Interactive) óptimo en dispositivos móviles y guiando el ojo del usuario de manera no intrusiva.

### E. Visualización Adaptativa y Escena 3D
- **Layout de Seguridad**: Introducción del `study-header` para separar la navegación (Volver/Pendientes) del área de estudio, evitando colisiones en móviles.
- **Escalado Inteligente (Fitting)**: Algoritmo en `flashcards.js` que ajusta el tamaño de fuente (0.9rem a 2.8rem) basándose en la densidad de caracteres y la presencia de imágenes 9:16.
- **Scroll de Alta Accesibilidad**: Configuración de Flexbox para garantizar que el texto largo siempre sea legible desde el inicio en celulares, manteniendo el centrado vertical en textos cortos.

### F. Generación Multidisciplinar Adaptativa
- **Motor de IA Multidominio**: El prompt maestro en `flashcardService.js` ha sido refactorizado para aplicar estrategias pedagógicas específicas según el área:
    - **Medicina**: Enfoque en razonamiento clínico, síntomas y diagnósticos diferenciales (Juicio clínico vs. Definición).
    - **Educación**: Enfoque en teorías del aprendizaje, gestión de aula y estrategias aplicadas para docentes.
- **Active Recall Reforzado**: Todas las generaciones fuerzan el formato "Disparador Mental" -> "Respuesta Atómica", optimizando la retención a largo plazo.

### G. Seguridad, Monetización y Control de Cuotas (V16)
- **Escudos de Caracteres (Safety Caps)**:
    - **Límite de Texto**: Restricción estricta de **400 caracteres** por cara para garantizar tarjetas atómicas y evitar el almacenamiento de documentos extensos.
    - **Límite de Síntesis (TTS)**: Para optimizar costos de Google Cloud, el audio premium solo procesa los primeros **500 caracteres** de cada cara.

- **Política de Consumo de Vidas (Usuarios Free)**:
    El sistema aplica una filosofía de **"Mantenimiento Gratuito vs. Valor de Pago"**:
    - **Acciones Gratuitas (0 Vidas)**: 
        - Edición de texto en tarjetas existentes.
        - Gestión de metadatos de mazo (Renombrar, cambiar icono o color).
        - Eliminación de tarjetas o mazos.
        - Reordenamiento de tarjetas.
    - **Acciones de Pago (1 Vida)**:
        - **Creación**: Nuevo mazo (incluye sub-mazos/carpetas) y nuevas tarjetas individuales.
        - **Estudio**: Inicio de sesión de estudio ("Estudiar Ahora") y revisión de tarjetas individuales (botón Play).
        - **Valor Agregado**: Guardado de **Guía de Estudio** (Descripción enriquecida) y Generación de tarjetas con IA (Gemini).

- **Restricciones Premium (Planes Pagados)**:
    - **Carga Masiva (Excel)**: Función **exclusiva para usuarios Premium**. Los usuarios Free tienen el acceso bloqueado tanto en la interfaz (UI) como en la API para proteger la integridad operativa del sistema de importación masiva.

- **Validación Preventiva**: El frontend (`repaso.js`) audita el contenido antes de la subida, proporcionando feedback inmediato sobre límites de caracteres o cuotas de vida insuficientes.

### H. UX Discovery y Micro-interacciones (Tutor IA)
- **Efecto Neon Glow Pulse**: Animación optimizada por hardware (CSS keyframes) que aplica un resplandor de neón vibrante al botón del Tutor al girar la flashcard. Se eliminó la inyección de partículas en el DOM para favorecer la fluidez de renderizado a 60fps en smartphones, manteniendo la alta visibilidad requerida.
- **Efecto Shimmer**: Animación de resplandor sutil en la interfaz de chat para indicar actividad y guiar el enfoque del usuario hacia las herramientas de soporte.

### I. Optimizaciones de Alto Rendimiento y Ruteo (V15 - Mayo 2026)
- **Higiene de Enrutamiento (Client-Side Routing)**: Se ha corregido la contaminación del historial de navegación que ocurría durante el arranque de la aplicación (Deep Linking y restauraciones BFCache). La función `init()` y las ediciones de tarjetas ahora utilizan cargas silenciosas (`pushState=false`), evitando inyectar estados basura.
- **Salida de Sesión Nativa**: La función de salida en el modo estudio (`handleExit`) ha abandonado las redirecciones duras. Ahora evalúa el `document.referrer` y utiliza un `window.history.back()` nativo, garantizando que el usuario regrese impecablemente al nivel exacto del mazo sin duplicar páginas en el historial.
- **Resolución de Condición de Carrera (Última Tarjeta)**: Se implementó una barrera asíncrona (`await syncPromise`) en la calificación de la última flashcard de la cola. Esto fuerza al sistema a esperar que la base de datos confirme la revisión antes de pedir la siguiente tanda, erradicando el bug de repetición de tarjetas.
- **Renderizado por Lotes (DocumentFragment)**: Las cuadrículas de mazos masivos (`renderDeckCards` y `renderCommunityDecks`) fueron refactorizadas para ensamblar las tarjetas en memoria temporal (`DocumentFragment`) antes de inyectarlas al DOM en una sola operación. Esto elimina el bloqueo del hilo principal y reduce los costosos cálculos de *reflow/repaint* del navegador al mínimo.

### J. Arquitectura Lite y Optimización de Red (V17 - Mayo 2026)
- **Data Thinning (Lazy Loading)**: Refactorización del modelo de datos para excluir el campo `description` (Guía de Estudio) de todas las consultas de listado. El contenido enriquecido ahora se carga bajo demanda mediante el endpoint `/api/decks/:id/guide` solo cuando el usuario abre el modal correspondiente.
- **Shared Request Pool**: Implementación de un gestor de promesas compartidas en el frontend para evitar peticiones duplicadas durante el arranque de la aplicación (Barra lateral y Dashboard compartiendo el mismo flujo de datos).
- **Optimistic UI Updates**: Mejora de la percepción de velocidad mediante la actualización inmediata del DOM en acciones de edición y renombrado, sincronizando con la base de datos en segundo plano.

### K. Arquitectura BFCache y Eliminación N+1 (V18 - Mayo 2026)
- **Renderizado Declarativo y Centralización de Estado**: Se erradicó el anti-patrón N+1 y se desacopló completamente la lógica del DOM en el Explorador de Mazos. El componente ahora opera bajo un modelo de 'Estado Único' (Flat Tree en memoria), donde la función `toggleNode` solo muta datos y el método `renderTree` proyecta esos datos al HTML de forma síncrona. Esto garantiza una consistencia visual absoluta y latencia de 0ms en la expansión de carpetas profundas.
- **BFCache Network Resiliency**: Para solucionar errores críticos en navegadores móviles (iOS/Android) que suspenden las conexiones TCP al usar el botón "Atrás" (BFCache), se inyectó un `Delay Resiliente` (400ms) en el evento `pageshow`.
- **Soft Fallback Global (NetworkService)**: La lógica repetitiva de manejo de desconexiones fue centralizada en `NetworkService.js`. El servicio ahora intercepta de forma transparente excepciones de red puras (`Failed to fetch`) y aplica un reintento inteligente y silencioso a los 800ms, blindando toda la aplicación contra cortes momentáneos de conectividad sin perturbar la UI.

### L. Reingeniería Visual y Separación de Categorías (Junio 2026)
- **Separación de Mazos (Tabs):** Se dividió la vista raíz del Centro de Repaso en dos pestañas ("Mazos Oficiales" para mazos del sistema `type === 'SYSTEM'` y "Mis Mazos Creados" para mazos personales del usuario).
- **Control de Escritura Contextual:** El botón de creación (`+ Crear Mazo`) ahora se oculta de forma dinámica en la pestaña "Mazos Oficiales" y en cualquier subcarpeta dentro de un mazo del sistema, evitando operaciones de guardado accidentales o erróneas en el contenido oficial.
- **Skins Personalizados (deck.webp):** Se implementó la imagen de brújula premium `deck.webp` como fondo universal de las tarjetas de mazo (`.deck-card`), usando una máscara de gradiente oscuro que se aclara sutilmente al hacer hover (revelando más detalles del cuero y patrón de la skin) mientras mantiene la legibilidad total del texto. Las tarjetas de creación (`.add-deck-card`) se mantuvieron sin imagen (dashed) para fácil contraste visual.
- **Visualización Adaptativa en Celulares:** En pantallas móviles (<= 768px), los mazos cambian dinámicamente de un formato de bloque cuadrado 1:1 a filas/listas horizontales fluidas. La imagen de fondo se adapta a un gradiente horizontal que ilumina el centro de la fila donde se ubica el icono de la brújula y asegura legibilidad en los costados.
- **Simplificación y Depuración de Colores:** Se eliminó por completo la opción de asignar colores personalizados a los mazos, removiendo el color selector tanto del HTML como del JS (`DeckExplorer.renderColorPicker`) para favorecer un aspecto limpio y cohesivo sustentado en el skin general. Se eliminaron los bordes de color laterales del dashboard.
- **Contenedor Stacked Deck (Efecto Baraja):** En el modo de estudio, se eliminó la deformación de perspectiva 3D al girar la flashcard (efecto plano de giro) y se añadió un efecto de baraja física (múltiples capas de cartas apiladas) al contenedor `.scene` mediante sombras multinivel superpuestas, además de un borde suave de alto contraste.
- **Sincronización en Tiempo Real:** Se optimizó `invalidateCache()` para borrar completamente el pool de promesas compartidas (`this._sharedRequests.decks`) y la memoria local del explorador en cualquier operación de escritura (Creación, Edición, Eliminación y cambio de Visibilidad). Esto erradica el problema de retardo de 5 segundos de caché y garantiza actualizaciones instantáneas en el DOM.
- **Diferenciación Visual y Resaltado en el Explorador:** Se eliminó la inyección de iconos de texto para evitar la sobrecarga visual. En su lugar, se implementó un sistema de clasificación limpio por bordes izquierdos coloreados y fondos sutiles: Mazos Oficiales (borde verde), Mazos Clonados de la comunidad (borde púrpura), Mazos públicos del usuario (borde azul), y Mazos personales privados (borde gris pizarra). El enlace de raíz **Comunidad** se resalta especialmente con un fondo degradado azul a púrpura translúcido y bordes luminosos de acento.

### M. Rediseño del Modal de Tarjetas y Brillo Invitación (Junio 2026 - V19)
- **Separación Visual de Caras (Anverso y Reverso):** Para eliminar la confusión y guiar intuitivamente al usuario en la creación de tarjetas, se estructuró la sección individual del modal en dos contenedores independientes:
    - **Frente (Anverso/Pregunta):** Con borde azul translúcido (`rgba(59, 130, 246, 0.18)`) y foco con brillo azul suave.
    - **Dorso (Reverso/Respuesta):** Con borde púrpura translúcido (`rgba(139, 92, 246, 0.18)`) y foco con brillo morado suave.
- **Grilla de Controles Alineada:** Los controles de audio TTS (Generación y Selector de Idioma) y de visibilidad de texto se reordenaron en filas internas (`.settings-row`) con bordes divisorios delgados.
- **Sincronización Dinámica de Voces TTS:** Implementación del método `syncTtsLanguageSelectors()` que habilita/deshabilita el selector de voz y ajusta su opacidad (`.settings-lang-select-container.enabled`) de forma dinámica en base al estado activo del checkbox "Generar audio TTS". Se dispara en eventos de cambio, al limpiar el modal (`_clearCardModal`) y al editar (`openEditCardModal`).
- **Botón con Brillo Invitación:** Se añadió la clase `.btn-add-card-glow` al botón dinámico "+ Añadir Tarjeta" en `repaso.js`, aplicando una animación infinita de box-shadow azul translúcido (`@keyframes btn-pulse-glow`) para incentivar e indicar al usuario de forma clara el punto de acción para crear nuevas tarjetas.
- **Corrección de Giro en Flashcards (Efecto Reflejado):** Al remover el efecto de profundidad perspectiva 3D en el sprint anterior, se eliminó accidentalmente la propiedad `transform-style: preserve-3d;` en la clase `.card` de `flashcards.css`. Esto causaba que las caras de la tarjeta se aplanaran, impidiendo que `backface-visibility: hidden` ocultase el reverso de la cara frontal al rotar la tarjeta, mostrando la pregunta reflejada horizontalmente. Se restauró `transform-style: preserve-3d;` a `.card` para solucionar este comportamiento regresivo sin reintroducir la distorsión de perspectiva de cámara exagerada.

### O. Vista Inicial de Comunidad y Rediseño Neón de Tarjetas (Agosto 2026 - V21)
- **Ruteo Contextual por Estado de Sesión:**
  - **Visitantes (Sin Sesión):** Al ingresar al módulo Repaso cargan por defecto la vista **Comunidad** para visualizar el contenido público. Si hacen clic en "Mis Mazos", el sistema renderiza un banner responsivo (`renderGuestMisMazosBanner`) con un llamado a la acción persuasivo que explica los beneficios de registrarse (crear mazos, carpetas, tarjetas con IA y sincronización multi-dispositivo) con botones para crear cuenta o volver a Comunidad.
  - **Usuarios Logueados:** Al ingresar o recargar la página (`F5`), el sistema respeta la navegación estándar y la última vista activa persistida (`localStorage.getItem('repaso_active_view')`), garantizando que si estaban trabajando en "Mis Mazos" o dentro de una carpeta `deckId`, permanezcan exactamente en dicha sección sin forzar redirecciones.
- **Refinamiento de Iluminación de Tarjetas (`.deck-card`):** Se pulió el resplandor de las tarjetas estableciendo un fondo negro mate puro (`#09090b`), limitando el destello neón a la esquina superior derecha (`60px` de radio) para mantener la legibilidad de la tipografía y los botones de acción sin sobrecarga de color.
- **Resaltado Seleccionado en Explorador (`node-community`):** Se eliminó el fondo azul y borde permanente de la opción "Comunidad" en el Explorador lateral (`deck-explorer.js` / `repaso.css`). El elemento mantiene un estado neutro en reposo y activa su resplandor azul únicamente cuando está seleccionado (`.active`) o en hover (`:hover`).
- **Homogeneización de Proporciones:** Se igualaron al 100% las proporciones, padding e insignias entre Comunidad y Mis Mazos.

### P. Clasificación por Áreas Temáticas y Filtrado en Comunidad (Agosto 2026 - V22)
- **Persistencia en Base de Datos**: Se incorporó la columna `category` (`VARCHAR(50) DEFAULT 'General'`) e índice optimizado `idx_decks_public_category` en la tabla `decks`.
- **Estructura por Capas**:
  - `domain/`: Repositorio (`flashcardRepository.js`) y servicio (`deckService.js`) actualizados para crear, editar, listar y filtrar mazos por temática (`Medicina`, `Educación`, `Matemáticas`, `Historia`, `Derecho`, `Ciencia`, `Tecnología`, `General`).
  - `application/`: `deckController.js` procesa el filtro de categoría en `getPublicDecks`, `createDeck`, `updateDeck` y `toggleVisibility`.
  - `presentation/`: Se inyectó una barra de filtrado por pills (`.community-category-bar`, `.category-pill`) en la vista **Comunidad** para filtrado en tiempo real sin recargar la página. Modal de creación/edición de mazos y confirmación de publicación actualizados con selector de temática responsivo y estilizado.
- **Formato Visual Profesional**: Insignias de temática (`.deck-category-tag`) con tipografía estilizada, alineación responsiva y diseño sobrio sin saturación de bordes o efectos invasivos.

- **Ajustes de Tipografía en Blanco Puro y Responsividad (V23)**:
  - **Títulos en Blanco Puro**: Se forzó el color blanco brillante (`#f8fafc` / `#ffffff !important`) en los títulos de mazos (`.deck-card h3`) y en todos los ítems del árbol del Explorador (`.tree-content .tree-label`), sustituyendo tonos grises u opacos por una tipografía nítida y legible.
  - **Márgenes Simétricos en PC**: Se ajustó `.explorer-container` y `#deck-content-area` (`padding-right: 2rem; box-sizing: border-box;`) garantizando una separación limpia y constante con el borde derecho de la pantalla en ordenadores.
  - **Control de Desbordamiento y Desplazamiento Autónomo de Píldoras**:
    - Móviles: `touch-action: pan-x;`, `overscroll-behavior-x: contain;` y manejadores `touchstart`/`touchmove` autónomos permitiendo deslizar las píldoras horizontalmente sin arrastrar la ventana principal.
    - PC: Manejador `wheel` integrado para desplazar las píldoras horizontalmente usando la rueda del ratón.
- **Implementación Estricta de la Escala Negro Mate Puro (V25)**:
  - **Corrección de Documentación (`DESIGN_SYSTEM.md`)**: Se eliminaron las referencias a tonos azulados de elevación (`#0f172a`, `#0d1424`, `#0d131f`), declarando de forma estricta la paleta **Pure Matte Black Scale** (`#050505` para el cuerpo principal, `#0a0a0a` para tarjetas y modales sólidos, y `#121212` / `#18181b` para inputs y sub-tarjetas).
  - **Overlay Semi-Transparente con Backdrop Blur**: Se configuró `.modal-overlay` a `background: rgba(0,0,0,0.75)` con `backdrop-filter: blur(12px) saturate(160%)`, permitiendo visualizar de manera sutil y elegante la página difuminada detrás del modal, manteniendo el cuerpo modal (`.modal-content`) 100% nítido, sólido e inalterado en `#0a0a0a`.
  - **Reestructuración de "Estadísticas del Mazo" (`stats-modal`)**:
    - Se dividió el contenido en `.modal-header`, `.modal-body` (con scroll suave autónomo) y `.modal-footer`, resolviendo el recorte del cuadro explicativo SRS y el gráfico.
- **Explorador Colapsable, Iconos Blanco Puro y Secciones Estandarizadas de Submazos / Tarjetas (V26)**:
  - **Explorador Colapsable Responsivo**: Se añadió soporte para contraer/desplegar el panel lateral del Explorador mediante el botón `#btn-toggle-explorer` (`fas fa-columns` / `fas fa-bars`), con persistencia en `localStorage`.
    - **PC (Escritorio > 768px)**: Colapso horizontal suave a un ancho compacto de `68px`, ocultando las etiquetas de texto y dejando los iconos centrados y accesibles.
    - **Móvil (<= 768px)**: Colapso vertical del árbol de mazos a una barra de encabezado de `56px` sin tapar la pantalla.
  - **Eliminación de Fondos Azules y Colores Saturados**:
    - Se erradicaron los fondos de selección azul/naranja/púrpura (`rgba(59,130,246,0.2)`) en el árbol del explorador, reemplazándolos por un resaltado sobrio mate neutro (`background: rgba(255,255,255,0.08)`, `border-left: 3px solid #ffffff`).
    - Todos los iconos de mazos dentro del Explorador lateral se renderizan en **Blanco Puro (`#ffffff`)** evadiendo la saturación cromática.
  - **Estructura de Secciones Uniformes en Vista de Mazo (`#folder-view`)**:
    - **Sección SUB-MAZOS**: Encabezado sobrio con flecha desplegable (`fas fa-chevron-down`/`right`) y botón directo `+ Crear Submazo` (`DeckExplorer.openCreateModal(parentId)`).
- **Optimización de Jerarquía Visual del Explorador y Eliminación de Botón Redundante (V27)**:
  - **Jerarquía y Contraste de Mazos**:
    - Mazos no seleccionados: Texto e icono atenuados en tono sobrio slate (`#94a3b8` / `opacity: 0.85`), coincidiendo con el estilo del menú lateral global.
    - Mazo activo seleccionado: Resaltado en blanco brillante puro (`#ffffff !important; font-weight: 700`), fondo mate sutil (`rgba(255,255,255,0.08)`) y borde indicador lateral en blanco (`3px solid #ffffff`).
    - Estado hover: Transición fluida a `#f1f5f9`.
  - **Alineación Vertical al Contraer en PC**:
    - Al contraer horizontalmente el Explorador en PC (`.explorer-sidebar.is-collapsed`), los submazos anidados secundarios se ocultan (`display: none !important`), alineando de manera limpia y vertical únicamente los iconos de mazos raíz principales y apilando verticalmente los botones de acción (`+` y `[|]`).
  - **Depuración de Botón Duplicado**:
- **Perfeccionamiento de Contraste, Barra de Iconos de Acción en PC y Corrección del Colapso de Tarjetas (V28)**:
  - **Atenuación Estricta de Textos / Títulos No Seleccionados**:
    - Se eliminaron las reglas de blanco forzado en el árbol del explorador (`dashboard.css` y `repaso.css`).
    - Todos los títulos de mazos no seleccionados adoptan el tono atenuado **Slate** (`#94a3b8` / `opacity: 0.8`), idéntico al menú desplegable principal de la plataforma.
    - Únicamente el mazo activo seleccionado adquiere **Blanco Puro Brillo** (`#ffffff !important; font-weight: 700; opacity: 1`).
  - **Barra de Iconos Ultralimpia al Contraer en PC**:
    - Al contraer el Explorador en ordenadores (`.explorer-sidebar.is-collapsed`), se oculta completamente el árbol (`#deck-tree { display: none !important; }`), mostrando únicamente una barra lateral estilizada de `68px` con los botones de acción centrados verticalmente (`+ Crear Mazo` y `[=] Desplegar Explorador`).
- **Corrección de Maquetación Responsiva para el Explorador Contraído en Celulares (V29)**:
  - Se separaron de forma estricta los estilos de colapso en `@media (min-width: 769px)` (Escritorio) y `@media (max-width: 768px)` (Móvil).
  - En móviles (`max-width: 768px`), al estar la barra del Explorador en estado contraído:
    - La cabecera `.explorer-sidebar-header` se mantiene en fila horizontal (`flex-direction: row; justify-content: space-between; align-items: center; width: 100%;`).
    - El título `"EXPLORADOR"` permanece perfectamente visible a la izquierda (`display: block !important; font-size: 0.85rem; color: #94a3b8;`).
    - Los botones de acción (`+` y `[=]`) se posicionan uno al lado del otro en una fila horizontal estilizada a la derecha.
- **Persistencia de Píldora de Categoría Activa en la Sección Comunidad (V30)**:
  - **Preservación del Filtro de Categoría**:
    - Se actualizó el parámetro por defecto de `loadCommunity(pushState, category)` y `renderCommunityDecks(page, category)` en `repaso.js`.
- **Alineación Estricta con el Design System (Purga Cromática Azul y Estandarización Negro Mate / Naranja - V31)**:
  - **Reestructuración de Superficies de Modales**:
    - Se erradicaron todos los fondos azulados oscuros (`rgba(15, 23, 42, ...)` y `rgba(30, 41, 59, 0.5)`).
    - En el modal `preview-deck-modal`, las tarjetas internas de previsualización adoptan la superficie estándar **Dark Slate Matte** (`#121212` con borde `1px solid rgba(255, 255, 255, 0.08)`).
    - En `deck-guide-modal`, el contenedor de la guía de estudio pasa a superficie `#121212`.
    - En `.modal-card-face`, los anversos de tarjetas se actualizaron a superficie `#121212` con enfoque en acento Naranja (`rgba(249, 115, 22, 0.25)`).
  - **Estandarización de Insignias y Componentes**:
    - **Insignias de Categorías (`.deck-category-tag`)**: Actualizadas a fondo naranja translúcido (`rgba(249, 115, 22, 0.12)`), borde (`rgba(249, 115, 22, 0.25)`) y texto `#ff9f43`.
    - **Insignias de Audio y Spinners**: Spinners y badges pasaron de azul (`#60a5fa`) a la paleta viva de marca Naranja (`#f97316` / `#ff9f43`).
- **Manejadores Directos de Apertura de Modal para Mazos Compartidos de la Comunidad (V32)**:
  - **Asignación Robusta de Eventos DOM**:
    - Se reemplazaron los atributos de maquetación HTML inline (`onclick="..."`) en las tarjetas de la comunidad por asignaciones directas de manejadores de eventos en el DOM (`card.onclick = () => this.previewPublicDeck(deck.id, deck.name)`).
    - Se eliminaron los fallos silenciosos provocados por comillas simples o dobles no escapadas en títulos de mazos con caracteres especiales o signos de puntuación.
- **Corrección Integral de Botones de Mazos y Apertura de Modales de Edición, Eliminación y Guía (V33)**:
  - **Eliminación de Errores por Cadenas de Plantilla HTML Inline**:
    - Se reemplazaron las llamadas `onclick="..."` embebidas en los botones de acción (`Editar`, `Eliminar`, `Estudiar`, `Demo`) por clases explícitas (`btn-act-play`, `btn-act-edit`, `btn-act-delete`, `btn-act-demo`) y delegación DOM en `renderDeckCards`.
    - Se eliminó el error de sintaxis provocado al inyectar descripciones o títulos con caracteres especiales, comillas o bloques de código dentro de atributos HTML en línea.
  - **Apertura Universal de Modal de Guía (`openGuideModal`)**:
- **Corrección Estructural de HTML en Modales y Alineación Cromática de Cabecera de Mazo (V34)**:
  - **Corrección de Etiqueta `div` Duplicada en Modal de Edición/Creación**:
    - Se reparó en `repaso.html` un `div` duplicado sin cerrar en `create-deck-modal` que provocaba el desplazamiento o desconfiguración lateral de los modales de edición.
  - **Actualización de Botones de Cabecera (`renderFolderHeader`)**:
    - Se actualizaron los botones principales ("Estudiar Ahora", "Hacer Público") de azul (`#3b82f6`) al degradado oficial Naranja Manta (`linear-gradient(135deg, #f97316 0%, #ea580c 100%)`) con sombra `box-shadow: 0 4px 15px rgba(249, 115, 22, 0.35)`.
- **Especialización Multidisciplinaria del Chat Tutor de Repaso y Cero Contaminación Temática (V35)**:
  - **Inyección Estructurada de Metadatos de Mazo y Flashcard**:
    - `flashcards.js` y `tutor-chat.js` capturan y transmiten el contexto integral: `deckCategory` (*Derecho*, *Tecnología*, *Medicina*, *Educación*, etc.), `deckName`, `topic`, `front`, `back`, `imageUrl` y `explanationImageUrl`.
  - **Preservación de Especialización en `chatController.js`**:
    - Se aisló la especialización `flashcard_tutor` impidiendo que sea aplanada a medicina.
    - Se estructura el prompt con mentalidad, doctrina y marco conceptual adaptado a la materia real del mazo.
  - **Aislamiento Doctrinal y Erradicación de Frases Médicas/Cursos**:
    - Se eliminó del system prompt y del servicio de IA cualquier descarte genérico sobre consultas médicas o catálogos en materias ajenas como Derecho.
    - En `buildPrompt` (`chatPrompts.js`), se aisló la construcción de `flashcard_tutor` y `neutral` para no inyectar directrices clínicas del MINSA/GPC.
- **Categoría 'Tecnología' y Corrección UX en Barra de Píldoras de Comunidad (V36)**:
  - **Nueva Categoría Temática Multidisciplinaria**:
    - Se incorporó la categoría `Tecnología` (que engloba programación, computación, redes, inteligencia artificial y desarrollo de software) con icono `fas fa-laptop-code` / 💻.
    - Se añadió `Tecnología` a `CATEGORIES` en `repaso.js`, en `#new-deck-category` (`repaso.html`), en `#publish-deck-category` y en `ICON_OPTIONS` (`deck-explorer.js`).
    - Se expandió el soporte del Tutor IA en `chatController.js` y `chatPrompts.js` para fundamentar en arquitectura de software, algoritmos y código limpio.
  - **Corrección Integral de UX en la Barra de Filtros de Comunidad**:
    - Se eliminó el reseteo abrupto del scroll horizontal a "Todas" al seleccionar píldoras lejanas: `renderCommunityDecks` ahora actualiza de forma reactiva la clase `.active` en el DOM sin destruir `.community-category-bar`.
    - Se incorporó `activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })` para mantener la píldora seleccionada centrada y visible en pantalla.
- **Optimización de Carga Masiva Excel, Control de Costos TTS/Media y Seguridad de Mazos (V38)**:
  - **Ampliación de Límites de Tarjetas y Texto**:
    - Se aumentó la capacidad de tarjetas por archivo Excel de `50` a **`100 tarjetas`**.
    - Se amplió el límite de caracteres por cara de tarjeta a **`1,000 caracteres`** para flashcards de texto puro.
    - Se implementó un límite condicional estricto de **`500 caracteres`** por cara cuando se activa la generación de Audio TTS para preservar el presupuesto y cuota gratuita de Google Cloud Text-to-Speech.
  - **Políticas de Privilegios y Control de Costos Multimedia (GCS / TTS)**:
    - **Audio TTS e Imágenes Exclusivas del Plan Advanced**: La síntesis de voz (`_processAudioTts`) y la carga de imágenes (`uploadCardImage`, `POST /api/cards/upload-image`) están estrictamente reservadas para usuarios con tier `advanced`, `elite` o `admin`.
    - **Protección Paywall y Fallback Seguro**: Usuarios Free y Basic son interceptados visualmente con `window.uiManager.showPaywallModal(..., 'flashcards')` y protegidos en backend con código HTTP `403 Forbidden` (`paywall: true`).
    - **Cuotas de Carga Masiva Diarias**: `LIMITS.basic.batch_import = 3` (texto puro) y `LIMITS.advanced.batch_import = 10` (con opción de audio TTS), bloqueando cuentas Free para prevenir abuso de scripts.
  - **Armonización Visual y Consistencia de Diseño (Design System Negro Mate & Naranja Manta)**:
    - **Erradicación de Azules Residuales**: Se depuraron y sustituyeron todas las clases con sombras o fondos azules (`rgba(59, 130, 246)`, `#3b82f6`, `#60a5fa`) en pestañas activas (`.repaso-tab-btn.active`), barras de progreso (`.progress-bar-fill`), insignias de usuario (`.badge-user`), enlaces de migas de pan (`.crumb-link`), animaciones de vencimiento (`.is-due-glow`), selectores de checkboxes (`accent-color: #f97316`) y áreas de arrastrar/soltar (`.btn-upload-minimal`).
    - **Consistencia en Modales**: Se homogeneizó la estética de los modales (`#create-deck-modal`, `#stats-modal`, `#card-modal`, `#ai-modal`, `#preview-deck-modal`, `#deck-guide-modal`) con fondo negro mate sólido `#0a0a0a`, bordes sutiles `rgba(255, 255, 255, 0.08)`, bordes redondeados y títulos/acentos en Naranja Manta `#f97316` / `#ff9f43`.
    - **Sombreado e Iluminación Coherente**: Los botones primarios y tarjetas interactivas cuentan con resplandores calibrados `box-shadow: 0 4px 15px rgba(249, 115, 22, 0.35)` sin contaminación cromática.
  - **Sincronización Comercial y Planes (Landing y Pricing)**:
    - Se actualizaron las secciones de precios en [index.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/index.html) y [pricing.html](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/pricing.html) para destacar:
      - **Plan Básico**: Flashcards manuales ilimitadas y carga masiva Excel (3 archivos/día).
      - **Plan Avanzado**: Flashcards manuales personalizadas con Audio TTS e imágenes, Carga masiva Excel con Audio TTS (10 archivos/día) y Generación con IA (30 pedidos/mes).
    - Se actualizó el documento maestro [SISTEMA_MONETIZACION_LIMITES_Y_SUSCRIPCIONES.md](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/documentation/SISTEMA_MONETIZACION_LIMITES_Y_SUSCRIPCIONES.md).

- **Ordenación Cronológica de Publicación en Comunidad y Auditoría de Salud de Código (V39)**:
  - **Ordenamiento Prioritario por Fecha de Publicación/Modificación**:
    - Se actualizó `FlashcardRepository.getPublicDecks` para realizar el ordenamiento con `ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.created_at DESC`.
    - Al publicar un mazo en la comunidad o cambiar su visibilidad/categoría (`updateDeckVisibility`), el servidor actualiza la marca de tiempo `updated_at = NOW()`.
    - Esto garantiza de forma consistente en todas las categorías ("Todas", "Medicina", "Tecnología", "Educación", "Derecho", etc.) que cualquier mazo recién publicado o editado se ubique inmediatamente en el **primer lugar (índice 0)** de la cuadrícula de la comunidad.
  - **Auditoría de Salud de Código y Limpieza de Arquitectura**:
    - Se removió la importación no utilizada `crypto` en `FlashcardRepository.js` de acuerdo con las directrices de `code-health-rules.md`.
    - Se sincronizó el esquema `database_schema.sql` declarando la columna `updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()` e incorporando el índice de alto rendimiento `idx_decks_public_category` sobre `(is_public, category, updated_at DESC, created_at DESC)`.
  - **Verificación de Pruebas Unitarias**:
    - Se añadieron casos de prueba en `deckSecurityLimits.test.js` para verificar la llamada de `getPublicDecks` por categoría y la actualización con `updated_at`.
    - 17/17 suites de prueba pasando (123/123 pruebas al 100%).

- **Posicionamiento Inteligente del Tour Guía y Depuración de KPIs de Mazos (V40)**:
  - **Algoritmo de Posicionamiento Anti-Solapamiento en Tour Guía**:
    - Se refactorizó `positionHint` en `tooltipManager.js` calculando la intersección del área rectangular (`overlapArea`) entre la tarjeta flotante del tooltip y el elemento objetivo en pantalla.
    - Evalúa iterativamente las posiciones candidatas (`bottom`, `top`, `right`, `left`), seleccionando automáticamente la variante con **cero solapamiento (0px de obstrucción)**.
    - Se ajustaron los selectores en `startRepasoTour` para apuntar a la cabecera `.explorer-sidebar-header` en el Paso 2 (evitando cubrir el árbol de carpetas o el botón "EXPLORADOR" en móviles y escritorios).
    - Se incorporó `targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })` para garantizar el centrado óptimo del elemento objetivo en pantalla antes de calcular coordenadas.
  - **Depuración y Purificación de Analíticas/KPIs de Mazos**:
    - Se desvinculó la tabla `quiz_history` (simulacros/exámenes culminados de Salud y Educación) de la generación de analíticas de mapas de actividad del módulo de repaso en `analyticsRepository.js` y `analyticsService.js`.
    - Se habilitó la filtración contextual por `deckId` en `/api/analytics/heatmap?deckId=...`, permitiendo que el modal de estadísticas (`openStatsModal` en `repaso.js`) contabilice exclusivamente las tarjetas repasadas (`user_flashcards`) del mazo seleccionado.

- **Corrección de Permisos de Subida de Imágenes para Usuarios Advanced y Manejo Limpio de Paywall (V41)**:
  - **Identificación de Tier de Usuario en `_getUserContext`**:
    - Se refactorizó `_getUserContext` en `deckController.js` para extraer `req.user?.subscriptionTier` (propiedad camelCase mapeada por `User` domain model), garantizando que los usuarios con plan `advanced` o rol `admin` sean reconocidos correctamente con `isAdvanced = true`.
    - Resuelve el error 403 en `POST /api/cards/upload-image` donde usuarios Advanced eran tratados erróneamente como plan `free`.
  - **Manejo Amigable de Errores y Modal de Suscripción**:
    - Se actualizó `_uploadFileToGCS` en `repaso.js` y `deck-explorer.js` para extraer el mensaje explicativo del servidor (`data.error`) y mostrar el modal oficial de pago `showPaywallModal(errMsg, 'flashcards')`.
    - Se evitó la emisión de notificaciones redundantes o erróneas de "Créditos agotados" o "Error de red" al presentar la oferta de membresía.

- **Auditoría de Transmisión del Contexto al Tutor IA y Extensión a 12k Caracteres (V42)**:
  - **Soporte de Contexto Completo y Ampliación de Longitud**:
    - Se actualizó `LIMITS.CONTEXT_TEXT = 12000` en `securityUtils.js` y `tutorAiService.js` para evitar truncamientos en la inyección de prompts de tarjetas de repaso.
    - Se añadieron metadatos multimedia (`audioUrlFront`, `audioUrlBack`, `hideTextFront`, `hideTextBack`) en `flashcards.js`, `tutor-chat.js` y `chatController.js`.
  - **Preservación de Categoría en Estudio Individual**:
    - Se actualizó `repaso.js` para transmitir `deckName` y `category` codificados al iniciar estudio directo de una tarjeta individual (`/flashcards?deckId=...&cardId=...`), asegurando que el Tutor IA opere en la disciplina exacta del mazo.
  - **Limpieza de Código y Confiabilidad (Code Health)**:
- **Auditoría Integral de Seguridad, Categoría Idiomas Compartible y Modernización Esbelta de Mazos (V43)**:
  - **Blindaje contra IDOR en Manipulación de Tarjetas**:
    - Se incorporó la validación obligatoria de propiedad del mazo (`deck.user_id === userId`) en `DeckService.addCard`, `DeckService.addBulkCards` y `deckController.generateCards`.
    - Respuestas HTTP 403 inmediatas cuando un usuario autenticado intenta inyectar tarjetas individuales, lotes masivos o generaciones IA dentro de mazos ajenos.
  - **Preservación de Categoría Temática en Clonación**:
    - Se actualizó `DeckService.cloneDeck` para transmitir `deck.category || 'General'` a `createDeck`, evitando que los mazos clonados desde la comunidad caigan erróneamente en `'General'`.
  - **Nueva Categoría "Idiomas" y Filtro Compartible en Comunidad**:
    - Incorporación de `'Idiomas'` en el backend (`DECK_CATEGORIES` en `deckController.js`), selects de creación/edición (`repaso.html`), picker de iconos (`fas fa-language` en `deck-explorer.js`) y modal de publicación (`#publish-deck-category`).
    - Soporte completo para **Deep Linking**: `repaso.js` lee `?category=...` desde la URL al inicializarse y sincroniza `window.history.replaceState` reactivamente al seleccionar píldoras.
    - Se añadió el botón minimalista *"Compartir Filtro"* en el banner de comunidad para copiar la URL filtrada directamente al portapapeles con toast de confirmación.
  - **Rediseño Esbelto y Conforme al Sistema de Diseño (`DESIGN_SYSTEM.md`)**:
    - **Cabecera de Mazo Fluida y Ergonómica en Móvil y PC**: Eliminación de la columna lateral rígida de 64px (`.deck-icon-large`). Integración de un badge de icono compacto (`.deck-title-icon-badge`, 28-32px) directamente al lado del título `<h1>`, otorgando el 100% del ancho horizontal disponible al título, metadatos y botones de acción.
    - **Principio de Sobriedad Visual (Sección 7 DESIGN_SYSTEM.md)**: Erradicación de iconos decorativos redundantes en las píldoras de metadatos (`.deck-meta`), permitiendo que la tipografía limpia, los pesos numéricos en negrita y las sutiles tonalidades semánticas guíen la lectura sin ruido gráfico ni desbordamientos en pantallas pequeñas.
    - **Corrección de Encabezados en Modales (Título Izquierda, X Derecha)**: Se corrigió la regla colateral en `dashboard.css` (`.modal-content>div:last-of-type`) que alteraba el flujo flex en móviles. Se blindó `.modal-header` en `modal.css` y `repaso.css` garantizando `display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important;`.
    - **Carga Masiva Excel Robusta (Contención de Desbordamiento y Limpieza Atómica)**:
      - Se implementó `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` en `#bulk-file-label` y en el contenedor `<label>`, previniendo que nombres largos de archivos desborden o deformen la modal.
      - Se extendió `_clearCardModal()` y `closeCardModal()` para resetear completamente `#bulk-file-label` a *"Seleccionar Archivo"*, restablecer contadores de tarjetas y vaciar el input al cerrar o guardar.
    - **Icono y Jerarquía de Colapso del Explorador Lateral (Móvil y PC)**:
      - **Doble Comportamiento Responsivo**:
        - En **PC / Escritorio**: `fas fa-chevron-left` para contraer hacia la izquierda y `fas fa-chevron-right` para desplegar hacia la derecha.
        - En **Móvil / Celular (`<= 768px`)**: `fas fa-chevron-up` para contraer hacia arriba y `fas fa-chevron-down` para desplegar hacia abajo, adecuándose perfectamente a la naturaleza vertical del acordeón móvil.
      - En estado colapsado para escritorio (`.explorer-sidebar.is-collapsed`), se asignó `order: -1` a `#btn-toggle-explorer`, posicionándolo de forma ergonómica en la parte superior del botón de nuevo mazo (`#btn-explorer-create`).
    - **Orden de Categorías en Comunidad y Remoción de Botón Redundante**:
      - Se reordenó el listado de categorías en `repaso.js` para ubicar la píldora **Idiomas** exactamente entre **Educación** y **Matemáticas** (`Todas` → `Medicina` → `Educación` → `Idiomas` → `Matemáticas`...).
      - Se eliminó el botón *"Compartir Filtro"* del banner de comunidad para evitar sobrecarga visual en la cabecera, ya que el sistema sincroniza reactivamente la categoría activa directamente en los parámetros de la URL del navegador (`?view=community&category=...`).
    - **Erradicación del Parpadeo de Recarga al Abrir, Editar o Guardar en Modales**:
      - **Causa Raíz Identificada**: Al cerrar cualquier modal (o guardar datos en ella), `uiManager.popModalState()` invocaba `window.history.back()`. Esto disparaba un evento global `popstate` que el enrutador de `repaso.js` interpretaba como una navegación hacia atrás del usuario, volviendo a invocar `loadDashboard()` o `loadCommunity()`, lo cual vaciaba el contenedor con esqueletos de carga (`<div class="deck-skeleton-card">`) y volvía a pedir datos al servidor en paralelo con la acción de guardado.
      - **Solución Arquitectónica Implementada**:
        1. **Cierre Silencioso de Historial (`replaceState`)**: `uiManager.pushModalState()` almacena el estado previo en una pila interna `_modalHistoryStack`. Al cerrar manual o programáticamente la modal (mediante `popModalState()`), se utiliza `window.history.replaceState(prev.state, '', prev.href)` en lugar de `history.back()`. Esto limpia el historial del navegador sin disparar el evento `popstate`, previniendo recargas espurias.
        2. **Preservación In-Place de la Grilla de Mazos**: `renderRootDecks()` ahora verifica `hasLoadedDecks`. Si la grilla ya existe y tiene tarjetas renderizadas, no sobreescribe el contenedor con esqueletos, sino que actualiza los mazos de manera suave e in-place.
        3. **Blindaje de `handlePopState`**: Se incorporó una guarda estricta que aborta la re-ejecución del enrutador si existen modales abiertos en `uiManager` o si la vista activa ya tiene su grilla cargada.
    - **Evolución de Tarjetas de Mazo: Categoría Dinámica en Reemplazo de "PERSONAL" / "PERS."**:
      - Se eliminaron definitivamente los antiguos badges estáticos `PERSONAL`, `PERS.`, `AUTOMÁTICO` y `AUTO`. En su lugar, tanto en PC como en móvil, las tarjetas de mazo ahora muestran la categoría real seleccionada por el usuario (`deck.category || 'General'`: Medicina, Idiomas, Educación, Derecho, etc.), manteniendo consistencia con la desvinculación total de simulacros automáticos.
    - **Reubicación Ergonómica del Icono a la Fila de Metadatos y Amplitud del Título**:
      - Se retiró el badge de icono que se ubicaba al lado del título `<h1>` (`.deck-title-icon-badge`), permitiendo que el nombre del mazo ocupe el 100% del ancho horizontal disponible en la fila superior sin comprimirse ni colisionar con el botón de la derecha.
      - Se eliminó la etiqueta de texto de categoría en la fila de metadatos (`.deck-meta`) y en su lugar se posicionó el icono propio del mazo (`.deck-meta-pill.pill-deck-icon`) al inicio de dicha fila, alineado elegantemente con los contadores de tarjetas, pendientes y dominadas.
    - **Botón de Guía Rápida del Mazo**:
      - El botón `#btn-deck-tour` mantiene su texto y etiqueta oficial como **"Guía"** con el icono `fas fa-circle-question`, conservando coherencia con los demás botones de ayuda rápida del sistema.
    - **Sobriedad Visual en Selectores de Categoría (Sin Emojis Redundantes)**:
      - Se eliminaron los emojis de las opciones `<option>` del selector de categorías tanto en la modal de creación/edición de mazo (`#new-deck-category`) como en la modal de publicación a la comunidad (`#publish-deck-category`), dejando nombres limpios y profesionales.
    - **Corrección de Contraste en Botón "Cancelar" en Modo Claro**:
      - Se refactorizó `.btn-secondary-action` y su pseudoclase `:hover` en `dashboard.css` para utilizar variables semánticas (`color: var(--text-main); background: var(--surface-hover)`), erradicando el bug donde el texto se volvía blanco sobre fondo claro haciéndose invisible.
      - La modal de publicación (`#confirm-publish-modal`) ahora estructura sus botones dentro de un contenedor `.modal-footer` semántico.
    - **Icono Oficial de Estrellitas IA**:
      - Se reemplazó el icono de varita diagonal (`fas fa-magic`) por el vector SVG oficial de estrellitas IA (`ai-sparkles-icon`) con estilo de 4 puntas en el botón *"Crear con IA"* de la barra de acciones y en la modal generadora de tarjetas.
    - **Alto Contraste y Ergonomía del Botón de Audio en Modo Claro**:
      - El botón flotante de audio (`.fc-audio-btn`) en `flashcards.css` fue rediseñado con el color primario cálido (`#ea580c`, borde `1.5px solid rgba(249, 115, 22, 0.35)` y fondo sutil `rgba(249, 115, 22, 0.12)`). En modo claro ofrece contraste nítido y legible (eliminando el anterior ícono blanco sobre fondo pálido) y transiciona a gradiente anaranjado en hover.
    - **Actualización del Motor TTS y Soporte Multilingüe (Italiano y Otras Lenguas)**:
      - Se documenta el catálogo de voces en `ttsService.js`:
        - **Google Cloud Studio** (voces grabadas en estudio por actores humanos profesionales): Español (`es-ES-Studio-C`, `es-US-Studio-B`), Inglés (`en-US-Studio-O`, `en-GB-Studio-C`), Francés (`fr-FR-Studio-A`), Alemán (`de-DE-Studio-C`).
        - **Google Cloud Neural2 / Chirp-HD**: Italiano (`it-IT-Neural2-A`) y Portugués (`pt-BR-Neural2-A`). Se corroboró directamente con la API de Google que actualmente Google no dispone de modelo `Studio` para el idioma italiano (su disponibilidad se limita a ES, EN, FR y DE), pero las voces `it-IT-Neural2-A`, `it-IT-Neural2-C` y `it-IT-Chirp-HD-F` están 100% activas y verificadas con generación binaria exitosa.
    - **Arquitectura de Limpieza y Ciclo de Vida de Archivos en GCS (`_cleanOrphanMedia`)**:
      - **Principio de Integridad y Protección Anti-Huérfanos**:
        1. **Al editar una tarjeta (`updateCard`)**: Tanto para imágenes (`image_url`, `explanation_image_url`) como para audios (`audio_url_frente`, `audio_url_dorso`), cualquier archivo reemplazado o removido manualmente (`deleteAudioFront`, etc.) se actualiza primero en la BD. Luego, en la fase post-guardado, el sistema invoca `DeckService.isMediaInUse(url)` para verificar si otra tarjeta (ej. en mazos clonados por otros usuarios) utiliza el mismo recurso. Si el conteo es 0, se elimina de GCS de inmediato vía `mediaController.deleteFile(url)`.
        2. **Al eliminar una tarjeta individual (`deleteCard`)**: Se extraen las 4 URLs de multimedia de la tarjeta, se borra el registro de la BD y se invoca `_cleanOrphanMedia([image_url, explanation_image_url, audio_url_frente, audio_url_dorso])`, purgando los archivos en GCS que ya no tengan referencias en el sistema.
        3. **Al eliminar un mazo padre con sub-mazos recursivos (`deleteDeck`)**:
           - El repositorio ejecuta una CTE recursiva (`WITH RECURSIVE deck_tree`) que desciende por todos los niveles de profundidad (mazo → sub-mazo → sub-sub-mazo) aislando por `user_id`.
           - Se recopilan todas las imágenes de anverso/reverso, todos los audios de anverso/reverso y todas las imágenes incrustadas en las descripciones de los mazos.
           - Se eliminan los mazos de la BD (con cascada de PostgreSQL sobre `user_flashcards`).
           - Se invoca `_cleanOrphanMedia` sobre el conjunto consolidado y deduplicado (`Set`), eliminando todos los archivos que ya no estén en uso por ningún otro usuario ni mazo.
       - **Refactorización Clean Code**: Se centralizó la lógica repetitiva en la función auxiliar `_cleanOrphanMedia`, erradicando duplicidades y blindando la ejecución con bloques `try/catch`.
      - **Erradicación de Duplicación en `tts_cache/`**:
        - Se identificó que `ttsService.synthesize()` guardaba automáticamente una copia en `tts_cache/` como efecto secundario, mientras que `deckController._processAudioTts()` guardaba una segunda copia en `audio-cards/`.
        - Como la BD solo registraba la ruta de `audio-cards/`, al borrar tarjetas se eliminaba el archivo en `audio-cards/` pero la copia en `tts_cache/` quedaba huérfana en el bucket.
        - **Corrección**: Se implementó el parámetro `{ cache: false }` en `ttsService.synthesize()`, activado por defecto en `_processAudioTts()`. Ahora el audio de las tarjetas se genera y guarda exclusivamente una sola vez en `audio-cards/`, eliminando toda duplicidad y fuga de archivos en el bucket.
    - **Ergonomía Táctil y Tipografía Adaptativa en Celulares (`flashcards.js`, `flashcards.css`)**:
      - **Desplazamiento Táctil por Arrastre Directo (`enableSmoothTextDrag`)**:
        - Se solucionó el bloqueo en dispositivos táctiles donde el usuario solo podía desplazarse tocando la delgada barra de scroll lateral.
        - Ahora el usuario puede arrastrar con el dedo directamente sobre cualquier parte del contenedor de texto (`.content-text`).
        - Se implementó discriminación inteligente entre gesto de scroll/arrastre (`touchmove` con delta > 6px) y toque simple (`tap`), asegurando que al arrastrar o soltar el dedo para leer jamás se voltee la tarjeta accidentalmente.
        - En CSS, se habilitó `touch-action: pan-y !important`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior-y: contain` y `pointer-events: none` en los pseudo-elementos `::before`/`::after` de centrado para evitar que intercepten los eventos táctiles.
      - **Calibración de Tipografía Dinámica, Estabilidad en Giro y Optimización de Listas (PC y Móvil)**:
        - **Escala Generosa en PC / Escritorio**: Tarjetas amplias (hasta 850px) aprovechan el espacio visual con tamaños generosos (`2.60rem` en textos cortos, `1.95rem` en medianos, `1.75rem` en textos de ~200 caracteres, y `1.50rem` - `1.30rem` en largos), eliminando la sensación de texto pequeño o islas flotantes con espacio vacío excesivo.
        - **Erradicación del Conflicto CSS/JS (Code Health)**: Se eliminó `transition: font-size 0.2s ease` de `.content-text` y las reglas estáticas redundantes (`2.2rem` en `.fc-only-text` y `1.1rem` en `.fc-has-image`). Esto previene retrasos de renderizado y discrepancias entre estilos CSS y el motor de layout en JavaScript.
        - **Estabilidad Total en Giro de Tarjeta (`toggleFlip`)**: Se retiró el recálculo síncrono de tipografía durante la animación de giro 3D (`rotateY(180deg)` de 0.5s). Los tamaños de anverso y reverso se calculan una sola vez de forma determinista al montar la tarjeta en `renderCard()`, garantizando que el texto mantenga su tamaño exacto sin encogerse al girar la tarjeta múltiples veces.
        - **Aprovechamiento Lateral de Listas y Viñetas**:
          - Se retiró la restricción `max-width: 92%` y el margen automático en `.content-text ol, .content-text ul`, asignándoles `width: 100%; max-width: 100%; margin: 0.4rem 0;`.
          - Se redujo la indentación excesiva de `2rem` (32px) a `1.35rem` en PC y `1.15rem` en celular, otorgando espacio suficiente al marcador de viñeta sin desperdiciar ancho.
          - En celulares (`@media (max-width: 768px)`), el padding de `.fc-card-face` se optimizó de `1.75rem` (28px) a `1.1rem` (17px), incrementando el ancho útil disponible para texto en más de un 35%.
        - **Motor Determinista Shrink-to-Fit (Clean Code)**: Detección inteligente de listas (`hasList`) y ajuste proporcional en un solo paso matemático si el texto desborda el contenedor visible (`scrollHeight > clientHeight + 4`), con piso mínimo protegido (`0.84rem` en móvil, `1.05rem` en PC).
    - Limpieza de colores azules hardcodeados (`#60a5fa`, `#3b82f6`) en botones de acción rápida de tarjetas y eventos de arrastre, adoptando tokens institucionales (`#f97316` / `var(--primary)`).
  - **Verificación de Pruebas Unitarias**:
    - Creada y ampliada la suite `tests/unit/deckIdiomasAndSecurity.test.js` y `tests/unit/flashcardScope.test.js` cubriendo normalización de Idiomas, filtrado de comunidad, rechazo IDOR, clonación fiel, integridad de `.modal-header`, presencia de `.pill-deck-icon` en metadatos, categoría dinámica en tarjetas, botón "Guía", selectores sin emojis, icono SVG de estrellitas IA, prevención de texto blanco en hover, alto contraste en botón de audio, resolución de voces Studio/Italiano en TTS, limpieza de archivos huérfanos vía `_cleanOrphanMedia`, prevención de duplicación en `tts_cache` con `{ cache: false }`, escala generosa en PC (`1.75rem`), estabilidad anti-encogimiento en `toggleFlip`, listas de ancho completo sin transición CSS, desplazamiento táctil directo por arrastre en tarjetas, propiedades táctiles en CSS, reversión silenciosa en `popModalState` y prevención de parpadeo por esqueletos.
    - 43 suites de prueba pasando (313/313 pruebas al 100%).

- **Sincronización Reactiva Inmediata al Clonar Mazos de Comunidad y Purga de Código Muerto (V44)**:
  - **Diagnóstico de Causa Raíz (@code-health-rules)**:
    - **Omisión de Invalidación de Caché**: En `src/presentation/public/js/repaso.js`, el método `cloneDeck()` no invocaba `this.invalidateCache()`, a diferencia de todas las demás operaciones de mutación (`createDeck`, `updateDeck`, `deleteDeck`, `addCard`). Esto provocaba que las peticiones posteriores a `renderRootDecks()` reutilizaran estructuras obsoletas en memoria.
    - **Stale Promise / Caché Fantasma en `fetchDecksShared`**: El método `fetchDecksShared` implementaba un patrón de desduplicación con un temporizador diferido `setTimeout(() => { delete this._sharedRequests.decks[key]; }, 5000)`. Al clonar un mazo e inmediatamente hacer clic en "Mis Mazos" (`loadDashboard`), la llamada a `fetchDecksShared(null)` retornaba la promesa ya resuelta antes de la clonación, devolviendo la lista de mazos previa sin el nuevo mazo clonado.
    - **Promesa Flotante en Explorador**: `this.explorer.loadTree()` era invocado sin `await` dentro de `cloneDeck`, causando una carrera asíncrona donde la vista cambiaba antes de actualizarse el árbol de navegación.
    - **Código Muerto en Backend (`deckService.js`)**: En `DeckService.cloneDeck`, existía una consulta redundante a la base de datos `await this.trainingRepository.getDeckById('GUEST', publicDeckId)` asignada a la variable no utilizada `originalDeck`, antes de la ejecución del SQL directo de clonación.
  - **Solución e Implementación Arquitectónica**:
    - **Invalidación Obligatoria**: Se integró `this.invalidateCache()` en `cloneDeck()` inmediatamente después de recibir la respuesta exitosa del servidor (`res.ok`).
    - **Sincronización Asíncrona Garantizada**: Se añadió `await this.explorer.loadTree()` tanto en `cloneDeck()` como en `handleCreateDeck()`, asegurando que el árbol lateral de carpetas y mazos refleje el nuevo mazo antes de la renderización del dashboard.
    - **Desduplicación In-Flight Efímera**: Se eliminó el temporizador artificial de 5000ms en `fetchDecksShared`. La clave de desduplicación se elimina de forma síncrona en el bloque `finally` tan pronto como la promesa se asienta (resuelve o rechaza). Esto previene colisiones concurrentes legítimas sin congelar el estado de la aplicación.
    - **Limpieza de Backend (@code-health-rules)**: Se eliminó la variable `originalDeck` y la consulta huérfana en `deckService.js`, optimizando el consumo de conexiones a PostgreSQL.
  - **Verificación de Pruebas Unitarias**:
    - Se creó la suite dedicada `tests/unit/deckCloneSync.test.js` con 4 pruebas automatizadas que certifican:
      1. Invocación de `invalidateCache` tras clonación exitosa.
      2. Espera asíncrona (`await`) de `explorer.loadTree()`.
      3. Limpieza inmediata de promesas en `_sharedRequests.decks` en `finally` sin temporizadores de 5 segundos.
      4. Ausencia de llamadas redundantes a `getDeckById` en `DeckService.cloneDeck`.
    - 44/44 suites de prueba Jest pasando (317/317 pruebas al 100%).

---

**Documentación Técnica Actualizada - Septiembre 2026.**

