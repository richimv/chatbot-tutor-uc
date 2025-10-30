const { GoogleGenerativeAI } = require('@google/generative-ai');
const CourseRepository = require('../repositories/courseRepository'); // Importar CourseRepository
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// === INICIO: VERIFICACIÓN DE API KEY ===
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ FATAL: La variable de entorno GEMINI_API_KEY no está definida.');
    console.error('Asegúrate de que tienes un archivo .env en la raíz del proyecto con "GEMINI_API_KEY=TU_CLAVE_AQUI"');
} else {
    // Muestra solo una parte de la clave por seguridad
    console.log(`✅ GEMINI_API_KEY cargada correctamente (termina en: ...${apiKey.slice(-4)})`);
}
// === FIN: VERIFICACIÓN DE API KEY ===

const genAI = new GoogleGenerativeAI(apiKey);

// --- Constantes para los scripts de Python ---
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PREDICTORS_PATH = path.join(__dirname, '..', '..', 'ml_service', 'predictors');

class MLService {
    /**
     * Procesa un mensaje de usuario usando un Modelo de Lenguaje Grande (LLM).
     * Ya no solo clasifica, sino que genera una respuesta conversacional y extrae la intención.
     * @param {string} text - El mensaje del usuario.
     * @param {Array<object>} conversationHistory - El historial de la conversación para dar contexto.
     * @returns {Promise<object>} Un objeto con la respuesta, la intención y la confianza.
     */
    static async classifyIntent(text, conversationHistory = []) {
        console.log('🤖 MLService: Generando respuesta con LLM para:', text);

        try {
            // Instancia del repositorio de cursos para la herramienta
            const courseRepository = new CourseRepository();

            const model = genAI.getGenerativeModel({
                // Usamos un modelo estable y compatible con herramientas.
                model: "gemini-1.0-pro",
                // ✅ RE-INTRODUCIMOS LAS HERRAMIENTAS
                tools: [{
                    function_declarations: [{
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
                    }]
                }]
            });
            console.log('🤖 MLService: Modelo configurado:', model.model); // Verificación del modelo

            // === INICIO: LÓGICA DE CONVERSACIÓN CON HERRAMIENTAS ===

            // 1. Instrucción de sistema: Ahora le decimos que use la herramienta.
            const systemInstruction = {
                role: 'user',
                parts: [{ text: `Eres "Tutor IA UC", un asistente experto de la Universidad Continental. Tu propósito es ayudar a los estudiantes.
                **Regla Crítica:** Para obtener información sobre cursos, docentes, horarios o materiales, DEBES usar la herramienta 'getCourseDetails'. No inventes información.
                **Formato de Salida Obligatorio:** Tu respuesta final DEBE ser un único objeto JSON válido, sin texto adicional.
                El JSON debe tener esta estructura:
                {
                  "intencion": "[consulta_horario|solicitar_material|duda_teorica|consulta_evaluacion|consulta_administrativa|consulta_general]",
                  "confianza": 0.9, // Tu confianza en la clasificación de la intención
                  "respuesta": "Tu respuesta amable y detallada aquí.",
                  "sugerencias": ["Sugerencia 1", "Sugerencia 2"]
                }`
                }]
            };

            // 2. Formatear el historial y empezar la sesión de chat.
            const historyForAPI = conversationHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            const chat = model.startChat({ history: [systemInstruction, ...historyForAPI] });
            let result = await chat.sendMessage(text);

            // 3. Bucle para manejar las llamadas a herramientas.
            while (result.response.functionCalls) {
                const functionCalls = result.response.functionCalls; // CORRECCIÓN: Es una propiedad, no un método.
                console.log(`🛠️ Gemini solicitó la herramienta: ${functionCalls[0].name}`);

                const call = functionCalls[0];
                if (call.name === 'getCourseDetails') {
                    const courseDetails = await courseRepository.search(call.args.courseName);
                    console.log('🔍 Resultado de la herramienta:', courseDetails);

                    // CORRECCIÓN FINAL: El SDK espera que `response` contenga directamente los datos, no un objeto anidado.
                    result = await chat.sendMessage([{
                        functionResponse: {
                            name: 'getCourseDetails',
                            response: { courseDetails }
                        }
                    }]);
                } else {
                    throw new Error(`Herramienta no reconocida: ${call.name}`);
                }
            }

            // 4. Procesar la respuesta final de Gemini.
            const responseText = result.response.text();
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error(`La respuesta del LLM no contiene un JSON válido: ${responseText}`);
            }
            const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
            const parsedResult = JSON.parse(jsonString);
            return parsedResult;
            
            // === FIN: LÓGICA DE CONVERSACIÓN CON HERRAMIENTAS ===

        } catch (error) {
            console.error('❌ Error en MLService al contactar al LLM:', error);
            // Devolver una respuesta de error estandarizada
            return {
                intencion: 'error_general',
                confianza: 1.0,
                respuesta: 'Lo siento, estoy teniendo problemas para conectarme con mi cerebro de IA en este momento. Por favor, intenta de nuevo en unos instantes.'
            };
        }
    }

    /**
     * Obtiene recomendaciones de cursos y temas relacionados ejecutando scripts de Python.
     * @param {string} query - La consulta de búsqueda del usuario.
     * @param {string[]} directResultsIds - IDs de los cursos ya encontrados en la búsqueda directa.
     * @returns {Promise<object>} Un objeto con `relatedCourses` y `relatedTopics`.
     */
    static async getRecommendations(query, directResultsIds = []) {
        console.log(`🤖 MLService: Obteniendo recomendaciones para "${query}"`);
        try {
            const coursesDataPath = path.join(__dirname, '..', '..', 'infrastructure', 'database', 'courses.json');
            const coursesData = JSON.parse(await fs.readFile(coursesDataPath, 'utf-8'));

            // Ejecutar predictores contextuales en paralelo. Los predictores de popularidad ya no se llaman aquí.
            const [relatedCourses, relatedTopics] = await Promise.all([
                this._runPythonPredictor('related_course_predictor.py', { query, direct_results_ids: directResultsIds, courses: coursesData }),
                this._runPythonPredictor('related_topic_predictor.py', { query, courses: coursesData })
            ]);

            return {
                relatedCourses,
                relatedTopics
                // Ya no se devuelven popularCourses y popularTopics desde aquí.
            };
        } catch (error) {
            console.error('❌ Error en MLService al obtener recomendaciones:', error);
            return { relatedCourses: [], relatedTopics: [], popularCourses: [], popularTopics: null }; // Devolver vacío en caso de error
        }
    }

    /**
     * Helper para ejecutar un script de Python y obtener su salida JSON.
     * @param {string} scriptName - Nombre del archivo del predictor.
     * @param {object} data - Datos a enviar al script vía stdin.
     * @returns {Promise<any>} El resultado JSON del script.
     */
    static _runPythonPredictor(scriptName, data) {
        return new Promise((resolve, reject) => {
            // ✅ SOLUCIÓN: Ejecutar como un módulo (-m) para resolver los imports relativos de Python.
            // 1. Convertir la ruta del script a un nombre de módulo (e.g., ml_service.predictors.script_name)
            const moduleName = `ml_service.predictors.${scriptName.replace('.py', '')}`;
            
            // 2. Establecer el directorio de trabajo en la raíz del proyecto para que Python encuentre el paquete 'ml_service'.
            const projectRoot = path.join(__dirname, '..', '..');

            const pythonProcess = spawn(PYTHON_PATH, ['-m', moduleName], {
                cwd: projectRoot, // Directorio de trabajo
                env: {
                    ...process.env,
                    // Asegurarse de que PYTHONPATH incluya la raíz del proyecto si es necesario.
                    PYTHONPATH: projectRoot,
                },
            });

            let result = '';
            let error = '';

            pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
            pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

            pythonProcess.on('close', (code) => {
                if (code !== 0) return reject(new Error(`Script ${scriptName} falló con código ${code}: ${error}`));
                try { resolve(JSON.parse(result)); } catch (e) { reject(new Error(`Error parseando JSON de ${scriptName}: ${e.message}`)); }
            });

            pythonProcess.stdin.write(JSON.stringify(data));
            pythonProcess.stdin.end();
        });
    }

    /**
     * Genera una descripción concisa y académica para un curso específico.
     * @param {string} courseName - El nombre del curso.
     * @returns {Promise<string>} La descripción generada.
     */
    static async generateCourseDescription(courseName) {
        console.log(`🤖 MLService: Generando descripción para el curso: "${courseName}"`);
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const prompt = `Como un experto académico y redactor de planes de estudio, crea una descripción atractiva y concisa (aproximadamente 3 a 4 frases) para el curso universitario llamado "${courseName}". La descripción debe explicar de qué trata el curso, sus objetivos principales y qué aprenderán los estudiantes. El tono debe ser profesional pero accesible.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const description = response.text();

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
     * @param {string} topicName - El nombre del tema.
     * @returns {Promise<string>} La descripción generada.
     */
    static async generateTopicDescription(topicName) {
        console.log(`🤖 MLService: Generando descripción para el tema: "${topicName}"`);
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const prompt = `Como un experto académico, explica brevemente (en 2 o 3 frases) de qué trata el tema "${topicName}" en un contexto universitario. Sé claro y conciso.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const description = response.text();
            
            if (!description) {
                throw new Error("La respuesta de la IA estaba vacía.");
            }

            console.log(`✅ Descripción generada para "${topicName}"`);
            return description;

        } catch (error) {
            console.error(`❌ Error en MLService al generar descripción para "${topicName}":`, error);
            // Devolver un mensaje de error genérico si la IA falla
            return "No se pudo generar una descripción en este momento. Inténtalo de nuevo más tarde.";
        }
    }

    // El método trainModel ya no es necesario, puedes eliminarlo.
    static async trainModel() {
        console.warn('⚠️ El entrenamiento del modelo local ya no es necesario con la nueva arquitectura LLM.');
        return Promise.resolve({
            success: true,
            message: 'El entrenamiento del modelo local está obsoleto. El sistema ahora usa un LLM externo.'
        });
    }
}

module.exports = MLService;