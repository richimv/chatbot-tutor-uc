const { normalizeText, stemmer } = require('../utils/textUtils');

const FILLER_WORDS = new Set([
    'quiero', 'saber', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las',
    'que', 'es', 'explicame', 'como', 'funciona', 'necesito', 'informacion', 'dame', 'acerca', 'del', 'tema', 'ayuda',
    'qué', 'cómo', 'información', 'podrias', 'de', 'del', 'y', 'o', 'a', 'en', 'con', 'por', 'sin', 'entre', 'hacia', 'desde',
    'hasta', 'durante', 'mediante', 'segun', 'tras', 'versus', 'via', 'cabe', 'bajo', 'contra', 'muestrame', 'ejemplos', 'concepto'
]);

function predict(query, directResultsIds, allCourses) {
    const normalizedQuery = normalizeText(query);
    const queryKeywords = new Set(
        normalizedQuery.split(' ').filter(w => w && !FILLER_WORDS.has(w) && w.length > 2).map(w => stemmer.stem(w))
    );

    if (queryKeywords.size === 0) {
        return []; // Devolvemos un array vacío si no hay palabras clave
    }

    // ✅ CORRECCIÓN FINAL: Usar la variable correcta 'enrichedCourses' que se recibe como parámetro.
    const candidateCourses = allCourses.filter(course => !directResultsIds.includes(course.id));
    
    const courseScores = {};
    for (const course of candidateCourses) {
        const courseContentText = normalizeText(course.name + ' ' + (course.topics || []).join(' '));
        const courseKeywords = new Set(courseContentText.split(' ').filter(w => w).map(w => stemmer.stem(w)));
        
        const intersection = new Set([...queryKeywords].filter(x => courseKeywords.has(x)));
        let score = intersection.size;
        
        const isSubset = [...queryKeywords].every(kw => courseKeywords.has(kw));
        if (isSubset) {
            score += queryKeywords.size;
        }

        if (score > 0) {
            // Guardamos el nombre y la puntuación
            courseScores[course.name] = { name: course.name, score: score };
        }
    }
    
    // Ordenamos por puntuación y devolvemos el objeto completo
    return Object.values(courseScores).sort((a, b) => b.score - a.score).slice(0, 2);
}

module.exports = { predict };