// Este archivo centraliza la creación de instancias de todos los controladores.
// Esto asegura que toda la aplicación use la misma instancia (singleton) para cada controlador,
// evitando problemas de contexto y servicios no inicializados.

// --- 1. Importar las CLASES de los servicios y controladores ---
const AuthService = require('../../domain/services/authService');
const UserRepository = require('../../domain/repositories/userRepository'); // ✅ 1. Importar la CLASE del repositorio.
const ChatService = require('../../domain/services/chatService');
const AnalyticsService = require('../../domain/services/analyticsService');
const AdminService = require('../../domain/services/adminService');
const SearchService = require('../../domain/services/searchService');
const UsageService = require('../../domain/services/usageService'); // ✅ NUEVO

const AuthController = require('./authController');
const ChatController = require('./chatController');
const AnalyticsController = require('./analyticsController');
const CoursesController = require('./coursesController');
const UsageController = require('./usageController'); // ✅ NUEVO

// --- 2. Crear una ÚNICA instancia de cada SERVICIO ---
const userRepository = new UserRepository(); // ✅ 2. Crear una ÚNICA instancia del repositorio.
const authService = new AuthService(userRepository); // ✅ Inyectar el repositorio en el servicio.
const analyticsService = new AnalyticsService();
const chatService = new ChatService();
const adminService = new AdminService();
const searchService = new SearchService();
const usageService = new UsageService(); // ✅ NUEVO: Servicio singleton

// --- 3. Inyectar los servicios en los controladores al crearlos ---
module.exports = {
    authController: new AuthController(authService), // Ahora authService tiene su repositorio.
    chatController: new ChatController(chatService, analyticsService, usageService), // ✅ Nuevo: Inyectar usageService
    analyticsController: new AnalyticsController(analyticsService, userRepository), // ✅ 3. Inyectar el repositorio.
    coursesController: new CoursesController(searchService, adminService),
    usageController: new UsageController(usageService), // ✅ NUEVO
    adminController: require('./adminController') // ✅ NUEVO: Importar la instancia singleton directamente
};