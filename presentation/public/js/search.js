class SearchComponent {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.contentContainer = document.getElementById('content-container'); // Contenedor principal para resultados y exploración
        this.browseContainer = document.getElementById('browse-container'); // Contenedor específico para la exploración
        this.resultsContainer = document.getElementById('results-container'); // Contenedor para resultados de búsqueda

        // Almacenes de datos
        this.allData = { careers: [], courses: [], sections: [], instructors: [], topics: [] };

        // Estado de la vista para la navegación de retorno
        this.viewStack = []; // Pila para gestionar el historial de navegación
        this.currentView = {}; // Vista actual

        this.init();
    }

    async init() {
        await this.loadAllData();
        this.setupEventListeners();
        this.navigateTo(this.renderInitialView.bind(this));
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, sectionsRes, instructorsRes, topicsRes] = await Promise.all([
                fetch('/api/careers'),
                fetch('/api/courses'),
                fetch('/api/sections'),
                fetch('/api/instructors'),
                fetch('/api/topics')
            ]);
            this.allData.careers = await careersRes.json();
            this.allData.courses = await coursesRes.json();
            this.allData.sections = await sectionsRes.json();
            this.allData.instructors = await instructorsRes.json();
            this.allData.topics = await topicsRes.json();
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

        // Delegación de eventos para la navegación de exploración
        this.browseContainer.addEventListener('click', (e) => {

            const card = e.target.closest('[data-type]');
            if (card) {
                e.preventDefault();
                const type = card.dataset.type;
                const id = card.dataset.id;
                if (type === 'career') this.navigateTo(this.renderCoursesForCareer.bind(this), id);
                if (type === 'course') this.navigateTo(this.renderUnifiedCourseView.bind(this), id);
                if (type === 'topic') this.navigateTo(this.renderTopicView.bind(this), id);
                if (type === 'unified-course-view') this.renderUnifiedCourseView(id);
            }
        });

        // Delegación para los nuevos tipos de interacciones
        this.contentContainer.addEventListener('click', this.handleContentClick.bind(this));

        // ✅ CORRECCIÓN: Listener global para el botón de inicio en el header.
        // Se mueve aquí para que siempre esté activo, sin importar el contenedor visible.
        document.addEventListener('click', (e) => {
            const homeButton = e.target.closest('.nav-home-button');
            if (homeButton) {
                e.preventDefault();
                this.navigateTo(this.renderInitialView.bind(this));
            }
        });
    }

    navigateTo(renderFunction, ...args) {
        // ✅ CORRECCIÓN CRÍTICA: Guardar la vista actual en la pila ANTES de actualizarla.
        if (this.currentView.render) {
            this.viewStack.push(this.currentView);
        }
        this.currentView = { render: renderFunction, args: args };
        renderFunction(...args);
    }

    navigateBack() {
        if (this.viewStack.length > 0) {
            const previous = this.viewStack.pop();
            this.currentView = previous;
            previous.render(...previous.args); // La función ya está vinculada desde navigateTo.
        } else {
            this.navigateTo(this.renderInitialView.bind(this));
        }
    }

    handleContentClick(e) {
        // ✅ CORRECCIÓN CRÍTICA: Unificar el manejo del botón "Volver" aquí.
        // Este listener en `contentContainer` ahora captura todos los clics de "Volver".
        const backButton = e.target.closest('.back-button');
        if (backButton) {
            e.preventDefault();
            this.navigateBack();
            return;
        }
        const courseCard = e.target.closest('.course-card-link');
        if (courseCard) {
            e.preventDefault();
            // ✅ CORRECCIÓN: Asegurarse de que la navegación a la vista del curso
            // se maneje de forma consistente, llamando a navigateTo con la función correcta.
            const courseId = courseCard.dataset.courseId;
            this.navigateTo(this.renderUnifiedCourseView.bind(this), courseId);
            return;
        }

        const careerBadge = e.target.closest('.course-badge[data-career-id]');
        if (careerBadge) {
            e.preventDefault();
            this.navigateTo(this.renderCoursesForCareer.bind(this), careerBadge.dataset.careerId);
            return;
        }

    }

    renderInitialView() {
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        const careersHTML = this.allData.careers.map(career => createBrowseCardHTML(career, 'career')).join('');

        this.browseContainer.innerHTML = `
            <h2 class="browse-title">Explorar por Carrera</h2>
            <div class="browse-grid">${careersHTML}</div>
        `;
    }

    renderCoursesForCareer(careerId) {
        const career = this.allData.careers.find(c => c.id === careerId);
        if (!career) return;

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

        this.browseContainer.innerHTML = `
            <div class="detail-navigation">
                ${createBackButtonHTML()}
            </div>
            <div class="browse-header">
                <h2 class="browse-title">Cursos en ${career.name}</h2>
            </div>
            <div class="browse-grid">${coursesHTML}</div>
            ${career.curriculumUrl ? `
                <div class="curriculum-section">
                    <h3>Malla Curricular</h3>
                    <p>Consulta el plan de estudios completo para la carrera de ${career.name}.</p>
                    <a href="${career.curriculumUrl}" target="_blank" class="btn-secondary">Descargar Malla Curricular (PDF)</a>
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
        const topics = (course.topicIds || []).map(id => this.allData.topics.find(t => t.id === id)).filter(Boolean);
        const pdfs = topics.flatMap(t => t.resources?.pdfs || []).filter(p => p.name && p.url);
        const links = topics.flatMap(t => t.resources?.links || []).filter(l => l.name && l.url);

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

        // 6. Construir el HTML inicial con un placeholder para la descripción
        this.browseContainer.innerHTML = `
            <div class="detail-navigation">
                ${createBackButtonHTML()}
            </div>
            <div class="unified-course-view">
                <div class="course-main-header">
                    <h2>${course.name} (${course.code})</h2>
                    <div class="course-badges">
                        ${allCareersForCourse.map(c => `<button class="course-badge" data-career-id="${c.id}">${c.name}</button>`).join('')}
                    </div>
                </div>
                <p class="course-description" id="dynamic-course-description">
                    <span class="loading-text">Generando descripción con IA...</span>
                </p>

                <h3>Docentes y Horarios</h3>
                <div class="sections-grid">${sectionsHTML || '<p>No hay secciones abiertas para este curso.</p>'}</div>

                <h3>Temas y Materiales del Curso</h3>
                <div class="topics-materials-grid">
                    <div class="topics-column"><h4>Temas</h4><div class="topic-list">${topics.length > 0 ? topics.map(t => `<button class="topic-tag" data-type="topic" data-id="${t.id}">${t.name}</button>`).join('') : 'No hay temas.'}</div></div>
                    <div class="materials-column"><h4>Materiales</h4><div class="material-list">${pdfs.map(p => `<a href="${p.url}" target="_blank" class="material-item pdf">${p.name}</a>`).join('')}${links.map(l => `<a href="${l.url}" target="_blank" class="material-item link">${l.name}</a>`).join('')}${pdfs.length === 0 && links.length === 0 ? '<span class="no-material">No hay materiales.</span>' : ''}</div></div>
                </div>
                ${createContextualChatButtonHTML('course', course.name)}
            </div>
        `;

        // 7. Llamar a la API para obtener la descripción y actualizar el DOM
        try {
            const response = await fetch(`/api/courses/${courseId}/description`);
            if (!response.ok) throw new Error('No se pudo generar la descripción.');
            
            const { description } = await response.json();
            const descriptionElement = document.getElementById('dynamic-course-description');
            if (descriptionElement) {
                descriptionElement.innerHTML = description.replace(/\n/g, '<br>'); // Reemplazar saltos de línea por <br>
            }
        } catch (error) {
            const descriptionElement = document.getElementById('dynamic-course-description');
            if (descriptionElement) descriptionElement.innerHTML = '<span class="error-text">No se pudo cargar la descripción en este momento.</span>';
        }
    }

    async renderTopicView(topicId) {
        const topic = this.allData.topics.find(t => t.id === topicId);
        if (!topic) {
            this.browseContainer.innerHTML = `<p class="error-state">No se encontró el tema solicitado.</p>`;
            return;
        }
        this.resultsContainer.classList.add('hidden');
        this.browseContainer.classList.remove('hidden');

        // Mostrar un estado de carga mientras se genera la descripción
        this.browseContainer.innerHTML = createTopicViewHTML(topic, 'Generando descripción con IA...');

        try {
            // Llamar a la nueva API para obtener la descripción de Gemini
            const response = await fetch(`/api/topics/${topicId}/description`);
            if (!response.ok) throw new Error('No se pudo generar la descripción.');
            
            const { description } = await response.json();

            // Volver a renderizar la vista con la descripción obtenida
            this.browseContainer.innerHTML = createTopicViewHTML(topic, description, true);

        } catch (error) {
            console.error('Error al obtener la descripción del tema:', error);
            // Si falla, renderizar con un mensaje de error
            this.browseContainer.innerHTML = createTopicViewHTML(topic, 'No se pudo cargar la descripción.');
        }
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        
        this.viewStack = []; // Limpiar historial al hacer una nueva búsqueda.
        if (!query) {
            this.navigateTo(this.renderInitialView.bind(this));
            return;
        }

        // Ocultar vista de exploración y mostrar resultados
        this.browseContainer.classList.add('hidden');
        this.resultsContainer.classList.remove('hidden');

        try {
            this.showLoading();
            
            // --- INICIO: CÓDIGO REAL PARA CONECTAR CON LA API ---
            const response = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) throw new Error('Error en la búsqueda');
            
            const searchData = await response.json();
            // ✅ CORRECCIÓN: Guardar la función de renderizado y sus datos para el historial.
            this.navigateTo(this.displaySearchResults.bind(this), searchData);
            this.saveRecentSearch(query);
            
        } catch (error) {
            console.error('❌ Error buscando:', error);
            this.showMessage('Error al realizar la búsqueda. Intenta nuevamente.', 'error');
        }
    }

    // Función global para que los checkboxes puedan llamarla
    setupFilterListener() {
        const filterContainer = this.resultsContainer.querySelector('.filter-sidebar');
        if (!filterContainer) return;

        // Listener para el mini-buscador de carreras
        const careerSearchInput = filterContainer.querySelector('#career-filter-search');
        careerSearchInput.addEventListener('keyup', () => {
            const searchTerm = careerSearchInput.value.toLowerCase();
            filterContainer.querySelectorAll('.form-check').forEach(check => {
                const label = check.querySelector('label').textContent.toLowerCase();
                check.style.display = label.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        // Listener para los checkboxes
        filterContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('filter-checkbox')) {
                const checkedCareerNames = Array.from(filterContainer.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);
                const allCards = this.resultsContainer.querySelectorAll('.results-list .course-card-link');

                allCards.forEach(card => {
                    // ✅ LÓGICA MEJORADA: Leer todas las carreras de la tarjeta
                    const cardCareers = (card.dataset.careers || '').split(',');
                    
                    const isVisible = checkedCareerNames.length === 0 || checkedCareerNames.some(filterCareer => cardCareers.includes(filterCareer));
                    
                    card.style.display = isVisible ? 'block' : 'none'; // Usar block para consistencia con el estado inicial
                });

                // Actualizar contador de resultados visibles
                const visibleCount = this.resultsContainer.querySelectorAll('.results-list .course-card-link[style*="display: block"]').length;
                const countElement = this.resultsContainer.querySelector('.visible-results-count');
                if (countElement) {
                    countElement.textContent = `Mostrando ${visibleCount} de ${allCards.length} cursos.`;
                }
            }
        });
    }

    displaySearchResults(searchData) {
        const { results, recommendations, totalResults, searchQuery, isEducationalQuery } = searchData;

        // LÓGICA MEJORADA PARA "NO HAY RESULTADOS"
        if (results.length === 0) {
            // ✅ LÓGICA UNIFICADA: Si no hay resultados, mostrar recomendaciones y/o promos de chat.
            this.resultsContainer.innerHTML = `
                <div class="no-results-container">
                    <div class="no-results-message">
                        <h3>📭 No se encontraron cursos para "${searchQuery}"</h3>
                        <p>Intenta con otros términos de búsqueda o revisa la ortografía.</p>
                    </div>
                    ${createRecommendationsSectionHTML(recommendations, this.searchInput)}
                    ${isEducationalQuery ? createSpecificChatPromoHTML(searchQuery) : createChatPromoSectionHTML()}
                </div>
            `;
            return;
        } else if (results.length === 0 && isEducationalQuery) { // Si es pregunta teórica y no hay documentos
            // Si no hay resultados pero es una pregunta teórica, sugerir el chatbot.
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>🤔 No encontré documentos para "${searchQuery}"</h3>
                    <p>Parece que tu búsqueda es sobre un concepto teórico.</p>
                    <div class="chat-promo" style="margin-top: 1rem; text-align: left; border-color: #a5b4fc;">
                        <p>Nuestro <strong>Tutor IA</strong> es excelente para explicar temas como este.</p>
                        <button class="btn-primary" onclick="window.askAboutTopic('${searchQuery}')">
                            💬 Preguntar al Tutor IA
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        let resultsHTML = `
            <div class="search-header">
                <h3>🔍 Resultados para "${searchQuery}"</h3>
                <p class="results-count visible-results-count">Mostrando ${totalResults} curso${totalResults !== 1 ? 's' : ''}.</p>
            </div>
            <div class="search-layout">
                ${createFilterSidebarHTML(this.allData.careers)}
                <div class="results-list">
                    <div class="detail-navigation">
                        ${createBackButtonHTML()}
                    </div>
                    ${results.map(createSearchResultCardHTML).join('')}
                    ${createRecommendationsSectionHTML(recommendations, this.searchInput)}
                </div>
            </div>
            ${isEducationalQuery ? createSpecificChatPromoHTML(searchQuery) : createChatPromoSectionHTML()}
        `;

        this.resultsContainer.innerHTML = resultsHTML;
        this.setupFilterListener(); // Activar los listeners para los nuevos filtros
    }

    showLoading() {
        // Limpiar el contenedor antes de mostrar el spinner para evitar errores de renderizado
        this.resultsContainer.innerHTML = ''; 
        this.resultsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Buscando cursos...</p>
                <!-- Añadido para dar más contexto al usuario -->
                <p class="loading-subtitle">Analizando tendencias y generando recomendaciones</p>
            </div>
        `;
    }

    showMessage(message, type = 'info') {
        const className = type === 'error' ? 'error-message' : 
                         type === 'warning' ? 'warning-message' : 'info-message';
        
        // Limpiar el contenedor antes de mostrar el mensaje para evitar errores de renderizado
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.innerHTML = `
            <div class="message ${className}">
                <p>${message}</p>
            </div>
        `;
    }

    saveRecentSearch(query) {
        let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        
        // Evitar duplicados
        recentSearches = recentSearches.filter(search => search !== query);
        
        // Agregar al inicio y mantener máximo 5
        recentSearches.unshift(query);
        recentSearches = recentSearches.slice(0, 5);
        
        localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    }

}

// ✅ CORRECCIÓN: La inicialización ahora se hace desde app.js para un control centralizado.
// document.addEventListener('DOMContentLoaded', () => new SearchComponent());

/**
 * Crea el HTML para la sección de recomendaciones de ML.
 * @param {object} recommendations - Objeto con `relatedCourses` y `relatedTopics`.
 * @param {HTMLElement} searchInputRef - Referencia al input de búsqueda para simular clics.
 * @returns {string} El HTML de la sección.
 */
function createRecommendationsSectionHTML(recommendations, searchInputRef) {    
    if (!recommendations || (!recommendations.relatedCourses?.length && !recommendations.relatedTopics?.length)) {
        return ''; // No mostrar nada si no hay recomendaciones
    }

    // Adjuntar funciones al objeto window para que sean accesibles desde el HTML inline
    window.handleCourseRecommendationClick = (query) => {
        searchInputRef.value = query;
        searchInputRef.dispatchEvent(new KeyboardEvent('keypress', { 'key': 'Enter' }));
    };
    // La función window.askAboutTopic ya debería existir para el chatbot

    const coursesHTML = (recommendations.relatedCourses || []).map(course => `
        <div class="recommendation-card" onclick="window.handleCourseRecommendationClick('${course}')">
            <div class="rec-icon">🎓</div>
            <div class="rec-content">
                <span class="rec-title">Curso Relacionado</span>
                <span class="rec-text">${course}</span>
            </div>
            <div class="rec-arrow">›</div>
        </div>
    `).join('');

    const topicsHTML = (recommendations.relatedTopics || []).map(topic => `
        <div class="recommendation-card" onclick="window.askAboutTopic('${topic}')">
            <div class="rec-icon">💡</div>
            <div class="rec-content">
                <span class="rec-title">Tema para Explorar</span>
                <span class="rec-text">${topic}</span>
            </div>
            <div class="rec-arrow">›</div>
        </div>
    `).join('');

    return `
        <div class="discover-more-section">
            <h4 class="discover-title">Descubre más</h4>
            <div class="recommendations-container">
                ${coursesHTML}
                ${topicsHTML}
            </div>
        </div>
    `;
}

function createNoResultsViewHTML(searchQuery, recommendations, isEducationalQuery, searchInputRef) {
    const recommendationsHTML = createRecommendationsSectionHTML(recommendations, searchInputRef);
    const chatPromoHTML = isEducationalQuery ? createSpecificChatPromoHTML(searchQuery) : createChatPromoSectionHTML();
    return `
        <div class="discover-more-section">
            <h4 class="discover-title">Descubre más</h4>
            <div class="recommendations-container">
                ${coursesHTML}
                ${topicsHTML}
            </div>
        </div>
    `;
}