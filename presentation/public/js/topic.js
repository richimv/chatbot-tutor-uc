document.addEventListener('DOMContentLoaded', async () => {
    if (window.sessionManager) window.sessionManager.initialize();

    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get('id');

    if (!topicId) {
        window.location.href = '/';
        return;
    }

    await loadTopicData(topicId);
    setupSearch();
});

async function loadTopicData(id) {
    const container = document.getElementById('topic-content');
    try {
        // Fetch topic details (assuming endpoint exists or using generic fetch)
        // Note: The original app might not have a direct /api/topics/:id endpoint that returns everything.
        // We might need to fetch topic info + resources.
        // For now, let's assume we can get basic info.
        // If specific endpoint is missing, we might need to adjust.

        // Simulating fetch or using existing structure if available. 
        // Checking previous code, `renderTopicView` used `this.allData` or fetched specifically.
        // Let's try to fetch from a hypothetical endpoint or fallback.

        // REAL IMPLEMENTATION: The previous code filtered from `allData` or fetched.
        // We should probably implement a direct fetch in the backend if it doesn't exist, 
        // but for frontend refactor, let's try to hit the search API or similar if needed, 
        // OR just fetch the topic if the API supports it.

        // Let's assume /api/topics/:id exists or we create it. 
        // If not, we might need to fetch the course and find the topic.
        // Let's try a direct fetch first.
        const response = await fetch(`${window.AppConfig.API_URL}/api/topics/${id}`);

        let topic;
        if (response.ok) {
            topic = await response.json();
        } else {
            // Fallback: This might be a bit hacky without a dedicated endpoint, 
            // but let's assume for this refactor we have data.
            throw new Error('Tema no encontrado');
        }

        renderTopic(topic, container);
    } catch (error) {
        console.error('Error loading topic:', error);
        container.innerHTML = `<div class="error-state">
            <p>Error al cargar el tema.</p>
            <p class="error-details" style="font-size: 0.8rem; color: #666;">${error.message}</p>
            <a href="/" class="btn-primary">Volver al inicio</a>
        </div>`;
    }
}

function renderTopic(topic, container) {
    // Resources
    let resourcesHTML = '';
    if (topic.resources && topic.resources.length > 0) {
        resourcesHTML = topic.resources.map(res => `
            <a href="${res.url}" class="material-row" target="_blank">
                <div class="material-icon"><i class="fas fa-file-pdf"></i></div>
                <div class="material-info" style="flex:1">
                    <div style="font-weight:600; margin-bottom:0.25rem;">${res.title}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem;">Documento Educativo</div>
                </div>
                <i class="fas fa-download" style="color:var(--accent)"></i>
            </a>
        `).join('');
    } else {
        resourcesHTML = '<p class="empty-state-small">No hay materiales asociados.</p>';
    }

    container.innerHTML = `
        <!-- 1. HERO BANNER -->
        <div class="hero-banner">
            <div class="hero-content">
                <nav class="hero-nav">
                    <button onclick="history.back()" class="back-link" style="background:none; border:none; cursor:pointer;"><i class="fas fa-arrow-left"></i> Volver / Curso</button>
                </nav>
                
                <div class="hero-identity">
                    <div class="hero-text">
                        <h1 class="hero-title" style="margin-top: 0;">${topic.name}</h1>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. OVERLAP ZONE -->
        <div class="overlap-container">
            <div class="content-card">
                 <!-- Grid: Material vs Chat -->
                <div class="inner-topic-layout" style="display: grid; grid-template-columns: 1fr 340px; gap: 3rem;">
                    
                    <!-- Content -->
                    <div class="layout-main">
                        <div class="section-header">
                            <h2 class="section-title"><i class="fas fa-layer-group" style="color:var(--accent)"></i> Materiales de Estudio</h2>
                        </div>
                        <div class="material-list">
                            ${resourcesHTML}
                        </div>
                    </div>

                    <!-- Assistant Sidebar -->
                    <div class="layout-sidebar">
                        <div class="sidebar-box" style="background:#f8fafc; border:2px solid var(--accent);">
                             <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎓</div>
                             <h3 style="color:var(--accent); margin-bottom:0.5rem;">Asistente Inteligente</h3>
                             <p style="font-size:0.95rem; color:var(--text-muted); margin-bottom:1.5rem; line-height:1.5;">
                                Estoy entrenado específicamente en el contenido de <strong>${topic.name}</strong>.
                             </p>
                             <button id="start-chat-btn" class="btn-primary" style="width:100%; justify-content:center; box-shadow: 0 4px 14px rgba(var(--accent-rgb), 0.3);">
                                <i class="fas fa-comments"></i> Preguntar Ahora
                             </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    // Inject Responsive Style for Inner Grid
    const style = document.createElement('style');
    style.innerHTML = `@media (max-width: 900px) { .inner-topic-layout { grid-template-columns: 1fr !important; } }`;
    container.appendChild(style);

    // Chat button logic
    document.getElementById('start-chat-btn').addEventListener('click', () => {
        const event = new CustomEvent('open-chat', { detail: { topicId: topic.id, topicName: topic.name } });
        document.dispatchEvent(event);
    });
}

function renderResources(resources) {
    if (!resources || resources.length === 0) return '<p>No hay materiales disponibles.</p>';
    return resources.map(res => `
        <a href="${res.url}" class="material-card" target="_blank">
            <i class="fas fa-book"></i>
            <span>${res.title}</span>
        </a>
    `).join('');
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) window.location.href = `/?q=${encodeURIComponent(query)}`;
    };
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}
