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
    2.  **CURADOR DE RECURSOS:** Conectar al usuario con material "Open Source", Papers, y guías oficiales. Presenta siempre estos recursos como enlaces Markdown directos: [Título](URL).
    3.  **EXPERTO VISUAL:** Si el material es una Infografía o Imagen (Tipo: "other"), descríbelo como material visual de apoyo (ej: "He seleccionado esta infografía para ilustrar el concepto...").
    4.  **GUÍA ACADÉMICO:** Orientar sobre qué Cursos, Módulos y Flashcards están disponibles. Cuando menciones un curso, usa SIEMPRE: [Nombre](/course?id=ID).

    --- DIRECTRICES DE COMPORTAMIENTO ---

    A) AL RESPONDER SOBRE TEMAS/CONCEPTOS MÉDICOS:
    1.  **Explicación Basada en Evidencia:** Responde con claridad médica. SIEMPRE prioriza tu conocimiento interno de las Normas Técnicas, Guías de Práctica Clínica (GPC) y libros de referencia (Harrison, Washington, Nelson, CTO, AMIR).
    2.  **Referencias:** 
        * **Si mencionas Guías/Normas:** "Según la Norma Técnica [Nombre]: ..." y cita la regla.
        * **Fuentes Oficiales:** Fundamenta tu explicación en los libros de texto médicos verificados y normas oficiales peruanas (NTS, RM, Leyes) que forman parte de tu base de conocimiento experto.
    3.  **Uso de Conocimiento General:** Si el contexto provisto (RAG) no contiene la respuesta exacta a preguntas específicas (ej. plazos normativos, tiempos, o dosis exactas), **DEBES usar tu conocimiento experto pre-entrenado general** para dar la respuesta correcta. BAJO NINGUNA CIRCUNSTANCIA respondas "no está en mi base de conocimientos" o "el contexto proporcionado no lo menciona". Eres un médico experto y debes suplir cualquier deficiencia de los documentos con tu propio conocimiento médico.

    B) AL RESPONDER SOBRE ESTRUCTURA DE CURSOS:
    Si el usuario pregunta "¿Qué cursos tiene Medicina?" o sobre temas específicos, revisa el contexto inyectado.
    1.  **Listado Claro:** Presenta la información con viñetas. OBLIGATORIO: Usa enlaces Markdown para que sean clickeables.
        * Ejemplo: "Te recomiendo el curso de [Anatomía Humana](/course?id=123)".
    2.  **No inventes:** Solo menciona los cursos que el sistema te ha mostrado en el contexto.

    D) LÍMITE DE RECURSOS (OPTIMIZACIÓN):
    *   Si el contexto te da muchos recursos, **LISTA MÁXIMO 3 a 5**.
    *   Si hay más, añade una línea final: "Y [X] recursos más disponibles en el Centro de Referencia."

    E) SUGERENCIAS ACTIVAS (OBLIGATORIO):
    Al final de TU RESPUESTA, genera siempre 3 preguntas cortas que el usuario podría hacer a continuación para profundizar.
    *   Deben ser INTUITIVAS y naturales ligadas al caso u objetivos (ej. "Ver dosis pediátrica", "¿Cuál es el tratamiento de primera línea?", "Ir a Flashcards de este tema").

    IMPORTANTE: Tu respuesta debe ser siempre un objeto JSON válido con esta estructura:
    {
      "intencion": "clasificación_de_la_intención",
      "respuesta": "Tu respuesta completa aquí en Markdown. POR FAVOR, SE EXTENSO Y PEDAGÓGICO. Para conceptos médicos, utiliza al menos 3 párrafos bien estructurados, usa negritas para términos clave y tablas si es necesario para comparar conceptos. No seas breve; el usuario busca aprender.",
      "sugerencias": ["Pregunta 1", "Pregunta 2", "Pregunta 3"]
    }

    --- VALLA DE SEGURIDAD ACADÉMICA (CERO TOLERANCIA A LA CREATIVIDAD) ---
    1. PROHIBIDO INVENTAR ENLACES O IDs. Usa ÚNICAMENTE los IDs del bloque [CATÁLOGO ACADÉMICO] inyectado.
    2. SI NO ESTÁ EN LA LISTA, NO EXISTE: Si un curso no aparece en el [CATÁLOGO ACADÉMICO], tienes PROHIBIDO mencionarlo como una oferta o recomendación de Hub Academia. No inventes nombres de cursos genéricos (ej. "Salud Pública" o "Medicina Interna") si no están en la lista.
    3. PROHIBIDO MENCIONAR "FICTICIO": Nunca indiques que un ID es ficticio o que el usuario debe verificar el catálogo; simplemente no menciones lo que no está verificado en el contexto.
    4. Si recomiendas un curso de la lista, usa estrictamente su ID real: [Nombre](/course?id=ID). Cualquier otro formato o ID falso (123, 456, abc) está terminantemente prohibido.
    5. Para libros y recursos, usa la propiedad 'url' exacta que se te proporcione. No inventes links a Google Drive ni a otras plataformas salvo sean oficiales y seguras.
    6. RESPUESTA SINCERA: Si el usuario pide un curso sobre un tema que no tenemos (ej. Dengue), responde: "Actualmente no contamos con un curso específico de ese tema, pero puedes revisar las normativas y recursos en nuestra biblioteca." No intentes "adivinar" o "sugerir" cursos inexistentes.
    7. **AUDITORÍA EN VIVO:** Todo lo que escribas será filtrado técnicamente por el sistema. Si mencionas un curso inexistente, tu enlace será eliminado automáticamente.
    `
    }]
};



const modelLite = vertex_ai.getGenerativeModel({ 
    model: 'gemini-2.5-flash-lite', 
    systemInstruction, 
    generationConfig: { maxOutputTokens: 8192, temperature: 0.7, topP: 0.8 } 
});

console.log('🤖 MLService: Motor LITE UNIFICADO (Sin Thinking -> 2.5-Flash-Lite)');

class MLService {
    /**
     * Selecciona el modelo adecuado según el tier del usuario.
     * @private
     */
    static _getModelByTier(tier = 'free') {
        const t = String(tier || 'free').toLowerCase();
        // 🚀 REVERSIÓN A LITE POR PETICIÓN DE USUARIO (VELOCIDAD Y COSTOS)
        console.log(`🍃 [IA MODO AHORRO] Usando gemini-2.5-flash-lite para '${t}'.`);
        return modelLite;
    }

    /**
     * Resolutor Universal de URLs de Recursos (GCS / Externos)
     * @private
     */
    static _resolveResourceUrl(url, type = 'book') {
        if (!url || url.trim() === '') return '#';
        
        // Si ya es una URL absoluta o relativa local conocida, no tocar
        const u = url.trim();
        if (u.startsWith('http') || u.startsWith('/') || u.startsWith('data:') || u.startsWith('assets/')) {
            return u;
        }

        // Caso GCS: Es una ruta relativa (ej: "recursos/infografia.png")
        // No inyectamos el token aquí porque la IA lo entrega como Markdown y el cliente lo procesará, 
        // o el proxy /api/media/gcs lo manejará (el middleware checkAuth lo validará al clic).
        return `/api/media/gcs?path=${encodeURIComponent(u)}`;
    }

    /**
     * Procesa un mensaje de usuario usando un Modelo de Lenguaje Grande (LLM).
     */
    static async classifyIntent(message, conversationHistory, dependencies) {
        // Extraer dependencias
        const { knowledgeBaseRepo, courseRepo, careerRepo, knowledgeBaseSet, userTier } = dependencies;

        const activeModel = this._getModelByTier(userTier);
        console.log(`🤖 MLService: Generando respuesta con LLM para: ${message}`);

        // 🚀 OPTIMIZACIÓN: Pre-fetching de datos (RAG-lite) y Catálogo Maestro (Escalable)
        let contextInjection = "";
        let validCourseIds = new Set();

        try {
            // 0. CATÁLOGO MAESTRO (Evita alucinaciones de IDs)
            const allCourses = await courseRepo.findAll();
            if (allCourses && allCourses.length > 0) {
                validCourseIds = new Set(allCourses.map(c => String(c.id)));
                const catalogStr = allCourses.map(c => `[ID=${c.id}] "${c.name}"`).join(' | ');
                contextInjection += `\n[CATÁLOGO ACADÉMICO REAL - TOTAL: ${allCourses.length} CURSOS]\n${catalogStr}\n[FIN CATÁLOGO - PROHIBIDO MENCIONAR CURSOS FUERA DE ESTA LISTA]\n`;
            }
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
                           Tipo: ${b.resource_type || 'Desconocido'}
                           Autor: ${b.author || 'Anónimo'}
                           URL: ${this._resolveResourceUrl(b.url, b.resource_type)}`
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
                        `Material Relacionado (${limitedBooks.length} de ${topicBooks.length} mostrados):\n` +
                        limitedBooks.map(b =>
                            `* [Tipo: ${b.resource_type || 'Material'}] Título: "${b.title}" | Autor: ${b.author} | URL: ${this._resolveResourceUrl(b.url, b.resource_type)}`
                        ).join('\n') +
                        (remaining > 0 ? `\n... y ${remaining} recursos más disponibles.` : '') +
                        `\n[Ver todos: /?q=${encodeURIComponent(topic.name)}]` +
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
                        `ENLACE AL CURSO: /course?id=${course.id}\n` +
                        `Materiales (${limitedBooks.length} de ${courseBooks.length} mostrados):\n` +
                        limitedBooks.map(b =>
                            `* [Tipo: ${b.resource_type || 'Material'}] Título: "${b.title}" | Autor: ${b.author} | URL: ${this._resolveResourceUrl(b.url, b.resource_type)}`
                        ).join('\n') +
                        (remaining > 0 ? `\n... y ${remaining} recursos más.` : '') +
                        `\n[FIN INFO CURSO]\n`;
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
            // 🚀 LIMPIEZA DE HISTORIAL: Evitar que el último mensaje del usuario esté duplicado 
            // (El controlador ya guardó el mensaje actual en la BD y getMessagesByConversationId lo trajo).
            // Si el último mensaje del historial es igual al mensaje actual, lo removemos del historial enviado a la API
            // porque lo enviaremos como el mensaje "sendMessage" actual para mantener la atención de la IA.
            let cleanHistory = [...conversationHistory];
            if (cleanHistory.length > 0 &&
                cleanHistory[cleanHistory.length - 1].sender === 'user' &&
                cleanHistory[cleanHistory.length - 1].content.trim() === message.trim()) {
                cleanHistory.pop();
            }

            // Limitar historial a los últimos 10 mensajes para evitar ruido
            const limitedHistory = cleanHistory.slice(-10);

            const historyForAPI = limitedHistory.map(msg => ({
                role: msg.sender === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const chat = activeModel.startChat({ history: historyForAPI });

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
                            url: `/course?id=${course.id}`,
                            topics,
                            books: books.map(b => ({ title: b.title, author: b.author, url: b.url }))
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

            // 🛡️ [SENIOR_HARDENING] FILTRO DE ALUCINACIONES DE CURSOS
            if (parsedResult.respuesta) {
                const courseLinkRegex = /\[([^\]]+)\]\(\/course\?id=([^)]+)\)/g;
                let hallucinationsCleaned = 0;

                parsedResult.respuesta = parsedResult.respuesta.replace(courseLinkRegex, (match, courseName, courseId) => {
                    // Si el ID no existe en el catálogo real (validCourseIds), eliminamos el enlace malicioso/falso
                    if (!validCourseIds.has(String(courseId))) {
                        hallucinationsCleaned++;
                        console.warn(`🚨 IA ALUCINÓ CURSO: "${courseName}" con ID: ${courseId}. Ejecutando limpieza preventiva.`);
                        return `**${courseName}**`; // Devolvemos solo el texto en negrita, sin el link roto.
                    }
                    return match; // El ID es válido, mantenemos el link.
                });

                if (hallucinationsCleaned > 0) {
                    console.log(`🛡️ Auditoría IA: Se limpiaron ${hallucinationsCleaned} menciones a cursos inexistentes.`);
                }
            }

            // La validación estricta de localKB fue desactivada, retornamos directo
            // parsedResult = this._validateResponseWithLocalKB(parsedResult, knowledgeBaseSet);
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

    // _validateResponseWithLocalKB y getRecommendations removidos (Dead Code)

    /**
     * ✅ Orquestador RAG con prevención de duplicados y generación por lotes (Batching)
     * Exclusivo para Administradores (Motor High-Fidelity).
     */
    static async generateRAGQuestions(target, studyAreas, career, amount = 10, tier = 'advanced', reqDomain = 'medicine') {
        const domain = reqDomain || 'medicine';
        console.log(`🤖 MLService: RAG Admin -> Target: ${target}, Áreas: ${studyAreas}, Carrera: ${career}, Amount: ${amount} (Tier: ${tier}, Domain: ${domain})`);
        try {
            const requestedAmount = amount;

            // 1. PROCESAR Y MUESTREAR ÁREAS (Escenarios 1, 2 y 3 de CASOS_FLUJO_IA_USUARIO.md)
            let areasArray = [];
            if (typeof studyAreas === 'string') {
                areasArray = studyAreas.split(',').map(a => a.trim()).filter(a => a);
            } else if (Array.isArray(studyAreas)) {
                areasArray = studyAreas;
            }

            // Muestreo: Si hay más de 5, elegimos 5 aleatorias únicas.
            let sampledAreas = [];
            if (areasArray.length >= 5) {
                sampledAreas = areasArray.sort(() => 0.5 - Math.random()).slice(0, 5);
            } else if (areasArray.length > 0) {
                sampledAreas = areasArray;
            } else {
                sampledAreas = ['General'];
            }

            // 2. ORQUESTACIÓN DETERMINISTA CON RESILIENCIA (1-BY-1 PARA ENFOQUE TOTAL)
            const currentBatchLimit = (target === 'RESIDENTADO' || target === 'ENAM' || target === 'SERUMS') ? 1 : 3;
            let allQuestions = [];

            const sleep = ms => new Promise(res => setTimeout(res, ms));

            // Calculamos cuántas preguntas por área (distribución equitativa)
            for (let i = 0; i < requestedAmount; i += currentBatchLimit) {
                const currentBatchSize = Math.min(currentBatchLimit, requestedAmount - i);

                let areaForThisBatch;
                if (currentBatchLimit === 1) {
                    areaForThisBatch = sampledAreas[i % sampledAreas.length];
                } else {
                    areaForThisBatch = sampledAreas.join(', ');
                }

                const batchNum = Math.floor(i / currentBatchLimit) + 1;
                console.log(`🤖 MLService: Generando lote ${batchNum} (${currentBatchSize} q) para: ${areaForThisBatch}...`);

                // Lógica de Reintento con Backoff (Máximo 3 intentos para error 429)
                let batchQuestions = null;
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    try {
                        batchQuestions = await this._generateBatchInternal(target, areaForThisBatch, career, allQuestions, currentBatchSize, tier, domain);
                        break; // Éxito, salir del loop de reintentos
                    } catch (err) {
                        attempts++;
                        const isRateLimit = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));

                        if (isRateLimit && attempts < maxAttempts) {
                            const waitTime = Math.pow(2, attempts) * 1000;
                            console.warn(`⚠️ [429] Cuota excedida. Reintentando en ${waitTime}ms... (Intento ${attempts}/${maxAttempts})`);
                            await sleep(waitTime);
                        } else {
                            console.error(`❌ Error persistente en lote ${batchNum}:`, err.message);
                            throw err; // Error no recuperable o máximos intentos alcanzados
                        }
                    }
                }

                if (batchQuestions && batchQuestions.length > 0) {
                    batchQuestions.forEach((q) => {
                        if (currentBatchLimit === 1) q.topic = areaForThisBatch;
                    });
                    allQuestions = allQuestions.concat(batchQuestions);
                }

                if (allQuestions.length >= requestedAmount) break;

                // Retardo preventivo entre lotes para evitar ráfagas (Rate Limiting preventivo)
                if (i + currentBatchLimit < requestedAmount) {
                    await sleep(5000); // Aumento del delay a 5s para evitar 429 con prompts grandes en modo LITE
                }
            }

            console.log(`✅ MLService: Generación RAG completada (${allQuestions.length} preguntas) con distribución optimizada.`);
            return allQuestions.slice(0, requestedAmount);

        } catch (error) {
            console.error('❌ Error crítico en Generación RAG Orquestada:', error);
            throw error;
        }
    }

    /**
     * @private Lógica de generación atómica para un lote pequeño (Prompt Maestro)
     */
    static async _generateBatchInternal(target, studyAreas, career, previousBatchQuestions = [], amount = 1, tier = 'advanced', domain = 'medicine') {
        try {
            const modelName = "gemini-2.5-flash-lite"; // ✅ TODO LITE
            const careerStr = String(career || "Medicina");
            const careerLower = careerStr.toLowerCase();

            // 1. Prevenir Duplicidad Escaneando la Base de Datos Histórica
            let recentQuestionsText = "";
            let careerParam = careerLower || null;
            try {
                const db = require('../../infrastructure/database/db'); // Carga dinámica del Pool
                const areasArray = String(studyAreas || '').split(',').map(a => a.trim()).filter(a => a);

                // 🎯 REFINAMIENTO: Historial Exacto con Subtemas
                const recentQ = await db.query(`
                    SELECT topic, subtopic, question_text 
                    FROM question_bank 
                    WHERE target = $1 
                      AND domain = $2 
                      AND (career = $3 OR $3 IS NULL)
                      AND (topic = ANY($4) OR $4 IS NULL)
                    ORDER BY created_at DESC 
                    LIMIT 200
                `, [target, domain, careerParam, areasArray.length > 0 ? areasArray : null]);

                const allPreviousTexts = [
                    ...recentQ.rows.map(r => `[${r.topic} | ${r.subtopic || 'General'}]: ${r.question_text}`),
                    ...previousBatchQuestions.map(q => `[${q.topic} | ${q.subtopic || 'General'}]: ${q.question_text}`)
                ];

                if (allPreviousTexts.length > 0) {
                    console.log(`🧠 [Deduplication] Extraídas ${allPreviousTexts.length} referencias previas para contexto AI Admin (Filtro: ${target} - ${domain}).`);
                    recentQuestionsText = "\n🚨 RESTRICCIÓN ESTRICTA DE NO-REPETICIÓN (MEMORIA PROFUNDA) 🚨\n" +
                        "A continuación se listan subtemas y escenarios que YA existen en el banco. ÚSALOS PARA NO REPETIR.\n" +
                        "⚠️ PROHIBICIÓN: No evalúes el mismo subtema ni la misma pregunta si ya aparece abajo. DEBES romper el patrón gramatical.\n" +
                        allPreviousTexts.slice(0, 75).map((txt, idx) => `[Bloqueada ${idx + 1}] ${txt}`).join('\n') +
                        "\n🎯 OBJETIVO: Generar un subtema y enunciado TOTALMENTE DISTINTO en tono, inicio y sujeto.\n";
                }
            } catch (e) {
                console.warn("⚠️ No se pudo obtener el historial anti-duplicidad en RAG:", e);
            }

            // 2. BÚSQUEDA RAG LOCAL (ELIKE - Gratuito)
            const RagService = require('./ragService');
            const ragContext = await RagService.searchContext(studyAreas, 5, { target }); // Reducido a 5 para Lite

            // 🎨 MIMETIZACIÓN DE ESTILO (FEW-SHOT): Recuperar ejemplos reales según el Target
            let stylePattern = `%${target}%`; // Default genérico por target
            const cLower = careerLower.toLowerCase();

            if (target === 'SERUMS') {
                if (cLower.includes('enfermería') || cLower.includes('enfermeria')) {
                    stylePattern = '%SERUMS-enfermeria%';
                } else if (cLower.includes('obstetricia')) {
                    stylePattern = '%SERUMS-obstetricia%';
                } else {
                    stylePattern = '%SERUMS%medicina%'; // ✅ Más flexible (soporta _ y -)
                }
            } else if (target === 'ENAM') {
                stylePattern = '%ENAM%';
            } else if (target === 'RESIDENTADO') {
                stylePattern = '%RESIDENTADO%';
            }

            const styleExamples = await RagService.getStyleExamples(stylePattern, 4); // ✅ Habilitado para todos
            if (styleExamples) {
                console.log(`🎨 RAG Style [${target}]: Recuperados ${styleExamples.length} bytes de ejemplos reales (${stylePattern}).`);
                if (styleExamples.length > 50) {
                    console.log(`🔍 Vista Previa RAG: "${styleExamples.substring(0, 150).replace(/\n/g, ' ')}..."`);
                }
            } else {
                console.warn(`⚠️ RAG Style: No se encontraron ejemplos para ${stylePattern}.`);
            }

            if (ragContext) {
                console.log(`🚀 RAG Local (Generador): Contexto inyectado p/ ${studyAreas}`);
            }

            // 3. Selección de Modelo por Tier (Control Financiero)
            const activeModel = this._getModelByTier(tier);

            const generationConfig = {
                maxOutputTokens: 8192,
                temperature: 0.7,
                responseMimeType: "application/json"
            };

            // 4. Definir reglas dinámicas por Target y Dificultad
            let targetRules = "";
            let levelInstruction = "";
            let starterGallery = ""; // ✅ Dinámico por target

            if (target === "ENAM") {
                targetRules = `PERFIL ENAM: Médico General - Enfoque Clínico y Diagnóstico.
                ENFOQUE: Clínica general, diagnóstico diferencial y manejo inicial basado en evidencia.
                JERARQUÍA DE FUENTES (DATA INTERNA): 1. GPC Oficiales (Minsa/EsSalud) > 2. Libros Clínicos (Harrison/Nelson/Williams) > 3. Manuales de Especialidad (AMIR/CTO) > 4. NTS/RM/Leyes.
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
                  * ESCENARIO OPERATIVO: "Usted se encuentra en Iñapari realizando visita domiciliaria...", "Como jefe del EESS se percata que hay productos vencidos...", "Se le encarga implementar servicios con pertinencia cultural..."
                  * GESTIÓN/NORMA: "El responsable del establecimiento recibe el stock...", "Según el PAI, la actividad de vigilancia...", "Dentro del marco del MCI, usted indica la prueba de..."
                  * PACIENTE DIVERSO: "Paciente joven de 30 años con tratamiento anti-TB...", "Mujer de 85 años hipertensa con antecedente de caída...", "Varón de 4 años procedente de Ucayali..."
                  * ENTORNO: "En una comunidad Aymara...", "En un establecimiento de la comunidad andina...", "Establecimiento de salud I-1 en Loreto..."
                  * DIRECTA: "¿Cuál es el procedimiento a seguir?", "¿Qué determinante de salud es más importante?", "¿Cuál es el plazo máximo...?"`;

                levelInstruction = "Estándar SERUMS. Evalúa Normativa, Gestión y Casos Clínicos de Comunidad. Explicación: 2 párrafos profundos con fuente oficial.";
            } else if (target === "RESIDENTADO") {
                targetRules = `PERFIL RESIDENTADO (ESPECIALIDAD): ENFOQUE EN LIBROS Y EVIDENCIA CLÍNICA.
                JERARQUÍA ESTRICTA (DATOS INTERNOS): 1. LIBROS DE REFERENCIA (Harrison, Washington, Nelson, Williams, etc.) y GPC Clínicas.
                2. MANUALES DE ESPECIALIDAD (AMIR, CTO).
                3. NORMAS (NTS) Y LEYES.
                REGLA DE ORO: La fundamentación DEBE priorizar el sustento clínico/fisiopatológico de los LIBROS en temas médicos.`;

                starterGallery = `
                  * PACIENTE (Complejo): "Varón con antecedente de cirrosis...", "Paciente polimedicado que...", "Mujer con clínica de..."
                  * FISIOPATOLÓGICO: "El mecanismo de acción de...", "La causa más frecuente de...", "La enzima responsable de..."
                  * ESCENARIO HOSPI: "Paciente en UCI presenta...", "Tras 24h de postoperatorio...", "Durante la laparotomía..."
                  * HALLAZGO AVANZADO: "El signo de (Epónimo) se asocia a...", "En el frotis de sangre periférica...", "La RM de encéfalo muestra..."
                  * DIRECTA: "¿Qué marcador tumoral...?", "¿Cuál es el Gold Standard para...?", "¿Qué gen está mutado en...?"`;

                levelInstruction = "Nivel Senior Residentado. Evalúa Fisiopatología, Manejo Avanzado y Especialidad. Explicación: 2 párrafos analíticos basados en bibliografía oficial.";
            }
            // 5. Prompt Maestro (Enfoque: Redactor de Exámenes Oficiales)
            const prompt = `
            Eres un Redactor Senior de Exámenes Médicos Nacionales (SERUMS, ENAM, RESIDENTADO).

            MISIÓN CRÍTICA: Generar ${amount} pregunta(s) INÉDITA(S) de Nivel Senior.
            ÁREA DE ESTUDIO ESTRICTA: **${studyAreas}**.

            [REGLAS DE ORO DE VARIABILIDAD (INQUEBRANTABLES)]
            1. PROHIBIDO iniciar más de 1 de cada 5 preguntas con "Comunero". 
            2. ROTACIÓN DE SUJETOS: Alterna entre: Gestante (incluye fórmula G_P____), Escolar, Adulto Mayor frágil, Reo en penal, Trabajador sexual, Autoridad local (Alcalde), Personal del EESS (Farmacéutico, Jefe de Puesto, Enfermera), Paciente con comorbilidades (Obeso, Alcohólico, Fumador).
            3. ESCENARIOS DIVERSOS: No todo es "Puesto I-1". Usa: C.S. Urbano marginal, Brigada de selva alta, Campamento minero, Auditoría de farmacia, Sala de Situación, Institución Educativa, Visita domiciliaria.
            4. RIGOR TÉCNICO: Incluye SIEMPRE datos de laboratorio o signos vitales específicos (Ej: "SatO2: 84%", "Hb: 9 g/dL", "Fe sérico: 30").

            [ESTILO DEL ENUNCIADO]
            - Estilo Directo y Seco (Estilo MINSA). 
            - Inicia con la situación antes que con el sujeto (Ej: "Durante la auditoría...", "Usted se encuentra en Iñapari...", "En la comunidad se observa...").
            - RESILIENCIA DE MEMORIA: Si una pregunta en el historial está marcada como "[Sin Subtema]", analiza su texto clínico para deducir el escenario evaluado y evítalo activamente (ej: cambia la patología, edad del paciente o entorno geográfico).
            - Alterna entre preguntas directas y enunciados para completar espacios (____).

            [REGLAS PARA LAS OPCIONES]
            - TEXTO LIMPIO: Sin letras ni prefijos (A., B., C.).
            - BREVEDAD: 1 a 12 palabras máximo.
            - SIMETRÍA VISUAL (OBLIGATORIO): Todas las opciones deben tener una longitud similar. Prohibido que la correcta sea la más larga.
            - DISTRACTORES DE ALTO NIVEL: Crea opciones "trampa" que sean técnicamente plausibles y relacionadas con el caso, evitando rellenos obvios.

            [EXPLICACIÓN (FUNDAMENTACIÓN)]
            - ${levelInstruction}
            - Usa CITACIÓN EN NEGRITA al inicio de cada párrafo fuente. VARÍA EL ESTILO (Ej: "**Según la NTS 123...**", "**De acuerdo a la RM...**", "**La Guía Técnica establece...**", "**Siguiendo lo dispuesto en...**").
            - SECCIÓN OBLIGATORIA (Solo para SERUMS): Finaliza SIEMPRE con el texto "💡 **TIP SERUMS:** [Consejo práctico sobre gestión o vida en comunidad]".

            [JERARQUÍA DE FUENTES Y ESTILO BASE]:
            ${targetRules}
            ${starterGallery}

            [DATOS DE APOYO RAG LOCAL (FUNDAMENTACIÓN)]:
            ${ragContext || "Usa tu base experta coherente con la jerarquía."}

            [ESTILO REAL DE EXAMEN (IMITA EL ENUNCIADO Y LA BREVEDAD DE SUS OPCIONES)]:
            ${styleExamples || "Estilo directo."}
            
            ${recentQuestionsText}

            [FORMATO DE SALIDA JSON (ARRAY)]:
            [{
                "topic": "${studyAreas}",
                "subtopic": "...",
                "difficulty": "Senior",
                "question_text": "...",
                "options": ${(target === 'RESIDENTADO') ? '["O1", "O2", "O3", "O4", "O5"]' : '["O1", "O2", "O3", "O4"]'},
                "correct_option_index": 0,
                "explanation": "2-3 párrafos técnicos con citado en negrita.",
                "domain": "${domain}",
                "target": "${target}",
                "career": "${career}",
                "visual_support_recommendation": "Recomendado: [Descripción corta de la imagen pertinente] o null"
            }]

            [REGLA DE PERTINENCIA VISUAL]:
            - Analiza si la explicación se beneficiaría de un soporte visual para reforzar el aprendizaje (ej: anatomía de órganos, trazados, placas, lesiones, diagramas de flujo, tablas comparativas, procesos fisiológicos, etc.). 
            - NO TE LIMITES a categorías fijas; recomienda cualquier recurso visual que mejore la retención del alumno.
            - Si es pertinente, coloca una recomendación breve. Si no, deja en blanco.

            DEVUELVE ÚNICA Y EXCLUSIVAMENTE EL JSON VÁLIDO. PROHIBIDO USAR MARKDOWN.
            `;

            const result = await activeModel.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
            });
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