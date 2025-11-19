/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// --- Componentes para la página de Búsqueda (search.js) ---

/**
 * Devuelve una clase de icono de Font Awesome basada en el nombre y tipo del item.
 * @param {string} name - El nombre del item (carrera o curso).
 * @param {string} type - El tipo de item ('career' o 'course').
 * @returns {string} La clase de Font Awesome para el icono.
 */
function getIconForItem(name, type) {
    const lowerCaseName = name.toLowerCase();

    if (type === 'career') {
        if (lowerCaseName.includes('informática') || lowerCaseName.includes('sistemas')) return 'fa-laptop-code';
        if (lowerCaseName.includes('derecho')) return 'fa-gavel';
        if (lowerCaseName.includes('medicina')) return 'fa-stethoscope';
        if (lowerCaseName.includes('diseño')) return 'fa-paint-brush';
        if (lowerCaseName.includes('psicología')) return 'fa-brain';
        if (lowerCaseName.includes('arquitectura')) return 'fa-drafting-compass';
        if (lowerCaseName.includes('periodismo')) return 'fa-newspaper';
        if (lowerCaseName.includes('ingeniería civil')) return 'fa-hard-hat';
        return 'fa-university'; // Icono por defecto para carreras
    }

    if (type === 'course') {
        if (lowerCaseName.includes('cálculo')) return 'fa-calculator';
        if (lowerCaseName.includes('programación')) return 'fa-code';
        if (lowerCaseName.includes('física')) return 'fa-atom';
        if (lowerCaseName.includes('química')) return 'fa-flask';
        if (lowerCaseName.includes('historia')) return 'fa-landmark';
        if (lowerCaseName.includes('literatura')) return 'fa-book-open';
        return 'fa-graduation-cap'; // Icono por defecto para cursos
    }

    return 'fa-folder'; // Icono genérico
}


function createBrowseCardHTML(item, type) {
    const iconClass = getIconForItem(item.name, type);

    // ✅ MEJORA: Card para Carreras con un diseño más rico y descriptivo.
    if (type === 'career') {
        return `
            <div class="browse-card career-card" data-type="career" data-id="${item.id}">
                <div class="browse-card-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="browse-card-content">
                    <h3 class="browse-card-title">${item.name}</h3>
                </div>
                <div class="browse-card-cta">
                    <span>Ver Cursos</span>
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        `;
    }

    // Card para Cursos (NUEVO DISEÑO)
    if (type === 'course') {
        const code = item.code ? `<span class="course-card-code">${item.code}</span>` : '';
        const description = item.description ? item.description.substring(0, 80) + '...' : 'Ver más información sobre este curso.';

        return `
            <div class="browse-card course-card" data-type="course" data-id="${item.id}">
                <div class="browse-card-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="browse-card-content">
                    <div class="course-card-header">
                        <h3 class="browse-card-title">${item.name}</h3>
                        ${code}
                    </div>
                    <p class="course-card-description">${description}</p>
                </div>
                <div class="browse-card-cta">
                    <span>Ver detalles</span>
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        `;
    }

    // Fallback para otros tipos (si los hubiera)
    return `
        <div class="browse-card" data-type="${type}" data-id="${item.id}">
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="browse-card-content">
                <h3 class="browse-card-title">${item.name}</h3>
            </div>
            <div class="browse-card-cta">
                <span>Ver detalles</span>
                <i class="fas fa-arrow-right"></i>
            </div>
        </div>
    `;
}

function createFilterSidebarHTML(careers) {
    const sortedCareers = careers.sort((a, b) => a.name.localeCompare(b.name));
    return `
        <!-- ✅ CORRECCIÓN: El sidebar se genera como un aside simple.
             La lógica responsive lo moverá al modal en pantallas pequeñas. -->
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
    // ✅ SOLUCIÓN: El backend ahora envía 'careerIds' como un array de objetos {id, name}.
    // Lo renombramos a 'careers' para mayor claridad y generamos botones clickables.
    const careers = course.careerIds || [];
    const careersHTML = careers.map(c => 
        `<button class="course-badge" data-career-id="${c.id}">${c.name}</button>`
    ).join('');

    // ✅ MEJORA UI/UX: Aplicar el estilo de las tarjetas de "Explorar" para consistencia.
    const iconClass = getIconForItem(course.name, 'course');

    // ✅ MEJORA: Añadir el código del curso para mayor consistencia con las tarjetas de exploración.
    const codeHTML = course.code ? `<span class="course-card-code">${course.code}</span>` : '';

    return `
        <div class="course-card-link" data-type="course" data-id="${course.id}" data-careers="${careers.map(c => c.name).join(',')}" style="cursor: pointer;">
            <div class="course-card-link-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="course-card-link-content">
                <h3>${course.name}</h3>${codeHTML}
                <div class="course-badges">${careersHTML}</div>
            </div>
            <div class="course-card-link-cta">
                <i class="fas fa-arrow-right"></i>
            </div>
        </div>
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

    // ✅ MEJORA: Las recomendaciones ahora son objetos {id, name} y navegan directamente a la vista.
    // ✅ SOLUCIÓN: Usar atributos data-* en lugar de onclick para una mejor delegación de eventos.
    const coursesHTML = (recommendations.relatedCourses || []).map(course => `
        <div class="recommendation-card" data-rec-type="course" data-rec-id="${course.id}">
            <div class="rec-icon course-rec"><i class="fas fa-graduation-cap"></i></div>
            <div class="rec-content">
                <span class="rec-title">Curso Relacionado</span>
                <span class="rec-text">${course.name}</span>
            </div>
            <div class="rec-arrow"><i class="fas fa-arrow-right"></i></div>
        </div>
    `).join('');

    // ✅ MEJORA: Las recomendaciones de temas ahora navegan a la vista del tema, no al chat.
    // ✅ SOLUCIÓN: Usar atributos data-* en lugar de onclick.
    const topicsHTML = (recommendations.relatedTopics || []).map(topic => `
        <div class="recommendation-card" data-rec-type="topic" data-rec-id="${topic.id}">
            <div class="rec-icon topic-rec"><i class="fas fa-lightbulb"></i></div>
            <div class="rec-content">
                <span class="rec-title">Tema para Explorar</span>
                <span class="rec-text">${topic.name}</span>
            </div>
            <div class="rec-arrow"><i class="fas fa-arrow-right"></i></div>
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
    return /*html*/`
        <div class="chat-promo-banner">
            <div class="chat-promo-banner-icon"><i class="fas fa-robot"></i></div>
            <div class="chat-promo-banner-content">
                <h3 class="chat-promo-banner-title">Tu Asistente Personal de Estudio</h3>
                <p class="chat-promo-banner-text">Respuestas instantáneas, explicaciones claras y la guía que necesitas para tener éxito.</p>
            </div>
            <button class="btn-primary chat-promo-banner-cta" onclick="openChat()">
                Pregúntale al Tutor
            </button>
        </div>
    `;
}

function createBackButtonHTML() {
    return `<button class="back-button" aria-label="Volver a la página anterior">‹ Volver</button>`;
}

// ✅ NUEVO: Componente para la promoción de chat específica a una pregunta.
function createSpecificChatPromoHTML(searchQuery) {
    return /*html*/`
        <div class="specific-promo-card">
            <div class="specific-promo-icon"><i class="fas fa-brain"></i></div>
            <div class="specific-promo-content">
                <h4 class="specific-promo-title">Profundiza en tu pregunta</h4>
                <div class="specific-promo-query">
                    "${searchQuery}"
                </div>
                <p class="specific-promo-subtitle">Nuestro Tutor IA es experto en temas como este.</p>
            </div>
            <button class="btn-primary specific-promo-cta" onclick="window.askAboutTopic('${searchQuery}')">
                Obtener una explicación detallada
            </button>
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
function createTopicViewHTML(topic, description, books = [], showChatButton = false) {
    // ✅ SOLUCIÓN: Renderizar los libros/recursos que se pasan como parámetro.
    const booksHTML = books.length > 0
        ? books.map(book => `
            <!-- ✅ SOLUCIÓN: Eliminar target="_blank" para permitir que JS controle el clic. -->
            <a href="${book.url}" class="material-item pdf">${book.title} (Autor: ${book.author})</a>
          `).join('')
        : '<span class="no-material">No hay bibliografía recomendada para este tema.</span>';

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
                <div class="material-group"><h5>📚 Libros y Materiales</h5><div class="material-list">${booksHTML}</div></div>
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
                <h3>${course.name} (${course.course_id})</h3>
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

function createAdminItemCardHTML(item, type, subtitle = '', showResetPassword = false) {
    // ✅ SOLUCIÓN: Usar 'item.title' si el tipo es 'book', de lo contrario usar 'item.name'.
    const displayName = type === 'book' ? item.title : item.name;
    const resetPasswordButton = showResetPassword ? `<button class="reset-pass-btn-small" data-id="${item.id}" title="Restablecer Contraseña">🔑</button>` : '';

    return `
        <div class="admin-item-card item-card">
            <span>${displayName} <small>${subtitle}</small></span>
            <div class="item-actions">
                ${resetPasswordButton}
                <button class="edit-btn-small" data-type="${type}" data-id="${item.id}" title="Editar ${type}">✏️</button>
                <button class="delete-btn-small" data-type="${type}" data-id="${item.id}" title="Eliminar ${type}">🗑️</button>
            </div>
        </div>
    `;
}