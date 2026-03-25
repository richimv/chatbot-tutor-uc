const { VertexAI } = require('@google-cloud/vertexai');
const MLService = require('./mlService');

// === CONFIGURACIÓN VERTEX AI (Igual que MLService) ===
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;

if (!project || !location) {
    console.error('❌ FATAL (QuizService): GOOGLE_CLOUD_PROJECT y LOCATION deben estar definidos en .env');
}

// Inicializar Cliente Vertex AI
const vertex_ai = new VertexAI({ project: project, location: location });

// Instancia Unificada a LITE
const modelLite = vertex_ai.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.4,
        responseMimeType: 'application/json'
    },
});

const modelStandard = modelLite; // ✅ UNIFICADO A LITE

class QuizService {

    /**
     * Genera un batch de preguntas de trivia usando Vertex AI (Motor Dual).
     * @param {string} topic 
     * @param {number} roundNumber
     * @param {string} tier
     */
    async generateRound(topic, roundNumber = 1, tier = 'free') {
        const activeModel = (tier === 'admin') ? modelStandard : modelLite;
        console.log(`🎲 [Trivia IA] Usando modelo ${tier === 'admin' ? 'Estándar' : 'Lite'} para Tier: ${tier}`);
        
        try {
            // --- FLUJO TRIVIA GENERAL ---
            const basePrompt = `
                Actúa como un experto en trivia y educación dinámica de alto nivel.
                
                CONTEXTO:
                - Tema: ${JSON.stringify(topic)}
                - Nivel: Profesional / Senior

                TU MISIÓN:
                Genera 5 preguntas de opción múltiple de alta calidad.
                
                REGLAS DE ORO:
                1. EXPLICACIÓN PEDAGÓGICA (EXTENSA): Para cada pregunta, proporciona un feedback educativo nutritivo de MÍNIMO 2 párrafos que explique el "por qué" de la respuesta y aporte datos adicionales interesantes.
                2. DIVERSIDAD: No repitas conceptos básicos.
                3. PRECISIÓN: Las respuestas deben ser técnicamente correctas.
                4. SIN LÍMITES DE CARACTERES: Prioriza la calidad y profundidad sobre la brevedad.
                5. COMPLEXIDAD: ${roundNumber > 2 ? 'Aumenta la profundidad técnica y casos de borde.' : 'Enfócate en conceptos clave y aplicaciones prácticas.'}

                FORMATO DE SALIDA (JSON Array Puro):
                [
                    {
                        "question": "¿Pregunta interesante y desafiante?",
                        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
                        "correctAnswerIndex": 1,
                        "timeLimit": 30,
                        "educationalFeedback": "Explicación detallada, nutritiva y pedagógica de al menos 2 párrafos."
                    }
                ]
                IMPORTANT: Return ONLY valid JSON.
                `;

            const result = await activeModel.generateContent(basePrompt);
            const text = result.response.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();

            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');
            let allQuestions = [];
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                try {
                    allQuestions = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
                } catch (e) {
                    console.error("⚠️ Error parseando JSON de QuizService:", e.message);
                    throw new Error("Error en el formato de respuesta de la IA.");
                }
            }

            // 🎲 ALGORITMO DE MEZCLA (Fisher-Yates) PARA OPCIONES
            allQuestions = allQuestions.map(q => {
                const correctAnswerText = q.options[q.correctAnswerIndex];
                for (let i = q.options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
                }
                q.correctAnswerIndex = q.options.indexOf(correctAnswerText);
                return q;
            });

            return allQuestions;

        } catch (error) {
            console.error("❌ Error generando Quiz con Vertex AI:", error);
            throw new Error("Falló la generación del Quiz con IA.");
        }
    }
}

module.exports = new QuizService();
