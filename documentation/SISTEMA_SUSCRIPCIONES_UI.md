# Sistema de Suscripciones y Límites de Usuario (UI/UX)

Este documento detalla las mejoras implementadas para profesionalizar la comunicación de planes, límites y suscripciones dentro del ecosistema del Chatbot Tutor.

## 1. Modelo de Datos y Backend
Se han realizado actualizaciones en la capa de datos para soportar una visualización precisa en el frontend:
- **Modelo User**: Adición del campo `subscriptionExpiresAt` para rastrear la validez temporal del plan.
- **UserRepository**: Mapeo y persistencia de `subscription_expires_at` desde la base de datos PostgreSQL.
- **Auth Controller**: El endpoint `/api/auth/me` ahora entrega estos metadatos al cliente para su renderizado.

## 2. Gestión de Banco Agotado (IA Universal)
Se implementó un flujo de reposición automática en `TrainingService.js` para garantizar que ningún usuario se quede sin preguntas, independientemente de su plan.

### Flujo de Reposición:
1. El servidor detecta que el lote de preguntas del banco es insuficiente (< 5).
2. Se activa el **Modo Fast (IA)** para todos los usuarios.
3. El sistema genera preguntas nuevas balanceadamente para completar el lote.
4. **Beneficio**: Experiencia fluida y sin interrupciones ("Banco Infinito") para todos los Tiers.

### 3. Onboarding: Configuración por Defecto
Para garantizar que un usuario nuevo pueda entrenar inmediatamente sin fricciones, se ha implementado un sistema de "Provisión Automática" en `AuthService.js`:
- **Target**: `SERUMS` (Enfoque en Salud Pública).
- **Dificultad**: `Básico` (Nivel Teórico).
- **Carrera**: `Medicina Humana`.
- **Áreas**: 5 ejes oficiales del MINSA pre-seleccionados (Sincronización académica).
- **Visualización**: El dashboard del simulador detecta estos valores automáticamente si no existen preferencias previas, permitiendo el inicio instantáneo del primer examen.

## 4. Sección de Suscripción en el Perfil
Se reemplazó la visualización simple del rol por una sección dedicada en `profile.html`:
- **Badge Dinámico**: Diferenciación visual entre *Plan Gratuito*, *Plan Basic* y *Plan Advanced*.
- **Contenedor de Estado**:
    - **Premium Activo**: Muestra fecha de vencimiento formateada (ej: "15 de mayo de 2026") y una lista de beneficios incluidos.
    - **Plan Gratuito**: Muestra una invitación "Unlock" resaltada en dorado para incentivar el upgrade.

## 4. Estándares de Logging
Se han profesionalizado los logs en la terminal (`TrainingService.js`) utilizando iconos y trazas claras:
- `🔎 [Banco]`: Estado de stock en las áreas seleccionadas.
- `🤖 [IA Reposición]`: Activación de generación universal para completar lotes.
- `🍃 [IA AHORRO]`: Uso de modelo Lite ($0 cost) para todos los usuarios.
- `🛡️ [IA RAG]`: Uso de bibliografía oficial (exclusivo Advanced/Admin).

## 4. Refactorización de Pricing (Upgrades)
Se eliminó la restricción que ocultaba la tabla de precios a usuarios con suscripción activa:
- **Flujo de Upgrade**: Los usuarios con **Plan Básico** ahora pueden visualizar y adquirir el **Plan Avanzado**.
- **Identificación de Plan Actual**: Se resalta visualmente el nivel actual del usuario con un borde dorado y el badge "Tu Plan Actual".
- **Prevención de Errores**: El botón de compra del plan que el usuario ya posee se deshabilita automáticamente, indicando "Plan Activo".
- **Mensaje de Éxito**: Solo los usuarios en el nivel máximo (**Advanced**) ven el modal de "Ya eres Premium".

---
*Ultima actualización: 13 de marzo de 2026*
