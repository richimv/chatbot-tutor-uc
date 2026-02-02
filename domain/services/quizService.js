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
        temperature: 0.4,
        topP: 0.9,
        responseMimeType: 'application/json' // ✅ JSON Mode Activado para estabilidad
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
            // Matriz de Dificultad ACADÉMICA (Nivel Universitario a Doctorado)
            const difficultyMatrix = {
                'Básico': {
                    1: 'Nivel Pregrado (1er Año): Definiciones y conceptos fundamentales.',
                    2: 'Nivel Pregrado (2do Año): Relación básica de conceptos.',
                    3: 'Nivel Pregrado (Final): Aplicación directa de teoría.',
                    4: 'Nivel Pregrado: Casos de estudio simples.',
                    5: 'Nivel Licenciatura: Integración de conocimientos básicos.'
                },
                'Profesional': {
                    1: 'Nivel Maestría: Análisis crítico de teorías estándar.',
                    2: 'Nivel Maestría: Aplicación en escenarios laborales reales.',
                    3: 'Nivel Especialización: Resolución de conflictos técnicos.',
                    4: 'Nivel Docente: Explicación de fenoménos complejos.',
                    5: 'Nivel Experto Técnico: Casos de borde y excepciones.'
                },
                'Experto': {
                    1: 'Nivel Doctorado (PhD): Evaluación de evidencia contradictoria.',
                    2: 'Nivel Investigación: Metodologías avanzadas y estado del arte.',
                    3: 'Nivel Consultor Senior: Estrategia y toma de decisiones bajo incertidumbre.',
                    4: 'Nivel Eminencia: Innovación y crítica de paradigmas actuales.',
                    5: 'Nivel "Pesadilla Académica": Detalles oscuros, historia profunda o casos clínicos únicos.'
                }
            };

            // Selección de dificultad segura
            let selectedDiff = difficulty || 'Básico';
            if (!difficultyMatrix[selectedDiff]) selectedDiff = 'Básico';

            const complexityGuide = difficultyMatrix[selectedDiff][Math.min(roundNumber, 5)] || difficultyMatrix['Básico'][1];

            // ⚠️ LIMITACIÓN DE TOKENS: Restricción estricta de longitud en feedback
            const basePrompt = `
                Actúa como un catedrático universitario exigente y experto en la materia.
                
                CONTEXTO:
                - Tema: ${JSON.stringify(topic)}
                - Audiencia: Estudiantes universitarios, Docentes y Doctorandos.
                - Nivel Seleccionado: ${selectedDiff}
                - Ronda Actual: ${roundNumber} de 5.

                TU MISIÓN:
                Genera 5 preguntas de opción múltiple siguiendo ESTRICTAMENTE este nivel de complejidad acadèmica:
                "${complexityGuide}"

                REGLAS DE ORO (ANTI-REPETICIÓN Y ECONOMÍA):
                1. CONCISIÓN EXTREMA: Preguntas detalladas según el nivel, máximo 320 caracteres. Opciones no muy cortas, ni extensas.
                2. DIVERSIDAD: No repitas conceptos.
                3. CONSISTENCIA: Mantén el nivel académico alto, pero sé breve.
                4. PRECISIÓN: Las respuestas deben ser técnicamente correctas.
                5. FEEDBACK LIMITADO: Limita el 'educationalFeedback' a MÁXIMO 250 CARACTERES. Solo la idea central.

                FORMATO DE SALIDA (JSON Array Puro):
                [
                    {
                        "question": "¿Pregunta académica rigurosa y corta?",
                        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
                        "correctAnswerIndex": 1,
                        "timeLimit": 45,
                        "educationalFeedback": "Explicación académica muy breve (Máx 250 chars)."
                    }
                ]
                IMPORTANT: Return ONLY valid JSON.
                `;

            // Batch 1: Enfoque Conceptual
            const promptBatch1 = `${basePrompt}\nENFOQUE ESPECÍFICO BATCH A: Céntrate en **Teoría, Historia y Definiciones**. Sobre todo, teoría y definiciones. No incluyas casos prácticos.`;

            // Batch 2: Enfoque Aplicado
            const promptBatch2 = `${basePrompt}\nENFOQUE ESPECÍFICO BATCH B: Céntrate en **Aplicación Práctica y Problemas**.`;

            // Ejecución Paralela (2 workers)
            const [result1, result2] = await Promise.all([
                model.generateContent(promptBatch1),
                model.generateContent(promptBatch2)
            ]);

            const parseResponse = (result) => {
                let text = result.response.candidates[0].content.parts[0].text;
                // Limpieza agresiva de markdown
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();

                // Extracción segura del JSON Array [...]
                const jsonStart = text.indexOf('[');
                const jsonEnd = text.lastIndexOf(']');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    text = text.substring(jsonStart, jsonEnd + 1);
                }

                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("⚠️ Error parseando JSON de un batch:", e.message);
                    return [];
                }
            };

            const questions1 = parseResponse(result1);
            const questions2 = parseResponse(result2);

            // Unión de resultados
            let allQuestions = [...questions1, ...questions2];

            // Validación final
            if (allQuestions.length < 5) {
                throw new new Error("La IA no pudo generar suficientes preguntas válidas. Intenta de nuevo.");
            }

            // 🎲 ALGORITMO DE MEZCLA (Fisher-Yates) PARA OPCIONES
            // Soluciona el problema de "Siempre es la B" reordenando las respuestas manualmente.
            allQuestions = allQuestions.map(q => {
                const correctAnswerText = q.options[q.correctAnswerIndex]; // Guardar texto correcto

                // Mezclar opciones
                for (let i = q.options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
                }

                // Encontrar nuevo índice de la respuesta correcta
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
