/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// GLOBAL: Lógica de Auto-Scroll para Carruseles
window.carouselInterval = null;

// Todos los valores provenientes del catálogo/administración pasan por este
// escape antes de interpolarse en plantillas HTML.
const safeHtmlValue = value => window.escapeHtml
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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
    const safeName = safeHtmlValue(item.name || 'Sin nombre');
    const safeId = safeHtmlValue(item.id);

    // MEJORA: Card para Carreras con soporte de imagen TIPO POSTER
    if (type === 'career') {
        // Opción 1: Diseño Full Image (Si tiene imagen)
        if (item.image_url) {
            const finalImage = window.resolveImageUrl(item.image_url);
            return `
                <div class="browse-card career-card full-image-card" data-type="career" data-id="${safeId}" style="cursor: pointer;">
                    <img src="${safeHtmlValue(finalImage)}" alt="${safeName}" class="browse-card-image-full" loading="lazy" decoding="async" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
                    <div class="browse-card-overlay">
                        <div class="browse-card-content overlay-content">
                            <h3 class="browse-card-title text-white" style="font-size: 1.25rem;">${safeName}</h3>
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
            <div class="browse-card career-card" data-type="career" data-id="${safeId}" style="cursor: pointer;">
                ${iconOrImage}
                <div class="browse-card-content">
                    <h3 class="browse-card-title">${safeName}</h3>
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
        const safeCode = safeHtmlValue(item.code || '');
        const codeHTML = item.code ? `<span class="course-card-code">${safeCode}</span>` : '';

        const actionButtons = `
            <div class="card-actions">
                <button class="action-btn save-btn js-library-btn" data-id="${safeId}" data-type="course" data-action="save" title="Guardar"><i class="far fa-bookmark"></i></button>
                <button class="action-btn fav-btn js-library-btn" data-id="${safeId}" data-type="course" data-action="favorite" title="Favorito"><i class="far fa-heart"></i></button>
            </div>
        `;

        // Si hay imagen, usamos el diseño "Full Cover"
        if (item.image_url) {
            const finalImage = window.resolveImageUrl(item.image_url);
            return `
                <div class="browse-card course-card full-image-card" data-type="course" data-id="${safeId}" style="cursor: pointer;">
                    <img src="${safeHtmlValue(finalImage)}" alt="${safeName}" class="browse-card-image-full" loading="lazy" decoding="async" onerror="this.style.display='none'; this.parentElement.classList.remove('full-image-card'); this.parentElement.innerHTML = 'Recarga la página para vista estándar';">
                    
                    ${actionButtons}

                    <div class="browse-card-overlay">
                         <div class="browse-card-content overlay-content">
                            <h3 class="browse-card-title text-white">${safeName}</h3>
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
            <div class="browse-card course-card" data-type="course" data-id="${safeId}" style="cursor: pointer;">
                ${actionButtons}
                ${iconOrImage}
                <div class="browse-card-content">
                    <div class="course-card-header">
                        <h3 class="browse-card-title">${safeName}</h3>
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
                <h3 class="browse-card-title">${safeName}</h3>
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
    const safeName = safeHtmlValue(course.name || 'Curso sin nombre');
    const safeId = safeHtmlValue(course.id);
    const safeCode = safeHtmlValue(course.code || '');
    const safeDescription = safeHtmlValue(course.description || '');
    const codeHTML = course.code ? `<span class="course-card-code">${safeCode}</span>` : '';

    return `
        <div class="browse-card course-card" style="cursor: pointer;" data-type="course" data-id="${safeId}">
            <div class="card-bookmark-ribbon"><i class="fas fa-bookmark"></i></div>
            <div class="browse-card-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="browse-card-content">
                <div class="course-card-header">
                    <h3 class="browse-card-title">${safeName}</h3>
                    ${codeHTML}
                </div>
                <p class="course-card-description" style="display:none;">${safeDescription}</p>
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

function createBackButtonHTML() {
    return `<button class="back-button" aria-label="Volver a la página anterior">‹ Volver</button>`;
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
    let displayName = item.name;
    if (type === 'book') {
        displayName = item.title || item.name || 'Recurso sin título';
    } else if (type === 'case') {
        const cleanCaseText = item.description_text ? item.description_text.replace(/<[^>]*>/g, '').trim() : '';
        displayName = item.title || (item.code ? `Caso: ${item.code}` : '') || (cleanCaseText ? (cleanCaseText.length > 80 ? cleanCaseText.substring(0, 80) + '...' : cleanCaseText) : 'Casuística sin título');
    } else if (type === 'question') {
        const cleanText = item.question_text ? item.question_text.replace(/<[^>]*>/g, '') : '';
        displayName = cleanText ? (cleanText.length > 110 ? cleanText.substring(0, 107) + '...' : cleanText) : 'Pregunta sin texto';
    }

    const resetPasswordButton = showResetPassword ? `<button class="reset-pass-btn-small" data-id="${item.id}" title="Restablecer Contraseña"><i class="fas fa-key"></i></button>` : '';

    // =========================================================================
    // 🏷️ BADGES SYSTEM (Refinado, alto contraste y consistente con Dual-Theme)
    // =========================================================================
    let areaBadge = '';
    if (type === 'career' && item.area) {
        areaBadge = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.35rem; align-items: center;">
                <span class="admin-badge admin-badge-indigo">
                    ${item.area}
                </span>
            </div>
        `;
    } else if (type === 'course') {
        const codeBadge = item.code ? `<span class="admin-badge admin-badge-green">${item.code}</span>` : '';
        const careerBadge = item.career_name ? `<span class="admin-badge admin-badge-muted">${item.career_name}</span>` : '';
        if (codeBadge || careerBadge) {
            areaBadge = `
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.35rem; align-items: center;">
                    ${codeBadge}
                    ${careerBadge}
                </div>
            `;
        }
    } else if (type === 'topic') {
        const courseBadge = item.course_name ? `<span class="admin-badge admin-badge-cyan">${item.course_name}</span>` : '';
        if (courseBadge) {
            areaBadge = `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.35rem; align-items: center;">${courseBadge}</div>`;
        }
    } else if (type === 'question') {
        const isMedicine = item.domain === 'medicine';
        const isEducation = item.domain === 'education';
        const domainClass = isMedicine ? 'admin-badge-green' : 'admin-badge-blue';
        const domainLabel = isMedicine ? 'SALUD' : isEducation ? 'EDUCACIÓN' : (item.domain?.toUpperCase() || 'GENERAL');

        const baseBadge = `<span class="admin-badge ${domainClass}">${domainLabel} • ${item.target || 'General'}</span>`;
        
        let topicBadge = '';
        if (item.topic) {
            topicBadge = `<span class="admin-badge admin-badge-muted">${item.topic}</span>`;
        }

        let caseBadge = '';
        if (item.case_id) {
            const caseCode = item.case_code || 'CASO';
            const caseOrder = item.case_order ? `Preg. #${item.case_order}` : '';
            const caseTitle = item.case_title ? ` - ${item.case_title}` : '';
            caseBadge = `<span class="admin-badge admin-badge-indigo case-linked-badge" title="Vinculada al Caso: ${caseCode}${caseTitle}">${caseCode} ${caseOrder ? `• ${caseOrder}` : ''}</span>`;
        }

        areaBadge = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.35rem; align-items: center;">
                ${baseBadge}
                ${topicBadge}
                ${caseBadge}
            </div>
        `;
    } else if (type === 'case') {
        const codeBadge = item.code ? `<span class="admin-badge admin-badge-indigo">${item.code}</span>` : '';
        const domainText = item.domain === 'medicine' ? 'Salud Profesional' : item.domain === 'education' ? 'Educación Docente' : (item.domain ? item.domain.toUpperCase() : 'General');
        const domainBadge = `<span class="admin-badge admin-badge-blue">${domainText}</span>`;
        const qCount = parseInt(item.questions_count, 10) || 0;
        const questionsBadge = `<span class="admin-badge admin-badge-green">${qCount} ${qCount === 1 ? 'pregunta vinculada' : 'preguntas vinculadas'}</span>`;
        
        areaBadge = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.35rem; align-items: center;">
                ${codeBadge}
                ${domainBadge}
                ${questionsBadge}
            </div>
        `;
    } else if (type === 'student') {
        const tier = (item.subscriptionTier || item.subscription_tier || 'free').toUpperCase();
        const status = (item.subscriptionStatus || item.subscription_status || 'inactive').toUpperCase();
        const expiresAt = item.subscriptionExpiresAt || item.subscription_expires_at;

        const tierClass = tier === 'BASIC' ? 'admin-badge-blue' : tier === 'ADVANCED' ? 'admin-badge-purple' : 'admin-badge-muted';
        const statusClass = status === 'ACTIVE' ? 'admin-badge-green' : status === 'EXPIRED' ? 'admin-badge-danger' : 'admin-badge-muted';

        let dateStr = '';
        if (expiresAt) {
            const formattedDate = new Date(expiresAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            dateStr = `📅 Expira: ${formattedDate}`;
        }

        areaBadge = `
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.35rem; align-items: center;">
                <span class="admin-badge ${tierClass}">${tier}</span>
                <span class="admin-badge ${statusClass}">${status}</span>
                ${dateStr ? `<span class="admin-badge admin-badge-muted">${dateStr}</span>` : ''}
            </div>
        `;
    }

    // Subtítulo formateado
    if (type === 'case' && !subtitle && item.description_text) {
        const cleanDesc = item.description_text.replace(/<[^>]*>/g, '').trim();
        if (cleanDesc && cleanDesc !== displayName) {
            subtitle = cleanDesc.length > 120 ? cleanDesc.substring(0, 120) + '...' : cleanDesc;
        }
    } else if (type === 'question' && !subtitle && item.case_title) {
        subtitle = `<span style="color: var(--text-muted, #94a3b8); font-size: 0.8rem;"><i class="fas fa-layer-group" style="color:#818cf8; margin-right: 4px;"></i>Caso: <strong>${item.case_title}</strong></span>`;
    }
    const subtitleHTML = subtitle ? `<div class="item-subtitle" style="font-size: 0.82rem; color: var(--text-muted, #94a3b8); margin-top: 0.25rem;">${subtitle}</div>` : '';

    const resourceTypeAttr = type === 'book' ? `data-resource-type="${item.resource_type || item.type || 'other'}"` : `data-resource-type="${type}"`;

    // --- RENDERIZACIÓN EXCLUSIVA PARA RECURSOS ---
    if (type === 'book') {
        const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
        const isVisible = item.visible === true || String(item.visible).toLowerCase() === 'true' || item.visible === 1 || item.visible === undefined;
        const isOpenDirectly = item.open_directly === true || String(item.open_directly).toLowerCase() === 'true' || item.open_directly === 1;

        // Renderización de Miniatura
        let thumbnailHTML = '';
        if (item.image_url && item.image_url.trim() !== '') {
            const resolvedThumb = window.resolveImageUrl(item.image_url, item.resource_type || item.type || 'book');
            thumbnailHTML = `
                <div class="admin-item-thumbnail" title="Portada asignada">
                    <img src="${resolvedThumb}" alt="Preview" loading="lazy" decoding="async">
                </div>
            `;
        } else {
            thumbnailHTML = `
                <div class="admin-item-thumbnail empty-thumbnail" title="Sin portada personalizada (usa fallback)">
                    <i class="fas fa-image-slash"></i>
                </div>
            `;
        }

        return `
            <div class="admin-item-card item-card resource-item-card" ${resourceTypeAttr} data-name="${safeHtmlValue(item.title || item.name || displayName || '')}">
                <div class="admin-item-checkbox-wrapper">
                    <input type="checkbox" class="admin-item-checkbox" data-type="${type}" data-id="${item.id}" title="Seleccionar para acción masiva">
                </div>
                ${thumbnailHTML}
                
                <div class="item-card-content">
                    <h3 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 2px 0;">${displayName}</h3>
                    ${areaBadge}
                    ${subtitleHTML}
                </div>

                <div class="admin-item-indicators">
                    <span class="indicator-badge premium-badge ${isPremium ? 'active' : 'inactive'}" title="${isPremium ? 'Acceso Premium Activado' : 'Acceso Libre'}">
                        <i class="fas fa-crown"></i>
                    </span>
                    <span class="indicator-badge visible-badge ${isVisible ? 'active' : 'inactive'}" title="${isVisible ? 'Visible en Catálogo' : 'Oculto al Público'}">
                        <i class="fas ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </span>
                    <span class="indicator-badge immersive-badge ${isOpenDirectly ? 'active' : 'inactive'}" title="${isOpenDirectly ? 'Apertura Inmersiva en Visor' : 'Apertura Tradicional'}">
                        <i class="fas fa-bolt"></i>
                    </span>
                </div>
                
                <div class="item-actions">
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

    return `
        <div class="admin-item-card item-card" ${resourceTypeAttr} data-email="${safeHtmlValue(item.email || '')}" data-name="${safeHtmlValue(item.name || displayName || '')}">
            <div class="admin-item-checkbox-wrapper">
                <input type="checkbox" class="admin-item-checkbox" data-type="${type}" data-id="${item.id}" title="Seleccionar para acción masiva">
            </div>
            <div class="item-card-content">
                <h3 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 2px 0; line-height: 1.4;">${displayName}</h3>
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
    const safeTitle = safeHtmlValue(title);
    const safeAuthor = safeHtmlValue(author);
    const safeType = safeHtmlValue(type);
    const safeId = safeHtmlValue(item.id);
    const safeSize = safeHtmlValue(item.size || '');

    // 2. Registrar URL de forma segura en UI Manager para accesos protegidos
    if (url && url !== '#') {
        window.uiManager.registerMaterial(item.id, url);
    }

    // 3. Estado de acceso (Freemium/Premium)
    const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
    const isLocked = window.uiManager.isResourceLocked(isPremium);

    // 4.1. Apertura Directa
    const openDirectly = item.open_directly === true || String(item.open_directly).toLowerCase() === 'true' || item.open_directly === 1;

    // 4.2. Determinar Iconos, Textos y Colores SVG(CSS) según el Tipo (Single Source of Truth)
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

    // ✅ RESOLUCIÓN UNIVERSAL: resolveImageUrl ahora maneja los fallbacks artísticos internamente
    const displayImage = window.resolveImageUrl(rawImage, type);

    // Siempre renderizamos la imagen (ya sea la del recurso o la artística por defecto)
    let visualHTML = `<img src="${safeHtmlValue(displayImage)}" alt="${safeTitle}" class="urc-image" loading="lazy" decoding="async" onerror="this.src='${safeHtmlValue(window.getDefaultResourceImage(type))}'">`;

    // El fallback de icono ahora es solo decorativo o para estados de error crítico,
    // pero por defecto lo mantenemos oculto ya que la imagen siempre debería cubrir el fondo.
    const fallbackHTML = `
        <div class="urc-icon-fallback ${typeColorClass} fallback-trigger" style="display:none;">
            <i class="fas ${iconClass}"></i>
        </div>
    `;

    // 6. Ensamblaje del Componente Universal
    return `
        <div class="unified-resource-card ${displayImage ? 'has-bg-image' : ''}" data-resource-type="${safeType}" data-resource-id="${safeId}" data-is-premium="${isPremium}" data-open-directly="${openDirectly}">
            
            <!-- Zona de Acciones Flotantes (Librería) -->
            <div class="urc-library-actions">
                <button class="urc-action-btn js-library-btn action-save" data-id="${safeId}" data-type="${type === 'course' ? 'course' : 'book'}" data-action="save" title="Guardar">
                    <i class="far fa-bookmark"></i>
                </button>
                <button class="urc-action-btn js-library-btn action-fav" data-id="${safeId}" data-type="${type === 'course' ? 'course' : 'book'}" data-action="favorite" title="Favorito">
                    <i class="far fa-heart"></i>
                </button>
            </div>

            <!-- Zona Superior: Visual (Clicable) -->
            <div class="urc-visual-zone" role="button" tabindex="0" title="Ver detalles de ${safeTitle}">
                ${visualHTML}
                ${displayImage ? fallbackHTML : ''}
                
                <!-- Overlay Oscuro y Candado -->
                <div class="urc-visual-overlay"></div>
                ${isPremium ? `<div class="urc-premium-indicator" title="Recurso Premium"><i class="fas fa-crown"></i></div>` : ''}
                ${isLocked ? `<div class="urc-lock-indicator" title="Requiere Premium"><i class="fas fa-lock"></i></div>` : ''}
            </div>

            <!-- Zona Inferior: Información (Clicable) -->
            <div class="urc-info-zone" role="button" tabindex="0" title="Ver detalles de ${safeTitle}">
                <div class="urc-meta">
                    ${item.size ? `<span class="urc-size"><i class="fas fa-hdd"></i> ${safeSize}</span>` : ''}
                </div>
                
                <h4 class="urc-title" title="${safeTitle}">${safeTitle}</h4>
                
                ${author ? `
                    <div class="urc-author" title="${safeAuthor}">
                        <i class="fas fa-user-edit"></i> ${safeAuthor}
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
    const safeResolve = window.resolveImageUrl || (url => url);
    const resolvedImage = safeResolve(item.image_url);
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
    if (!config || !config.question) {
        return '<div class="review-card-error">Error: Datos de pregunta no disponibles.</div>';
    }

    const { question, answer, index, isDemo, isSavedFront, career } = config;

    let imageHTML = '';
    if (question.image_url) {
        const safeResolve = window.resolveImageUrl || (url => url);
        const resolvedImg = safeResolve(question.image_url);
        imageHTML = `
        <div class="review-q-image-container">
            <img src="${resolvedImg}" loading="lazy" alt="Pregunta ${index + 1}">
        </div>`;
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let optionsHTML = '';
    const optionsList = question.options || [];
    optionsList.forEach((optText, optIdx) => {
        let className = 'review-opt';
        const letter = letters[optIdx] || (optIdx + 1);
        let badgeHTML = '';

        if (optIdx === question.correct_option_index) {
            className += ' r-correct';
            badgeHTML = `<span class="review-opt-status-badge correct" title="Opción Correcta"><i class="fas fa-check-circle"></i><span class="badge-text"> Correcta</span></span>`;
        } else if (answer && optIdx === answer.userAnswer) {
            className += ' r-wrong';
            badgeHTML = `<span class="review-opt-status-badge wrong" title="Tu respuesta"><i class="fas fa-times-circle"></i><span class="badge-text"> Tu respuesta</span></span>`;
        }

        optionsHTML += `
        <div class="${className}">
            <span class="review-opt-letter">${letter}</span>
            <span class="review-opt-text">${optText}</span>
            ${badgeHTML}
        </div>`;
    });

    const rawQuestionText = question.question_text || 'Pregunta sin texto disponible.';
    const questionTextHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(rawQuestionText) : rawQuestionText;

    const defaultExp = 'Respuesta correcta basada en guías prácticas u oficiales pertinentes al tema.';
    const rawExpText = question.explanation || defaultExp;
    const expTextHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(rawExpText) : rawExpText.replace(/\n/g, '<br>');

    let expImageHTML = '';
    if (question.explanation_image_url) {
        const safeResolve = window.resolveImageUrl || (url => url);
        const resolvedExpImg = safeResolve(question.explanation_image_url);
        expImageHTML = `
        <div class="review-explanation-image-container">
            <img src="${resolvedExpImg}" loading="lazy" alt="Sustento gráfico">
        </div>`;
    }

    let caseScenarioHTML = '';
    const hasCaseContent = Boolean(
        (question.case_description && String(question.case_description).trim()) ||
        (question.case_image_url && typeof question.case_image_url === 'string' && question.case_image_url.trim())
    );

    const isEducation = (window.location.search.includes('context=EDUCACION') || (career && !career.includes('Medicina') && !career.includes('Enfermería')));
    const caseLabel = isEducation ? 'Casuística Anidada' : 'Viñeta Clínica Compartida';
    const caseOrderNum = question.case_order || (index + 1);

    if (hasCaseContent) {
        const rawCaseDesc = question.case_description || '';
        const caseDescHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(rawCaseDesc) : rawCaseDesc;
        
        let caseImgHTML = '';
        if (question.case_image_url) {
            const safeResolve = window.resolveImageUrl || (url => url);
            caseImgHTML = `
            <div class="review-case-image-wrap">
                <img src="${safeResolve(question.case_image_url)}" loading="lazy" alt="Material del caso">
            </div>`;
        }

        caseScenarioHTML = `
        <div class="review-case-box">
            <div class="review-case-badge-row">
                <span class="review-case-pill">
                    <i class="fas fa-layer-group"></i> ${caseLabel}
                </span>
                <span class="review-case-order-pill">Pregunta ${caseOrderNum}</span>
            </div>
            ${rawCaseDesc.trim() ? `<div class="review-case-body">${caseDescHTML}</div>` : ''}
            ${caseImgHTML}
        </div>`;
    } else if (question.case_id) {
        caseScenarioHTML = `
        <div class="review-case-minimal-pill-row">
            <span class="review-case-pill">
                <i class="fas fa-link"></i> ${caseLabel} • Pregunta ${caseOrderNum}
            </span>
        </div>`;
    }

    return `
    <div class="review-card ${question.image_url ? 'has-image' : ''}" data-qindex="${index}">
        ${caseScenarioHTML}
        <div class="review-card-header">
            <span class="review-q-badge">Pregunta ${index + 1}</span>
            <div class="review-q-text">
                ${questionTextHTML}
            </div>
        </div>
        ${imageHTML}
        <div class="review-options">
            ${optionsHTML}
        </div>
        <div class="review-explanation">
            <div class="review-explanation-header">
                <span class="review-exp-tag">
                    <i class="fas fa-lightbulb"></i> Explicación y Sustento
                </span>
            </div>
            <div class="review-explanation-body">
                ${expTextHTML}
            </div>
            ${expImageHTML}
            ${!isDemo && !(typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('demo=true')) ? `
            <div class="review-tutor-action-row">
                <button type="button" class="btn-review-tutor-trigger" onclick="window.openTutorForReviewQuestion(${index})">
                    <img src="/assets/hubifrente.png" alt="Hubi" class="btn-review-tutor-icon">
                    <span>Consultar Tutor IA</span>
                </button>
            </div>` : ''}
        </div>
    </div>`;
};

/**
 * Global Helper: Abre la URL directa comprobada de un recurso o delega a uiManager.
 */
window.openVerifiedNewsUrl = function (url, id, type, isPremium, openDirectly) {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        window.open(url, '_blank');
        return;
    }
    if (window.uiManager) {
        window.uiManager.unlockAndNavigate(id, type, isPremium, openDirectly);
    } else if (url) {
        window.open(url, '_blank');
    }
};

/**
 * Crea la interfaz exclusiva estilo Boletín de Novedades (News Widget) para los últimos 30 días (Mes actual).
 */
function createNewsBulletinWidgetHTML(newsItems = [], domain = 'medicine') {
    if (!newsItems || newsItems.length === 0) {
        return `
            <div class="news-bulletin-empty" style="text-align: center; padding: 4rem 2rem; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 1.5rem; margin-top: 1rem;">
                <i class="far fa-newspaper" style="font-size: 3rem; color: #3b82f6; margin-bottom: 1rem; opacity: 0.7;"></i>
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">No hay novedades registradas en los últimos 30 días</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto;">Nuestra IA monitorea periódicamente la web oficial para publicar investigaciones y normas de ${domain === 'medicine' ? 'Salud' : 'Educación'}.</p>
            </div>
        `;
    }

    const featured = newsItems[0];
    const secondary = newsItems.slice(1);

    const getBadgeInfo = (item) => {
        const type = (item.resource_type || item.type || '').toLowerCase();
        if (type === 'noticia') return { label: 'NOTICIA OFICIAL', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', text: '#c084fc' };
        if (type === 'norma') return { label: 'NORMA OFICIAL', bg: 'rgba(217, 119, 6, 0.15)', border: 'rgba(217, 119, 6, 0.35)', text: '#fbbf24' };
        if (type === 'guia') return { label: 'GUÍA TÉCNICA', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', text: '#34d399' };
        return { label: 'PAPER CIENTÍFICO', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', text: '#60a5fa' };
    };

    const getHeroStyle = (item) => {
        const type = (item.resource_type || item.type || '').toLowerCase();
        if (type === 'noticia') {
            return {
                border: '1px solid rgba(168, 85, 247, 0.45)',
                shadow: '0 15px 40px rgba(168, 85, 247, 0.12)'
            };
        }
        if (type === 'norma') {
            return {
                border: '1px solid rgba(245, 158, 11, 0.45)',
                shadow: '0 15px 40px rgba(245, 158, 11, 0.12)'
            };
        }
        if (type === 'guia') {
            return {
                border: '1px solid rgba(16, 185, 129, 0.45)',
                shadow: '0 15px 40px rgba(16, 185, 129, 0.12)'
            };
        }
        return {
            border: '1px solid rgba(59, 130, 246, 0.45)',
            shadow: '0 15px 40px rgba(59, 130, 246, 0.12)'
        };
    };

    const cleanSnippet = (html) => {
        if (!html) return 'Resumen factual comprobado. Haz clic en el botón inferior para abrir la publicación oficial original.';
        const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return clean.length > 220 ? clean.substring(0, 220) + '...' : clean;
    };

    const featBadge = getBadgeInfo(featured);
    const featStyle = getHeroStyle(featured);
    const featOpenDirectly = featured.open_directly === true || String(featured.open_directly) === 'true';
    const featIsPremium = featured.is_premium === true;
    const featUrl = featured.url || '';
    const featThumb = window.resolveImageUrl ? window.resolveImageUrl(featured.image_url, featured.resource_type || 'paper') : (featured.image_url || 'assets/paper.webp');

    const featuredHTML = `
        <div class="news-hero-card has-media" style="background: var(--card-bg); border: ${featStyle.border}; box-shadow: ${featStyle.shadow};">
            <div class="news-hero-body">
                <div class="news-hero-tags">
                    <span class="news-pill-tag" style="background: ${featBadge.bg}; border: 1px solid ${featBadge.border}; color: ${featBadge.text}; font-weight: 700; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem;">
                        ${featBadge.label}
                    </span>
                    <span class="news-freshness-tag"><i class="fas fa-bolt"></i> Novedad Reciente (Últimos 30 Días)</span>
                </div>
                <h3 class="news-hero-title">${featured.title}</h3>
                <div class="news-hero-meta">
                    <span class="news-author"><i class="fas fa-building-columns"></i> ${featured.author || 'Entidad Oficial / Investigadores'}</span>
                </div>
                <p class="news-hero-snippet">${cleanSnippet(featured.content_html)}</p>
                <div class="news-hero-footer">
                    <button class="news-primary-btn" onclick="window.openVerifiedNewsUrl('${featUrl}', '${featured.id}', '${featured.resource_type || 'paper'}', ${featIsPremium}, ${featOpenDirectly})">
                        <i class="fas fa-external-link-alt"></i> Leer Documento Oficial Verificado
                    </button>
                </div>
            </div>
            <div class="news-hero-media">
                <img src="${featThumb}" alt="${featured.title}" class="news-hero-img" loading="lazy" decoding="async">
            </div>
        </div>
    `;

    const secondaryCardsHTML = secondary.map(item => {
        const itemType = (item.resource_type || item.type || 'paper').toLowerCase();
        const badge = getBadgeInfo(item);
        const openDirectly = item.open_directly === true || String(item.open_directly) === 'true';
        const isPremium = item.is_premium === true;
        const itemUrl = item.url || '';
        const secThumb = window.resolveImageUrl ? window.resolveImageUrl(item.image_url, itemType) : (item.image_url || 'assets/paper.webp');

        return `
            <div class="news-secondary-card has-media" data-type="${itemType}" onclick="window.openVerifiedNewsUrl('${itemUrl}', '${item.id}', '${itemType}', ${isPremium}, ${openDirectly})">
                <div class="news-sec-media">
                    <img src="${secThumb}" alt="${item.title}" class="news-sec-img" loading="lazy" decoding="async">
                </div>
                <div class="news-sec-body">
                    <div class="news-sec-header">
                        <span class="news-pill-tag" style="background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.text}; font-size: 0.7rem; padding: 2px 10px; border-radius: 12px;">
                            ${badge.label}
                        </span>
                        <span class="news-sec-date"><i class="far fa-clock"></i> Reciente</span>
                    </div>
                    <h4 class="news-sec-title">${item.title}</h4>
                    <div class="news-sec-author">
                        <i class="fas fa-user-edit"></i> ${item.author || 'Fuente Oficial'}
                    </div>
                    <p class="news-sec-snippet">${cleanSnippet(item.content_html)}</p>
                    <div class="news-sec-footer">
                        <span class="news-sec-link"><i class="fas fa-arrow-right"></i> Abrir Recurso</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="news-widget-wrapper">
            <div class="news-widget-header">
                <div class="news-widget-title-area">
                    <h2 class="news-widget-main-title">
                        <i class="fas fa-newspaper" style="color: #3b82f6;"></i> 
                        Novedades y Boletín Reciente
                    </h2>
                    <p class="news-widget-desc">Últimos papers de investigación científica, noticias y normas oficiales verificadas de ${domain === 'medicine' ? 'Salud' : 'Educación'}</p>
                </div>
                <div class="news-widget-badge-count">
                    <span>${newsItems.length} Publicaciones</span>
                </div>
            </div>

            ${featuredHTML}

            ${secondary.length > 0 ? `
                <div class="news-sec-section">
                    <h4 class="news-sec-heading"><i class="fas fa-list-ul"></i> Otras Novedades del Sector</h4>
                    <div class="news-sec-grid">
                        ${secondaryCardsHTML}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Navegación de tarjetas sin inline onclick. Los datos viajan en data-* y se
// convierten a valores controlados antes de llegar al UI manager.
document.addEventListener('click', event => {
    const zone = event.target.closest('.urc-visual-zone, .urc-info-zone');
    if (!zone || event.target.closest('.js-library-btn')) return;

    const card = zone.closest('.unified-resource-card');
    if (!card || !window.uiManager?.unlockAndNavigate) return;

    window.uiManager.unlockAndNavigate(
        card.dataset.resourceId,
        card.dataset.resourceType || 'other',
        card.dataset.isPremium === 'true',
        card.dataset.openDirectly === 'true'
    );
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const zone = event.target.closest('.urc-visual-zone, .urc-info-zone');
    if (!zone) return;
    event.preventDefault();
    zone.click();
});
