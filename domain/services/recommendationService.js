const { normalizeText } = require('../utils/textUtils');
const Snowball = require('snowball'); // Usaremos una librería de stemming para JS

const stemmer = new Snowball('Spanish');

function getKeywords(text) {
    const words = normalizeText(text).split(' ').filter(Boolean);
    return new Set(words.map(word => {
        stemmer.setCurrent(word);
        stemmer.stem();
        return stemmer.result;
    }));
}

class RecommendationService {

    predictRelatedCourses(query, directResultsIds, allCourses) {
        const queryKeywords = getKeywords(query);
        if (queryKeywords.size === 0) return [];

        const candidateCourses = allCourses.filter(c => !directResultsIds.includes(c.courseId));
        const courseScores = {};

        candidateCourses.forEach(course => {
            const courseName = course.name || '';
            const topicNames = course.topics || [];
            const courseContentText = `${courseName} ${topicNames.join(' ')}`;
            const courseKeywords = getKeywords(courseContentText);

            const commonKeywords = new Set([...queryKeywords].filter(x => courseKeywords.has(x)));
            let score = commonKeywords.size;

            const nameKeywords = getKeywords(courseName);
            if ([...queryKeywords].some(x => nameKeywords.has(x))) {
                score += 5; // Bonus por coincidencia en el nombre
            }

            if (score > 0) {
                courseScores[courseName] = score;
            }
        });

        return Object.entries(courseScores)
            .sort(([, a], [, b]) => b - a)
            .map(([name]) => name)
            .slice(0, 2);
    }

    predictRelatedTopics(query, allCourses) {
        const queryKeywords = getKeywords(query);
        if (queryKeywords.size === 0) return [];

        const allTopics = new Set(allCourses.flatMap(c => c.topics || []));
        const relatedTopics = new Set();

        allTopics.forEach(topic => {
            const topicKeywords = getKeywords(topic);
            if ([...queryKeywords].some(x => topicKeywords.has(x))) {
                relatedTopics.add(topic);
            }
        });

        const normalizedQuery = normalizeText(query);
        let finalTopics = [...relatedTopics];
        if (finalTopics.length > 1) {
            finalTopics = finalTopics.filter(t => normalizeText(t) !== normalizedQuery);
        }

        return finalTopics.slice(0, 3);
    }

    getRecommendations(query, directResultsIds, allCourses) {
        const relatedCourses = this.predictRelatedCourses(query, directResultsIds, allCourses);
        const relatedTopics = this.predictRelatedTopics(query, allCourses);
        return { relatedCourses, relatedTopics };
    }
}

module.exports = RecommendationService;