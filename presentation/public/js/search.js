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
        this.allData = { careers: [], courses: [], topics: [], books: [] };

        // Estado de la vista para la navegación de retorno
        this.viewStack = []; // Pila para gestionar el historial de navegación
        this.currentView = {}; // Vista actual

        this.init();
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
            const [careersRes, coursesRes, topicsRes, booksRes] = await Promise.all([
                fetch(`${window.AppConfig.API_URL}/api/careers`),
                fetch(`${window.AppConfig.API_URL}/api/courses`),
                fetch(`${window.AppConfig.API_URL}/api/topics`),
                fetch(`${window.AppConfig.API_URL}/api/books`) // ✅ AÑADIDO: Cargar los libros
            ]);
            this.allData.careers = await careersRes.json();
            this.allData.courses = await coursesRes.json();
            this.allData.topics = await topicsRes.json();
            this.allData.books = await booksRes.json(); // ✅ AÑADIDO: Guardar los libros
        } catch (error) {
            console.error("Error loading all data for browsing:", error);
            this.browseContainer.innerHTML = `<p class="error-state">No se pudo cargar la información para explorar.</p>`;
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
        if (!state) {
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
        // ✅ LÓGICA DE VISIBILIDAD DEL HERO Y BOTÓN VOLVER GLOBAL
        const headerBackBtn = document.getElementById('header-back-btn');
        const searchSection = document.querySelector('.search-section');

        if (viewName === 'home') {
            document.body.classList.remove('hero-hidden');
            if (searchSection) searchSection.classList.remove('sticky');
            if (headerBackBtn) {
                headerBackBtn.classList.add('hidden'); // Ensure hidden class is added
                headerBackBtn.classList.remove('visible');
            }
        } else {
            document.body.classList.add('hero-hidden');
            if (headerBackBtn) {
                headerBackBtn.classList.remove('hidden'); // Ensure hidden class is removed so visible works
                headerBackBtn.classList.add('visible');
            }
        }

        switch (viewName) {
            case 'career':
                this.renderCoursesForCareer(...args);
                break;
            case 'course':
                this.renderUnifiedCourseView(...args);
                break;
            // ... (resto igual)
            case 'topic':
                this.renderTopicView(...args);
                break;
            case 'search':
                this.renderSearchResults(...args);
                break;
            case 'home':
                this.renderInitialView();
                break;
            default:
                console.warn('Vista desconocida:', viewName);
                this.renderInitialView();
        }
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

        // ✅ NUEVO: Manejar clics en los stickers de carrera.
        // Esta es la acción más específica y debe tener la máxima prioridad para evitar
        // que el evento se propague al contenedor padre (la tarjeta del curso).
        const careerBadge = e.target.closest('.course-badge[data-career-id]');
        if (careerBadge) {
            // Detenemos la propagación para que el clic en el sticker no active
            // el clic en la tarjeta del curso que lo contiene.
            e.stopPropagation();
            e.preventDefault();
            const careerId = parseInt(careerBadge.dataset.careerId, 10);
            if (!isNaN(careerId)) {
                // Navegamos a la vista que renderiza los cursos para esa carrera.
                this.navigateTo('career', careerId);
            }
            return;
        }

        // ✅ LÓGICA DE NAVEGACIÓN UNIFICADA: Maneja clics en tarjetas de exploración (carrera, curso, tema).
        const browseCard = e.target.closest('[data-type]');
        if (browseCard) {
            // ✅ REFACTOR MPA: Ya no interceptamos con preventDefault().
            // Dejamos que el onclick definido en el HTML (components.js) haga la redirección:
            // window.location.href = 'page.html?id=...'

            // Si por alguna razón el onclick no está, forzamos la redirección aquí como fallback.
            const type = browseCard.dataset.type;
            const id = browseCard.dataset.id;

            if (type && id) {
                // Si el elemento ya tiene un onclick que maneja la navegación, esto es redundante pero seguro.
                // Pero para asegurar que NO se use navigateTo (SPA), simplemente retornamos.
                // El onclick del HTML se encargará.
                return;
            }
        }

        // ✅ SOLUCIÓN: Manejar clics en las tarjetas de recomendación.
        // Se mueve aquí para que no interfiera con la lógica de los stickers.
        const recommendationCard = e.target.closest('.recommendation-card[data-rec-id]');
        if (recommendationCard) {
            e.preventDefault();
            const type = recommendationCard.dataset.recType;
            const id = parseInt(recommendationCard.dataset.recId, 10);

            if (!isNaN(id)) {
                if (type === 'course') this.navigateTo('course', id);
                if (type === 'topic') this.navigateTo('topic', id);
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
        this.resultsContainer.innerHTML = `<div class="loading-state">Buscando inteligentemente...</div>`;

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
        const foundBooks = data.results.filter(item => item.type === 'book' || item.resource_type === 'book');
        const foundCourses = data.results.filter(item => item.type === 'course' || (!item.type && !item.resource_type));

        // 3. Construir HTML de Libros (Tamaño pequeño - Grid de Libros)
        let booksSectionHTML = '';
        if (foundBooks.length > 0) {
            const booksHTML = foundBooks.map(book => create3DBookCardHTML(book)).join('');
            booksSectionHTML = `
                <div class="section-header" style="margin-top: 1.5rem; border-bottom: none;">
                    <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Libros Encontrados (${foundBooks.length})</h3>
                </div>
                <!-- ✅ USAMOS books-grid PARA TAMAÑO CORRECTO (Igual que en Home) -->
                <div class="books-grid"> 
                    ${booksHTML}
                </div>
            `;
        }

        // 4. Construir HTML de Cursos (Tamaño grande - Exploración)
        let coursesSectionHTML = '';
        if (foundCourses.length > 0) {
            // ✅ Asegurar que usamos 'course' para el estilo correcto
            const coursesHTML = foundCourses.map(course => createBrowseCardHTML(course, 'course')).join('');
            coursesSectionHTML = `
                <div class="section-header" style="margin-top: 2.5rem; border-bottom: none;">
                     <h3 class="browse-title" style="margin-bottom: 0.5rem; font-size: 1.25rem;">Cursos Encontrados (${foundCourses.length})</h3>
                </div>
                <!-- ✅ USAMOS browse-grid PARA TARJETAS GRANDES -->
                <div class="browse-grid" style="margin-top: 0.5rem;"> 
                     ${coursesHTML}
                </div>
            `;
        }

        let contentHTML = '';
        if (foundBooks.length === 0 && foundCourses.length === 0) {
            contentHTML = `<p class="empty-state" style="margin-top: 2rem;">No se encontraron resultados para "${data.searchQuery}".</p>`;
        } else {
            contentHTML = booksSectionHTML + coursesSectionHTML;
        }

        // 5. Secciones inferiores (Recomendaciones + Chat)
        let bottomSectionsHTML = '';
        const classification = data.queryClassification || 'General';

        if (data.isEducationalQuery || (data.results && data.results.length === 0)) {
            bottomSectionsHTML = `
                ${createSpecificChatPromoHTML(data.searchQuery, classification)}
                ${createRecommendationsSectionHTML(data.recommendations)}
            `;
        } else {
            bottomSectionsHTML = `
                ${createRecommendationsSectionHTML(data.recommendations)}
                ${createChatPromoSectionHTML()}
            `;
        }

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
                </div>

                <!-- SECCIONES INFERIORES -->
                <div style="margin-top: 3rem;">
                    ${bottomSectionsHTML}
                </div>
            </div>
        `;
    }

    // setupFilterListeners() ELIMINADO: Ya no hay sidebar de filtros.

    // =================================================================
    // ✅ FIN: SECCIÓN AÑADIDA
    // =================================================================

    renderInitialView() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // ✅ CORRECCIÓN: Asegurarse de que this.allData.careers esté cargado.
        if (!this.allData.careers || this.allData.careers.length === 0) {
            this.browseContainer.innerHTML = `<h2 class="browse-title">Áreas de Estudio</h2><p class="empty-state">No se encontraron áreas para mostrar.</p>`;
            return;
        }

        // ==========================================
        // 1. SECCIÓN: LIBROS DESTACADOS (MEDICINA)
        // ==========================================
        let featuredBooks = [];
        // Intentamos encontrar un curso de Medicina para mostrar sus libros.
        const medicineCourse = this.allData.courses.find(c => c.name.toLowerCase().includes('medicina'));

        if (medicineCourse && medicineCourse.materials && medicineCourse.materials.length > 0) {
            featuredBooks = medicineCourse.materials.slice(0, 6); // Límite de 6 libros
        } else if (this.allData.books && this.allData.books.length > 0) {
            // Fallback: mostrar libros genéricos si no hay curso de medicina
            featuredBooks = this.allData.books.slice(0, 6);
        }

        let featuredBooksSection = '';
        if (featuredBooks.length > 0) {
            const booksHTML = featuredBooks.map(book => create3DBookCardHTML(book)).join('');
            featuredBooksSection = `
                <section class="featured-section">
                    <div class="section-header">
                        <h2 class="browse-title" style="margin-bottom: 0;">Libros Destacados</h2>
                        <span class="section-subtitle" style="display:block; color: var(--text-muted); margin-top: 4px; margin-bottom: 0.5rem;">Recursos esenciales de Medicina y Salud</span>
                    </div>
                    <div class="books-grid">
                        ${booksHTML}
                    </div>
                </section>
                <div class="section-spacer" style="height: 1rem;"></div>
            `;
        }

        // ==========================================
        // 1.5. SECCIÓN: CURSOS DESTACADOS
        // ==========================================
        let featuredCourses = this.allData.courses.filter(c => c.image_url && c.image_url.trim() !== "").slice(0, 4);
        // Si no hay cursos con imágenes, o son muy pocos, completamos con los primeros disponibles
        if (featuredCourses.length < 4) {
            const remaining = 4 - featuredCourses.length;
            const others = this.allData.courses.filter(c => !featuredCourses.includes(c)).slice(0, remaining);
            featuredCourses = [...featuredCourses, ...others];
        }

        let featuredCoursesSection = '';
        if (featuredCourses.length > 0) {
            const coursesHTML = featuredCourses.map(course => createBrowseCardHTML(course, 'course')).join('');
            featuredCoursesSection = `
                <section class="featured-section">
                    <div class="section-header">
                        <h2 class="browse-title" style="margin-bottom: 0;">Cursos Destacados</h2>
                        <span class="section-subtitle" style="display:block; color: var(--text-muted); margin-top: 4px; margin-bottom: 0.5rem;">Descubre nuestros cursos más populares</span>
                    </div>
                    <!-- Usamos browse-grid para mantener consistencia con las tarjetas de curso -->
                    <div class="browse-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
                        ${coursesHTML}
                    </div>
                </section>
                <div class="section-spacer" style="height: 1rem;"></div>
            `;
        }

        // ==========================================
        // 2. SECCIÓN: TEASER DEL TUTOR IA
        // ==========================================
        const aiTeaserSection = `
            <div class="ai-teaser-card" style="background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--surface) 100%); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem; display: flex; align-items: center; gap: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; overflow: hidden;">
                <!-- Decoración de fondo -->
                <div style="position: absolute; right: -20px; top: -20px; opacity: 0.05; font-size: 10rem; transform: rotate(15deg); pointer-events: none;">
                    <i class="fas fa-robot"></i>
                </div>
                
                <div class="ai-teaser-icon" style="flex-shrink: 0; width: 80px; height: 80px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; box-shadow: 0 8px 16px rgba(56, 189, 248, 0.3);">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="ai-teaser-content" style="flex: 1; z-index: 1;">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 700;">Tu Asistente Académico Inteligente</h3>
                    <p style="margin: 0 0 1.5rem 0; color: var(--text-muted); line-height: 1.6; max-width: 600px;">Obtén respuestas instantáneas sobre tus cursos, resúmenes de temas complejos y recomendaciones personalizadas de estudio.</p>
                     <button class="btn-primary" onclick="window.openChat()" style="padding: 12px 24px; font-size: 1rem;">
                        <i class="fas fa-comments"></i> Pregúntale al Tutor
                    </button>
                </div>
            </div>
        `;

        // ==========================================
        // 3. SECCIÓN: ÁREAS DE ESTUDIO (Agrupadas)
        // ==========================================
        const careersByArea = this.allData.careers.reduce((acc, career) => {
            const area = career.area || 'Otras Áreas';
            if (!acc[area]) acc[area] = [];
            acc[area].push(career);
            return acc;
        }, {});

        // Ordenar áreas alfabéticamente, dejando 'Otras Áreas' al final si existe
        const sortedAreas = Object.keys(careersByArea).sort((a, b) => {
            if (a === 'Otras Áreas') return 1;
            if (b === 'Otras Áreas') return -1;
            return a.localeCompare(b);
        });

        let areasHTML = '';
        sortedAreas.forEach(area => {
            const careers = careersByArea[area];
            const careersHTML = careers.map(career => createBrowseCardHTML(career, 'career')).join('');

            areasHTML += `
                <div class="area-section">
                    <h3 class="area-title">${area}</h3>
                    <div class="browse-grid">${careersHTML}</div>
                </div>
            `;
        });

        this.browseContainer.innerHTML = /*html*/`
            ${featuredBooksSection}
            ${featuredCoursesSection}
            <div class="section-header">
                <h2 class="browse-title" style="margin-bottom: 0;">Áreas de Estudio</h2>
                <p class="section-subtitle" style="margin-bottom: 0.25rem; color: var(--text-muted); margin-top: 4px;">Explora nuestra oferta académica por disciplina</p>
            </div>
            ${areasHTML}
            <div class="section-spacer" style="height: 1rem;"></div>
            ${aiTeaserSection}
        `;
    }

    renderCoursesForCareer(careerId) {
        // ✅ NUEVO: Registrar la vista de la página de carrera.
        AnalyticsApiService.recordView('career', careerId);

        const career = this.allData.careers.find(c => c.id === careerId);
        if (!career) return;

        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // Filtrar cursos (temporalmente mostramos todos si no hay lógica específica, o podríamos filtrar por nombre)
        // Para este refactor, mantendremos la lógica actual de "todos los cursos" (o lo que estaba antes)
        // pero con un layout profesional.
        const coursesInCareer = this.allData.courses;

        let coursesHTML = '';
        if (coursesInCareer.length > 0) {
            coursesHTML = coursesInCareer.map(course => createBrowseCardHTML(course, 'course')).join('');
        } else {
            coursesHTML = `<p class="empty-state">No hay cursos disponibles para esta carrera todavía.</p>`;
        }

        const descriptionHTML = career.description
            ? `<p class="career-description">${career.description}</p>`
            : '<p class="course-description"><span class="no-material">No hay una descripción disponible para esta carrera.</span></p>';

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                <div class="detail-navigation">
                    ${createBackButtonHTML()}
                </div>
                
                <div class="course-main-header">
                    <div class="course-header-icon" style="background: linear-gradient(to bottom right, var(--bg-tertiary), var(--bg-secondary));">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">${career.name}</h2>
                        <span class="course-badge" style="margin-top: 0.5rem; display: inline-block;">Carrera Profesional</span>
                    </div>
                </div>

                <div class="course-detail-grid">
                    <!-- Columna Principal -->
                    <div class="course-main-content">
                        <div class="detail-section">
                            <h3 class="detail-section-title">Acerca de la Carrera</h3>
                            ${descriptionHTML}
                            ${career.curriculum_url ? `
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                    <h4 style="margin-bottom: 0.5rem; font-size: 1rem; color: var(--text-main);">Plan de Estudios</h4>
                                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">Descarga la malla curricular oficial para ver el detalle de asignaturas.</p>
                                    <a href="${career.curriculum_url}" target="_blank" class="btn-secondary">
                                        <i class="fas fa-file-pdf"></i> Ver Malla Curricular
                                    </a>
                                </div>
                            ` : ''}
                        </div>

                        <div class="detail-section" style="background: transparent; padding: 0; box-shadow: none; border: none;">
                            <h3 class="detail-section-title" style="border-bottom: none; margin-bottom: 1rem;">Cursos Disponibles</h3>
                            <div class="browse-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
                                ${coursesHTML}
                            </div>
                        </div>
                    </div>

                    <!-- Barra Lateral -->
                    <aside class="course-sidebar">
                        ${createContextualChatButtonHTML('career', career.name)}
                        
                        <div class="sidebar-section">
                            <h4 class="sidebar-title">Información Rápida</h4>
                            <ul class="section-schedule" style="font-size: 0.9rem;">
                                <li><i class="fas fa-university" style="width: 20px; text-align: center;"></i> Facultad de Ingeniería</li>
                                <li><i class="fas fa-clock" style="width: 20px; text-align: center;"></i> 10 Semestres</li>
                                <li><i class="fas fa-map-marker-alt" style="width: 20px; text-align: center;"></i> Campus San Joaquín</li>
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>
        `;
    }

    async renderUnifiedCourseView(courseId) {
        // ✅ NUEVO: Registrar la vista de la página de curso.
        AnalyticsApiService.recordView('course', courseId);

        const course = this.allData.courses.find(c => c.id === courseId);
        if (!course) {
            this.browseContainer.innerHTML = `<p class="error-state">No se encontró el curso solicitado.</p>`;
            return;
        }

        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // Secciones eliminadas
        const sectionsHTML = '';

        const courseDescriptionHTML = course.description
            ? `<p class="course-description">${course.description.replace(/\n/g, '<br>')}</p>`
            : '<p class="course-description"><span class="no-material">No hay una descripción disponible para este curso.</span></p>';

        // ✅ MEJORA: Obtener icono para el header
        // ✅ MEJORA: Obtener icono para el header
        const courseIconClass = getIconForItem(course.name, 'course');

        // ✅ FIX: Definir 'books' y 'topics' extraídos del objeto curso.
        // El repositorio devuelve 'materials' para los libros y 'topics' para los temas.
        const books = course.materials || [];
        const topics = course.topics || [];

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                <div class="detail-navigation">
                    ${createBackButtonHTML()}
                </div>
                
                <div class="course-main-header">
                    <div class="course-header-icon">
                        <i class="fas ${courseIconClass}"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">${course.name} ${course.code ? `(${course.code})` : ''}</h2>

                    </div>
                </div>

                <div class="course-detail-grid">
                    <!-- Columna Principal -->
                    <div class="course-main-content">
                        <div class="detail-section">
                            <h3 class="detail-section-title">Descripción del Curso</h3>
                            ${courseDescriptionHTML}
                        </div>
                        <div class="detail-section">
                            <h3 class="detail-section-title">Bibliografía Recomendada</h3>
                            <div class="material-list">
                                ${books.length > 0 ? books.map(b => `
                                    <!-- ✅ SOLUCIÓN: Eliminar target="_blank" para permitir que JS controle el clic. -->
                                    <a href="${b.url}" class="material-card">
                                        <div class="material-card-icon"><i class="far fa-file-pdf"></i></div>
                                        <div class="material-card-info">
                                            <span class="material-title">${b.title}</span>
                                            <span class="material-author">por ${b.author}</span>
                                        </div>
                                        <div class="material-card-arrow"><i class="fas fa-arrow-right"></i></div>
                                    </a>
                                `).join('') : '<p class="empty-state-small">No hay bibliografía recomendada.</p>'}
                            </div>
                        </div>
                    </div>

                    <!-- Barra Lateral -->
                    <aside class="course-sidebar">
                        ${createContextualChatButtonHTML('course', course.name)}
                        <div class="sidebar-section">
                            <h4 class="sidebar-title">Temas del Curso</h4>
                            <div class="topic-list">
                                ${topics.length > 0 ? topics.map(t => `<button class="topic-tag" data-type="topic" data-id="${t.id}">${t.name}</button>`).join('') : '<p class="empty-state-small">No hay temas asociados.</p>'}
                            </div>
                        </div>

                    </aside>
                </div>
            </div>
        `;
    }

    async renderTopicView(topicId) {
        // ✅ NUEVO: Registrar la vista de la página de tema.
        AnalyticsApiService.recordView('topic', topicId);

        const topic = this.allData.topics.find(t => t.id === topicId);
        if (!topic) {
            this.browseContainer.innerHTML = `<p class="error-state">No se encontró el tema solicitado.</p>`;
            return;
        }

        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        const booksForTopic = (topic.bookIds || []).map(id => this.allData.books.find(b => b.id === id)).filter(Boolean);

        // ✅ MEJORA: Encontrar cursos que incluyan este tema.
        const relatedCourses = this.allData.courses.filter(course => course.topicIds && course.topicIds.includes(topicId));

        // ✅ MEJORA: Usar el mismo layout que la vista de curso para consistencia.
        const topicDescriptionHTML = topic.description
            ? `<p class="course-description">${topic.description.replace(/\n/g, '<br>')}</p>`
            : '<p class="course-description"><span class="no-material">No hay una descripción disponible para este tema.</span></p>';

        const topicIconClass = getIconForItem(topic.name, 'topic'); // Asumiendo que getIconForItem puede manejar 'topic'

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-view-container">
                <div class="detail-navigation">
                    ${createBackButtonHTML()}
                </div>
                
                <div class="course-main-header">
                    <div class="course-header-icon">
                        <i class="fas ${topicIconClass}"></i>
                    </div>
                    <div class="course-header-title">
                        <h2 class="detail-view-title">${topic.name}</h2>
                    </div>
                </div>

                <div class="course-detail-grid">
                    <!-- Columna Principal -->
                    <div class="course-main-content">
                        <div class="detail-section">
                            <h3 class="detail-section-title">Descripción del Tema</h3>
                            ${topicDescriptionHTML}
                        </div>
                        <div class="detail-section">
                            <h3 class="detail-section-title">Bibliografía Recomendada</h3>
                            <div class="material-list">
                                ${booksForTopic.length > 0 ? booksForTopic.map(b => `
                                    <!-- ✅ SOLUCIÓN: Eliminar target="_blank" para permitir que JS controle el clic. -->
                                    <a href="${b.url}" class="material-card">
                                        <div class="material-card-icon"><i class="far fa-file-pdf"></i></div>
                                        <div class="material-card-info">
                                            <span class="material-title">${b.title}</span>
                                            <span class="material-author">por ${b.author}</span>
                                        </div>
                                        <div class="material-card-arrow"><i class="fas fa-arrow-right"></i></div>
                                    </a>
                                `).join('') : '<p class="empty-state-small">No hay bibliografía recomendada para este tema.</p>'}
                            </div>
                        </div>
                    </div>

                    <!-- Barra Lateral -->
                    <aside class="course-sidebar">
                        ${createContextualChatButtonHTML('topic', topic.name)}
                        <div class="sidebar-section">
                            <h4 class="sidebar-title">Cursos Relacionados</h4>
                            <div class="topic-list">
                                ${relatedCourses.length > 0 ? relatedCourses.map(c => `<button class="topic-tag" data-type="course" data-id="${c.id}">${c.name}</button>`).join('') : '<p class="empty-state-small">No hay cursos que cubran este tema.</p>'}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        `;
    }

    // ✅ NUEVO: Funciones para controlar el visor de PDF
    // ✅ NUEVO: Funciones para controlar el visor de PDF (ELIMINADO)
}

// Instanciar el componente cuando el DOM esté listo para evitar accesos
// a elementos que aún no existen.
document.addEventListener('DOMContentLoaded', () => {
    window.searchComponent = new SearchComponent();
});