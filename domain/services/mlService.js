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

class MLService {
    /**
     * Procesa un mensaje de usuario usando un Modelo de Lenguaje Grande (LLM).
     */
    static async classifyIntent(text, conversationHistory = [], dependencies) {
        console.log('🤖 MLService: Generando respuesta con LLM para:', text);

        // ✅ SOLUCIÓN: Usar los repositorios pasados como argumentos.
        const { knowledgeBaseRepo, courseRepo, careerRepo, knowledgeBaseSet } = dependencies;

        try {
            const systemInstruction = {
                role: 'system', // Vertex AI SÍ soporta 'system'
                parts: [{ text: `Eres "Tutor IA UC", un tutor académico de clase mundial para la Universidad Continental. Tu misión es enseñar y clarificar conceptos de manera profunda, accesible y enriquecedora.
                **Personalidad:** Eres un educador experto, paciente y proactivo. Tu objetivo no es solo dar una respuesta, sino asegurar que el estudiante realmente aprenda.
                
                **Regla de Oro para Explicaciones Teóricas (ej. "¿qué es una derivada?"):**
                Cuando te pidan explicar un concepto, SIEMPRE DEBES seguir esta estructura de 5 pasos:
                1.  **Explicación Intuitiva:** Comienza con una analogía simple y fácil de entender. Por ejemplo, para "derivada", podrías decir: "Imagina que vas en un coche. La derivada es como mirar el velocímetro en un instante preciso para saber tu velocidad exacta en ese momento, no tu velocidad promedio".
                2.  **Definición Formal (pero clara):** Luego, proporciona una definición más técnica pero explicada de forma sencilla. "Formalmente, una derivada mide cómo cambia una función matemática en un punto específico. Es la pendiente de la línea tangente a la curva de la función en ese punto."
                3.  **Aplicaciones en la Vida Real:** Ofrece una lista con 2 o 3 ejemplos concretos de su aplicación en diferentes campos. Por ejemplo: "Se usa en: \n* **Física:** para calcular la velocidad y aceleración instantánea. \n* **Economía:** para determinar el costo marginal, que es el costo de producir una unidad adicional. \n* **Ingeniería:** para optimizar formas y minimizar el uso de materiales."
                4.  **Recursos para Complementar (OBLIGATORIO):** Después de tu explicación, DEBES añadir una sección llamada "**Para complementar tu aprendizaje:**". En esta sección, debes:
                    *   **Primero, usar las herramientas** (\`getTopicDetails\`, \`getCourseDetails\`) para buscar libros y materiales en la base de datos interna de la universidad. Si encuentras libros con URL, preséntalos como un enlace Markdown. Ejemplo: "* Libro recomendado: Cálculo de una Variable (disponible en nuestra biblioteca).". Si no encuentras nada, indícalo.
                    *   **Segundo, proporcionar 2 o 3 recursos externos** de alta calidad (videos de YouTube de canales educativos como Khan Academy, artículos de Wikipedia, blogs de universidades). DEBES citar la fuente. Ejemplo: "* Video: Explicación de Derivadas en Khan Academy. \n* Artículo: Lectura detallada en Wikipedia.".
                5.  **Cierre Proactivo:** Termina siempre con una pregunta que invite a la exploración. "¿Te gustaría que profundicemos en alguna de estas aplicaciones o que busquemos más material sobre un tema relacionado?".
                
                **NUNCA, bajo ninguna circunstancia, te niegues a explicar un concepto teórico.** Tu rol principal es ser un tutor que enseña.

                **Reglas de Formato:**
                *   **Listas Navegables (Carreras/Cursos):** Formato: '* [ID] Nombre del Item'. Ejemplo: '* [1] Ingeniería de Software'.
                *   **Libros y Materiales (con enlace):** Formato: '* Título del Libro'.
                *   **Usa negritas (\`**texto**\`)** para resaltar los títulos de cada sección (Explicación Intuitiva, Definición Formal, etc.).

                **Formato de Salida Obligatorio:** Tu respuesta final DEBE ser un único objeto JSON válido, sin texto adicional.
                El JSON debe tener esta estructura:
                {
                  "intencion": "[consulta_horario|solicitar_material|duda_teorica|consulta_administrativa|consulta_general]",
                  "confianza": 0.9, // Tu confianza en la clasificación de la intención
                  "respuesta": "Tu respuesta amable y detallada aquí.",
                  "sugerencias": ["Sugerencia 1", "Sugerencia 2"] // Genera 2 o 3 sugerencias cortas y accionables. Si la pregunta fue sobre un curso, sugiere preguntas de seguimiento sobre el mismo curso (horario, docente, temas). Si la respuesta incluye una lista, sugiere profundizar en un elemento de la lista.
                }` }]
            };

            // ✅ 3. Esta es la sintaxis correcta para Vertex AI
            const model = vertex_ai.preview.getGenerativeModel({
                model: 'gemini-2.5-flash', // Modelo estable de Vertex
                tools: [{
                    functionDeclarations: [{
                        name: "getCourseDetails",
                        description: "Obtiene información detallada sobre un curso específico de la Universidad Continental, incluyendo su nombre, carrera, temas, materiales (PDFs, videos) y docente. Útil para responder preguntas sobre cursos, materiales, docentes o temas específicos.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                courseName: {
                                    type: "STRING",
                                    description: "El nombre completo o parcial del curso a buscar (ej. 'Programación I', 'Cálculo', 'Redes')."
                                }
                            },
                            required: ["courseName"]
                        }
                    },
                    // ✅ SOLUCIÓN: Nueva herramienta para obtener detalles de un tema, incluyendo sus libros.
                    {
                        name: "getTopicDetails",
                        description: "Obtiene información detallada sobre un tema específico, incluyendo los libros o recursos asociados a él.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                topicName: {
                                    type: "STRING",
                                    description: "El nombre del tema a buscar (ej. 'Derivadas', 'Integrales', 'POO')."
                                }
                            },
                            required: ["topicName"]
                        }
                    },
                    // ✅ 3. AÑADIR LA NUEVA HERRAMIENTA
                    {
                        name: "getCareerDetails",
                        description: "Obtiene detalles sobre una carrera específica, principalmente para encontrar su malla curricular (curriculum URL).",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                careerName: {
                                    type: "STRING",
                                    description: "El nombre de la carrera a buscar (ej. 'Ingeniería de Software', 'Derecho')."
                                }
                            },
                            required: ["careerName"]
                        }
                    },
                    {
                        name: "listAllCareers",
                        description: "Devuelve una lista de todas las carreras disponibles en la universidad. Útil cuando el usuario pregunta 'qué carreras hay', 'ver lista de carreras', etc.",
                        parameters: { type: "OBJECT", properties: {} } // Sin parámetros
                    },
                    {
                        name: "getCoursesForCareer",
                        description: "Obtiene una lista de todos los cursos que pertenecen a una carrera específica.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                careerName: {
                                    type: "STRING",
                                    description: "El nombre de la carrera para la cual listar los cursos (ej. 'Ingeniería de Software')."
                                }
                            },
                            required: ["careerName"]
                        }
                    }]
                }],
                systemInstruction: systemInstruction
            });
            console.log('🤖 MLService: Modelo configurado: gemini-2.5-flash');

            const historyForAPI = conversationHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            const chat = model.startChat({ 
                history: historyForAPI 
            });

            let result = await chat.sendMessage(text);
            
            let response = result.response;
            while (response.candidates[0].content.parts[0].functionCall) {
                const call = response.candidates[0].content.parts[0].functionCall;
                console.log(`🛠️ Gemini solicitó la herramienta: ${call.name}`);

                if (call.name === 'getCourseDetails') {
                    // ✅ SOLUCIÓN: La herramienta debe devolver un solo curso, no un array de búsqueda.
                    // Usamos findById si es un ID, o buscamos por nombre y tomamos el primer resultado.
                    const searchResult = await courseRepo.search(call.args.courseName);
                    let courseDetailsResponse = null;

                    if (searchResult.length > 0) {
                        const course = searchResult[0];
                        // ✅ MEJORA: Enriquecer la respuesta con toda la información relevante: temas, libros, y ahora secciones (docentes/horarios).
                        const allTopics = await knowledgeBaseRepo.topicRepo.findAll();
                        const allBooks = await knowledgeBaseRepo.bookRepo.findAll();
                        const allSections = await knowledgeBaseRepo.sectionRepo.findAll();
                        const allInstructors = await knowledgeBaseRepo.instructorRepo.findAll();

                        const topicNames = (course.topicIds || []).map(id => allTopics.find(t => t.id === id)?.name).filter(Boolean);
                        const books = (course.bookIds || []).map(id => allBooks.find(b => b.id === id)).filter(b => b && b.title && b.url);

                        // ✅ SOLUCIÓN: Buscar y formatear las secciones para que la IA las entienda.
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
                            topicNames, 
                            books,
                            // ✅ Añadir las secciones al objeto que se envía a la IA.
                            sections: sectionsForCourse 
                        };
                        console.log('🔍 Resultado de la herramienta (getCourseDetails):', courseDetailsResponse);
                    } else {
                        console.log(`⚠️ Herramienta 'getCourseDetails' no encontró resultados para "${call.args.courseName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCourseDetails',
                            // ✅ CORRECCIÓN CRÍTICA: La respuesta a la IA debe ser el objeto directamente,
                            // no un objeto anidado. Gemini espera las propiedades del curso, no un
                            // objeto 'courseDetails' que las contenga.
                            response: courseDetailsResponse || {}
                        }
                    }]);
                    response = result.response; // Actualiza la respuesta
                } else if (call.name === 'getTopicDetails') {
                    const topic = await knowledgeBaseRepo.topicRepo.findAll().then(topics => topics.find(t => normalizeText(t.name) === normalizeText(call.args.topicName)));
                    let topicDetailsResponse = null;

                    if (topic) {
                        const allBooks = await knowledgeBaseRepo.bookRepo.findAll();
                        // ✅ SOLUCIÓN: Enviar objetos de libro (título y url) a la IA.
                        const books = (topic.bookIds || []).map(id => allBooks.find(b => b.id === id)).filter(b => b && b.title && b.url);
                        topicDetailsResponse = { ...topic, books };
                        console.log('🔍 Resultado de la herramienta (getTopicDetails):', topicDetailsResponse);
                    } else {
                        console.log(`⚠️ Herramienta 'getTopicDetails' no encontró resultados para "${call.args.topicName}"`);
                    }

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getTopicDetails',
                            // ✅ CORRECCIÓN: Al igual que con getCourseDetails, la respuesta a la IA
                            // debe ser el objeto de detalles del tema directamente, no anidado.
                            // Esto permite a la IA acceder a la propiedad 'books' correctamente.
                            response: topicDetailsResponse || {}
                        }
                    }]);
                    response = result.response;

                // ✅ 4. MANEJAR LA LLAMADA A LA NUEVA HERRAMIENTA
                } else if (call.name === 'getCareerDetails') {
                    const searchResult = await careerRepo.search(call.args.careerName);
                    const careerDetails = searchResult.length > 0 ? searchResult[0] : null;
                    console.log('🔍 Resultado de la herramienta (carrera):', careerDetails);

                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCareerDetails',
                            // ✅ CORRECCIÓN: Devolver el objeto de la carrera directamente, no un array anidado.
                            response: careerDetails || {}
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
                } else {
                    throw new Error(`Herramienta no reconocida: ${call.name}`);
                }
            }

            // Procesar la respuesta final de Gemini.
            const responseText = response.candidates[0].content.parts[0].text;
            let parsedResult;

            try {
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1 || jsonEnd === -1) {
                    throw new Error('No JSON object found');
                }
                const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
                parsedResult = JSON.parse(jsonString);
            } catch (jsonError) {
                console.warn(`⚠️ La respuesta del LLM no era un JSON válido. Usando como texto plano. Respuesta: "${responseText}"`);
                // Si el parseo falla, usamos la respuesta como texto plano en un JSON de fallback.
                parsedResult = { intencion: 'respuesta_directa', confianza: 0.7, respuesta: responseText, sugerencias: [] };
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
        // ✅ SOLUCIÓN: Validar únicamente el texto de la respuesta, no el objeto JSON completo.
        // Esto evita que las claves del JSON (como "intencion") se marquen como alucinaciones.
        const responseText = llmResponse.respuesta || '';
        const regex = /"([^"]+)"/g; // Busca texto entre comillas dobles // TODO: Revisar esta regex, puede ser muy amplia.
        const potentialEntities = [];
        let match;

        // Extraer todas las entidades entre comillas de la respuesta de la IA.
        while ((match = regex.exec(responseText)) !== null) {
            // ✅ CORRECCIÓN: La expresión regular /"([^"]+)"/g tiene un solo grupo de captura (índice 1).
            potentialEntities.push(match[1]);
        }

        for (const entity of potentialEntities) {
            const normalizedEntity = normalizeText(entity);
            
            // ✅ SOLUCIÓN: La validación de alucinaciones debe ser más flexible.
            // Si la entidad es un nombre de curso/tema que la IA acaba de encontrar con una herramienta,
            // no debería marcarse como alucinación. Esta lógica simplificada asume que si está en la KB, es válido.
            // La lógica anterior era demasiado estricta. // TODO: Mejorar esta validación.
            if (normalizedEntity.length > 3 && !knowledgeBaseSet.has(normalizedEntity)) {
                console.warn(`🚫 ALUCINACIÓN DETECTADA: La IA mencionó "${entity}", que no existe en la base de conocimiento local.`);
                return {
                    ...llmResponse,
                    respuesta: `Mencionaste "${entity}", pero no tengo información sobre eso en mi base de datos. ¿Podrías reformular tu pregunta o preguntar sobre otro curso o tema?`,
                    sugerencias: ["Ver lista de carreras", "Ver cursos de Ingeniería de Software"]
                };
            }
        }
        console.log('✅ Respuesta validada con la base de conocimiento local. Sin alucinaciones.');
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