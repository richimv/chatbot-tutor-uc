let isGoogleUser = false; // Estado global para el tipo de usuario

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    await window.sessionManager.initialize();
    const user = window.sessionManager.getUser();

    if (!user) {
        window.location.href = '/login';
        return;
    }

    // ✅ DETECTAR PROVEEDOR (Google vs Email)
    if (window.supabaseClient) {
        const { data } = await window.supabaseClient.auth.getSession();
        if (data && data.session && data.session.user) {
            const provider = data.session.user.app_metadata.provider;
            // Supabase a veces retorna 'email' o 'google', o lo pone en identities
            const identities = data.session.user.identities || [];
            const isOAuth = provider !== 'email' || identities.some(id => id.provider === 'google');

            if (isOAuth) {
                isGoogleUser = true;
                console.log('👤 Usuario identificado como: OAuth/Google');
            }
        }
    }

    // Fill Data
    document.getElementById('user-name').textContent = user.name || 'Usuario';
    document.getElementById('user-email').textContent = user.email || '';

    const badgeContainer = document.getElementById('plan-badge-container');
    const tier = String(user.subscriptionTier || 'free').toLowerCase();

    if (user.role === 'admin') {
        badgeContainer.innerHTML = '<span class="badge-premium" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;"><i class="fas fa-shield-alt"></i> Administrador</span>';
    } else if (tier === 'advanced') {
        badgeContainer.innerHTML = '<span class="badge-premium" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; font-weight: 800;"><i class="fas fa-crown"></i> Plan Advanced</span>';
    } else if (tier === 'basic') {
        badgeContainer.innerHTML = '<span class="badge-premium"><i class="fas fa-star"></i> Plan Basic</span>';
    } else {
        badgeContainer.innerHTML = '<span class="badge-free"><i class="fas fa-seedling"></i> Plan Gratuito</span>';
    }

    // ✅ NUEVO: Renderizar Detalles Detallados
    renderSubscriptionDetails(user);

    // Inject Header (Simplified)
    const headerPlaceholder = document.getElementById('header-placeholder');
    headerPlaceholder.innerHTML = `
                <header class="main-header">
                    <div class="header-start">
                        <a href="/" class="logo">
                            <img src="assets/logo.png" alt="Logo" class="logo-img">
                            <span class="logo-text">Hub Academia</span>
                        </a>
                        <a href="/" class="header-back-btn visible" style="display: flex;">
                            <i class="fas fa-arrow-left"></i> Volver
                        </a>
                    </div>
                </header>
            `;
});

/**
 * ✅ NUEVO: Renderiza los detalles de la suscripción en el perfil.
 */
function renderSubscriptionDetails(user) {
    const container = document.getElementById('subscription-status-container');
    if (!container) return;

    const tier = String(user.subscriptionTier || 'free').toLowerCase();
    const expiresAt = user.subscriptionExpiresAt;
    const status = user.subscriptionStatus || user.subscription_status;

    const isPremium = tier !== 'free' && status === 'active';

    if (isPremium) {
        const dateStr = expiresAt ? new Date(expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Acceso Vitalicio';
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.2rem; font-weight: 800; color: #fff;">${tier.toUpperCase()} <i class="fas fa-check-circle" style="color: #4ade80;"></i></span>
                    <span style="background: rgba(74, 222, 128, 0.1); color: #4ade80; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">ACTIVO</span>
                </div>
                <div style="color: #cbd5e1; font-size: 0.95rem;">
                    <i class="far fa-calendar-alt" style="margin-right: 8px;"></i> Vence: <strong>${dateStr}</strong>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <h4 style="margin-bottom: 10px; font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Beneficios del Plan:</h4>
                    <ul style="list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                        <li style="font-size: 0.85rem; color: #e2e8f0;"><i class="fas fa-gamepad" style="color: #4ade80; width: 20px;"></i> Quiz Arena (${tier === 'advanced' ? '10' : '5'} partidas diarias)</li>
                        <li style="font-size: 0.85rem; color: #e2e8f0;"><i class="fas fa-clone" style="color: #60a5fa; width: 20px;"></i> Flashcards ${tier === 'advanced' ? 'Manuales + IA(30 pedidos/mes)' : 'Manuales + IA(10 pedidos/mes)'}</li>
                        <li style="font-size: 0.85rem; color: #e2e8f0;"><i class="fas fa-chart-line" style="color: #a78bfa; width: 20px;"></i> Estadísticas ${tier === 'advanced' ? 'Avanzadas (IA)' : 'Básicas'}</li>
                        <li style="font-size: 0.85rem; color: #e2e8f0;"><i class="fas fa-book-medical" style="color: #f472b6; width: 20px;"></i> Biblioteca Completa (DRIVE)</li>
                        <li style="font-size: 0.85rem; color: #e2e8f0;"><i class="fas fa-robot" style="color: #f472b6; width: 20px;"></i> Simulador Exámenes (${user.dailySimulatorUsage || 0}/${tier === 'advanced' ? '40' : '15'} hoy)</li>
                    </ul>
                </div>
                <button onclick="window.location.href='/pricing'" class="btn-action" style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); width: auto; align-self: flex-start;">
                    Administrar Suscripción
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.2rem; font-weight: 800; color: #94a3b8;">PLAN GRATUITO</span>
                    <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">LIMITADO</span>
                </div>
                <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">
                    Estás usando la versión gratuita. Tu progreso se guarda, pero tienes acceso restringido a algunos beneficios.
                </p>
                <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.1); padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 1.5rem; color: #fbbf24;"><i class="fas fa-unlock-alt"></i></div>
                    <div>
                        <div style="color: #fbbf24; font-weight: 700; font-size: 0.9rem;">¿Quieres más?</div>
                        <div style="color: #cbd5e1; font-size: 0.85rem;">Adquiere un plan y mejora tu experiencia.</div>
                    </div>
                </div>
                <button onclick="window.location.href='/pricing'" class="btn-action btn-primary" style="width: 100%; justify-content: center; height: 50px; font-size: 1rem;">
                    💎 Ver Planes Premium
                </button>
            </div>
        `;
    }
}

// Modal Logic
const modal = document.getElementById('delete-modal');
const deleteInput = document.getElementById('delete-password');
const deleteLabel = document.querySelector('label[for="delete-password"]'); // Label dinámico
const deleteError = document.getElementById('delete-error');

function openDeleteModal() {
    modal.style.display = 'flex';
    deleteInput.value = '';
    deleteError.style.display = 'none';

    // ✅ UX ADAPTATIVA
    if (isGoogleUser) {
        deleteLabel.textContent = 'Escribe "ELIMINAR" para confirmar:';
        deleteInput.placeholder = 'ELIMINAR';
        deleteInput.type = 'text'; // Cambiar a texto visible
    } else {
        deleteLabel.textContent = 'Ingresa tu contraseña para confirmar:';
        deleteInput.placeholder = 'Tu contraseña';
        deleteInput.type = 'password';
    }

    deleteInput.focus();
}

function closeDeleteModal() {
    modal.style.display = 'none';
}

// Close on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeleteModal();
});

// Delete Action
document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    const inputValue = deleteInput.value;

    // Validaciones según tipo de usuario
    if (isGoogleUser) {
        if (inputValue !== 'ELIMINAR') {
            deleteError.textContent = 'Debes escribir "ELIMINAR" textualmente.';
            deleteError.style.display = 'block';
            return;
        }
    } else {
        if (!inputValue) {
            deleteError.textContent = 'Por favor ingresa tu contraseña';
            deleteError.style.display = 'block';
            return;
        }
    }

    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Eliminando...';
    btn.disabled = true;

    try {
        // Si es Google, la password enviada es vacía (o irrelevante)
        // Usamos el input como contraseña si es email, o vacío si es Google
        const payloadPassword = isGoogleUser ? '' : inputValue;

        await AuthApiService.deleteAccount(payloadPassword);

        // Logout logic logic
        await window.sessionManager.logout();
        // window.location.href = '/?deleted=true'; // Redundant if logout redirects
    } catch (error) {
        console.error(error);
        deleteError.textContent = error.message || 'Error al eliminar cuenta';
        deleteError.style.display = 'block';
        btn.textContent = originalText;
        btn.disabled = false;
    }
});