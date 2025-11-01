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

    // Si hay directResultsIds, significa que estamos en modo "recomendación" y debemos excluir esos cursos.
    // Si no, estamos en modo "búsqueda ampliada" y consideramos todos los cursos.
    const candidateCourses = allCourses.filter(course => !directResultsIds.includes(course.id));
    
    // --- LÓGICA DE BÚSQUEDA REHECHA DESDE CERO ---

    // Filtro de Coincidencia Total (para búsquedas específicas como "ingenieria civil")
    let filteredResults = candidateCourses.filter(course => {
        const specificCareers = (course.careers || []).filter(career => !['tronco comun', 'ciclo basico', 'estudios generales'].includes(normalizeText(career)));
        if (specificCareers.length === 0) return false;

        const courseCareerStems = new Set(normalizeText(specificCareers.join(' ')).split(' ').filter(w => w).map(w => stemmer.stem(w)));
        
        // Devuelve true si TODAS las palabras clave de la búsqueda están presentes en las carreras del curso.
        return [...queryKeywords].every(queryStem => 
            [...courseCareerStems].some(careerStem => careerStem.startsWith(queryStem) || queryStem.startsWith(careerStem))
        );
    });

    // Si el filtro estricto encontró resultados, los usamos.
    if (filteredResults.length > 0) {
        console.log('... Usando resultados de filtro estricto.');
        return filteredResults.slice(0, 10);
    }

    // Fallback: Filtro de Coincidencia Parcial (para búsquedas amplias como "ingenieria")
    // Si el filtro estricto no arrojó nada, usamos una lógica más flexible.
    console.log('... Usando resultados de filtro flexible.');
    filteredResults = candidateCourses.filter(course => {
        const courseNameStems = new Set(normalizeText(course.name).split(' ').filter(w => w).map(w => stemmer.stem(w)));
        const specificCareers = (course.careers || []).filter(career => !['tronco comun', 'ciclo basico', 'estudios generales'].includes(normalizeText(career)));
        const courseCareerStems = new Set(normalizeText(specificCareers.join(' ')).split(' ').filter(w => w).map(w => stemmer.stem(w)));

        // Devuelve true si ALGUNA palabra clave de la búsqueda está presente en el nombre O en las carreras.
        return [...queryKeywords].some(queryStem => 
            [...courseNameStems].some(nameStem => nameStem.startsWith(queryStem) || queryStem.startsWith(nameStem)) ||
            [...courseCareerStems].some(careerStem => careerStem.startsWith(queryStem) || queryStem.startsWith(careerStem))
        );
    });
    
    return filteredResults.slice(0, 10);
}

module.exports = { predict };