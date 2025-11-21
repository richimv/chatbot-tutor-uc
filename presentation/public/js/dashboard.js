class DashboardManager {
    constructor() {
        this.container = document.getElementById('dashboard-container');
        this.kpiData = null; // Almacenar los datos de los KPIs para reutilizarlos en los modales
        this.charts = {}; // Almacenar instancias de gráficos para destruirlos
        this.init();
    }

    async init() {
        // Renderizar el layout inicial con los filtros
        this.container.innerHTML = `
            <div class="dashboard-header">
                <h2>Visión General</h2>
                <div class="date-filters">
                    <button class="date-filter-btn active" data-days="7">7 Días</button>
                    <button class="date-filter-btn" data-days="30">30 Días</button>
                    <button class="date-filter-btn" data-days="90">90 Días</button>
                </div>
            </div>

            <div id="dashboard-content">
                <div class="loading-state">Cargando estadísticas...</div>
            </div>
        `;
        this.setupFilterListeners();
        await this.displayStatistics(7); // Cargar datos de los últimos 7 días por defecto
    }

    setupFilterListeners() {
        document.querySelector('.date-filters').addEventListener('click', (e) => {
            if (e.target.classList.contains('date-filter-btn')) {
                document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const days = e.target.dataset.days;
                this.displayStatistics(days);
            }
        });
    }

    async displayStatistics(days = 7) {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `<div class="loading-state">Cargando estadísticas...</div>`;

        try {
            // ✅ Ahora pasamos el filtro de días a la API
            const [kpiData, totalTrends, interactionTrends, predictionsData, feedbackData] = await Promise.all([
                AnalyticsApiService.getDashboardAnalytics(days),
                AnalyticsApiService.getSearchTrends(days), // ✅ RESTAURADO: Cargar tendencias totales
                AnalyticsApiService.getInteractionTrends(days), // Esto lo usamos para la dona
                AnalyticsApiService.getPredictions(),
                AnalyticsApiService.getFeedback()
            ]);

            // ✅ PLAN DE EJECUCIÓN: Almacenar los datos para usarlos en los modales
            this.kpiData = kpiData;

            // Destruir gráficos antiguos antes de crear nuevos
            Object.values(this.charts).forEach(chart => chart.destroy());

            contentContainer.innerHTML = `
                <div class="dashboard-grid">
                    <div class="kpi-cards-container" id="kpi-cards"></div>
                    <div class="charts-container">
                        <div class="chart-card">
                            <!-- ✅ RESTAURADO: Gráfico de tendencia total -->
                            <h3>Tendencia Total de Búsquedas</h3>
                            <div class="chart-wrapper">
                                <canvas id="total-trends-chart"></canvas>
                            </div>
                        </div>
                        <div class="chart-card">
                            <h3>Distribución de Búsquedas por Categoría</h3>
                            <div class="chart-wrapper">
                                <canvas id="category-distribution-chart"></canvas>
                            </div>
                        </div>
                        <!-- ✅ RESTAURADO: Contenedor para el gráfico de Top Términos -->
                        <div class="chart-card" id="top-terms-chart-container"></div>
                    </div>
                    
                    <!-- ✅ NUEVO: Sección de Top 5 Listas -->
                    <div class="top-lists-section">
                        <h3 class="section-title">Top 5 Más Solicitados</h3>
                        <div class="top-lists-container" id="top-lists-container"></div>
                    </div>
                    </div>
                    <div class="insights-container">
                        <!-- ✅ MEJORA: Dos tarjetas separadas para las predicciones -->
                        <div class="prediction-card" id="popular-course-card"></div>
                        <div class="prediction-card" id="popular-topic-card" style="animation-delay: 0.5s;"></div>
                        
                        <div class="feedback-table-card">
                            <h3>Últimos Feedbacks</h3>
                            <div id="feedback-table"></div>
                        </div>
                    </div>
                </div>
            `;

            this.renderKpiCards(kpiData);
            this.renderTotalTrendsChart(totalTrends);
            this.renderCategoryDistributionChart(kpiData.categoryDistribution); // ✅ MEJORA: Usar la nueva distribución calculada
            this.renderTopTermsChart(kpiData.topSearches); // ✅ RESTAURADO: Gráfico de barras Top 10
            this.renderTopLists(kpiData);
            this.renderPredictionCards(predictionsData);
            this.renderFeedbackTable(feedbackData);
            this.renderZeroResults(kpiData.zeroResultSearches); // ✅ NUEVO INSIGHT
        } catch (error) {
            console.error('❌ Error al cargar las estadísticas:', error);
            this.container.innerHTML = `<p class="error-state">No se pudieron cargar las estadísticas. ${error.message}</p>`;
        }
    }

    renderKpiCards(data) {
        const container = document.getElementById('kpi-cards');
        const positiveFeedbackRate = data.totalFeedbacks > 0 ? ((data.positiveFeedbacks / data.totalFeedbacks) * 100).toFixed(1) : '0.0';

        // ✅ MEJORA: Añadir iconos a las tarjetas de KPI
        container.innerHTML = `
            <!-- ✅ KPI Unificados y Claros -->
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <i class="fas fa-user-friends fa-2x" style="color: #9b59b6;"></i>
                    <div class="kpi-card-title">Usuarios Activos</div>
                </div>
                <div class="kpi-card-value">${data.users.active} <span class="kpi-sub-value">/ ${data.users.total} total</span></div>
            </div>
            <!-- ✅ NUEVO: KPI para Consultas al Chatbot -->
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <i class="fas fa-comments fa-2x" style="color: #f39c12;"></i>
                    <div class="kpi-card-title">Consultas al Chatbot</div>
                </div>
                <div class="kpi-card-value">${data.totalChatQueries}</div>
            </div>
            <!-- ✅ NUEVO: KPI para Búsquedas en Buscador -->
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <i class="fas fa-search fa-2x" style="color: #3498db;"></i>
                    <div class="kpi-card-title">Búsquedas en Buscador</div>
                </div>
                <div class="kpi-card-value">${data.totalSearches}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <i class="fas fa-graduation-cap fa-2x" style="color: #3498db;"></i>
                    <div class="kpi-card-title">Consultas Educativas</div>
                </div>
                <div class="kpi-card-value">${data.educationalQueryPercentage}%</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <i class="fas fa-thumbs-up fa-2x" style="color: var(--success);"></i>
                    <div class="kpi-card-title">Feedback Positivo</div>
                </div>
                <div class="kpi-card-value">${positiveFeedbackRate}%</div>
            </div>
        `;
    }

    // ✅ RESTAURADO: Gráfico de línea para el total de búsquedas diarias
    renderTotalTrendsChart(data) {
        const ctx = document.getElementById('total-trends-chart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(88, 101, 242, 0.5)');
        gradient.addColorStop(1, 'rgba(88, 101, 242, 0)');

        // ✅ NUEVO: Calcular y mostrar el total en la tarjeta del gráfico.
        const totalCount = data.values.reduce((sum, value) => sum + parseInt(value, 10), 0);
        const chartCard = document.getElementById('total-trends-chart').closest('.chart-card');
        const totalDisplay = document.createElement('div');
        totalDisplay.className = 'chart-total-display';
        totalDisplay.innerHTML = `Total: <strong>${totalCount}</strong>`;
        chartCard.querySelector('h3').insertAdjacentElement('afterend', totalDisplay);

        this.charts.totalTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Búsquedas Totales por Día',
                    data: data.values,
                    borderColor: 'rgba(88, 101, 242, 1)',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(88, 101, 242, 1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // ✅ MEJORA: Gráfico de dona usando la distribución calculada en backend
    renderCategoryDistributionChart(distribution) {
        const ctx = document.getElementById('category-distribution-chart').getContext('2d');

        // Si no hay datos de distribución, mostrar estado vacío
        if (!distribution || Object.values(distribution).reduce((a, b) => a + b, 0) === 0) {
            ctx.canvas.parentElement.innerHTML = '<p class="empty-state-small">No hay datos suficientes.</p>';
            return;
        }

        const categories = Object.keys(distribution);
        const counts = Object.values(distribution);
        const backgroundColors = [
            'rgba(52, 152, 219, 0.8)',  // Azul (Curso)
            'rgba(46, 204, 113, 0.8)',   // Verde (Tema)
            'rgba(155, 89, 182, 0.8)',  // Morado (Docente)
            'rgba(230, 126, 34, 0.8)',  // Naranja (Carrera)
            'rgba(149, 165, 166, 0.8)'  // Gris (General)
        ];

        this.charts.categoryDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Nº de Búsquedas',
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                let value = context.raw;
                                let total = context.chart._metasets[context.datasetIndex].total;
                                let percentage = Math.round((value / total) * 100) + '%';
                                return label + value + ' (' + percentage + ')';
                            }
                        }
                    }
                }
            }
        });
    }

    // ✅ RESTAURADO: Gráfico de barras para los términos más buscados (Top 10)
    renderTopTermsChart(topTerms) {
        const container = document.getElementById('top-terms-chart-container');
        if (!topTerms || topTerms.length === 0) {
            container.innerHTML = '<p class="empty-state-small">No hay términos para mostrar.</p>';
            return;
        }

        // Asegurarse de que el contenedor esté vacío y tenga un canvas
        container.innerHTML = '<canvas id="top-terms-bar-chart"></canvas>';
        const ctx = document.getElementById('top-terms-bar-chart').getContext('2d');

        // Tomar hasta 10 términos
        const termsToShow = topTerms.slice(0, 10);

        this.charts.topTerms = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: termsToShow.map(t => t.query),
                datasets: [{
                    label: 'Nº de Búsquedas',
                    data: termsToShow.map(t => t.count),
                    backgroundColor: 'rgba(88, 101, 242, 0.6)',
                    borderColor: 'rgba(88, 101, 242, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    hoverBackgroundColor: 'rgba(88, 101, 242, 0.8)'
                }]
            },
            options: {
                indexAxis: 'y', // Barras horizontales
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, y: { grid: { display: false } } }
            }
        });
    }

    // ✅ RESTAURADO: Gráfico de barras simple para los 5 términos más buscados.
    // ✅ NUEVO: Renderiza las 4 listas de Top 5
    renderTopLists(data) {
        const container = document.getElementById('top-lists-container');

        const createListCard = (title, icon, items, type) => {
            const listItems = items.map((item, index) => `
                <li class="top-list-item">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${item.name || item.query}</span>
                    <span class="count badge">${item.count} ${type === 'instructor' ? 'búsquedas' : 'vistas'}</span>
                </li>
            `).join('');

            return `
                <div class="top-list-card">
                    <div class="card-header">
                        <i class="fas ${icon}"></i>
                        <h4>${title}</h4>
                    </div>
                    <ul class="top-list">
                        ${items.length ? listItems : '<li class="empty-state-small">Sin datos suficientes</li>'}
                    </ul>
                </div>
            `;
        };

        container.innerHTML = `
            ${createListCard('Carreras', 'fa-graduation-cap', data.topCareers, 'career')}
            ${createListCard('Cursos', 'fa-book', data.topCourses, 'course')}
            ${createListCard('Temas', 'fa-lightbulb', data.topTopics, 'topic')}
            ${createListCard('Docentes', 'fa-chalkboard-teacher', data.topInstructors, 'instructor')}
        `;
    }

    // ✅ MEJORA: Función renombrada para manejar ambas predicciones
    renderPredictionCards(data) {
        const courseCard = document.getElementById('popular-course-card');
        const topicCard = document.getElementById('popular-topic-card');

        const renderCardContent = (title, icon, predictionData, type) => {
            const value = predictionData?.predictedCourse || predictionData?.predictedTopic || 'No disponible';
            const confidence = predictionData?.confidence || 0;
            const confidencePercent = (confidence * 100).toFixed(0);
            const reason = predictionData?.reason || '';

            // Color de la barra según confianza
            let barColor = '#4caf50'; // Verde (Alto)
            if (confidence < 0.7) barColor = '#ff9800'; // Naranja (Medio)
            if (confidence < 0.4) barColor = '#f44336'; // Rojo (Bajo)

            return `
                <h3><i class="fas ${icon}"></i> ${title}</h3>
                <p class="prediction-subtitle">${type === 'course' ? 'Curso con mayor probabilidad de ser popular:' : 'Tema emergente de mayor interés:'}</p>
                
                <div class="predicted-value">${value}</div>
                
                ${value !== 'No disponible' ? `
                    <div class="confidence-container" style="width: 80%; margin: 0.5rem auto;">
                        <div class="confidence-label" style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.2rem;">
                            <span>Confianza del modelo</span>
                            <span>${confidencePercent}%</span>
                        </div>
                        <div class="confidence-bar-bg" style="background: rgba(255,255,255,0.2); height: 6px; border-radius: 3px;">
                            <div class="confidence-bar-fill" style="width: ${confidencePercent}%; background: ${barColor}; height: 100%; border-radius: 3px; transition: width 1s ease;"></div>
                        </div>
                    </div>
                    <p class="prediction-reason" style="font-size: 0.85rem; opacity: 0.9; margin-top: 0.8rem; font-style: italic;">
                        <i class="fas fa-info-circle"></i> ${reason}
                    </p>
                ` : ''}
            `;
        };

        courseCard.innerHTML = renderCardContent('Predicción de Curso', 'fa-brain', data.popularCourse, 'course');
        topicCard.innerHTML = renderCardContent('Predicción de Tema', 'fa-lightbulb', data.popularTopic, 'topic');
    }

    // ✅ NUEVO INSIGHT: Renderiza la lista de búsquedas sin resultados
    renderZeroResults(data) {
        // Crear el contenedor si no existe (se añadirá dinámicamente al grid)
        let container = document.getElementById('zero-results-card');
        if (!container) {
            const insightsContainer = document.querySelector('.insights-container');
            container = document.createElement('div');
            container.id = 'zero-results-card';
            container.className = 'feedback-table-card'; // Reutilizamos estilo
            insightsContainer.appendChild(container);
        }

        if (!data || data.length === 0) {
            container.innerHTML = `
                <h3><i class="fas fa-search-minus" style="color: var(--danger);"></i> Búsquedas Sin Resultados</h3>
                <p class="empty-state-small">¡Excelente! Los usuarios encuentran todo lo que buscan.</p>
            `;
            return;
        }

        const listItems = data.map(item => `
            <li class="zero-result-item">
                <span class="query-text">"${item.query}"</span>
                <span class="query-count">${item.count} veces</span>
            </li>
        `).join('');

        container.innerHTML = `
            <h3><i class="fas fa-search-minus" style="color: var(--danger);"></i> Oportunidades de Contenido</h3>
            <p class="card-subtitle">Términos buscados que no arrojaron resultados:</p>
            <ul class="zero-results-list">
                ${listItems}
            </ul>
        `;
    }

    renderFeedbackTable(feedbackData) {
        const container = document.getElementById('feedback-table');
        const recentFeedback = feedbackData.slice(0, 5);
        if (recentFeedback.length === 0) {
            container.innerHTML = '<p class="empty-state-small">Aún no hay feedbacks.</p>';
            return;
        }
        container.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>Consulta</th><th>Feedback</th></tr></thead>
                <tbody>
                    ${recentFeedback.map(fb => `<tr><td>${this.escapeHTML(fb.query)}</td><td>${fb.is_helpful ? '👍' : '👎'}</td></tr>`).join('')}
                </tbody>
            </table>`;
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
    }
}

document.addEventListener('DOMContentLoaded', () => new DashboardManager());