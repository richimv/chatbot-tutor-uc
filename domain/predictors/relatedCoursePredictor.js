const { normalizeText, stemmer } = require('../utils/textUtils');
const levenshtein = require('fast-levenshtein'); // ✅ 1. Importar la librería para tolerancia a errores

const FILLER_WORDS = new Set([
    'quiero', 'saber', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las',
    'que', 'es', 'explicame', 'como', 'funciona', 'necesito', 'informacion', 'dame', 'acerca', 'del', 'tema', 'ayuda',
    'qué', 'cómo', 'información', 'podrias', 'de', 'del', 'y', 'o', 'a', 'en', 'con', 'por', 'sin', 'entre', 'hacia', 'desde',
    'hasta', 'durante', 'mediante', 'segun', 'tras', 'versus', 'via', 'cabe', 'bajo', 'contra', 'muestrame', 'ejemplos', 'concepto'
]);

// ✅ SOLUCIÓN: Función para generar n-gramas y mejorar la tolerancia a errores.
// "ingenieriaa" -> ["ing", "nge", "gen", "eni", "nie", "ier", "eri", "ria", "iaa"]
// Esto ayuda a encontrar coincidencias parciales incluso si el stemmer falla.
function getNGrams(word, n = 3) {
    const ngrams = new Set();
    if (word.length < n) return ngrams;
    for (let i = 0; i <= word.length - n; i++) {
        ngrams.add(word.substring(i, i + n));
    }
    return ngrams;
}

function predict(query, directResultsIds, allData) {
    const normalizedQuery = normalizeText(query);
    const queryKeywords = new Set(
        normalizedQuery.split(' ').filter(w => w && !FILLER_WORDS.has(w) && w.length > 2).map(w => stemmer.stem(w))
    );

    if (queryKeywords.size === 0) {
        return []; // Devolvemos un array vacío si no hay palabras clave
    }

    // ✅ SOLUCIÓN: Generar n-gramas de la consulta para una coincidencia más robusta.
    const queryNGrams = new Set();
    queryKeywords.forEach(keyword => {
        getNGrams(keyword).forEach(ngram => queryNGrams.add(ngram));
    });

    // Si hay directResultsIds, significa que estamos en modo "recomendación" y debemos excluir esos cursos.
    // Si no, estamos en modo "búsqueda ampliada" y consideramos todos los cursos.
    const candidateCourses = allData.courses.filter(course => !directResultsIds.includes(course.id));
    
    // --- LÓGICA DE BÚSQUEDA MEJORADA CON PUNTUACIÓN ---
    const scoredResults = candidateCourses.map(course => {
        let score = 0;
        const normalizedCourseName = normalizeText(course.name);
        const courseNameStems = new Set(normalizedCourseName.split(' ').map(w => stemmer.stem(w)));

        // ✅ MEJORA: Incluir los temas del curso en la lógica de puntuación.
        // La data ahora viene de la BD, así que los temas son solo IDs. Usamos los datos completos.
        const topicNames = (course.topicIds || []).map(id => allData.topics.find(t => t.id === id)?.name || '').filter(Boolean);
        const normalizedTopics = normalizeText(topicNames.join(' '));
        const topicStems = new Set(normalizedTopics.split(' ').map(w => stemmer.stem(w)));

        // ✅ SOLUCIÓN CRÍTICA: Incluir las carreras en la lógica de puntuación.
        // Esto soluciona el error y hace que el predictor sea más inteligente.
        const careerNames = (course.careerIds || []).map(id => allData.careers.find(c => c.id === id)?.name || '').filter(Boolean);
        const normalizedCareers = normalizeText(careerNames.join(' '));
        const careerStems = new Set(normalizedCareers.split(' ').map(w => stemmer.stem(w)));

        // ✅ 2. Puntuación por similitud (tolerancia a errores de tipeo)
        const distance = levenshtein.get(normalizedQuery, normalizedCourseName);
        if (distance < 3) {
            // Bonificación alta si la palabra es muy parecida (ej: "ingenieriaa" vs "ingenieria")
            score += (3 - distance) * 15;
        }

        // Puntuación alta por coincidencia de frase contenida
        if (normalizedCourseName.includes(normalizedQuery)) {
            score += 50;
        }

        // Puntuación por cada palabra clave que coincida
        queryKeywords.forEach(queryStem => {
            if (courseNameStems.has(queryStem)) {
                score += 15; // Más peso si está en el nombre del curso
            }
            if (topicStems.has(queryStem)) {
                score += 10; // Un peso alto para los temas
            }
            if (careerStems.has(queryStem)) {
                score += 5; // Un peso menor para las carreras
            }
        });

        // ✅ SOLUCIÓN: Añadir puntuación por coincidencia de n-gramas.
        // Esto es muy efectivo para errores de tipeo como "ingenieriaa".
        const courseNameNGrams = getNGrams(normalizedCourseName.replace(/\s/g, ''));
        queryNGrams.forEach(queryNgram => {
            if (courseNameNGrams.has(queryNgram)) {
                score += 1; // Puntuación baja pero efectiva para sumar evidencia.
            }
        });
        return { ...course, score };
    });

    // Filtrar los que tienen puntuación > 0 y ordenar de mayor a menor
    const finalResults = scoredResults.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    
    // ✅ SOLUCIÓN: Devolver el formato que el frontend espera: un array de objetos {id, name} para las carreras.
    return finalResults.slice(0, 4).map(course => ({
        id: course.id,
        name: course.name,
        // Buscamos los objetos de carrera completos usando los IDs que ya tiene el curso.
        careerIds: (course.careerIds || []).map(careerId => {
            const career = allData.careers.find(c => c.id === careerId);
            return career ? { id: career.id, name: career.name } : null;
        }).filter(Boolean) // Filtramos nulos si alguna carrera no se encontrara
    }));
}

module.exports = { predict };