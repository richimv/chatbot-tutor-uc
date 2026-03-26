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

- **Activos Locales**: Si el path comienza con `assets/`, la función devuelve la ruta relativa, sirviendo el archivo desde el servidor web local (Render/Vercel).
- **Activos en la Nube**: Si el path no es local ni una URL absoluta (http/https), se transforma automáticamente en una petición autenticada al proxy de GCS.

```javascript
// Lógica simplificada en config.js
window.resolveImageUrl = function(path) {
    if (path.startsWith('assets/')) return path; // Servir local
    return `${API_URL}/api/media/gcs?path=${encodeURIComponent(path)}&token=${jwt}`; // Servir GCS
}
```

## 3. Visor de Medios Maestro (`MediaViewer`) 🩺
Implementado en `uiManager.js`, el `MediaViewer` es un componente premium para la visualización de recursos:

- **Compatibilidad**: Soporta imágenes de alta resolución, infografías y mapas médicos.
- **Funcionalidades**: Controles de Zoom, desplazamiento infinito y botón de descarga directa.
- **Activación**: Se dispara automáticamente en tarjetas de recursos, buscador y biblioteca privada cuando se detecta un formato de imagen.

## 4. Integración en Administración 🛠️
El panel de control (`admin.js`) ha sido optimizado para simplificar el flujo de trabajo:

- **Modo Dual**: Permite subir un archivo local (que el backend subirá a GCS o Local Assets) o referenciar una URL manual.
- **Fallback Automático**: Si un administrador sube una imagen pero deja el campo "URL del Recurso" vacío, el sistema asigna automáticamente la ruta de la imagen como el enlace del recurso.
- **Live Preview**: Validación visual inmediata antes de persistir los cambios.

## 5. Verificación de Uso (UsageService) 🔍
Cada vez que se accede a un recurso premium, el sistema realiza una verificación en terminal:
`🔍 [UsageService] Verificando: [USER_ID]`

### Preguntas Frecuentes:
- **¿Por qué verifica si soy Advanced?**: Por seguridad y trazabilidad. El sistema valida que la sesión sea activa y el token válido antes de servir el recurso.
- **¿Consume "vidas" o pases?**: **NO.** Para usuarios con planes `Basic` o `Advanced`, el controlador `UsageService.js` detecta el *Tier* y concede acceso inmediato sin incrementar el contador `usageCount`. Solo los usuarios con plan `Free` descuentan un pase diario al abrir recursos premium.

---
*Ultima edición: Marzo 2026 - Implementación de Acceso Universal a Medios.*
