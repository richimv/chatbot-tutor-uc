/**
 * category.js
 * Lógica para la página dinámica de directorios de recursos (Libros, Normas, Papers, etc.)
 * Agrupa los recursos por "Topics" (Temas).
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'book'; // Por defecto 'book'

    // 1. Configurar UI Base (Hero Banner)
    setupCategoryHeader(type);

    // 2. Cargar Recursos
    const resources = await fetchResources(type);

    // 3. Agrupar y Renderizar
    const grouped = groupResourcesByTopic(resources);
    renderGroups(grouped, type);

    // 4. Configurar Buscador Local
    setupLocalSearch();
});

function setupCategoryHeader(type) {
    const title = document.getElementById('hero-title');
    const subtitle = document.getElementById('hero-subtitle');
    const icon = document.getElementById('hero-icon');

    // Remove skeleton class
    title.classList.remove('skeleton-text');
    subtitle.classList.remove('skeleton-text');

    const meta = {
        'book': { t: 'Biblioteca Histórica', s: 'Colección de libros médicos y material de referencia.', i: 'fas fa-book-medical' },
        'norma': { t: 'Normativas y Leyes', s: 'Documentos legales, NTS y directivas de salud.', i: 'fas fa-balance-scale' },
        'paper': { t: 'Investigación y Papers', s: 'Artículos científicos y resúmenes de evidencia.', i: 'fas fa-microscope' },
        'guia': { t: 'Guías Clínicas', s: 'Guías de Práctica Clínica nacionales e internacionales', i: 'fas fa-notes-medical' },
        'video': { t: 'Videoteca', s: 'Clases maestras, procedimientos y recursos audiovisuales.', i: 'fas fa-play-circle' },
        'other': { t: 'Otros Recursos', s: 'Material misceláneo para complementar tu estudio.', i: 'fas fa-photo-video' }
    };

    const currentMeta = meta[type] || meta['other'];
    title.textContent = currentMeta.t;
    subtitle.textContent = currentMeta.s;
    icon.className = currentMeta.i;

    // Apply data-type for specific CSS styles
    const heroSection = document.getElementById('category-hero');
    if (heroSection) {
        heroSection.setAttribute('data-type', type);
    }
}

async function fetchResources(type) {
    try {
        const url = `${window.AppConfig.API_URL}/api/resources?type=${type}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al cargar la bóveda');
        return await response.json();
    } catch (error) {
        console.error("Error fetching category resources:", error);
        document.getElementById('category-groups-container').innerHTML = `
            <div class="empty-state-card" style="text-align:center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:var(--text-muted); margin-bottom: 20px;"></i>
                <p>No se pudo cargar la bóveda en este momento. Intenta recargar la página.</p>
            </div>
        `;
        return [];
    }
}

function groupResourcesByTopic(resources) {
    const groups = {};
    const unorganized = [];

    resources.forEach(res => {
        // En bookRepository update, hicimos JSON_AGG de topicIds y names.
        // Verificamos formato array de objetos {id, name}
        if (res.topics && Array.isArray(res.topics) && res.topics.length > 0) {
            res.topics.forEach(topic => {
                if (!groups[topic.name]) {
                    groups[topic.name] = { id: topic.id, name: topic.name, resources: [] };
                }
                groups[topic.name].resources.push(res);
            });
        } else {
            // Si no tiene topics asiganados.
            unorganized.push(res);
        }
    });

    // Convert to Array, sort alphabetically by topic name
    const groupedArray = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));

    // Si hay recursos sin tema, mandarlos al final "Recursos Generales"
    if (unorganized.length > 0) {
        groupedArray.push({
            id: 'general',
            name: 'Recursos Generales',
            resources: unorganized
        });
    }

    return groupedArray;
}

function renderGroups(groups, categoryType) {
    const container = document.getElementById('category-groups-container');
    container.innerHTML = '';

    if (groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card" style="text-align:center; padding: 40px;">
                <i class="fas fa-folder-open" style="font-size:3rem; color:var(--text-muted); margin-bottom: 20px;"></i>
                <p>Aún no hay recursos agregados a esta bóveda.</p>
            </div>
        `;
        return;
    }

    groups.forEach((group, index) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'topic-group'; // Comienza cerrado por defecto

        // El primer grupo puede ir abierto por defecto
        if (index === 0) groupEl.classList.add('active');

        // Construir la grillas de recursos usando el Single Source of Truth basado en el categoryType
        const resourcesHTML = group.resources.map(res => {
            if (categoryType === 'video' || res.type === 'video' || res.resource_type === 'video') {
                return window.createVideoCardHTML(res);
            }
            return window.createUnifiedResourceCardHTML(res);
        }).join('');

        groupEl.innerHTML = `
            <div class="topic-header" onclick="toggleTopicGroup(this)">
                <div class="topic-info">
                    <h2>${group.name} <span class="topic-count">${group.resources.length} items</span></h2>
                </div>
                <i class="fas fa-chevron-down topic-toggle-icon"></i>
            </div>
            <div class="topic-content">
                <div class="topic-grid">
                    ${resourcesHTML}
                </div>
            </div>
        `;
        container.appendChild(groupEl);
    });
}

// Expande o Contraer el Acordeón
window.toggleTopicGroup = function (headerElement) {
    const groupElement = headerElement.closest('.topic-group');
    groupElement.classList.toggle('active');
};

function setupLocalSearch() {
    const searchInput = document.getElementById('local-search-input');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.unified-resource-card, .video-card');

        cards.forEach(card => {
            let title = '';
            let subtitle = '';

            if (card.classList.contains('unified-resource-card')) {
                title = card.querySelector('.urc-title')?.textContent.toLowerCase() || '';
                subtitle = card.querySelector('.urc-author')?.textContent.toLowerCase() || '';
            } else if (card.classList.contains('video-card')) {
                title = card.querySelector('.video-title')?.textContent.toLowerCase() || '';
                subtitle = card.querySelector('.video-author')?.textContent.toLowerCase() || '';
            }

            if (title.includes(term) || subtitle.includes(term)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });

        // Ocultar Grupos Enteros si están vacíos tras la búsqueda
        document.querySelectorAll('.topic-group').forEach(group => {
            const visibleCards = Array.from(group.querySelectorAll('.unified-resource-card, .video-card')).filter(c => c.style.display !== 'none');
            const toggleIcon = group.querySelector('.topic-toggle-icon');

            if (term !== '') {
                if (visibleCards.length > 0) {
                    group.style.display = 'block';
                    group.classList.add('active');
                } else {
                    group.style.display = 'none';
                }
            } else {
                group.style.display = 'block';
                group.querySelectorAll('.unified-resource-card, .video-card').forEach(c => {
                    c.style.display = c.classList.contains('unified-resource-card') ? 'flex' : 'block';
                });
            }
        });
    });
}
