// Cargar cursos al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    await cargarCursos();
});

// Función para cargar cursos
async function cargarCursos() {
    try {
        const response = await fetch('http://localhost:3000/api/cursos');
        const cursos = await response.json();

        const tbody = document.querySelector('#course-list tbody');
        tbody.innerHTML = ''; // Limpiar la tabla

        cursos.forEach(curso => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${curso.nombre}</td>
                <td>${curso.carrera}</td>
                <td>
                    <button class="edit-button" data-id="${curso.id}">Editar</button>
                    <button class="delete-button" data-id="${curso.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Agregar eventos a los botones de editar y eliminar
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', () => editarCurso(button.dataset.id));
        });

        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', () => eliminarCurso(button.dataset.id));
        });
    } catch (error) {
        console.error('Error al cargar los cursos:', error);
    }
}

// Función para agregar un curso
document.getElementById('add-course-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const carrera = document.getElementById('carrera').value;
    const temas = document.getElementById('temas').value.split(',').map(t => t.trim());
    const pdfs = document.getElementById('pdfs').value.split(',').map(p => p.trim());
    const videos = document.getElementById('videos').value.split(',').map(v => v.trim());

    const nuevoCurso = {
        nombre,
        carrera,
        temas,
        materiales: { pdfs, videos }
    };

    try {
        const response = await fetch('http://localhost:3000/api/add-curso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoCurso)
        });

        if (response.ok) {
            alert('Curso agregado exitosamente');
            document.getElementById('add-course-form').reset();
            await cargarCursos();
        } else {
            alert('Error al agregar el curso');
        }
    } catch (error) {
        console.error('Error al agregar el curso:', error);
    }
});

// Función para eliminar un curso
async function eliminarCurso(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este curso?')) return;

    try {
        const response = await fetch(`http://localhost:3000/api/delete-curso/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Curso eliminado exitosamente');
            await cargarCursos();
        } else {
            alert('Error al eliminar el curso');
        }
    } catch (error) {
        console.error('Error al eliminar el curso:', error);
    }
}

// Función para editar un curso (pendiente de implementación)
function editarCurso(id) {
    alert(`Funcionalidad de edición para el curso con ID ${id} pendiente de implementación.`);
}