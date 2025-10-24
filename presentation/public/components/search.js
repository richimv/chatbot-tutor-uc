class SearchComponent {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.init();
    }

    init() {
        this.searchButton.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Cargar búsquedas recientes si existen
        this.loadRecentSearches();
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            this.showMessage('Por favor, ingresa un término de búsqueda.', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            // --- INICIO: CÓDIGO REAL PARA CONECTAR CON LA API ---
            const response = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) throw new Error('Error en la búsqueda');
            
            const searchData = await response.json();
            this.displayResults(searchData);
            // --- FIN: CÓDIGO REAL ---

            // Guardar en búsquedas recientes
            this.saveRecentSearch(query);
            
        } catch (error) {
            console.error('❌ Error buscando:', error);
            this.showMessage('Error al realizar la búsqueda. Intenta nuevamente.', 'error');
        }
    }

    displayResults(searchData) {
        const { results, suggestions, totalResults, searchQuery, isEducationalQuery } = searchData;

        // LÓGICA MEJORADA PARA "NO HAY RESULTADOS"
        if (results.length === 0 && isEducationalQuery) { // Si es pregunta teórica y no hay documentos
            // Si no hay resultados pero es una pregunta teórica, sugerir el chatbot.
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>🤔 No encontré documentos para "${searchQuery}"</h3>
                    <p>Parece que tu búsqueda es sobre un concepto teórico.</p>
                    <div class="chat-promo" style="margin-top: 1rem; text-align: left; border-color: #a5b4fc;">
                        <p>Nuestro <strong>Tutor IA</strong> es excelente para explicar temas como este.</p>
                        <button class="btn-primary" onclick="window.askAboutTopic('${searchQuery}')">
                            💬 Preguntar al Tutor IA
                        </button>
                    </div>
                </div>
            `;
            return;
        } else if (results.length === 0) { // Si no es pregunta teórica y no hay documentos
            // Si no hay resultados y no es teórica, mostrar mensaje estándar.
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>📭 No se encontraron cursos para "${searchQuery}"</h3>
                    <p>Intenta con otros términos de búsqueda o revisa la ortografía.</p>
                </div>
            `;
            return;
        }

        let resultsHTML = `
            <div class="search-header">
                <h3>🔍 Resultados para "${searchQuery}"</h3>
                <p class="results-count">${totalResults} curso${totalResults !== 1 ? 's' : ''} encontrado${totalResults !== 1 ? 's' : ''}</p>
            </div>
        `;

        // Mostrar cursos encontrados
        resultsHTML += results.map(course => `
            <div class="course-card">
                <div class="course-header">
                    <h3>${course.nombre}</h3>
                    <span class="course-badge">${course.carrera}</span>
                </div>
                
                <div class="course-meta">
                    <span class="meta-item">
                        <strong>📚 Temas:</strong> 
                        <div class="topic-list">
                            ${course.temas.map(tema => `<span class="topic-tag">${tema}</span>`).join('')}
                        </div>
                    </span>
                </div>

                <div class="materials-section">
                    <div class="material-category">
                        <strong>📄 PDFs:</strong>
                        ${course.materiales && course.materiales.pdfs && course.materiales.pdfs.length > 0 ? `
                            <div class="material-list">
                                ${course.materiales.pdfs.map(pdf => 
                                    `<a href="${pdf.url}" target="_blank" class="material-item">${pdf.name}</a>`
                                ).join('')}
                            </div>
                        ` : '<span class="no-material">No hay PDFs disponibles</span>'}
                    </div>
                </div>

                <div class="course-actions">
                    <button class="btn-secondary" onclick="askAboutCourse('${course.nombre}')">
                        💬 Preguntar sobre este curso
                    </button>
                </div>
            </div>
        `).join('');

        // Mostrar sugerencias inteligentes si existen
        if (suggestions) {
            resultsHTML += `
                <div class="suggestions-section">
                    <div class="suggestions-header">
                        <h4>💡 Recomendaciones Inteligentes</h4>
                        <p>Basado en tu búsqueda y tendencias del sistema</p>
                    </div>
                    <div class="suggestions-content">
                        ${suggestions.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                    </div>
                </div>
            `;
        }

        // Agregar sección de chatbot
        resultsHTML += `
            <div class="chat-promo">
                <div class="chat-promo-content">
                    <h4>🤖 ¿Necesitas más ayuda?</h4>
                    <p>Nuestro tutor IA puede explicarte conceptos, ayudarte con dudas específicas y guiarte en tu aprendizaje.</p>
                    <button class="btn-primary" onclick="openChat()">
                        💬 Hablar con el Tutor IA
                    </button>
                </div>
            </div>
        `;

        this.resultsContainer.innerHTML = resultsHTML;
    }

    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Buscando cursos...</p>
                <p class="loading-subtitle">Analizando tendencias y generando recomendaciones</p>
            </div>
        `;
    }

    showMessage(message, type = 'info') {
        const className = type === 'error' ? 'error-message' : 
                         type === 'warning' ? 'warning-message' : 'info-message';
        
        this.resultsContainer.innerHTML = `
            <div class="message ${className}">
                <p>${message}</p>
            </div>
        `;
    }

    saveRecentSearch(query) {
        let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        
        // Evitar duplicados
        recentSearches = recentSearches.filter(search => search !== query);
        
        // Agregar al inicio y mantener máximo 5
        recentSearches.unshift(query);
        recentSearches = recentSearches.slice(0, 5);
        
        localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    }

    loadRecentSearches() {
        // Podría implementarse para mostrar búsquedas recientes
    }
}

// Estilos adicionales para las nuevas funcionalidades
const additionalStyles = `
    <style>
        .search-header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #e2e8f0;
        }

        .search-header h3 {
            color: #1e293b;
            margin-bottom: 0.5rem;
        }

        .results-count {
            color: #64748b;
            font-size: 0.9rem;
        }

        .course-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }

        .course-badge {
            background: #dbeafe;
            color: #1e40af;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .meta-item {
            display: block;
            margin-bottom: 1rem;
        }

        .material-category {
            margin-bottom: 1rem;
        }

        .material-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .material-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 0.375rem 0.75rem;
            border-radius: 8px;
            font-size: 0.8rem;
            color: #475569;
        }

        .course-actions {
            margin-top: 1.5rem;
            padding-top: 1rem;
            border-top: 1px solid #f1f5f9;
        }

        .suggestions-section {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #bae6fd;
            border-radius: 12px;
            padding: 1.5rem;
            margin: 2rem 0;
        }

        .suggestions-header h4 {
            color: #0369a1;
            margin-bottom: 0.5rem;
        }

        .suggestions-header p {
            color: #64748b;
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }

        .suggestions-content {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
        }

        .chat-promo {
            background: linear-gradient(135deg, #fef7cd 0%, #fef3c7 100%);
            border: 1px solid #fcd34d;
            border-radius: 12px;
            padding: 1.5rem;
            margin-top: 2rem;
            text-align: center;
        }

        .chat-promo-content h4 {
            color: #d97706;
            margin-bottom: 0.5rem;
        }

        .chat-promo-content p {
            color: #92400e;
            margin-bottom: 1rem;
        }

        .loading-subtitle {
            font-size: 0.9rem;
            color: #64748b;
            margin-top: 0.5rem;
        }

        .search-suggestions {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
        }

        .search-suggestions ul {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
        }

        .search-suggestions li {
            margin: 0.25rem 0;
            color: #475569;
        }

        .btn-secondary {
            background: #6b7280;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.875rem;
        }

        .btn-secondary:hover {
            background: #4b5563;
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);

// ✅ ELIMINADO: La inicialización ahora se centraliza en app.js para evitar duplicados.