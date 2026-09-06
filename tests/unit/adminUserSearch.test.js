const fs = require('fs');
const path = require('path');

describe('Admin Panel - Búsqueda de Usuarios por Correo y Nombre', () => {
    let componentsJs;
    let adminJs;

    beforeAll(() => {
        componentsJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/ui/components.js'), 'utf8');
        adminJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/admin.js'), 'utf8');
    });

    test('createAdminItemCardHTML incluye data-email y data-name en las tarjetas de usuarios/alumnos', () => {
        global.safeHtmlValue = (val) => String(val || '');
        global.document = {
            addEventListener: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => [])
        };
        global.window = {
            resolveImageUrl: (url) => url,
            uiManager: {
                registerMaterial: jest.fn(),
                isResourceLocked: jest.fn()
            }
        };

        const student = {
            id: 'usr_123',
            name: 'Carlos Mendoza',
            email: 'carlos.mendoza@universidad.edu.pe',
            subscriptionTier: 'advanced',
            subscriptionStatus: 'active',
            subscriptionExpiresAt: '2026-12-31T00:00:00.000Z'
        };

        eval(componentsJs);

        const cardHtml = createAdminItemCardHTML(student, 'student', `(${student.email})`, true);

        expect(cardHtml).toContain('data-email="carlos.mendoza@universidad.edu.pe"');
        expect(cardHtml).toContain('data-name="Carlos Mendoza"');
        expect(cardHtml).toContain('carlos.mendoza@universidad.edu.pe');
        expect(cardHtml).toContain('ADVANCED');
        expect(cardHtml).toContain('ACTIVE');
    });

    test('El placeholder del buscador en la pestaña Alumnos/Usuarios indica búsqueda por correo', () => {
        expect(adminJs).toContain("tabId === 'tab-students' ? 'Buscar por nombre o correo...' : 'Buscar...'");
    });

    test('El algoritmo de filtrado en applySearchFilterForTab evalúa data-email, data-name y textContent', () => {
        expect(adminJs).toContain("const emailAttr = (item.dataset.email || '').toLowerCase();");
        expect(adminJs).toContain("const nameAttr = (item.dataset.name || '').toLowerCase();");
        expect(adminJs).toContain('matchesText = textContent.includes(searchVal) || emailAttr.includes(searchVal) || nameAttr.includes(searchVal);');
    });

    test('Simulación de filtrado por email: coincide por prefijo, dominio y nombre', () => {
        const student = {
            name: 'Ana García',
            email: 'ana.garcia@medicina.pe'
        };

        const emailAttr = student.email.toLowerCase();
        const nameAttr = student.name.toLowerCase();
        const textContent = `${student.name} (${student.email}) basic active`.toLowerCase();

        const match = (query) => {
            const q = query.toLowerCase().trim();
            return textContent.includes(q) || emailAttr.includes(q) || nameAttr.includes(q);
        };

        expect(match('ana')).toBe(true);
        expect(match('garcia')).toBe(true);
        expect(match('medicina.pe')).toBe(true);
        expect(match('carlos')).toBe(false);
    });
});