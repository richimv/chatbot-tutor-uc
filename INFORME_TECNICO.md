# 📄 Informe Técnico: Reestructuración y Seguridad de Recursos en Hub Academia

Este documento detalla los importantes cambios arquitectónicos realizados en la plataforma para unificar la renderización de recursos y asegurar un flujo de *Paywall* / *Auth* estrictamente controlado para usuarios Visitantes, Freemium y Premium.

## 🎯 1. Single Source of Truth para UI de Recursos

Previamente, las tarjetas de recursos (*Documents*, *Books*, *Videos*) se generaban de formas dispersas en diferentes archivos (`category.js`, `course.js`, `search.js`), lo que generaba inconsistencias visuales y parches de seguridad.

### Solución:
Hemos consolidado la lógica en dos funciones maestras ubicadas en `/js/ui/components.js`:
- `createUnifiedResourceCardHTML(item)`: Empleada para *Libros*, *Documentos* y *Papers*.
- `createVideoCardHTML(video)`: Empleada estrictamente para *Videos*.

**Impacto:** Cualquier cambio de diseño, icono premium (👑), candado (🔒) o comportamiento al hacer click, se propaga instantáneamente a todas las carruseles, búsquedas y páginas de cursos de la plataforma.

## 🔒 2. Seguridad Síncrona vs Race Conditions

Anteriormente, la plataforma mostraba el icono de candado basándose en estados asíncronos que provocaban un "parpadeo" o mostraban el candado a usuarios Premium por milisegundos.

### Solución (`uiManager.js` & `components.js`):
Ahora la renderización evalúa *síncronamente* el estado de autenticación leyendo directamente de `localStorage` al momento de dibujar el HTML. 

```javascript
// Lógica Extraída
const authToken = localStorage.getItem('supabase.auth.token');
const isLogged = !!authToken;
let hasAccess = false;

if (isLogged) {
    // Si es Premium o Freemium con Vidas, tiene acceso a visualizarlo sin candado
    if (userPlan === 'premium' || (userPlan === 'freemium' && userLives > 0)) {
        hasAccess = true;
    }
}
```
Esto garantiza que los candados premium jamás fastidien a quienes tienen una suscripción o pase válido.

## 🛑 3. Delegación de Eventos: `unlockResource`

Antes los usuarios podían bypassear el "Paywall" si hacían "click derecho -> abrir enlace".

### Solución:
Ninguna tarjeta expone la etiqueta `href` directa hacia su contenido subyacente de ser *is_premium = true*. 
En su lugar, inyectan el evento: `onclick="window.uiManager.unlockResource(id, type, isPremium)"`

Esta función intermedia en `uiManager.js` actúa como el **Gran Guardián**:
1. Comprueba si el usuario está Logueado. Si no, lanza el modal *"Únete a Hub Academia"*.
2. Comprueba si el recurso es Premium.
3. Si lo es, revisa si es *Freemium*. Si lo es, evalúa si tiene *vidas* (`free_trials`).
4. **Cero vidas?** Lanza el modal *"Te encantó la prueba"* (Membresía).
5. **Tiene vidas?** Resta 1 vida, y navega recién al visualizador de PDF/Video.

## 🛠 4. Fix del Payload Backend en Repositorio de Cursos

Un bug crítico causaba que dentro del detalle de los cursos, los recursos no funcionaran a pesar de tener la función `unlockResource`. 

### Solución en `CourseRepository.js`:
El backend construía un `JSON_BUILD_OBJECT` en PostgreSQL omitiendo declarar la llave `r.is_premium`. Se parcheó la base de datos para que la Query inyecte `'is_premium', r.is_premium` asegurando que el Frontend entienda cuándo detener al usuario.

## 🖼 5. Reorganización de Módulos (UI)

Se reasignó la sección *"Cursos Populares"* al lugar ideal sugerido (`search.js`), intermedio entre la invocación del *"Hub Quiz Arena"* y las *"Áreas de Estudio"*. También, los botones principales del centro de llamadas *"Bibliotecas Oficiales"* se actualizaron utilizando portadas en `background-image` fotográficas consumidas sobre la red con efecto graduado lineal (Linear Gradient) para denotar calidad y esteticidad superior.

---
**Elaborado en el ciclo actual de actualizaciones** - *Hub Academia (2026)*