# 📚 Especificación Maestra de Arquitectura y Mapeo: Módulo Educación (Web ↔ App Móvil)

> **Documento de Verdad y Coherencia de Negocio (Single Source of Truth)**  
> **Ámbito:** Plataforma Web (`hubacademia`) ↔ Aplicación Celular (`HubDocenteApp`)  
> **Fecha de Sincronización:** Agosto 2026  
> **Regla de Oro:** Cero invención. Todo componente, endpoint, entidad y flujo móvil debe ser un reflejo exacto y adaptado de las capacidades reales existentes en el sistema web.

---

## 1. 🏛️ Estructura de las 4 Capas (Clean Architecture)

```
========================================================================================================
CAPA                   WEB (hubacademia)                                  APP (HubDocenteApp)
========================================================================================================
1. PRESENTATION        • simulator-dashboard.html / .js                   • app/(tabs)/home.tsx (Dashboard + KPIs + Modos)
                       • quiz.html / quiz.js                              • app/(tabs)/simulators.tsx (Modal Configuración)
                       • quiz-tutor.js (Chat RAG en examen)              • app/(tabs)/leaderboard.tsx (Ranking real)
                       • components.css / theme.css                       • app/quiz/index.tsx (Motor de Examen 10q/20q/60q)
                                                                          • app/quiz/results.tsx (Score + Corrección)
                                                                          • components/QuestionCard.tsx, TutorModal, etc.

2. APPLICATION         • docenteController.js                             • application/context/AuthContext.tsx
                       • checkLimitsMiddleware.js                         • application/state/quizState.ts
                       • usageMiddleware.js                               • application/hooks/useDocenteQuiz.ts

3. DOMAIN              • docenteService.js                                • domain/types/docente.ts
                       • docenteRepository.js                             • domain/services/docenteService.ts
                       • generationPrompts.js (isEducation)               • domain/models/docenteModels.ts
                       • question_bank & quiz_history schemas

4. INFRASTRUCTURE      • apiRoutes.js (/api/docente/*)                    • infrastructure/network/NetworkService.ts
                       • Supabase Client (PostgreSQL + JSONB)             • infrastructure/storage/SecureStore.ts
                       • Pinecone Namespace 'education' (RAG)             • infrastructure/api/docenteApi.ts
========================================================================================================
```

---

## 2. 🗄️ Esquema de Base de Datos Real (Supabase / PostgreSQL)

Las aplicaciones móviles e interfaces web interactúan con las mismas tablas existentes en la base de datos sin alterar ni crear tablas ficticias:

### 2.0 Tabla `case_scenarios` (Situaciones / Casuísticas Compartidas con RLS)
```sql
CREATE TABLE public.case_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,          -- 'CASO-PED-2026-01'
    title VARCHAR(255),                        -- 'Situación Pedagógica: Evaluación Formativa'
    description_text TEXT NOT NULL,            -- Enunciado común, texto de lectura o caso compartido (incluye tablas HTML de TinyMCE)
    image_url TEXT,                            -- Imagen/gráfico común (GCS o Supabase Storage)
    domain VARCHAR(50) NOT NULL DEFAULT 'education', -- 'education' | 'medicine'
    target VARCHAR(50),                        -- 'ASCENSO', 'NOMBRAMIENTO', etc.
    topic VARCHAR(100),                        -- Área de estudio común
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.case_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to case_scenarios" ON public.case_scenarios FOR SELECT USING (true);
CREATE POLICY "Allow admin manage case_scenarios" ON public.case_scenarios FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin')) WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin'));
```

### 2.1 Tabla `question_bank` (Banco Maestro de Reactivos & Encadenamiento de Casos)
```sql
CREATE TABLE public.question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) DEFAULT 'GENERAL',    -- 'education' para preguntas docentes
    target VARCHAR(255),                      -- 'ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'
    career VARCHAR(100),                      -- 'EBR - Primaria', 'EBR - Secundaria - Matemática'
    topic VARCHAR(100) NOT NULL,              -- 'Evaluación formativa y retroalimentación'
    subtopic VARCHAR(255),                    -- 'Niveles de retroalimentación reflexiva'
    difficulty VARCHAR(50) DEFAULT 'Senior',
    question_text TEXT NOT NULL,              -- Enunciado específico del reactivo
    options JSONB NOT NULL,                   -- ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"]
    correct_option_index INTEGER NOT NULL,    -- 0, 1, 2 o 3
    explanation TEXT,                         -- Justificación pedagógica oficial CNEB / MINEDU
    image_url TEXT,
    explanation_image_url TEXT,
    case_id UUID REFERENCES public.case_scenarios(id) ON DELETE SET NULL, -- Vínculo al caso compartido
    case_order INTEGER DEFAULT 1,             -- Orden secuencial dentro de la casuística (1, 2, 3...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2.2 Tabla `quiz_history` (Historial de Evaluaciones y Analítica JSONB)
```sql
CREATE TABLE public.quiz_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    target VARCHAR(50),                       -- 'ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'
    career VARCHAR(100),                      -- 'EBR - Primaria', 'EBR - Secundaria - ...'
    topic VARCHAR(100) NOT NULL,              -- 'Simulacro Docente Pro'
    difficulty VARCHAR(20) DEFAULT 'MIXTO',
    score INTEGER NOT NULL,                   -- Puntuación /20
    total_questions INTEGER NOT NULL,         -- 10, 20 o 60
    weak_points TEXT[],
    area_stats JSONB DEFAULT '{}'::jsonb,     -- {"Enfoque por competencias": {"correct": 5, "total": 6}, ...}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2.3 Tabla `user_question_history` (Ciclo de Anti-Repetición)
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
    domain VARCHAR(50) NOT NULL,             -- 'educacion'
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"target":"ASCENSO","career":"EBR - Primaria","areas":[...]}
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

## 2. 🗄️ Entidades Reales y Modelos de Datos (Dominio Educación)

### 2.1 Exámenes Objetivo Reales (`targets`)
La plataforma web soporta exclusivamente estos 3 objetivos de evaluación docente:

| Target Web | Valor Backend | Estado en Web | Descripción Real |
| :--- | :--- | :--- | :--- |
| **ASCENSO** | `'ASCENSO'` | **ACTIVO (Principal)** | Evaluación de Ascenso de Escala en la Carrera Pública Magisterial. |
| **NOMBRAMIENTO** | `'NOMBRAMIENTO'` | Próximamente / Activo | Concurso de Ingreso a la Carrera Pública Magisterial (CPM). |
| **ACCESO A CARGOS** | `'ACCESO_CARGOS'` | Beta / Directivos | Evaluación para Directores y Especialistas de UGEL/DRE. |

---

### 2.2 Modalidad y Niveles Magisteriales (`career`)
El sistema web clasifica a los docentes según su nivel y especialidad:

1. **`EBR - Nivel Inicial`** (`career = 'EBR - Inicial'`)
2. **`EBR - Nivel Primaria`** (`career = 'EBR - Primaria'`)
   - *Especialidades Primaria:* `General`, `Profesor de Innovación Pedagógica`, `Educación Física`.
3. **`EBR - Nivel Secundaria`** (`career = 'EBR - Secundaria - {Especialidad}'`)
   - *Especialidades Oficiales de Secundaria:*
     - Matemática
     - Comunicación
     - Ciencias Sociales
     - Ciencia y Tecnología
     - Desarrollo Personal, Ciudadanía y Cívica
     - Educación Física
     - Educación Religiosa
     - Educación para el Trabajo
     - Arte y Cultura
     - Inglés como Lengua Extranjera
     - Profesor de Innovación Pedagógica

---

### 2.3 Áreas y Tópicos Pedagógicos Oficiales (Por Target)

#### A. Para Target `ASCENSO` (Grupos de Estudio):
1. **Enfoques y Principios del CNEB:**
   - *Enfoque por competencias*
   - *Enfoques transversales*
   - *Principios de la educación peruana*
2. **Teorías y Procesos del Aprendizaje:**
   - *Constructivismo y socioconstructivismo*
   - *Aprendizajes significativos*
   - *Activación y recojo de saberes previos*
   - *Conflicto o disonancia cognitiva y demanda cognitiva*
   - *Procesos auxiliares del aprendizaje*
3. **Planificación y Evaluación:**
   - *Planificación pedagógica*
   - *Evaluación formativa y retroalimentación*
4. **Clima Escolar e Inclusión:**
   - *Convivencia democrática y clima de aula*
   - *Educación inclusiva y DUA*
   - *Características y desarrollo del estudiante*

#### B. Para Target `NOMBRAMIENTO`:
1. **Habilidades Generales:**
   - *Comprensión Lectora*
   - *Razonamiento Lógico*
2. **Conocimientos Pedagógicos y Curriculares:**
   - *Teorías del Aprendizaje y Desarrollo*
   - *Principios del Currículo Nacional (CNEB)*
   - *Planificación Curricular (PCI, PCA, Unidades)*
   - *Evaluación Formativa y Retroalimentación*
   - *Convivencia Escolar y Clima de Aula*
   - *Principios de la Educación Peruana*

#### C. Para Target `ACCESO_CARGOS`:
1. **Gestión Institucional:**
   - *Liderazgo Pedagógico*
   - *Planificación Estratégica (PEI, PAT)*
   - *Gestión del Riesgo de Desastres*
   - *Monitoreo y Acompañamiento*

---

### 2.4 Modos de Configuración de Examen
En la web existen dos modos de configuración:
1. **Modo Examen Oficial (`default`)**: Integra todas las áreas de forma equilibrada según el target seleccionado (Recomendado).
2. **Práctica Personalizada (`custom`)**: Permite al usuario marcar/desmarcar con checkboxes las áreas específicas que desea ejercitar.

---

### 2.5 Modos de Entrenamiento Reales
El simulador ofrece 3 modalidades concretas:

| Modo | Cantidad Preguntas | Comportamiento en Examen | Justificación / Feedback |
| :--- | :--- | :--- | :--- |
| ⚡ **Simulacro Rápido** | **10 preguntas** | Feedback visual inmediato al pulsar opción (Azul/Rojo). Auto-avance rápido. | Explicación profunda reservada para la revisión final. |
| 📚 **Modo Estudio** | **20 preguntas** | Enfoque formativo pausado. Muestra acierto/error y despliega la caja de justificación. | **Explicación pedagógica oficial en cada pregunta** + Botón **Tutor IA**. |
| 🎯 **Simulacro Real** | **60 preguntas** *(Educación)* / 100 *(Salud)* | "Modo Ciego" con cronómetro global oficial. Sin feedback intermedio. | Corrección completa y detallada al finalizar el examen. |

---

## 3. 🔌 Especificación de Endpoints de la API Backend

Todos los endpoints residen bajo el prefijo `/api/docente/*`:

### 3.1 `POST /api/docente/start`
Inicia un nuevo simulacro pedagógico.
- **Headers:** `Authorization: Bearer <jwt>`
- **Body:**
```json
{
  "target": "ASCENSO",
  "career": "EBR - Primaria",
  "areas": ["Enfoque por competencias", "Evaluación formativa y retroalimentación"],
  "round": 1,
  "limit": 10,
  "difficulty": "MIXTO",
  "mode": "study"
}
```
- **Respuesta:**
```json
{
  "success": true,
  "topic": "Enfoque por competencias",
  "areas": ["Enfoque por competencias", "Evaluación formativa y retroalimentación"],
  "round": 1,
  "questions": [
    {
      "id": "uuid-1234",
      "question": "En una sesión de aprendizaje...",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correct_option_index": 1,
      "explanation": "💡 TIP PEDAGÓGICO: Según el CNEB...",
      "topic": "Evaluación formativa y retroalimentación",
      "area": "Planificación y Evaluación"
    }
  ],
  "isPremium": true,
  "source": "BANK"
}
```

---

### 3.2 `POST /api/docente/next-batch`
Carga el siguiente lote de preguntas durante un simulacro largo evitando repeticiones.
- **Body:**
```json
{
  "target": "ASCENSO",
  "career": "EBR - Primaria",
  "areas": ["..."],
  "seenIds": ["uuid-1234", "uuid-5678"],
  "difficulty": "MIXTO",
  "mode": "study"
}
```

---

### 3.3 `POST /api/docente/submit`
Registra el puntaje y las respuestas detalladas del examen para analíticas y radar.
- **Body:**
```json
{
  "topic": "Simulacro Magisterial",
  "areas": ["Enfoque por competencias", "Planificación pedagógica"],
  "target": "ASCENSO",
  "career": "EBR - Primaria",
  "difficulty": "MIXTO",
  "score": 16.0,
  "correct_answers_count": 8,
  "total_questions": 10,
  "questions": [
    {
      "id": "uuid-1234",
      "question": "...",
      "options": ["..."],
      "correct_option_index": 1,
      "userAnswer": 1,
      "isCorrect": true,
      "explanation": "...",
      "topic": "Evaluación formativa",
      "area": "Planificación y Evaluación"
    }
  ]
}
```

---

### 3.4 `GET /api/docente/stats`
Obtiene las métricas de rendimiento y el análisis por áreas.
- **Query Params:** `context=EDUCACION&target=ASCENSO&days=30&limit=all&career=EBR+-+Primaria`
- **Respuesta:**
```json
{
  "success": true,
  "kpis": {
    "avg_score": "14.5",
    "accuracy": 72,
    "total_correct": 145,
    "total_incorrect": 55,
    "mastered_cards": 12,
    "strongest_topic": "Enfoque por competencias",
    "weakest_topic": "Características y desarrollo del estudiante",
    "radar_data": [
      { "subject": "Enfoque por competencias", "accuracy": 88, "correct": 42, "total": 48 },
      { "subject": "Constructivismo y socioconstructivismo", "accuracy": 75, "correct": 36, "total": 48 },
      { "subject": "Planificación pedagógica", "accuracy": 68, "correct": 32, "total": 47 },
      { "subject": "Evaluación formativa y retroalimentación", "accuracy": 62, "correct": 28, "total": 45 },
      { "subject": "Convivencia democrática y clima de aula", "accuracy": 55, "correct": 22, "total": 40 },
      { "subject": "Características y desarrollo del estudiante", "accuracy": 50, "correct": 20, "total": 40 }
    ],
    "isGuest": false
  }
}
```

---

### 3.5 `GET /api/docente/evolution`
Obtiene la serie temporal para graficar la curva de aprendizaje.
- **Query Params:** `context=EDUCACION&target=ASCENSO&days=30`
- **Respuesta:**
```json
{
  "success": true,
  "chart": {
    "labels": ["01/08", "04/08", "08/08", "11/08"],
    "scores10": ["14.0", null, "16.0", "18.0"],
    "scores20": [null, "15.0", null, null],
    "scoresReal": [null, null, null, null],
    "scores": ["14.0", "15.0", "16.0", "18.0"]
  }
}
```

---

### 3.6 `GET /api/docente/leaderboard`
Obtiene la tabla de clasificación magisterial.
- **Respuesta:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "user_id": "uuid-abc",
      "name": "Prof. Carlos Mendoza",
      "avatar_url": "...",
      "career": "EBR - Primaria",
      "avg_score": 17.8,
      "total_quizzes": 24,
      "rank": 1
    }
  ]
}
```

---

### 3.7 `POST /api/chat` (Tutor IA Pedagógico)
Consulta al tutor inteligente contextualizado en la casuística pedagógica.
- **Body:**
```json
{
  "message": "¿Por qué la alternativa B es conductista y la C es constructivista?",
  "context": "quiz_tutor",
  "examContext": "EDUCACION",
  "target": "ASCENSO",
  "career": "EBR - Primaria",
  "questionData": {
    "question": "En una sesión...",
    "options": ["A", "B", "C", "D"],
    "correct_option_index": 2,
    "userAnswer": 1,
    "explanation": "..."
  }
}
```

---

## 4. 📱 Mapeo y Adaptación a la App Celular (`HubDocenteApp`)

Para replicar con precisión las funcionalidades de la web en la aplicación móvil:

### 4.1 Pantalla Principal (`app/(tabs)/home.tsx`)
- **Cabecera**: Saludo dinámico con nombre del docente y badge de estado de cuenta.
- **Tarjeta de Configuración Activa**: Muestra el Target (`Ascenso`, `Nombramiento`), Nivel (`EBR Primaria`, etc.) y botón *"Configurar Examen"*.
- **Tarjetas de Modos de Entrenamiento (Grid de Modos):**
  1. ⚡ **Simulacro Rápido (10q)**: Inicio directo a `/quiz?mode=arcade&limit=10`.
  2. 📚 **Modo Estudio (20q)**: Inicio directo a `/quiz?mode=study&limit=20`.
  3. 🎯 **Simulacro Real (60q)**: Inicio a `/quiz?mode=real&limit=60` con temporizador oficial.
- **Resumen de Progreso (KPIs):**
  - Tabs de filtrado: Modo (`Todos`, `10q`, `20q`) y Tiempo (`Histórico`, `30 días`, `7 días`).
  - Cajas de KPI: Puntuación Promedio (`14.5 / 20`), Precisión Global (`72%`), Aciertos/Errores (`145 / 55`).
- **Diagnóstico Pedagógico:**
  - Gráfico de barras de Dominio por Áreas Pedagógicas (CNEB, Teorías, Planificación/Evaluación, Clima Escolar).
  - Tópico más fuerte (`strongest_topic`) y Tópico más débil (`weakest_topic`).

---

### 4.2 Pantalla de Configuración (`app/(tabs)/simulators.tsx`)
- **Sección 1: Examen Objetivo**:
  - `ASCENSO` (Activo - Recomendado)
  - `NOMBRAMIENTO`
  - `ACCESO A CARGOS`
- **Sección 2: Modalidad / Nivel**:
  - `EBR - Nivel Inicial`
  - `EBR - Nivel Primaria`
  - `EBR - Nivel Secundaria` (con selector de especialidades: Matemática, Comunicación, Ciencias Sociales, Ciencia y Tecnología, etc.).
- **Sección 3: Modo de Configuración**:
  - `Modo Examen Oficial` (Todas las áreas integradas de forma equilibrada).
  - `Práctica Personalizada` (Selección manual por grupos de áreas pedagógicas con checkboxes).
- **Botón Aplicar Configuración**: Persiste la configuración en almacenamiento local (`AsyncStorage`) y en el backend si el usuario está autenticado.

---

### 4.3 Motor de Examen Móvil (`app/quiz/index.tsx`)
- **Cabecera**: Contador de progreso (`X / Total`), barra de avance, botón de salida con confirmación.
- **Tarjeta de Casuística Pedagógica (`QuestionCard.tsx`)**:
  - Badge del área/tema pedagógico.
  - Enunciado claro con formato.
  - Opciones de respuesta táctiles (A, B, C, D) con letras distintivas.
- **Interacción por Modalidad:**
  - **En Modo Rápido (10q)**: Al tocar una opción, se resalta inmediatamente (verde si es correcta, rojo si es incorrecta) y se activa el botón "Siguiente".
  - **En Modo Estudio (20q)**: Al tocar, además de resaltar, se abre la caja de **Justificación Pedagógica CNEB** y el botón **"Tutor IA"**.
  - **En Simulacro Real (60q)**: Marca la opción seleccionada sin revelar si es correcta o errónea y pasa a la siguiente pregunta.
- **Drawer / Modal de Tutor IA (`TutorModal.tsx`)**:
  - Permite chatear con el Tutor IA pedagógico enviando la pregunta actual y recibiendo respuestas instantáneas basadas en RAG.

---

### 4.5 🎨 Renderizado de Markdown, Sanitización HTML e Imágenes Universales (`RichMarkdown` & `MediaUrlResolver`)
- **Sanitización Profunda de HTML**: Procesa y limpia automáticamente etiquetas como `<p>`, `</p>`, `<br>`, `<strong>`, `<b>`, `<i>`, `<em>`, `<li>` y entidades HTML (`&nbsp;`, `&quot;`, `&#39;`, `&aacute;`, etc.), eliminando etiquetas crudas y convirtiéndolas en texto estructurado con espaciado natural de párrafos.
- **Resolución Universal de Imágenes**: Soporta URLs absolutas y rutas relativas de Google Cloud Storage (GCS) a través del proxy `${API_URL}/api/media/gcs?file=...`.
- **Imágenes en Casuística y Justificación**: Renderizado tanto de `image_url` en la pregunta como de `explanation_image_url` en la caja de sustento pedagógico y en el feed de revisión de resultados con visor lightbox interactivo.

---

### 4.6 🧠 Tutor Pedagógico IA (`TutorModal.tsx` / `CHAT_IA_TECH_SPECS.md`)
- **Activación Exclusiva Post-Respuesta**: El botón y chip del Tutor IA (`✨ Tutor IA` / `✨ Preguntar al Tutor IA`) se habilitan y muestran **únicamente cuando el usuario ya ha seleccionado una alternativa**, evitando pistas previas durante el examen.
- **Integración con `/api/chat`**:
  - Enrutamiento con `specialization: 'education'`, `target: 'ASCENSO' | 'NOMBRAMIENTO'`, `examContext: 'EDUCACION'`.
  - Inyección de contexto completo de la pregunta actual (`questionText`, `options`, `correctOptionText`, `userOptionText`, `isUserCorrect`, `explanation`, `topic`, `career`).
  - Historial de sesión efímero (`history: [{ sender: 'user' | 'bot', content: '...' }]`).
- **Sugerencias Rápidas Interactivas (`sugerencias`)**: Chips clicables encima del campo de entrada para consultas instantáneas.

---

### 4.7 💾 Persistencia de Exámenes en Progreso, Reanudación e Interrupción (`ResumeQuizModal` & `ExitQuizModal`)
- **Auto-Guardado Continuo (`simulator_active_session_*`)**: Guarda el progreso (preguntas, respuestas marcadas, índice actual) en `AppStorage` ante interrupciones o salidas accidentales.
- **Modal de Reanudación (`ResumeQuizModal.tsx`)**: Al reingresar a un simulacro en progreso (< 24h), pregunta al usuario si desea *"Continuar Examen"* (ubicándolo en la primera pregunta pendiente) o *"Iniciar Nuevo"* (descartando la sesión previa).
- **Interrupción In-App Multiplataforma (`ExitQuizModal.tsx`)**: Al pulsar la 'X' en Web o Móvil, ofrece *"Guardar y Salir"*, *"Continuar Examen"* o *"Descartar progreso y salir"*.
- **Limpieza Atómica al Culminar**: Al finalizar el examen (`finishQuiz`), la sesión activa se elimina y el resultado se sincroniza en PostgreSQL o almacenamiento local de demo.

---

### 4.7 🔐 Autenticación Exclusiva Google OAuth SSO (`app/(auth)/login.tsx` & `AuthContext.tsx`)
- **Paridad 100% con `login.html`**: Se eliminaron formularios redundantes de correo/contraseña. El acceso se realiza exclusivamente mediante el botón Cápsula oficial de Google (`Continuar con Google`).
- **Flujo Multiplataforma sin Bloqueos COOP**:
  - **En Web**: Redirección directa vía `signInWithOAuth` + detección automática de token hash (`detectSessionInUrl: true`), evitando errores de Cross-Origin-Opener-Policy (`window.closed`).
  - **En Móvil (iOS/Android)**: Flujo in-app con `openAuthSessionAsync` y captura de deep link `hubdocente://google-auth`.
- **Sincronización Atómica y KPIs**: Al autenticar y al finalizar un examen, se ejecuta `POST /api/auth/sync`, `GET /api/auth/me` y `POST /api/docente/submit` para registrar atómicamente el historial en `quiz_history` con `area_stats` y actualizar las KPIs del Dashboard (`/api/docente/stats`).
- **Estructura de Rutas Limpia en Expo Router**: Jerarquía con `(auth)/_layout.tsx`, `quiz/_layout.tsx`, `(tabs)/_layout.tsx` y `+not-found.tsx` previniendo errores de "Unmatched Route".
- **Modo Demo Inmediato**: Botón *"Explorar Modo Demo Gratuito"* para acceso directo sin login.

---

### 4.8 Ranking Magisterial (`app/(tabs)/leaderboard.tsx`)
- Lista de los mejores promedios docentes obtenidos en simulacros reales, con posición, avatar, nombre, nivel/especialidad y promedio vigesimal.

---

### 4.9 ⚙️ Configuración Obligatoria Pre-Simulacro, Filtrado Estricto por Nivel y Sincronización en BD (`ExamConfigModal` & `/api/users/preferences`)
- **Configuración Obligatoria Pre-Examen**: Ningún usuario (visitante o registrado) puede iniciar un simulacro sin una configuración activa. Si el usuario no tiene una configuración guardada, el modal de configuración (`ExamConfigModal.tsx`) se abre automáticamente antes de iniciar la prueba.
- **Selector de Nivel y Especialidad Magisterial (`career`)**:
  - `EBR - Nivel Inicial` (`career = 'EBR - Inicial'`)
  - `EBR - Nivel Primaria` (`career = 'EBR - Primaria'`)
  - `EBR - Nivel Secundaria` (`career = 'EBR - Secundaria - {Especialidad}'`) con selector horizontal de especialidades (Matemática, Comunicación, Ciencias Sociales, Ciencia y Tecnología, etc.).
- **Filtrado Estricto en Base de Datos (Eliminación de Cruce de Niveles)**:
  - En `POST /api/docente/start` y `GET /api/docente/demo`, se envía estrictamente el parámetro `career` (`EBR - Inicial`, `EBR - Primaria`, etc.).
  - En el backend (`docenteRepository.js`), las consultas a `question_bank` aplican el filtro estricto:
    `WHERE domain = 'education' AND target = $target AND (career IS NULL OR career = $career)`
  - Evita que aparezcan casuísticas de Secundaria a un docente de Inicial o Primaria.
- **Sincronización con PostgreSQL (`user_simulator_preferences`)**:
  - `GET /api/users/preferences?domain=education`: Carga las preferencias guardadas del usuario en la base de datos al abrir la app o dashboard.
  - `POST /api/users/preferences`: Upsert en `user_simulator_preferences` del payload `{ domain: 'education', config_json: { target, career, configMode, areas, difficulty } }`.
  - Persistencia local en `AppStorage` (`simActiveConfig_educacion`) para visitantes y soporte offline.
- **Banner de Filtro Activo y KPIs en Dashboard (`home.tsx`)**:
  - Muestra badges interactivos con el Target activo, Nivel docente, y Áreas seleccionadas junto al botón `[⚙️ Configurar]`.
  - Las métricas de promedio, precisión, aciertos, debilidades/fortalezas y el gráfico de barras por competencias CNEB se sincronizan y filtran dinámicamente según el Target y Nivel activo del docente.

---

### 4.10 📈 Gráfico de Tendencia Histórica y Métricas Agrupadas por Competencias (`HistoricalTrendChart` & `PedagogicalBarChart`)
- **Tendencia Histórica en Línea (`HistoricalTrendChart.tsx`)**: Visualiza la evolución de los puntajes vigesimales (0 a 20) a lo largo de las sesiones mediante curvas SVG diferenciadas para *Modo Rápido (10q)*, *Modo Estudio (20q)* y *Simulacros Reales (60q)*, junto con la línea de corte aprobatoria MINEDU (14.0 pts).
- **Dominio Curricular por Grupos CNEB**: El gráfico de barras agrupa las áreas evaluadas en sus macro-competencias oficiales (*Enfoques y Principios del CNEB*, *Teorías y Procesos del Aprendizaje*, *Planificación y Evaluación*, *Clima Escolar e Inclusión* para Ascenso; *Habilidades Generales*, *Conocimientos Pedagógicos y Curriculares* para Nombramiento), mostrando el porcentaje de precisión por área y el promedio global del grupo.

---

### 4.11 🖼️ Parser de Imágenes Embebidas TinyMCE y Tablas Curriculares (`RichMarkdown.tsx`)
- **Imágenes Embebidas en TinyMCE (`<img>` / `![]()`)**: Detección y extracción de etiquetas `<img>` intercaladas en el texto de las casuísticas, resolución de URLs mediante el proxy GCS o rutas absolutas, y visualización responsiva con visor interactivo Modal Lightbox para ampliar detalles (como lecturas de cuentos o infografías).
- **Tablas Responsivas (`<table>` / Markdown Tables)**: Soporte completo para cuadros comparativos y matrices pedagógicas en HTML y Markdown, renderizados en un contenedor con desplazamiento horizontal suave, cabeceras destacadas (`<th>`) y filas alternadas (`<tr>`).
- **Navegación Móvil Limpia (2 Tabs)**: Estructura de barra inferior simplificada con solo 2 pestañas: **Inicio** (`home`) y **Mi Perfil** (`profile`).

---

### 4.12 🎯 Retroalimentación por Modos de Examen, Paleta Oficial Azul/Rojo y Protección de Tutor IA
- **Paleta Oficial de Retroalimentación**:
  - **Acierto / Clave Correcta**: **AZUL** (`#3b82f6` / `#2563eb` / `rgba(59, 130, 246, 0.18)`), idéntico al estándar de la plataforma web.
  - **Error / Clave Incorrecta**: **ROJO** (`#ef4444` / `#dc2626` / `rgba(239, 68, 68, 0.18)`).
  - **Selección Neutra (Simulacros Reales)**: Resaltado neutro (`rgba(255, 255, 255, 0.12)`) sin desvelar acierto o error.
- **Comportamiento por Modos de Examen**:
  - **Modo Rápido (10q)**: Entrega feedback visual inmediato de acierto/error en **AZUL / ROJO** al marcar una opción. NO despliega la caja de texto explicativo ni el botón del Tutor IA durante el examen para mantener un ritmo ágil. Al culminar, la pantalla de **Revisión del Examen** presenta todas las justificaciones pedagógicas CNEB y activa el Tutor IA.
  - **Modo Estudio Formativo (20q)**: Entrega feedback inmediato en **AZUL / ROJO**, despliega la caja de justificación curricular oficial CNEB y habilita el botón del Tutor Pedagógico IA de forma instantánea.
  - **Simulacros Reales (60q / 100q)**: Selección neutra sin feedback de color ni explicaciones durante la prueba. Toda la retroalimentación se revela al culminar en la pantalla de revisión.
- **Tutor Pedagógico IA Sanitizado y Protección Demo**:
  - Interfaz sin etiquetas comerciales del modelo (`Gemini 3.1 Flash Lite` en backend).
  - Sanitizador `extractCleanAiText` que erradica JSON crudo, llaves residuales y escapes literales `\n`.
  - **Protección Visitantes / Demo**: Los usuarios no autenticados o en modo demo visualizan una tarjeta Glassmorphism de invitación a registrarse de forma gratuita para desbloquear consultas de tutoría y guardar su evolución.
- **Tiers Oficiales y RAG Pinecone**:
  - Tiers del sistema: `free`, `basic`, `advanced` (y `admin`). No existe el tier `elite`.
  - El motor de recuperación semántica Pinecone se activa de forma exclusiva para usuarios `advanced` y `admin` (hasta 25 msgs/día).
- **Tendencia Histórica con Datos 100% Reales**:
  - `HistoricalTrendChart.tsx` renderiza estrictamente los datos existentes en PostgreSQL (`quiz_history`).
  - Eliminados todos los arreglos simulados hardcodeados. Si el usuario no registra simulacros para un filtro o modo, se presenta un Estado Vacío elegante ("Sin historial registrado").

---

### 4.13 ☀️ Rediseño Integral a Tema Claro Magisterial, Política de Registro y Estado de Concursos (Actualización Agosto 2026)
- **Tema Claro de Alto Rendimiento Visual**:
  - Paleta base: fondo `#f8fafc`, tarjetas `#ffffff` con sombras suaves multiplataforma, bordes `#e2e8f0` / `#c7d2fe`, primario índigo/azul-morado (`#4f46e5` a `#4338ca`), acento suave (`#6366f1` / `#eef2ff`), dorado CNEB (`#f59e0b` / `#fffbeb`) y tipografía oscura legible `#0f172a` y `#64748b`.
  - Reemplazo completo de componentes oscuros a tema claro: `QuestionCard.tsx`, `TutorModal.tsx`, `ExamConfigModal.tsx`, `HistoricalTrendChart.tsx`, `PedagogicalBarChart.tsx`, `RichMarkdown.tsx`, `ExitQuizModal.tsx`, `ResumeQuizModal.tsx`, `login.tsx`, `profile.tsx`, `pricing.tsx`, `terms-and-conditions.tsx` y `privacy-policy.tsx`.
- **Eliminación de Demo Mode en Móvil y Redirección Instantánea**:
  - Se eliminó la pantalla splash redundante con botón demo (`index.tsx`).
  - La aplicación redirige de inmediato a `/(tabs)/home` si existe sesión activa o a `/(auth)/login` si el usuario no está autenticado, incentivando el registro para guardar analíticas y progreso.
- **Disponibilidad de Concursos Magisteriales**:
  - `ASCENSO`: Concurso activo y habilitado para simulación.
  - `NOMBRAMIENTO` y `ACCESO A CARGOS`: Marcados con badge "Pronto" y deshabilitados temporalmente en el selector de convocatorias.

---

### 4.14 🔄 Ciclo de Vida de Preguntas (24h), Paginación por Lotes y Normalización de Filtros
- **Paginación Reactiva por Lotes (`/api/docente/start` & `/api/docente/next-batch`)**:
  - Al iniciar un simulacro, la aplicación solicita un primer lote de 5 preguntas balanceadas (`Math.min(5, totalLimit)`).
  - Conforme el docente avanza en la prueba, el cliente solicita automáticamente el siguiente lote con `DocenteService.getNextBatch` enviando los `seenIds` acumulados en la sesión para evitar repeticiones internas.
- **Ciclo Anti-Repetición de 24 Horas (`user_question_history`)**:
  - Al enviar las respuestas mediante `POST /api/docente/submit`, el backend actualiza `user_question_history` marcando cada pregunta con `seen_at = NOW()` y `times_seen = times_seen + 1`.
  - Durante las siguientes 24 horas, `docenteRepository.findQuestionsInBankBatch` excluye automáticamente esas preguntas (`seen_at > NOW() - INTERVAL '24 hours'`), garantizando que el usuario siempre reciba casuísticas frescas.
  - Al día siguiente (transcurridas 24 horas), las preguntas vuelven a estar disponibles automáticamente en el pool del docente.
- **Normalización de Dificultad y Resiliencia Backend**:
  - Los filtros generales como `'MIXTO'`, `'TODOS'`, `'ALL'` o `'DEFAULT'` son normalizados para no restringir indebidamente el banco (`question_bank`).
  - Si la reposición RAG de IA experimenta demoras o indisponibilidad en el servidor, el servicio entrega las preguntas disponibles del banco (`balancedBatch`) como fallback seguro sin interrumpir la experiencia de examen del docente.

---

### 4.15 🛡️ Gestión Robusta de Modales, Botón Retroceso (Hardware BackHandler) y Persistencia del Chat IA
- **Cierre Táctil por Backdrop y Botón Físico (`onRequestClose` / `BackHandler`)**:
  - **Modales Auxiliares (`TutorModal`, `ExamConfigModal`, `Lightbox`)**: Incorporan un backdrop interactivo que se cierra inmediatamente al tocar fuera del contenedor y responden al botón físico o gesto de retroceso del dispositivo móvil cerrando la modal sin alterar la pantalla de fondo.
  - **Modales Críticas (`ExitQuizModal`, `ResumeQuizModal`)**: Requieren una selección explícita por parte del usuario para evitar pérdidas accidentales de progreso. Al presionar retroceso en `ExitQuizModal`, se cancela la salida y se retoma la prueba; en `ResumeQuizModal`, se regresa con seguridad al dashboard.
- **Flujo de Retroceso Inteligente durante el Examen (`quiz/index.tsx`)**:
  - Si una modal (Tutor, Lightbox, Salida) está abierta, el retroceso cierra dicha modal.
  - Si `currentIndex > 0`, el retroceso navega a la pregunta inmediatamente anterior (`handlePrevious()`).
  - Si `currentIndex === 0` (primera pregunta), el retroceso abre la modal de pausa/salida segura (`ExitQuizModal`), evitando la salida accidental sin guardar.
  - En la pantalla de resultados (`results.tsx`), el retroceso redirige limpiamente a la pantalla de inicio (`/(tabs)/home`).
- **Persistencia de Conversación con el Tutor IA por Casuística**:
  - Al consultar al Tutor IA y cerrar o minimizar la modal, el historial de mensajes permanece intacto en memoria para esa misma pregunta.
  - El estado del chat se reinicializa únicamente cuando el docente pasa a una casuística diferente (`question.id` distinto).
  - Sanitizador `stripHtml` integrado en la cabecera del Tutor para limpiar etiquetas `<p>` o `<img>` residuales y renderizar resúmenes limpios.

---

### 4.16 🎯 Visibilidad de Botón 'X', Mensajes de Progreso Exactos (1/10, 1/20) y Aislamiento Estricto por Modalidad
- **Alto Contraste y Visibilidad del Botón 'X' de Salida**:
  - El botón de cierre en cabecera (`exitBtn`) fue optimizado con contenedor circular blanco (`#ffffff`), borde sólido (`#cbd5e1`), sombra de elevación e icono oscuro de 22px (`DocentePalette.textPrimary` `#0f172a`), garantizando 100% de legibilidad en tema claro.
- **Mensajes de Progreso Transparentes y Exactos en Modales**:
  - `ResumeQuizModal`: Muestra una redacción concisa sin redundancias: *"Tienes un simulacro de **{targetExam}** (**{modeName}**) en progreso donde respondiste **{answeredCount} de {totalQuestions}** preguntas."* (ej. 3 de 20 preguntas).
  - `ExitQuizModal`: Informa al docente el estado exacto de avance: *"Vas en la pregunta **{currentQuestionNumber} de {totalQuestions}** (**{answeredCount}** respondidas). Tu progreso se guardará automáticamente..."*.
- **Aislamiento de Sesiones por Modalidad (Rápido 10q, Estudio 20q, Real 60q)**:
  - Al iniciar un simulacro de diferente modalidad (ej. cambiar de 10qs a 20qs), el sistema valida la coincidencia de `mode`, `target` y `totalLimit`. Si no coinciden, descarta la sesión previa y genera un examen limpio de 20 preguntas, evitando que se mezclen preguntas de distintas modalidades y garantizando el guardado correcto de analíticas en la base de datos al finalizar.

---

### 4.18 🧠 Diagnóstico Inteligente Multi-Tier & Principio de Sobriedad Visual (`AIDiagnosisCard.tsx` & `/api/analytics/diagnostic`)
- **Integración de Diagnóstico en App Móvil (`AIDiagnosisCard.tsx`)**:
  - Ubicado en `app/(tabs)/home.tsx`, permite al docente extraer un informe estructurado de rendimiento pedagógico basado en sus simulacros reales.
  - **Índice de Preparación Oficial (`Readiness Index %`)**: Visualiza un score ponderado de efectividad correlacionado con la escala vigesimal y badge de competencia (`Sobresaliente`, `Competente`, `En Desarrollo`, `Inicial`).
  - **Fortalezas y Oportunidades de Mejora**: Tarjetas analíticas con conteo de reactivos correctos/fallados y sustento normativo oficial CNEB/MINEDU renderizadas mediante `RichMarkdown.tsx`.
  - **Píldora High-Yield Oficial (Exclusiva Plan Avanzado)**: Consejo doctrinal oficial renderizado con fondo suave `#eff6ff`, borde `#bfdbfe` y acento en Azul Cobalto (`#3b82f6` / `#2563eb`).
  - **Sprint Táctico en 3 Pasos**: Ruta accionable estructurada (Refuerzo Conceptual, Modo Estudio 20q y Velocidad en 10q).
- **Paleta Cromática Unificada (Cero Efecto Arcoíris)**:
  - En sincronía con la plataforma web, se eliminaron los colores estridentes/no contextuales (púrpuras `#8b5cf6`, amarillos `#fde68a`, etc.).
  - Todos los elementos visuales del diagnóstico (`tierBadgeAdvanced`, `highYieldBox`, `sprintBadge`, `upgradeCallout`, `extractBtn`, `readinessNumber`) utilizan la paleta pedagógica Azul Cobalto (`#3b82f6`), garantizando elegancia y máxima sobriedad docente.
- **Gestión de Cuotas y Vidas en Móvil**:
  - **Cuentas Free**: Consume 1 vida semanal al generar el diagnóstico, dispara el toast flotante `LifeToast` (`⚡ 1 vida utilizada en diagnóstico. Te quedan X vidas.`) y sincroniza el perfil con `refreshProfile()`. Si las vidas llegan a 0, despliega la alerta con acceso a `/pricing`.
  - **Plan Básico**: Diagnóstico heurístico estático ilimitado (0 tokens de IA).
  - **Plan Avanzado / Admin**: Auditoría cognitiva profunda con **Motor de IA Avanzado (Google Cloud Vertex AI)** (consumiendo 1 token diario).
- **Iconografía Sobria y Minimalista (Sin Icon Clutter)**:
  - En cumplimiento de `DESIGN_SYSTEM.md`, la interfaz móvil evita el exceso de iconos decorativos, dando protagonismo a la tipografía clara (`Inter`), espaciados limpios y jerarquía visual esbelta.
- **Diferenciación Móvil**: En la app móvil no existe modo demo ni el gráfico de dona "Distribución por Áreas", conservando una experiencia nativa directa y enfocada.

---



## 📱 5. Implementación en Aplicaciones Móviles (HubSaludApp y HubDocenteApp)

Para mantener paridad total de experiencia entre la plataforma Web y las aplicaciones móviles nativas (React Native / Expo):

### 1. Componente `UserGuideModal.tsx`
* **Arquitectura:** Modal con fondo Blur/Glassmorphism y contenedor GlassCard (`maxWidth: 400`).
* **Navegación:** Carrusel de 3 pasos con dots interactivos y botones `← Anterior` y `Siguiente →` / `¡Comenzar! 🚀`.
* **Disparadores:**
  * **Manual:** Botón `? Guía` estilizado en el banner de configuración activa (`home.tsx`), a la izquierda de `Configurar`.
  * **Automático:** Almacenamiento seguro en `AppStorage` (`hasSeenSimulatorGuide_salud` / `hasSeenSimulatorGuide_docente`) para mostrarlo al usuario únicamente en su primer inicio de sesión.

### 2. Componente `KpiInfoModal.tsx`
* **Interactividad en Dashboard:** Al pulsar sobre cualquier tarjeta de KPI o cabecera de gráfico, se abre una modal semántica con:
  1. Definición clara de la métrica (Puntaje Vigesimal, Precisión %, Diagnósticos/Casos Correctos, Errores).
  2. Fórmula matemática de cálculo.
  3. Recomendación formativa y metas mínimas requeridas según el concurso oficial (SERUMS / ENAM / Residentado en Salud; Nombramiento / Ascenso en Docente).

### 3. Sincronización de 10 Vidas de Prueba
* El pool de prueba gratuito para usuarios `free / pending` está unificado en **10 vidas** en todo el frontend móvil (`AuthContext.tsx`, `profile.tsx`, `ScreenHeader.tsx`, `terms-and-conditions.tsx`).
* Notificaciones flotantes no invasivas con `LifeToast.tsx` (`⚡ 1 crédito utilizado. Te quedan X/10 vidas de prueba`).

---

## 🧪 6. Criterios de Aceptación y Calidad (QA)

- [x] **Botón Guía Horizontal:** En Web y Móvil, el botón `Guía` se sitúa junto a `Configurar Examen`, sin desbordes.
- [x] **Jerarquía en Header:** Menú de usuario sin etiquetas duplicadas del plan.
- [x] **Miniguía en Repaso:** Tour de 3 pasos en el Dashboard de Repaso y de 4 pasos dentro del mazo.
- [x] **Guía Móvil Nativa:** Modal interactiva de 3 pasos (`UserGuideModal.tsx`) en `HubSaludApp` y `HubDocenteApp`.
- [x] **Tooltips Interactivos de KPIs Móviles:** Modal explicativa (`KpiInfoModal.tsx`) al tocar cualquier tarjeta de KPI o gráfico.
- [x] **Alerta Única de Vida:** El toast de descuento de vida se dispara exactamente una vez al iniciar simulacro o estudiar un mazo.
- [x] **Modal de Resultados Armonioso:** Espaciado limpio entre *"Ver Corrección del Examen"* y los botones secundarios.
- [x] **Avatar Hubi en Revisión:** Botón de Tutor IA en revisión de examen con icono y avatar de Hubi.
- [x] **Pruebas Unitarias y Tipado:** 19 suites Jest (149/149 tests en verde) y TypeScript sin errores (`0 errors`).

---

## 🚀 7. Sincronización Móvil de Simulacro Real, Método B y Blindaje RAG (Septiembre 2026)

Para consolidar la misma robustez técnica en **Hub Educación App (`HubDocenteApp`)** y **Hub Salud App (`HubSaludApp`)**:

### 1. Carga Total Atómica (Método B) en Mobile
* `app/quiz/index.tsx` solicita directamente el tamaño total del examen (`limit: totalLimit`: 10, 20 o 60 en Docente; 10, 20 o 100 en Salud) en la llamada inicial a `/api/docente/start`.
* El backend ejecuta el algoritmo `packExamQuestions`, asegurando que las casuísticas pedagógicas y viñetas clínicas ingresen como unidades atómicas indivisibles, erradicando casos cortados a la mitad.
* Al recibir el paquete completo, la app almacena todo el examen en memoria local, eliminando llamadas innecesarias en segundo plano y permitiendo realizar la prueba offline o ante intermitencias de red.

### 2. Temporizador Reglamentario Contextual en Mobile
* Al iniciar un Simulacro Real (`mode === 'real'` o reactivos $\ge 50$):
  * **Hub Educación:** Cronómetro regresivo oficial de **3 horas (10,800 segundos)** con visualización `HH:MM:SS` (ej. `02:59:45`).
  * **Hub Salud:** Cronómetro regresivo de **2 horas (7,200 segundos)**.
* **Persistencia Resiliente:** El tiempo restante se almacena en `AppStorage` y se reanuda de forma exacta ante interrupciones. Si el cronómetro llega a 0, la app finaliza y entrega automáticamente el examen.

### 3. Filtro de Modalidad en Dashboard Móvil
* En `app/(tabs)/home.tsx`, se añadió la barra horizontal de filtros por modo: `Todos`, `Rápido (10q)`, `Estudio (20q)` y `Simulacro Real`.
* Al pulsar un filtro, recarga en tiempo real `getStats({ limit: selectedModeFilter })` y `getEvolution({ limit: selectedModeFilter })`, renderizando la serie dorada `scoresReal` en `HistoricalTrendChart.tsx`.

### 4. Blindaje del Motor RAG
* **En Simulacros Reales:** RAG **100% Desactivado** tanto en Web como en las Apps Móviles. Los reactivos provienen de forma exclusiva del banco verificado en PostgreSQL (`source: 'BANK'`). El Tutor IA permanece bloqueado durante la prueba (modo ciego estricto).
* **En Exámenes Cortos (10q / 20q):** El RAG opera exclusivamente por déficit ($\text{neededCount} = \text{limit} - \text{bankCount}$) en bloques paralelos de $\le 5$ preguntas, guardando cada reactivo generado en PostgreSQL para auto-abastecer el banco.