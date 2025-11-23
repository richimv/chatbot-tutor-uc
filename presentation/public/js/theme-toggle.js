/**
 * Theme Toggle System
 * Permite cambiar entre tema claro y oscuro con persistencia en localStorage
 */

(function () {
    'use strict';

    // Constantes
    const THEME_KEY = 'preferred-theme';
    const DARK_THEME_CLASS = 'dark-theme';
    const THEME_TOGGLE_ID = 'theme-toggle';
    const THEME_ICON_ID = 'theme-icon';

    // Elementos del DOM
    let themeToggleBtn = null;
    let themeIcon = null;

    /**
     * Inicializa el tema basado en la preferencia guardada o del sistema
     */
    function initTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);

        if (savedTheme === 'dark') {
            // Aplicar tema oscuro guardado
            document.body.classList.add(DARK_THEME_CLASS);
        } else if (savedTheme === 'light') {
            // Aplicar tema claro guardado
            document.body.classList.remove(DARK_THEME_CLASS);
        } else {
            // Sin preferencia guardada - detectar preferencia del sistema
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add(DARK_THEME_CLASS);
                localStorage.setItem(THEME_KEY, 'dark');
            }
        }

        updateIcon();
    }

    /**
     * Cambia entre tema claro y oscuro
     */
    function toggleTheme() {
        const isDark = document.body.classList.toggle(DARK_THEME_CLASS);

        // Guardar preferencia
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');

        // Actualizar icono
        updateIcon();

        // Animación del icono
        if (themeIcon) {
            themeIcon.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                themeIcon.style.transform = 'rotate(0deg)';
            }, 300);
        }
    }

    /**
     * Actualiza el icono del botón según el tema activo
     */
    function updateIcon() {
        if (!themeIcon) return;

        const isDark = document.body.classList.contains(DARK_THEME_CLASS);

        // Cambiar icono: luna para tema oscuro, sol para tema claro
        if (isDark) {
            themeIcon.className = 'fas fa-moon';
            if (themeToggleBtn) {
                themeToggleBtn.setAttribute('title', 'Cambiar a tema claro');
                themeToggleBtn.setAttribute('aria-label', 'Cambiar a tema claro');
            }
        } else {
            themeIcon.className = 'fas fa-sun';
            if (themeToggleBtn) {
                themeToggleBtn.setAttribute('title', 'Cambiar a tema oscuro');
                themeToggleBtn.setAttribute('aria-label', 'Cambiar a tema oscuro');
            }
        }
    }

    /**
     * Inicializa los event listeners
     */
    function initEventListeners() {
        themeToggleBtn = document.getElementById(THEME_TOGGLE_ID);
        themeIcon = document.getElementById(THEME_ICON_ID);

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // Detectar cambios en la preferencia del sistema (opcional)
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Solo aplicar si el usuario no tiene preferencia guardada
                const savedTheme = localStorage.getItem(THEME_KEY);
                if (!savedTheme) {
                    if (e.matches) {
                        document.body.classList.add(DARK_THEME_CLASS);
                    } else {
                        document.body.classList.remove(DARK_THEME_CLASS);
                    }
                    updateIcon();
                }
            });
        }
    }

    /**
     * Inicialización cuando el DOM está listo
     */
    function init() {
        // Aplicar tema inmediatamente (antes de DOMContentLoaded para evitar flash)
        initTheme();

        // Configurar event listeners cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEventListeners);
        } else {
            initEventListeners();
        }
    }

    // Ejecutar inicialización
    init();

})();
