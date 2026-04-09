/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// GLOBAL: Lógica de Auto-Scroll para Carruseles
window.carouselInterval = null;

/**
 * Inicia el desplazamiento suave del carrusel.
 * @param {string} trackId - ID del contenedor.
 * @param {number} direction - -1 (izq) o 1 (der).
 * @param {number} speedMultiplier - Multiplicador de velocidad (Default: 1).
 */
window.startCarouselScroll = function (trackId, direction, speedMultiplier = 1) {
    const track = document.getElementById(trackId);
    if (!track) return;

    window.stopCarouselScroll(); // Limpiar previo si existe

    // Velocidad Base (pixels por frame)
    const baseSpeed = 2;
    const speed = baseSpeed * speedMultiplier;

    function step() {
        track.scrollLeft += direction * speed;
        // Continuar loop
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

/**
 * Inicializa el carrusel (comprueba si necesita botones de scroll).
 * @param {string} id - ID del contenedor del carrusel.
 */
window.initializeCarousel = function (containerId) {
    // 1. Obtener el contenedor principal (Wrapper)
    const container = document.getElementById(containerId);
    if (!container) return;

    // 2. Encontrar el "Track" real (donde están los items y ocurre el scroll)
    // Puede ser por ID especifico o buscando la clase .carousel-track-container
    let track = document.getElementById(`${containerId}-track`);
    if (!track) {
        track = container.querySelector('.carousel-track-container');
    }

    if (!track) {
        console.warn(`[initializeCarousel] Track not found for container: ${containerId}`);
        return;
    }

    // 3. Encontrar botones DENTRO del contenedor
    const prevBtn = container.querySelector('.carousel-btn.prev');
    const nextBtn = container.querySelector('.carousel-btn.next');

    if (!prevBtn || !nextBtn) return;

    const checkScroll = () => {
        // Margen de error de 2px para evitar falsos positivos
        const hasOverflow = track.scrollWidth > track.clientWidth + 2;

        if (hasOverflow) {
            // "Recuperar" funcionalidad: Mostrar botones (flex)
            // CSS se encargará de la opacidad (Clean UI: opacity 0 -> hover -> opacity 1)
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            // Ocultar si no hay contenido suficiente
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    };

    // 4. Inicialización Robusta
    // Check inicial
    checkScroll();

    // Observer para cambios de tamaño (Responsive + Carga de Imágenes)
    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(track);

    // Fallbacks para imágenes que cargan tarde
    setTimeout(checkScroll, 500);
    setTimeout(checkScroll, 2000);
};

// --- Componentes para la página de Búsqueda (search.js) ---

/**
 * Devuelve una clase de icono de Font Awesome basada en el nombre y tipo del item.
 * @param {string} name - El nombre del item (carrera o curso).
 * @param {string} type - El tipo de item ('career' o 'course').
 * @returns {string} La clase de Font Awesome para el icono.
 */
function getIconForItem(name, type) {
    const rawName = name || '';
    const lowerCaseName = rawName.toLowerCase();

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

    // MEJORA: Card para Carreras con soporte de imagen TIPO POSTER
    if (type === 'career') {
        // Opción 1: Diseño Full Image (Si tiene imagen)
        if (item.image_url) {
            const finalImage = window.resolveImageUrl(item.image_url);
            return `
                <div class="browse-card career-card full-image-card" data-type="career" data-id="${item.id}" style="cursor: pointer;">
                    <img src="${finalImage}" alt="${item.name}" class="browse-card-image-full" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
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
            <div class="browse-card career-card" data-type="career" data-id="${item.id}" style="cursor: pointer;">
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

        const actionButtons = `
            <div class="card-actions">
                <button class="action-btn save-btn js-library-btn" data-id="${item.id}" data-type="course" data-action="save" title="Guardar"><i class="far fa-bookmark"></i></button>
                <button class="action-btn fav-btn js-library-btn" data-id="${item.id}" data-type="course" data-action="favorite" title="Favorito"><i class="far fa-heart"></i></button>
            </div>
        `;

        // Si hay imagen, usamos el diseño "Full Cover"
        if (item.image_url) {
            const finalImage = window.resolveImageUrl(item.image_url);
            return `
                <div class="browse-card course-card full-image-card" data-type="course" data-id="${item.id}" style="cursor: pointer;">
                    <img src="${finalImage}" alt="${item.name}" class="browse-card-image-full" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
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
            <div class="browse-card course-card" data-type="course" data-id="${item.id}" style="cursor: pointer;">
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
        // CORRECCIÓN: Eliminado onclick a topic.html (muerto). search.js intercepta.
        clickAction = '';
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
        <!-- CORRECCIÓN: El sidebar se genera como un aside simple.
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
        <div class="browse-card course-card" style="cursor: pointer;" data-type="course" data-id="${course.id}">
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

    // Renderizado híbrido de Cursos y Libros
    const coursesHTML = (recommendations.relatedCourses || []).map(item => {
        const isBook = item.type === 'book';
        const icon = isBook ? 'fa-book-open' : 'fa-graduation-cap';
        const typeLabel = isBook ? 'RECURSO RECOMENDADO' : 'CURSO RELACIONADO';
        const dataType = isBook ? 'book' : 'course';

        return `
        <div class="recommendation-card" data-type="${dataType}" data-id="${item.id}">
            <div class="recommendation-icon"><i class="fas ${icon}"></i></div>
            <div class="recommendation-content">
                <div class="recommendation-type">${typeLabel} 
                    ${item.confidence ? `<span class="ml-confidence-badge" title="Confianza del Asistente">${item.confidence}% Match</span>` : ''}
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
                    ${topic.confidence ? `<span class="ml-confidence-badge" title="Confianza del Asistente">${topic.confidence}% Match</span>` : ''}
                </div>
                <div class="recommendation-title">${topic.name}</div>
            </div>
            <div class="recommendation-arrow"><i class="fas fa-arrow-right"></i></div>
        </div>
    `).join('');

    // NUEVO: Calcular confianza promedio para mostrar indicador
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
            <span>Recomendaciones del Asistente</span>
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

// NUEVO: Tarjeta de Intención Educativa (Diseño Premium para Preguntas)
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
                        <br>En lugar de buscar en múltiples recursos, ¿quieres que te lo explique paso a paso?
                    </p>
                </div>
            </div>
            <div class="intent-actions">
                <button class="btn-primary intent-cta-btn" onclick="window.askAboutTopic('${query}')">
                    <i class="fas fa-sparkles"></i>
                    Explicar con el Asistente
                </button>
            </div>
        </div>
    `;
}

// NUEVO: Componente para el botón de chat contextual dentro de una vista.
function createContextualChatButtonHTML(type, name) {
    const action = type === 'course' ? `window.askAboutCourse('${name}')` : `window.askAboutTopic('${name}')`;
    return `
        <div class="contextual-chat-section">
            <button class="btn-secondary btn-ask-ai" onclick="${action}">
                🤖 Consultar al Asistente sobre este ${type === 'course' ? 'curso' : 'tema'}
            </button>
        </div>
    `;
}

// NUEVO: Componente para la vista de un tema.
function createTopicViewHTML(topic, description, books = [], showChatButton = false) {
    // SOLUCIÓN: Renderizar los libros/recursos de forma segura (Link Obfuscation)
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
                <div class="material-group"><h5>📚 Recursos y Materiales</h5><div class="material-list">${booksHTML}</div></div>
                ${showChatButton ? createContextualChatButtonHTML('topic', topic.name) : ''}
            </div>
        </div>
    `;
}

// --- Componentes para la página de Administración (admin.js) ---



function createAdminItemCardHTML(item, type, subtitle = '', showResetPassword = false) {
    // SOLUCIÓN: Usar 'item.title' si el tipo es 'book', de lo contrario usar 'item.name'.
    let displayName = type === 'book' ? item.title : item.name;
    if (type === 'question') {
        displayName = item.question_text ? (item.question_text.substring(0, 80) + '...') : 'Pregunta sin texto';
    }

    const resetPasswordButton = showResetPassword ? `<button class="reset-pass-btn-small" data-id="${item.id}" title="Restablecer Contraseña"><i class="fas fa-key"></i></button>` : '';

    // NUEVO: Mostrar badge de área para carreras de forma más limpia
    let areaBadge = '';
    if (type === 'career' && item.area) {
        areaBadge = `<span class="area-badge" style="font-size: 0.7rem; background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); display:inline-block; margin-top:0.25rem;">${item.area}</span>`;
    } else if (type === 'question') {
        areaBadge = `<span class="area-badge" style="font-size: 0.7rem; background: var(--primary-light); padding: 2px 8px; border-radius: 4px; color: var(--text-dark); display:inline-block; margin-top:0.25rem;">${item.domain?.toUpperCase() || ''} | ${item.target || 'General'}</span>`;
    }

    // Subtitulo formateado
    const subtitleHTML = subtitle ? `<div class="item-subtitle" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${subtitle}</div>` : '';

    const resourceTypeAttr = type === 'book' ? `data-resource-type="${item.resource_type || item.type || 'other'}"` : `data-resource-type="${type}"`;

    return `
        <div class="admin-item-card item-card" ${resourceTypeAttr}>
            <div class="item-card-content">
                <h3 style="font-size: 1rem; margin-bottom: 4px;">${displayName}</h3>
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

// --- Tarjeta de Recursos Estándar Unificada (Single Source of Truth) ---
function createUnifiedResourceCardHTML(item) {
    // 1. Validaciones y Fallbacks
    const title = item.title || item.name || 'Material sin título';
    const author = item.author || '';
    const url = item.url || '#';
    // Homologación de tipos para cubrir libros, artículos, normas, etc.
    const type = item.type || item.resource_type || 'other';

    // 2. Registrar URL de forma segura en UI Manager para accesos protegidos
    if (url && url !== '#') {
        window.uiManager.registerMaterial(item.id, url);
    }

    // 3. Estado de acceso (Freemium/Premium)
    const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
    const isLocked = window.uiManager.isResourceLocked(isPremium);

    // 4. Determinar Iconos, Textos y Colores SVG(CSS) según el Tipo (Single Source of Truth)
    let iconClass, typeLabel, typeColorClass;

    switch (type) {
        case 'book':
            iconClass = 'fa-book';
            typeLabel = 'Libro/Manual';
            typeColorClass = 'urc-color-book'; // Definido en CSS
            break;
        case 'course':
            iconClass = 'fa-graduation-cap';
            typeLabel = 'Curso Premium';
            typeColorClass = 'urc-color-course';
            break;
        case 'norma':
            iconClass = 'fa-balance-scale';
            typeLabel = 'Norma Técnica';
            typeColorClass = 'urc-color-norma';
            break;
        case 'guia':
            iconClass = 'fa-file-medical';
            typeLabel = 'Guía Clínica';
            typeColorClass = 'urc-color-guia';
            break;
        case 'paper':
        case 'article':
            iconClass = 'fa-microscope';
            typeLabel = 'Artículo / Paper';
            typeColorClass = 'urc-color-paper';
            break;
        case 'video':
            iconClass = 'fa-video';
            typeLabel = 'Video Clase / Tutorial';
            typeColorClass = 'urc-color-video';
            break;
        default:
            iconClass = 'fa-image';
            typeLabel = 'Imagen / Otro';
            typeColorClass = 'urc-color-other';
            break;
    }

    // 5. Layout Híbrido Senior: Resolución de Imagen Inteligente (Smart Cover)
    const rawImage = item.image_url || item.coverUrl;
    const hasManualImage = Boolean(rawImage && rawImage.trim() !== '');
    const isDrive = window.uiManager.isDriveLink(url);

    let visualHTML = '';
    let displayImage = null;

    if (hasManualImage) {
        // Prioridad 1: Imagen manual definida por el admin
        displayImage = window.resolveImageUrl(rawImage);
    } else if (isDrive) {
        // Prioridad 2: Miniatura dinámica de Google Drive (Vía Proxy Seguro)
        displayImage = window.resolveImageUrl(url);
    }

    if (displayImage) {
        // CORRECCIÓN SENIOR: Búsqueda relativa (parentElement.querySelector) para asegurar disponibilidad
        // del nodo, impidiendo que el onerror crashee intentando invocar document.getElementById
        const fallbackId = `fb-${type}-${item.id}`;
        visualHTML = `<img src="${displayImage}" alt="${title}" class="urc-image" loading="lazy" onerror="this.style.display='none'; const fb = this.parentElement.querySelector('.urc-icon-fallback'); if(fb) fb.style.display='flex';">`;
    }

    // El fallback ahora tiene un ID único y su visibilidad depende de 'displayImage'
    const fallbackId = `fb-${type}-${item.id}`;
    const fallbackHTML = `
        <div id="${fallbackId}" class="urc-icon-fallback ${typeColorClass} fallback-trigger" style="${displayImage ? 'display:none;' : 'display:flex;'}">
            <i class="fas ${iconClass}"></i>
        </div>
    `;

    if (!displayImage) {
        visualHTML = fallbackHTML;
    }

    // 6. Ensamblaje del Componente Universal
    return `
        <div class="unified-resource-card ${displayImage ? 'has-bg-image' : ''}" data-resource-type="${type}">
            
            <!-- Zona de Acciones Flotantes (Librería) -->
            <div class="urc-library-actions">
                <button class="urc-action-btn js-library-btn action-save" data-id="${item.id}" data-type="${type === 'course' ? 'course' : 'book'}" data-action="save" title="Guardar">
                    <i class="far fa-bookmark"></i>
                </button>
                <button class="urc-action-btn js-library-btn action-fav" data-id="${item.id}" data-type="${type === 'course' ? 'course' : 'book'}" data-action="favorite" title="Favorito">
                    <i class="far fa-heart"></i>
                </button>
            </div>

            <!-- Zona Superior: Visual (Clicable) -->
            <div class="urc-visual-zone" role="button" tabindex="0" onclick="window.uiManager.unlockAndNavigate('${item.id}', '${type}', ${isPremium})" title="Ver detalles de ${title}">
                ${visualHTML}
                ${displayImage ? fallbackHTML : ''}
                
                <!-- Overlay Oscuro y Candado -->
                <div class="urc-visual-overlay"></div>
                ${isPremium ? `<div class="urc-premium-indicator" title="Recurso Premium"><i class="fas fa-crown"></i></div>` : ''}
                ${isLocked ? `<div class="urc-lock-indicator" title="Requiere Premium"><i class="fas fa-lock"></i></div>` : ''}
            </div>

            <!-- Zona Inferior: Información (Clicable) -->
            <div class="urc-info-zone" role="button" tabindex="0" onclick="window.uiManager.unlockAndNavigate('${item.id}', '${type}', ${isPremium})" title="Ver detalles de ${title}">
                <div class="urc-meta">
                    <span class="urc-badge ${typeColorClass}"><i class="fas ${iconClass}"></i> ${typeLabel}</span>
                    ${item.size ? `<span class="urc-size"><i class="fas fa-hdd"></i> ${item.size}</span>` : ''}
                </div>
                
                <h4 class="urc-title" title="${title}">${title}</h4>
                
                ${author ? `
                    <div class="urc-author" title="${author}">
                        <i class="fas fa-user-edit"></i> ${author}
                    </div>
                ` : ''}
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
                onmouseenter="startCarouselScroll('${id}-track', -1, 1)" 
                onmousedown="startCarouselScroll('${id}-track', -1, 6)" 
                onmouseup="startCarouselScroll('${id}-track', -1, 1)" 
                onmouseleave="stopCarouselScroll()"
                onclick="document.getElementById('${id}-track').scrollBy({left: -300, behavior: 'smooth'})">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="carousel-track-container" id="${id}-track">
                ${contentHTML}
            </div>
            <button class="carousel-btn next" 
                onmouseenter="startCarouselScroll('${id}-track', 1, 1)" 
                onmousedown="startCarouselScroll('${id}-track', 1, 6)" 
                onmouseup="startCarouselScroll('${id}-track', 1, 1)" 
                onmouseleave="stopCarouselScroll()"
                onclick="document.getElementById('${id}-track').scrollBy({left: 300, behavior: 'smooth'})">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

// (Banner Promocional Eliminado en Phase 29)

// =========================================
// 💀 SKELETON LOADERS
// =========================================

/**
 * Crea una tarjeta tipo Skeleton para mostrar mientras cargan los datos.
 * @param {string} type 'Premium' para horizontal o 'Grid' para vertical.
 */
function createSkeletonCardHTML(type = 'Grid') {
    if (type === 'Premium') {
        return `
            <div class="document-card-premium" style="pointer-events: none; opacity: 0.8;">
                <div class="document-icon-wrapper skeleton-box" style="border-radius: 10px; border: none;"></div>
                <div class="document-info" style="gap: 10px;">
                    <div class="skeleton-box skeleton-text short" style="height: 12px; margin: 0;"></div>
                    <div class="skeleton-box skeleton-text title" style="margin: 0; width: 90%;"></div>
                    <div class="skeleton-box skeleton-text" style="width: 50%; height: 10px; margin: 0;"></div>
                </div>
                <div class="skeleton-box" style="width: 60px; height: 32px; border-radius: 6px;"></div>
            </div>
        `;
    }

    // Default: Book/Course Grid Card
    return `
        <div class="skeleton-card" style="pointer-events: none; animation: fadeIn 0.3s ease-in-out;">
            <div class="skeleton-box skeleton-image"></div>
            <div class="skeleton-box skeleton-text title" style="margin-top: 8px;"></div>
            <div class="skeleton-box skeleton-text"></div>
            <div class="skeleton-box skeleton-text short"></div>
        </div>
    `;
}

// NUEVO: Tarjeta de Video Premium (Rediseñada para distinción visual)
window.createVideoCardHTML = function (item) {
    const title = item.title || item.name || 'Video Educativo';
    const author = item.author || 'Hub Academia';
    const url = item.url || '#';
    // Extracción robusta de ID de YouTube via Regex
    const getYouTubeID = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeID(url);
    const resolvedImage = window.resolveImageUrl(item.image_url);
    const thumbnail = item.image_url && !item.image_url.includes('unsplash')
        ? resolvedImage
        : (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80');

    if (url && url !== '#') {
        window.uiManager.registerMaterial(item.id, url);
    }

    const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
    const isLocked = window.uiManager.isResourceLocked(isPremium);

    return `
        <div class="video-card-premium ${isPremium ? 'is-premium' : ''} ${isLocked ? 'is-locked' : ''}" 
             data-id="${item.id}" 
             onclick="window.uiManager.unlockResource('${item.id}', 'video', ${isPremium})">
            
            <div class="video-thumbnail-wrapper">
                <img src="${thumbnail}" alt="${title}" class="video-img-contain" loading="lazy"
                     onerror="if(!this.dataset.triedMq && this.src.includes('youtube')){ this.dataset.triedMq=true; this.src=this.src.replace('hqdefault','mqdefault'); } else { this.src='https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'; }">
                
                <div class="video-play-hint">
                    <div class="play-circle-glow">
                        <i class="fas fa-play"></i>
                    </div>
                </div>

                <!-- Overlay Minimalista de Título -->
                <div class="video-overlay-info">
                    <h3 class="video-title-text">${title}</h3>
                    <span class="video-author-mini"><i class="fas fa-user-tie"></i> ${author}</span>
                </div>

                ${isPremium ? `<div class="video-premium-tag"><i class="fas fa-crown"></i></div>` : ''}
                ${isLocked ? `<div class="video-locked-overlay"><i class="fas fa-lock"></i></div>` : ''}
            </div>
        </div>
    `;
};

// ==========================================
// QUIZ REVIEW CARDS (Fase 4 Refactoring)
// ==========================================
window.UIComponents = window.UIComponents || {};

window.UIComponents.createReviewCardHTML = function (config) {
    const { question, answer, index, isDemo, isSavedFront } = config;

    let saveBtnHTML = '';
    if (!isDemo) {
        if (isSavedFront) {
            saveBtnHTML = `
            <div>
                <button class="btn-neon saved-flashcard-btn" disabled
                    style="padding: 0.5rem 1rem; font-size: 0.75rem; white-space: nowrap; border-radius: 20px; opacity: 0.5; cursor: not-allowed; background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4); color: #10b981; box-shadow: none;">
                    <i class="fas fa-check"></i> Ya guardado
                </button>
            </div>`;
        } else {
            saveBtnHTML = `
            <div>
                <button class="btn-neon save-flashcard-btn" data-qindex="${index}"
                    style="padding: 0.5rem 1rem; font-size: 0.75rem; white-space: nowrap; border-radius: 20px;">
                    <i class="fas fa-save"></i> Guardar Flashcard
                </button>
            </div>`;
        }
    }

    let imageHTML = '';
    if (question.image_url) {
        const resolvedImg = window.resolveImageUrl ? window.resolveImageUrl(question.image_url) : question.image_url;
        imageHTML = `
        <div class="review-q-image-container">
            <img src="${resolvedImg}" loading="lazy" style="max-height: 250px; border-radius: 8px;">
        </div>`;
    }

    let optionsHTML = '';
    const optionsList = question.options || [];
    optionsList.forEach((optText, optIdx) => {
        let className = 'review-opt';
        let formattedText = optText;

        if (optIdx === question.correct_option_index) {
            className += ' r-correct';
            formattedText = `<strong>${optText}</strong>`;
        } else if (answer && optIdx === answer.userAnswer) {
            className += ' r-wrong';
            formattedText = `<strong>${optText}</strong>`;
        }

        optionsHTML += `
        <div class="${className}">
            <span style="flex: 1;">${formattedText}</span>
        </div>`;
    });

    const defaultExp = 'Respuesta correcta basada en guías prácticas u oficiales pertinentes al tema.';
    const expText = question.explanation || defaultExp;

    let expImageHTML = '';
    if (question.explanation_image_url) {
        const resolvedExpImg = window.resolveImageUrl ? window.resolveImageUrl(question.explanation_image_url) : question.explanation_image_url;
        expImageHTML = `
        <div style="text-align:center; margin-top:1.5rem;">
            <img src="${resolvedExpImg}" loading="lazy" style="max-width:100%; max-height:250px; border-radius:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        </div>`;
    }

    return `
    <div class="review-card ${question.image_url ? 'has-image' : ''}" data-qindex="${index}">
        <div class="review-card-header">
            <div class="review-q-text" style="flex: 1; margin: 0;">
                <span style="color:#3b82f6; font-weight: 800; margin-right: 0.5rem;">Q${index + 1}</span> 
                ${question.question_text}
            </div>
            ${saveBtnHTML}
        </div>
        ${imageHTML}
        <div class="review-options">
            ${optionsHTML}
        </div>
        <div class="review-explanation">
            <strong><i class="fas fa-lightbulb" style="color:#fbbf24; margin-right:5px;"></i> Explicación:</strong><br><br>
            ${expText}
            ${expImageHTML}
        </div>
    </div>`;
};
