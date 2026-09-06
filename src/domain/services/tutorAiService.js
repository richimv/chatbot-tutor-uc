const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const fs = require('fs');
const RagService = require('./ragService');
const chatPrompts = require('../prompts/chatPrompts');
const db = require('../../infrastructure/database/db'); // Mover al inicio
const securityUtils = require('../utils/securityUtils');
const mediaController = require('../../application/controllers/mediaController');

const { resolveGoogleAuthOptions } = require('../../infrastructure/config/googleCredentials');

/**
 * 🎓 TUTOR AI SERVICE V6.2: El Cerebro del Chat y Tutoría.
 * - Routing inteligente por especialización (medicine, education, neutral, flashcard_tutor).
 * - RAG Semántico (Pinecone) para medicina y educación.
 * - Catálogo Visual (Postgres/GCS) para imágenes de recursos.
 * - Detección de idioma para TTS dinámico.
 * - JSON estructurado nativo (responseMimeType).
 */
class TutorAiService {
    constructor() {
        resolveGoogleAuthOptions('TutorAiService');
        const project = process.env.GOOGLE_CLOUD_PROJECT || 'mock-gcp-project';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        try {
            this.vertex_ai = new VertexAI({ project, location });
            this.model = this.vertex_ai.getGenerativeModel({
                model: 'gemini-2.5-flash-lite',
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.8,
                    topP: 0.9,
                    responseMimeType: "application/json"
                }
            });
            console.log("✅ TutorAiService: Motor de Tutoría inicializado.");
        } catch (err) {
            console.warn("⚠️ TutorAiService: VertexAI no inicializado (Modo test o credenciales incompletas):", err.message);
            this.vertex_ai = null;
            this.model = null;
        }
    }

    /**
     * Busca recursos visuales (imágenes) relevantes en Postgres.
     * Solo busca en specializations que tienen recursos visuales (medicine, education).
     * Usa búsqueda por título + temas relacionados para mayor relevancia.
     * @param {string} query - El mensaje del usuario.
     * @param {string} specialization - 'medicine', 'education', etc.
     * @returns {string} Texto del catálogo visual para inyectar en el prompt, o '' si no hay.
     */
    async _searchVisualResources(topics, specialization) {
        try {
            const visualDomains = ['medicine', 'education'];
            if (!visualDomains.includes(specialization)) return '';

            // Usar temas expandidos o fallback a palabras clave
            const keywords = (topics && topics.length > 0)
                ? topics.map(t => t.toLowerCase()).slice(0, 5)
                : [];

            if (keywords.length === 0) return '';

            // Buscar por título del recurso Y por nombre del tema relacionado
            const conditions = keywords.map((_, i) => `(
                unaccent(LOWER(r.title)) LIKE unaccent(LOWER($${i + 1}))
                OR unaccent(LOWER(COALESCE(t.name, ''))) LIKE unaccent(LOWER($${i + 1}))
            )`).join(' OR ');

            const domainIndex = keywords.length + 1;
            const params = [...keywords.map(k => `%${k}%`), specialization];

            const sqlQuery = `
                SELECT DISTINCT r.title, r.image_url,
                       MAX(CASE 
                         WHEN unaccent(LOWER(r.title)) LIKE unaccent(LOWER($1)) THEN 100
                         WHEN unaccent(LOWER(COALESCE(t.name, ''))) LIKE unaccent(LOWER($1)) THEN 80
                         ELSE 50
                       END) as relevance
                FROM resources r
                LEFT JOIN topic_resources tr ON r.id = tr.resource_id
                LEFT JOIN topics t ON t.id = tr.topic_id
                WHERE r.resource_type = 'other' 
                  AND r.image_url IS NOT NULL
                  AND r.domain = $${domainIndex}
                  AND (${conditions})
                GROUP BY r.title, r.image_url
                ORDER BY relevance DESC
                LIMIT 5
            `;

            const { rows } = await db.query(sqlQuery, params);
            if (rows.length === 0) return '';

            const catalog = rows.map(r => `- RECURSO: "${r.title}" | URL: ${r.image_url}`).join('\n');
            console.log(`🖼️ [TutorAiService] ${rows.length} imagen(es) encontrada(s) para temas: ${keywords.join(', ')}`);

            return `\n\n[CATÁLOGO VISUAL DISPONIBLE - PRIORIDAD ALTA]\nInstrucción: Si alguno de estos títulos coincide con el tema principal, DEBES insertarlo. Recursos:\n${catalog}`;
        } catch (error) {
            console.warn('⚠️ [TutorAiService] Error buscando recursos visuales:', error.message);
            return '';
        }
    }

    /**
     * Extrae imágenes en base64 de un texto y resuelve imágenes de GCS / locales
     * a partir del texto y del objeto context (Quiz y Flashcards) para la API de Gemini.
     */
    async _extractMultimodalParts(text, context = null) {
        const parts = [];
        if (!text && !context) return { cleanedText: '', parts };

        const visitedSources = new Set();

        // 1. Extraer imágenes Base64 inline en el texto
        if (text) {
            const base64Regex = /data:(image\/[a-z0-9-+.]+);base64,([^"'\s)>]+)/gi;
            let match;
            while ((match = base64Regex.exec(text)) !== null) {
                const mimeType = match[1];
                const base64Data = match[2].replace(/\s/g, '');
                if (base64Data && !visitedSources.has(base64Data.substring(0, 40))) {
                    visitedSources.add(base64Data.substring(0, 40));
                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                }
            }
        }

        // 2. Extraer candidatos de URLs / GCS del texto y de context
        const rawCandidates = [];

        // De etiquetas <img src="..."> en el texto
        if (text) {
            const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            while ((match = imgSrcRegex.exec(text)) !== null) {
                rawCandidates.push(match[1]);
            }
        }

        // Del objeto context estructurado
        if (context) {
            if (context.caseImageUrl) rawCandidates.push(context.caseImageUrl);
            if (context.imageUrl) rawCandidates.push(context.imageUrl);
            if (context.explanationImageUrl) rawCandidates.push(context.explanationImageUrl);

            const extraTextFields = [
                context.caseDescription,
                context.case_description,
                context.front,
                context.questionText,
                context.question_text,
                context.question,
                context.back,
                context.explanation
            ];

            extraTextFields.forEach(field => {
                if (typeof field === 'string') {
                    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
                    let m;
                    while ((m = imgRegex.exec(field)) !== null) {
                        rawCandidates.push(m[1]);
                    }
                }
            });
        }

        // 3. Resolver candidatos de GCS / Local a buffers inlineData
        for (const candidate of rawCandidates) {
            if (!candidate || typeof candidate !== 'string') continue;
            if (parts.length >= 4) break; // Límite de seguridad: máx 4 imágenes por request

            if (candidate.startsWith('data:image/')) {
                const b64Match = candidate.match(/data:(image\/[a-z0-9-+.]+);base64,([^"'\s)>]+)/i);
                if (b64Match) {
                    const key = b64Match[2].substring(0, 40);
                    if (!visitedSources.has(key)) {
                        visitedSources.add(key);
                        parts.push({
                            inlineData: {
                                mimeType: b64Match[1],
                                data: b64Match[2].replace(/\s/g, '')
                            }
                        });
                    }
                }
                continue;
            }

            // Normalizar y extraer ruta GCS
            let gcsPath = null;
            if (candidate.includes('?file=')) {
                gcsPath = candidate.split('?file=')[1].split('&')[0];
            } else if (candidate.includes('?path=')) {
                gcsPath = candidate.split('?path=')[1].split('&')[0];
            } else if (!candidate.startsWith('http://') && !candidate.startsWith('https://') && !candidate.startsWith('/') && !candidate.startsWith('assets/')) {
                gcsPath = candidate;
            }

            if (gcsPath) {
                try {
                    gcsPath = decodeURIComponent(gcsPath).replace(/\\/g, '/');
                    if (visitedSources.has(gcsPath)) continue;
                    visitedSources.add(gcsPath);

                    const ext = path.extname(gcsPath).toLowerCase();
                    const mimeType = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/webp';

                    const bucket = mediaController.storage.bucket(mediaController.bucketName);
                    const file = bucket.file(gcsPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [buffer] = await file.download();
                        if (buffer && buffer.length > 0) {
                            parts.push({
                                inlineData: {
                                    mimeType,
                                    data: buffer.toString('base64')
                                }
                            });
                            console.log(`🖼️ [TutorAiService] Imagen GCS resuelta como inlineData: ${gcsPath} (${buffer.length} bytes)`);
                        }
                    }
                } catch (gcsErr) {
                    console.warn(`⚠️ [TutorAiService] No se pudo descargar imagen de GCS (${gcsPath}):`, gcsErr.message);
                }
                continue;
            }

            // Si es un asset local relativo (/assets/... o assets/...)
            if (candidate.startsWith('/assets/') || candidate.startsWith('assets/')) {
                try {
                    const cleanPath = candidate.replace(/^\/+/, '');
                    if (visitedSources.has(cleanPath)) continue;
                    visitedSources.add(cleanPath);

                    const localFullPath = path.join(__dirname, '../../presentation/public', cleanPath);
                    if (fs.existsSync(localFullPath)) {
                        const buffer = fs.readFileSync(localFullPath);
                        const ext = path.extname(cleanPath).toLowerCase();
                        const mimeType = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/webp';
                        parts.push({
                            inlineData: {
                                mimeType,
                                data: buffer.toString('base64')
                            }
                        });
                        console.log(`🖼️ [TutorAiService] Imagen local resuelta como inlineData: ${cleanPath}`);
                    }
                } catch (localErr) {
                    console.warn(`⚠️ [TutorAiService] Error leyendo asset local (${candidate}):`, localErr.message);
                }
            }
        }

        // Reemplazar la data URI base64 en el texto por un placeholder indexado
        const cleanedText = (text || '').replace(/data:(image\/[a-z0-9-+.]+);base64,([^"'\s)>]+)/gi, '[Imagen Adjunta]');

        return { cleanedText, parts };
    }

    /**
     * Ejecuta una llamada resiliente con reintentos hacia Gemini (REST / Vertex)
     */
    async _callModelResilient(contents, systemPrompt) {
        const apiKey = process.env.GEMINI_API_KEY;
        const maxRetries = 2;
        let delayMs = 1000;
        let lastError = null;

        // 1. Canal Primario Principal: Google Cloud Vertex AI (Gemini Enterprise Agent Platform)
        if (this.vertex_ai) {
            const vertexCandidateModels = [
                'gemini-2.5-flash-lite',
                'gemini-2.5-flash'
            ];
            console.log(`📡 [VertexAI Tutor] Conectando a Vertex AI (GCP Enterprise)...`);
            for (const modelName of vertexCandidateModels) {
                try {
                    const vertexModel = this.vertex_ai.getGenerativeModel({
                        model: modelName,
                        generationConfig: { maxOutputTokens: 8192, temperature: 0.8, topP: 0.9, responseMimeType: "application/json" }
                    });

                    const result = await vertexModel.generateContent({
                        contents,
                        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                    });
                    
                    if (result && result.response && result.response.candidates && result.response.candidates[0] && result.response.candidates[0].content) {
                        console.log(`✅ [VertexAI Tutor Éxito] Respuesta generada con modelo: ${modelName}`);
                        return result.response.candidates[0].content.parts[0].text;
                    }
                } catch (err) {
                    lastError = err;
                    console.warn(`⚠️ [VertexAI Tutor Fallo - ${modelName}]:`, err.message);
                }
            }
        }

        // 2. Canal Secundario de Contingencia: Google AI Studio REST
        if (apiKey) {
            const restCandidateModels = [
                'gemini-3.5-flash-lite',
                'gemini-3.1-flash-lite',
                'gemini-2.5-flash-lite'
            ];
            for (const modelName of restCandidateModels) {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const axios = require('axios');
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                        
                        // Sanitizar contents para asegurar partes no vacías
                        const sanitizedContents = (contents || []).map(c => ({
                            role: c.role === 'model' ? 'model' : 'user',
                            parts: (c.parts || []).map(p => {
                                if (p.inlineData) {
                                    return { inline_data: { mime_type: p.inlineData.mimeType, data: p.inlineData.data } };
                                }
                                return p;
                            }).filter(p => p.text || p.inline_data)
                        })).filter(c => c.parts.length > 0);

                        const payload = {
                            contents: sanitizedContents.length > 0 ? sanitizedContents : [{ role: 'user', parts: [{ text: 'Hola' }] }],
                            systemInstruction: {
                                parts: [{ text: systemPrompt }]
                            },
                            generationConfig: {
                                responseMimeType: "application/json",
                                temperature: 0.8,
                                maxOutputTokens: 8192,
                                topP: 0.9
                            }
                        };

                        console.log(`📡 [REST Tutor Contingencia] Llamando a ${modelName} vía Google AI Studio...`);
                        const res = await axios.post(url, payload, { timeout: 25000 });
                        
                        if (res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content) {
                            const text = res.data.candidates[0].content.parts[0].text;
                            console.log(`✅ [REST Tutor Éxito] Respuesta generada con modelo: ${modelName}`);
                            return text;
                        }
                        throw new Error("Respuesta inválida del servidor REST");
                    } catch (err) {
                        lastError = err;
                        const status = err.response ? err.response.status : null;
                        console.warn(`⚠️ [REST Tutor Fallo - ${modelName}]:`, err.message);
                        
                        if (status === 404 || status === 400 || status === 403) {
                            break;
                        }

                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                            delayMs *= 2;
                        }
                    }
                }
            }
        }

        console.error("❌ [TutorAiService] Todos los canales e intentos de IA fallaron.");
        throw lastError;
    }

    /**
     * Maneja la conversación del usuario con el Tutor.
     * @param {string} message - El mensaje del usuario.
     * @param {Array} history - Historial de la conversación.
     * @param {Object} filters - { target, specialization, namespace, userTier }
     */
    async handleChat(userMessage, history = [], filters = {}) {
        // 1. Extraer imágenes base64 y resolver imágenes GCS/locales del mensaje y del contexto (Quiz y Flashcards)
        const { cleanedText: preCleanedMessage, parts: imageParts } = await this._extractMultimodalParts(userMessage, filters.context);

        // 2. Sanitizar el mensaje limpio (soporta payloads de contexto de tarjetas/simulacro)
        const message = securityUtils.sanitizeInputForAI(preCleanedMessage, securityUtils.LIMITS.CONTEXT_TEXT);
        const conversationId = filters.conversationId || 'default';

        const target = (filters.target || "ENAM").toUpperCase();
        const specialization = filters.specialization || 'medicine';
        const namespace = filters.namespace || specialization;

        console.log(`🎓 [TutorAiService] Consulta (${specialization} | NS: ${namespace}): "${message.substring(0, 40)}..."`);

        try {
            // Inicializar caché si no existe (Persistencia de temas por conversación)
            if (!this._topicCache) this._topicCache = new Map();

            // 1. EXTRAER TEMAS INTELIGENTES (Solo para medicina y educación con RAG, no para flashcards multidisciplinarias)
            let smartTopics = [];
            let ragQuerySeed = message;
            if (filters.context && filters.context.type === 'quiz_tutor') {
                const qTopic = filters.context.topic || filters.context.area || '';
                const qText = (filters.context.questionText || '').replace(/<[^>]*>/g, ' ').trim();
                const studentDoubt = (filters.rawUserMessage || '').trim();
                ragQuerySeed = `${qTopic ? `Tema: ${qTopic}. ` : ''}${qText}. Consulta: ${studentDoubt}`.trim();
                if (!ragQuerySeed) ragQuerySeed = message;
            } else if (filters.rawUserMessage) {
                ragQuerySeed = filters.rawUserMessage;
            }

            if (specialization !== 'flashcard_tutor') {
                smartTopics = await RagService.extractSmartTerms(ragQuerySeed, specialization, target);
                
                // LÓGICA DE PERSISTENCIA: Si no hay temas nuevos pero hay historial, recuperar últimos temas
                if ((!smartTopics || smartTopics.length === 0 || smartTopics[0].toLowerCase() === 'ninguno') && this._topicCache.has(conversationId)) {
                    smartTopics = this._topicCache.get(conversationId);
                    console.log(`♻️ [TutorAiService] Reutilizando temas del cache para ${conversationId}: ${smartTopics.join(', ')}`);
                } else if (smartTopics && smartTopics.length > 0 && smartTopics[0].toLowerCase() !== 'ninguno') {
                    // Guardar nuevos temas técnicos en el caché
                    this._topicCache.set(conversationId, smartTopics);
                }
            }

            const mainSearchQuery = (smartTopics && smartTopics.length > 0) ? smartTopics.join(' ') : ragQuerySeed;
            console.log(`🧠 [TutorAiService] Temas finales: ${smartTopics?.join(', ') || 'ninguno'}`);

            // 2. Determinar Contexto de Estudio (Ruta Express vs RAG Híbrido Multiuso)
            let context = "";
            const resourceContext = filters.resourceContext || null;

            if (resourceContext) {
                // Modo Contexto de Recurso (Asistente de Voz / Chat del Recurso)
                const content = resourceContext.content_html || "";
                const plainText = content ? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                const isContentShort = plainText && plainText.length > 0 && plainText.length < 15000;

                if (isContentShort) {
                    console.log(`📚 [TutorAiService] Usando content_html de recurso directo (< 15k texto plano)`);
                    context = `--- CONTEXTO OFICIAL DEL RECURSO: "${resourceContext.title}" ---\n${plainText}\n\n[INSTRUCCIONES DE RESPUESTA]:\nResponde a la pregunta del usuario utilizando este material como tu base de verdad técnica primaria. Si la pregunta requiere profundizar o no está explícita aquí, usa tu experiencia clínica/pedagógica para dar una respuesta rica y veraz.`;
                } else if (filters.useRag !== false) {
                    console.log(`🔍 [TutorAiService] Usando RAG Semántico basado en el Título del Recurso: "${resourceContext.title}"`);
                    const questionRagService = require('./questionRagService');
                    
                    // Buscamos semánticamente en Pinecone usando el título del recurso y la consulta
                    context = await questionRagService.getStyleContextByKeywords(
                        specialization,
                        [`${resourceContext.title} ${mainSearchQuery}`],
                        8,
                        null,
                        resourceContext.title
                    );

                    // Fallback Generativo Experto basado en el título (Si RAG falló por completo)
                    if (!context || context.trim() === '') {
                        if (plainText && plainText.length > 0) {
                            console.log(`⚠️ [TutorAiService] RAG de título no disponible pero se usará plainText del recurso como fallback de contingencia.`);
                            context = `--- CONTEXTO OFICIAL DEL RECURSO (Fragmento Contingencia): "${resourceContext.title}" ---\n${plainText.substring(0, 20000)}\n\n[INSTRUCCIONES DE RESPUESTA]:\nResponde a la pregunta utilizando este fragmento del material como tu base primaria de verdad.`;
                        } else {
                            console.warn(`⚠️ [TutorAiService] RAG de título no disponible, usando fallback básico centrado en el título: "${resourceContext.title}"`);
                            context = `[MODO ASISTENTE DE RECURSO - FALLBACK GENERATIVO EXPERTO]
Tema principal de estudio: "${resourceContext.title}".
INSTRUCCIÓN CRÍTICA: El usuario te ha pedido resumir o responder una duda sobre el recurso titulado "${resourceContext.title}". Como el material completo no está indexado en la base vectorial ni en la base de datos, debes actuar como un especialista de élite en ${specialization} y generar una respuesta rica, detallada y perfectamente estructurada basándote estrictamente en tus conocimientos expertos sobre el tema exacto del título ("${resourceContext.title}").
🚨 REGLA DE ORO: TIENES ABSOLUTAMENTE PROHIBIDO decir "no tengo acceso al contenido", "proporcióname el enlace", "no puedo acceder a páginas web externas" o excusas similares. El usuario sabe que eres el tutor integrado. Responde directamente con el resumen o explicación experta del tema indicado en el título de forma proactiva para deslumbrarlo, usando viñetas o tablas Markdown.`;
                        }
                    }
                } else {
                    console.log(`⚠️ [TutorAiService] RAG desactivado por límite. Usando fallback generativo experto para recurso.`);
                    context = `[MODO ASISTENTE DE RECURSO - FALLBACK GENERATIVO EXPERTO]
Tema principal de estudio: "${resourceContext.title}".
INSTRUCCIÓN CRÍTICA: El usuario te ha pedido resumir o responder una duda sobre el recurso titulado "${resourceContext.title}". Como RAG está deshabilitado por límites, debes actuar como un especialista de élite en ${specialization} y generar una respuesta rica, detallada y perfectamente estructurada basándote en tus conocimientos expertos sobre el tema exacto del título ("${resourceContext.title}").`;
                }
            } else if (specialization === 'flashcard_tutor') {
                // Modo Tutor Flashcard Multidisciplinario (El contexto detallado ya fue inyectado en userMessage)
                console.log(`🧠 [TutorAiService] Modo flashcard_tutor activo. Disciplina: ${filters.category || 'General'}`);
                context = "";
            } else {
                // Modo Chat General (Normal RAG)
                const activeRAG = ['medicine', 'education'].includes(specialization) && filters.useRag !== false;
                if (activeRAG) {
                    // Pasamos predefinedTerms para evitar la doble llamada a la IA reescritora
                    context = await RagService.searchContextSmart(mainSearchQuery, 20, { 
                        mode: 'SEMANTIC', 
                        target,
                        namespace,
                        predefinedTerms: smartTopics
                    });
                }
            }

            // 3. Buscar imágenes (Solo para simuladores medicina/educación, nunca para flashcard_tutor multidisciplinario)
            let visualCatalog = '';
            if (specialization === 'medicine' || specialization === 'education') {
                visualCatalog = await this._searchVisualResources(smartTopics || [], specialization);
            }

            // 4. Construir prompt según la especialización
            const contextConImagenes = visualCatalog ? `${visualCatalog}\n\n${context}` : context;

            let systemPrompt = chatPrompts.buildPrompt(specialization, target, contextConImagenes);

            const contents = history.map(h => {
                const text = h.content || '';
                const cleanedText = text.replace(/data:(image\/[a-z0-9-+.]+);base64,([a-zA-Z0-9+/=\s\r\n]+?)(?=["'\s\)])/gi, '[Imagen]');
                return {
                    role: (h.role === 'user' || h.sender === 'user') ? 'user' : 'model',
                    parts: [{ text: cleanedText }]
                };
            });
            
            // Añadir mensaje actual limpio y adjuntar las imágenes extraídas como partes multimodales
            const userParts = [{ text: message }];
            if (imageParts && imageParts.length > 0) {
                userParts.push(...imageParts);
                console.log(`📸 [TutorAiService] Inyectadas ${imageParts.length} imágenes como partes multimodales.`);
            }
            contents.push({ role: 'user', parts: userParts });

            // 5. Generación de respuesta resiliente con reintentos y multicanal
            const rawText = await this._callModelResilient(contents, systemPrompt);

            // 6. Parsear la respuesta JSON de forma ultra-resiliente sin truncamiento por comillas internas
            const parsed = this._parseAiResponse(rawText);
            const sanitizedRespuesta = parsed.respuesta;

            // 7. Log de la respuesta (Debug Visual)
            if (sanitizedRespuesta && sanitizedRespuesta.includes('![')) {
                console.log('✅ [TutorAiService] IA insertó imagen en la respuesta.');
            } else {
                console.warn('⚠️ [TutorAiService] IA NO insertó ninguna imagen del catálogo.');
            }

            // Mapeo de fuentes según el dominio
            const sourcesMap = {
                'medicine': 'Biblioteca Médica Digital (NTS, GPC, Harrison)',
                'education': 'Biblioteca Magisterial (CNEB, Normas MINEDU, Pruebas de Ascenso)'
            };

            return {
                intencion: parsed?.intencion || `consulta_${specialization}`,
                respuesta: sanitizedRespuesta,
                sugerencias: Array.isArray(parsed?.sugerencias) ? parsed.sugerencias : [],
                idioma_detectado: parsed?.idioma_detectado || 'es',
                confianza: 0.9,
                contextUsed: !!context,
                sources: context ? (sourcesMap[specialization] || "Biblioteca Especializada") : "Conocimiento General"
            };

        } catch (error) {
            console.error('❌ Error en TutorAiService:', error.message);
            throw error;
        }
    }

    /**
     * Parsea la respuesta del modelo IA de forma ultra-resiliente.
     * Si el JSON viene con comillas dobles sin escapar dentro del texto en Markdown (ej. en opciones o citas pedagógicas),
     * extrae la respuesta completa mediante límites semánticos sin truncar ni cortar nada.
     */
    _parseAiResponse(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return { intencion: 'consulta', respuesta: '', sugerencias: [], idioma_detectado: 'es' };
        }

        let text = rawText.trim();

        // 1. Quitar bloques de código Markdown si envuelven el JSON (```json ... ```)
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
            text = codeBlockMatch[1].trim();
        }

        // 2. Intento 1: Parseo JSON directo estándar
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.respuesta === 'string' && parsed.respuesta.trim()) {
                return {
                    intencion: parsed.intencion || 'consulta',
                    respuesta: this._cleanResponseText(parsed.respuesta),
                    sugerencias: Array.isArray(parsed.sugerencias) ? parsed.sugerencias : [],
                    idioma_detectado: parsed.idioma_detectado || 'es'
                };
            }
        } catch (e) {
            // Continuar a la extracción semántica defensiva
        }

        // 3. Intento 2: Extracción semántica por límites de clave sin truncamiento por comillas internas
        const respKeyMatch = text.match(/"respuesta"\s*:\s*"/i);
        if (respKeyMatch) {
            const valueStartIndex = respKeyMatch.index + respKeyMatch[0].length;
            const remainder = text.substring(valueStartIndex);

            // El valor de "respuesta" termina antes de la siguiente clave del esquema o antes de la llave de cierre final
            const boundaryRegex = /",\s*"(?:sugerencias|idioma_detectado|intencion|confianza|sources|contextUsed)"\s*:|"\s*\}\s*$/i;
            const boundaryMatch = remainder.match(boundaryRegex);

            let extractedRespuesta = '';
            if (boundaryMatch) {
                extractedRespuesta = remainder.substring(0, boundaryMatch.index);
            } else {
                const lastBraceIdx = remainder.lastIndexOf('}');
                if (lastBraceIdx !== -1) {
                    const quoteBefore = remainder.lastIndexOf('"', lastBraceIdx);
                    extractedRespuesta = quoteBefore !== -1 ? remainder.substring(0, quoteBefore) : remainder.substring(0, lastBraceIdx);
                } else {
                    extractedRespuesta = remainder;
                }
            }

            // Extraer sugerencias si existen
            let sugerencias = [];
            const sugMatch = text.match(/"sugerencias"\s*:\s*\[([\s\S]*?)\]/i);
            if (sugMatch && sugMatch[1]) {
                try {
                    sugerencias = JSON.parse(`[${sugMatch[1]}]`);
                } catch (err) {}
            }

            let intencion = 'consulta';
            const intMatch = text.match(/"intencion"\s*:\s*"([^"]+)"/i);
            if (intMatch && intMatch[1]) intencion = intMatch[1];

            let idioma = 'es';
            const langMatch = text.match(/"idioma_detectado"\s*:\s*"([^"]+)"/i);
            if (langMatch && langMatch[1]) idioma = langMatch[1];

            return {
                intencion,
                respuesta: this._cleanResponseText(extractedRespuesta),
                sugerencias,
                idioma_detectado: idioma
            };
        }

        // 4. Fallback si no hay estructura JSON identificable: devolver el texto tal cual
        return {
            intencion: 'consulta',
            respuesta: this._cleanResponseText(text),
            sugerencias: [],
            idioma_detectado: 'es'
        };
    }

    /**
     * Sanitiza el texto de respuesta final para evitar cualquier contaminación de JSON,
     * llaves/corchetes residuales o escapes literales de saltos de línea sin romper LaTeX.
     */
    _cleanResponseText(text) {
        if (!text || typeof text !== 'string') return '';
        let cleaned = text.trim();

        // 1. Si el texto viene con bloques de código json
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
            cleaned = codeBlockMatch[1].trim();
        }

        // 2. Si el texto sigue siendo un string JSON, extraer su valor mediante boundaries seguros
        if (cleaned.startsWith('{') && (cleaned.includes('"respuesta"') || cleaned.includes('"intencion"'))) {
            try {
                const parsed = JSON.parse(cleaned);
                if (parsed && typeof parsed.respuesta === 'string') {
                    cleaned = parsed.respuesta;
                }
            } catch (e) {
                const respKeyMatch = cleaned.match(/"respuesta"\s*:\s*"/i);
                if (respKeyMatch) {
                    const valStart = respKeyMatch.index + respKeyMatch[0].length;
                    const remainder = cleaned.substring(valStart);
                    const boundaryMatch = remainder.match(/",\s*"(?:sugerencias|idioma_detectado|intencion|confianza|sources|contextUsed)"\s*:|"\s*\}\s*$/i);
                    if (boundaryMatch) {
                        cleaned = remainder.substring(0, boundaryMatch.index);
                    } else {
                        const lastBraceIdx = remainder.lastIndexOf('}');
                        if (lastBraceIdx !== -1) {
                            const quoteBefore = remainder.lastIndexOf('"', lastBraceIdx);
                            cleaned = quoteBefore !== -1 ? remainder.substring(0, quoteBefore) : remainder.substring(0, lastBraceIdx);
                        }
                    }
                }
            }
        }

        // 3. Normalizar saltos de línea y comillas escapadas sin destruir comandos LaTeX (\neq, \nabla, \nu, \times, \theta, etc.)
        cleaned = cleaned
            .replace(/\\r\\n/g, '\n')
            .replace(/\r\n/g, '\n')
            .replace(/\\"/g, '"');

        // Convertir secuencias \n literales a saltos reales preservando comandos LaTeX específicos que inician con 'n' (\neq, \nabla, \nu, etc.)
        const latexNRemainders = 'eq|abla|eg|u|otin|i|ull|exists|rightarrow|leftarrow|subseteq|supseteq|less|gtr|leq|geq|sim|cong|mid|atural';
        const latexNRegex = new RegExp(`\\\\n(?!(?:${latexNRemainders})\\b)`, 'g');
        cleaned = cleaned.replace(latexNRegex, '\n');

        // 4. Limpiar fragmentos residuales de JSON al inicio o final
        cleaned = cleaned
            .replace(/^\s*\{\s*"respuesta"\s*:\s*"/i, '')
            .replace(/^\s*\{\s*"intencion"\s*:\s*"[^"]*",\s*"respuesta"\s*:\s*"/i, '')
            .replace(/"\s*,\s*"sugerencias"[\s\S]*\}\s*$/i, '')
            .replace(/"\s*\}\s*$/i, '');

        return cleaned.trim();
    }


    /**
     * Genera un título corto para una conversación.
     */
    async generateConversationTitle(userMessage, botResponse) {
        try {
            console.log("📝 [TutorAiService] Generando título automático...");

            const prompt = `Analiza el primer intercambio de un chat y genera un título corto, elegante y descriptivo de máximo 5 palabras.
            Usuario: ${userMessage}
            IA: ${botResponse.substring(0, 150)}...
            
            Devuelve un JSON con el campo "titulo".`;

            const contents = [{ role: 'user', parts: [{ text: prompt }] }];
            const systemInstruction = "Eres un experto en síntesis de contenido. Generas títulos para chats de medicina y educación.";
            const rawText = await this._callModelResilient(contents, systemInstruction);

            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch (e) {
                const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
                try {
                    parsed = JSON.parse(cleaned);
                } catch (e2) {
                    parsed = { titulo: userMessage.substring(0, 30) };
                }
            }

            return parsed.titulo || userMessage.substring(0, 30);
        } catch (error) {
            console.error("⚠️ Error generando título:", error.message);
            return userMessage.substring(0, 30) + "...";
        }
    }
}

module.exports = new TutorAiService();
