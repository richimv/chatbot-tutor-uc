/* global createBrowseCardHTML, createBackButtonHTML, createTopicViewHTML, 
          createContextualChatButtonHTML, createSearchResultCardHTML, 
          createRecommendationsSectionHTML, createSpecificChatPromoHTML, 
          createChatPromoSectionHTML, createFilterSidebarHTML */
/*
  NOTA: Las funciones mencionadas arriba se definen en /public/js/ui/components.js
  y se cargan globalmente. Este comentario le indica al linter que no las marque
  como errores de "variable no definida".
*/

class SearchComponent {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.contentContainer = document.getElementById('content-container'); // Contenedor principal para resultados y exploración
        this.browseContainer = document.getElementById('browse-container'); // Contenedor específico para la exploración
        this.resultsContainer = document.getElementById('results-container'); // Contenedor para resultados de búsqueda

        // Almacenes de datos
        this.allData = { careers: [], courses: [], topics: [] };
        // ✅ DEFENSIVE: Inicializar arrays para evitar crashes si la carga falla
        this.featuredCourses = [];

        this.viewStack = []; // Pila para gestionar el historial de navegación
        this.currentView = { name: 'home', args: [] }; // Vista actual

        // ✅ MANTA TABS STATE (Phase 30)
        this.activeTab = 'biblioteca'; // 'biblioteca' | 'cursos'
        this.activeFilter = 'Libros y Manuales'; // Default param for first tab

        this.init();

        // ✅ NUEVO: Escuchar cambios en la sesión para actualizar la UI (ej. quitar candados)
        if (window.sessionManager) {
            window.sessionManager.onStateChange(() => {
                console.log('🔄 Sesión actualizada. Re-renderizando vista actual:', this.currentView.name);
                if (this.currentView.name) {
                    this.renderView(this.currentView.name, ...this.currentView.args);
                }
            });
        }
    }

    async init() {
        // 1. Cargar datos iniciales (carreras para el menú de exploración)
        await this.loadAllData();

        // 2. Configurar event listeners
        this.setupEventListeners();

        // 3. Verificar si hay una búsqueda en la URL (desde otras páginas)
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');

        // 4. Configurar manejo de historial
        window.addEventListener('popstate', this.handlePopState.bind(this));

        if (query) {
            this.searchInput.value = query;
            this.performSearch();
        } else {
            // Si hay estado previo (ej: recarga), restaurarlo
            if (history.state) {
                this.handlePopState({ state: history.state });
            } else {
                // Estado inicial
                history.replaceState({ view: 'home' }, '', '#home');
                this.renderInitialView();
            }
        }
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, topicsRes] = await Promise.all([
                fetch(`${window.AppConfig.API_URL}/api/careers`),
                fetch(`${window.AppConfig.API_URL}/api/courses`),
                fetch(`${window.AppConfig.API_URL}/api/topics`)
            ]);
            this.allData.careers = await careersRes.json();
            this.allData.courses = await coursesRes.json();
            this.allData.topics = await topicsRes.json();
        } catch (error) {
            console.error("Error loading all data for browsing:", error);
            this.browseContainer.innerHTML = `<p class="error-state">No se pudo cargar la información para explorar.</p>`;
        }
    }

    async loadFeaturedContent() {
        // ✅ FALLBACK ROBUSTO: Definir servicio local si falta el global
        let serviceToUse = window.SearchService;

        if (!serviceToUse) {
            console.error('❌ CRITICAL: SearchService global missing. Using FailSafe local service.');

            // Definición Local de Emergencia
            class FailSafeSearchService {
                static async _fetchData(endpoint) {
                    const API_URL = window.AppConfig ? window.AppConfig.API_URL : 'http://localhost:3000';
                    try {
                        const response = await fetch(`${API_URL}${endpoint}`);
                        if (!response.ok) return []; // Retornar array vacío en error
                        return await response.json();
                    } catch (e) {
                        console.error(`FailSafe fetch error for ${endpoint}:`, e);
                        return [];
                    }
                }
            }
            serviceToUse = FailSafeSearchService;
        }

        try {
            // Cargar Cursos en paralelo
            const [courses] = await Promise.all([
                serviceToUse._fetchData('/api/analytics/featured-courses')
            ]);

            this.featuredCourses = courses || [];

            // ✅ SOLUCIÓN AL ERROR 400: El endpoint buscar requiere una query.
            // Para obtener el catálogo y destacar documentos oficiales, usamos el endpoint directo general de recursos.
            const latestDocsResponse = await fetch(`${window.AppConfig.API_URL}/api/books`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Añadir token por si el endpoint lo requiere
                }
            });
            const latestDocsData = latestDocsResponse.ok ? await latestDocsResponse.json() : [];

            // Filtrar y ordenar los más recientes de forma manual
            const allResults = latestDocsData || [];
            this.featuredResources = allResults
                .filter(r => r.resource_type === 'norma' || r.resource_type === 'guia' || r.resource_type === 'paper')
                .slice(0, 6);

            console.log('🔥 Contenido destacado cargado (con servicio disponible):', {
                courses: this.featuredCourses.length,
                resources: this.featuredResources.length
            });
        } catch (error) {
            console.error('❌ Error cargando contenido destacado:', error);
            // Fallbacks vacíos para no romper la UI
            this.featuredCourses = [];
            this.featuredResources = [];
        }
    }

    setupEventListeners() {
        this.searchButton.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });


        // ✅ CORRECCIÓN DEFINITIVA: Delegación de eventos en el `body`.
        // Esto asegura que los clics se capturen tanto en la vista de exploración (`#browse-container`)
        // como en la de resultados (`#results-container`), solucionando el problema de los stickers no clickables.
        document.body.addEventListener('click', this.handleContentClick.bind(this));

        // ✅ CORRECCIÓN: Listener global para el botón de inicio en el header.
        const homeBtn = document.querySelector('.nav-home-button');
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Limpiar búsqueda si existe
                this.searchInput.value = '';
                this.startNewNavigation('home');
            });
        }

        // ✅ NUEVO: Listener para el botón VOLVER GLOBAL del header
        const headerBackBtn = document.getElementById('header-back-btn');
        if (headerBackBtn) {
            headerBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateBack();
            });
        }

        // ✅ NUEVO: Listener para la barra de búsqueda sticky
        // CORRECCIÓN BUG: Usamos un 'placeholder' para evitar el salto de contenido
        const searchSection = document.querySelector('.search-section');
        const heroWrapper = document.querySelector('.hero-wrapper');

        // ✅ REFACTOR: La barra de búsqueda ahora es estática o sticky por CSS.
        // Se elimina la lógica JS que causaba el "rebote".
        // El CSS se encargará de posicionarla correctamente.
    }

    /**
     * Navega a una nueva vista usando History API.
     * @param {string} viewName - Nombre de la vista ('career', 'course', 'topic', 'search', 'home').
     * @param {...any} args - Argumentos para la función de renderizado.
     */
    navigateTo(viewName, ...args) {
        // Guardamos el estado en el historial
        const state = { view: viewName, args: args };
        // Construimos una URL amigable (opcional, pero útil para debug)
        const hash = `#${viewName}/${args.join('/')}`;
        history.pushState(state, '', hash);

        // Renderizamos la vista
        this.renderView(viewName, ...args);
    }

    /**
     * Inicia una nueva navegación (resetea el flujo, pero mantiene el historial lineal).
     * Se usa para Búsquedas o volver al Inicio explícitamente.
     */
    startNewNavigation(viewName, ...args) {
        const state = { view: viewName, args: args };
        const hash = `#${viewName}`;
        history.pushState(state, '', hash);
        this.renderView(viewName, ...args);
    }

    navigateBack() {
        // ✅ SOLUCIÓN: Usar la funcionalidad nativa del navegador.
        // Esto disparará el evento 'popstate' que manejamos en handlePopState.
        history.back();
    }

    /**
     * Maneja el evento popstate (Botón Atrás/Adelante).
     */
    handlePopState(event) {
        const state = event.state;

        // ✅ CORRECCIÓN BUG 303: Ignorar estados empujados por uiManager (Modales)
        if (state && state.modalOpen) {
            return;
        }

        // ✅ CORRECCIÓN: Ignorar estados empujados por el ChatComponent.
        // Cuando el chat se cierra con history.back(), el popstate no debe
        // provocar un re-render de la BIBLIOTECA/búsqueda.
        if (state && state.chatbotOpen) {
            return;
        }

        if (!state || !state.view) {
            // Si no hay estado (ej: estado inicial vacío), volvemos al home.
            this.renderInitialView();
            return;
        }
        // Restauramos la vista según el estado guardado.
        this.renderView(state.view, ...(state.args || []));
    }

    /**
     * Dispatcher centralizado para renderizar vistas.
     */
    renderView(viewName, ...args) {
        // ✅ Mantener registro de la vista actual para re-renderizado por cambios de sesión
        this.currentView = { name: viewName, args: args };

        // ✅ LÓGICA DE VISIBILIDAD DEL HERO Y BOTÓN VOLVER GLOBAL
        const headerBackBtn = document.getElementById('header-back-btn');
        const searchSection = document.querySelector('.search-section');
        const heroSlider = document.getElementById('hero-slider'); // ✅ NUEVO: Referencia directa al slider
        const trainingModules = document.getElementById('training-modules'); // ✅ NUEVO: Controle Módulos

        if (viewName === 'home') {
            document.body.classList.remove('hero-hidden');
            if (searchSection) searchSection.classList.remove('sticky');
            if (heroSlider) heroSlider.style.display = 'block'; // ✅ Mostrar slider en Home
            if (trainingModules) trainingModules.style.display = 'block';

            if (headerBackBtn) {
                headerBackBtn.classList.add('hidden');
                headerBackBtn.classList.remove('visible');
            }
        } else {
            document.body.classList.add('hero-hidden');
            if (heroSlider) heroSlider.style.display = 'none'; // ✅ Ocultar slider en otras vistas (Resultados, Cursos, etc.)
            if (trainingModules) trainingModules.style.display = 'none';

            if (headerBackBtn) {
                headerBackBtn.classList.remove('hidden');
                headerBackBtn.classList.add('visible');
            }
        }

        // 2. Renderizar contenido según la vista
        if (viewName === 'home') {
            this.renderInitialView();
        } else if (viewName === 'career') {
            // Deprecated: SPA navigation for career
            console.warn("Legacy SPA navigation for career detected. Redirecting...");
            window.location.href = `/career?id=${args[0]}`;
        } else if (viewName === 'course') {
            // Deprecated: SPA navigation for course
            console.warn("Legacy SPA navigation for course detected. Redirecting...");
            window.location.href = `/course?id=${args[0]}`;
        } else if (viewName === 'topic') {
            // Topic pages are deprecated. Redirect to search just in case.
            // (This should be handled by click listeners, but as a fallback)
            console.warn("Topic page is deprecated. Redirecting to search.");
            const topic = this.allData.topics.find(t => t.id == args[0]);
            if (topic) {
                this.searchInput.value = topic.name;
                this.performSearch();
            } else {
                this.renderInitialView();
            }
        } else if (viewName === 'search') {
            // args[0] es 'data'
            this.renderSearchResults(args[0]);
        } else if (viewName === 'all-books') {
            this.renderAllBooks();
        } else if (viewName === 'all-courses') {
            this.renderAllCourses();
        } else if (viewName === 'medical-books') { // ✅ NUEVO: Soporte para vista de medicina
            this.renderMedicalBooksView();
        } else {
            console.warn('Vista desconocida:', viewName);
            this.renderInitialView();
        }

        // Sincronizar estado: Manejado por LibraryUI de forma reactiva
    }

    handleContentClick(e) {
        // ✅ CORRECCIÓN CRÍTICA: Unificar el manejo del botón "Volver" aquí.
        // Este listener en `contentContainer` ahora captura todos los clics de "Volver".
        const backButton = e.target.closest('.back-button'); // ✅ CORRECCIÓN: Definir la variable backButton.
        if (backButton) {
            e.preventDefault();
            this.navigateBack();
            return;
        }

        // ✅ NUEVO: Manejar el botón de cerrar tag en resultados
        const closeTagBtn = e.target.closest('.search-tag-close');
        if (closeTagBtn) {
            e.preventDefault();
            this.startNewNavigation('home'); // Volver al inicio al cerrar la búsqueda
            return;
        }

        // ✅ LÓGICA DE NAVEGACIÓN PROGRESIVA:
        // - Topics: Navegación SPA interna (navigateTo).
        // - Carreras/Cursos: Navegación estándar MPA (window.location).

        // ✅ NUEVO: Manejar clics en los stickers de carrera.
        const careerBadge = e.target.closest('.course-badge[data-career-id]');
        if (careerBadge) {
            e.stopPropagation();
            e.preventDefault();
            const careerId = parseInt(careerBadge.dataset.careerId, 10);
            if (!isNaN(careerId)) {
                // Navegación MPA estándar
                window.location.href = `/career?id=${careerId}`;
            }
            return;
        }


        // ✅ NUEVO: Evitar conflictos con botones de librería (LibraryUI)
        if (e.target.closest('.js-library-btn')) {
            return; // Dejar que libraryUI.js maneje esto
        }

        // ✅ LÓGICA DE NAVEGACIÓN CENTRALIZADA (Reemplaza onclicks inline eliminados)
        const browseCard = e.target.closest('[data-type]');
        if (browseCard) {
            const type = browseCard.dataset.type;
            const id = browseCard.dataset.id;

            if (type === 'topic') {
                e.preventDefault();
                // ✅ UPDATE: Topic clicks now trigger a search instead of opening a page.
                const topic = this.allData.topics.find(t => t.id == id);
                if (topic) {
                    this.searchInput.value = topic.name;
                    this.performSearch();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                return;
            } else if (type === 'career') {
                // Navegación MPA estándar para carreras
                window.location.href = `/career?id=${id}`;
                return;
            } else if (type === 'course') {
                // Navegación MPA estándar para cursos
                window.location.href = `/course?id=${id}`;
                return;
            }
        }

        // ✅ SOLUCIÓN: Manejar clics en las tarjetas de recomendación.
        const recommendationCard = e.target.closest('.recommendation-card[data-rec-id]');
        if (recommendationCard) {
            e.preventDefault();
            const type = recommendationCard.dataset.recType;
            const id = parseInt(recommendationCard.dataset.recId, 10);

            if (!isNaN(id)) {
                if (type === 'course') window.location.href = `/course?id=${id}`;
                if (type === 'topic') {
                    // Trigger search
                    const topic = this.allData.topics.find(t => t.id == id);
                    if (topic) {
                        this.searchInput.value = topic.name;
                        this.performSearch();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            }
            return;
        }

        // ✅ NUEVO: Manejar clics en los enlaces de materiales (libros)
        // ✅ SOLUCIÓN: El selector correcto para las tarjetas de libro es '.material-card'.
        // El selector anterior '.material-item' era de un diseño antiguo.
        const materialLink = e.target.closest('.material-card');
        if (materialLink) {
            e.preventDefault();

            // ✅ MEJORA: Verificar si el usuario ha iniciado sesión.
            if (!window.sessionManager.isLoggedIn()) {
                // Si no ha iniciado sesión, mostrar el modal de invitación.
                document.getElementById('login-prompt-modal').style.display = 'flex';
                return; // Detener la ejecución.
            }

            const url = materialLink.href;
            const title = materialLink.textContent.trim();

            // --- ✅ SOLUCIÓN DEFINITIVA: Lógica de manejo de enlaces ---

            // SIEMPRE abrir en una nueva pestaña, sin importar si es PDF o Drive.
            // Esto elimina la necesidad del visor PDF heredado.
            window.open(url, '_blank');
            return;
        }

        // ✅ NUEVO: Manejo de botones "Ver Todos"
        const viewAllBtn = e.target.closest('.view-all-btn');
        if (viewAllBtn) {
            e.preventDefault();
            const target = viewAllBtn.dataset.view; // 'all-books' o 'all-courses'
            if (target) {
                this.navigateTo(target);
            }
        }
    }

    // =================================================================
    // ✅ INICIO: SECCIÓN AÑADIDA - LÓGICA DE BÚSQUEDA
    // =================================================================

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            // Opcional: podrías mostrar un mensaje si la búsqueda está vacía.
            return;
        }

        // Mostramos el contenedor de resultados y ocultamos el de exploración.
        this.browseContainer.classList.add('hidden');
        this.resultsContainer.classList.remove('hidden');

        const skeletonCards = Array(3).fill(createSkeletonCardHTML('Premium')).join('');
        this.resultsContainer.innerHTML = `
            <div class="detail-view-container">
                <div class="section-header" style="margin-top: 1.5rem; border-bottom: none; opacity: 0.7;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">
                        <i class="fas fa-search" style="color:var(--accent)"></i> Buscando inteligentemente...
                    </h3>
                </div>
                <div class="documents-grid-premium" style="margin-top: 1rem;">
                    ${skeletonCards}
                </div>
            </div>
        `;

        try {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${window.AppConfig.API_URL}/api/buscar?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const data = await response.json();

            // Inicia una nueva navegación con los resultados de la búsqueda.
            // Esto limpia el historial anterior, lo cual es correcto para una nueva búsqueda.
            this.startNewNavigation('search', data);

        } catch (error) {
            console.error("Error performing search:", error);
            this.resultsContainer.innerHTML = `<p class="error-state">Hubo un error al realizar la búsqueda. Por favor, inténtalo de nuevo.</p>`;
        }
    }

    renderSearchResults(data) {
        // 1. Ocultar el modo de exploración y mostrar el de resultados.
        this.browseContainer.classList.add('hidden');
        this.resultsContainer.classList.remove('hidden');

        // 2. Separar resultados por tipo para visualización específica
        // Gracias al fix en searchService.js, ahora 'type' refleja 'video', 'article', etc.
        const foundBooks = data.results.filter(item => item.type === 'book' || item.resource_type === 'book');
        const foundVideos = data.results.filter(item => item.type === 'video' || item.resource_type === 'video');

        // ✅ NUEVO: Documentos formales
        const formalTypes = ['norma', 'guia', 'paper'];
        const foundDocs = data.results.filter(item => formalTypes.includes(item.type) || formalTypes.includes(item.resource_type));

        // Artículos (lo que no sea libro, video, curso, o documento formal)
        const foundArticles = data.results.filter(item =>
            (item.type === 'article' || item.resource_type === 'article' || item.type === 'other' || item.resource_type === 'other') &&
            !formalTypes.includes(item.type) && !formalTypes.includes(item.resource_type)
        );

        // Cursos (type 'course' o undefined)
        const foundCourses = data.results.filter(item => item.type === 'course' || (!item.type && !item.resource_type));

        // Orden Solicitado: Documentos -> Libros -> Videos -> Materiales -> Cursos

        let contentHTML = '';

        // 0. SECCIÓN: DOCUMENTOS FORMALES (Normas, Guías, Papers)
        if (foundDocs.length > 0) {
            const docsHTML = foundDocs.map(doc => createUnifiedResourceCardHTML(doc)).join('');
            contentHTML += `
                <div class="section-header" style="margin-top: 1.5rem; border-bottom: none;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;"><i class="fas fa-landmark" style="color:var(--accent)"></i> Documentos Encontrados (${foundDocs.length})</h3>
                </div>
                <div class="books-grid"> 
                    ${docsHTML}
                </div>
            `;
        }

        // 1. SECCIÓN: LIBROS CON INFINITE SCROLL
        if (foundBooks.length > 0) {
            // Configuración del Infinite Scroll
            const ITEMS_PER_PAGE = 12;
            this.currentBookList = foundBooks; // Guardamos ref para lazy loading
            this.loadedBooksCount = 0;

            const initialBatch = this.currentBookList.slice(0, ITEMS_PER_PAGE);
            this.loadedBooksCount = initialBatch.length;

            const booksHTML = initialBatch.map(book => createUnifiedResourceCardHTML(book)).join('');

            contentHTML += `
                <div class="section-header" style="margin-top: 1.5rem; border-bottom: none;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Libros Encontrados (${foundBooks.length})</h3>
                </div>
                <div id="books-grid-container" class="books-grid"> 
                    ${booksHTML}
                </div>
                <!-- Sentinel for Infinite Scroll -->
                <div id="books-sentinel" style="height: 20px; width: 100%; margin-top: 20px; display: flex; justify-content: center;">
                    ${foundBooks.length > ITEMS_PER_PAGE ? '<i class="fas fa-circle-notch fa-spin" style="color: var(--accent); opacity: 0;"></i>' : ''}
                </div>
            `;
        }

        // 2. SECCIÓN: VIDEOS
        if (foundVideos.length > 0) {
            const videosHTML = foundVideos.map(video => createVideoCardHTML(video)).join('');
            contentHTML += `
                <div class="section-header" style="margin-top: 2rem; border-bottom: none;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Videos Relacionados (${foundVideos.length})</h3>
                </div>
                <!-- Usamos 'video-grid' definido en course.css -->
                <div class="video-grid" style="margin-top: 0.5rem;"> 
                    ${videosHTML}
                </div>
            `;
        }

        // 3. SECCIÓN: ARTÍCULOS Y RECURSOS
        if (foundArticles.length > 0) {
            const articlesHTML = foundArticles.map(resource => createUnifiedResourceCardHTML(resource)).join('');
            contentHTML += `
                <div class="section-header" style="margin-top: 2rem; border-bottom: none;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Materiales y Lecturas (${foundArticles.length})</h3>
                </div>
                <div class="books-grid" style="margin-top: 0.5rem;"> 
                    ${articlesHTML}
                </div>
            `;
        }

        // 4. SECCIÓN: CURSOS (Ahora al final)
        if (foundCourses.length > 0) {
            const coursesHTML = foundCourses.map(course => createUnifiedResourceCardHTML({ ...course, type: 'course' })).join('');
            contentHTML += `
                <div class="section-header" style="margin-top: 2rem; border-bottom: none;">
                     <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Cursos Encontrados (${foundCourses.length})</h3>
                </div>
                <div class="browse-grid" style="margin-top: 0.5rem;"> 
                     ${coursesHTML}
                </div>
            `;
        }

        if (contentHTML === '') {
            contentHTML = `<p class="empty-state" style="margin-top: 2rem;">No se encontraron resultados para "${data.searchQuery}".</p>`;
        }

        // 5. Secciones inferiores (Recomendaciones + Chat)
        let bottomSectionsHTML = '';

        // ✅ NUEVO: Tarjeta de IA educativa si se detecta intención de pregunta
        let educationalCardHTML = '';
        if (data.isEducationalQuery) {
            educationalCardHTML = createEducationalIntentCardHTML(data.searchQuery);
        }

        // Recomendaciones siempre visibles
        bottomSectionsHTML = `
            ${!data.isEducationalQuery ? createChatPromoSectionHTML() : ''}
        `;

        // 6. Renderizar Vista "Biblioteca Digital"
        // ✅ CORRECCIÓN DE DISEÑO: Alineación y Botón Volver consistente
        this.resultsContainer.innerHTML = /*html*/`
            <div class="detail-view-container"> 
                
                <!-- Cabecera de Resultados (Botón volver ahora está en el Header Global) -->
                <div class="results-header-container" style="padding-top: 0.5rem;">
                     <h2 class="results-main-title" style="margin-bottom: 0.25rem;">Resultados para "${data.searchQuery}"</h2>
                     <p class="results-count" style="color: var(--text-muted);">
                        ${data.results ? data.results.length : 0} recursos encontrados
                     </p>
                </div>

                <!-- CONTENIDO PRINCIPAL (Separado) -->
                <div style="min-height: 40vh;">
                     ${contentHTML}
                     ${educationalCardHTML} <!-- ✅ MOVIDO: Mostrar tarjeta educativa al final -->
                </div>

                <!-- SECCIONES INFERIORES -->
                <div style="margin-top: 3rem;">
                    ${bottomSectionsHTML}
                </div>
            </div>
        `;

        // ✅ SYNC: Actualizar estado visual de botones (Guardado/Favorito)
        if (window.libraryManager) {
            setTimeout(() => window.libraryManager.updateButtons(), 100);
        }

        // ✅ INICIAR INFINITE SCROLL SI ES NECESARIO
        if (foundBooks.length > 0 && this.currentBookList.length > this.loadedBooksCount) {
            this.setupInfiniteScroll();
        }
    }

    setupInfiniteScroll(sentinelId, loadCallback) {
        // Defaults for search results provided if no args
        const sId = sentinelId || 'books-sentinel';
        const sentinel = document.getElementById(sId);
        if (!sentinel) return;

        // Desconectar observador previo si existe para este sentinel (limpieza)
        if (this.currentObserver) {
            this.currentObserver.disconnect();
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const loader = sentinel.querySelector('i');
                if (loader) loader.style.opacity = '1';

                setTimeout(() => {
                    if (loadCallback) {
                        loadCallback(sentinel, observer);
                    } else {
                        // Default behavior for Search Results
                        this.loadMoreBooks(sentinel);
                    }
                }, 500);
            }
        }, { rootMargin: '100px' });

        observer.observe(sentinel);

        // Store reference based on context
        if (sId === 'books-sentinel') this.booksObserver = observer;
        else this.currentObserver = observer;
    }

    loadMoreBooks(sentinel) {
        const ITEMS_PER_LOAD = 12;
        const total = this.currentBookList.length;

        // Si ya cargamos todo, detener.
        if (this.loadedBooksCount >= total) return;

        const nextBatch = this.currentBookList.slice(this.loadedBooksCount, this.loadedBooksCount + ITEMS_PER_LOAD);
        this.loadedBooksCount += nextBatch.length;

        const newBooksHTML = nextBatch.map(book => createUnifiedResourceCardHTML(book)).join('');
        const grid = document.getElementById('books-grid-container');

        if (grid) {
            // Animación Fade In manual simple
            // Crear elemento temporal para parsear HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newBooksHTML;

            Array.from(tempDiv.children).forEach((node, index) => {
                node.style.opacity = '0';
                node.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.05}s`;
                grid.appendChild(node);
            });

            // Re-sincronizar botones de librería para los nuevos elementos
            if (window.libraryManager) window.libraryManager.updateButtons();
        }

        // Si ya no hay más, ocultar sentinel
        if (this.loadedBooksCount >= total) {
            sentinel.style.display = 'none';
            if (this.booksObserver) this.booksObserver.disconnect();
        } else {
            // Ocultar spin
            const loader = sentinel.querySelector('i');
            if (loader) loader.style.opacity = '0';
        }
    }

    // setupFilterListeners() ELIMINADO: Ya no hay sidebar de filtros.

    // =================================================================
    // ✅ FIN: SECCIÓN AÑADIDA
    // =================================================================

    // ✅ NUEVO: Renderizar Catálogo de Libros POR ÁREAS (Lazy Loaded)
    renderAllBooks() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        const allBooks = this.allData.books || [];

        // 1. Agrupar libros por Área
        const booksByArea = {};
        const noAreaKey = 'Recursos Generales';

        allBooks.forEach(book => {
            const areas = (book.areas && book.areas.length > 0) ? book.areas : [noAreaKey];
            areas.forEach(area => {
                if (!booksByArea[area]) booksByArea[area] = [];
                if (!booksByArea[area].find(b => b.id === book.id)) {
                    booksByArea[area].push(book);
                }
            });
        });

        // 2. Ordenar Áreas
        this.sortedBookAreas = Object.keys(booksByArea).sort((a, b) => {
            if (a === noAreaKey) return 1;
            if (b === noAreaKey) return -1;
            return a.localeCompare(b);
        });

        this.booksByAreaContext = booksByArea;
        this.loadedAreasCount = 0; // State for lazy loading areas

        // 3. Renderizar Estructura Base
        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                <div class="course-main-header">
                    <div class="course-header-icon" style="background: linear-gradient(to bottom right, #10b981, #059669);">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">Recursos por Áreas</h2>
                        <span class="course-badge" style="margin-top: 0.5rem; display: inline-block;">${allBooks.length} Recursos Disponibles</span>
                    </div>
                </div>

                <div class="course-detail-grid" style="grid-template-columns: 1fr;"> 
                    <div id="all-books-content" class="course-main-content">
                        <!-- Areas will be injected here -->
                    </div>
                     <!-- Sentinel -->
                    <div id="all-books-sentinel" style="height: 20px; width: 100%; margin-top: 20px; display: flex; justify-content: center;">
                         <i class="fas fa-circle-notch fa-spin" style="color: var(--accent); opacity: 0;"></i>
                    </div>
                </div>
            </div>
        `;

        // 4. Cargar Primer Lote
        this.loadMoreBookAreas();

        // 5. Setup Infinite Scroll
        if (this.sortedBookAreas.length > this.loadedAreasCount) {
            this.setupInfiniteScroll('all-books-sentinel', (s, o) => this.loadMoreBookAreas(s, o));
        } else {
            const s = document.getElementById('all-books-sentinel');
            if (s) s.style.display = 'none';
        }

        // ✅ SYNC
        if (window.libraryManager) setTimeout(() => window.libraryManager.updateButtons(), 100);

        // Scroll top via Helper
        this._scrollToTop();
    }

    loadMoreBookAreas(sentinel, observer) {
        const ARENAS_PER_LOAD = 3; // Cargar de 3 en 3 áreas
        const container = document.getElementById('all-books-content');
        if (!container) return; // Si cambiamos de vista

        const total = this.sortedBookAreas.length;
        if (this.loadedAreasCount >= total) {
            if (sentinel) sentinel.style.display = 'none';
            return;
        }

        const nextAreas = this.sortedBookAreas.slice(this.loadedAreasCount, this.loadedAreasCount + ARENAS_PER_LOAD);
        this.loadedAreasCount += nextAreas.length;

        let newHtml = '';
        nextAreas.forEach(area => {
            const books = this.booksByAreaContext[area];
            const booksGrid = books.map(book => createUnifiedResourceCardHTML(book)).join('');
            newHtml += `
                <div class="area-group-section" style="margin-bottom: 3rem; opacity: 0; animation: fadeInUp 0.5s ease forwards;">
                     <button class="section-header" style="background: none; border: none; border-bottom: 1px solid var(--border-color); width: 100%; padding: 0 0 0.5rem 0;" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('fa-rotate-180');">
                         <h3 class="area-title" style="font-size: 1.1rem; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                            <i class="fas fa-layer-group" style="color: var(--accent); font-size: 1rem;"></i>
                            ${area}
                         </h3>
                         <i class="fas fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s;"></i>
                    </button>
                    <div class="books-grid"> 
                        ${booksGrid}
                    </div>
                </div>
            `;
        });

        container.insertAdjacentHTML('beforeend', newHtml);

        // Re-sincronizar botones
        if (window.libraryManager) setTimeout(() => window.libraryManager.updateButtons(), 50);

        if (sentinel) {
            const loader = sentinel.querySelector('i');
            if (loader) loader.style.opacity = '0';
        }

        // Check if finished
        if (this.loadedAreasCount >= total && sentinel) {
            sentinel.style.display = 'none';
            if (observer) observer.disconnect();
        }
    }

    // ✅ NUEVO: Renderizar Catálogo de Cursos POR ÁREAS (Lazy Loaded)
    renderAllCourses() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        const allCourses = this.allData.courses || [];
        const allCareers = this.allData.careers || [];

        // 1. Agrupar cursos por Área (usando Carreras)
        const coursesByArea = {};
        const noAreaKey = 'Formación General';

        allCourses.forEach(course => {
            let assignedToArea = false;

            // course.careerIds viene del backend como array de IDs
            if (course.careerIds && course.careerIds.length > 0) {
                course.careerIds.forEach(careerId => {
                    const career = allCareers.find(c => c.id === careerId);
                    if (career && career.area) {
                        const area = career.area;
                        if (!coursesByArea[area]) coursesByArea[area] = [];

                        // Evitar duplicados en la misma área
                        if (!coursesByArea[area].find(c => c.id === course.id)) {
                            coursesByArea[area].push(course);
                        }
                        assignedToArea = true;
                    }
                });
            }

            // Si no se asignó a ninguna área (sin carrera o carrera sin área)
            if (!assignedToArea) {
                if (!coursesByArea[noAreaKey]) coursesByArea[noAreaKey] = [];
                coursesByArea[noAreaKey].push(course);
            }
        });

        // 2. Ordenar Áreas
        this.sortedCourseAreas = Object.keys(coursesByArea).sort((a, b) => {
            if (a === noAreaKey) return 1;
            if (b === noAreaKey) return -1;
            return a.localeCompare(b);
        });

        this.coursesByAreaContext = coursesByArea;
        this.loadedCourseAreasCount = 0;

        // 3. Renderizar Estructura Base
        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                 <div class="course-main-header">
                    <div class="course-header-icon" style="background: linear-gradient(to bottom right, #3b82f6, #2563eb);">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">Cursos por Área Académica</h2>
                        <span class="course-badge" style="margin-top: 0.5rem; display: inline-block;">${allCourses.length} Cursos Disponibles</span>
                    </div>
                </div>

                <div class="course-detail-grid" style="grid-template-columns: 1fr;"> 
                    <div id="all-courses-content" class="course-main-content">
                        <!-- Areas will be injected here -->
                    </div>
                    <!-- Sentinel -->
                    <div id="all-courses-sentinel" style="height: 20px; width: 100%; margin-top: 20px; display: flex; justify-content: center;">
                         <i class="fas fa-circle-notch fa-spin" style="color: var(--accent); opacity: 0;"></i>
                    </div>
                </div>
            </div>
        `;

        // 4. Cargar Primer Lote
        this.loadMoreCourseAreas();

        // 5. Setup Infinite Scroll
        if (this.sortedCourseAreas.length > this.loadedCourseAreasCount) {
            this.setupInfiniteScroll('all-courses-sentinel', (s, o) => this.loadMoreCourseAreas(s, o));
        } else {
            const s = document.getElementById('all-courses-sentinel');
            if (s) s.style.display = 'none';
        }

        // Scroll top via Helper
        this._scrollToTop();
    }

    loadMoreCourseAreas(sentinel, observer) {
        const ARENAS_PER_LOAD = 3;
        const container = document.getElementById('all-courses-content');
        if (!container) return;

        const total = this.sortedCourseAreas.length;
        if (this.loadedCourseAreasCount >= total) {
            if (sentinel) sentinel.style.display = 'none';
            return;
        }

        const nextAreas = this.sortedCourseAreas.slice(this.loadedCourseAreasCount, this.loadedCourseAreasCount + ARENAS_PER_LOAD);
        this.loadedCourseAreasCount += nextAreas.length;

        let newHtml = '';
        nextAreas.forEach(area => {
            const courses = this.coursesByAreaContext[area];
            const coursesGrid = courses.map(course => createUnifiedResourceCardHTML({ ...course, type: 'course' })).join('');

            newHtml += `
                 <div class="area-group-section" style="margin-bottom: 3rem; opacity: 0; animation: fadeInUp 0.5s ease forwards;">
                    <button class="section-header" style="background: none; border: none; border-bottom: 1px solid var(--border-color); width: 100%; padding: 0 0 0.5rem 0;" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('fa-rotate-180');">
                         <h3 class="area-title" style="font-size: 1.1rem; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                            <i class="fas fa-university" style="color: var(--accent); font-size: 1rem;"></i>
                            ${area}
                         </h3>
                         <i class="fas fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s;"></i>
                    </button>
                    <div class="courses-grid" style="margin-top: 0.5rem;"> 
                         ${coursesGrid}
                    </div>
                </div>
            `;
        });

        container.insertAdjacentHTML('beforeend', newHtml);

        if (sentinel) {
            const loader = sentinel.querySelector('i');
            if (loader) loader.style.opacity = '0';
        }

        if (this.loadedCourseAreasCount >= total && sentinel) {
            sentinel.style.display = 'none';
            if (observer) observer.disconnect();
        }
    }

    async renderInitialView(pushToStack = true) {
        if (pushToStack && this.viewStack[this.viewStack.length - 1] !== 'home') {
            this.viewStack.push('home');
        }
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // ✅ MANTA REDESIGN (PHASE 30) - TABS SKELETON
        // 1. DIBUJAR LAS PESTAÑAS Y EL CONTENEDOR DE FILTROS A NIVEL ESTRUCTURAL

        const tabsHTML = `
            <div id="manta-navigation" class="manta-navigation-area">
                <div class="manta-tabs-container" id="manta-tabs">
                    <button class="manta-tab ${this.activeTab === 'biblioteca' ? 'active' : ''}" data-tab="biblioteca">Biblioteca</button>
                    <button class="manta-tab ${this.activeTab === 'cursos' ? 'active' : ''}" data-tab="cursos">Cursos</button>
                </div>
                <div class="manta-filters-container" id="manta-filters">
                    <!-- Pills renderizados dinámicamente aquí -->
                </div>
            </div>
            <div id="manta-grid-container" class="manta-content-grid" style="margin-top: 0;">
                <!-- Contenido (Cartas) renderizado dinámicamente aquí -->
            </div>
        `;

        // REEMPLAZAMOS EL BROWSE CONTAINER CON NUESTRA ESTRUCTURA LIMPIA
        this.browseContainer.innerHTML = tabsHTML;

        // ASIGNAR EVENT LISTENERS A LAS PESTAÑAS
        this.browseContainer.querySelectorAll('.manta-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                // Actualizar estado activo visual
                this.browseContainer.querySelectorAll('.manta-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Actualizar logica
                this.activeTab = e.currentTarget.dataset.tab;

                // Resetear el sub-filtro por defecto cuando se cambia de pestaña
                if (this.activeTab === 'biblioteca') {
                    this.activeFilter = 'Libros y Manuales';
                } else if (this.activeTab === 'cursos') {
                    // Buscar la primera área de carreras como default
                    const areas = [...new Set(this.allData.careers.map(c => c.area || 'Otras Áreas'))];
                    this.activeFilter = areas[0] || 'Ciencias de la salud';
                }

                this.renderTabContent();
            });
        });

        // 2. DISPARAR RENDERIZACION DEL CONTENIDO ACTUAL
        this.renderTabContent();
    }

    // ✅ NUEVO: Lógica dinámica de renderizado de contenido según Tab y Filtro
    async renderTabContent() {
        const filtersContainer = this.browseContainer.querySelector('#manta-filters');
        const gridContainer = this.browseContainer.querySelector('#manta-grid-container');

        // Limpiamos grilla y mostramos skeleton
        gridContainer.innerHTML = Array(6).fill('<div class="course-card">' + createSkeletonCardHTML('Grid') + '</div>').join('');

        if (this.activeTab === 'biblioteca') {
            // 1. DIBUJAR PILDORAS DE BIBLIOTECA
            const biblioFilters = [
                { id: 'Libros y Manuales', val: 'book' },
                { id: 'Papers Científicos', val: 'paper' },
                { id: 'Normas y Directivas', val: 'norma' },
                { id: 'Guías Clínicas', val: 'guia' }
            ];

            filtersContainer.innerHTML = biblioFilters.map(f => `
                <button class="manta-filter-pill ${this.activeFilter === f.id ? 'active' : ''}" data-filter-id="${f.id}" data-filter-val="${f.val}">
                    ${f.id}
                </button>
            `).join('');

            // Escuchar clics en pill
            this._attachFilterListeners(filtersContainer, async (valStr) => {
                // Llamar a Supabase o Cache
                let data = [];
                try {
                    const res = await fetch(`${window.AppConfig.API_URL}/api/books?type=${valStr}`);
                    if (res.ok) data = await res.json();
                } catch (e) { console.error('Error fetching library type', e); }

                if (!data || data.length === 0) {
                    gridContainer.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1;">No hay recursos en esta categoría.</p>';
                } else {
                    // Construcción Multi-Tema
                    const groupedData = data.reduce((acc, doc) => {
                        if (doc.topics && doc.topics.length > 0) {
                            doc.topics.forEach(t => {
                                let topicName = typeof t === 'object' && t !== null ? (t.name || t.title || 'General') : t;
                                if (!acc[topicName]) acc[topicName] = [];
                                // Evitar duplicar
                                if (!acc[topicName].some(item => item.id === doc.id)) {
                                    acc[topicName].push(doc);
                                }
                            });
                        } else {
                            if (!acc['General']) acc['General'] = [];
                            acc['General'].push(doc);
                        }
                        // Aplicar orden cronológico (más recientes primero según ID) como mejora extra
                        for (let key in acc) {
                            acc[key].sort((a, b) => (b.id || 0) - (a.id || 0));
                        }
                        return acc;
                    }, {});

                    let allCardsHTML = [];
                    for (const topic of Object.keys(groupedData).sort()) {
                        allCardsHTML.push(`<div class="manta-group-title" style="grid-column: 1/-1;">${topic}</div>`);
                        groupedData[topic].forEach(doc => {
                            allCardsHTML.push(createUnifiedResourceCardHTML(doc));
                        });
                    }

                    // ✅ PERFORMANCE MOBILE: Paginación DOM (Progressive Rendering)
                    gridContainer.innerHTML = '';
                    let currentIndex = 0;
                    const itemsPerPage = 20;

                    const renderNextBatch = () => {
                        const nextBatch = allCardsHTML.slice(currentIndex, currentIndex + itemsPerPage);
                        if (nextBatch.length === 0) return;

                        // Quitar el sentinel anterior si existe para poner uno nuevo al final
                        const oldSentinel = gridContainer.querySelector('.scroll-sentinel');
                        if (oldSentinel) oldSentinel.remove();

                        // Añadir HTML sin sobreescribir (insertAdjacentHTML es O(1))
                        gridContainer.insertAdjacentHTML('beforeend', nextBatch.join(''));
                        currentIndex += itemsPerPage;

                        // Si hay más elementos, crear un nuevo sentinel
                        if (currentIndex < allCardsHTML.length) {
                            const sentinel = document.createElement('div');
                            sentinel.className = 'scroll-sentinel';
                            sentinel.style.cssText = 'height: 10px; grid-column: 1/-1;';
                            gridContainer.appendChild(sentinel);

                            const observer = new IntersectionObserver((entries) => {
                                if (entries[0].isIntersecting) {
                                    observer.disconnect();
                                    requestAnimationFrame(renderNextBatch);
                                }
                            }, { rootMargin: '200px' });
                            observer.observe(sentinel);
                        }
                    };
                    renderNextBatch();
                }
            });

            // Disparar autollenado para la pildora activa
            const activePill = biblioFilters.find(f => f.id === this.activeFilter);
            if (activePill) {
                // Manual simulate fetch
                let data = [];
                try {
                    const res = await fetch(`${window.AppConfig.API_URL}/api/books?type=${activePill.val}`);
                    if (res.ok) data = await res.json();
                } catch (e) { }

                if (!data || data.length === 0) {
                    gridContainer.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1;">No hay recursos disponibles.</p>';
                } else {
                    // Construcción Multi-Tema
                    const groupedData = data.reduce((acc, doc) => {
                        if (doc.topics && doc.topics.length > 0) {
                            doc.topics.forEach(t => {
                                let topicName = typeof t === 'object' && t !== null ? (t.name || t.title || 'General') : t;
                                if (!acc[topicName]) acc[topicName] = [];
                                // Evitar duplicar
                                if (!acc[topicName].some(item => item.id === doc.id)) {
                                    acc[topicName].push(doc);
                                }
                            });
                        } else {
                            if (!acc['General']) acc['General'] = [];
                            acc['General'].push(doc);
                        }
                        // Aplicar orden cronológico (Nuevos primero)
                        for (let key in acc) {
                            acc[key].sort((a, b) => (b.id || 0) - (a.id || 0));
                        }
                        return acc;
                    }, {});

                    let allCardsHTML = [];
                    for (const topic of Object.keys(groupedData).sort()) {
                        allCardsHTML.push(`<div class="manta-group-title" style="grid-column: 1/-1;">${topic}</div>`);
                        groupedData[topic].forEach(doc => {
                            allCardsHTML.push(createUnifiedResourceCardHTML(doc));
                        });
                    }

                    // ✅ PERFORMANCE MOBILE: Paginación DOM (Progressive Rendering)
                    gridContainer.innerHTML = '';
                    let currentIndex = 0;
                    const itemsPerPage = 20;

                    const renderNextBatch = () => {
                        const nextBatch = allCardsHTML.slice(currentIndex, currentIndex + itemsPerPage);
                        if (nextBatch.length === 0) return;

                        const oldSentinel = gridContainer.querySelector('.scroll-sentinel');
                        if (oldSentinel) oldSentinel.remove();

                        gridContainer.insertAdjacentHTML('beforeend', nextBatch.join(''));
                        currentIndex += itemsPerPage;

                        if (currentIndex < allCardsHTML.length) {
                            const sentinel = document.createElement('div');
                            sentinel.className = 'scroll-sentinel';
                            sentinel.style.cssText = 'height: 10px; grid-column: 1/-1;';
                            gridContainer.appendChild(sentinel);

                            const observer = new IntersectionObserver((entries) => {
                                if (entries[0].isIntersecting) {
                                    observer.disconnect();
                                    requestAnimationFrame(renderNextBatch);
                                }
                            }, { rootMargin: '200px' });
                            observer.observe(sentinel);
                        }
                    };
                    renderNextBatch();
                }
            }


        } else if (this.activeTab === 'cursos') {
            // 1. DIBUJAR PILDORAS DINAMICAS SEGUN AREAS DE CARRERAS
            const areas = [...new Set(this.allData.careers.map(c => c.area || 'Otras Áreas'))].sort();

            filtersContainer.innerHTML = areas.map(a => `
                <button class="manta-filter-pill ${this.activeFilter === a ? 'active' : ''}" data-filter-id="${a}">
                    ${a}
                </button>
            `).join('');

            // Función helper para renderizar Cursos agrupados por Carrera
            const renderCoursesByCareer = (careersInArea) => {
                if (!careersInArea || careersInArea.length === 0) {
                    return '<p class="empty-state" style="grid-column: 1 / -1;">No hay carreras en esta área.</p>';
                }

                let html = '';
                careersInArea.forEach(career => {
                    // Filtrar cursos (castear IDs a String para evitar fallos strict equality)
                    const strCareerId = String(career.id);
                    const linkedCourses = this.allData.courses.filter(c => c.careerIds && c.careerIds.some(id => String(id) === strCareerId));
                    if (linkedCourses.length > 0) {
                        html += `<div class="manta-group-title">${career.title || career.name}</div>`;
                        linkedCourses.forEach(course => {
                            html += createUnifiedResourceCardHTML({ ...course, type: 'course' });
                        });
                    }
                });

                return html || '<p class="empty-state" style="grid-column: 1 / -1;">Aún no hay cursos asignados a las carreras de esta área.</p>';
            };

            // Escuchar clics
            this._attachFilterListeners(filtersContainer, (areaStr) => {
                const careersInArea = this.allData.careers.filter(c => (c.area || 'Otras Áreas') === areaStr);
                const rawHTML = renderCoursesByCareer(careersInArea);

                if (rawHTML.includes('empty-state')) {
                    gridContainer.innerHTML = rawHTML;
                    return;
                }

                // Convertir HTML continuo en Array de tarjetas para render progresivo
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rawHTML;
                const allCardsHTML = Array.from(tempDiv.children).map(el => el.outerHTML);

                // Lógica de Paginación DOM (Progressive)
                gridContainer.innerHTML = '';
                let currentIndex = 0;
                const itemsPerPage = 15;

                const renderNextBatch = () => {
                    const nextBatch = allCardsHTML.slice(currentIndex, currentIndex + itemsPerPage);
                    if (nextBatch.length === 0) return;

                    const oldSentinel = gridContainer.querySelector('.scroll-sentinel');
                    if (oldSentinel) oldSentinel.remove();

                    gridContainer.insertAdjacentHTML('beforeend', nextBatch.join(''));
                    currentIndex += itemsPerPage;

                    if (currentIndex < allCardsHTML.length) {
                        const sentinel = document.createElement('div');
                        sentinel.className = 'scroll-sentinel';
                        sentinel.style.cssText = 'height: 10px; grid-column: 1/-1;';
                        gridContainer.appendChild(sentinel);

                        const observer = new IntersectionObserver((entries) => {
                            if (entries[0].isIntersecting) {
                                observer.disconnect();
                                requestAnimationFrame(renderNextBatch);
                            }
                        }, { rootMargin: '200px' });
                        observer.observe(sentinel);
                    }
                };
                renderNextBatch();
            });

            // Disparar autollenado
            const careersInActiveArea = this.allData.careers.filter(c => (c.area || 'Otras Áreas') === this.activeFilter);
            const rawHTMLActive = renderCoursesByCareer(careersInActiveArea);

            if (rawHTMLActive.includes('empty-state')) {
                gridContainer.innerHTML = rawHTMLActive;
            } else {
                // Convertir HTML continuo en Array de tarjetas para render progresivo
                const tempDivActive = document.createElement('div');
                tempDivActive.innerHTML = rawHTMLActive;
                const allCardsHTMLActive = Array.from(tempDivActive.children).map(el => el.outerHTML);

                gridContainer.innerHTML = '';
                let currIndex = 0;
                const limitPerPage = 15;

                const renderInitBatch = () => {
                    const nextBatch = allCardsHTMLActive.slice(currIndex, currIndex + limitPerPage);
                    if (nextBatch.length === 0) return;

                    const oldSentinel = gridContainer.querySelector('.scroll-sentinel');
                    if (oldSentinel) oldSentinel.remove();

                    gridContainer.insertAdjacentHTML('beforeend', nextBatch.join(''));
                    currIndex += limitPerPage;

                    if (currIndex < allCardsHTMLActive.length) {
                        const sentinel = document.createElement('div');
                        sentinel.className = 'scroll-sentinel';
                        sentinel.style.cssText = 'height: 10px; grid-column: 1/-1;';
                        gridContainer.appendChild(sentinel);

                        const obs = new IntersectionObserver((entries) => {
                            if (entries[0].isIntersecting) {
                                obs.disconnect();
                                requestAnimationFrame(renderInitBatch);
                            }
                        }, { rootMargin: '200px' });
                        obs.observe(sentinel);
                    }
                };
                renderInitBatch();
            }
        }
    }

    // Helper privado para añadir Event Listeners a los filtros dinamicos
    _attachFilterListeners(container, fetchCallback) {
        container.querySelectorAll('.manta-filter-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                // Actualizar estado visual
                container.querySelectorAll('.manta-filter-pill').forEach(p => p.classList.remove('active'));
                const btn = e.currentTarget;
                btn.classList.add('active');

                // Actualizar estado logico
                this.activeFilter = btn.dataset.filterId;

                // Mostrar skeleton momentaneo
                const gridContainer = this.browseContainer.querySelector('#manta-grid-container');
                gridContainer.innerHTML = Array(6).fill('<div class="course-card">' + createSkeletonCardHTML('Grid') + '</div>').join('');

                // Ejecutar Callback con valor
                const fetchVal = btn.dataset.filterVal || btn.dataset.filterId;
                fetchCallback(fetchVal);
            });
        });
    }

    // ✅ NUEVA VISTA: TODOS LOS LIBROS DE MEDICINA
    renderMedicalBooksView() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');
        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                <div class="course-main-header">
                    <div class="course-header-icon" style="background: linear-gradient(to bottom right, #ef4444, #b91c1c);">
                        <i class="fas fa-book-medical"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">Libros de Medicina</h2>
                        <span class="course-badge" style="margin-top: 0.5rem; display: inline-block;">${this.medicalBooks.length} Recursos Disponibles</span>
                    </div>
                </div>

                    <!-- Usamos el mismo diseño en grilla (.books-grid) -->
                    <div class="books-grid" id="medical-books-grid">
                        ${this.medicalBooks.map(book => createUnifiedResourceCardHTML(book)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Scroll top robusto
        this._scrollToTop();
    }

    /**
     * ✅ HELPER: Scroll to Top Robusto
     * Fuerza el scroll al inicio en todos los contenedores posibles
     * para asegurar compatibilidad Desktop/Mobile.
     */
    _scrollToTop() {
        // 1. Standard Window Scroll
        window.scrollTo({ top: 0, behavior: 'instant' }); // 'instant' evita conflictos de animación

        // 2. Document Body & Element
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        // 3. Contenedores internos (por si acaso hay overflow)
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) mainContainer.scrollTop = 0;

        const contentContainer = document.getElementById('content-container');
        if (contentContainer) contentContainer.scrollTop = 0;
    }
}

// Instanciar el componente cuando el DOM esté listo para evitar accesos
// a elementos que aún no existen.
document.addEventListener('DOMContentLoaded', () => {
    window.searchComponent = new SearchComponent();
});