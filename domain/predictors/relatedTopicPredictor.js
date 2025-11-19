const { normalizeText, stemmer } = require('../utils/textUtils');
const levenshtein = require('fast-levenshtein'); // ✅ 1. Importar la librería

function predict(query, allTopics) {
    const normalizedQuery = normalizeText(query);
    const queryKeywords = new Set(
        normalizedQuery.split(' ').filter(w => w && w.length > 2).map(w => stemmer.stem(w))
    );

    if (queryKeywords.size === 0) {
        return [];
    }

    // ✅ 2. Lógica de puntuación avanzada para temas
    const scoredTopics = allTopics.map(topic => {
        let score = 0;
        const normalizedTopicName = normalizeText(topic.name);
        const topicNameStems = new Set(normalizedTopicName.split(' ').map(w => stemmer.stem(w)));

        // Puntuación por similitud (tolerancia a errores)
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

    // ✅ 3. Filtrar, ordenar y devolver en el formato correcto
    const finalResults = scoredTopics.filter(t => t.score > 0).sort((a, b) => b.score - a.score);
    return finalResults.slice(0, 3).map(topic => ({ id: topic.id, name: topic.name }));
}

module.exports = { predict };