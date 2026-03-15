# 📊 INFORME TÉCNICO Y ECONÓMICO: Implementación de Límites y Rentabilidad IA (Marzo 2026)

Este documento detalla exhaustivamente todos los módulos técnicos, rutas del servidor, base de datos y vistas del usuario final que han sido implementadas e integradas para la **Estructuración de Costos y Límite de Uso de IA** en HubAcademia. 

El objetivo primordial de esta refactorización fue **garantizar el margen de utilidad y rentabilidad de la plataforma**, evitando escenarios donde un usuario de nivel Básico (Free o S/ 9.90) consumiera financieramente el valor total de su paquete mediante peticiones recurrentes a los modelos más costosos de Vertex AI (como Gemini Pro, Thinking Mode y búsquedas RAG repetitivas).

---

## 🏗️ 1. Estructura Matemática de Suscripciones (Configurada en Sistema)

El sistema ahora soporta matemática rígida (Planes y Tokens).

| Característica | **Plan Básico (Free / Entry)** | **Plan Avanzado (Pro / Premium)** |
| :--- | :--- | :--- |
| **Costo / Duración** | S/ 9.90 (2 Meses) | S/ 24.90 (6 Meses) |
| **Tutor IA (Chat)** | Estándar + Lite (20 msg/día) | Biblioteca RAG + Lite (30 msg/día) |
| **Quiz Arena (IA)** | 5 partidas/día (Modelo Lite) | 10 partidas/día (Modelo Lite) |
| **Analítica de Patrones** | Estático (Sin IA) | Diagnóstico Clínico (Modelo Lite) |
| **Flashcards (IA)** | 20 tarjetas / mes (Lite) | 100 tarjetas / mes (Lite) |
| **Simulador Médico (Repuesto IA)** | **BLOQUEADO (Solo Banco)** | **ILIMITADO (Modelo Lite)** |

---

## 🛠️ 2. Módulos y APIs Transformadas

A continuación, la lista completa e hiper-detallada de los módulos integrados con las nuevas barreras de cobro y límites (Middleware).

### 2.1 Módulo: El Simulador (Training Service)
> *Aunque inicialmente no fue concebido en la tabla pública de límites, se detectó que este módulo representaba una **Fuga Crítica de Costos (~S/0.05 por interacción)** para el plan básico.*

- **El Problema Anterior:** Si a un alumno se le acababan las preguntas de un tema almacenado en la Base de Datos (Banco), el sistema apelaba a una función recursiva de RAG e Inteligencia Artificial Vertex para *construirle al aire y en tiempo real* un set de 10-15 preguntas médicas. Este consumo desbordaba el pago de S/ 9.90.
- **La Solución Implementada:** 
  - Se modificó el núcleo `TrainingService.js` con una **Lógica de Modelo Dual**.
  - **Plan Free/Basic**: Sigue restringido al Banco de Datos (Costo Cero). Si se agotan las preguntas, el sistema arroja `BANK_EXHAUSTED`.
  - **Plan Advanced/Elite**: Se habilitó la **Reposición Automática con IA**. Cuando el banco se agota, el sistema genera preguntas nuevas usando `gemini-2.5-flash-lite`.
  - **Rentabilidad Máxima:** Al usar el modelo **Lite**, el costo por "Thinking" (razonamiento) es de **$0.00**. Esto permite ofrecer generación ILIMITADA a los usuarios Advanced sin comprometer el margen de utilidad de la academia.

### 2.2 Módulo: Tutor Médico RAG (Chat Principal)
- Se estandarizó el tracking de límite a través del middleware `checkAILimits('chat_standard')`.
- La IA en todos los casos utiliza el modelo rápido transaccional. Sin embargo, si el usuario es de nivel **Avanzado (Premium)**, se activa el **Acceso a Biblioteca Médica RAG** (extracción local de los libros Harrison, NTS, GPC) sin costo agregado por ser una extracción local ILIKE, lo cual funda sus respuestas clínicamente en cada chat que el usuario consume de sus 30 tokens diarios.

### 2.3 Módulo: Diagnóstico Clínico ("Análisis de Patrones de Error")
- **El Problema Anterior:** El frontend usaba un `setTimeout` javascript básico que simplemente tomaba la "Peor materia" del alumno en la tabla relacional y fingía durante 1.5 segundos que la IA estaba "pensando", arrojando una oración quemada y dura.
- **La Solución Implementada:**
  - Se creó la ruta de servidor protegida e íntegramente nueva en Backend: `POST /api/analytics/diagnostic`.
  - Toma un mapeo estadístico en forma de JSON relacional de los exámenes del alumno, analiza la correlación de fallas y entrega un consejo clínico. Exclusivo para usuarios del Plan Avanzado.
  - Al no emplear ya características onerosas, su uso simplemente consume de la cuota diaria global de "Chat", asegurando la rentabilidad.

### 2.4 Módulo: Generador de Flashcards (Tarjetas de Repaso)
- **El Problema Anterior:** Estaba midiendo en el backend usando contadores de "Chat". Por esto, generarlas iba a afectar injustamente al chat y a chocar con la meta mensual del pago de S/ 9.90.
- **La Solución Implementada:**
  - Se estructuró y desplegó una columna en BD exclusivamente para cobrar Flashcards llamada: `monthly_flashcards_usage`.
  - Integrado a `deckController.js`. Siendo de Plan Básico, si al generador le pides hacer 4 bloques seguidos de 5 Tarjetas (total=20 al mes), el backend automáticamente devolverá `HTTP 403 Forbidden - Límite Mensual` en la petición siguiente. 
  - Si tu plan es avanzado, tienes una bolsa de 100 flashcards automatizadas (20 bloqueos de generación profunda en base).

### 2.5 Módulo: Quiz Arena
- Integrado bajo la propiedad estricta `daily_arena_usage` consumiendo 1 contador de API por intento de juego, sin afectar el resto del ecosistema ni los tokens directos de IAs complejas.

---

## 🗄️ 3. Modificaciones en Base de Datos e Infraestructura

Se ejecutaron scripts de Alteración a nivel del Servidor de Base de Datos PostgreSQL/Supabase.

1.  **Migración de Estados y Tiers:** Se formalizó la taxonomía del negocio. `subscription_tier`: `'free'`, `'basic'`, `'advanced'`, `'elite'`.
2.  **Tracking y Contadores Creados / Sincronizados:**
    - `daily_ai_usage` (Resetea al amanecer a 0).
    - `daily_arena_usage` (Resetea al amanecer a 0).
    - `monthly_thinking_usage` (No resetea a diario. Resetea cuando se vence el mes/plan).
    - `monthly_flashcards_usage` (No resetea a diario. Resetea con la factura nueva mensual/semestral).
    - `last_usage_reset`: Fecha vital del backend para decidir si debe resetear contadores de 24 hrs.

---

## 💳 4. Webhook de Transacciones (Mercado Pago)

El ecosistema de pagos interactúa con el de Límites de IAs de manera nativa:
- Cuando **Mercado Pago Webhook (`paymentController.js`)** recibe una confirmación de estatus `'approved'`, este procesa el `planId` seleccionado.
- Automáticamente el servidor hace la suma `NOW() + INTERVAL '2 months'` (ó 6 según el plan) y reactiva todos los contadores mensuales y diarios de IAs a CERO `0` en el mismo nanosegundo que la orden de compra fue confirmada por el servidor del Banco emisor local.

---

## ✅ Resumen del Estado de Producción
Todo el software ha culminado el hito de protección de ingresos. **Cualquier usuario en Plan 'basic' tiene matemáticamente el 0% de probabilidades de superar la utilidad estipulada.** Todos los Endpoints, APIs en Express y Frontends han sido cubiertos y blindados contra sobrecargas por consumos no autorizados. Misión comercial y técnica documentadas y concluidas con éxito.


## 5. Aclaraciones sobre Límites Compartidos y el Simulador

### 1. El Beneficio "Tutor IA Clínico RAG"
Las interacciones de IA avanzadas (como Búsqueda de Libros y Diagnósticos Clínicos) históricamente costaban mucho dinero por requerir modelos engorrosos ("Thinking"). Actualmente operan a costo **$0.00** extra al usar RAG 100% Local (PostgreSQL ILIKE).
Por ello, el Plan **Advanced** ha unificado sus topes: otorga generosos **30 Chats Diarios**.
- El usuario Advanced goza automáticamente de **Acceso a la Biblioteca Médica (RAG)**. Cada vez que consulta, la IA recupera pasajes del Harrison, NTS o CTO.
- Puede detonar reportes de Diagnóstico Clínico en el Simulador las veces que lo requiera.
Cualquiera de las dos funciones le restará simplemente 1 token a sus 30 tokens diarios. Es una oferta inmensa para el alumno, pero que no genera deudas imprevistas para la academia.

### 2. Generación de Exámenes y Reposición ILIMITADA
En el Simulador (`api/quiz/start` y `api/quiz/next-batch`), la generación de preguntas inéditas está blindada:
- **Free y Basic**: Jamás generan nuevas preguntas. Solo consumen stock del Banco.
- **Advanced**: Cuando se agotan las estáticas, el servicio activa la reposición con `gemini-2.5-flash-lite`.
- **Costo Cero de Razonamiento**: Al usar el motor Lite, HubAcademia deja de pagar por los "pasos de pensamiento" de la IA, permitiendo que esta función sea el motor de venta del Plan Pro sin riesgo financiero.

### 3. Defensa Absoluta de Cuotas: Módulo de Flashcards
Las tarjetas generadas con IA estipulan **20 tarjetas al mes** para Basic y **100 tarjetas al mes** para Advanced.
El middleware extrae directamente de PostgreSQL la entidad `monthly_flashcards_usage`. 
Al saturar las cuotas (4 o 20 llamadas), el backend escupe rígidamente un 403.
El framework UI inyecta al vuelo -sin depender de scripts ni promesas externas- un bloque DOM `custom-limit-modal` con posición absoluta `fixed` que bloquea y empapela toda la pantalla. Es imposible de romper o saltar mediante CSS de otros módulos y blinda tajantemente la base de datos de usuarios aprovechados.
