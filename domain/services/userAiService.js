const { VertexAI } = require('@google-cloud/vertexai');
const { normalizeText } = require('../utils/textUtils');

// Inicializar Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
const vertex_ai = new VertexAI({ project: project, location: location });

// Configuración Lite para Usuarios (Ahorro y Velocidad)
const liteConfig = {
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.8,
        responseMimeType: "application/json"
    }
};

const modelLite = vertex_ai.getGenerativeModel(liteConfig);

class UserAiService {
    /**
     * Generador de Preguntas para Usuarios (Modo Fast - Sin RAG)
     */
    static async generateQuestions(target, difficulty, studyAreas, career, amount = 5, tier = 'basic', reqDomain = 'medicine') {
        const domain = reqDomain || 'medicine';
        console.log(`⚡ [UserAiService] Generación "Fast Mode" p/ ${target} - Áreas: ${studyAreas}`);
        try {
            const requestedAmount = amount;
            let areasArray = [];
            if (typeof studyAreas === 'string') {
                areasArray = studyAreas.split(',').map(a => a.trim()).filter(a => a);
            } else if (Array.isArray(studyAreas)) {
                areasArray = studyAreas;
            }

            let sampledAreas = areasArray.length >= 5 
                ? areasArray.sort(() => 0.5 - Math.random()).slice(0, 5)
                : (areasArray.length > 0 ? areasArray : ['General']);

            const currentBatchLimit = (target === 'RESIDENTADO' || target === 'ENAM' || target === 'SERUMS') ? 1 : 3;
            let allQuestions = [];

            const sleep = ms => new Promise(res => setTimeout(res, ms));

            for (let i = 0; i < requestedAmount; i += currentBatchLimit) {
                const currentBatchSize = Math.min(currentBatchLimit, requestedAmount - i);
                let areaForThisBatch = (currentBatchLimit === 1) ? sampledAreas[i % sampledAreas.length] : sampledAreas.join(', ');

                let batchQuestions = await this._generateBatchInternal(target, difficulty, areaForThisBatch, career, allQuestions, currentBatchSize, tier, domain);

                if (batchQuestions && batchQuestions.length > 0) {
                    batchQuestions.forEach((q) => { if (currentBatchLimit === 1) q.topic = areaForThisBatch; });
                    allQuestions = allQuestions.concat(batchQuestions);
                }

                if (allQuestions.length >= requestedAmount) break;
                if (i + currentBatchLimit < requestedAmount) await sleep(1000); // Latencia reducida para modo Fast
            }

            return allQuestions.slice(0, requestedAmount);
        } catch (error) {
            console.error('❌ Error crítico en UserAiService:', error);
            throw error;
        }
    }

    /**
     * @private Lógica de generación con el "PROMPT MAESTRO" (Version Fast - Sin RAG)
     */
    static async _generateBatchInternal(target, difficulty, studyAreas, career, previousBatchQuestions = [], amount = 1, tier = 'basic', domain = 'medicine') {
        try {
            const careerStr = String(career || "Medicina");
            const careerLower = careerStr.toLowerCase();

            // 0. PREVENIR DUPLICIDAD (Escaneo de Historial en DB)
            let recentQuestionsText = "";
            try {
                const db = require('../../infrastructure/database/db'); 
                const areasArray = String(studyAreas || '').split(',').map(a => a.trim()).filter(a => a);

                const recentQ = await db.query(`
                    SELECT topic, question_text 
                    FROM question_bank 
                    WHERE target = $1 
                      AND domain = $2 
                      AND (career = $3 OR $3 IS NULL)
                      AND (topic = ANY($4) OR $4 IS NULL)
                      AND difficulty = $5
                    ORDER BY created_at DESC 
                    LIMIT 100
                `, [target, domain, careerLower || null, areasArray.length > 0 ? areasArray : null, difficulty]);

                const allPreviousTexts = [
                    ...recentQ.rows.map(r => r.topic + ": " + r.question_text),
                    ...previousBatchQuestions.map(q => q.topic + ": " + q.question_text)
                ];

                if (allPreviousTexts.length > 0) {
                    recentQuestionsText = "\n🚨 RESTRICCIÓN DE NO-REPETICIÓN 🚨\n" +
                        "Temas y enfoques que YA existen (PROHIBIDO REPETIR EXACTAMENTE):\n" +
                        allPreviousTexts.slice(-15).map((txt, idx) => `- ${txt.substring(0, 120)}...`).join('\n') +
                        "\n🎯 Genera un escenario DISTINTO.\n";
                }
            } catch (e) {
                console.warn("⚠️ No se pudo obtener el historial anti-duplicidad en User Service:", e);
            }

            // 1. REGLAS DINÁMICAS POR TARGET (Calidad Premium Restaurada)
            let targetRules = "";
            let levelInstruction = "";
            let starterGallery = "";

            if (target === "ENAM") {
                targetRules = `PERFIL ENAM: Médico General - Enfoque Clínico y Diagnóstico.
                ENFOQUE: Clínica general, diagnóstico diferencial y manejo inicial basado en evidencia.
                JERARQUÍA DE FUENTES: 1. GPC Oficiales (Minsa/EsSalud) > 2. Libros Clínicos (Harrison/Nelson/Williams) > 3. Manuales de Especialidad (AMIR/CTO) > 4. NTS/RM/Leyes.
                REGLA DE ORO: Mínimo 2 fuentes distintas en la explicación.`;

                starterGallery = `
                  * PACIENTE (Clásico): "Mujer de 45 años...", "Gestante de 32 semanas...", "Niño con fiebre de..." (Sin 'Un' o 'Una').
                  * TIEMPO: "Tras 4 horas de evolución...", "Hace 3 días presenta..."
                  * HALLAZGO/CLÍNICA: "Al examen físico se palpa...", "La radiografía de tórax muestra...", "El laboratorio reporta..."
                  * ACCIÓN: "Usted se encuentra en emergencia...", "Durante el control prenatal...", "Al atender un parto..."
                  * DIRECTA: "¿Cuál es el diagnóstico más probable?", "¿Qué tratamiento de elección...?", "¿Cuál es la complicación...?"`;

                if (difficulty === "Básico") levelInstruction = "Evalúa MEMORIA DIRECTA (Definiciones, Triadas). Explicación: 2 párrafos extensos y detallados.";
                else if (difficulty === "Intermedio") levelInstruction = "Evalúa RAZONAMIENTO CLÍNICO SIMPLE. Explicación: 2 párrafos técnicos y detallados.";
                else levelInstruction = "Evalúa MANEJO INICIAL Y REFERENCIAS. Explicación: 3 párrafos analíticos y robustos.";
            } else if (target === "SERUMS") {
                targetRules = `Enfoque: Salud Pública y Gestión Comunitaria (ENCAPS). 
                VINCULACION COMUNITARIA: El nivel del establecimiento (I-1 al I-4) y la geografía peruana deben integrarse de forma natural y VARIADA.
                JERARQUÍA DE FUENTES (ESTRICTA): 1. LEY (NTS/RM) > 2. OFICIAL (GPC Minsa) > 3. SOPORTE (Libros).
                REGLA DE ORO: Mínimo 2 fuentes diferentes + Un TIP SERUMS`;

                starterGallery = `
                  * LOCALIDAD: "EESS nivel I-4 en la sierra...", "C.S. en zona amazónica...", "Puesto de salud I-1 reporta..."
                  * ACCIÓN/GESTIÓN: "Se le encarga evaluar...", "Como jefe del EESS usted...", "Durante la visita domiciliaria..."
                  * PACIENTE (Rural): "Comunero de 40 años...", "Madre de familia acude...", "Escolar de 8 años..."
                  * ENTIDAD/NORMA: "El Ministerio de Salud...", "La DIRIS reporta...", "Según el PAI..."
                  * DIRECTA: "¿Qué nivel de prevención...?", "¿Quién integra el equipo...?", "¿Cuál es el plazo de...?"`;

                if (difficulty === "Básico") levelInstruction = "Evalúa DATOS NORMATIVOS. Explicación: 2 párrafos extensos.";
                else if (difficulty === "Intermedio") levelInstruction = "Evalúa APLICACIÓN DE NORMAS. Explicación: 2 párrafos técnicos y detallados.";
                else levelInstruction = "Evalúa GESTIÓN DE BROTES. Explicación: 3 párrafos profundos y robustos.";
            } else if (target === "RESIDENTADO") {
                targetRules = `PERFIL RESIDENTADO: ENFOQUE EN LIBROS Y EVIDENCIA CLÍNICA.
                JERARQUÍA ESTRICTA: 1. LIBROS DE REFERENCIA (Harrison, Washington, Nelson, Williams) > 2. MANUALES (AMIR, CTO) > 3. NORMAS/LEYES.
                REGLA DE ORO: La fundamentación DEBE priorizar el sustento clínico/fisiopatológico de los LIBROS en temas médicos.`;

                starterGallery = `
                  * PACIENTE (Complejo): "Varón con antecedente de cirrosis...", "Paciente polimedicado que...", "Mujer con clínica de..."
                  * FISIOPATOLÓGICO: "El mecanismo de acción de...", "La causa más frecuente de...", "La enzima responsable de..."
                  * ESCENARIO HOSPI: "Paciente en UCI presenta...", "Tras 24h de postoperatorio...", "Durante la laparotomía..."
                  * HALLAZGO AVANZADO: "El signo de (Epónimo) se asocia a...", "En el frotis de sangre periférica...", "La RM de encéfalo muestra..."
                  * DIRECTA: "¿Qué marcador tumoral...?", "¿Cuál es el Gold Standard para...?", "¿Qué gen está mutado en...?"`;

                if (difficulty === "Básico") levelInstruction = "CIENCIAS BÁSICAS Y FISIOPATOLOGÍA aplicadas a la clínica. Explicación: 2 o 3 párrafos robustos.";
                else if (difficulty === "Intermedio") levelInstruction = "CASOS CLÍNICOS de especialidad con enfoque en diagnóstico diferencial. Explicación: 2 o 3 párrafos robustos.";
                else levelInstruction = "MANEJO TERAPÉUTICO de 2da/3ra línea y complicaciones raras. Explicación: 3 párrafos analíticos extensos.";
            }

            // 2. PROMPT MAESTRO (Versión FAST - Sin RAG)
            const prompt = `
            Eres un Redactor Senior de Exámenes Médicos Nacionales (SERUMS, ENAM, RESIDENTADO).

            MISIÓN CRÍTICA: Generar ${amount} pregunta(s) INÉDITA(S) de nivel ${difficulty}.
            ÁREA DE ESTUDIO ESTRICTA: **${studyAreas}**.

            [REGLAS PARA LAS OPCIONES DE RESPUESTA (INQUEBRANTABLES)]:
            1. TEXTO LIMPIO (SIN LETRAS): PROHIBIDO prefijos como "A.", "B.", "C.", etc. Escribe SOLO el texto de la respuesta.
            2. BREVEDAD EXTREMA: OBLIGATORIO mantener las opciones entre 1 y un MÁXIMO de 12 palabras.
            3. SIMETRÍA VISUAL: La respuesta correcta y los distractores deben tener casi la misma cantidad de palabras.
            4. PROHIBIDO SOBRE-EXPLICAR: No justifiques la respuesta correcta dentro de la opción.
            5. ALEATORIEDAD: Coloca la respuesta correcta en una posición aleatoria en el array.

            [ESTILO DEL ENUNCIADO]
            - Estilo Directo, Operativo y Seco (Estilo Telegrama).
            - Rota los inicios (Ej: "Mujer de 45 años...", "Durante la guardia...").
            - Alterna entre preguntas directas ("¿Cuál es...?") y enunciados para completar espacios (____).

            [EXPLICACIÓN (FUNDAMENTACIÓN)]
            - ${levelInstruction}
            - Usa CITACIÓN EN NEGRITA al inicio (Ej: "*Según la NTS 123-MINSA*: ...").
            - PROHIBIDO mencionar letras de opciones (Ej: "La opción A es correcta"). Refiérete a los conceptos por nombre.

            [JERARQUÍA DE FUENTES (RESPETA ESTO)]:
            ${targetRules}

            [DATOS DE APOYO (CONOCIMIENTO EXPERTO)]:
            Usa tu base de conocimiento médico experto coherente con la jerarquía de fuentes peruanas e internacionales citada arriba. 
            No utilices RAG externo, confía en tu entrenamiento para dar respuestas precisas.

            [ESTILO REAL DE EXAMEN (IMITA EL ENUNCIADO Y LA BREVEDAD DE SUS OPCIONES)]:
            ${starterGallery}

            [FORMATO DE SALIDA JSON (ARRAY DE OBJETOS)]:
            [{
                "topic": "${studyAreas}",
                "difficulty": "${difficulty}",
                "question_text": "Texto Directo (Estilo Telegrama).",
                "options": ${(target === 'RESIDENTADO') ? '["Opcion A", "Opcion B", "Opcion C", "Opcion D", "Opcion E"]' : '["Opcion A", "Opcion B", "Opcion C", "Opcion D"]'},
                "correct_option_index": 0,
                "explanation": "2-3 párrafos detallados con citado en negrita.",
                "domain": "${domain}",
                "target": "${target}",
                "career": "${career}",
                "subtopic": "Subtema específico"
            }]

            DEVUELVE ÚNICA Y EXCLUSIVAMENTE EL JSON VÁLIDO. NADA DE TEXTO ANTES NI DESPUÉS. PROHIBIDO USAR MARKDOWN.
            `;

            const result = await modelLite.generateContent(prompt);
            const responseText = result.response.candidates[0].content.parts[0].text;

            let questions = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
            if (!Array.isArray(questions)) questions = [questions];
            return questions;
        } catch (error) {
            console.error('❌ Error en generacion de lote User AI:', error.message);
            return [];
        }
    }
}

module.exports = UserAiService;
