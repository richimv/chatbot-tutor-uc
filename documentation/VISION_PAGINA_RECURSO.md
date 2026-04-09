# 📘 Visión Técnica: Suite de Experiencia de Recursos (Página de Destino & Visor Inmersivo)

## 1. Objetivo del Proyecto
Transformar la navegación de la biblioteca de un simple listado de archivos en una **Enciclopedia Médica Interactiva**. El objetivo es que cada recurso (libro, guía, video) tenga su propio espacio informativo antes de ser abierto, mejorando la retención del usuario y la organización del conocimiento.

---

## 2. Flujo de Navegación (User Journey)
1.  **Descubrimiento:** El usuario encuentra una tarjeta en la "Home" o "Biblioteca".
2.  **Información Progresiva:** Al hacer clic, NO se abre el archivo; se navega a la **Página de Destino del Recurso** (`/resource?id=71`).
3.  **Estudio Inmersivo:** Solo cuando el usuario está listo, hace clic en "Ver/Estudiar" para abrir el **Visor Full-Screen**.

---

## 3. Anatomía de la Página de Recurso (Layout Premium)

Esta página se divide en dos secciones principales diseñadas para una lectura limpia y profesional:

### A. Columna de Control (Izquierda / Top en Mobile)
*   **Hero Preview:** Imagen de portada grande con efecto de "Libro" (E-book style).
*   **Acciones Principales:**
    *   **Botón [Ver / Estudiar]:** Dispara el visor inmersivo.
    *   **Botón [Descargar]:** Descarga directa del archivo original desde GCS.
    *   **Botón [Guardar]:** Añade el recurso a "Mis Guardados" de la biblioteca personal.
*   **Metadatos Clave:** Título principal en H1 y Nombre del Autor/Institución.

### B. Cuerpo de Conocimiento (Derecha / Bottom en Mobile)
*   **Resumen Wikipedia-Style:** Un área de texto enriquecido (HTML) editada manualmente por el administrador.
*   **Contenidos:** 
    *   Explicaciones extendidas del recurso.
    *   Cuadros comparativos o tablas de datos clave.
    *   Imágenes integradas dentro del texto para reforzar el aprendizaje.
*   **Formato:** Limpio, con tipografía optimizada para lectura larga y estructura jerárquica clara.
*   **Tablas Inteligentes:** Implementación de contenedores responsivos (`table-responsive-wrapper`) que permiten el desplazamiento lateral de tablas complejas (10+ columnas) sin romper el diseño, garantizando legibilidad total en dispositivos móviles.
*   **Optimización Móvil:** Botones minimalistas y tipografía escalada para evitar el ruido visual y maximizar el área de lectura.

---

## 4. El Visor Inmersivo Universal (Full Screen)

Cuando se activa el modo "Estudiar", el sistema despliega una capa superior táctil y responsive:

*   **Alcance:** Compatible con PDFs, Vídeos (MP4/WebM), Presentaciones (PPTX) y Documentos (DOCX) almacenados en GCS.
*   **Propiedad:** El visor sirve archivos directamente desde nuestro Bucket para garantizar que el usuario nunca abandone el dominio `hubacademia.com`.
*   **Interfaz:** 
    *   Fondo oscuro (Dark Mode) con desenfoque de fondo.
    *   Controles flotantes minimalistas (Zoom, Cerrar, Página siguiente).
*   **Integración IA (Chat):**
    *   El Chat de Tutoría estará disponible en un panel lateral.
    *   **Limitación Actual:** La IA no procesará el documento completo por razones de costo y latencia; funcionará como el chat actual, apoyando al alumno mientras lee.

---

## 5. Decisiones Técnicas y Buenas Prácticas
*   **Escalabilidad:** Al tener una página dedicada por recurso, podemos aplicar SEO en el futuro y medir qué materiales son los más leídos con analítica de precisión.
*   **Rendimiento:** Solo se carga el visor pesado (PDF/Video) bajo demanda del usuario, ahorrando datos y carga inicial.
*   **Resguardo:** Los enlaces externos (fuera de nuestra propiedad) siempre se abrirán en una pestaña nueva como fallback de seguridad.

---

> [!IMPORTANT]
> **Estado de Implementación:** Completado. La arquitectura de visualización de recursos está operativa, incluyendo el editor enriquecido TinyMCE 6 para la gestión de contenidos y el sistema de renderizado responsivo para datos complejos.
