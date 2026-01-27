// --- Lógica del Botón "Hub Quiz Arena" ---
const btnQuiz = document.getElementById('btn-quiz-arena');
if (btnQuiz) {
    btnQuiz.addEventListener('click', () => {
        // 1. Usar el SessionManager global para verificar
        if (!window.sessionManager.isAuthenticated()) {
            // 2. Si no es autenticado, modal de Login
            const loginModal = document.getElementById('login-prompt-modal');
            if (loginModal) loginModal.style.display = 'flex';
        } else {
            // 3. Si autenticado, ir al juego
            // TODO: Crear quiz.html más adelante, por ahora alert / placeholder
            // window.location.href = '/quiz.html'; 
            alert('¡Bienvenido a Hub Quiz Arena! (Pronto redirigirá a /quiz.html)');
        }
    });
}
