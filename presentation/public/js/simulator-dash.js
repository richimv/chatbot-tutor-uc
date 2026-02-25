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
    let lineChartInst = null;
    let radarChartInst = null;

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

        // 2. Setup Config Modal Logic & Load Persistent Config
        setupConfigModal();

        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const res = await fetch(`/api/users/preferences?domain=${currentContext.toLowerCase()}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const prefData = await res.json();
                    if (prefData && prefData.data) {
                        activeConfig = prefData.data;
                        localStorage.setItem('simActiveConfig', JSON.stringify(activeConfig));
                    }
                } else {
                    // API not available — use localStorage fallback silently
                    const savedConfig = localStorage.getItem('simActiveConfig');
                    if (savedConfig) activeConfig = JSON.parse(savedConfig);
                }

                const summaryBox = document.getElementById('active-config-summary');
                if (summaryBox && activeConfig) {
                    summaryBox.style.display = 'flex';
                    summaryBox.innerHTML = `
                        <i class="fas fa-filter"></i> 
                        <span><strong>Filtro Recuperado:</strong> ${activeConfig.target} | ${activeConfig.difficulty} | ${activeConfig.areas ? activeConfig.areas.length : 0} áreas</span>
                    `;
                }
            } catch (e) {
                console.warn("Config API not available, using localStorage fallback.");
                const savedConfig = localStorage.getItem('simActiveConfig');
                if (savedConfig) {
                    try { activeConfig = JSON.parse(savedConfig); } catch (pe) { }
                }
            }
        }

        // 3. Setup Links (Modes) with initial default
        updateModeLinks(ctxConfig);

        // 3.5 FREEMIUM: Lock simulator modes for non-premium users
        applyFreemiumLocks();

        // Also listen for session changes (handles race condition with async session init)
        if (window.sessionManager) {
            window.sessionManager.onStateChange(() => applyFreemiumLocks());
        }

        // Flashcard link will be dynamic based on System Deck ID

        // 4. Fetch Stats (with graceful error handling for missing APIs)
        await loadStats();
        await loadEvolution();
    }

    /**
     * FREEMIUM: Lock ALL simulator modes for non-premium users.
     * Premium = subscriptionStatus 'active' OR role 'admin'.
     */
    function applyFreemiumLocks() {
        if (!window.sessionManager) return;
        const user = window.sessionManager.getUser();
        if (!user) return; // Not logged in yet or visitor

        const status = user.subscriptionStatus || user.subscription_status;
        const isPremium = status === 'active' || user.role === 'admin';

        // Only apply locks for non-premium logged-in users
        if (isPremium) return;

        // Lock ALL 3 simulator modes
        const modeIds = ['btn-mode-arcade', 'btn-mode-study', 'btn-mode-real'];

        modeIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn || btn.classList.contains('locked')) return; // Skip if already locked

            btn.classList.add('locked');
            btn.removeAttribute('href');
            btn.style.cursor = 'pointer';

            // Add Premium badge
            const badge = document.createElement('span');
            badge.className = 'mode-badge premium-lock-badge';
            badge.innerHTML = '<i class="fas fa-lock"></i> Premium';
            btn.appendChild(badge);

            // Intercept click → paywall
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.uiManager && window.uiManager.showPaywallModal) {
                    window.uiManager.showPaywallModal();
                } else {
                    window.location.href = '/pricing';
                }
            });
        });
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
            btnArcade.href = `/quiz${baseParams}${separator}limit=10`;
        }

        // 2. Study Mode (20 questions)
        const btnStudy = document.getElementById('btn-mode-study');
        if (btnStudy) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnStudy.href = `/quiz${baseParams}${separator}limit=20`;
        }

        // 3. Real Mock (100 questions - STRICTLY DB ONLY)
        const btnReal = document.getElementById('btn-mode-real');
        if (btnReal) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnReal.href = `/quiz${baseParams}${separator}limit=100`;
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

                let isChecked = true;
                if (activeConfig && activeConfig.target === target && activeConfig.areas) {
                    isChecked = activeConfig.areas.includes(area);
                }

                label.innerHTML = `<input type="checkbox" value="${area}" ${isChecked ? 'checked' : ''}> ${area}`;
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
                let activeTarget = 'ENAM';
                if (activeConfig) {
                    activeTarget = activeConfig.target || 'ENAM';

                    // Set Target Radio
                    const targetRadio = document.querySelector(`.exam-target-option input[value="${activeTarget}"]`);
                    if (targetRadio) targetRadio.checked = true;

                    // Set Difficulty Select
                    const diffSelect = document.getElementById('config-difficulty');
                    if (diffSelect && activeConfig.difficulty) {
                        diffSelect.value = activeConfig.difficulty;
                    }
                } else {
                    const checkedEl = document.querySelector('.exam-target-option input:checked');
                    if (checkedEl) activeTarget = checkedEl.value;
                }

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
            btnSave.onclick = async () => {
                const target = document.querySelector('.exam-target-option input:checked').value;
                const difficulty = document.getElementById('config-difficulty').value;
                const selectedAreas = Array.from(areasGrid.querySelectorAll('input:checked')).map(cb => cb.value);

                if (selectedAreas.length === 0) {
                    alert('Debes seleccionar al menos un área de estudio.');
                    return;
                }

                // Show basic loading state on button
                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                btnSave.disabled = true;

                activeConfig = { target, difficulty, areas: selectedAreas };
                localStorage.setItem('simActiveConfig', JSON.stringify(activeConfig)); // Persist locally

                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        // Persist to Database for Cross-Device Sync
                        await fetch('/api/users/preferences', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                domain: currentContext.toLowerCase(),
                                config_json: activeConfig
                            })
                        });
                    } catch (err) {
                        console.error("Error saving preferences to backend", err);
                    }
                }

                btnSave.innerHTML = originalText;
                btnSave.disabled = false;

                // Update UI Summary
                summaryBox.style.display = 'flex';
                summaryBox.innerHTML = `
                    <i class="fas fa-filter"></i> 
                    <span><strong>Filtro Activo:</strong> ${target} | ${difficulty} | ${selectedAreas.length} áreas seleccionadas</span>
                `;

                // Update Links
                updateModeLinks(contexts[currentContext] || contexts['MEDICINA']);

                // Relanzar fetch a base de datos de inmediato con nuevo target
                loadStats();
                loadEvolution();

                closeModal();
            };
        }
    }


    async function loadEvolution() {
        const token = localStorage.getItem('authToken');
        try {
            let qs = `?context=${currentContext}`;
            if (activeConfig && activeConfig.target) qs += `&target=${encodeURIComponent(activeConfig.target)}`;

            const res = await fetch(`/api/quiz/evolution${qs}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return; // API not available, skip silently
            const data = await res.json();

            if (lineChartInst) lineChartInst.destroy();

            if (data.success && data.chart.labels.length > 0) {
                const ctx = document.getElementById('evolutionChart').getContext('2d');
                lineChartInst = new Chart(ctx, {
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

        try {
            if (!token) return;

            // Fetch Optimized Summary
            let qs = `?context=${currentContext}`;
            if (activeConfig && activeConfig.target) qs += `&target=${encodeURIComponent(activeConfig.target)}`;

            const res = await fetch(`/api/quiz/stats${qs}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return; // API not available, skip silently
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
                if (btnFlash) btnFlash.href = `/repaso?deckId=${kpis.system_deck_id}`;
            }

            // --- Render Radar Chart (Áreas) ---
            if (radarChartInst) radarChartInst.destroy();

            if (kpis.radar_data && kpis.radar_data.length > 0) {
                document.getElementById('radar-empty-state').style.display = 'none';
                const radarCanvas = document.getElementById('radarChart');
                radarCanvas.style.display = 'block';

                // 🧹 Sanitizar y agrupar historial viejo corrupto
                const cleanRadarMap = {};
                kpis.radar_data.forEach(d => {
                    let cleanSubject = d.subject || 'General';
                    if (cleanSubject.includes(',')) cleanSubject = cleanSubject.split(',')[0].trim();

                    if (!cleanRadarMap[cleanSubject]) {
                        cleanRadarMap[cleanSubject] = { correct: 0, total: 0 };
                    }

                    const safeTotal = parseInt(d.total || 0, 10);
                    const rawCorrect = (d.correct !== undefined) ? parseInt(d.correct, 10) : Math.round((d.accuracy / 100) * safeTotal);
                    cleanRadarMap[cleanSubject].correct += rawCorrect;
                    cleanRadarMap[cleanSubject].total += safeTotal;
                });

                const radarLabels = Object.keys(cleanRadarMap);
                const radarDataPts = radarLabels.map(subject =>
                    Math.round((cleanRadarMap[subject].correct / cleanRadarMap[subject].total) * 100) || 0
                );

                radarChartInst = new Chart(radarCanvas.getContext('2d'), {
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

        } catch (error) {
            console.warn('Stats not available:', error.message);
        } finally {
            // ALWAYS reveal dashboard content, even if API fails
            const loadingEl = document.getElementById('loading');
            const contentEl = document.getElementById('dashboard-content');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
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
