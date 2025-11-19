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
                            <div class="chart-wrapper" style="height: 350px;">
                                <canvas id="category-distribution-chart"></canvas>
                            </div>
                        </div>
                        <div class="chart-card">
                            <!-- ✅ RESTAURADO: Gráfico de barras para los 5 términos más buscados -->
                            <h3>Top 5 Términos más buscados</h3>
                            <div id="top-terms-chart-container" class="chart-wrapper" style="height: 300px;"></div>
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
            this.renderTotalTrendsChart(totalTrends); // ✅ RESTAURADO
            this.renderCategoryDistributionChart(kpiData.topSearches); // ✅ NUEVO: Dona de categorías
            this.renderTopTermsChart(kpiData.topSearches); // ✅ RESTAURADO: Renderizar el gráfico de barras
            this.renderPredictionCards(predictionsData); // ✅ CORRECCIÓN: Llamar a la nueva función
            this.renderFeedbackTable(feedbackData);
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

    // ✅ NUEVO: Gráfico de dona para la distribución por categoría.
    renderCategoryDistributionChart(topTerms) {
        const ctx = document.getElementById('category-distribution-chart').getContext('2d');
        if (!topTerms || topTerms.length === 0) {
            ctx.canvas.parentElement.innerHTML = '<p class="empty-state-small">No hay términos buscados en este período.</p>';
            return;
        }

        // 1. Agrupar y sumar conteos por tipo
        const termsByType = topTerms.reduce((acc, term) => {
            acc[term.type] = (acc[term.type] || 0) + parseInt(term.count, 10);
            return acc;
        }, {});

        const categories = Object.keys(termsByType);
        const counts = Object.values(termsByType);
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
                    label: 'Nº de Búsquedas por Categoría',
                    data: counts,
                    backgroundColor: backgroundColors.slice(0, categories.length),
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // ✅ RESTAURADO: Gráfico de barras simple para los 5 términos más buscados.
    renderTopTermsChart(topTerms) {
        const container = document.getElementById('top-terms-chart-container');
        if (!topTerms || topTerms.length === 0) {
            container.innerHTML = '<p class="empty-state-small">No hay términos para mostrar.</p>';
            return;
        }

        // Asegurarse de que el contenedor esté vacío y tenga un canvas
        container.innerHTML = '<canvas id="top-terms-bar-chart"></canvas>';
        const ctx = document.getElementById('top-terms-bar-chart').getContext('2d');

        this.charts.topTerms = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topTerms.map(t => t.query),
                datasets: [{
                    label: 'Nº de Búsquedas',
                    data: topTerms.map(t => t.count),
                    backgroundColor: 'rgba(88, 101, 242, 0.8)',
                    borderColor: 'rgba(88, 101, 242, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Barras horizontales
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // ✅ MEJORA: Función renombrada para manejar ambas predicciones
    renderPredictionCards(data) {
        const courseCard = document.getElementById('popular-course-card');
        const topicCard = document.getElementById('popular-topic-card');

        // ✅ SOLUCIÓN: Acceder a la propiedad correcta del objeto de predicción (ej: .predictedCourse).
        // También mostramos la confianza de la predicción para un dashboard más completo.
        const coursePrediction = data.popularCourse?.predictedCourse || 'No disponible';
        const courseConfidence = data.popularCourse?.confidence ? `(Confianza: ${(data.popularCourse.confidence * 100).toFixed(0)}%)` : '';

        const topicPrediction = data.popularTopic?.predictedTopic || 'No disponible';
        const topicConfidence = data.popularTopic?.confidence ? `(Confianza: ${(data.popularTopic.confidence * 100).toFixed(0)}%)` : '';

        courseCard.innerHTML = `
            <h3><i class="fas fa-brain"></i> Predicción ML</h3>
            <p>Curso con mayor probabilidad de ser popular:</p>
            <div class="predicted-value">${coursePrediction}</div>
            <p class="prediction-confidence">${courseConfidence}</p>
        `;
        topicCard.innerHTML = `
            <h3><i class="fas fa-lightbulb"></i> Predicción de Tema</h3>
            <p>Tema emergente de mayor interés:</p>
            <div class="predicted-value">${topicPrediction}</div>
            <p class="prediction-confidence">${topicConfidence}</p>
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