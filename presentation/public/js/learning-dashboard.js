/**
 * Logic for Student Learning Dashboard
 * Consumes /api/quiz/stats and renders personal progress charts.
 */

class LearningDashboard {
    constructor() {
        this.token = localStorage.getItem('authToken');
        if (!this.token) {
            window.location.href = '/login'; // Redirect if no auth
            return;
        }
        this.init();
    }

    async init() {
        try {
            const data = await this.fetchStats();
            this.renderKPIs(data);
            this.renderCharts(data);

            document.getElementById('loading').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        } catch (error) {
            console.error(error);
            document.getElementById('loading').innerHTML = `<p style="color:#ef4444">Error cargando métricas: ${error.message}</p>`;
        }
    }

    async fetchStats() {
        // Solicitamos contexto explícito de MEDICINA para aislar las estadísticas
        const res = await fetch('/api/quiz/stats?context=MEDICINA', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error('Error de servidor');
        return await res.json();
    }

    renderKPIs(data) {
        const q = data.quizzes;
        const f = data.flashcards;

        document.getElementById('kpi-avg').textContent = q.avgScore;
        document.getElementById('kpi-questions').textContent = q.totalQuestions;
        document.getElementById('kpi-games-sub').textContent = `en ${q.totalGames} simulacros`;

        document.getElementById('kpi-mastered').textContent = f.mastered;
        document.getElementById('kpi-due').textContent = f.due;
    }

    renderCharts(data) {
        this.renderHistoryChart(data.history);
        this.renderMasteryChart(data.flashcards);
    }

    renderHistoryChart(history) {
        const ctx = document.getElementById('chart-history').getContext('2d');

        // Data prep
        const labels = history.map(h => {
            const date = new Date(h.created_at);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        const scores = history.map(h => (h.score * 10.0 / h.total_questions).toFixed(1)); // Normalize to 10

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nota (0-10)',
                    data: scores,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderMasteryChart(flashcards) {
        const ctx = document.getElementById('chart-mastery').getContext('2d');

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Nuevas', 'Aprendiendo', 'Dominadas'],
                datasets: [{
                    data: [flashcards.new, flashcards.learning, flashcards.mastered],
                    backgroundColor: ['#64748b', '#f59e0b', '#22c55e'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1' }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LearningDashboard();
});
