/**
 * Simulator Dashboard Logic
 * Handles Context-Aware Stats Fetching
 */

const SimulatorDash = (() => {

    // Config
    const contexts = {
        'MEDICINA': {
            title: 'Medicina Humana',
            icon: '<i class="fas fa-heartbeat"></i>',
            quizParams: '?topic=Medicina%20General'
        },
        'INGLES': {
            title: 'Inglés Técnico',
            icon: '<i class="fas fa-language"></i>',
            quizParams: '?topic=Medical%20English' // Future
        }
    };

    let currentContext = 'MEDICINA'; // Default
    let activeConfig = null; // Stores user custom exam configuration

    // Exam Areas Data
    const examAreas = {
        'ENAM': ['Cardiología', 'Neumología', 'Gastroenterología', 'Nefrología', 'Neurología', 'Ginecología', 'Pediatría', 'Cirugía', 'Salud Pública'],
        'SERUMS': ['Salud Pública', 'Cuidado Integral', 'Ética e Interculturalidad', 'Investigación', 'Gestión de Servicios'],
        'ENARM': ['Cardiología', 'Neumología', 'Gastroenterología', 'Nefrología', 'Neurología', 'Reumatología', 'Infectología', 'Endocrinología', 'Ginecología', 'Pediatría', 'Cirugía General']
    };

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        currentContext = urlParams.get('context') || 'MEDICINA';

        // 1. Setup UI Context
        const ctxConfig = contexts[currentContext] || contexts['MEDICINA'];
        document.getElementById('ctx-title').textContent = ctxConfig.title;
        document.getElementById('ctx-icon').innerHTML = ctxConfig.icon;

        // 2. Setup Config Modal Logic
        setupConfigModal();

        // 3. Setup Links (Modes) with initial default
        updateModeLinks(ctxConfig);

        // Flashcard link will be dynamic based on System Deck ID

        // 4. Fetch Stats
        await loadStats();
        await loadEvolution();
    }

    function updateModeLinks(ctxConfig) {
        let baseParams = `${ctxConfig.quizParams}&context=${currentContext}`;

        // Append Custom Config if active
        if (activeConfig) {
            baseParams = `?target=${encodeURIComponent(activeConfig.target)}&difficulty=${encodeURIComponent(activeConfig.difficulty)}&areas=${encodeURIComponent(activeConfig.areas.join(','))}&context=${currentContext}`;
        }

        // 1. Arcade/Quick (10 questions)
        const btnArcade = document.getElementById('btn-mode-arcade');
        if (btnArcade) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnArcade.href = `quiz.html${baseParams}${separator}limit=10`;
        }

        // 2. Study Mode (20 questions)
        const btnStudy = document.getElementById('btn-mode-study');
        if (btnStudy) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnStudy.href = `quiz.html${baseParams}${separator}limit=20`;
        }

        // 3. Real Mock (100 questions - STRICTLY DB ONLY)
        const btnReal = document.getElementById('btn-mode-real');
        if (btnReal) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnReal.href = `quiz.html${baseParams}${separator}limit=100`;
        }
    }

    function setupConfigModal() {
        const modal = document.getElementById('config-modal-overlay');
        const btnOpen = document.getElementById('btn-start-config');
        const btnClose = document.getElementById('btn-close-config');
        const btnSave = document.getElementById('btn-save-config');
        const radioTargets = document.querySelectorAll('.exam-target-option input');
        const areasGrid = document.getElementById('config-areas-grid');
        const summaryBox = document.getElementById('active-config-summary');

        // Render Checkboxes dynamically
        const renderAreas = (target) => {
            areasGrid.innerHTML = '';
            const areas = examAreas[target] || [];
            areas.forEach(area => {
                const label = document.createElement('label');
                label.className = 'area-checkbox-label';
                label.innerHTML = `<input type="checkbox" value="${area}" checked> ${area}`;
                areasGrid.appendChild(label);
            });
        };

        // Open Modal
        if (btnOpen) {
            btnOpen.onclick = (e) => {
                e.preventDefault();
                console.log("Abriendo modal de configuración...");
                modal.classList.add('active'); // Mantiene consistencia con el dashboard.css si aplica
                modal.style.display = 'flex';
                modal.style.visibility = 'visible';
                modal.style.zIndex = '99999';
                modal.style.opacity = '1';

                // Trigger initial render safely
                const checkedEl = document.querySelector('.exam-target-option input:checked');
                const activeTarget = checkedEl ? checkedEl.value : 'ENAM';
                renderAreas(activeTarget);
            };
        }

        // Close Modal
        const closeModal = () => {
            modal.classList.remove('active');
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            setTimeout(() => { modal.style.display = 'none'; }, 300); // Transition buffer
        };
        if (btnClose) btnClose.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); }

        // Change Target Event
        radioTargets.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) renderAreas(e.target.value);
            });
        });

        // Save Config
        if (btnSave) {
            btnSave.onclick = () => {
                const target = document.querySelector('.exam-target-option input:checked').value;
                const difficulty = document.getElementById('config-difficulty').value;
                const selectedAreas = Array.from(areasGrid.querySelectorAll('input:checked')).map(cb => cb.value);

                if (selectedAreas.length === 0) {
                    alert('Debes seleccionar al menos un área de estudio.');
                    return;
                }

                activeConfig = { target, difficulty, areas: selectedAreas };

                // Update UI Summary
                summaryBox.style.display = 'flex';
                summaryBox.innerHTML = `
                    <i class="fas fa-filter"></i> 
                    <span><strong>Filtro Activo:</strong> ${target} | ${difficulty} | ${selectedAreas.length} áreas seleccionadas</span>
                `;

                // Update Links
                updateModeLinks(contexts[currentContext] || contexts['MEDICINA']);

                closeModal();
            };
        }
    }


    async function loadEvolution() {
        const token = localStorage.getItem('authToken');
        try {
            const res = await fetch(`/api/quiz/evolution?context=${currentContext}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success && data.chart.labels.length > 0) {
                const ctx = document.getElementById('evolutionChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.chart.labels,
                        datasets: [{
                            label: 'Puntaje (Base 20)',
                            data: data.chart.scores,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            pointBackgroundColor: '#60a5fa',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: { color: '#cbd5e1' }
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 20,
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                ticks: { color: '#94a3b8' },
                                title: {
                                    display: true,
                                    text: 'Nota (0-20)',
                                    color: '#64748b'
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#94a3b8' },
                                title: {
                                    display: true,
                                    text: 'Intentos Recientes',
                                    color: '#64748b'
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error rendering chart:', error);
        }
    }

    // Store KPI data for AI analysis
    let cachedStats = null;

    async function loadStats() {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            // Fetch Optimized Summary
            const res = await fetch(`/api/quiz/stats?context=${currentContext}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            cachedStats = data.kpis; // Store for AI Analysis

            // Render Stats
            const kpis = data.kpis;
            document.getElementById('stat-score').textContent = kpis.avg_score || '0.0';
            document.getElementById('stat-accuracy').textContent = `${Math.round(kpis.accuracy || 0)}%`;
            document.getElementById('stat-counts-text').textContent = `${kpis.total_correct || 0} correctas / ${kpis.total_incorrect || 0} incorrectas`;
            document.getElementById('stat-mastery').textContent = kpis.mastered_cards || 0;

            // Setup Flashcard Link
            if (kpis.system_deck_id) {
                const btnFlash = document.getElementById('btn-flashcards');
                if (btnFlash) btnFlash.href = `repaso.html?deckId=${kpis.system_deck_id}`;
            }

            // --- Render Radar Chart (Áreas) ---
            if (kpis.radar_data && kpis.radar_data.length > 0) {
                document.getElementById('radar-empty-state').style.display = 'none';
                const radarCanvas = document.getElementById('radarChart');
                radarCanvas.style.display = 'block';

                const radarLabels = kpis.radar_data.map(d => d.subject);
                const radarDataPts = kpis.radar_data.map(d => d.accuracy);

                new Chart(radarCanvas.getContext('2d'), {
                    type: 'radar',
                    data: {
                        labels: radarLabels,
                        datasets: [{
                            label: 'Precisión %',
                            data: radarDataPts,
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: '#3b82f6',
                            pointBackgroundColor: '#60a5fa',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#3b82f6'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                beginAtZero: true,
                                max: 100,
                                ticks: { display: false, stepSize: 20 },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                pointLabels: { color: '#cbd5e1', font: { size: 11 } },
                                angleLines: { color: 'rgba(255, 255, 255, 0.1)' }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }

            // Ocultar Loading
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'block';

        } catch (error) {
            console.error(error);
            // Even on error, reveal dashboard to not block user interactions
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'block';
        }
    }

    // AI Analysis Handler
    function setupAIAnalysis() {
        const btnAnalyze = document.getElementById('btn-analyze-ai');
        const btnAgain = document.getElementById('btn-analyze-again');
        const stateInitial = document.getElementById('ai-initial-state');
        const stateLoading = document.getElementById('ai-loading-state');
        const stateResults = document.getElementById('ai-results-state');

        const runAnalysis = () => {
            // UI Transitions
            stateInitial.style.display = 'none';
            stateResults.style.display = 'none';
            stateLoading.style.display = 'flex';

            // Simulate "Thinking" (or call real AI endpoint later)
            setTimeout(() => {
                stateLoading.style.display = 'none';
                stateResults.style.display = 'block';

                // Populate Logic (Using cached stats for now)
                if (cachedStats) {
                    const strong = cachedStats.strongest_topic || 'No hay suficientes datos';
                    const weak = cachedStats.weakest_topic || 'No hay suficientes datos';

                    document.getElementById('ai-strengths').innerHTML =
                        `Has demostrado un dominio sólido en <strong>${strong}</strong>. Sigue manteniendo este nivel.`;

                    document.getElementById('ai-weaknesses').innerHTML =
                        `Detectamos oportunidades de mejora en <strong>${weak}</strong>. Te recomendamos enfocar tus próximas sesiones de estudio aquí.`;
                }
            }, 1500); // 1.5s delay for effect
        }

        if (btnAnalyze) btnAnalyze.addEventListener('click', runAnalysis);
        if (btnAgain) btnAgain.addEventListener('click', runAnalysis);
    }

    // Modify init to call setupAIAnalysis
    const originalInit = init;
    init = async function () {
        await originalInit.apply(this, arguments); // Call original items (loadStats, loadEvolution)
        setupAIAnalysis(); // Setup handlers
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', SimulatorDash.init);
