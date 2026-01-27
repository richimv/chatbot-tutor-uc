const { VertexAI } = require('@google-cloud/vertexai');

// === CONFIGURACIÓN VERTEX AI (Igual que MLService) ===
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;

if (!project || !location) {
    console.error('❌ FATAL (QuizService): GOOGLE_CLOUD_PROJECT y LOCATION deben estar definidos en .env');
}

// Inicializar Cliente Vertex AI
const vertex_ai = new VertexAI({ project: project, location: location });

// Instanciar Modelo "gemini-2.5-flash" (Preview en Vertex)
const model = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.4, // Un poco más creativo que el bibliotecario (0.3) para preguntas variadas
        topP: 0.9,
    },
});

class QuizService {

    /**
     * Genera un batch de preguntas de trivia usando Vertex AI (Gemini 2.5 Flash).
     * @param {string} topic 
     * @param {string} difficulty 
     */
    async generateRound(topic, difficulty, roundNumber = 1) {
        try {
            // Matriz de Dificultad Dinámica Estricta
            const difficultyMatrix = {
                'Básico': {
                    1: 'Nivel Fácil (Conceptos fundamentales)',
                    2: 'Nivel Fácil-Medio',
                    3: 'Nivel Medio (Aplicación simple)',
                    4: 'Nivel Medio',
                    5: 'Nivel Medio-Alto'
                },
                'Profesional': {
                    1: 'Nivel Medio (Aplicación estándar)',
                    2: 'Nivel Medio-Alto',
                    3: 'Nivel Alto (Análisis)',
                    4: 'Nivel Alto',
                    5: 'Nivel Difícil (Casos complejos)'
                },
                'Experto': {
                    1: 'Nivel Alto (Análisis profundo)',
                    2: 'Nivel Difícil',
                    3: 'Nivel Muy Difícil (Evaluación)',
                    4: 'Nivel Experto',
                    5: 'Nivel Pesadilla / Caso Clínico Real / Investigación'
                }
            };

            // Lógica de Dificultad Dinámica: Si llega 'Dynamic', calculamos según la ronda
            let selectedDiff = difficulty;
            if (!selectedDiff || selectedDiff === 'Dynamic') {
                if (roundNumber >= 5) selectedDiff = 'Experto';
                else if (roundNumber >= 3) selectedDiff = 'Profesional';
                else selectedDiff = 'Básico';
            }

            // Fallback de seguridad si la key no existe
            if (!difficultyMatrix[selectedDiff]) selectedDiff = 'Básico';

            const currentR = roundNumber || 1;

            // Acceso seguro a la matriz
            const complexityGuide = difficultyMatrix[selectedDiff][Math.min(currentR, 5)] || difficultyMatrix['Básico'][1];

            const prompt = `
            Actúa como un profesor experto y duro. El usuario ha seleccionado el nivel de dificultad: ${selectedDiff}. Estamos en la Ronda ${currentR} de 5.
            
            Tu objetivo es generar 10 preguntas que sigan ESTRICTAMENTE esta guía de complejidad:
            "${complexityGuide}"
            
            INSTRUCCIÓN CLAVE: Genera preguntas progresivas. Nunca bajes el nivel seleccionado. Si es experto, sé implacable.

            Tema: "${topic}".
            
            FORMATO DE SALIDA: JSON Array Estricto. NO incluyas markdown, ni comillas invertidas extra. Solo el JSON plano.
            
            Estructura de cada objeto en el array:
            {
                "question": "Texto de la pregunta (sea académico pero entretenido, adaptado a la ronda y dificultad)",
                "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
                "correctAnswerIndex": 0, (0-3 indicando la correcta),
                "timeLimit": (Número entre 30 y 60 segundos),
                "educationalFeedback": "Breve explicación de por qué es la correcta"
            }
            `;

            // Llamada a Vertex AI
            const result = await model.generateContent(prompt);
            const response = result.response;
            const candidate = response.candidates[0].content.parts[0].text;

            if (!candidate) throw new Error("La API de Vertex AI no devolvió texto.");

            // Limpieza robusta de JSON (Markdown code blocks)
            let text = candidate.replace(/```json/g, '').replace(/```/g, '').trim();

            // Intento de parsing
            let questions;
            try {
                questions = JSON.parse(text);
            } catch (e) {
                console.warn("⚠️ JSON malformado de Gemini, intentando reparar...", text);
                // Si falla, es posible que haya texto antes o después del JSON
                const jsonStart = text.indexOf('[');
                const jsonEnd = text.lastIndexOf(']');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    text = text.substring(jsonStart, jsonEnd + 1);
                    questions = JSON.parse(text);
                } else {
                    throw e;
                }
            }

            return questions;

        } catch (error) {
            console.error("❌ Error generando Quiz con Vertex AI:", error);
            throw new Error("Falló la generación del Quiz con IA.");
        }
    }
}

module.exports = new QuizService();
