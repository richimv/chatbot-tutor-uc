# 📊 SISTEMA DE MONETIZACIÓN, LÍMITES Y SUSCRIPCIONES (Documento Consolidado)

Este documento centraliza toda la arquitectura de monetización, el modelo de suscripciones, las cuotas de control de consumo de IA y las interfaces visuales (UI/UX) integradas en HubAcademia. Sirve como la única fuente de verdad técnica para los desarrollos en estas áreas.

---

## 🏗️ 1. Estructura Matemática de Suscripciones (Planes y Tokens)

| Característica | **Plan Básico (Basic)** | **Plan Avanzado (Advanced)** | **Prueba Gratuita (Free)** |
| :--- | :--- | :--- | :--- |
| **Costo / Duración** | S/ 9.90 (2 Meses) | S/ 24.90 (4 Meses) | Gratuito |
| **Tutor IA (Chat)** | Estándar (50 msg/día, Sin RAG) | Inteligente con RAG / Razonamiento (100 msg/día) | Estándar (Sin RAG, Descuenta vidas) |
| **Consultas RAG** | No Incluido (0 msg/día) | Incluido (Hasta 25 msg RAG/Día, degradable a estándar) | No Incluido (Bloqueado) |
| **Voz (Audio Assistant)**| Estándar (50 msg/día) | Avanzado (100 msg/día) | Descuenta vidas |
| **Flashcards (Manuales)** | Ilimitadas (Texto puro hasta 1,000 caracteres por cara) | Personalizadas con Audio TTS (500 chars) e Imágenes (1,000 chars texto) | Estudio de mazos y repaso básico |
| **Carga Masiva Excel** | 3 archivos/día (Hasta 100 tarjetas/archivo, texto puro) | 10 archivos/día (Hasta 100 tarjetas/archivo con opción Audio TTS) | Bloqueado con Paywall |
| **Audio TTS e Imágenes**| No Incluido (Paywall) | Exclusivo (Síntesis TTS Google Cloud + Subida de Imágenes a GCS) | No Incluido (Paywall) |
| **Generación IA Flashcards** | No Incluido | 30 pedidos / mes (Hasta 20 tarjetas por pedido con Gemini) | No Incluido |
| **Clonación de Mazos** | Ilimitado estudio comunitario (Máx 30 clones/día anti-spam) | Ilimitado estudio comunitario (Máx 30 clones/día anti-spam) | Ilimitado estudio comunitario (Máx 30 clones/día anti-spam) |
| **Simulador de Exámenes** | **CAP 15/Día** | **CAP 50/Día** | Descuenta vidas (10 de prueba semanal) |

---

## 🔄 2. Ciclo de Vida del Estudiante (Conversión y Acceso)

El viaje de un usuario dentro de la plataforma se gestiona de forma secuencial:

### Fase 2.1: Registro e Inicialización (Visitante)
*   Cuando un nuevo usuario se registra a través de `authController.js`, PostgreSQL le asigna por defecto:
    *   `role`: `'student'`
    *   `subscription_tier`: `'free'`
    *   `subscription_status`: `'pending'`
    *   `subscription_expires_at`: `NULL`
*   Para evitar fricciones iniciales, `AuthService.js` aprovisiona automáticamente preferencias base en el simulador: target `SERUMS`, carrera `Medicina Humana`, dificultad `Básico` y 5 áreas del temario oficial MINSA.

### Fase 2.2: El Modelo de Vidas (Freemium de Entrada)
*   El usuario gratuito opera con un pool de **vidas** o créditos de prueba (columna `usage_count` inicializada en `10`, renovada cada 7 días).
*   Cada acción core (empezar examen, evaluar speaking, mensaje de chat) descuenta créditos (las consultas de chat descuentan exactamente 1 vida y se ejecutan sin RAG). Cuando se agotan, la UI despliega de forma segura el modal paywall bloqueante impidiendo el abuso del servicio.

### Fase 2.3: Compra y Webhook de Mercado Pago
*   El usuario adquiere un plan premium redireccionándose a Mercado Pago (`paymentController.js`). El servidor inyecta una variable oculta en la pasarela: `external_reference: "USER_ID_UUID|advanced"`.
*   La confirmación se gestiona de forma asíncrona mediante el Webhook de Mercado Pago (`handleWebhook`).
*   Al validarse un pago aprobado (`approved`) y verificar la seguridad de la tarifa, el servidor ejecuta la actualización en PostgreSQL:
    *   Establece `subscription_tier` a `'advanced'` o `'basic'`.
    *   Fija `subscription_status` a `'active'`.
    *   Resetea todos los consumos a cero (`0`).
    *   Actualiza la fecha de caducidad en formato UTC: `subscription_expires_at = NOW() + INTERVAL '4 months'` (ó 2 meses).

### Fase 2.3.1: Pago Manual vía Yape/Plin (Contacto Oficial WhatsApp)
*   **Interfaz pricing.html y Apps Móviles**: Ofrece un banner destacado que abre un modal con el canal de atención oficial de WhatsApp asociado al número **+51 993 869166** (Hub Academia). No se expone ningún número para transferencias directas ni código QR estático; en su lugar, se guía al usuario a contactar por WhatsApp para recibir las instrucciones personalizadas de pago y activar su cuenta al instante.
*   **Pestañas de Planes**: Permite seleccionar dinámicamente el plan básico (S/ 9.90 por 2 meses) o el plan avanzado (S/ 24.90 por 4 meses) y actualiza automáticamente los montos e instrucciones en tiempo real.
*   **Redirección Dinámica**: Mediante `pricing.js` / `pricing.tsx` y el gestor de sesión, se captura el email registrado del usuario para pre-llenar un mensaje de WhatsApp personalizado al hacer clic en "Contactar por WhatsApp (+51 993 869166)".
*   **Activación y Consistencia Interactiva en el Panel de Gestión (`admin.js`)**: El administrador puede editar el registro de cualquier estudiante desde el Panel de Gestión. El sistema automatiza y restringe los valores en el cliente en tiempo real:
*   Si selecciona `basic`, el estado cambia a `active` y se calcula la fecha actual + 2 meses.
*   Si selecciona `advanced`, el estado cambia a `active` y se calcula la fecha actual + 4 meses.
*   Si selecciona `free`, el estado cambia a `pending`/`expired` y se limpia la fecha.
*   Si el estado se cambia manualmente a `pending` o `expired`, el tier se degrada automáticamente a `free` y la fecha de expiración se borra.
*   **Reglas de Validación y Fidelización en Backend (`adminService.js`)**: El backend actúa como una red de seguridad atómica para garantizar que no existan combinaciones inconsistentes en base de datos. Cuando se activa el estado a `'active'` de manera manual en el panel, el backend automáticamente:
    *   Fuerza los tiers y estados a ser consistentes (no permite planes premium en estado `pending`).
    *   Autocalcula la expiración del plan si no fue provista (+2 meses para basic, +4 meses para advanced).
    *   Resetea todos los contadores de consumo diario y mensual a cero (`usageCount = 0`, `dailyAiUsage = 0`, etc.) simulando exactamente el webhook de Mercado Pago para inicializar el pool limpio.

### Fase 2.4: Retorno al Cliente y Sincronización
*   El usuario es redirigido de regreso a la aplicación a la URL `/?payment=success`.
*   El frontend intercepta este parámetro, refresca el token JWT del usuario (`sessionManager.refreshUser()`) y dispara una confirmación visual (SweetAlert) actualizando los límites de inmediato sin requerir re-autenticación.

### Fase 2.5: Control de Expiración
*   Si la fecha actual supera el valor de `subscription_expires_at`, el middleware reduce de inmediato el nivel a `subscription_tier: 'free'` y actualiza el status a `'expired'`.
*   Como beneficio por haber sido cliente, se le otorgan **10 nuevas vidas** de prueba y se resetea la fecha de renovación gratuita.

---

## 🛠️ 3. Módulos y APIs del Backend

### 3.1 Módulo: El Simulador (Training Service)
*   **Usuarios Premium:** Las cuotas diarias de exámenes se descuentan únicamente al **culminar y enviar** el examen (`submitScore`).
*   **Usuarios Free:** Consumen vidas de prueba al **iniciar** la Ronda 1.
*   **Reposición por IA ("Banco Infinito")**: Si el stock local del banco es menor a 5 preguntas, se activa la generación de emergencia balanceada por áreas para completar el lote sin interrumpir el flujo.

### 3.2 Módulo: Tutor IA (Quiz Tutor & Repaso Tutor)
*   **Control Unificado de Consumos (`checkLimitsMiddleware`)**:
    *   **Usuarios Basic Activos**: Tienen asignado un límite de **50 mensajes/día** (`daily_ai_usage`). No utilizan RAG (`useRag = false`) en ninguna circunstancia.
    *   **Usuarios Advanced Activos**: Tienen asignado un límite de **100 mensajes/día** (`daily_ai_usage`) con **hasta 25 consultas RAG/día** (`daily_rag_usage`). Si agotan las 25 consultas RAG, el sistema realiza automáticamente un fallback a IA Estándar (generativo experto sin RAG) consumiendo de la cuota diaria estándar hasta los 100 mensajes.
    *   **Usuarios Free / Pending**: Consumen **1 vida de prueba** (`usage_count`) por cada consulta enviada al Quiz Tutor o Repaso Tutor, hasta agotar su pool de 10 vidas (`max_free_limit`). NUNCA utilizan RAG (`useRag = false`).
    *   **Asistente Guía (Chat General)**: Es 100% estático y efímero para todos los usuarios. Latencia de 0ms, 0 consumo de vidas o cuotas diarias.

### 3.3 Módulo: Diagnóstico Clínico (Analytics)
*   Permite a los usuarios Advanced realizar una correlación estadística de sus fallas mediante `POST /api/analytics/diagnostic`. Consume de la cuota diaria del chat.

### 3.4 Módulo: Tarjetas de Repaso y Flashcards (deckController.js / deckService.js)
*   **Creación Manual y Longitudes de Texto**:
    *   **Texto Puro (Basic y Advanced)**: Permite hasta **1,000 caracteres** por cara (frente y dorso), ofreciendo amplitud para fórmulas, listas y explicaciones doctrinales.
    *   **Audio TTS Activado (Advanced únicamente)**: Aplica un tope condicional de **500 caracteres** por cara para preservar el presupuesto de síntesis de Google Cloud Text-to-Speech.
*   **Políticas Multimedia (TTS e Imágenes)**:
    *   **Audio TTS y Carga de Imágenes (`/api/cards/upload-image`)**: Exclusivos de planes `advanced`, `elite` y `admin`. Usuarios `free` o `basic` que intenten activar estas opciones reciben respuesta `403 Forbidden` (`paywall: true`) e intercepción visual inmediata con la modal Paywall.
*   **Carga Masiva vía Excel (`batch_import`)**:
    *   **Free**: 0 archivos/día (bloqueado para mitigar abusos de bots/scripts).
    *   **Basic**: Hasta 3 archivos Excel por día (hasta 100 tarjetas por archivo, texto puro de hasta 1,000 caracteres por cara).
    *   **Advanced**: Hasta 10 archivos Excel por día (hasta 100 tarjetas por archivo con soporte opcional de síntesis de voz TTS en lote).
*   **Generación de Flashcards con IA (`monthly_flashcards_usage`)**:
    *   Exclusivo del Plan Avanzado con cuota de **30 solicitudes mensuales** (hasta 20 tarjetas generadas por solicitud mediante Gemini).
*   **Clonación y Mazos de Comunidad**:
    *   Todos los tiers (Free, Basic, Advanced) pueden clonar y estudiar mazos públicos con audios e imágenes existentes sin generar costos extra en GCS/TTS (reutilización atómica de URLs).
    *   Protección anti-duplicados y rate limiting de máximo 30 clonaciones por día para prevenir flooding.

---

## 🗄️ 4. Estructura de Base de Datos y Metadata

| Campo DB (`users`) | Tipo de Datos | Propósito Técnico |
| :--- | :--- | :--- |
| `subscription_tier` | `VARCHAR` | Nivel de plan activo (`'free'`, `'basic'`, `'advanced'`, `'elite'`). |
| `subscription_status` | `VARCHAR` | Estado de la suscripción (`'pending'`, `'active'`, `'expired'`). |
| `subscription_expires_at`| `TIMESTAMP` | Fecha de expiración en tiempo UTC. |
| `daily_ai_usage` | `INTEGER` | Mensajes diarios estándar sin RAG (normal, flashcard_tutor). |
| `daily_rag_usage` | `INTEGER` | Consultas RAG especializadas (salud, educación, quiz_tutor). Límite de 25/día para Advanced, fallback a daily_ai_usage si se agota. |
| `daily_simulator_usage` | `INTEGER` | Simulacros finalizados en el día actual. |
| `monthly_flashcards_usage`| `INTEGER` | Intentos mensuales de generación de flashcards. |
| `last_usage_reset` | `TIMESTAMP` | Última fecha en que se reiniciaron los contadores diarios. |

---

## 🏗️ 5. Unificación Arquitectónica de Límites (limits.js)

Para evitar duplicar constantes en el frontend y backend:
1.  **limits.js (Fuente Única de Verdad):** Centraliza las cuotas en [limits.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/infrastructure/config/limits.js).
2.  **Inyección en Perfil (`getMe`):** El endpoint `/api/auth/me` inyecta dinámicamente la configuración `limits` del plan.
3.  **Cliente Sync:** El validador en el cliente `validateFreemiumAction()` de [uiManager.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/presentation/public/js/ui/uiManager.js) resuelve el límite dinámicamente, garantizando un mantenimiento centralizado.

### 5.1 Renovación Semanal de Vidas Free (Fuente Única de Verdad)
La lógica de renovación de vidas para usuarios Free/Pending está centralizada en un único método:
*   **`UsageService.renewWeeklyLivesIfNeeded(userId)`** en [usageService.js](file:///c:/Users/ricar/Downloads/PROYECTOS/hubacademia/src/domain/services/usageService.js) (Capa de Dominio).
*   Este método delega el acceso SQL a `UserRepository.renewWeeklyLivesIfNeeded()`, que ejecuta un `UPDATE` atómico en PostgreSQL: resetea `usage_count = 0`, estandariza `max_free_limit = 10` y actualiza `last_free_renewal = CURRENT_TIMESTAMP` si han pasado 7+ días calendario en zona horaria `America/Lima`.
*   Es invocado por:
    *   `authService.getUserWithStatus()` — cuando el frontend solicita datos del usuario vía `GET /api/auth/me`.
    *   `checkLimitsMiddleware.js` — cuando el usuario accede a cualquier endpoint protegido de IA.
*   Elimina la duplicación previa de código SQL entre `authService.js` y `checkLimitsMiddleware.js`.

---

## 🖥️ 6. UI/UX del Sistema de Suscripciones y Precios (Web y Móvil)

### 6.1 Página y Pantalla de Perfil (`profile.html` / `profile.tsx`)
*   **Badge Dinámico**: Muestra el nivel oficial del usuario (*Plan Gratuito*, *Plan Basic*, *Plan Advanced* o *Administrador Global*).
*   **Gestión de Usuario y Edición de Nombre**: Modal interactivo para actualizar el nombre de perfil con validación de longitud mínima (vía `PUT /api/auth/profile`).
*   **Cuadrícula de Consumos y Cuotas**: Dibuja barras de progreso del consumo diario/mensual real frente al límite inyectado por el backend (`daily_simulator_usage`, `daily_ai_usage`, `daily_rag_usage` y `lives_remaining`).
*   **Flujo de Eliminación de Cuenta ("Account Deletion")**: Requisito obligatorio de Google Play Store implementado tanto en la web como en las aplicaciones móviles (`DELETE /api/auth/account`), con confirmación textual estricta ("ELIMINAR") y purga en cascada en base de datos.

### 6.2 Pantalla de Pricing e Upgrades (`pricing.html` / `pricing.tsx`)
*   **Diseño Glassmorphic Cyber-Minimalist**: Tarjetas translúcidas oscuras con desenfoque de fondo, degradados dorados/esmeralda y tipografía de alto contraste.
*   **Selector de Planes**:
    *   **Plan Básico (S/ 9.90 por 2 Meses)**: 15 simulacros diarios, 50 consultas diarias de IA estándar, flashcards manuales ilimitadas.
    *   **Plan Avanzado (S/ 24.90 por 4 Meses)**: 50 simulacros diarios, 100 consultas diarias de IA con 25 RAG semánticos, 30 pedidos mensuales de flashcards con IA + Audio TTS.
*   **Pasarelas de Pago Multi-Método**:
    *   **Yape / Plin QR**: Datos oficiales de cuenta (Ricardo M. / +51 980844817) y botón con mensaje pre-llenado para WhatsApp con correo registrado.
    *   **Mercado Pago (Tarjeta de Crédito / Débito)**: Integración segura mediante `paymentService.createOrder()` y navegación web in-app (`WebBrowser.openBrowserAsync`).
*   **Flujo de Upgrades Activos**: Resalta el plan actual, desactiva planes inferiores y permite mejoras inmediatas a tiers superiores.

---

## 📱 7. Requisitos de Cumplimiento para Google Play Store y App Store

Las aplicaciones móviles (`HubDocenteApp` y `HubSaludApp`) integran todas las directivas de seguridad y privacidad exigidas para despliegue en tiendas oficiales:
1.  **Políticas de Privacidad (`/privacy-policy`)**: Detalla el tratamiento de datos mediante Google OAuth SSO, almacenamiento de tokens JWT, cifrado TLS 1.3, RLS en PostgreSQL, no comercialización de información personal y uso confidencial de Vertex AI sin re-entrenamiento público.
2.  **Términos y Condiciones (`/terms-and-conditions`)**: Define claramente el alcance pedagógico y clínico de los simuladores, las duraciones de los planes a plazo fijo (sin renovaciones sorpresa automáticas) y los canales de soporte autorizados.
3.  **Mecanismo de Eliminación de Cuenta en la App**: Accesible directamente desde `profile.tsx` para permitir que cualquier usuario ejerza su derecho de supresión de datos en cualquier momento.

---

## 🛡️ 8. Arquitectura Unificada de Paywall y Control por Tier (`uiManager.js`)

Se ha consolidado el control de accesos y modales Paywall mediante `uiManager.js` para evitar duplicación de código y garantizar mensajes dinámicos acordes al plan activo del usuario:

* **Usuarios con Plan Básico (`subscription_tier === 'basic'`)**:
  * **Tutor IA (Chat)**: No utilizan el sistema de vidas. Disponen de **50 mensajes/día** (`daily_ai_usage`).
  * **Al Alcanzar Límite**: `uiManager.showPaywallModal(null, 'chat_standard')` despliega el modal interactivo proponiendo la mejora al **Plan Avanzado** (*"Mejorar a Avanzado"*), destacando el acceso a 100 mensajes diarios y RAG semántico.
  * **Flashcards Multimedia**: Intentos de usar síntesis de voz TTS o subida de imágenes despliegan el Paywall proponiendo upgrade a Avanzado sin interrumpir la sesión activa.

* **Usuarios con Plan Avanzado (`subscription_tier === 'advanced'`)**:
  * **Tutor IA (Chat)**: Disponen de **100 mensajes/día** con hasta **25 consultas RAG/día** (con fallback generativo experto automático tras 25 RAGs).
  * **Al Alcanzar Límite (100/100)**: Se muestra el modal de reconocimiento (*"¡Meta Diaria Alcanzada! 🏆"*), invitando a continuar al día siguiente sin mensajes confusos de renovar suscripción.
  * **Flashcards IA (30/mes)**: Al agotar la cuota mensual de 30 pedidos con Gemini, se informa amigablemente el reinicio de la cuota para el próximo mes.

* **Usuarios Plan Gratuito / Pending (`subscription_tier === 'free'` o estado `pending` / `expired`)**:
  * **Pool de Vidas**: Operan con **10 vidas de prueba** (`usage_count`) que se descuentan al iniciar repasos, simulacros o enviar mensajes al Tutor IA.
  * **Regla de la Última Vida (Vida 10 de 10)**:
    * **Uso Ininterrumpido**: Cuando el usuario tiene 1 vida restante (`usageCount === 9`, `maxFreeLimit === 10`), el sistema le permite iniciar su sesión de estudio de flashcards o consultar al Tutor IA sin ninguna interrupción.
    * **Prevención de Popups Prematuros en Toast**: `showLifeDecrementToast` emite una notificación de advertencia informativa (*"Has consumido tu última vida de prueba semanal. Te quedan 0 vidas."*) y **nunca** programa `showPaywallModal()` en temporizadores asíncronos (`setTimeout`).
    * **Experiencia en Tutores IA (Quiz Tutor y Repaso Flashcard Tutor)**: Al recibir la respuesta del modelo de la última vida, el mensaje se añade al chat y el usuario puede leerlo con total tranquilidad. El modal Paywall **no** cubre la pantalla tras responder.
    * **Bloqueo Proactivo y Justo**: El modal Paywall solo se dispara cuando el usuario se encuentra **realmente en 0 vidas** e intenta iniciar una **nueva** acción que requiera vidas (abrir un nuevo mazo de repaso, iniciar otro simulacro o enviar un nuevo mensaje en el chat del tutor).
    * **Coerción Numérica Estricta**: Todas las comparaciones (`usage >= limit`) se ejecutan obligatoriamente mediante `Number()`, evitando trampas de coerción en JavaScript (donde el string `'9' >= '10'` evalúa a `true`).

---
*Última actualización de la documentación consolidada: 5 de Septiembre de 2026 (Corrección de la Última Vida de Prueba, Prevención de Paywall Prematuro y Blindaje de Tutores IA)*
