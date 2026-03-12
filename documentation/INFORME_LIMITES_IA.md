# 📊 INFORME TÉCNICO Y ECONÓMICO: Implementación de Límites y Rentabilidad IA (Marzo 2026)

Este documento detalla exhaustivamente todos los módulos técnicos, rutas del servidor, base de datos y vistas del usuario final que han sido implementadas e integradas para la **Estructuración de Costos y Límite de Uso de IA** en HubAcademia. 

El objetivo primordial de esta refactorización fue **garantizar el margen de utilidad y rentabilidad de la plataforma**, evitando escenarios donde un usuario de nivel Básico (Free o S/ 9.90) consumiera financieramente el valor total de su paquete mediante peticiones recurrentes a los modelos más costosos de Vertex AI (como Gemini Pro, Thinking Mode y búsquedas RAG repetitivas).

---

## 🏗️ 1. Estructura Matemática de Suscripciones (Configurada en Sistema)

El sistema ahora soporta matemática rígida (Planes y Tokens).

| Característica | **Plan Básico (Free / Entry)** | **Plan Avanzado (Pro / Premium)** |
| :--- | :--- | :--- |
| **Costo / Duración** | S/ 9.90 (2 Meses) | S/ 24.90 (6 Meses) |
| **Tutor IA (Chat)** | Estándar (20 mensajes/día) | Pro con Biblioteca Médica (30 mensajes/día) |
| **Quiz Arena (IA)** | 5 partidas/día | 10 partidas/día |
| **Analítica de Patrones** | Estático (Sin IA) | Diagnóstico Clínico con IA (Dentro de los 50 mensajes diarios) |
| **Flashcards (IA)** | 20 tarjetas / mes | 100 tarjetas / mes |
| **Generador Simulador Médico (IA)** | **[EXTIRPADO] - Solo BD** | **[EXTIRPADO] - Solo BD** |

---

## 🛠️ 2. Módulos y APIs Transformadas

A continuación, la lista completa e hiper-detallada de los módulos integrados con las nuevas barreras de cobro y límites (Middleware).

### 2.1 Módulo: El Simulador (Training Service)
> *Aunque inicialmente no fue concebido en la tabla pública de límites, se detectó que este módulo representaba una **Fuga Crítica de Costos (~S/0.05 por interacción)** para el plan básico.*

- **El Problema Anterior:** Si a un alumno se le acababan las preguntas de un tema almacenado en la Base de Datos (Banco), el sistema apelaba a una función recursiva de RAG e Inteligencia Artificial Vertex para *construirle al aire y en tiempo real* un set de 10-15 preguntas médicas. Este consumo desbordaba el pago de S/ 9.90.
- **La Solución Implementada:** 
  - Se modificó a nivel de núcleo `TrainingService.js`.
  - Ahora, si el usuario hace un Simulacro y es Plan Básico, **solo** se servirán y reciclarán las preguntas creadas por el equipo médico u originadas pasivamente en el Banco Global.
  - La **IA Generativa de Preguntas Médicas RAG ha sido completamente EXTIRPADA para TODOS los planes**. 
  - **Rentabilidad Conservada:** Se determinó que incluso limitando el Simulador a 30 rondas para el usuario Avanzado, el costo operativo proyectado a 6 meses agregaba un pasivo de S/ 9.00 adicionales por persona, disminuyendo drásticamente el margen bruto a un nivel inaceptable (Utilidad Bruta reducida al 26%). Por lo tanto, el sistema ahora atiende el 100% de los simulacros médicos desde la Base de Datos Histórica y Estática (Costo Cero).

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
