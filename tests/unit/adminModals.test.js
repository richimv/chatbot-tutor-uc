const fs = require('fs');
const path = require('path');

describe('Admin Panel - Modales Responsivas y Contraste Dual-Theme', () => {
    let adminCss;
    let adminJs;
    let adminHtml;

    beforeAll(() => {
        adminCss = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/css/admin.css'), 'utf8');
        adminJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/admin.js'), 'utf8');
        adminHtml = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/admin.html'), 'utf8');
    });

    describe('1. Cumplimiento de Design System y Dual-Theme en Modales', () => {
        test('admin.css no debe contener el background oscuro hardcodeado (#0f0f13) en .modal-content', () => {
            // El background #0f0f13 rompía el modo claro forzando fondos oscuros
            const modalContentBlocks = adminCss.match(/\.modal-content\s*\{[^}]*\}/g) || [];
            for (const block of modalContentBlocks) {
                expect(block).not.toContain('#0f0f13');
            }
        });

        test('.modal-content debe implementar las variables de tema var(--modal-bg) y var(--border-color)', () => {
            expect(adminCss).toMatch(/\.modal-content\s*\{[^}]*background:\s*var\(--modal-bg\)/);
            expect(adminCss).toMatch(/\.modal-content\s*\{[^}]*border:\s*1px\s+solid\s+var\(--border-color\)/);
            expect(adminCss).toMatch(/\.modal-content\s*\{[^}]*box-shadow:\s*var\(--shadow-xl\)/);
        });

        test('Arquitectura de caja: .modal-content debe tener padding: 0 !important para anclaje limpio de header/footer', () => {
            expect(adminCss).toMatch(/\.modal-content\s*\{[^}]*padding:\s*0\s*!important/);
        });

        test('Subcontenedores internos de modales utilizan tokens Dual-Theme de alto contraste', () => {
            // Tarjetas de métodos de importación masiva
            expect(adminCss).toContain('.import-method-card {');
            expect(adminCss).toMatch(/\.import-method-card\s*\{[^}]*background:\s*var\(--bg-tertiary\)/);
            expect(adminCss).toMatch(/\.import-method-card\s*\{[^}]*border:\s*1px\s+solid\s+var\(--border-color\)/);

            // Contenedores de carga de imágenes
            expect(adminCss).toContain('.image-upload-group {');
            expect(adminCss).toMatch(/\.image-upload-group\s*\{[^}]*background:\s*var\(--bg-tertiary\)/);

            // Contenedor de árbol de dominios IA
            expect(adminCss).toContain('#ai-domain-container {');
            expect(adminCss).toMatch(/#ai-domain-container\s*\{[^}]*background:\s*var\(--bg-tertiary\)/);

            // Chips seleccionados tienen texto blanco de alto contraste
            expect(adminCss).toMatch(/\.selected-chip\s*\{[^}]*color:\s*#ffffff\s*!important/);
        });

        test('No deben existir variables CSS huérfanas en admin.css ni admin.js', () => {
            expect(adminCss).not.toContain('--danger-color');
            expect(adminCss).not.toContain('--accent-color');
            expect(adminJs).not.toContain('--danger-color');
        });
    });

    describe('2. Responsividad Móvil (≤ 768px y ≤ 480px) y Adaptabilidad de Ancho', () => {
        test('Media query móvil (≤ 768px) ajusta el ancho de .modal-content con márgenes perimetrales', () => {
            expect(adminCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.modal-content\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*20px\)\s*!important/);
        });

        test('Media query ultracompacta (≤ 480px) ajusta márgenes seguros para pantallas de 360px-480px', () => {
            expect(adminCss).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.modal-content\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*16px\)\s*!important/);
        });

        test('Colapso automático de cuadrículas multi-columna en modales para pantallas móviles', () => {
            // Impide que campos en 2 o 3 columnas (como Opciones A/B/C/D o Dominio/Target) se aplasten
            expect(adminCss).toMatch(/\.modal-body\s+div\[style\*="grid-template-columns"\]\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*!important/);
        });

        test('Acciones de subida de imágenes (.image-upload-actions) hacen flex-wrap en pantallas móviles', () => {
            expect(adminCss).toMatch(/\.image-upload-actions\s*\{[\s\S]*?flex-wrap:\s*wrap/);
        });

        test('openGenericModal ajusta dinámicamente el ancho máximo en pantallas móviles', () => {
            expect(adminJs).toContain('if (window.innerWidth <= 768) {');
            expect(adminJs).toContain("modalContent.style.width = 'calc(100% - 16px)';");
            expect(adminJs).toContain("modalContent.style.maxWidth = '100%';");
        });
    });

    describe('3. Integración de TinyMCE Editor con Dual-Theme Dinámico', () => {
        test('getStandardTinyMCEConfig detecta data-theme y aplica skins/colores acordes a Light y Dark mode', () => {
            expect(adminJs).toContain("const isDark = document.documentElement.getAttribute('data-theme') !== 'light';");
            expect(adminJs).toContain("skin: isDark ? 'oxide-dark' : 'oxide'");
            expect(adminJs).toContain("content_css: isDark ? 'dark' : 'default'");
            expect(adminJs).toContain("const bodyTextColor = isDark ? '#f8fafc' : '#0f172a';");
            expect(adminJs).toContain("const bodyBgColor = isDark ? '#121212' : '#ffffff';");
        });
    });

    describe('4. Estructura y Clases del Modal de Confirmación en admin.html', () => {
        test('admin.html incluye la estructura completa de confirmation-modal-card con contraste y diseño accesible', () => {
            expect(adminHtml).toContain('id="confirmation-modal"');
            expect(adminHtml).toContain('confirmation-modal-card');
            expect(adminHtml).toContain('confirmation-modal-header');
            expect(adminHtml).toContain('confirmation-title-wrap');
            expect(adminHtml).toContain('confirmation-modal-icon-container');
            expect(adminHtml).toContain('confirmation-modal-body');
            expect(adminHtml).toContain('confirmation-modal-footer');
        });
    });
});
