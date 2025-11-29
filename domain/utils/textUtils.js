const natural = require('natural');
const stemmer = natural.PorterStemmerEs; // Stemmer en español

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^\w\s]/g, ''); // Quitar puntuación
}

module.exports = { normalizeText, stemmer };