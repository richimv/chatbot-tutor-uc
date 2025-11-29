const { normalizeText, stemmer } = require('../utils/textUtils');
const levenshtein = require('fast-levenshtein');

/**
 * ✅ REFACTOR COMPLETO: Predictor de temas con contexto de cursos directos.
 * Estrategia híbrida: primero busca temas de los cursos encontrados, luego hace búsqueda semántica.
 * 
 * @param {string} query - Consulta del usuario
 * @param {Array} allTopics - Todos los temas disponibles
 * @param {Array<number>} directResultsIds - IDs de cursos encontrados (NUEVO)
 * @param {Object} allData - Datos completos (courses, topics) (NUEVO)
 * @returns {Array} - Temas recomendados con confianza
 */
function predict(query, allTopics, directResultsIds = [], allData = null) {
    // ✅ ESTRATEGIA 1: Si hay cursos directos, extraer sus temas (máxima relevancia)
    if (directResultsIds && directResultsIds.length > 0 && allData && allData.courses) {
        const contextualTopics = [];

        directResultsIds.forEach(courseId => {
            const course = allData.courses.find(c => c.id === courseId);
            if (course && course.topicIds) {
                course.topicIds.forEach(topicId => {
                    const topic = allTopics.find(t => t.id === topicId);
                    if (topic && !contextualTopics.find(t => t.id === topic.id)) {
                        contextualTopics.push({
                            id: topic.id,
                            name: topic.name,
                            confidence: 95, // Alta confianza: extraído de cursos reales
                            source: 'contextual'
                        });
                    }
                });
            }
        });

        if (contextualTopics.length > 0) {
            console.log(`✅ Predictor de Temas: ${contextualTopics.length} temas contextuales de cursos directos`);
            console.log(`   Temas:`, contextualTopics.map(t => t.name));
            return contextualTopics.slice(0, 4);
        }
    }

    // ✅ ESTRATEGIA 2: Búsqueda semántica si no hay contexto o no se encontraron temas
    const normalizedQuery = normalizeText(query);
    const queryKeywords = new Set(
        normalizedQuery.split(' ').filter(w => w && w.length > 2).map(w => stemmer.stem(w))
    );

    if (queryKeywords.size === 0) {
        return [];
    }

    const scoredTopics = allTopics.map(topic => {
        let score = 0;
        const normalizedTopicName = normalizeText(topic.name);
        const topicNameStems = new Set(normalizedTopicName.split(' ').map(w => stemmer.stem(w)));

        // Puntuación por similitud
        const distance = levenshtein.get(normalizedQuery, normalizedTopicName);
        if (distance < 3) {
            score += (3 - distance) * 15;
        }

        // Puntuación por frase contenida
        if (normalizedTopicName.includes(normalizedQuery)) {
            score += 50;
        }

        // Puntuación por palabras clave
        queryKeywords.forEach(queryStem => {
            if (topicNameStems.has(queryStem)) {
                score += 15;
            }
        });

        return { ...topic, score };
    });

    const finalResults = scoredTopics.filter(t => t.score > 20).sort((a, b) => b.score - a.score);

    console.log(`📊 Predictor de Temas (semántico): ${finalResults.length} temas encontrados`);
    if (finalResults.length > 0) {
        console.log(`   Top 3:`, finalResults.slice(0, 3).map(t => `${t.name} (${t.score})`));
    }

    return finalResults.slice(0, 4).map(topic => ({
        id: topic.id,
        name: topic.name,
        confidence: Math.min(Math.round(topic.score * 1.5), 98),
        source: 'semantic'
    }));
}

module.exports = { predict };