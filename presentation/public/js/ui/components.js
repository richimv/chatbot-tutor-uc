/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// --- Componentes para la página de Búsqueda (search.js) ---

function createBrowseCardHTML(item, type) {
    return `
        <div class="browse-card" data-type="${type}" data-id="${item.id}">
            <h3>${item.name}</h3>
            <p>${type === 'career' ? 'Explorar cursos de esta carrera' : item.code}</p>
        </div>
    `;
}

function createFilterSidebarHTML(careers) {
    const sortedCareers = careers.sort((a, b) => a.name.localeCompare(b.name));
    return `
        <aside class="filter-sidebar">
            <h4>Filtrar por Carrera</h4>
            <div class="filter-group">
                <input type="text" id="career-filter-search" placeholder="Buscar carrera...">
                <div class="filter-options">
                ${sortedCareers.map(career => `
                    <div class="form-check">
                        <input class="filter-checkbox" type="checkbox" value="${career.name}" id="filter-${career.id}">
                        <label for="filter-${career.id}">${career.name}</label>
                    </div>
                `).join('')}
                </div>
            </div>
        </aside>
    `;
}

function createSearchResultCardHTML(course) {
    // ✅ CORRECCIÓN ARQUITECTURAL: El repositorio ahora envía 'careers' como un array de nombres.
    const careersHTML = (course.careers || []).map(c => `<span class="course-badge-static">${c}</span>`).join('');

    return `
        <a href="#" class="course-card-link" data-course-id="${course.courseId}" data-careers="${(course.careers || []).join(',')}" style="display: block;">
            <h3>${course.name}</h3>
            <div class="course-badges">${careersHTML}</div>
        </a>
    `;
}

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
        // Simula presionar Enter para iniciar una nueva búsqueda
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
            <div class="recommendations-container">${coursesHTML}${topicsHTML}</div>
        </div>
    `;
}

function createChatPromoSectionHTML() {
    return `
        <div class="chat-promo">
            <div class="chat-promo-content">
                <h4>🤖 ¿Necesitas más ayuda?</h4>
                <p>Nuestro tutor IA puede explicarte conceptos, ayudarte con dudas específicas y guiarte en tu aprendizaje.</p>
                <button class="btn-primary" onclick="openChat()">
                    💬 Hablar con el Tutor IA
                </button>
            </div>
        </div>
    `;
}

function createBackButtonHTML() {
    return `<button class="back-button" aria-label="Volver a la página anterior">‹ Volver</button>`;
}

// ✅ NUEVO: Componente para la promoción de chat específica a una pregunta.
function createSpecificChatPromoHTML(searchQuery) {
    return `
        <div class="chat-promo" style="border-color: var(--accent);">
            <div class="chat-promo-content">
                <h4>🤔 ¿Tienes una pregunta más profunda?</h4>
                <p>Parece que tu búsqueda es una pregunta. Nuestro Tutor IA puede darte una respuesta detallada.</p>
                <button class="btn-primary" onclick="window.askAboutTopic('${searchQuery}')">
                    💬 Preguntar al Tutor IA sobre "${searchQuery}"
                </button>
            </div>
        </div>
    `;
}

// ✅ NUEVO: Componente para el botón de chat contextual dentro de una vista.
function createContextualChatButtonHTML(type, name) {
    const action = type === 'course' ? `window.askAboutCourse('${name}')` : `window.askAboutTopic('${name}')`;
    return `
        <div class="contextual-chat-section">
            <button class="btn-secondary btn-ask-ai" onclick="${action}">
                🤖 Preguntar al Tutor IA sobre este ${type === 'course' ? 'curso' : 'tema'}
            </button>
        </div>
    `;
}

// ✅ NUEVO: Componente para la vista de un tema.
function createTopicViewHTML(topic, description, showChatButton = false) {
    const pdfs = topic.resources?.pdfs || [];
    const links = topic.resources?.links || [];

    const pdfsHTML = pdfs.length > 0 
        ? pdfs.map(p => `<a href="${p.url}" target="_blank" class="material-item pdf">${p.name}</a>`).join('')
        : '<span class="no-material">No hay PDFs para este tema.</span>';

    const linksHTML = links.length > 0
        ? links.map(l => `<a href="${l.url}" target="_blank" class="material-item link">${l.name}</a>`).join('')
        : '<span class="no-material">No hay enlaces para este tema.</span>';

    return `
        <div class="detail-navigation">
            ${createBackButtonHTML()}
        </div>
        <div class="topic-view">
            <div class="topic-header">
                <h2>${topic.name}</h2>
            </div>
            <div class="topic-description">
                <h4>¿De qué trata este tema?</h4>
                <p>${description}</p>
            </div>
            <div class="topic-materials">
                <h4>Recursos Disponibles</h4>
                <div class="material-group"><h5>📄 Documentos PDF</h5><div class="material-list">${pdfsHTML}</div></div>
                <div class="material-group"><h5>🔗 Enlaces Web</h5><div class="material-list">${linksHTML}</div></div>
                ${showChatButton ? createContextualChatButtonHTML('topic', topic.name) : ''}
            </div>
        </div>
    `;
}

// --- Componentes para la página de Administración (admin.js) ---

function createAdminSectionCardHTML(section, data) {
    const { allCourses, allInstructors, allCareers } = data;
    const course = allCourses.find(c => c.id === section.courseId);
    const instructor = allInstructors.find(i => i.id === section.instructorId);
    const careers = section.careerIds.map(id => allCareers.find(c => c.id === id)?.name).filter(Boolean);

    if (!course) return ''; // No renderizar si el curso base no existe

    return `
        <div class="item-card-full">
            <div class="item-card-header">
                <h3>${course.name} (${course.code})</h3>
                <div class="item-actions">
                    <button class="edit-btn-small" data-type="section" data-id="${section.id}" title="Editar Sección">✏️</button>
                    <button class="delete-btn-small" data-type="section" data-id="${section.id}" title="Eliminar Sección">🗑️</button>
                </div>
            </div>
            <div class="item-card-body">
                <div><strong>Docente:</strong> ${instructor ? instructor.name : 'No asignado'}</div>
                <div><strong>Carreras:</strong> ${careers.join(', ') || 'Ninguna'}</div>
                <div><strong>Horario:</strong> ${section.schedule.map(s => `${s.day} ${s.startTime}-${s.endTime}`).join(' | ') || 'No definido'}</div>
            </div>
        </div>
    `;
}

function createAdminItemCardHTML(item, type, subtitle = '') {
    return `
        <div class="item-card">
            <span>${item.name} <small>${subtitle}</small></span>
            <div class="item-actions">
                <button class="edit-btn-small" data-type="${type}" data-id="${item.id}" title="Editar ${type}">✏️</button>
                <button class="delete-btn-small" data-type="${type}" data-id="${item.id}" title="Eliminar ${type}">🗑️</button>
            </div>
        </div>
    `;
}