# 🚀 Guía de Estrategia de Demos para Invitados (Guest Demo)

Este documento describe la arquitectura modular para las demostraciones (demos) de Hub Academia. El objetivo es permitir que usuarios no registrados prueben las funcionalidades principales con datos reales, manteniendo una experiencia fluida y realista.

## 🏗️ Arquitectura General (Evolución V2.0)

La estrategia ha evolucionado de datos estáticos a un modelo de **Alta Fidelidad**:
1.  **Demos Dinámicas (Simuladores)**: Uso del endpoint `/api/quiz/demo` para obtener preguntas aleatorias reales de la base de datos, eliminando la dependencia de archivos JS pesados.
2.  **Aislamiento de Dominios**: Separación estricta de historial y estadísticas entre Medicina y Educación mediante sufijos en `localStorage`.
3.  **Sistema de Límites Progresivos**: Control de acceso basado en tiempo y cantidad para incentivar la conversión (registro).

---

## 📂 Componentes Principales

### 1. Motor de Consultas Demo (`/api/quiz/demo`)
- **Funcionamiento**: El controlador `quiz.js` detecta el modo invitado y consulta este endpoint.
- **Ventaja**: El usuario prueba la calidad real de la casuística del banco sin consumir tokens de IA.
- **Anti-Repetición**: Soporta el parámetro `excludeIds` enviado desde el cliente para garantizar contenido nuevo en cada sesión.

### 2. Persistencia Local Segmentada (`localStorage`)
Para evitar cruces de información entre especialidades:
- **Estadísticas**: Se guardan como `guest_demo_stats_medicina` o `guest_demo_stats_educacion`.
- **Historial de Vistas**: Se guardan como `guest_seen_ids_medicina` o `guest_seen_ids_educacion`.

### 3. Motor de Analíticas del Dashboard (`simulator-dash.js`)
- El Tablero detecta si el usuario es invitado y busca los datos en el `localStorage` según el dominio actual.
- **Fallback de Marketing Contextual**: Si el usuario no tiene sesiones previas o no ha configurado su examen, se muestran **Datos de Ejemplo (Mock)** rigurosamente alineados al concurso oficial activo de cada dominio:
  - **Salud (SERUMS)**: Muestra exclusivamente los 5 ejes temáticos oficiales: *Ética e Interculturalidad*, *Salud Pública*, *Gestión de Servicios de Salud*, *Investigación* y *Cuidado Integral de Salud*.
  - **Educación (ASCENSO)**: Muestra los ejes pedagógicos del CNEB: *Enfoques y Principios del CNEB*, *Teorías y Procesos del Aprendizaje*, *Planificación y Evaluación* y *Clima Escolar e Inclusión*.
- **Comportamiento sin Configuración**: Muestra estado "Configuración Pendiente" con botón en neón parpadeante. Si el usuario intenta iniciar el simulacro de 10 QS, el sistema abre el modal de configuración con efecto shake para forzar la selección de su carrera y examen antes de iniciar.
- **Comportamiento con Configuración Aplicada**: Los gráficos de barras y de dona filtran y destacan las áreas de la configuración activa (las 5 del SERUMS). Al culminar el simulacro real de 10 preguntas, las analíticas del intento real reemplazan a los mocks.

### 4. Reinicio Diario y Límites de Sesión (GuestSessionManager)
Para incentivar el registro sin bloquear permanentemente al prospecto:
- **Límite de 1 Sesión Diaria**: El usuario visitante puede realizar hasta 1 simulacro rápido de 10qs en un periodo de 24 horas (fecha calendario `America/Lima`).
- **Retención de Datos de 1 Día (TTL Diario)**: La información y métricas obtenidas del simulacro demo (`guest_demo_stats_[domain]`) duran exactamente 1 día. Al iniciar un nuevo día calendario, `GuestSessionManager` purga automáticamente las estadísticas locales del visitante y reinicia el contador de sesiones a 0.
- **Anti-Repetición Persistente**: A diferencia de las estadísticas efímeras, los `guest_seen_ids` persisten para que, si el usuario vuelve al día siguiente, no vea las mismas preguntas que ya respondió. Solo se limpian si el banco de preguntas se agota totalmente para ese usuario.

---

## 🛡️ Resiliencia y Manejo de Errores

### Mecanismo de Autocuración (Corrupted Session Recovery)
Dado que el simulador guarda el progreso en `localStorage` para permitir recargas de página, existe el riesgo de que los datos se corrompan o queden obsoletos tras una actualización de código.
- **Detección**: En `quiz.js`, el bloque `initQuiz` está envuelto en un `try-catch` global.
- **Acción**: Si se detecta cualquier error de inicialización, el sistema asume que la sesión local está dañada, la elimina automáticamente (`localStorage.removeItem`) y redirige al usuario para iniciar una sesión fresca desde el backend.
- **Bypass de Demo**: Las sesiones en modo demo ignoran intencionalmente cualquier rastro de sesiones guardadas previas para evitar conflictos entre estados de usuario registrado y estados de invitado.

---

## 🛠️ Implementación por Módulo

### 🩺 Módulo de Simuladores (Medicina y Educación)
- **Activación**: Al hacer clic en "Simulacro Rápido" (10 preguntas) como invitado.
- **Configuración Permitida (Evolución V2.1)**:
  - Los visitantes pueden abrir el modal de configuración de exámenes y aplicar una configuración general bajo el **"Modo Examen Oficial"**. La configuración se guarda localmente en `localStorage` (`simActiveConfig_[context]`).
  - No se permite seleccionar "Práctica Personalizada"; al intentarlo, se muestra el modal de registro y se revierte la selección.
  - Al igual que un usuario registrado, si un visitante no ha aplicado una configuración previamente, no se le permitirá iniciar el simulacro de 10qs, y en su lugar se abrirá y agitará el modal de configuración.
- **Filtrado y Empaquetado Estricto de 10 Preguntas (`packDemoBatch`)**:
  - Los endpoints `/api/medico/demo` y `/api/docente/demo` reciben parámetros de consulta opcionales (`target`, `career`, `difficulty`, `areas`) del cliente.
  - El motor demo utiliza el algoritmo modular `packDemoBatch` para asegurar que las casuísticas anidadas (`case_scenarios`) se incluyan completas solo si encajan en el cupo restante sin romper la integridad del caso ni exceder bajo ninguna circunstancia el límite de 10 preguntas.
  - Se garantiza que el lote demo devuelto contenga exactamente 10 preguntas (nunca sobrecargas de 18 a 20 preguntas).
- **Aislamiento de Modo Ciego y Supresión de Tutor IA**:
  - El simulacro de prueba para visitantes se ejecuta estrictamente como **Modo Rápido / Arcade Ciego** (`mode=arcade`, `maxQuestions=10`).
  - Se desactiva cualquier activación inadvertida del "Modo Estudio" (20 preguntas) y se ocultan el panel de explicaciones durante el examen y el botón "Consultar Tutor IA", reservando los tokens y el asistente para usuarios registrados y autorizados.
- **Indicador Visual de Prueba y Bloqueos en Modo Visitante**:
  - Cuando el visitante tiene disponible su intento gratuito diario (`GuestSessionManager.canTakeDailyDemo() === true`), la tarjeta del **Simulacro Rápido (10 Preguntas)** (`#btn-mode-arcade`) parpadea dinámicamente con una animación de brillo dorado/amarillo (`.mode-card--trial-pulse`) y mantiene el botón *"Iniciar simulacro →"*.
  - Una vez rendido el simulacro, la animación se apaga y el botón pasa al estado *"Prueba completada 🔒"*, bloqueando intentos adicionales hasta el siguiente día calendario (`America/Lima`) y solicitando el registro de cuenta.
  - En las tarjetas de **Modo Estudio (20 Preguntas)** y **Simulacro Real (Oficial)**, sus botones muestran el icono de candado (`🔒`) para indicar de forma intuitiva que requieren registro o suscripción.
- **Mapeo de Dominios**: El frontend mapea automáticamente `MEDICINA -> medicine` y `EDUCACION -> education` para compatibilidad con el esquema de la DB.

### 🚀 Control de Versiones (Cache Busting)
Para asegurar que las correcciones lleguen a todos los usuarios de inmediato (evitando el caché del navegador):
- Se utiliza el parámetro `?v=YYYYMMDD_vX` en la importación de scripts en los archivos HTML (ej: `quiz.html`).
- **IMPORTANTE**: Al realizar cambios críticos en la lógica de `quiz.js` o `simulator-dash.js`, se debe incrementar esta versión en el HTML correspondiente.

---

## 📊 Resumen de Keys en LocalStorage

| Key | Propósito | Reset |
|-----|-----------|-------|
| `demo_sessions_count` | Contador de intentos del día (Máx: 1) | Diario (`America/Lima`) |
| `demo_sessions_date` | Fecha de la última sesión | Diario (`America/Lima`) |
| `guest_seen_ids_[domain]` | IDs de preguntas ya respondidas | Al agotar banco |
| `guest_demo_stats_[domain]` | Data para gráficos de dashboard (TTL 1 día) | Diario (`America/Lima`) |
| `current_exam_session` | Sesión activa (Resiliencia) | Al terminar / Expirar |

---

## 📱 Política de Aplicaciones Móviles (HubDocenteApp y HubSaludApp)

A diferencia de la plataforma web donde los visitantes pueden realizar simulacros demo de 10 preguntas:
- **Autenticación Obligatoria (100% SSO)**: Las aplicaciones móviles requieren inicio de sesión con Google desde el primer momento (`/(auth)/login`).
- **Motivo de Arquitectura**: 
  1. Evitar bypass de cuotas en cliente móvil mediante borrado de almacenamiento local.
  2. Proteger las vidas sincronizadas (10 vidas en cuenta gratuita en PostgreSQL/Supabase).
  3. Vincular de inmediato el historial y analíticas de simulacros al usuario.
- **Disponibilidad Inicial de Concursos**:
  - **Educación (`HubDocenteApp`)**: Habilitado exclusivamente el examen objetivo **ASCENSO** (MINEDU). Los demás concursos (**Nombramiento**, **Acceso a Cargos**) se presentan con el distintivo **"Pronto"** para evitar selección prematura.
  - **Salud (`HubSaludApp`)**: Habilitado exclusivamente el examen objetivo **SERUMS** (MINSA). Los demás exámenes (**ENAM**, **Residentado**) se presentan con el distintivo **"Pronto"**.

---

## 💎 Beneficios
- **Alta Fidelidad**: El usuario prueba el producto REAL, no una maqueta.
- **Conversión Progresiva**: 1 sesión diaria en web es suficiente para demostrar el valor antes de pedir el registro.
- **Eficiencia**: Cero consumo de créditos de IA para usuarios no registrados.
- **Orden**: Aislamiento total entre perfiles médicos y docentes desde el primer clic.
