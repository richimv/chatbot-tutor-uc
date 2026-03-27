class AdminManager {
    constructor() {
        // Almacenes de datos
        this.allCareers = [];
        this.allCourses = []; // Cursos base (de courses.json)

        this.allStudents = []; // ✅ NUEVO: Almacén para alumnos
        this.allTopics = []; // Nuevo almacén para temas
        this.allBooks = []; // Nuevo almacén para libros
        this.allQuestions = []; // ✅ NUEVO: Almacén para preguntas

        // Estado de ordenamiento
        // ✅ NUEVO: Estado de ordenamiento por pestaña
        this.tabSortState = {
            'tab-careers': 'date-desc',
            'tab-courses': 'date-desc',
            'tab-students': 'date-desc',
            'tab-topics': 'date-desc',
            'tab-books': 'date-desc',
            'tab-questions': 'date-desc'
        };
        this.previewTimer = null; // ✅ Debounce para previsualización

        // Elementos del DOM
        this.genericModal = document.getElementById('generic-modal');
        this.genericForm = document.getElementById('generic-form');

        // ✅ SOLUCIÓN: Bindeo explícito para el nuevo manejador de eventos.
        this.handleResetPassword = this.handleResetPassword.bind(this);

        this.init();
    }

    init() {
        // Listener global para cerrar los dropdowns si se hace clic afuera
        document.addEventListener('click', (e) => {
            const openDropdown = document.querySelector('.searchable-dropdown-container.open');
            if (openDropdown) {
                const toggle = openDropdown.querySelector('.searchable-dropdown-toggle');
                const list = openDropdown.querySelector('.collapsible-list');

                // ✅ SOLUCIÓN: Cerrar si el clic NO está en la barra de búsqueda NI en la lista.
                if (!toggle.contains(e.target) && !list.contains(e.target)) {
                    openDropdown.classList.remove('open');
                    this._updateDropdownState(openDropdown); // ✅ SOLUCIÓN: Actualizar estado en lugar de limpiar.
                    const searchInput = openDropdown.querySelector('.live-search-input');
                    if (searchInput) {
                        searchInput.blur();
                    }
                }
            }
        });

        this.setupEventListeners();
        this.loadAllData();
    }

    setupEventListeners() {
        // Listener para las pestañas de navegación
        document.querySelector('.admin-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Delegación de eventos para todo el contenedor principal (editar, eliminar)
        this.setupMainContainerDelegation();

        this.genericForm.addEventListener('submit', (e) => { e.preventDefault(); this.saveGenericForm(); });

        // ✅ SOLUCIÓN DEFINITIVA: Devolver el control del modal a admin.js.
        // Este listener se encarga de cerrar el modal genérico desde el panel de admin,
        // evitando conflictos con la lógica global de app.js.
        // ✅ SOLUCIÓN UX: Prevenir cierres accidentales al seleccionar texto y soltar fuera.
        // Solo cerramos si el click EMPEZÓ y TERMINÓ en el fondo.
        let isMouseDownOnBackdrop = false;

        this.genericModal.addEventListener('mousedown', (e) => {
            if (e.target === this.genericModal) {
                isMouseDownOnBackdrop = true;
            } else {
                isMouseDownOnBackdrop = false;
            }
        });

        this.genericModal.addEventListener('click', (e) => {
            // Cerrar si se da al botón X
            if (e.target.closest('.modal-close')) {
                e.stopPropagation();
                this.closeGenericModal();
                return;
            }

            // Cerrar si se hace clic en el fondo (overlay), PERO solo si el mousedown también fue ahí.
            if (e.target === this.genericModal && isMouseDownOnBackdrop) {
                e.stopPropagation();
                this.closeGenericModal();
            }

            // Resetear por seguridad
            isMouseDownOnBackdrop = false;
        });

        // ✅ SOLUCIÓN: Listener centralizado para todos los componentes interactivos dentro del modal genérico.
        // Esto reemplaza los listeners que se añadían repetidamente en openGenericModal.
        this.genericModal.addEventListener('click', (e) => {
            // --- Lógica para abrir/cerrar dropdowns ---
            const dropdownToggle = e.target.closest('.searchable-dropdown-toggle');
            if (dropdownToggle) {
                e.stopPropagation(); // Evitar que el listener de cierre del modal interfiera.
                const currentContainer = dropdownToggle.closest('.searchable-dropdown-container');

                // Cerrar todos los demás dropdowns abiertos en el modal.
                this.genericModal.querySelectorAll('.searchable-dropdown-container.open').forEach(openContainer => {
                    if (openContainer !== currentContainer) {
                        openContainer.classList.remove('open');
                        this.updateSelectedChips(openContainer);
                        this.clearSearchInput(openContainer);
                    }
                });

                // Abrir o cerrar el dropdown actual.
                currentContainer.classList.toggle('open');

                if (!currentContainer.classList.contains('open')) {
                    // Si se acaba de cerrar, limpiar y desenfocar el input de búsqueda.
                    this._updateDropdownState(currentContainer); // ✅ SOLUCIÓN: Actualizar estado en lugar de limpiar.
                    const searchInput = currentContainer.querySelector('.live-search-input');
                    if (searchInput) searchInput.blur();
                }
                return; // Terminar la ejecución para no procesar otros clics.
            }

            // --- Lógica para otros botones dentro del modal ---
            if (e.target.id === 'add-schedule-row') this.addScheduleRow();
            if (e.target.classList.contains('remove-schedule-row')) e.target.closest('.schedule-row').remove();
            if (e.target.type === 'checkbox') {
                const container = e.target.closest('.searchable-dropdown-container');
                if (container) this.updateSelectedChips(container);
            }

            // ✅ NUEVO: Listeners para el Gestor de Unidades
            if (e.target.id === 'add-unit-btn') {
                const container = document.getElementById('units-container');
                container.insertAdjacentHTML('beforeend', this._createUnitHTML('Nueva Unidad', []));
            }
            if (e.target.closest('.remove-unit-btn')) {
                e.target.closest('.unit-item').remove();
            }
            if (e.target.classList.contains('add-topic-btn')) {
                const container = e.target.closest('.add-topic-container');
                const template = document.getElementById('topic-selector-template').innerHTML;
                container.innerHTML = template; // Reemplazar botón con selector

                // Inicializar búsqueda en vivo para este nuevo selector
                const searchInput = container.querySelector('.unit-topic-search');
                const select = container.querySelector('.topic-select');
                const dropdownContainer = container.querySelector('.searchable-dropdown-container');

                // NOTA: No necesitamos listeners para abrir/cerrar aquí, 
                // la delegación global en genericModal lo maneja.

                // Filtrar opciones
                searchInput.addEventListener('input', () => {
                    const filter = searchInput.value.toLowerCase();
                    const options = select.options;
                    for (let i = 0; i < options.length; i++) {
                        const txtValue = options[i].text.toLowerCase();
                        options[i].style.display = txtValue.includes(filter) ? "" : "none";
                    }
                    if (!dropdownContainer.classList.contains('open')) {
                        dropdownContainer.classList.add('open');
                    }
                });

                // Seleccionar opción
                select.addEventListener('change', () => {
                    searchInput.value = select.options[select.selectedIndex].text;
                    dropdownContainer.classList.remove('open');
                });

                // Seleccionar opción al hacer clic (para UX de lista)
                select.addEventListener('click', (ev) => {
                    if (ev.target.tagName === 'OPTION') {
                        select.value = ev.target.value;
                        searchInput.value = ev.target.text;
                        dropdownContainer.classList.remove('open');
                    }
                });
            }
            if (e.target.classList.contains('cancel-add-topic')) {
                const container = e.target.closest('.add-topic-container');
                container.innerHTML = '<button type="button" class="btn-secondary btn-small add-topic-btn">+ Añadir Tema</button>';
            }
            if (e.target.classList.contains('confirm-add-topic')) {
                const selectorWrapper = e.target.closest('.topic-selector-wrapper'); // Usar el nuevo wrapper
                const select = selectorWrapper.querySelector('select');
                const topicId = select.value;

                if (!topicId) return; // No hacer nada si no hay selección

                const topicName = select.options[select.selectedIndex].text;

                const unitItem = e.target.closest('.unit-item');
                const list = unitItem.querySelector('.unit-topics-list');

                // Evitar duplicados en la misma unidad
                if (!list.querySelector(`[data-id="${topicId}"]`)) {
                    list.insertAdjacentHTML('beforeend', `
                        <div class="unit-topic-item" data-id="${topicId}">
                            <span class="topic-name">${topicName}</span>
                            <button type="button" class="remove-topic-btn">×</button>
                            <input type="hidden" name="unit-topic-id" value="${topicId}">
                        </div>
                    `);
                }

                // Restaurar botón
                const container = e.target.closest('.add-topic-container');
                container.innerHTML = '<button type="button" class="btn-secondary btn-small add-topic-btn">+ Añadir Tema</button>';
            }
            if (e.target.classList.contains('remove-topic-btn')) {
                e.target.closest('.unit-topic-item').remove();
            }
        });

        // ✅ NUEVO: Listener centralizado para las barras de búsqueda de las pestañas.
        // ✅ MEJORA UX: Debounce para evitar lag al escribir.
        let searchTimeout;
        document.getElementById('admin-main-container').addEventListener('input', (e) => {
            if (e.target.classList.contains('admin-search-input')) {
                clearTimeout(searchTimeout);
                const input = e.target;

                searchTimeout = setTimeout(() => {
                    const filter = input.value.toLowerCase().trim(); // Trim para limpiar espacios
                    const tabId = input.dataset.targetTab;
                    const tabContent = document.getElementById(tabId);

                    // Seleccionar todas las tarjetas de item dentro de la pestaña activa.
                    const items = tabContent.querySelectorAll('.admin-item-card, .career-card');

                    items.forEach(item => {
                        // ✅ MEJORA: Búsqueda más profunda (buscar en atributos data si existen, o solo texto visible)
                        const textContent = item.textContent.toLowerCase();
                        // Podríamos añadir búsqueda por ID o atributos específicos si fuera necesario
                        const matches = textContent.includes(filter);

                        item.style.display = matches ? '' : 'none';

                        // Animación sutil de entrada (opcional)
                        if (matches) {
                            item.style.animation = 'fadeIn 0.2s ease-in-out';
                        }
                    });

                    // Mostrar estado vacío si no hay resultados
                    const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
                    let emptyState = tabContent.querySelector('.search-empty-state');

                    if (visibleItems.length === 0 && filter !== '') {
                        if (!emptyState) {
                            emptyState = document.createElement('p');
                            emptyState.className = 'search-empty-state empty-state';
                            emptyState.textContent = `🔍 No se encontraron resultados para "${filter}"`;
                            tabContent.appendChild(emptyState);
                        } else {
                            emptyState.textContent = `🔍 No se encontraron resultados para "${filter}"`;
                            emptyState.style.display = 'block';
                        }
                    } else if (emptyState) {
                        emptyState.style.display = 'none';
                    }

                }, 300); // 300ms de retraso (debounce)
            }
        });

        // ✅ NUEVO: Listener delegado para los controles de ordenamiento en cada pestaña
        document.getElementById('admin-main-container').addEventListener('change', (e) => {
            if (e.target.classList.contains('tab-sort-select')) {
                const tabId = e.target.dataset.tab;
                this.tabSortState[tabId] = e.target.value;
                // Re-renderizar la pestaña actual
                this.switchTab(tabId);
            }
        });

    }

    switchTab(tabId) {
        // 1. Gestionar clases de botones
        document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // 2. Gestionar visibilidad de contenedores (Forzar display para evitar errores CSS)
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none'; // ✅ FORZAR OCULTO
        });

        const activeContainer = document.getElementById(tabId);
        if (activeContainer) {
            activeContainer.classList.add('active');
            activeContainer.style.display = 'block'; // ✅ FORZAR VISIBLE
        }

        // 3. Renderizar contenido (Lazy Load o Refresh)
        if (tabId === 'tab-courses') this.displayBaseCourses();
        if (tabId === 'tab-topics') this.displayTopics();
        if (tabId === 'tab-students') this.displayStudents();
        if (tabId === 'tab-books') this.displayBooks();
        if (tabId === 'tab-careers') this.displayCareers();
        if (tabId === 'tab-questions') this.displayQuestions();
    }

    // ✅ NUEVO: Método auxiliar para obtener las cabeceras de autenticación.
    _getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        };
    }

    // ✅ NUEVO: Método para obtener IDs seleccionados de un checkbox list
    getSelectedIds(name) {
        const container = document.querySelector(`.searchable-dropdown-container[data-name="${name}"]`);
        if (!container) return [];
        // Filtrar valores no numéricos para evitar NaN
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value, 10))
            .filter(id => !isNaN(id));
    }

    // ✅ NUEVO: Método de ordenamiento genérico
    sortData(data, type = 'default', tabId) {
        if (!data || !Array.isArray(data)) return [];

        const sortOrder = this.tabSortState[tabId] || 'date-desc';

        return [...data].sort((a, b) => {
            switch (sortOrder) {
                case 'alpha-asc':
                    const nameA = (type === 'book' ? a.title : a.name) || '';
                    const nameB = (type === 'book' ? b.title : b.name) || '';
                    return nameA.localeCompare(nameB);
                case 'alpha-desc':
                    const nameADesc = (type === 'book' ? a.title : a.name) || '';
                    const nameBDesc = (type === 'book' ? b.title : b.name) || '';
                    return nameBDesc.localeCompare(nameADesc);
                case 'date-asc':
                    // ✅ SOLUCIÓN: Usar created_at si existe, sino usar ID como proxy (asumiendo serial/autoincrement)
                    // Para usuarios (instructors/students) siempre hay created_at. Para otros, usamos ID.
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : (parseInt(a.id, 10) || 0);
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : (parseInt(b.id, 10) || 0);
                    return dateA - dateB;
                case 'date-desc':
                default:
                    const dateADesc = a.created_at ? new Date(a.created_at).getTime() : (parseInt(a.id, 10) || 0);
                    const dateBDesc = b.created_at ? new Date(b.created_at).getTime() : (parseInt(b.id, 10) || 0);
                    return dateBDesc - dateADesc;
            }
        });
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, studentsRes, topicsRes, booksRes, questionsRes] = await Promise.all([
                fetch(`${window.AppConfig.API_URL}/api/careers`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/courses`, { headers: this._getAuthHeaders() }),

                fetch(`${window.AppConfig.API_URL}/api/students`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/topics`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/books`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/admin/questions`, { headers: this._getAuthHeaders() })
            ]);

            for (const res of [careersRes, coursesRes, studentsRes, topicsRes, booksRes, questionsRes]) {
                if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
            }

            this.allCareers = await careersRes.json();
            this.allCourses = await coursesRes.json();

            this.allStudents = await studentsRes.json(); // ✅ NUEVO
            this.allTopics = await topicsRes.json();
            this.allBooks = await booksRes.json(); // Cargar libros
            this.allQuestions = await questionsRes.json();

            // ✅ CORRECCIÓN: Renderizar todas las pestañas DESPUÉS de que todos los datos se hayan cargado
            this.displayCareers();
            this.displayBaseCourses();
            this.displayStudents(); // ✅ NUEVO
            this.displayTopics();
            this.displayBooks();
            this.displayQuestions();

        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            this.sectionsContainer.innerHTML = `<p class="error-state">Error al cargar los datos del panel. Asegúrate de que el servidor esté funcionando y las rutas API estén correctas.</p>`;
        }
    }



    setupMainContainerDelegation() {
        const mainContainer = document.getElementById('admin-main-container');
        mainContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn-small');
            const deleteBtn = e.target.closest('.delete-btn-small');
            const resetPassBtn = e.target.closest('.reset-pass-btn-small');

            if (editBtn) {
                e.preventDefault();
                this.openGenericModal(editBtn.dataset.type, editBtn.dataset.id);
            }

            if (deleteBtn) {
                e.preventDefault();
                this.handleDelete(deleteBtn.dataset.type, deleteBtn.dataset.id);
            }

            if (resetPassBtn) {
                e.preventDefault();
                this.handleResetPassword(resetPassBtn.dataset.id);
            }
        });
    }

    displayCareers() {
        const container = document.getElementById('tab-careers');
        // ✅ APLICAR ORDENAMIENTO
        const sortedCareers = this.sortData(this.allCareers, 'career', 'tab-careers');
        const itemsHTML = sortedCareers.map(career => createAdminItemCardHTML(career, 'career')).join('');
        const content = this._createTabHeaderHTML('career', 'Añadir Carrera', 'tab-careers') +
            (itemsHTML || '<p class="empty-state">No hay carreras.</p>');
        container.innerHTML = content;
    }

    displayBaseCourses() {
        const container = document.getElementById('tab-courses');
        // ✅ APLICAR ORDENAMIENTO
        const sortedCourses = this.sortData(this.allCourses, 'course', 'tab-courses');
        const itemsHTML = sortedCourses.map(course => createAdminItemCardHTML(course, 'course', course.code ? `(${course.code})` : '')).join('');
        const content = this._createTabHeaderHTML('course', 'Añadir Curso', 'tab-courses') +
            (itemsHTML || '<p class="empty-state">No hay cursos base.</p>');
        container.innerHTML = content;
    }



    // ✅ NUEVO: Método para mostrar alumnos
    displayStudents() {
        const container = document.getElementById('tab-students');
        // ✅ APLICAR ORDENAMIENTO
        const sortedStudents = this.sortData(this.allStudents, 'student', 'tab-students');
        const itemsHTML = sortedStudents.map(student => createAdminItemCardHTML(student, 'student', `(${student.email})`, true)).join('');
        const content = this._createTabHeaderHTML('student', 'Añadir Alumno', 'tab-students') +
            (itemsHTML || '<p class="empty-state">No hay alumnos.</p>');
        container.innerHTML = content;
    }

    displayTopics() {
        const container = document.getElementById('tab-topics');
        // ✅ APLICAR ORDENAMIENTO
        const sortedTopics = this.sortData(this.allTopics, 'topic', 'tab-topics');
        const itemsHTML = sortedTopics.map(topic => createAdminItemCardHTML(topic, 'topic')).join('');
        const content = this._createTabHeaderHTML('topic', 'Añadir Tema', 'tab-topics') +
            (itemsHTML || '<p class="empty-state">No hay temas.</p>');
        container.innerHTML = content;
    }

    displayBooks() {
        const container = document.getElementById('tab-books');
        // ✅ APLICAR ORDENAMIENTO
        const sortedBooks = this.sortData(this.allBooks, 'book', 'tab-books');
        const itemsHTML = sortedBooks.map(book => createAdminItemCardHTML(book, 'book', `by ${book.author}`)).join('');
        const content = this._createTabHeaderHTML('book', 'Añadir Recurso', 'tab-books') +
            (itemsHTML || '<p class="empty-state">No hay recursos.</p>');
        container.innerHTML = content;
    }

    // ✅ NUEVO: Interfaz de Preguntas
    displayQuestions() {
        const container = document.getElementById('tab-questions');
        // ✅ APLICAR ORDENAMIENTO
        const sortedQuestions = this.sortData(this.allQuestions, 'question', 'tab-questions');
        const itemsHTML = sortedQuestions.map(q => createAdminItemCardHTML(q, 'question')).join('');

        // Custom header with Bulk Import button
        const content = `
            <div class="tab-header-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px;">
                <div class="search-sort-wrapper" style="display: flex; gap: 10px; align-items: center; flex: 1;">
                    <div class="search-bar-container" style="display: flex; align-items: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 0 12px; width: 300px; height: 40px; transition: border-color 0.2s;">
                        <i class="fas fa-search" style="color: var(--text-secondary); margin-right: 10px; font-size: 0.9rem;"></i>
                        <input type="text" class="admin-search-input" placeholder="Buscar preguntas..." data-target-tab="tab-questions" style="border: none; background: transparent; flex: 1; color: var(--text-primary); outline: none; font-size: 0.9rem;">
                    </div>
                </div>
                <button class="btn-secondary" onclick="window.adminManager.openGenericModal('bulk-question')" style="height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 20px;">
                    <i class="fas fa-file-import"></i> <span class="hide-mobile">Importar JSON/CSV</span>
                </button>
                <button class="btn-primary" onclick="window.adminManager.openGenericModal('ai-question')" style="background: linear-gradient(135deg, #a855f7, #6366f1); border-color: transparent; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 20px;">
                    <i class="fas fa-robot"></i> <span class="hide-mobile">Generar con IA (Lite)</span>
                </button>
                <button class="btn-primary" onclick="window.adminManager.openGenericModal('question')" style="height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 20px;">
                    <i class="fas fa-plus"></i> <span class="hide-mobile">Añadir Pregunta</span>
                </button>
            </div>
            ${itemsHTML || '<p class="empty-state">No hay preguntas registradas.</p>'}
        `;
        container.innerHTML = content;
    }

    async openGenericModal(type, id = null) {
        this.genericForm.reset();
        this.genericForm.dataset.type = type;
        this.genericForm.dataset.id = id || '';
        const modal = document.getElementById('generic-modal');
        const title = modal.querySelector('.modal-header h2');
        const fieldsContainer = document.getElementById('generic-form-fields');
        fieldsContainer.innerHTML = '';
        let fieldsHTML = '';
        let currentItem = null;

        // Definimos los endpoints de la API para cada tipo
        switch (type) {
            // ... (el resto del switch case permanece igual)
            case 'career':
                title.textContent = id ? 'Editar Carrera' : 'Añadir Carrera';
                if (id) currentItem = this.allCareers.find(c => c.id === parseInt(id, 10));

                const areas = [
                    { id: 'Ciencias de la Salud', name: 'Ciencias de la Salud' },
                    { id: 'Ingenierías', name: 'Ingenierías' },
                    { id: 'Ciencias Empresariales', name: 'Ciencias Empresariales' },
                    { id: 'Ciencias Sociales y Humanidades', name: 'Ciencias Sociales y Humanidades' },
                    { id: 'Arquitectura y Diseño', name: 'Arquitectura y Diseño' },
                    { id: 'Ciencias Exactas', name: 'Ciencias Exactas' }
                ];

                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre de la Carrera (*)', currentItem?.name || '', true) +
                    this.createSelect('generic-area', 'Área Académica (*)', areas, currentItem?.area || '', false) +
                    this.createImageUploadGroup('generic-image', 'Portada (Imagen Horizontal 16:9)', currentItem?.image_url || '');
                break;
            case 'question':
                title.textContent = id ? 'Editar Pregunta' : 'Añadir Pregunta';
                if (id) currentItem = this.allQuestions.find(q => String(q.id) === String(id));

                let optA = currentItem?.options?.[0] || '';
                let optB = currentItem?.options?.[1] || '';
                let optC = currentItem?.options?.[2] || '';
                let optD = currentItem?.options?.[3] || '';
                let optE = currentItem?.options?.[4] || ''; // Añadida 5ta opción
                let correctAns = currentItem?.correct_answer ?? 0;

                const domains = [
                    { id: 'medicine', name: 'Medicina' },
                    { id: 'english', name: 'Inglés' },
                    { id: 'general_trivia', name: 'Cultura General' }
                ];

                fieldsHTML = `
                    ${this.createFormGroup('textarea', 'generic-question-text', 'Pregunta (*)', currentItem?.question_text || '', true)}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${this.createSelect('generic-domain', 'Dominio (*)', domains, currentItem?.domain || 'medicine', false)}
                        <div>
                            <label class="form-label" for="generic-target">Examen Objetivo (*)</label>
                            <select id="generic-target" class="form-input" onchange="
                                const targetVal = this.value;
                                const isSerums = targetVal === 'SERUMS';
                                const isResidentado = targetVal === 'RESIDENTADO';
                                
                                const cm = document.getElementById('generic-career-wrapper');
                                if(cm) cm.style.display = isSerums ? 'block' : 'none';

                                const optEWrap = document.getElementById('generic-opt4-wrapper');
                                if(optEWrap) optEWrap.style.display = isResidentado ? 'block' : 'none';

                                const selectCorrect = document.getElementById('generic-correct-ans');
                                if(selectCorrect) {
                                    const optEOption = selectCorrect.querySelector('option[value=\\'4\\']');
                                    if(isResidentado && !optEOption) {
                                        const newOpt = document.createElement('option');
                                        newOpt.value = '4'; newOpt.textContent = 'Opción E';
                                        selectCorrect.appendChild(newOpt);
                                    } else if (!isResidentado && optEOption) {
                                        optEOption.remove();
                                        if (selectCorrect.value === '4') selectCorrect.value = '0';
                                    }
                                }
                            ">
                                <option value="ENAM" ${currentItem?.target === 'ENAM' ? 'selected' : ''}>ENAM</option>
                                <option value="SERUMS" ${currentItem?.target === 'SERUMS' ? 'selected' : ''}>SERUMS</option>
                                <option value="RESIDENTADO" ${currentItem?.target === 'RESIDENTADO' ? 'selected' : ''}>RESIDENTADO</option>
                            </select>
                        </div>
                    </div>
                    <div id="generic-career-wrapper" style="display: ${currentItem?.target?.toUpperCase() === 'SERUMS' ? 'block' : 'none'}; margin-top: 15px;">
                        <label class="form-label" for="generic-career">Carrera Profesional (Sólo SERUMS)</label>
                        <select id="generic-career" class="form-input" style="outline: none;">
                            <option value="">Selecciona una carrera...</option>
                            <option value="Medicina Humana" ${currentItem?.career === 'Medicina Humana' ? 'selected' : ''}>Medicina Humana</option>
                            <option value="Enfermería" ${currentItem?.career === 'Enfermería' ? 'selected' : ''}>Enfermería</option>
                            <option value="Obstetricia" ${currentItem?.career === 'Obstetricia' ? 'selected' : ''}>Obstetricia</option>
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                        ${this.createFormGroup('text', 'generic-topic', 'Área de Estudio (*)', currentItem?.topic || '', true)}
                        ${this.createFormGroup('text', 'generic-subtopic', 'Subtema (Opcional)', currentItem?.subtopic || '', false)}
                    </div>
                    <fieldset style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <legend style="color: var(--text-secondary); font-size: 0.9em; padding: 0 5px;">Opciones y Respuesta</legend>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            ${this.createFormGroup('text', 'generic-opt0', 'Opción A (*)', optA, true)}
                            ${this.createFormGroup('text', 'generic-opt1', 'Opción B (*)', optB, true)}
                            ${this.createFormGroup('text', 'generic-opt2', 'Opción C (*)', optC, true)}
                            ${this.createFormGroup('text', 'generic-opt3', 'Opción D (*)', optD, true)}
                            <div id="generic-opt4-wrapper" style="display: ${currentItem?.target?.toUpperCase() === 'RESIDENTADO' ? 'block' : 'none'};">
                                ${this.createFormGroup('text', 'generic-opt4', 'Opción E (* Solo Residentado)', optE, false)}
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            ${this.createSelect('generic-correct-ans', 'Definir Respuesta Correcta (*)', [
                    { id: 0, name: 'Opción A' }, { id: 1, name: 'Opción B' }, { id: 2, name: 'Opción C' }, { id: 3, name: 'Opción D' }, ...(currentItem?.target?.toUpperCase() === 'RESIDENTADO' ? [{ id: 4, name: 'Opción E' }] : [])
                ], correctAns, false)}
                        </div>
                    </fieldset>
                    ${this.createFormGroup('textarea', 'generic-explanation', 'Explicación (Opcional)', currentItem?.explanation || '', false)}
                    ${this.createImageUploadGroup('generic-image', 'Imagen de ENUNCIADO (Opcional)', currentItem?.image_url || '')}
                    ${this.createImageUploadGroup('generic-explanation-image', 'Imagen de EXPLICACIÓN (GCS o Local)', currentItem?.explanation_image_url || '')}
                `;

                setTimeout(() => {
                    const txtQ = document.getElementById('generic-question-text');
                    const txtE = document.getElementById('generic-explanation');
                    if (txtQ) txtQ.rows = 3;
                    if (txtE) txtE.rows = 2;
                }, 0);
                break;

            case 'bulk-question':
                title.textContent = 'Importar Banco de Preguntas (JSON / Excel / CSV)';
                fieldsHTML = `
                    <div class="admin-item-card" style="padding: 15px; text-align: left; background: var(--bg-surface); margin-bottom: 15px;">
                        <p style="margin-bottom: 5px; color: var(--text-muted); font-size: 0.9rem;">
                            <strong>Opción 1: Pegar JSON directamente</strong><br>
                            Copia y pega el array JSON generado por la IA en el cuadro de abajo. Es la forma más rápida si estás generando preguntas aquí mismo.
                        </p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label class="form-label" for="generic-bulk-json" style="font-weight: 600; font-size:0.9rem; margin-bottom: 5px; display:block;">Pegar JSON de preguntas (*)</label>
                        <textarea id="generic-bulk-json" class="form-input" placeholder='[{"question_text": "...", "options": [...], ...}]' style="min-height: 150px; font-family: monospace; font-size: 0.85rem; background: var(--bg-secondary); border: 1px solid var(--border-color);"></textarea>
                    </div>

                    <div class="admin-item-card" style="padding: 15px; text-align: left; background: var(--bg-surface); margin-bottom: 15px;">
                        <p style="margin-bottom: 5px; color: var(--text-muted); font-size: 0.9rem;">
                            <strong>Opción 2: Subir Excel o CSV</strong><br>
                            Asegúrate de respetar las 14 columnas del formato estricto oficial. Si no sabes cómo armarlo, descarga nuestra plantilla.
                        </p>
                        <button type="button" class="btn-secondary" style="margin-top: 10px; padding: 5px 15px; font-size: 0.85rem;" onclick="window.adminManager.downloadExcelTemplate()">
                            <i class="fas fa-file-excel" style="color:#22c55e;"></i> Descargar Plantilla Oficial
                        </button>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label class="form-label" for="generic-bulk-file" style="font-weight: 600; font-size:0.9rem; margin-bottom: 5px; display:block;">O selecciona tu archivo (.xlsx, .xls, .csv)</label>
                        <input type="file" id="generic-bulk-file" accept=".xlsx, .xls, .csv" class="form-input" style="padding: 10px; background: var(--bg-secondary); border: 1px dashed var(--border-color); cursor:pointer;">
                    </div>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) btn.innerHTML = '<i class="fas fa-file-import"></i> Importar Lote';
                }, 0);
                break;
            case 'ai-question':
                title.textContent = 'Generador de Preguntas IA (Flash Lite)';
                fieldsHTML = `
                    <div style="margin-bottom:15px; color:var(--text-muted); font-size:0.9rem; background: rgba(168, 85, 247, 0.1); padding: 10px; border-radius: 8px;">
                        <i class="fas fa-info-circle" style="color: #a855f7;"></i> La IA escaneará un vasto acervo documental RAG que incluye <b>exámenes pasados, libros de autores reconocidos (Harrison, Washington, manuales AMIR, CTO, etc.), normas técnicas, guías clínicas y leyes</b>. Generará un lote de 5 preguntas sin duplicarse con el banco existente.
                    </div>
                    <h4 style="margin-bottom:0.5rem;">Dominio</h4>
                    <select id="ai-domain-select" style="width:100%; padding:10px; border-radius:8px; margin-bottom:15px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color);">
                        <option value="medicine" selected>Medicina</option>
                        <option value="english">Inglés</option>
                        <option value="general_trivia">Cultura General</option>
                    </select>
                    <h4 style="margin-bottom:0.5rem;">Examen Objetivo</h4>
                    <select id="ai-target" style="width:100%; padding:10px; border-radius:8px; margin-bottom:15px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color);" onchange="
                        const isSerums = this.value === 'SERUMS';
                        const info = document.getElementById('ai-serums-info');
                        const wrapper = document.getElementById('ai-career-wrapper');
                        if(info) info.style.display = isSerums ? 'block' : 'none';
                        if(wrapper) wrapper.style.display = isSerums ? 'block' : 'none';
                        
                        // Filtrar Grupos de Estudio
                        document.querySelectorAll('.ai-study-group').forEach(el => {
                            if (isSerums) {
                                // Solo Grupo D
                                el.style.display = el.dataset.group === 'D' ? 'block' : 'none';
                            } else {
                                // Todos los grupos (ENAM, RESIDENTADO, etc)
                                el.style.display = 'block';
                            }
                        });
                        
                        // Desmarcar todo al cambiar de objetivo para evitar envíos erróneos
                        document.querySelectorAll('.ai-domain-cb').forEach(cb => cb.checked = false);
                        const allCheck = document.getElementById('ai-domain-all');
                        if(allCheck) allCheck.checked = false;
                    ">
                        <option value="ENAM">ENAM</option>
                        <option value="SERUMS">SERUMS</option>
                        <option value="RESIDENTADO">RESIDENTADO</option>
                    </select>
                    <div id="ai-serums-info" style="display:none; margin-top:-5px; margin-bottom: 15px; font-size: 0.85rem; color: var(--text-muted); background: rgba(56, 189, 248, 0.05); padding: 10px; border-left: 3px solid #38bdf8; border-radius: 4px;">
                        <strong>Evaluación (ENCAPS) - MINSA:</strong> Las preguntas para esta evaluación están estrictamente calibradas en base a nuestras guías, normas técnicas y libros oficiales (RAG) para las profesiones de: medicina humana, enfermería y obstetricia.
                    </div>
                    <div id="ai-career-wrapper" style="display:none; margin-bottom: 15px;">
                        <h4 style="margin-bottom:0.5rem;">Carrera Profesional</h4>
                        <select id="ai-career" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color);">
                            <option value="Medicina Humana">Medicina Humana</option>
                            <option value="Enfermería">Enfermería</option>
                            <option value="Obstetricia">Obstetricia</option>
                        </select>
                    </div>
                    <h4 style="margin-bottom:0.5rem;">Áreas de Estudio</h4>
                    <div id="ai-domain-container" style="min-height: 200px; max-height: 250px; overflow-y: scroll; display: block; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; background: var(--bg-secondary); margin-bottom: 15px;">
                        <div class="ai-study-group" data-group="A" style="margin-bottom: 15px;">
                            <strong style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 5px; display: block;">Grupo A — Ciencias Básicas</strong>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Anatomía"> Anatomía</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Fisiología"> Fisiología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Farmacología"> Farmacología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Microbiología y Parasitología"> Microbiología y Parasitología</label>
                        </div>
                        <div class="ai-study-group" data-group="B" style="margin-bottom: 15px;">
                            <strong style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 5px; display: block;">Grupo B — Las 4 Grandes</strong>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Medicina Interna"> Medicina Interna</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Pediatría"> Pediatría</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Ginecología y Obstetricia"> Ginecología y Obstetricia</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Cirugía General"> Cirugía General</label>
                        </div>
                        <div class="ai-study-group" data-group="C" style="margin-bottom: 15px;">
                            <strong style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 5px; display: block;">Grupo C — Especialidades Clínicas</strong>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Cardiología"> Cardiología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Gastroenterología"> Gastroenterología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Neurología"> Neurología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Nefrología"> Nefrología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Neumología"> Neumología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Endocrinología"> Endocrinología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Infectología"> Infectología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Reumatología"> Reumatología</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Traumatología"> Traumatología</label>
                        </div>
                        <div class="ai-study-group" data-group="D" style="margin-bottom: 5px;">
                            <strong style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 5px; display: block;">Grupo D — Salud Pública y Gestión</strong>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Salud Pública"> Salud Pública</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Gestión De Servicios De Salud"> Gestión De Servicios De Salud</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Ética E Interculturalidad"> Ética E Interculturalidad</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Investigación"> Investigación</label>
                            <label style="display:block; margin-left: 10px; margin-bottom: 4px; color: var(--text-secondary);"><input type="checkbox" class="ai-domain-cb" value="Cuidado Integral De Salud"> Cuidado Integral De Salud</label>
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-primary); font-weight: 500;">
                            <input type="checkbox" id="ai-domain-all" onchange="document.querySelectorAll('.ai-domain-cb').forEach(c => c.checked = this.checked)"> 
                            Seleccionar/Deseleccionar Todas
                        </label>
                    </div>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-magic"></i> Iniciar Generación RAG';
                        btn.style.background = 'linear-gradient(135deg, #a855f7, #6366f1)';
                        btn.style.borderColor = 'transparent';
                    }
                }, 0);
                break;
            // ...
            case 'course':
                title.textContent = id ? 'Editar Curso' : 'Añadir Curso';

                // ✅ SOLUCIÓN: Obtener detalles completos del curso (incluyendo unidades y temas) desde la API
                if (id) {
                    try {
                        const res = await fetch(`${window.AppConfig.API_URL}/api/courses/${id}`, { headers: this._getAuthHeaders() });
                        if (res.ok) {
                            currentItem = await res.json();
                        } else {
                            console.error('Error fetching course details');
                            currentItem = this.allCourses.find(c => c.id === parseInt(id, 10)); // Fallback
                        }
                    } catch (error) {
                        console.error('Error fetching course details:', error);
                        currentItem = this.allCourses.find(c => c.id === parseInt(id, 10)); // Fallback
                    }
                }

                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Curso (*)', currentItem?.name || '', true) +
                    // ✅ NUEVO: Selector de Carreras
                    this.createCheckboxList('Carreras Asociadas', 'generic-careers', this.allCareers, currentItem?.careerIds || [], 'career') +
                    // this.createUnitManager(...) Eliminado

                    // ✅ OPTIMIZACIÓN: Ordenar libros por ID descendente (Más recientes primero) para facilitar asignación rápida.
                    // Se crea una copia [...Array] para no mutar el original desordenadamente.
                    this.createCheckboxList('Recursos de Referencia', 'generic-books', [...this.allBooks].sort((a, b) => b.id - a.id), currentItem?.materials?.map(m => m.id) || currentItem?.bookIds || [], 'book') +
                    this.createImageUploadGroup('generic-image', 'Portada (Imagen Horizontal 16:9)', currentItem?.image_url || '');
                break;
            case 'topic':
                title.textContent = id ? 'Editar Tema' : 'Añadir Tema';
                if (id) currentItem = this.allTopics.find(t => t.id === parseInt(id, 10));
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Tema (*)', currentItem?.name || '', true) +
                    // Descripción eliminada
                    // ✅ SOLUCIÓN: Mostrar la lista de libros para asociarlos al tema.
                    this.createCheckboxList('Libros de Referencia', 'generic-books', this.allBooks, currentItem?.bookIds || [], 'book') +
                    '<div id="resources-container"></div>';
                break;


            case 'student': // ✅ NUEVO
                title.textContent = id ? 'Editar Alumno' : 'Añadir Alumno';
                if (id) currentItem = this.allStudents.find(i => i.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Alumno (*)', currentItem?.name || '', true) +
                    this.createFormGroup('email', 'generic-email', 'Email (*)', currentItem?.email || '', true);
                break;
            case 'book':
                title.textContent = id ? 'Editar Recurso' : 'Añadir Recurso';
                if (id) currentItem = this.allBooks.find(b => b.id === parseInt(id, 10));

                // Definir tipos de recurso acordes al nuevo enfoque EdTech

                // Definir tipos de recurso acordes al nuevo enfoque EdTech
                const resourceTypes = [
                    { id: 'norma', name: 'Norma Técnica/Legal' },
                    { id: 'guia', name: 'Guía de Práctica Clínica' },
                    { id: 'paper', name: 'Artículo/Paper' },
                    { id: 'video', name: 'Video' },
                    { id: 'book', name: 'Libro (Histórico)' },
                    { id: 'other', name: 'Otro' }
                ];

                fieldsHTML = `
                <div style="margin-bottom: 15px;">
                    ${this.createSelect('generic-type', 'Tipo de Recurso (*)', resourceTypes, currentItem?.resource_type || 'book', false)}
                </div>

                <!-- ✅ Checkbox Premium -->
                <div class="form-group" style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="generic-is-premium" style="width: 20px; height: 20px; cursor: pointer;" ${currentItem?.is_premium ? 'checked' : ''}>
                    <label for="generic-is-premium" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-crown" style="color: var(--warning-color);"></i> Recurso Premium (Requiere suscripción o vidas)
                    </label>
                </div>

                <!-- ✅ NUEVO: Asignación de Temas (Topics) al Recurso -->
                <div style="margin-bottom: 15px;">
                    ${this.createCheckboxList('Temas / Categorías Asociadas', 'generic-topics', this.allTopics, currentItem?.topics?.map(t => t.id) || currentItem?.topicIds || [], 'topic')}
                </div>

                <!-- ✅ NUEVO: Asignación Directa de Curso(s) -->
                <div style="margin-bottom: 15px; border-top: 1px dashed var(--border-color); padding-top: 15px;">
                    ${this.createCheckboxList('Cursos Asociados', 'generic-courses', this.allCourses, currentItem?.courseIds || [], 'course')}
                    <small style="color:var(--text-muted); display:block; margin-top:4px;">Asigna directamente a la biblioteca de los cursos este material sin tener que navegar a editarlos.</small>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="grid-column: 1 / -1;">
                        ${this.createFormGroup('text', 'generic-title', 'Título (*)', currentItem?.title || '', true)}
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <!-- ✅ UX MEJORA: Campo Autor Validado -->
                        <div class="form-group">
                            <label for="generic-author">Autor/Creador (*)</label>
                            <input type="text" id="generic-author" name="generic-author" value="${currentItem?.author || ''}" required placeholder="Ej: Drake, Richard L.; Vogl, A. Wayne">
                                <small style="display: block; margin-top: 4px; color: var(--text-muted); font-size: 0.8em;">
                                    <i class="fas fa-info-circle"></i> Formato obligatorio: <b>Nombre, Apellido</b>. Separa múltiples autores con punto y coma (;).
                                </small>
                        </div>
                    </div>

                    <div style="grid-column: 1 / -1;">
                        ${this.createFormGroup('text', 'generic-url', 'URL del Recurso (Opcional)', currentItem?.url || '', false)}
                        <small style="display:block; color:var(--text-muted); margin-top:2px;">
                            <i class="fas fa-magic"></i> <b>Tip:</b> Si se deja vacío, se usará la <b>imagen de portada</b> como recurso (ideal para infografías/mapas).
                        </small>
                    </div>
                </div>
                `;
                fieldsHTML += this.createImageUploadGroup('generic-image', 'Portada/Miniatura (Imagen)', currentItem?.image_url || '');
                break;
        }

        fieldsContainer.innerHTML = fieldsHTML;
        this.genericModal.style.display = 'flex';

        // ✅ SOLUCIÓN DEFINITIVA: Inicializar el estado visual de los componentes después de renderizar.
        // Esto soluciona los dos problemas reportados.
        this.genericModal.querySelectorAll('.searchable-dropdown-container').forEach(container => {
            if (container.dataset.multiselect === 'true') {
                // 1. Para listas de checkboxes (multiselect), actualiza los "stickers azules".
                this.updateSelectedChips(container);
            } else {
                // 2. Para selects de una sola opción, actualiza el campo de texto visible.
                const select = container.querySelector('select');
                const searchInput = container.querySelector('.live-search-input');
                if (select && searchInput && select.value) {
                    searchInput.value = select.options[select.selectedIndex].text;
                }
            }
        });



        if (type === 'topic' && currentItem) this.renderTopicResources(currentItem.resources);

        // Activar filtros de búsqueda en vivo y listeners de selección
        this._setupSearchableSelect('search-section-course-select', '#section-course-select');
        this._setupSearchableSelect('search-section-instructor-select', '#section-instructor-select');

        // Inicializar los chips para las listas de checkboxes existentes
        this.genericModal.querySelectorAll('.searchable-dropdown-container[data-multiselect="true"]').forEach(container => {
            this.updateSelectedChips(container);
        });

        this._liveSearchFilter('search-generic-topics', 'fieldset[data-name="generic-topics"] .checkbox-list', '.checkbox-item', 'label');
        this._liveSearchFilter('search-generic-books', 'fieldset[data-name="generic-books"] .checkbox-list', '.checkbox-item', 'label');
        this._liveSearchFilter('search-generic-related-courses', 'fieldset[data-name="generic-related-courses"] .checkbox-list', '.checkbox-item', 'label');
        this._liveSearchFilter('search-section-career-select', 'fieldset[data-name="section-career-select"] .checkbox-list', '.checkbox-item', 'label');
        this._liveSearchFilter('search-generic-courses', 'div[data-name="generic-courses"] .checkbox-list', '.checkbox-item', 'label');

        // ✅ FEEDBACK UNIVERSAL DE ARCHIVOS: Inicializar listeners para cualquier grupo de carga de imagen presente
        const setupFileInputFeedback = (inputId, infoId) => {
            const _input = document.getElementById(inputId);
            const _info = document.getElementById(infoId);
            if (_input && _info) {
                // Eliminar listener previo si existe para evitar duplicados
                _input.onchange = null; 
                _input.onchange = () => {
                    if (_input.files.length > 0) {
                        _info.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success-color);"></i> Archivo listo: <b>${_input.files[0].name}</b> (Se ignorará el texto)`;
                        _info.style.color = 'var(--success-color)';
                    }
                };
            }
        };

        // Escanear y activar para los IDs estándar usados en los modales
        setupFileInputFeedback('generic-image-file', 'generic-image-file-info');
        setupFileInputFeedback('generic-explanation-image-file', 'generic-explanation-image-file-info');
        setupFileInputFeedback('generic-bulk-file', 'generic-bulk-file-info'); // Para importación masiva también
    }

    _setupSearchableSelect(inputId, selectId) {
        const select = this.genericModal.querySelector(selectId);
        if (!select) return;

        this._liveSearchFilter(inputId, selectId, 'option', 'textContent');

        select.addEventListener('change', (e) => {
            const container = e.target.closest('.searchable-dropdown-container');
            const searchInput = container.querySelector('.live-search-input');
            searchInput.value = e.target.options[e.target.selectedIndex].text;
            container.classList.remove('open');
        });
    }

    /**
     * ✅ NUEVO: Actualiza el estado visual de un dropdown cuando se cierra.
     * En lugar de borrar el input, lo sincroniza con el valor seleccionado.
     * @param {HTMLElement} container El .searchable-dropdown-container
     */
    _updateDropdownState(container) {
        if (!container) return;

        this.clearSearchInput(container); // Limpia el filtro de búsqueda y resetea la lista.

        if (container.dataset.multiselect === 'true') {
            this.updateSelectedChips(container); // Para multiselect, solo actualiza los chips.
        } else {
            // Para single-select, re-establece el texto del input con la opción seleccionada.
            const select = container.querySelector('select');
            const searchInput = container.querySelector('.live-search-input');
            if (select && searchInput && select.value) {
                searchInput.value = select.options[select.selectedIndex].text;
            }
        }
    }

    clearSearchInput(container) {
        if (!container) return;
        const searchInput = container.querySelector('.live-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        // ✅ SOLUCIÓN: Resetear la visibilidad de todos los items en la lista.
        const listContainer = container.querySelector('.collapsible-list');
        if (listContainer) {
            const items = listContainer.querySelectorAll('.checkbox-item, option'); // Aplica a ambos tipos de listas
            items.forEach(item => {
                item.style.display = ''; // Restaura el display por defecto
            });
        }
    }

    updateSelectedChips(container) {
        if (!container || container.dataset.multiselect !== 'true') return;

        const chipsContainer = container.querySelector('.selected-chips-container');
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');

        chipsContainer.innerHTML = ''; // Limpiar chips existentes

        checkboxes.forEach(checkbox => {
            const chip = document.createElement('div');
            chip.className = 'selected-chip';
            chip.textContent = checkbox.nextElementSibling.textContent; // El texto de la etiqueta

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-chip-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                checkbox.checked = false;
                this.updateSelectedChips(container); // Volver a renderizar los chips
            };

            chip.appendChild(removeBtn);
            chipsContainer.appendChild(chip);
        });
    }

    createFormGroup(type, id, label, value = '', required = false) {
        const req = required ? 'required' : '';
        const inputHTML = type === 'textarea'
            ? `<textarea id="${id}" name="${id}" ${req}>${value}</textarea>`
            : `<input type="${type}" id="${id}" name="${id}" value="${value}" ${req}>`;
        return `<div class="form-group"><label for="${id}">${label}</label>${inputHTML}</div>`;
    }

    createImageUploadGroup(id, label, value = '') {
        const isExternal = value.startsWith('http');
        const token = localStorage.getItem('authToken');
        const previewUrl = value ? (isExternal ? value : `${window.AppConfig.API_URL}/api/media/preview?path=${value}&token=${token}`) : '';
        
        return `
            <div class="form-group image-upload-group" style="margin-bottom: 20px; border: 1px dashed var(--border-color); padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.02);">
                <label for="${id}-url" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i class="fas fa-image" style="color: var(--accent-color);"></i> ${label}
                </label>
                
                <input type="hidden" id="${id}-delete-flag" value="false">

                <div class="image-upload-actions">
                    <input type="text" id="${id}-url" name="${id}-url" value="${value}" 
                        placeholder="Ruta GCS o URL externa" 
                        style="flex: 1;"
                        oninput="window.adminManager.updateLivePreview('${id}')">
                    
                    <button type="button" class="remove-img-btn" title="Eliminar Imagen" onclick="window.adminManager.removeImage('${id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>

                    <input type="file" id="${id}-file" name="${id}-file" style="display: none;" accept="image/*">
                    <button type="button" class="upload-img-btn" onclick="document.getElementById('${id}-file').click()">
                        <i class="fas fa-upload"></i> <span class="hide-mobile">Subir Local</span>
                    </button>
                </div>

                <!-- Contenedor de Previsualización -->
                <div id="${id}-preview-container" style="display: ${value ? 'block' : 'none'}; margin-top: 10px; text-align: center; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                    <small style="display: block; color: var(--text-muted); margin-bottom: 5px;">Vista Previa:</small>
                    <img id="${id}-preview-img" src="${previewUrl}" alt="Preview" 
                        style="max-width: 100%; max-height: 180px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
                        onerror="this.parentElement.style.display='none'">
                </div>

                <small id="${id}-file-info" style="display: block; margin-top: 8px; color: var(--text-muted); font-size: 0.85em; opacity: 0.8;">
                    <i class="fas fa-info-circle"></i> <b>Tip:</b> Si subes un archivo local, este tendrá prioridad.
                </small>
            </div>
        `;
    }

    /**
     * ✅ NUEVO: Lógica unificada para marcar imagen como eliminada en el frontend.
     */
    removeImage(id) {
        const flag = document.getElementById(`${id}-delete-flag`);
        const urlInput = document.getElementById(`${id}-url`);
        const fileInput = document.getElementById(`${id}-file`);
        const preview = document.getElementById(`${id}-preview-container`);
        const info = document.getElementById(`${id}-file-info`);

        if (flag) flag.value = 'true';
        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
        if (preview) preview.style.display = 'none';
        
        if (info) {
            info.innerHTML = `<i class="fas fa-trash" style="color: var(--danger-color);"></i> Imagen marcada para eliminar al guardar.`;
            info.style.color = 'var(--danger-color)';
        }
    }

    /**
     * ✅ Actualiza la previsualización en tiempo real mientras el usuario escribe.
     */
    updateLivePreview(id) {
        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            const urlInput = document.getElementById(`${id}-url`);
            const previewContainer = document.getElementById(`${id}-preview-container`);
            const previewImg = document.getElementById(`${id}-preview-img`);
            
            if (!urlInput || !previewImg || !previewContainer) return;

            const value = urlInput.value.trim();
            // ✅ Optimización Anti-Ruido: Solo buscar si tiene al menos 4 caracteres y un punto (ej: a.png)
            if (!value || value.length < 4 || !value.includes('.')) {
                previewContainer.style.display = 'none';
                return;
            }

            const isExternal = value.startsWith('http');
            const previewUrl = window.resolveImageUrl(value);
            
            // ✅ Carga Asíncrona: Validar éxito antes de mostrar para evitar parpadeos y 404s visuales
            const tempImg = new Image();
            tempImg.onload = () => {
                // Sincronía: Verificar que el valor del input no haya cambiado durante la carga
                if (urlInput.value.trim() === value) {
                    previewImg.src = previewUrl;
                    previewContainer.style.display = 'block';
                }
            };
            tempImg.onerror = () => {
                if (urlInput.value.trim() === value) {
                    previewContainer.style.display = 'none';
                }
            };
            tempImg.src = previewUrl;
        }, 750); // ✅ Aumentado a 750ms para permitir escribir nombres completos sin spam de consola
    }

    createSelect(id, label, options, selectedValue, optional = false) {
        let optionsHTML = optional ? '<option value="">-- Ninguno --</option>' : '';
        optionsHTML += options.map(opt => `<option value="${opt.id}" ${opt.id === selectedValue ? 'selected' : ''}>${opt.name}</option>`).join('');
        return `<div class="form-group"><label for="${id}">${label}</label><select id="${id}">${optionsHTML}</select></div>`;
    }

    createSearchableSelect(id, label, options, selectedValue, optional = false) {
        // ✅ SOLUCIÓN: El ID de un docente es un UUID (string), no un número.
        // Se comprueba si el ID del control contiene 'instructor' para decidir si se parsea o no.
        const isInstructorSelect = id.includes('instructor');
        const finalSelectedValue = isInstructorSelect
            ? selectedValue
            : (selectedValue ? parseInt(selectedValue, 10) : null);

        let optionsHTML = optional ? '<option value="">-- Ninguno --</option>' : '';
        // ✅ MEJORA: Usar una comparación no estricta (==) para comparar el valor final (que puede ser string o número)
        // con el `opt.id` de las opciones, que siempre es un string desde el HTML.
        optionsHTML += options.map(opt => `<option value="${opt.id}" ${opt.id == finalSelectedValue ? 'selected' : ''}>${opt.name}</option>`).join('');
        return `
            <div class="form-group searchable-dropdown-container" data-name="${id}">
                <label for="${id}">${label}</label>
                <div class="searchable-dropdown-toggle">
                    <input type="text" id="search-${id}" class="live-search-input" placeholder="Buscar y seleccionar...">
                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                </div>
                <div class="collapsible-list">
                    <select id="${id}" size="8">${optionsHTML}</select>
                </div>
            </div>
        `;
    }

    createCheckboxList(label, name, options, selectedIds = [], type = 'default') {
        // ✅ SOLUCIÓN: Asegurarse de que los IDs seleccionados sean números para la comparación.
        const numericSelectedIds = (selectedIds || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));

        // ✅ LÓGICA CORREGIDA: Respetar el orden pasado por el invocador.
        // Anteriormente se forzaba un orden alfabético aquí, sobrescribiendo el orden por fecha/ID.
        const sortedOptions = options; // Usar el array tal cual viene (ya ordenado)
        const itemsHTML = sortedOptions.map(opt => {
            const checked = numericSelectedIds.includes(opt.id) ? 'checked' : '';
            const displayLabel = type === 'book' ? `${opt.title} (by ${opt.author})` : opt.name;
            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="${name}-${opt.id}" name="${name}" value="${opt.id}" ${checked}>
                    <label for="${name}-${opt.id}">${displayLabel}</label>
                </div>
            `;
        }).join('');

        return `
            <div class="form-group searchable-dropdown-container" data-name="${name}" data-multiselect="true">
                <label>${label}</label>
                <div class="selected-chips-container"></div>
                <div class="searchable-dropdown-toggle">
                    <input type="text" id="search-${name}" class="live-search-input" placeholder="Buscar y seleccionar...">
                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                </div>
                <div class="collapsible-list">
                    <div class="checkbox-list">${itemsHTML}</div>
                </div>
            </div>
        `;
    }

    addScheduleRow(day = '', startTime = '', endTime = '', room = '', notes = '') {
        const container = document.getElementById('schedule-container');
        const newRow = document.createElement('div');
        newRow.className = 'schedule-row';
        newRow.innerHTML = `<input type="text" class="schedule-day" placeholder="Día" value="${day}" required> <input type="time" class="schedule-start" value="${startTime}" required><input type="time" class="schedule-end" value="${endTime}" required><input type="text" class="schedule-room" placeholder="Salón" value="${room}"><input type="text" class="schedule-notes" placeholder="Notas/Carrera (Opcional)" value="${notes}"><button type="button" class="remove-schedule-row">×</button>`;
        container.appendChild(newRow);
    }

    // ✅ NUEVO: Gestor de Unidades
    createUnitManager(allTopics, currentTopics = []) {
        // Agrupar temas actuales por unidad
        const unitsMap = new Map();
        currentTopics.forEach(t => {
            const unitName = t.unit || 'General';
            if (!unitsMap.has(unitName)) unitsMap.set(unitName, []);
            unitsMap.get(unitName).push(t);
        });

        // Si no hay temas, iniciar con una unidad vacía
        if (unitsMap.size === 0) unitsMap.set('Unidad I', []);

        let unitsHTML = '';
        unitsMap.forEach((topics, unitName) => {
            unitsHTML += this._createUnitHTML(unitName, topics);
        });

        // Crear el select de temas (oculto, usado como plantilla) - AHORA CON BUSCADOR
        const topicOptions = allTopics.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        return `
                <div class="form-group unit-manager-container">
                    <label>Contenido del Curso (Unidades y Temas)</label>
                    <div id="units-container">${unitsHTML}</div>
                    <button type="button" id="add-unit-btn" class="btn-secondary btn-small" style="margin-top: 10px;">+ Añadir Unidad</button>

                    <!-- Template oculto para selector de temas CON BUSCADOR -->
                    <div id="topic-selector-template" style="display:none;">
                        <div class="topic-selector-wrapper">
                            <div class="searchable-dropdown-container" data-name="unit-topic-select">
                                <div class="searchable-dropdown-toggle">
                                    <input type="text" class="live-search-input unit-topic-search" placeholder="Buscar tema..." autocomplete="off">
                                        <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </div>
                                <div class="collapsible-list">
                                    <select class="topic-select" size="5">${topicOptions}</select>
                                </div>
                            </div>
                            <div class="topic-actions">
                                <button type="button" class="btn-primary btn-small confirm-add-topic">Añadir</button>
                                <button type="button" class="btn-secondary btn-small cancel-add-topic">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }

    _createUnitHTML(unitName, topics) {
        const topicsHTML = topics.map(t => `
                <div class="unit-topic-item" data-id="${t.id}">
                    <span class="topic-name">${t.name}</span>
                    <button type="button" class="remove-topic-btn" title="Quitar tema">×</button>
                    <input type="hidden" name="unit-topic-id" value="${t.id}">
                </div>
                `).join('');

        return `
                <div class="unit-item card-3d">
                    <div class="unit-header">
                        <input type="text" class="unit-name-input" placeholder="Nombre de la Unidad" value="${unitName}">
                            <button type="button" class="remove-unit-btn" title="Eliminar Unidad"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="unit-topics-list">
                        ${topicsHTML}
                    </div>
                    <div class="add-topic-container">
                        <button type="button" class="btn-secondary btn-small add-topic-btn">+ Añadir Tema</button>
                    </div>
                </div>
                `;
    }

    updateMaterialsPreview() {
        const previewContainer = document.getElementById('topic-materials-preview');
        const topicsCheckboxes = document.querySelectorAll('input[name="generic-topics"]:checked');
        if (!previewContainer || !topicsCheckboxes) return;

        const selectedTopicIds = Array.from(topicsCheckboxes).map(cb => cb.value);

        let materialsHTML = '<h4>Materiales Incluidos:</h4>';
        let hasMaterials = false;

        selectedTopicIds.forEach(topicId => {
            const topic = this.allTopics.find(t => t.id === topicId);
            const pdfs = topic?.resources?.pdfs || [];
            const links = topic?.resources?.links || [];

            if (pdfs.length > 0 || links.length > 0) {
                hasMaterials = true;
                pdfs.forEach(p => { materialsHTML += `<span class="material-preview-item pdf">${p.name}</span>`; });
                links.forEach(l => { materialsHTML += `<span class="material-preview-item link">${l.name}</span>`; });
            }
        });

        if (!hasMaterials) {
            previewContainer.innerHTML = '<p class="empty-state-small">Ningún material en los temas seleccionados.</p>';
        } else {
            previewContainer.innerHTML = materialsHTML;
        }
    }

    closeGenericModal() {
        // 1. Ocultar el modal
        this.genericModal.style.display = 'none';
        // 2. Limpiar su contenido para la próxima vez que se abra
        const fieldsContainer = document.getElementById('generic-form-fields');
        if (fieldsContainer) fieldsContainer.innerHTML = '';
    }

    // Función para filtrar listas (checkboxes o selects) en vivo
    _liveSearchFilter(inputId, listContainerSelector, itemSelector, labelSelector) {
        const input = this.genericModal.querySelector(`#${inputId}`);
        if (!input) { return; }
        const listContainer = input.closest('.searchable-dropdown-container').querySelector('.collapsible-list');
        if (!listContainer) { return; }

        input.addEventListener('keyup', () => {
            const filter = input.value.toLowerCase();
            const items = listContainer.querySelectorAll(itemSelector);
            items.forEach(item => {
                const label = (labelSelector === 'textContent' ? item.textContent : item.querySelector(labelSelector).textContent).toLowerCase();
                item.style.display = label.includes(filter) ? '' : 'none'; // Usar '' en lugar de 'flex' o 'block' para restaurar el display por defecto
            });
        });
    }

    async saveGenericForm() {
        const type = this.genericForm.dataset.type;
        const id = this.genericForm.dataset.id;
        let url = id ? `${window.AppConfig.API_URL}/api/${type}s/${id}` : `${window.AppConfig.API_URL}/api/${type}s`;
        const method = id ? 'PUT' : 'POST';

        if (type === 'question') {
            url = id ? `${window.AppConfig.API_URL}/api/admin/question/${id}` : `${window.AppConfig.API_URL}/api/admin/question`;
        }

        let body = {};
        
        // ✅ MEJORA UI/UX: Bloquear botón para evitar spam clicks / duplicados
        const saveBtn = document.getElementById('generic-save-btn');
        const originalBtnText = saveBtn ? saveBtn.innerHTML : 'Guardar';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            saveBtn.disabled = true;
        }

        try {
            switch (type) {
                case 'career':
                    // ✅ AHORA USA FORMDATA
                    const careerFormData = new FormData();
                    careerFormData.append('name', document.getElementById('generic-name').value);
                    careerFormData.append('area', document.getElementById('generic-area').value);

                    // Manejo de imagen
                    const deleteCareerImage = document.getElementById('generic-image-delete-flag')?.value;
                    if (deleteCareerImage === 'true') careerFormData.append('deleteImage', 'true');

                    const careerFileInput = document.getElementById('generic-image-file');
                    const careerUrlInput = document.getElementById('generic-image-url');

                    if (careerFileInput && careerFileInput.files[0]) {
                        careerFormData.append('coverImage', careerFileInput.files[0]);
                    } else if (careerUrlInput && careerUrlInput.value.trim()) {
                        careerFormData.append('image_url', careerUrlInput.value.trim());
                    }

                    body = careerFormData;
                    break;
                case 'course':
                    // ✅ AHORA USA FORMDATA
                    const courseFormData = new FormData();
                    courseFormData.append('name', document.getElementById('generic-name').value);
                    // Append arrays as JSON strings or separate fields depending on backend expectation.
                    // For FormData usually we append multiple values with same key or a JSON string.
                    // Let's serialize to JSON for safety if backend expects JSON body usually.
                    // BUT since we are switching to FormData, standard is multiple keys. 
                    // Let's try appending JSON string for arrays which is robust for many backends.

                    const bookIds = this.getSelectedIds('generic-books');
                    const careerIds = this.getSelectedIds('generic-careers');

                    // Hack: Send as JSON string and ensure backend parses it. 
                    // Alternatively, append each id: careerIds[] = 1, careerIds[] = 2
                    // Let's stick to JSON string for arrays to keep it simple if backend logic supports `JSON.parse` on these fields.
                    courseFormData.append('bookIds', JSON.stringify(bookIds));
                    courseFormData.append('careerIds', JSON.stringify(careerIds));

                    // Manejo de imagen
                    const deleteCourseImage = document.getElementById('generic-image-delete-flag')?.value;
                    if (deleteCourseImage === 'true') courseFormData.append('deleteImage', 'true');

                    const courseFileInput = document.getElementById('generic-image-file');
                    const courseUrlInput = document.getElementById('generic-image-url');

                    if (courseFileInput && courseFileInput.files[0]) {
                        courseFormData.append('coverImage', courseFileInput.files[0]);
                    } else if (courseUrlInput && courseUrlInput.value.trim()) {
                        courseFormData.append('image_url', courseUrlInput.value.trim());
                    }

                    body = courseFormData;
                    break;
                case 'section':
                    const selectedCareers = Array.from(document.querySelectorAll('input[name="section-career-select"]:checked')).map(cb => cb.value);
                    const scheduleRows = document.querySelectorAll('.schedule-row');
                    body = {
                        courseId: document.getElementById('section-course-select').value,
                        careerIds: selectedCareers,
                        instructorId: document.getElementById('section-instructor-select').value || null,
                        schedule: Array.from(scheduleRows).map(row => ({
                            day: row.querySelector('.schedule-day').value, startTime: row.querySelector('.schedule-start').value, endTime: row.querySelector('.schedule-end').value, room: row.querySelector('.schedule-room').value, notes: row.querySelector('.schedule-notes')?.value || ''
                        }))
                    };
                    break;
                case 'instructor':
                    body = {
                        name: document.getElementById('generic-name').value,
                        email: document.getElementById('generic-email').value
                    };
                    break;
                case 'student': // ✅ NUEVO
                    body = {
                        name: document.getElementById('generic-name').value,
                        email: document.getElementById('generic-email').value
                    };
                    break;
                case 'topic':
                    // ✅ SOLUCIÓN: Enviar un array
                    const selectedBooksTopic = Array.from(document.querySelectorAll('input[name="generic-books"]:checked')).map(cb => cb.value);
                    body = {
                        name: document.getElementById('generic-name').value,
                        bookIds: selectedBooksTopic
                    };
                    break;
                case 'book':
                    // ✅ LÓGICA ESPECIAL: Usar FormData para subir archivos (imagen de portada)
                    const formData = new FormData();
                    formData.append('title', document.getElementById('generic-title').value);
                    formData.append('author', document.getElementById('generic-author').value);
                    formData.append('url', document.getElementById('generic-url').value);
                    // ✅ Type Field
                    formData.append('resource_type', document.getElementById('generic-type').value);
                    // ✅ Premium Field
                    formData.append('is_premium', document.getElementById('generic-is-premium').checked);

                    // ✅ NUEVO: Capturar Temas Seleccionados
                    const resourceTopicIds = this.getSelectedIds('generic-topics');
                    formData.append('topicIds', JSON.stringify(resourceTopicIds));

                    // ✅ NUEVO: Capturar Cursos Asociados
                    const resourceCourseIds = this.getSelectedIds('generic-courses');
                    formData.append('courseIds', JSON.stringify(resourceCourseIds));

                    // ✅ NUEVO: Manejo de eliminación de imagen
                    const deleteImageFlag = document.getElementById('generic-image-delete-flag')?.value;
                    if (deleteImageFlag === 'true') {
                        formData.append('deleteImage', 'true');
                    }

                    // ✅ Prioridad: 1. Archivo Local | 2. URL/Texto Manual
                    const fileInput = document.getElementById('generic-image-file');
                    const urlInput = document.getElementById('generic-image-url');

                    if (fileInput && fileInput.files[0]) {
                        formData.append('coverImage', fileInput.files[0]);
                    } else if (urlInput && urlInput.value.trim()) {
                        // Si no hay archivo pero hay texto, el backend lo tratará como la nueva image_url
                        formData.append('image_url', urlInput.value.trim());
                    }
                    if (method === 'PUT' && id) {
                        // Pasar ID si es update, aunque en FormData suele ir mejor en URL, el controlador espera el ID en URL.
                        // Pero si necesitamos ID en body en el futuro, se añade.
                        // formData.append('id', id);
                        // NOTA: Para imagen existente si no se sube una nueva, el backend mantiene la anterior.
                    }
                    body = formData; // Asignamos FormData en lugar de objeto JSON
                    break;
                case 'question':
                    const qTarget = document.getElementById('generic-target').value;
                    const qCareerEl = document.getElementById('generic-career');
                    const qData = {
                        question_text: document.getElementById('generic-question-text').value,
                        domain: document.getElementById('generic-domain').value,
                        target: qTarget,
                        // ✅ Mejora: Solo sobrescribir career si el target es SERUMS; de lo contrario, mantener nulo.
                        career: (qTarget === 'SERUMS' && qCareerEl) ? (qCareerEl.value || null) : null,
                        topic: document.getElementById('generic-topic').value,
                        subtopic: document.getElementById('generic-subtopic')?.value || null,
                        difficulty: 'Senior',
                        options: (qTarget === 'RESIDENTADO')
                            ? [
                                document.getElementById('generic-opt0').value,
                                document.getElementById('generic-opt1').value,
                                document.getElementById('generic-opt2').value,
                                document.getElementById('generic-opt3').value,
                                document.getElementById('generic-opt4').value
                            ]
                            : [
                                document.getElementById('generic-opt0').value,
                                document.getElementById('generic-opt1').value,
                                document.getElementById('generic-opt2').value,
                                document.getElementById('generic-opt3').value
                            ],
                        correct_answer: parseInt(document.getElementById('generic-correct-ans').value, 10),
                        explanation: document.getElementById('generic-explanation').value
                    };

                    const questionFormData = new FormData();
                    Object.keys(qData).forEach(key => {
                        if (key === 'options') {
                            questionFormData.append(key, JSON.stringify(qData[key]));
                        } else {
                            questionFormData.append(key, qData[key]);
                        }
                    });

                    // ✅ Lógica de Imagen de ENUNCIADO
                    const qImageFile = document.getElementById('generic-image-file');
                    const qImageUrl = document.getElementById('generic-image-url');
                    const qDeleteFlag = document.getElementById('generic-image-delete-flag');
                    
                    if (qImageFile && qImageFile.files[0]) {
                        questionFormData.append('questionImage', qImageFile.files[0]);
                    } else if (qImageUrl && qImageUrl.value.trim()) {
                        questionFormData.append('image_url', qImageUrl.value.trim());
                    } else if (method === 'PUT') {
                        if (qDeleteFlag && qDeleteFlag.value === 'true') {
                            questionFormData.append('deleteQuestionImage', 'true');
                            questionFormData.append('image_url', '');
                        } else {
                            questionFormData.append('image_url', qImageUrl.value || '');
                        }
                    }

                    // ✅ Lógica de Imagen de EXPLICACIÓN
                    const explImageFile = document.getElementById('generic-explanation-image-file');
                    const explImageUrl = document.getElementById('generic-explanation-image-url');
                    const explDeleteFlag = document.getElementById('generic-explanation-image-delete-flag');
                    
                    if (explImageFile && explImageFile.files[0]) {
                        questionFormData.append('explanationImage', explImageFile.files[0]);
                    } else if (explImageUrl && explImageUrl.value.trim()) {
                        questionFormData.append('explanation_image_url', explImageUrl.value.trim());
                    } else if (method === 'PUT') {
                        if (explDeleteFlag && explDeleteFlag.value === 'true') {
                            questionFormData.append('deleteExplanationImage', 'true');
                            questionFormData.append('explanation_image_url', '');
                        } else {
                            questionFormData.append('explanation_image_url', explImageUrl.value || '');
                        }
                    }

                    body = questionFormData;
                    break;
                case 'ai-question': {
                    const aiBtn = document.getElementById('generic-save-btn');
                    const originalText = aiBtn.innerHTML;
                    try {
                        aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Lote (2-3 min)... por favor no cierre.';
                        aiBtn.disabled = true;

                        // Áreas de Estudio seleccionadas (checkboxes) → van al campo `studyAreas`
                        const selectedStudyAreas = Array.from(document.querySelectorAll('.ai-domain-cb:checked')).map(cb => cb.value);
                        if (selectedStudyAreas.length === 0) {
                            throw new Error("Por favor selecciona al menos una Área de Estudio/Especialidad.");
                        }

                        const targetVal = document.getElementById('ai-target').value;
                        const careerSelectEl = document.getElementById('ai-career');
                        const careerVal = targetVal === 'SERUMS' && careerSelectEl ? careerSelectEl.value : null;

                        // Dominio global del banco (medicine | english | general_trivia) — campo separado
                        const domainVal = document.getElementById('ai-domain-select')?.value || 'medicine';

                        const reqBody = {
                            target: targetVal,
                            career: careerVal,
                            difficulty: 'Senior',
                            domain: domainVal,                       // Dominio global de la BD
                            studyAreas: selectedStudyAreas.join(', ') // Áreas de estudio para el prompt de la IA
                        };
                        const aiUrl = `${window.AppConfig.API_URL}/api/admin/questions/generate-ai`;
                        const resAi = await fetch(aiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                            body: JSON.stringify(reqBody)
                        });
                        const resDataAi = await resAi.json();
                        if (!resAi.ok) throw new Error(resDataAi.error || 'Error al generar preguntas IA');

                        await window.confirmationModal.showAlert(`¡Éxito! ${resDataAi.message}`, 'Banco Inyectado Automáticamente');
                        this.closeGenericModal();
                        await this.loadAllData();
                        return; // Retorno anticipado
                    } catch (err) {
                        throw err; // Pasa el error al catch global
                    } finally {
                        if (aiBtn) { aiBtn.innerHTML = originalText; aiBtn.disabled = false; }
                    }
                }
                case 'bulk-question': {
                    const jsonInput = document.getElementById('generic-bulk-json');
                    const fileInput = document.getElementById('generic-bulk-file');

                    // Prioridad 1: JSON pegado directamente
                    if (jsonInput && jsonInput.value.trim()) {
                        try {
                            body = JSON.parse(jsonInput.value.trim());
                            if (!Array.isArray(body)) throw new Error("El JSON debe ser un array de objetos.");
                        } catch (err) {
                            throw new Error("Error en formato JSON: " + err.message);
                        }
                    }
                    // Prioridad 2: Archivo subido
                    else if (fileInput && fileInput.files.length) {
                        const file = fileInput.files[0];
                        body = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                try {
                                    const data = new Uint8Array(e.target.result);
                                    if (typeof window.XLSX === 'undefined') throw new Error("La librería procesadora de Excel no ha cargado completamente. Intenta recargar la página.");

                                    const workbook = window.XLSX.read(data, { type: 'array' });
                                    const sheetName = workbook.SheetNames[0];
                                    const sheet = workbook.Sheets[sheetName];
                                    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

                                    if (rows.length < 2) throw new Error("El archivo está vacío o solo contiene la fila de encabezados.");

                                    // Omitir la fila 0 (encabezados)
                                    const parsed = rows.slice(1).filter(row => row.length > 0 && row[0]).map((cols, i) => {
                                        if (!cols[0]) return null;
                                        return {
                                            question_text: String(cols[0] || '').trim(),
                                            domain: String(cols[1] || 'medicine').trim(),
                                            target: cols[2] ? String(cols[2]).trim() : null,
                                            career: cols[3] ? String(cols[3]).trim() : null,
                                            topic: String(cols[4] || 'General').trim(),
                                            difficulty: 'Senior',
                                            options: (String(cols[2] || '').trim().toUpperCase() === 'RESIDENTADO') ? [
                                                String(cols[6] || 'Opción A').trim(),
                                                String(cols[7] || 'Opción B').trim(),
                                                String(cols[8] || 'Opción C').trim(),
                                                String(cols[9] || 'Opción D').trim(),
                                                String(cols[10] || 'Opción E').trim()
                                            ] : [
                                                String(cols[6] || 'Opción A').trim(),
                                                String(cols[7] || 'Opción B').trim(),
                                                String(cols[8] || 'Opción C').trim(),
                                                String(cols[9] || 'Opción D').trim()
                                            ],
                                            correct_answer: parseInt(cols[11] || 0, 10),
                                            explanation: cols[12] ? String(cols[12]).trim() : null,
                                            image_url: cols[13] ? String(cols[13]).trim() : null,
                                            subtopic: cols[14] ? String(cols[14]).trim() : null,
                                            explanation_image_url: cols[15] ? String(cols[15]).trim() : null
                                        };
                                    }).filter(Boolean);

                                    if (parsed.length === 0) throw new Error("No se encontraron preguntas válidas en el documento.");
                                    resolve(parsed);
                                } catch (err) {
                                    reject(new Error("Error parseando archivo: " + err.message));
                                }
                            };
                            reader.onerror = () => reject(new Error("Error leyendo el archivo desde el disco."));
                            reader.readAsArrayBuffer(file);
                        });
                    } else {
                        throw new Error('Por favor pega el JSON o selecciona un archivo Excel/CSV.');
                    }

                    // Enviar petición Custom para inyección masiva
                    const _url = `${window.AppConfig.API_URL}/api/admin/questions/bulk`;
                    const _response = await fetch(_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                        body: JSON.stringify(body)
                    });
                    const _responseData = await _response.json();
                    if (!_response.ok) throw new Error(_responseData.error || 'Error al inyectar lote.');

                    await window.confirmationModal.showAlert(`¡Éxito! ${_responseData.message}`, 'Inyección Completada');
                    this.closeGenericModal();
                    await this.loadAllData();
                    return; // Retorno anticipado
                }

                default:
                    throw new Error(`Tipo de entidad no manejado: ${type}`);
            }

            // ✅ SOLUCIÓN DEFINITIVA: Añadir el ID al cuerpo de la petición SOLO si estamos
            // actualizando un registro existente (método PUT) Y si NO estamos usando FormData.
            // (Si usamos FormData, no podemos mezclarlo con JSON body fácilmente aquí).
            if (method === 'PUT' && id && !(body instanceof FormData)) {
                body.id = id;
            }

            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            };

            // ✅ FIX: Content-Type NO debe establecerse para FormData (el navegador pone boundary)
            if (!(body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: (body instanceof FormData) ? body : JSON.stringify(body)
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || `Error al guardar ${type}`);
            }

            const successMessage = method === 'POST' && responseData.tempPassword ? `¡Guardado con éxito! La contraseña temporal es: ${responseData.tempPassword}` : '¡Guardado con éxito!';
            await window.confirmationModal.showAlert(successMessage, 'Éxito');

            this.closeGenericModal();
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            console.error(`❌ Error guardando ${type}:`, error);

            // ✅ NUEVO: Manejo específico para sesión expirada
            if (error.message.includes('Token expirado') || error.message.includes('Token inválido') || error.message.includes('Acceso denegado')) {
                await window.confirmationModal.showAlert('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.', 'Sesión Expirada');
                // Opcional: Redirigir al login después de que el usuario cierre el modal (si showAlert tuviera callback, o con un pequeño delay)
                // setTimeout(() => window.location.href = '/login', 2000);
            } else {
                await window.confirmationModal.showAlert(`Error al guardar: ${error.message}`, 'Error');
            }
        } finally {
            // ✅ MEJORA UI/UX: Restaurar botón independientemente de si hubo éxito o error
            if (saveBtn) {
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            }
        }
    }

    async handleDelete(type, id) {
        if (!await window.confirmationModal.show(`¿Estás seguro de que quieres eliminar este elemento (${type})? Esta acción no se puede deshacer.`, 'Eliminar Elemento', 'Eliminar', 'Cancelar')) return;

        try {
            let url = `${window.AppConfig.API_URL}/api/${type}s/${id}`;
            if (type === 'question') {
                url = `${window.AppConfig.API_URL}/api/admin/question/${id}`;
            }

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error al eliminar ${type}`);
            }

            await window.confirmationModal.showAlert('Elemento eliminado con éxito.', 'Éxito');
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            console.error(`❌ Error eliminando ${type}:`, error);

            // ✅ NUEVO: Manejo específico para sesión expirada
            if (error.message.includes('Token expirado') || error.message.includes('Token inválido') || error.message.includes('Acceso denegado')) {
                await window.confirmationModal.showAlert('Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.', 'Sesión Expirada');
            } else {
                await window.confirmationModal.showAlert(`Error al eliminar: ${error.message}`, 'Error');
            }
        }
    }

    // ✅ NUEVO: Manejador para restablecer la contraseña de un usuario (docente).
    async handleResetPassword(userId) {
        const instructor = this.allInstructors.find(i => i.id === parseInt(userId, 10));
        if (!instructor) {
            await window.confirmationModal.showAlert('Error: No se encontró al instructor.', 'Error');
            return;
        }

        if (!await window.confirmationModal.show(`¿Estás seguro de que quieres restablecer la contraseña para ${instructor.name}? Se generará una nueva contraseña temporal.`, 'Restablecer Contraseña', 'Restablecer', 'Cancelar')) {
            return;
        }

        try {
            const response = await fetch(`${window.AppConfig.API_URL}/api/users/${userId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // ✅ SOLUCIÓN: Añadir el token de autorización a la cabecera.
                    // El token se guarda en localStorage al iniciar sesión.
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'No se pudo restablecer la contraseña.');
            }

            const { newPassword } = await response.json();
            await window.confirmationModal.showAlert(`¡Éxito! La nueva contraseña temporal para ${instructor.name} es:\n\n${newPassword}\n\nPor favor, compártela de forma segura.`, 'Contraseña Restablecida');
        } catch (error) {
            console.error('❌ Error al restablecer la contraseña:', error);
            await window.confirmationModal.showAlert(`Error: ${error.message}`, 'Error');
        }
    }

    renderTopicResources(resources) {
        const container = document.getElementById('resources-container');
        if (!container) return; // ✅ SAFETY CHECK: Evitar crash si el contenedor no existe.
        container.innerHTML = '';

        // Renderizar PDFs existentes
        if (resources && resources.pdfs) {
            resources.pdfs.forEach(pdf => { if (pdf.name || pdf.url) this.addResourceField('pdf', pdf.name, pdf.url); });
        }
        // Renderizar enlaces existentes
        if (resources && resources.links) {
            resources.links.forEach(link => { if (link.name || link.url) this.addResourceField('link', link.name, link.url); });
        }
    }

    addResourceField(type, name = '', url = '') {
        const container = document.getElementById('resources-container');
        const div = document.createElement('div');
        div.className = 'resource-field'; div.dataset.type = type;
        div.innerHTML = `
                <input type="text" placeholder="Nombre del ${type}" value="${name}" class="resource-name">
                    <input type="text" placeholder="URL del recurso" value="${url}" class="resource-url">
                        <button type="button" class="remove-resource-btn">❌</button>
                        `;
        container.appendChild(div);

        // El botón de eliminar se maneja por delegación de eventos
    }

    // ✅ NUEVO: Función auxiliar para crear el encabezado de las pestañas con la barra de búsqueda y ordenamiento.
    _createTabHeaderHTML(type, buttonLabel, tabId) {
        const currentSort = this.tabSortState[tabId] || 'date-desc';
        // ✅ UX MEJORA: Ocultar el filtro de ordenamiento en la pestaña "Secciones" ya que tiene su propio agrupamiento.
        const showSort = tabId !== 'tab-sections';

        const sortSelectHTML = showSort ? `
                        <select class="tab-sort-select" data-tab="${tabId}" style="padding: 0 15px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; height: 40px; font-size: 0.9rem;">
                            <option value="date-desc" ${currentSort === 'date-desc' ? 'selected' : ''}>📅 Más Recientes</option>
                            <option value="date-asc" ${currentSort === 'date-asc' ? 'selected' : ''}>📅 Más Antiguos</option>
                            <option value="alpha-asc" ${currentSort === 'alpha-asc' ? 'selected' : ''}>🔤 A-Z</option>
                            <option value="alpha-desc" ${currentSort === 'alpha-desc' ? 'selected' : ''}>🔤 Z-A</option>
                        </select>
                        ` : '';

        return `
                        <div class="tab-header-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px;">
                            <div class="search-sort-wrapper" style="display: flex; gap: 10px; align-items: center; flex: 1;">
                                <!-- ✅ UX MEJORA: Barra de búsqueda con ancho fijo y mejor padding para evitar solapamiento del icono -->
                                <div class="search-bar-container" style="display: flex; align-items: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 0 12px; width: 300px; height: 40px; transition: border-color 0.2s;">
                                    <i class="fas fa-search" style="color: var(--text-secondary); margin-right: 10px; font-size: 0.9rem;"></i>
                                    <input type="text"
                                        class="admin-search-input"
                                        placeholder="Buscar..."
                                        data-target-tab="${tabId}"
                                        style="border: none; background: transparent; flex: 1; color: var(--text-primary); outline: none; font-size: 0.9rem;">
                                </div>

                                ${sortSelectHTML}
                            </div>
                            <button class="btn-primary" onclick="window.adminManager.openGenericModal('${type}')" style="height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 20px;">
                                <i class="fas fa-plus"></i> <span>${buttonLabel}</span>
                            </button>
                        </div>
                        `;
    }

    // ✅ NUEVO: Generador dinámico de Plantilla Excel para usuarios
    downloadExcelTemplate() {
        if (typeof window.XLSX !== 'undefined') {
            const ws_data = [
                ['PREGUNTA (*)', 'DOMINIO (medicine/english)', 'TARGET (ENAM/SERUMS/RESIDENTADO)', 'CARRERA (Solo SERUMS)', 'AREA_ESTUDIO (*)', 'DIFICULTAD', 'OPCION_A (*)', 'OPCION_B (*)', 'OPCION_C (*)', 'OPCION_D (*)', 'OPCION_E (Solo RESIDENTADO)', 'INDEX_CORRECTA (0 al 4) (*)', 'EXPLICACION', 'URL_IMAGEN', 'SUBTEMA (OPCIONAL)'],
                ['¿Fármaco de elección en tormenta tiroidea?', 'medicine', 'ENAM', '', 'Cardiología', 'Intermedio', 'Propiltiouracilo', 'Metimazol', 'Yodo', 'Propranolol', '', '0', 'Bloquea la conversión periférica de T4 a T3 urgentemente.', '', 'Emergencias Endocrinas'],
                ['¿Qué vacuna se aplica a la gestante según calendario PAI SERUMS?', 'medicine', 'SERUMS', 'Enfermería', 'Inmunizaciones', 'Básico', 'Hepatitis B', 'dTpa', 'Rotavirus', 'VPH', '', '1', 'La dTpa se aplica entre la semana 27 y 36 de gestación.', '', 'PAI'],
                ['¿Causa más frecuente de absceso hepático piógeno?', 'medicine', 'RESIDENTADO', '', 'Gastroenterología', 'Avanzado', 'E. Coli', 'K. pneumoniae', 'Bacteroides fragilis', 'Streptococcus milleri', 'Entamoeba histolytica', '1', 'Klebsiella pneumoniae es actualmente el principal agente causal, especialmente en diabéticos (Harrison).', '', 'Cirugía Hepatobiliar']
            ];
            const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Preguntas");
            window.XLSX.writeFile(wb, "HubAcademia_Plantilla_Banco_Preguntas.xlsx");
        } else {
            console.error('SheetJS no detectado');
            alert("No se cargaron los recursos para descargar el excel. Refresca la página.");
        }
    }

}

// Inicializar administrador
window.adminManager = new AdminManager();