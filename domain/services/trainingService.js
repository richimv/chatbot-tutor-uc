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
     * Construye una query RAG enriquecida según Target + Área.
     * En vez de "Protocolos ENAM de Cardiología", genera queries con
     * términos médicos específicos que mejoran la relevancia del vector search.
     */
    _buildRagQuery(target, areas, difficulty) {
        const areaString = areas.join(', ');

        // Mapa de keywords por área para enriquecer la búsqueda vectorial
        const areaKeywords = {
            // Grupo A — Ciencias Básicas
            'Anatomía': 'anatomía humana estructuras órganos relaciones topográficas',
            'Fisiología': 'fisiología mecanismos homeostasis función orgánica',
            'Farmacología': 'farmacología mecanismo de acción farmacocinética farmacodinamia interacciones medicamentosas',
            'Microbiología y Parasitología': 'microbiología parasitología agentes infecciosos bacterias virus parásitos patogenia',

            // Grupo B — Las 4 Grandes
            'Medicina Interna': 'medicina interna diagnóstico diferencial adultos Harrison fisiopatología',
            'Pediatría': 'pediatría neonatología crecimiento desarrollo inmunización infantil Nelson',
            'Ginecología y Obstetricia': 'ginecología obstetricia embarazo parto preeclampsia control prenatal',
            'Cirugía General': 'cirugía general abdomen agudo apendicitis colecistitis hernias manejo quirúrgico',

            // Grupo C — Especialidades
            'Cardiología': 'cardiología infarto síndrome coronario insuficiencia cardíaca arritmias ECG hipertensión',
            'Gastroenterología': 'gastroenterología hígado hepatitis pancreatitis enfermedad ácido péptica hemorragia digestiva',
            'Neurología': 'neurología ACV epilepsia meningitis cefalea neuropatía',
            'Nefrología': 'nefrología insuficiencia renal síndrome nefrótico nefrítico electrolitos diálisis',
            'Neumología': 'neumología neumonía EPOC asma tuberculosis pulmonar derrame pleural',
            'Endocrinología': 'endocrinología diabetes mellitus tiroides hipotiroidismo hipertiroidismo Cushing',
            'Infectología': 'infectología VIH SIDA tuberculosis dengue malaria sepsis antibioticoterapia',
            'Reumatología': 'reumatología lupus artritis reumatoide vasculitis autoinmunidad',
            'Traumatología': 'traumatología fracturas luxaciones ortopedia manejo trauma musculoesquelético',

            // Grupo D — Salud Pública y Gestión
            'Salud Pública y Epidemiología': 'salud pública epidemiología vigilancia epidemiológica brotes dengue malaria',
            'Gestión de Servicios de Salud': 'gestión servicios salud categorización establecimientos calidad atención',
            'Ética Deontología e Interculturalidad': 'ética médica deontología derechos paciente interculturalidad consentimiento',
            'Medicina Legal': 'medicina legal certificado defunción peritaje responsabilidad médica autopsia',
            'Investigación y Bioestadística': 'investigación bioestadística estudios clínicos sensibilidad especificidad',
            'Cuidado Integral': 'cuidado integral MAIS-BFC etapas de vida paquetes atención MINSA'
        };

        // Keywords adicionales por Target (contexto de examen)
        const targetContext = {
            'ENAM': {
                'Salud Pública y Epidemiología': 'Calendario Vacunación cadena frío NTS TBC NTS Materno-Perinatal esquema vacunal brote dengue',
                'Cuidado Integral': 'MAIS-BFC modelo atención integral etapas vida paquetes atención primer nivel',
                'Ética Deontología e Interculturalidad': 'parto vertical costumbres locales adecuación cultural interculturalidad',
                'Medicina Legal': 'certificado defunción llenado correcto causa básica muerte',
                '_default': 'examen nacional medicina ENAM diagnóstico conducta inicial primer nivel'
            },
            'PRE-INTERNADO': {
                'Gestión de Servicios de Salud': 'categorización establecimientos I-1 III-2 triaje hospitalario ESN',
                'Ética Deontología e Interculturalidad': 'derechos paciente consentimiento informado seguridad paciente',
                'Investigación y Bioestadística': 'media mediana moda tipos variables estadística descriptiva básica',
                '_default': 'pre-internado EsSalud seguridad paciente competencias pregrado'
            },
            'RESIDENTADO': {
                'Investigación y Bioestadística': 'lectura crítica riesgo relativo odds ratio valores p sesgos tipos estudio cohorte ensayo clínico NNT',
                'Gestión de Servicios de Salud': 'diagrama Ishikawa Pareto planeamiento estratégico FODA calidad mejora continua',
                'Salud Pública y Epidemiología': 'sensibilidad especificidad valor predictivo positivo negativo curva ROC prevalencia incidencia',
                '_default': 'residentado CONAREME especialidad diagnóstico diferencial manejo avanzado'
            }
        };

        // Construir la query enriquecida
        const primaryArea = areas[0];
        const baseKeywords = areaKeywords[primaryArea] || primaryArea;

        // Añadir contexto específico del target para esta área
        const tCtx = targetContext[target] || {};
        const specificBoost = tCtx[primaryArea] || tCtx['_default'] || '';

        const query = `${baseKeywords} ${specificBoost}`.trim();

        return query;
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

        // 2. Si faltan, generar con IA
        const needed = limit - questions.length;
        console.log(`⚠️ Banco insuficiente (Encontradas: ${questions.length}). Generando ${needed} nuevas con IA... [Target: ${target}] [Nivel: ${difficulty}] [Áreas: ${areas.join(', ')}]`);

        // Generar enviando el Array de areas
        let newQuestions = await (target !== 'GENERAL_TRIVIA'
            ? this.generateMedicalQuestionsAI(target, areas, difficulty, limit)
            : this.generateGeneralQuestionsAI(areas, difficulty, limit)); // Enviando Array de Areas a General también

        // 🔀 Shuffle de opciones para nuevas preguntas IA
        newQuestions = newQuestions.map(q => this.shuffleOptions(q));

        // 3. Guardar las nuevas en el Banco Y OBTENER IDs
        let newIds = [];
        if (newQuestions.length > 0) {
            // Pasamos areas[0] como defaultTopic, pero el repositorio priorizará q.topic generado por la IA
            newIds = await repository.saveQuestionBankBatch(newQuestions, areas[0], dbDomain, dbTarget, difficulty);
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
     * Generador Puro IA (MEDICINA) - Lógica interna RAG Multi-Área y Deduplicación
     */
    async generateMedicalQuestionsAI(target, areas, difficulty, count) {
        try {
            const areaString = areas.join(', ');

            // 1. RAG Híbrido: Query contextual enriquecida por Target + Área
            let ragContext = "";
            try {
                const RagService = require('./ragService');
                const queryPrompt = this._buildRagQuery(target, areas, difficulty);
                console.log(`🔍 RAG Query: "${queryPrompt}"`);
                ragContext = await RagService.searchContext(queryPrompt, 5);
            } catch (e) { console.error("RAG Falló", e); }

            // 2. Extraer Contexto de Deduplicación (Preguntas Previas)
            let deduplicationText = "No hay contexto previo de deduplicación.";
            try {
                const pastQuestions = await repository.getRandomQuestionsContext('medicine', target, areas, 15);
                if (pastQuestions.length > 0) {
                    deduplicationText = pastQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                }
            } catch (e) { console.error("Deduplication fetch failed", e); }

            // 3. Generar Semantic Sub-Drift (Rotación de Enfoque Clínico)
            const clinicalFocuses = [
                "Etiología y Fisiopatología",
                "Diagnóstico Inicial y Criterios",
                "Exámenes Auxiliares (Gold Standard)",
                "Tratamiento de Primera Línea",
                "Manejo de Complicaciones",
                "Factores de Riesgo y Prevención"
            ];
            const randomFocus = clinicalFocuses[Math.floor(Math.random() * clinicalFocuses.length)];


            let optionsCount = 4;
            let optionsStr = '["Opción 1 limpia sin letra","Opción 2 limpia sin letra","Opción 3 limpia sin letra","Opción 4 limpia sin letra"]';

            if (target === 'RESIDENTADO') {
                optionsCount = 5;
                optionsStr = '["Opción 1 limpia","Opción 2 limpia","Opción 3 limpia","Opción 4 limpia","Opción 5 limpia"]';
            }

            const prompt = `
            Actúa como un redactor experto de Exámenes Médicos Profesionales (Estilo ${target}).
            Temas obligatorios: "${areaString}". Dificultad: ${difficulty}.
            
            DIRECCIÓN RAG (MIMETISMO DE ESTILO Y FORMATO):
            A continuación se proveen extractos de libros o normativas médicas reales. Úsalos como VERDAD ABSOLUTA para generar las preguntas y IMITA ESTRICTAMENTE su estructura, tono deductivo y longitud de viñetas.
            -- RAG CONTEXT --
            ${ragContext ? ragContext : "Usa guías clínicas MINSA o internacionales vigentes."}
            
            🚨 REGLA DE ORO DE DEDUPLICACIÓN (CONTEXTO NEGATIVO):
            ABSOLUTAMENTE PROHIBIDO evaluar los siguientes conceptos o casos clínicos exactos, ya que ya existen en nuestro banco. DEBES generar preguntas sobre enfermedades, síndromes o escenarios clínicos DIFERENTES a estos:
            -- INICIO PREGUNTAS PROHIBIDAS --
            ${deduplicationText}
            -- FIN PREGUNTAS PROHIBIDAS --

            🎯 ENFOQUE CLÍNICO ROTATIVO (SEMANTIC SUB-DRIFT):
            Dentro de los límites estrictos del tema "${areaString}", hoy debes enfocar el ${count >= 3 ? '70%' : '100%'} de tus preguntas específicamente en: **${randomFocus}**. 

            MISIÓN:
            Genera ${count} preguntas de opción múltiple con casos clínicos o teóricas según el nivel.
            ATENCIÓN: CADA PREGUNTA DEBE TENER EXACTAMENTE ${optionsCount} OPCIONES DE RESPUESTA, NI UNA MÁS NI UNA MENOS.
            
            DIRECTRICES CLAVE DEL TIPO DE EXAMEN (RESPETAR ESTRICTAMENTE):
            - Si es ENAM (Examen Nacional de Medicina - Perú, ASPEFAM): Evalúa conocimientos GENERALES troncales: fisiopatología, clínica y diagnóstico clásico. INCLUYE Normas Técnicas de Salud (NTS) básicas cuando el área sea de Salud Pública (Calendario de Vacunación, cadena de frío, NTS de TBC, NTS Materno-Perinatal, MAIS-BFC). Prioriza: conducta inicial, diagnóstico y manejo en el primer nivel de atención. Si el área es Ética, incluir Parto Vertical e interculturalidad. Si el área es Medicina Legal, el Certificado de Defunción es pregunta fija. Ciencias básicas + clínicas (180-200 preguntas en el examen real). Enfoque: "El Médico de Posta".
            - Si es PRE-INTERNADO (Examen de Ingreso a Internado Médico, EsSalud): Enfócate en seguridad del paciente dentro del hospital. Atención primaria, NTS vigentes del MINSA, competencias clínicas de pregrado. Si el área es Gestión, priorizar Categorización de establecimientos (I-1 al III-2) y triaje hospitalario. Si el área es Ética, priorizar Derechos del paciente y Consentimiento Informado. Si el área es Investigación/Bioestadística, conceptos básicos: media, mediana, moda, tipos de variables. Ciencias básicas aplicadas a la clínica (ej. Anatomía de fracturas comunes). Enfoque: "Seguridad del Paciente".
            - Si es RESIDENTADO (Examen Nacional de Residentado Médico, CONAREME): Enfócate en Especialidad avanzada. Casos clínicos enrevesados con diagnóstico diferencial exhaustivo, examen auxiliar Gold Standard y tratamiento de segunda o tercera línea. Si el área es Investigación/Bioestadística, enfoque PESADO en lectura crítica: Riesgo Relativo (RR), Odds Ratio (OR), valores p, tipos de sesgos en estudios clínicos. Si el área es Gestión, priorizar herramientas de calidad (Diagrama de Ishikawa, Pareto) y Planeamiento Estratégico (FODA). Si el área es Epidemiología, cálculos complejos de sensibilidad, especificidad y valores predictivos. 90% casos clínicos + 10% ciencias básicas aplicadas. Enfoque: "El Médico Científico/Gerente".
            
            INSTRUCCIÓN DE DIFICULTAD ESTRICTA:
            ${difficulty === 'Básico' ? '- Nivel Básico: Preguntas directas de memoria pura (etiologías, definiciones, mecanismos fisiopatológicos). NO USES CASOS CLÍNICOS LARGOS. Ejemplo: "¿Cuál es el agente causal de la sífilis?"' : ''}
            ${difficulty === 'Intermedio' ? '- Nivel Intermedio: Viñetas clínicas que evalúan diagnóstico y análisis clínico. Casos clínicos cortos típicos de exámenes. Ejemplo: Paciente con fiebre y manchas, pedir diagnóstico.' : ''}
            ${difficulty === 'Avanzado' ? '- Nivel Avanzado: Casos clínicos complejos que requieran manejo terapéutico, excepciones farmacológicas o decisiones ético-legales intrincadas. Ejemplo: Elegir tratamiento alternativo en paciente alérgico a primera línea.' : ''}
            
            JSON ESTRICTO:
            [{"question":"...","options":${optionsStr},"correctAnswerIndex":0,"explanation":"...", "topic": "<Especifica el área elegida de la lista provista>"}]
            
            ⚠️ REGLA DE FORMATO:
            Bajo ninguna circunstancia uses letras ("A)", "B.", "C.-", etc.) al inicio de las opciones.
            Las opciones deben contener únicamente el texto crudo.
            Asegúrate de escapar correctamente las comillas dobles internas con \\" para no romper el formato JSON.
            `;

            const result = await modelMedical.generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text;

            try {
                return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (parseError) {
                console.error("❌ Error parseando JSON de IA Médica:", parseError.message);
                console.error("📝 Texto crudo recibido que causó el error:\n", text);
                return [];
            }
        } catch (error) {
            console.error("❌ Error IA Médica (General):", error);
            return [];
        }
    }

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

                // 🧹 SANITIZACIÓN: Evitar que Gemini invente temas combinados como "Pediatría, Neonatología"
                if (allowedAreas.length > 0) {
                    // Buscar coincidencia parcial exacta (case-insensitive)
                    const matched = allowedAreas.find(a => topic.toLowerCase().includes(a.toLowerCase()));
                    topic = matched ? matched : allowedAreas[0];
                } else if (topic.includes(',')) {
                    // Fallback extra
                    topic = topic.split(',')[0].trim();
                }

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
