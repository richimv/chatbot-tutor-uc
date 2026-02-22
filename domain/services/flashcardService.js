const trainingRepository = require('../../infrastructure/repositories/trainingRepository');

class FlashcardService {

    /**
     * Obtiene las tarjetas pendientes de repaso para un usuario.
     */
    async getDueFlashcards(userId) {
        return await trainingRepository.getDueFlashcards(userId);
    }

    /**
     * Procesa el repaso de una tarjeta usando el algoritmo SM-2.
     * @param {string} cardId 
     * @param {number} quality - 0 a 5 (0=Blackout, 5=Perfect)
     * @param {object} currentCardState - { interval, easiness, repetitions }
     */
    async processReview(cardId, quality, currentCardState) {
        // Algoritmo SuperMemo-2 (SM-2)
        // https://super-memory.com/english/ol/sm2.htm

        let { interval_days, easiness_factor, repetition_number } = currentCardState;

        // Convertir a números por seguridad
        let interval = parseInt(interval_days || 0);
        let ef = parseFloat(easiness_factor || 2.5);
        let reps = parseInt(repetition_number || 0);

        let nextReviewDate = new Date();

        if (quality >= 3) {
            // Respuesta Correcta (SM-2 Standard)
            if (reps === 0) {
                interval = 1; // 1 día
            } else if (reps === 1) {
                interval = 6; // 6 días
            } else {
                interval = Math.round(interval * ef);
            }
            reps++;

            // Sumar días
            nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        } else {
            // "Olvidé" / Respuesta Incorrecta
            // RESET: Intervalo 0 (para indicar intraday) o 1? 
            // La UI dice "< 1 min". 
            // Lo agendamos para dentro de 1 minuto.
            reps = 0;
            interval = 0; // Marcar como 0 días (intraday)

            // Sumar 1 minuto
            nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 1);
        }

        // Actualizar Factor de Facilidad (EF) solo si no fue un fallo total (opcional, estándar SM-2 no baja EF si q<3, pero otros sí. Mantenemos tu lógica original de ajuste)
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ef < 1.3) ef = 1.3;

        // Guardar en BD
        await trainingRepository.updateFlashcard(cardId, interval, ef, reps, nextReviewDate);

        return {
            success: true,
            nextReview: nextReviewDate,
            intervalDays: interval
        };
    }
}

module.exports = new FlashcardService();
