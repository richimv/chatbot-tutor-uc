
/**
 * Motor del Simulacro Médico (Frontend)
 * Maneja la lógica de preguntas, temporizador y envío de resultados.
 */

// Estado del Juego
const state = {
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    answers: [], // { questionId, userAnswer, isCorrect }
    startTime: null,
    topic: '',
    maxQuestions: 20, // 🎯 Study Mode Limit
    isLoadingBatch: false,
    quizId: null, // ✅ NUEVO: ID único de sesión para evitar colisiones en localStorage
    quizSessionId: null // ✅ Identificador de sesión de simulador
};

// Exponer estado para diagnóstico
window.__quizState = state;

// Control del Scroll Automático
let currentScrollAnimationId = null;
let activeScrollCleanup = null;

function cancelCurrentScroll() {
    if (currentScrollAnimationId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(currentScrollAnimationId);
        currentScrollAnimationId = null;
    }
    if (activeScrollCleanup) {
        activeScrollCleanup();
        activeScrollCleanup = null;
    }
}

function getStorageKey() {
    const user = window.sessionManager ? window.sessionManager.getUser() : null;
    const userId = user?.id || 'guest';
    return `simulator_active_session_${userId}`;
}

// 💡 TIPS DINÁMICOS Y RECURSOS DE CARGA POR ÁREA
const LOADING_RESOURCES = {
    'MEDICINA': {
        title: 'Preparando Simulacro de Salud',
        subtitle: 'Consultando especificaciones oficiales y casuística...',
        icon: 'fa-stethoscope',
        tips: [
            "El lavado de manos clínico es la medida más costo-efectiva para prevenir infecciones intrahospitalarias.",
            "En el SERUMS, la cadena de frío y el registro oportuno garantizan la efectividad del esquema nacional de vacunación.",
            "La Norma Técnica de Salud categoriza a los EESS I-1 para atención ambulatoria y actividades de prevención comunitaria.",
            "El consentimiento informado es un derecho fundamental del paciente en todo procedimiento clínico.",
            "En emergencias hipertensivas, la meta es reducir la PAM no más del 20-25% durante la primera hora de estabilización.",
            "Los determinantes sociales de la salud impactan de manera directa en los indicadores epidemiológicos a largo plazo.",
            "En atención primaria, la anamnesis estructurada y el examen físico orientado definen el 85% de la orientación diagnóstica."
        ]
    },
    'EDUCACION': {
        title: 'Preparando Entrenamiento Magisterial',
        subtitle: 'Analizando casuística pedagógica y rúbricas CNEB...',
        icon: 'fa-chalkboard-user',
        tips: [
            "La retroalimentación por descubrimiento o reflexión es la más potente para consolidar el aprendizaje autónomo.",
            "El andamiaje pedagógico acompaña al estudiante en su Zona de Desarrollo Próximo hacia el logro de competencias.",
            "El CNEB evalúa mediante estándares y criterios claros, orientados a la mejora continua y no a la simple calificación.",
            "En situaciones de conflicto escolar, prioriza siempre la mediación reflexiva, la empatía y los acuerdos democráticos.",
            "El error constructivo es una oportunidad didáctica valiosa para que los estudiantes autorregulen su razonamiento.",
            "El Diseño Universal para el Aprendizaje (DUA) garantiza accesibilidad, participación y progreso para todos los estudiantes.",
            "El conflicto cognitivo se produce cuando los saberes previos entran en disonancia con un nuevo reto pedagógico."
        ]
    }
};

let tipInterval = null;

// Elementos DOM
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingSubtitle: document.getElementById('loadingSubtitle'),
    loadingIcon: document.getElementById('loadingIcon'),
    loadingModeBadge: document.getElementById('loadingModeBadge'),
    loadingModeText: document.getElementById('loadingModeText'),
    loadingTip: document.getElementById('loadingTip'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    // Header Progress
    currentQ: document.getElementById('currentQ'),
    maxQ: document.getElementById('maxQ'),
    progressBar: document.getElementById('progressBar'),
    timer: document.getElementById('timer'),
    feedbackBox: document.getElementById('feedbackBox'),
    explanationText: document.getElementById('explanationText'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    nextBtnContainer: document.getElementById('nextBtnContainer'),
    resultsOverlay: document.getElementById('resultsOverlay'),
    scoreCircle: document.getElementById('scoreCircle'),
    svgScoreProgress: document.getElementById('svgScoreProgress'),
    finalScore: document.getElementById('finalScore'),
    explanationImageContainer: document.getElementById('explanationImageContainer'),
    explanationImage: document.getElementById('explanationImage')
};

/**
 * 🛠️ Muestra la pantalla de carga profesional con animaciones, icono y rotación de tips
 */
function showLoadingOverlay(customTitle = null, customSubtitle = null) {
    const overlay = elements.loadingOverlay || document.getElementById('loadingOverlay');
    if (!overlay) return;

    const ctxKey = (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(state.targetExam) || state.context === 'EDUCACION') ? 'EDUCACION' : 'MEDICINA';
    const resources = LOADING_RESOURCES[ctxKey] || LOADING_RESOURCES['MEDICINA'];

    // Icono del área
    const iconEl = elements.loadingIcon || document.getElementById('loadingIcon');
    if (iconEl) {
        iconEl.className = `fas ${resources.icon || 'fa-brain'}`;
    }

    // Badge del Modo
    const modeTextEl = elements.loadingModeText || document.getElementById('loadingModeText');
    if (modeTextEl) {
        if (state.maxQuestions === 10) {
            modeTextEl.textContent = 'Simulacro Rápido · 10 Preguntas';
        } else if (state.maxQuestions === 20) {
            modeTextEl.textContent = 'Modo Estudio · 20 Preguntas';
        } else if (state.maxQuestions === 100 || state.mode === 'real') {
            modeTextEl.textContent = 'Simulacro Real · Temporizador Oficial';
        } else if (state.targetExam) {
            modeTextEl.textContent = `${state.targetExam} · ${state.maxQuestions || 10} Preguntas`;
        } else {
            modeTextEl.textContent = `${state.maxQuestions || 10} Preguntas`;
        }
    }

    // Título y Subtítulo
    const titleEl = elements.loadingTitle || document.getElementById('loadingTitle');
    const subtitleEl = elements.loadingSubtitle || document.getElementById('loadingSubtitle');
    if (titleEl) titleEl.innerText = customTitle || resources.title;
    if (subtitleEl) subtitleEl.innerText = customSubtitle || resources.subtitle;

    // Rotación suave de tips
    const tipEl = elements.loadingTip || document.getElementById('loadingTip');
    if (tipEl && resources.tips && resources.tips.length > 0) {
        if (tipInterval) clearInterval(tipInterval);
        let tipIdx = Math.floor(Math.random() * resources.tips.length);
        tipEl.innerText = resources.tips[tipIdx];
        tipEl.style.opacity = '1';

        tipInterval = setInterval(() => {
            if (overlay.classList.contains('hidden')) {
                clearInterval(tipInterval);
                tipInterval = null;
                return;
            }
            tipEl.style.opacity = '0';
            setTimeout(() => {
                tipIdx = (tipIdx + 1) % resources.tips.length;
                tipEl.innerText = resources.tips[tipIdx];
                tipEl.style.opacity = '1';
            }, 350);
        }, 3800);
    }

    overlay.classList.remove('hidden');
}

/**
 * 🛠️ Oculta suavemente la pantalla de carga y limpia temporizadores
 */
function hideLoadingOverlay() {
    if (tipInterval) {
        clearInterval(tipInterval);
        tipInterval = null;
    }
    const manualOverlay = document.getElementById('loading-overlay');
    if (manualOverlay) manualOverlay.remove();
    const overlay = elements.loadingOverlay || document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// ==========================================
// 🚀 ASIGNACIÓN TEMPRANA (Para evitar Race Conditions)
// ==========================================
window.showExamReview = async function () {
    console.log("🚀 Iniciando renderizado de revisión...");
    cancelCurrentScroll();
    if (window.quizTutor) window.quizTutor.toggle(false);
    const tutorBtn = document.getElementById('btn-open-quiz-tutor');
    if (tutorBtn) tutorBtn.style.display = 'none';
    try {
        const resOverlay = document.getElementById('resultsOverlay') || elements.resultsOverlay;
        if (resOverlay) {
            resOverlay.classList.remove('active');
            resOverlay.style.display = 'none';
        }

        const caseContainer = document.getElementById('caseScenarioContainer');
        if (caseContainer) caseContainer.style.display = 'none';

        const qHeader = document.querySelector('.question-header');
        if (qHeader) qHeader.style.display = 'none';

        const qLayout = document.getElementById('questionLayout');
        if (qLayout) qLayout.style.display = 'none';

        const qText = document.getElementById('questionText');
        if (qText) qText.style.display = 'none';

        const oGrid = document.getElementById('optionsGrid');
        if (oGrid) oGrid.style.display = 'none';

        const fBox = document.getElementById('feedbackBox');
        if (fBox) fBox.style.display = 'none';

        const nextContainer = elements.nextBtnContainer || document.getElementById('nextBtnContainer');
        if (nextContainer) {
            nextContainer.classList.add('hidden');
            nextContainer.style.display = 'none';
        }

        const reviewContainer = document.getElementById('reviewContainer') || elements.reviewContainer;
        if (reviewContainer) {
            reviewContainer.classList.remove('hidden');
            reviewContainer.style.display = 'block';
            const reviewTitleEl = reviewContainer.querySelector('.review-header h2');
            if (reviewTitleEl) {
                const ctxUpper = (state.context || 'MEDICINA').toUpperCase();
                const ctxTitleSuffix = ctxUpper === 'EDUCACION' ? 'Magisterial' : 'Médico';
                reviewTitleEl.innerHTML = `<i class="fas fa-clipboard-check"></i> Corrección de Simulacro ${ctxTitleSuffix}`;
            }
            const reviewExitBtn = reviewContainer.querySelector('.btn-top-exit') || document.getElementById('btn-review-exit');
            if (reviewExitBtn) {
                reviewExitBtn.onclick = (e) => {
                    e.preventDefault();
                    const ctx = state.context || 'MEDICINA';
                    window.location.href = `simulator-dashboard?context=${ctx}`;
                };
            }
        }

        const quizContainer = document.querySelector('.quiz-container');
        if (quizContainer) quizContainer.classList.add('review-mode');

        const feed = document.getElementById('reviewFeed');
        if (!feed) {
            console.error("❌ Error: Elemento reviewFeed no encontrado.");
            return;
        }

        feed.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#3b82f6;"></i><br><p style="color:#cbd5e1; margin-top:1rem;">Cargando revisión...</p></div>';

        const totalProcessed = Math.min(Math.max(state.answers ? state.answers.length : 0, state.currentQuestionIndex), state.questions.length);
        const answeredQuestions = state.questions.slice(0, totalProcessed);

        feed.innerHTML = '';

        if (totalProcessed === 0) {
            feed.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay preguntas respondidas.</div>';
        }

        const saveButtonsMap = new Map();

        for (let i = 0; i < totalProcessed; i++) {
            try {
                const q = state.questions[i];
                if (!q) continue;
                const ans = state.answers[i];
                const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
                const config = { question: q, answer: ans, index: i, isDemo: isDemo, isSavedFront: false, career: state.career };
                const cardHTML = window.UIComponents.createReviewCardHTML(config);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHTML.trim();
                const card = tempDiv.firstElementChild;

                if (!card) continue;
                feed.appendChild(card);
            } catch (e) { console.error(e); }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        console.log("✅ showExamReview finalizado.");
    } catch (e) { console.error("💥 ERROR CRÍTICO en showExamReview:", e); }
};

/**
 * Construye de forma unificada y segura el contexto completo de una pregunta para el Tutor IA
 * @param {number} qIndex - Índice de la pregunta en state.questions
 * @returns {Object|null} Contexto estructurado para el Tutor IA
 */
function buildQuestionTutorContext(qIndex) {
    if (!state.questions || !state.questions[qIndex]) return null;
    const q = state.questions[qIndex];
    const ans = state.answers ? state.answers[qIndex] : null;

    // Normalización de opciones a array de strings
    let rawOptions = q.options || [];
    if (typeof rawOptions === 'string') {
        try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = [rawOptions]; }
    }
    const safeOptions = Array.isArray(rawOptions) 
        ? rawOptions.map(opt => typeof opt === 'string' ? opt : (opt?.text || opt?.option || String(opt))) 
        : [];

    const correctIdx = (q.correct_option_index !== null && q.correct_option_index !== undefined && !isNaN(Number(q.correct_option_index))) 
        ? Number(q.correct_option_index) 
        : null;

    const userIdx = (ans && ans.userAnswer !== null && ans.userAnswer !== undefined && !isNaN(Number(ans.userAnswer))) 
        ? Number(ans.userAnswer) 
        : null;

    const correctText = (correctIdx !== null && safeOptions[correctIdx] !== undefined) 
        ? String(safeOptions[correctIdx]) 
        : '';

    const userText = (userIdx !== null && safeOptions[userIdx] !== undefined) 
        ? String(safeOptions[userIdx]) 
        : '';

    const isUserCorrect = ans ? Boolean(ans.isCorrect) : (userIdx !== null && correctIdx !== null ? userIdx === correctIdx : false);

    const examDomain = (state.context && state.context.toUpperCase() === 'EDUCACION') ? 'EDUCACION' : 'MEDICINA';
    const targetExam = q.target || state.targetExam || (examDomain === 'EDUCACION' ? 'ASCENSO' : 'SERUMS');

    return {
        id: q.id || `q-${qIndex}`,
        questionText: q.question_text || q.question || '',
        options: safeOptions,
        correctOptionIndex: correctIdx,
        correctOptionText: correctText,
        userOptionIndex: userIdx,
        userOptionText: userText,
        isUserCorrect: isUserCorrect,
        explanation: q.explanation || '',
        topic: q.topic || q.area || state.topic || 'General',
        target: targetExam,
        career: q.career || state.career || '',
        examContext: examDomain,
        difficulty: state.difficulty || 'Senior',
        areas: state.areas || [],
        mode: state.mode || '',
        imageUrl: q.image_url || null,
        explanationImageUrl: q.explanation_image_url || null,
        caseId: q.case_id || null,
        caseCode: q.case_code || null,
        caseTitle: q.case_title || null,
        caseDescription: q.case_description || null,
        caseImageUrl: q.case_image_url || null,
        caseOrder: q.case_order || null
    };
}

/**
 * Abre el Tutor IA con el contexto específico de una pregunta durante la revisión post-examen
 */
window.openTutorForReviewQuestion = function (qIndex, event) {
    const isGuest = new URLSearchParams(window.location.search).get('demo') === 'true' || 
                    (window.sessionManager ? !window.sessionManager.isLoggedIn() : !localStorage.getItem('authToken'));
    if (isGuest) {
        if (window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
            window.uiManager.showAuthPromptModal();
            return;
        }
    }

    if (window.uiManager && typeof window.uiManager.validateFreemiumAction === 'function') {
        if (!window.uiManager.validateFreemiumAction(event, 'quiz_tutor')) {
            return;
        }
    }

    const qContext = buildQuestionTutorContext(qIndex);
    if (!qContext) return;

    if (window.quizTutor) {
        window.quizTutor.toggle(true, qContext);
    }
};

// Configuración
let API_URL = `${window.AppConfig.API_URL}/api/medico`; // Default fallback

// 1. Inicialización
async function init() {
    // Asegurar que la sesión del usuario está resuelta antes de restaurar/comenzar el quiz
    if (window.sessionManager) {
        await window.sessionManager.initialize();
    }

    // Re-bind elements to guarantee they are correctly resolved after DOM is fully parsed
    Object.keys(elements).forEach(key => {
        const el = document.getElementById(key);
        if (el) elements[key] = el;
    });

    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.topic = urlParams.get('topic') || '';
    state.context = urlParams.get('context') || 'MEDICINA'; // Default

    // Set dynamic tab title and module attribute based on context
    const ctxUpper = state.context.toUpperCase();
    const isEdu = ctxUpper === 'EDUCACION';
    document.body.setAttribute('data-module', isEdu ? 'educacion' : 'salud');
    document.body.classList.remove('module-salud', 'module-educacion');
    document.body.classList.add(isEdu ? 'module-educacion' : 'module-salud');

    const ctxTitle = isEdu ? 'Simulador Magisterial' : 'Simulador Médico';
    document.title = `${ctxTitle} | Hub Academia`;

    // Configurar API_URL dinámicamente según contexto
    if (isEdu) {
        API_URL = `${window.AppConfig.API_URL}/api/docente`;
    } else {
        API_URL = `${window.AppConfig.API_URL}/api/medico`;
    }

    // Custom Exam Builder params
    let savedConfig = null;
    try {
        const stored = localStorage.getItem(`simActiveConfig_${state.context}`);
        if (stored) savedConfig = JSON.parse(stored);
    } catch (error) { console.warn("No active config found"); }

    state.difficulty = urlParams.get('difficulty') || urlParams.get('level') || (savedConfig && savedConfig.difficulty ? savedConfig.difficulty : 'Senior');

    state.targetExam = urlParams.get('target') || (savedConfig ? savedConfig.target : (state.context === 'EDUCACION' ? 'ASCENSO' : 'SERUMS'));
    state.career = urlParams.get('career') || (savedConfig ? savedConfig.career : null);
    state.mode = urlParams.get('mode') || '';
    state.configType = urlParams.get('configType') || (savedConfig && savedConfig.configType ? savedConfig.configType : 'default');

    const areasParam = urlParams.get('areas');
    if (areasParam) {
        state.areas = String(areasParam).split(',');
    } else if (savedConfig && savedConfig.areas && savedConfig.areas.length > 0) {
        state.areas = savedConfig.areas;
    } else {
        state.topic = urlParams.get('topic') || '';
        state.areas = state.topic ? [state.topic] : [];
    }

    // 🎯 Mode Selection: 
    // ?limit=10 -> Quick / Arcade Mode (Modo Demo para visitantes)
    // ?limit=20 -> Study Mode
    // ?limit=100 -> Real Mock
    const isDemoParam = urlParams.get('demo') === 'true';
    const limitParam = parseInt(urlParams.get('limit'));
    if (!isNaN(limitParam) && limitParam > 0) {
        state.maxQuestions = limitParam;
    }
    if (isDemoParam) {
        state.isDemo = true;
        state.maxQuestions = 10;
        state.mode = 'arcade';
    } else if (state.maxQuestions === 10 && !state.mode) {
        state.mode = 'arcade';
    } else if (state.maxQuestions === 20 && !state.mode) {
        state.mode = 'study';
    }
    if (elements.maxQ) elements.maxQ.textContent = state.maxQuestions;

    // Mostrar de inmediato overlay estilizado con contexto resuelto
    showLoadingOverlay();

    // Timer Logic: Only show for Real Mock (>= 50 questions or mode=real)
    const timerBadge = document.querySelector('.timer-badge');
    if ((state.maxQuestions >= 50 || state.mode === 'real') && timerBadge) {
        timerBadge.style.display = 'flex';
    } else if (timerBadge) {
        timerBadge.style.display = 'none';
    }

    // Setup Exit Buttons
    const handleExit = () => {
        const ctx = state.context || 'MEDICINA';
        window.location.href = `simulator-dashboard?context=${ctx}`;
    };

    const handleExitClick = async () => {
        if (state.isFinished) {
            handleExit();
            return;
        }

        // 💾 Guardar progreso actual para permitir reanudar
        saveSession();

        if (window.confirmationModal && typeof window.confirmationModal.show === 'function') {
            const confirmed = await window.confirmationModal.show(
                '¿Deseas pausar y salir del simulacro? Tu progreso quedará guardado para que puedas reanudarlo cuando desees.',
                'Pausar Simulacro',
                'Sí, salir',
                'Continuar examen'
            );
            if (confirmed) {
                handleExit();
            }
        } else {
            if (confirm('¿Deseas pausar y salir del simulacro? Tu progreso quedará guardado.')) {
                handleExit();
            }
        }
    };

    const btnExit = document.getElementById('btn-exit-quiz');
    const btnTopExit = document.getElementById('btn-top-exit');
    const btnReviewExit = document.getElementById('btn-review-exit');

    if (btnExit) btnExit.onclick = handleExit;
    if (btnTopExit) btnTopExit.onclick = handleExitClick;
    if (btnReviewExit) btnReviewExit.onclick = handleExit;

    try {
        // ✅ NUEVO: Intentar recuperar sesión previa
        const recovered = loadSession();
        if (recovered && recovered.questions && recovered.questions.length > 0) {
            console.log("♻️ Sesión recuperada de localStorage.");
            
            let resume = true;
            // Solo preguntamos si el examen no ha expirado
            if (recovered.timeLeft !== undefined && recovered.timeLeft <= 0) {
                resume = true; // Forzar reanudación para calificar automáticamente
            } else if (window.confirmationModal && typeof window.confirmationModal.show === 'function') {
                hideLoadingOverlay();
                const configText = recovered.targetExam || 'examen';
                resume = await window.confirmationModal.show(
                    `Tienes un simulacro de ${configText} iniciado previamente. ¿Deseas continuar respondiéndolo o prefieres comenzar uno nuevo?`,
                    'Simulacro en progreso',
                    'Continuar anterior',
                    'Iniciar nuevo'
                );
            }
            
            if (resume === true) {
                Object.assign(state, recovered);
                state.score = (state.answers || []).filter(a => a && a.isCorrect).length;
                
                // Ubicar el índice en la primera pregunta sin responder de la sesión recuperada
                const firstUnanswered = (state.answers && Array.isArray(state.answers))
                    ? state.answers.findIndex((a, idx) => idx < state.questions.length && (!a || a.userAnswer === undefined))
                    : -1;
                
                if (firstUnanswered !== -1) {
                    state.currentQuestionIndex = firstUnanswered;
                } else if (state.answers && state.answers.length > 0) {
                    state.currentQuestionIndex = Math.min(state.answers.length, state.questions.length - 1);
                }

                renderQuestion();
                if (state.maxQuestions >= 50 || state.mode === 'real') startMockTimer();
            } else if (resume === false) {
                console.log("🆕 Descartando sesión anterior por elección del usuario.");
                clearSession();
                state.quizId = Date.now().toString(36); // Generar ID único
                await startQuiz();
            } else {
                console.log("🚪 El usuario cerró el modal sin seleccionar. Retornando al dashboard...");
                handleExit();
                return;
            }
        } else {
            console.log("🆕 Iniciando sesión nueva (sin estado previo).");
            // Inicialización limpia
            state.quizId = Date.now().toString(36); // Generar ID único
            await startQuiz();
        }
    } catch (error) {
        console.error('Error iniciando quiz:', error);
        hideLoadingOverlay();
        // Si ya tenemos preguntas en memoria y fue una advertencia no fatal, renderizar y continuar
        if (state.questions && Array.isArray(state.questions) && state.questions.length > 0) {
            console.warn("⚠️ Continuando ejecución del quiz en memoria a pesar del error de inicialización.");
            renderQuestion();
            if (state.maxQuestions >= 50 || state.mode === 'real') startMockTimer();
        } else {
            clearSession();
            if (window.confirmationModal) {
                await window.confirmationModal.showAlert(
                    error.message || 'No se pudo cargar el simulacro. Por favor, verifica tu conexión a internet o intenta nuevamente.',
                    'Error al Iniciar Examen'
                );
            }
            window.location.href = '/';
        }
    }
    initLightbox();
}

/**
 * Serializa el estado del examen deduplicando casos anidados para minimizar uso de almacenamiento.
 */
function serializeSessionState() {
    const casesMap = {};
    const optimizedQuestions = (state.questions || []).map(q => {
        if (q.case_id) {
            if (!casesMap[q.case_id]) {
                casesMap[q.case_id] = {
                    case_title: q.case_title || null,
                    case_description: q.case_description || null,
                    case_image_url: q.case_image_url || null,
                    case_order: q.case_order || null,
                    case_code: q.case_code || null
                };
            }
            // Retornar pregunta sin duplicar los campos pesados del caso
            const { case_title, case_description, case_image_url, case_order, case_code, ...rest } = q;
            return rest;
        }
        return q;
    });

    return {
        ...state,
        questions: optimizedQuestions,
        _casesMap: Object.keys(casesMap).length > 0 ? casesMap : undefined,
        savedAt: Date.now(),
        quizId: state.quizId,
        quizSessionId: state.quizSessionId,
        timeLeft: state.timeLeft,
        isFinished: false
    };
}

/**
 * Persistencia Local Resiliente (Multi-tier: localStorage -> sessionStorage -> memoria)
 */
function saveSession() {
    if (new URLSearchParams(window.location.search).get('demo') === 'true') return;
    if (state.isFinished) return; // ✅ NUNCA guardar si el examen ya se culminó

    try {
        const payload = serializeSessionState();
        const serialized = JSON.stringify(payload);
        const storageKey = getStorageKey();

        try {
            localStorage.setItem(storageKey, serialized);
        } catch (quotaError) {
            console.warn("⚠️ QuotaExceeded en localStorage. Intentando optimizar y respaldar...");
            // 1. Limpieza de claves obsoletas de otros exámenes
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('simulator_active_session_') && k !== storageKey) {
                        localStorage.removeItem(k);
                    }
                }
                localStorage.setItem(storageKey, serialized);
                return;
            } catch (e2) {
                // 2. Si aún excede localStorage, respaldar en sessionStorage
                try {
                    sessionStorage.setItem(storageKey, serialized);
                    console.log("💾 Sesión guardada con éxito en sessionStorage como respaldo.");
                    return;
                } catch (e3) {
                    console.warn("⚠️ No se pudo persistir en storage por límite de cuota del navegador. El examen continuará fluidamente en memoria viva.");
                }
            }
        }
    } catch (err) {
        console.warn("⚠️ Error no fatal al serializar sesión:", err);
    }
}

function loadSession() {
    try {
        const storageKey = getStorageKey();
        let stored = null;
        try {
            stored = localStorage.getItem(storageKey);
        } catch (e) {
            console.warn("Fallo leyendo localStorage:", e);
        }
        if (!stored) {
            try {
                stored = sessionStorage.getItem(storageKey);
            } catch (e) {
                console.warn("Fallo leyendo sessionStorage:", e);
            }
        }
        if (!stored) return null;
        const data = JSON.parse(stored);

        // Regla 0: Si la sesión en memoria ya fue culminada, eliminarla de inmediato
        if (data.isFinished || data.finished) {
            console.log("♻️ Sesión en memoria ya finalizada. Limpiando caché.");
            clearSession();
            return null;
        }

        // Regla 1: Expiración por tiempo de examen extendido (24 horas = 86400000 ms para soportar Simulacros Reales y pausas)
        const ageInMs = Date.now() - (data.savedAt || 0);
        if (ageInMs > 86400000) {
            console.log("♻️ Sesión expirada por antigüedad (> 24hr).");
            clearSession();
            return null;
        }

        // Si es un Simulacro Real (>= 50qs o mode=real), mantenemos el tiempo restante guardado intacto para permitir pausas e interrupciones
        if ((data.maxQuestions >= 50 || data.mode === 'real') && data.timeLeft !== undefined && data.timeLeft !== null) {
            console.log(`⏱️ Persistencia del cronómetro: tiempo restante restaurado intacto: ${data.timeLeft}s.`);
        }

        const urlParams = new URLSearchParams(window.location.search);

        // ✅ Si estamos en modo DEMO, nunca cargamos sesión previa (evita conflictos con sesiones de usuarios registrados)
        if (urlParams.get('demo') === 'true') {
            console.log("🆕 Modo Demo activo: Ignorando sesión guardada para inicio limpio.");
            return null;
        }

        // Regla 2: Límite de preguntas debe coincidir (Evita cargar 10qs cuando se pide 20qs)
        const limitParam = parseInt(urlParams.get('limit'));
        const expectedLimit = (!isNaN(limitParam) && limitParam > 0) ? limitParam : 20;
        const isRealMismatch = (expectedLimit >= 50 && data.maxQuestions < 50) || (expectedLimit < 50 && Math.abs((data.maxQuestions || 0) - expectedLimit) > 5);
        if (data.maxQuestions && isRealMismatch) {
            console.log("♻️ Sesión descartada por desajuste de modalidad (límite distinto).");
            clearSession();
            return null;
        }

        // Regla 3: Validar contexto (MEDICINA vs EDUCACION)
        const currentContext = (state.context || 'MEDICINA').toUpperCase();
        const storedContext = (data.context || 'MEDICINA').toUpperCase();
        if (currentContext !== storedContext) {
            console.log("♻️ Sesión descartada por desajuste de contexto.");
            clearSession();
            return null;
        }

        // Rehidratar casos anidados desde el mapa deduplicado si existe
        if (data._casesMap && Array.isArray(data.questions)) {
            data.questions = data.questions.map(q => {
                if (q.case_id && data._casesMap[q.case_id]) {
                    return {
                        ...q,
                        ...data._casesMap[q.case_id]
                    };
                }
                return q;
            });
            delete data._casesMap;
        }

        // Sincronizar configuraciones guardadas de forma segura si existen en la sesión
        if (data.targetExam) state.targetExam = data.targetExam;
        if (data.career) state.career = data.career;
        if (data.difficulty) state.difficulty = data.difficulty;
        if (data.areas && Array.isArray(data.areas) && data.areas.length > 0) state.areas = data.areas;
        if (data.topic) state.topic = data.topic;
        if (data.quizSessionId) state.quizSessionId = data.quizSessionId;

        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            return data;
        } else {
            console.log("♻️ Sesión descartada por datos incompletos de preguntas.");
            clearSession();
            return null;
        }
    } catch (error) { console.warn("Fallo cargando sesión previa", error); }
    return null;
}

function clearSession() {
    const user = window.sessionManager ? window.sessionManager.getUser() : null;
    const userId = user?.id || 'guest';
    const storageKey = `simulator_active_session_${userId}`;

    // 1. Limpieza explícita por claves directas en localStorage y sessionStorage
    try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`simulator_active_session_guest`);
    } catch (e) {}

    try {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(`simulator_active_session_guest`);
    } catch (e) {}

    // 2. Barrido exhaustivo de cualquier clave residual simulator_active_session_*
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('simulator_active_session_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.warn("Fallo limpiando sesiones de localStorage:", e);
    }

    try {
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('simulator_active_session_')) {
                sessionKeysToRemove.push(key);
            }
        }
        sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) {
        console.warn("Fallo limpiando sesiones de sessionStorage:", e);
    }
}

// Exponer función para iniciar nuevo examen limpiando caché sin race conditions
window.startNewExam = function () {
    console.log("🆕 Iniciando nuevo examen (limpiando sesión activa).");
    clearSession();
    location.reload();
};



// 2. Iniciar Quiz (Llamada al Backend)
async function startQuiz() {
    // Mostrar Pantalla de Carga y Tips Dinámicos
    showLoadingOverlay();

    let data;
    let response; // ✅ Declare here for function-wide scope
    const urlParams = new URLSearchParams(window.location.search);
    const isDemo = urlParams.get('demo') === 'true';

    let fetchUrl = `${API_URL}/start`;
    let fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            topic: state.topic,
            target: state.targetExam,
            areas: state.areas,
            career: state.career,
            difficulty: state.difficulty,
            limit: state.maxQuestions,
            mode: state.mode,
            configType: state.configType
        })
    };

    if (isDemo) {
        state.isDemo = true;
        state.maxQuestions = 10;
        state.mode = 'arcade';

        // --- 📊 DEMO ANTI-REPETITION & LÍMITE (1 intento por día para visitantes) ---
        if (window.GuestSessionManager && !window.GuestSessionManager.canTakeDailyDemo()) {
            elements.loadingOverlay.classList.add('hidden');
            if (window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
                window.uiManager.showAuthPromptModal();
            } else {
                window.location.href = '/register';
            }
            return;
        }

        // FETCH REAL QUESTIONS FROM DB DEMO ENDPOINT
        // Mapear el contexto del frontend al dominio del backend
        const contextMap = {
            'MEDICINA': 'medicine',
            'EDUCACION': 'education'
        };
        const domainParam = contextMap[state.context || 'MEDICINA'] || 'medicine';
        const seenIds = JSON.parse(localStorage.getItem(`guest_seen_ids_${domainParam}`) || '[]');
        fetchUrl = `${API_URL}/demo?domain=${domainParam}&limit=10&excludeIds=${seenIds.join(',')}`;
        if (state.targetExam) fetchUrl += `&target=${encodeURIComponent(state.targetExam)}`;
        if (state.career) fetchUrl += `&career=${encodeURIComponent(state.career)}`;
        if (state.difficulty) fetchUrl += `&difficulty=${encodeURIComponent(state.difficulty)}`;
        if (state.areas && state.areas.length > 0) fetchUrl += `&areas=${encodeURIComponent(state.areas.join(','))}`;

        try {
            console.log(`📡 Iniciando Demo Engine para dominio: ${domainParam}`);
            response = await window.NetworkService.fetch(fetchUrl);
            data = await response.json();

            if (!data.success || !data.questions || data.questions.length === 0) {
                // Si el banco se agota para el invitado, limpiamos su historial local para que pueda repetir
                localStorage.removeItem(`guest_seen_ids_${domainParam}`);
                throw new Error("No hay preguntas disponibles para la demo.");
            }

            // Asegurar que el lote demo nunca exceda 10 preguntas
            data.questions = data.questions.slice(0, 10);

            // Registrar intento de sesión diaria de visitante de forma centralizada
            if (window.GuestSessionManager) {
                window.GuestSessionManager.recordDemoAttempt();
            } else {
                const count = parseInt(localStorage.getItem('demo_sessions_count') || '0', 10);
                localStorage.setItem('demo_sessions_count', (count + 1).toString());
                localStorage.setItem('demo_sessions_date', new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }));
            }

            // Guardar IDs vistos para evitar repetición en la siguiente sesión
            const newSeenIds = [...new Set([...seenIds, ...data.questions.map(q => q.id)])];
            localStorage.setItem(`guest_seen_ids_${domainParam}`, JSON.stringify(newSeenIds));

            // 🎲 Shuffle Options (Frontend Fisher-Yates) for better UX
            data.questions = data.questions.map(q => {
                if (!q.options || !Array.isArray(q.options)) return q;
                
                const correctAnswerText = q.options[q.correct_option_index];
                const shuffledOptions = [...q.options];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }
                return {
                    ...q,
                    options: shuffledOptions,
                    correct_option_index: shuffledOptions.indexOf(correctAnswerText)
                };
            });

            // Ajustar el tema para la UI
            const target = domainParam === 'education' ? 'ASCENSO' : 'SERUMS';
            data.topic = `DEMO: ${target}`;

        } catch (demoErr) {
            console.error("💥 Error en Demo Engine:", demoErr);
            elements.loadingOverlay.classList.add('hidden');

            // Error amigable para el usuario
            const msg = demoErr.message === "No hay preguntas disponibles para la demo."
                ? "Lo sentimos, no hay preguntas disponibles para esta demo en este momento."
                : "No se pudieron cargar las preguntas de demostración. Por favor, intenta de nuevo más tarde.";

            if (window.confirmationModal) {
                window.confirmationModal.showAlert(msg, 'Demostración');
            } else if (window.uiManager) {
                window.uiManager.showToast(msg, 'warning');
            }

            return;
        }
    } else {
        response = await window.NetworkService.fetch(fetchUrl, {
            method: 'POST',
            body: fetchOptions.body
        });
        data = await response.json();

        // 🚦 Manejo del Error 403 (Banco Agotado o Paywall)
        if (response.status === 403) {
            elements.loadingOverlay.classList.add('hidden');
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                if (window.uiManager) window.uiManager.showToast(data.error || "Límite alcanzado.", 'warning');
                window.location.href = '/pricing';
            }
            return;
        }

        // 🛠 Error de Servidor (500) u Otros
        if (!response.ok && response.status !== 404) {
            elements.loadingOverlay.classList.add('hidden');
            console.error("Server Error:", data.error);
            if (window.confirmationModal) {
                window.confirmationModal.showAlert("Hubo un error interno en el servidor. Por favor, intenta de nuevo o contacta a soporte técnico.", "Error de Servidor");
            } else if (window.uiManager) {
                window.uiManager.showToast("Error en el servidor.", 'error');
            }
            return;
        }

        // Sincronización de sesión y vidas gestionada centralizadamente por NetworkService.fetch
    }

    if (!data.success) {
        elements.loadingOverlay.classList.add('hidden');

        // 🚦 Error 404: Banco Agotado Real (Ya se intentó IA y falló)
        if (response && response.status === 404 && data.noQuestions) {
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal('Has abarcado todas las preguntas oficiales y de IA disponibles para este tema.', 'simulator');
            } else {
                if (window.confirmationModal) {
                    await window.confirmationModal.showAlert('Has completado todas las preguntas de este tema. Intenta cambiar de área o dificultad.', '¡Banco Agotado!');
                }
                window.location.href = `simulator-dashboard?context=${state.context || 'MEDICINA'}`;
            }
            return;
        }

        // 🛠 Error Técnico de IA (500 con flag)
        if (data.technicalError) {
            if (window.confirmationModal) {
                window.confirmationModal.showAlert(data.error || "Hubo un problema técnico al generar preguntas. Por favor, intenta de nuevo.", "Aviso");
            } else if (window.uiManager) {
                window.uiManager.showToast(data.error, 'error');
            }
            return;
        }

        // 🛡️ Error 403: Límite de Suscripción (Vidas / Cuota Diaria)
        if (response && response.status === 403) {
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                if (window.uiManager) window.uiManager.showToast(data.error || "Límite alcanzado.", 'warning');
                window.location.href = '/pricing';
            }
            return;
        }

        // Fallback genérico para otros errores
        if (window.uiManager) {
            window.uiManager.showToast(data.error || 'Hubo un error cargando el simulacro.', 'error');
        }
        return;
    }

    state.questions = Array.isArray(data.questions) ? data.questions : [];
    if (state.isDemo || state.mode === 'arcade' || state.maxQuestions === 10) {
        state.maxQuestions = 10;
        state.mode = 'arcade';
        if (state.questions.length > 10) {
            state.questions = state.questions.slice(0, 10);
        }
    } else if (state.questions.length > state.maxQuestions) {
        state.questions = state.questions.slice(0, state.maxQuestions);
    }
    if (elements.maxQ) elements.maxQ.textContent = state.maxQuestions;
    state.quizSessionId = data.quizSessionId || null;
    // 💡 ACTUALIZACIÓN DE TEMA: Si el backend rotó el tema (ej: Medicina -> Cardiología), actualizamos el estado.
    if (data.topic) {
        state.topic = data.topic;
        console.log(`Topic actualizado por Backend: ${state.topic}`);
    }
    // 🔄 SINCRONIZACIÓN DE ÁREAS: Asegurar que el frontend mantenga el filtro multi-área (ej: Fallback SERUMS)
    if (data.areas && data.areas.length > 0) {
        state.areas = data.areas;
        console.log(`Áreas sincronizadas por Backend: ${state.areas.join(', ')}`);
    }
    state.startTime = Date.now();

    // Ocultar Loading y mostrar primera pregunta
    hideLoadingOverlay();
    saveSession(); // Guardar estado inicial
    renderQuestion();

    // Iniciar temporizador maestro si es Simulacro Real
    if (state.maxQuestions >= 50 || state.mode === 'real') {
        startMockTimer();
    }
}

// 2.5 Fetch Next Batch (Background)
async function fetchNextBatch() {
    if (state.isLoadingBatch) return;

    // NO BATCHING IN DEMO MODE (Static Content)
    const urlParamsNext = new URLSearchParams(window.location.search);
    if (urlParamsNext.get('demo') === 'true') return;

    // Si ya tenemos todas las preguntas requeridas para el simulacro cargadas en memoria, no solicitar más
    if (state.questions.length >= state.maxQuestions) return;

    state.isLoadingBatch = true;
    state.batchLoadFailed = false; // Reset status
    console.log(`🔄 Solicitando siguiente lote (${state.questions.length}/${state.maxQuestions})...`);

    try {
        const seenIds = state.questions
            .map(q => q.id)
            .filter(Boolean);

        const response = await window.NetworkService.fetch(`${API_URL}/next-batch`, {
            method: 'POST',
            body: JSON.stringify({
                quizSessionId: state.quizSessionId || undefined,
                topic: state.topic, // Legacy compatibility
                target: state.targetExam,
                areas: state.areas,
                career: state.career,
                difficulty: state.difficulty,
                seenIds: seenIds,
                mode: state.mode,
                configType: state.configType
            })
        });

        const data = await response.json();

        // 🚦 Manejo del Error 500/404 Controlado (Límite Básico u otros)
        if (!response.ok || !data.success) {
            hideLoadingOverlay();

            if (response.status === 404 && data.noQuestions) {
                if (window.uiManager) window.uiManager.showToast('Has completado todas las preguntas disponibles.', 'info');
                state.maxQuestions = state.questions.length; // Ajustar total al mazo real disponible
                updateProgressUI();
                return;
            }

            if (window.uiManager && window.uiManager.showToast) {
                window.uiManager.showToast(data.error || "No hay más preguntas disponibles en este momento.", "info");
            }
            state.maxQuestions = state.questions.length; // Ajustar total al mazo real disponible
            updateProgressUI();
            return;
        }

        // 🚦 Manejo del Error 403 (Banco Agotado o Paywall)
        if (response.status === 403) {
            hideLoadingOverlay();
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                if (window.uiManager) window.uiManager.showToast(data.error || "Límite alcanzado.", 'warning');
                finishQuiz();
            }
            return;
        }

        // 🛠 Error de Servidor (500) u Otros (No 404)
        if (!response.ok && response.status !== 404) {
            hideLoadingOverlay();
            console.error("Server Error:", data.error);
            if (window.uiManager) window.uiManager.showToast("Error cargando más preguntas. Reintentando...", 'warning');
            return;
        }

        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            state.questions.push(...data.questions);
            if (state.questions.length > state.maxQuestions) {
                state.maxQuestions = state.questions.length;
            }
            console.log(`✅ Lote cargado exitosamente. Total acumulado: ${state.questions.length}/${state.maxQuestions}`);

            // 🔄 Refrescar áreas por si el backend rotó algo (opcional pero robusto)
            if (data.areas && data.areas.length > 0) {
                state.areas = data.areas;
            }

            saveSession();
            updateProgressUI();
        }
    } catch (error) {
        console.error("Error fetching batch:", error);
        state.batchLoadFailed = true; // Marcar fallo de carga
        if (window.uiManager && window.uiManager.showToast) {
            window.uiManager.showToast("Error de conexión al cargar más preguntas.", "error");
        }
    } finally {
        state.isLoadingBatch = false;
        // 🛠️ FIX SENIOR: Eliminar cargador y disparar renderizado si estábamos esperando la pregunta
        const manualOverlay = document.getElementById('loading-overlay');
        if (manualOverlay) manualOverlay.remove();

        const overlay = elements.loadingOverlay || document.getElementById('loadingOverlay');
        const isWaiting = overlay && !overlay.classList.contains('hidden') && overlay.style.display !== 'none';

        if (state.questions[state.currentQuestionIndex]) {
            if (isWaiting || !elements.questionText || !elements.questionText.textContent.trim()) {
                hideLoadingOverlay();
                renderQuestion();
            }
        } else if (state.batchLoadFailed) {
            hideLoadingOverlay();
            showNetworkRetryOverlay();
        } else if (state.currentQuestionIndex >= state.maxQuestions) {
            hideLoadingOverlay();
            finishQuiz();
        }
    }
}

// 3. Renderizar Pregunta
function renderQuestion() {
    cancelCurrentScroll();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (window.currentQuizAudio) {
        try {
            window.currentQuizAudio.pause();
        } catch (e) {}
        window.currentQuizAudio = null;
    }

    // Check if we are done
    if (state.currentQuestionIndex >= state.maxQuestions) {
        return finishQuiz();
    }

    const q = state.questions[state.currentQuestionIndex];

    // If we ran out of questions but haven't hit maxQuestions yet (wait for batch?)
    if (!q) {
        const ctxKey = (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(state.targetExam) || state.context === 'EDUCACION') ? 'EDUCACION' : 'MEDICINA';
        const resources = LOADING_RESOURCES[ctxKey] || LOADING_RESOURCES['MEDICINA'];

        if (state.isLoadingBatch) {
            showLoadingOverlay(resources.title, "Obteniendo siguiente bloque de preguntas oficiales...");
            if (elements.questionText) elements.questionText.innerHTML = '';
            return; // Detenemos el renderizado de la pregunta hasta que cargue
        } else if (state.batchLoadFailed) {
            hideLoadingOverlay();
            showNetworkRetryOverlay();
            return;
        } else if (state.questions.length < state.maxQuestions) {
            showLoadingOverlay(resources.title, "Obteniendo siguiente bloque de preguntas oficiales...");
            if (elements.questionText) elements.questionText.innerHTML = '';
            fetchNextBatch();
            return;
        } else {
            // No more questions available, but we haven't hit maxQuestions.
            // Adjust maxQuestions to current length to show accurate results
            console.warn("⚠️ Banco agotado prematuramente. Finalizando con", state.questions.length, "preguntas.");
            state.maxQuestions = state.questions.length;
            return finishQuiz();
        }
    }
    hideLoadingOverlay();

    // Trigger Batch Load if we are close to end of current array using local threshold
    // E.g., if we have 5 qs, and we are at index 3 (Question 4), prefetch next batch in background.
    // Trigger Batch Load if we are close to end of current array using local threshold
    // Prefetch next batch when remaining questions in memory <= 3
    if (state.questions.length < state.maxQuestions &&
        (state.questions.length - state.currentQuestionIndex) <= 3 &&
        !state.isLoadingBatch) {
        fetchNextBatch();
    }

    // Actualizar UI Header
    if (elements.currentQ) elements.currentQ.textContent = state.currentQuestionIndex + 1;
    updateProgressUI();

    // 📖 Renderizar Caso / Situación Compartida si la pregunta pertenece a una Casuística
    const caseContainer = document.getElementById('caseScenarioContainer');
    if (caseContainer) {
        const hasCase = Boolean(
            (q.case_id && typeof q.case_id === 'string' && q.case_id.trim() !== '') ||
            (q.case_code && typeof q.case_code === 'string' && q.case_code.trim() !== '') ||
            (q.case_description && typeof q.case_description === 'string' && q.case_description.trim() !== '') ||
            (q.case_image_url && typeof q.case_image_url === 'string' && q.case_image_url.trim() !== '')
        );

        if (hasCase) {
            const caseBadgeText = document.getElementById('caseBadgeText');
            const caseOrderBadge = document.getElementById('caseOrderBadge');
            const caseTitle = document.getElementById('caseTitle');
            const caseDesc = document.getElementById('caseDescriptionText');
            const caseImgContainer = document.getElementById('caseImageContainer');
            const caseImg = document.getElementById('caseImage');

            const isEducation = (state.context || '').toUpperCase() === 'EDUCACION';
            const caseLabel = isEducation ? 'Casuística Anidada' : 'Viñeta Clínica Compartida';

            if (caseBadgeText) {
                caseBadgeText.textContent = caseLabel;
            }

            if (caseOrderBadge) {
                const orderNum = q.case_order ? Number(q.case_order) : 1;
                caseOrderBadge.textContent = `Pregunta ${orderNum}`;
            }

            if (caseTitle) {
                caseTitle.style.display = 'none';
            }

            if (caseDesc) {
                const rawDesc = q.case_description || '';
                if (rawDesc.trim()) {
                    caseDesc.innerHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(rawDesc) : rawDesc;
                    caseDesc.style.display = 'block';
                } else {
                    caseDesc.innerHTML = '';
                    caseDesc.style.display = 'none';
                }
            }

            if (caseImgContainer && caseImg) {
                if (q.case_image_url && typeof q.case_image_url === 'string' && q.case_image_url.trim()) {
                    caseImg.src = window.resolveImageUrl(q.case_image_url);
                    caseImgContainer.style.display = 'block';
                } else {
                    caseImgContainer.style.display = 'none';
                    caseImg.removeAttribute('src');
                }
            }

            caseContainer.style.display = 'block';
        } else {
            caseContainer.style.display = 'none';
        }
    }

    // Imagen (si existe y tiene URL válida)
    const imgContainer = document.getElementById('questionImageContainer');
    const imgElement = document.getElementById('questionImage');
    const layout = document.getElementById('questionLayout');

    if (imgContainer && imgElement) {
        if (q.image_url && typeof q.image_url === 'string' && q.image_url.trim() !== '') {
            imgElement.src = window.resolveImageUrl(q.image_url);
            imgContainer.style.display = 'block';
            imgContainer.classList.remove('hidden');
            if (layout) layout.classList.add('has-image');
        } else {
            imgContainer.style.display = 'none';
            imgContainer.classList.add('hidden');
            imgElement.removeAttribute('src');
            if (layout) layout.classList.remove('has-image');
        }
    }

    // Texto Pregunta
    elements.questionText.innerHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(q.question_text || '') : (q.question_text || '');

    // Reset UI
    elements.optionsGrid.innerHTML = '';
    elements.feedbackBox.style.display = 'none';
    elements.feedbackBox.classList.remove('error');
    if (elements.nextBtnContainer) {
        elements.nextBtnContainer.classList.add('hidden');
        elements.nextBtnContainer.style.display = 'none';
    }
    const tutorBtn = document.getElementById('btn-open-quiz-tutor');
    if (tutorBtn) {
        tutorBtn.style.display = 'none';
    }

    // Render Opciones
    if (!q.options || !Array.isArray(q.options)) {
        throw new Error("Pregunta recibida sin opciones válidas (Corrupción de datos). Abortando renderizado.");
    }

    const letters = ['A', 'B', 'C', 'D', 'E'];
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';

        const letterSpan = document.createElement('span');
        letterSpan.className = 'option-letter';
        letterSpan.textContent = letters[index] || '';

        const textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        if (window.MarkdownRenderer) {
            textSpan.innerHTML = window.MarkdownRenderer.render(String(opt || '')).replace(/^<p>|<\/p>$/g, '');
        } else if (window.marked && window.marked.parse) {
            textSpan.innerHTML = window.marked.parse(String(opt || '')).replace(/^<p>|<\/p>$/g, '');
        } else {
            textSpan.textContent = opt;
        }

        btn.appendChild(letterSpan);
        btn.appendChild(textSpan);

        btn.onclick = () => handleAnswer(index, btn);
        elements.optionsGrid.appendChild(btn);
    });

    // 🔙 Configurar Botón Anterior
    const prevBtn = elements.prevBtn || document.getElementById('prevBtn');
    if (prevBtn) {
        if (state.currentQuestionIndex > 0) {
            prevBtn.classList.remove('hidden');
            prevBtn.style.display = 'inline-flex';
            prevBtn.onclick = () => handlePreviousQuestion();
        } else {
            prevBtn.classList.add('hidden');
            prevBtn.style.display = 'none';
        }
    }

    // 🔄 REANIMAR INTERFAZ SI LA PREGUNTA YA HABÍA SIDO RESPONDIDA EN LA SESIÓN RECUPERADA O AL NAVEGAR ATRÁS
    const existingAns = state.answers[state.currentQuestionIndex];
    if (existingAns && existingAns.userAnswer !== undefined) {
        const optionBtns = elements.optionsGrid.querySelectorAll('button');
        if (optionBtns[existingAns.userAnswer]) {
            handleAnswer(existingAns.userAnswer, optionBtns[existingAns.userAnswer], true);
        }
    } else {
        if (elements.feedbackBox) {
            elements.feedbackBox.classList.add('hidden');
            elements.feedbackBox.style.display = 'none';
        }
        const nextBtn = elements.nextBtn || document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.classList.add('hidden');
            nextBtn.style.display = 'none';
        }
        const tutorBtn = document.getElementById('btn-open-quiz-tutor');
        if (tutorBtn) {
            tutorBtn.classList.add('hidden');
            tutorBtn.style.display = 'none';
        }

        const nextContainer = elements.nextBtnContainer || document.getElementById('nextBtnContainer');
        if (nextContainer) {
            if (state.currentQuestionIndex > 0) {
                nextContainer.classList.remove('hidden');
                nextContainer.style.display = 'flex';
            } else {
                nextContainer.classList.add('hidden');
                nextContainer.style.display = 'none';
            }
        }
    }
}

function updateProgressUI() {
    // Update Progress
    const current = state.currentQuestionIndex + 1;
    const total = state.maxQuestions; // 🎯 Denominador Fijo: Refleja el objetivo del simulacro

    if (elements.currentQ) elements.currentQ.textContent = current;
    if (elements.maxQ) elements.maxQ.textContent = total;
    if (elements.progressBar) {
        elements.progressBar.style.width = `${(current / total) * 100}%`;
    }
}

// 4. Manejar Respuesta
function handleAnswer(selectedIndex, btnElement, isReplaying = false) {
    const q = state.questions[state.currentQuestionIndex];
    if (!q) return;

    // Deshabilitar todos los botones para evitar re-marcado
    const allBtns = elements.optionsGrid.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    const isCorrect = selectedIndex === q.correct_option_index;

    if (!isReplaying) {
        // Guardar respuesta por índice explícito para evitar duplicación al reanudar
        state.answers[state.currentQuestionIndex] = {
            questionId: state.currentQuestionIndex,
            userAnswer: selectedIndex,
            isCorrect: isCorrect
        };

        // Recalcular puntaje exacto basado en respuestas únicas
        state.score = state.answers.filter(a => a && a.isCorrect).length;
        saveSession(); // ✅ PERSISTENCIA INMEDIATA
    }

    // --- Retroalimentación Visual ---
    if (state.maxQuestions === 100) {
        // MODO SIMULACRO REAL (100q): Selección neutra blanca, sin feedback de acierto/error inmediato.
        if (btnElement) btnElement.classList.add('neutral-selected');
    } else {
        // MODO ESTUDIO (20q) o RÁPIDO (10q): Feedback inmediato rojo/azul
        if (isCorrect) {
            if (btnElement) btnElement.classList.add('correct');
        } else {
            if (btnElement) btnElement.classList.add('wrong');
            const correctIdx = q.correct_option_index !== undefined ? q.correct_option_index : q.correct_index;
            if (correctIdx !== undefined && allBtns[correctIdx]) {
                allBtns[correctIdx].classList.add('correct');
            }
        }
    }

    // Configurar acción y texto del botón Siguiente / Finalizar
    const isLastQuestion = (state.currentQuestionIndex + 1) >= state.maxQuestions;
    const nextBtn = elements.nextBtn || document.getElementById('nextBtn');
    if (nextBtn) {
        if (isLastQuestion) {
            nextBtn.innerHTML = `Finalizar Simulacro <i class="fas fa-check-circle" style="margin-left: 0.5rem;"></i>`;
        } else {
            nextBtn.innerHTML = `Siguiente Pregunta <i class="fas fa-arrow-right" style="margin-left: 0.5rem;"></i>`;
        }
        nextBtn.classList.remove('hidden');
        nextBtn.style.display = 'inline-flex';
        nextBtn.onclick = () => handleNextQuestion();
    }

    // 🚀 BIFURCACIÓN DE COMPORTAMIENTO PARA FEEDBACK / SIGUIENTE
    // Simulacro Real (>= 50qs o mode=real) y Modo Rápido (10qs o mode=arcade) son Modo Ciego estricto
    const isRealMock = state.mode === 'real' || Number(state.maxQuestions) >= 50;
    const isStudyMode = !isRealMock && !state.isDemo && state.mode !== 'arcade' && Number(state.maxQuestions) !== 10 && (Number(state.maxQuestions) === 20 || state.mode === 'study');

    if (isStudyMode) {
        // MODO ESTUDIO (20q): Mostrar explicación y el botón siguiente
        if (elements.explanationText) {
            elements.explanationText.innerHTML = window.MarkdownRenderer ? window.MarkdownRenderer.render(q.explanation || "Respuesta correcta según normas técnicas y guías oficiales.") : (q.explanation || "Respuesta correcta según normas técnicas y guías oficiales.");
        }

        if (elements.explanationImage && elements.explanationImageContainer) {
            if (q.explanation_image_url && typeof q.explanation_image_url === 'string' && q.explanation_image_url.trim() !== '') {
                elements.explanationImage.src = window.resolveImageUrl(q.explanation_image_url);
                elements.explanationImageContainer.style.display = 'block';
                elements.explanationImageContainer.classList.remove('hidden');
            } else {
                elements.explanationImageContainer.style.display = 'none';
                elements.explanationImageContainer.classList.add('hidden');
                elements.explanationImage.removeAttribute('src');
            }
        }

        const isEdu = (state.context || '').toUpperCase() === 'EDUCACION' || ['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(state.targetExam);
        const titleTextEl = document.getElementById('explanationTitleText');
        const iconEl = document.getElementById('explanationIcon');
        if (titleTextEl) {
            titleTextEl.textContent = isEdu ? 'Sustento Pedagógico Oficial' : 'Sustento Clínico Oficial';
        }
        if (iconEl) {
            iconEl.className = isEdu ? 'fas fa-graduation-cap' : 'fas fa-stethoscope';
        }

        if (elements.feedbackBox) {
            elements.feedbackBox.classList.remove('hidden');
            elements.feedbackBox.style.display = 'flex';
            if (!isCorrect) {
                elements.feedbackBox.classList.add('error');
            } else {
                elements.feedbackBox.classList.remove('error');
            }
        }
    } else {
        // MODO RÁPIDO (10q) o SIMULACRO REAL (60q / 100q): Ocultamos explicación/feedback box, mostramos solo botón siguiente
        if (elements.feedbackBox) {
            elements.feedbackBox.classList.add('hidden');
            elements.feedbackBox.style.display = 'none';
        }
    }

    const nextContainer = elements.nextBtnContainer || document.getElementById('nextBtnContainer');
    if (nextContainer) {
        nextContainer.classList.remove('hidden');
        nextContainer.style.display = 'flex';
    }

    // Configurar y mostrar botón de Tutor IA (No disponible en vivo durante modo rápido, modo ciego, simulacro real ni modo demo/visitante)
    const tutorBtn = document.getElementById('btn-open-quiz-tutor');
    if (tutorBtn) {
        const isBlindMode = isRealMock || Number(state.maxQuestions) <= 10 || state.mode === 'arcade' || Boolean(state.isDemo);
        const isGuest = Boolean(state.isDemo) || new URLSearchParams(window.location.search).get('demo') === 'true' || 
                        (window.sessionManager ? !window.sessionManager.isLoggedIn() : !localStorage.getItem('authToken'));
        if (isBlindMode || isGuest) {
            tutorBtn.classList.add('hidden');
            tutorBtn.style.display = 'none';
        } else {
            tutorBtn.classList.remove('hidden');
            tutorBtn.style.display = 'inline-flex';
            tutorBtn.onclick = (e) => {
                const isGuest = new URLSearchParams(window.location.search).get('demo') === 'true' || 
                                (window.sessionManager ? !window.sessionManager.isLoggedIn() : !localStorage.getItem('authToken'));
                if (isGuest) {
                    if (window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
                        window.uiManager.showAuthPromptModal();
                        return;
                    }
                }

                if (window.uiManager && typeof window.uiManager.validateFreemiumAction === 'function') {
                    if (!window.uiManager.validateFreemiumAction(e, 'quiz_tutor')) {
                        return;
                    }
                }

                const qContext = buildQuestionTutorContext(state.currentQuestionIndex);
                if (qContext && window.quizTutor) {
                    window.quizTutor.toggle(true, qContext);
                }
            };
        }
    }

    // 📜 Desplazamiento suave e inteligente tras responder
    setTimeout(() => {
        if (isStudyMode && elements.feedbackBox && elements.feedbackBox.style.display !== 'none') {
            elements.feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            const nextContainer = elements.nextBtnContainer || document.getElementById('nextBtnContainer');
            if (nextContainer && nextContainer.style.display !== 'none') {
                nextContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, 100);
}

function handlePreviousQuestion() {
    if (state.currentQuestionIndex > 0) {
        cancelCurrentScroll();
        if (window.quizTutor) window.quizTutor.toggle(false);
        state.currentQuestionIndex--;
        renderQuestion();
    }
}

function handleNextQuestion() {
    cancelCurrentScroll();
    if (window.quizTutor) window.quizTutor.toggle(false);
    state.currentQuestionIndex++;
    if (state.currentQuestionIndex >= state.maxQuestions) {
        finishQuiz();
    } else {
        renderQuestion();
    }
}

// 5. Temporizador Real Mock (Maestro)
let timerInterval;
function startMockTimer() {
    // 🔄 RECURSO DE PERSISTENCIA: Si hay tiempo guardado en el estado, lo usamos.
    // Duración oficial reglamentaria:
    // - Educación (60 preguntas): 3 horas (10,800s / 180 min) según pruebas oficiales MINEDU.
    // - Salud / Medicina (100 preguntas): 2 horas (7,200s / 120 min) según pruebas oficiales ENAM/SERUMS.
    const isEduContext = (state.context || '').toUpperCase() === 'EDUCACION' || state.maxQuestions === 60 || ['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(state.targetExam);
    const defaultDurationSeconds = isEduContext ? 10800 : 7200;
    let timeLeft = (state.timeLeft !== undefined && state.timeLeft !== null) ? state.timeLeft : defaultDurationSeconds;

    // Función para formatear HH:MM:SS (si >= 1h) o MM:SS (si < 1h)
    const updateDisplay = () => {
        if (!elements.timer) return;
        if (timeLeft >= 3600) {
            const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
            const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            elements.timer.textContent = `${h}:${m}:${s}`;
        } else {
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            elements.timer.textContent = `${m}:${s}`;
        }
    };

    updateDisplay(); // Mostrar inicial

    // Si el tiempo ya expiró al iniciar o recuperar, entregamos automáticamente de inmediato
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (window.uiManager) window.uiManager.showToast("⏰ ¡El tiempo límite ha expirado! Calificando tus respuestas...", 'warning', 4000);
        finishQuiz();
        return;
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        state.timeLeft = timeLeft; // Sincronizar con el estado global

        // Auto-save periódico (cada 10 segundos para no saturar storage, o en cada cambio si prefieres)
        if (timeLeft % 10 === 0) saveSession();

        updateDisplay();

        // Alerta visual de los últimos 5 minutos
        if (timeLeft === 300) {
            elements.timer.parentElement.style.background = 'rgba(239, 68, 68, 0.4)'; // Rojo más intenso
            elements.timer.parentElement.style.animation = 'pulse-ring 2s infinite';
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (window.uiManager) window.uiManager.showToast("⏰ ¡Se acabó el tiempo! Entregando tu simulacro automáticamente...", 'warning', 4000);
            finishQuiz();
        }
    }, 1000);
}

// 6. Finalizar Quiz
// ✅ Helper para encolar envíos fallidos de resultados de simulacros
function savePendingSubmission(quizId, payload) {
    try {
        const pending = JSON.parse(localStorage.getItem('simulator_pending_submissions') || '[]');
        if (!pending.some(p => p.quizId === quizId)) {
            pending.push({ quizId, payload, savedAt: Date.now(), context: state.context });
            localStorage.setItem('simulator_pending_submissions', JSON.stringify(pending));
            console.log(`💾 [Queue] Simulacro ${quizId} guardado localmente en pendientes.`);
        }
    } catch (e) {
        console.warn("Fallo guardando envío pendiente:", e);
    }
}

function removePendingSubmission(quizId) {
    try {
        const pending = JSON.parse(localStorage.getItem('simulator_pending_submissions') || '[]');
        const filtered = pending.filter(p => p.quizId !== quizId);
        localStorage.setItem('simulator_pending_submissions', JSON.stringify(filtered));
    } catch (e) {}
}

// ✅ Interfaz de Reintento ante caídas de conexión durante la carga de lotes
function showNetworkRetryOverlay() {
    const existing = document.getElementById('network-retry-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'network-retry-overlay';
    overlay.className = 'loading-overlay';

    overlay.innerHTML = `
        <div class="loading-card" style="max-width: 420px;">
            <div style="font-size: 2.5rem; margin-bottom: 1.25rem; color: #f59e0b;">
                <i class="fas fa-wifi"></i>
            </div>
            <h3 class="loading-title" style="margin-bottom: 0.5rem;">Error de Conexión</h3>
            <p class="loading-subtitle" style="margin-bottom: 1.75rem;">No pudimos conectar con el servidor para cargar las preguntas. Verifica tu conexión a internet.</p>
            <button id="btn-retry-batch" class="btn-primary" style="padding: 0.75rem 2rem; border-radius: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%;">
                <i class="fas fa-sync"></i> Reintentar Carga
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    const retryBtn = document.getElementById('btn-retry-batch');
    if (retryBtn) {
        retryBtn.onclick = () => {
            overlay.remove();
            fetchNextBatch();
        };
    }
}

async function finishQuiz() {
    state.isFinished = true;
    clearSession(); // ✅ Limpiar de inmediato cualquier sesión activa para evitar la modal de reanudación
    clearInterval(timerInterval);
    if (window.quizTutor) window.quizTutor.toggle(false);
    const tutorBtn = document.getElementById('btn-open-quiz-tutor');
    if (tutorBtn) tutorBtn.style.display = 'none';

    // Ocultar elementos de pregunta activa
    const qHeader = document.querySelector('.question-header');
    if (qHeader) qHeader.style.display = 'none';
    const qLayout = document.getElementById('questionLayout');
    if (qLayout) qLayout.style.display = 'none';
    const nextContainer = elements.nextBtnContainer || document.getElementById('nextBtnContainer');
    if (nextContainer) {
        nextContainer.classList.add('hidden');
        nextContainer.style.display = 'none';
    }

    // Calcular Score Visual
    const denominator = state.maxQuestions; // 🎯 Siempre sobre el total configurado (10, 20, 100)
    if (elements.finalScore) {
        elements.finalScore.textContent = `${state.score}/${denominator}`;
    }

    // Calcular porcentaje para el círculo (SVG dashoffset)
    const actualTotal = denominator || 1;
    const pct = Math.min(100, Math.max(0, (state.score / actualTotal) * 100));

    // Circunferencia = 2 * PI * r(45) = 282.74
    const circumference = 283;
    const dashoffset = circumference - (pct / 100) * circumference;

    if (elements.svgScoreProgress) {
        // Trigger fluid animation slightly after modal opens
        setTimeout(() => {
            elements.svgScoreProgress.style.strokeDashoffset = dashoffset;
        }, 200);
    }

    const resOverlay = document.getElementById('resultsOverlay') || elements.resultsOverlay;
    if (resOverlay) {
        resOverlay.style.display = 'flex';
        resOverlay.classList.remove('hidden');
        resOverlay.classList.add('active');
    }

    // 📊 LOCAL STATS SAVING (Guest Demo Persistence)
    const urlParamsFinish = new URLSearchParams(window.location.search);
    if (urlParamsFinish.get('demo') === 'true') {
        const correct = state.answers.filter(a => a.isCorrect).length;
        const total = state.answers.length; // Use answered questions
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Calculate Area Stats for Radar Chart
        const areaStats = {};
        state.answers.forEach((ans, idx) => {
            const q = state.questions[idx];
            const topic = q.topic || 'Otros';
            if (!areaStats[topic]) areaStats[topic] = { correct: 0, total: 0 };
            areaStats[topic].total++;
            if (ans.isCorrect) areaStats[topic].correct++;
        });

        const currentStats = {
            lastRun: new Date().toISOString(),
            correct: correct,
            incorrect: total - correct,
            accuracy: accuracy,
            avgScore: total > 0 ? (correct * 20 / total).toFixed(1) : '0',
            areaStats: areaStats // { Topic: {correct, total} }
        };

        const domainKey = (state.context || 'MEDICINA').toLowerCase();
        if (window.GuestSessionManager) {
            window.GuestSessionManager.saveGuestStats(domainKey, currentStats);
        } else {
            localStorage.setItem(`guest_demo_stats_${domainKey}`, JSON.stringify(currentStats));
        }
        console.log(`💾 Estadísticas demo (${domainKey}) guardadas localmente.`);

        // No return early here, let it show the results overlay
    }

    // Enviar Resultados al Backend (SALTAR EN DEMO)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
        console.log("🏁 Demo finalizada. Resultados no guardados en base de datos.");
        return;
    }

    const totalCount = state.questions.length;
    const actualScore = (state.answers || []).filter(a => a && a.isCorrect).length;
    state.score = actualScore;

    const payload = {
        quizSessionId: state.quizSessionId || undefined,
        topic: state.areas && state.areas.length > 1 ? 'Multi-Área' : (state.topic || 'General'),
        areas: state.areas || [],
        target: state.targetExam,
        career: state.career,
        difficulty: state.difficulty,
        mode: state.mode || (totalCount >= 50 ? 'real' : undefined),
        score: actualScore,
        total_questions: totalCount,
        totalQuestions: totalCount,
        questions: state.questions.map((q, idx) => ({
            id: q.id,
            sessionQuestionId: q.sessionQuestionId || undefined,
            userAnswer: state.answers[idx]?.userAnswer !== undefined ? state.answers[idx].userAnswer : null,
            correct_option_index: q.correct_option_index,
            isCorrect: !!state.answers[idx]?.isCorrect,
            topic: q.topic || state.topic || 'General'
        }))
    };

    try {
        await window.NetworkService.fetch(`${API_URL}/submit`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        console.log("✅ Resultados guardados con éxito.");

        // Sincronización de sesión y vidas gestionada centralizadamente por NetworkService.fetch

        clearSession(); // ✅ LIMPIAR SOLO SI TUVO ÉXITO
        removePendingSubmission(state.quizId);
    } catch (error) {
        console.error("Error guardando resultados", error);
        
        savePendingSubmission(state.quizId, payload);
        clearSession(); // Limpiar la sesión activa para permitir iniciar nuevos simulacros

        // Si falla definitivamente después de los reintentos de safeFetch
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Error de Conexión',
                text: 'No pudimos sincronizar tus resultados con el servidor debido a un fallo de red. No te preocupes, han sido guardados localmente y se subirán automáticamente en cuanto recuperes conexión.',
                icon: 'warning',
                background: 'rgba(20,20,20,0.95)'
            });
        }
    }
}


// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// --- 🖼️ Visor Lightbox Premium (Zoom, Drag, Gestos) ---
function initLightbox() {
    const modal = document.getElementById('lightboxModal');
    const closeBtn = document.getElementById('lightboxClose');
    const zoomInBtn = document.getElementById('lightboxZoomIn');
    const zoomOutBtn = document.getElementById('lightboxZoomOut');
    const zoomResetBtn = document.getElementById('lightboxZoomReset');
    const viewport = document.getElementById('lightboxViewport');
    const image = document.getElementById('lightboxImage');

    if (!modal || !image) {
        console.warn("⚠️ Elementos del Lightbox no encontrados en el DOM. Reintentando en 500ms...");
        setTimeout(initLightbox, 500);
        return;
    }

    let zoomLevel = 1;
    let isDragging = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;
    
    // Para pinch to zoom
    let initialTouchDist = 0;
    let lastZoomLevel = 1;

    // Función de actualización de transformación
    function updateTransform() {
        // Limitar zoom entre 0.5 y 6
        zoomLevel = Math.min(6, Math.max(0.5, zoomLevel));
        
        // Limitar arrastre para que la imagen no desaparezca de la pantalla
        const maxTranslateX = window.innerWidth * zoomLevel;
        const maxTranslateY = window.innerHeight * zoomLevel;
        translateX = Math.min(maxTranslateX, Math.max(-maxTranslateX, translateX));
        translateY = Math.min(maxTranslateY, Math.max(-maxTranslateY, translateY));

        image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
    }

    // Resetear posición y escala
    function resetZoom() {
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    }

    // Abrir Lightbox con imagen específica
    window.openLightbox = function(src) {
        if (!src) return;
        image.src = src;
        modal.classList.add('active');
        resetZoom();
        document.body.style.overflow = 'hidden'; // Bloquear scroll de fondo
        if (window.uiManager && typeof window.uiManager.pushModalState === 'function') {
            window.uiManager.pushModalState('lightboxModal');
        }
    };

    // Cerrar Lightbox
    function closeLightbox(isFromPopState = false) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            image.src = '';
        }, 300); // Esperar transición CSS
        
        if (!isFromPopState && window.uiManager && typeof window.uiManager.popModalState === 'function') {
            window.uiManager.popModalState('lightboxModal');
        }
    }

    // Exponer globalmente para la integración con UIManager
    window.closeLightbox = closeLightbox;

    // Eventos de botones
    closeBtn.onclick = () => closeLightbox(false);
    
    zoomInBtn.onclick = () => {
        zoomLevel += 0.25;
        updateTransform();
    };

    zoomOutBtn.onclick = () => {
        zoomLevel -= 0.25;
        updateTransform();
    };

    zoomResetBtn.onclick = resetZoom;

    // Cerrar al hacer click en el fondo vacío del viewport
    viewport.onclick = (e) => {
        if (e.target === viewport || e.target === modal) {
            closeLightbox(false);
        }
    };

    // --- Arrastre (Drag) con Ratón ---
    viewport.addEventListener('mousedown', (e) => {
        if (e.target !== image && e.target !== viewport) return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        viewport.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            viewport.classList.remove('dragging');
        }
    });

    // --- Soporte Móvil (Touch Events) ---
    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // Un dedo: Arrastre
            isDragging = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
            viewport.classList.add('dragging');
        } else if (e.touches.length === 2) {
            // Dos dedos: Pellizcar para Zoom
            isDragging = false;
            initialTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            lastZoomLevel = zoomLevel;
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            updateTransform();
        } else if (e.touches.length === 2 && initialTouchDist > 0) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = dist / initialTouchDist;
            zoomLevel = lastZoomLevel * factor;
            updateTransform();
        }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
        isDragging = false;
        viewport.classList.remove('dragging');
        initialTouchDist = 0;
    });

    // Zoom con la rueda del ratón (Mouse Wheel)
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.1 : -0.1;
        zoomLevel += factor;
        updateTransform();
    }, { passive: false });

    // Doble click para zoom inteligente toggle (1x <-> 2.5x)
    viewport.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (zoomLevel > 1) {
            resetZoom();
        } else {
            zoomLevel = 2.5;
            const rect = viewport.getBoundingClientRect();
            const clickX = e.clientX - rect.left - rect.width/2;
            const clickY = e.clientY - rect.top - rect.height/2;
            translateX = -clickX * 1.5;
            translateY = -clickY * 1.5;
            updateTransform();
        }
    });

    // Soporte Teclado: Escape para cerrar
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeLightbox(false);
        }
    });

    // Vincular clicks a los elementos de imagen interactivos existentes (metadata image_url)
    const bindImageClick = (elementId) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.addEventListener('click', () => {
                if (el.src) window.openLightbox(el.src);
            });
        }
    };

    bindImageClick('questionImage');
    bindImageClick('explanationImage');
    bindImageClick('caseImage');

    // Delegación para imágenes inline en enunciados, casuísticas y explicaciones
    const qText = document.getElementById('questionText');
    if (qText) {
        qText.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && e.target.src) {
                window.openLightbox(e.target.src);
            }
        });
    }

    const caseContainer = document.getElementById('caseScenarioContainer');
    if (caseContainer) {
        caseContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && e.target.src) {
                window.openLightbox(e.target.src);
            }
        });
    }

    const expText = document.getElementById('explanationText');
    if (expText) {
        expText.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && e.target.src) {
                window.openLightbox(e.target.src);
            }
        });
    }

    // Delegación global en el feed de revisión
    const reviewFeed = document.getElementById('reviewFeed');
    if (reviewFeed) {
        reviewFeed.addEventListener('click', (e) => {
            // Ignorar clicks en botones, controles interactivos o avatares de acción (Tutor IA, audio, etc.)
            if (e.target.closest('button, .btn-review-tutor-trigger, .quiz-audio-btn, a, .no-lightbox')) {
                return;
            }

            // Si hacen click directo en una imagen de la pregunta, casuística o explicación
            if (e.target.tagName === 'IMG' && e.target.src) {
                if (e.target.closest('.review-q-image-container, .review-explanation-image-container, .review-q-text, .review-explanation-body, .review-case-box, .review-case-body, .review-case-image-wrap')) {
                    window.openLightbox(e.target.src);
                    return;
                }
            }
            
            // Fallback para clicks en el contenedor de imagen
            const container = e.target.closest('.review-q-image-container, .review-explanation-image-container, .review-case-image-wrap');
            if (container) {
                const img = container.querySelector('img');
                if (img && img.src) {
                    window.openLightbox(img.src);
                }
            }
        });
    }
}

// Helper for custom smooth and gentle scrolling (easeInOutQuad)
function smoothScrollTo(element, duration = 2200) {
    if (!element) return;
    
    // Cancel any ongoing scroll animation first
    cancelCurrentScroll();

    const targetY = element.getBoundingClientRect().top + window.scrollY;
    const startY = window.scrollY;
    const distance = targetY - startY - 40; // offset by 40px for safety spacing
    let startTime = null;
    let userInterrupted = false;

    // Detect user interruption
    const interruptHandler = () => {
        userInterrupted = true;
        cancelCurrentScroll();
    };

    const cleanup = () => {
        window.removeEventListener('wheel', interruptHandler);
        window.removeEventListener('touchmove', interruptHandler);
        window.removeEventListener('touchstart', interruptHandler);
        window.removeEventListener('mousedown', interruptHandler);
        window.removeEventListener('pointerdown', interruptHandler);
        window.removeEventListener('keydown', interruptHandler);
        activeScrollCleanup = null;
    };

    window.addEventListener('wheel', interruptHandler, { passive: true });
    window.addEventListener('touchmove', interruptHandler, { passive: true });
    window.addEventListener('touchstart', interruptHandler, { passive: true });
    window.addEventListener('mousedown', interruptHandler, { passive: true });
    window.addEventListener('pointerdown', interruptHandler, { passive: true });
    window.addEventListener('keydown', interruptHandler, { passive: true });

    activeScrollCleanup = cleanup;

    function animation(currentTime) {
        if (userInterrupted) return; // Stop if user interrupted
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutQuad(Math.min(timeElapsed, duration), startY, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) {
            if (typeof requestAnimationFrame === 'function') {
                currentScrollAnimationId = requestAnimationFrame(animation);
            }
        } else {
            cleanup();
            currentScrollAnimationId = null;
        }
    }

    function easeInOutQuad(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    if (typeof requestAnimationFrame === 'function') {
        currentScrollAnimationId = requestAnimationFrame(animation);
    } else {
        window.scrollTo(0, targetY - 40);
    }
}

console.log("💎 Module quiz.js loaded successfully. showExamReview is ready with Zoom Lightbox.");

window.openQuizTutorForReview = window.openTutorForReviewQuestion;
