# 📚 Documentación Consolidada: Mi Biblioteca (Hub Academia)

## 1. 🌟 Visión General y Filosofía de Diseño
**Mi Biblioteca** (`/library`) es el centro de conocimiento, investigación y aprendizaje personalizado de **Hub Academia**. Ha sido diseñada bajo una arquitectura **EdTech Senior, Minimalista y Responsiva**, integrando en un solo espacio:
- **Descubrimiento de Conocimiento:** Catálogo unificado de recursos para los sectores de **Salud (Medicina)** y **Educación**.
- **Boletín de Novedades (Mensual / 30 Días):** Curación periódica e ingesta en vivo de noticias gubernamentales oficiales, normas técnicas, guías clínicas e investigaciones científicas traducidas al español.
- **Buscador Inteligente Senior:** Búsqueda en caliente con auto-reset, botón de limpieza rápida `X`, soporte para tecla `Escape` y lupa responsiva en celulares.
- **Suite de Estudio Personal:** Gestión de recursos guardados, favoritos y tablón de notas vinculado al Tutor IA.
- **Visor Inmersivo Universal:** Lectura y estudio de documentos sin salir del dominio de la plataforma.

---

## 2. 📂 Clasificación de Recursos Educativos
La plataforma clasifica automáticamente cada publicación y material en su sector correspondiente (**Salud** o **Educación**):

| Tipo de Recurso | Identificador | Descripción | Distintivo Visual (UI) |
| :--- | :--- | :--- | :--- |
| **Noticia Oficial** | `noticia` | Comunicados de prensa y noticias oficiales del MINEDU y MINSA. | Badge Morado + Glow Púrpura |
| **Paper Científico** | `paper` | Artículos clínicos e investigaciones peer-reviewed (PubMed, PMC, SciELO, Redalyc, Dialnet). | Badge Azul + Glow Azul |
| **Norma Técnica / Legal** | `norma` | Normas Técnicas de Salud (NTS), leyes y directivas oficiales. | Badge Ámbar + Glow Dorado |
| **Guía Clínica / Técnica**| `guia` | Guías de Práctica Clínica (GPC) y manuales técnicos. | Badge Esmeralda + Glow Verde |
| **Libro / Manual** | `book` | Bibliografía académica y textos de consulta histórica. | Tarjeta Estándar / Poster |
| **Video / Multimedia** | `video` | Clases grabadas, ponencias y recursos audiovisuales. | Tarjeta Multimedia |

---

## 3. 🖥️ Arquitectura UI/UX y Experiencia de Navegación

### A. Layout Elevado de Pantalla Completa (`library.html`)
- **Espacio Vertical Maximizado:** Se eliminó el título estático redundante "Mi Biblioteca" y textos secundarios, elevando la barra de pestañas `.library-tabs` directamente al tope del contenedor principal.
- **Divisor Académico:** Alternancia fluida entre sectores mediante el selector **SALUD | EDUCACIÓN**.

```
+-----------------------------------------------------------------------------------+
|  [Biblioteca de Recursos]    (Guardados)    (Favoritos)    (Notas)                 |  <- Tabs Elevadas al Tope
+-----------------------------------------------------------------------------------+
|  [ 🔍 Busca tu recurso académico...                           [x]  [ 🔍 Buscar ] ]|  <- Buscador Compacto con Clear 'X' y Lupa Mobile
+-----------------------------------------------------------------------------------+
|  SALUD  |  EDUCACIÓN                                                              |  <- Divisor de Sectores Académicos
|  [🔥 Novedades] [Libros y Manuales] [Papers Científicos] [Normas] [Guías] [Otros] |  <- Píldoras de Filtro
+-----------------------------------------------------------------------------------+
|  📰 WIDGET DE NOVEDADES Y BOLETÍN RECIENTE (ÚLTIMOS 30 DÍAS / MENSUAL)            |
|  +-----------------------------------------------------------------------------+  |
|  | [HERO CARD] Badge Resplandeciente + Título + Resumen + [Portada] + [Leer]  |  |  <- Layout con Soporte de Portada/Imagen
|  +-----------------------------------------------------------------------------+  |
|  | [GRILLA SECUNDARIA DE NOVEDADES] (Portadas + Badges + Metadatos)             |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### B. Buscador Inteligente Senior (`search.js`)
- **Auto-Reset en Tiempo Real (`input` listener):** Si el usuario busca y posteriormente borra todo el texto ingresado en la barra, el sistema ejecuta `resetSearchToBrowse()` restaurando el widget de Novedades y el catálogo original sin necesidad de recargar la página.
- **Botón de Limpieza (`#searchClearBtn`):** Un botón `X` se despliega reactivamente en el campo de texto cuando hay caracteres ingresados. Al hacer clic, borra el campo, enfoca el cursor y restaura la vista inicial.
- **Teclas de Acceso Rápido:** Presionar la tecla `Escape` en el teclado cancela la búsqueda activa y regresa al catálogo.
- **Diseño Adaptativo Móvil:** En smartphones (<= 768px), el botón de búsqueda oculta su etiqueta de texto y se contrae a una lupa circular de 36px x 36px a la derecha del input de texto.

### C. Widget de Novedades y Boletín Reciente (30 Días / Mensual) (`components.js` & `browse.css`)
- **Alcance Temporal:** Muestra las publicaciones oficiales e investigaciones más recientes del **mes en curso (últimos 30 días)**.
- **Soporte de Portadas e Imágenes (`image_url`):**
  - **Tarjeta Hero:** Si el recurso tiene portada asignada, la resuelve mediante `window.resolveImageUrl()` y la renderiza en el contenedor `.news-hero-media`. Si no tiene portada o falla el enlace, aplica fallback `onerror` limpio manteniendo la legibilidad del texto.
  - **Tarjetas Secundarias:** Presentan portadas superiores `.news-sec-media` con bordes redondeados y efectos hover de escala suave.

### D. Página de Destino (`/resource?id=X`) y Visor Inmersivo
- **Página de Destino:** Presenta la portada en gran tamaño, metadatos de autoría, botones de acción (*Estudiar*, *Descargar*, *Guardar*) y resumen factual estilo enciclopedia.
- **Visor Inmersivo Universal (Full Screen):** Permite estudiar PDFs, videos (MP4/YouTube) y documentos directamente en pantalla completa sin salir del dominio de Hub Academia.
- **Descargas Directas:** Los archivos en Google Cloud Storage (GCS) se descargan nativamente con el parámetro `download=true` notificando las cabeceras `Content-Disposition`.

---

## 4. 🔒 Control de Acceso y Pestañas Privadas

La biblioteca adapta sus pestañas según el estado de la sesión del usuario:

- **Biblioteca de Recursos (`resources`):** Catálogo general público, buscador avanzado y boletín de novedades. Disponible para todos los visitantes.
- **Guardados (`saved`):** Colección privada de recursos guardados por el estudiante (Requiere inicio de sesión).
- **Favoritos (`favorites`):** Cursos y recursos destacados con el icono de corazón (Requiere inicio de sesión).
- **Notas (`notes`):** Editor de Notas Premium y tablón moderno de notas personales (Requiere inicio de sesión).

> 💡 **Protección de Invitados (`guest-mode`):** Si no hay una sesión activa (`user === null`), las pestañas *Guardados*, *Favoritos* y *Notas* se ocultan automáticamente (`display: none !important`). Si un visitante intenta ingresar por URL (ej. `/library?tab=saved`), el controlador lo redirige de forma limpia a `resources`.

---

## 5. 🛠️ Tablón de Notas Personales y Tutor IA

- **Guardado Directo desde el Chat:** Cada respuesta generada por el Tutor IA incluye el control de un clic **"Guardar como Nota"**, formateando y almacenando el contenido en la biblioteca del estudiante.
- **Creación Manual de Notas (`openNoteModal`):** Permite al estudiante redactar notas de estudio desde cero a través del botón "Nueva Nota" en el tablón, delegando limpiamente a `openNoteEditor(noteId)` en `libraryUI.js`.
- **Visualización en Tarjetas Modernas (`.note-card`):** Sustituye los listados planos por tarjetas visuales con indicador cromático.
- **Herramientas de Tablón (`.notes-toolbar`):**
  - **Buscador de Notas:** Filtrado en caliente por palabras clave en título o contenido.
  - **Selector de Orden:** Organiza notas por fecha (Recientes/Antiguas), alfabéticamente (A-Z), por color asignado o por origen (Chat / Manual).

---

## 6. 🗄️ Modelo de Datos y Seguridad (PostgreSQL & Supabase RLS)

```sql
-- Tabla Principal de Recursos Educativos
CREATE TABLE IF NOT EXISTS public.resources (
    id SERIAL PRIMARY KEY,
    resource_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    url VARCHAR(255) UNIQUE,
    image_url VARCHAR(500),
    resource_type VARCHAR(50) DEFAULT 'book', -- 'paper', 'norma', 'guia', 'noticia', 'book', 'video', 'other'
    is_premium BOOLEAN DEFAULT false,
    content_html TEXT,
    domain VARCHAR(50) DEFAULT 'medicine',   -- 'medicine', 'education'
    visible BOOLEAN DEFAULT true,
    open_directly BOOLEAN DEFAULT false
);

-- Relación de Recursos Guardados por Usuario
CREATE TABLE IF NOT EXISTS public.user_book_library (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    book_id INTEGER REFERENCES public.resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id)
);

-- Tabla de Notas Personales
CREATE TABLE IF NOT EXISTS public.user_notes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'manual', -- 'chat', 'manual'
    color VARCHAR(20) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

- **Seguridad RLS (Row Level Security):** Políticas configuradas en Supabase asegurando que cada usuario acceda **únicamente a sus propios registros guardados y notas personales**, validando mediante `auth.uid()`.
- **Clean URLs:** Configurado mediante `"cleanUrls": true` en `vercel.json` y la ruta Express `/library` para navegación sin extensión `.html`.

---

## 7. 🤖 Curaduría Científica e Ingesta Automática (Antigravity 2.0)

La biblioteca se actualiza de forma autónoma mediante **Scheduled Tasks** en **Antigravity 2.0** a las **8:00 PM**:

1. **Ingesta Diaria de Noticias Oficiales (`0 20 * * *`)**:
   - Escanea diariamente los portales de noticias MINEDU ([gob.pe/institucion/minedu/noticias](https://www.gob.pe/institucion/minedu/noticias)) y MINSA ([gob.pe/institucion/minsa/noticias](https://www.gob.pe/institucion/minsa/noticias)).
   - Extrae noticias del día con deduplicación por URL y almacena con `resource_type: "noticia"`.
2. **Ingesta Semanal de Papers Científicos (`0 20 * * 1`)**:
   - Escanea PubMed, PMC, SciELO, Redalyc y Dialnet en la ventana de los **últimos 7 días**.
   - Garantiza mínimo **80% Papers Científicos** (`resource_type: "paper"`).
   - **Traducción e Interpretación Hispana:** Traduce títulos en inglés al español técnico y elabora la síntesis factual en español de 2 a 3 líneas para `content_html`.
3. **Verificación Anti-Soft-404:** Todo recurso es analizado mediante `read_url_content` e inspección HTTP antes de insertarse en la BD. Si la URL devuelve 404, Soft-404 o paywall bloqueado, es descartada automáticamente.

---

## 🧪 Verificación y Suite de Pruebas Unitarias
El sistema de biblioteca cuenta con una suite de pruebas unitarias (`npm test`) pasando al **100% (12/12 test suites, 87/87 pruebas pasando en verde)**.
