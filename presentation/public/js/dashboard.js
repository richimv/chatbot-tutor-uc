class DashboardManager {
    constructor() {
        this.apiUrl = '/api/admin/dashboard-stats';
        this.aiUrl = '/api/admin/run-ai'; // Endpoint para activar Python
        this.charts = {}; // Store chart instances
        this.token = localStorage.getItem('authToken');

        // Verificar autenticación antes de iniciar
        if (!this.token) {
            window.location.href = '/login';
            return;
        }

        this.init();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Configurar el botón "Actualizar IA"
        const btnUpdate = document.getElementById('btn-update-ai');
        if (btnUpdate) {
            btnUpdate.addEventListener('click', (e) => {
                e.preventDefault();
                this.triggerAiUpdate(btnUpdate);
            });
        }
    }

    async init() {
        try {
            const data = await this.fetchData();

            // 1. Renderizar KPIs
            this.renderKPIs(data.kpi);

            // 2. Renderizar Gráficos
            this.renderCharts(data.charts);

            // 3. Renderizar IA (Nuevo)
            this.renderAiSection(data.ai);

            // Mostrar contenido, ocultar loader
            document.getElementById('loading').style.display = 'none';
            document.getElementById('main-content').style.display = 'block'; // Usar 'block' es más seguro para layout general
        } catch (error) {
            console.error('Fatal Error:', error);
            document.getElementById('loading').innerHTML = `
                <div style="text-align: center; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p style="margin-top: 1rem;">Error cargando datos: ${error.message}</p>
                    <button onclick="window.location.reload()" class="btn" style="margin-top:1rem">Reintentar</button>
                </div>
            `;
        }
    }

    async fetchData() {
        const [statsRes, realTimeRes] = await Promise.all([
            fetch(this.apiUrl, { headers: { 'Authorization': `Bearer ${this.token}` } }),
            fetch('/api/analytics/real-time', { headers: { 'Authorization': `Bearer ${this.token}` } })
        ]);

        if (!statsRes.ok || !realTimeRes.ok) {
            if (statsRes.status === 401) window.location.href = '/login';
            throw new Error(`API Error ${statsRes.status}`);
        }

        const stats = await statsRes.json();
        const realTime = await realTimeRes.json();

        return { ...stats, realTime };
    }

    renderKPIs(data) {
        // data ya viene mergeado con kpi y realTime
        const kpi = data.kpi || data; // Manejo flexible si la estructura cambia
        
        this.animateValue('kpi-users', kpi.totalUsers || 0);
        this.animateValue('kpi-premium', kpi.premiumUsers || 0);
        this.animateValue('kpi-searches', kpi.totalSearches || 0);
        this.animateValue('kpi-chat', kpi.totalChatMessages || 0);

        // NUEVOS KPIs
        if (data.realTime) {
            this.animateValue('kpi-live', data.realTime.activeNow || 0);
        }
        if (kpi.uniqueVisitors !== undefined) {
            this.animateValue('kpi-daily-visitors', kpi.uniqueVisitors || 0);
        }
    }

    animateValue(id, value) {
        const obj = document.getElementById(id);
        if (!obj) return;
        obj.textContent = new Intl.NumberFormat('es-PE').format(value); // Formato local Perú
    }

    renderCharts(data) {
        // Destruir gráficos anteriores si existen (para evitar superposiciones al recargar)
        // Nota: Chart.js maneja instancias en el canvas. En esta versión simple asumimos carga única.
        this.createBarChart('chart-courses', data.topCourses, 'Cursos Populares', '#3b82f6');
        this.createBarChart('chart-books', data.topBooks, 'Libros Populares', '#10b981');
    }

    renderAiSection(aiData) {
        const container = document.getElementById('ai-insights-container');
        if (!container) return;

        // Si no hay data de nada
        if (!aiData) {
            container.innerHTML = `
                <div class="ai-loading-card">
                    <i class="fas fa-robot"></i> Sin análisis reciente.
                    <br><small style="color: #64748b;">Haz clic en "Actualizar IA" para generar predicciones.</small>
                </div>`;
            return;
        }

        // Helper para generar tarjeta
        const createCard = (title, icon, pred, typeIcon) => {
            // Detectar nombre de predicción en cualquiera de las llaves posibles
            const predictionName = pred ? (pred.predictedCourse || pred.predictedBook || pred.predictedResource) : null;

            if (!predictionName) {
                // Tarjeta vacía/placeholder
                return `
                <div class="ai-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; opacity:0.7;">
                   <div style="font-size:3rem; margin-bottom:1rem; color:#334155;">${typeIcon}</div>
                   <div style="color:#64748b;">Sin suficientes datos para ${title}</div>
                </div>`;
            }

            const confidencePercent = Math.round(pred.confidence * 100);

            return `
            <div class="ai-card">
                <div class="ai-header">
                    <div class="ai-title"><i class="${icon}"></i> ${title}</div>
                    <div style="color: #94a3b8; font-size: 0.75rem;">
                        Basado en ${pred.searchCount || 0} búsquedas
                    </div>
                </div>
                
                <div class="ai-prediction">
                    ${typeIcon} ${predictionName}
                </div>
                
                <div class="ai-reason">
                    "${pred.reason}"
                </div>

                <div class="confidence-section" style="margin-top:auto;">
                    <div style="display:flex; justify-content:space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 5px;">
                        <span>Confianza</span>
                        <span>${confidencePercent}%</span>
                    </div>
                    <div class="confidence-bar-bg">
                        <div class="confidence-bar-fill" style="width: ${confidencePercent}%"></div>
                    </div>
                </div>
            </div>
            `;
        };

        const courseCard = createCard('Curso Tendencia', 'fas fa-graduation-cap', aiData.course_prediction, '🚀');
        const bookCard = createCard('Libro Tendencia', 'fas fa-book', aiData.book_prediction, '📚');

        container.innerHTML = `<div class="ai-grid">${courseCard}${bookCard}</div>`;
    }

    async triggerAiUpdate(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analizando...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            const res = await fetch(this.aiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.ok) {
                // Recargar todo el dashboard para ver los nuevos datos
                await this.init();
                alert('¡Análisis de IA completado exitosamente!');
            } else {
                const err = await res.json();
                alert('Error: ' + (err.error || 'Falló el análisis'));
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión con el servidor de IA.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }



    createBarChart(canvasId, items, label, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const ctx = canvas.getContext('2d');

        // Handle Empty Data
        if (!items || items.length === 0) {
            return;
        }

        const labels = items.map(i => i.name.length > 25 ? i.name.substring(0, 25) + '...' : i.name);
        const values = items.map(i => parseInt(i.visits));

        // Save new instance
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Visitas',
                    data: values,
                    backgroundColor: color,
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#f8fafc', font: { size: 12 } }
                    }
                }
            }
        });
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});