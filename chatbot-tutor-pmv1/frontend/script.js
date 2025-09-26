async function buscarCursos() {
  const query = document.getElementById('searchInput').value;
  if (!query) {
    alert('Por favor, ingresa un término de búsqueda');
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/buscar?q=${encodeURIComponent(query)}`);
    const cursos = await response.json();
    mostrarResultados(cursos);
  } catch (error) {
    console.error('Error al buscar cursos:', error);
    document.getElementById('resultados').innerHTML = 
      '<p style="color: red;">Error al conectar con el servidor. Asegúrate de que el backend esté ejecutándose.</p>';
  }
}

function mostrarResultados(cursos) {
  const contenedor = document.getElementById('resultados');
  
  if (cursos.length === 0) {
    contenedor.innerHTML = '<p>No se encontraron cursos que coincidan con tu búsqueda.</p>';
    return;
  }

  contenedor.innerHTML = cursos.map(curso => `
    <div class="curso">
      <h3>${curso.nombre}</h3>
      <p><strong>Carrera:</strong> ${curso.carrera}</p>
      <p><strong>Temas:</strong> ${curso.temas.join(', ')}</p>
      <div class="materiales">
        <p><strong>📚 Materiales PDF:</strong></p>
        <ul>
          ${curso.materiales.pdfs.map(pdf => `<li>${pdf}</li>`).join('')}
        </ul>
        <p><strong>🎥 Videos disponibles:</strong></p>
        <ul>
          ${curso.materiales.videos.map(video => `<li>${video}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
}

// Permitir búsqueda con Enter
document.getElementById('searchInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    buscarCursos();
  }
});