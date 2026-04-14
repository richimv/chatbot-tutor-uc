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
            quizParams: '?target=SERUMS&career=Medicina%20Humana'
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
            areas: ['Anatomía', 'Fisiología', 'Farmacología', 'Microbiología y Parasitología'],
            bg: 'rgba(234, 179, 8, 0.7)',
            border: '#eab308'
        },
        {
            label: 'Las 4 Grandes',
            areas: ['Medicina Interna', 'Pediatría', 'Ginecología y Obstetricia', 'Cirugía General'],
            bg: 'rgba(59, 130, 246, 0.7)',
            border: '#3b82f6'
        },
        {
            label: 'Especialidades Clínicas',
            areas: ['Cardiología', 'Gastroenterología', 'Neurología', 'Nefrología', 'Neumología', 'Endocrinología', 'Infectología', 'Reumatología', 'Traumatología'],
            bg: 'rgba(99, 102, 241, 0.7)',
            border: '#6366f1'
        },
        {
            label: 'Salud Pública y Gestión',
            areas: ['Salud Pública', 'Cuidado Integral De Salud', 'Ética E Interculturalidad', 'Investigación', 'Gestión De Servicios De Salud'],
            bg: 'rgba(16, 185, 129, 0.7)',
            border: '#10b981'
        }
    ];

    // Build lookup map for O(1) mapping of areas back to their parent group configuration
    const areaToGroupMap = {};
    examAreasGrouped.forEach((g, gIndex) => {
        g.areas.forEach(a => {
            areaToGroupMap[a] = {
                groupLabel: g.label,
                bg: g.bg,
                border: g.border,
                order: gIndex
            };
        });
    });

    function renderBarChart(cleanRadarMap) {
        // Obsolete Chart.js fallback support (just in case)
        if (radarChartInst) { radarChartInst.destroy(); radarChartInst = null; }

        const emptyState = document.getElementById('radar-empty-state');
        const container = document.getElementById('native-bars-container');
        if (!container) return;

        // Flatten mapping to list of active items
        const activeSubjects = Object.keys(cleanRadarMap)
            .filter(subject => cleanRadarMap[subject].total > 0)
            .map(subject => {
                const acc = Math.round((cleanRadarMap[subject].correct / cleanRadarMap[subject].total) * 100) || 0;
                // Find group info (fallback to 'Otros' if subject not found)
                const gInfo = areaToGroupMap[subject] || {
                    groupLabel: 'Otros',
                    bg: 'rgba(148, 163, 184, 0.7)', // Slate
                    border: '#94a3b8',
                    order: 99
                };
                return { name: subject, acc, ...gInfo };
            });

        if (activeSubjects.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            container.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        container.style.display = 'flex';
        container.innerHTML = ''; // Limpiar barras anteriores

        // Agrupar los resultados por su Categoría Principal (Las 4 Grandes, Ciencias Básicas, etc.)
        const groups = {};
        activeSubjects.forEach(s => {
            if (!groups[s.groupLabel]) {
                groups[s.groupLabel] = {
                    label: s.groupLabel,
                    order: s.order,
                    items: []
                };
            }
            groups[s.groupLabel].items.push(s);
        });

        // Ordenar los grupos según el orden base establecido
        const sortedGroups = Object.values(groups).sort((a, b) => a.order - b.order);

        // Render HTML Blocks
        sortedGroups.forEach((group, index) => {
            // Ordenar ítems dentro de su grupo por precisión (descendente)
            group.items.sort((a, b) => b.acc - a.acc);

            // Inyectar Título / Línea Divisoria del Grupo
            const groupHeader = document.createElement('div');
            groupHeader.className = 'html-chart-group-header';
            groupHeader.innerHTML = `<span>${group.label}</span>`;
            // Pequeña distancia top extra salvo que sea el primer render
            if (index > 0) groupHeader.style.marginTop = '1rem';
            container.appendChild(groupHeader);

            // Inyectar Barras Individuales
            group.items.forEach((item, itemIdx) => {
                const barRow = document.createElement('div');
                barRow.className = 'html-bar-row';
                barRow.innerHTML = `
                    <div class="html-bar-info">
                        <span class="html-bar-label">${item.name}</span>
                        <span class="html-bar-value">${item.acc}%</span>
                    </div>
                    <div class="html-bar-track">
                        <div class="html-bar-fill" data-width="${item.acc}%" style="width: 0%; background: ${item.bg}; border: 1px solid ${item.border};"></div>
                    </div>
                `;
                container.appendChild(barRow);
            });
        });

        // Lanzar animación fluida con un requestAnimationFrame para asegurar que el DOM inicializó con width 0%
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fills = container.querySelectorAll('.html-bar-fill');
                fills.forEach(fill => {
                    const targetWidth = fill.getAttribute('data-width');
                    fill.style.width = targetWidth;
                });
            });
        });
    }

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
        bindModeClicks();

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
                    const targetDisplay = activeConfig.target === 'SERUMS' && activeConfig.career 
                        ? `${activeConfig.target} (${activeConfig.career})` 
                        : activeConfig.target;
                    
                    summaryBox.innerHTML = `
                        <i class="fas fa-filter"></i> 
                        <span><strong>Filtro Recuperado:</strong> ${targetDisplay} | ${activeConfig.areas ? activeConfig.areas.length : 0} áreas</span>
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
            // ✅ Sincronizar usuario para tener contadores de límites (usageCount, dailySimulatorUsage) actualizados
            if (window.sessionManager) {
                await window.sessionManager.refreshUser();
            }
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
            <strong>Tip:</strong> Tu simulador está configurado por defecto para el SERUMS. Personaliza tu meta y áreas clínicas aquí.
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
            baseParams = `?target=${encodeURIComponent(activeConfig.target)}&areas=${encodeURIComponent(activeConfig.areas.join(','))}&context=${currentContext}`;
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
        const ids = ['btn-mode-arcade', 'btn-mode-study', 'btn-mode-real'];
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
                        // Pasamos 'simulator' para que valide contra los límites de 15/40
                        if (!window.uiManager.validateFreemiumAction(e, 'simulator')) return;
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

            const groupsToRender = target === 'SERUMS'
                ? examAreasGrouped.filter(g => g.label === 'Salud Pública y Gestión')
                : examAreasGrouped;

            groupsToRender.forEach(group => {
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
                    e.preventDefault();
                    e.stopPropagation();
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

                    const targetRadio = document.querySelector(`.exam-target-option input[value="${activeTarget}"]`);
                    if (targetRadio) targetRadio.checked = true;
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
                    } else if (t === 'SERUMS') {
                        // Solo Grupo D
                        defaultAreas = examAreasGrouped.find(g => g.label === 'Salud Pública y Gestión').areas;
                    } else if (t === 'RESIDENTADO') {
                        defaultAreas = examAreasGrouped.flatMap(g => g.areas);
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

                activeConfig = { target, areas: selectedAreas, career };
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
                const targetDisplay = target === 'SERUMS' && career 
                    ? `${target} (${career})` 
                    : target;

                summaryBox.innerHTML = `
                    <i class="fas fa-filter"></i> 
                    <span><strong>Filtro Activo:</strong> ${targetDisplay} | ${selectedAreas.length} áreas seleccionadas</span>
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

            const evoCanvas = document.getElementById('evolutionChart');
            const evoEmpty = document.getElementById('evolution-empty-state');

            if (data.success && data.chart && data.chart.labels && data.chart.labels.length > 0) {
                if (evoCanvas) evoCanvas.style.display = 'block';
                if (evoEmpty) evoEmpty.style.display = 'none';

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
            } else {
                if (evoCanvas) evoCanvas.style.display = 'none';
                if (evoEmpty) evoEmpty.style.display = 'flex';
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
            if (countsEl) countsEl.textContent = `${kpis.total_correct || 0} / ${kpis.total_incorrect || 0}`;
            if (masteryEl) masteryEl.textContent = kpis.mastered_cards || 0;

            // Setup Flashcard Link
            if (kpis.system_deck_id) {
                const btnFlash = document.getElementById('btn-flashcards');
                if (btnFlash) btnFlash.href = `repaso?deckId=${kpis.system_deck_id}`;
            }

            // --- Render Bar Chart (Áreas) ---
            // --- Render Bar Chart (Áreas) ---
            if (kpis.radar_data && kpis.radar_data.length > 0) {
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

                renderBarChart(cleanRadarMap);
            } else {
                renderBarChart({}); // Empty state handler
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

                    let activeCfg = JSON.parse(localStorage.getItem('simActiveConfig')) || {};
                    let targetExamName = activeCfg.target || 'General';

                    let mockStrengths = `
                        <ul style="margin-top: 0.5rem; padding-left: 0.5rem; color: #cbd5e1; list-style-type: none;">
                            <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Diagnóstico Diferencial (${targetExamName}):</strong> Los patrones de decisión evidencian una alta asimilación de protocolos clínicos de primera línea, reaccionando óptimamente frente a escenarios de presión temporal característicos de este nivel de evaluación.</li>
                            <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Bloque Clínico Estratégico:</strong> Rendimiento superior a la media de la cohorte en preguntas transversales asociadas a Pediatría y Ginecología para ${targetExamName}, reflejando un sólido razonamiento médico.</li>
                            <li style="line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Ciencias Básicas Interrelacionadas:</strong> Tus respuestas denotan una buena correlación entre la fisiopatología y la clínica manifiesta.</li>
                        </ul>
                    `;

                    let mockWeaknesses = `
                        <ul style="margin-top: 0.5rem; padding-left: 0.5rem; color: #cbd5e1; list-style-type: none;">
                            <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #f59e0b; margin-right: 0.5rem;"></i> <strong>Salud Pública y Gestión de Servicios (${targetExamName}):</strong> Se detectan inconsistencias analíticas críticas en el dominio de normas técnicas vigentes (NTS), indicadores epidemiológicos de impacto y cadena de gestión documental exigidos para este eje.</li>
                        </ul>
                        <div style="margin-top: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border-left: 3px solid #3b82f6; border-radius: 6px;">
                            <span style="color: #60a5fa; font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 0.4rem; letter-spacing: 0.5px;"><i class="fas fa-microchip"></i> RECOMENDACIÓN DEL MOTOR:</span>
                            <span style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5;">De acuerdo a las matrices del histórico reciente para ${targetExamName}, aislar la disciplina de "Salud Pública" y realizar simulacros cruzados de 30 preguntas exclusivas durante los próximos 2 ciclos te ayudará dramáticamente a emparejar tu puntaje general.</span>
                        </div>
                        <div style="margin-top: 1.5rem; text-align: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 1.5rem;">
                            <button onclick="window.uiManager.showAuthPromptModal();" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                Desbloquear Análisis Individualizado
                            </button>
                            <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.75rem; line-height: 1.4;">Nota: Esta cuenta utiliza matrices de diagnóstico generales de prueba. Para compilar análisis volumétricos reales de tu propio rendimiento sobre miles de correlaciones cruzadas exclusivas de ${targetExamName}, crea una cuenta gratuitamente.</p>
                        </div>
                    `;

                    // For guests, we ignore localStats map as the text is pre-rendered heavily to entice registration.

                    document.getElementById('ai-strengths').innerHTML = mockStrengths;
                    document.getElementById('ai-weaknesses').innerHTML = mockWeaknesses;
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

                        const radar = cachedStats.radar_data || [];
                        const sortedRadar = [...radar].sort((a, b) => b.accuracy - a.accuracy);

                        let activeCfgLogs = JSON.parse(localStorage.getItem('simActiveConfig')) || {};
                        let restrictedTarget = activeCfgLogs.target || 'General';
                        let availableAreas = activeCfgLogs.areas || ['Medicina General', 'Salud Pública', 'Epidemiología'];

                        // If radar is empty (e.g., brand new config), fallback to the first two areas of the applied config
                        let topSub1 = sortedRadar.length > 0 ? sortedRadar[0].subject : (availableAreas[0] || 'Medicina General');
                        let topSub2 = sortedRadar.length > 1 ? sortedRadar[1].subject : (availableAreas[1] || 'Terapéutica');
                        let weakSub = sortedRadar.length > 0 ? sortedRadar[sortedRadar.length - 1].subject : (availableAreas[availableAreas.length - 1] || 'Salud Pública');

                        // We use the real topics here, making it completely pertinent to whatever config is active
                        const fStrong = `
                            <ul style="margin-top: 0.5rem; padding-left: 0.5rem; color: #cbd5e1; list-style-type: none;">
                                <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Diagnóstico Algorítmico (${restrictedTarget}):</strong> Tus patrones de decisión evidencian una alta asimilación de los protocolos clínicos de primera línea evaluados frecuentemente en el objetivo seleccionado.</li>
                                <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Dominio en ${topSub1}:</strong> Tienes un alto dominio en esta materia asimilando la casuística de evaluación y correlacionando la clínica efectivamente. Este es tu bloque más fuerte.</li>
                                <li style="line-height: 1.5;"><i class="fas fa-angle-right" style="color: #22c55e; margin-right: 0.5rem;"></i> <strong>Criterios en ${topSub2}:</strong> Tus respuestas denotan una buena correlación entre la fisiopatología y la clínica manifiesta para este requerimiento del examen.</li>
                            </ul>
                        `;

                        const fWeak = `
                            <ul style="margin-top: 0.5rem; padding-left: 0.5rem; color: #cbd5e1; list-style-type: none;">
                                <li style="margin-bottom: 0.5rem; line-height: 1.5;"><i class="fas fa-angle-right" style="color: #f59e0b; margin-right: 0.5rem;"></i> <strong>Área Crítica en ${weakSub}:</strong> Se detectan inconsistencias analíticas de alto riesgo. Necesitas priorizar intensivamente el simulacro cruzado de este eje transversal para corregir la curva estadística negativa.</li>
                            </ul>
                            <div style="margin-top: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border-left: 3px solid #3b82f6; border-radius: 6px;">
                                <span style="color: #60a5fa; font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 0.4rem; letter-spacing: 0.5px;"><i class="fas fa-microchip"></i> RECOMENDACIÓN DEL MOTOR:</span>
                                <span style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5;">De acuerdo a las métricas acopladas al entorno ${restrictedTarget}, debes configurar inmediatamente un filtro exclusivo para la disciplina de "${weakSub}" abarcando 50 preguntas correlativas en el próximo ciclo continuo. Esto emparejará tus ratios antes del simulacro general final.</span>
                            </div>
                        `;

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
        if (window.uiManager) {
            window.uiManager.renderGuestBanner('dashboard-content');
        }
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
        if (countsEl) countsEl.textContent = '50 / 20';
        if (masteryEl) masteryEl.textContent = '12';

        // 2. Evolution Chart Demo
        const evoCanvas = document.getElementById('evolutionChart');
        if (evoCanvas) {
            // --- 🧹 LIMPIEZA DE CANVAS ---
            if (lineChartInst) {
                lineChartInst.destroy();
                lineChartInst = null;
            }

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

        // 3. Bar Chart Demo
        // 3. Bar Chart Demo
        const demoAreasMap = {
            'Ginecología y Obstetricia': { correct: 90, total: 100 },
            'Medicina Interna': { correct: 85, total: 100 },
            'Pediatría': { correct: 75, total: 100 },
            'Salud Pública': { correct: 65, total: 100 },
            'Fisiología': { correct: 60, total: 100 },
            'Cardiología': { correct: 50, total: 100 }
        };
        renderBarChart(demoAreasMap);

        // 4. Persistence: Check for local demo stats
        const localStatsStr = localStorage.getItem('guest_demo_stats');
        if (localStatsStr) {
            try {
                const stats = JSON.parse(localStatsStr);
                if (scoreEl) scoreEl.textContent = stats.avgScore || '0';
                if (accuracyEl) accuracyEl.textContent = `${stats.accuracy || 0}%`;
                if (countsEl) countsEl.textContent = `${stats.correct || 0} / ${stats.incorrect || 0}`;

                // Update Bar Chart if areaStats exists
                if (stats.areaStats) {
                    renderBarChart(stats.areaStats);

                    // Update mastery count (areas with >= 70% accuracy)
                    let masteryCount = 0;
                    Object.keys(stats.areaStats).forEach(topic => {
                        const area = stats.areaStats[topic];
                        if (area.total > 0 && (area.correct / area.total) >= 0.70) {
                            masteryCount++;
                        }
                    });
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

// 🔄 AUTO-REFRESH: Recargar estadísticas al volver al tablero (Botón Atrás o Salir del Quiz)
window.addEventListener('pageshow', (event) => {
    // Si la página se está mostrando desde el cache del navegador (persisted)
    if (event.persisted) {
        console.log("🔄 Navegación detectada: Refrescando Estadísticas...");
        SimulatorDash.init();
    }
});
