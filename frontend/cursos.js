const API_URL = "http://localhost:3000/api";

// 📌 Cargar todos los cursos al iniciar
async function cargarCursos() {
    try {
        const res = await fetch(`${API_URL}/cursos`);
        const cursos = await res.json();
        mostrarCursos(cursos);
    } catch (error) {
        console.error("❌ Error al cargar cursos:", error);
    }
}

// 📌 Mostrar cursos en pantalla
function mostrarCursos(cursos) {
    const contenedor = document.getElementById("lista-cursos");
    contenedor.innerHTML = "";

    if (cursos.length === 0) {
        contenedor.innerHTML = "<p>No hay cursos registrados.</p>";
        return;
    }

    cursos.forEach(curso => {
        const div = document.createElement("div");
        div.classList.add("curso");
        div.innerHTML = `
            <h3>${curso.nombre}</h3>
            <p><strong>Carrera:</strong> ${curso.carrera}</p>
            <p><strong>Temas:</strong> ${curso.temas.join(", ")}</p>
            <p><strong>PDFs:</strong> ${curso.materiales.pdfs.join(", ")}</p>
            <p><strong>Videos:</strong> ${curso.materiales.videos.join(", ")}</p>
            <button onclick="editarCurso('${curso.id}')">✏️ Editar</button>
            <button onclick="eliminarCurso('${curso.id}')">🗑️ Eliminar</button>
        `;
        contenedor.appendChild(div);
    });
}

// 📌 Guardar curso (Agregar o Editar)
document.getElementById("course-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("cursoId").value;
    const nuevoCurso = {
        nombre: document.getElementById("nombre").value,
        carrera: document.getElementById("carrera").value,
        temas: document.getElementById("temas").value.split(",").map(t => t.trim()),
        materiales: {
            pdfs: document.getElementById("pdfs").value.split(",").map(p => p.trim()),
            videos: document.getElementById("videos").value.split(",").map(v => v.trim())
        }
    };

    try {
        if (id) {
            // ✏️ Editar curso existente
            const res = await fetch(`${API_URL}/edit-curso/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoCurso)
            });
            if (!res.ok) throw new Error("Error al editar curso");
            alert("✏️ Curso editado exitosamente");
        } else {
            // ➕ Agregar curso nuevo
            const res = await fetch(`${API_URL}/add-curso`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoCurso)
            });
            if (!res.ok) throw new Error("Error al agregar curso");
            alert("✅ Curso agregado exitosamente");
        }

        // Resetear formulario
        document.getElementById("course-form").reset();
        document.getElementById("cursoId").value = "";
        document.getElementById("form-title").textContent = "➕ Agregar Curso";

        // Recargar lista
        cargarCursos();

    } catch (error) {
        console.error("❌ Error al guardar curso:", error);
    }
});

// 📌 Editar curso
async function editarCurso(id) {
    try {
        const res = await fetch(`${API_URL}/cursos`);
        const cursos = await res.json();

        // 🔑 Aseguramos que la comparación de IDs sea correcta
        const curso = cursos.find(c => String(c.id) === String(id));

        if (!curso) return alert("Curso no encontrado");

        document.getElementById("cursoId").value = curso.id;
        document.getElementById("nombre").value = curso.nombre;
        document.getElementById("carrera").value = curso.carrera;
        document.getElementById("temas").value = curso.temas.join(", ");
        document.getElementById("pdfs").value = curso.materiales.pdfs.join(", ");
        document.getElementById("videos").value = curso.materiales.videos.join(", ");

        document.getElementById("form-title").textContent = "✏️ Editar Curso";
    } catch (error) {
        console.error("❌ Error al editar curso:", error);
    }
}

// 📌 Eliminar curso
async function eliminarCurso(id) {
    if (!confirm("¿Seguro que deseas eliminar este curso?")) return;

    try {
        const res = await fetch(`${API_URL}/delete-curso/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar curso");
        alert("🗑️ Curso eliminado correctamente");
        cargarCursos();
    } catch (error) {
        console.error("❌ Error al eliminar curso:", error);
    }
}

// 🚀 Inicializar
cargarCursos();
