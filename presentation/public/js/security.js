/**
 * security.js
 * 
 * Implementa medidas de protección frontend para disuadir la copia no autorizada
 * y el acceso al código fuente por usuarios no técnicos.
 */

(function () {
    console.log('🛡️ Security Shield Activado');

    // 1. Deshabilitar Click Derecho (Context Menu)
    document.addEventListener('contextmenu', (e) => {
        // Permitir en inputs para poder copiar/pegar texto si es necesario
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        e.preventDefault();
        return false;
    });

    // 2. Deshabilitar Atajos de Teclado de Desarrollo (F12, Ctrl+U, etc.)
    document.addEventListener('keydown', (e) => {
        // F12
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }

        // Ctrl + Shift + I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            return false;
        }

        // Ctrl + Shift + J (Console)
        if (e.ctrlKey && e.shiftKey && e.key === 'J') {
            e.preventDefault();
            return false;
        }

        // Ctrl + Shift + C (Inspect Element)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            return false;
        }

        // Ctrl + U (View Source)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            return false;
        }
    });

    // 3. Detección básica de DevTools (debugger trap)
    // Esto detiene la ejecución si las DevTools están abiertas y el usuario no sabe cómo manejarlo.
    // Se ejecuta en un intervalo para verificar constantemente.
    // setInterval(() => {
    //     try {
    //         debugger; // Si las DevTools están abiertas, el navegador se detendrá aquí.
    //     } catch (err) {}
    // }, 2000);

    // NOTA: El debugger trap puede ser molesto durante el desarrollo legítimo.
    // Se recomienda activarlo solo en producción.

    // 4. Protección de arrastrar imágenes (Drag & Drop)
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

})();
