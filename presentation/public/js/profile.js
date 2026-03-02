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
    if (user.role === 'admin') {
        badgeContainer.innerHTML = '<span class="badge-premium" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;"><i class="fas fa-shield-alt"></i> Administrador</span>';
    } else if (user.subscriptionStatus === 'active') {
        badgeContainer.innerHTML = '<span class="badge-premium"><i class="fas fa-crown"></i> Plan Premium</span>';
    } else {
        badgeContainer.innerHTML = '<span class="badge-free"><i class="fas fa-seedling"></i> Plan Gratuito</span>';
    }

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