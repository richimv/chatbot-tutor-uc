document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const resourceId = urlParams.get('id');
    const wrapper = document.getElementById('resource-wrapper');

    if (!resourceId) {
        wrapper.innerHTML = '<div class="error-state">No se especificó un recurso (Falta ID).</div>';
        return;
    }

    try {
        const response = await fetch(`${window.AppConfig.API_URL}/api/resources/${resourceId}`);
        if (!response.ok) throw new Error('Recurso no encontrado');

        const resource = await response.json();
        renderResource(resource);
    } catch (error) {
        console.error('Error fetching resource:', error);
        wrapper.innerHTML = `<div class="error-state">No se pudo cargar la información del recurso. ${error.message}</div>`;
    }

    function renderResource(resource) {
        document.title = `${resource.title} - Hub Academia`;

        // Determine cover logic
        const rawImage = resource.image_url;
        let coverImage = null;

        if (rawImage && rawImage.trim() !== '') {
            coverImage = window.resolveImageUrl ? window.resolveImageUrl(rawImage) : rawImage;
        } else if (resource.url && window.uiManager && window.uiManager.isDriveLink(resource.url)) {
            coverImage = window.resolveImageUrl ? window.resolveImageUrl(resource.url) : null;
        }

        const isVideo = resource.resource_type === 'video' || (window.uiManager && window.uiManager.isVideo(resource.url));
        if (isVideo && resource.url && resource.url.includes('youtu') && (!rawImage || rawImage.includes('unsplash'))) {
            const match = resource.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
            const videoId = (match && match[2].length === 11) ? match[2] : null;
            if (videoId) {
                coverImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
        }

        // Definir clases e iconos basados en el tipo de recurso (igual que components.js)
        const typeConfigs = {
            'book': { icon: 'fa-book', colorClass: 'urc-color-book' },
            'guia': { icon: 'fa-file-medical', colorClass: 'urc-color-guia' },
            'norma': { icon: 'fa-file-signature', colorClass: 'urc-color-norma' },
            'paper': { icon: 'fa-file-alt', colorClass: 'urc-color-paper' },
            'video': { icon: 'fa-play-circle', colorClass: 'urc-color-other' },
            'other': { icon: 'fa-image', colorClass: 'urc-color-other' }
        };
        const config = typeConfigs[resource.resource_type] || typeConfigs['other'];

        // Si tenemos imagen, usar img con fallback nativo que muestra el bloque de color si falla.
        // Si no hay imagen, mostrar directamente el bloque de color hermoso.
        let visualHTML = '';
        if (coverImage) {
            visualHTML = `<img src="${coverImage}" alt="Portada de ${resource.title}" class="resource-cover" onerror="this.style.display='none'; document.getElementById('resource-cover-fallback').style.cssText='display:flex !important;';">
                          <div id="resource-cover-fallback" class="resource-cover resource-cover-fallback urc-icon-fallback ${config.colorClass}" style="display:none;"><i class="fas ${config.icon}"></i></div>`;
        } else {
            visualHTML = `<div id="resource-cover-fallback" class="resource-cover resource-cover-fallback urc-icon-fallback ${config.colorClass}" style="display:flex !important;"><i class="fas ${config.icon}"></i></div>`;
        }

        if (isVideo) {
            visualHTML = `
                <div style="position: relative;">
                    ${visualHTML}
                    <div style="position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); 
                                width: 60px; height: 60px; background: rgba(0,0,0,0.6); border-radius: 50%;
                                display: flex; align-items: center; justify-content: center; color: white;
                                font-size: 24px; cursor: pointer; pointer-events: none; border: 2px solid rgba(255,255,255,0.8);">
                        <i class="fas fa-play" style="margin-left: 4px;"></i>
                    </div>
                </div>
            `;
        }

        let viewTarget = `href="#"`;
        let viewOnClick = `onclick="event.preventDefault(); alert('Enlace no disponible');"`;
        let viewClass = 'btn-view';

        const isInternalGCS = resource.url && (resource.url.includes('storage.googleapis.com') || resource.url.startsWith('/') || resource.url.includes('hubacademia.com'));

        const defaultContent = `<div style="text-align:center; padding: 40px; color: var(--text-secondary);">
            <i class="fas fa-info-circle fa-3x" style="margin-bottom:15px; opacity:0.5;"></i>
            <p>Este recurso no tiene un resumen detallado aún.</p>
        </div>`;

        // Configurar la URL en el uiManager
        if (window.uiManager && resource.url) {
            window.uiManager.registerMaterial(resource.id, resource.url);
        }

        wrapper.innerHTML = `
            <div class="resource-hero">
                <div class="resource-cover-wrapper">
                    ${visualHTML}
                    
                    <div class="resource-cover-overlay-btn">
                        <button onclick="openResourceLink(${resource.id}, '${resource.url}', ${resource.is_premium})" class="btn-view" style="box-shadow: 0 8px 25px rgba(0,0,0,0.5);">
                            <i class="fas fa-external-link-alt"></i> Ver Recurso
                        </button>
                    </div>
                </div>
                <div class="resource-info">
                    <h1>${resource.title}</h1>
                    <p><i class="fas fa-user-edit"></i> ${resource.author || 'Autor Anónimo'}</p>
                    <div style="margin-top: 10px;">
                        ${resource.is_premium ? '<span class="badge premium"><i class="fas fa-crown"></i> PRO</span>' : ''}
                    </div>
                </div>
                
                <div class="resource-actions" style="margin-top: 20px;">
                    <!-- Integración con Mi Biblioteca / LibraryUI -->
                    <button class="btn-save btn-primary js-library-btn action-save" data-id="${resource.id}" data-type="book" data-action="save">
                        <i class="far fa-bookmark"></i> Agregar a mi Biblioteca
                    </button>
                    <button class="btn-save btn-primary js-library-btn action-fav" data-id="${resource.id}" data-type="book" data-action="favorite">
                        <i class="far fa-heart"></i> Favorito
                    </button>
                </div>
            </div>

            <div class="resource-body">
                <div class="resource-content" id="resource-content-body">
                    ${resource.content_html || defaultContent}
                </div>
            </div>
        `;

        // MEJORA PROFESIONAL: Envolver todas las tablas en un contenedor responsivo dinámicamente
        // Esto evita que las tablas de 10+ columnas rompan el layout sin usar el hack de 'display: block' en la tabla.
        setTimeout(() => {
            const contentBody = document.getElementById('resource-content-body');
            if (contentBody) {
                const tables = contentBody.querySelectorAll('table');
                tables.forEach(table => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'table-responsive-wrapper';
                    table.parentNode.insertBefore(wrapper, table);
                    wrapper.appendChild(table);
                });
            }
        }, 0);
    }
});

function openResourceLink(id, url, isPremium) {
    if (!url) return;
    if (window.uiManager) {
        window.uiManager.unlockResource(id, 'book', isPremium, `Recurso ${id}`);
    } else {
        window.open(url, '_blank');
    }
}

// Mock function for saving resources (Library integration)
async function saveResource(id, btn) {
    if (!window.LibraryService) {
        alert("El servicio de biblioteca no está disponible o requiere inicio de sesión.");
        return;
    }
    const isSaved = btn.classList.contains('saved');
    try {
        if (isSaved) {
            await window.LibraryService.removeResource(id);
            btn.classList.remove('saved');
            btn.innerHTML = '<i class="far fa-bookmark"></i> Guardar a Biblioteca';
        } else {
            await window.LibraryService.saveResource(id);
            btn.classList.add('saved');
            btn.innerHTML = '<i class="fas fa-bookmark" style="color:var(--primary-color)"></i> Guardado';
        }
    } catch (err) {
        console.error(err);
        alert("Error al guardar en la biblioteca.");
    }
}
