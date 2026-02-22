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
        // 1. INSTITUTIONAL DOCUMENTS (Normas, Guías) - TOP PRIORITY
        const officialDocs = course.materials.filter(m => m.type === 'norma' || m.type === 'guia');

        // 2. SCIENTIFIC PAPERS
        const papers = course.materials.filter(m => m.type === 'paper' || m.type === 'article');

        // 3. VIDEOS (YouTube Embeds)
        const videos = course.materials.filter(m => m.type === 'video');

        // 4. HISTORICAL BIBLIOGRAPHY & OTHERS
        const booksAndOthers = course.materials.filter(m => !m.type || m.type === 'book' || m.type === 'other');

        // A. DOCUMENTOS OFICIALES E INSTITUCIONALES
        if (officialDocs.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-landmark" style="color:var(--accent)"></i> Normativas y Guías Clínicas</h2>
                    <p class="section-subtitle">Documentos oficiales de referencia obligatoria.</p>
                </div>
                <div class="documents-grid-premium">
                    ${officialDocs.map(doc => createDocumentCardHTML(doc)).join('')}
                </div>
                <div class="section-spacer" style="height: 2.5rem;"></div>
            `;
        }

        // B. INVESTIGACIÓN Y PAPERS
        if (papers.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-microscope" style="color:var(--accent)"></i> Investigación y Literatura Científica</h2>
                </div>
                <div class="documents-grid-premium">
                    ${papers.map(p => createDocumentCardHTML(p)).join('')}
                </div>
                <div class="section-spacer" style="height: 2.5rem;"></div>
            `;
        }

        // C. VIDEOS (YouTube Embeds)
        if (videos.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-play-circle" style="color:var(--accent)"></i> Videoteca Explicativa</h2>
                </div>
                <div class="video-grid">
                    ${videos.map(v => createVideoCardHTML(v)).join('')}
                </div>
                <div class="section-spacer" style="height: 2.5rem;"></div>
            `;
        }

        // D. BIBLIOGRAFÍA HISTÓRICA Y OTROS (Core/Legacy)
        if (booksAndOthers.length > 0) {
            contentHTML += `
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-book-reader" style="color:var(--accent)"></i> Bibliografía y Material de Apoyo</h2>
                </div>
                <div class="documents-grid-premium">
                    ${booksAndOthers.map(b => createDocumentCardHTML(b)).join('')}
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


    // Sincronizar estado de botones (Manejado automáticamente por LibraryUI)
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
