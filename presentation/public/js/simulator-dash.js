/**
 * Simulator Dashboard Logic
 * Handles Context-Aware Stats Fetching
 */

const SimulatorDash = (() => {

    // Config
    const contexts = {
        'MEDICINA': {
            title: 'Ciencias de la Salud',
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

    // Exam Areas Data — Grouped by category (identical for all targets)
    const examAreasGrouped = [
        {
            label: 'Ciencias Básicas',
            areas: ['Anatomía', 'Fisiología', 'Farmacología', 'Microbiología y Parasitología']
        },
        {
            label: 'Las 4 Grandes',
            areas: ['Medicina Interna', 'Pediatría', 'Ginecología y Obstetricia', 'Cirugía General']
        },
        {
            label: 'Especialidades Clínicas',
            areas: ['Cardiología', 'Gastroenterología', 'Neurología', 'Nefrología', 'Neumología', 'Endocrinología', 'Infectología', 'Reumatología', 'Traumatología']
        },
        {
            label: 'Salud Pública y Gestión',
            areas: ['Salud Pública y Epidemiología', 'Gestión de Servicios de Salud', 'Ética Deontología e Interculturalidad', 'Medicina Legal', 'Investigación y Bioestadística', 'Cuidado Integral']
        }
    ];

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        currentContext = urlParams.get('context') || 'MEDICINA';

        // 1. Setup UI Context
        const ctxConfig = contexts[currentContext] || contexts['MEDICINA'];
        const titleEl = document.getElementById('ctx-title');
        const iconEl = document.getElementById('ctx-icon');

        if (titleEl) titleEl.textContent = ctxConfig.title;
        if (iconEl) iconEl.innerHTML = ctxConfig.icon;

        // 2. Setup Config Modal Logic & Load Persistent Config
        setupConfigModal();

        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                // Fetch preferences from API instead of localStorage
                const res = await fetch(`${window.AppConfig.API_URL}/api/users/preferences?domain=${currentContext.toLowerCase()}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const prefData = await res.json();

                if (prefData && prefData.data) {
                    activeConfig = prefData.data;
                    // Keep localStorage in sync for legacy code
                    localStorage.setItem('simActiveConfig', JSON.stringify(activeConfig));
                } else {
                    // Fallback to localStorage if API has nothing
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
                console.error("Error loading saved config from API", e);
            }
        }

        // 3. Setup Links (Modes) with initial default
        updateModeLinks(ctxConfig);
        bindModeClicks();

        // 4. Fetch Stats or Demo Data
        if (token) {
            await loadStats();
            await loadEvolution();
        } else {
            console.log("👤 Modo Invitado: Usando datos de demostración estáticos.");
            renderGuestDemoData();
        }

        // 5. Tooltip para usuarios nuevos sin configuración
        if (!activeConfig) showFirstVisitTip();
    }

    function showFirstVisitTip() {
        const btn = document.getElementById('btn-start-config');
        if (!btn) return;

        // --- NEON PULSE: Persiste hasta que el usuario guarde una configuración ---
        const pulseStyle = document.createElement('style');
        pulseStyle.id = 'neon-pulse-style';
        pulseStyle.textContent = `
            @keyframes neonPulse {
                0%, 100% { box-shadow: 0 0 5px rgba(96,165,250,0.4), 0 0 15px rgba(96,165,250,0.15); }
                50%      { box-shadow: 0 0 12px rgba(96,165,250,0.7), 0 0 30px rgba(96,165,250,0.25), 0 0 4px rgba(96,165,250,0.5) inset; }
            }
            #btn-start-config.neon-active {
                animation: neonPulse 2s ease-in-out infinite;
                border-color: rgba(96,165,250,0.5) !important;
            }
        `;
        document.head.appendChild(pulseStyle);
        btn.classList.add('neon-active');

        // --- TOOLTIP: Solo se muestra una vez, 15 segundos ---
        if (localStorage.getItem('hasSeenConfigTip')) return;

        const tip = document.createElement('div');
        tip.id = 'config-tip';
        tip.innerHTML = `
            <style>
                #config-tip {
                    position: absolute;
                    top: calc(100% + 12px);
                    right: 0;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(96, 165, 250, 0.3);
                    border-radius: 14px;
                    padding: 0.9rem 1.1rem;
                    color: #e2e8f0;
                    font-size: 0.82rem;
                    line-height: 1.5;
                    width: 240px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(96,165,250,0.1);
                    z-index: 100;
                    animation: tipFadeIn 0.5s ease-out;
                }
                #config-tip::before {
                    content: '';
                    position: absolute;
                    top: -7px;
                    right: 24px;
                    width: 12px;
                    height: 12px;
                    background: rgba(15, 23, 42, 0.95);
                    border-top: 1px solid rgba(96, 165, 250, 0.3);
                    border-left: 1px solid rgba(96, 165, 250, 0.3);
                    transform: rotate(45deg);
                }
                #config-tip .tip-icon { color: #60a5fa; margin-right: 4px; }
                @keyframes tipFadeIn {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            </style>
            <i class="fas fa-lightbulb tip-icon"></i>
            <strong>Tip:</strong> Personaliza tu examen eligiendo tipo (ENAM, SERUMS, Residentado), áreas clínicas y dificultad.
        `;

        btn.parentElement.style.position = 'relative';
        btn.parentElement.appendChild(tip);

        const dismissTip = () => {
            if (!document.getElementById('config-tip')) return;
            tip.style.animation = 'tipFadeIn 0.3s ease-out reverse forwards';
            setTimeout(() => tip.remove(), 300);
            localStorage.setItem('hasSeenConfigTip', 'true');
        };

        // Auto-dismiss after 15 seconds
        setTimeout(dismissTip, 15000);
        // Also dismiss when clicking the config button
        btn.addEventListener('click', dismissTip, { once: true });
    }

    function updateModeLinks(ctxConfig) {
        const token = localStorage.getItem('authToken');
        let baseParams = `${ctxConfig.quizParams}&context=${currentContext}`;

        // Append Custom Config if active
        if (activeConfig) {
            baseParams = `?target=${encodeURIComponent(activeConfig.target)}&difficulty=${encodeURIComponent(activeConfig.difficulty)}&areas=${encodeURIComponent(activeConfig.areas.join(','))}&context=${currentContext}`;
            if (activeConfig.target === 'SERUMS' && activeConfig.career) {
                baseParams += `&career=${encodeURIComponent(activeConfig.career)}`;
            }
        }

        // 1. Arcade/Quick (10 questions)
        const btnArcade = document.getElementById('btn-mode-arcade');
        if (btnArcade) {
            const separator = baseParams.includes('?') ? '&' : '?';
            const demoFlag = !token ? '&demo=true' : '';
            btnArcade.href = `quiz${baseParams}${separator}limit=10${demoFlag}`;
        }

        // 2. Study Mode (20 questions)
        const btnStudy = document.getElementById('btn-mode-study');
        if (btnStudy) {
            const separator = baseParams.includes('?') ? '&' : '?';
            const demoFlag = !token ? '&demo=true' : '';
            btnStudy.href = `quiz${baseParams}${separator}limit=20${demoFlag}`;
        }

        // 3. Real Mock (100 questions - STRICTLY DB ONLY)
        const btnReal = document.getElementById('btn-mode-real');
        if (btnReal) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnReal.href = `quiz${baseParams}${separator}limit=100`;
        }
    }

    /**
     * Intercept clicks on mode buttons to validate freemium limits
     */
    function bindModeClicks() {
        const ids = ['btn-mode-arcade', 'btn-mode-study', 'btn-mode-real', 'btn-flashcards'];
        ids.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    const token = localStorage.getItem('authToken');

                    // 1. Visitante check (Redirección Únete)
                    if (!token && window.uiManager) {
                        // EXCEPCIÓN: Permitir Modo Rápido (Arcade) para Invitados con LÍMITE
                        const isArcade = id === 'btn-mode-arcade';

                        if (isArcade) {
                            const sessionsSent = parseInt(localStorage.getItem('demo_sessions_count') || '0');
                            if (sessionsSent >= 3) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.uiManager.showAuthPromptModal();
                                return;
                            }
                        } else {
                            // Para cualquier otro modo (Estudio, Real, Flashcards) - Bloquear directo
                            e.preventDefault();
                            e.stopPropagation();
                            window.uiManager.showAuthPromptModal();
                            return;
                        }
                    }

                    // 2. Block disabled modes
                    if (btn.classList.contains('mode-card--disabled')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }

                    if (window.uiManager && typeof window.uiManager.validateFreemiumAction === 'function') {
                        // Returns false and calls showPaywallModal() if limit reached
                        window.uiManager.validateFreemiumAction(e);
                    }
                });
            }
        });
    }

    function setupConfigModal() {
        const modal = document.getElementById('config-modal-overlay');
        const btnOpen = document.getElementById('btn-start-config');
        const btnClose = document.getElementById('btn-close-config');
        const btnSave = document.getElementById('btn-save-config');
        const radioTargets = document.querySelectorAll('.exam-target-option input');
        const areasGrid = document.getElementById('config-areas-grid');
        const summaryBox = document.getElementById('active-config-summary');

        if (!modal || !btnOpen || !areasGrid) return; // Guard for non-dashboard pages

        // Render grouped checkboxes with sub-headers
        const renderAreas = (target) => {
            areasGrid.innerHTML = '';
            areasGrid.style.display = 'flex';
            areasGrid.style.flexDirection = 'column';
            areasGrid.style.gap = '1rem';

            examAreasGrouped.forEach(group => {
                // Group header
                const header = document.createElement('div');
                header.style.cssText = 'font-size:0.75rem; color:#60a5fa; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; margin-top:0.25rem; padding-bottom:0.3rem; border-bottom:1px solid rgba(96,165,250,0.15);';
                header.textContent = group.label;
                areasGrid.appendChild(header);

                // Checkbox grid for this group
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;';

                group.areas.forEach(area => {
                    const label = document.createElement('label');
                    label.className = 'area-checkbox-label';

                    let isChecked = true;
                    if (activeConfig && activeConfig.target === target && activeConfig.areas) {
                        isChecked = activeConfig.areas.includes(area);
                    }

                    label.innerHTML = `<input type="checkbox" value="${area}" ${isChecked ? 'checked' : ''}> ${area}`;
                    grid.appendChild(label);
                });

                areasGrid.appendChild(grid);
            });
        };

        // Open Modal
        if (btnOpen) {
            btnOpen.onclick = (e) => {
                const token = localStorage.getItem('authToken');
                if (!token && window.uiManager) {
                    window.uiManager.showAuthPromptModal();
                    return;
                }

                e.preventDefault();
                console.log("Abriendo modal de configuración...");
                modal.classList.add('active'); // Mantiene consistencia con el dashboard.css si aplica
                modal.style.display = 'flex';
                modal.style.visibility = 'visible';
                modal.style.zIndex = '99999';
                modal.style.opacity = '1';

                if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
                    window.uiManager.pushModalState('config-modal-overlay');
                }

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

                const serumsInfo = document.getElementById('serums-info-alert');
                if (serumsInfo) serumsInfo.style.display = activeTarget === 'SERUMS' ? 'block' : 'none';

                const careerBox = document.getElementById('serums-career-container');
                if (careerBox) careerBox.style.display = activeTarget === 'SERUMS' ? 'block' : 'none';

                const careerSelect = document.getElementById('config-career');
                if (activeConfig && activeConfig.career && careerSelect) {
                    careerSelect.value = activeConfig.career;
                }

                renderAreas(activeTarget);
            };
        }

        // Close Modal
        const closeModal = () => {
            if (window.uiManager && typeof window.uiManager.popModalState === 'function') {
                window.uiManager.popModalState('config-modal-overlay');
            }
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
                if (e.target.checked) {
                    const t = e.target.value;
                    const serumsInfo = document.getElementById('serums-info-alert');
                    if (serumsInfo) serumsInfo.style.display = t === 'SERUMS' ? 'block' : 'none';
                    const careerBox = document.getElementById('serums-career-container');
                    if (careerBox) careerBox.style.display = t === 'SERUMS' ? 'block' : 'none';

                    // Lógica Automática de Selección
                    let defaultAreas = [];
                    if (t === 'ENAM') {
                        // Grupos B, C, D
                        defaultAreas = examAreasGrouped.filter(g => g.label !== 'Ciencias Básicas').flatMap(g => g.areas);
                        document.getElementById('config-difficulty').value = 'Intermedio';
                    } else if (t === 'SERUMS') {
                        // Solo Grupo D
                        defaultAreas = examAreasGrouped.find(g => g.label === 'Salud Pública y Gestión').areas;
                        document.getElementById('config-difficulty').value = 'Básico'; // Sugerido
                    } else if (t === 'RESIDENTADO') {
                        // Todos (A, B, C, D)
                        defaultAreas = examAreasGrouped.flatMap(g => g.areas);
                        document.getElementById('config-difficulty').value = 'Avanzado';
                    }

                    if (activeConfig) {
                        activeConfig.target = t;
                        activeConfig.areas = defaultAreas;
                    } else {
                        activeConfig = { target: t, areas: defaultAreas };
                    }
                    renderAreas(t);
                }
            });
        });

        // Save Config
        if (btnSave) {
            btnSave.onclick = async () => {
                const target = document.querySelector('.exam-target-option input:checked').value;
                const difficulty = document.getElementById('config-difficulty').value;
                const selectedAreas = Array.from(areasGrid.querySelectorAll('input:checked')).map(cb => cb.value);
                const careerSelectEl = document.getElementById('config-career');
                const career = target === 'SERUMS' && careerSelectEl ? careerSelectEl.value : null;

                if (selectedAreas.length === 0) {
                    alert('Debes seleccionar al menos un área de estudio.');
                    return;
                }

                // Show basic loading state on button
                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                btnSave.disabled = true;

                activeConfig = { target, difficulty, areas: selectedAreas, career };
                localStorage.setItem('simActiveConfig', JSON.stringify(activeConfig)); // Persist locally

                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        // Persist to Database for Cross-Device Sync
                        await fetch(`${window.AppConfig.API_URL}/api/users/preferences`, {
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

                // Quitar efecto neón — ya configuró
                const cfgBtn = document.getElementById('btn-start-config');
                if (cfgBtn) cfgBtn.classList.remove('neon-active');

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

            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${window.AppConfig.API_URL}/api/quiz/evolution${qs}`, {
                headers
            });
            const data = await res.json();

            if (lineChartInst) lineChartInst.destroy();

            if (data.success && data.chart && data.chart.labels && data.chart.labels.length > 0) {
                const evoCanvas = document.getElementById('evolutionChart');
                if (!evoCanvas) return; // Guard for non-dashboard pages

                const evolutionCtx = evoCanvas.getContext('2d');
                lineChartInst = new Chart(evolutionCtx, {
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
            // Fetch Optimized Summary
            let qs = `?context=${currentContext}`;
            if (activeConfig && activeConfig.target) qs += `&target=${encodeURIComponent(activeConfig.target)}`;

            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${window.AppConfig.API_URL}/api/quiz/stats${qs}`, {
                headers
            });
            const data = await res.json();
            cachedStats = data.kpis; // Store for AI Analysis

            // Render Stats
            const kpis = data.kpis;
            const scoreEl = document.getElementById('stat-score');
            const accuracyEl = document.getElementById('stat-accuracy');
            const countsEl = document.getElementById('stat-counts-text');
            const masteryEl = document.getElementById('stat-mastery');

            if (scoreEl) scoreEl.textContent = kpis.avg_score || '0.0';
            if (accuracyEl) accuracyEl.textContent = `${Math.round(kpis.accuracy || 0)}%`;
            if (countsEl) countsEl.textContent = `${kpis.total_correct || 0} correctas / ${kpis.total_incorrect || 0} incorrectas`;
            if (masteryEl) masteryEl.textContent = kpis.mastered_cards || 0;

            // Setup Flashcard Link
            if (kpis.system_deck_id) {
                const btnFlash = document.getElementById('btn-flashcards');
                if (btnFlash) btnFlash.href = `repaso?deckId=${kpis.system_deck_id}`;
            }

            // --- Render Radar Chart (Áreas) ---
            if (radarChartInst) radarChartInst.destroy();

            if (kpis.radar_data && kpis.radar_data.length > 0) {
                const emptyState = document.getElementById('radar-empty-state');
                const radarCanvas = document.getElementById('radarChart');

                if (emptyState) emptyState.style.display = 'none';
                if (radarCanvas) {
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
            }

            // Ocultar Loading
            const loadingEl = document.getElementById('loading');
            const contentEl = document.getElementById('dashboard-content');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';

            // ✅ GUEST BANNER: If logged as guest, show a call to action
            if (kpis.isGuest) {
                renderGuestBanner();
            }

        } catch (error) {
            console.error(error);
            // Even on error, reveal dashboard to not block user interactions
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

        if (!btnAnalyze || !stateInitial) return; // Guard for non-dashboard pages

        const runAnalysis = async (e) => {
            // ✅ Interceptar con Paywall si no tiene vidas
            if (window.uiManager && typeof window.uiManager.validateFreemiumAction === 'function') {
                if (!window.uiManager.validateFreemiumAction(e)) return;
            }

            // UI Transitions
            stateInitial.style.display = 'none';
            stateResults.style.display = 'none';
            stateLoading.style.display = 'flex';

            const token = localStorage.getItem('authToken');

            // ✅ MOCK ANALYSIS FOR GUESTS: No call to API
            if (!token) {
                setTimeout(() => {
                    const localStats = JSON.parse(localStorage.getItem('guest_demo_stats') || '{}');
                    stateLoading.style.display = 'none';
                    stateResults.style.display = 'block';

                    let mockStrengths = "<strong>Cuidado Integral:</strong> Tus respuestas muestran una base sólida en salud preventiva.";
                    let mockWeaknesses = "<strong>Ética y Gestión:</strong> Necesitas profundizar en la normativa de NTS y derechos del paciente.";

                    // Try to be more specific if areaStats exist
                    if (localStats.areaStats) {
                        const sorted = Object.entries(localStats.areaStats)
                            .map(([topic, data]) => ({ topic, ratio: data.correct / data.total }))
                            .sort((a, b) => b.ratio - a.ratio);

                        if (sorted.length > 0) {
                            const best = sorted[0];
                            const worst = sorted[sorted.length - 1];
                            mockStrengths = `<strong>${best.topic}:</strong> Tienes un excelente dominio en esta área con un ${Math.round(best.ratio * 100)}% de aciertos.`;
                            mockWeaknesses = `<strong>${worst.topic}:</strong> Es tu área de mayor oportunidad. Repasa los fundamentos de este bloque para mejorar tu perfil.`;
                        }
                    }

                    document.getElementById('ai-strengths').innerHTML = `
                        <i class="fas fa-check-circle" style="color: #10b981;"></i> 
                        ${mockStrengths}
                    `;
                    document.getElementById('ai-weaknesses').innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> 
                        ${mockWeaknesses} 
                        <a href="#" onclick="window.uiManager.showAuthPromptModal(); return false;" style="color:#60a5fa; font-weight:700;">Regístrate</a> para un análisis profundo por IA.
                    `;
                }, 1500);
                return;
            }

            try {
                // LLAMADA REAL A LA IA DE DIAGNÓSTICO PROFUNDO
                const response = await fetch(`${window.AppConfig.API_URL}/api/analytics/diagnostic`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stats: cachedStats }) // data que llega desde loadStats() previamente
                });

                const data = await response.json();

                if (!response.ok) {
                    if (response.status === 403) {
                        // Límite sobrepasado o usuario Básico/Free sin acceso a IA.
                        // EN LUGAR DE PAYWALL INTRUSIVO, HACEMOS FALLBACK AL DIAGNÓSTICO ESTÁTICO (Clásico)
                        console.log("⚠️ Fallback a Diagnóstico Clínico Estático (Límites o Tier Básico)");
                        stateLoading.style.display = 'none';
                        stateResults.style.display = 'block';

                        const fStrong = cachedStats.strongest_topic && cachedStats.strongest_topic !== 'N/A'
                            ? `<strong>${cachedStats.strongest_topic}:</strong> Tienes un alto dominio en esta materia basado en tu ratio de aciertos histórico.`
                            : "Continúa practicando para encontrar tus fortalezas.";

                        const fWeak = cachedStats.weakest_topic && cachedStats.weakest_topic !== 'N/A'
                            ? `<strong>${cachedStats.weakest_topic}:</strong> Necesitas repasar intensivamente los tópicos y leer la bibliografía de este curso para mejorar tus puntajes.`
                            : "Aún no hay suficientes datos para determinar tu eslabón débil.";

                        document.getElementById('ai-strengths').innerHTML = fStrong;
                        document.getElementById('ai-weaknesses').innerHTML = fWeak;
                        return;
                    }
                    throw new Error(data.error || 'Error en servidor de IA');
                }

                // Mostrar Respuesta Real
                stateLoading.style.display = 'none';
                stateResults.style.display = 'block';

                document.getElementById('ai-strengths').innerHTML = data.strengths || "Análisis no disponible.";
                document.getElementById('ai-weaknesses').innerHTML = data.weaknesses || "Análisis no disponible.";

                // Si existe UiManager usamos decrement vidas (Opcional visual)
                if (window.uiManager && typeof window.uiManager.updateLifeCounters === 'function') {
                    // Update visual local si es posible (solo para no recargar front)
                    window.uiManager.updateLifeCounters();
                }

            } catch (err) {
                console.error("AI Analysis Failed", err);
                stateLoading.style.display = 'none';
                stateInitial.style.display = 'flex';
                alert("Hubo un problema de conexión al tutor de inteligencia artificial. Intenta nuevamente.");
            }
        }

        if (btnAnalyze) btnAnalyze.addEventListener('click', (e) => runAnalysis(e));
        if (btnAgain) btnAgain.addEventListener('click', (e) => runAnalysis(e));
    }

    // Modify init to call setupAIAnalysis
    const originalInit = init;
    init = async function () {
        await originalInit.apply(this, arguments); // Call original items (loadStats, loadEvolution)
        setupAIAnalysis(); // Setup handlers
    }

    function renderGuestBanner() {
        const container = document.getElementById('dashboard-content');
        if (!container) return; // Guard
        const banner = document.createElement('div');
        banner.style.cssText = 'background: linear-gradient(90deg, #1e293b, #0f172a); border: 1px solid #3b82f6; border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1); animation: fadeIn 0.8s ease-out;';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 50px; height: 50px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 1.5rem;">
                    <i class="fas fa-user-astronaut"></i>
                </div>
                <div>
                    <h3 style="color: #f8fafc; margin: 0; font-size: 1.1rem;">Estás en Modo Invitado</h3>
                    <p style="color: #94a3b8; margin: 0.2rem 0 0 0; font-size: 0.9rem;">Regístrate para guardar tu progreso real y acceder a todas las funciones.</p>
                </div>
            </div>
            <button class="btn-action" style="background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; border: none; cursor: pointer;" onclick="window.location.href='/register'">
                Crear Cuenta Gratis
            </button>
        `;
        container.prepend(banner);
    }

    function renderGuestDemoData() {
        renderGuestBanner();

        // --- 🌈 Arcade Mode Glow for Guests ---
        const sessionsSent = parseInt(localStorage.getItem('demo_sessions_count') || '0');
        const arcadeBtn = document.getElementById('btn-mode-arcade');

        if (sessionsSent < 3 && arcadeBtn) {
            const arcadeCard = arcadeBtn.closest('.mode-card');
            if (arcadeCard) {
                // Inject styles for the glow
                if (!document.getElementById('arcade-glow-style')) {
                    const style = document.createElement('style');
                    style.id = 'arcade-glow-style';
                    style.textContent = `
                        @keyframes arcade-glow {
                            0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.4); border-color: rgba(59, 130, 246, 0.3); }
                            50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 10px rgba(34, 197, 94, 0.4); border-color: rgba(96, 165, 250, 0.8); }
                            100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.4); border-color: rgba(59, 130, 246, 0.3); }
                        }
                        .arcade-highlight {
                            animation: arcade-glow 2s infinite ease-in-out;
                            position: relative;
                            z-index: 10;
                            overflow: visible !important; /* Prevent clipping */
                        }
                        .arcade-highlight::after {
                            content: '¡Pruébalo ahora!';
                            position: absolute;
                            top: 15px; /* Centered slightly better for the larger size */
                            right: 15px;
                            background: linear-gradient(90deg, #bfd025ff, #10b981);
                            color: white;
                            font-size: 0.7rem; /* Increased font-size */
                            padding: 6px 14px; /* Increased padding */
                            border-radius: 20px;
                            font-weight: 800;
                            text-transform: uppercase;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                            z-index: 20;
                            border: 1px solid rgba(255,255,255,0.2);
                        }
                        @media (max-width: 768px) {
                            .arcade-highlight::after {
                                font-size: 0.8rem; /* Increased font-size for mobile */
                                padding: 4px 10px; /* Increased padding for mobile */
                                top: 15px;
                                right: 15px;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
                arcadeCard.classList.add('arcade-highlight');
            }
        }

        // 1. KPI Demo values
        const scoreEl = document.getElementById('stat-score');
        const accuracyEl = document.getElementById('stat-accuracy');
        const countsEl = document.getElementById('stat-counts-text');
        const masteryEl = document.getElementById('stat-mastery');

        if (scoreEl) scoreEl.textContent = '14.5';
        if (accuracyEl) accuracyEl.textContent = '72%';
        if (countsEl) countsEl.textContent = '120 correctas / 45 incorrectas';
        if (masteryEl) masteryEl.textContent = '12';

        // 2. Evolution Chart Demo
        const evoCanvas = document.getElementById('evolutionChart');
        if (evoCanvas) {
            const evolutionCtx = evoCanvas.getContext('2d');
            lineChartInst = new Chart(evolutionCtx, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
                    datasets: [{
                        label: 'Puntaje (Demo)',
                        data: [11, 13, 12, 15, 14.5],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // 3. Radar Chart Demo
        const radarCanvas = document.getElementById('radarChart');
        const radarEmpty = document.getElementById('radar-empty-state');
        if (radarCanvas) {
            if (radarEmpty) radarEmpty.style.display = 'none';
            radarCanvas.style.display = 'block';
            radarChartInst = new Chart(radarCanvas.getContext('2d'), {
                type: 'radar',
                data: {
                    labels: ['Medicina', 'Cirugía', 'Pediatría', 'Gineco', 'Salud Pública'],
                    datasets: [{
                        label: 'Dominio % (Demo)',
                        data: [85, 60, 75, 90, 65],
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: '#60a5fa',
                        pointBackgroundColor: '#60a5fa',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#60a5fa'
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

        // 4. Persistence: Check for local demo stats
        const localStatsStr = localStorage.getItem('guest_demo_stats');
        if (localStatsStr) {
            try {
                const stats = JSON.parse(localStatsStr);
                if (scoreEl) scoreEl.textContent = stats.avgScore || '0';
                if (accuracyEl) accuracyEl.textContent = `${stats.accuracy || 0}%`;
                if (countsEl) countsEl.textContent = `${stats.correct || 0} correctas / ${stats.incorrect || 0} incorrectas`;

                // Update Radar Chart if areaStats exists
                if (stats.areaStats && radarChartInst) {
                    const sortedLabels = Object.keys(stats.areaStats);
                    const masteryData = sortedLabels.map(topic => {
                        const area = stats.areaStats[topic];
                        return Math.round((area.correct / area.total) * 100);
                    });

                    radarChartInst.data.labels = sortedLabels;
                    radarChartInst.data.datasets[0].data = masteryData;
                    radarChartInst.data.datasets[0].label = 'Tu Dominio %';
                    radarChartInst.update();

                    // Update mastery count (areas with > 70% accuracy)
                    const masteryCount = masteryData.filter(val => val >= 70).length;
                    const masteryEl = document.getElementById('stat-mastery');
                    if (masteryEl) masteryEl.textContent = masteryCount;
                }
            } catch (e) { console.error("Error parsing local stats", e); }
        }

        // 5. Ocultar Loading
        const loading = document.getElementById('loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', SimulatorDash.init);
