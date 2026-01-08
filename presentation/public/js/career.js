document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar sesión y tema
    if (window.sessionManager) {
        window.sessionManager.initialize();
    }

    // 2. Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const careerId = urlParams.get('id');

    if (!careerId) {
        window.location.href = '/';
        return;
    }

    // 3. Cargar datos
    await loadCareerData(careerId);

    // 4. Configurar búsqueda (redirección simple)
    setupSearch();
});

async function loadCareerData(id) {
    const container = document.getElementById('career-content');

    try {
        const response = await fetch(`${window.AppConfig.API_URL}/api/careers/${id}`);
        if (!response.ok) throw new Error('Carrera no encontrada');

        const career = await response.json();

        // ✅ ACIVAR BOTÓN DE VOLVER EN HEADER
        const headerBackBtn = document.getElementById('header-back-btn');
        if (headerBackBtn) {
            headerBackBtn.classList.add('visible');
            headerBackBtn.href = '/'; // Volver al inicio (Áreas)
            headerBackBtn.querySelector('span').textContent = 'Volver a Áreas';
        }

        renderCareer(career, container);
    } catch (error) {
        console.error('Error loading career:', error);
        container.innerHTML = `<div class="error-state">
            <p>No se pudo cargar la información de la carrera.</p>
            <p class="error-details" style="font-size: 0.8rem; color: #666;">${error.message}</p>
            <a href="/" class="btn-primary">Volver al inicio</a>
        </div>`;
    }
}

function renderCareer(career, container) {
    // Generate Courses HTML
    let coursesHTML = '';
    if (career.courses && career.courses.length > 0) {
        coursesHTML = career.courses.map(course => createBrowseCardHTML(course, 'course')).join('');
    } else {
        coursesHTML = '<p class="empty-state">No hay cursos disponibles para esta carrera aún.</p>';
    }

    container.innerHTML = `
        <!-- 1. HERO SECTION -->
        <div class="hero-banner">
            <div class="hero-content">
                <!-- Internal Nav Removed -->
                
                <div class="hero-identity">
                    <div class="hero-text">
                        <h1 class="hero-title">${career.name}</h1>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. OVERLAP CONTENT -->
        <div class="overlap-container">
            <div class="content-card">
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-layer-group"></i> Cursos Disponibles</h2>
                    <!-- Optional: Filter or view toggle could go here -->
                </div>
                
                <div class="browse-grid">
                    ${coursesHTML}
                </div>
            </div>
        </div>
    `;

    // Listeners
    container.querySelectorAll('.browse-card[data-type="course"]').forEach(card => {
        card.addEventListener('click', () => {
            const courseId = card.dataset.id;
            window.location.href = `course.html?id=${courseId}`;
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            // Redirigir a search.html (o index.html#search)
            // Por ahora, usaremos index.html con hash para mantener compatibilidad con la búsqueda existente
            // O idealmente, crear search.html también.
            // Vamos a redirigir al home con el parámetro de búsqueda para que search.js lo tome
            window.location.href = `/?q=${encodeURIComponent(query)}`;
        }
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}
