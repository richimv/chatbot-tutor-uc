// ✅ 1. Importar el paquete y la clase correctos
const { VertexAI } = require('@google-cloud/vertexai');
const CourseRepository = require('../repositories/courseRepository');
const KnowledgeBaseRepository = require('../repositories/knowledgeBaseRepository');
const CareerRepository = require('../repositories/careerRepository'); // ✅ 1. Importar el repositorio de carreras

const { normalizeText } = require('../utils/textUtils'); // ✅ SOLUCIÓN: Importar la función que faltaba.

// === INICIO: VERIFICACIÓN DE API KEY ===
// (La API Key se usa automáticamente desde .env, pero el proyecto y la ubicación también)
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;
if (!project || !location) {
    console.error('❌ FATAL: Las variables de entorno GOOGLE_CLOUD_PROJECT y GOOGLE_CLOUD_LOCATION deben estar definidas en .env');
} else {
    console.log(`✅ Proyecto de Google Cloud cargado: ${project} en ${location}`);
}
// === FIN: VERIFICACIÓN ===

// ✅ 2. Inicializar el cliente de Vertex AI
const vertex_ai = new VertexAI({ project: project, location: location });

// ✅ OPTIMIZACIÓN: Inicializar el modelo una sola vez (Singleton) para mejorar la latencia.
// ✅ OPTIMIZACIÓN: Inicializar el modelo una sola vez (Singleton) para mejorar la latencia.
const systemInstruction = {
    role: 'system',
    parts: [{
        text: `ROL: Eres el Tutor Senior de "Hub Academia", un experto en Medicina Peruana y un ecosistema EdTech 100% oficial y legal.
    
    TU MISIÓN TIENE 3 PILARES:
    1.  **TUTOR CLÍNICO:** Explicar conceptos médicos basándote estrictamente en las Normas Técnicas, Guías de Práctica Clínica (GPC) y el marco legal del MINSA/EsSalud provistos en el contexto.
    2.  **CURADOR DE RECURSOS:** Conectar al usuario con material "Open Source", Papers de libre acceso, y guías oficiales que estén en nuestra BD. NO RECOMIENDES NI MENCIONES libros comerciales (ej. Harrison, CTO, etc.) a favor de la piratería; apóyate en fuentes oficiales, bases RAG, PubMed, SciELO, o material de la Academia.
    3.  **GUÍA ACADÉMICO:** Orientar sobre qué Carreras, Cursos, Módulos de Entrenamiento y Flashcards están disponibles en Hub Academia.

    --- DIRECTRICES DE COMPORTAMIENTO ---

    A) AL RESPONDER SOBRE TEMAS/CONCEPTOS MÉDICOS:
    1.  **Explicación Basada en Evidencia:** Responde con claridad médica. SIEMPRE prioriza el contexto inyectado "[BIBLIOTECA...]", "[CONTEXTO MÉDICO RAG...]" o datos provenientes de la base RAG para fundamentar tu respuesta. Si recibes un bloque "[CONTEXTO MÉDICO RAG - DOCUMENTOS VERIFICADOS]", ÚSALO OBLIGATORIAMENTE como base de tu respuesta y cita la fuente (ej. "Según Harrison, Capítulo X..." o "De acuerdo con la NTS N° XXX del MINSA...").
    2.  **RAG (Recuperación) y Referencias:** 
        * **Si hay Guías/Normas en contexto:** "Según la Norma Técnica [Nombre]: ..." y cita la regla.
        * **Si hay Videos/Webs en contexto:** "Te recomiendo complementar con: [Título](URL)."
        * **Si hay contexto RAG médico:** Fundamenta tu explicación en los fragmentos provistos. Estos provienen de libros de texto verificados (Harrison, Washington, Nelson, CTO, AMIR) y normas oficiales (NTS, RM, Leyes) cargados en la plataforma.
    3.  **Si NO hay recursos en BD:** Explica el concepto general médicamente e invita a buscar en repositorios oficiales o a practicar en el "Quiz Arena".

    B) AL RESPONDER SOBRE ESTRUCTURA (CARRERAS/CURSOS):
    Si el usuario pregunta "¿Qué carreras hay?" o "¿Qué cursos tiene Medicina?", revisa el contexto inyectado "[ESTRUCTURA...]".
    1.  **Listado Claro:** Presenta la información con viñetas o listas numeradas para que sea fácil de leer (usa formato * [course:ID] Nombre).
    2.  **No inventes:** Solo menciona lo que el sistema te ha mostrado en el contexto.

    D) LÍMITE DE RECURSOS (OPTIMIZACIÓN):
    *   Si el contexto te da muchos recursos, **LISTA MÁXIMO 3 a 5**.
    *   Si hay más, añade una línea final: "Y [X] recursos más disponibles en el Centro de Referencia."

    E) SUGERENCIAS ACTIVAS (OBLIGATORIO):
    Al final de TU RESPUESTA, genera siempre 3 preguntas cortas que el usuario podría hacer a continuación para profundizar.
    *   Deben ser INTUITIVAS y naturales ligadas al caso u objetivos (ej. "Ver dosis pediátrica", "¿Cuál es el tratamiento de primera línea?", "Ir a Flashcards de este tema").

    IMPORTANTE: Tu respuesta debe ser siempre un objeto JSON válido con esta estructura:
    {
      "intencion": "clasificación_de_la_intención",
      "respuesta": "Tu respuesta completa aquí en Markdown...",
      "sugerencias": ["Pregunta 1", "Pregunta 2", "Pregunta 3"]
    }
    `
    }]
};



const model = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.3, // ✅ Reducido para ser más preciso como bibliotecario
        topP: 0.8,
    },
    tools: [{
        functionDeclarations: [{
            name: "getCourseDetails",
            description: "Obtiene información detallada sobre un curso. Úsalo para buscar materiales, horarios o docentes.",
            parameters: {
                type: "OBJECT",
                properties: {
                    courseName: { type: "STRING", description: "Nombre del curso (ej. 'Programación')." }
                },
                required: ["courseName"]
            }
        },
        {
            name: "getCareerDetails",
            description: "Obtiene detalles sobre una carrera.",
            parameters: {
                type: "OBJECT",
                properties: {
                    careerName: { type: "STRING", description: "Nombre de la carrera." }
                },
                required: ["careerName"]
            }
        },
        {
            name: "listAllCareers",
            description: "Lista todas las carreras disponibles.",
            parameters: { type: "OBJECT", properties: {} }
        },
        {
            name: "getCoursesForCareer",
            description: "Lista cursos de una carrera.",
            parameters: {
                type: "OBJECT",
                properties: {
                    careerName: { type: "STRING", description: "Nombre de la carrera." }
                },
                required: ["careerName"]
            }
        },
        {
            name: "getInstructorInfo",
            description: "Obtiene información sobre un docente y los cursos que enseña. Úsalo cuando pregunten por un profesor o docente específico.",
            parameters: {
                type: "OBJECT",
                properties: {
                    instructorName: { type: "STRING", description: "Nombre del docente/profesor." }
                },
                required: ["instructorName"]
            }
        },
        {
            name: "listAllInstructors",
            description: "Lista todos los docentes/profesores disponibles.",
            parameters: { type: "OBJECT", properties: {} }
        }]
    }],
    systemInstruction: systemInstruction
});
console.log('🤖 MLService: Modelo configurado (Singleton): gemini-2.5-flash');

class MLService {
    /**
     * Procesa un mensaje de usuario usando un Modelo de Lenguaje Grande (LLM).
     */
    static async classifyIntent(message, conversationHistory, dependencies) {
        console.log(`🤖 MLService: Generando respuesta con LLM para: ${message}`);

        // Usar los repositorios pasados como argumentos.
        const { knowledgeBaseRepo, courseRepo, careerRepo, knowledgeBaseSet, userTier } = dependencies;

        // 🚀 OPTIMIZACIÓN: Pre-fetching de datos (RAG-lite)
        let contextInjection = "";
        try {
            // 1. Buscar coincidencias directas de libros (Metadata Search - MEJORADO 🧠)
            const allBooks = await knowledgeBaseRepo.bookRepo.findAll();
            const normalizedMsg = normalizeText(message);

            // Lista de palabras comunes a ignorar para enfocarnos en lo importante
            const stopWords = [
                'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'y', 'o', 'en', 'con', 'por', 'para',
                'citame', 'citar', 'cita', 'dame', 'quiero', 'libro', 'libros', 'texto', 'textos',
                'busco', 'necesito', 'tienes', 'formato', 'apa', 'vancouver', 'iso', 'edicion'
            ];

            // Extraemos las palabras clave (tokens) del mensaje del usuario
            const msgTokens = normalizedMsg.split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.includes(w)); // Solo palabras > 2 letras y que no sean stopWords

            const matchedBooks = allBooks.filter(b => {
                const normTitle = normalizeText(b.title);
                const normAuthor = b.author ? normalizeText(b.author) : '';

                // A. Coincidencia Exacta (Como antes, por si acaso)
                if (normTitle.includes(normalizedMsg)) return true;

                // B. Coincidencia Inteligente por Palabras Clave
                if (msgTokens.length > 0) {
                    // Si el usuario dijo "Gray", buscamos si "Gray" está en el título o autor
                    // Usamos 'every' para ser estrictos (todas las keywords deben estar) 
                    // o 'some' para ser flexibles. 'some' es mejor para chats.
                    return msgTokens.some(token => normTitle.includes(token) || normAuthor.includes(token));
                }
                return false;
            });

            if (matchedBooks.length > 0) {
                // Limitamos a 3 resultados para optimizar tokens (antes 5)
                const topMatches = matchedBooks.slice(0, 3);

                contextInjection += `\n[BIBLIOTECA: RECURSOS ENCONTRADOS]\n` +
                    topMatches.map(b =>
                        `* Título: "${b.title}"
                           Autor: ${b.author || 'Anónimo'}
                           URL: ${b.url}`
                    ).join('\n---\n') +
                    `\n[FIN RECURSOS]\n`;
                console.log(`🚀 Pre-fetching Inteligente: ${topMatches.length} recursos inyectados (Keywords: ${msgTokens.join(', ')}).`);
            }

            // 2. Buscar por TEMA (usando la lógica existente de entidades)
            const entities = knowledgeBaseRepo.findEntitiesInText(message);

            if (entities.topics.length > 0) {
                const topicName = entities.topics[0];
                const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                const topic = allTopics.find(t => normalizeText(t.name).includes(normalizeText(topicName)));

                if (topic) {
                    const topicBooks = allBooks.filter(b => (topic.bookIds || []).includes(b.id));

                    // ✅ OPTIMIZACIÓN: Límite de 3 recursos + "Ver más"
                    const limitedBooks = topicBooks.slice(0, 3);
                    const remaining = topicBooks.length - limitedBooks.length;

                    contextInjection += `\n[BIBLIOTECA: RECURSOS DEL TEMA "${topic.name}"]\n` +
                        `Descripción: ${topic.description || "No disponible"}\n` +
                        `Libros relacionados (${limitedBooks.length} de ${topicBooks.length} mostrados):\n` +
                        limitedBooks.map(b =>
                            `* Título: "${b.title}" | Autor: ${b.author} | URL: ${b.url}`
                        ).join('\n') +
                        (remaining > 0 ? `\n... y ${remaining} recursos más disponibles en la biblioteca.` : '') +
                        `\n[Enlace para ver todos: /?q=${encodeURIComponent(topic.name)}]` + // Instrucción para el LLM
                        `\n[FIN RECURSOS TEMA]\n`;
                }
            }

            // 3. Buscar por CURSO (RAG para cursos mencionados)
            if (entities.courses.length > 0) {
                const courseName = entities.courses[0];
                const allCourses = await courseRepo.findAll();
                const course = allCourses.find(c => normalizeText(c.name).includes(normalizeText(courseName)));

                if (course) {
                    const courseBooks = allBooks.filter(b => (course.materials || []).some(m => m.id === b.id) || (course.bookIds || []).includes(b.id));

                    // ✅ OPTIMIZACIÓN: Límite de 3 recursos + "Ver más"
                    const limitedBooks = courseBooks.slice(0, 3);
                    const remaining = courseBooks.length - limitedBooks.length;

                    contextInjection += `\n[BIBLIOTECA: CURSO "${course.name}"]\n` +
                        `Descripción: ${course.description || "No disponible"}\n` +
                        `Bibliografía (${limitedBooks.length} de ${courseBooks.length} mostrados):\n` +
                        limitedBooks.map(b =>
                            `* Título: "${b.title}" | Autor: ${b.author} | URL: ${b.url}`
                        ).join('\n') +
                        (remaining > 0 ? `\n... y ${remaining} libros más.` : '') +
                        `\n[Enlace para ver todos: /?q=${encodeURIComponent(course.name)}]` +
                        `\n[FIN INFO CURSO]\n`;
                }
            }

            // 4. Buscar por CARRERA
            if (entities.careers.length > 0) {
                const careerName = entities.careers[0];
                const allCareers = await careerRepo.findAll();
                const career = allCareers.find(c => normalizeText(c.name).includes(normalizeText(careerName)));

                if (career) {
                    contextInjection += `\n[ESTRUCTURA: INFORMACIÓN DE LA CARRERA "${career.name}"]\n` +
                        `Descripción: ${career.description || "No disponible"}\n` +
                        `ID para enlace: ${career.id}\n` +
                        `\n[FIN INFORMACIÓN CARRERA]\n`;
                    console.log(`🚀 Pre-fetching: Datos de la carrera "${career.name}" inyectados.`);
                }
            }

        } catch (e) {
            console.warn("⚠️ Error en pre-fetching (continuando sin contexto extra):", e);
        }

        // 📚 RAG VECTORIAL: Búsqueda semántica en documentos médicos vectorizados
        // (Harrison, NTS, RM, Leyes, CTO, AMIR, Washington, etc.)
        const isAdvanced = userTier === 'advanced' || userTier === 'elite' || userTier === 'admin';
        let usedRAG = false;

        if (isAdvanced && !dependencies.disableRAG) {
            try {
                const RagService = require('./ragService');
                const ragResults = await RagService.searchContext(message, 4);
                if (ragResults && ragResults.trim().length > 0) {
                    contextInjection += `\n[CONTEXTO MÉDICO RAG - DOCUMENTOS VERIFICADOS]\n${ragResults}\n[FIN CONTEXTO RAG]\n`;
                    console.log(`📚 RAG Chat: Inyectados ${ragResults.length} caracteres de contexto médico vectorial.`);
                    usedRAG = true; // Flag Activa para cobrar Token Pesado al usuario
                }
            } catch (ragError) {
                console.warn("⚠️ RAG vectorial no disponible para Chat (continuando sin él):", ragError.message);
            }
        } else {
            if (dependencies.disableRAG) {
                console.log(`🚫 RAG Vectorial Omitido: Usuario Nivel '${userTier}' excedió la cuota mensual de Thinking/RAG.`);
            } else {
                console.log(`🚫 RAG Vectorial Bloqueado: Usuario nivel '${userTier}' no tiene acceso a RAG.`);
            }
        }

        try {
            // El modelo ya está inicializado arriba.

            const historyForAPI = conversationHistory.map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({ history: historyForAPI });

            // Si hay contexto pre-cargado, lo adjuntamos al mensaje del usuario de forma invisible para él.
            const finalMessage = contextInjection ? `${contextInjection}\n\nUsuario: ${message}` : message;

            let result = await chat.sendMessage(finalMessage);

            let response = result.response;
            while (response.candidates[0].content.parts[0].functionCall) {
                const call = response.candidates[0].content.parts[0].functionCall;
                console.log(`🛠️ Gemini solicitó la herramienta: ${call.name}`);

                if (call.name === 'getCourseDetails') {
                    // ✅ SOLUCIÓN: Búsqueda flexible para cursos
                    const allCourses = await courseRepo.findAll();
                    const normalizedQuery = normalizeText(call.args.courseName);
                    // Buscar coincidencia parcial
                    const course = allCourses.find(c => normalizeText(c.name).includes(normalizedQuery));

                    let courseDetailsResponse = null;

                    if (course) {
                        // ✅ MEJORA: Enriquecer la respuesta
                        const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                        const allBooks = await knowledgeBaseRepo.bookRepo.findAll();
                        // ✅ MEJORA CRÍTICA: Enviar ID y Nombre de los temas para que la IA pueda generar enlaces [topic:ID]
                        const topics = (course.topicIds || []).map(id => {
                            const t = allTopics.find(topic => topic.id === id);
                            return t ? { id: t.id, name: t.name } : null;
                        }).filter(Boolean);

                        const books = (course.bookIds || []).map(id => allBooks.find(b => b.id === id)).filter(b => b && b.title && b.url);

                        // Legacy 'sections' logic removed as per cleanup task.

                        courseDetailsResponse = {
                            ...course,
                            topics,
                            books
                        };
                        console.log('🔍 Resultado (getCourseDetails): Encontrado:', course.name);
                    } else {
                        console.log(`⚠️ No se encontró curso para "${call.args.courseName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCourseDetails',
                            response: courseDetailsResponse || { error: "Curso no encontrado" }
                        }
                    }]);
                    response = result.response;


                } else if (call.name === 'getCareerDetails') {
                    // ✅ SOLUCIÓN: Búsqueda de carrera (faltaba la lógica completa)
                    const allCareers = await careerRepo.findAll();
                    const normalizedQuery = normalizeText(call.args.careerName);
                    const career = allCareers.find(c => normalizeText(c.name).includes(normalizedQuery));

                    let careerDetailsResponse = null;

                    if (career) {
                        // Obtener los cursos de esta carrera
                        // ✅ CORRECCIÓN: Usar 'findByCareerCategory' que sí existe en el repositorio
                        const courses = await courseRepo.findByCareerCategory(career.name);
                        const courseList = courses.map(c => ({ id: c.id, name: c.name }));

                        careerDetailsResponse = {
                            id: career.id,
                            name: career.name,
                            description: career.description || 'No disponible',
                            courses: courseList
                        };
                        console.log('🔍 Resultado (getCareerDetails): Encontrado:', career.name, 'con', courseList.length, 'cursos.');
                    } else {
                        console.log(`⚠️ No se encontró carrera para "${call.args.careerName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCareerDetails',
                            response: careerDetailsResponse || { error: "Carrera no encontrada" }
                        }
                    }]);
                    response = result.response;


                } else if (call.name === 'listAllCareers') {
                    const allCareers = await careerRepo.findAll();
                    const careerList = allCareers.map(c => ({ id: c.id, name: c.name }));

                    console.log('🔍 Resultado de la herramienta (listar carreras):', careerList.length, 'carreras encontradas.');

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'listAllCareers',
                            response: { careers: careerList }
                        }
                    }]);
                    response = result.response;

                } else if (call.name === 'getCoursesForCareer') {
                    // ✅ CORRECCIÓN: Usar 'findByCareerCategory'
                    const courses = await courseRepo.findByCareerCategory(call.args.careerName);
                    console.log(`🔍 Resultado de la herramienta (cursos por carrera): ${courses.length} cursos encontrados.`);

                    // Devolvemos solo id y nombre para ser concisos
                    const courseList = courses.map(c => ({ id: c.id, name: c.name })); // ✅ CORRECCIÓN: Usar el 'id' numérico

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCoursesForCareer',
                            response: { courses: courseList }
                        }
                    }]);
                    response = result.response;

                } else {
                    console.warn(`⚠️ Herramienta solicitada no encontrada o eliminada: ${call.name}`);
                    // Fallback seguro: responder que la herramienta no está disponible
                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: call.name,
                            response: { error: "Herramienta no disponible o en mantenimiento." }
                        }
                    }]);
                    response = result.response;
                }
            }

            // Procesar la respuesta final de Gemini.
            const responseText = response.candidates[0].content.parts[0].text;
            let parsedResult;

            try {
                // ✅ MEJORA: Extracción robusta de JSON
                let jsonString = responseText;

                // 1. Intentar extraer de bloque de código markdown (con o sin etiqueta 'json')
                const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonString = codeBlockMatch[1];
                } else {
                    // 2. Búsqueda manual del objeto JSON
                    const jsonStartIndex = responseText.search(/\{\s*"intencion"/);
                    const jsonEndIndex = responseText.lastIndexOf('}');

                    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                        jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
                    }
                }

                // 3. Limpieza preventiva de caracteres problemáticos
                // Reemplazar saltos de línea reales por \n si existen (error común de LLMs)
                // jsonString = jsonString.replace(/\n/g, "\\n"); // Cuidado: esto puede romper el JSON si ya está bien formateado.
                // Mejor confiamos en el prompt reforzado.

                parsedResult = JSON.parse(jsonString);
            } catch (jsonError) {
                console.warn(`⚠️ Error al parsear JSON del LLM: ${jsonError.message}`);
                console.warn(`Texto recibido: ${responseText}`);

                // Fallback Robusto: Extracción manual por Regex
                // Si el JSON es inválido (ej. saltos de línea sin escapar), intentamos rescatar los campos.
                try {
                    const intencionMatch = responseText.match(/"intencion":\s*"([^"]+)"/);
                    const respuestaMatch = responseText.match(/"respuesta":\s*"((?:[^"\\]|\\.)*)"/);
                    const sugerenciasMatch = responseText.match(/"sugerencias":\s*\[(.*?)\]/s);

                    if (respuestaMatch) {
                        let cleanRespuesta = respuestaMatch[1];
                        // Convertir literal \n a salto de línea real
                        cleanRespuesta = cleanRespuesta.replace(/\\n/g, '\n');
                        // Des-escapar comillas dobles \" -> "
                        cleanRespuesta = cleanRespuesta.replace(/\\"/g, '"');

                        let cleanSugerencias = [];
                        if (sugerenciasMatch) {
                            // Extraer strings del array de sugerencias
                            const suggestionsRaw = sugerenciasMatch[1];
                            const suggestionRegex = /"([^"]+)"/g;
                            let match;
                            while ((match = suggestionRegex.exec(suggestionsRaw)) !== null) {
                                cleanSugerencias.push(match[1]);
                            }
                        }

                        parsedResult = {
                            intencion: intencionMatch ? intencionMatch[1] : 'respuesta_directa',
                            confianza: 0.8, // Confianza media por ser fallback
                            respuesta: cleanRespuesta,
                            sugerencias: cleanSugerencias
                        };
                        console.log("✅ Fallback: Respuesta recuperada exitosamente vía Regex.");
                    } else {
                        throw new Error("No se pudo extraer la respuesta con Regex.");
                    }
                } catch (fallbackError) {
                    console.error("❌ Fallback falló:", fallbackError);
                    // Último recurso: devolver todo el texto plano
                    parsedResult = {
                        intencion: 'respuesta_directa',
                        confianza: 0.5,
                        respuesta: responseText,
                        sugerencias: []
                    };
                }
            }

            parsedResult = this._validateResponseWithLocalKB(parsedResult, knowledgeBaseSet);
            parsedResult.usedRAG = usedRAG;
            return parsedResult;

        } catch (error) {
            console.error('❌ Error en MLService al contactar al LLM:', error);
            return {
                intencion: 'error_general',
                confianza: 1.0,
                respuesta: 'Lo siento, estoy teniendo problemas para conectarme con mi cerebro de IA en este momento. Por favor, intenta de nuevo en unos instantes.',
                usedRAG: false
            };
        }
    }

    /**
     * Valida la respuesta de la IA.
     * @private
     */
    static _validateResponseWithLocalKB(llmResponse, knowledgeBaseSet) {
        // ✅ SOLUCIÓN: Se ha desactivado la validación estricta de texto entre comillas.
        // La lógica anterior marcaba como "alucinación" cualquier concepto entre comillas (ej. "tasa de cambio")
        // que no fuera una entidad de la BD, lo cual bloqueaba explicaciones válidas.
        // Ahora confiamos en que el Prompt Engineering y el uso de herramientas evitan alucinaciones graves.

        // TODO: En el futuro, se podría implementar una validación específica para los IDs de los enlaces [type:id]
        // para asegurar que no lleven a páginas 404.

        return llmResponse;
    }

    /**
     * Obtiene recomendaciones de cursos y temas relacionados.
     */
    static async getRecommendations(query, directResultsIds = []) {
        // ✅ RECOMMENDATIONS DISABLED (Python Service Removed)
        // La lógica de recomendaciones ahora se maneja en el flujo principal o RAG.
        return { relatedCourses: [], relatedTopics: [] };
    }


    /**
     * Genera una descripción concisa y académica para un curso específico.
     */
    static async generateCourseDescription(courseName) {
        console.log(`🤖 MLService: Generando descripción para el curso: "${courseName}"`);
        try {
            // ✅ 4. Esta es la sintaxis correcta para 'generateContent' en Vertex
            const model = vertex_ai.preview.getGenerativeModel({
                model: 'gemini-2.5-flash'
            });

            const prompt = `Como un experto académico y redactor de planes de estudio, crea una descripción atractiva y concisa (aproximadamente 3 a 4 frases) para el curso universitario llamado "${courseName}". La descripción debe explicar de qué trata el curso, sus objetivos principales y qué aprenderán los estudiantes. El tono debe ser profesional pero accesible.`;

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
            const response = result.response;
            const description = response.candidates[0].content.parts[0].text;

            if (!description) {
                throw new Error("La respuesta de la IA estaba vacía.");
            }
            console.log(`✅ Descripción de curso generada para "${courseName}"`);
            return description;
        } catch (error) {
            console.error(`❌ Error en MLService al generar descripción para el curso "${courseName}":`, error);
            return "No se pudo generar una descripción en este momento. Inténtalo de nuevo más tarde.";
        }
    }



    /**
     * ✅ NUEVO: Generador RAG de Preguntas para el Banco (Admin)
    /**
     * Motor RAG con prevencion de duplicados
     */
    static async generateRAGQuestions(target, difficulty, domain, career) {
        console.log(`🤖 MLService: Iniciando Generación RAG Administrativa -> Target: ${target}, Diff: ${difficulty}, Domain: ${domain}`);
        try {
            const RagService = require('./ragService');
            // 0. Prevenir Duplicidad Escaneando la Base de Datos Histórica
            let recentQuestionsText = "";
            let careerParam = career || null;
            try {
                const db = require('../../infrastructure/database/db'); // Carga dinámica del Pool
                // Extraer el historial más reciente según el grupo
                const recentQ = await db.query(`
                    SELECT topic, question_text 
                    FROM question_bank 
                    WHERE target = $1 
                      AND domain = $2 
                      AND (career = $3 OR $3 IS NULL)
                    ORDER BY created_at DESC 
                    LIMIT 200
                `, [target, domain, careerParam]);

                if (recentQ.rows.length > 0) {
                    recentQuestionsText = "\\n🚨 RESTRICCIÓN ESTRICTA DE DUPLICIDAD 🚨\\nAquí tienes las últimas preguntas que YA existen en el sistema. ESTÁ TOTALMENTE PROHIBIDO CREAR PREGUNTAS IDÉNTICAS A ESTAS O EVALUAR EL MISMO DATO EXACTO:\\n" +
                        recentQ.rows.map((r, idx) => `[Bloqueada ${idx + 1}] Tema: ${r.topic} | Muestra: "${r.question_text.substring(0, 150)}..."`).join('\\n') + "\\n(Obligatorio: Inventa casos clínicos completamente nuevos o evalúa otras clasificaciones/tratamientos de estos escenarios).\\n";
                }
            } catch (e) {
                console.warn("⚠️ No se pudo obtener el historial anti-duplicidad en RAG:", e);
            }

            // 1. Extraer contexto (mayor densidad para abarcar libros y normas) de la BD nativa
            // Modificamos el query RAG para que fuerce la búsqueda en normas, libros y guías
            const queryVectorial = `Conceptos médicos, guías clínicas, normas técnicas, leyes y preguntas de ${domain} para ${target} dificultad ${difficulty}`;
            const ragContext = await RagService.searchContext(queryVectorial, 12); // Subimos de 5 a 12 fragmentos para obtener más variedad

            // 2. Instanciar Gemini forzando salida JSON y subiendo la temperatura para mayor variedad
            const jsonModel = vertex_ai.preview.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.7, // 0.7 para asegurar alta variedad y evitar duplicados genéricos
                    responseMimeType: "application/json" // Fuerza salida JSON estricta
                }
            });

            // 2.5. Definir reglas específicas del target y la dificultad
            let targetRules = "";
            if (target === "ENAM") {
                targetRules = "Enfoque: 'El Médico de Posta' para su SERUMS. Clínica general, fisiopatología, diagnóstico clásico. Debe incluir Normas Técnicas (NTS) básicas de Salud Pública (Vacunas, TB, Materno-Perinatal, MAIS-BFC) y Certificado de Defunción. OBLIGATORIO: Generar 4 opciones.";
            } else if (target === "SERUMS") {
                targetRules = "Enfoque: Evaluación SERUMS (ENCAPS Minsa). Enfoque holístico para profesionales de la salud (Medicina Humana, Enfermería, Obstetricia). Priorizar Seguridad del Paciente, Medicina Preventiva, Categorización de establecimientos (I-1 al III-2), triaje comunitario, y ciencias básicas aplicadas a la salud pública. OBLIGATORIO: Generar 4 opciones.";
            } else if (target === "RESIDENTADO") {
                targetRules = "Enfoque: 'El Médico Científico/Gerente'. Especialidad avanzada: diagnóstico diferencial exhaustivo, Gold Standard, tratamiento de 2da/3ra línea. Investigación: RR, OR, sesgos. Gestión: Ishikawa, FODA. 90% DEBEN SER CASOS CLÍNICOS. OBLIGATORIO: Generar 5 opciones.";
            }

            let diffRules = "";
            if (difficulty === "Básico") {
                diffRules = "Evalúa memoria pura: etiologías, definiciones, mecanismos. Ejemplo: '¿Cuál es el agente causal de la sífilis?'";
            } else if (difficulty === "Intermedio") {
                diffRules = "Evalúa análisis clínico: viñetas diagnósticas. Ejemplo: 'Caso con fiebre + manchas → pedir diagnóstico'.";
            } else if (difficulty === "Avanzado") {
                diffRules = "Evalúa toma de decisiones: manejo terapéutico, excepciones. Ejemplo: 'Tratamiento alternativo en alérgico a 1ra línea'.";
            }

            // 3. System Prompt Reforzado
            const prompt = `
            Eres un experto catedrático creador de exámenes profesionales de altísimo nivel para Perú. Genera exactamente 20 preguntas de opción múltiple INÉDITAS, variadas y sumamente creativas.
            
            - Examen Objetivo: ${target} -> PERFIL DEL EXAMEN: ${targetRules}
            - Carrera o Profesión: ${career ? career : 'Aplica a todas las ramas'} (De ser especificada, orienta el léxico y los problemas al campo de acción de esta carrera).
            - Nivel de Dificultad: ${difficulty} -> EXIGENCIA COGNITIVA: ${diffRules}
            - Áreas/Especialidades Seleccionadas: ${domain} (Distribuye las 20 preguntas equilibradamente entre estas áreas, mezclando temas transversales si es posible).

            INSTRUCCIONES CRÍTICAS SOBRE EL CONTEXTO:
            - Abajo recibirás fragmentos mixtos de la BD Documental. Estos incluyen: Exámenes Pasados, Libros Base (Harrison, Washington), Manuales de Resumen (CTO, AMIR), Normas Técnicas del MINSA, Guías de Práctica Clínica y Leyes Peruanas en Salud.
            - DEBES extraer la información clínica de estos fragmentos para redactar las preguntas.
            - REQUISITO ANTI-DUPLICACIÓN: Crea casos clínicos únicos, cruza variables de edad, sexo y sintomatología clínica. Evita a toda costa preguntas genéricas (ej. "¿Cuál es la causa más frecuente de X?"). Elabora preguntas de nicho para garantizar que no existan duplicados en nuestra base de datos.
            - REQUISITO TRAMPAS EXÁMENES (DISTRACTORES): Las opciones incorrectas DEBEN ser sumamente plausibles (distractores y trampas comunes). No hagas que la respuesta correcta sea evidente pónsela muy difícil. El médico evaluado debe dudar y afilar su análisis. La explicación obligatoriamente debe detallar la respuesta correcta y por qué la trampa aparente es falsa.
            ${recentQuestionsText}
            CONTEXTO OFICIAL RECUPERADO DE LA BD RAG:
            ${ragContext || "No hay contexto alojado. Usa conocimiento médico general oficial del Perú (MINSA/EsSalud)."}

            REGLAS ESTRICTAS DEL JSON:
            Devuelve un ARRAY DE OBJETOS JSON puros. NO incluyas markdown, solo el array [ {...}, {...} ].
            Estructura EXACTA de cada objeto:
            {
              "question_text": "Texto completo del caso clínico o pregunta.",
              "options": ["Opción A", "Opción B", "Opción C", "Opción D"], // Genera 4 o 5 opciones dependiendo del PERFIL DEL EXAMEN (Target).
              "correct_option_index": 0, // Índice de la respuesta correcta (obliga que sea de 0 a (N-1) )
              "explanation": "Explicación académica fundamentada en libros o normas técnicas.",
              "domain": "ESPECIFICAR_EL_AREA_USADA_AQUI", // (Ej. Pediatría, o Cirugía General, debe pertenecer a las áreas solicitadas)
              "target": "${target}",
              "career": "${career ? career : ""}", // Obligatorio incluir la carrera (o cadena vacía si no aplica)
              "topic": "Nombre del tema o subtema específico (Ej. Preeclampsia, Asma)",
              "difficulty": "${difficulty}",
              "image_url": ""
            }
            `;

            const result = await jsonModel.generateContent(prompt);
            const responseText = result.response.candidates[0].content.parts[0].text;

            const questions = JSON.parse(responseText);
            console.log(`✅ MLService: Lote RAG generado con éxito (${questions.length} preguntas)`);
            return questions;

        } catch (error) {
            console.error('❌ Error crítico en Generación RAG Administrativa:', error);
            throw error;
        }
    }

    static async trainModel() {
        console.warn('⚠️ El entrenamiento del modelo local ya no es necesario con la nueva arquitectura LLM.');
        return Promise.resolve({
            success: true,
            message: 'El entrenamiento del modelo local está obsoleto. El sistema ahora usa un LLM externo.'
        });
    }
}

module.exports = MLService;