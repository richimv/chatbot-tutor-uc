# 🚀 Guía de Estrategia de Demos para Invitados (Guest Demo)

Este documento describe la arquitectura modular y escalable para las demostraciones (demos) de los módulos de Hub Academia. El objetivo es permitir que usuarios no registrados prueben las funcionalidades principales sin incurrir en costos de backend/IA y manteniendo una experiencia de usuario fluida y realista.

## 🏗️ Arquitectura General

La estrategia se basa en tres pilares:
1.  **Datos Estáticos Centralizados**: Un archivo `demoData.js` que contiene bancos de preguntas/tarjetas de ejemplo.
2.  **Persistencia Local (Real-Feel)**: Uso de `localStorage` para guardar el progreso de la sesión del invitado y generar analíticas dinámicas.
3.  **Lógica Decoplada**: Los controladores de cada módulo detectan el modo demo mediante flags en la URL o la ausencia de tokens de sesión.

---

## 📂 Componentes Principales

### 1. Banco de Datos de Demo (`demoData.js`)
Ubicado en `presentation/public/js/demoData.js`.
- Actúa como una base de datos local para invitados.
- Estructura: `window.DemoBank = { MODULO: [ ...items ] }`.
- **Importante**: Debe seguir el mismo esquema de propiedades que la base de datos real (ej: `question_text`, `correct_option_index`).

### 2. Controladores de Módulo (`quiz.js`, `repaso.js`)
Detectan si el usuario debe recibir datos de demo:
- **Flag URL**: `?demo=true`
- **Fallback**: Si no hay `authToken`, el sistema activa comportamientos de invitado.
- **Acción**: En lugar de hacer un `fetch` a la API, el controlador lee de `window.DemoBank`.

### 3. Motor de Analíticas Locales (`simulator-dash.js`)
Para que la demo no sea estática, el sistema:
- Guarda los `areaStats` y puntajes en `localStorage` al finalizar un examen de demo.
- El Tablero Médico (`simulator-dash.js`) prioriza estos datos locales sobre los de la API para renderizar el **Gráfico de Radar** y los **KPIs**.

---

## 🛠️ Implementación por Módulo

### 🩺 Módulo de Simuladores (Simulador Médico)
- **Activación**: Al hacer clic en "Simulacro Rápido" (Arcade) como invitado.
- **Acceso Restringido**: El "Modo Estudio" (20 preguntas) está bloqueado para invitados para incentivar la conversión.
- **Límite de Conversión**: Se permiten **3 sesiones gratuitas** de Simulacro Rápido. Esto se controla mediante `localStorage.demo_sessions_count`.
- **Sistema Anti-Repetición**: Las preguntas vistas se almacenan en `guest_seen_ids` para asegurar que cada uno de los 3 intentos muestre contenido nuevo.
- **Bloqueo Temprano & UI**: 
    - El dashboard bloquea el acceso antes de navegar si se agotan los intentos.
    - Se utiliza la modal unificada de "Únete a Hub Academia" para todos los límites.
    - **Efecto Visual (Glow)**: La tarjeta tiene un brillo pulsante y etiqueta de "¡Pruébalo ahora!" que cesa al agotar los intentos.

### 📚 Módulo de Repaso (Flashcards)
- **Modo Vitrina**: Los invitados ven mazos de sistema (tipo `SYSTEM`) marcados como ejemplos.
- **Start Study Demo**: Función `startStudyDemo(deckId)` en `repaso.js`.
- **Flujo**: 
    - Carga un set de tarjetas pre-definidas.
    - Permite al usuario interactuar (girar, calificar dificultad).
    - Al terminar el mazo, muestra el modal de "Únete a Hub" para incentivar el registro.

---

## 🚀 Guía para Nuevos Módulos

Para añadir una demo a un nuevo módulo (ej: "Casos Clínicos Interactivos"):

1.  **Añadir Data**: Agrega una nueva clave en `window.DemoBank` en `demoData.js`.
2.  **Interceptar Carga**: Validar `authToken` o flags de URL para activar modo demo.
3.  **Implementar Límites**: Definir un número máximo de usos (ej: 3) y persistir en `localStorage`.
4.  **Anti-Repetición**: Si es un módulo de preguntas, usar un array de IDs vistos para filtrar la data local.
5.  **Persistir Estadísticas**: Guardar resultados en `localStorage` para que el dashboard muestre progreso realista.
6.  **Highlight Visual**: Considerar usar la clase `.arcade-highlight` para guiar al usuario.

---

## 💎 Beneficios
- **Escalabilidad**: Sistema modular que permite añadir demos sin tocar el backend.
- **Conversión Progresiva**: Permite probar lo justo para generar interés (3 sesiones) antes de solicitar el registro.
- **Costo Cero**: No se consumen tokens de IA ni recursos de servidor para invitados.
- **Consistencia**: Uso de componentes UI y modales existentes para una experiencia profesional.
