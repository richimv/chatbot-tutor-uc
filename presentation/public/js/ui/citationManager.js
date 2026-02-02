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
                    <h2><i class="fas fa-quote-right" style="color:var(--accent)"></i> Generar Referencia Bibliográfica</h2>
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

    /**
     * ✅ MEJORA: Función de formateo de autores robusta.
     * Soporta múltiples autores separados por PUNTO Y COMA (;).
     * Ejemplo entrada: "Drake, Richard L.; Vogl, Wayne; Mitchell, Adam"
     */
    formatAuthors(authorString, style) {
        if (!authorString) return "Autor desconocido";

        // 1. Convertir el string "Nombre, Apellido; Nombre, Apellido" a una lista de objetos
        const authors = authorString.split(';').map(a => {
            const parts = a.trim().split(',');
            return {
                surname: parts[1] ? parts[1].trim() : parts[0].trim(), // Si no hay coma, usamos todo como apellido/nombre único
                name: parts[1] ? parts[0].trim() : ''
            };
        });

        // 2. Formatear según el estilo
        if (style === 'APA') {
            // APA: Drake, R. L., & Vogl, A. W.
            return authors.map((a, index) => {
                // Convertir "Richard L." -> "R. L."
                const initials = a.name.split(' ').map(n => n[0] + '.').join(' ');
                const isLast = index === authors.length - 1;
                const prefix = (isLast && authors.length > 1) ? '& ' : '';
                // Si es el primero no lleva amperstand, si es el ultimo y hay mas de uno si.
                // Correccion logica join:
                if (index === 0) return `${a.surname}, ${initials}`;
                if (isLast) return `& ${a.surname}, ${initials}`;
                return `${a.surname}, ${initials}`;
            }).join(', ');
            // NOTA: La lógica del usuario para APA era un poco simple en el map. 
            // Ajustamos para que el join se encargue de las comas, y el amperstand se maneje con lógica de array.
            // Mejor implementación exacta a lo pedido:
            /*
            return authors.map((a, index) => {
               const initials = a.name.split(' ').map(n => n[0] + '.').join(' ');
               return `${a.surname}, ${initials}`;
            }).join(', ').replace(/, ([^,]*)$/, ', & $1'); // Reemplazar la última coma por ", &" es un hack común para APA.
            */
            // Usemos la lógica literal del usuario pero corregida para el map/join context:
            return authors.map((a, index) => {
                const initials = a.name.split(' ').map(n => n[0] + '.').join(' ');
                const isLast = index === authors.length - 1;
                // APA standard: a list separated by commas, with "&" before the last one.
                // User logic: const prefix = (isLast && authors.length > 1) ? '& ' : '';
                // return `${prefix}${a.surname}, ${initials}`;
                // This would result in "Drake, R. L., & Vogl, A. W." if joined by ", ".
                // Let's stick to the user's intent:
                return `${(isLast && authors.length > 1) ? '& ' : ''}${a.surname}, ${initials}`;
            }).join(', ');
        }

        else if (style === 'Vancouver') {
            // Vancouver: Drake RL, Vogl AW
            return authors.map(a => {
                const initials = a.name.split(' ').map(n => n[0]).join(''); // Sin puntos
                return `${a.surname} ${initials}`;
            }).join(', ');
        }

        else if (style === 'ISO') {
            // ISO 690: DRAKE, Richard L.
            return authors.map(a => {
                return `${a.surname.toUpperCase()}, ${a.name}`;
            }).join('; ');
        }

        return authorString; // Fallback
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
            const rawAuthor = resource.author;
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

            // Formateadores Seguros con Fallbacks Académicos
            const safe = (str) => str || '';
            // Si el valor es falsy, usar el fallback (ej. [s.l.]).
            const val = (v, fallback) => v ? v : fallback;

            // Funciones específicas para evitar acumulación de puntuación
            // Ej: Si no hay editorial, no poner " ,".
            const appendIf = (val, prefix = '', suffix = '') => val ? `${prefix}${val}${suffix}` : '';

            // ✅ USAR NUEVA FUNCIÓN DE FORMATEO
            const fmt = (s, style) => this.formatAuthors(s, style);

            // Datos normalizados con Fallbacks
            const fYear = val(year, '[s.f.]');
            const fCity = val(city, '[s.l.]');
            const fPub = val(publisher, '[s.n.]');

            if (type === 'book') {
                // APA 7: Autor. (Año). Título (Edición). Editorial.
                const authorAPA = fmt(rawAuthor, 'APA');
                const editionStr = edition ? ` (${edition})` : '';
                apaText = `${authorAPA} (${fYear}). <i>${safe(title)}</i>${editionStr}. ${fPub}.`;

                // Vancouver: Autor. Título. Edición. Ciudad: Editorial; Año.
                const authorVan = fmt(rawAuthor, 'Vancouver');
                const edVan = edition ? ` ${edition}.` : '';
                vancouverText = `${authorVan}. ${safe(title)}.${edVan} ${fCity}: ${fPub}; ${fYear}.`;

                // ISO 690: AUTOR. Título. Edición. Ciudad: Editorial, Año. ISBN.
                // REGLA: Si la ciudad es desconocida [s.l.], y editorial también [s.n.], se muestran.
                const authorISO = fmt(rawAuthor, 'ISO');
                const edISO = edition ? ` ${edition}.` : '';
                const isbnISO = isbn ? ` ISBN ${isbn}.` : '';

                // Construcción ISO estricta
                isoText = `${authorISO}. <i>${safe(title)}</i>.${edISO} ${fCity}: ${fPub}, ${fYear}.${isbnISO}`;

            } else {
                // Recursos Digitales / Videos
                const authorAPA = fmt(rawAuthor, 'APA');
                const authorISO = fmt(rawAuthor, 'ISO');

                // APA: Autor. (Año). Título [Tipo]. Recuperado de URL
                apaText = `${authorAPA} (${fYear}). ${safe(title)} [${type === 'video' ? 'Video' : 'Recurso en línea'}]. Recuperado de ${url || '#'}`;

                // Vancouver: Autor. Título [Internet]. Año [citado fecha]. Disponible en: URL
                vancouverText = `${fmt(rawAuthor, 'Vancouver')}. ${safe(title)} [Internet]. ${fYear} [citado el ${accessDate}]. Disponible en: ${url || '#'}`;

                // ISO 690: AUTOR. Título [en línea]. Año. Disponible en: URL
                isoText = `${authorISO}. <i>${safe(title)}</i> [en línea]. ${fYear}. Disponible en: ${url || '#'}`;
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
