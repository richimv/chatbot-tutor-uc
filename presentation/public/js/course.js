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

    // Materials Categorization
    let contentHTML = '';

    if (course.materials && course.materials.length > 0) {
        // Filter by type
        const books = course.materials.filter(m => !m.type || m.type === 'book');
        const videos = course.materials.filter(m => m.type === 'video');
        const articles = course.materials.filter(m => m.type === 'article');
        const others = course.materials.filter(m => m.type === 'other');

        // 1. VIDEOS SECTION (First as requested in some contexts, or high priority)
        // Order requested: Books -> Articles -> Other -> Videos? 
        // User asked: "Categorizar los recursos del curso en: Libros, Artículos, Videos (con vista especial de YouTube) y Otros."
        // Usually Videos are high engagement, but let's stick to a logical flow. 
        // Let's go: Videos (Visual) -> Books (Core) -> Articles/Others (Supplements).

        // Orden Solicitado: Libros -> Videos -> Artículos -> Otros

        // 1. VIDEOS (High priority requested second) - WAIT, user said: Libros -> Videos -> Artículos -> Otro Recursos

        // A. BOOKS (Core)
        if (books.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-book" style="color:var(--accent)"></i> Bibliografía</h2>
                </div>
                <div class="books-grid">
                    ${books.map(book => create3DBookCardHTML(book)).join('')}
                </div>
                <div class="section-spacer" style="height: 2rem;"></div>
            `;
        }

        // B. VIDEOS (YouTube Embeds)
        if (videos.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-play-circle" style="color:var(--accent)"></i> Videos Clave</h2>
                </div>
                <div class="video-grid">
                    ${videos.map(v => createVideoCardHTML(v)).join('')}
                </div>
                <div class="section-spacer" style="height: 2rem;"></div>
            `;
        }

        // C. ARTICLES (Generic Cards)
        if (articles.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-newspaper" style="color:var(--accent)"></i> Artículos</h2>
                </div>
                <div class="resources-grid">
                    ${articles.map(a => createResourceCardHTML(a)).join('')}
                </div>
                <div class="section-spacer" style="height: 2rem;"></div>
            `;
        }

        // D. OTHERS (Generic Cards)
        if (others.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-archive" style="color:var(--accent)"></i> Otros Recursos</h2>
                </div>
                <div class="resources-grid">
                    ${others.map(o => createResourceCardHTML(o)).join('')}
                </div>
            `;
        }

    } else {
        contentHTML = '<p class="empty-state-small">No hay material bibliográfico registrado.</p>';
    }

    // ✅ OPTIMIZATION: Check if Hero already exists to prevent Animation Replay
    const existingHero = container.querySelector('.hero-title');
    if (existingHero && existingHero.textContent === course.name) {
        console.log('⚡ UI Optimized: Updating only materials, preserving Hero animation.');
        // Locate the content area
        const sectionBlock = container.querySelector('.section-block');
        if (sectionBlock) {
            sectionBlock.innerHTML = contentHTML;
        } else {
            // Should not happen if structure is maintained, but fallback:
            const wrapper = container.querySelector('.overlap-container');
            if (wrapper) wrapper.innerHTML = `<div class="section-block">${contentHTML}</div>`;
        }
    } else {
        // 🚀 First Render (Full)
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
                    ${contentHTML}
                </div>
            </div>
            </div>
        `;
    }


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
