const { VertexAI } = require('@google-cloud/vertexai');
const repository = require('../repositories/trainingRepository');
const MLService = require('./mlService');
const UserAiService = require('./userAiService');

// CONFIGURACIÓN VERTEX AI
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project: project, location: location });

const modelCreativeLite = vertex_ai.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
        maxOutputTokens: 65535,
        temperature: 0.9,
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
            isCorrect: index === question.correct_option_index
        }));

        // Shuffle (Fisher-Yates)
        for (let i = mappedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mappedOptions[i], mappedOptions[j]] = [mappedOptions[j], mappedOptions[i]];
        }

        // Reconstruir
        question.options = mappedOptions.map(o => o.text);
        question.correct_option_index = mappedOptions.findIndex(o => o.isCorrect);

        return question;
    }

    // MÉTODO _buildRagQuery EXTIRPADO COMPLETAMENTE POR CONTROL FINANCIERO

    /**
     * Obtiene Preguntas (Banco Local).
     * Soporta tanto Modo Legacy (String) como Modo Multi-Area (Objeto).
     */
    async getQuestions(categoryOptions, limit = 5, userId, subscriptionTier = 'free', seenIds = []) {
        // 1. Parsear opciones
        let target = 'MEDICINA';
        let areas = ['Medicina General'];
        let career = null;

        if (typeof categoryOptions === 'object') {
            target = categoryOptions.target || 'MEDICINA';
            areas = categoryOptions.areas && categoryOptions.areas.length > 0 ? categoryOptions.areas : ['Medicina General'];
            career = categoryOptions.career || null;
        } else {
            // Modo Legacy
            target = 'MEDICINA';
            areas = [this.normalizeTopic(categoryOptions)];
        }

        if (!areas || areas.length === 0) {
            areas = ['MEDICINA GENERAL'];
        }

        const dbDomain = target === 'GENERAL_TRIVIA' ? 'GENERAL_TRIVIA' : 'medicine';
        const dbTarget = target === 'GENERAL_TRIVIA' ? null : target;

        // 🔄 FALLBACK DE ÁREAS (SERUMS POR DEFECTO)
        // Si no hay áreas o son genéricas, inyectamos el bloque oficial del SERUMS.
        const isGeneric = !areas || areas.length === 0 ||
            (areas.length === 1 && (areas[0].toUpperCase() === 'MEDICINA GENERAL' || areas[0].toUpperCase() === 'GENERAL'));

        if (isGeneric) {
            areas = [
                'Salud Pública',
                'Gestión De Servicios De Salud',
                'Ética E Interculturalidad',
                'Investigación',
                'Cuidado Integral De Salud'
            ];
            console.log(`📡 Fallback Activado: Usando 5 áreas oficiales de SERUMS para configuración inicial.`);
        }

        // 🎯 NORMALIZACIÓN DE ÁREAS (Necesario para Repo y IA)
        const normalizedAllAreas = areas.map(a => a.trim().toUpperCase());
        const areaMap = new Map();
        areas.forEach(a => areaMap.set(a.trim().toUpperCase(), a.trim()));

        // ---------------------------------------------------------
        // A. FLUJO MÉDICO (ENAM, SERUMS, RESIDENTADO)
        // ---------------------------------------------------------
        if (dbDomain === 'medicine') {
            console.log(`\n🧠 [TrainingService] Analizando stock en ${normalizedAllAreas.length} áreas para ${dbTarget}...`);

            const rawBankQuestions = await repository.findQuestionsInBankBatch(dbDomain, dbTarget, normalizedAllAreas, 50, userId, career, seenIds);

            const questionsByArea = {};
            rawBankQuestions.forEach(q => {
                const shuffledQ = this.shuffleOptions(q);
                const topicKey = shuffledQ.topic ? shuffledQ.topic.toUpperCase() : 'GENERAL';
                if (!questionsByArea[topicKey]) questionsByArea[topicKey] = [];
                questionsByArea[topicKey].push(shuffledQ);
            });

            const areasWithStock = normalizedAllAreas.filter(area => questionsByArea[area] && questionsByArea[area].length > 0);

            // 2. Lotería de Áreas: Para el banco, intentamos abarcar todas las que tengan stock primero
            let bankSampledAreas;
            if (areasWithStock.length >= 5) {
                bankSampledAreas = areasWithStock.sort(() => 0.5 - Math.random()).slice(0, 5);
            } else if (areasWithStock.length > 0) {
                bankSampledAreas = [...areasWithStock];
            } else {
                bankSampledAreas = normalizedAllAreas.length > 5 ? normalizedAllAreas.sort(() => 0.5 - Math.random()).slice(0, 5) : normalizedAllAreas;
            }

            let balancedBatch = [];
            for (const area of bankSampledAreas) {
                if (balancedBatch.length < limit && questionsByArea[area] && questionsByArea[area].length > 0) {
                    balancedBatch.push(questionsByArea[area].shift());
                }
            }

            // Si aún no completamos, intentamos sacar más de las mismas áreas con stock o de cualquier área seleccionada
            if (balancedBatch.length < limit) {
                const searchOrder = [...areasWithStock, ...normalizedAllAreas];
                for (const area of searchOrder) {
                    while (balancedBatch.length < limit && questionsByArea[area] && questionsByArea[area].length > 0) {
                        balancedBatch.push(questionsByArea[area].shift());
                    }
                }
            }

            const areasStr = areasWithStock.length > 5 ? `${areasWithStock.length} áreas` : `[${areasWithStock.join(', ')}]`;
            console.log(`🔎 [Banco] Stock detectado en: ${areasStr} (${balancedBatch.length}/${limit} preguntas).`);

            const bankCount = balancedBatch.length;
            let batchIsHealthy = bankCount === limit;

            // ✅ REGLA DE ORO (CASOS_FLUJO_IA): Si se seleccionaron >= 5 áreas, el lote DEBE tener 5 áreas únicas.
            // Si el banco solo tiene stock en < 5 áreas, forzamos IA para cumplir con la diversidad de tópicos.
            if (normalizedAllAreas.length >= 5 && areasWithStock.length < 5) {
                batchIsHealthy = false;
                console.log(`⚠️ [IA Trigger] Banco insuficiente para diversidad: solo ${areasWithStock.length} áreas con stock. Forzando Reposición IA.`);
            }
            let source = 'BANK';

            if (!batchIsHealthy) {
                const tier = String(subscriptionTier || 'free').toLowerCase();

                // ✅ IA PARA TODOS: Se permite la generación IA (Modo Fast para Free/Basic, RAG para Admin)
                // Se elimina el bloqueo previo: tier !== 'advanced' && tier !== 'admin'

                // 🎯 REPOSICIÓN IA: Seleccionar las 5 áreas para la generación (Escenarios 1, 2 y 3)
                const rawSampled = normalizedAllAreas.length >= 5
                    ? normalizedAllAreas.sort(() => 0.5 - Math.random()).slice(0, 5)
                    : normalizedAllAreas;

                // Mapear de vuelta al Title Case original para que la IA genere correctamente
                const sampledAreas = rawSampled.map(a => areaMap.get(a) || a);

                console.log(`🤖 [IA] Lote insuficiente (${bankCount}/${limit}). Activando Reposición para ${sampledAreas.length} áreas...`);
                source = 'AI_REPOSITION';

                if (limit >= 100) {
                    if (bankCount < 10) {
                        throw new Error(`No hay suficientes preguntas en el banco para este simulacro. Solo hay ${bankCount} disponibles.`);
                    }
                    repository.markQuestionsAsSeen(userId, balancedBatch.map(q => q.id));
                    return { questions: balancedBatch, source: 'BANK', topic: sampledAreas[0] };
                }

                const areaPrompt = sampledAreas.join(', ');

                let aiQuestions;
                const isAdmin = subscriptionTier === 'admin';

                if (isAdmin) {
                    console.log(`🚀 [Replenish-Admin] Calling MLService (RAG) for ${target}`);
                    aiQuestions = await MLService.generateRAGQuestions(target, areaPrompt, career, 5, subscriptionTier);
                } else {
                    console.log(`⚡ [Replenish-User] Calling UserAiService (Fast) for ${target}`);
                    aiQuestions = await UserAiService.generateQuestions(target, areaPrompt, career, 5, subscriptionTier);
                }

                if (aiQuestions && aiQuestions.length > 0) {
                    source = 'HYBRID';
                    aiQuestions = aiQuestions.map(q => this.shuffleOptions(q));
                    // 🎯 FIX: Pasar el parámetro 'career' para que el repositorio lo guarde en la BD.
                    const newIds = await repository.saveQuestionBankBatch(aiQuestions, sampledAreas[0], dbDomain, dbTarget, career);
                    if (newIds && newIds.length > 0) {
                        await repository.markQuestionsAsSeen(userId, newIds);
                        aiQuestions.forEach((q, idx) => { if (newIds[idx]) q.id = newIds[idx]; });
                    }
                    balancedBatch = aiQuestions.slice(0, limit);
                    console.log(`✅ Balance Restaurado: Lote de emergencia generado y entregado.`);
                }
            }

            if (balancedBatch.length > 0) {
                repository.markQuestionsAsSeen(userId, balancedBatch.filter(q => q.id).map(q => q.id));
                return {
                    questions: balancedBatch.slice(0, limit),
                    source: source,
                    topic: (!batchIsHealthy && typeof sampledAreas !== 'undefined') ? sampledAreas[0] : (areaMap.get(bankSampledAreas[0]) || bankSampledAreas[0])
                };
            }

            throw new Error("No hay preguntas disponibles. Intenta con otros temas o dificultad.");
        }

        // ---------------------------------------------------------
        // SI ES QUIZ ARENA (GENERAL_TRIVIA / OTROS)
        // ---------------------------------------------------------
        const normalizedTopic = String(areas[0] || 'Cultura General').trim().toUpperCase();
        const questions = await repository.findArenaQuestions(dbDomain, dbTarget, normalizedTopic, limit, userId);

        // SI ES QUIZ ARENA (GENERAL_TRIVIA), Conservamos la IA (Bajo temperatura creativa y sin RAG)
        if (questions.length < limit) {
            const tier = String(subscriptionTier || 'free').toLowerCase();

            // 🛡️ RESTRICCIÓN DE IA EN ARENA: Se permite a todos los usuarios (incluyendo 'free')
            // si el banco se agota, para no interrumpir la experiencia de juego.
            // Los límites de cuota diaria (UsageService) se validan en el controlador.
            console.log(`🧠 [Arena-IA] Reponiendo ${limit - questions.length} faltantes con IA... [Tema: ${areas[0]}]`);
            let newQuestions = await this.generateGeneralQuestionsAI(areas, limit - questions.length, subscriptionTier);

            // 🔀 Shuffle de opciones para nuevas preguntas IA
            newQuestions = newQuestions.map(q => this.shuffleOptions(q));

            // 3. Guardar las nuevas en el Banco Y OBTENER IDs
            let newIds = [];
            if (newQuestions.length > 0) {
                newIds = await repository.saveQuestionBankBatch(newQuestions, areas[0], dbDomain, dbTarget, career);
                // ✅ VINCULACIÓN DE IDs: Asignar IDs reales a los objetos en memoria para que el marcado de seen funcione
                newQuestions.forEach((q, idx) => {
                    if (newIds[idx]) q.id = newIds[idx];
                });
            }

            // 🔀 SHUFFLE TOTAL: Asegurar que tanto las del banco como las de la IA tengan opciones barajeadas
            const combined = [...questions.map(q => this.shuffleOptions(q)), ...newQuestions].slice(0, limit);

            // ✅ ANTI-REPETICIÓN: Marcar TODO el lote entregado como visto
            const finalIds = combined.filter(q => q.id).map(q => q.id);
            if (finalIds.length > 0) {
                await repository.markQuestionsAsSeen(userId, finalIds);
            }

            return {
                questions: combined,
                source: questions.length > 0 ? 'HYBRID' : 'IA',
                topic: normalizedTopic
            };
        }

        const bankQuestions = questions.slice(0, limit).map(q => this.shuffleOptions(q));

        // ✅ ANTI-REPETICIÓN: Marcar lote del banco como visto
        const finalBankIds = bankQuestions.filter(q => q.id).map(q => q.id);
        if (finalBankIds.length > 0) {
            await repository.markQuestionsAsSeen(userId, finalBankIds);
        }

        return {
            questions: bankQuestions,
            source: 'BANK',
            topic: normalizedTopic
        };
    }

    // MÉTODO generateMedicalQuestionsAI MIGRADO A MLService.generateRAGQuestions (RAG Maestro)

    /**
     * Generador Puro IA (GENERAL) - Lógica interna y Deduplicación
     */
    async generateGeneralQuestionsAI(areas, count, tier = 'free') {
        try {
            console.log(`🤖 [Arena IA] Usando modelo Lite para Tier: ${tier}`);

            const areaString = areas.join(', ');

            // Extraer Contexto de Deduplicación
            let deduplicationText = "No hay contexto previo de deduplicación.";
            try {
                const pastQuestions = await repository.getRandomQuestionsContext('GENERAL_TRIVIA', null, areas, 30);
                if (pastQuestions.length > 0) {
                    deduplicationText = pastQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                }
            } catch (e) { console.error("Deduplication fetch failed", e); }


            // Añadir entropía al prompt (Versión Simplificada)
            const seeds = ["Curiosidades", "Hechos poco conocidos", "Conceptos clave", "Errores comunes", "Aplicaciones prácticas"];
            const randomSeed = seeds[Math.floor(Math.random() * seeds.length)];

            const prompt = `
            Actúa como un Quiz Master dinámico para una App de Trivia Premium. 
            Tema: "${areaString}". 
            
            🚨 VISIÓN DE JUEGO (GAMIFICATION):
            - No generes preguntas extremadamente técnicas, aburridas o estresantes.
            - Genera "Trivias Inteligentes": Preguntas directas, datos curiosos, conceptos clave y cultura general.
            - El tono debe ser profesional pero ágil, relajado y divertido (Gamified).
            - Estándar Interno: Senior (Alta calidad de redacción y veracidad), pero accesible para el aprendizaje lúdico y el relax.
            
            🚨 REGLA DE ORO DE DEDUPLICACIÓN (CONTEXTO NEGATIVO):
            ABSOLUTAMENTE PROHIBIDO evaluar los siguientes conceptos exactos o temas relacionados:
            -- INICIO PREGUNTAS PROHIBIDAS --
            ${deduplicationText}
            -- FIN PREGUNTAS PROHIBIDAS --
            ⚠️ TU MISIÓN: No solo evites el texto exacto, sino también la temática central de las preguntas anteriores. Sé original, busca escenarios laterales o curiosidades que NO estén en la lista.

            🚨 REGLA DE ORO DE OPCIONES (ANTI-SESGO):
            - SIMETRÍA VISUAL: Todas las opciones deben tener una longitud similar.
            - NO AL SESGO DE LONGITUD: Bajo ninguna circunstancia la opción correcta debe ser significativamente más larga o detallada que las demás.
            - DISTRACTORES REALES (TRAMPAS): Las opciones incorrectas deben ser plausibles y estar relacionadas con el tema; evita rellenos obvios o absurdos.

            Instrucciones de Calidad:
            1. IDIOMA: ESPAÑOL (Neutro).
            2. FORMATO: Genera EXACTAMENTE 4 opciones.
            3. DINAMISMO: Preguntas que inviten a la curiosidad (Ej: "¿Sabías que...?", "¿Cuál es el principal responsable de...?", "¿Qué hito marcó...?").
            4. CALIDAD DE OPCIONES: Sin letras ("A", "B"). Conceptos crudos.
            
            Genera ${count} preguntas de trivia interesantes y retadoras pero NO estresantes.
            
            JSON ESTRICTO (No incluyas explicaciones fuera del JSON):
            [{"question_text":"¿Cuál es el principal factor...?","options":["Concepto A", "Concepto B", "Concepto C", "Concepto D"],"correct_option_index":0,"explanation":"Explicación educativa de 1-2 líneas.","topic":"${areas[0]}","visual_support_recommendation":"Recomendación de imagen (ej: Mapa de Europa del siglo XVIII, Diagrama de la fotosíntesis, Retrato de Newton, etc.)"}]
            
            🚨 REGLA DE SOPORTE VISUAL:
            En el campo "visual_support_recommendation", sugiere qué recurso visual ayudaría a reforzar la explicación. Sé creativo y variado (Tablas, Mapas, Diagramas, Pinturas, Fotos históricas).
            
            ⚠️ REGLA DE FORMATO:
            Bajo ninguna circunstancia uses letras ("A)", "B.", "C.-", etc.) al inicio de las opciones.
            Las opciones deben contener únicamente el texto crudo del concepto evaluado.
            Asegúrate de escapar correctamente las comillas dobles internas con \\" para no romper el formato JSON.
            `;

            const result = await modelCreativeLite.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            let questions;
            try {
                // Extracción robusta (Mismo estándar que mlService)
                const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                let jsonString = codeBlockMatch ? codeBlockMatch[1] : text;
                const startIndex = jsonString.search(/\[/);
                const endIndex = jsonString.lastIndexOf(']');
                
                if (startIndex !== -1 && endIndex !== -1) {
                    jsonString = jsonString.substring(startIndex, endIndex + 1);
                }
                questions = JSON.parse(jsonString);
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
                    if (q.correct_option_index >= 4) {
                        q.options[3] = q.options[q.correct_option_index]; // Mover correcta a pos 3
                        q.correct_option_index = 3;
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
     * @param {number} count - Número sugerido (Default 10, adaptable).
     */
    async generateFlashcardsFromTopic(topic, count = 10) {
        try {
            const prompt = `
            Actúa como un experto pedagogogía y diseño instruccional.
            Crea entre 1 y 15 Flashcards educativas sobre el tema: "${topic}".
            
            🚨 REGLA DE INTELIGENCIA ADAPTATIVA:
            - Si el usuario solicita EXPLÍCITAMENTE una cantidad en el tema (ej: "3 tarjetas"), cumple con esa cantidad exacta SIEMPRE QUE esté entre 1 y 15.
            - Si no hay una cantidad explícita, sé proporcional a la densidad del tema. Si el tema es simple o muy específico, genera lo necesario (aunque sea 1 o 2 tarjetas).
            - Si el tema es complejo o extenso, genera el máximo de 15 tarjetas críticas.
            - No intentes meter todo un libro en 15 tarjetas; prioriza lo que un estudiante NECESITA memorizar primero.

            FORMATO JSON ESTRICTO:
            [{ "front": "Pregunta o Concepto", "back": "Respuesta o Definición Breve" }]

            REGLAS DE CALIDAD:
            1. Idioma: Español.
            2. "front": Debe ser claro y provocar recuerdo activo (Active Recall).
            3. "back": Debe ser conciso (< 50 palabras). Evita respuestas de una sola palabra si el concepto requiere matiz.
            4. Evita preguntas de verdadero/falso o sí/no.
            `;

            console.log(`🧠 AI Adaptive Flashcards: Procesando '${topic}' (Margen 5-15)...`);
            // Flashcards siempre usan Lite para ahorro
            const result = await modelCreativeLite.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            const cards = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            return cards;

        } catch (error) {
            console.error("❌ Error Generando Flashcards IA:", error);
            throw new Error("No se pudo generar contenido con IA.");
        }
    }

    // --- MÉTODOS LEGACY (Wrappers para compatibilidad) ---

    // Usado por QuizController (ENAM/SERUMS/RESIDENTADO)
    async generateQuiz(categoryOptions, userId, limit = 5, subscriptionTier = 'free', seenIds = []) {
        const result = await this.getQuestions(categoryOptions, limit, userId, subscriptionTier, seenIds);
        return { questions: result.questions, topic: result.topic };
    }

    // Usado por QuizGameController (Arena)
    async generateGeneralQuiz(topic, userId, tier = 'free') {
        const result = await this.getQuestions({ target: 'GENERAL_TRIVIA', areas: [topic] }, 5, userId, tier);
        return result.questions;
    }

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
                const isCorrect = q.userAnswer === q.correct_option_index;

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
            const errors = quizData.questions.filter(q => q.userAnswer !== q.correct_option_index);

            if (errors.length > 0) {
                // Pasamos quizData.topic como fallback, pero el repo ahora usará q.topic
                await repository.createFlashcardsBatch(userId, errors, quizData.topic, attemptId);
                return { attemptId, flashcardsCreated: errors.length };
            }
        }

        return { attemptId, flashcardsCreated: 0 };
    }

    // --- NUEVO: MÉTODOS DE ANALÍTICA DEL QUIZ (MIGRADOS DESDE EL CONTROLADOR) ---
    async incrementUserSimulatorUsage(userId) {
        await repository.incrementSimulatorUsage(userId);
    }

    async getUserQuizStats(userId, context, target) {
        let topicFilter = '';
        const params = [userId];
        
        if (context === 'MEDICINA') {
            if (target) {
                params.push(target);
                topicFilter = `AND target = $2`;
            } else {
                topicFilter = ``; 
            }
        } else if (context) {
            params.push(`%${context}%`);
            topicFilter = `AND topic ILIKE $2`;
        }

        const qStats = await repository.getBasicQuizStats(userId, topicFilter, params);

        let accuracy = 0;
        let avgScore20 = 0;
        const totalQ = parseInt(qStats.total_questions) || 0;
        const totalCorrect = parseInt(qStats.total_correct) || 0;
        const totalGames = parseInt(qStats.total_games) || 0;
        const totalIncorrect = totalQ - totalCorrect;

        if (totalQ > 0) {
            accuracy = (totalCorrect / totalQ) * 100;
            avgScore20 = (totalCorrect / totalQ) * 20;
        }

        const mastered = await repository.getMasteredFlashcardsCount(userId);

        let strongest = 'N/A';
        let weakest = 'N/A';
        let radarData = []; 

        try {
            const topicRes = await repository.getTopicAnalysis(userId, topicFilter, params);
            if (topicRes.length > 0) {
                strongest = topicRes[0].subtema;
                weakest = topicRes[topicRes.length - 1].subtema;

                radarData = topicRes.map(row => {
                    const correctAnswers = parseInt(row.correct_answers || 0, 10);
                    const totalAnswers = parseInt(row.total_answers || 0, 10);
                    return {
                        subject: row.subtema,
                        accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
                        correct: correctAnswers,
                        total: totalAnswers
                    };
                });
            }
        } catch (e) {
            console.warn("⚠️ No se pudo procesar area_stats JSONB.", e.message);
            const topicRes = await repository.getTopicAnalysisFallback(userId, topicFilter, params);
            if (topicRes.length > 0) {
                strongest = topicRes[0].topic;
                weakest = topicRes[topicRes.length - 1].topic;
            }
        }

        let deckId = null;
        if (context) {
            deckId = await repository.ensureSystemDeck(userId, context);
        }

        return {
            avg_score: avgScore20.toFixed(1),
            accuracy: Math.round(accuracy),
            total_correct: totalCorrect,
            total_incorrect: totalIncorrect,
            mastered_cards: mastered,
            strongest_topic: strongest,
            weakest_topic: weakest,
            radar_data: radarData,
            system_deck_id: deckId
        };
    }

    async getLeaderboard() {
        return await repository.getLeaderboard();
    }
}

module.exports = new TrainingService();
