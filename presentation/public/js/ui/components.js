/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// ✅ GLOBAL: Lógica de Auto-Scroll para Carruseles
window.carouselInterval = null;

window.startCarouselScroll = function (trackId, direction) {
    const track = document.getElementById(trackId);
    if (!track) return;

    window.stopCarouselScroll(); // Limpiar previo si existe

    // Velocidad de desplazamiento (pixels por frame)
    const speed = 2;

    function step() {
        track.scrollLeft += direction * speed;
        window.carouselInterval = requestAnimationFrame(step);
    }

    window.carouselInterval = requestAnimationFrame(step);
};

window.stopCarouselScroll = function () {
    if (window.carouselInterval) {
        cancelAnimationFrame(window.carouselInterval);
        window.carouselInterval = null;
    }
};

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

// ✅ NUEVO: Tarjeta de Intención Educativa (Diseño Premium para Preguntas)
function createEducationalIntentCardHTML(query) {
    return /*html*/`
        <div class="educational-intent-card">
            <div class="intent-card-content">
                <div class="intent-icon-wrapper">
                    <i class="fas fa-brain"></i>
                </div>
                <div class="intent-text-group">
                    <h3 class="intent-title">Pregunta Profunda Detectada</h3>
                    <p class="intent-description">
                        "<strong>${query}</strong>" parece un tema complejo. 
                        <br>En lugar de buscar en libros, ¿quieres que te lo explique paso a paso?
                    </p>
                </div>
            </div>
            <div class="intent-actions">
                <button class="btn-primary intent-cta-btn" onclick="window.askAboutTopic('${query}')">
                    <i class="fas fa-sparkles"></i>
                    Explicar con IA
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
function createTopicViewHTML(topic, description, books = [], showChatButton = false) {
    // ✅ SOLUCIÓN: Renderizar los libros/recursos de forma segura (Link Obfuscation)
    const booksHTML = books.length > 0
        ? books.map(book => {
            if (book.url) window.uiManager.registerMaterial(book.id, book.url);
            return `
            <div class="material-item pdf" role="button" tabindex="0" onclick="window.uiManager.openMaterial('${book.id}')" title="Ver material">
                <i class="fas fa-file-pdf"></i> ${book.title} (Autor: ${book.author})
            </div>
            `;
        }).join('')
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
    // const author = book.author || 'Autor Desconocido'; // ✅ UPDATE: Autor oculto en vista destacada

    const rawCoverUrl = book.image_url || book.coverUrl;
    const coverUrl = (rawCoverUrl && rawCoverUrl.trim() !== "")
        ? rawCoverUrl
        : 'https://placehold.co/150x220/1e293b/ffffff?text=Libro';

    const url = book.url || '#';

    if (url && url !== '#') {
        window.uiManager.registerMaterial(book.id, url);
    }

    const safeBook = JSON.stringify(book).replace(/"/g, '&quot;');

    const actionButtons = `
        <div class="card-actions"> <!-- Inline styles moved to CSS -->
            <button class="action-btn save-btn" onclick="return window.uiManager.validateFreemiumAction(event)" data-type="book" data-id="${book.id}" data-action="save" title="Guardar"><i class="far fa-bookmark"></i></button>
            <button class="action-btn fav-btn" onclick="return window.uiManager.validateFreemiumAction(event)" data-type="book" data-id="${book.id}" data-action="favorite" title="Favorito"><i class="far fa-heart"></i></button>
            <button class="action-btn cite-btn" onclick="if(window.uiManager.validateFreemiumAction(event)) window.uiManager.checkAuthAndExecute(() => window.openCitationModal(event, ${safeBook}))" title="Citar"><i class="fas fa-quote-right"></i></button>
        </div>
    `;

    // ✅ DISEÑO TIPO REFERENCE (Title Overlay)
    return `
        <div class="book-card-container" style="position: relative; height: 100%;">
            ${actionButtons}
            <div class="book-card overlay-style" role="button" tabindex="0" onclick="window.uiManager.openMaterial('${book.id}')" title="${title}" style="cursor: pointer; height: 100%; border-radius: 8px; overflow: hidden; position: relative;">
                
                <div class="book-cover-container" style="height: 100%;">
                    <img src="${coverUrl}" alt="${title}" class="book-cover-img" loading="lazy" style="height: 100%; width: 100%; object-fit: cover;" onerror="this.src='https://placehold.co/150x220/1e293b/ffffff?text=Sin+Imagen'">
                    
                    <!-- ✅ Overlay Gradient & Title -->
                    <div class="book-gradient-overlay" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 60%; background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%); display: flex; align-items: flex-end; padding: 10px;">
                        <h3 class="book-title-overlay" style="color: white; font-size: 0.9rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8); margin: 0; line-height: 1.25;">${title}</h3>
                    </div>

                    ${(!window.sessionManager?.getUser() || (window.sessionManager.getUser().subscriptionStatus !== 'active' && window.sessionManager.getUser().subscription_status !== 'active'))
            ? `<div class="book-overlay-icon" style="bottom: 50%; right: 50%; transform: translate(50%, 50%);"><i class="fas fa-lock"></i></div>`
            : ''}
                </div>
                
                <!-- Info externa eliminada -->
            </div>
        </div>
    `;
}

/**
 * Crea un contenedor de carrusel para una lista de items.
 * @param {string} id - ID único para el carrusel.
 * @param {string} contentHTML - HTML de los items (tarjetas).
 */
function createCarouselHTML(id, contentHTML) {
    return `
        <div class="carousel-container" id="${id}">
            <button class="carousel-btn prev" 
                onmouseenter="startCarouselScroll('${id}-track', -1)" 
                onmouseleave="stopCarouselScroll()"
                onclick="document.getElementById('${id}-track').scrollBy({left: -300, behavior: 'smooth'})">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="carousel-track-container" id="${id}-track">
                ${contentHTML}
            </div>
            <button class="carousel-btn next" 
                onmouseenter="startCarouselScroll('${id}-track', 1)" 
                onmouseleave="stopCarouselScroll()"
                onclick="document.getElementById('${id}-track').scrollBy({left: 300, behavior: 'smooth'})">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}