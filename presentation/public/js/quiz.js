
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
    difficulty: '',
    maxQuestions: 20, // 🎯 Study Mode Limit
    isLoadingBatch: false
};

// Elementos DOM
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    currentQ: document.getElementById('currentQ'),
    progressBar: document.getElementById('progressBar'),
    timerDisplay: document.getElementById('timer'),
    feedbackBox: document.getElementById('feedbackBox'),
    explanationText: document.getElementById('explanationText'),
    nextBtn: document.getElementById('nextBtn'),
    resultsOverlay: document.getElementById('resultsOverlay'),
    finalScore: document.getElementById('finalScore'),
    scoreCircle: document.getElementById('scoreCircle')
};

// Configuración
const API_URL = '/api/quiz'; // Ajustar según config

// 1. Inicialización
async function init() {
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.topic = urlParams.get('topic') || 'Medicina General';
    state.difficulty = urlParams.get('difficulty') || urlParams.get('level') || 'Intermedio';
    state.context = urlParams.get('context') || 'MEDICINA'; // Default

    // Custom Exam Builder params
    state.targetExam = urlParams.get('target') || 'ENAM';
    const areasParam = urlParams.get('areas');
    state.areas = areasParam ? areasParam.split(',') : [state.topic];

    // 🎯 Mode Selection: 
    // ?limit=5  -> Quick Mode
    // ?limit=20 -> Study Mode (Default)
    // ?limit=100 -> Real Mock
    const limitParam = parseInt(urlParams.get('limit'));
    if (!isNaN(limitParam) && limitParam > 0) {
        state.maxQuestions = limitParam;
    }

    // Hide Timer by default (Requested by user)
    // Only show if Real Mock (limit 100) or explicit 'timer' param? 
    // For now, hide it as requested.
    document.querySelector('.timer-badge').style.display = 'none';

    // Setup Exit Button
    const btnExit = document.getElementById('btn-exit-quiz');
    if (btnExit) {
        btnExit.onclick = () => {
            // Redirect to Dashboard with Context
            const ctx = state.context || 'MEDICINA';
            window.location.href = `simulator-dashboard.html?context=${ctx}`;
        };
    }

    try {
        await startQuiz();
    } catch (error) {
        console.error("Error iniciando quiz:", error);
        alert("Error iniciando el simulacro. Revisa la consola.");
    }
}

// 2. Iniciar Quiz (Llamada al Backend)
async function startQuiz() {
    // Mostrar Loading
    elements.loadingOverlay.classList.remove('hidden');

    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("Debes iniciar sesión para realizar simulacros.");
        window.location.href = '/login.html';
        return;
    }

    const response = await fetch(`${API_URL}/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            topic: state.topic, // Legacy compatibility
            target: state.targetExam,
            areas: state.areas,
            difficulty: state.difficulty,
            limit: state.maxQuestions
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Error desconocido del servidor');
    }

    state.questions = data.questions;
    // 💡 ACTUALIZACIÓN DE TEMA: Si el backend rotó el tema (ej: Medicina -> Cardiología), actualizamos el estado.
    if (data.topic) {
        state.topic = data.topic;
        console.log(`Topic actualizado por Backend: ${state.topic}`);
    }
    state.startTime = Date.now();

    // Ocultar Loading y mostrar primera pregunta
    elements.loadingOverlay.classList.add('hidden');
    renderQuestion();
    startTimer();
}

// 2.5 Fetch Next Batch (Background)
async function fetchNextBatch() {
    if (state.isLoadingBatch) return;
    state.isLoadingBatch = true;
    console.log("🔄 Fetching next batch...");

    try {
        const token = localStorage.getItem('authToken');
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
                difficulty: state.difficulty,
                seenIds: seenIds
            })
        });

        const data = await response.json();
        if (data.success && data.questions.length > 0) {
            state.questions.push(...data.questions);
            console.log(`✅ Batch loaded. Total questions: ${state.questions.length}`);
            updateProgressUI(); // Update progress bar with new total? Or keep relative to 20?
        }
    } catch (e) {
        console.error("Error fetching batch:", e);
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
    elements.currentQ.textContent = state.currentQuestionIndex + 1;
    updateProgressUI();

    // Texto Pregunta
    elements.questionText.textContent = q.question;

    // Reset UI
    elements.optionsGrid.innerHTML = '';
    elements.feedbackBox.style.display = 'none';
    elements.feedbackBox.classList.remove('error');

    // Render Opciones
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(index, btn);
        elements.optionsGrid.appendChild(btn);
    });
}

function updateProgressUI() {
    // Bar reflects progress towards Max Questions (20)
    const progressPct = ((state.currentQuestionIndex + 1) / state.maxQuestions) * 100;
    elements.progressBar.style.width = `${progressPct}%`;
}

// 4. Manejar Respuesta
function handleAnswer(selectedIndex, btnElement) {
    const q = state.questions[state.currentQuestionIndex];

    // Deshabilitar todos los botones
    const allBtns = elements.optionsGrid.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    const isCorrect = selectedIndex === q.correctAnswerIndex;

    // Estilos Visuales
    if (isCorrect) {
        btnElement.classList.add('correct');
        state.score++;
    } else {
        btnElement.classList.add('wrong');
        // Mostrar cuál era la correcta
        allBtns[q.correctAnswerIndex].classList.add('correct');
        elements.feedbackBox.classList.add('error');
    }

    // Guardar respuesta
    state.answers.push({
        questionId: state.currentQuestionIndex, // Usamos índice como ID temporal
        userAnswer: selectedIndex,
        isCorrect: isCorrect
    });

    // Mostrar Feedback (Explicación)
    elements.explanationText.textContent = q.explanation || "Respuesta correcta basada en guías clínicas.";
    elements.feedbackBox.style.display = 'block';

    // Configurar Botón Siguiente
    elements.nextBtn.onclick = () => {
        state.currentQuestionIndex++;
        renderQuestion();
    };
}

// 5. Temporizador (Simple)
let timerInterval;
function startTimer() {
    let timeLeft = 45; // Segundos por pregunta (promedio)
    elements.timerDisplay.textContent = `${timeLeft}s`;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        elements.timerDisplay.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Auto-fail logic if needed, or just warn
        }
    }, 1000);
}

// 6. Finalizar Quiz
async function finishQuiz() {
    clearInterval(timerInterval);

    // Calcular Score Visual
    elements.finalScore.textContent = `${state.score}/${state.currentQuestionIndex}`; // Show total answered

    // Calcular porcentaje para el círculo (CSS Conic Gradient)
    const actualTotal = state.currentQuestionIndex || 1;
    const pct = (state.score / actualTotal) * 100;
    elements.scoreCircle.style.background = `conic-gradient(#22c55e ${pct}%, #1e293b ${pct}%)`;

    elements.resultsOverlay.classList.add('active');

    // Enviar Resultados al Backend
    const token = localStorage.getItem('authToken');
    try {
        await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                topic: state.topic, // Áreas originales para compatibilidad
                areas: state.areas, // Extra metadata
                target: state.targetExam,
                difficulty: state.difficulty,
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

// Auto-init
document.addEventListener('DOMContentLoaded', init);
