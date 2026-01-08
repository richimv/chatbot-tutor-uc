class DashboardManager {
    constructor() {
        this.container = document.getElementById('dashboard-container');
        this.charts = {};
        this.init();
    }

    async init() {
        this.renderInitialStructure();
        this.setupFilterListeners();
        await this.displayStatistics(7);
    }

    renderInitialStructure() {
        this.container.innerHTML = `
            <div class="dashboard-header">
                <div style="display: flex; justify-content: space-between; align-items: end;">
                    <div>
                        <h2 class="dashboard-title">Visión General</h2>
                        <p class="dashboard-subtitle">Métricas clave y rendimiento del sistema</p>
                    </div>
                    <div class="date-filters" style="display: flex; gap: 0.5rem;">
                        <!-- Using nav-link style for buttons for consistency -->
                        <button class="chart-btn active" data-days="7">7 Días</button>
                        <button class="chart-btn" data-days="30">30 Días</button>
                        <button class="chart-btn" data-days="90">90 Días</button>
                    </div>
                </div>
            </div>

            <div id="dashboard-content">
                <div class="loading-state" style="text-align: center; padding: 4rem; color: var(--text-muted);">
                    <i class="fas fa-circle-notch fa-spin fa-2x"></i>
                    <p style="margin-top: 1rem;">Cargando datos...</p>
                </div>
            </div>
        `;
    }

    setupFilterListeners() {
        const filters = this.container.querySelector('.date-filters');
        if (filters) {
            filters.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    this.container.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    this.displayStatistics(e.target.dataset.days);
                }
            });
        }
    }

    async displayStatistics(days = 7) {
        const contentContainer = document.getElementById('dashboard-content');

        try {
            const [kpiData, totalTrends, interactionTrends, predictionsData, feedbackData, courseSeriesData, topicSeriesData] = await Promise.all([
                AnalyticsApiService.getDashboardAnalytics(days),
                AnalyticsApiService.getSearchTrends(days),
                AnalyticsApiService.getInteractionTrends(days),
                fetch(`${window.AppConfig.API_URL}/api/analytics/predictions?days=${days}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                }).then(res => res.json()),
                AnalyticsApiService.getFeedback(),
                fetch(`${window.AppConfig.API_URL}/api/analytics/courses-time-series?days=${days}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                }).then(res => res.json()),
                fetch(`${window.AppConfig.API_URL}/api/analytics/topics-time-series?days=${days}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                }).then(res => res.json())
            ]);

            // Clear old charts
            Object.values(this.charts).forEach(chart => chart.destroy());

            // Render Layout using dashboard.css Grid Classes
            contentContainer.innerHTML = `
                <!-- KPIs -->
                <div class="kpi-grid" id="kpi-grid"></div>

                <!-- Main Charts -->
                <div class="charts-grid">
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3 class="chart-title">Tendencia de Búsquedas</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="total-trends-chart"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3 class="chart-title">Distribución por Categoría</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="category-distribution-chart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="charts-grid">
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3 class="chart-title">Top 5 Cursos (Popularidad)</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="course-popularity-chart"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3 class="chart-title">Top 5 Temas (Popularidad)</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="topic-popularity-chart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Bottom Section: Lists & Insights -->
                <div class="dashboard-sections-grid">
                    <!-- Top Lists -->
                    <div class="section-card">
                        <div class="section-header">
                            <h3 class="section-title">Lo Más Buscado</h3>
                        </div>
                        <div id="top-lists-content" style="padding: 0;"></div>
                    </div>

                    <!-- Insights & Feedback -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <!-- Predictions -->
                        <div id="prediction-cards-container" style="display: flex; flex-direction: column; gap: 1rem;"></div>
                        
                        <!-- Recent Feedback -->
                        <div class="section-card">
                            <div class="section-header">
                                <h3 class="section-title">Feedback Reciente</h3>
                            </div>
                            <div id="feedback-list" class="activity-list"></div>
                        </div>
                    </div>
                </div>
            `;

            this.renderKpiGrid(kpiData);
            this.renderTotalTrendsChart(totalTrends);
            this.renderCategoryDistributionChart(kpiData.categoryDistribution);
            this.renderTimeSeriesChart(courseSeriesData, 'course-popularity-chart');
            this.renderTimeSeriesChart(topicSeriesData, 'topic-popularity-chart');
            this.renderTopLists(kpiData);
            this.renderPredictions(predictionsData);
            this.renderFeedbackList(feedbackData);

        } catch (error) {
            console.error('Dashboard Error:', error);
            contentContainer.innerHTML = `<p class="error-message">Error cargando datos: ${error.message}</p>`;
        }
    }

    renderKpiGrid(data) {
        const container = document.getElementById('kpi-grid');
        const positiveFeedbackRate = data.totalFeedbacks > 0 ? ((data.positiveFeedbacks / data.totalFeedbacks) * 100).toFixed(1) : '0.0';

        const kpis = [
            { icon: 'fa-user-friends', color: 'text-info', label: 'Usuarios Activos', value: data.users.active, sub: `/ ${data.users.total}` },
            { icon: 'fa-comments', color: 'text-warning', label: 'Consultas Chat', value: data.totalChatQueries },
            { icon: 'fa-search', color: 'text-primary', label: 'Búsquedas', value: data.totalSearches },
            { icon: 'fa-graduation-cap', color: 'text-success', label: '% Educativo', value: `${data.educationalQueryPercentage}%` },
            { icon: 'fa-smile', color: 'text-success', label: 'Satisfacción', value: `${positiveFeedbackRate}%` }
        ];

        container.innerHTML = kpis.map(kpi => `
            <div class="kpi-card">
                <div class="kpi-icon">
                    <i class="fas ${kpi.icon}"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${kpi.value} <small style="font-size: 0.6em; color: var(--text-muted);">${kpi.sub || ''}</small></div>
                    <div class="kpi-label">${kpi.label}</div>
                </div>
            </div>
        `).join('');
    }

    renderTotalTrendsChart(data) {
        this.renderLineChart('total-trends-chart', data.labels, [{
            label: 'Búsquedas Diarias',
            data: data.values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true
        }]);
    }

    renderCategoryDistributionChart(distribution) {
        const ctx = document.getElementById('category-distribution-chart').getContext('2d');
        if (!distribution) return;

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(distribution),
                datasets: [{
                    data: Object.values(distribution),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
            }
        });
    }

    renderTimeSeriesChart(data, canvasId) {
        if (!data || !data.datasets) return;

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        const datasets = data.datasets.map((ds, i) => ({
            ...ds,
            borderColor: colors[i % colors.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4
        }));

        this.renderLineChart(canvasId, data.labels, datasets);
    }

    renderLineChart(id, labels, datasets) {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (!ctx) return;

        this.charts[id] = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    renderTopLists(data) {
        const container = document.getElementById('top-lists-content');

        const renderList = (title, icon, items) => {
            if (!items.length) return '';
            return `
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color);">
                    <h4 style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas ${icon}"></i> ${title}
                    </h4>
                    <ul class="activity-list">
                        ${items.slice(0, 3).map((item, i) => `
                            <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem;">
                                <span><strong style="color: var(--primary); margin-right: 0.5rem;">#${i + 1}</strong> ${item.name || item.query}</span>
                                <span class="badge" style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">${item.count}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        };

        container.innerHTML = `
            ${renderList('Carreras Populares', 'fa-graduation-cap', data.topCareers)}
            ${renderList('Cursos Populares', 'fa-book', data.topCourses)}
            ${renderList('Temas de Interés', 'fa-lightbulb', data.topTopics)}
        `;
    }

    renderPredictions(data) {
        const container = document.getElementById('prediction-cards-container');

        const renderPrediction = (title, icon, pred) => {
            if (!pred) return '';
            const confidence = (pred.confidence * 100).toFixed(0);
            return `
                <div class="kpi-card" style="padding: 1rem; flex-direction: column; gap: 0.5rem; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="font-size: 0.9rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas ${icon}" style="color: var(--warning);"></i> ${title}
                        </h4>
                        <span style="font-size: 0.8rem; color: var(--success);">${confidence}% Confianza</span>
                    </div>
                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-main);">${pred.predictedCourse || pred.predictedTopic}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${pred.reason}</div>
                </div>
            `;
        };

        container.innerHTML = `
            ${renderPrediction('Próximo Curso Tendencia', 'fa-brain', data.popularCourse)}
            ${renderPrediction('Tema Emergente', 'fa-bolt', data.popularTopic)}
        `;
    }

    renderFeedbackList(feedback) {
        const container = document.getElementById('feedback-list');
        if (!feedback.length) {
            container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Sin feedback reciente</div>';
            return;
        }

        container.innerHTML = feedback.slice(0, 5).map(fb => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${fb.is_helpful ? 'fa-thumbs-up' : 'fa-thumbs-down'}" style="color: ${fb.is_helpful ? 'var(--success)' : 'var(--danger)'}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-text">${this.escapeHTML(fb.query)}</div>
                    <div class="activity-time">${new Date(fb.created_at).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    }

    escapeHTML(str) {
        return str ? str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[m])) : '';
    }
}

document.addEventListener('DOMContentLoaded', () => new DashboardManager());