document.addEventListener('DOMContentLoaded', () => {
    // Get Parent ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const parentId = urlParams.get('parentId');

    if (parentId) {
        document.getElementById('page-title').textContent = 'Nuevo Sub-Mazo';
        document.getElementById('page-subtitle').textContent = 'Organiza tu contenido dentro de la carpeta actual';
    }

    // Icon Selection
    const icons = document.querySelectorAll('.icon-option');
    const inputIcon = document.getElementById('deck-icon'); // Value input

    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            document.querySelector('.icon-option.selected')?.classList.remove('selected');
            icon.classList.add('selected');
            inputIcon.value = icon.dataset.icon;
        });
    });

    // Form Submit
    document.getElementById('deck-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('deck-name').value;
        const icon = document.getElementById('deck-icon').value;
        const token = localStorage.getItem('authToken');

        try {
            const res = await fetch('/api/decks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, icon, parentId }) // Send parentId (null or uuid)
            });

            if (res.ok) {
                // Redirect back to parent folder if exists
                // We need to pass state back or just use history?
                // Simple: Go to repaso.html?parentId=... but repaso.js needs to handle query param on load? 
                // Current repaso.js doesn't read URL params on init, it starts at Root.
                // Let's just go to root for now, or update RepasoManager to read URL.
                window.location.href = '/repaso';
            } else {
                alert('Error al crear mazo');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        }
    });
});