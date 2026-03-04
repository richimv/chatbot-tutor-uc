const { VertexAI } = require('@google-cloud/vertexai');
const repository = require('../../infrastructure/repositories/trainingRepository');

// CONFIGURACIÓN VERTEX AI
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project: project, location: location });

// INSTANCIAS DE VERTEX AI ELIMINADAS (Simulador Médico ahora usa 100% BD)
// Instancia Modelo CREATIVO (Para Arena/General - Variado)
const modelCreative = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.9, // Alto para creatividad y variedad
        topP: 0.95,
        responseMimeType: 'application/json'
    },
});

class TrainingService {

    /**
     * Normaliza el tema para evitar duplicados (ej: "Historia de Roma" -> "HISTORIA ROMA").
     */
    normalizeTopic(input) {
        if (!input) return "GENERAL";
        return input
            .toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
            .replace(/[^A-Z0-9 ]/g, "") // Solo letras y números
            .replace(/\b(DE|LA|EL|LOS|LAS|UN|UNA|SOBRE|QUIERO|EXAMEN|TEST|PREGUNTAS)\b/g, "") // Stop words
            .trim()
            .replace(/\s+/g, " "); // Espacios dobles
    }

    /**
     * Mezcla las opciones de respuesta y actualiza el índice correcto.
     */
    shuffleOptions(question) {
        if (!question.options || !question.options.length) return question;

        const originalOptions = question.options;

        // Crear array de objetos {text, originalIndex}
        const mappedOptions = originalOptions.map((opt, index) => ({
            text: opt,
            isCorrect: index === question.correctAnswerIndex
        }));

        // Shuffle (Fisher-Yates)
        for (let i = mappedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mappedOptions[i], mappedOptions[j]] = [mappedOptions[j], mappedOptions[i]];
        }

        // Reconstruir
        question.options = mappedOptions.map(o => o.text);
        question.correctAnswerIndex = mappedOptions.findIndex(o => o.isCorrect);

        return question;
    }

    // MÉTODO _buildRagQuery EXTIRPADO COMPLETAMENTE POR CONTROL FINANCIERO

    /**
     * Obtiene Preguntas (Híbrido: Banco -> IA).
     * Soporta tanto Modo Legacy (String) como Modo Multi-Area (Objeto).
     */
    async getQuestions(categoryOptions, difficulty, limit = 5, userId) {
        // 1. Parsear opciones
        let target = 'MEDICINA';
        let areas = ['Medicina General'];

        if (typeof categoryOptions === 'object') {
            target = categoryOptions.target || 'MEDICINA';
            areas = categoryOptions.areas && categoryOptions.areas.length > 0 ? categoryOptions.areas : ['Medicina General'];
        } else {
            // Modo Legacy
            target = 'MEDICINA'; // We assumed domain was 'MEDICINA' for QuizController before
            areas = [this.normalizeTopic(categoryOptions)];
        }

        if (!areas || areas.length === 0) {
            areas = ['MEDICINA GENERAL'];
        }

        // 🛠️ DB MAPPER FIX: 'target' holds the exam type (ENAM, PRE-INTERNADO, RESIDENTADO) or 'GENERAL_TRIVIA' from Arena.
        const dbDomain = target === 'GENERAL_TRIVIA' ? 'GENERAL_TRIVIA' : 'medicine';
        const dbTarget = target === 'GENERAL_TRIVIA' ? null : target;

        // 🛡️ OVERRIDE DE DIFICULTAD OFICIAL (Simulacro Real)
        if (limit >= 100) {
            console.log(`⚖️ [Simulacro Real Detectado] Ignorando dificultad del usuario (${difficulty}). Aplicando Estándar Oficial...`);
            if (target === 'RESIDENTADO') {
                difficulty = 'Avanzado'; // Especialidad compleja
            } else {
                difficulty = 'Intermedio'; // Nivel troncal ENAM/PRE-INTERNADO
            }
        }

        // 🔄 ROTACIÓN DE TEMAS (Solo si es general)
        if (areas.length === 1 && (areas[0] === 'MEDICINA GENERAL' || areas[0] === 'GENERAL' || !areas[0])) {
            const subtopics = ['CARDIOLOGIA', 'PEDIATRIA', 'GINECOLOGIA', 'NEUROLOGIA', 'DERMATOLOGIA', 'TRAUMATOLOGIA', 'SALUD PUBLICA', 'NEFROLOGIA', 'GASTROENTEROLOGIA'];
            areas[0] = subtopics[Math.floor(Math.random() * subtopics.length)];
            console.log(`🔄 Rotación de Tema: Seleccionado '${areas[0]}' para Medicina General.`);
        }

        const areaString = areas.join(', ');
        console.log(`🧠 TrainingService: Buscando Multi-Área: [${areaString}] Target: (${target}) Nivel Forzado: [${difficulty}]...`);

        // 1. Intentar obtener del Banco (DB) con la nueva query (Batch)
        let questions = await repository.findQuestionsInBankBatch(dbDomain, dbTarget, areas, difficulty, limit, userId);

        // 🔀 Shuffle de opciones para preguntas de DB
        questions = questions.map(q => this.shuffleOptions(q));

        if (questions.length >= limit) {
            console.log(`✅ ¡Éxito! ${questions.length} preguntas recuperadas del Banco (Cost $0).`);
            repository.markQuestionsAsSeen(userId, questions.map(q => q.id));
            return { questions: questions.slice(0, limit), source: 'BANK', topic: areas[0] };
        }

        // 🛑 MOCK TEST PROTECTION (Límite 100 o mayor)
        if (limit >= 100) {
            console.warn(`🛑 Modo Simulacro Real (Limit ${limit}): Bloqueando generación IA masiva por seguridad financiera. Retornando las locales.`);
            if (questions.length < 10) {
                throw new Error(`No hay suficientes preguntas en el banco para este simulacro. Solo hay ${questions.length} disponibles en estas áreas. Juega "Modo Estudio" primero para alimentar la base de datos con la IA.`);
            }
            // Retorna lo que tenga el banco (ej: 40 o 70) para no romper el front
            repository.markQuestionsAsSeen(userId, questions.map(q => q.id));
            return { questions: questions, source: 'BANK', topic: areas[0] };
        }

        // 2. Si faltan, procesar lógica según el target (Trivia vs Médico)
        const needed = limit - questions.length;

        // 🛡️ EXTIRPACIÓN DEL GENERADOR IA PARA EL SIMULADOR MÉDICO
        // Por orden directa de rentabilidad (UX/Finanzas): NINGÚN USUARIO genera preguntas médicas con IA en vivo.
        if (target !== 'GENERAL_TRIVIA') {
            if (questions.length === 0) {
                throw new Error("No hay preguntas disponibles en el banco para los temas seleccionados. Intenta con otra dificultad o añade más áreas de estudio.");
            }
            console.warn(`🛑 Simulador Médico: Banco insuficiente (Encontradas: ${questions.length}). Retornando lo disponible (Se extirpó la Generación IA).`);
            repository.markQuestionsAsSeen(userId, questions.map(q => q.id));
            return { questions: questions, source: 'BANK', topic: areas[0] };
        }

        // SI ES QUIZ ARENA (GENERAL_TRIVIA), Conservamos la IA (Bajo temperatura creativa y sin RAG)
        console.log(`🧠 Quiz Arena, generando ${needed} nuevas con IA Creative... [Áreas: ${areas.join(', ')}]`);
        let newQuestions = await this.generateGeneralQuestionsAI(areas, difficulty, needed);

        // 🔀 Shuffle de opciones para nuevas preguntas IA
        newQuestions = newQuestions.map(q => this.shuffleOptions(q));

        // 3. Guardar las nuevas en el Banco Y OBTENER IDs
        let newIds = [];
        if (newQuestions.length > 0) {
            newIds = await repository.saveQuestionBankBatch(newQuestions, areas[0], dbDomain, dbTarget, difficulty);
        }

        // 4. Marcar como vistas las nuevas y FILTRAR REPETIDAS
        if (newIds && newIds.length > 0) {
            await repository.markQuestionsAsSeen(userId, newIds);
            newQuestions.forEach((q, index) => {
                if (newIds[index]) q.id = newIds[index];
            });
        }

        // 5. Combinar
        const bankIds = new Set(questions.map(q => q.id));
        const uniqueNewQuestions = newQuestions.filter(q => !bankIds.has(q.id));

        const combined = [...questions, ...uniqueNewQuestions].slice(0, limit);

        return { questions: combined, source: 'HYBRID', topic: areas[0] };
    }

    // MÉTODO generateMedicalQuestionsAI EXTIRPADO COMPLETAMENTE POR CONTROL FINANCIERO

    /**
     * Generador Puro IA (GENERAL) - Lógica interna y Deduplicación
     */
    async generateGeneralQuestionsAI(areas, difficulty, count) {
        try {
            const areaString = areas.join(', ');

            // Extraer Contexto de Deduplicación
            let deduplicationText = "No hay contexto previo de deduplicación.";
            try {
                const pastQuestions = await repository.getRandomQuestionsContext('GENERAL_TRIVIA', null, areas, 15);
                if (pastQuestions.length > 0) {
                    deduplicationText = pastQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                }
            } catch (e) { console.error("Deduplication fetch failed", e); }


            // Añadir entropía al prompt (Versión Simplificada)
            const seeds = ["Curiosidades", "Hechos poco conocidos", "Conceptos clave", "Errores comunes", "Aplicaciones prácticas"];
            const randomSeed = seeds[Math.floor(Math.random() * seeds.length)];

            const prompt = `
            Actúa como un Quiz Master experto en educación. 
            Tema: "${areaString}". Dificultad: ${difficulty}.
            Enfoque: ${randomSeed}.
            
            🚨 REGLA DE ORO DE DEDUPLICACIÓN (CONTEXTO NEGATIVO):
            ABSOLUTAMENTE PROHIBIDO evaluar los siguientes conceptos exactos, ya que ya existen en nuestro banco. DEBES generar preguntas DIFERENTES a estas:
            -- INICIO PREGUNTAS PROHIBIDAS --
            ${deduplicationText}
            -- FIN PREGUNTAS PROHIBIDAS --

            Instrucciones CRÍTICAS:
            1. IDIOMA: ESPAÑOL (Neutro). Todas las preguntas y respuestas en español.
            2. FORMATO: Genera EXACTAMENTE 4 opciones de respuesta para cada pregunta.
            3. LONGITUD: Preguntas claras y directas (1-2 oraciones), pero no excesivamente cortas.
            4. TONO: Profesional pero dinámico.
            
            Genera ${count} preguntas de trivia interesantes y NO repetitivas.
            
            JSON ESTRICTO:
            [{"question":"¿Cuál es...?","options":["Texto crudo", "Respuesta directa", "Concepto limpio", "Opción final sin letras"],"correctAnswerIndex":0,"explanation":"...", "topic": "${areas[0]}"}]
            
            ⚠️ REGLA DE FORMATO:
            Bajo ninguna circunstancia uses letras ("A)", "B.", "C.-", etc.) al inicio de las opciones.
            Las opciones deben contener únicamente el texto crudo.
            Asegúrate de escapar correctamente las comillas dobles internas con \\" para no romper el formato JSON.
            `;

            const result = await modelCreative.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            let questions;
            try {
                questions = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (parseError) {
                console.error("❌ Error parseando JSON de IA General:", parseError.message);
                console.error("📝 Texto crudo recibido que causó el error:\n", text);
                return [];
            }

            // 🛡️ SANITIZACIÓN ROBUSTA: Forzar 4 opciones
            questions = questions.map(q => {
                // Si tiene más de 4, cortamos (asegurando que la correcta esté dentro)
                if (q.options.length > 4) {
                    // Si la correcta es índice 4 o mayor (5ta opción+), la movemos al 3
                    if (q.correctAnswerIndex >= 4) {
                        q.options[3] = q.options[q.correctAnswerIndex]; // Mover correcta a pos 3
                        q.correctAnswerIndex = 3;
                    }
                    q.options = q.options.slice(0, 4); // Cortar exceso
                }
                // Si tiene menos de 4 (raro), rellenamos
                while (q.options.length < 4) {
                    q.options.push("Opción extra");
                }
                return q;
            });

            return questions;
        } catch (error) {
            console.error("❌ Error IA General:", error);
            return [];
        }
    }

    /**
     * Genera Flashcards a partir de un tema o texto (Para Custom Decks).
     * @param {string} topic - Tema o texto corto.
     * @param {number} count - Número de tarjetas (Default 5).
     */
    async generateFlashcardsFromTopic(topic, count = 5) {
        try {
            const prompt = `
            Crea ${count} Flashcards educativas sobre: "${topic}".
            
            FORMATO JSON ESTRICTO:
            [{ "front": "Pregunta o Concepto", "back": "Respuesta o Definición Breve" }]

            REGLAS:
            1. Idioma: Español.
            2. "front": Debe ser claro y provocar recuerdo activo.
            3. "back": Debe ser conciso(< 50 palabras).
            4. Evita preguntas de "Sí/No".
            `;

            console.log(`🧠 AI Flashcards: Generando ${count} tarjetas sobre '${topic}'...`);
            const result = await modelCreative.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            const cards = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            return cards;

        } catch (error) {
            console.error("❌ Error Generando Flashcards IA:", error);
            throw new Error("No se pudo generar contenido con IA.");
        }
    }

    // --- MÉTODOS LEGACY (Wrappers para compatibilidad) ---

    // Usado por QuizController (ENAM/PRE-INTERNADO/RESIDENTADO)
    async generateQuiz(categoryOptions, difficulty = 'ENAM', userId, limit = 5) {
        const result = await this.getQuestions(categoryOptions, difficulty, limit, userId);
        return { questions: result.questions, topic: result.topic };
    }

    // Usado por QuizGameController (Arena)
    async generateGeneralQuiz(topic, difficulty = 'Intermedio', userId) {
        const result = await this.getQuestions({ target: 'GENERAL_TRIVIA', areas: [topic] }, difficulty, 5, userId);
        return result.questions;
    }

    /**
     * Guarda el resultado (Sin cambios, usa repo)
     */
    /**
     * Guarda el resultado y opcionalmente crea flashcards.
     * @param {string} userId
     * @param {object} quizData
     * @param {object} options - { createFlashcards: boolean }
     */
    async submitQuizResult(userId, quizData, options = { createFlashcards: false }) {
        // --- CALCULAR ESTADÍSTICAS POR ÁREA (JSONB) ---
        const areaStats = {};

        // Allowed areas chosen by user strictly (fallback for sanitization)
        const allowedAreas = (quizData.areas && Array.isArray(quizData.areas) && quizData.areas.length > 0)
            ? quizData.areas
            : [quizData.topic];

        if (quizData.questions && Array.isArray(quizData.questions)) {
            quizData.questions.forEach(q => {
                let topic = q.topic || quizData.topic || 'General';
                const isCorrect = q.userAnswer === q.correctAnswerIndex;

                // 🧹 SANITIZACIÓN MEJORADA: 
                // Si el topic de la pregunta es genérico (ej: "MEDICINA") o está vacío, 
                // intentamos mapiar a la lista de áreas permitidas por el usuario.
                const isGeneric = !topic || topic === 'MEDICINA' || topic === 'General' || topic === 'Medicina General';

                if (isGeneric && allowedAreas.length > 0) {
                    topic = allowedAreas[0];
                } else if (allowedAreas.length > 0) {
                    // Si el topic NO es genérico (ej: "Neurología"), solo verificamos si coincide con algo de allowedAreas
                    // para normalizarlo, pero si no coincide, PRESERVAMOS el topic original en vez de forzar el primero.
                    const matched = allowedAreas.find(a => topic.toLowerCase().includes(a.toLowerCase()));
                    if (matched) topic = matched;
                } else if (topic.includes(',')) {
                    topic = topic.split(',')[0].trim();
                }

                if (!areaStats[topic]) {
                    areaStats[topic] = { correct: 0, total: 0 };
                }

                areaStats[topic].total += 1;
                if (isCorrect) {
                    areaStats[topic].correct += 1;
                }

                // Actualizar el topic en el objeto pregunta para que el Repo lo use fielmente
                q.topic = topic;
            });
        }

        quizData.areaStats = areaStats; // Adjuntar para el repositorio

        const attemptId = await repository.saveQuizHistory(userId, quizData);

        // 🟢 MODULARIDAD: Crear flashcards con topics individuales
        if (options.createFlashcards) {
            const errors = quizData.questions.filter(q => q.userAnswer !== q.correctAnswerIndex);

            if (errors.length > 0) {
                // Pasamos quizData.topic como fallback, pero el repo ahora usará q.topic
                await repository.createFlashcardsBatch(userId, errors, quizData.topic, attemptId);
                return { attemptId, flashcardsCreated: errors.length };
            }
        }

        return { attemptId, flashcardsCreated: 0 };
    }
}

module.exports = new TrainingService();
