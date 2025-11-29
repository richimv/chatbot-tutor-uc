const { normalizeText, stemmer } = require('../utils/textUtils');
const levenshtein = require('fast-levenshtein');

const FILLER_WORDS = new Set([
    'quiero', 'saber', 'ejercicios', 'libro', 'libros', 'sobre', 'para', 'que', 'sirve', 'una', 'un', 'el', 'la', 'los', 'las',
    'que', 'es', 'explicame', 'como', 'funciona', 'necesito', 'informacion', 'dame', 'acerca', 'del', 'tema', 'ayuda',
    'qué', 'cómo', 'información', 'podrias', 'de', 'del', 'y', 'o', 'a', 'en', 'con', 'por', 'sin', 'entre', 'hacia', 'desde',
    'hasta', 'durante', 'mediante', 'segun', 'tras', 'versus', 'via', 'cabe', 'bajo', 'contra', 'muestrame', 'ejemplos', 'concepto'
]);

function getNGrams(word, n = 3) {
    const ngrams = new Set();
    if (word.length < n) return ngrams;
    for (let i = 0; i <= word.length - n; i++) {
        ngrams.add(word.substring(i, i + n));
    }
    return ngrams;
}

/**
 * ✅ REFACTOR COMPLETO: Predictor de cursos relacionados con exclusión inteligente por carrera.
 * @param {string} query - Consulta del usuario
 * @param {Array<number>} directResultsIds - IDs de cursos encontrados directamente
 * @param {Object} allData - Datos completos (courses, topics, careers)
 * @returns {Array} - Cursos recomendados con confianza
 */
function predict(query, directResultsIds, allData) {
    const normalizedQuery = normalizeText(query);
    const queryKeywords = new Set(
        normalizedQuery.split(' ').filter(w => w && !FILLER_WORDS.has(w) && w.length > 2).map(w => stemmer.stem(w))
    );

    if (queryKeywords.size === 0) {
        return [];
    }

    const queryNGrams = new Set();
    queryKeywords.forEach(keyword => {
        getNGrams(keyword).forEach(ngram => queryNGrams.add(ngram));
    });

    // ✅ MEJORA CRÍTICA: Obtener contexto de carreras de los resultados directos
    const sourceCareerIds = new Set();
    if (directResultsIds && directResultsIds.length > 0) {
        directResultsIds.forEach(courseId => {
            const sourceCourse = allData.courses.find(c => c.id === courseId);
            if (sourceCourse && sourceCourse.careerIds) {
                sourceCourse.careerIds.forEach(cid => sourceCareerIds.add(cid));
            }
        });
    }

    // Filtrar candidatos: excluir resultados directos
    const candidateCourses = allData.courses.filter(course => !directResultsIds.includes(course.id));

    const scoredResults = candidateCourses.map(course => {
        let score = 0;
        const normalizedCourseName = normalizeText(course.name);
        const courseNameStems = new Set(normalizedCourseName.split(' ').map(w => stemmer.stem(w)));

        // Datos del curso
        const topicNames = (course.topicIds || []).map(id => allData.topics.find(t => t.id === id)?.name || '').filter(Boolean);
        const normalizedTopics = normalizeText(topicNames.join(' '));
        const topicStems = new Set(normalizedTopics.split(' ').map(w => stemmer.stem(w)));

        const careerNames = (course.careerIds || []).map(id => allData.careers.find(c => c.id === id)?.name || '').filter(Boolean);
        const normalizedCareers = normalizeText(careerNames.join(' '));
        const careerStems = new Set(normalizedCareers.split(' ').map(w => stemmer.stem(w)));

        // Scoring
        const distance = levenshtein.get(normalizedQuery, normalizedCourseName);
        if (distance < 3) {
            score += (3 - distance) * 15;
        }

        if (normalizedCourseName.includes(normalizedQuery)) {
            score += 50;
        }

        queryKeywords.forEach(queryStem => {
            if (courseNameStems.has(queryStem)) {
                score += 15;
            }
            if (topicStems.has(queryStem)) {
                score += 10;
            }
            if (careerStems.has(queryStem)) {
                score += 20;
            }
        });

        const courseNameNGrams = getNGrams(normalizedCourseName.replace(/\s/g, ''));
        queryNGrams.forEach(queryNgram => {
            if (courseNameNGrams.has(queryNgram)) {
                score += 1;
            }
        });

        // ✅ NUEVA LÓGICA: Penalización por falta de afinidad de carrera
        if (sourceCareerIds.size > 0) {
            const courseCareerIds = course.careerIds || [];
            const hasCommonCareer = courseCareerIds.some(cid => sourceCareerIds.has(cid));

            if (!hasCommonCareer) {
                // Si no comparte carrera y el score es bajo-medio, es irrelevante
                if (score < 60) {
                    console.log(`🚫 Excluyendo "${course.name}" (score: ${score}) - Sin afinidad de carrera`);
                    return { ...course, score: 0 };
                }
                // Si el score es alto pero no comparte carrera, reducir drásticamente
                score = Math.floor(score * 0.3);
                console.log(`⚠️ Penalizando "${course.name}" por falta de afinidad de carrera. Score reducido: ${score}`);
            } else {
                // Bonus por compartir carrera
                score += 15;
                console.log(`✅ Bonus para "${course.name}" por compartir carrera. Score: ${score}`);
            }
        }

        return { ...course, score };
    });

    // ✅ UMBRAL MÁS ESTRICTO: De 15 a 30
    const finalResults = scoredResults.filter(r => r.score > 30).sort((a, b) => b.score - a.score);

    console.log(`📊 Predictor de Cursos: ${finalResults.length} recomendaciones de ${candidateCourses.length} candidatos`);
    if (finalResults.length > 0) {
        console.log(`   Top 3:`, finalResults.slice(0, 3).map(c => `${c.name} (${c.score})`));
    }

    return finalResults.slice(0, 4).map(course => ({
        id: course.id,
        name: course.name,
        confidence: Math.min(Math.round(course.score), 99),
        careerIds: (course.careerIds || []).map(careerId => {
            const career = allData.careers.find(c => c.id === careerId);
            return career ? { id: career.id, name: career.name } : null;
        }).filter(Boolean)
    }));
}

module.exports = { predict };