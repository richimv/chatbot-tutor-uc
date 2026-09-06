if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        // Check Auth
        if (window.sessionManager) {
            await window.sessionManager.initialize();
        }
        const user = window.sessionManager ? window.sessionManager.getUser() : null;

        if (!user) {
            if (typeof window !== 'undefined' && window.location) {
                window.location.href = '/login';
            }
            return;
        }

        // Fill Data
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = user.name || 'Usuario';
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = user.email || '';

        const avatarBadge = document.getElementById('user-avatar-badge');
        if (avatarBadge) {
            const displayName = user.name || 'Usuario';
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;
            const rawPhoto = user.picture || user.avatar_url || user.avatarUrl;
            let safePhotoUrl = fallbackAvatar;
            if (rawPhoto && typeof rawPhoto === 'string') {
                const trimmed = rawPhoto.trim();
                if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined') {
                    safePhotoUrl = getSafeProfileImageUrl(trimmed) || fallbackAvatar;
                }
            }

            const image = document.createElement('img');
            image.src = safePhotoUrl;
            image.alt = displayName;
            image.className = 'profile-avatar-img';
            image.referrerPolicy = 'no-referrer';
            image.onerror = () => {
                image.onerror = null;
                image.src = fallbackAvatar;
            };
            avatarBadge.replaceChildren(image);
        }

        const badgeContainer = document.getElementById('plan-badge-container');
        const tier = String(user.subscriptionTier || 'free').toLowerCase();

        if (user.role === 'admin') {
            badgeContainer.innerHTML = '<span class="badge-premium" style="background: var(--primary);"><i class="fas fa-shield-alt"></i> Administrador Global</span>';
        } else if (tier === 'advanced') {
            badgeContainer.innerHTML = '<span class="badge-premium" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff;"><i class="fas fa-crown"></i> Plan Advanced</span>';
        } else if (tier === 'basic') {
            badgeContainer.innerHTML = '<span class="badge-premium"><i class="fas fa-star"></i> Plan Basic</span>';
        } else {
            badgeContainer.innerHTML = '<span class="badge-free">Plan Gratuito</span>';
        }

        // Update Security & Role Info
        const roleValEl = document.getElementById('user-role-val');
        if (roleValEl) {
            if (user.role === 'admin') roleValEl.textContent = 'Administrador Global';
            else if (user.role === 'teacher') roleValEl.textContent = 'Docente';
            else roleValEl.textContent = 'Estudiante';
        }

        renderSubscriptionDetails(user);
        renderUsageDetails(user);
    });
}

function getSafeProfileImageUrl(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    try {
        const url = new URL(trimmed, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch (error) {
        return null;
    }
}

/**
 * Calcula la fecha de la próxima renovación semanal para usuarios Free
 * @param {Object} user - Objeto de usuario
 * @returns {{ formattedDate: string, daysLeft: number }}
 */
function getNextFreeRenewalInfo(user) {
    const lastRenewalStr = user.lastFreeRenewal || user.last_free_renewal;
    if (!lastRenewalStr) {
        return { formattedDate: "Cada 7 días", daysLeft: 7 };
    }

    try {
        const lastRenewalDate = new Date(lastRenewalStr);
        const nextRenewalDate = new Date(lastRenewalDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffMs = nextRenewalDate.getTime() - now.getTime();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const rawDate = nextRenewalDate.toLocaleDateString('es-ES', options);
        const formattedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

        return { formattedDate, daysLeft };
    } catch (e) {
        console.warn('⚠️ Error al calcular fecha de renovación:', e);
        return { formattedDate: "Cada 7 días", daysLeft: 7 };
    }
}

/**
 * Renderiza los detalles de la suscripción
 */
function renderSubscriptionDetails(user) {
    const container = document.getElementById('subscription-status-container');
    if (!container) return;

    const rawTier = String(user.subscriptionTier || 'free').toLowerCase();
    const tier = ['basic', 'advanced'].includes(rawTier) ? rawTier : 'free';
    const expiresAt = user.subscriptionExpiresAt;
    const status = user.subscriptionStatus || user.subscription_status;

    const isPremium = tier !== 'free' && status === 'active';
    const isAdmin = user.role === 'admin';

    if (isAdmin) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">ROL ADMINISTRADOR</span>
                    <span style="background: var(--primary-glow); color: var(--primary); border: 1px solid var(--border-hover); padding: 4px 12px; border-radius: 50px; font-size: 0.72rem; font-weight: 700;">ILIMITADO</span>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">
                    Posees acceso total y sin restricciones a todos los servicios de IA y administración de la plataforma.
                </div>
            </div>
        `;
        return;
    }

    if (isPremium) {
        const dateStr = expiresAt ? new Date(expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Acceso Activo';
        
        let planPerks = '';
        if (tier === 'basic') {
            planPerks = `
                <div style="display: flex; flex-direction: column; gap: 0.45rem; margin: 0.25rem 0; font-size: 0.85rem; color: var(--text-secondary);">
                    <div>• 50 Consultas diarias al Tutor IA</div>
                    <div>• 15 Simulacros completos por día</div>
                    <div>• Flashcards Manuales Ilimitadas</div>
                </div>
            `;
        } else {
            planPerks = `
                <div style="display: flex; flex-direction: column; gap: 0.45rem; margin: 0.25rem 0; font-size: 0.85rem; color: var(--text-secondary);">
                    <div>• 100 Consultas diarias al Tutor IA</div>
                    <div>• 25 Consultas diarias de Especialidad (RAG)</div>
                    <div>• 50 Simulacros completos por día</div>
                    <div>• 30 Generaciones de Flashcards con IA al mes</div>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">PLAN ${tier.toUpperCase()}</span>
                    <span style="background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); padding: 4px 12px; border-radius: 50px; font-size: 0.72rem; font-weight: 700;">ACTIVO</span>
                </div>

                ${planPerks}

                <div style="color: var(--text-secondary); font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    <i class="far fa-calendar-alt" style="color: var(--primary);"></i> Vence el: <strong style="color: var(--text-main);">${dateStr}</strong>
                </div>

                <a href="/pricing" class="btn-action btn-secondary" style="align-self: flex-start; margin-top: 0.25rem; text-decoration: none;">
                    Administrar Suscripción
                </a>
            </div>
        `;
    } else {
        const renewalInfo = getNextFreeRenewalInfo(user);

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">PLAN GRATUITO</span>
                    <span style="background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); padding: 4px 12px; border-radius: 50px; font-size: 0.72rem; font-weight: 700;">10 VIDAS / SEMANA</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.85rem; color: var(--text-secondary);">
                    <div>• <strong>10 Créditos semanales</strong> para simuladores y tutorías</div>
                    <div>• <strong>Recarga automática</strong> cada 7 días</div>
                </div>

                <div class="renewal-banner">
                    <i class="far fa-calendar-check"></i>
                    <div class="renewal-banner-text">
                        Próxima recarga: <strong>${renewalInfo.formattedDate}</strong>
                    </div>
                </div>

                <a href="/pricing" class="btn-action btn-primary" style="width: 100%; margin-top: 0.25rem; text-align: center; text-decoration: none;">
                    Activar Plan Basic o Advanced
                </a>
            </div>
        `;
    }
}

if (typeof document !== 'undefined') {
    // Modal de eliminación simplificado (Solo Google)
    const modal = typeof document !== 'undefined' ? document.getElementById('delete-modal') : null;
    const deleteInput = typeof document !== 'undefined' ? document.getElementById('delete-password') : null;
    const deleteError = typeof document !== 'undefined' ? document.getElementById('delete-error') : null;

    function openDeleteModal() {
        if (modal) modal.style.display = 'flex';
        if (deleteInput) deleteInput.value = '';
        if (deleteError) deleteError.style.display = 'none';
        const btn = typeof document !== 'undefined' ? document.getElementById('confirm-delete-btn') : null;
        if (btn) {
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Sí, eliminar cuenta';
            btn.disabled = false;
        }
        if (deleteInput) deleteInput.focus();
    }

    function closeDeleteModal() {
        if (modal) modal.style.display = 'none';
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDeleteModal();
        });
    }

    const confirmDeleteBtn = typeof document !== 'undefined' ? document.getElementById('confirm-delete-btn') : null;
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!deleteInput || deleteInput.value !== 'ELIMINAR') {
                if (deleteError) {
                    deleteError.innerHTML = '<i class="fas fa-exclamation-circle"></i> Debes escribir "ELIMINAR" textualmente.';
                    deleteError.style.display = 'block';
                }
                return;
            }

            const btn = document.getElementById('confirm-delete-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
                btn.disabled = true;
            }

            try {
                await AuthApiService.deleteAccount();
                await window.sessionManager.logout();
            } catch (error) {
                console.error(error);
                if (deleteError) {
                    deleteError.textContent = error.message || 'Error al eliminar cuenta';
                    deleteError.style.display = 'block';
                }
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-trash-alt"></i> Sí, eliminar cuenta';
                    btn.disabled = false;
                }
            }
        });
    }

    // Modal de edición de nombre
    const editNameModal = typeof document !== 'undefined' ? document.getElementById('edit-name-modal') : null;
    const newNameInput = typeof document !== 'undefined' ? document.getElementById('new-name-input') : null;
    const editNameError = typeof document !== 'undefined' ? document.getElementById('edit-name-error') : null;

    function openEditNameModal() {
        if (editNameModal) editNameModal.style.display = 'flex';
        const currentNameEl = typeof document !== 'undefined' ? document.getElementById('user-name') : null;
        const currentName = currentNameEl ? currentNameEl.textContent : '';
        if (newNameInput) {
            newNameInput.value = currentName !== 'Cargando...' ? currentName : '';
            newNameInput.focus();
        }
        if (editNameError) editNameError.style.display = 'none';
    }

    function closeEditNameModal() {
        if (editNameModal) editNameModal.style.display = 'none';
    }

    if (editNameModal) {
        editNameModal.addEventListener('click', (e) => {
            if (e.target === editNameModal) closeEditNameModal();
        });
    }

    async function submitNameChange() {
        if (!newNameInput) return;
        const newName = newNameInput.value.trim();
        if (newName.length < 2) {
            if (editNameError) {
                editNameError.textContent = 'El nombre debe tener al menos 2 caracteres.';
                editNameError.style.display = 'block';
            }
            return;
        }

        const btn = document.getElementById('confirm-edit-name-btn');
        if (btn) {
            btn.textContent = 'Guardando...';
            btn.disabled = true;
        }

        try {
            await AuthApiService.updateProfile(newName);
            // Actualizar UI
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = newName;
            // Actualizar sesión local
            if (window.sessionManager) {
                const user = window.sessionManager.getUser();
                if (user) {
                    user.name = newName;
                    window.sessionManager.setUser(user);
                }
            }
            closeEditNameModal();
        } catch (error) {
            console.error(error);
            if (editNameError) {
                editNameError.textContent = error.message || 'Error al actualizar el nombre.';
                editNameError.style.display = 'block';
            }
        } finally {
            if (btn) {
                btn.textContent = 'Guardar Cambios';
                btn.disabled = false;
            }
        }
    }
}

/**
 * Genera el componente HTML para una tarjeta de métrica de consumo
 */
function createUsageCardHTML({ title, colorHex, badge, countVal, percentage, labelLeft, labelRight }) {
    return `
        <div class="usage-item">
            <div class="usage-item-header">
                <div class="usage-title-group">
                    <div class="usage-title-text-wrap">
                        <div class="usage-title">${title}</div>
                        <span class="usage-badge-tag">${badge}</span>
                    </div>
                </div>
                <div class="usage-count-val" style="color: ${colorHex};">${countVal}</div>
            </div>
            <div class="usage-progress-bg">
                <div class="usage-progress-bar" style="width: ${percentage}%; background: ${colorHex};"></div>
            </div>
            <div class="usage-footer">
                <span class="usage-footer-left">${labelLeft}</span>
                <span class="usage-footer-right" style="color: ${colorHex}; font-weight: 600;">${labelRight}</span>
            </div>
        </div>
    `;
}

/**
 * Renderiza el consumo detallado de cuotas
 */
function renderUsageDetails(user) {
    const usageCard = document.getElementById('premium-usage-card');
    const container = document.getElementById('premium-usage-container');
    const planTag = document.getElementById('usage-plan-tag');
    const titleEl = document.getElementById('usage-section-title');
    const subtitleEl = document.getElementById('usage-section-subtitle');

    if (!usageCard || !container) return;

    const rawTier = String(user.subscriptionTier || 'free').toLowerCase();
    const tier = ['basic', 'advanced'].includes(rawTier) ? rawTier : 'free';
    const status = user.subscriptionStatus || user.subscription_status;
    const isPremium = tier !== 'free' && status === 'active';
    const isAdmin = user.role === 'admin';

    usageCard.style.display = 'block';

    if (planTag) {
        if (isAdmin) planTag.textContent = 'ADMINISTRADOR';
        else if (tier === 'advanced') planTag.textContent = 'PLAN ADVANCED';
        else if (tier === 'basic') planTag.textContent = 'PLAN BASIC';
        else planTag.textContent = 'PLAN GRATUITO';
    }

    if (isAdmin) {
        if (titleEl) titleEl.textContent = 'Acceso de Administrador';
        if (subtitleEl) subtitleEl.textContent = 'Permisos globales para todos los módulos y herramientas de la plataforma.';

        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: var(--bg-tertiary); border: 1px dashed var(--border-color); border-radius: 14px;">
                <h4 style="color: var(--text-main); margin: 0 0 0.4rem 0; font-weight: 700; font-size: 1.05rem;">Acceso Ilimitado de Administrador</h4>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 auto; max-width: 540px; line-height: 1.5;">Tu cuenta posee permisos globales y acceso sin restricciones ni límites de cuota en todas las funciones de IA.</p>
            </div>
        `;
        return;
    }

    const limits = user.limits || {};

    if (isPremium) {
        if (titleEl) titleEl.textContent = 'Consumo de Servicios IA';
        if (subtitleEl) subtitleEl.textContent = 'Monitoreo en tiempo real de las cuotas asignadas a tu nivel de membresía actual.';

        let cardsHTML = '';

        // 1. Tutor IA Estándar (Basic & Advanced)
        const aiLimit = limits.chat_standard || (tier === 'basic' ? 50 : 100);
        const aiUsed = user.dailyAiUsage !== undefined ? user.dailyAiUsage : (user.daily_ai_usage || 0);
        const aiRemaining = Math.max(0, aiLimit - aiUsed);
        const aiPct = Math.min(100, (aiUsed / aiLimit) * 100);

        cardsHTML += createUsageCardHTML({
            title: 'Tutor de IA Estándar',
            colorHex: 'var(--primary)',
            badge: 'Diario',
            countVal: `${aiUsed} / ${aiLimit}`,
            percentage: aiPct,
            labelLeft: 'Interacciones con Tutor IA',
            labelRight: `Disponibles: ${aiRemaining}`
        });

        // 2. Consultas RAG (SOLO PARA ADVANCED)
        if (tier === 'advanced') {
            const ragLimit = limits.daily_rag_limit !== undefined ? limits.daily_rag_limit : 25;
            const ragUsed = user.dailyRagUsage !== undefined ? user.dailyRagUsage : (user.daily_rag_usage || 0);
            const ragRemaining = Math.max(0, ragLimit - ragUsed);
            const ragPct = ragLimit > 0 ? Math.min(100, (ragUsed / ragLimit) * 100) : 0;

            cardsHTML += createUsageCardHTML({
                title: 'Consultas RAG Especializadas',
                colorHex: 'var(--accent-teal)',
                badge: 'Diario (Advanced)',
                countVal: `${ragUsed} / ${ragLimit}`,
                percentage: ragPct,
                labelLeft: 'Base de conocimiento oficial',
                labelRight: `Disponibles: ${ragRemaining}`
            });
        }

        // 3. Simuladores (Basic & Advanced)
        const simLimit = limits.simulator || (tier === 'basic' ? 15 : 50);
        const simUsed = user.dailySimulatorUsage !== undefined ? user.dailySimulatorUsage : (user.daily_simulator_usage || 0);
        const simRemaining = Math.max(0, simLimit - simUsed);
        const simPct = Math.min(100, (simUsed / simLimit) * 100);

        cardsHTML += createUsageCardHTML({
            title: 'Simulacros y Exámenes',
            colorHex: 'var(--accent-purple)',
            badge: 'Diario',
            countVal: `${simUsed} / ${simLimit}`,
            percentage: simPct,
            labelLeft: 'Evaluaciones rendidas hoy',
            labelRight: `Disponibles: ${simRemaining}`
        });

        // 4. Flashcards (SOLO PARA ADVANCED)
        if (tier === 'advanced') {
            const fcLimit = limits.monthly_flashcards || 30;
            const fcUsed = user.monthlyFlashcardsUsage !== undefined ? user.monthlyFlashcardsUsage : (user.monthly_flashcards_usage || 0);
            const fcRemaining = Math.max(0, fcLimit - fcUsed);
            const fcPct = Math.min(100, (fcUsed / fcLimit) * 100);

            cardsHTML += createUsageCardHTML({
                title: 'Generador de Flashcards',
                colorHex: 'var(--warning)',
                badge: 'Mensual (Advanced)',
                countVal: `${fcUsed} / ${fcLimit}`,
                percentage: fcPct,
                labelLeft: 'Creación de mazos con IA',
                labelRight: `Disponibles: ${fcRemaining}`
            });
        }

        container.innerHTML = cardsHTML;
    } else {
        // Plan Free / Pending
        if (titleEl) titleEl.textContent = 'Créditos de Vidas Semanales';
        if (subtitleEl) subtitleEl.textContent = 'Tus créditos se recargan automáticamente a 10 cada 7 días para practicar en simulacros y consultar al Tutor IA.';

        const usageCount = user.usageCount !== undefined ? user.usageCount : (user.usage_count || 0);
        const maxFreeLimit = user.maxFreeLimit !== undefined ? user.maxFreeLimit : (user.max_free_limit || 10);
        const remaining = Math.max(0, maxFreeLimit - usageCount);
        const pct = Math.min(100, (remaining / maxFreeLimit) * 100);
        
        let colorHex = 'var(--success)';
        if (remaining <= 2 && remaining > 0) {
            colorHex = 'var(--warning)';
        } else if (remaining === 0) {
            colorHex = 'var(--danger)';
        }

        container.innerHTML = `
            <div class="usage-item" style="grid-column: 1 / -1;">
                <div class="usage-item-header">
                    <div class="usage-title-group">
                        <div class="usage-title-text-wrap">
                            <div class="usage-title">Créditos de Exploración Disponibles</div>
                            <span class="usage-badge-tag">Recarga Semanal (10 Vidas)</span>
                        </div>
                    </div>
                    <div class="usage-count-val" style="color: ${colorHex}; font-size: 1.25rem; font-weight: 800;">${remaining} / ${maxFreeLimit}</div>
                </div>
                <div class="usage-progress-bg">
                    <div class="usage-progress-bar" style="width: ${pct}%; background: ${colorHex};"></div>
                </div>
                <div class="usage-footer">
                    <span class="usage-footer-left">Consumidos esta semana: ${usageCount}</span>
                    <span class="usage-footer-right" style="color: ${colorHex}; font-weight: 600;">Disponibles: ${remaining} vidas</span>
                </div>
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createUsageCardHTML,
        renderUsageDetails,
        getNextFreeRenewalInfo,
        getSafeProfileImageUrl
    };
}
