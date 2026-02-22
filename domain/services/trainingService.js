const { VertexAI } = require('@google-cloud/vertexai');
const repository = require('../../infrastructure/repositories/trainingRepository');

// CONFIGURACIÓN VERTEX AI
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project: project, location: location });

// Instancia Modelo PRO (Para Medicina - Preciso)
const modelMedical = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.3, // Bajo para ser preciso en medicina
        topP: 0.8,
        responseMimeType: 'application/json'
    },
});

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

        // 🔄 ROTACIÓN DE TEMAS (Solo si es general)
        if (areas.length === 1 && (areas[0] === 'MEDICINA GENERAL' || areas[0] === 'GENERAL' || !areas[0])) {
            const subtopics = ['CARDIOLOGIA', 'PEDIATRIA', 'GINECOLOGIA', 'NEUROLOGIA', 'DERMATOLOGIA', 'TRAUMATOLOGIA', 'SALUD PUBLICA', 'NEFROLOGIA', 'GASTROENTEROLOGIA'];
            areas[0] = subtopics[Math.floor(Math.random() * subtopics.length)];
            console.log(`🔄 Rotación de Tema: Seleccionado '${areas[0]}' para Medicina General.`);
        }

        const areaString = areas.join(', ');
        console.log(`🧠 TrainingService: Buscando Multi-Área: [${areaString}] Target: (${target}) Nivel: [${difficulty}]...`);

        // 1. Intentar obtener del Banco (DB) con la nueva query (Batch)
        let questions = await repository.findQuestionsInBankBatch(target, areas, difficulty, limit, userId);

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

        // 2. Si faltan, generar con IA
        const needed = limit - questions.length;
        console.log(`⚠️ Banco insuficiente (Encontradas: ${questions.length}). Generando ${needed} nuevas con IA...`);

        // Generar enviando el Array de areas
        let newQuestions = await (target !== 'GENERAL_TRIVIA'
            ? this.generateMedicalQuestionsAI(target, areas, difficulty, limit)
            : this.generateGeneralQuestionsAI(areas[0], difficulty, limit)); // Asumiendo que trivia no usa areas complejas

        // 🔀 Shuffle de opciones para nuevas preguntas IA
        newQuestions = newQuestions.map(q => this.shuffleOptions(q));

        // 3. Guardar las nuevas en el Banco Y OBTENER IDs
        let newIds = [];
        if (newQuestions.length > 0) {
            // Guardamos cada pregunta bajo la primera de la lista de areas por ahora para simplificar métricas (o se podría aleatorizar)
            newIds = await repository.saveQuestionBankBatch(newQuestions, areas[0], target, difficulty);
        }

        // 4. Marcar como vistas las nuevas y FILTRAR REPETIDAS (CRÍTICO)
        if (newIds && newIds.length > 0) {
            await repository.markQuestionsAsSeen(userId, newIds);

            // Asignar IDs
            newQuestions.forEach((q, index) => {
                if (newIds[index]) q.id = newIds[index];
            });

            // IMPORTANTE: Si la IA generó una pregunta que YA existía y el usuario YA la vio,
            // repository.markQuestionsAsSeen no hizo nada, pero la pregunta sigue ahí.
            // Debemos verificar si el usuario ya vio estos IDs.
            // Una forma simple es asumir que si `newIds` retornó algo, es válido, 
            // pero si la base de datos hizo UPDATE en vez de INSERT, devuelve el ID igual.
            // Consultamos de nuevo el historial para estos newIds específicos para estar 100% seguros?
            // O mejor: Filtramos en memoria si `questions` ya tiene ese ID (raro) o confiamos en el azar.
            // Dado que acabamos de marcar como visto, si llamamos a findQuestionsInBank de nuevo, no saldrían.
        }

        // 5. Combinar
        // Para evitar duplicados VISUALES, filtramos IDs que ya estén en `questions` (del banco)
        const bankIds = new Set(questions.map(q => q.id));
        const uniqueNewQuestions = newQuestions.filter(q => !bankIds.has(q.id));

        const combined = [...questions, ...uniqueNewQuestions].slice(0, limit);

        return { questions: combined, source: 'HYBRID', topic: areas[0] };
    }

    /**
     * Generador Puro IA (MEDICINA) - Lógica interna RAG Multi-Área
     */
    async generateMedicalQuestionsAI(target, areas, difficulty, count) {
        try {
            const areaString = areas.join(', ');

            // RAG Híbrido: Filtramos documentos por áreas
            let ragContext = "";
            try {
                const RagService = require('./ragService');
                // Optimizamos la query
                const queryPrompt = `Protocolos ${target} de ${areaString}`;
                ragContext = await RagService.searchContext(queryPrompt, 5); // 5 Chunks max
            } catch (e) { console.error("RAG Falló", e); }

            let optionsCount = 4;
            let optionsStr = '["A)...","B)...","C)...","D)..."]';

            if (target === 'ENARM') {
                optionsCount = 5;
                optionsStr = '["A)...","B)...","C)...","D)...","E)..."]';
            }

            const prompt = `
            Actúa como un redactor experto de Exámenes Médicos Profesionales (Estilo ${target}).
            Temas obligatorios: "${areaString}". Dificultad: ${difficulty}.
            
            DIRECCIÓN RAG:
            A continuación se proveen extractos de libros o normativas médicas reales. Úsalos como VERDAD ABSOLUTA para generar las preguntas.
            
            CONTEXTO EXTRAÍDO:
            ${ragContext ? ragContext : "Usa guías clínicas MINSA o internacionales vigentes."}
            
            MISIÓN:
            Genera ${count} preguntas de opción múltiple con casos clínicos.
            ATENCIÓN: CADA PREGUNTA DEBE TENER EXACTAMENTE ${optionsCount} OPCIONES DE RESPUESTA, NI UNA MÁS NI UNA MENOS.
            - Si es SERUMS: Enfócate en la Norma Técnica de Salud, flujograma y manejo en el primer nivel de atención (Puesto de Salud).
            - Si es ENARM/ENAM: Enfócate en diagnóstico diferencial preciso, examen auxiliar inicial ("Gold Standard") y terapéutica de especialidad.
            
            JSON ESTRICTO:
            [{"question":"...","options":${optionsStr},"correctAnswerIndex":0,"explanation":"..."}]
            `;

            const result = await modelMedical.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (error) {
            console.error("❌ Error IA Médica:", error);
            return [];
        }
    }

    /**
     * Generador Puro IA (GENERAL) - Lógica interna
     */
    async generateGeneralQuestionsAI(topic, difficulty, count) {
        try {
            // Añadir entropía al prompt (Versión Simplificada)
            const seeds = ["Curiosidades", "Hechos poco conocidos", "Conceptos clave", "Errores comunes", "Aplicaciones prácticas"];
            const randomSeed = seeds[Math.floor(Math.random() * seeds.length)];

            const prompt = `
            Actúa como un Quiz Master experto en educación. 
            Tema: "${topic}". Dificultad: ${difficulty}.
            Enfoque: ${randomSeed}.
            
            Instrucciones CRÍTICAS:
            1. IDIOMA: ESPAÑOL (Neutro). Todas las preguntas y respuestas en español.
            2. FORMATO: Genera EXACTAMENTE 4 opciones de respuesta para cada pregunta.
            3. LONGITUD: Preguntas claras y directas (1-2 oraciones), pero no excesivamente cortas.
            4. TONO: Profesional pero dinámico.
            
            Genera ${count} preguntas de trivia interesantes y NO repetitivas.
            
            JSON ESTRICTO:
            [{"question":"¿Cuál es...?","options":["Opción A","Opción B", "Opción C", "Opción D"],"correctAnswerIndex":0,"explanation":"..."}]
            `;

            const result = await modelCreative.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;
            let questions = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

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
            [{"front": "Pregunta o Concepto", "back": "Respuesta o Definición Breve"}]
            
            REGLAS:
            1. Idioma: Español.
            2. "front": Debe ser claro y provocar recuerdo activo.
            3. "back": Debe ser conciso (< 50 palabras).
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

    // Usado por QuizController (Serum/ENAM/ENARM)
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

        if (quizData.questions && Array.isArray(quizData.questions)) {
            quizData.questions.forEach(q => {
                const topic = q.topic || quizData.topic || 'General';
                const isCorrect = q.userAnswer === q.correctAnswerIndex;

                if (!areaStats[topic]) {
                    areaStats[topic] = { correct: 0, total: 0 };
                }

                areaStats[topic].total += 1;
                if (isCorrect) {
                    areaStats[topic].correct += 1;
                }
            });
        }

        quizData.areaStats = areaStats; // Adjuntar para el repositorio

        const attemptId = await repository.saveQuizHistory(userId, quizData);

        // 🟢 MODULARIDAD: La decisión viene del controlador, no adivinamos por el topic/difficulty.
        if (options.createFlashcards) {
            const errors = quizData.questions.filter(q => q.userAnswer !== q.correctAnswerIndex);

            if (errors.length > 0) {
                await repository.createFlashcardsBatch(userId, errors, quizData.topic, attemptId);
                return { attemptId, flashcardsCreated: errors.length };
            }
        }

        return { attemptId, flashcardsCreated: 0 };
    }
}

module.exports = new TrainingService();
