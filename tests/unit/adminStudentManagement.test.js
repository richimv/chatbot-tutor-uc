const fs = require('fs');
const path = require('path');
const adminService = require('../../src/domain/services/adminService');

jest.mock('../../src/domain/repositories/adminRepository');
jest.mock('../../src/infrastructure/database/db');

describe('Admin Panel - Arquitectura de Gestión de Alumnos y Suscripciones', () => {
    let componentsJs;
    let adminJs;
    let designSystemMd;
    let mockUserRepo;

    beforeAll(() => {
        componentsJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/ui/components.js'), 'utf8');
        adminJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/admin.js'), 'utf8');
        designSystemMd = fs.readFileSync(path.join(__dirname, '../../documentation/DESIGN_SYSTEM.md'), 'utf8');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepo = {
            create: jest.fn(),
            findById: jest.fn(),
            findByRole: jest.fn(),
            update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
            delete: jest.fn()
        };
        adminService.repositories.user = mockUserRepo;
    });

    describe('1. Capa de Dominio (adminService.js): Creación y Consistencia de Alumnos', () => {
        test('adminService.create crea usuario y no inyecta contraseñas temporales (Google OAuth exclusivo)', async () => {
            const fakeUser = {
                id: 'usr-google-uuid',
                name: 'Mariana Ríos',
                email: 'mariana.rios@gmail.com',
                role: 'student',
                subscriptionTier: 'free',
                subscriptionStatus: 'pending'
            };

            mockUserRepo.create.mockResolvedValue(fakeUser);
            mockUserRepo.findById.mockResolvedValue(fakeUser);
            mockUserRepo.update.mockResolvedValue(fakeUser);

            const result = await adminService.create('student', {
                name: 'Mariana Ríos',
                email: 'mariana.rios@gmail.com',
                subscriptionTier: 'free',
                subscriptionStatus: 'pending'
            });

            expect(mockUserRepo.create).toHaveBeenCalledWith({
                id: null,
                email: 'mariana.rios@gmail.com',
                name: 'Mariana Ríos',
                role: 'student'
            });
            expect(result.tempPassword).toBeUndefined();
            expect(result.id).toBe('usr-google-uuid');
        });

        test('adminService.create con plan avanzado inicializa consistencia y resetea consumos', async () => {
            const initialUser = {
                id: 'usr-adv-123',
                name: 'Carlos Ruiz',
                email: 'carlos.ruiz@medicina.pe',
                role: 'student'
            };

            const updatedUser = {
                ...initialUser,
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active'
            };

            mockUserRepo.create.mockResolvedValue(initialUser);
            mockUserRepo.findById.mockResolvedValue(initialUser);
            mockUserRepo.update.mockResolvedValue(updatedUser);

            const result = await adminService.create('student', {
                name: 'Carlos Ruiz',
                email: 'carlos.ruiz@medicina.pe',
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active'
            });

            expect(mockUserRepo.update).toHaveBeenCalledWith('usr-adv-123', expect.objectContaining({
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active',
                usageCount: 0,
                dailyAiUsage: 0,
                dailyRagUsage: 0,
                dailySimulatorUsage: 0,
                monthlyFlashcardsUsage: 0
            }));
            expect(result.tempPassword).toBeUndefined();
        });

        test('adminService.update calcula +4 meses para plan avanzado cuando no se envía fecha', async () => {
            mockUserRepo.findById.mockResolvedValue({
                id: 'u-target',
                subscriptionTier: 'free',
                subscriptionStatus: 'pending'
            });
            mockUserRepo.update.mockResolvedValue({
                id: 'u-target',
                subscriptionTier: 'advanced',
                subscriptionStatus: 'active'
            });

            await adminService.update('student', 'u-target', {
                subscriptionTier: 'advanced'
            });

            const updateArg = mockUserRepo.update.mock.calls[0][1];
            expect(updateArg.subscriptionTier).toBe('advanced');
            expect(updateArg.subscriptionStatus).toBe('active');
            expect(updateArg.subscriptionExpiresAt).toBeInstanceOf(Date);

            const diffMonths = (updateArg.subscriptionExpiresAt - new Date()) / (1000 * 60 * 60 * 24 * 30);
            expect(diffMonths).toBeCloseTo(4, 0);
        });

        test('adminService.update degrada a free y limpia fecha al pasar a expired o pending', async () => {
            mockUserRepo.findById.mockResolvedValue({
                id: 'u-target',
                subscriptionTier: 'basic',
                subscriptionStatus: 'active',
                subscriptionExpiresAt: new Date()
            });
            mockUserRepo.update.mockResolvedValue({
                id: 'u-target',
                subscriptionTier: 'free',
                subscriptionStatus: 'expired',
                subscriptionExpiresAt: null
            });

            await adminService.update('student', 'u-target', {
                subscriptionStatus: 'expired'
            });

            expect(mockUserRepo.update).toHaveBeenCalledWith('u-target', expect.objectContaining({
                subscriptionTier: 'free',
                subscriptionStatus: 'expired',
                subscriptionExpiresAt: null
            }));
        });
    });

    describe('2. Capa de Presentación (admin.js): Controladores de Alumnos y Mensajería', () => {
        test('displayStudents() no pasa showResetPassword=true para erradicar botones de contraseñas locales', () => {
            expect(adminJs).toContain("const sortedStudents = this.sortData(this.allStudents, 'student', 'tab-students');");
            expect(adminJs).toContain("const itemsHTML = sortedStudents.map(student => createAdminItemCardHTML(student, 'student', `(${student.email})`)).join('');");
            expect(adminJs).not.toContain("createAdminItemCardHTML(student, 'student', `(${student.email})`, true)");
        });

        test('handleResetPassword muestra modal informativo de autenticación exclusiva Google OAuth', () => {
            expect(adminJs).toContain('Hub Academia utiliza autenticación exclusiva mediante Google OAuth');
            expect(adminJs).not.toContain('/api/auth/users/${userId}/reset-password');
        });

        test('saveGenericForm muestra mensaje de bienvenida Google para alumnos nuevos', () => {
            expect(adminJs).toContain("type === 'student' && method === 'POST'");
            expect(adminJs).toContain('El usuario podrá ingresar directamente con su cuenta de Google');
            expect(adminJs).not.toContain('responseData.tempPassword');
        });

        test('admin.js maneja la lógica de reactividad bidireccional entre tier y status en el formulario modal', () => {
            expect(adminJs).toContain("tierSelect.addEventListener('change', () => {");
            expect(adminJs).toContain("if (tier === 'basic') {");
            expect(adminJs).toContain("statusSelect.value = 'active';");
            expect(adminJs).toContain("expiresInput.value = getFutureDate(2);");
            expect(adminJs).toContain("} else if (tier === 'advanced') {");
            expect(adminJs).toContain("expiresInput.value = getFutureDate(4);");
            expect(adminJs).toContain("} else if (tier === 'free') {");
            expect(adminJs).toContain("statusSelect.value = 'pending';");
            expect(adminJs).toContain("expiresInput.value = '';");
        });
    });

    describe('3. Componentes Visuales (components.js): Tarjeta de Alumno y Badges', () => {
        test('createAdminItemCardHTML omite botón reset-pass cuando no se solicita', () => {
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
            eval(componentsJs);

            const student = {
                id: 'std_456',
                name: 'Luis Alarcón',
                email: 'luis.alarcon@gmail.com',
                subscriptionTier: 'basic',
                subscriptionStatus: 'active',
                subscriptionExpiresAt: '2026-11-05T00:00:00.000Z'
            };

            const html = createAdminItemCardHTML(student, 'student', `(${student.email})`);

            expect(html).toContain('Luis Alarcón');
            expect(html).toContain('luis.alarcon@gmail.com');
            expect(html).toContain('data-email="luis.alarcon@gmail.com"');
            expect(html).toContain('data-name="Luis Alarcón"');
            expect(html).toContain('admin-badge-blue');
            expect(html).toContain('BASIC');
            expect(html).toContain('admin-badge-green');
            expect(html).toContain('ACTIVE');
            expect(html).toContain('📅 Expira:');
            expect(html).not.toContain('reset-pass-btn-small');
            expect(html).toContain('edit-btn-small');
            expect(html).toContain('delete-btn-small');
        });
    });

    describe('4. Coherencia con DESIGN_SYSTEM.md', () => {
        test('DESIGN_SYSTEM.md documenta la Sección 13 para Panel de Gestión y Gestión de Alumnos', () => {
            expect(designSystemMd).toContain('## 13. 🖥️ Arquitectura y Estándar Visual del Panel de Gestión / Administración');
            expect(designSystemMd).toContain('13.1. Layout del Panel y Contenedor Maestro');
            expect(designSystemMd).toContain('13.4. Arquitectura Avanzada de Modales del Panel de Gestión');
            expect(designSystemMd).toContain('13.5. Subcontenedores Internos dentro de las Modales');
            expect(designSystemMd).toContain('13.6. Adaptabilidad Móvil y Colapso Automático de Cuadrículas');
            expect(designSystemMd).toContain('13.7. Editor Científico TinyMCE 6 Dual-Theme Dinámico');
            expect(designSystemMd).toContain('13.9. Arquitectura y Reglas de la Pestaña de Gestión de Alumnos / Usuarios');
            expect(designSystemMd).toContain('Google OAuth');
            expect(designSystemMd).toContain('calc(100% - 20px)');
            expect(designSystemMd).toContain('calc(100% - 16px)');
        });
    });
});
