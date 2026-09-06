# 🎨 Design System & Branding: Hub Academia v3.5

**Estado:** Fuente de Verdad (Single Source of Truth)  
**Versión:** 3.5  
**Enfoque Estético:** Dual-Theme Engine (Dark Mode Matte Black 🌙 / Light Mode Studio Slate ☀️) / Cyber-Minimalist / Manta Pill Gradients

Este documento define las reglas visuales, componentes interactivos, tokens CSS y directrices de experiencia de usuario (UX) para **Hub Academia**. Sirve como guía de referencia obligatoria para mantener la coherencia en todas las interfaces de la plataforma.

---

## 📌 Tabla de Contenidos
1. [🌈 Paleta de Colores y Tokens Dinámicos (Dark 🌙 / Light ☀️)](#1--paleta-de-colores-y-tokens-dinámicos-dark---light-)
2. [🔤 Tipografía y Jerarquía](#2--tipografía-y-jerarquía)
3. [🔲 Componentes Core](#3--componentes-core)
4. [📐 Grids, Layouts y Responsividad](#4--grids-layouts-y-responsividad)
5. [✨ Micro-interacciones y Efectos](#5--micro-interacciones-y-efectos)
6. [🚀 Reglas UX Mandatorias](#6--reglas-ux-mandatorias)
7. [🎨 Iconografía (Font Awesome 6.4.0)](#7--iconografía-font-awesome-640)
8. [📱 Mobile Design Systems: HubDocenteApp & HubSaludApp](#8--mobile-design-systems-hubdocenteapp--hubsaludapp-light-theme)
9. [📋 Sistema de Revisión de Examen (Correction Mode & Dual-Theme UI)](#9--sistema-de-revisión-de-examen-correction-mode--dual-theme-ui)
10. [🔔 Sistema Centralizado de Alertas, Toasts y Vidas en Tiempo Real](#10--sistema-centralizado-de-alertas-toasts-y-vidas-en-tiempo-real)
11. [💬 Sistema Centralizado de Tooltips y Onboarding Guía](#11--sistema-centralizado-de-tooltips-y-onboarding-guía-tooltipmanager)
12. [📐 Motor Universal de Tipografía Matemática, Científica y Notación Química](#12--motor-universal-de-tipografía-matemática-científica-y-notación-química-katex--markdownrenderer)
13. [🖥️ Arquitectura y Estándar Visual del Panel de Gestión / Administración & Subcontenedores Avanzados](#13-️-arquitectura-y-estándar-visual-del-panel-de-gestión--administración-admin-panel--subcontenedores-avanzados-de-modales)

---

## 1. 🌈 Paleta de Colores y Tokens Dinámicos (Dark 🌙 / Light ☀️)

La plataforma cuenta con un motor de temas centralizado gobernado por el atributo `data-theme="dark"` y `data-theme="light"` en la etiqueta raíz `<html>`. Queda estrictamente prohibido el uso de valores hexadecimales hardcodeados en hojas de componentes; todo elemento debe consumir tokens CSS de `theme.css`.

### Matriz de Tokens de Tema

| Token CSS | Dark Mode (`[data-theme="dark"]`) | Light Mode (`[data-theme="light"]`) | Propósito / Uso en UI |
| :--- | :--- | :--- | :--- |
| `--bg-main` | `#050505` (Deep Black) | `#f8fafc` (Clean Slate 50) | Fondo principal de la aplicación (`body`). |
| `--bg-secondary` / `--card-bg` | `#0a0a0a` (Matte Black) | `#ffffff` (Pure White) | Tarjetas, paneles, contenedores de sección y modales. |
| `--bg-tertiary` | `#121212` (Elevated Black) | `#f1f5f9` (Slate 100) | Subtarjetas anidadas, inputs, barras de progreso de fondo. |
| `--surface-hover` | `rgba(255, 255, 255, 0.05)` | `rgba(0, 0, 0, 0.04)` | Estados hover en ítems de lista, dropdowns y botones secundarios. |
| `--border-color` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.09)` | Bordes sutiles y separadores divisorios. |
| `--border-hover` | `rgba(255, 255, 255, 0.18)` | `rgba(0, 0, 0, 0.18)` | Bordes al posar el cursor o enfocar elementos. |
| `--text-main` | `#ffffff` / `#f8fafc` | `#0f172a` (Slate 900) | Títulos principales, encabezados H1-H3 y texto de alto contraste. |
| `--text-secondary` | `#cbd5e1` (Slate 300) | `#334155` (Slate 700) | Texto de párrafos, opciones de cuestionario y descripciones. |
| `--text-muted` | `#94a3b8` (Slate 400) | `#64748b` (Slate 500) | Subtítulos secundarios, etiquetas de fecha y metadatos. |
| `--modal-bg` | `#0a0a0a` | `#ffffff` | Superficie sólida opaca para modales interactivos. |
| `--modal-overlay-bg` | `rgba(0, 0, 0, 0.75)` | `rgba(15, 23, 42, 0.5)` | Fondo difuminado (`backdrop-filter`) tras los modales. |
| `--input-bg` | `#121212` | `#ffffff` | Relleno de campos de texto, áreas de texto y selects. |
| `--input-border` | `rgba(255, 255, 255, 0.12)` | `rgba(0, 0, 0, 0.15)` | Borde perimetral de controles de formulario. |
| `--input-text` | `#ffffff` | `#0f172a` | Color de tipografía digitada por el usuario. |
| `--shadow-md` | `0 4px 20px rgba(0, 0, 0, 0.5)` | `0 4px 20px rgba(0, 0, 0, 0.06)` | Elevación media en tarjetas y badges. |
| `--shadow-xl` | `0 25px 50px -12px rgba(0, 0, 0, 0.85)` | `0 20px 40px -12px rgba(0, 0, 0, 0.12)` | Elevación alta en ventanas modales y drawers. |

### Acentos de Marca (Idénticos en ambos temas para consistencia)
* **Azul Primario (`--primary`):** `#3b82f6` (Hover: `#2563eb`).
* **Degradado Manta Orange (`--gradient-orange`):** `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`.
* **Degradado Cyan-Blue (`--gradient-primary`):** `linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%)`.
* **Éxito (`--success`):** `#10b981`.
* **Peligro (`--danger`):** `#ef4444`.
* **Advertencia (`--warning`):** `#f59e0b`.

---

## 2. 🔤 Tipografía y Jerarquía

Utilizamos exclusivamente la tipografía **Inter** para asegurar alta legibilidad y una apariencia moderna y tecnológica.

* **Fuente Principal:** `'Inter', system-ui, -apple-system, sans-serif`
* **Escala de Encabezados (PC):**
  * **H1 (Título de Página):** `2.2rem` | ExtraBold (800) | `letter-spacing: -0.02em`
  * **H2 (Secciones):** `1.6rem` | Bold (700) | `letter-spacing: -0.01em`
  * **H3 (Subsecciones/Tarjetas):** `1.25rem` | SemiBold (600)
* **Escala de Encabezados (Móvil - Breakpoint <= 768px):**
  * **H1:** `1.8rem` | ExtraBold (800)
  * **H2:** `1.4rem` | Bold (700)
  * **H3:** `1.15rem` | SemiBold (600)
* **Texto de Cuerpo (Body Text):**
  * **Normal:** `0.95rem` | Regular (400) | `line-height: 1.6`
  * **Pequeño/Muted:** `0.85rem` | Regular (400) | `line-height: 1.5`

---

## 3. 🔲 Componentes Core

### 3.1. Modales (Estándar Negro Mate con Backdrop Blur)
Todas las ventanas modales de la plataforma deben seguir este patrón visual exacto:
* **Overlay tras el Modal (`.modal-overlay`):** Capa difuminada semi-transparente `rgba(0, 0, 0, 0.75)` con `backdrop-filter: blur(12px) saturate(160%)` que permite percibir suavemente la página de fondo.
* **Cuerpo del Modal (`.modal-content`):** `#0a0a0a` (Negro Mate Puro Sólido OPACO, sin transparencias internas para que el contenido sea 100% nítido).
* **Borde:** `1px solid rgba(255, 255, 255, 0.08)`.
* **Esquinas:** `20px` (Rounded).
* **Sombra:** `0 25px 50px -12px rgba(0, 0, 0, 0.9)`.

### 3.2. Botones y Estados Hover

> [!IMPORTANT]
> El estilo **Manta Pill Gradient con Insignia Circular de Icono** o **Manta Orange Degradado** son los estándares estéticos obligatorios para botones primarios de acción. Los botones secundarios deben mantener una estética limpia y sobria, integrándose perfectamente con el explorador.

* **Botón Primario de Repaso / Core Action (`.btn-premium-primary`):**
  * **Fondo:** `linear-gradient(135deg, #f97316 0%, #ea580c 100%)`.
  * **Texto:** `#ffffff` en negrita (600/700).
  * **Sombra / Glow:** `box-shadow: 0 4px 15px rgba(249, 115, 22, 0.35)`.
  * **Hover:** `transform: translateY(-2px); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5); color: #ffffff;`.

* **Botón Secundario (`.btn-secondary` / `.btn-premium-secondary`):**
  * **Fondo Inicial:** `rgba(255, 255, 255, 0.04)` (Translúcido limpio).
  * **Borde:** `1px solid rgba(255, 255, 255, 0.08)`.
  * **Forma:** `border-radius: 10px - 12px` | Texto `#e2e8f0`.
  * **Interacción Hover (Estándar Explorador):** `background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); color: #ffffff; transform: translateY(-1px);`.
  * **Regla de Coherencia:** Queda estrictamente prohibido usar fondos plomos opacos (ej. `#334155` o `rgba(51,65,85,0.8)`) o aplicar halos/bordes de resplandor naranja aislados sobre botones secundarios que rompan la armonía visual.

### 3.3. Badges de Estado e Insignias de Plan
* **Pill Badge Plan Active (`.badge-premium`):**
  * Fondo `linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)`, texto `#ffffff` en negrita, radio `50px`, con resplandor sutil `box-shadow: 0 0 14px rgba(59, 130, 246, 0.4)`.
* **Pill Badge Verificado / Activo (`.badge-status-active`):**
  * Fondo `rgba(16, 185, 129, 0.12)`, borde `1px solid rgba(16, 185, 129, 0.3)`, texto `#34d399` en negrita (600), radio `50px`.

### 3.4. Inputs y Form Controles
* **Fondo:** `#121212` (Dark Slate Matte).
* **Borde:** `1px solid rgba(255, 255, 255, 0.08)`.
* **Focus State:** Borde cambia a `#3b82f6` con un shadow azul difuminado (`box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15)`).
* **Borde de Esquinas:** `12px`.

### 3.5. Modales de Zona de Peligro / Advertencia Crítica (`.modal-content.danger-variant`)
* **Propósito:** Confirmación de acciones irreversibles (Eliminación de cuenta, purga de historial).
* **Borde Destacado:** `1px solid rgba(239, 68, 68, 0.3)`.
* **Caja de Aviso Interna:** Fondo `rgba(239, 68, 68, 0.08)`, borde `1px solid rgba(239, 68, 68, 0.2)`, texto `#fca5a5`.
* **Botón de Confirmación Peligrosa (`.btn-danger-pill`):**
  * Fondo `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`.
  * Radio `50px` (Pill), texto `#ffffff` en negrita (700).
  * Glow Effect: `box-shadow: 0 4px 15px rgba(239, 68, 68, 0.35)`.
  * Hover: `transform: translateY(-2px) scale(1.02); box-shadow: 0 6px 25px rgba(239, 68, 68, 0.5)`.

### 3.6. Tarjetas de Consumo de IA & Servicios (`.usage-main-card`)
* **Título Responsivo:** `Consumo de Servicios IA` (`font-size: 1.1rem` en escritorio, disminuyendo progresivamente a `0.95rem` en pantallas móviles `<= 480px` para evitar desbordamientos).
* **Contenedor Flex de Cabecera:** `min-width: 0` para prevenir quiebres de línea forzados.
* **Ítems de Consumo (`.usage-item`):** Fondo `var(--bg-tertiary)`, borde `var(--border-color)`, ajuste automático de texto con `word-break: break-word` e indicadores de cuotas en tiempo real.

### 3.7. Hero Banner Centrado Dual-Theme (`.hub-hero-container`)
* **Cuadrícula Técnica y Resplandores Ambientales (`.hero-ambient-glow`):** Cuadrícula nítida visible en Dark (`rgba(255, 255, 255, 0.055)`) y Light (`rgba(15, 23, 42, 0.075)`), combinada con iluminación radial multidimensional (azul eléctrico, índigo y violeta en Dark; azul cielo y lavanda suave en Light) que elimina la monotonía del blanco y da profundidad SaaS moderna.
* **Pill Badges Temáticos:** Enlaces superiores estilizados en píldora con microinteracciones para `💊 Salud (SERUMS)` y `🎓 Educación (Ascenso Docente)`.
* **Tipografía Dinámica:** Título H1 `Tu Hub Académico` con gradiente de texto `.hero-gradient-text` optimizado para Dark (`#38bdf8` -> `#818cf8` -> `#ec4899`) y Light (`#2563eb` -> `#6366f1` -> `#db2777`).
* **Botón de Acción Principal (`.hero-primary-cta`):** Píldora degradada interactiva con efecto de elevación y desplazamiento suave hacia los módulos.
* **Cuadrícula Bento de Métricas (`.hero-metrics-grid`):** 4 tarjetas de estadísticas (`1K+`, `5K+`, `98%`, `24/7`) con fondo `var(--card-bg)`, borde `var(--border-color)`, barra superior dinámica en hover y valores tipográficos en `var(--text-main)`.

### 3.8. Header User Profile Pill (`.user-menu-toggle`)
* **Componente de Usuario Enriquecido:** Reemplaza el botón circular simple por una píldora estética con avatar circular, columna con nombre de usuario (`.user-header-name`) y plan de suscripción (`.user-header-tier` ej: `Plan Avanzado`, `Plan Pro`, `Plan Gratuito`), junto con una flecha chevron animada `⌄`.
* **Comportamiento Responsivo:** En dispositivos móviles ultra-compactos `<= 640px` colapsa ordenadamente a avatar + chevron para evitar desbordamientos en la barra de navegación.

### 3.9. Mockup Showcases en Landing Page (`.edu-preview-showcase`, `.med-preview-showcase`)
* **Integración Visual de Imágenes Portada:** Presentación de las capturas oficiales (`educacionportada.png`, `simuladormedicoportada.png`) dentro de marcos glassmorphic de 20px de radio, borde dinámico `var(--border-color)`, sombra de elevación `var(--shadow-lg)` y píldoras flotantes (`.mockup-floating-pill`) con iconos representativos y efecto blur backdrop.
* **Contraste 100% Adaptativo:** Compatible y nítido tanto en Modo Oscuro como en Modo Claro, con microinteracciones de zoom sutil y elevación al posar el cursor.

### 3.10. Módulo de Repaso & Flashcards Dual-Theme (`/repaso` y `/flashcards`)
* **Flashcard Central de Estudio (`.fc-card-face`):** Fondo dinámico `var(--card-bg)`, borde `var(--border-color)`, relieve `var(--shadow-lg)` y tipografía `var(--text-main) !important` en preguntas, respuestas, listas y subtítulos en ambos temas (☀️ / 🌙).
* **Botones FSRS de Calificación (`.control-btn`):** Tarjetas interactivas con `var(--card-bg)`, sombra `var(--shadow-md)`, colores temáticos de feedback (Rojo `Olvidé`, Naranja `Difícil`, Azul `Bien`, Esmeralda `Fácil`) y hover con halo cromático sutil sin sombras negras excesivas.
* **Drawer Tutor IA (`.tutor-chat-panel`):** Panel lateral con `var(--card-bg)`, borde `var(--border-color)`, input con `var(--input-bg)` y `var(--input-text)` y burbujas de respuesta en `var(--bg-tertiary)`.
* **Explorador y Gestión de Mazos (`repaso.html`):** Títulos de mazo en `var(--text-main)`, botones de acción secundarios en `var(--card-bg)` con borde limpio, buscador adaptativo y filas de tarjetas con relieve y contraste completo.
* **Eliminación de Sombras Excesivas:** Sustitución de sombras oscuras duras (36px/40px) por elevaciones refinadas (`var(--shadow-md)`, `var(--shadow-lg)`, `var(--shadow-xl)`).

### 3.11. Simuladores, Dashboard, Quiz & Revisión de Exámenes Dual-Theme (`/simulator-dashboard`, `/quiz`)
* **Modal de Configuración de Simulacro:** Título en `var(--text-main)`, subtítulos en `var(--text-secondary)`, tarjetas de objetivo de examen con `var(--card-bg)` y selección activa con `var(--primary-glow)` y `var(--primary)`. Toggle de modo con `var(--bg-tertiary)` y `var(--border-color)`.
* **Diagnóstico de Rendimiento & Desglose de Materias:** Barras nativas HTML con etiquetas `.html-bar-label` y valores `.html-bar-value` en `var(--text-main)`, tracks en `var(--bg-tertiary)` con borde dinámico.
* **KPI Circular / Dona (`#topicDoughnutChart`, `#doughnut-legend`):** Leyenda dinámica con `var(--text-main)` y `var(--text-secondary)`, con bordes adaptativos según el tema activo. Pestañas de modo (`.kpi-mode-tab`) y tiempo (`.kpi-time-tab`) con clases CSS unificadas y contraste optimizado.
* **Análisis de Patrones de Error (Advanced IA):** Fondos `var(--bg-tertiary)`, bordes punteados `var(--border-color)`, textos de alto contraste (`var(--text-main)` y `var(--text-secondary)`) y botón primario píldora (`#btn-analyze-ai`) con resplandor glow.
* **Barra de Filtro Activo (`#active-config-summary`):** Píldora moderna con `var(--card-bg)` y `var(--border-color)`.
* **Pantalla de Revisión de Examen (`.review-card`):** Tarjetas de preguntas en `var(--card-bg)` con sombra `var(--shadow-sm)`, opciones de respuesta `.review-opt` con `var(--bg-tertiary)`, feedback correcto/incorrecto con bordes claros y explicaciones pedagógicas sobre `var(--surface-hover)`.
* **Desactivación de Banner de Modo Invitado:** Eliminada la inyección persistente del banner de modo invitado para una interfaz de usuario completamente limpia y despejada.

### 3.12. Identidad Cromática por Módulo (Salud Verde Cian vs Educación Azul vs Repaso Naranja)
* **Módulo Salud (SERUMS / Medicina):** Paleta clínica en **Verde Cian / Teal** (`#14b8a6`, `#0d9488`, `#2dd4bf`), presente en píldoras del Hero (`.pill-salud`), secciones de aterrizaje (`#salud-section`), títulos con `.accent-green-text`, botón CTA `.btn-med-theme`, vitrina mockup (`.mockup-floating-pill.pill-med`), bordes y sombras de tarjetas `.med-card-theme`, y variables dinámicas `--primary` (`#0d9488`), `--primary-dark` (`#0f766e`), `--primary-light` (`#2dd4bf`) y resplandores en `simulator-dash.js`.
* **Módulo Educación (Ascenso / Magisterio):** Paleta azul real y eléctrico (`#2563eb`, `#1d4ed8`, `#3b82f6`), presente en píldoras del Hero, secciones de aterrizaje (`#docente-section`), título con `.accent-blue-text`, botón CTA `.btn-edu-theme`, vitrina mockup (`.mockup-floating-pill.pill-edu`), y variables dinámicas `--primary` en el dashboard.
* **Módulo Repaso (Flashcards / FSRS):** Paleta ámbar y naranja (`#f97316`, `#ea580c`), presente en tarjetas de mazos, botones de creación rápida y vistas de comunidad.

### 3.13. Header Global Invariante y Botón "Acceder"
* **Header & Sidebar Invariantes:** El botón `.main-header #open-login-modal` mantiene de forma constante e invariable su estilo azul de marca (`linear-gradient(135deg, #2563eb, #1d4ed8)`) y texto blanco, independientemente del módulo o contexto activo, garantizando coherencia en la barra de navegación.

### 3.14. Perfil de Usuario, Precios y Chat Flotante Dual-Theme
* **Página de Precios (`/pricing`, `#pricing-section`):** Títulos y precios en `var(--text-main)`, botón de Plan Básico en `var(--bg-tertiary)` con borde y Plan Avanzado en Teal `#14b8a6`. Integración obligatoria de FontAwesome para renderizado de iconos del sidebar y header.
* **Perfil de Usuario (`/profile`):** Eliminación de sombras oscuras pesadas (85%-90%) sustituidas por `var(--shadow-sm)` y `var(--shadow-md)`. Textos y tarjetas de consumo de IA sincronizados con `var(--text-main)`, `var(--text-secondary)`, `var(--bg-tertiary)` y `var(--border-color)`.
* **Chatbot Flotante (`chat.css`):** Cabecera `.chatbot-header` adaptativa con `var(--header-bg)` y `var(--border-color)`, eliminando el tono gris plomo fijo en modo claro. Tarjeta de bienvenida con fondo `var(--bg-tertiary)` y borde primario.

### 3.15. Menú Lateral (Sidebar) con Acceso a Planes y Precios
* **Retiro de Selector de Tema:** El interruptor de tema se mantiene exclusivamente en la cabecera superior principal (`.main-header`).
* **Enlace a Planes y Precios:** Se añade la sección `sidebar-section-pricing` con icono `<i class="fas fa-crown"></i>` y enlace a `/pricing`, sincronizada con el enrutador de páginas activas `highlightActiveItem()`.

### 3.16. Modales de Repaso, Biblioteca y Registro Dual-Theme
* **Modales del Módulo Repaso y Paywalls (`repaso.html`, `uiManager.js`, `heatmap.js`):**
  * Modal Paywall / Acceso Premium (`showUpgradeModal` en `uiManager.js`): Texto explicativo en `var(--text-main)` de alto contraste (resolviendo texto blanco invisible en tema claro), títulos en degradado dorado y botón de acción con sombra y tipografía de impacto.
  * Modal de Bienvenida Freemium (`welcome-freemium-modal`): Fondo `var(--modal-bg)`, borde `var(--border-color)` y textos en `var(--text-main)` y `var(--text-secondary)`.
  * Modal Previsualización de Mazo (`#preview-deck-modal`): Título en `var(--text-main)`, tarjetas individuales con `var(--bg-tertiary)`, `var(--border-color)`, pregunta en `var(--text-main)` y respuesta en `var(--text-secondary)`.
  * Modal Guía de Estudio (`#deck-guide-modal`): Fondo `#deck-guide-content` con `var(--bg-tertiary)` y texto `var(--text-main)`.
  * Modal Estadísticas del Mazo (`#stats-modal` y `heatmap.js`): Título y contador de Total Tarjetas (`#modal-total`) en `var(--text-main)`, tarjetas de KPI, dona SRS y Activity Heatmap con días, intensidad, tooltips y leyendas sincronizados con `var(--text-main)`, `var(--text-secondary)` y `var(--border-color)`.
  * Modal de Generación IA (`#ai-modal`) y Carga Masiva: Opciones de audio TTS y fondos en `var(--bg-tertiary)` y `var(--text-main)`.
* **Tarjetas de Mazos de Repaso (`repaso.js`, `repaso.css`):**
  * Fila Superior Desacoplada (`.deck-card-top-row`): Badge a la izquierda y contenedor de acciones a la derecha (`.deck-card-actions`) sin colisiones.
  * Botón Play (`.btn-act-play`): Fondo degradado naranja de alto contraste con icono blanco `#ffffff` nítido.
  * Botones de Edición y Eliminación (`.btn-act-edit`, `.btn-act-delete`): Fondos `var(--bg-tertiary)` y `var(--border-color)` con hover interactivo.
* **Tipografía y Textos en Cursiva (`markdown-content.css`, `base.css`):**
  * `.markdown-content em` y `em, i.italic-text`: `font-style: italic; color: var(--text-main);` / `color: inherit;` garantizando perfecta legibilidad en respuestas del tutor, quiz, flashcards y descripciones.
* **Barra de Búsqueda y Orden en Notas (`library.html`):**
  * Input de Búsqueda y Selector de Orden: Fondos dinámicos en `var(--bg-tertiary)`, bordes en `var(--border-color)`, texto `var(--text-main)` y placeholder `var(--text-muted)`.
* **Cabecera Móvil y Controles de Sesión (`header.css`):**
  * Logo y Título alineados estrictamente a la izquierda en móvil (`position: static; transform: none`).
  * Controles de usuario logueado en móvil simplificados exclusivamente al avatar circular (`34px x 34px`), ocultando nombre y etiqueta de plan para evitar solapamientos.
### 3.17. Estándar Universal de Modales (Arquitectura, Barras de Desplazamiento y Botones)
Toda modal en Hub Academia debe estructurarse obligatoriamente bajo el siguiente patrón modular estricto:

* **1. Contenedor y Capas (`.modal-overlay` y `.modal-content`):**
  * Fondo overlay: `background: var(--modal-overlay-bg); backdrop-filter: blur(12px) saturate(160%);` con bloqueo de scroll corporal (`body.modal-open`).
  * Contenedor modal: `background: var(--modal-bg); border: 1px solid var(--border-color); border-radius: 20px; box-shadow: var(--shadow-xl); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;`.
* **2. Cabecera Fija (`.modal-header`):**
  * `padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); background: transparent; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;`.
  * Título `<h2>` en `var(--text-main)` con icono temático institucional.
  * Botón de cierre `.modal-close-btn` con `&times;` accesible y hover sutil en `var(--surface-hover)`.
* **3. Cuerpo con Scrollbar Contenido (`.modal-body`):**
  * `padding: 1.5rem; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 1.25rem;`.
  * **Barra de desplazamiento estandarizada:**
    * Firefox / Estándar: `scrollbar-width: thin; scrollbar-color: var(--border-color) transparent;`.
    * Webkit (Chrome, Edge, Safari): Ancho `6px`, track transparente y thumb `var(--border-color)` con radio `10px`.
    * *Regla crítica:* La barra de desplazamiento debe estar estrictamente confinada al `.modal-body` y jamás cruzar ni desbordar hacia la cabecera o el pie de la modal. Quedan prohibidos los contenedores de scroll anidados dobles.
  * Etiquetas de formulario (`.form-label`, `label`): `font-weight: 600; color: var(--text-main); font-size: 0.88rem;`.
  * Inputs y Selects: `background: var(--input-bg); border: 1.5px solid var(--border-color); color: var(--text-main); border-radius: 10px; height: 44px;`. Al enfocar: `border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow);`.
  * Selectores de Iconos / Píldoras: Botones inactivos con `background: var(--bg-tertiary); border: 1.5px solid var(--border-color);`. Botones activos con borde del color seleccionado, fondo translúcido y sombra de acento.
  * Callouts informativos: Fondos tintados en `var(--bg-tertiary)` con bordes de color de acento y texto en `var(--text-secondary)`.
* **4. Pie Fijo y Botones Estándar (`.modal-footer`):**
  * `padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: transparent; display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; flex-shrink: 0; border-radius: 0 0 20px 20px;`.
  * **Orden y Dimensiones Universales de Botones:**
    * **Botón Secundario (Izquierda del grupo de acción):** `.btn-secondary-action` ("Cancelar" o "Cerrar"). Altura fija `42px`, min-width `105px`, padding `0 1.25rem`, fondo `var(--bg-tertiary)`, borde `1.5px solid var(--border-color)`, color `var(--text-main)`, `border-radius: 10px`, `font-weight: 600`, `font-size: 0.9rem`.
    * **Botón Primario (Derecha):** `.btn-action` ("Crear", "Guardar", "Generar", "Clonar"). Altura fija `42px`, min-width `110px`, padding `0 1.5rem`, degradado temático de acción, sin borde, color blanco `#ffffff`, `border-radius: 10px`, `font-weight: 700`, `font-size: 0.9rem`, sombra de elevación `box-shadow: 0 4px 12px rgba(...)`.

### 3.18. Expansión, Estilización y Búsqueda Universal en "Mi Biblioteca"
* **Contenedor Amplio y Desencajonado:** Eliminación de contenedores `.glass-card` con bordes anidados duplicados. Contenedor directo `.dashboard-container` con `max-width: 1400px; width: 100%; padding: 1.5rem 2rem;` para que los recursos ocupen el ancho total con holgura.
* **Encabezado Minimalista:** Título `<h1>` `Mi Biblioteca` limpio y conciso, sin párrafos de descripción que resten espacio vertical, permitiendo una elevación óptima de las pestañas y el catálogo.
* **Barra de Búsqueda Estilizada en Cápsula (`.notes-search-wrapper`):**
  * Diseño homogéneo para todas las pestañas de Biblioteca (*Catálogo de Recursos* y *Notas*).
  * Estructura: Cápsula redondeada `border-radius: 30px`, altura `44px`, fondo `var(--bg-tertiary)`, borde `1px solid var(--border-color)`, lupa a la izquierda `16px`, texto `var(--text-main)` y botón de limpieza integrado a la derecha `search-clear-btn`.
* **Pestañas Temáticas con Contraste Semántico (SALUD y EDUCACIÓN):**
  * Pestañas `.manta-tab.resource-tab`: Color `var(--text-secondary)` (inactivo) y `var(--text-main)` (activo), con línea indicadora inferior `var(--primary)` y separador `var(--border-color)`. Garantiza legibilidad 100% nítida en modo claro y modo oscuro.
* **Pestañas de Navegación de Ancho Completo:**
  * *Catálogo de Recursos* (`fa-compass`): Catálogo unificado y buscador de documentos.
  * *Guardados* (`fa-bookmark`): Marcadores guardados por el usuario.
  * *Favoritos* (`fa-heart`): Recursos destacados con corazón.
  * *Notas de Estudio* (`fa-sticky-note`): Cuadrícula responsive de notas con toolbar de búsqueda y ordenación.
* **Estados Vacíos Enriquecidos (`.library-empty-state`):**
  * Icono circular contenedor, encabezado descriptivo, texto de guía y botón de llamada a la acción primario para guiar al estudiante de vuelta al catálogo.
* **Buscador Resiliente (`SearchComponent`):**
  * Control seguro de limpieza de búsqueda (`toggleClearButton`), restauración instantánea y estados de carga (skeletons) integrados.

### 3.19. Arquitectura y Estándar Visual del Panel de Simuladores (Salud & Educación)
* **Contenedor Principal (`.dashboard-container`):**
  * `max-width: 1440px; margin: 0 auto; padding: 2rem 1.5rem 5rem;`. Otorga holgura lateral uniforme sin compresión ni enmarcado excesivo.
* **Hero Card Contextual (`.context-hero-card`):**
  * Banner de apertura con fondo `var(--card-bg)`, borde `1px solid var(--border-color)`, radio `20px`, padding `1.75rem 2rem`, glow ambiental radial (`.context-hero-glow`) y desenfoque glassmorphism `backdrop-filter: blur(12px)`.
  * **Estructura Interna:** Tag semántico (`.context-hero-tag`, 0.72rem en mayúsculas con tracking `0.08em`), Título de módulo (`.context-hero-title`, 1.75rem, font-weight 800, color `var(--text-main)`), y subtítulo contextual (`.context-hero-subtitle`, color `var(--text-secondary)`).
  * **Acciones de Cabecera:** Resumen de configuración activa (`#active-config-summary`) con pills de especialidad/carrera y botón principal de configuración (`.btn-config-hero`) con radio `12px`, padding ergonómico y sombra de elevación `0 4px 14px var(--primary-glow)`.
* **Cuadrícula y Tarjetas de Modos de Entrenamiento (`.modes-grid`, `.mode-card`):**
  * Distribución: 3 columnas en PC (`repeat(3, 1fr)`), 2 columnas en tabletas (`900px`), 1 columna en móviles (`600px`).
  * Estructura: Tarjetas con radio `18px`, padding `1.5rem`, fondo `var(--card-bg)`, borde `1px solid var(--border-color)` y elevación base `var(--shadow-sm)`.
  * **Fondos Gráficos Integrados (`background-size: cover; background-position: center;` con opacidad y filtro anti-sobresaturación):**
    * *Modo Rápido:* `/assets/simulacro-rapido.webp` (Oscuro) / `/assets/simulacro-rapido-claro.webp` (Claro).
    * *Modo Estudio (Salud):* `/assets/modo-estudio-salud.webp` (Oscuro) / `/assets/modo-estudio-salud-claro.webp` (Claro).
    * *Modo Estudio (Educación):* `/assets/modo-estudio-educacion.webp` (Oscuro) / `/assets/modo-estudio-educacion-claro.webp` (Claro).
    * *Simulacro Real:* `/assets/simulacro-real.webp` (Oscuro) / `/assets/simulacro-real-claro.webp` (Claro) con acento y botón en tonalidad Rose/Carmesí (`#f43f5e`).
  * **Micro-interacción Hover:** `transform: translateY(-4px);`, iluminación de borde en el color de acento de la tarjeta (`rgba(var(--accent-rgb), 0.4)`), y sombra de difusión `0 12px 30px rgba(var(--accent-rgb), 0.12)`.
  * **Componentes de Tarjeta:**
    * *Cabecera:* Icono cuadrado redondeado (`.mode-icon-badge`, 42x42px, fondo tintado y borde sutil) + Badge de cantidad de preguntas (`.mode-q-badge`, fondo `var(--bg-tertiary)` y borde `var(--border-color)`).
    * *Cuerpo:* Título en negrita `1.1rem` (`.mode-title`) y descripción concisa `0.8rem` (`.mode-desc`).
    * *Pie:* Botón pill de llamada a la acción (`.mode-cta`, color y borde de acento, transición a fondo completo e inversión de texto en blanco al posar el cursor).
* **Métricas Clave y KPIs con Micro-Barras (`.stats-overview`, `.stat-box`):**
  * 3 tarjetas para *Nota Promedio*, *Precisión Global* y *Total Reactivos Resueltos*.
  * **Fondos Gráficos Integrados (`::before` con opacidad calibrada al 85% y filtro de saturación equilibrada):**
    * *Puntuación Promedio:* `/assets/puntuacion-promedio.webp` (Oscuro) / `/assets/puntuacion-promedio-claro.webp` (Claro).
    * *Precisión Global (Salud):* `/assets/precision-global-salud.webp` (Oscuro) / `/assets/precision-global-salud-claro.webp` (Claro).
    * *Precisión Global (Educación):* `/assets/precision-global-educacion.webp` (Oscuro) / `/assets/precision-global-educacion-claro.webp` (Claro).
    * *Volumen de Respuestas:* `/assets/volumen-respuestas.webp` (Oscuro) / `/assets/volumen-respuestas-claro.webp` (Claro) con icono y valor en tonalidad Rose/Carmesí (`#f43f5e`).
  * Valores destacados en tipografía bold `2rem` con unidades legibles (`.stat-unit`).
  * **Micro-barras de progreso en cápsula (`.stat-progress-track`):** Altura fija `6px`, radio `999px`, fondo `var(--bg-tertiary)`, borde `1px solid var(--border-color)`. Barra animada suavemente con `transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1)`.
  * **Píldoras de aciertos y errores:** `.count-pill--correct` (icono check, fondo esmeralda 10%, color `#10b981`) y `.count-pill--incorrect` (icono x, fondo carmesí 10%, color `#f43f5e`).
* **Filtros de Analítica (`.kpi-filters-container`, `.kpi-tabs-group`):**
  * Agrupadores en cápsula con fondo `var(--bg-tertiary)` y radio `12px`.
  * Pestañas activas con fondo `var(--card-bg)` en modo claro o `var(--bg-secondary)` en modo oscuro, borde sutil y sombra de elevación.
* **Paneles de Visualización Analítica (`.detailed-row`, `.detail-card`):**
  * Tarjetas de analítica con radio `20px`, padding `1.5rem`, fondo `var(--card-bg)` y cabecera con título `0.95rem` en mayúsculas.
  * **Evolución Temporal:** Contenedor de canvas con línea horizontal aprobatoria discontinua en nota 14 (`Aprobatorio ≥ 14`).
  * **Distribución Temática:** Contenedor de dona con leyenda envolvente en la parte inferior (`.doughnut-custom-legend`).
  * **Dominio por Áreas:** Contenedor de barras horizontales nativas con etiquetas de semáforo cognitivo: Alto (verde `#10b981`), Medio (ámbar `#f59e0b`), Crítico (rojo `#f43f5e`).
* **Diagnóstico Inteligente por IA (`.ai-diagnosis-card`):**
  * Encabezado con icono con gradiente violeta/índigo, badge pill "Advanced IA" y glow ambiental.
  * **Estado Inicial:** Callout de borde punteado con icono de robot flotante y botón de llamada a la acción (`.btn-ai-action`).
  * **Estado de Resultados:**
    * *Grilla 2x1 de Insights:* Panel de Fortalezas (borde y tinte esmeralda) y Panel de Brechas Críticas (borde y tinte ámbar).
    * *Panel de Estrategia:* Banner horizontal con badge "Plan de Acción" y botón secundario para reanalizar diagnóstico.
* **Sistema de Temas Dual Estricto:**
  * **Modo Oscuro (Matte Black):** Fondo de página `var(--bg-main)` (`#050505`), fondo de tarjetas `var(--card-bg)` (`#0a0a0a` / `#121212`), bordes `rgba(255, 255, 255, 0.08)`, textos `#f8fafc` y `#94a3b8`. Prohibido el uso de tonos verde bosque o fondos oliva en la interfaz global.
  * **Modo Claro (Clean Slate):** Fondo de página `#f8fafc`, fondo de tarjetas `#ffffff`, bordes `#e2e8f0`, sombras suaves `var(--shadow-sm)`, textos `#0f172a` y `#64748b`.

---

## 4. 📐 Grids, Layouts y Responsividad

### 4.1. Cuadrícula de Biblioteca (Resources Grid)
* **Escritorio (> 1200px):** Exactamente **6 columnas por fila** (`repeat(6, minmax(0, 1fr))`).
* **Portátiles Medianos (900px a 1200px):** **4 columnas por fila** (`repeat(4, minmax(0, 1fr))`).
* **Tabletas (600px a 900px):** **3 columnas por fila** (`repeat(3, minmax(0, 1fr))`).
* **Celulares (<= 600px):** **2 columnas por fila** (`repeat(2, minmax(0, 1fr))`) con brecha de espacio reducida a `0.75rem`.

### 4.2. Responsividad del Panel de Simuladores (Salud & Educación)
* **Escritorio (> 900px):**
  * Modos de entrenamiento: 3 columnas (`repeat(3, 1fr)`).
  * KPIs y Métricas: 3 columnas (`repeat(3, 1fr)`).
  * Fila Analítica: Proporción 2:1 (Evolución 2fr / Dona 1fr).
* **Tabletas y Pantallas Medianas (600px a 900px):**
  * Modos de entrenamiento: 2 columnas (`repeat(2, 1fr)`).
  * KPIs y Métricas: 2 columnas (`repeat(2, 1fr)`).
  * Paneles de Analítica y Diagnóstico IA: 1 columna completa apilada.
* **Celulares y Pantallas Pequeñas (<= 600px / <= 480px):**
  * Contenedor principal con padding ergonómico `1.25rem 1rem 3.5rem` (evita cortes laterales y sobre-compresión).
  * **Hero Contextual:** Apilamiento vertical (`flex-direction: column`), botón de configuración a ancho completo (`width: 100%`) y glow ambiental reducido en escala y opacidad para evitar deslumbramientos.
  * **Modos de Entrenamiento:** 1 sola columna fluida con botón `.mode-cta` a ancho completo para facilidad táctil con una sola mano.
  * **KPIs y Métricas:** 1 columna con tamaño tipográfico ajustado a `1.75rem` / `1.55rem` para evitar saltos de línea numéricos.
  * **Filtros de Analítica:** Contenedor deslizable horizontalmente (`overflow-x: auto; -webkit-overflow-scrolling: touch;`) con barra de desplazamiento oculta para una experiencia nativa fluida.
  * **Gráficos y Canvas:** Altura optimizada a `220px` (y `190px` en <480px) para conservar visibilidad del contenido sin obligar al usuario a hacer scroll excesivo.
  * **Diagnóstico Inteligente IA:** Apilamiento de 1 columna para tarjetas de Fortalezas y Brechas, con botones de acción táctiles de tamaño completo.

---

## 5. ✨ Micro-interacciones y Efectos

* **Brillo de Acento (Glow hover effect):**
  * Las tarjetas interactivas de previsualización deben reaccionar al pasar el cursor cambiando la opacidad del borde y aplicando una sombra del color de acento de la sección.
* **Curva de Transición Estándar:**
  * `transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);`

---

## 6. 🚀 Reglas UX Mandatorias

1. **Superficies Negro Mate Estrictas:** 
   > [!WARNING]
   > Usar siempre `#050505` para el fondo principal de la página (`body`), `#0a0a0a` para tarjetas y contenedores principales, y `#121212` para sub-tarjetas o ítems anidados. Prohibido usar fondos con degradados azulados o capas `::before` de resplandor radial azul en los contenedores principales.
2. **Botones Primarios de Acción:**
   * Utilizar siempre el degradado Manta Cyan-Blue (`linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%)`) con forma pill (`border-radius: 50px`).

---

## 7. 🎨 Iconografía (Font Awesome 6.4.0) & Principio de Sobriedad Visual

* **Biblioteca Estándar:** Font Awesome v6.4.0 mediante CDN (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`).

### 7.1. 🚫 Prohibición de Abuso e Icon Clutter (Diseño Esbelto y Profesional)
Para conservar una estética de producto digital premium, moderna y no saturada (Cyber-Minimalist / Studio Clean), se establecen las siguientes directrices obligatorias:

1. **Uso Moderado e Intencional:** Los iconos deben utilizarse exclusivamente cuando aporten valor semántico real a la navegación, estado o acción primaria. Queda prohibido adornar cada párrafo, lista o encabezado con iconos superfluos.
2. **Jerarquía Tipográfica sobre Iconos:** La claridad y estructura de la información debe descansar principalmente en una tipografía limpia (`Inter`), buenos pesos visuales, espaciados generosos (`gap`, `padding`, `margin`) y contrastes calibrados, no en la proliferación de símbolos gráficos.
3. **Evitar Sobrecarga en Tarjetas y Contenedores:** En subtarjetas, sprints tácticos, badges o listas explicativas, priorizar texto claro con viñetas sutiles o números de paso limpios (ej. `Paso 1`, `Paso 2`, `Paso 3`) antes que saturar con múltiples iconos coloridos de diferentes familias.
4. **Armonía y Escala:** Cuando se empleen iconos (ej. en botones primarios o avisos críticos), su tamaño no debe competir con el texto principal (`font-size: 0.85rem a 1rem` en iconos en línea, o badges cuadrados contenidos de `36px` a `42px`). Mantener siempre una paleta monocromática o tonalidades atenuadas (`var(--text-secondary)`, `var(--text-muted)` o acentos semánticos controlados).

---

## 8. 📱 Mobile Design Systems: HubDocenteApp & HubSaludApp (Light Theme)

Las aplicaciones móviles de React Native / Expo (`HubDocenteApp` y `HubSaludApp`) utilizan un **Tema Claro Profesional de Alto Rendimiento y Contraste**, con esquinas suavemente redondeadas (`roundness: 12px a 20px`), sombras sutiles multiplataforma y tipografía oscura legible (`#0f172a` / `#475569`).

### 8.1. HubDocenteApp (Tema Claro Magisterial)
* **Fondo Principal:** `#f8fafc` (Slate 50).
* **Superficies / Tarjetas:** `#ffffff` (Blanco puro con sombras suaves `rgba(15, 23, 42, 0.06)`).
* **Sub-tarjetas / Fondos de Input:** `#f1f5f9` (Slate 100).
* **Bordes Estándar:** `#e2e8f0` (Slate 200) y `#c7d2fe` (Indigo 200 en estados activos).
* **Color Primario de Marca:** Azul-Morado / Índigo Magisterial (`#4f46e5` a `#4338ca`).
* **Acentos:** Índigo brillante (`#6366f1` / fondo suave `#eef2ff`) y Dorado CNEB (`#f59e0b` / fondo suave `#fffbeb`).
* **Tipografía:** Textos principales en `#0f172a` (Slate 900) y secundarios en `#64748b` (Slate 500).

### 8.2. HubSaludApp (Tema Claro Clínico)
* **Fondo Principal:** `#f8fafc` (Slate 50).
* **Superficies / Tarjetas:** `#ffffff` (Blanco puro con sombras clínicas suaves).
* **Sub-tarjetas / Fondos de Input:** `#f0fdfa` (Teal 50) / `#f1f5f9`.
* **Bordes Estándar:** `#e2e8f0` (Slate 200) y `#99f6e4` (Teal 200 en estados activos).
* **Color Primario de Marca:** Teal Clínico / Verde Médico Profundo (`#0d9488` a `#0f766e`).
* **Acentos:** Esmeralda / Cian Clínico (`#059669` / `#06b6d4` / fondo suave `#ccfbf1`) y Dorado de Excelencia (`#f59e0b` / `#fffbeb`).
* **Tipografía:** Textos principales en `#0f172a` (Slate 900) y secundarios en `#475569` (Slate 600).

### 8.3. Reglas de Componentes Móviles
* **Eliminación de Demo Mode en Apps Móviles:** Redirección inmediata a `/(auth)/login` para usuarios no registrados o `/(tabs)/home` para usuarios autenticados.
* **Badge de Concursos Disponibles:**
  - `HubDocenteApp`: Solo `ASCENSO` habilitado; `NOMBRAMIENTO` y `ACCESO_CARGOS` con badge "Pronto".
  - `HubSaludApp`: Solo `SERUMS` habilitado; `ENAM`, `RESIDENTADO` y `CONCURSO_MINSA` con badge "Pronto".
* **Tutor IA & Markdown:** Tarjetas de sustento con fondo `#f8fafc`, tablas estructuradas con cabecera en tinte suave de marca y tipografía `#0f172a`.
* **Compatibilidad de Sombras:**
  ```typescript
  ...Platform.select({
    web: { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.06)' },
    default: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
  })
  ```

---

## 9. 📋 Sistema de Revisión de Examen (Correction Mode & Dual-Theme UI)

La pantalla de revisión post-examen (`.review-container`) ofrece un análisis detallado y pedagógico de cada pregunta respondida, cumpliendo estrictamente con la paleta de tokens dinámicos:

1. **Jerarquía Tipográfica Armónica:**
   - **Enunciado de la Pregunta (`.review-q-text`):** `1.12rem` | SemiBold (600) | `var(--text-main)`.
   - **Badge de Pregunta (`.review-q-badge`):** `0.78rem` | Bold (700) | `border-radius: 9999px` | Fondo azul translúcido `rgba(59, 130, 246, 0.12)`.
   - **Opciones de Respuesta (`.review-opt`):** `0.95rem` | Regular (400) | `border-radius: 12px` | `var(--bg-tertiary)`.
2. **Badges de Opciones y Letras Semánticas:**
   - Cada opción cuenta con un contenedor cuadrado/circular (`.review-opt-letter`) de `28x28px` con las letras [A, B, C, D].
   - **Opción Correcta (`.r-correct`):** Fondo `var(--success-bg)`, borde `var(--success-border)`. Letra con fondo verde esmeralda `#10b981` y badge "Respuesta Correcta".
   - **Opción Errónea Marcada (`.r-wrong`):** Fondo `var(--danger-bg)`, borde `var(--danger-border)`. Letra con fondo carmesí `#ef4444`, texto tachado y badge "Tu Elección".
3. **Caja de Sustento Pedagógico (`.review-explanation`):**
   - Encabezado con etiqueta dorada/ámbar (`.review-exp-tag`) `<i class="fas fa-lightbulb"></i> Explicación Oficial`.
   - Cuerpo en tipografía `0.95rem` con interlineado `1.65` y color `var(--text-secondary)`.
4. **Disparador del Tutor IA en Revisión (`.btn-review-tutor-trigger`):**
   - Botón en forma de píldora con el gradiente de marca Manta Pill (`linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%)`).
   - Icono oficial de Hubi (`/assets/hubifrente.png`) de 16x16px con `pointer-events: none;` para garantizar que los clics abran directamente el Tutor IA y no interfieran con el visor Lightbox.
   - Sombra con resplandor cian/azul `box-shadow: 0 3px 12px rgba(59, 130, 246, 0.35)`.
5. **Responsividad Móvil (<= 768px):**
   - Contenedor al 100% de ancho con padding adaptativo `1.25rem 0.85rem`.
   - Opciones con `align-items: flex-start` y `.badge-text { display: none; }`, exhibiendo únicamente el icono compacto (`fa-check-circle` o `fa-times-circle`) para brindar el 100% del ancho horizontal a la lectura fluida del enunciado. En desktop se preserva la píldora completa.

---

## 10. 🔔 Sistema Centralizado de Alertas, Toasts y Vidas en Tiempo Real

Para erradicar popups nativos y bloqueantes (`alert()` y `confirm()`), la plataforma cuenta con una arquitectura de alertas reactivas y no intrusivas:

1. **Modal de Confirmación y Alerta (`window.confirmationModal`):**
   - Basado en `.confirmation-modal-card` con tokens dinámicos (`--modal-bg`, `--text-main`, `--border-color`).
   - Métodos asíncronos `show(msg, title, confirmText, cancelText): Promise<boolean>` y `showAlert(msg, title, btnText): Promise<boolean>`.
   - Iconos reactivos contextuales (Peligro/Eliminar en rojo `fa-exclamation-triangle`, Éxito en verde `fa-check-circle`, Reanudar en violeta `fa-history`, Consulta en azul `fa-question-circle`).
2. **Toast Global Flotante (`window.uiManager.showToast`):**
   - Contenedor flotante en z-index máximo (`2147483647`).
   - Glassmorphism con bordes y sombra dual-theme `border-radius: 9999px`.
   - Tipos semánticos: `'success'`, `'error'`, `'warning'`, `'info'`, `'life'`.
   - **Autoridad Visual Única:** Sanitiza automáticamente cualquier emoji inicial en el mensaje para garantizar que el icono semántico (`hub-toast-icon`) sea la única representación gráfica limpia, eliminando redundancias visuales.
3. **Notificación de Vidas en Tiempo Real (`window.uiManager.showLifeDecrementToast`):**
   - Cada consumo de crédito en cuentas Free dispara instantáneamente un toast con rayo dorado:  
     `1 crédito utilizado. Te quedan X/10 vidas de prueba.`
   - Si quedan 1 o 2 vidas: `¡Atención! Te quedan solo X/10 vidas de prueba.` (Toast de advertencia).
   - Al agotarse las vidas (`remaining <= 0`): `Has agotado tus vidas de prueba semanal.` y apertura automática del `PaywallModal`.

---

## 11. 💬 Sistema Centralizado de Tooltips y Onboarding Guía (`TooltipManager`)

La plataforma cuenta con un gestor universal de tooltips declarativos y guías interactivas para onboarding de nuevos usuarios y visitantes:

1. **Tooltips Declarativos Universales (`.hub-tooltip`):**
   - Se activan mediante atributos `data-tooltip="Mensaje explicativo"` y `data-tooltip-pos="top|bottom|left|right"`.
   - Soporte Dual-Theme automático consumiendo `--card-bg`, `--text-main`, `--border-color` y `--shadow-md`.
   - Compatibilidad total con pantallas táctiles (apertura por tap y cierre al tocar fuera).
2. **Guías de Onboarding Interactivas (`.hub-guided-tip`):**
   - Burbuja flotante con badge indicativo (`.hub-guided-badge`), título destacado, descripción concisa y botones de acción ("Siguiente paso", "Entendido", "✕").
   - Resaltado visual pulsante sobre el elemento objetivo (`.hub-guided-target-pulse`).
   - Tour guiado en 2 pasos para el simulador (`startSimulatorTour`), que orienta a los visitantes en la configuración de meta y la selección de modos de estudio.
   - Botón de ayuda persistente en la cabecera (`.btn-guide-help` / `#btn-show-guide`) para reactivar la guía en cualquier momento.
3. **Tooltips Explicativos de KPIs (`.kpi-info-container` / `.kpi-tooltip-content`):**
   - Tarjetas informativas de gráficos accesibles tanto mediante `:hover` en PC como mediante `click`/`tap` en celulares.

---

## 12. 📐 Motor Universal de Tipografía Matemática, Científica y Notación Química (KaTeX + MarkdownRenderer)

La plataforma cuenta con un canal de renderizado matemático y científico unificado de alta fidelidad, gobernado centralmente por `MarkdownRenderer` y la biblioteca KaTeX:

### 12.1. Delimitadores Estándar y Soporte Notacional
* **Fórmulas Inline ($...$ o \(...\)):** Para variables, potencias y expresiones dentro del flujo del texto (ej. `$x^2$`, `$\int f(x) dx$`, `$\frac{a}{b}$`, `$n = 2$`).
* **Ecuaciones en Bloque Display ($$...$$ o \[...\]):** Para deducciones, fórmulas complejas y pasos de cálculo centrados horizontalmente (ej. `$$\int x^n dx = \frac{x^{n+1}}{n+1} + C \quad (n \neq -1)$$`).
* **Notación Química:** Soporte para fórmulas y reacciones estricto con `$\mathrm{H_2O + CO_2 \rightarrow H_2CO_3}$`.
* **Alfabeto Griego y Operadores:** Soporte completo para $\alpha, \beta, \gamma, \delta, \theta, \pi, \sigma, \omega, \infty, \pm, \neq, \le, \ge, \rightarrow$.

### 12.2. Arquitectura de Ciclo de Vida y Seguridad (XSS vs KaTeX)
1. **Pre-extracción y Aislamiento:** `_extractMath()` aísla los bloques matemáticos antes de que `marked.js` los procese, evitando que los guiones bajos (`_` de subíndices) o asteriscos (`*` de multiplicación) sean mutilados como cursivas o negritas.
2. **Sanitización DOM XSS:** `_sanitizeDom()` purga código malicioso del cuerpo Markdown plano antes de inyectar las ecuaciones, protegiendo las coordenadas geométricas espaciales (`style="top:..."`) que KaTeX requiere para el posicionamiento exacto de numeradores y denominadores.
3. **Salida Pura HTML:** KaTeX se compila con `output: 'html'`, garantizando renderizado instantáneo sin discrepancias de MathML.
4. **Contenedor Responsivo (`.katex-display-wrapper`):** Envuelve las ecuaciones en bloque con desplazamiento horizontal táctil (`-webkit-overflow-scrolling: touch`), evitando cualquier desbordamiento visual en teléfonos móviles.

### 12.3. Consistencia Unificada en Todas las Vistas
El mismo canal de renderizado rige de manera homogénea en:
* **Tutor IA en Simulador (`quiz-tutor.js`)** y **Tutor IA en Flashcards (`tutor-chat.js`)**.
* **Modal de Notas de Mi Biblioteca (`libraryUI.js`)**.
* **Tarjetas de Flashcards y Mazos de Repaso (`flashcards.js`, `repaso.js`)**.
* **Visualizador de Recursos Educativos (`resource.js`)**.
* **Panel de Administración y Previsualización (`admin.js`)**.

---

## 13. 🖥️ Arquitectura y Estándar Visual del Panel de Gestión / Administración (Admin Panel) & Subcontenedores Avanzados de Modales

El Panel de Gestión (`/admin`, `admin.html`, `admin.js`, `admin.css`) es la consola maestra de administración de Hub Academia. Su arquitectura visual y funcional debe mantener paridad estricta con el resto del ecosistema mediante el Dual-Theme Engine, adaptación responsiva extrema y diseño modular.

### 13.1. Layout del Panel y Contenedor Maestro
* **Contenedor Maestro (`.admin-container`):** `max-width: 1440px; margin: 0 auto; padding: 1.5rem 1.75rem; width: 100%; box-sizing: border-box;`. En dispositivos móviles (`<= 768px`) reduce el padding a `1rem 0.75rem` para maximizar el ancho útil sin generar desbordamiento lateral.
* **Barra de Pestañas con Desplazamiento Táctil (`.admin-tabs`):**
  * Desplazamiento horizontal nativo en pantallas estrechas: `overflow-x: auto; -webkit-overflow-scrolling: touch; display: flex; gap: 8px; scrollbar-width: none;`.
  * Pestañas `.tab-link`: Fondo transparente o `var(--surface-hover)`, radio `10px`, padding `0.65rem 1.1rem`, tipografía `0.88rem` SemiBold (600), texto en `var(--text-secondary)`.
  * **Estado Activo (`.tab-link.active`):** Fondo `var(--bg-tertiary)`, color `var(--primary)`, borde inferior activo o contorno de acento de 2px, garantizando contraste 100% nítido en modo claro (`#2563eb` sobre fondo Slate) y modo oscuro (`#3b82f6` sobre Matte Black).
* **Contenedor de Contenido (`.tab-content`):** Transición suave entre pestañas con display condicional (`display: none` / `display: block`).

### 13.2. Controles de Cabecera, Buscador Universal y Filtros Dinámicos
* **Barra de Herramientas (`.tab-header-controls`):** Flexbox adaptativo con `display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;`.
* **Agrupador de Búsqueda y Orden (`.search-sort-wrapper`):** Flexbox con `display: flex; gap: 10px; align-items: center; flex-wrap: wrap; flex: 1; min-width: 280px;`.
* **Buscador Universal (`.admin-search-input`):**
  * Contenedor `.search-bar-container` con icono FontAwesome a la izquierda `16px`, input con `background: var(--input-bg); border: 1px solid var(--input-border); color: var(--input-text); border-radius: 10px; height: 40px; padding-left: 2.25rem;`.
  * **Placeholders Contextuales por Pestaña:**
    * Alumnos (`tab-students`): `"Buscar por nombre o correo..."`.
    * Recursos (`tab-books`): `"Buscar recursos..."`.
    * General: `"Buscar..."`.
  * **Algoritmo de Búsqueda Multiatributo (`applySearchFilterForTab`):** Evalúa concurrentemente `item.textContent`, `item.dataset.email` y `item.dataset.name` para coincidencias instantáneas sin peticiones redundantes a la base de datos.
* **Filtros Selectores (`.admin-type-filter`, `.tab-sort-select`):** Altura estándar `40px`, radio `10px`, fondo `var(--input-bg)`, borde `var(--input-border)`, color `var(--text-main)`.

### 13.3. Tarjetas de Elementos de Administración (`.admin-item-card`)
* **Superficie de Tarjeta:** Fondo `var(--card-bg)`, borde `1px solid var(--border-color)`, radio `14px`, padding `1rem 1.25rem`, sombra suave `var(--shadow-sm)`.
* **Checkbox Masivo (`.admin-item-checkbox-wrapper`):** Contenedor a la izquierda con checkbox personalizado de `18x18px` para selección y ejecución de operaciones en bloque (eliminación masiva, encadenamiento de casos).
* **Thumbnail de Previsualización (`.admin-item-thumbnail`):** Cuadrado de `44x44px` con radio `8px`, fondo `var(--bg-tertiary)`, borde `1px solid var(--border-color)`, imagen optimizada WebP o fallback iconográfico `<i class="fas fa-image-slash"></i>`.
* **Cuerpo de Información (`.item-card-content`):**
  * Título principal: tipografía `0.95rem` SemiBold (600), `line-height: 1.4`, color `var(--text-main)`.
  * Subtítulos: tipografía `0.82rem`, color `var(--text-muted)`.
* **Semáforo de Tres Puntos en Recursos (`.admin-item-indicators`):**
  * Punto Dorado / Corona (`.premium-badge`): Acceso Premium que descuenta vidas a usuarios gratuitos.
  * Punto Verde / Ojo (`.visibility-badge`): Recurso activo y visible en el catálogo de estudiantes.
  * Punto Azul / Rayo (`.direct-badge`): Apertura directa e inmersiva en visor modal (omite página de detalle).
* **Sistema Estandarizado de Badges Semánticos (`.admin-badge`):**
  * `.admin-badge-blue`: Azul marca (`var(--primary)` translúcido), usado para Plan BASIC y dominio EDUCACIÓN.
  * `.admin-badge-purple`: Violeta/Índigo translúcido, usado para Plan ADVANCED y casuísticas.
  * `.admin-badge-green`: Esmeralda translúcido, usado para estado ACTIVE, dominio SALUD y contador de preguntas.
  * `.admin-badge-danger`: Carmesí translúcido con texto `#f87171`, usado para estado EXPIRED y avisos críticos.
  * `.admin-badge-muted`: Slate neutro (`var(--bg-tertiary)`), usado para Plan FREE, nombres de curso y fecha de caducidad (`📅 Expira: DD/MM/AAAA`).
  * `.admin-badge-cyan`: Cian translúcido, usado para nombres de tema o etiquetas pedagógicas.

### 13.4. Arquitectura Avanzada de Modales del Panel de Gestión (`.modal`, `.modal-content`)
Todas las modales operadas por `openGenericModal()` y `saveGenericForm()` se adhieren al siguiente estándar universal:
* **Erradicación de Colores Rígidos:** Prohibido el uso de `#0f0f13` o fondos oscuros hardcodeados. El cuerpo modal consume estrictamente:
  ```css
  background: var(--modal-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  box-shadow: var(--shadow-xl);
  ```
* **Regla Estructural de Padding Cero (`padding: 0 !important`):**
  El contenedor `.modal-content` debe poseer `padding: 0 !important; display: flex; flex-direction: column; overflow: hidden;` para que `.modal-header`, `.modal-body` y `.modal-footer` anclen de borde a borde sin espacios muertos ni doble padding.
* **Scroll Confinado a `.modal-body`:**
  * `.modal-body` cuenta con `overflow-y: auto; flex: 1; min-height: 0; padding: 1.5rem;`.
  * Barra de desplazamiento estandarizada: `scrollbar-width: thin; scrollbar-color: var(--border-color) transparent;`.
  * **Regla Crítica:** Queda estrictamente prohibido que la barra de desplazamiento rebase hacia el header o el footer, o que existan contenedores anidados con scrolls redundantes.

### 13.5. Subcontenedores Internos dentro de las Modales
* **1. Tarjetas de Selección de Método (`.import-method-card`):**
  * Fondo `var(--bg-tertiary)`, borde `1px solid var(--border-color)`, radio `12px`, padding `1.25rem`.
  * Micro-interacción: Al posar el cursor, aplica elevación `transform: translateY(-2px)`, borde iluminado en `var(--primary)` y halo suave.
* **2. Contenedores Condicionales de IA (`#ai-domain-container`, `.ai-specialty-container`):**
  * Fondo `var(--bg-tertiary)`, borde `1px solid var(--border-color)`, esquinas redondeadas `12px`, padding `1rem 1.25rem`.
  * Checkboxes de área estilizados como pills interactivas con `display: flex; align-items: center; gap: 8px;`.
* **3. Chips de Elementos Seleccionados (`.selected-chip`):**
  * Fondo `var(--bg-tertiary)` con borde `1px solid var(--border-color)`, radio `8px`, padding `6px 12px`.
  * Texto de alto contraste obligatorio: `color: #ffffff !important;` en modo oscuro y Slate en modo claro.
  * Botón de deselección con cruz accesible `fa-times` y hover interactivo.
* **4. Zona de Carga y Acciones de Imágenes (`.image-upload-actions`, `.image-preview-wrapper`):**
  * Contenedor flex con `display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 8px;`.
  * Previsualización con marco redondeado de `10px`, borde dinámico `var(--border-color)`.
  * Botón de eliminación de imagen con token de peligro oficial `var(--danger)` (prohibido variables huérfanas como `--danger-color`).
* **5. Switches Estilo iOS (`.switch-container`, `.switch-slider`):**
  * Track en `var(--bg-tertiary)`, borde `1px solid var(--border-color)`, slider activo en `var(--primary)` (o ámbar `--warning` para Acceso Premium).

### 13.6. Adaptabilidad Móvil y Colapso Automático de Cuadrículas
* **Ancho Perimetral Seguro en Dispositivos Móviles:**
  * En pantallas medianas y tabletas (`@media (max-width: 768px)`):
    ```css
    .modal-content {
        width: calc(100% - 20px) !important;
        max-width: calc(100% - 20px) !important;
        margin: 10px auto !important;
    }
    ```
  * En celulares ultracompactos (`@media (max-width: 480px)`):
    ```css
    .modal-content {
        width: calc(100% - 16px) !important;
        max-width: calc(100% - 16px) !important;
        margin: 8px auto !important;
    }
    ```
* **Colapso Mandatorio de Grillas Internas:**
  Toda grilla interna declarada con `grid-template-columns: 1fr 1fr;` (ej. campos en dos columnas como Tipo/Sector, Tier/Estado, opciones A/B/C/D) colapsa obligatoriamente a una columna fluida en móvil para evitar que los inputs o selects queden comprimidos o desborden el contenedor:
  ```css
  @media (max-width: 768px) {
      .modal-body div[style*="grid-template-columns"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
      }
  }
  ```

### 13.7. Editor Científico TinyMCE 6 Dual-Theme Dinámico (`getStandardTinyMCEConfig`)
* **Detección Reactiva de Tema:**
  ```javascript
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  ```
* **Configuración Diferencial de Skins y Contenido:**
  * **Modo Oscuro (Matte Black 🌙):**
    * `skin: 'oxide-dark'`, `content_css: 'dark'`.
    * Fondo de redacción `#0a0a0a` / `#121212`, tipografía `#ffffff` / `#f8fafc`.
  * **Modo Claro (Studio Slate ☀️):**
    * `skin: 'oxide'`, `content_css: 'default'`.
    * Fondo de redacción `#ffffff`, tipografía `#0f172a`.
* **Sanitización y Carga de Medios:** Las imágenes pegadas (`Ctrl+V` o Base64) se interceptan y suben exclusivamente al guardar a Google Cloud Storage (GCS) en formato WebP, impidiendo payloads pesados en base de datos.

### 13.8. Modal Canónica de Confirmación (`#confirmation-modal` / `.confirmation-modal-card`)
La modal universal de confirmación implementa una jerarquía accesible de alta legibilidad:
* **Estructura Estricta:**
  * Contenedor tarjeta: `.confirmation-modal-card` con `max-width: 440px; border-radius: 20px;`.
  * Cabecera: `.confirmation-modal-header` con `.confirmation-title-wrap` e icono semántico en contenedor `.confirmation-modal-icon` (interrogación azul, advertencia ámbar, peligro rojo, éxito verde).
  * Botón de cierre: `.modal-close-btn` con atributo accesible `aria-label="Cerrar modal"`.
  * Cuerpo: `.confirmation-modal-body` con mensaje tipográfico en `var(--text-secondary)`.
  * Pie: `.confirmation-modal-footer` con botón secundario `.btn-secondary` ("Cancelar") a la izquierda y primario `.btn-primary` ("Confirmar") a la derecha.

### 13.9. Arquitectura y Reglas de la Pestaña de Gestión de Alumnos / Usuarios
* **Autenticación Exclusiva Google OAuth:**
  * Hub Academia opera exclusivamente mediante **Google OAuth** (`signInWithIdToken` / `signInWithOAuth`).
  * Los alumnos creados por el administrador en el panel acceden directamente autenticándose con su correo Google. Se erradica por completo el concepto de contraseñas locales o botones rotos de reseteo.
* **Sincronización Bidireccional de Suscripciones:**
  * **Frontend Dinámico (`admin.js`):**
    * Seleccionar `Plan Básico` fuerza estado `Activo` y fecha actual + 2 meses.
    * Seleccionar `Plan Avanzado` fuerza estado `Activo` y fecha actual + 4 meses.
    * Seleccionar `Gratuito (Free)` fuerza estado `Inactivo/Pending` y vacía la fecha.
    * Cambiar manualmente a `Inactivo` o `Expirado` degrada el tier a `Free` y limpia la fecha.
  * **Backend Atómico (`adminService.js`):**
    * Red de seguridad de negocio (`resolveSubscriptionConsistency`): fuerza consistencia de tiers y calcula expiración (+2m basic, +4m advanced) si no fue enviada.
    * **Fidelización Automática:** Al activar un usuario (`subscriptionStatus: 'active'`), se restablecen a cero (`0`) todos los contadores de consumo (`usageCount = 0`, `dailyAiUsage = 0`, `dailyRagUsage = 0`, `dailySimulatorUsage = 0`, `monthlyFlashcardsUsage = 0`) para garantizar un ciclo de membresía limpio e íntegro.
