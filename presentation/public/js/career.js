/**
 * @fileoverview Controlador principal de la página de "Carreras".
 * Responsable de inicializar la sesión del usuario, obtener el ID de la carrera desde
 * los parámetros de la URL, cargar los datos de la API y orquestar el renderizado en pantalla.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar sesión y preferencias del usuario (Tema oscuro/claro, Auth)
    if (window.sessionManager) {
        window.sessionManager.initialize();
    }

    // 2. Extraer el ID de la carrera actual desde la barra de direcciones (?id=X)
    const urlParams = new URLSearchParams(window.location.search);
    const careerId = urlParams.get('id');

    // 3. Validación de seguridad: Si no hay ID de carrera, proteger la navegación y enviar al Home
    if (!careerId) {
        window.location.href = '/';
        return;
    }

    // 4. Iniciar la carga asíncrona de datos desde el backend
    await loadCareerData(careerId);

    // 5. Configurar el motor de búsqueda persistente (Header)
    setupSearch();
});

/**
 * Consulta la API para obtener la metadata completa de una carrera y sus cursos agrupados.
 * Maneja los estados de éxito (pasando los datos al renderizador) o de error (Renderizando UI de fallback).
 * @param {string} id - UUID numérico/string de la carrera a consultar en base de datos.
 */
async function loadCareerData(id) {
    const container = document.getElementById('career-content');

    try {
        const response = await fetch(`${window.AppConfig.API_URL}/api/careers/${id}`);
        if (!response.ok) throw new Error('Carrera no encontrada en la base de datos.');

        const career = await response.json();

        // 🟢 UX Enhancement: Configurar el botón de navegación del Header dinámicamente
        // para que indique claramente que el usuario regresará a la lista general de áreas/carreras.
        const headerBackBtn = document.getElementById('header-back-btn');
        if (headerBackBtn) {
            headerBackBtn.classList.add('visible');
            headerBackBtn.href = '/'; // Volver al Hub Principal
            headerBackBtn.querySelector('span').textContent = 'Volver';
        }

        renderCareer(career, container);
    } catch (error) {
        console.error('Error crítico al cargar datos de la carrera:', error);
        // Renderizar componente de error ('Empty State' o 'Error State') amigable para el usuario
        container.innerHTML = `<div class="error-state">
            <p>No se pudo procesar la información de la carrera requerida.</p>
            <p class="error-details" style="font-size: 0.8rem; color: #666;">Detalle técnico: ${error.message}</p>
            <a href="/" class="btn-primary">Volver al inicio seguro</a>
        </div>`;
    }
}

/**
 * Inyecta el HTML de la página en el DOM e hidrata los componentes dinámicos con eventos.
 * @param {Object} career - Payload con la data de la carrera (incluye su nombre y lista de cursos).
 * @param {HTMLElement} container - Elemento del DOM donde se montará la vista.
 */
function renderCareer(career, container) {
    // 1. Generar marcado HTML usando el componente estandarizado de UI global (`createBrowseCardHTML`)
    // Esto asegura que una tarjeta de curso luzca idéntica aquí que en cualquier otra pantalla.
    let coursesHTML = '';
    if (career.courses && career.courses.length > 0) {
        coursesHTML = career.courses.map(course => createBrowseCardHTML(course, 'course')).join('');
    } else {
        coursesHTML = '<p class="empty-state">No hay cursos vinculados oficialmente a esta carrera por ahora.</p>';
    }

    container.innerHTML = `
        <!-- 1. HERO SECTION: Cabecera visual de la carrera -->
        <div class="hero-banner">
            <div class="hero-content">
                <div class="hero-identity">
                    <div class="hero-text">
                        <h1 class="hero-title">${career.name}</h1>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. GRID UNIFICADO: Contenedor que empareja con la página principal (Home) -->
        <div class="overlap-container" style="padding: 0; margin-top: -40px;"> <!-- Ajuste Z-index y superposición sutil -->
            <div class="main-container">
                <div class="section-header">
                    <h2 class="section-title"><i class="fas fa-layer-group"></i> Cursos Disponibles</h2>
                </div>
                
                <div class="browse-grid"> <!-- Clase compartida con search.js para consistencia total -->
                    ${coursesHTML}
                </div>
            </div>
        </div>
    `;

    // 3. Suscripción de Eventos (Event Binding)
    // Se recorre cada tarjeta recién insertada para que, al dar clic, redirija al visor de curso.
    container.querySelectorAll('.browse-card[data-type="course"]').forEach(card => {
        card.addEventListener('click', (e) => {
            // ✅ PATRÓN DE INTERCEPCIÓN (EVENT STOP BUBBLE)
            // Si el clic ocurrió dentro de un botón de acción interactivo (Favorito, Guardar de `libraryUI.js`),
            // detenemos la redirección de página abrupta.
            if (e.target.closest('.action-btn')) {
                return;
            }

            const courseId = card.dataset.id;
            window.location.href = `course?id=${courseId}`;
        });
    });

    // NOTA TÉCNICA (Sobre LibraryUI): 
    // Ya no es necesario inicializar manualmente los botones de "Guardar" y "Favorito" llamando scripts.
    // La nueva arquitectura (`libraryUI.js`) utiliza un \`MutationObserver\` que automáticamente
    // hidrata y sincroniza con Base de Datos cualquier botón de clase \`.js-library-btn\` detectado en el DOM.
}

/**
 * Configura la barra de búsqueda en la cabecera (Header top bar).
 * Detecta tanto la tecla 'Enter' como el clic en el botón de la lupa y redirige al HOME
 * donde `search.js` tomará control profundo del query por querystring (?q=...).
 */
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    if (!searchInput || !searchButton) return;

    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            // Delegamos el motor de inteligencia de búsqueda a la página principal.
            window.location.href = `/?q=${encodeURIComponent(query)}`;
        }
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}
