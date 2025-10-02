// Mostrar/ocultar el menú hamburguesa
document.getElementById('menu-toggle').addEventListener('click', () => {
  const menuOptions = document.getElementById('menu-options');
  menuOptions.style.display = menuOptions.style.display === 'none' ? 'block' : 'none';
});

// Función para buscar cursos
document.getElementById('searchButton').addEventListener('click', async () => {
  const query = document.getElementById('searchInput').value.trim();

  if (!query) {
    alert('Por favor, ingresa un término de búsqueda.');
    return;
  }

  try {
    // Realizar la solicitud al backend para buscar cursos
    const response = await fetch(`http://localhost:3000/api/buscar?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const resultados = await response.json();

      // Mostrar los resultados en la página
      const resultadosDiv = document.getElementById('resultados');
      resultadosDiv.innerHTML = ''; // Limpiar resultados anteriores

      if (resultados.length === 0) {
        resultadosDiv.innerHTML = '<p>No se encontraron cursos para la búsqueda.</p>';
      } else {
        resultados.forEach(curso => {
          const cursoDiv = document.createElement('div');
          cursoDiv.classList.add('curso');
          cursoDiv.innerHTML = `
            <h3>${curso.nombre}</h3>
            <p><strong>Carrera:</strong> ${curso.carrera}</p>
            <p><strong>Temas:</strong> ${curso.temas.join(', ')}</p>
            <p><strong>PDFs:</strong> ${curso.materiales.pdfs.join(', ')}</p>
            <p><strong>Videos:</strong> ${curso.materiales.videos.join(', ')}</p>
          `;
          resultadosDiv.appendChild(cursoDiv);
        });
      }
    } else {
      alert('Error al buscar cursos.');
    }
  } catch (error) {
    console.error('Error al buscar cursos:', error);
    alert('Error al conectar con el servidor.');
  }
});
