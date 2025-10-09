import { db } from './firebase-config.js';
import { ref, push, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

document.getElementById('add-course-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    // Obtener los valores del formulario
    const nombre = document.getElementById('nombre').value;
    const carrera = document.getElementById('carrera').value;
    const temas = document.getElementById('temas').value.split(',').map(t => t.trim());
    const pdfs = document.getElementById('pdfs').value.split(',').map(p => p.trim());
    const videos = document.getElementById('videos').value.split(',').map(v => v.trim());

    // Crear el objeto del nuevo curso
    const nuevoCurso = {
        id: Date.now(), // Generar un ID único basado en la fecha
        nombre,
        carrera,
        temas,
        materiales: {
            pdfs,
            videos
        }
    };

    try {
        // Enviar el curso al backend
        const response = await fetch('http://localhost:3000/api/add-curso', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nuevoCurso)
        });

        if (response.ok) {
            alert('Curso agregado exitosamente');
            document.getElementById('add-course-form').reset();
        } else {
            alert('Error al agregar el curso');
        }
    } catch (error) {
        console.error('Error al enviar el curso:', error);
        alert('Error al conectar con el servidor');
    }
});