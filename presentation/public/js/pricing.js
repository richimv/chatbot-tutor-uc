// ✅ Smart Pricing Logic (SessionManager)
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar SessionManager
    if (window.sessionManager) {
        await window.sessionManager.initialize();

        // Suscribirse a cambios de estado
        window.sessionManager.onStateChange((user) => {
            checkPremiumStatus(user);
        });

        // Verificar estado inicial si ya cargó
        checkPremiumStatus(window.sessionManager.getUser());
    } else {
        console.error("SessionManager no cargado. Verifique imports.");
    }
});

function checkPremiumStatus(user) {
    if (!user) return; // Si no hay usuario, mostrar pricing por defecto (Free)

    try {
        // Verificar status (Soporte para camelCase y snake_case)
        const status = user.subscriptionStatus || user.subscription_status;
        const role = user.role;

        console.log("💎 Verificando Estatus Premium:", status);

        // Lógica: Si es 'active' o 'premium' o es admin (para pruebas)
        if (status === 'active' || status === 'premium' || role === 'admin') {
            // Ocultar Pricing
            const pricingContent = document.getElementById('pricing-content');
            if (pricingContent) pricingContent.style.display = 'none';

            // Mostrar Premium
            const premiumContent = document.getElementById('premium-content');
            if (premiumContent) {
                premiumContent.style.display = 'block';
                // Trigger reflow for animation if needed
                premiumContent.style.animation = 'none';
                premiumContent.offsetHeight; /* trigger reflow */
                premiumContent.style.animation = 'fadeIn 0.5s ease-in-out';
            }
        }
    } catch (e) {
        console.error("Error checking premium status:", e);
    }
}

// Check for payment status in URL
const urlParams = new URLSearchParams(window.location.search);
const paymentStatus = urlParams.get('payment');
const statusDetail = urlParams.get('status'); // MP a veces manda 'approved'

if (paymentStatus === 'success' || statusDetail === 'approved') {
    // Limpiar URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Mostrar feedback
    alert('¡Pago exitoso! 🎉\nTu cuenta Premium ha sido activada. Disfruta de acceso ilimitado.');

    // Redirigir al dashboard para que vea todo desbloqueado
    setTimeout(() => window.location.href = '/', 1000); // Updated to index.html (Dashboard view) -> Clean URL /

} else if (paymentStatus === 'failure') {
    alert('El pago no se pudo completar. Por favor, intenta de nuevo.');
} else if (paymentStatus === 'pending') {
    alert('Tu pago está en proceso. Te notificaremos cuando se apruebe.');
}

// Logout helper (Usando SessionManager)
function logout() {
    // ✅ CORRECCIÓN: Usar el nuevo manejador de sesión
    if (window.sessionManager) {
        window.sessionManager.logout();
    } else {
        localStorage.removeItem('authToken');
        // Check if there's a referrer or specific redirect logic needed
        const urlParams = new URLSearchParams(window.location.search);
        const redirectedFromApp = urlParams.get('fromApp') === 'true'; // Example flag

        if (redirectedFromApp) {
            // Si el usuario viene de la app (ej: intento fallido de acceder a contenido), lo mandamos al login con redirect
            window.location.href = 'login?redirect=pricing';
        } else {
            // Flujo normal: Login -> Pricing
            window.location.href = 'login';
        }
    }
}

// ✅ Lógica de Pago Multi-Plan
document.querySelectorAll('.plan-select-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
        // Obtenemos qué plan seleccionó el usuario desde el atributo data-plan
        const selectedPlan = event.currentTarget.getAttribute('data-plan');
        console.log("Iniciando pago para el plan:", selectedPlan);

        // ✅ Obtener el token correctamente
        const token = localStorage.getItem('authToken');

        // Si no hay token, intentar obtenerlo de supabase (caso borde) u obligar a login
        if (!token) {
            window.location.href = 'login?redirect=pricing';
            return;
        }

        const loading = document.getElementById('loading-overlay');
        loading.classList.remove('hidden');

        try {
            // ✅ Enviar el planId en el body
            const response = await fetch(`${window.AppConfig.API_URL}/api/payment/create-order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ planId: selectedPlan })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al iniciar el pago');
            }

            const data = await response.json();

            if (data.init_point) {
                // Redirect to Mercado Pago logic
                window.location.href = data.init_point;
            } else {
                alert('Error: No se recibió el link de pago.');
                loading.classList.add('hidden');
            }

        } catch (error) {
            console.error("Error de pago:", error);
            alert('Hubo un problema al conectar con el servidor de pagos. ' + error.message);
            loading.classList.add('hidden');
        }
    });
});