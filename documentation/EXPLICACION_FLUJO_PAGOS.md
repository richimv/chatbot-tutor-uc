# Flujo de Transición y Arquitectura Segura de Pagos: De "Visitante" a "Advanced"

Para entender cómo funciona el pulmón económico de Hub Academia, debemos mapear 5 momentos cruciales en el viaje del estudiante, la base de datos distribuida y el Servidor (API en Node.js + Mercado Pago).

---

## FASE 1: El Visitante y el Registro Inicial
Cuando un médico entra al portal y presiona **Registrarse**, es llevado al `authController.js`.
- Al insertar su cuenta a la base de datos `users`, el sistema de postgresql lo inyecta **por defecto** con los siguientes parámetros fundacionales:
  - `role`: `'student'`
  - `subscription_tier`: `'free'`
  - `subscription_status`: `'pending'` (Significa que la cuenta está creada pero aún no ha realizado su primer pago para activar el dashboard premium o validar su acceso).
  - `subscription_expires_at`: `NULL` (Los usuarios *Free* no tienen fecha límite, siempre vivirán en la capa base y el middleware jamás intentará rebajarlos a nada inferior).

## FASE 2: El Modelo de Vidas (Freemium de Entrada)
El usuario recién horneado entra al **Simulador Médico**. Este módulo no tiene barreras directas sobre cuántos clics da, sino sobre **Acciones Core** de generación y calificación.
- El Archivo Involucrado es: `TrainingService.js` (Backend) conectado a un sistema llamado **UsageService** (Vidas).
- Los estudiantes cuyo tier es `'free'` al querer darle "Empezar Examen", disparan en BD la tabla `usage_logs`. 
- Si no tiene más de 3 registros consumidos globales en toda su historia, se le concede generar un Examen Básico. 
- Al consumirse la de la *Vidas*, la UI arroja el **Modal Paywall: "Alcanzaste tu límite de simulaciones gratuitas"** para convertirlos a pago.

## FASE 3: Transacción o Conversión a Usuario Pro
El usuario clickea comprar un paquete "Advanced" (Tutor IA - 6 Meses).
- Entra el archivo: `paymentController.js` (Método `createOrder`).
- Le preparamos a Mercado Pago un JSON transaccional donde le decimos: 
    - `user.email`
    - Qué nos está comprando
    - Pero lo fundamental es la varibale OCULTA a los ojos del Front: `external_reference: "USER_ID_UUID|advanced"`. Esta pieza guarda "quien" y "qué" pagó para que cuando MercadoPago responda sepamos la ruta a seguir.
- El usuario llena su número de tarjeta y clickea "Pagar".

## FASE 4: Confirmación Asíncrona Webhook (Notificación Back-to-Back)
El navegador del usuario no aprueba la transacción jamás. Es **Mercado Pago quien le habla a nuestro servidor por detrás** usando una URL encriptada.
- Archivo: `paymentController.js` (Método `handleWebhook`).
- Cuando Mercado Pago reporta `status: 'approved'`, entra a un bloque If.
- **¿Cómo discierne el sistema entre Basic o Advanced?** El servidor separa la variable secreta (`external_reference`) por esa pleca vertical de texto (`|`). Obteniendo que UUID `A123` nos pagó legalmente el código en constante de sistema, es decir `advanced` o `basic`.
- El Servidor compara si el Monto reportado por MP es casi idéntico o mayor al de nuestro servidor (ej: 24.9), protegiéndonos de cobros alterados a S/ 0.10 céntimos.

### 💰 La Cirugía a Nivel de Base De Datos (Activación de Tier)
En ese mismo milisegundo de aprobación, se dispara un `UPDATE users` titánico en PostgreSQL que:
1. Pone `subscription_tier`: `'advanced'` o `'basic'` dependiendo del ID de Mercado Pago.
2. Pone `subscription_status`: `'active'`.
3. Pone todas las cuotas a cero `daily_ai_usage = 0`, `monthly_flashcards_usage = 0` (Le resetea los consumos diarios/mensuales que tuvo gratis en el pasado si los tuvo erróneamente para reiniciar en limpio).
4. Cómputo Automático de Caducidad usando un reloj Universal (UTC): Inyecta a la Columna de Expiración el comando nativo `NOW() + INTERVAL '6 months'` (Advanced) o `INTERVAL '2 months'` (Basic). Así el servidor Base de Datos calcula hasta el segundo y día exacto su vencimiento a futuro, descartando fallos por años bisiestos.

## FASE 4.5: El Retorno Triunfal a la Aplicación (Frontend Callback)
Una vez pagado el plan en la pasarela, Mercado Pago redirige automáticamente al usuario a nuestra web a través de la URL de éxito parametrizada `/?payment=success` (configurada en `paymentController.js`).
- El archivo `app.js` posee un interceptor silencioso global en el `DOMContentLoaded` que captura esta bandera.
- Al detectarla: 
  1. Limpia higiénicamente la URL del usuario eliminando el query param.
  2. Dispara el reinicio del JWT de la máquina local (`sessionManager.validateSession()`) forzando al navegador a darse cuenta inmediatamente que ya no es un Trial, sino un VIP.
  3. Ejecuta una alerta mágica de Gratitud (SweetAlert) confirmándole al alumno que sus límites han sido destrabados con éxito, entregándole control absoluto al instante sin tener que volver a Iniciar Sesión.

## FASE 5: Vida Diaria del 'Advanced' (El Middleware Cerbero)
A partir de este momento, todos y cada uno de los clics que el alumno haga por la web al chat y otros servicios son auditados por el guardián `checkLimitsMiddleware.js`.
- El middleware antes de darle acceso al Chat/Simulator hace 3 preguntas relámpago a la BD:
  1. **"¿Este loco ya venció?"**: Extrae su fecha de vencimiento. Si `Date.now() > FechaEnBD` en tiempo real... rebaja su fila en Base de Datos de vuelta a Tier: `'free'`. Y lo expulsa.
  2. **"¿Cambió el Sol de día?"**: Compara la columna silenciosa `last_usage_reset` con hoy. Si no son iguales, le resetea los disparos de Chat y Arena a Cero `0`.
  3. **"¿Qué funciones especiales le corresponden por plan?"**: Al intentar usar en el Simulador el boton de "Diagnóstico Clínico AI", la ruta pasa la validación de suscripción limitando su acceso a 'Advanced' o 'Elite'. Si califica, consume un token de su masivo total `chat_standard` (Ej. 50/día).
     - **El Fallback Elegante:** Siendo un plan menor (Basic o Free), el backend bloquea la petición a IA arrojando 403. El Frontend JavaScript cacha el 403, oculta la alerta de Paywall, dibuja velozmente un mensaje puramente estadístico pre-cocinado del Banco Local usando JavaScript, sin gastar nada y entregando un servicio degradado pero funcional como un campeón.

---
