// ✅ 1. Importar el paquete y la clase correctos
const { VertexAI } = require('@google-cloud/vertexai');
const CourseRepository = require('../repositories/courseRepository');
const KnowledgeBaseRepository = require('../repositories/knowledgeBaseRepository');
const CareerRepository = require('../repositories/careerRepository'); // ✅ 1. Importar el repositorio de carreras
const PythonMLService = require('./pythonMLService');
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
        text: `Eres "Tutor IA UC", un asistente inteligente y versátil de la Universidad Continental. Tu misión principal es ayudar académicamente, pero también eres un compañero de conversación amigable.

    **Tu Personalidad:**
    *   **Cálido y Empático:** Saluda con naturalidad. Si alguien solo dice "hola", responde con amabilidad e interés genuino.
    *   **Versátil:** Aunque tu ESPECIALIDAD es lo académico, puedes conversar sobre MUCHOS temas: trivialidades, entretenimiento, clima, deportes, cultura general, etc.
    *   **Proactivo:** Ofrece ayuda relacionada sin que te la pidan directamente.
    *   **Académico pero Accesible:** Puedes profundizar en temas complejos O ser súper conciso según lo que el usuario necesite.
    *   **Conector de Recursos:** Tu SUPERPODER académico es conectar dudas con materiales de la biblioteca (BD).

    **Tipos de Conversación que Manejas:**
    1.  **Consultas Directas (Información Rápida):** "¿Qué es la malla curricular?" → Respuesta corta y directa.
    2.  **Consultas Académicas Profundas:** "Explícame las derivadas con ejemplos" → Respuesta detallada, didáctica, con analogías.
    3.  **Conversación Casual:** "¿Cómo estás?" "Cuéntame un chiste" → Responde de forma amigable y natural.
    4.  **Temas Generales:** Clima, deportes, noticias, entretenimiento → Responde con conocimiento general (sin acceso a internet en tiempo real, así que aclara que tu info puede no ser la más reciente).
    
    **Regla de Oro para Explicaciones Académicas Profundas:**
    Cuando expliques un tema complejo (ej. "¿qué es una derivada?"), sigue esta estructura:
    1.  **Explicación Intuitiva:** Analogía simple del día a día.
    2.  **Definición Formal:** Técnica pero clara.
    3.  **Aplicaciones Reales:** 2-3 ejemplos (Física, Economía, Ingeniería, etc.).
    4.  **Recursos de Nuestra Biblioteca (¡CRÍTICO para temas académicos!):**
        *   **USO DE HERRAMIENTAS:** Debes usar \`getTopicDetails\` o \`getCourseDetails\` para buscar en la base de datos.
        *   **SI ENCUENTRAS RECURSOS (Libros/PDFs):** Diles: "¡Tengo buenas noticias! En nuestra biblioteca tenemos estos materiales para ti:". Lista los libros con sus enlaces Markdown.
        *   **SI NO ENCUENTRAS RECURSOS:** Diles: "No encontré materiales específicos en nuestra base de datos por ahora, pero aquí tienes recursos externos confiables:".
    5.  **Recursos Externos (opcional):** 2-3 enlaces de calidad (Khan Academy, Wikipedia, etc.).
    6.  **Cierre:** Pregunta si quiere profundizar o necesita algo más.

    **Límites y Seguridad (Importante pero sin ser restrictivo):**
    *   **NO respondas:** Contenido ilegal, peligroso para la salud/vida, discriminatorio, o que promueva violencia.
    *   **SÍ puedes hablar:** De temas sensibles con madurez (ej. historia, salud mental, carreras difíciles) siempre con respeto.
    *   **Si te piden hacer tu tarea/examen:** Sé amable pero firme: "Puedo ayudarte a ENTENDER el tema, pero no puedo hacer tu tarea por ti. ¿Qué parte no entiendes?"
    *   **Temas fuera de tu conocimiento actual:** Sé honesto: "No tengo acceso a información en tiempo real sobre [X], pero puedo ayudarte con conceptos generales o dirigirte a fuentes confiables."

    **Reglas de Formato:**
    *   **Listas Navegables (Carreras/Cursos/Temas):** USA SIEMPRE este formato específico para que el usuario pueda hacer clic e ir a la sección correspondiente:
        *   Para Carreras: '* [career:ID] Nombre de la Carrera' (ej. '* [career:1] Ingeniería de Software').
        *   Para Cursos: '* [course:ID] Nombre del Curso' (ej. '* [course:15] Cálculo I').
        *   Para Temas: '* [topic:ID] Nombre del Tema' (ej. '* [topic:42] Derivadas').
    *   **Malla Curricular (PDF):** 
        *   Si el usuario pregunta DIRECTAMENTE por "descargar", "ver PDF", "malla curricular PDF", "plan de estudios PDF", sé DIRECTO: empieza tu respuesta con el enlace del PDF.
        *   Formato: "¡Claro! Aquí puedes descargar la malla curricular de [Carrera]: [📄 Descargar Malla Curricular (PDF)](curriculum_url)\n\nLa carrera incluye los siguientes cursos principales: [lista breve]"
        *   Enlace SIEMPRE primero, lista de cursos después (y de forma concisa).
    *   **Libros y Materiales (con enlace):** Formato Markdown estándar: '* [Título del Libro](URL)'.
    *   **Usa negritas (\`**texto**\`)** para resaltar los títulos de cada sección.
    *   **Concisión:** Si la pregunta es directa (ej. "quiero X"), da X primero. Evita rodeos innecesarios.
    *   **Profundidad:** Si la pregunta pide explicaciones detalladas, sé exhaustivo y didáctico.

    **Formato de Salida Obligatorio:** Tu respuesta final DEBE ser un único objeto JSON válido, sin texto adicional.
    El JSON debe tener esta estructura:
    {
      "intencion": "[consulta_horario|solicitar_material|duda_teorica|consulta_administrativa|consulta_general|conversacion_casual]",
      "confianza": 0.9,
      "respuesta": "Tu respuesta amable y detallada aquí.",
      "sugerencias": ["Sugerencia 1", "Sugerencia 2"]
    }` }]
};

const model = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.95,
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
            name: "getTopicDetails",
            description: "Obtiene información de un tema y sus LIBROS/RECURSOS asociados. Úsalo SIEMPRE que expliques un tema.",
            parameters: {
                type: "OBJECT",
                properties: {
                    topicName: { type: "STRING", description: "Nombre del tema (ej. 'Derivadas')." }
                },
                required: ["topicName"]
            }
        },
        {
            name: "getCareerDetails",
            description: "Obtiene detalles sobre una carrera (malla curricular).",
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

        // ✅ SOLUCIÓN: Usar los repositorios pasados como argumentos.
        const { knowledgeBaseRepo, courseRepo, careerRepo, knowledgeBaseSet } = dependencies;

        // 🚀 OPTIMIZACIÓN: Pre-fetching de datos (RAG-lite)
        // Buscamos entidades en el mensaje y cargamos sus datos ANTES de llamar al LLM.
        // Esto evita que el LLM tenga que hacer una "tool call" para pedir información básica.
        let contextInjection = "";
        try {
            const entities = knowledgeBaseRepo.findEntitiesInText(message);

            if (entities.courses.length > 0) {
                const courseName = entities.courses[0];
                const courses = await courseRepo.search(courseName);
                if (courses.length > 0) {
                    const course = courses[0];
                    // Simular output de getCourseDetails
                    // Nota: Esto es ineficiente si hay muchos temas, idealmente topicRepo tendría un findByCourseId
                    const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                    const courseTopics = allTopics.filter(t => t.course_id === course.id).map(t => ({ id: t.id, name: t.name }));

                    contextInjection += `\n[SISTEMA: INFORMACIÓN PRE-CARGADA SOBRE EL CURSO "${course.name}"]\n` +
                        `ID: ${course.id}\n` +
                        `Descripción: ${course.description || "No disponible"}\n` +
                        `Temas del curso: ${courseTopics.map(t => `* [topic:${t.id}] ${t.name}`).join('\n')}\n` +
                        `[FIN INFORMACIÓN PRE-CARGADA]\n`;
                    console.log(`🚀 Pre-fetching: Datos del curso "${course.name}" inyectados en el contexto.`);
                }
            }

            if (entities.topics.length > 0) {
                const topicName = entities.topics[0];
                const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                const topic = allTopics.find(t => normalizeText(t.name).includes(normalizeText(topicName)));

                if (topic) {
                    const books = await knowledgeBaseRepo.bookRepo.findAll();
                    const topicBooks = books.filter(b => b.topic_id === topic.id);

                    contextInjection += `\n[SISTEMA: INFORMACIÓN PRE-CARGADA SOBRE EL TEMA "${topic.name}"]\n` +
                        `ID: ${topic.id}\n` +
                        `Descripción: ${topic.description || "No disponible"}\n` +
                        `Libros/Recursos disponibles:\n${topicBooks.map(b => `* [${b.title}](${b.url})`).join('\n')}\n` +
                        `[FIN INFORMACIÓN PRE-CARGADA]\n`;
                    console.log(`🚀 Pre-fetching: Datos del tema "${topic.name}" inyectados en el contexto.`);
                }
            }

        } catch (e) {
            console.warn("⚠️ Error en pre-fetching (continuando sin contexto extra):", e);
        }

        try {
            // El modelo ya está inicializado arriba.

            const historyForAPI = conversationHistory.map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({
                history: historyForAPI
            });

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
                        const allSections = await knowledgeBaseRepo.sectionRepo.findAll();
                        const allInstructors = await knowledgeBaseRepo.instructorRepo.findAll();

                        // ✅ MEJORA CRÍTICA: Enviar ID y Nombre de los temas para que la IA pueda generar enlaces [topic:ID]
                        const topics = (course.topicIds || []).map(id => {
                            const t = allTopics.find(topic => topic.id === id);
                            return t ? { id: t.id, name: t.name } : null;
                        }).filter(Boolean);

                        const books = (course.bookIds || []).map(id => allBooks.find(b => b.id === id)).filter(b => b && b.title && b.url);

                        const sectionsForCourse = allSections
                            .filter(s => s.courseId === course.id)
                            .map(section => {
                                const instructor = allInstructors.find(i => i.id === section.instructorId);
                                return {
                                    instructorName: instructor ? instructor.name : 'Por asignar',
                                    schedule: section.schedule.map(s => `${s.day} de ${s.startTime} a ${s.endTime} en el salón ${s.room}`)
                                };
                            });

                        courseDetailsResponse = {
                            ...course,
                            topics, // Ahora enviamos objetos {id, name}
                            books,
                            sections: sectionsForCourse
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
                } else if (call.name === 'getTopicDetails') {
                    // ✅ SOLUCIÓN: Búsqueda flexible para temas
                    const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                    const normalizedQuery = normalizeText(call.args.topicName);
                    // Buscar coincidencia parcial (includes) en lugar de exacta
                    const topic = allTopics.find(t => normalizeText(t.name).includes(normalizedQuery));

                    let topicDetailsResponse = null;

                    if (topic) {
                        const allBooks = await knowledgeBaseRepo.bookRepo.findAll();
                        const books = (topic.bookIds || []).map(id => allBooks.find(b => b.id === id)).filter(b => b && b.title && b.url);
                        topicDetailsResponse = { ...topic, books };
                        console.log('🔍 Resultado (getTopicDetails): Encontrado:', topic.name, 'con', books.length, 'libros.');
                    } else {
                        console.log(`⚠️ No se encontró tema para "${call.args.topicName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getTopicDetails',
                            response: topicDetailsResponse || { error: "Tema no encontrado" }
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
                        const courses = await courseRepo.findByCareerName(career.name);
                        const courseList = courses.map(c => ({ id: c.id, name: c.name }));

                        careerDetailsResponse = {
                            id: career.id,
                            name: career.name,
                            description: career.description || 'No disponible',
                            curriculum_url: career.curriculum_url || null, // ✅ INCLUIR URL DE MALLA CURRICULAR
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
                    const courses = await courseRepo.findByCareerName(call.args.careerName);
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

                } else if (call.name === 'getInstructorInfo') {
                    // Buscar instructor por nombre
                    const allInstructors = await knowledgeBaseRepo.instructorRepo.findAll();
                    const normalizedQuery = normalizeText(call.args.instructorName);
                    const instructor = allInstructors.find(i => normalizeText(i.name).includes(normalizedQuery));

                    let instructorInfoResponse = null;

                    if (instructor) {
                        // Buscar las secciones (cursos) que enseña este instructor
                        const allSections = await knowledgeBaseRepo.sectionRepo.findAll();
                        const allCourses = await courseRepo.findAll();

                        const instructorSections = allSections.filter(s => s.instructorId === instructor.id);
                        const coursesTeaching = instructorSections.map(section => {
                            const course = allCourses.find(c => c.id === section.courseId);
                            if (!course) return null;

                            return {
                                courseId: course.id,
                                courseName: course.name,
                                schedule: section.schedule.map(s => `${s.day} de ${s.startTime} a ${s.endTime} en ${s.room}`)
                            };
                        }).filter(Boolean);

                        instructorInfoResponse = {
                            id: instructor.id,
                            name: instructor.name,
                            email: instructor.email,
                            coursesTeaching: coursesTeaching
                        };
                        console.log('🔍 Resultado (getInstructorInfo): Encontrado:', instructor.name, 'enseña', coursesTeaching.length, 'cursos.');
                    } else {
                        console.log(`⚠️ No se encontró instructor para "${call.args.instructorName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getInstructorInfo',
                            response: instructorInfoResponse || { error: "Docente no encontrado" }
                        }
                    }]);
                    response = result.response;

                } else if (call.name === 'listAllInstructors') {
                    const allInstructors = await knowledgeBaseRepo.instructorRepo.findAll();
                    const instructorList = allInstructors.map(i => ({ id: i.id, name: i.name }));

                    console.log('🔍 Resultado (listAllInstructors):', instructorList.length, 'instructores encontrados.');

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'listAllInstructors',
                            response: { instructors: instructorList }
                        }
                    }]);
                    response = result.response;

                } else {
                    throw new Error(`Herramienta no reconocida: ${call.name}`);
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
            return parsedResult;

        } catch (error) {
            console.error('❌ Error en MLService al contactar al LLM:', error);
            return {
                intencion: 'error_general',
                confianza: 1.0,
                respuesta: 'Lo siento, estoy teniendo problemas para conectarme con mi cerebro de IA en este momento. Por favor, intenta de nuevo en unos instantes.'
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
        // ... (Tu lógica de recomendaciones aquí, no necesita cambios) ...
        console.log(`🤖 MLService: Obteniendo recomendaciones para "${query}"`);
        try {
            const recommendations = await PythonMLService.getRecommendations(query, directResultsIds);
            return recommendations;
        } catch (error) {
            console.error('❌ Error en MLService al obtener recomendaciones:', error);
            return { relatedCourses: [], relatedTopics: [] };
        }
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
     * Genera una descripción concisa y académica para un tema específico.
     */
    static async generateTopicDescription(topicName) {
        console.log(`🤖 MLService: Generando descripción para el tema: "${topicName}"`);
        try {
            // ✅ 5. Esta es la sintaxis correcta para 'generateContent' en Vertex
            const model = vertex_ai.preview.getGenerativeModel({
                model: 'gemini-2.5-flash'
            });

            const prompt = `Como un experto académico, explica brevemente (en 2 o 3 frases) de qué trata el tema "${topicName}" en un contexto universitario. Sé claro y conciso.`;

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
            const response = result.response;
            const description = response.candidates[0].content.parts[0].text;

            if (!description) {
                throw new Error("La respuesta de la IA estaba vacía.");
            }
            console.log(`✅ Descripción generada para "${topicName}"`);
            return description;

        } catch (error) {
            console.error(`❌ Error en MLService al generar descripción para "${topicName}":`, error);
            return "No se pudo generar una descripción en este momento. Inténtalo de nuevo más tarde.";
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