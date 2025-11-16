const express = require('express');
const router = express.Router();
const authController = require('../../application/controllers/authController');
const { auth, adminOnly } = require('../middleware/authMiddleware'); // ✅ Importar adminOnly

router.post('/login', authController.login);
router.post('/register', authController.register);

// Ruta protegida para obtener la información del usuario actual
router.get('/me', auth, authController.getMe);

// Ruta para que un usuario cambie su propia contraseña.
router.put('/change-password', auth, authController.changePassword);

// ✅ NUEVA RUTA: Para que un administrador restablezca la contraseña de cualquier usuario.
// Esta ruta es más lógica aquí que en apiRoutes.js.
router.post('/users/:id/reset-password', auth, adminOnly, authController.adminResetPassword);

module.exports = router;