/**
 * citationManager.js
 * 
 * Gestiona el modal de citaciones bibliográficas.
 * Se encarga de inyectar el HTML del modal y exponer funciones globales.
 */

class CitationManager {
    constructor() {
        this.init();
    }

    init() {
        this.renderModalStructure();
        this.exposeGlobalFunctions();
        this.setupEventListeners();
    }

    renderModalStructure() {
        if (document.getElementById('citation-modal')) return;

        const modalHTML = `
        <div id="citation-modal" class="modal">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-quote-right" style="color:var(--accent)"></i> Generar Cita Bibliográfica</h2>
                    <button class="modal-close-btn" onclick="closeCitationModal()">×</button>
                </div>
                <!-- ✅ MEJORA: Overflow handling para evitar desbordes -->
                <div class="modal-body" style="overflow-y: auto; max-height: 70vh;">
                    <!-- Tabs -->
                    <div class="citation-tabs">
                        <button class="tab-link active" onclick="switchCitationTab('apa')" id="btn-apa">APA 7</button>
                        <button class="tab-link" onclick="switchCitationTab('vancouver')" id="btn-vancouver">Vancouver</button>
                        <button class="tab-link" onclick="switchCitationTab('iso')" id="btn-iso">ISO 690</button>
                    </div>
                    
                    <!-- Content Areas -->
                    <div id="citation-content-apa" class="citation-content">
                        <div class="citation-box" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; word-break: break-word;">
                            <p id="citation-text-apa" class="citation-text" style="font-family: monospace; font-size: 0.9rem; margin:0; line-height: 1.5; color: var(--text-primary);"></p>
                        </div>
                        <button class="btn-copy-large" onclick="copyToClipboard('citation-text-apa', this)">
                            <i class="fas fa-copy"></i> Copiar al Portapapeles
                        </button>
                    </div>

                    <div id="citation-content-vancouver" class="citation-content" style="display:none;">
                         <div class="citation-box" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; word-break: break-word;">
                            <p id="citation-text-vancouver" class="citation-text" style="font-family: monospace; font-size: 0.9rem; margin:0; line-height: 1.5; color: var(--text-primary);"></p>
                        </div>
                        <button class="btn-copy-large" onclick="copyToClipboard('citation-text-vancouver', this)">
                            <i class="fas fa-copy"></i> Copiar al Portapapeles
                        </button>
                    </div>

                    <div id="citation-content-iso" class="citation-content" style="display:none;">
                         <div class="citation-box" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; word-break: break-word;">
                            <p id="citation-text-iso" class="citation-text" style="font-family: monospace; font-size: 0.9rem; margin:0; line-height: 1.5; color: var(--text-primary);"></p>
                        </div>
                        <button class="btn-copy-large" onclick="copyToClipboard('citation-text-iso', this)">
                            <i class="fas fa-copy"></i> Copiar al Portapapeles
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    exposeGlobalFunctions() {
        window.openCitationModal = (event, resource) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // Validar resource
            if (!resource) {
                console.error("No resource provided to openCitationModal");
                return;
            }

            // Mapeo seguro de propiedades (DB vs Frontend)
            const title = resource.title || resource.name;
            const author = resource.author;
            const year = resource.publication_year || resource.year;
            const publisher = resource.publisher;
            const edition = resource.edition;
            const city = resource.city;
            const isbn = resource.isbn;
            const url = resource.url;

            // Detectar tipo correctamente
            let type = resource.type || resource.resource_type;
            if (!type) type = 'book'; // Default a libro si no se especifica
            const accessDate = new Date().toLocaleDateString('es-ES');

            let apaText, vancouverText, isoText;

            // Formateadores Seguros
            const safe = (str) => str || '';

            if (type === 'book') {
                // APA 7
                apaText = `${safe(author)}. (${year || 's.f.'}). <i>${safe(title)}</i>${edition ? ` (${edition})` : ''}.${publisher ? ` ${publisher}.` : ''}`;
                // Vancouver
                vancouverText = `${safe(author)}. ${safe(title)}.${edition ? ` ${edition}.` : ''}${city ? ` ${city}:` : ''}${publisher ? ` ${publisher};` : ''}${year ? ` ${year}.` : ''}`;
                // ISO 690
                const authorUpper = safe(author).split(',')[0].toUpperCase() + (safe(author).includes(',') ? ',' + safe(author).split(',')[1] : '');
                isoText = `${authorUpper}. <i>${safe(title)}</i>.${edition ? ` ${edition}.` : ''}${city ? ` ${city}:` : ''}${publisher ? ` ${publisher},` : ''}${year ? ` ${year}.` : ''}${isbn ? ` ISBN ${isbn}.` : ''}`;
            } else {
                // Generar para otros recursos
                apaText = `${safe(author)}. (${year || 's.f.'}). ${safe(title)} [${type === 'video' ? 'Video' : 'Recurso en línea'}]. Recuperado de ${url || '#'}`;
                vancouverText = `${safe(author)}. ${safe(title)} [Internet].${year ? ` ${year}` : ''} [citado el ${accessDate}]. Disponible en: ${url || '#'}`;
                const authorUpper = safe(author).split(',')[0].toUpperCase();
                isoText = `${authorUpper}. <i>${safe(title)}</i> [en línea].${year ? ` ${year}.` : ''} Disponible en: ${url || '#'}`;
            }

            document.getElementById('citation-text-apa').innerHTML = apaText;
            document.getElementById('citation-text-vancouver').innerHTML = vancouverText;
            document.getElementById('citation-text-iso').innerHTML = isoText;

            this.switchTab('apa'); // Reset tab
            document.getElementById('citation-modal').style.display = 'flex';
        };

        window.closeCitationModal = () => {
            const modal = document.getElementById('citation-modal');
            if (modal) modal.style.display = 'none';
        };

        window.switchCitationTab = (tab) => this.switchTab(tab);

        window.copyToClipboard = (elementId, btnElement) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            const text = el.innerText;

            navigator.clipboard.writeText(text).then(() => {
                const originalHTML = btnElement.innerHTML;
                const originalBg = btnElement.style.background;

                btnElement.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                btnElement.style.background = '#059669'; // Success Green

                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    btnElement.style.background = originalBg;
                }, 2000);
            }).catch(err => console.error('Error copying:', err));
        };
    }

    switchTab(tab) {
        ['apa', 'vancouver', 'iso'].forEach(t => {
            const content = document.getElementById(`citation-content-${t}`);
            const btn = document.getElementById(`btn-${t}`);
            if (content) content.style.display = 'none';
            if (btn) btn.classList.remove('active');
        });

        const activeContent = document.getElementById(`citation-content-${tab}`);
        const activeBtn = document.getElementById(`btn-${tab}`);

        if (activeContent) activeContent.style.display = 'block';
        if (activeBtn) activeBtn.classList.add('active');
    }

    setupEventListeners() {
        // Cerrar al hacer clic fuera
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('citation-modal');
            if (event.target == modal) {
                modal.style.display = "none";
            }
        });
    }
}

// Inicializar globalmente
document.addEventListener('DOMContentLoaded', () => {
    window.citationManager = new CitationManager();
});
