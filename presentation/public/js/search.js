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
        this.startNewNavigation(this.renderInitialView.bind(this));
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, sectionsRes, instructorsRes, topicsRes, booksRes] = await Promise.all([
                fetch('/api/careers'),
                fetch('/api/courses'),
                fetch('/api/sections'),
                fetch('/api/instructors'),
                fetch('/api/topics'),
                fetch('/api/books') // ✅ AÑADIDO: Cargar los libros
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
            this.startNewNavigation(this.renderInitialView.bind(this)); // Volver al inicio es una nueva navegación
            }
        });
    }

    /**
     * Navega a una nueva vista, guardando la actual en el historial.
     * Se usa para profundizar en la navegación (ej: de resultados a curso).
     */
    navigateTo(renderFunction, ...args) {
        if (this.currentView.render) {
            this.viewStack.push(this.currentView);
        }
        this.currentView = { render: renderFunction, args: args };
        renderFunction(...args);
    }

    /**
     * Inicia una nueva secuencia de navegación, limpiando el historial anterior.
     * Se usa exclusivamente al realizar una búsqueda.
     */
    startNewNavigation(renderFunction, ...args) {
        this.viewStack = []; // Limpia el historial para la nueva búsqueda.
        this.currentView = { render: renderFunction, args: args };
        renderFunction(...args);
    }

    navigateBack() {
        if (this.viewStack.length > 0) {
            const previousView = this.viewStack.pop();
            this.currentView = previousView;
            // ✅ CORRECCIÓN: Llamar a la función de renderizado sin modificar más la pila.
            previousView.render(...previousView.args);
        } else {
            // Si no hay historial, la única acción segura es volver al inicio.
            this.startNewNavigation(this.renderInitialView.bind(this));
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
                this.navigateTo(this.renderCoursesForCareer.bind(this), careerId);
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
                if (type === 'career') this.navigateTo(this.renderCoursesForCareer.bind(this), id);
                if (type === 'course') this.navigateTo(this.renderUnifiedCourseView.bind(this), id);
                if (type === 'topic') this.navigateTo(this.renderTopicView.bind(this), id);
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
                if (type === 'course') this.navigateTo(this.renderUnifiedCourseView.bind(this), id);
                if (type === 'topic') this.navigateTo(this.renderTopicView.bind(this), id);
            }
            return;
        }

        // ✅ NUEVO: Manejar clics en los enlaces de materiales (libros)
        const materialLink = e.target.closest('.material-item');
        if (materialLink) {
            e.preventDefault();
            const url = materialLink.href;
            const title = materialLink.textContent.trim();

            // ✅ LÓGICA MEJORADA: Detectar PDFs directos y enlaces de Google Drive.
            let embedUrl = null;

            if (url.toLowerCase().endsWith('.pdf')) {
                embedUrl = url; // Es un PDF directo.
            } else if (url.includes('drive.google.com/file/d/')) {
                // Es un enlace de Google Drive. Lo convertimos a formato de vista previa.
                const fileId = url.split('/d/')[1].split('/')[0];
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }

            // Si tenemos una URL para incrustar, la abrimos en el modal.
            // Si no, abrimos el enlace original en una nueva pestaña.
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
            const response = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const data = await response.json();

            // Inicia una nueva navegación con los resultados de la búsqueda.
            // Esto limpia el historial anterior, lo cual es correcto para una nueva búsqueda.
            this.startNewNavigation(this.renderSearchResults.bind(this), data);

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
            resultsHTML = data.results.map(course => createSearchResultCardHTML(course)).join('');
        } else {
            resultsHTML = `<p class="empty-state" style="grid-column: 1 / -1;">No se encontraron cursos para "${data.searchQuery}".</p>`;
        }
    
        // ✅ SOLUCIÓN: Determinar el orden de las secciones inferiores según el tipo de búsqueda.
        let bottomSectionsHTML = '';
        if (data.isEducationalQuery) {
            // Para búsquedas profundas: primero la promo del chat, luego las recomendaciones.
            bottomSectionsHTML = `
                ${createSpecificChatPromoHTML(data.searchQuery)}
                ${createRecommendationsSectionHTML(data.recommendations)}
            `;
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
                const selectedCareers = Array.from(filterContainer.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                const allCourseCards = this.resultsContainer.querySelectorAll('.course-card-link');

                allCourseCards.forEach(card => {
                    const cardCareers = card.dataset.careers.split(',');
                    // Si no hay filtros seleccionados, o si alguna de las carreras de la tarjeta está en las seleccionadas, se muestra.
                    const shouldShow = selectedCareers.length === 0 || cardCareers.some(cc => selectedCareers.includes(cc));
                    card.style.display = shouldShow ? 'block' : 'none';
                });
            }
        });
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
        const coursesInCareer = this.allData.courses.filter(c => courseIdsInCareer.includes(c.id));

        let coursesHTML = '';
        if (coursesInCareer.length > 0) {
            coursesHTML = coursesInCareer.map(course => createBrowseCardHTML(course, 'course')).join('');
        } else {
            coursesHTML = `<p class="empty-state">No hay cursos disponibles para esta carrera todavía.</p>`;
        }

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-navigation">
                ${createBackButtonHTML()}
            </div>
            <div class="browse-header">
                <h2 class="browse-title">Cursos en ${career.name}</h2>
            </div>
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
        const course = this.allData.courses.find(c => c.id === courseId);
        if (!course) {
            this.browseContainer.innerHTML = `<p class="error-state">No se encontró el curso solicitado.</p>`;
            return;
        }

        // ✅ CORRECCIÓN: Asegurarse de que siempre se muestre el contenedor correcto
        // y se oculte el de resultados de búsqueda al ver un curso.
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden'); // Reutilizamos el contenedor de browse

        // 1. Encontrar todas las secciones para este curso
        const sectionsForCourse = this.allData.sections.filter(s => s.courseId === courseId);

        // 2. Agrupar todas las carreras de todas las secciones
        const allCareerIds = [...new Set(sectionsForCourse.flatMap(s => s.careerIds))];
        const allCareersForCourse = allCareerIds.map(id => this.allData.careers.find(c => c.id === id)).filter(Boolean);

        // 3. Obtener todos los temas y materiales
        const topics = (course.topicIds || []).map(id => this.allData.topics.find(t => t.id === id)).filter(Boolean); // Se mantiene para la lista de temas
        // ✅ MEJORA: Obtener los libros asignados al curso, no los materiales de los temas.
        const books = (course.bookIds || []).map(id => this.allData.books.find(b => b.id === id)).filter(Boolean);

        // 4. Renderizar la información de cada sección (docente, horario, carrera)
        const sectionsHTML = sectionsForCourse.map(section => {
            const instructor = this.allData.instructors.find(i => i.id === section.instructorId);
            const careersInSection = section.careerIds.map(id => this.allData.careers.find(c => c.id === id)?.name).filter(Boolean).join(', ');
            const schedule = section.schedule.map(s => `<li>${s.day} de ${s.startTime} a ${s.endTime} (Salón: ${s.room})</li>`).join('');

            return `
                <div class="section-details-card">
                    <div class="section-instructor">🧑‍🏫 Docente: <strong>${instructor ? instructor.name : 'Por asignar'}</strong></div>
                    <div class="section-careers">Para: ${careersInSection}</div>
                    <ul class="section-schedule">${schedule || '<li>Horario no definido</li>'}</ul>
                </div>
            `;
        }).join('');

        // ✅ CORRECCIÓN: Mostrar la descripción directamente desde los datos del curso.
        // Ya no se genera con IA, por lo que se renderiza de inmediato.
        const courseDescriptionHTML = course.description 
            ? `<p class="course-description">${course.description.replace(/\n/g, '<br>')}</p>`
            : '<p class="course-description"><span class="no-material">No hay una descripción disponible para este curso.</span></p>';

        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-navigation">
                ${createBackButtonHTML()}
            </div>
            <div class="unified-course-view">
                <div class="course-main-header">
                    <h2 class="detail-view-title">${course.name} ${course.code ? `(${course.code})` : ''}</h2>
                    <div class="course-badges" style="margin-bottom: 1rem;">
                        ${allCareersForCourse.map(c => `<button class="course-badge" data-career-id="${c.id}">${c.name}</button>`).join('')}
                    </div>
                </div>
                ${courseDescriptionHTML}

                <h3 class="detail-view-subtitle">Docentes y Horarios</h3>
                <div class="sections-grid">${sectionsHTML || '<p>No hay secciones abiertas para este curso.</p>'}</div>

                <h3 class="detail-view-subtitle">Temas y Bibliografía del Curso</h3>
                <div class="topics-materials-grid">
                    <div class="topics-column"><h4>Temas</h4><div class="topic-list">${topics.length > 0 ? topics.map(t => `<button class="topic-tag" data-type="topic" data-id="${t.id}">${t.name}</button>`).join('') : 'No hay temas.'}</div></div>
                    <div class="materials-column">
                        <h4>Libros Recomendados</h4>
                        <div class="material-list">
                            ${books.length > 0 ? books.map(b => `<a href="${b.url}" target="_blank" class="material-item pdf">${b.title} (Autor: ${b.author})</a>`).join('') : '<span class="no-material">No hay bibliografía recomendada.</span>'}
                        </div>
                    </div>
                </div>
                ${createContextualChatButtonHTML('course', course.name)}
            </div>
        `;
    }

    renderTopicView(topicId) {
        const topic = this.allData.topics.find(t => t.id === topicId);
        if (!topic) {
            this.browseContainer.innerHTML = `<p class="error-state">No se encontró el tema solicitado.</p>`;
            return;
        }

        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        const booksForTopic = (topic.bookIds || []).map(id => this.allData.books.find(b => b.id === id)).filter(Boolean);

        // ✅ FIX: Construir el HTML directamente para no mostrar la sección de descripción.
        this.browseContainer.innerHTML = /*html*/`
            <div class="detail-navigation">${createBackButtonHTML()}</div>
            <div class="topic-view">
                <h2 class="detail-view-title">${topic.name}</h2>
                <h3 class="detail-view-subtitle">Libros Y Materiales Recomendados</h3>
                <div class="material-list">
                    ${booksForTopic.length > 0 ? booksForTopic.map(b => `<a href="${b.url}" target="_blank" class="material-item pdf">${b.title} (Autor: ${b.author})</a>`).join('') : '<span class="no-material">No hay bibliografía recomendada para este tema.</span>'}
                </div>
                ${createContextualChatButtonHTML('topic', topic.name)}
            </div>
        `;
    }

    // ✅ NUEVO: Funciones para controlar el visor de PDF
    openPdfModal(url, title) {
        const modal = document.getElementById('pdf-viewer-modal');
        const iframe = document.getElementById('pdf-iframe');
        const modalTitle = document.getElementById('pdf-modal-title');

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