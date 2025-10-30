const { normalizeText } = require('../utils/textUtils');

function predict(query, allCourses) {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return [];
    }

    // ✅ CORRECCIÓN FINAL: Usar la variable correcta 'enrichedCourses' que se recibe como parámetro.
    const allTopics = new Set();
    for (const course of allCourses) {
        if (Array.isArray(course.topics)) {
            course.topics.forEach(topic => allTopics.add(topic));
        }
    }

    const relatedTopics = new Set();
    for (const topic of allTopics) {
        const normalizedTopic = normalizeText(topic);
        if (normalizedTopic.includes(normalizedQuery) && normalizedQuery !== normalizedTopic) {
            // Añadimos un objeto con el nombre y una puntuación simple
            relatedTopics.add({ name: topic, score: normalizedTopic.length - normalizedQuery.length });
        }
    }

    // Convertimos el Set a un Array, ordenamos por puntuación (de menor a mayor, para temas más específicos) y devolvemos los 3 mejores.
    return Array.from(relatedTopics)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
}

module.exports = { predict };