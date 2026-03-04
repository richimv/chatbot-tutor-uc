// infrastructure/controllers/paymentController.js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('../../infrastructure/database/db');

// Configuración del cliente
// IMPORTANTE: Asegúrate de que MP_ACCESS_TOKEN en Render sea el de PRODUCCIÓN (empieza con APP_USR-...)
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const PLANS = {
    basic: { price: 9.90, months: 2, title: 'Plan Básico - Entrenamiento Médico' },
    advanced: { price: 24.90, months: 6, title: 'Plan Avanzado - Tutor IA Médica' }
};

exports.createOrder = async (req, res) => {
    try {
        if (!req.user || !req.user.email) {
            console.error('❌ Error: Usuario sin email intentando pagar.');
            return res.status(400).json({ error: 'Usuario no válido. Se requiere email.' });
        }

        const userId = req.user.id;
        const planId = req.body.planId;

        if (!planId || !PLANS[planId]) {
            return res.status(400).json({ error: 'Plan seleccionado inválido.' });
        }

        const plan = PLANS[planId];
        const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'https://tutor-ia-backend.onrender.com';
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.hubacademia.com';

        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: `suscripcion-${planId}`,
                        title: plan.title,
                        description: `Acceso por ${plan.months} meses`,
                        picture_url: 'https://www.hubacademia.com/assets/logo.png',
                        unit_price: plan.price,
                        currency_id: 'PEN',
                        quantity: 1,
                    }
                ],
                payer: {
                    email: req.user.email,
                    name: req.user.name || 'Estudiante',
                },
                external_reference: `${userId}|${planId}`, // Pasamos ID y el Plan elegido
                back_urls: {
                    success: `${frontendUrl}/?payment=success`,
                    failure: `${frontendUrl}/pricing?payment=failure`,
                    pending: `${frontendUrl}/pricing?payment=pending`
                },
                auto_return: 'approved',
                payment_methods: {
                    excluded_payment_types: [{ id: "ticket" }],
                    installments: 1
                },
                notification_url: `${backendUrl}/api/payment/webhook`
            }
        });

        console.log(`✅ Preferencia creada para ${req.user.email} (Plan: ${planId})`);
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error('❌ Error creando preferencia MP:', error);
        res.status(500).json({ error: 'Error al iniciar el pago' });
    }
};

exports.handleWebhook = async (req, res) => {
    const paymentId = req.query.id || req.query['data.id'];
    const type = req.query.type || req.query.topic;

    res.sendStatus(200);

    try {
        if (type === 'payment' && paymentId) {
            const payment = new Payment(client);
            const data = await payment.get({ id: paymentId });

            if (data.status === 'approved') {
                const parts = data.external_reference.split('|');
                const userId = parts[0];
                const planId = parts[1] || 'basic'; // Fallback a basic si falta
                const paidAmount = data.transaction_amount;

                const plan = PLANS[planId] || PLANS.basic;

                if (paidAmount >= plan.price - 0.1) { // Tolerancia decimal
                    await pool.query(
                        `UPDATE users SET 
                            subscription_status = 'active',
                            subscription_tier = $1,
                            subscription_expires_at = NOW() + INTERVAL '${plan.months} months',
                            daily_ai_usage = 0,
                            monthly_thinking_usage = 0,
                            monthly_flashcards_usage = 0,
                            daily_arena_usage = 0,
                            payment_id = $2
                         WHERE id = $3`,
                        [planId, paymentId, userId]
                    );
                    console.log(`🎉 PAGO EXITOSO: Usuario ${userId} activado en Plan ${planId.toUpperCase()}`);
                } else {
                    console.warn(`⚠️ Alerta: Pago aprobado pero monto sospechoso (${paidAmount}) para usuario ${userId}, Plan esperado: ${plan.price}`);
                }
            }
        }
    } catch (error) {
        console.error('⚠️ Error procesando Webhook:', error.message);
    }
};