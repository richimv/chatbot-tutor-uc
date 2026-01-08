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

    // ✅ MEJORA: Card para Carreras con soporte de imagen TIPO POSTER
    if (type === 'career') {
        // Opción 1: Diseño Full Image (Si tiene imagen)
        if (item.image_url) {
            return `
                <div class="browse-card career-card full-image-card" data-type="career" data-id="${item.id}" onclick="window.location.href='career.html?id=${item.id}'" style="cursor: pointer;">
                    <img src="${item.image_url}" alt="${item.name}" class="browse-card-image-full" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
                    <div class="browse-card-overlay">
                        <div class="browse-card-content overlay-content">
                            <h3 class="browse-card-title text-white" style="font-size: 1.25rem;">${item.name}</h3>
                        </div>
                        <div class="browse-card-cta overlay-cta">
                            <span>Ver Cursos</span>
                            <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                </div>
            `;
        }

        // Opción 2: Diseño Estándar (Solo icono)
        const iconOrImage = `
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
        `;

        return `
            <div class="browse-card career-card" data-type="career" data-id="${item.id}" onclick="window.location.href='career.html?id=${item.id}'" style="cursor: pointer;">
                ${iconOrImage}
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

    // Card para Cursos (DISEÑO TIPO POSTER/NETFLIX SI HAY IMAGEN)
    if (type === 'course') {
        const codeHTML = item.code ? `<span class="course-card-code">${item.code}</span>` : '';

        // ✅ NUEVO: Botones de acción (Guardar/Favorito)
        const actionButtons = `
            <div class="card-actions">
                <button class="action-btn save-btn" data-type="course" data-id="${item.id}" data-action="save" title="Guardar"><i class="far fa-bookmark"></i></button>
                <button class="action-btn fav-btn" data-type="course" data-id="${item.id}" data-action="favorite" title="Favorito"><i class="far fa-heart"></i></button>
            </div>
        `;

        // Si hay imagen, usamos el diseño "Full Cover"
        if (item.image_url) {
            return `
                <div class="browse-card course-card full-image-card" data-type="course" data-id="${item.id}" onclick="window.location.href='course.html?id=${item.id}'" style="cursor: pointer;">
                    <img src="${item.image_url}" alt="${item.name}" class="browse-card-image-full" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
                    ${actionButtons}

                    <div class="browse-card-overlay">
                         <div class="browse-card-content overlay-content">
                            <h3 class="browse-card-title text-white">${item.name}</h3>
                            ${codeHTML}
                         </div>
                         <div class="browse-card-cta overlay-cta">
                            <span>Ver detalles</span>
                            <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                </div>
            `;
        }

        // Diseño Estándar (Sin imagen, solo icono)
        const iconOrImage = `
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
        `;

        return `
            <div class="browse-card course-card" data-type="course" data-id="${item.id}" onclick="window.location.href='course.html?id=${item.id}'" style="cursor: pointer;">
                ${actionButtons}
                ${iconOrImage}
                <div class="browse-card-content">
                    <div class="course-card-header">
                        <h3 class="browse-card-title">${item.name}</h3>
                        ${codeHTML}
                    </div>
                </div>
                <div class="browse-card-cta">
                    <span>Ver detalles</span>
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        `;
    } else if (type === 'topic') {
        clickAction = `onclick="window.location.href='topic.html?id=${item.id}'"`;
        contentHTML = `
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="browse-card-content">
                <h3 class="browse-card-title">${item.name}</h3>
            </div>
        `;
    }

    return `
        <div class="browse-card ${type}-card" ${clickAction} style="cursor: pointer;">
            ${contentHTML}
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
    const careers = course.careerIds || [];
    const iconClass = getIconForItem(course.name, 'course');
    const codeHTML = course.code ? `<span class="course-card-code">${course.code}</span>` : '';

    return `
        <div class="browse-card course-card" onclick="window.location.href='course.html?id=${course.id}'" style="cursor: pointer;">
            <div class="card-bookmark-ribbon"><i class="fas fa-bookmark"></i></div>
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="browse-card-content">
                <div class="course-card-header">
                    <h3 class="browse-card-title">${course.name}</h3>
                    ${codeHTML}
                </div>
                <p class="course-card-description" style="display:none;">${course.description || ''}</p>
            </div>
            <div class="browse-card-cta">
                <span>Ver detalles</span>
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

    // ✅ MEJORA: Renderizado híbrido de Cursos y Libros
    const coursesHTML = (recommendations.relatedCourses || []).map(item => {
        const isBook = item.type === 'book';
        const icon = isBook ? 'fa-book-open' : 'fa-graduation-cap';
        const typeLabel = isBook ? 'LIBRO RECOMENDADO' : 'CURSO RELACIONADO';
        const dataType = isBook ? 'book' : 'course';

        return `
        <div class="recommendation-card" data-type="${dataType}" data-id="${item.id}">
            <div class="recommendation-icon"><i class="fas ${icon}"></i></div>
            <div class="recommendation-content">
                <div class="recommendation-type">${typeLabel} 
                    ${item.confidence ? `<span class="ml-confidence-badge" title="Confianza de la IA">${item.confidence}% Match</span>` : ''}
                </div>
                <div class="recommendation-title">${item.name}</div>
                ${isBook && item.author ? `<div class="recommendation-author" style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${item.author}</div>` : ''}
            </div>
            <div class="recommendation-arrow"><i class="fas fa-arrow-right"></i></div>
        </div>
    `}).join('');

    const topicsHTML = (recommendations.relatedTopics || []).map(topic => `
        <div class="recommendation-card topic-card" data-type="topic" data-id="${topic.id}">
            <div class="recommendation-icon topic-icon"><i class="fas fa-lightbulb"></i></div>
            <div class="recommendation-content">
                <div class="recommendation-type">TEMA PARA EXPLORAR
                    ${topic.confidence ? `<span class="ml-confidence-badge" title="Confianza de la IA">${topic.confidence}% Match</span>` : ''}
                </div>
                <div class="recommendation-title">${topic.name}</div>
            </div>
            <div class="recommendation-arrow"><i class="fas fa-arrow-right"></i></div>
        </div>
    `).join('');

    // ✅ NUEVO: Calcular confianza promedio para mostrar indicador
    const allRecommendations = [
        ...(recommendations.relatedCourses || []),
        ...(recommendations.relatedTopics || [])
    ];
    const confidenceValues = allRecommendations
        .map(r => r.confidence)
        .filter(c => c !== undefined && c !== null);

    const avgConfidence = confidenceValues.length > 0
        ? Math.round(confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length)
        : 0;

    const mlIndicator = avgConfidence > 0 ? `
        <div class="ml-powered-indicator">
            <i class="fas fa-robot"></i>
            <span>Recomendaciones generadas por IA</span>
            <span class="ml-confidence-avg">${avgConfidence}% de coincidencia promedio</span>
        </div>
    ` : '';

    return /*html*/`
        <div class="recommendations-section">
            <h3 class="section-title">Descubre más</h3>
            <div class="recommendations-container">${coursesHTML}${topicsHTML}</div>
            ${mlIndicator}
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
function createSpecificChatPromoHTML(searchQuery, classification = 'General') {
    let title = "¿No encontraste lo que buscabas?";
    let subtitle = "Nuestro Tutor IA puede ayudarte a encontrar la respuesta.";
    let buttonText = "Preguntar al Tutor";
    let icon = "fa-search";

    // ✅ PERSONALIZACIÓN: Adaptar el mensaje según el contexto
    if (classification === 'Carrera') {
        title = "¿Te interesa esta carrera?";
        subtitle = "Pregúntame sobre la malla curricular, campo laboral o perfil del egresado.";
        buttonText = "Consultar sobre la carrera";
        icon = "fa-user-graduate";
    } else if (classification === 'Curso') {
        title = "¿Tienes dudas sobre este curso?";
        subtitle = "Puedo explicarte el sílabo, temas difíciles o recomendarte libros.";
        buttonText = "Consultar sobre el curso";
        icon = "fa-book-open";
    } else if (classification === 'Tema') {
        title = "Explora este tema a fondo";
        subtitle = "Obtén explicaciones detalladas, ejemplos y recursos de estudio.";
        buttonText = "Aprender más sobre esto";
        icon = "fa-lightbulb";
    }

    return /*html*/`
        <div class="specific-promo-card">
            <div class="specific-promo-icon"><i class="fas ${icon}"></i></div>
            <div class="specific-promo-content">
                <h4 class="specific-promo-title">${title}</h4>
                <div class="specific-promo-query">
                    "${searchQuery}"
                </div>
                <p class="specific-promo-subtitle">${subtitle}</p>
            </div>
            <button class="btn-primary specific-promo-cta" onclick="window.askAboutTopic('${searchQuery}')">
                ${buttonText}
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



function createAdminItemCardHTML(item, type, subtitle = '', showResetPassword = false) {
    // ✅ SOLUCIÓN: Usar 'item.title' si el tipo es 'book', de lo contrario usar 'item.name'.
    const displayName = type === 'book' ? item.title : item.name;
    const resetPasswordButton = showResetPassword ? `<button class="reset-pass-btn-small" data-id="${item.id}" title="Restablecer Contraseña"><i class="fas fa-key"></i></button>` : '';

    // ✅ NUEVO: Mostrar badge de área para carreras de forma más limpia
    const areaBadge = (type === 'career' && item.area)
        ? `<span class="area-badge" style="font-size: 0.7rem; background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); display:inline-block; margin-top:0.25rem;">${item.area}</span>`
        : '';

    // Subtitulo formateado
    const subtitleHTML = subtitle ? `<div class="item-subtitle" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${subtitle}</div>` : '';

    return `
        <div class="admin-item-card item-card">
            <div class="item-card-content">
                <h3>${displayName}</h3>
                ${areaBadge}
                ${subtitleHTML}
            </div>
            
            <div class="item-actions">
                ${resetPasswordButton}
                <button class="edit-btn-small" data-type="${type}" data-id="${item.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn-small" data-type="${type}" data-id="${item.id}" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

function create3DBookCardHTML(book) {
    const title = book.title || 'Sin Título';
    const author = book.author || 'Autor Desconocido';

    // ✅ CORRECCIÓN: Usar 'image_url' que es la propiedad correcta de Supabase.
    // También chequeamos 'coverUrl' por compatibilidad hacia atrás si fuera necesario.
    const rawCoverUrl = book.image_url || book.coverUrl;

    const coverUrl = (rawCoverUrl && rawCoverUrl.trim() !== "")
        ? rawCoverUrl
        : 'https://placehold.co/150x220/1e293b/ffffff?text=Libro';

    const url = book.url || '#';

    // ✅ NUEVO: Botones de acción para libros
    // Serializamos el objeto libro para pasarlo al modal de citación (escapando comillas dobles)
    const safeBook = JSON.stringify(book).replace(/"/g, '&quot;');

    const actionButtons = `
        <div class="card-actions" style="top: 0px; right: 0px;">
            <button class="action-btn save-btn" data-type="book" data-id="${book.id}" data-action="save" title="Guardar"><i class="far fa-bookmark"></i></button>
            <button class="action-btn fav-btn" data-type="book" data-id="${book.id}" data-action="favorite" title="Favorito"><i class="far fa-heart"></i></button>
            <button class="action-btn cite-btn" onclick="window.openCitationModal(event, ${safeBook})" title="Citar"><i class="fas fa-quote-right"></i></button>
        </div>
    `;

    return `
        <div class="book-card-container" style="position: relative;">
            ${actionButtons}
            <a href="${url}" class="book-card" onclick="event.preventDefault(); window.open('${url}', '_blank');" title="${title}">
                <div class="book-cover-container">
                    <img src="${coverUrl}" alt="${title}" class="book-cover-img" loading="lazy" onerror="this.src='https://placehold.co/150x220/1e293b/ffffff?text=Sin+Imagen'">
                    <div class="book-overlay-icon">
                        <i class="fas fa-book-open"></i>
                    </div>
                </div>
                <div class="book-info">
                    <h3 class="book-title">${title}</h3>
                    <div class="book-author">${author}</div>
                </div>
            </a>
        </div>
    `;
}