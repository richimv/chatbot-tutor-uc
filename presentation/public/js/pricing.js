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
    if (!user) return; // Si no hay usuario, mostrar pricing por defecto

    try {
        const status = user.subscriptionStatus || user.subscription_status;
        const tier = String(user.subscriptionTier || 'free').toLowerCase();
        const role = user.role;

        console.log(`💎 Verificando Estatus: Plan=${tier}, Status=${status}`);

        const isPremium = (status === 'active' || status === 'premium' || role === 'admin');
        const isAdvanced = (tier === 'advanced' || role === 'admin');

        // 1. Lógica de Visibilidad - Siempre mostrar tabla para permitir upgrades/fidelización
        const pricingContent = document.getElementById('pricing-content');
        if (pricingContent) pricingContent.style.display = 'block';

        const premiumContent = document.getElementById('premium-content');
        if (premiumContent) premiumContent.style.display = 'none';

        // 2. Resaltar Plan Actual if existe
        if (isPremium) {
            if (tier === 'advanced') {
                markCurrentPlan('advanced');
            } else if (tier === 'basic') {
                markCurrentPlan('basic');
            }
        }
    } catch (e) {
        console.error("Error checking premium status:", e);
    }
}

/**
 * Ajusta el UI para indicar cuál es el plan que el usuario ya posee.
 */
function markCurrentPlan(planId) {
    const card = document.getElementById(`plan-card-${planId}`);
    const btn = document.getElementById(`btn-plan-${planId}`);

    if (card) {
        card.style.border = '2px solid #fbbf24';
        card.style.position = 'relative';
        
        // Añadir badge de "Tu Plan"
        const badge = document.createElement('div');
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Tu Plan Actual';
        badge.style.cssText = `
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #fbbf24;
            color: #000;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(251, 191, 36, 0.3);
        `;
        card.appendChild(badge);
    }

    if (btn) {
        btn.innerHTML = '<i class="fas fa-certificate"></i> Plan Activo';
        btn.disabled = true;
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = '#94a3b8';
        btn.style.cursor = 'default';
        btn.style.pointerEvents = 'none';
        btn.style.border = '1px solid rgba(255,255,255,0.1)';
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