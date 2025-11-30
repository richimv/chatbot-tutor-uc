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
        this.allData = { careers: [], courses: [], sections: [], instructors: [], topics: [], books: [] };

        // Estado de la vista para la navegación de retorno
        this.viewStack = []; // Pila para gestionar el historial de navegación
        this.currentView = {}; // Vista actual

        this.init();
    }

    async init() {
        await this.loadAllData();
        this.setupEventListeners();

        // ✅ LÓGICA DE HISTORIAL: Manejar el botón Atrás
        window.addEventListener('popstate', this.handlePopState.bind(this));

        // Si ya hay un estado (ej: recarga de página), lo restauramos.
        // Si no, establecemos el estado inicial.
        if (history.state) {
            this.handlePopState({ state: history.state });
        } else {
            history.replaceState({ view: 'home' }, '', '#home');
            this.renderInitialView();
        }
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, sectionsRes, instructorsRes, topicsRes, booksRes] = await Promise.all([
                fetch(`${window.AppConfig.API_URL}/api/careers`),
                fetch(`${window.AppConfig.API_URL}/api/courses`),
                fetch(`${window.AppConfig.API_URL}/api/sections`),
                fetch(`${window.AppConfig.API_URL}/api/instructors`),
                fetch(`${window.AppConfig.API_URL}/api/topics`),
                fetch(`${window.AppConfig.API_URL}/api/books`) // ✅ AÑADIDO: Cargar los libros
            ]);
            this.allData.careers = await careersRes.json();
            this.allData.courses = await coursesRes.json();
            this.allData.sections = await sectionsRes.json();
            this.allData.instructors = await instructorsRes.json();
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
        // Se mueve aquí para que siempre esté activo, sin importar el contenedor visible.
        document.addEventListener('click', (e) => {
            const homeButton = e.target.closest('.nav-home-button');
            if (homeButton) {
                e.preventDefault();
                if (homeButton) {
                    e.preventDefault();
                    this.startNewNavigation('home'); // Volver al inicio
                }
            }
        });
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
        this.renderView(state.view, ...state.args);
    }

    /**
     * Dispatcher centralizado para renderizar vistas.
     */
    renderView(viewName, ...args) {
        switch (viewName) {
            case 'career':
                this.renderCoursesForCareer(...args);
                break;
            case 'course':
                this.renderUnifiedCourseView(...args);
                break;
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
            e.preventDefault();
            const type = browseCard.dataset.type;
            const id = parseInt(browseCard.dataset.id, 10);

            if (!isNaN(id)) {
                if (type === 'career') this.navigateTo('career', id);
                if (type === 'course') this.navigateTo('course', id);
                if (type === 'topic') this.navigateTo('topic', id);
            }
            return;
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

            // 1. Si es un enlace de OneDrive/SharePoint o Google Drive, SIEMPRE abrir en una nueva pestaña.
            // Esto evita todos los problemas de autenticación y seguridad de los iframes.
            if (url.includes('sharepoint.com') || url.includes('drive.google.com')) {
                window.open(url, '_blank');
                return;
            }

            // 2. Si es un enlace directo a un archivo .pdf, abrirlo en nuestro visor modal.
            let embedUrl = null;
            if (url.toLowerCase().endsWith('.pdf')) {
                embedUrl = url;
            }

            if (embedUrl) {
                this.openPdfModal(embedUrl, title);
            } else {
                window.open(url, '_blank');
            }
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

        // 2. Construir el HTML de los resultados y las recomendaciones.
        let resultsHTML = '';
        if (data.results && data.results.length > 0) {
            // ✅ SOLUCIÓN: Las secciones inferiores ahora se construyen por separado.
            resultsHTML = data.results.map(course => createSearchResultCardHTML(course)).join('');
        } else {
            resultsHTML = `<p class="empty-state" style="grid-column: 1 / -1;">No se encontraron cursos para "${data.searchQuery}".</p>`;
        }
        // ✅ SOLUCIÓN: Determinar el orden de las secciones inferiores según el tipo de búsqueda.
        let bottomSectionsHTML = '';

        // Si es una consulta educativa O si no hay resultados (para no dejar al usuario sin opciones)
        if (data.isEducationalQuery || (data.results && data.results.length === 0)) {
            // Para búsquedas profundas: primero la promo del chat, luego las recomendaciones. 
            // 4. Mostrar sección "Profundiza en tu pregunta" si es consulta educativa
            // ✅ MEJORA: Personalizar el mensaje según el tipo de búsqueda (Carrera, Curso, Tema)
            const classification = data.queryClassification || 'General';
            // Se añade directamente al HTML de resultados.
            resultsHTML += createSpecificChatPromoHTML(data.searchQuery, classification);
            bottomSectionsHTML = createRecommendationsSectionHTML(data.recommendations);
        } else {
            // Para búsquedas normales: primero las recomendaciones, luego la promo general.
            bottomSectionsHTML = `
                ${createRecommendationsSectionHTML(data.recommendations)}
                ${createChatPromoSectionHTML()}
            `;
        }

        // 3. Ensamblar la estructura completa de la página de resultados.
        // ✅ SOLUCIÓN DEFINITIVA: Estructura de dos niveles.
        // 1. Un 'search-layout' superior con dos columnas: filtros y resultados.
        // 2. Las secciones de recomendaciones y chat se colocan FUERA y DEBAJO de ese layout.
        this.resultsContainer.innerHTML = /*html*/`
            <!-- SECCIÓN SUPERIOR: DOS COLUMNAS (FILTROS + CURSOS) -->
            <!-- ✅ MEJORA RESPONSIVE: Botón para abrir filtros en móvil.
                 La clase 'filter-open-btn-container' hace que solo sea visible en pantallas pequeñas gracias al CSS. -->
            <div class="filter-open-btn-container">
                <button id="open-filter-modal-btn" class="btn-secondary">☰ Filtrar Resultados</button>
            </div>
            <div class="search-layout"> 
                <!-- Columna 1: Filtros -->
                ${createFilterSidebarHTML(this.allData.careers)} 
                
                <!-- Columna 2: Resultados de Cursos -->
                <div class="results-list"> 
                    <div class="search-results-header">
                        <h2 class="search-results-title">Resultados para "${data.searchQuery}"</h2>
                    </div>
                    ${resultsHTML}
                </div>
            </div>

            <!-- SECCIÓN INFERIOR: ANCHO COMPLETO (RECOMENDACIONES + CHAT) -->
            ${bottomSectionsHTML}
        `;

        // 4. Añadir los event listeners para que los filtros recién creados funcionen.
        this.setupFilterListeners();
    }

    setupFilterListeners() {
        const filterSidebar = this.resultsContainer.querySelector('.filter-sidebar');
        if (!filterSidebar) return;

        // ✅ SOLUCIÓN RESPONSIVE: Lógica para mover los filtros al modal en móvil.
        const openModalBtn = document.getElementById('open-filter-modal-btn');
        const filterModal = document.getElementById('filter-modal');
        const filterModalBody = document.getElementById('filter-modal-body');
        const closeModalBtn = filterModal?.querySelector('.modal-close');
        const searchLayout = this.resultsContainer.querySelector('.search-layout');

        // Si estamos en móvil (el botón de abrir modal es visible)
        if (window.getComputedStyle(openModalBtn.parentElement).display !== 'none') {
            // Mover el sidebar al cuerpo del modal
            if (filterModalBody) filterModalBody.appendChild(filterSidebar);

            openModalBtn.addEventListener('click', () => {
                filterModal.style.display = 'flex';
            });

            closeModalBtn.addEventListener('click', () => {
                filterModal.style.display = 'none';
            });
        } else {
            // Si estamos en escritorio, nos aseguramos de que el sidebar esté en su sitio.
            if (searchLayout) {
                searchLayout.prepend(filterSidebar);
            }
        }

        // El listener de los checkboxes funciona igual en móvil y escritorio.
        filterSidebar.addEventListener('change', (e) => {
            if (e.target.classList.contains('filter-checkbox')) {
                const selectedCareers = Array.from(filterSidebar.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                const allCourseCards = this.resultsContainer.querySelectorAll('.course-card-link');

                allCourseCards.forEach(card => {
                    const cardCareers = card.dataset.careers.split(',');
                    // Si no hay filtros seleccionados, o si alguna de las carreras de la tarjeta está en las seleccionadas, se muestra.
                    const shouldShow = selectedCareers.length === 0 || cardCareers.some(cc => selectedCareers.includes(cc));
                    card.style.display = shouldShow ? 'block' : 'none';
                });
            }
        });

        // ✅ SOLUCIÓN: Añadir la lógica para la barra de búsqueda de carreras.
        const careerSearchInput = filterSidebar.querySelector('#career-filter-search');
        if (careerSearchInput) {
            const filterOptions = filterSidebar.querySelector('.filter-options');
            const careerCheckboxes = filterOptions.querySelectorAll('.form-check');

            careerSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();

                careerCheckboxes.forEach(checkContainer => {
                    // Usamos .textContent para obtener el nombre de la carrera desde la etiqueta.
                    const careerName = checkContainer.querySelector('label').textContent.toLowerCase();

                    if (careerName.includes(searchTerm)) {
                        checkContainer.style.display = 'flex'; // Mostrar si coincide
                    } else {
                        checkContainer.style.display = 'none'; // Ocultar si no coincide
                    }
                });
            });
        }
    }

    // =================================================================
    // ✅ FIN: SECCIÓN AÑADIDA
    // =================================================================

    renderInitialView() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // ✅ CORRECCIÓN: Asegurarse de que this.allData.careers esté cargado.
        // Si no hay carreras, se muestra un mensaje en lugar de un contenedor vacío.
        if (!this.allData.careers || this.allData.careers.length === 0) {
            this.browseContainer.innerHTML = `<h2 class="browse-title">Explorar por Carrera</h2><p class="empty-state">No se encontraron carreras para mostrar.</p>`;
            return;
        }
        const careersHTML = this.allData.careers.map(career => createBrowseCardHTML(career, 'career')).join('');

        this.browseContainer.innerHTML = /*html*/`
            <h2 class="browse-title">Explorar por Carrera</h2>
            <div class="browse-grid">${careersHTML}</div>
        `;
    }

    renderCoursesForCareer(careerId) {
        // ✅ NUEVO: Registrar la vista de la página de carrera.
        AnalyticsApiService.recordView('career', careerId);

        const career = this.allData.careers.find(c => c.id === careerId);
        if (!career) return;

        // ✅ SOLUCIÓN AL BUG: Ocultar el contenedor de resultados y mostrar el de exploración.
        // Esto asegura que la navegación desde un sticker sea visible inmediatamente.
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // Encontrar todas las secciones que pertenecen a esta carrera
        const sectionsInCareer = this.allData.sections.filter(s => s.careerIds.includes(careerId));
        const courseIdsInCareer = [...new Set(sectionsInCareer.map(s => s.courseId))];

        // Obtener la información de los cursos base
        const coursesInCareer = this.allData.courses
            .filter(c => courseIdsInCareer.includes(c.id))
            .sort((a, b) => a.name.localeCompare(b.name));

        let coursesHTML = '';
        if (coursesInCareer.length > 0) {
            coursesHTML = coursesInCareer.map(course => createBrowseCardHTML(course, 'course')).join('');
        } else {
            coursesHTML = `<p class="empty-state">No hay cursos disponibles para esta carrera todavía.</p>`;
        }

        const descriptionHTML = career.description ? `<p class="career-description">${career.description}</p>` : '';

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-navigation">
                ${createBackButtonHTML()}
            </div>
            <div class="browse-header">
                <h2 class="browse-title">Cursos en ${career.name}</h2>
            </div>
            ${descriptionHTML}
            <div class="browse-grid">${coursesHTML}</div>
            ${career.curriculum_url ? `
                <div class="curriculum-section">
                    <h3>Malla Curricular</h3>
                    <p>Consulta el plan de estudios completo para la carrera de ${career.name}.</p>
                    <a href="${career.curriculum_url}" target="_blank" class="btn-secondary">Descargar Malla Curricular (PDF)</a>
                </div>
            ` : ''}
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

        const sectionsForCourse = this.allData.sections.filter(s => s.courseId === courseId);
        const allCareerIds = [...new Set(sectionsForCourse.flatMap(s => s.careerIds))];
        const allCareersForCourse = allCareerIds.map(id => this.allData.careers.find(c => c.id === id)).filter(Boolean);
        const topics = (course.topicIds || []).map(id => this.allData.topics.find(t => t.id === id)).filter(Boolean);
        const books = (course.bookIds || []).map(id => this.allData.books.find(b => b.id === id)).filter(Boolean);

        // ✅ MEJORA: Tarjetas de sección más visuales con iconos
        const sectionsHTML = sectionsForCourse.map(section => {
            const instructor = this.allData.instructors.find(i => i.id === section.instructorId);
            const careersInSection = section.careerIds.map(id => this.allData.careers.find(c => c.id === id)?.name).filter(Boolean).join(', ');
            const schedule = section.schedule.map(s => `<li><i class="far fa-clock"></i> ${s.day} de ${s.startTime} a ${s.endTime} <span><i class="fas fa-map-marker-alt"></i> Salón: ${s.room}</span></li>`).join('');

            return `
                <div class="section-details-card">
                    <div class="section-card-header">
                        <i class="fas fa-chalkboard-teacher"></i>
                        <span>Docente: <strong>${instructor ? instructor.name : 'Por asignar'}</strong></span>
                    </div>
                    <div class="section-card-body">
                        <div class="section-careers">
                            <i class="fas fa-graduation-cap"></i>
                            <span>Para: ${careersInSection || 'Varias carreras'}</span>
                        </div>
                        <ul class="section-schedule">${schedule || '<li><i class="far fa-calendar-alt"></i> Horario no definido</li>'}</ul>
                    </div>
                </div>
            `;
        }).join('');

        const courseDescriptionHTML = course.description
            ? `<p class="course-description">${course.description.replace(/\n/g, '<br>')}</p>`
            : '<p class="course-description"><span class="no-material">No hay una descripción disponible para este curso.</span></p>';

        // ✅ MEJORA: Obtener icono para el header
        const courseIconClass = getIconForItem(course.name, 'course');

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
                        <div class="course-badges">
                            ${allCareersForCourse.map(c => `<button class="course-badge" data-career-id="${c.id}">${c.name}</button>`).join('')}
                        </div>
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
                        <div class="sidebar-section">
                            <h4 class="sidebar-title">Docentes y Horarios</h4>
                            <div class="sections-grid">${sectionsHTML || '<p class="empty-state">No hay secciones abiertas para este curso.</p>'}</div>
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
    openPdfModal(url, title) {
        const modal = document.getElementById('pdf-viewer-modal'); // ID del contenedor principal
        const iframe = document.getElementById('pdf-iframe');
        const modalTitle = modal.querySelector('#pdf-modal-title'); // Busca el título dentro del modal

        modalTitle.textContent = title;
        iframe.src = url;
        modal.style.display = 'flex';
    }
}

// Instanciar el componente cuando el DOM esté listo para evitar accesos
// a elementos que aún no existen.
document.addEventListener('DOMContentLoaded', () => {
    window.searchComponent = new SearchComponent();
});