
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
    loadingTitle: document.getElementById('loadingTitle'),
    loadingSubtitle: document.getElementById('loadingSubtitle'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    currentQ: document.getElementById('currentQ'),
    maxQ: document.getElementById('maxQ'),
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
const API_URL = `${window.AppConfig.API_URL}/api/quiz`; // Ajustar según config

// 1. Inicialización
async function init() {
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.topic = urlParams.get('topic') || 'Medicina General';
    state.difficulty = urlParams.get('difficulty') || urlParams.get('level') || 'Intermedio';
    // Custom Exam Builder params
    let savedConfig = null;
    try {
        const stored = localStorage.getItem('simActiveConfig');
        if (stored) savedConfig = JSON.parse(stored);
    } catch (e) { console.warn("No active config found"); }

    state.targetExam = urlParams.get('target') || (savedConfig ? savedConfig.target : 'ENAM');
    state.difficulty = urlParams.get('difficulty') || urlParams.get('level') || (savedConfig ? savedConfig.difficulty : 'Intermedio');
    state.context = urlParams.get('context') || 'MEDICINA'; // Default
    state.career = urlParams.get('career') || (savedConfig ? savedConfig.career : null);

    const areasParam = urlParams.get('areas');
    if (areasParam) {
        state.areas = areasParam.split(',');
    } else if (savedConfig && savedConfig.areas && savedConfig.areas.length > 0) {
        state.areas = savedConfig.areas;
    } else {
        state.topic = urlParams.get('topic') || 'Medicina General';
        state.areas = [state.topic];
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

    const token = await getValidToken();
    if (!token) {
        alert("Debes iniciar sesión para realizar simulacros.");
        window.location.href = '/login';
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
            career: state.career,
            limit: Math.min(5, state.maxQuestions) // Batching optimizations
        })
    });

    const data = await response.json();

    // ⛔ Freemium: Límite de vidas o bloqueo premium
    if (response.status === 403) {
        elements.loadingOverlay.classList.add('hidden');
        if (data.limitReached || data.premiumLock) {
            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal();
            } else {
                alert(data.error || 'Has alcanzado tu límite de acciones gratuitas.');
                window.location.href = '/pricing';
            }
            return;
        }
    }

    if (!data.success) {
        elements.loadingOverlay.classList.add('hidden');

        if (response.status === 404 && data.noQuestions) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '<span class="text-gradient-primary" style="font-size: 1.5rem; font-weight: 800;">¡Banco Agotado!</span>',
                    html: `
                        <div style="font-size: 0.95rem; color: #cbd5e1; margin-top: 0.5rem; text-align: left;">
                            <i class="fas fa-info-circle" style="color: #3b82f6; margin-right: 5px;"></i> 
                            Genial, has abarcado <strong>todas las preguntas reservadas</strong> para esta configuración en particular.<br><br>
                            Intenta cambiar de Área de Estudio, Dificultad o Tipo de Examen en el Dashboard para desbloquear nuevos escenarios clínicos.
                        </div>
                    `,
                    icon: 'info',
                    iconColor: '#60a5fa',
                    background: 'rgba(30, 41, 59, 0.85)',
                    color: '#f8fafc',
                    backdrop: `rgba(10, 10, 10, 0.8) backdrop-filter: blur(4px);`,
                    customClass: {
                        popup: 'swal-glass-popup',
                        confirmButton: 'btn-neon'
                    },
                    buttonsStyling: false,
                    confirmButtonText: '<i class="fas fa-sliders-h" style="margin-right: 5px;"></i> Configurar otro Simulacro',
                    allowOutsideClick: false
                }).then(() => {
                    window.location.href = `simulator-dashboard?context=${state.context || 'MEDICINA'}`;
                });
            } else {
                alert('¡Banco Agotado!\\n\\nHas abarcado todas las preguntas de este tema y dificultad. Intenta cambiar tu configuración en el dashboard para acceder a más casos clínicos.');
                window.location.href = `simulator-dashboard?context=${state.context || 'MEDICINA'}`;
            }
            return;
        }

        if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
            window.uiManager.showPaywallModal(data.error || 'No hay más preguntas disponibles en el Banco para este tema. Cambia de tema o mejora tu plan para utilizar Inteligencia Artificial ilimitada.');
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
                difficulty: state.difficulty,
                career: state.career,
                seenIds: seenIds
            })
        });

        const data = await response.json();

        // 🚦 Manejo del Error 500/404 Controlado (Límite Básico u otros)
        if (!response.ok || !data.success) {
            elements.loadingOverlay.classList.add('hidden');

            if (response.status === 404 && data.noQuestions) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: '<span style="color: #10b981; font-size: 1.5rem; font-weight: 800;"><i class="fas fa-award"></i> ¡Banco Agotado!</span>',
                        html: `
                            <div style="font-size: 0.95rem; color: #cbd5e1; margin-top: 0.5rem; text-align: left;">
                                ¡Excelente trabajo! Has terminado con <strong>todas las preguntas disponibles</strong> para esta configuración exacta.<br><br>
                                Te entregaremos tu simulacro ahora mismo evaluando las preguntas que llegaste a contestar.
                            </div>
                        `,
                        icon: 'success',
                        iconColor: '#10b981',
                        background: 'rgba(30, 41, 59, 0.85)',
                        color: '#f8fafc',
                        backdrop: `rgba(10, 10, 10, 0.8) backdrop-filter: blur(4px);`,
                        customClass: {
                            popup: 'swal-glass-popup',
                            confirmButton: 'btn-neon'
                        },
                        buttonsStyling: false,
                        confirmButtonText: '<i class="fas fa-chart-line" style="margin-right: 5px;"></i> Ver mis Resultados',
                        allowOutsideClick: false
                    }).then(() => finishQuiz());
                } else {
                    alert('¡Banco Agotado!\\nHas terminado con todas las preguntas disponibles para esta configuración. Puntuando lo que respondiste...');
                    finishQuiz();
                }
                return;
            }

            if (window.uiManager && typeof window.uiManager.showPaywallModal === 'function') {
                window.uiManager.showPaywallModal(data.error || "No hay más preguntas disponibles para tu Plan. Mejora a Advanced para Generación AI ilimitada.");
            } else {
                alert(data.error || "No hay más preguntas disponibles para tu Plan actual.");
            }
            return finishQuiz(); // Acabar el examen con lo poco que tenía
        }

        if (data.success && data.questions.length > 0) {
            state.questions.push(...data.questions);
            console.log(`✅ Batch loaded. Total questions: ${state.questions.length}`);
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
                elements.loadingTitle.textContent = "Generando más preguntas...";
                const isBasic = state.difficulty && state.difficulty.toLowerCase() === 'básico';
                elements.loadingSubtitle.textContent = isBasic
                    ? `Consultando banco de ${state.targetExam || state.topic}...`
                    : `Analizando contexto y generando caso clínico...`;
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
    if (q.image_url) {
        imgElement.src = q.image_url;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
        imgElement.src = '';
    }

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
            renderQuestion();
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
        // Mostrar cuál era la correcta
        allBtns[q.correctAnswerIndex].classList.add('correct');
        elements.feedbackBox.classList.add('error');
    }

    // Mostrar Feedback (Explicación)
    elements.explanationText.textContent = q.explanation || "Respuesta correcta basada en guías clínicas.";
    elements.feedbackBox.style.display = 'block';

    // Configurar Botón Siguiente
    elements.nextBtn.onclick = () => {
        state.currentQuestionIndex++;
        renderQuestion();
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
    elements.finalScore.textContent = `${state.score}/${state.currentQuestionIndex}`; // Show total answered

    // Calcular porcentaje para el círculo (CSS Conic Gradient)
    const actualTotal = state.currentQuestionIndex || 1;
    const pct = (state.score / actualTotal) * 100;
    elements.scoreCircle.style.backgroundImage = `conic-gradient(#22c55e ${pct}%, transparent ${pct}%)`;

    elements.resultsOverlay.classList.add('active');

    // Enviar Resultados al Backend
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
                difficulty: state.difficulty,
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
window.showExamReview = function () {
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
    feed.innerHTML = ''; // Limpiar

    // Iterar solo por las preguntas que realmente contestó
    const totalAnswered = state.currentQuestionIndex;

    for (let i = 0; i < totalAnswered; i++) {
        const q = state.questions[i];
        const ans = state.answers[i]; // { questionId, userAnswer, isCorrect }

        const card = document.createElement('div');
        card.className = 'review-card';

        // Título/Pregunta
        const qText = document.createElement('div');
        qText.className = 'review-q-text';
        qText.innerHTML = `<span style="color:#3b82f6; font-weight: 800; margin-right: 0.5rem;">Q${i + 1}</span> ${q.question}`;
        card.appendChild(qText);

        // Imagen (si existe)
        if (q.image_url) {
            const imgContainer = document.createElement('div');
            imgContainer.style.textAlign = 'center';
            imgContainer.style.marginBottom = '1.25rem';
            const img = document.createElement('img');
            img.src = q.image_url;
            img.style.maxHeight = '200px';
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
            optDiv.textContent = optText;

            // Logica de colores
            if (optIdx === q.correctAnswerIndex) {
                optDiv.classList.add('r-correct');
                optDiv.innerHTML += ' <i class="fas fa-check-circle" style="float:right"></i>';
            } else if (optIdx === ans.userAnswer) {
                // El usuario marcó esta y era incorrecta
                optDiv.classList.add('r-wrong');
                optDiv.innerHTML += ' <i class="fas fa-times-circle" style="float:right"></i>';
            }

            optionsContainer.appendChild(optDiv);
        });
        card.appendChild(optionsContainer);

        // Explicación
        const expDiv = document.createElement('div');
        expDiv.className = 'review-explanation';
        expDiv.innerHTML = `<strong><i class="fas fa-lightbulb"></i> Explicación:</strong><br><br>${q.explanation || 'Respuesta correcta basada en actas médicas oficiales.'}`;
        card.appendChild(expDiv);

        feed.appendChild(card);
    }

    // Scroll al inicio de la revisión
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Auto-init
document.addEventListener('DOMContentLoaded', init);
