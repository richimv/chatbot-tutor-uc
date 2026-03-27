
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
    isLoadingBatch: false
};

// Elementos DOM
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingSubtitle: document.getElementById('loadingSubtitle'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    // Header Progress
    currentQ: document.getElementById('currentQ'),
    maxQ: document.getElementById('maxQ'),
    progressBar: document.getElementById('progressBar'),
    timer: document.getElementById('timer'),
    feedbackBox: document.getElementById('feedbackBox'),
    explanationText: document.getElementById('explanationText'),
    nextBtn: document.getElementById('nextBtn'),
    resultsOverlay: document.getElementById('resultsOverlay'),
    scoreCircle: document.getElementById('scoreCircle'),
    svgScoreProgress: document.getElementById('svgScoreProgress'),
    finalScore: document.getElementById('finalScore'),
    explanationImageContainer: document.getElementById('explanationImageContainer'),
    explanationImage: document.getElementById('explanationImage')
};

// Configuración
const API_URL = `${window.AppConfig.API_URL}/api/quiz`; // Ajustar según config

// 1. Inicialización
async function init() {
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.topic = urlParams.get('topic') || '';
    state.difficulty = urlParams.get('difficulty') || urlParams.get('level') || 'Senior';
    // Custom Exam Builder params
    let savedConfig = null;
    try {
        const stored = localStorage.getItem('simActiveConfig');
        if (stored) savedConfig = JSON.parse(stored);
    } catch (e) { console.warn("No active config found"); }

    state.targetExam = urlParams.get('target') || (savedConfig ? savedConfig.target : 'SERUMS');
    state.context = urlParams.get('context') || 'MEDICINA'; // Default
    state.career = urlParams.get('career') || (savedConfig ? savedConfig.career : null);

    const areasParam = urlParams.get('areas');
    if (areasParam) {
        state.areas = areasParam.split(',');
    } else if (savedConfig && savedConfig.areas && savedConfig.areas.length > 0) {
        state.areas = savedConfig.areas;
    } else {
        state.topic = urlParams.get('topic') || '';
        state.areas = state.topic ? [state.topic] : [];
    }

    // 🎯 Mode Selection: 
    // ?limit=5  -> Quick Mode
    // ?limit=20 -> Study Mode (Default)
    // ?limit=100 -> Real Mock
    const limitParam = parseInt(urlParams.get('limit'));
    if (!isNaN(limitParam) && limitParam > 0) {
        state.maxQuestions = limitParam;
    }
    if (elements.maxQ) elements.maxQ.textContent = state.maxQuestions;

    // Timer Logic: Only show for Real Mock (100 questions) - Users request
    const timerBadge = document.querySelector('.timer-badge');
    if (state.maxQuestions === 100 && timerBadge) {
        timerBadge.style.display = 'flex';
    } else if (timerBadge) {
        timerBadge.style.display = 'none';
    }

    // Setup Exit Buttons
    const handleExit = () => {
        const ctx = state.context || 'MEDICINA';
        window.location.href = `simulator-dashboard?context=${ctx}`;
    };

    const btnExit = document.getElementById('btn-exit-quiz');
    const btnTopExit = document.getElementById('btn-top-exit');

    if (btnExit) btnExit.onclick = handleExit;
    if (btnTopExit) btnTopExit.onclick = handleExit;

    try {
        await startQuiz();
    } catch (error) {
        console.error("Error iniciando quiz:", error);
        alert("Error iniciando el simulacro. Revisa la consola.");
    }
}

// 1.5 Helper para Obtener Token Fresco (Evita 401 en exámenes largos)
async function getValidToken() {
    // 1. Intentar usar supabase client si existe (Frontend)
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient.auth.getSession();
            if (data && data.session) {
                const freshToken = data.session.access_token;
                localStorage.setItem('authToken', freshToken); // Actualizar local
                return freshToken;
            }
        } catch (e) { console.warn("Error refreshing token via supabase UI", e); }
    }
    // 2. Fallback al token clásico
    return localStorage.getItem('authToken');
}

// 2. Iniciar Quiz (Llamada al Backend)
async function startQuiz() {
    // Mostrar Loading
    elements.loadingOverlay.classList.remove('hidden');

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
            limit: Math.min(5, state.maxQuestions)
        })
    };

    if (isDemo) {
        // --- 🌟 RAG DEMO ENGINE (Scalable) ---
        // Prioritize current target, fallback to SERUMS if empty, then fallback to anything available
        let target = state.targetExam || 'SERUMS';
        if (!window.DemoBank[target] || window.DemoBank[target].length === 0) {
            target = 'SERUMS';
        }

        let questions = window.DemoBank[target] || [];
        if (questions.length === 0) {
            // Last resort: find any non-empty category
            const categories = Object.keys(window.DemoBank);
            for (const cat of categories) {
                if (window.DemoBank[cat].length > 0) {
                    questions = window.DemoBank[cat];
                    target = cat;
                    break;
                }
            }
        }

        // --- 📊 DEMO ANTI-REPETITION & LIMITS ---
        const sessionsSent = parseInt(localStorage.getItem('demo_sessions_count') || '0');
        const seenIds = JSON.parse(localStorage.getItem('guest_seen_ids') || '[]');

        // Filter out questions already seen by this guest
        const availableQuestions = questions.filter(q => {
            // Use question_text as hash since demo data might not have unique IDs
            const qHash = btoa(q.question_text.substring(0, 50));
            return !seenIds.includes(qHash);
        });

        if (sessionsSent >= 3 || availableQuestions.length < state.maxQuestions) {
            elements.loadingOverlay.classList.add('hidden');
            if (window.uiManager && typeof window.uiManager.showAuthPromptModal === 'function') {
                window.uiManager.showAuthPromptModal();
            } else {
                window.location.href = '/register';
            }
            return;
        }

        // Shuffle available and Slice
        const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
        let sliced = shuffled.slice(0, state.maxQuestions);

        // Save seen IDs to prevent repetition
        const currentBatchHashes = sliced.map(q => btoa(q.question_text.substring(0, 50)));
        localStorage.setItem('guest_seen_ids', JSON.stringify([...new Set([...seenIds, ...currentBatchHashes])]));

        // Increment session count
        localStorage.setItem('demo_sessions_count', (sessionsSent + 1).toString());

        // 🎲 Shuffle Options (Fisher-Yates) like the Backend does (QuizService.js:142)
        sliced = sliced.map(q => {
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

        // Simular retardo de Red para feedback UI
        await new Promise(r => setTimeout(r, 800));

        data = {
            success: true,
            questions: sliced,
            topic: `DEMO: ${target}`
        };
    } else {
        const token = await getValidToken();
        if (!token) {
            alert("Debes iniciar sesión para realizar simulacros.");
            window.location.href = '/login';
            return;
        }
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(fetchUrl, fetchOptions);
        data = await response.json();

        // 🚦 Manejo del Error 403 (Banco Agotado o Paywall)
        if (response.status === 403) {
            elements.loadingOverlay.classList.add('hidden');
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                alert(data.error || "Límite alcanzado.");
                window.location.href = '/pricing';
            }
            return;
        }

        // 🛠 Error de Servidor (500) u Otros
        if (!response.ok && response.status !== 404) {
            elements.loadingOverlay.classList.add('hidden');
            console.error("Server Error:", data.error);
            alert("Hubo un error interno en el servidor. Por favor, intenta de nuevo o contacta a soporte técnico.");
            return;
        }
    }

    if (!data.success) {
        elements.loadingOverlay.classList.add('hidden');

        if (response && response.status === 404 && data.noQuestions) {
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal('Has completado las preguntas disponibles en este banco.', 'simulator');
            } else {
                alert('¡Banco Agotado!\\n\\nHas abarcado todas las preguntas de este tema y dificultad. Intenta cambiar tu configuración en el dashboard para acceder a más casos clínicos.');
                window.location.href = `simulator-dashboard?context=${state.context || 'MEDICINA'}`;
            }
            return;
        }

        if (response && response.status === 500) {
            alert("Error del servidor al cargar preguntas. Revisa tu conexión o intenta más tarde.");
            return;
        }

        if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function' && response && response.status === 403) {
            window.uiManager.showPaywallModal(data.error || 'No hay más preguntas disponibles en el Banco para este tema. Cambia de configuración o mejora tu plan para acceder a funciones avanzadas.');
        } else {
            alert(data.error || 'Hubo un error cargando el simulacro.');
        }
        return;
    }

    state.questions = data.questions;
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
    elements.loadingOverlay.classList.add('hidden');
    renderQuestion();

    // Iniciar temporizador maestro si es Simulacro Real
    if (state.maxQuestions === 100) {
        startMockTimer();
    }
}

// 2.5 Fetch Next Batch (Background)
async function fetchNextBatch() {
    if (state.isLoadingBatch) return;

    // NO BATCHING IN DEMO MODE (Static Content)
    const urlParamsNext = new URLSearchParams(window.location.search);
    if (urlParamsNext.get('demo') === 'true') return;

    state.isLoadingBatch = true;
    console.log("🔄 Fetching next batch...");

    try {
        const token = await getValidToken();
        const seenIds = state.questions.map(q => q.id);

        const response = await fetch(`${API_URL}/next-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                topic: state.topic, // Legacy compatibility
                target: state.targetExam,
                areas: state.areas,
                career: state.career,
                seenIds: seenIds
            })
        });

        const data = await response.json();

        // 🚦 Manejo del Error 500/404 Controlado (Límite Básico u otros)
        if (!response.ok || !data.success) {
            elements.loadingOverlay.classList.add('hidden');

            if (response.status === 404 && data.noQuestions) {
                alert('¡Excelente Trabajo! Has terminado con todas las preguntas disponibles para esta configuración. Puntuando lo que respondiste...');
                return finishQuiz();
            }

            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                alert(data.error || "No hay más preguntas disponibles para tu Plan actual.");
            }
            return finishQuiz(); // Acabar el examen con lo poco que tenía
        }

        // 🚦 Manejo del Error 403 (Banco Agotado o Paywall)
        if (response.status === 403) {
            elements.loadingOverlay.classList.add('hidden');
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error, 'simulator');
            } else {
                alert(data.error || "Límite alcanzado.");
                finishQuiz();
            }
            return;
        }

        // 🛠 Error de Servidor (500) u Otros (No 404)
        if (!response.ok && response.status !== 404) {
            elements.loadingOverlay.classList.add('hidden');
            console.error("Server Error:", data.error);
            alert("Error cargando más preguntas. Reintentando...");
            return;
        }

        if (data.success && data.questions.length > 0) {
            state.questions.push(...data.questions);
            console.log(`✅ Batch loaded. Total questions: ${state.questions.length}`);

            // 🔄 Refrescar áreas por si el backend rotó algo (opcional pero robusto)
            if (data.areas && data.areas.length > 0) {
                state.areas = data.areas;
            }

            updateProgressUI(); // Update progress bar with new total? Or keep relative to 20?
        }
    } catch (e) {
        console.error("Error fetching batch:", e);
        elements.loadingOverlay.classList.add('hidden');
        alert("Ocurrió un error cargando nuevas preguntas o se cortó tu conexión.");
    } finally {
        state.isLoadingBatch = false;
    }
}

// 3. Renderizar Pregunta
function renderQuestion() {
    // Check if we are done
    if (state.currentQuestionIndex >= state.maxQuestions) {
        return finishQuiz();
    }

    const q = state.questions[state.currentQuestionIndex];

    // If we ran out of questions but haven't hit maxQuestions yet (wait for batch?)
    if (!q) {
        if (state.isLoadingBatch) {
            if (elements.loadingTitle && elements.loadingSubtitle) {
                elements.loadingTitle.textContent = "Cargando próximas preguntas...";
                elements.loadingSubtitle.textContent = `Consultando banco de ${state.targetExam || state.topic}...`;
            }
            elements.loadingOverlay.classList.remove('hidden');
            setTimeout(renderQuestion, 500); // Retry
            return;
        } else {
            // No more questions available at all
            return finishQuiz();
        }
    }
    elements.loadingOverlay.classList.add('hidden');

    // Trigger Batch Load if we are close to end of current array using local threshold
    // E.g., if we have 5 qs, and we are at index 3, load more.
    if (state.questions.length < state.maxQuestions &&
        state.questions.length - state.currentQuestionIndex <= 2) {
        fetchNextBatch();
    }

    // Actualizar UI Header
    if (elements.currentQ) elements.currentQ.textContent = state.currentQuestionIndex + 1;
    updateProgressUI();

    // Imagen (si existe)
    const imgContainer = document.getElementById('questionImageContainer');
    const imgElement = document.getElementById('questionImage');
    const layout = document.getElementById('questionLayout');

    if (q.image_url) {
        imgElement.src = window.resolveImageUrl(q.image_url);
        imgContainer.classList.remove('hidden');
        if (layout) layout.classList.add('has-image');
    } else {
        imgContainer.classList.add('hidden');
        imgElement.src = '';
        if (layout) layout.classList.remove('has-image');
    }

    // Texto Pregunta
    elements.questionText.textContent = q.question_text;

    // Reset UI
    elements.optionsGrid.innerHTML = '';
    elements.feedbackBox.style.display = 'none';
    elements.feedbackBox.classList.remove('error');

    // Render Opciones
    const letters = ['A', 'B', 'C', 'D', 'E'];
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';

        const letterSpan = document.createElement('span');
        letterSpan.className = 'option-letter';
        letterSpan.textContent = letters[index] || '';

        const textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        textSpan.textContent = opt;

        btn.appendChild(letterSpan);
        btn.appendChild(textSpan);

        btn.onclick = () => handleAnswer(index, btn);
        elements.optionsGrid.appendChild(btn);
    });
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
function handleAnswer(selectedIndex, btnElement) {
    const q = state.questions[state.currentQuestionIndex];

    // Deshabilitar todos los botones
    const allBtns = elements.optionsGrid.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    const isCorrect = selectedIndex === q.correct_option_index;

    // Guardar respuesta silenciosamente
    state.answers.push({
        questionId: state.currentQuestionIndex,
        userAnswer: selectedIndex,
        isCorrect: isCorrect
    });

    // 🏆 MODO CIEGO (Simulacro Real)
    if (state.maxQuestions === 100) {
        // Solo marcar azul sin relevar acierto/error
        btnElement.classList.add('selected');
        if (isCorrect) state.score++;

        // Auto-avanzar después de medio segundo de delay "táctil"
        setTimeout(() => {
            state.currentQuestionIndex++;
            // ✅ CORRECCIÓN: No finalizar hasta llegar al total esperado (10, 20 o 100)
            if (state.currentQuestionIndex >= state.maxQuestions) {
                finishQuiz();
            } else {
                renderQuestion();
            }
        }, 600);
        return;
    }

    // 📚 MODO ESTUDIO (Comportamiento Clásico)
    // Estilos Visuales
    if (isCorrect) {
        btnElement.classList.add('correct');
        state.score++;
    } else {
        btnElement.classList.add('wrong');
        // Mostrar cuál era la correcta (Seguridad: q.correct_option_index debe ser válido)
        const correctIdx = q.correct_option_index !== undefined ? q.correct_option_index : q.correct_index;
        if (correctIdx !== undefined && allBtns[correctIdx]) {
            allBtns[correctIdx].classList.add('correct');
        }
        elements.feedbackBox.classList.add('error');
    }

    // Mostrar Feedback (Explicación)
    elements.explanationText.textContent = q.explanation || "Respuesta correcta basada en guías clínicas.";
    
    // ✅ NUEVO: Mostrar Imagen de Explicación (si existe)
    if (q.explanation_image_url) {
        // ✅ Usar el resolutor universal (Soporta GCS, ID-Proxy y URLs Externas)
        elements.explanationImage.src = window.resolveImageUrl(q.explanation_image_url);
        elements.explanationImageContainer.classList.remove('hidden');
    } else {
        elements.explanationImageContainer.classList.add('hidden');
        elements.explanationImage.src = '';
    }

    elements.feedbackBox.style.display = 'block';

    // Configurar Botón Siguiente
    elements.nextBtn.onclick = () => {
        state.currentQuestionIndex++;
        // ✅ CORRECCIÓN: No finalizar hasta llegar al total esperado (10, 20 o 100)
        if (state.currentQuestionIndex >= state.maxQuestions) {
            finishQuiz();
        } else {
            renderQuestion();
        }
    };
}

// 5. Temporizador Real Mock (Maestro)
let timerInterval;
function startMockTimer() {
    let timeLeft = 7200; // 120 minutos en segundos (2 horas)

    // Función para formatear MM:SS
    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        elements.timerDisplay.textContent = `${m}:${s}`;
    };

    updateDisplay(); // Mostrar inicial

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        // Alerta visual de los últimos 5 minutos
        if (timeLeft === 300) {
            elements.timerDisplay.parentElement.style.background = 'rgba(239, 68, 68, 0.4)'; // Rojo más intenso
            elements.timerDisplay.parentElement.style.animation = 'pulse-ring 2s infinite';
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("⏰ ¡Se acabó el tiempo! Entregando tu simulacro automáticamente...");
            finishQuiz();
        }
    }, 1000);
}

// 6. Finalizar Quiz
async function finishQuiz() {
    clearInterval(timerInterval);

    // Calcular Score Visual
    const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
    const denominator = state.maxQuestions; // 🎯 Siempre sobre el total configurado (10, 20, 100)
    elements.finalScore.textContent = `${state.score}/${denominator}`;

    // Calcular porcentaje para el círculo (SVG dashoffset)
    const actualTotal = denominator || 1;
    const pct = (state.score / actualTotal) * 100;

    // Circunferencia = 2 * PI * r(45) = 282.74
    const circumference = 283;
    const dashoffset = circumference - (pct / 100) * circumference;

    if (elements.svgScoreProgress) {
        // Trigger fluid animation slightly after modal opens
        setTimeout(() => {
            elements.svgScoreProgress.style.strokeDashoffset = dashoffset;
        }, 200);
    }

    elements.resultsOverlay.classList.add('active');

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

        localStorage.setItem('guest_demo_stats', JSON.stringify(currentStats));
        console.log("💾 Estadísticas demo guardadas localmente con desglose por área.");

        // No return early here, let it show the results overlay
    }

    // Enviar Resultados al Backend (SALTAR EN DEMO)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
        console.log("🏁 Demo finalizada. Resultados no guardados en base de datos.");
        return;
    }

    const token = await getValidToken();
    try {
        await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                topic: state.areas && state.areas.length > 1 ? 'Multi-Área' : state.topic, // Enviar etiqueta "Multi-Área" si hay más de 1
                areas: state.areas, // Extra metadata
                target: state.targetExam,
                career: state.career,
                score: state.score,
                total_questions: state.currentQuestionIndex, // Send actual total answered
                questions: state.questions.slice(0, state.currentQuestionIndex).map((q, idx) => ({
                    ...q,
                    userAnswer: state.answers[idx]?.userAnswer || 0, // Fallback en caso de click ultra rápìdo
                    topic: q.topic || state.topic // Preservar el topic individual de la pregunta si el backend lo mandó
                }))
            })
        });
        console.log("✅ Resultados guardados y Flashcards generadas.");
    } catch (e) {
        console.error("Error guardando resultados", e);
    }
}

// 7. Revisión Post-Examen (Exam Review)
window.showExamReview = async function () {
    // Esconder resultados y grilla principal
    document.getElementById('resultsOverlay').classList.remove('active');
    document.querySelector('.question-header').style.display = 'none';
    document.getElementById('questionText').style.display = 'none';
    document.getElementById('optionsGrid').style.display = 'none';
    document.getElementById('feedbackBox').style.display = 'none';

    // Mostrar Contenedor de Revisión
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.classList.remove('hidden');

    const feed = document.getElementById('reviewFeed');
    feed.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#3b82f6;"></i><br><p style="color:#cbd5e1; margin-top:1rem;">Cargando revisión...</p></div>';

    // Iterar por las preguntas que realmente contestó o el total si ya terminó
    const totalProcessed = state.currentQuestionIndex >= state.questions.length
        ? state.questions.length
        : state.currentQuestionIndex;
    const answeredQuestions = state.questions.slice(0, totalProcessed);

    // Check which ones are already saved as flashcards
    let savedFronts = new Set();
    const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
    if (!isDemo && answeredQuestions.length > 0) {
        try {
            const token = await getValidToken();
            const res = await fetch(`${API_URL}/../training/flashcards/check-saved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    questions: answeredQuestions,
                    moduleName: state.context || 'MEDICINA'
                })
            });
            const data = await res.json();
            if (data.success && data.savedFronts) {
                savedFronts = new Set(data.savedFronts);
            }
        } catch (e) {
            console.error('Error checking saved flashcards', e);
        }
    }

    feed.innerHTML = ''; // Limpiar indicator

    for (let i = 0; i < totalProcessed; i++) {
        const q = state.questions[i];
        const ans = state.answers[i]; // { questionId, userAnswer, isCorrect }

        const card = document.createElement('div');
        card.className = 'review-card';

        // Contenedor flexible para Título/Pregunta y Botón
        const headerDiv = document.createElement('div');
        headerDiv.className = 'review-card-header';

        // Título/Pregunta
        const qText = document.createElement('div');
        qText.className = 'review-q-text';
        qText.style.flex = '1';
        qText.style.margin = '0';
        qText.innerHTML = `<span style="color:#3b82f6; font-weight: 800; margin-right: 0.5rem;">Q${i + 1}</span> ${q.question_text}`;
        headerDiv.appendChild(qText);

        // Flashcard Button
        if (!isDemo) {
            const saveBtnContainer = document.createElement('div');
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-neon';
            saveBtn.style.padding = '0.5rem 1rem';
            saveBtn.style.fontSize = '0.75rem';
            saveBtn.style.whiteSpace = 'nowrap';
            saveBtn.style.borderRadius = '20px'; // Mas redondeado

            const isSaved = savedFronts.has(q.question_text.trim());
            if (isSaved) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Ya guardado';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.style.background = 'rgba(16, 185, 129, 0.2)'; // Verde apagado
                saveBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                saveBtn.style.color = '#10b981';
                saveBtn.style.boxShadow = 'none';
            } else {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Flashcard';
                // Añadir un color de acento azul/purpura para distinción

                saveBtn.onclick = async () => {
                    const originalText = saveBtn.innerHTML;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
                    saveBtn.disabled = true;
                    try {
                        const token = await getValidToken();
                        const res = await fetch(`${API_URL}/../training/flashcards/save-from-question`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({
                                question: q,
                                topic: q.topic || state.topic,
                                moduleName: state.context || 'MEDICINA'
                            })
                        });
                        const data = await res.json();
                        if (data.success) {
                            saveBtn.innerHTML = '<i class="fas fa-check"></i> Ya guardado';
                            saveBtn.style.background = 'rgba(16, 185, 129, 0.2)';
                            saveBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                            saveBtn.style.color = '#10b981';
                            saveBtn.style.boxShadow = 'none';
                            saveBtn.style.opacity = '0.5';
                            saveBtn.style.cursor = 'not-allowed';
                        } else {
                            saveBtn.innerHTML = originalText;
                            saveBtn.disabled = false;
                            alert('No se pudo guardar la flashcard: ' + (data.error || 'Error desconocido'));
                        }
                    } catch (e) {
                        saveBtn.innerHTML = originalText;
                        saveBtn.disabled = false;
                        console.error('Error saving flashcard', e);
                        alert('Error de conexión al guardar la flashcard');
                    }
                };
            }
            saveBtnContainer.appendChild(saveBtn);
            headerDiv.appendChild(saveBtnContainer);
        }

        card.appendChild(headerDiv);

        // Imagen de Pregunta (si existe)
        if (q.image_url) {
            card.classList.add('has-image'); // Para layout responsivo en CSS
            const imgContainer = document.createElement('div');
            imgContainer.className = 'review-q-image-container';
            const img = document.createElement('img');
            img.src = window.resolveImageUrl(q.image_url);
            img.loading = 'lazy';
            img.style.maxHeight = '250px';
            img.style.borderRadius = '8px';
            imgContainer.appendChild(img);
            card.appendChild(imgContainer);
        }

        // Opciones
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'review-options';

        q.options.forEach((optText, optIdx) => {
            const optDiv = document.createElement('div');
            optDiv.className = 'review-opt';

            // Text content
            const textSpan = document.createElement('span');
            textSpan.style.flex = '1';
            textSpan.textContent = optText;

            // Logica de colores
            if (optIdx === q.correct_option_index) {
                optDiv.classList.add('r-correct');
                textSpan.innerHTML = `<strong>${optText}</strong>`;
            } else if (ans && optIdx === ans.userAnswer) {
                optDiv.classList.add('r-wrong');
                textSpan.innerHTML = `<strong>${optText}</strong>`;
            }

            optDiv.appendChild(textSpan);
            optionsContainer.appendChild(optDiv);
        });
        card.appendChild(optionsContainer);

        // Explicación
        const expDiv = document.createElement('div');
        expDiv.className = 'review-explanation';
        
        let explanationHTML = `<strong><i class="fas fa-lightbulb" style="color:#fbbf24; margin-right:5px;"></i> Explicación:</strong><br><br>`;
        explanationHTML += `${q.explanation || 'Respuesta correcta basada en guías prácticas u oficiales pertinentes al tema.'}`;

        // ✅ NUEVO: Imagen en Revisión (AHORA ABAJO DEL TEXTO)
        if (q.explanation_image_url) {
            const imgUrl = window.resolveImageUrl(q.explanation_image_url);
            explanationHTML += `<div style="text-align:center; margin-top:1.5rem;"><img src="${imgUrl}" loading="lazy" style="max-width:100%; max-height:250px; border-radius:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"></div>`;
        }
        
        expDiv.innerHTML = explanationHTML;
        card.appendChild(expDiv);

        feed.appendChild(card);
    }

    // Scroll al inicio de la revisión
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Auto-init
document.addEventListener('DOMContentLoaded', init);
