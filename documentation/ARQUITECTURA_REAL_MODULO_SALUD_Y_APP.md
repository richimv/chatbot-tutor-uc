# 🩺 Especificación Maestra de Arquitectura y Mapeo: Módulo Salud (Web ↔ App Móvil)

> **Documento de Verdad y Coherencia de Negocio (Single Source of Truth)**  
> **Ámbito:** Plataforma Web (`hubacademia`) ↔ Aplicación Celular (`HubSaludApp`)  
> **Fecha de Sincronización:** Agosto 2026  
> **Regla de Oro:** Cero invención. Todo componente, endpoint, entidad y flujo móvil debe ser un reflejo exacto y adaptado de las capacidades reales existentes en el sistema web.

---

## 1. 🏛️ Estructura de las 4 Capas (Clean Architecture)

```
========================================================================================================
CAPA                   WEB (hubacademia)                                  APP (HubSaludApp)
========================================================================================================
1. PRESENTATION        • simulator-dashboard.html / .js (context MEDICINA)• app/(tabs)/home.tsx (Dashboard + KPIs + Modos)
                       • quiz.html / quiz.js                              • app/(tabs)/simulators.tsx (Modal Configuración)
                       • quiz-tutor.js (Chat RAG en examen médico)        • app/(tabs)/leaderboard.tsx (Ranking médico real)
                       • components.css / theme.css                       • app/quiz/index.tsx (Motor de Examen 10q/20q/100q)
                                                                          • app/quiz/results.tsx (Score + Corrección)
                                                                          • components/ClinicalQuestionCard.tsx, ClinicalTutorModal, etc.

2. APPLICATION         • medicoController.js                              • application/context/AuthContext.tsx
                       • checkLimitsMiddleware.js                         • application/state/quizState.ts
                       • usageMiddleware.js                               • application/hooks/useSaludQuiz.ts

3. DOMAIN              • medicoService.js                                 • domain/types/salud.ts
                       • medicoRepository.js                              • domain/services/saludService.ts
                       • generationPrompts.js (isMedicine)                • domain/models/saludModels.ts
                       • question_bank & quiz_history schemas

4. INFRASTRUCTURE      • apiRoutes.js (/api/medico/*)                     • infrastructure/network/NetworkService.ts
                       • Supabase Client (PostgreSQL + JSONB)             • infrastructure/storage/SecureStore.ts
                       • Pinecone Namespace 'medicine' (RAG)              • infrastructure/api/saludApi.ts
========================================================================================================
```

---

## 2. 🗄️ Esquema de Base de Datos Real (Supabase / PostgreSQL)

Las aplicaciones móviles de salud e interfaces web interactúan con las mismas tablas existentes en la base de datos sin alterar ni crear tablas ficticias:

### 2.0 Tabla `case_scenarios` (Viñetas Clínicas / Casos Complejos Compartidos con RLS)
```sql
CREATE TABLE public.case_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,          -- 'CASO-MED-2026-01'
    title VARCHAR(255),                        -- 'Paciente Politraumatizado en Shock'
    description_text TEXT NOT NULL,            -- Historia clínica, anamnesis y examen físico común
    image_url TEXT,                            -- EKG, Radiografía, TAC, Frotis (GCS/Supabase)
    domain VARCHAR(50) NOT NULL DEFAULT 'medicine', -- 'medicine' | 'education'
    target VARCHAR(50),                        -- 'ENAM', 'SERUMS', 'RESIDENTADO'
    topic VARCHAR(100),                        -- Especialidad médica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.case_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to case_scenarios" ON public.case_scenarios FOR SELECT USING (true);
CREATE POLICY "Allow admin manage case_scenarios" ON public.case_scenarios FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin')) WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin'));
```

### 2.1 Tabla `question_bank` (Banco Maestro Clínico & Encadenamiento de Viñetas)
```sql
CREATE TABLE public.question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) DEFAULT 'medicine',   -- 'medicine' para preguntas de salud
    target VARCHAR(255),                      -- 'SERUMS', 'ENAM', 'RESIDENTADO'
    career VARCHAR(100),                      -- 'Medicina Humana', 'Enfermería'
    topic VARCHAR(100) NOT NULL,              -- 'Cardiología', 'Salud Pública', 'Pediatría'
    subtopic VARCHAR(255),                    -- 'Manejo del síndrome coronario agudo'
    difficulty VARCHAR(50) DEFAULT 'Intermedio',
    question_text TEXT NOT NULL,              -- Pregunta clínica específica
    options JSONB NOT NULL,                   -- ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "Alternativa E"]
    correct_option_index INTEGER NOT NULL,    -- 0, 1, 2, 3 (o 4 en Residentado)
    explanation TEXT,                         -- Justificación clínica oficial basada en NTS / GPC / MINSA
    image_url TEXT,
    explanation_image_url TEXT,
    case_id UUID REFERENCES public.case_scenarios(id) ON DELETE SET NULL, -- Vínculo a la viñeta clínica común
    case_order INTEGER DEFAULT 1,             -- Orden secuencial de la pregunta en el caso (1, 2, 3...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2.2 Tabla `quiz_history` (Historial Clínico y Analítica JSONB)
```sql
CREATE TABLE public.quiz_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    target VARCHAR(50),                       -- 'SERUMS', 'ENAM', 'RESIDENTADO'
    career VARCHAR(100),                      -- 'Medicina Humana', 'Enfermería'
    topic VARCHAR(100) NOT NULL,              -- 'Simulacro Médico Pro'
    difficulty VARCHAR(20) DEFAULT 'MIXTO',
    score INTEGER NOT NULL,                   -- Puntuación /20
    total_questions INTEGER NOT NULL,         -- 10, 20 o 100
    weak_points TEXT[],
    area_stats JSONB DEFAULT '{}'::jsonb,     -- {"Cardiología": {"correct": 4, "total": 5}, ...}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2.3 Tabla `user_question_history` (Anti-Repetición)
```sql
CREATE TABLE public.user_question_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    question_id UUID REFERENCES public.question_bank(id),
    seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    times_seen INTEGER DEFAULT 1
);
```

### 2.4 Tabla `user_simulator_preferences` (Sincronización de Configuración Activa)
```sql
CREATE TABLE public.user_simulator_preferences (
    user_id UUID NOT NULL REFERENCES public.users(id),
    domain VARCHAR(50) NOT NULL,             -- 'medicina'
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"target":"SERUMS","career":"Medicina Humana","areas":[...]}
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (user_id, domain)
);
```

### 2.5 Tabla `users` (Gestión de Identidad, Avatar Oficial y Vidas)
```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) DEFAULT 'student',
    avatar_url TEXT,                               -- Foto oficial sincronizada desde Google CDN
    subscription_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'active' | 'expired'
    subscription_tier VARCHAR(50) DEFAULT 'free',      -- 'free' | 'basic' | 'advanced'
    usage_count INTEGER DEFAULT 0,                 -- Vidas consumidas
    max_free_limit INTEGER DEFAULT 10,             -- Límite de vidas gratuitas (10)
    last_free_renewal TIMESTAMP WITH TIME ZONE DEFAULT now(), -- Renovación semanal de 10 vidas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 3. 🎯 Entidades Reales y Modelos de Datos (Dominio Salud)

### 3.1 Exámenes Objetivo Reales (`targets`)
| Target Web | Valor Backend | Estado en Web | Descripción Real |
| :--- | :--- | :--- | :--- |
| **SERUMS** | `'SERUMS'` | **ACTIVO (Principal)** | Evaluación Nacional de Adjudicación SERUMS (MINSA / ENCAPS). |
| **ENAM** | `'ENAM'` | Próximamente / Activo | Examen Nacional de Medicina (ASPEFAM). |
| **RESIDENTADO** | `'RESIDENTADO'` | Beta / Especialidades | Residentado Médico (CONAREME). |

---

### 3.2 Profesiones de la Salud Reales (`career`)
1. **`Medicina Humana`** (`career = 'Medicina Humana'`)
2. **`Enfermería`** (`career = 'Enfermería'`)

---

### 3.3 Las 22 Áreas Clínicas Oficiales (Agrupadas en 4 Bloques)

1. **Ciencias Básicas:**
   - *Anatomía*
   - *Fisiología*
   - *Farmacología*
   - *Microbiología y Parasitología*

2. **Las 4 Grandes:**
   - *Medicina Interna*
   - *Pediatría*
   - *Ginecología y Obstetricia*
   - *Cirugía General*

3. **Especialidades Clínicas:**
   - *Cardiología*
   - *Gastroenterología*
   - *Neurología*
   - *Nefrología*
   - *Neumología*
   - *Endocrinología*
   - *Infectología*
   - *Reumatología*
   - *Traumatología*

4. **Salud Pública y Gestión:**
   - *Salud Pública*
   - *Cuidado Integral de Salud*
   - *Ética e Interculturalidad*
   - *Investigación*
   - *Gestión de Servicios de Salud*

---

### 3.4 Modos de Entrenamiento Reales
| Modo | Cantidad Preguntas | Comportamiento en Examen | Justificación / Feedback |
| :--- | :--- | :--- | :--- |
| ⚡ **Simulacro Rápido** | **10 preguntas** | Feedback visual inmediato al pulsar opción (Azul/Rojo). Auto-avance ágil. | Explicación profunda reservada para la revisión final. |
| 📚 **Modo Estudio** | **20 preguntas** | Enfoque formativo pausado. Muestra acierto/error y despliega la caja de justificación. | **Explicación médica oficial en cada pregunta** + Botón **Tutor IA**. |
| 🎯 **Simulacro Real** | **100 preguntas** | "Modo Ciego" con cronómetro global oficial de 120 min. Sin feedback intermedio. | Corrección completa y detallada al finalizar el examen. |

---

## 4. 🔌 Endpoints de la API Backend (`/api/medico/*`)

1. `POST /api/medico/start`: Genera examen híbrido (Banco local balanceado + reposición RAG IA si se agota).
2. `POST /api/medico/next-batch`: Siguiente tanda durante simulacro con `seenIds` para evitar repeticiones.
3. `GET /api/medico/demo`: Reactivos de prueba para visitantes sin login.
4. `POST /api/medico/submit`: Envío de puntaje vigesimal y registro atómico de `area_stats`.
5. `GET /api/medico/stats`: Obtención de KPIs, precisión, tópico fuerte/débil y `radar_data`.
6. `GET /api/medico/evolution`: Curva de evolución histórica de puntajes.
7. `GET /api/medico/leaderboard`: Tabla de líderes médicos por promedio ponderado.
8. `POST /api/chat`: Tutor Clínico IA con namespace semántico `medicine` de Pinecone.

---

## 5. 📱 Adaptaciones y Optimizaciones en `HubSaludApp`

### 5.1 🎨 Renderizado de Markdown, Sanitización HTML e Imágenes Universales (`RichMarkdown` & `MediaUrlResolver`)
- **Sanitización Profunda de HTML**: Procesa y limpia automáticamente etiquetas como `<p>`, `</p>`, `<br>`, `<strong>`, `<b>`, `<i>`, `<em>`, `<li>` y entidades HTML (`&nbsp;`, `&quot;`, `&#39;`, `&aacute;`, etc.), eliminando etiquetas crudas y garantizando presentación clínica impecable.
- **Resolución Universal de Imágenes**: Soporta URLs absolutas y rutas relativas de Google Cloud Storage (GCS) a través del proxy `${API_URL}/api/media/gcs?file=...`.
- **Imágenes en Casos Clínicos y Justificación**: Renderizado tanto de `image_url` en la pregunta como de `explanation_image_url` en la caja de sustento clínico (MINSA/ASPEFAM) y en el feed de revisión de resultados con visor lightbox interactivo.

---

### 5.2 🧠 Tutor Clínico IA (`ClinicalTutorModal.tsx` / `CHAT_IA_TECH_SPECS.md`)
- **Activación Exclusiva Post-Respuesta**: El botón y chip del Tutor Clínico (`✨ Tutor Clínico` / `✨ Preguntar al Tutor IA`) se habilitan y muestran **únicamente cuando el postulante ya ha seleccionado una alternativa clínica**, evitando pistas previas durante el examen.
- **Integración con `/api/chat`**:
  - Enrutamiento con `specialization: 'medicine'`, `target: 'SERUMS' | 'ENAM' | 'RESIDENTADO'`, `examContext: 'MEDICINA'`.
  - Inyección de contexto clínico completo (`questionText`, `options`, `correctOptionText`, `userOptionText`, `isUserCorrect`, `explanation`, `topic`, `career`).
  - Historial de sesión efímero (`history: [{ sender: 'user' | 'bot', content: '...' }]`).
- **Sugerencias Rápidas Interactivas (`sugerencias`)**: Chips clicables encima del campo de entrada para consultas instantáneas.

---

### 5.3 💾 Persistencia de Exámenes en Progreso, Reanudación e Interrupción (`ResumeQuizModal` & `ExitQuizModal`)
- **Auto-Guardado Continuo (`simulator_active_session_*`)**: Guarda el progreso clínico en `AppStorage` ante interrupciones.
- **Modal de Reanudación (`ResumeQuizModal.tsx`)**: Al reingresar a un simulacro clínico en progreso (< 24h), permite *"Continuar Examen"* o *"Iniciar Nuevo"*.
- **Interrupción In-App Multiplataforma (`ExitQuizModal.tsx`)**: Diálogo in-app confiable en Web y Móvil para pausar, guardar o descartar.
- **Limpieza Atómica al Culminar**: Al finalizar el examen (`finishQuiz`), la sesión activa se elimina y el resultado se sincroniza en PostgreSQL o almacenamiento local de demo.

---

### 5.4 ⚙️ Configuración Obligatoria Pre-Simulacro, Filtrado Clínico por Especialidad y Sincronización en BD (`ExamConfigModal` & `/api/users/preferences`)
- **Configuración Obligatoria Pre-Examen Clínico**: Ningún usuario puede iniciar un simulacro sin una configuración activa. Si el postulante no cuenta con una configuración guardada, el modal `ExamConfigModal.tsx` se abre de inmediato.
- **Selector de Carrera y Examen Objetivo (`target` & `career`)**:
  - Targets: `SERUMS` (MINSA), `ENAM` (ASPEFAM), `RESIDENTADO` (CONAREME).
  - Carreras: `Medicina Humana`, `Enfermería`.
- **Filtrado Estricto en Base de Datos**:
  - En `POST /api/medico/start` y `GET /api/medico/demo`, se envía estrictamente el parámetro `career` (`Medicina Humana` o `Enfermería`).
  - La consulta SQL en `medicoRepository.js` filtra por carrera y especialidades clínicas seleccionadas (`WHERE domain = 'medicine' AND target = $target AND (career IS NULL OR career = $career)`).
- **Sincronización con PostgreSQL (`user_simulator_preferences`)**:
  - `GET /api/users/preferences?domain=medicine`: Sincroniza las preferencias del postulante médico al iniciar la app.
  - `POST /api/users/preferences`: Persiste y actualiza las preferencias `{ domain: 'medicine', config_json: { target, career, configMode, areas, difficulty } }`.
  - Persistencia local en `AppStorage` (`simActiveConfig_salud`) para modo visitante y soporte sin conexión.
- **Banner de Filtro Activo y KPIs en Dashboard (`home.tsx`)**:
  - Badges con Target clínico, Carrera y Especialidades activas con botón `[⚙️ Configurar]`.
  - KPIs de promedio vigesimal, precisión diagnóstica global, aciertos/errores y gráfico de barras por áreas clínicas sincronizados con la especialidad del usuario.

---

### 5.5 📈 Gráfico de Tendencia Histórica Clínica y Especialidades Agrupadas (`HistoricalTrendChart` & `ClinicalBarChart`)
- **Tendencia Histórica Clínica (`HistoricalTrendChart.tsx`)**: Visualización en SVG de la evolución de diagnósticos y puntajes en el tiempo divididos por *Modo Rápido (10q)*, *Modo Estudio (20q)* y *Simulacro Real (100q)*, incluyendo la línea aprobatoria (14.0 pts).
- **Dominio Clínico Agrupado**: El gráfico agrupa las especialidades según la matriz oficial (*Salud Pública y Atención Primaria*, *Ciencias Clínicas de Urgencia* para SERUMS; *Grandes Especialidades Médicas*, *Salud Pública y Ciencias Básicas* para ENAM; *Medicina de Alta Complejidad*, *Epidemiología y Bioestadística* para Residentado), calculando el promedio por grupo y la precisión individual.

---

### 5.6 🖼️ Parser de Imágenes Embebidas TinyMCE y Tablas de Dosificación/Algoritmos (`RichMarkdown.tsx`)
- **Imágenes Embebidas en Casos Clínicos (`<img>` / `![]()`)**: Extracción de imágenes dentro del enunciado de TinyMCE (ej. electrocardiogramas, radiografías, esquemas diagnósticos), resolución con proxy GCS y visor interactivo Modal Lightbox para ampliación táctil.
- **Tablas Clínicas Responsivas (`<table>` / Markdown Tables)**: Formato estructurado para tablas de dosificación de fármacos, criterios diagnósticos y matrices clínicas con desplazamiento horizontal.
- **Navegación Móvil Limpia (2 Tabs)**: Solo 2 pestañas activas: **Clínica** (`home`) y **Mi Perfil** (`profile`).

---

### 5.7 🩺 Retroalimentación por Modos Clínicos, Paleta Oficial Azul/Rojo y Protección de Tutor IA
- **Paleta Oficial de Retroalimentación**:
  - **Acierto / Diagnóstico Correcto**: **AZUL** (`#3b82f6` / `#2563eb` / `rgba(59, 130, 246, 0.18)`), estándar idéntico a la versión web de la plataforma.
  - **Error / Diagnóstico Incorrecto**: **ROJO** (`#ef4444` / `#dc2626` / `rgba(239, 68, 68, 0.18)`).
  - **Selección Neutra (Simulacros Reales)**: Resaltado neutro (`rgba(255, 255, 255, 0.12)`) sin desvelar la clave.
- **Comportamiento por Modos de Examen Clínico**:
  - **Modo Rápido (10q)**: Feedback visual inmediato en **AZUL / ROJO** al marcar una opción. No muestra la caja de justificación clínica ni el botón del Tutor IA durante la prueba para mantener un flujo ágil. Al culminar, la pantalla de **Revisión del Examen** presenta todas las justificaciones MINSA y activa el Tutor IA.
  - **Modo Estudio Clínico (20q)**: Feedback inmediato en **AZUL / ROJO**, despliega la caja de justificación clínica oficial y habilita el botón del Tutor Clínico IA instantáneamente.
  - **Simulacros Reales (100q)**: Selección neutra sin colores de acierto ni explicaciones intermedias. Todo se revela al finalizar en la revisión.
- **Tutor Clínico IA Sanitizado y Protección Demo**:
  - Interfaz sin etiquetas comerciales del modelo (`Gemini 3.1 Flash Lite` en backend).
  - Sanitizador `extractCleanAiText` que previene cualquier fuga de JSON o corchetes.
  - **Protección Visitantes / Demo**: Bloqueo de inputs para visitantes no autenticados, presentando la tarjeta Glassmorphism de invitación a registrarse gratis para desbloquear el tutor y guardar diagnósticos.
- **Tiers Oficiales y RAG Pinecone**:
  - Tiers del sistema: `free`, `basic`, `advanced` (y `admin`). No existe el tier `elite`.
  - Pinecone RAG exclusivo para `advanced` y `admin` (hasta 25 msgs/día).
- **Tendencia Histórica con Datos 100% Reales**:
  - `HistoricalTrendChart.tsx` renderiza estrictamente los datos existentes en PostgreSQL (`quiz_history`).
  - Eliminados todos los datos ficticios de fallback. Si no hay datos registrados, presenta un Estado Vacío elegante ("Sin historial registrado").

---

### 4.13 ☀️ Rediseño Integral a Tema Claro Clínico, Política de Registro y Estado de Concursos (Actualización Agosto 2026)
- **Tema Claro de Alto Rendimiento Clínico**:
  - Paleta base: fondo `#f8fafc`, tarjetas `#ffffff` con sombras suaves multiplataforma, bordes `#e2e8f0` / `#99f6e4`, primario teal clínico/verde médico (`#0d9488` a `#0f766e`), acento suave (`#059669` / `#06b6d4` / `#ccfbf1`), dorado de excelencia (`#f59e0b` / `#fffbeb`) y tipografía oscura legible `#0f172a` y `#475569`.
  - Reemplazo completo de componentes oscuros a tema claro: `ClinicalQuestionCard.tsx`, `ClinicalTutorModal.tsx`, `ExamConfigModal.tsx`, `HistoricalTrendChart.tsx`, `ClinicalBarChart.tsx`, `RichMarkdown.tsx`, `ExitQuizModal.tsx`, `ResumeQuizModal.tsx`, `login.tsx`, `profile.tsx`, `pricing.tsx`, `terms-and-conditions.tsx` y `privacy-policy.tsx`.
- **Eliminación de Demo Mode en Móvil y Redirección Instantánea**:
  - Se eliminó la pantalla splash redundante con botón demo (`index.tsx`).
  - La aplicación redirige de inmediato a `/(tabs)/home` si existe sesión activa o a `/(auth)/login` si el usuario no está autenticado, incentivando el registro para guardar analíticas y progreso.
- **Disponibilidad de Concursos de Salud**:
  - `SERUMS`: Concurso activo y habilitado para simulación.
  - `ENAM`, `RESIDENTADO MÉDICO` y `CONCURSO MINSA`: Marcados con badge "Pronto" y deshabilitados temporalmente en el selector de convocatorias.

---

### 4.14 🔄 Ciclo de Vida de Casos Clínicos (24h), Paginación por Lotes y Normalización de Filtros
- **Paginación Reactiva por Lotes (`/api/medico/start` & `/api/medico/next-batch`)**:
  - Al iniciar una evaluación médica, la app móvil solicita un primer lote de 5 casos clínicos balanceados (`Math.min(5, totalLimit)`).
  - Conforme el postulante avanza, el cliente solicita automáticamente el siguiente lote con `SaludService.getNextBatch` enviando los `seenIds` acumulados en la sesión para evitar repeticiones internas.
- **Ciclo Anti-Repetición de 24 Horas (`user_question_history`)**:
  - Al culminar y enviar las respuestas mediante `POST /api/medico/submit`, el backend actualiza `user_question_history` marcando cada caso clínico con `seen_at = NOW()` y `times_seen = times_seen + 1`.
  - Durante las siguientes 24 horas, `medicoRepository.findQuestionsInBankBatch` excluye automáticamente esos casos clínicos (`seen_at > NOW() - INTERVAL '24 hours'`), garantizando que el médico o enfermero reciba casos frescos.
  - Al día siguiente (transcurridas 24 horas), los casos clínicos vuelven a estar disponibles automáticamente en el pool del postulante.
- **Normalización de Dificultad y Resiliencia Backend**:
  - Los filtros generales como `'MIXTO'`, `'TODOS'`, `'ALL'` o `'DEFAULT'` son normalizados para no restringir indebidamente el banco (`question_bank`).
  - Si la reposición RAG de IA experimenta demoras o indisponibilidad en el servidor, el servicio entrega los casos clínicos disponibles del banco (`balancedBatch`) como fallback seguro sin interrumpir la simulación.

---

### 4.15 🛡️ Gestión Robusta de Modales, Botón Retroceso (Hardware BackHandler) y Persistencia del Chat IA
- **Cierre Táctil por Backdrop y Botón Físico (`onRequestClose` / `BackHandler`)**:
  - **Modales Auxiliares (`ClinicalTutorModal`, `ExamConfigModal`, `Lightbox`)**: Incorporan un backdrop interactivo que se cierra inmediatamente al tocar fuera del contenedor y responden al botón físico o gesto de retroceso del dispositivo móvil cerrando la modal sin alterar la pantalla de fondo.
  - **Modales Críticas (`ExitQuizModal`, `ResumeQuizModal`)**: Requieren una selección explícita por parte del usuario para evitar pérdidas accidentales de progreso. Al presionar retroceso en `ExitQuizModal`, se cancela la salida y se retoma la prueba; en `ResumeQuizModal`, se regresa con seguridad al dashboard.
- **Flujo de Retroceso Inteligente durante el Examen (`quiz/index.tsx`)**:
  - Si una modal (Tutor, Lightbox, Salida) está abierta, el retroceso cierra dicha modal.
  - Si `currentIndex > 0`, el retroceso navega al caso clínico inmediatamente anterior (`handlePrevious()`).
  - Si `currentIndex === 0` (primer caso clínico), el retroceso abre la modal de pausa/salida segura (`ExitQuizModal`), evitando la salida accidental sin guardar.
  - En la pantalla de resultados (`results.tsx`), el retroceso redirige limpiamente a la pantalla de inicio (`/(tabs)/home`).
- **Persistencia de Conversación con el Tutor IA por Caso Clínico**:
  - Al consultar al Tutor IA y cerrar o minimizar la modal, el historial de mensajes permanece intacto en memoria para ese mismo caso clínico.
  - El estado del chat se reinicializa únicamente cuando el profesional de salud pasa a un caso clínico diferente (`question.id` distinto).
  - Sanitizador `stripHtml` integrado en la cabecera del Tutor para limpiar etiquetas `<p>` o `<img>` residuales y renderizar resúmenes clínicos pulcros.

---

### 4.16 🎯 Visibilidad de Botón 'X', Mensajes de Progreso Exactos (1/10, 1/20) y Aislamiento Estricto por Modalidad
- **Alto Contraste y Visibilidad del Botón 'X' de Salida**:
  - El botón de cierre en cabecera (`exitBtn`) fue optimizado con contenedor circular blanco (`#ffffff`), borde sólido (`#cbd5e1`), sombra de elevación e icono oscuro de 22px (`SaludPalette.textPrimary` `#0f172a`), garantizando 100% de legibilidad en tema claro.
- **Mensajes de Progreso Transparentes y Exactos en Modales**:
  - `ResumeQuizModal`: Muestra una redacción concisa sin redundancias: *"Tienes un simulacro de **{targetExam}** (**{modeName}**) en progreso donde respondiste **{answeredCount} de {totalQuestions}** preguntas."* (ej. 3 de 20 preguntas).
  - `ExitQuizModal`: Informa al postulante el estado exacto de avance: *"Vas en la pregunta **{currentQuestionNumber} de {totalQuestions}** (**{answeredCount}** respondidas). Tu progreso se guardará automáticamente..."*.
- **Aislamiento de Sesiones por Modalidad (Rápido 10q, Estudio 20q, Real 100q)**:
  - Al iniciar una evaluación de diferente modalidad (ej. cambiar de 10qs a 20qs), el sistema valida la coincidencia de `mode`, `target` y `totalLimit`. Si no coinciden, descarta la sesión previa y genera una prueba limpia de 20 casos clínicos, evitando que se mezclen preguntas y garantizando el registro fidedigno de analíticas en la base de datos al culminar.

---

### 4.18 🧠 Diagnóstico Inteligente Multi-Tier & Principio de Sobriedad Visual (`AIDiagnosisCard.tsx` & `/api/analytics/diagnostic`)
- **Integración de Diagnóstico en App Móvil (`AIDiagnosisCard.tsx`)**:
  - Ubicado en `app/(tabs)/home.tsx`, permite al postulante médico extraer un informe estructurado de rendimiento clínico basado en sus simulacros reales.
  - **Índice de Preparación Oficial (`Readiness Index %`)**: Visualiza un score ponderado de efectividad correlacionado con la escala vigesimal y badge de competencia (`Sobresaliente`, `Competente`, `En Desarrollo`, `Inicial`).
  - **Fortalezas y Oportunidades de Mejora**: Tarjetas analíticas con conteo de reactivos correctos/fallados y sustento normativo oficial MINSA/ASPEFAM renderizadas mediante `RichMarkdown.tsx`.
  - **Píldora High-Yield Oficial (Exclusiva Plan Avanzado)**: Perla clínica oficial renderizada con fondo suave `#f0fdfa`, borde `#ccfbf1` y acento en Verde Esmeralda/Teal (`#0d9488`).
  - **Sprint Táctico en 3 Pasos**: Ruta accionable estructurada (Refuerzo Conceptual, Modo Estudio 20q y Velocidad en 10q).
- **Paleta Cromática Unificada (Cero Efecto Arcoíris)**:
  - En sincronía con la plataforma web, se eliminaron los colores estridentes/no contextuales (púrpuras `#8b5cf6`, amarillos `#fde68a`, etc.).
  - Todos los elementos visuales del diagnóstico (`tierBadgeAdvanced`, `highYieldBox`, `sprintBadge`, `upgradeCallout`, `extractBtn`) utilizan la paleta médica Verde Esmeralda / Teal (`#0d9488`, `SaludPalette.primary`), garantizando sobriedad clínica de alto nivel.
- **Gestión de Cuotas y Vidas en Móvil**:
  - **Cuentas Free**: Consume 1 vida semanal al generar el diagnóstico, dispara el toast flotante `LifeToast` (`⚡ 1 vida utilizada en diagnóstico. Te quedan X vidas.`) y sincroniza el perfil con `refreshProfile()`. Si las vidas llegan a 0, despliega la alerta con acceso a `/pricing`.
  - **Plan Básico**: Diagnóstico heurístico estático ilimitado (0 tokens de IA).
  - **Plan Avanzado / Admin**: Auditoría cognitiva profunda con **Motor de IA Avanzado (Google Cloud Vertex AI)** (consumiendo 1 token diario).
- **Iconografía Sobria y Minimalista (Sin Icon Clutter)**:
  - En cumplimiento de `DESIGN_SYSTEM.md`, la interfaz móvil evita el exceso de iconos decorativos, dando protagonismo a la tipografía clara (`Inter`), espaciados limpios y jerarquía visual esbelta.
- **Diferenciación Móvil**: En la app móvil no existe modo demo ni el gráfico de dona "Distribución por Áreas", conservando una experiencia nativa directa y enfocada.

---

## 🚀 5. Sincronización Móvil de Simulacro Real, Método B y Blindaje RAG (Septiembre 2026)

Para consolidar los mismos estándares técnicos en **Hub Salud App (`HubSaludApp`)**:

### 1. Carga Total Atómica (Método B) en Mobile
* `app/quiz/index.tsx` solicita directamente el tamaño total del examen (`limit: totalLimit`: 10, 20 o 100 reactivos) en la llamada inicial a `/api/medico/start`.
* El backend ejecuta el algoritmo `packExamQuestions`, garantizando que las viñetas clínicas ingresen como unidades atómicas indivisibles con todas sus preguntas hermanas ordenadas por `case_order ASC`, erradicando casos mutilados o incompletos.
* Al recibir el paquete completo, la app retiene todo el examen en memoria local, eliminando llamadas de red en segundo plano y otorgando 0 ms de latencia al navegar entre preguntas.

### 2. Temporizador Reglamentario Contextual en Mobile (2 Horas / 7,200s)
* Al iniciar un Simulacro Real (`mode === 'real'` o reactivos $\ge 50$), la app activa un cronómetro regresivo de **2 horas (7,200 segundos)** con visualización `HH:MM:SS` (ej. `01:59:45`).
* **Persistencia Resiliente:** El tiempo restante se almacena en `AppStorage` y se reanuda de forma exacta ante interrupciones. Si el cronómetro llega a 0, la app finaliza y entrega automáticamente el examen.

### 3. Filtro de Modalidad en Dashboard Móvil
* En `app/(tabs)/home.tsx`, se añadió la barra horizontal de filtros por modo: `Todos`, `Rápido (10q)`, `Estudio (20q)` y `Simulacro Real`.
* Al pulsar un filtro, recarga en tiempo real `getStats({ limit: selectedModeFilter })` y `getEvolution({ limit: selectedModeFilter })`, renderizando la serie dorada `scoresReal` en `HistoricalTrendChart.tsx`.

### 4. Blindaje del Motor RAG
* **En Simulacros Reales:** RAG **100% Desactivado** tanto en Web como en la App Móvil. Los reactivos provienen exclusivamente del banco verificado en PostgreSQL (`source: 'BANK'`). El Tutor IA permanece bloqueado durante la prueba (modo ciego estricto).
* **En Exámenes Cortos (10q / 20q):** El RAG opera exclusivamente por déficit ($\text{neededCount} = \text{limit} - \text{bankCount}$) en bloques paralelos de $\le 5$ preguntas, persistiendo cada reactivo generado en PostgreSQL para auto-abastecer el banco.
