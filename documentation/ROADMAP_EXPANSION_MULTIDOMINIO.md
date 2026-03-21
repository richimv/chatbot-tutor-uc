# 🚀 Roadmap Estratégico: Hub Academia v3.0 (Expansión Multi-Dominio)

**Versión:** 1.0  
**Estado:** Propuesta de Arquitectura y Escalabilidad  
**Enfoque:** Transición de EdTech Médico a Plataforma Educativa Global.

---

## 1. 🎯 Visión de la Fase v3.0

El objetivo es transformar la infraestructura actual de **Hub Academia** en un motor educativo agnóstico al dominio, permitiendo la coexistencia de múltiples facultades (Medicina, Idiomas, Educación) bajo un mismo núcleo tecnológico.

### Dominios de Expansión Prioritarios:
1.  **Idiomas (Language Hub):** Práctica inmersiva de Inglés e Italiano.
2.  **Educación (Docente Pro):** Preparación para exámenes de Nombramiento y herramientas de productividad magisterial.
3.  **Habilidades Blandas / Otros:** Repaso espaciado universal (Flashcards).

---

## 🏗️ 2. Arquitectura de Desacoplamiento (Domain-Aware)

Para evitar duplicar código, la plataforma evolucionará hacia una arquitectura centrada en **Dominios Dinámicos**.

### 2.1. Capa de Datos (PostgreSQL)
Las tablas `question_bank` y `documents` ya cuentan con la columna `domain`. Los nuevos registros deben seguir este estándar:
- `domain = 'medicine'` (Actual)
- `domain = 'languages'` (Nuevo)
- `domain = 'education'` (Nuevo)

### 2.2. Motor de IA Híbrido (RAG Especializado)
El `TrainingService.js` debe implementar una fábrica de prompts basada en el dominio seleccionado:
- **Medicina:** Enfoque en GPC, NTS y casos clínicos.
- **Idiomas:** Enfoque en niveles MCER (A1-C2), gramática y modismos.
- **Educación:** Enfoque en el Currículo Nacional y Ley de Reforma Magisterial.

---

## 📚 3. Módulos y Funcionalidades Nuevas

### 3.1. Idiomas (English & Italian Mastery)
- **Arena de Idiomas:** Retos rápidos de vocabulario y traducción. La IA genera escenarios de "Roleplay" donde el usuario debe completar diálogos.
- **Tutor de Gramática:** El Chat detectará errores gramaticales en la pregunta del usuario y ofrecerá correcciones antes de responder (Feedback Inmediato).
- **Audio-Flashcards:** Integración de TTS (Text-to-Speech) para que las tarjetas de repaso incluyan pronunciación nativa.

### 3.2. Docente Pro (Asistente Magisterial)
Este módulo se divide en dos sub-áreas:
- **Simulador de Evaluación:** Preparación para Nombramiento Docente (Simulacros Oficiales).
- **IA de Productividad (Lesson Planner):**
    - Generación de **Sesiones de Clase** alineadas a competencias.
    - Creación de **Rúbricas** de evaluación personalizadas.
    - Descarga de **Plantillas** y materiales educativos en PDF.

---

## 🎨 4. UX/UI: El Dashboard "Contexto-Consciente"

El `simulator-dash.js` debe evolucionar para detectar el perfil del usuario:
- **Selector de Facultad:** Un menú persistente en el Header que cambie el "Ecosistema" (Ej: Cambiar de Medicina a Idiomas).
- **Personalización de Tarjetas:** En el modo "Docente", aparecerá un acceso destacado a la "Zona de Planeamiento", mientras que en "Idiomas" se priorizará el "Laboratorio de Escucha".

---

## 🚀 5. Hoja de Ruta Técnica (Próximos Pasos)

### Fase 1: Ingesta Masiva (Seeds)
- Carga inicial de bancos de preguntas oficiales de Idiomas y Educación vía `adminBulkUpload`.
- Vectorización de documentos clave de Educación (RAG Educativo).

### Fase 2: Lógica de Negocio (Backend)
- Refactorizar `checkLimitsMiddleware.js` para manejar cuotas diferenciadas por Dominio (Ej: Mensajes de Chat Medicina vs Mensajes de Chat Idiomas).
- Adaptar `TrainingService.js` para soportar `target` de tipo Idiomas/Nombramiento.

### Fase 3: Módulo de Creación Docente
- Crear el endpoint `/api/tools/lesson-planner` que utilice Gemini 2.5 Pro para generar documentos de alta extensión y coherencia pedagógica.
- Implementar generador de PDF para las sesiones generadas.

---

## ⚖️ Conclusión Senior
La clave del éxito en esta fase es **evitar la fragmentación**. No se deben crear 3 aplicaciones distintas, sino una sola aplicación inteligente que cambie su comportamiento y conocimiento (RAG) según la necesidad del usuario. Esto mantiene los costos de mantenimiento bajos y la potencia de la IA al máximo.

---
**Autor:** Antigravity AI  
**Hub Academia v3.0 Ready** 🛡️✨
