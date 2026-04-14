document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    await window.sessionManager.initialize();
    const user = window.sessionManager.getUser();

    if (!user) {
        window.location.href = '/login';
        return;
    }

    // Fill Data
    document.getElementById('user-name').textContent = user.name || 'Usuario';
    const emailEl = document.getElementById('user-email');
    // Todos los usuarios son Google Verified
    emailEl.innerHTML = `${user.email} <i class="fas fa-check-circle" style="color: #10b981; font-size: 0.9rem; margin-left: 5px;" title="Verificado via Google"></i>`;

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

    renderSubscriptionDetails(user);

    // Inject Header
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
 * Renderiza los detalles de la suscripción
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
                <!-- Beneficios Simplificados -->
                <div style="color: #cbd5e1; font-size: 0.95rem;">
                    <i class="far fa-calendar-alt" style="margin-right: 8px;"></i> Vence: <strong>${dateStr}</strong>
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
                <button onclick="window.location.href='/pricing'" class="btn-action btn-primary" style="width: 100%; justify-content: center; height: 50px; font-size: 1rem;">
                    💎 Ver Planes Premium
                </button>
            </div>
        `;
    }
}

// Modal de eliminación simplificado (Solo Google)
const modal = document.getElementById('delete-modal');
const deleteInput = document.getElementById('delete-password');
const deleteLabel = document.querySelector('label[for="delete-password"]');
const deleteError = document.getElementById('delete-error');

function openDeleteModal() {
    modal.style.display = 'flex';
    deleteInput.value = '';
    deleteError.style.display = 'none';
    deleteLabel.textContent = 'Escribe "ELIMINAR" para confirmar:';
    deleteInput.placeholder = 'ELIMINAR';
    deleteInput.type = 'text';
    deleteInput.focus();
}

function closeDeleteModal() {
    modal.style.display = 'none';
}

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeleteModal();
});

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (deleteInput.value !== 'ELIMINAR') {
        deleteError.textContent = 'Debes escribir "ELIMINAR" textualmente.';
        deleteError.style.display = 'block';
        return;
    }

    const btn = document.getElementById('confirm-delete-btn');
    btn.textContent = 'Eliminando...';
    btn.disabled = true;

    try {
        await AuthApiService.deleteAccount();
        await window.sessionManager.logout();
    } catch (error) {
        console.error(error);
        deleteError.textContent = error.message || 'Error al eliminar cuenta';
        deleteError.style.display = 'block';
        btn.textContent = 'Confirmar';
        btn.disabled = false;
    }
});