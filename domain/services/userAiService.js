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
    static async generateQuestions(target, studyAreas, career, amount = 5, tier = 'basic', reqDomain = 'medicine') {
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

                let batchQuestions = await this._generateBatchInternal(target, areaForThisBatch, career, allQuestions, currentBatchSize, tier, domain);

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
    static async _generateBatchInternal(target, studyAreas, career, previousBatchQuestions = [], amount = 1, tier = 'basic', domain = 'medicine') {
        try {
            const careerLower = String(career || "Medicina humana").toLowerCase();

            // 0. PREVENIR DUPLICIDAD (Escaneo de Historial en DB)
            let recentQuestionsText = "";
            try {
                const { query } = require('../../infrastructure/database/db');
                // ✅ MEMORIA ENRIQUECIDA: Extraer texto, tema y subtema para evitar solapamientos temáticos.
                const result = await query(
                    "SELECT question_text, topic, subtopic FROM question_bank ORDER BY created_at DESC LIMIT 40"
                );

                if (result.rows.length > 0) {
                    recentQuestionsText = "\n🚨 RESTRICCIÓN DE NO-REPETICIÓN (MEMORIA PROFUNDA) 🚨\n" +
                        "Temas y escenarios que YA existen. ESTÁ TERMINANTEMENTE PROHIBIDO REPETIR O CLONAR ESTOS CASOS:\n" +
                        result.rows.map((r, idx) => `- [${r.topic} | ${r.subtopic}]: ${r.question_text.substring(0, 100)}...`).join('\n') +
                        "\n🎯 DESAFÍO: Identifica el patrón de arriba y ROMPE con él. Si ya hay casos en 'Loreto' o '45 años', cambia radicalmente de geografía y edad.\n";
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

                levelInstruction = "Nivel Senior ENAM. Evalúa Diagnóstico y Manejo. Explicación: 2 párrafos técnicos.";
            } else if (target === "SERUMS") {
                targetRules = `Enfoque: Salud Pública y Gestión Comunitaria (ENCAPS). 
                VINCULACION COMUNITARIA: El nivel del establecimiento (I-1 al I-4) y la geografía peruana deben integrarse de forma natural y VARIADA.
                JERARQUÍA DE FUENTES (ESTRICTA): 1. LEY (NTS/RM) > 2. OFICIAL (GPC Minsa) > 3. SOPORTE (Libros).
                REGLA DE ORO: Mínimo 2 fuentes diferentes + Un TIP SERUMS`;

                starterGallery = `
                  * ESTRUCTURA DIRECTA (50%): Empieza de frente con la pregunta. (Ej: "¿Cuál es el valor límite de...?", "¿Qué norma técnica regula...?", "¿Cómo se clasifica...?")
                  * ESTRUCTURA DATO (30%): Empieza con el sujeto o dato clínico (Ej: "La gestante de 19 años con Hb: 9...", "Un trabajador sexual con úlceras...")
                  * ESTRUCTURA COMPLETAR (20%): Usa el formato de espacios en blanco ____ (Ej: "Todo servidor público debe ______ y ______ los bienes...").
                  * PROHIBICIÓN ABSOLUTA: Prohibido iniciar preguntas con "Usted es...", "Usted, como serumista...", "En un/una...", "El personal de salud...". Máximo 1 de cada 10 permitidas. Rompe la Inercia Narrativa ya.`;

                levelInstruction = "Estándar SERUMS. Evalúa Normativa, Gestión y Casos de Salud Pública. Explicación: 2 párrafos profundos con fuente oficial.";
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

                levelInstruction = "Nivel Senior Residentado. Evalúa Fisiopatología, Manejo Avanzado y Especialización. Explicación: 2 párrafos analíticos y robustos.";
            }

            // 2. PROMPT MAESTRO (Versión FAST - Sin RAG)
            const prompt = `
            Eres un Redactor Senior de Exámenes Médicos Nacionales (SERUMS, ENAM, RESIDENTADO).
            
            MISIÓN CRÍTICA: Generar ${amount} pregunta(s) INÉDITA(S) de Nivel Senior.
            ÁREA DE ESTUDIO ESTRICTA: **${studyAreas}**.

            [REGLAS DE ORO DE VARIABILIDAD (INQUEBRANTABLES)]
            1. PROHIBICIÓN DE PLAGIO: Está terminantemente prohibido copiar o parafrasear los ejemplos de la "Starter Gallery" o de las instrucciones. Úsalos SOLO para entender la ESTRUCTURA.
            2. ROTACIÓN DE SUJETOS: Alterna entre: Gestante (fórmula G_P____), Escolar, Adulto Mayor, Reo, Trabajador sexual, Autoridad local, Personal de Salud, Paciente con comorbilidades.
            3. ESCENARIOS DIVERSOS: No todo es "Puesto I-1". Usa: C.S. Urbano marginal, Brigada de selva alta, Campamento minero, Auditoría de farmacia, Sala de Situación, Institución Educativa, Visita domiciliaria.
            4. RIGOR TÉCNICO: Incluye SIEMPRE datos de laboratorio o signos vitales específicos (Ej: "SatO2: 84%", "Hb: 9 g/dL", "Fe sérico: 30").

            [ESTILO DEL ENUNCIADO (SEQUEDAD TÉCNICA)]
            - ESTILO TELEGRAMA MINSA: Elimina preámbulos literarios. No cuentes historias. Entrega datos y pregunta.
            - LA LÁPIDA DE LOS PREFIJOS: Banea el inicio "Usted, como [Rol]...". Es una muletilla inaceptable.
            - PROHIBICIÓN DE RECICLAJE: Si un escenario (Geografía + Edad + Sujeto) aparece en el historial anterior, cámbialo al 100%. Ejemplo: Si ya usaste "Loreto/45 años", ahora usa "Andahuaylas/G3P2/34 años".
            - RESILIENCIA DE MEMORIA: Si una pregunta en el historial está marcada como "[Sin Subtema]", analiza su texto clínico para deducir el escenario evaluado y evítalo activamente (ej: cambia la patología, edad del paciente o entorno geográfico).
            - VARIEDAD GRAMATICAL: Si la pregunta anterior empezó con un sujeto, la actual debe ser una pregunta directa (¿Cuál...?).
            - REGLA DE SIGNOS VITALES: Mandatorio incluir FC, FR, T°, PA, SatO2 en casos clínicos.
            - REGLA GEOCLÍNICA: Si usas una ciudad, el tema clínico debe ser coherente con ella.
            - PROHIBICIÓN: No uses "En...", "Desde...", "Durante...", "Usted..." al inicio de más de una pregunta por batch.

            [REGLAS PARA LAS OPCIONES]
            - TEXTO LIMPIO: Sin letras ni prefijos (A., B., C.).
            - BREVEDAD: 1 a 12 palabras máximo.
            - SIMETRÍA VISUAL: Longitud similar en todas las opciones.

            [EXPLICACIÓN (REGISTRO TÉCNICO)]
            - Que no sea tan extenso, ni tan breve, lo necesario para fundamentar la respuesta.
            - Usa CITACIÓN EN NEGRITA al inicio de cada párrafo fuente. VARÍA EL ESTILO (Ej: "**Según la NTS 123...**", "**De acuerdo a la RM...**", "**La Guía Técnica establece...**", "**Siguiendo lo dispuesto en...**").
            - SECCIÓN OBLIGATORIA (Solo para SERUMS): Finaliza SIEMPRE con el texto "💡 **TIP SERUMS:** [Consejo práctico sobre gestión o vida en comunidad]".

            [JERARQUÍA DE FUENTES Y ESTILO BASE]:
            ${targetRules}
            ${starterGallery}

            [RESTRICCIONES DE NO-REPETICIÓN]:
            ${recentQuestionsText}

            [FORMATO DE SALIDA JSON (ARRAY)]:
            [{
                "topic": "${studyAreas}",
                "difficulty": "Senior",
                "question_text": "...",
                "options": ${(target === 'RESIDENTADO') ? '["O1", "O2", "O3", "O4", "O5"]' : '["O1", "O2", "O3", "O4"]'},
                "correct_option_index": 0,
                "explanation": "2-3 párrafos técnicos con citado en negrita.",
                "domain": "${domain}",
                "target": "${target}",
                "career": "${career}",
                "subtopic": "...",
                "visual_support_recommendation": "Mensaje corto si es pertinente reforzar con imagen (ej: 'Recomendado: Radiografía de tórax') o null si no es necesario."
            }]

            [REGLA DE PERTINENCIA VISUAL]:
            - Analiza si la explicación se beneficiaría de un soporte visual para reforzar el aprendizaje (ej: anatomía de órganos, trazados, placas, lesiones, diagramas de flujo, tablas comparativas, procesos fisiológicos, etc.). 
            - NO TE LIMITES a categorías fijas; recomienda cualquier recurso visual que mejore la retención del alumno.
            - Si es pertinente, coloca una recomendación breve. Si no, coloca null.

            [REGLA DE ORO DE DIVERSIDAD INTERNA]:
            - Cada una de las ${amount} preguntas de este JSON debe ser TOTALMENTE diferente a las demás en el mismo lote.
            - Prohibido repetir el mismo subtema o la misma norma técnica dentro de este grupo de preguntas.
            - Alterna entre (Niño / Mujer / Adulto Mayor / Gestante / Trabajador) y entre (Costa / Sierra / Selva).

            DEVUELVE ÚNICA Y EXCLUSIVAMENTE EL JSON VÁLIDO. PROHIBIDO USAR MARKDOWN.
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
