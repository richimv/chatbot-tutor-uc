document.addEventListener('DOMContentLoaded', async () => {
    if (window.sessionManager) window.sessionManager.initialize();

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (!courseId) {
        window.location.href = '/';
        return;
    }

    // ✅ NUEVO: Almacenar ID para recarga
    window.currentCourseId = courseId;
    window.currentCourseData = null; // Cache básico

    await loadCourseData(courseId);
    setupSearch();

    // ✅ NUEVO: Listener para actualizar UI cuando la sesión cargue
    if (window.sessionManager) {
        window.sessionManager.onStateChange(() => {
            console.log("🔄 Sesión actualizada en Course Page. Re-renderizando...");
            if (window.currentCourseData) {
                renderCourse(window.currentCourseData, document.getElementById('course-content'));
            } else if (window.currentCourseId) {
                loadCourseData(window.currentCourseId);
            }
        });
    }
});

async function loadCourseData(id) {
    const container = document.getElementById('course-content');
    try {
        const response = await fetch(`${window.AppConfig.API_URL}/api/courses/${id}`);
        if (!response.ok) throw new Error('Curso no encontrado');

        const course = await response.json();

        // ✅ ACIVAR BOTÓN DE VOLVER EN HEADER
        const headerBackBtn = document.getElementById('header-back-btn');
        if (headerBackBtn) {
            headerBackBtn.classList.add('visible');
            headerBackBtn.onclick = (e) => {
                e.preventDefault();
                history.back();
            };
            headerBackBtn.querySelector('span').textContent = 'Volver';
        }

        renderCourse(course, container);
        window.currentCourseData = course; // Guardar en caché para re-renders
    } catch (error) {
        console.error('Error loading course:', error);
        container.innerHTML = `<div class="error-state">
            <p>Error al cargar el curso. Por favor, intenta nuevamente.</p>
            <p class="error-details" style="font-size: 0.8rem; color: #666;">${error.message}</p>
            <a href="/" class="btn-primary">Volver al inicio</a>
        </div>`;
    }
}

function renderCourse(course, container) {
    // Materials (Books/Resources)
    let materialsHTML = '';

    if (course.materials && course.materials.length > 0) {
        // ✅ UPDATED: Use the shared 3D Card component to ensure consistency and include Save/Fav buttons.
        // We wrap them in a grid container compatible with the 3D transforms.
        materialsHTML = `<div class="books-grid">
            ${course.materials.map(book => create3DBookCardHTML(book)).join('')}
        </div>`;
    } else {
        materialsHTML = '<p class="empty-state-small">No hay material bibliográfico registrado.</p>';
    }

    // Modal de Citación manejado por citationManager.js

    container.innerHTML = `
        <!-- HERO BANNER -->
        <div class="hero-banner">
            <div class="hero-content">
                <div class="hero-identity">
                    <div class="hero-text">
                        <h1 class="hero-title">${course.name}</h1>
                    </div>
                </div>
            </div>
        </div>

        <!-- CONTENT WORKSPACE -->
        <div class="overlap-container">
             <!-- Full Width Layout -->
            <div class="section-block">
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-book" style="color:var(--accent)"></i> Bibliografía y Recursos</h2>
                </div>
                ${materialsHTML}
            </div>
        </div>
        </div>
    `;

    // Sincronizar estado de botones (Guardado/Favorito)
    if (window.libraryManager) {
        window.libraryManager.updateButtons();
    }
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
