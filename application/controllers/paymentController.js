// infrastructure/controllers/paymentController.js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('../../infrastructure/database/db');

// Configuración del cliente
// IMPORTANTE: Asegúrate de que MP_ACCESS_TOKEN en Render sea el de PRODUCCIÓN (empieza con APP_USR-...)
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

exports.createOrder = async (req, res) => {
    try {
        // Validar usuario
        if (!req.user || !req.user.email) {
            console.error('❌ Error: Usuario sin email intentando pagar.');
            return res.status(400).json({ error: 'Usuario no válido. Se requiere email.' });
        }

        const userId = req.user.id;

        // 1. Configuración de URLs (Simplificada y Robusta)
        // En Render, process.env.RENDER_EXTERNAL_URL suele dar la URL pública HTTPS automáticamente.
        // Si no, usamos la variable manual BACKEND_URL.
        const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'https://tutor-ia-backend.onrender.com';

        // Frontend URL (Debe venir de variables de entorno o hardcoded si es fija)
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.hubacademia.com';

        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: 'suscripcion-vitalicia',
                        title: 'Suscripción Biblioteca Académica - Premium',
                        description: 'Acceso ilimitado a libros y tutoría IA',
                        picture_url: 'https://www.hubacademia.com/assets/logo.png', // Opcional: Logo de tu marca
                        unit_price: 5.00,
                        currency_id: 'PEN',
                        quantity: 1,
                    }
                ],
                payer: {
                    email: req.user.email,
                    name: req.user.name || 'Estudiante',
                },
                //binary_mode: true, // Aprobación inmediata (Rechaza pagos pendientes como PagoEfectivo si quieres velocidad)
                external_reference: userId.toString(), // CLAVE: Aquí viaja el ID del usuario

                // Rutas de retorno al Frontend
                back_urls: {
                    success: `${frontendUrl}/dashboard.html?payment=success`,
                    failure: `${frontendUrl}/pricing.html?payment=failure`,
                    pending: `${frontendUrl}/pricing.html?payment=pending`
                },
                auto_return: 'approved',

                // Métodos de pago
                payment_methods: {
                    excluded_payment_types: [
                        { id: "ticket" } // Excluye PagoEfectivo si quieres acceso inmediato
                    ],
                    installments: 1 // Solo 1 cuota (opcional)
                },

                // Webhook: A dónde avisar (Debe ser HTTPS y Público)
                notification_url: `${backendUrl}/api/payment/webhook`
            }
        });

        console.log(`✅ Preferencia creada para ${req.user.email}. Webhook: ${backendUrl}/api/payment/webhook`);
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error('❌ Error creando preferencia MP:', error);
        res.status(500).json({ error: 'Error al iniciar el pago' });
    }
};

exports.handleWebhook = async (req, res) => {
    // Mercado Pago envía los datos en query string o body dependiendo de la versión
    const paymentId = req.query.id || req.query['data.id'];
    const type = req.query.type || req.query.topic;

    // Responder rápido a MP para que deje de enviar la notificación
    // (Importante: MP espera un 200 OK en menos de 3 seg)
    res.sendStatus(200);

    try {
        if (type === 'payment' && paymentId) {
            console.log(`🔔 Webhook recibido: Pago ID ${paymentId}`);

            const payment = new Payment(client);
            const data = await payment.get({ id: paymentId });

            if (data.status === 'approved') {
                const userId = data.external_reference;
                const paidAmount = data.transaction_amount;

                // Verificación de seguridad extra: ¿Pagó lo correcto?
                if (paidAmount >= 9.00) { // Tolerancia por si hay decimales raros
                    await pool.query(
                        `UPDATE users SET 
                            subscription_status = 'active', 
                            payment_id = $1,
                            updated_at = NOW() 
                         WHERE id = $2`,
                        [paymentId, userId]
                    );
                    console.log(`🎉 PAGO EXITOSO: Usuario ${userId} activado.`);
                } else {
                    console.warn(`⚠️ Alerta: Pago aprobado pero monto sospechoso (${paidAmount}) para usuario ${userId}`);
                }
            }
        }
    } catch (error) {
        console.error('⚠️ Error procesando Webhook en segundo plano:', error.message);
        // No enviamos error 500 porque ya respondimos 200 al inicio
    }
};