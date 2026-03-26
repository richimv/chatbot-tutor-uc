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

## 4. Integración en Administración 🛠️
El panel de control (`admin.js`) ha sido blindado para la integridad de datos:
- **Protección de Datos**: Los campos como `career`, `subtopic` y las 5 opciones de Residentado están protegidos contra sobreescrituras accidentales con `null`.
- **Selector Seguro**: El examen objetivo (Target) es ahora un selector fijo para evitar errores de tipeo que corrompan el banco de preguntas.
- **Feedback Visual Inmediato**: Un check verde ✅ y el nombre del archivo confirman que la imagen está lista antes de guardar.

---

## 5. Costos y Capa Gratuita (Free Tier) 📊💰
- **Almacenamiento**: 5 GB gratis al mes.
- **Operaciones**: 5,000 (A) y 50,000 (B) gratuitas. El sistema usa caché para minimizar estas operaciones.

---
*Estado del Sistema: Infraestructura de medios 100% profesional en la nube.* 🚀✨
