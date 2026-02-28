/**
 * components.js
 * 
 * Contiene funciones de plantilla para generar componentes de UI (HTML).
 * Estas funciones son "puras": reciben datos y devuelven una cadena de HTML.
 * Esto ayuda a mantener la lógica de la aplicación (en search.js, admin.js) separada de la presentación.
 */

// ✅ GLOBAL: Lógica de Auto-Scroll para Carruseles
window.carouselInterval = null;

// ✅ GLOBAL: Lógica de Auto-Scroll para Carruseles
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

// ... (Resto del archivo) ...

// EN createCarouselHTML (Más abajo en el archivo, se actualiza la llamada):
function createCarouselHTML(id, contentHTML) {
    return `
        <div class="carousel-container" id="${id}">
            <button class="carousel-btn prev" 
                onmouseenter="startCarouselScroll('${id}', -1, 1)" 
                onmousedown="startCarouselScroll('${id}', -1, 4)" 
                onmouseup="startCarouselScroll('${id}', -1, 1)" 
                onmouseleave="stopCarouselScroll()">
                &#10094;
            </button>
            <div class="carousel-track-container" id="${id}-track">
                ${contentHTML}
            </div>
            <button class="carousel-btn next" 
                onmouseenter="startCarouselScroll('${id}', 1, 1)" 
                onmousedown="startCarouselScroll('${id}', 1, 4)" 
                onmouseup="startCarouselScroll('${id}', 1, 1)" 
                onmouseleave="stopCarouselScroll()">
                &#10095;
            </button>
        </div>
    `;
}

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

    // ✅ MEJORA: Card para Carreras con soporte de imagen TIPO POSTER
    if (type === 'career') {
        // Opción 1: Diseño Full Image (Si tiene imagen)
        if (item.image_url) {
            return `
                <div class="browse-card career-card full-image-card" data-type="career" data-id="${item.id}" style="cursor: pointer;">
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
            return `
                <div class="browse-card course-card full-image-card" data-type="course" data-id="${item.id}" style="cursor: pointer;">
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
        // ✅ CORRECCIÓN: Eliminado onclick a topic.html (muerto). search.js intercepta.
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

    // ✅ MEJORA: Renderizado híbrido de Cursos y Libros
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
                        <br>En lugar de buscar en múltiples recursos, ¿quieres que te lo explique paso a paso?
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
                <div class="material-group"><h5>📚 Recursos y Materiales</h5><div class="material-list">${booksHTML}</div></div>
                ${showChatButton ? createContextualChatButtonHTML('topic', topic.name) : ''}
            </div>
        </div>
    `;
}

// --- Componentes para la página de Administración (admin.js) ---



function createAdminItemCardHTML(item, type, subtitle = '', showResetPassword = false) {
    // ✅ SOLUCIÓN: Usar 'item.title' si el tipo es 'book', de lo contrario usar 'item.name'.
    let displayName = type === 'book' ? item.title : item.name;
    if (type === 'question') {
        displayName = item.question_text ? (item.question_text.substring(0, 80) + '...') : 'Pregunta sin texto';
    }

    const resetPasswordButton = showResetPassword ? `<button class="reset-pass-btn-small" data-id="${item.id}" title="Restablecer Contraseña"><i class="fas fa-key"></i></button>` : '';

    // ✅ NUEVO: Mostrar badge de área para carreras de forma más limpia
    let areaBadge = '';
    if (type === 'career' && item.area) {
        areaBadge = `<span class="area-badge" style="font-size: 0.7rem; background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); display:inline-block; margin-top:0.25rem;">${item.area}</span>`;
    } else if (type === 'question') {
        areaBadge = `<span class="area-badge" style="font-size: 0.7rem; background: var(--primary-light); padding: 2px 8px; border-radius: 4px; color: var(--text-dark); display:inline-block; margin-top:0.25rem;">${item.domain?.toUpperCase() || ''} | ${item.target || 'General'}</span>`;
        subtitle = `Dificultad: ${item.difficulty || 'Intermedio'}`;
    }

    // Subtitulo formateado
    const subtitleHTML = subtitle ? `<div class="item-subtitle" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${subtitle}</div>` : '';

    return `
        <div class="admin-item-card item-card">
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
    // ✅ Homologación de tipos para cubrir libros, artículos, normas, etc.
    const type = item.type || item.resource_type || 'other';

    // 2. Registrar URL de forma segura en UI Manager para accesos protegidos
    if (url && url !== '#') {
        window.uiManager.registerMaterial(item.id, url);
    }

    // 3. Estado de acceso (Freemium/Premium)
    const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
    let isLocked = false;

    if (isPremium) {
        // ✅ PRIORIDAD: Usar datos directos de sesión si el manager falla (Race Condition)
        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const user = window.sessionManager?.getUser() || (userStr ? JSON.parse(userStr) : null);

        // Si no hay usuario ni token, está bloqueado al 100% (Visitante)
        if (!user && !token) {
            isLocked = true;
        } else if (user) {
            const status = user.subscriptionStatus || user.subscription_status;

            // Si es active (Premium) o admin, NUNCA está bloqueado visualmente
            if (status === 'active' || user.role === 'admin') {
                isLocked = false;
            } else {
                // Freemium (no active). Solo bloquear si ya no tiene usos
                const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
                const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 3);
                if (usage >= limit) {
                    isLocked = true;
                } else {
                    isLocked = false;
                }
            }
        }
    }

    // 4. Determinar Iconos, Textos y Colores SVG(CSS) según el Tipo (Single Source of Truth)
    let iconClass, typeLabel, typeColorClass;

    switch (type) {
        case 'book':
            iconClass = 'fa-book';
            typeLabel = 'Libro/Manual';
            typeColorClass = 'urc-color-book'; // Definido en CSS
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
        default:
            iconClass = 'fa-folder-open';
            typeLabel = 'Material de Apoyo';
            typeColorClass = 'urc-color-other';
            break;
    }

    // 5. Layout Híbrido: Si tiene imagen priorizamos imagen, sino un fondo degradado con Icono grande
    const rawImage = item.image_url || item.coverUrl;
    let visualHTML = '';

    if (rawImage && rawImage.trim() !== '') {
        visualHTML = `<img src="${rawImage}" alt="${title}" class="urc-image" loading="lazy" onerror="this.src='https://placehold.co/200x260/1e293b/ffffff?text=Material'">`;
    } else {
        visualHTML = `
            <div class="urc-icon-fallback ${typeColorClass}">
                <i class="fas ${iconClass}"></i>
            </div>
        `;
    }

    // 6. Ensamblaje del Componente Universal
    // Nota: El type interno para la biblioteca siempre será "book" para guardar favoritos (legado compatible)
    return `
        <div class="unified-resource-card" data-resource-type="${type}">
            
            <!-- Zona de Acciones Flotantes (Librería) -->
            <div class="urc-library-actions">
                <button class="urc-action-btn js-library-btn action-save" data-id="${item.id}" data-type="book" data-action="save" title="Guardar">
                    <i class="far fa-bookmark"></i>
                </button>
                <button class="urc-action-btn js-library-btn action-fav" data-id="${item.id}" data-type="book" data-action="favorite" title="Favorito">
                    <i class="far fa-heart"></i>
                </button>
            </div>

            <!-- Zona Superior: Visual (Clicable) -->
            <div class="urc-visual-zone" role="button" tabindex="0" onclick="window.uiManager.unlockResource('${item.id}', '${type}', ${isPremium})" title="Abrir ${title}">
                ${visualHTML}
                
                <!-- Overlay Oscuro y Candado -->
                <div class="urc-visual-overlay"></div>
                ${isPremium ? `<div class="urc-premium-indicator" title="Recurso Premium"><i class="fas fa-crown"></i></div>` : ''}
                ${isLocked ? `<div class="urc-lock-indicator" title="Requiere Premium"><i class="fas fa-lock"></i></div>` : ''}
            </div>

            <!-- Zona Inferior: Información (Clicable) -->
            <div class="urc-info-zone" role="button" tabindex="0" onclick="window.uiManager.unlockResource('${item.id}', '${type}', ${isPremium})" title="Abrir ${title}">
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

// ✅ NUEVO: Banner Promocional del Juego (Mid-Page)
function createGamePromoSectionHTML() {
    return /*html*/`
        <section class="game-promo-banner">
            <div class="game-promo-content">
                <div class="game-promo-text">
                    <span class="game-promo-badge"><i class="fas fa-trophy"></i> Nuevo Desafío</span>
                    <h2 class="game-promo-title">Hub Quiz Arena</h2>
                    <p class="game-promo-description">
                        Convierte el estudio en un juego. 🏆<br>
                        Desbloquea logros, repasa conceptos clave y visualiza tu progreso académico.
                    </p>
                    <button class="btn-gamified" onclick="window.uiManager.checkAuthAndExecute(() => window.location.href='quiz')">
                        <i class="fas fa-gamepad"></i> Jugar Ahora
                    </button>
                </div>
            </div>
            
            <!-- Background Art -->
            <div class="game-promo-bg">
                <picture>
                    <source media="(max-width: 768px)" srcset="assets/quiz-bg-mobile.png">
                    <img src="assets/quiz-bg-desktop.png" alt="Quiz Arena Art" loading="lazy">
                </picture>
                <div class="game-promo-overlay"></div>
            </div>
        </section>
    `;
}

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

// ✅ NUEVO: Tarjeta de Video Estandarizada
window.createVideoCardHTML = function (item) {
    const title = item.title || item.name || 'Video Educativo';
    const author = item.author || 'Hub Academia';
    const url = item.url || '#';
    const thumbnail = item.image_url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

    if (url && url !== '#') {
        window.uiManager.registerMaterial(item.id, url);
    }

    const isPremium = item.is_premium === true || String(item.is_premium).toLowerCase() === 'true' || item.is_premium === 1;
    let isLocked = false;

    if (isPremium) {
        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const user = window.sessionManager?.getUser() || (userStr ? JSON.parse(userStr) : null);

        if (!user || !token) {
            isLocked = true;
        } else {
            const status = user.subscriptionStatus || user.subscription_status;
            if (status !== 'active' && user.role !== 'admin') {
                const usage = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
                const limit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 3);
                if (usage >= limit) isLocked = true;
            }
        }
    }

    return `
        < div class="video-card ${isPremium ? 'premium-item' : ''} ${isLocked ? 'locked' : ''}" data - id="${item.id}" style = "cursor: pointer; position: relative;" >
            <div class="video-thumbnail-container" onclick="window.uiManager.unlockResource('${item.id}', 'video', ${isPremium})" style="position: relative;">
                <img src="${thumbnail}" alt="${title}" class="video-thumbnail" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 12px;" onerror="this.src='https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'">
                <div class="play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3rem; color: white; opacity: 0.8; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                    <i class="fas fa-play-circle"></i>
                </div>
                ${isPremium ? `<div class="urc-premium-indicator" title="Video Premium" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); padding: 5px 10px; border-radius: 20px; font-size: 0.8rem; color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); z-index: 2;"><i class="fas fa-crown"></i></div>` : ''}
                ${isLocked ? `<div class="urc-lock-indicator" title="Requiere Premium" style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #f8fafc; border-radius: 12px; z-index: 3;"><i class="fas fa-lock"></i></div>` : ''}
            </div>
            <div class="video-info" style="padding: 12px 5px;" onclick="window.uiManager.unlockResource('${item.id}', 'video', ${isPremium})">
                <h3 class="video-title" style="font-size: 1rem; margin: 0; color: var(--text-primary); font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.8rem;">${title}</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;"><i class="fas fa-chalkboard-teacher"></i> ${author}</p>
            </div>
        </div >
        `;
};