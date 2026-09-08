/**
 * Simulator Dashboard Logic
 * Handles Context-Aware Stats Fetching
 */

const SimulatorDash = (() => {

    // Configuración Extendida de Dominios (v3.0)
    const contexts = {
        'MEDICINA': {
            title: 'Preparación Médico',
            heroTitle: 'Preparación Médico',
            subtitle: 'Entrenamiento técnico adaptado a especificaciones sanitarias oficiales MINSA & ENCAPS.',
            quizParams: '', // Eliminado el fallback automático. Ahora se fuerza la configuración.
            studyDesc: '20 preguntas con explicación y sustento clínico detallado.',
            realDesc: '100 preguntas integradas con temporizador oficial estricto (2 horas).',
            realQuestions: 100,
            sectionIcon: 'fa-stethoscope',
            barChartTitle: 'Dominio por Áreas Clínicas',
            barChartEmptyDesc: 'Completa simulacros variados para ver tu dominio clínico por especialidad.',
            images: {
                study: '/assets/Modo Estudio.webp',
                flashcards: '/assets/Flashcards.webp',
                real: '/assets/Simulacro Real.webp'
            },
            targets: [
                { value: 'ENAM', label: 'ENAM', disabled: true, subtitle: '(Próximamente)' },
                { value: 'SERUMS', label: 'SERUMS', checked: true },
                { value: 'RESIDENTADO', label: 'RESIDENTADO', disabled: true, subtitle: '(Beta / Trabajando)' }
            ],
            areas: [
                { label: 'Bloque Temático Oficial', areas: ['Salud Pública', 'Cuidado Integral de Salud', 'Ética e Interculturalidad', 'Investigación', 'Gestión de Servicios de Salud'], bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981', conditionalTarget: 'SERUMS' },
                { label: 'Grandes Especialidades Médicas', areas: ['Medicina Interna', 'Pediatría', 'Ginecología y Obstetricia', 'Cirugía General'], bg: 'rgba(59, 130, 246, 0.7)', border: '#3b82f6', conditionalTarget: 'ENAM' },
                { label: 'Salud Pública y Ciencias Básicas', areas: ['Salud Pública y Gestión', 'Farmacología Clínica y Fisiopatología', 'Ética Médica y Deontología'], bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981', conditionalTarget: 'ENAM' },
                { label: 'Medicina de Alta Complejidad', areas: ['Medicina Interna y Subespecialidades', 'Pediatría y Cuidados Intensivos', 'Cirugía General y Especializada', 'Gineco-Obstetricia de Alto Riesgo'], bg: 'rgba(245, 158, 11, 0.7)', border: '#f59e0b', conditionalTarget: 'RESIDENTADO' },
                { label: 'Epidemiología y Bioestadística', areas: ['Epidemiología Clínica y MBE', 'Gestión Sanitaria y Auditoría Médica'], bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981', conditionalTarget: 'RESIDENTADO' }
            ]
        },
        'EDUCACION': {
            title: 'Preparación Magisterial',
            heroTitle: 'Preparación Magisterial',
            subtitle: 'Evaluación de casuística pedagógica basada en el CNEB y Marco de Buen Desempeño Docente.',
            quizParams: '', // Eliminado el fallback automático.
            studyDesc: '20 preguntas con retroalimentación y sustento pedagógico CNEB.',
            realDesc: '60 preguntas integradas con temporizador oficial estricto (3 horas).',
            realQuestions: 60,
            sectionIcon: 'fa-chalkboard-teacher',
            barChartTitle: 'Dominio por Áreas Pedagógicas',
            barChartEmptyDesc: 'Completa simulacros variados para ver tu dominio pedagógico por especialidad.',
            images: {
                study: '/assets/Modo Estudio-v2.webp',
                flashcards: '/assets/Flashcards-v2.webp',
                real: '/assets/Simulacro Real-v2.webp'
            },
            targets: [
                { value: 'NOMBRAMIENTO', label: 'NOMBRAMIENTO', disabled: true, subtitle: '(Próximamente)' },
                { value: 'ASCENSO', label: 'ASCENSO', checked: true, subtitle: 'Escala Magisterial' },
                { value: 'ACCESO_CARGOS', label: 'ACCESO A CARGOS', disabled: true, subtitle: 'Directivos (Beta)' }
            ],
            careerOptions: [
                { value: 'EBR - Inicial', label: 'EBR - Nivel Inicial' },
                { value: 'EBR - Primaria', label: 'EBR - Nivel Primaria' },
                { value: 'EBR - Secundaria', label: 'EBR - Nivel Secundaria' }
            ],
            primarySpecialties: [
                'General', 'Profesor de Innovación Pedagógica', 'Educación Física'
            ],
            secondarySpecialties: [
                'Arte y Cultura', 'Ciencias Sociales', 'Ciencia y Tecnología', 'Comunicación',
                'Desarrollo Personal, Ciudadanía y Cívica', 'Educación Física',
                'Educación Religiosa', 'Educación para el Trabajo',
                'Inglés como Lengua Extranjera', 'Matemática', 'Profesor de Innovación Pedagógica'
            ],
            areas: [
                { label: 'Habilidades Generales', areas: ['Comprensión Lectora', 'Razonamiento Lógico'], bg: 'rgba(234, 179, 8, 0.7)', border: '#eab308', conditionalTarget: 'NOMBRAMIENTO' },
                { label: 'Enfoques y Principios del CNEB', areas: ['Enfoque por competencias', 'Enfoques transversales', 'Principios de la educación peruana'], bg: 'rgba(234, 179, 8, 0.7)', border: '#eab308', conditionalTarget: 'ASCENSO' },
                { label: 'Teorías y Procesos del Aprendizaje', areas: ['Constructivismo y socioconstructivismo', 'Aprendizajes significativos', 'Activación y recojo de saberes previos', 'Conflicto o disonancia cognitiva y demanda cognitiva', 'Procesos auxiliares'], bg: 'rgba(59, 130, 246, 0.7)', border: '#3b82f6', conditionalTarget: 'ASCENSO' },
                { label: 'Planificación y Evaluación', areas: ['Planificación pedagógica', 'Evaluación formativa y retroalimentación'], bg: 'rgba(99, 102, 241, 0.7)', border: '#6366f1', conditionalTarget: 'ASCENSO' },
                { label: 'Clima Escolar e Inclusión', areas: ['Convivencia democrática y clima de aula', 'Educación inclusiva y DUA', 'Características y desarrollo del estudiante'], bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981', conditionalTarget: 'ASCENSO' },
                { label: 'Conocimientos Pedagógicos y Curriculares', areas: ['Teorías del Aprendizaje y Desarrollo', 'Principios del Currículo Nacional (CNEB)', 'Planificación Curricular (PCI, PCA, Unidades)', 'Evaluación Formativa y Retroalimentación', 'Convivencia Escolar y Clima de Aula', 'Principios de la Educación Peruana'], bg: 'rgba(59, 130, 246, 0.7)', border: '#3b82f6', conditionalTarget: 'NOMBRAMIENTO' },
                { label: 'Gestión Institucional', areas: ['Liderazgo Pedagógico', 'Planificación Estratégica (PEI, PAT)', 'Gestión del Riesgo de Desastres', 'Monitoreo y Acompañamiento'], bg: 'rgba(249, 115, 22, 0.7)', border: '#f97316', conditionalTarget: 'ACCESO_CARGOS' }
            ]
        }
    };

    let currentContext = 'MEDICINA';
    let activeConfig = null;
    let activeMode = null;
    let activeDays = null;
    let lineChartInst = null;
    let radarChartInst = null;
    let doughnutChartInst = null;


    // Se inicializará dinámicamente según el contexto
    let examAreasGrouped = [];
    let areaToGroupMap = {};
    let selectedVocabIds = [];

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
                return {
                    name: subject, acc,
                    correct: cleanRadarMap[subject].correct,
                    total: cleanRadarMap[subject].total,
                    ...gInfo
                };
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
                        <span class="html-bar-value">${item.acc}% <span style="font-size:0.72rem;opacity:0.45;font-weight:400;">(${item.correct}/${item.total} q)</span></span>
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

    function renderDoughnutChart(doughnutData) {
        if (doughnutChartInst) {
            doughnutChartInst.destroy();
            doughnutChartInst = null;
        }

        const emptyState = document.getElementById('doughnut-empty-state');
        const wrapper = document.getElementById('doughnut-wrapper');
        const legend = document.getElementById('doughnut-legend');
        const canvas = document.getElementById('topicDoughnutChart');

        if (!canvas) return;

        const labels = Object.keys(doughnutData);
        const values = Object.values(doughnutData);
        const totalSum = values.reduce((a, b) => a + b, 0);

        if (totalSum === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            if (wrapper) wrapper.style.display = 'none';
            if (legend) legend.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (wrapper) wrapper.style.display = 'block';
        if (legend) legend.style.display = 'flex';

        let colors = [];
        if (currentContext === 'MEDICINA') {
            colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#14b8a6'];
        } else {
            colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#eab308'];
        }

        legend.innerHTML = '';
        labels.forEach((label, idx) => {
            const val = values[idx];
            const pct = Math.round((val / totalSum) * 100);
            const color = colors[idx % colors.length];

            const item = document.createElement('div');
            item.className = 'doughnut-legend-item';
            Object.assign(item.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
            });
            item.title = label;
            item.innerHTML = `
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
                <span style="font-weight: 600; color: var(--text-main); font-size: 0.8rem;">${val} q <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.72rem;">(${pct}%)</span></span>
            `;
            legend.appendChild(item);
        });

        const ctx = canvas.getContext('2d');
        doughnutChartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#0f172a',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} q`
                        }
                    }
                }
            }
        });
    }

    // ── Tabs de Modo (Todos / Rápido / Estudio) ────────────
    function setupModeTabs() {
        const tabs = document.querySelectorAll('.kpi-mode-tab');
        if (!tabs.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Actualizar estado activo
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const val = tab.dataset.mode;
                activeMode = val === 'all' ? null : (isNaN(val) ? val : parseInt(val, 10));

                // Re-cargar stats con el nuevo filtro
                const token = localStorage.getItem('authToken');
                if (token) {
                    loadStats();
                    loadEvolution();
                }
            });
        });
    }

    // ── Tabs de Tiempo (Histórico / 30d / 7d) ────────────
    function setupTimeTabs() {
        const tabs = document.querySelectorAll('.kpi-time-tab');
        if (!tabs.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Actualizar estado activo
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const val = tab.dataset.days;
                activeDays = val === 'all' ? null : parseInt(val);

                // Re-cargar stats con el nuevo filtro
                const token = localStorage.getItem('authToken');
                if (token) {
                    loadStats();
                    loadEvolution();
                }
            });
        });
    }

    function renderConfigSummary(summaryBox, config) {
        if (!summaryBox || !config) return;
        summaryBox.style.display = 'flex';

        let targetText = config.target || '';
        let infoText = '';
        if (config.career) {
            infoText = config.career;
        } else if (config.difficulty) {
            infoText = config.difficulty;
        }

        const isDefault = config.configType === 'default' || !config.configType;
        const areasCount = config.areas ? config.areas.length : 0;

        let pillsHtml = `<span class="config-summary-pill config-summary-pill--accent">${targetText}</span>`;
        if (infoText) {
            pillsHtml += ` <span class="config-summary-pill">${infoText}</span>`;
        }
        if (isDefault) {
            pillsHtml += ` <span class="config-summary-pill config-summary-pill--count">Examen Oficial (Todas las áreas)</span>`;
        } else {
            pillsHtml += ` <span class="config-summary-pill config-summary-pill--count">${areasCount} ${areasCount === 1 ? 'área' : 'áreas'}</span>`;
        }

        summaryBox.innerHTML = `
            <i class="fas fa-filter config-summary-icon"></i>
            <span class="config-summary-title">Filtro Activo:</span>
            ${pillsHtml}
        `;
    }

    async function init() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
        const urlParams = new URLSearchParams(window.location.search);
        currentContext = (urlParams.get('context') || 'MEDICINA').toUpperCase();

        // 🎨 Asignación Cromática Contextual (Salud = Verde/Esmeralda, Educación = Azul/Índigo)
        document.documentElement.setAttribute('data-simulator-context', currentContext.toLowerCase());
        if (currentContext === 'MEDICINA') {
            document.documentElement.style.setProperty('--primary', '#0d9488');
            document.documentElement.style.setProperty('--primary-dark', '#0f766e');
            document.documentElement.style.setProperty('--primary-light', '#2dd4bf');
            document.documentElement.style.setProperty('--primary-glow', 'rgba(13, 148, 136, 0.25)');
            document.documentElement.style.setProperty('--primary-glow-sm', 'rgba(13, 148, 136, 0.12)');
        } else if (currentContext === 'EDUCACION') {
            document.documentElement.style.setProperty('--primary', '#3b82f6');
            document.documentElement.style.setProperty('--primary-dark', '#2563eb');
            document.documentElement.style.setProperty('--primary-light', '#60a5fa');
            document.documentElement.style.setProperty('--primary-glow', 'rgba(59, 130, 246, 0.25)');
            document.documentElement.style.setProperty('--primary-glow-sm', 'rgba(59, 130, 246, 0.12)');
        }

        // 0. Initialize Context-Aware Data Structures
        const ctxConfig = contexts[currentContext] || contexts['MEDICINA'];
        examAreasGrouped = ctxConfig.areas || [];
        areaToGroupMap = {};
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

        // 1. Setup UI Context
        const titleEl = document.getElementById('ctx-title');
        const subtitleEl = document.getElementById('ctx-subtitle');
        const iconEl = document.getElementById('ctx-icon');

        if (titleEl) titleEl.textContent = ctxConfig.title;
        if (subtitleEl && ctxConfig.subtitle) subtitleEl.textContent = ctxConfig.subtitle;
        document.title = `${ctxConfig.title} | Hub Academia`;

        const realCountBadge = document.getElementById('real-questions-count-badge');
        if (realCountBadge && ctxConfig.realQuestions) {
            realCountBadge.textContent = `${ctxConfig.realQuestions} Preguntas`;
        }

        // Dynamic Bar Chart Labels based on Context
        const barChartTitleEl = document.getElementById('bar-chart-title');
        const barChartEmptyDescEl = document.getElementById('bar-chart-empty-desc');
        if (barChartTitleEl && ctxConfig.barChartTitle) {
            barChartTitleEl.textContent = ctxConfig.barChartTitle;
        }
        if (barChartEmptyDescEl && ctxConfig.barChartEmptyDesc) {
            barChartEmptyDescEl.textContent = ctxConfig.barChartEmptyDesc;
        }

        // Dynamic KPI Tooltips based on Context
        const evoTooltipDesc = document.getElementById('evolution-tooltip-desc');
        if (evoTooltipDesc) {
            evoTooltipDesc.textContent = 'Muestra la evolución de tus puntuaciones a lo largo del tiempo. Te permite medir tu curva de aprendizaje, identificar si tu rendimiento está mejorando y comparar resultados según el número de preguntas (10, 20 o simulacro real).';
        }

        const doughnutTooltipDesc = document.getElementById('doughnut-tooltip-desc');
        if (doughnutTooltipDesc) {
            doughnutTooltipDesc.textContent = 'Muestra la proporción de preguntas respondidas por cada tema o área. Ayuda a identificar en qué temas has concentrado más práctica y a asegurar que cubras todo el temario de forma equilibrada.';
        }

        const barTooltipTitle = document.getElementById('bar-tooltip-title');
        const barTooltipDesc = document.getElementById('bar-tooltip-desc');
        if (barTooltipTitle && ctxConfig.barChartTitle) {
            barTooltipTitle.textContent = ctxConfig.barChartTitle;
        }
        if (barTooltipDesc) {
            if (ctxConfig.title === 'Docente Pro' || window.location.search.includes('educacion')) {
                barTooltipDesc.textContent = 'Muestra tu porcentaje de acierto en cada área pedagógica. Sirve para detectar de manera precisa tus fortalezas y debilidades de cara a la evaluación docente.';
            } else {
                barTooltipDesc.textContent = 'Muestra tu porcentaje de acierto en cada especialidad o área clínica. Sirve para detectar de manera precisa tus fortalezas y tus puntos débiles específicos para priorizar tus repasos.';
            }
        }

        // Update analytics section icon based on domain
        const sectionHeading = document.querySelector('.section-heading');
        if (sectionHeading && ctxConfig.sectionIcon) {
            const icon = sectionHeading.querySelector('i');
            if (icon) {
                icon.className = `fas ${ctxConfig.sectionIcon}`;
            }
        }

        if (ctxConfig.images) {
            const studyImg = document.querySelector('#btn-mode-study img');
            const realImg = document.querySelector('#btn-mode-real img');

            if (studyImg && ctxConfig.images.study) studyImg.src = ctxConfig.images.study;
            if (realImg && ctxConfig.images.real) realImg.src = ctxConfig.images.real;
        }

        // Dynamically render exam target radio buttons
        const currentTargets = ctxConfig.targets || (ctxConfig.getTargetsForLang ? ctxConfig.getTargetsForLang('en-US') : null);
        if (currentTargets) {
            const targetContainer = document.querySelector('#config-modal-overlay .modal-section-title + div');
            if (window.innerWidth > 520) {
                targetContainer.style.gridTemplateColumns = `repeat(${currentTargets.length}, 1fr)`;
            } else {
                targetContainer.style.gridTemplateColumns = '1fr';
            }
            targetContainer.innerHTML = '';
            currentTargets.forEach(t => {
                const label = document.createElement('label');
                label.className = `exam-target-option ${t.disabled ? 'target-option--disabled' : ''}`;
                const subtitleHtml = t.subtitle
                    ? `<span style="display:block;font-size:0.6rem;opacity:0.7;font-weight:400;">${t.subtitle}</span>`
                    : '';
                label.innerHTML = `
                        <input type="radio" name="examTarget" value="${t.value}" ${t.checked ? 'checked' : ''} ${t.disabled ? 'disabled' : ''}>
                        <div class="target-card" style="${t.disabled ? 'opacity: 0.4; cursor: not-allowed; border-color: rgba(255,255,255,0.05);' : ''}">${t.label}${subtitleHtml}</div>
                    `;
                targetContainer.appendChild(label);
            });


            // Hide SERUMS-specific UI if not a medical context
            if (currentContext !== 'MEDICINA') {
                const serumsInfo = document.getElementById('serums-info-alert');
                const careerBox = document.getElementById('serums-career-container');
                if (serumsInfo) serumsInfo.style.display = 'none';
                if (careerBox) careerBox.style.display = 'none';
            }

            // Render Modalidad/Nivel selector for Education context
            if (ctxConfig.careerOptions) {
                const careerBox = document.getElementById('serums-career-container');
                if (careerBox) {
                    careerBox.style.display = 'block';
                    const careerTitle = careerBox.querySelector('.modal-section-title');
                    if (careerTitle) careerTitle.textContent = 'Modalidad / Nivel';

                    const selectEl = document.getElementById('config-career');
                    if (selectEl) {
                        selectEl.innerHTML = '';
                        ctxConfig.careerOptions.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.value;
                            option.textContent = opt.label;
                            selectEl.appendChild(option);
                        });

                        // Dynamic Specialty Selector - Defined globally within setupConfigModal or init to be accessible
                        window._updateEduSpecialties = (preselectedSpecialty = null) => {
                            if (currentContext !== 'EDUCACION') {
                                const specialtyContainer = document.getElementById('edu-specialty-container');
                                if (specialtyContainer) specialtyContainer.style.display = 'none';
                                return;
                            }
                            const level = selectEl.value;
                            let specialtyContainer = document.getElementById('edu-specialty-container');

                            if (!specialtyContainer) {
                                specialtyContainer = document.createElement('div');
                                specialtyContainer.id = 'edu-specialty-container';
                                specialtyContainer.style.marginTop = '0.75rem';
                                careerBox.appendChild(specialtyContainer);
                            }

                            if (level === 'EBR - Inicial') {
                                specialtyContainer.style.display = 'none';
                                specialtyContainer.innerHTML = '';
                            } else {
                                specialtyContainer.style.display = 'block';
                                const specs = (level === 'EBR - Primaria') ? ctxConfig.primarySpecialties : ctxConfig.secondarySpecialties;
                                specialtyContainer.innerHTML = `
                                    <h4 class="modal-section-title" style="font-size:0.75rem; color:#94a3b8; margin-bottom:0.5rem;">Especialidad (${level.replace('EBR - ', '')})</h4>
                                    <select id="config-specialty">
                                        ${specs.map(s => `<option value="${s}" ${s === preselectedSpecialty ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                `;
                            }
                        };

                        selectEl.addEventListener('change', () => window._updateEduSpecialties());
                        // Initial call will be handled by setupConfigModal to ensure consistency with loaded config
                    }
                }
            }
        }

        // Update card descriptions
        const studyDescEl = document.querySelector('#btn-mode-study .mode-desc');
        const realDescEl = document.querySelector('#btn-mode-real .mode-desc');
        if (studyDescEl) studyDescEl.textContent = ctxConfig.studyDesc;
        if (realDescEl) realDescEl.textContent = ctxConfig.realDesc;

        // 2. Setup Config Modal Logic & Load Persistent Config
        setupConfigModal();
        // bindModeClicks(); REMOVED TO PREVENT DOUBLE BINDING

        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                // Fetch preferences from API instead of localStorage
                const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/users/preferences?domain=${currentContext.toLowerCase()}`);
                const prefData = await res.json();

                if (prefData && prefData.data) {
                    activeConfig = prefData.data;
                    if (activeConfig) activeConfig.configType = activeConfig.configType || 'default';
                    // Keep localStorage in sync for legacy code
                    localStorage.setItem(`simActiveConfig_${currentContext}`, JSON.stringify(activeConfig));
                } else {
                    // Fallback to localStorage if API has nothing
                    const savedConfig = localStorage.getItem(`simActiveConfig_${currentContext}`);
                    if (savedConfig) {
                        activeConfig = JSON.parse(savedConfig);
                        if (activeConfig) activeConfig.configType = activeConfig.configType || 'default';
                    }
                }
            } catch (e) {
                console.error("Error loading saved config from API", e);
                // Fallback to localStorage
                const savedConfig = localStorage.getItem(`simActiveConfig_${currentContext}`);
                if (savedConfig) {
                    activeConfig = JSON.parse(savedConfig);
                    if (activeConfig) activeConfig.configType = activeConfig.configType || 'default';
                }
            }
        } else {
            const savedConfig = localStorage.getItem(`simActiveConfig_${currentContext}`);
            if (savedConfig) {
                activeConfig = JSON.parse(savedConfig);
                if (activeConfig) activeConfig.configType = activeConfig.configType || 'default';
            }
        }

        const summaryBox = document.getElementById('active-config-summary');
        if (summaryBox && activeConfig) {
            renderConfigSummary(summaryBox, activeConfig);
        }

        // 3. Setup Links (Modes) with initial default
        updateModeLinks(ctxConfig);
        bindModeClicks();

        // 4. Fetch Stats or Demo Data
        if (token) {
            // ✅ Sincronizar usuario para tener contadores de límites actualizados
            if (window.sessionManager) {
                await window.sessionManager.refreshUser();
            }
            setupModeTabs();
            setupTimeTabs();
            await loadStats();
            await loadEvolution();
        } else {
            console.log("👤 Modo Invitado: Usando datos de demostración estáticos.");
            renderGuestDemoData();
        }

        // 5. Diagnóstico Inteligente por IA (Extraer Insights)
        setupAIDiagnostic();

        // 6. Guía de Onboarding interactiva para visitantes y nuevos usuarios
        setupOnboardingGuide();

        // 6. Ocultar Loading & Mostrar Dashboard
        const loading = document.getElementById('loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
    }

    function setupOnboardingGuide() {
        const btnGuide = document.getElementById('btn-show-guide');
        if (btnGuide) {
            btnGuide.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.tooltipManager) {
                    window.tooltipManager.startSimulatorTour(true);
                }
            };
        }

        // Si es visitante o usuario sin configuración personalizada previa, sugerir tour guiado
        setTimeout(() => {
            if (window.tooltipManager && (!activeConfig || !localStorage.getItem('authToken'))) {
                window.tooltipManager.startSimulatorTour(false);
            }
        }, 800);

        // Soporte Touch / Tap para Tooltips de KPIs informativos
        document.addEventListener('click', (e) => {
            const kpiBtn = e.target.closest('.kpi-info-btn');
            if (kpiBtn) {
                e.stopPropagation();
                const container = kpiBtn.closest('.kpi-info-container');
                if (container) {
                    const wasActive = container.classList.contains('active');
                    document.querySelectorAll('.kpi-info-container.active').forEach(c => c.classList.remove('active'));
                    if (!wasActive) container.classList.add('active');
                }
                return;
            }

            // Si hace clic fuera, cerrar cualquier KPI tooltip abierto
            if (!e.target.closest('.kpi-tooltip-content')) {
                document.querySelectorAll('.kpi-info-container.active').forEach(c => c.classList.remove('active'));
            }
        });
    }

    function updateModeLinks(ctxConfig) {
        const token = localStorage.getItem('authToken');
        let baseParams = `${ctxConfig.quizParams}&context=${currentContext}`;

        // Corrección: Si no hay params por defecto (ahora están vacíos), quitamos el '&'
        if (baseParams.startsWith('&')) baseParams = `?context=${currentContext}`;

        // Append Custom Config if active
        if (activeConfig) {
            baseParams = `?target=${encodeURIComponent(activeConfig.target)}&areas=${encodeURIComponent(activeConfig.areas.join(','))}&context=${currentContext}`;
            if (activeConfig.configType) {
                baseParams += `&configType=${encodeURIComponent(activeConfig.configType)}`;
            }
            if (activeConfig.career) {
                baseParams += `&career=${encodeURIComponent(activeConfig.career)}`;
            }
            if (activeConfig.difficulty) {
                baseParams += `&difficulty=${encodeURIComponent(activeConfig.difficulty)}`;
            }
        }

        // 1. Arcade/Quick (10 questions)
        const btnArcade = document.getElementById('btn-mode-arcade');
        if (btnArcade) {
            const separator = baseParams.includes('?') ? '&' : '?';
            const demoFlag = !token ? '&demo=true' : '';
            btnArcade.href = `quiz${baseParams}${separator}limit=10&mode=arcade${demoFlag}`;
        }

        // 2. Study Mode (20 questions)
        const btnStudy = document.getElementById('btn-mode-study');
        if (btnStudy) {
            const separator = baseParams.includes('?') ? '&' : '?';
            btnStudy.href = `quiz${baseParams}${separator}limit=20&mode=study`;
        }

        // 3. Real Mock (60 or 100 questions - STRICTLY DB ONLY)
        const btnReal = document.getElementById('btn-mode-real');
        if (btnReal) {
            const separator = baseParams.includes('?') ? '&' : '?';
            const realLimit = ctxConfig.realQuestions || 100;
            btnReal.href = `quiz${baseParams}${separator}limit=${realLimit}&mode=real`;
        }

        updateGuestTrialHighlight();
    }

    /**
     * Actualiza el estado visual de las tarjetas de modo de examen:
     * - Visitante:
     *   * 10qs: parpadeo amarillo si está disponible; 'Prueba completada' con candado si ya se usó.
     *   * 20qs y Real: icono de candado para indicar que están bloqueados.
     * - Autenticado:
     *   * Restaura iconos y textos estándar.
     */
    function updateGuestTrialHighlight() {
        const btnArcade = document.getElementById('btn-mode-arcade');
        const btnStudy = document.getElementById('btn-mode-study');
        const btnReal = document.getElementById('btn-mode-real');

        const token = localStorage.getItem('authToken');
        if (!token) {
            const canTake = window.GuestSessionManager
                ? window.GuestSessionManager.canTakeDailyDemo()
                : parseInt(localStorage.getItem('demo_sessions_count') || '0', 10) < 1;

            if (btnArcade) {
                const ctaEl = btnArcade.querySelector('.mode-cta');
                if (canTake) {
                    btnArcade.classList.add('mode-card--trial-pulse');
                    if (ctaEl) {
                        ctaEl.innerHTML = `<span>Iniciar simulacro</span> <i class="fas fa-arrow-right"></i>`;
                    }
                } else {
                    btnArcade.classList.remove('mode-card--trial-pulse');
                    if (ctaEl) {
                        ctaEl.innerHTML = `<span>Prueba completada</span> <i class="fas fa-lock"></i>`;
                    }
                }
            }

            if (btnStudy) {
                const ctaEl = btnStudy.querySelector('.mode-cta');
                if (ctaEl) {
                    ctaEl.innerHTML = `<span>Iniciar modo estudio</span> <i class="fas fa-lock"></i>`;
                }
            }

            if (btnReal) {
                const ctaEl = btnReal.querySelector('.mode-cta');
                if (ctaEl) {
                    ctaEl.innerHTML = `<span>Iniciar simulacro real</span> <i class="fas fa-lock"></i>`;
                }
            }
        } else {
            if (btnArcade) {
                btnArcade.classList.remove('mode-card--trial-pulse');
                const ctaEl = btnArcade.querySelector('.mode-cta');
                if (ctaEl) {
                    ctaEl.innerHTML = `<span>Iniciar simulacro</span> <i class="fas fa-arrow-right"></i>`;
                }
            }

            if (btnStudy) {
                const ctaEl = btnStudy.querySelector('.mode-cta');
                if (ctaEl) {
                    ctaEl.innerHTML = `<span>Iniciar modo estudio</span> <i class="fas fa-arrow-right"></i>`;
                }
            }

            if (btnReal) {
                const ctaEl = btnReal.querySelector('.mode-cta');
                if (ctaEl) {
                    ctaEl.innerHTML = `<span>Iniciar simulacro real</span> <i class="fas fa-arrow-right"></i>`;
                }
            }
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
                        // EXCEPCIÓN: Permitir Modo Rápido (Arcade) para Invitados con LÍMITE (1 al día)
                        const isArcade = id === 'btn-mode-arcade';

                        if (isArcade) {
                            const canTake = window.GuestSessionManager 
                                ? window.GuestSessionManager.canTakeDailyDemo()
                                : parseInt(localStorage.getItem('demo_sessions_count') || '0', 10) < 1;

                            if (!canTake) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.uiManager.showAuthPromptModal();
                                return;
                            }

                            // 🛡️ Bloqueo si no hay configuración aplicada para visitante
                            if (!activeConfig) {
                                e.preventDefault();
                                e.stopPropagation();

                                const btnOpen = document.getElementById('btn-start-config');
                                if (btnOpen) {
                                    btnOpen.click(); // Abrimos el modal

                                    // Efecto visual para hacer énfasis en que deben configurar
                                    const modalContent = document.querySelector('.config-modal-content');
                                    if (modalContent) {
                                        modalContent.style.animation = 'shake 0.4s ease-in-out';
                                        setTimeout(() => modalContent.style.animation = '', 400);
                                    }

                                    // Si no existe la animación global, la añadimos dinámicamente
                                    if (!document.getElementById('shake-anim')) {
                                        const style = document.createElement('style');
                                        style.id = 'shake-anim';
                                        style.textContent = `@keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-10px);} 75% {transform: translateX(10px);} }`;
                                        document.head.appendChild(style);
                                    }
                                }
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

                    // 🛡️ GATEKEEPER DE CONFIGURACIÓN (Solo para Registrados)
                    // Evita que inicien un examen en blanco o que se mezclen áreas por defecto
                    if (token && !activeConfig) {
                        e.preventDefault();
                        e.stopPropagation();

                        const btnOpen = document.getElementById('btn-start-config');
                        if (btnOpen) {
                            btnOpen.click(); // Abrimos el modal

                            // Efecto visual para hacer énfasis en que deben configurar
                            const modalContent = document.querySelector('.config-modal-content');
                            if (modalContent) {
                                modalContent.style.animation = 'shake 0.4s ease-in-out';
                                setTimeout(() => modalContent.style.animation = '', 400);
                            }

                            // Si no existe la animación global, la añadimos dinámicamente
                            if (!document.getElementById('shake-anim')) {
                                const style = document.createElement('style');
                                style.id = 'shake-anim';
                                style.textContent = `@keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-10px);} 75% {transform: translateX(10px);} }`;
                                document.head.appendChild(style);
                            }
                        }
                        return;
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

                    // 🚀 Feedback táctil inmediato de preparación de examen
                    const ctaEl = btn.querySelector('.mode-cta');
                    if (ctaEl) {
                        ctaEl.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Preparando...`;
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
        const areasGrid = document.getElementById('config-areas-grid');
        const summaryBox = document.getElementById('active-config-summary');

        if (!modal || !btnOpen || !areasGrid) return; // Guard for non-dashboard pages

        const areasContainer = document.getElementById('areas-config-container');

        const updateConfigModeUI = () => {
            const selectedMode = document.querySelector('input[name="configMode"]:checked')?.value || 'default';
            
            // Toggle active class on option labels
            const options = document.querySelectorAll('.mode-toggle-option');
            options.forEach(opt => {
                const radio = opt.querySelector('input');
                if (radio && radio.checked) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });

            // Control de visualización armónico (Oculto en examen oficial, desplegado en personalizada)
            if (areasContainer) {
                if (selectedMode === 'default') {
                    areasContainer.style.display = 'none';
                } else {
                    areasContainer.style.display = 'block';
                    areasContainer.style.animation = 'fadeInSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                }
            }

            const checkboxes = areasGrid.querySelectorAll('input[type="checkbox"]');
            if (selectedMode === 'default') {
                checkboxes.forEach(cb => {
                    cb.checked = true;
                    cb.disabled = true;
                });
            } else {
                checkboxes.forEach(cb => {
                    cb.disabled = false;
                });
                // Restore checked state based on activeConfig.areas
                if (activeConfig && activeConfig.areas && activeConfig.configType === 'custom') {
                    checkboxes.forEach(cb => {
                        if (cb.classList.contains('group-header-checkbox')) return;
                        cb.checked = activeConfig.areas.includes(cb.value);
                    });
                }
                // Update header checkboxes
                const headers = areasGrid.querySelectorAll('.group-header-checkbox');
                headers.forEach(hCb => {
                    const nextGrid = hCb.closest('label').closest('div').nextElementSibling;
                    if (nextGrid && nextGrid.style.display === 'grid') {
                        const childCbs = Array.from(nextGrid.querySelectorAll('input[type="checkbox"]'));
                        hCb.checked = childCbs.every(cb => cb.checked);
                    }
                });
            }
        };

        const modeOptionLabels = document.querySelectorAll('.mode-toggle-option');
        modeOptionLabels.forEach(label => {
            label.addEventListener('click', (e) => {
                const radio = label.querySelector('input[name="configMode"]');
                if (radio) {
                    const token = localStorage.getItem('authToken');
                    if (!token && radio.value === 'custom') {
                        e.preventDefault();
                        const defaultRadio = document.querySelector('input[name="configMode"][value="default"]');
                        if (defaultRadio) defaultRadio.checked = true;
                        updateConfigModeUI();
                        if (window.uiManager) {
                            window.uiManager.showAuthPromptModal();
                        }
                        return;
                    }
                    radio.checked = true;
                    updateConfigModeUI();
                }
            });
        });

        const modeRadioButtons = document.getElementsByName('configMode');
        if (modeRadioButtons.length > 0) {
            modeRadioButtons.forEach(radio => {
                radio.addEventListener('change', () => {
                    const token = localStorage.getItem('authToken');
                    if (!token && radio.value === 'custom' && radio.checked) {
                        // Revert to default configuration mode for guests
                        const defaultRadio = document.querySelector('input[name="configMode"][value="default"]');
                        if (defaultRadio) defaultRadio.checked = true;
                        updateConfigModeUI();
                        if (window.uiManager) {
                            window.uiManager.showAuthPromptModal();
                        }
                        return;
                    }
                    updateConfigModeUI();
                });
            });
        }

        // Render grouped checkboxes with sub-headers
        const renderAreas = (target) => {
            areasGrid.innerHTML = '';

            areasGrid.style.display = 'flex';
            areasGrid.style.flexDirection = 'column';
            areasGrid.style.gap = '1rem';

            // Filter groups: conditional groups depend on target
            let groupsToRender = examAreasGrouped.filter(g => {
                if (g.conditionalTarget && g.conditionalTarget !== target) return false;
                return true;
            });

            groupsToRender.forEach(group => {
                // Group header with a styled check/uncheck checkbox
                const header = document.createElement('div');
                const accentColor = currentContext === 'EDUCACION' ? '#3b82f6' : '#14b8a6';
                header.style.cssText = `display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; margin-top:0.25rem; padding-bottom:0.3rem; border-bottom:1px solid ${accentColor}26;`;

                const headerLabel = document.createElement('label');
                headerLabel.style.cssText = 'display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none;';

                const headerCheckbox = document.createElement('input');
                headerCheckbox.type = 'checkbox';
                headerCheckbox.className = 'group-header-checkbox';
                headerCheckbox.style.cssText = `accent-color:${accentColor}; cursor:pointer; margin: 0; width:12px; height:12px;`;

                const headerTitle = document.createElement('span');
                headerTitle.textContent = group.label;

                headerLabel.appendChild(headerCheckbox);
                headerLabel.appendChild(headerTitle);
                header.appendChild(headerLabel);
                areasGrid.appendChild(header);

                // Checkbox grid for this group
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;';

                const childCheckboxes = [];

                group.areas.forEach(area => {
                    const label = document.createElement('label');
                    label.className = 'area-checkbox-label';

                    let isChecked = true;
                    if (activeConfig && activeConfig.target === target && activeConfig.areas) {
                        isChecked = activeConfig.areas.includes(area);
                    }

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = area;
                    checkbox.checked = isChecked;

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${area}`));
                    grid.appendChild(label);
                    childCheckboxes.push(checkbox);
                });

                // Update group header checkbox state initially
                const updateHeaderState = () => {
                    const selectedMode = document.querySelector('input[name="configMode"]:checked')?.value || 'default';
                    if (selectedMode === 'default') {
                        headerCheckbox.checked = true;
                        headerCheckbox.disabled = true;
                        return;
                    }
                    headerCheckbox.disabled = false;
                    const allChecked = childCheckboxes.every(cb => cb.checked);
                    headerCheckbox.checked = allChecked;
                };
                updateHeaderState();

                // Group toggle event
                headerCheckbox.addEventListener('change', (e) => {
                    const selectedMode = document.querySelector('input[name="configMode"]:checked')?.value || 'default';
                    if (selectedMode === 'default') return;
                    const checked = e.target.checked;
                    childCheckboxes.forEach(cb => {
                        cb.checked = checked;
                    });
                });

                // Child checkbox event to update header state
                childCheckboxes.forEach(cb => {
                    cb.addEventListener('change', () => {
                        updateHeaderState();
                    });
                });

                areasGrid.appendChild(grid);
            });

            // Re-apply toggle state after rendering
            updateConfigModeUI();
        };

        // Render exam target radio buttons dynamically
        const renderTargets = (targetsList) => {
            const targetContainer = document.querySelector('#config-modal-overlay .exam-target-grid');
            if (window.innerWidth > 520) {
                targetContainer.style.gridTemplateColumns = `repeat(${targetsList.length}, 1fr)`;
            } else {
                targetContainer.style.gridTemplateColumns = '1fr';
            }
            targetContainer.innerHTML = '';

            // Determine preselected target
            const defaultTargetObj = targetsList.find(t => t.checked) || targetsList[0];
            let activeTarget = (activeConfig && activeConfig.target) ? activeConfig.target : defaultTargetObj.value;

            const hasActive = targetsList.some(t => t.value === activeTarget);
            if (!hasActive) activeTarget = defaultTargetObj.value;

            targetsList.forEach(t => {
                const label = document.createElement('label');
                label.className = `exam-target-option ${t.disabled ? 'target-option--disabled' : ''}`;
                const subtitleHtml = t.subtitle
                    ? `<span style="display:block;font-size:0.6rem;opacity:0.7;font-weight:400;">${t.subtitle}</span>`
                    : '';
                const isChecked = t.value === activeTarget;
                label.innerHTML = `
                        <input type="radio" name="examTarget" value="${t.value}" ${isChecked ? 'checked' : ''} ${t.disabled ? 'disabled' : ''}>
                        <div class="target-card" style="${t.disabled ? 'opacity: 0.4; cursor: not-allowed; border-color: rgba(255,255,255,0.05);' : ''}">${t.label}${subtitleHtml}</div>
                    `;
                targetContainer.appendChild(label);
            });

            // Bind click events on the dynamic inputs
            const radioInputs = targetContainer.querySelectorAll('input');
            radioInputs.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        handleTargetChange(e.target.value);
                    }
                });
            });
        };

        const handleTargetChange = (t) => {
            // Toggle SERUMS-specific UI (medicine only)
            if (currentContext === 'MEDICINA') {
                const serumsInfo = document.getElementById('serums-info-alert');
                if (serumsInfo) serumsInfo.style.display = t === 'SERUMS' ? 'block' : 'none';
                const careerBox = document.getElementById('serums-career-container');
                if (careerBox) careerBox.style.display = t === 'SERUMS' ? 'block' : 'none';
            }

            // Default area selection logic
            let defaultAreas = [];
            if (t === 'ENAM') {
                defaultAreas = examAreasGrouped.filter(g => g.label !== 'Ciencias Básicas' && !g.conditionalTarget).flatMap(g => g.areas);
            } else if (t === 'SERUMS') {
                const healthGroup = examAreasGrouped.find(g => g.label.includes('Salud Pública'));
                defaultAreas = healthGroup ? healthGroup.areas : examAreasGrouped[0].areas;
            } else {
                defaultAreas = examAreasGrouped
                    .filter(g => !g.conditionalTarget || g.conditionalTarget === t)
                    .flatMap(g => g.areas);
            }

            if (activeConfig) {
                activeConfig.target = t;
                activeConfig.areas = defaultAreas;
            } else {
                activeConfig = { target: t, areas: defaultAreas };
            }
            renderAreas(t);
        };

        // Open Modal
        if (btnOpen) {
            btnOpen.onclick = (e) => {
                const token = localStorage.getItem('authToken');

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
                const ctxConfig = contexts[currentContext] || contexts['MEDICINA'];

                // Show/hide SERUMS-specific UI (only for medicine)
                const careerBox = document.getElementById('serums-career-container');
                const careerTitle = careerBox ? careerBox.querySelector('.modal-section-title') : null;

                if (currentContext === 'MEDICINA') {
                    if (careerBox) {
                        const activeRadio = document.querySelector('.exam-target-option input:checked');
                        careerBox.style.display = (activeRadio && activeRadio.value === 'SERUMS') ? 'block' : 'none';
                    }
                } else if (currentContext === 'EDUCACION') {
                    if (careerBox) {
                        careerBox.style.display = 'block';
                        if (careerTitle) careerTitle.textContent = 'Modalidad / Nivel';
                    }
                }

                const careerSelect = document.getElementById('config-career');
                if (activeConfig && activeConfig.career && careerSelect) {
                    let level = 'EBR - Primaria';
                    let specialty = 'General';
                    
                    const cVal = activeConfig.career;
                    if (cVal === 'EBR - Inicial') {
                        level = 'EBR - Inicial';
                    } else if (cVal === 'EBR - Primaria') {
                        level = 'EBR - Primaria';
                    } else if (cVal === 'EBR Primaria Profesor de Innovación Pedagógica') {
                        level = 'EBR - Primaria';
                        specialty = 'Profesor de Innovación Pedagógica';
                    } else if (cVal === 'EBR Primaria Educación Física') {
                        level = 'EBR - Primaria';
                        specialty = 'Educación Física';
                    } else if (cVal.startsWith('EBR - Secundaria')) {
                        level = 'EBR - Secundaria';
                        specialty = cVal.replace('EBR - Secundaria - ', '');
                    } else {
                        // Fallback parsing
                        const careerParts = cVal.split(' - ');
                        level = (careerParts[0] && careerParts[1]) ? `${careerParts[0]} - ${careerParts[1]}` : careerParts[0];
                        specialty = careerParts[2] || 'General';
                    }

                    careerSelect.value = level;
                    if (window._updateEduSpecialties) {
                        window._updateEduSpecialties(specialty);
                    }
                } else if (window._updateEduSpecialties) {
                    // Default for first time or no config
                    if (careerSelect && currentContext === 'EDUCACION') careerSelect.value = 'EBR - Primaria';
                    window._updateEduSpecialties();
                }

                // Render dynamic targets based on selected language/career
                const activeLang = careerSelect ? careerSelect.value : 'en-US';
                const initialTargets = ctxConfig.targets || (ctxConfig.getTargetsForLang ? ctxConfig.getTargetsForLang(activeLang) : null);
                renderTargets(initialTargets);

                // Bind unified change event for career/language select
                if (careerSelect) {
                    careerSelect.onchange = () => {
                        if (currentContext === 'MEDICINA') {
                            const activeRadio = document.querySelector('.exam-target-option input:checked');
                            if (activeRadio) renderAreas(activeRadio.value);
                        } else if (currentContext === 'EDUCACION') {
                            if (window._updateEduSpecialties) window._updateEduSpecialties();
                        }
                    };
                }

                const finalRadio = document.querySelector('.exam-target-option input:checked');
                const finalTarget = finalRadio ? finalRadio.value : 'MCER';

                if (currentContext === 'MEDICINA') {
                    const serumsInfo = document.getElementById('serums-info-alert');
                    if (serumsInfo) serumsInfo.style.display = finalTarget === 'SERUMS' ? 'block' : 'none';
                }

                // Preselect configMode based on activeConfig.configType (force default for guests)
                const modeVal = (activeConfig && activeConfig.configType && token) ? activeConfig.configType : 'default';
                const radioDefault = document.querySelector('input[name="configMode"][value="default"]');
                const radioCustom = document.querySelector('input[name="configMode"][value="custom"]');
                if (modeVal === 'default') {
                    if (radioDefault) radioDefault.checked = true;
                } else {
                    if (radioCustom) radioCustom.checked = true;
                }

                renderAreas(finalTarget);
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

        // Save Config
        if (btnSave) {
            btnSave.onclick = async () => {
                const target = document.querySelector('.exam-target-option input:checked').value;
                const configType = document.querySelector('input[name="configMode"]:checked')?.value || 'default';
                
                let selectedAreas;
                if (configType === 'default') {
                    selectedAreas = Array.from(areasGrid.querySelectorAll('.area-checkbox-label input')).map(cb => cb.value);
                } else {
                    selectedAreas = Array.from(areasGrid.querySelectorAll('.area-checkbox-label input:checked')).map(cb => cb.value);
                }

                const careerSelectEl = document.getElementById('config-career');
                const ctxCfg = contexts[currentContext] || contexts['MEDICINA'];
                let career = null;

                if (currentContext === 'MEDICINA' && target === 'SERUMS' && careerSelectEl) {
                    career = careerSelectEl.value;
                } else if (ctxCfg.careerOptions && careerSelectEl) {
                    career = careerSelectEl.value;
                    if (currentContext === 'EDUCACION') {
                        // Append specialty for Primaria (if not General) or Secundaria
                        const specSelect = document.getElementById('config-specialty');
                        if (specSelect && specSelect.value && specSelect.value !== 'General') {
                            if (career === 'EBR - Primaria') {
                                if (specSelect.value === 'Profesor de Innovación Pedagógica') {
                                    career = 'EBR Primaria Profesor de Innovación Pedagógica';
                                } else if (specSelect.value === 'Educación Física') {
                                    career = 'EBR Primaria Educación Física';
                                } else {
                                    career = `EBR Primaria ${specSelect.value}`;
                                }
                            } else {
                                career = `${career} - ${specSelect.value}`;
                            }
                        }
                    }
                }

                if (selectedAreas.length === 0) {
                    if (window.uiManager) window.uiManager.showToast('Debes seleccionar al menos un área de estudio.', 'warning');
                    else alert('Debes seleccionar al menos un área de estudio.');
                    return;
                }

                // Show basic loading state on button
                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                btnSave.disabled = true;

                activeConfig = { configType, target, areas: selectedAreas, career };
                localStorage.setItem(`simActiveConfig_${currentContext}`, JSON.stringify(activeConfig)); // Persist locally
                const activeSessionUserId = (window.sessionManager && window.sessionManager.getUser()) ? window.sessionManager.getUser().id : 'guest';
                localStorage.removeItem(`simulator_active_session_${activeSessionUserId}`); // Clear any pending quiz session on config change

                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        // Persist to Database for Cross-Device Sync
                        await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/users/preferences`, {
                            method: 'POST',
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
                renderConfigSummary(summaryBox, {
                    target: target,
                    career: career,
                    areas: selectedAreas
                });

                // Update Links
                updateModeLinks(contexts[currentContext] || contexts['MEDICINA']);

                // Quitar efecto neón — ya configuró
                const cfgBtn = document.getElementById('btn-start-config');
                if (cfgBtn) cfgBtn.classList.remove('neon-active');

                // Relanzar actualización: fetch a backend si está autenticado, o refresh de demo data si es visitante
                if (token) {
                    loadStats();
                    loadEvolution();
                } else {
                    renderGuestDemoData();
                }

                closeModal();
            };
        }
    }


    async function loadEvolution() {
        const token = localStorage.getItem('authToken');
        try {
            let qs = `?context=${currentContext}`;
            if (activeConfig && activeConfig.target) qs += `&target=${encodeURIComponent(activeConfig.target)}`;
            if (activeConfig && activeConfig.areas && activeConfig.areas.length > 0) {
                qs += `&areas=${encodeURIComponent(activeConfig.areas.join(','))}`;
            }
            let careerVal = (activeConfig && activeConfig.career) ? activeConfig.career : null;
            if (!careerVal) {
                if (currentContext === 'MEDICINA') careerVal = 'Medicina Humana';
                else if (currentContext === 'EDUCACION') careerVal = 'EBR - Primaria';
            }
            if (careerVal) qs += `&career=${encodeURIComponent(careerVal)}`;
            if (activeMode) qs += `&limit=${activeMode}`;   // Filtro por modo
            if (activeDays) qs += `&days=${activeDays}`;     // Filtro por tiempo

            let apiBase = '/api/medico';
            if (currentContext === 'EDUCACION') apiBase = '/api/docente';

            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}${apiBase}/evolution${qs}`);
            const data = await res.json();

            if (lineChartInst) lineChartInst.destroy();

            const evoCanvas = document.getElementById('evolutionChart');
            const evoEmpty = document.getElementById('evolution-empty-state');

            if (data.success && data.chart && data.chart.labels && data.chart.labels.length > 0) {
                if (evoCanvas) evoCanvas.style.display = 'block';
                if (evoEmpty) evoEmpty.style.display = 'none';

                if (!evoCanvas) return; // Guard for non-dashboard pages

                const evolutionCtx = evoCanvas.getContext('2d');
                // Helpers para la línea de aprobatoria
                const approvalLine = {
                    id: 'approvalLine',
                    afterDatasetsDraw(chart) {
                        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                        const yPos = y.getPixelForValue(14);
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([6, 4]);
                        ctx.moveTo(left, yPos);
                        ctx.lineTo(right, yPos);
                        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
                        ctx.font = '600 10px Inter, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText('Aprobatorio ≥ 14', right - 4, yPos - 5);
                        ctx.restore();
                    }
                };

                lineChartInst = new Chart(evolutionCtx, {
                    type: 'line',
                    data: {
                        labels: data.chart.labels,
                        datasets: [
                            {
                                label: 'Modo Rápido (10 qs)',
                                data: data.chart.scores10 || [],
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.03)',
                                borderWidth: 3,
                                pointBackgroundColor: '#1e293b',
                                pointBorderColor: '#34d399',
                                pointBorderWidth: 2,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                tension: 0.4,
                                fill: true,
                                spanGaps: true
                            },
                            {
                                label: 'Modo Estudio (20 qs)',
                                data: data.chart.scores20 || [],
                                borderColor: '#3b82f6',
                                backgroundColor: 'rgba(59, 130, 246, 0.03)',
                                borderWidth: 3,
                                pointBackgroundColor: '#1e293b',
                                pointBorderColor: '#60a5fa',
                                pointBorderWidth: 2,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                tension: 0.4,
                                fill: true,
                                spanGaps: true
                            },
                            {
                                label: 'Simulacros Reales',
                                data: data.chart.scoresReal || [],
                                borderColor: '#f59e0b',
                                backgroundColor: 'rgba(245, 158, 11, 0.03)',
                                borderWidth: 3,
                                pointBackgroundColor: '#1e293b',
                                pointBorderColor: '#fbbf24',
                                pointBorderWidth: 2,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                tension: 0.4,
                                fill: true,
                                spanGaps: true
                            }
                        ]
                    },
                    plugins: [approvalLine],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: { 
                                    color: document.documentElement.getAttribute('data-theme') === 'light' ? '#334155' : '#cbd5e1', 
                                    boxWidth: 12, 
                                    font: { size: 11, weight: '600', family: 'Inter, sans-serif' } 
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} / 20`
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: 0,
                                max: 20,
                                grid: { color: document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)' },
                                ticks: {
                                    color: document.documentElement.getAttribute('data-theme') === 'light' ? '#475569' : '#94a3b8',
                                    stepSize: 2,
                                    font: { family: 'Inter, sans-serif' },
                                    callback: (v) => v
                                },
                                title: {
                                    display: true,
                                    text: 'Nota (0–20)',
                                    color: document.documentElement.getAttribute('data-theme') === 'light' ? '#1e293b' : '#cbd5e1',
                                    font: { size: 11, weight: '600', family: 'Inter, sans-serif' }
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { 
                                    color: document.documentElement.getAttribute('data-theme') === 'light' ? '#475569' : '#94a3b8', 
                                    font: { size: 11, family: 'Inter, sans-serif' } 
                                },
                                title: {
                                    display: true,
                                    text: 'Intentos Recientes',
                                    color: document.documentElement.getAttribute('data-theme') === 'light' ? '#1e293b' : '#cbd5e1',
                                    font: { size: 11, weight: '600', family: 'Inter, sans-serif' }
                                }
                            }
                        }
                    }
                });

                // Apply dataset visibility filters based on activeMode tab
                if (activeMode === 10) {
                    lineChartInst.setDatasetVisibility(0, true);
                    lineChartInst.setDatasetVisibility(1, false);
                    lineChartInst.setDatasetVisibility(2, false);
                } else if (activeMode === 20) {
                    lineChartInst.setDatasetVisibility(0, false);
                    lineChartInst.setDatasetVisibility(1, true);
                    lineChartInst.setDatasetVisibility(2, false);
                } else if (activeMode === 'real') {
                    lineChartInst.setDatasetVisibility(0, false);
                    lineChartInst.setDatasetVisibility(1, false);
                    lineChartInst.setDatasetVisibility(2, true);
                } else {
                    lineChartInst.setDatasetVisibility(0, true);
                    lineChartInst.setDatasetVisibility(1, true);
                    lineChartInst.setDatasetVisibility(2, true);
                }
                lineChartInst.update();
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
            if (activeConfig && activeConfig.areas && activeConfig.areas.length > 0) {
                qs += `&areas=${encodeURIComponent(activeConfig.areas.join(','))}`;
            }
            let careerVal = (activeConfig && activeConfig.career) ? activeConfig.career : null;
            if (!careerVal) {
                if (currentContext === 'MEDICINA') careerVal = 'Medicina Humana';
                else if (currentContext === 'EDUCACION') careerVal = 'EBR - Primaria';
            }
            if (careerVal) qs += `&career=${encodeURIComponent(careerVal)}`;
            if (activeMode) qs += `&limit=${activeMode}`;   // Filtro por modo (10 = Rápido, 20 = Estudio)
            if (activeDays) qs += `&days=${activeDays}`;     // Filtro por tiempo (7, 30)
            let apiBase = '/api/medico';
            if (currentContext === 'EDUCACION') apiBase = '/api/docente';

            const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}${apiBase}/stats${qs}`);
            const data = await res.json();
            cachedStats = data.kpis; // Store for AI Analysis

            // Render Stats
            const kpis = data.kpis;
            const scoreEl = document.getElementById('stat-score');
            const accuracyEl = document.getElementById('stat-accuracy');
            const countsEl = document.getElementById('stat-counts-text');
            const totalCountEl = document.getElementById('stat-counts-total');
            const scoreBar = document.getElementById('kpi-score-bar');
            const accuracyBar = document.getElementById('kpi-accuracy-bar');
            const correctPill = document.getElementById('kpi-correct-pill');
            const incorrectPill = document.getElementById('kpi-incorrect-pill');
            const correctBar = document.getElementById('kpi-correct-bar');
            const incorrectBar = document.getElementById('kpi-incorrect-bar');

            const avgScoreNum = parseFloat(kpis.avg_score || 0);
            const accuracyNum = Math.round(parseFloat(kpis.accuracy || 0));
            const totalCorrect = parseInt(kpis.total_correct || 0, 10);
            const totalIncorrect = parseInt(kpis.total_incorrect || 0, 10);
            const totalAnswered = totalCorrect + totalIncorrect;

            if (scoreEl) scoreEl.textContent = kpis.avg_score || '0.0';
            if (scoreBar) scoreBar.style.width = `${Math.min(100, Math.max(0, (avgScoreNum / 20) * 100))}%`;

            const scoreSubEl = document.getElementById('stat-score-sub');
            if (scoreSubEl) {
                scoreSubEl.textContent = "Basado en tus últimos simulacros";
            }

            if (accuracyEl) accuracyEl.textContent = `${accuracyNum}%`;
            if (accuracyBar) accuracyBar.style.width = `${Math.min(100, Math.max(0, accuracyNum))}%`;

            if (totalCountEl) totalCountEl.textContent = totalAnswered;
            if (countsEl) countsEl.textContent = `${totalCorrect} / ${totalIncorrect}`;
            if (correctPill) correctPill.innerHTML = `<i class="fas fa-check"></i> ${totalCorrect} C`;
            if (incorrectPill) incorrectPill.innerHTML = `<i class="fas fa-xmark"></i> ${totalIncorrect} I`;

            if (correctBar && incorrectBar) {
                if (totalAnswered > 0) {
                    correctBar.style.width = `${(totalCorrect / totalAnswered) * 100}%`;
                    incorrectBar.style.width = `${(totalIncorrect / totalAnswered) * 100}%`;
                } else {
                    correctBar.style.width = '50%';
                    incorrectBar.style.width = '50%';
                }
            }

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

            // --- Render Doughnut Chart (Distribución por Áreas / Topics Reales) ---
            const doughnutData = {};
            kpis.radar_data?.forEach(d => {
                let cleanSubject = d.subject || 'General';
                if (cleanSubject.includes(',')) cleanSubject = cleanSubject.split(',')[0].trim();
                const totalCount = parseInt(d.total || 0, 10);
                if (totalCount > 0) {
                    doughnutData[cleanSubject] = (doughnutData[cleanSubject] || 0) + totalCount;
                }
            });
            renderDoughnutChart(doughnutData);

            // --- AI Diagnostic Strengths / Weaknesses ---
            const strengthsEl = document.getElementById('ai-strengths-content');
            const weaknessesEl = document.getElementById('ai-weaknesses-content');
            if (strengthsEl && kpis.strengths) {
                strengthsEl.innerHTML = kpis.strengths;
            }
            if (weaknessesEl && kpis.weaknesses) {
                weaknessesEl.innerHTML = kpis.weaknesses;
            }
        } catch (err) {
            console.error('Error fetching statistics:', err);
        }
    }

    function renderGuestDemoData() {

        // 2. KPI Demo values
        const scoreEl = document.getElementById('stat-score');
        const accuracyEl = document.getElementById('stat-accuracy');
        const countsEl = document.getElementById('stat-counts-text');
        const totalCountEl = document.getElementById('stat-counts-total');
        const scoreBar = document.getElementById('kpi-score-bar');
        const accuracyBar = document.getElementById('kpi-accuracy-bar');
        const correctPill = document.getElementById('kpi-correct-pill');
        const incorrectPill = document.getElementById('kpi-incorrect-pill');
        const correctBar = document.getElementById('kpi-correct-bar');
        const incorrectBar = document.getElementById('kpi-incorrect-bar');

        let currentAvgScore = '14.5';
        if (scoreEl) scoreEl.textContent = currentAvgScore;
        if (scoreBar) scoreBar.style.width = `${(14.5 / 20) * 100}%`;

        if (accuracyEl) accuracyEl.textContent = '72%';
        if (accuracyBar) accuracyBar.style.width = '72%';

        if (totalCountEl) totalCountEl.textContent = '70';
        if (countsEl) countsEl.textContent = '50 / 20';
        if (correctPill) correctPill.innerHTML = '<i class="fas fa-check"></i> 50 C';
        if (incorrectPill) incorrectPill.innerHTML = '<i class="fas fa-xmark"></i> 20 I';

        if (correctBar) correctBar.style.width = `${(50 / 70) * 100}%`;
        if (incorrectBar) incorrectBar.style.width = `${(20 / 70) * 100}%`;

        // 3. Evolution Chart Demo (Context-Aware)
        const evoCanvas = document.getElementById('evolutionChart');
        const evoEmpty = document.getElementById('evolution-empty-state');
        if (evoEmpty) evoEmpty.style.display = 'none';
        if (evoCanvas) {
            evoCanvas.style.display = 'block';
            // --- 🧹 LIMPIEZA DE CANVAS ---
            if (lineChartInst) {
                lineChartInst.destroy();
                lineChartInst = null;
            }

            const evolutionCtx = evoCanvas.getContext('2d');
            // Plugin línea de aprobatoria (también en demo)
            const approvalLineDemo = {
                id: 'approvalLineDemo',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                    const yPos = y.getPixelForValue(14);
                    ctx.save();
                    ctx.beginPath();
                    ctx.setLineDash([6, 4]);
                    ctx.moveTo(left, yPos);
                    ctx.lineTo(right, yPos);
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
                    ctx.font = '600 10px Inter, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText('Aprobatorio ≥ 14', right - 4, yPos - 5);
                    ctx.restore();
                }
            };

            let demoLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];
            let demoScores10 = [11.0, 13.0, 12.0, 15.0, 14.5];
            let demoScores20 = [12.0, 11.5, 13.8, 14.2, 16.0];
            let demoScoresReal = [10.0, 11.8, 12.5, 13.0, 14.2];

            if (currentContext === 'EDUCACION') {
                demoLabels = ['Sesión 1', 'Sesión 2', 'Sesión 3', 'Sesión 4', 'Sesión 5'];
                demoScores10 = [12.5, 13.8, 14.2, 15.0, 15.8];
                demoScores20 = [11.0, 12.5, 13.0, 14.5, 15.0];
                demoScoresReal = [10.0, 11.5, 12.2, 13.8, 14.5];
            }

            lineChartInst = new Chart(evolutionCtx, {
                type: 'line',
                data: {
                    labels: demoLabels,
                    datasets: [
                        {
                            label: 'Modo Rápido (10 qs) [Demo]',
                            data: demoScores10,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.03)',
                            borderWidth: 3,
                            pointBackgroundColor: '#1e293b',
                            pointBorderColor: '#34d399',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.4,
                            fill: true,
                            spanGaps: true
                        },
                        {
                            label: 'Modo Estudio (20 qs) [Demo]',
                            data: demoScores20,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.03)',
                            borderWidth: 3,
                            pointBackgroundColor: '#1e293b',
                            pointBorderColor: '#60a5fa',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.4,
                            fill: true,
                            spanGaps: true
                        },
                        {
                            label: 'Simulacros Reales [Demo]',
                            data: demoScoresReal,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.03)',
                            borderWidth: 3,
                            pointBackgroundColor: '#1e293b',
                            pointBorderColor: '#fbbf24',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.4,
                            fill: true,
                            spanGaps: true
                        }
                    ]
                },
                plugins: [approvalLineDemo],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 0, max: 20,
                            grid: { color: document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)' },
                            ticks: { 
                                color: document.documentElement.getAttribute('data-theme') === 'light' ? '#475569' : '#94a3b8', 
                                stepSize: 2,
                                font: { family: 'Inter, sans-serif' }
                            },
                            title: {
                                display: true,
                                text: 'Nota (0–20)',
                                color: document.documentElement.getAttribute('data-theme') === 'light' ? '#1e293b' : '#cbd5e1',
                                font: { size: 11, weight: '600', family: 'Inter, sans-serif' }
                            }
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { 
                                color: document.documentElement.getAttribute('data-theme') === 'light' ? '#475569' : '#94a3b8',
                                font: { family: 'Inter, sans-serif' }
                            },
                            title: {
                                display: true,
                                text: 'Intentos Recientes',
                                color: document.documentElement.getAttribute('data-theme') === 'light' ? '#1e293b' : '#cbd5e1',
                                font: { size: 11, weight: '600', family: 'Inter, sans-serif' }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { 
                                color: document.documentElement.getAttribute('data-theme') === 'light' ? '#334155' : '#cbd5e1', 
                                boxWidth: 12, 
                                font: { size: 11, weight: '600', family: 'Inter, sans-serif' } 
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} / 20`
                            }
                        }
                    }
                }
            });

            // Apply dataset visibility filters based on activeMode tab for Demo
            if (activeMode === 10) {
                lineChartInst.setDatasetVisibility(0, true);
                lineChartInst.setDatasetVisibility(1, false);
                lineChartInst.setDatasetVisibility(2, false);
            } else if (activeMode === 20) {
                lineChartInst.setDatasetVisibility(0, false);
                lineChartInst.setDatasetVisibility(1, true);
                lineChartInst.setDatasetVisibility(2, false);
            } else if (activeMode === 'real') {
                lineChartInst.setDatasetVisibility(0, false);
                lineChartInst.setDatasetVisibility(1, false);
                lineChartInst.setDatasetVisibility(2, true);
            } else {
                lineChartInst.setDatasetVisibility(0, true);
                lineChartInst.setDatasetVisibility(1, true);
                lineChartInst.setDatasetVisibility(2, true);
            }
            lineChartInst.update();
        }

        // 4. Bar Chart Demo (Context-Aware Mock Data)
        const demoAreasMap = currentContext === 'EDUCACION' ? {
            'Enfoque por competencias': { correct: 88, total: 100 },
            'Constructivismo y socioconstructivismo': { correct: 75, total: 100 },
            'Planificación pedagógica': { correct: 68, total: 100 },
            'Evaluación formativa y retroalimentación': { correct: 62, total: 100 },
            'Convivencia democrática y clima de aula': { correct: 55, total: 100 },
            'Características y desarrollo del estudiante': { correct: 50, total: 100 }
        } : {
            'Ética e Interculturalidad': { correct: 85, total: 100 },
            'Salud Pública': { correct: 80, total: 100 },
            'Gestión de Servicios de Salud': { correct: 75, total: 100 },
            'Investigación': { correct: 68, total: 100 },
            'Cuidado Integral de Salud': { correct: 60, total: 100 }
        };

        // 4b. Doughnut Chart Demo
        const demoDoughnutData = currentContext === 'MEDICINA' ? {
            'Ética e Interculturalidad': 8,
            'Salud Pública': 15,
            'Gestión de Servicios de Salud': 9,
            'Investigación': 6,
            'Cuidado Integral de Salud': 12
        } : {
            'Enfoques y Principios del CNEB': 14,
            'Teorías y Procesos del Aprendizaje': 22,
            'Planificación y Evaluación': 18,
            'Clima Escolar e Inclusión': 11
        };

        // Si el usuario configuró áreas específicas, adaptar los gráficos a dicha selección
        let activeBarData = demoAreasMap;
        let activeDoughnutData = demoDoughnutData;

        if (activeConfig && Array.isArray(activeConfig.areas) && activeConfig.areas.length > 0) {
            const filteredBar = {};
            const filteredDoughnut = {};
            activeConfig.areas.forEach(area => {
                if (demoAreasMap[area]) {
                    filteredBar[area] = demoAreasMap[area];
                }
                if (demoDoughnutData[area]) {
                    filteredDoughnut[area] = demoDoughnutData[area];
                }
            });
            if (Object.keys(filteredBar).length > 0) activeBarData = filteredBar;
            if (Object.keys(filteredDoughnut).length > 0) activeDoughnutData = filteredDoughnut;
        }

        renderBarChart(activeBarData);
        renderDoughnutChart(activeDoughnutData);

        // 5. Persistence: Check for local demo stats (Domain-Specific with 1-Day TTL)
        const stats = window.GuestSessionManager
            ? window.GuestSessionManager.getGuestStats(currentContext)
            : (() => {
                const raw = localStorage.getItem(`guest_demo_stats_${currentContext.toLowerCase()}`);
                return raw ? JSON.parse(raw) : null;
            })();

        if (stats) {
            try {
                currentAvgScore = stats.avgScore || '0';
                if (scoreEl) scoreEl.textContent = currentAvgScore;
                if (scoreBar) scoreBar.style.width = `${(parseFloat(currentAvgScore || 0) / 20) * 100}%`;
                if (accuracyEl) accuracyEl.textContent = `${stats.accuracy || 0}%`;
                if (accuracyBar) accuracyBar.style.width = `${stats.accuracy || 0}%`;
                if (countsEl) countsEl.textContent = `${stats.correct || 0} / ${stats.incorrect || 0}`;
                if (totalCountEl) totalCountEl.textContent = `${(stats.correct || 0) + (stats.incorrect || 0)}`;
                if (correctPill) correctPill.innerHTML = `<i class="fas fa-check"></i> ${stats.correct || 0} C`;
                if (incorrectPill) incorrectPill.innerHTML = `<i class="fas fa-xmark"></i> ${stats.incorrect || 0} I`;
                const totalReactivos = (stats.correct || 0) + (stats.incorrect || 0);
                if (totalReactivos > 0) {
                    if (correctBar) correctBar.style.width = `${((stats.correct || 0) / totalReactivos) * 100}%`;
                    if (incorrectBar) incorrectBar.style.width = `${((stats.incorrect || 0) / totalReactivos) * 100}%`;
                }

                // Update Bar Chart if areaStats exists (Real performance)
                if (stats.areaStats && Object.keys(stats.areaStats).length > 0) {
                    renderBarChart(stats.areaStats);
                    const masteryEl = document.getElementById('stat-mastery');
                    let masteryCount = 0;
                    Object.keys(stats.areaStats).forEach(topic => {
                        const area = stats.areaStats[topic];
                        if (area.total > 0 && (area.correct / area.total) >= 0.70) {
                            masteryCount++;
                        }
                    });
                    if (masteryEl) masteryEl.textContent = masteryCount;

                    // Update Doughnut Chart based on areaStats
                    const guestDoughnut = {};
                    if (currentContext === 'MEDICINA') {
                        const groupDTopics = ['Salud Pública', 'Cuidado Integral de Salud', 'Ética e Interculturalidad', 'Investigación', 'Gestión de Servicios de Salud'];
                        groupDTopics.forEach(t => guestDoughnut[t] = 0);
                        Object.keys(stats.areaStats).forEach(topic => {
                            if (groupDTopics.includes(topic)) {
                                guestDoughnut[topic] += parseInt(stats.areaStats[topic].total || 0, 10);
                            }
                        });
                    } else if (currentContext === 'EDUCACION') {
                        const eduGroups = {
                            'Enfoques y Principios del CNEB': ['Enfoque por competencias', 'Enfoques transversales', 'Principios de la educación peruana'],
                            'Teorías y Procesos del Aprendizaje': ['Constructivismo y socioconstructivismo', 'Aprendizajes significativos', 'Activación y recojo de saberes previos', 'Conflicto o disonancia cognitiva y demanda cognitiva', 'Procesos auxiliares'],
                            'Planificación y Evaluación': ['Planificación pedagógica', 'Evaluación formativa y retroalimentación'],
                            'Clima Escolar e Inclusión': ['Convivencia democrática y clima de aula', 'Educación inclusiva y DUA', 'Características y desarrollo del estudiante']
                        };
                        const eduGroupLabels = Object.keys(eduGroups);
                        eduGroupLabels.forEach(g => guestDoughnut[g] = 0);
                        Object.keys(stats.areaStats).forEach(topic => {
                            for (const gLabel of eduGroupLabels) {
                                if (eduGroups[gLabel].includes(topic)) {
                                    guestDoughnut[gLabel] += parseInt(stats.areaStats[topic].total || 0, 10);
                                    break;
                                }
                            }
                        });
                    }
                    renderDoughnutChart(guestDoughnut);
                }
            } catch (e) { console.error("Error parsing local stats", e); }
        }

        const scoreSubEl = document.getElementById('stat-score-sub');
        if (scoreSubEl) {
            scoreSubEl.textContent = 'Basado en tus últimos simulacros';
        }

        // 6. Ocultar Loading
        const loading = document.getElementById('loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
    }

    /**
     * Configura los listeners para el botón de extracción de Diagnóstico Inteligente por IA.
     */
    function setupAIDiagnostic() {
        const btnAnalyze = document.getElementById('btn-analyze-ai');
        const btnAgain = document.getElementById('btn-analyze-again');

        if (btnAnalyze && !btnAnalyze.dataset.bound) {
            btnAnalyze.dataset.bound = 'true';
            btnAnalyze.addEventListener('click', (e) => {
                e.preventDefault();
                runAIDiagnosis();
            });
        }

        if (btnAgain && !btnAgain.dataset.bound) {
            btnAgain.dataset.bound = 'true';
            btnAgain.addEventListener('click', (e) => {
                e.preventDefault();
                runAIDiagnosis();
            });
        }
    }

    /**
     * Ejecuta el análisis de diagnóstico con IA:
     * - Visitante: Muestra análisis demostrativo contextual con simulación de escaneo.
     * - Free / Basic: Genera diagnóstico estructurado y aviso de activación para Plan Avanzado.
     * - Advanced / Admin: Obtiene análisis personalizado en tiempo real mediante Gemini con sus métricas.
     */
    async function runAIDiagnosis() {
        const initialState = document.getElementById('ai-initial-state');
        const loadingState = document.getElementById('ai-loading-state');
        const resultsState = document.getElementById('ai-results-state');
        const strengthsEl = document.getElementById('ai-strengths');
        const weaknessesEl = document.getElementById('ai-weaknesses');
        const strategyTextEl = document.getElementById('ai-strategy-text');
        const readinessNumEl = document.getElementById('ai-readiness-number');
        const readinessLevelEl = document.getElementById('ai-readiness-level');
        const tierTextEl = document.getElementById('ai-tier-text');
        const tierIndicatorEl = document.getElementById('ai-tier-indicator');
        const strategyBadgeEl = document.getElementById('ai-strategy-badge');
        const highYieldBoxEl = document.getElementById('ai-highyield-box');
        const highYieldTextEl = document.getElementById('ai-highyield-text');
        const sprintGridEl = document.getElementById('ai-sprint-grid');

        const renderDiagnosisUI = (data, isAdvanced) => {
            if (strengthsEl && data.strengths) strengthsEl.innerHTML = data.strengths;
            if (weaknessesEl && data.weaknesses) weaknessesEl.innerHTML = data.weaknesses;
            if (strategyTextEl && data.strategy) strategyTextEl.textContent = data.strategy;

            if (readinessNumEl) readinessNumEl.textContent = (data.readinessIndex || 60) + '%';
            if (readinessLevelEl) readinessLevelEl.textContent = data.readinessLevel || 'Nivel Competente';

            if (tierTextEl) {
                tierTextEl.textContent = isAdvanced ? '👑 Diagnóstico con IA' : 'Diagnóstico Estático';
            }
            if (tierIndicatorEl) {
                if (isAdvanced) {
                    tierIndicatorEl.classList.add('badge-advanced');
                } else {
                    tierIndicatorEl.classList.remove('badge-advanced');
                }
            }
            if (strategyBadgeEl) {
                strategyBadgeEl.textContent = isAdvanced ? 'Auditoría Cognitiva IA' : 'Motor Heurístico Multi-Área';
            }

            if (highYieldBoxEl && highYieldTextEl) {
                if (data.highYieldTip) {
                    highYieldBoxEl.style.display = 'block';
                    highYieldTextEl.textContent = data.highYieldTip;
                } else {
                    highYieldBoxEl.style.display = 'none';
                }
            }

            if (sprintGridEl) {
                const sprintSteps = Array.isArray(data.sprint) && data.sprint.length > 0 ? data.sprint : [
                    { step: 1, title: "Refuerzo Conceptual", desc: "Repasa los fundamentos del área con mayor margen de error." },
                    { step: 2, title: "Modo Estudio (20q)", desc: "Entrena con justificaciones completas para fijar el aprendizaje." },
                    { step: 3, title: "Simulacro Rápido (10q)", desc: "Evalúa tu retención y velocidad antes de la prueba final." }
                ];
                sprintGridEl.innerHTML = sprintSteps.map((s, idx) => `
                    <div class="ai-step-card">
                        <span class="ai-step-badge">Paso ${s.step || idx + 1}</span>
                        <h6 class="ai-step-title">${s.title || 'Acción de Refuerzo'}</h6>
                        <p class="ai-step-desc">${s.desc || ''}</p>
                    </div>
                `).join('');
            }
        };

        if (initialState) initialState.style.display = 'none';
        if (resultsState) resultsState.style.display = 'none';
        if (loadingState) loadingState.style.display = 'flex';

        const token = localStorage.getItem('authToken');

        try {
            if (!token) {
                // Modo Visitante: Simulación de escaneo con datos demo o historial local
                await new Promise(r => setTimeout(r, 800));

                const guestStats = (window.GuestSessionManager && typeof window.GuestSessionManager.getGuestStats === 'function') 
                    ? window.GuestSessionManager.getGuestStats(currentContext) 
                    : null;
                const isEducacion = currentContext === 'EDUCACION';
                let guestStrengths = '';
                let guestWeaknesses = '';
                let guestStrategy = '';
                let guestSprint = [];
                let guestIndex = 50;
                let guestLevel = 'Nivel Inicial / Prueba';

                if (guestStats && guestStats.areaStats && Object.keys(guestStats.areaStats).length > 0) {
                    const guestRadar = Object.entries(guestStats.areaStats).map(([subject, data]) => ({
                        subject,
                        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
                        correct: data.correct,
                        total: data.total
                    }));

                    guestRadar.sort((a, b) => b.accuracy - a.accuracy);
                    const best1 = guestRadar[0];
                    const worst1 = guestRadar[guestRadar.length - 1];

                    guestIndex = Math.min(Math.max(Math.round(best1.accuracy * 0.7 + (parseFloat(guestStats.avgScore || 0) / 20 * 100) * 0.3), 35), 90);
                    guestLevel = guestIndex >= 70 ? 'Nivel Competente' : 'Nivel en Desarrollo';

                    if (isEducacion) {
                        guestStrengths = `
                            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; border-radius:6px; background:var(--surface-hover); border:1px solid var(--border-color); color:var(--primary); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.75rem;"><i class="fas fa-arrow-trend-up"></i> MODO PRUEBA DEMO</div>
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Has demostrado criterio pedagógico en tu simulacro de prueba:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Dominio en <strong>${best1.subject}</strong> con <strong>${best1.accuracy}%</strong> de aciertos (${best1.correct}/${best1.total} correctas).</span>
                                </li>
                            </ul>
                        `;
                        guestWeaknesses = `
                            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; border-radius:6px; background:var(--surface-hover); border:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.75rem;"><i class="fas fa-crosshairs"></i> FOCO DE MEJORA</div>
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Oportunidad de refuerzo detectada en tu evaluación:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-crosshairs" style="color:var(--text-muted); margin-top:2px;"></i>
                                    <span>Precisión del <strong>${worst1.accuracy}%</strong> en <strong>${worst1.subject}</strong> (${worst1.total - worst1.correct} fallas). Conviene repasar criterios del CNEB.</span>
                                </li>
                            </ul>
                        `;
                        guestStrategy = `Te sugerimos registrarte gratis para guardar tu progreso y seguir reforzando ${worst1.subject}.`;
                        guestSprint = [
                            { step: 1, title: "Registro Gratuito", desc: "Crea tu cuenta gratis para desbloquear 10 vidas semanales de práctica." },
                            { step: 2, title: `Refuerzo en ${worst1.subject}`, desc: "Practica simulacros comentados para afianzar tus respuestas." },
                            { step: 3, title: "Consolidación", desc: "Evalúa tu avance diario antes de la prueba oficial de la Carrera Pública." }
                        ];
                    } else {
                        guestStrengths = `
                            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; border-radius:6px; background:var(--surface-hover); border:1px solid var(--border-color); color:var(--primary); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.75rem;"><i class="fas fa-arrow-trend-up"></i> MODO PRUEBA DEMO</div>
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Tu perfil de prueba muestra buen razonamiento clínico inicial:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Buen acierto en <strong>${best1.subject}</strong> con <strong>${best1.accuracy}%</strong> de precisión (${best1.correct}/${best1.total} correctas).</span>
                                </li>
                            </ul>
                        `;
                        guestWeaknesses = `
                            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; border-radius:6px; background:var(--surface-hover); border:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.75rem;"><i class="fas fa-crosshairs"></i> FOCO CLÍNICO</div>
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Área prioritaria de mejora según tu sesión de prueba:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-crosshairs" style="color:var(--text-muted); margin-top:2px;"></i>
                                    <span>Efectividad del <strong>${worst1.accuracy}%</strong> en <strong>${worst1.subject}</strong> (${worst1.total - worst1.correct} errores). Conviene repasar protocolos clínicos.</span>
                                </li>
                            </ul>
                        `;
                        guestStrategy = `Regístrate para continuar practicando y desbloquear análisis avanzados en ${worst1.subject}.`;
                        guestSprint = [
                            { step: 1, title: "Registro Gratuito", desc: "Guarda tu historial de aciertos y accede a 10 vidas semanales." },
                            { step: 2, title: `Clínica de ${worst1.subject}`, desc: "Revisa normas técnicas y algoritmos diagnósticos oficiales." },
                            { step: 3, title: "Simulacros Oficiales", desc: "Mide tu puntaje en simulacros reales de medicina (SERUMS/ENAM)." }
                        ];
                    }
                } else {
                    if (isEducacion) {
                        guestStrengths = `
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">El marco oficial de la Carrera Pública Magisterial evalúa competencias clave:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Fundamentos de <strong>Planificación Curricular</strong> y diseño de sesiones.</span>
                                </li>
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Principios del CNEB para <strong>Convivencia Democrática</strong> y clima de aula.</span>
                                </li>
                            </ul>
                        `;
                        guestWeaknesses = `
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Completa tu simulacro diario para diagnosticar tus áreas de mayor riesgo:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-crosshairs" style="color:var(--text-muted); margin-top:2px;"></i>
                                    <span>Evaluación de casuísticas complejas en <strong>Rúbricas de Evaluación Formativa</strong>.</span>
                                </li>
                            </ul>
                        `;
                        guestStrategy = "Inicia con tu prueba diaria de 10 preguntas para calibrar tu nivel inicial.";
                    } else {
                        guestStrengths = `
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Las pruebas oficiales médicas ponderan con alta carga las siguientes especialidades:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Diagnóstico diferencial y terapéutica en <strong>Medicina Interna</strong> y <strong>Pediatría</strong>.</span>
                                </li>
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px;"></i>
                                    <span>Algoritmos de urgencia y guías clínicas basadas en evidencia.</span>
                                </li>
                            </ul>
                        `;
                        guestWeaknesses = `
                            <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:1rem;">Realiza tu prueba gratuita para medir tu tasa de acierto por especialidad:</p>
                            <ul style="margin:0; padding:0; list-style:none;">
                                <li style="display:flex; align-items:start; gap:0.75rem; margin-bottom:0.75rem; color:var(--text-main); font-size:0.85rem; line-height:1.4;">
                                    <i class="fas fa-crosshairs" style="color:var(--text-muted); margin-top:2px;"></i>
                                    <span>Toma de decisiones rápidas en <strong>Salud Pública, Epidemiología y Ginecología</strong>.</span>
                                </li>
                            </ul>
                        `;
                        guestStrategy = "Realiza tu prueba diaria gratuita de 10 preguntas para activar tu diagnóstico inicial.";
                    }
                }

                const guestUpgradeCallout = `
                    <div style="margin-top:1.25rem; padding:1rem 1.15rem; background:var(--surface-hover); border:1px solid var(--border-color); border-radius:10px;">
                        <span style="font-weight:700; color:var(--text-main); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.35rem;"><i class="fas fa-sparkles" style="color:var(--primary);"></i> Acceso Avanzado con IA</span>
                        <p style="color:var(--text-secondary); margin:0 0 0.75rem 0; font-size:0.82rem; line-height:1.5;">Regístrate de forma gratuita para guardar tu historial o activa el <strong>Plan Avanzado</strong> para desbloquear diagnósticos en tiempo real generados por IA basados en tus propios simulacros.</p>
                        <a href="/login" style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; font-weight:700; color:var(--primary); text-decoration:none;">Crear Cuenta Gratis <i class="fas fa-arrow-right"></i></a>
                    </div>
                `;
                guestWeaknesses += guestUpgradeCallout;

                renderDiagnosisUI({
                    strengths: guestStrengths,
                    weaknesses: guestWeaknesses,
                    strategy: guestStrategy,
                    readinessIndex: guestIndex,
                    readinessLevel: guestLevel,
                    sprint: guestSprint
                }, false);
            } else {
                if (window.uiManager && typeof window.uiManager.validateFreemiumAction === 'function') {
                    if (!window.uiManager.validateFreemiumAction(null, 'diagnostic')) {
                        if (loadingState) loadingState.style.display = 'none';
                        if (initialState) initialState.style.display = 'flex';
                        return;
                    }
                }

                const currentUser = window.sessionManager.getUser();
                const tier = String(currentUser?.subscriptionTier || currentUser?.subscription_tier || 'free').toLowerCase();
                const status = String(currentUser?.subscriptionStatus || currentUser?.subscription_status || 'pending').toLowerCase();
                const isAdvanced = (tier === 'advanced' || currentUser?.role === 'admin') && (status === 'active' || currentUser?.role === 'admin');

                const scoreText = document.getElementById('stat-score')?.textContent || '0';
                const accuracyText = document.getElementById('stat-accuracy')?.textContent || '0';
                const masteryText = document.getElementById('stat-mastery')?.textContent || '0';

                const statsPayload = cachedStats ? { ...cachedStats } : {
                    avg_score: scoreText,
                    accuracy: parseInt(accuracyText, 10) || 0,
                    mastered_cards: parseInt(masteryText, 10) || 0,
                    radar_data: []
                };

                if (!statsPayload.radar_data) {
                    statsPayload.radar_data = [];
                }

                const result = await window.AnalyticsApiService.getAIDiagnostic(statsPayload, currentContext);
                if (result && result.success) {
                    renderDiagnosisUI(result, isAdvanced);
                    if (window.sessionManager && typeof window.sessionManager.refreshUser === 'function') {
                        window.sessionManager.refreshUser().catch(() => {});
                    }
                } else {
                    throw new Error(result?.error || "Respuesta inválida del servicio de analítica");
                }
            }

            if (loadingState) loadingState.style.display = 'none';
            if (resultsState) resultsState.style.display = 'block';
        } catch (error) {
            console.error("Error al extraer diagnóstico IA:", error);
            if (loadingState) loadingState.style.display = 'none';
            if (initialState) initialState.style.display = 'flex';

            const isPaywallError = error.paywall || error.status === 403 || (error.message && (
                error.message.includes('vidas') || 
                error.message.includes('plan') || 
                error.message.includes('límite') ||
                error.message.includes('agotado') ||
                error.message.includes('cuota')
            ));

            if (isPaywallError && window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(error.message, 'diagnostic');
                return;
            }

            if (window.confirmationModal && typeof window.confirmationModal.showAlert === 'function') {
                window.confirmationModal.showAlert(
                    error.message || "No se pudo generar el diagnóstico con IA. Inténtalo de nuevo.",
                    "Diagnóstico IA",
                    "Entendido"
                );
            } else if (window.Swal) {
                window.Swal.fire({
                    icon: 'warning',
                    title: 'Diagnóstico IA',
                    text: error.message || 'No se pudo generar el diagnóstico. Inténtalo nuevamente.'
                });
            } else {
                alert(error.message || "No se pudo generar el diagnóstico IA.");
            }
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', SimulatorDash.init);

// 🔄 AUTO-REFRESH: Recargar estadísticas al volver al tablero (Botón Atrás o Salir del Quiz)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        console.log("🔄 Navegación detectada: Refrescando Estadísticas...");
        SimulatorDash.init();
    }
});
