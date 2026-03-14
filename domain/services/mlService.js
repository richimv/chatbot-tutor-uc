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
    1.  **Explicación Basada en Evidencia:** Responde con claridad médica. SIEMPRE prioriza tu conocimiento interno de las Normas Técnicas, Guías de Práctica Clínica (GPC) y libros de referencia (Harrison, Washington, Nelson, CTO, AMIR).
    2.  **Referencias:** 
        * **Si mencionas Guías/Normas:** "Según la Norma Técnica [Nombre]: ..." y cita la regla.
        * **Fuentes Oficiales:** Fundamenta tu explicación en los libros de texto médicos verificados y normas oficiales peruanas (NTS, RM, Leyes) que forman parte de tu base de conocimiento experto.
    3.  **Uso de Conocimiento General:** Si el contexto provisto (RAG) no contiene la respuesta exacta a preguntas específicas (ej. plazos normativos, tiempos, o dosis exactas), **DEBES usar tu conocimiento experto pre-entrenado general** para dar la respuesta correcta. BAJO NINGUNA CIRCUNSTANCIA respondas "no está en mi base de conocimientos" o "el contexto proporcionado no lo menciona". Eres un médico experto y debes suplir cualquier deficiencia de los documentos con tu propio conocimiento médico.

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
    thinking: { disable: true },
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

            // 5. BÚSQUEDA RAG LOCAL INTELIGENTE (Cero Costo - Palabras Clave)
            const RagService = require('./ragService');
            const disableRAG = dependencies.disableRAG || false; // ✅ Verificamos si el RAG está bloqueado para este tier

            // --- INICIO ROUTER CLÍNICO-NORMATIVO ---
            // Le damos inteligencia al RAG leyendo la intención de la pregunta antes de buscar
            let targetFocus = '';

            if (!disableRAG) { // ✅ Solo ejecutamos la lógica de búsqueda si NO está deshabilitado
                const msgLower = normalizedMsg; // variable local previamente normalizada

                // Regla A: Intención Operativa, Legal, o Procedimental (Prioridad SERUMS - NTS/Leyes)
                if (/(deberia|hacer|enfermera|procedimiento|norma|ley|legal|minsa|essalud|protocolo|manejo inicial|notificar|notificacion|referir|serums|plazo|tiempo|cuando)/i.test(msgLower)) {
                    targetFocus = 'SERUMS';
                }
                // Regla B: Intención Puramente Clínica, Diagnóstica o Especialidad (Prioridad RESIDENTADO - Harrison/Washington)
                else if (/(fisioterapia|fisiopatologia|mecanismo|dosis|tratamiento de eleccion|gold standard|diagnostico diferencial|receptor|enzima|gen|mutacion|residentado)/i.test(msgLower)) {
                    targetFocus = 'RESIDENTADO';
                }

                console.log(`🧠 Router RAG Detectó Intención: ${targetFocus || 'GENERAL/MIXTO'} para la pregunta`);
                // --- FIN ROUTER ---

                // Pedimos 3 fragmentos (antes 4) para ahorrar tokens y enfocar calidad, pasando el enfoque ideal.
                const localContext = await RagService.searchContext(message, 3, { target: targetFocus });
                if (localContext) {
                    contextInjection += `\n[CONTEXTO MÉDICO RAG LOCAL - DOCUMENTOS VERIFICADOS]\n${localContext}\n[FIN CONTEXTO RAG]\n`;
                    console.log(`🚀 RAG Local (${targetFocus || 'GENERAL'}): Fragmentos inyectados exitosamente.`);
                }
            } else {
                console.log(`⚠️ RAG Local saltado por configuración (disableRAG: true)`);
            }

        } catch (e) {
            console.warn("⚠️ Error en pre-fetching/RAG Local (continuando sin contexto extra):", e);
        }

        const usedRAG = contextInjection.includes('RAG LOCAL');
        console.log(`🤖 MLService: RAG Local Status: ${usedRAG ? 'ACTIVO' : 'INACTIVO'}`);

        try {
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
                    const courses = await courseRepo.findByCareerCategory(call.args.careerName);
                    console.log(`🔍 Resultado de la herramienta (cursos por carrera): ${courses.length} cursos encontrados.`);

                    // Devolvemos solo id y nombre para ser concisos
                    const courseList = courses.map(c => ({ id: c.id, name: c.name }));

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCoursesForCareer',
                            response: { courses: courseList }
                        }
                    }]);
                    response = result.response;

                } else {
                    console.warn(`⚠️ Herramienta solicitada no encontrada o eliminada: ${call.name}`);
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

                const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonString = codeBlockMatch[1];
                } else {
                    const jsonStartIndex = responseText.search(/\{\s*"intencion"/);
                    const jsonEndIndex = responseText.lastIndexOf('}');

                    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                        jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
                    }
                }

                parsedResult = JSON.parse(jsonString);
            } catch (jsonError) {
                console.warn(`⚠️ Error al parsear JSON del LLM: ${jsonError.message}`);
                console.warn(`Texto recibido: ${responseText}`);

                try {
                    const intencionMatch = responseText.match(/"intencion":\s*"([^"]+)"/);
                    const respuestaMatch = responseText.match(/"respuesta":\s*"((?:[^"\\]|\\.)*)"/);
                    const sugerenciasMatch = responseText.match(/"sugerencias":\s*\[(.*?)\]/s);

                    if (respuestaMatch) {
                        let cleanRespuesta = respuestaMatch[1];
                        cleanRespuesta = cleanRespuesta.replace(/\\n/g, '\n');
                        cleanRespuesta = cleanRespuesta.replace(/\\"/g, '"');

                        let cleanSugerencias = [];
                        if (sugerenciasMatch) {
                            const suggestionsRaw = sugerenciasMatch[1];
                            const suggestionRegex = /"([^"]+)"/g;
                            let match;
                            while ((match = suggestionRegex.exec(suggestionsRaw)) !== null) {
                                cleanSugerencias.push(match[1]);
                            }
                        }

                        parsedResult = {
                            intencion: intencionMatch ? intencionMatch[1] : 'respuesta_directa',
                            confianza: 0.8,
                            respuesta: cleanRespuesta,
                            sugerencias: cleanSugerencias
                        };
                        console.log("✅ Fallback: Respuesta recuperada exitosamente vía Regex.");
                    } else {
                        throw new Error("No se pudo extraer la respuesta con Regex.");
                    }
                } catch (fallbackError) {
                    console.error("❌ Fallback falló:", fallbackError);
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
                model: 'gemini-2.5-flash',
                thinking: { disable: true }
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
     * ✅ Orquestador RAG con prevención de duplicados y generación por lotes (Batching)
     * Genera un total de 10 preguntas fragmentadas en lotes pequeños (3, 3, 3, 1) para evitar truncamiento por token limit.
     */
    static async generateRAGQuestions(target, difficulty, studyAreas, career, amount = 10, domain = 'medicine') {
        console.log(`🤖 MLService: RAG Admin -> Target: ${target}, Diff: ${difficulty}, Áreas: ${studyAreas}, Carrera: ${career}, Amount: ${amount}`);
        try {
            const requestedAmount = amount;
            const BATCH_SIZE_BASE = 3;
            const currentBatchLimit = (target === 'RESIDENTADO' || target === 'ENAM') ? 1 : BATCH_SIZE_BASE;

            let allQuestions = [];

            for (let i = 0; i < requestedAmount; i += currentBatchLimit) {
                const currentBatchSize = Math.min(currentBatchLimit, requestedAmount - i);
                const batchNum = Math.floor(i / currentBatchLimit) + 1;
                console.log(`🤖 MLService: Generando lote ${batchNum} (${currentBatchSize} preguntas)...`);

                const batchQuestions = await this._generateBatchInternal(target, difficulty, studyAreas, career, allQuestions, currentBatchSize);

                if (batchQuestions && batchQuestions.length > 0) {
                    allQuestions = allQuestions.concat(batchQuestions);
                }

                if (allQuestions.length >= requestedAmount) break;
            }

            console.log(`✅ MLService: Generación RAG completada (${allQuestions.length} preguntas)`);
            return allQuestions.slice(0, requestedAmount);

        } catch (error) {
            console.error('❌ Error crítico en Generación RAG Orquestada:', error);
            throw error;
        }
    }

    /**
     * @private Lógica de generación atómica para un lote pequeño (Prompt Maestro)
     */
    static async _generateBatchInternal(target, difficulty, studyAreas, career, previousBatchQuestions, amount) {
        try {
            const domain = 'medicine';

            // 1. Prevenir Duplicidad Escaneando la Base de Datos Histórica
            let recentQuestionsText = "";
            let careerParam = career || null;
            try {
                const db = require('../../infrastructure/database/db'); // Carga dinámica del Pool
                const areasArray = String(studyAreas || '').split(',').map(a => a.trim()).filter(a => a);

                // 🎯 REFINAMIENTO: Historial Exacto
                const recentQ = await db.query(`
                    SELECT topic, question_text 
                    FROM question_bank 
                    WHERE target = $1 
                      AND domain = $2 
                      AND (career = $3 OR $3 IS NULL)
                      AND (topic = ANY($4) OR $4 IS NULL)
                      AND difficulty = $5
                    ORDER BY created_at DESC 
                    LIMIT 200
                `, [target, domain, careerParam, areasArray.length > 0 ? areasArray : null, difficulty]);

                const allPreviousTexts = [
                    ...recentQ.rows.map(r => r.topic + ": " + r.question_text),
                    ...previousBatchQuestions.map(q => q.topic + ": " + q.question_text)
                ];

                if (allPreviousTexts.length > 0) {
                    recentQuestionsText = "\n🚨 RESTRICCIÓN ESTRICTA DE DUPLICIDAD 🚨\nAquí tienes las últimas preguntas que YA existen en el sistema para este Target/Área. ESTÁ TOTALMENTE PROHIBIDO CREAR PREGUNTAS IDÉNTICAS A ESTAS O EVALUAR EL MISMO DATO EXACTO:\n" +
                        allPreviousTexts.slice(-20).map((txt, idx) => `[Bloqueada ${idx + 1}] ${txt.substring(0, 150)}...`).join('\n') + "\n(Obligatorio: Inventa casos clínicos completamente nuevos o evalúa otras clasificaciones/tratamientos de estos escenarios).\n";
                }
            } catch (e) {
                console.warn("⚠️ No se pudo obtener el historial anti-duplicidad en RAG:", e);
            }

            // 2. BÚSQUEDA RAG LOCAL (ELIKE - Gratuito)
            const RagService = require('./ragService');
            const ragContext = await RagService.searchContext(studyAreas, 8, { target }); // Pasamos el target para inyectar NTS/RM/GPC
            if (ragContext) {
                console.log(`🚀 RAG Local (Generador): Contexto inyectado para ${studyAreas}`);
            }

            // 3. Instanciar Gemini (1.5 Flash para evitar Thinking Costs)
            const jsonModel = vertex_ai.preview.getGenerativeModel({
                model: 'gemini-2.5-flash',
                thinking: { disable: true },
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            });

            // 4. Definir reglas dinámicas por Target y Dificultad
            let targetRules = "";
            let levelInstruction = "";

            if (target === "ENAM") {
                targetRules = `PERFIL ENAM: Médico General - Enfoque Clínico y Diagnóstico.
                ENFOQUE: Clínica general, diagnóstico diferencial y manejo inicial basado en evidencia.
                JERARQUÍA DE FUENTES (DATA INTERNA): 1. GPC Oficiales (Minsa/EsSalud) > 2. Libros Clínicos (Harrison/Nelson/Williams) > 3. Manuales de Especialidad (AMIR/CTO) > 4. NTS/RM/Leyes.
                REGLA DE ORO: Mínimo 2 fuentes distintas en la explicación.`;
                if (difficulty === "Básico") levelInstruction = "Evalúa MEMORIA DIRECTA (Definiciones, Triadas). Explicación: 2 párrafos.";
                else if (difficulty === "Intermedio") levelInstruction = "Evalúa RAZONAMIENTO CLÍNICO SIMPLE. Explicación: 2 párrafos detallados.";
                else if (difficulty === "Avanzado") levelInstruction = "Evalúa MANEJO INICIAL Y REFERENCIAS. Explicación: 3 párrafos analíticos.";
            } else if (target === "SERUMS") {
                targetRules = `Enfoque: Salud Pública y Gestión Comunitaria (ENCAPS). CONTEXTO: Establecimientos del primer nivel de atención (I-1 al I-4).
                JERARQUÍA DE FUENTES (ESTRICTA):
                1. LEY: NTS y RM (Cadena de Frío, Dengue, VIH, TB/TBC, Malaria, Inmunizaciones (PAI), NTS 169 Adulto Mayor, Cáncer, etc).
                2. OFICIAL: GPC del Minsa (GPC Sepsis obstétrica, GPC Diabetes, GPC ERC, etc). 
                3. SOPORTE: Libros y Manuales (AMIR/CTO/otros) de la data. USARLOS SI EXISTEN EN EL RAG DE CONTEXTO.
                REGLA DE ORO: Mínimo 2 fuentes (NTS + GPC/Manuales).`;
                if (difficulty === "Básico") levelInstruction = "Evalúa DATOS NORMATIVOS (Plazos, Cadenas de frío, Dosis PAI). Explicación: 2 párrafos.";
                else if (difficulty === "Intermedio") levelInstruction = "Evalúa APLICACIÓN DE NORMAS EN COMUNIDAD (I-1 al I-4). Explicación: 2 párrafos detallados.";
                else if (difficulty === "Avanzado") levelInstruction = "Evalúa GESTIÓN DE BROTES Y SITUACIONES LEGALES. Explicación: 3 párrafos profundos.";
            } else if (target === "RESIDENTADO") {
                targetRules = `PERFIL RESIDENTADO (ESPECIALIDAD): ENFOQUE EN LIBROS Y EVIDENCIA CLÍNICA.
                JERARQUÍA ESTRICTA (DATOS INTERNOS): 
                1. LIBROS DE REFERENCIA (Harrison, Washington, Nelson, Williams, etc.) y GPC Clínicas.
                2. MANUALES DE ESPECIALIDAD (AMIR, CTO).
                3. NORMAS (NTS) Y LEYES - Imprescindibles si el tema es Salud Pública, Gestión o Medicina Legal.
                REGLA DE ORO: La fundamentación DEBE priorizar el sustento clínico/fisiopatológico de los LIBROS en temas médicos. Si el contexto RAG interno es insuficiente para cumplir la extensión pedida, ENRIQUECE con fuentes externas oficiales.`;
                if (difficulty === "Básico") levelInstruction = "CIENCIAS BÁSICAS Y FISIOPATOLOGÍA aplicadas a la clínica. Enunciado < 30 palabras. Explicación 2 párrafos.";
                else if (difficulty === "Intermedio") levelInstruction = "CASOS CLÍNICOS de especialidad con enfoque en diagnóstico diferencial. Enunciado < 80 palabras. Explicación 2 párrafos.";
                else if (difficulty === "Avanzado") levelInstruction = "MANEJO TERAPÉUTICO de 2da/3ra línea y complicaciones raras. Enunciado < 120 palabras. Explicación 3 párrafos analíticos.";
            }
            // 5. Prompt Maestro (Preservando todas las reglas complejas)
            const prompt = `
            Eres un experto catedrático médico de alto nivel. Genera EXACTAMENTE ${amount} preguntas INÉDITAS de nivel ${difficulty}.

            🎯 PERFIL DEL EXAMEN: ${targetRules}

            REGLAS DE FORMULACIÓN (MANDATORIO):
            1. FUNDAMENTACIÓN MULTI-FUENTE: Cada explicación DEBE integrar y citar explícitamente al menos DOS (2) fuentes médicas oficiales basándote en tu conocimiento experto, cumpliendo la "Regla de Oro" del perfil.
            2. JERARQUÍA Y CITACIÓN (ESTRICTO): Obedece RIGUROSAMENTE la "JERARQUÍA DE FUENTES" definida arriba en el PERFIL DEL EXAMEN. Puedes enriquecer con información de la OMS/OPS, CDC o UpToDate solo si no contradice la jerarquía principal.
            3. LÍMITES CUANTITATIVOS (CONTROL DE CALIDAD):
               - ENUNCIADO: [Nivel Básico: <30 palabras] | [Nivel Intermedio: <80 palabras] | [Nivel Avanzado: <120 palabras]. PROHIBIDO EXCEDER.
               - EXPLICACIÓN: [Nivel Básico: 2 párrafos] | [Nivel Intermedio: 2 párrafos] | [Nivel Avanzado: 3 párrafos]. NO RECORTAR.
               - SI NO HAY FUENTES INTERNAS: Usa tu conocimiento experto para alcanzar la extensión y profundidad requerida, citando siempre las fuentes oficiales correspondientes.
            4. EQUILIBRIO Y SIMETRÍA: Respuesta correcta y distractores DEBEN tener longitud similar. No des pistas por extensión de texto.
            5. CANTIDAD DE OPCIONES: SERUMS y ENAM = 4 opciones | RESIDENTADO = 5 opciones.
            6. DISTRACTORES: Deben ser plausibles y basados en errores de razonamiento clínico o normativo.
            7. SIN LETRAS: No incluyas letras (A, B, C...) en el array "options".

            - Examen Objetivo: ${target} -> PERFIL DEL EXAMEN: ${targetRules}
            - Áreas de Estudio: ${studyAreas}.
            - DISTRIBUCIÓN OBLIGATORIA: Debes generar exactamente UNA (1) pregunta por cada área listada en "Áreas de Estudio" hasta completar el total de ${amount}. Si hay menos áreas que preguntas, distribúyelas equitativamente (ej: si hay 3 áreas y pido 5 preguntas, haz 2-2-1).
            - Dificultad Target: ${difficulty} (${levelInstruction})
            ${recentQuestionsText}
            
            [DATOS DE APOYO RAG LOCAL - BIBLIOGRAFÍA VERIFICADA]:
            ${ragContext || "No se encontraron fragmentos específicos. Usa tu base de datos experta respetando estrictamente la jerarquía del examen."}

            REGLA DE REDACCIÓN RAG (CRÍTICA):
            1. No inventes datos que contradigan los [DATOS DE APOYO RAG LOCAL].
            2. Si el fragmento menciona un autor o norma específica, ÚSALO para la CITACIÓN en la explicación.
            3. Si no hay fragmentos, usa tu conocimiento pero mantén la jerarquía del perfil.
            4. Evita repetir los temas mencionados en las restricciones de duplicidad.

            REGLAS DEL JSON (DEBE SER UN ARRAY DE OBJETOS):
            [
              {
                "topic": "Usa uno de estos: ${studyAreas}",
                "difficulty": "${difficulty}",
                "question_text": "Texto (según nivel). No pongas códigos de NTS aquí.",
                "options": ${target === 'SERUMS' ? '["Opción1", "Opción2", "Opción3", "Opción4"]' : '["Opción1", "Opción2", "Opción3", "Opción4", "Opción5"]'},
                "correct_option_index": 0,
                "explanation": "Explicación robusta de ${levelInstruction}. SINTETIZA TODAS LAS FUENTES citando explícitamente autores o NTS.",
                "domain": "${domain}",
                "target": "${target}",
                "career": "${(() => {
                    const c = (career || '').toLowerCase();
                    if (c.includes('medicina')) return 'Medicina Humana';
                    if (c.includes('enfermería') || c.includes('enfermeria')) return 'Enfermería';
                    if (c.includes('obstetricia')) return 'Obstetricia';
                    return career || 'Medicina Humana';
                })()}",
                "subtopic": "Subtema clínico específico",
                "image_url": ""
              }
            ]

            REGLAS CRÍTICAS DE CAMPOS:
            - Campo "domain": SIEMPRE "${domain}".
            - Campo "target": SIEMPRE "${target}".
            - Campo "career": SIEMPRE la carrera seleccionada.
            - Campo "topic": El ÁREA DE ESTUDIO (Salud Pública, Gestión, etc.).
            - Campo "subtopic": El SUBTEMA CLÍNICO (ej: CRED, PAI, Triadas).
            `;

            const result = await jsonModel.generateContent(prompt);
            const responseText = result.response.candidates[0].content.parts[0].text;

            let questions = [];

            try {
                questions = JSON.parse(responseText);
            } catch (err) {
                console.warn(`⚠️ Error parseando RAG JSON en lote: ${err.message}`);
                let cleanText = responseText.replace(/[\n\r\t]/g, " ").trim();
                try {
                    questions = JSON.parse(cleanText);
                } catch (err2) {
                    const lastBraceIndex = cleanText.lastIndexOf('}');
                    if (lastBraceIndex !== -1) {
                        let rescuedText = cleanText.substring(0, lastBraceIndex + 1).trim();
                        if (rescuedText.endsWith(',')) rescuedText = rescuedText.slice(0, -1);
                        if (!rescuedText.startsWith('[')) rescuedText = '[' + rescuedText;
                        if (!rescuedText.endsWith(']')) rescuedText += ']';
                        try {
                            questions = JSON.parse(rescuedText);
                            console.log(`✅ Rescate Lote Exitoso: ${questions.length} preguntas.`);
                        } catch (err3) {
                            throw new Error("Lote irrecuperable.");
                        }
                    } else { throw new Error("JSON no encontrado en el lote."); }
                }
            }

            if (!Array.isArray(questions)) questions = [questions];
            console.log(`✅ Lote validado: ${questions.length} preguntas.`);
            return questions;

        } catch (error) {
            console.error('❌ Error en generacion de lote RAG:', error.message);
            return [];
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