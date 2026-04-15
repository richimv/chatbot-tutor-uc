# Arquitectura de Almacenamiento Universal (GCS & Assets) 🏗️🛡️✨

Esta documentación detalla la implementación del sistema de gestión de medios (imágenes, infografías, esquemas) utilizando Google Cloud Storage (GCS) de forma integrada con los activos locales.

## 1. Arquitectura de Acceso (Proxy Seguro) ⚙️
Para evitar la exposición de buckets públicos y gestionar la autenticación, se utiliza un controlador proxy en el backend.

- **Endpoint**: `/api/media/gcs`
- **Controlador**: `mediaController.js`
- **Seguridad**: Solo usuarios con JWT válido pueden solicitar imágenes.
- **Optimización de Renderizado**: El servidor envía la cabecera `Content-Disposition: inline` para asegurar que el navegador visualice la imagen en lugar de forzar la descarga.

## 2. Resolución Inteligente de URLs (Frontend) 🧠
En `config.js`, la función `window.resolveImageUrl(path)` actúa como el orquestador universal:

- **Activos Locales (Legacy)**: Si el path comienza con `assets/`, la función devuelve la ruta relativa, sirviendo el archivo desde el servidor web local. Estos archivos aún existen para dar soporte a contenido antiguo.
- **Activos en la Nube (Estándar)**: Si el path no es local ni una URL absoluta (http/https), se transforma automáticamente en una petición al proxy de GCS.

---

## 3. Flujo de Administración (Carga a la Nube) ☁️
A partir de la actualización de Marzo 2026, el flujo de trabajo ha sido centralizado:

### **Botón "Subir Local" (Icono 📤)**
> [!IMPORTANT]
> **Todo archivo cargado mediante este botón ahora se sube EXCLUSIVAMENTE a Google Cloud Storage**. El sistema ya no guarda archivos físicamente en la carpeta `/assets` del servidor, garantizando escalabilidad infinita y persistencia ante reinicios del cloud (Render/Vercel).

### **Asignación Manual**
- Puedes escribir una ruta de GCS (ej: `my-internal-file.jpg`) o una URL externa.
- **Legacy**: Aún es posible escribir `assets/imagen.png` si el archivo ya existe físicamente en el servidor, pero este método está **depreciado** para contenido nuevo.

### **Integración Automática con TinyMCE (Portapapeles)**
- Si el administrador pega (`Ctrl+V`) una imagen directamente en el cuerpo del editor **TinyMCE**, el panel intercepta nativamente el archivo binario, lo sube automáticamente en segundo plano a Google Cloud Storage transformándolo en WebP de alta fidelidad, e incrusta de inmediato el enlace público (CDN) en el texto. Esto significa que **arrastrar, soltar o pegar capturas de pantalla funciona de la misma forma mágica que en Word**, pero subiendo a la nube de manera blindada.

## 4. Integración en Administración 🛠️
El panel de control (`admin.js`) ha sido blindado para la integridad de datos:
- **Protección de Datos**: Los campos como `career`, `subtopic` y las 5 opciones de Residentado están protegidos contra sobreescrituras accidentales con `null`.
- **Selector Seguro**: El examen objetivo (Target) es ahora un selector fijo para evitar errores de tipeo que corrompan el banco de preguntas.
- **Feedback Visual Inmediato**: Un check verde ✅ y el nombre del archivo confirman que la imagen está lista antes de guardar.
- **Gestión Dual**: El banco de preguntas ahora soporta imágenes independientes para el Enunciado y la Explicación, ambas con gestión automatizada de GCS.

## 5. Optimización y Procesamiento WebP (High-Fidelity) 🖼️⚡
Para garantizar un equilibrio entre rendimiento y calidad visual (crítica en contenido médico), el sistema procesa todas las imágenes cargadas mediante `sharp`:

- **Formato**: Conversión forzada a **WebP**.
- **Dimensiones**: Redimensionamiento inteligente con un ancho máximo de **1600px**.
- **Calidad**: Factor del **85%** con *Smart Subsampling* y preservación de metadatos (`.withMetadata()`).

## 6. Gestión del Ciclo de Vida y Limpieza Proactiva 🗑️🛡️
El sistema implementa una política de "Zero-Orphan" para optimizar costos:

- **Borrado por Reemplazo**: Al actualizar una imagen, el archivo antiguo se elimina físicamente de GCS antes de subir el nuevo.
- **Borrado Explícito (UI)**: Botones de papelera en la administración activan el borrado físico (`deleteImage: true`).
- **Fail-Safe**: Si se vacea manualmente el campo de URL, el backend dispara la limpieza de GCS automáticamente.
- **Cascada**: Al borrar una entidad, sus archivos asociados en GCS son eliminados de forma atómica.

## 7. Costos y Capa Gratuita (Free Tier) 📊💰
- **Almacenamiento**: 5 GB gratis al mes.
- **Operaciones**: 5,000 (A) y 50,000 (B) gratuitas. El sistema usa caché para minimizar transacciones.

---
*Estado del Sistema: Infraestructura de medios 100% profesional, optimizada y auto-limpiable.* 🚀✨
