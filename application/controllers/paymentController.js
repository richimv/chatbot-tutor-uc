// infrastructure/controllers/paymentController.js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('../../infrastructure/database/db');

// Configuración del cliente
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

exports.createOrder = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ VALIDACIÓN CRÍTICA: Asegurar que el usuario tenga email.
        if (!req.user || !req.user.email) {
            console.error('❌ Error: Usuario sin email intentando pagar.');
            return res.status(400).json({ error: 'Usuario no válido. Se requiere email para el recibo.' });
        }

        // 1. Configuración dinámica de URLs (Frontend vs Backend)
        // APP_URL: URL del Frontend (Vercel) para redirecciones del usuario.
        let baseUrl = process.env.APP_URL || 'http://localhost:3000';

        // BACKEND_URL: URL del Backend (Render) para notificaciones (Webhooks).
        let backendUrl = process.env.BACKEND_URL || 'https://tutor-ia-backend.onrender.com';

        // En desarrollo local, ambas son localhost:3000
        if (baseUrl.includes('localhost')) {
            backendUrl = 'http://localhost:3000';
        }

        // Asegurar que no haya slash final
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);

        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: 'suscripcion-vitalicia',
                        title: 'Suscripción Biblioteca Académica',
                        unit_price: 9.90,
                        currency_id: 'PEN',
                        quantity: 1,
                    }
                ],
                payer: {
                    email: req.user.email // ✅ USO REAL: Email del usuario logueado para recibir el comprobante.
                },
                binary_mode: true, // Aprobación inmediata
                external_reference: userId.toString(), // Vincula el pago a tu usuario

                // Rutas de redirección a TU aplicación
                back_urls: {
                    success: `${baseUrl}/dashboard.html`,
                    failure: `${baseUrl}/pricing.html?status=failure`,
                    pending: `${baseUrl}/pricing.html?status=pending`
                },
                auto_return: 'approved',

                payment_methods: {
                    excluded_payment_types: [
                        { id: "ticket" }, // Excluir PagoEfectivo (tarda mucho)
                        { id: "atm" }
                    ],
                    installments: 1
                },

                // Webhook para confirmar el pago en segundo plano (Al Backend)
                notification_url: `${backendUrl}/api/payment/webhook`
            }
        });

        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error('❌ Error creando preferencia:', error);
        res.status(500).json({ error: 'Error al iniciar el pago' });
    }
};

exports.handleWebhook = async (req, res) => {
    const paymentId = req.query.id || req.query['data.id'];
    const type = req.query.type;

    try {
        if (type === 'payment' || req.query.topic === 'payment') {
            const payment = new Payment(client);
            const data = await payment.get({ id: paymentId });

            if (data.status === 'approved') {
                const userId = data.external_reference;

                // Actualizar estado del usuario en la BD
                await pool.query(
                    `UPDATE users SET subscription_status = 'active', payment_id = $1 WHERE id = $2`,
                    [paymentId, userId]
                );
                console.log(`✅ Pago aprobado. Usuario ${userId} ahora es Premium.`);
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('⚠️ Error en Webhook:', error);
        res.sendStatus(500);
    }
};