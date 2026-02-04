# 🎓 Chatbot Tutor UC - Hub Académico

![Hub Académico Banner](https://www.hubacademia.com/assets/logo.png)

**Tu compañero de estudios inteligente.**  
Plataforma educativa integral que combina una vasta biblioteca virtual, un tutor basado en Inteligencia Artificial y un sistema de gamificación para potenciar el aprendizaje universitario.

🌐 **Sitio Web Oficial:** [hubacademia.com](https://hubacademia.com)

---

## 🚀 Características Principales

### 1. 📚 Biblioteca Virtual Especializada
Acceso centralizado a recursos educativos organizados por Carreras y Cursos.
- **Libros:** Catálogo extenso de bibliografía digital.
- **Videos y Artículos:** Material complementario curado.
- **Organización:** Filtrado inteligente por áreas de estudio.

### 2. 🤖 Tutor IA Personalizado (Gemini 2.5)
Un asistente virtual disponible 24/7 para resolver dudas teóricas.
- **RAG (Retrieval Augmented Generation):** El tutor no "alucina"; consulta nuestra base de datos de libros antes de responder para dar referencias precisas.
- **Contexto Académico:** Entiende sobre los cursos y mallas curriculares de la institución.
- **Ayuda en Tiempo Real:** Resúmenes, explicaciones de conceptos y recomendaciones de lectura.

### 3. ⚔️ Quiz Arena (Gamificación)
Refuerza lo aprendido compitiendo.
- **Retos Académicos:** Pon a prueba tus conocimientos en desafíos cronometrados.
- **Ranking Global:** Compite con otros estudiantes de tu carrera.

---

## 🛠️ Stack Tecnológico

El proyecto utiliza una arquitectura moderna y escalable de 4 capas.

### Frontend
- **Tecnología:** Vanilla JS (ES6+), HTML5, CSS3.
- **Diseño:** Responsive, Mobile-First con Glassmorphism y UI moderna.
- **Hosting:** **Vercel** (CDN Global).

### Backend
- **Tecnología:** Node.js + Express.
- **IA Engine:** Google Vertex AI (Gemini 2.5 Flash) con Function Calling.
- **Despliegue:** **Render** (Web Service).

### Base de Datos
- **Proveedor:** **Supabase** (PostgreSQL).
- **Características:** Tablas relacionales para usuarios, cursos, libros e historial de chat.

### Infraestructura Adicional
- **Correos:** **Resend** (Notificaciones transaccionales).
- **Almacenamiento:** Supabase Storage (para portadas y recursos).

---

## 💳 Pasarela de Pagos

Integración nativa con **Mercado Pago** para la venta del "Mega Pack Universitario".

- **Seguridad:** Gestión segura de webhooks para activación automática de cuentas.
- **Métodos:** Yape, Plin y Tarjetas (Débito/Crédito).
- **Flujo:** Activación inmediata de la suscripción `Premium` tras la confirmación del pago.

---

## 🔧 Instalación y Despliegue Local

### Requisitos
- Node.js v18+
- Cuenta en Google Cloud (Vertex AI)
- Cuenta en Supabase
- Credenciales de Mercado Pago

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-org/chatbot-tutor-uc.git
   cd chatbot-tutor-uc
   ```

2. **Instalar Dependencias**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno (.env)**
   ```env
   # Servidor
   PORT=3000
   NODE_ENV=development
   
   # Base de Datos (Supabase)
   DB_HOST=aws-0-us-west-1.pooler.supabase.com
   DB_USER=postgres
   DB_PASSWORD=tu_password
   DB_NAME=postgres
   
   # Google Vertex AI
   GOOGLE_CLOUD_PROJECT=tu-proyecto-id
   GOOGLE_CLOUD_LOCATION=us-central1
   
   # Mercado Pago
   MP_ACCESS_TOKEN=APP_USR-xxxxxx
   
   # Configuración Web
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:3000
   ```

4. **Correr en Desarrollo**
   ```bash
   npm run dev
   ```

---

## 📂 Estructura del Proyecto

```
chatbot-tutor-uc/
├── application/       # Lógica de aplicación (Controllers)
├── domain/           # Lógica de negocio (Services, Repositories)
├── infrastructure/   # DB, Server, Rutas, Configuración externa
├── presentation/     # Frontend (Public assets, HTML, JS UI)
├── ml_service/       # Microservicio Python (Analytics & Trends)
└── tests/            # Tests unitarios
```

---

## 📞 Soporte

Para consultas técnicas o soporte sobre la plataforma:
- **Email:** hubacademia01@gmail.com
- **Web:** [hubacademia.com/soporte](https://hubacademia.com)

---

© 2026 **Hub Academia**. Todos los derechos reservados.
