class AdminManager {
    constructor() {
        // Almacenes de datos
        this.allCareers = [];
        this.allCourses = []; // Cursos base (de courses.json)
        this.allSections = []; // Secciones (de sections.json)
        this.allInstructors = [];
        this.allStudents = []; // ✅ NUEVO: Almacén para alumnos
        this.allTopics = []; // Nuevo almacén para temas
        this.allBooks = []; // Nuevo almacén para libros

        // Estado de ordenamiento
        // ✅ NUEVO: Estado de ordenamiento por pestaña
        this.tabSortState = {
            'tab-sections': 'date-desc',
            'tab-careers': 'date-desc',
            'tab-courses': 'date-desc',
            'tab-instructors': 'date-desc',
            'tab-students': 'date-desc',
            'tab-topics': 'date-desc',
            'tab-books': 'date-desc'
        };

        // Elementos del DOM
        this.sectionsContainer = document.getElementById('tab-sections');
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

        // Delegación de eventos para expandir/colapsar tarjetas de carrera
        this.sectionsContainer.addEventListener('click', e => {
            const header = e.target.closest('.career-card-header');
            // ✅ MEJORA: Asegurarse de que el clic no fue en un botón dentro del header.
            if (header && !e.target.closest('button')) {
                header.parentElement.classList.toggle('expanded');
            }
        });

        // Delegación de eventos para todo el contenedor principal (editar, eliminar)
        this.setupMainContainerDelegation();

        this.genericForm.addEventListener('submit', (e) => { e.preventDefault(); this.saveGenericForm(); });

        // ✅ SOLUCIÓN DEFINITIVA: Devolver el control del modal a admin.js.
        // Este listener se encarga de cerrar el modal genérico desde el panel de admin,
        // evitando conflictos con la lógica global de app.js.
        this.genericModal.addEventListener('click', (e) => {
            // Cerrar si se hace clic en el fondo (overlay) o en un botón con la clase .modal-close
            if (e.target === this.genericModal || e.target.closest('.modal-close')) {
                // Detenemos la propagación para que el listener global de app.js no interfiera.
                // Esto asegura que solo admin.js controle el cierre de este modal específico.
                e.stopPropagation();
                this.closeGenericModal();
            }
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
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // ✅ RENDERIZAR CONTENIDO DE LA PESTAÑA ACTIVA
        if (tabId === 'tab-sections') this.displaySections();
        if (tabId === 'tab-courses') this.displayBaseCourses();
        if (tabId === 'tab-instructors') this.displayInstructors();
        if (tabId === 'tab-topics') this.displayTopics();
        if (tabId === 'tab-students') this.displayStudents(); // ✅ NUEVO
        if (tabId === 'tab-books') this.displayBooks(); // Nueva pestaña
        if (tabId === 'tab-careers') this.displayCareers();
    }

    // ✅ NUEVO: Método auxiliar para obtener las cabeceras de autenticación.
    _getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        };
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
            const [careersRes, coursesRes, sectionsRes, instructorsRes, studentsRes, topicsRes, booksRes] = await Promise.all([
                fetch(`${window.AppConfig.API_URL}/api/careers`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/courses`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/sections`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/instructors`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/students`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/topics`, { headers: this._getAuthHeaders() }),
                fetch(`${window.AppConfig.API_URL}/api/books`, { headers: this._getAuthHeaders() })
            ]);

            for (const res of [careersRes, coursesRes, sectionsRes, instructorsRes, studentsRes, topicsRes, booksRes]) {
                if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
            }

            this.allCareers = await careersRes.json();
            this.allCourses = await coursesRes.json();
            this.allSections = await sectionsRes.json();
            this.allInstructors = await instructorsRes.json();
            this.allStudents = await studentsRes.json(); // ✅ NUEVO
            this.allTopics = await topicsRes.json();
            this.allBooks = await booksRes.json(); // Cargar libros

            // ✅ CORRECCIÓN: Renderizar todas las pestañas DESPUÉS de que todos los datos se hayan cargado
            this.displaySections();
            this.displayCareers();
            this.displayBaseCourses();
            this.displayInstructors();
            this.displayStudents(); // ✅ NUEVO
            this.displayTopics();
            this.displayBooks();

        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            this.sectionsContainer.innerHTML = `<p class="error-state">Error al cargar los datos del panel. Asegúrate de que el servidor esté funcionando y las rutas API estén correctas.</p>`;
        }
    }

    // Nueva pestaña para Secciones (CarrerasUC)
    displaySections() {
        const container = document.getElementById('tab-sections');
        // ✅ SOLUCIÓN: Usar la función estandarizada para crear el header con la barra de búsqueda.
        let header = this._createTabHeaderHTML('section', 'Añadir Sección', 'tab-sections');

        // 1. Agrupar secciones por carrera
        const sectionsByCareer = new Map();
        // ✅ APLICAR ORDENAMIENTO A LAS SECCIONES
        const sortedSections = this.sortData(this.allSections, 'section', 'tab-sections');

        sortedSections.forEach(section => {
            section.careerIds.forEach(careerId => {
                if (!sectionsByCareer.has(careerId)) {
                    sectionsByCareer.set(careerId, []);
                }
                sectionsByCareer.get(careerId).push(section);
            });
        });

        // 2. Ordenar carreras alfabéticamente por nombre (esto se mantiene igual para la agrupación)
        const sortedCareerIds = [...sectionsByCareer.keys()].sort((idA, idB) => {
            const careerA = this.allCareers.find(c => c.id === idA)?.name || '';
            const careerB = this.allCareers.find(c => c.id === idB)?.name || '';
            return careerA.localeCompare(careerB);
        });

        // Si no hay secciones, mostrar el header y el mensaje de estado vacío.
        if (!this.allSections || this.allSections.length === 0) {
            container.innerHTML = header + `<p class="empty-state">📭 No hay secciones para mostrar.</p>`;
            return;
        }

        const dataForCards = { allCourses: this.allCourses, allInstructors: this.allInstructors, allCareers: this.allCareers };

        // 3. Renderizar HTML agrupado
        // ✅ SOLUCIÓN: Declarar la variable 'html' como una cadena vacía antes de usarla.
        let html = '';
        sortedCareerIds.forEach(careerId => {
            const career = this.allCareers.find(c => c.id === careerId);
            const sections = sectionsByCareer.get(careerId);
            html += `
                <div class="career-card">
                    <div class="career-card-header">
                        <h3>${career ? career.name : 'Carrera Desconocida'} (${sections.length} cursos)</h3>
                        <span class="toggle-arrow">›</span>
                    </div>
                    <div class="career-card-details">
                        ${sections.map(section => createAdminSectionCardHTML(section, dataForCards)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = header + html;
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

    displayInstructors() {
        const container = document.getElementById('tab-instructors');
        // ✅ APLICAR ORDENAMIENTO
        const sortedInstructors = this.sortData(this.allInstructors, 'instructor', 'tab-instructors');
        const itemsHTML = sortedInstructors.map(instructor => createAdminItemCardHTML(instructor, 'instructor', `(${instructor.email})`, true)).join('');
        const content = this._createTabHeaderHTML('instructor', 'Añadir Docente', 'tab-instructors') +
            (itemsHTML || '<p class="empty-state">No hay docentes.</p>');
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
        const content = this._createTabHeaderHTML('book', 'Añadir Libro', 'tab-books') +
            (itemsHTML || '<p class="empty-state">No hay libros.</p>');
        container.innerHTML = content;
    }

    openGenericModal(type, id = null) {
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
                    this.createFormGroup('textarea', 'description', 'Descripción de la Carrera', currentItem?.description || '') +
                    this.createFormGroup('text', 'generic-url', 'URL de la Malla Curricular', currentItem?.curriculum_url || '');
                break;
            // ...
            case 'course':
                title.textContent = id ? 'Editar Curso' : 'Añadir Curso';
                if (id) currentItem = this.allCourses.find(c => c.id === parseInt(id, 10));
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Curso (*)', currentItem?.name || '', true) +
                    this.createFormGroup('textarea', 'description', 'Descripción del Curso', currentItem?.description || '') +
                    this.createCheckboxList('Temas Asociados', 'generic-topics', this.allTopics, currentItem?.topicIds || []) +
                    this.createCheckboxList('Libros de Referencia', 'generic-books', this.allBooks, currentItem?.bookIds || [], 'book');
                break;
            case 'topic':
                title.textContent = id ? 'Editar Tema' : 'Añadir Tema';
                if (id) currentItem = this.allTopics.find(t => t.id === parseInt(id, 10));
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Tema (*)', currentItem?.name || '', true) +
                    this.createFormGroup('textarea', 'description', 'Descripción del Tema', currentItem?.description || '') +
                    // ✅ SOLUCIÓN: Mostrar la lista de libros para asociarlos al tema.
                    this.createCheckboxList('Libros de Referencia', 'generic-books', this.allBooks, currentItem?.bookIds || [], 'book') +
                    '<div id="resources-container"></div>';
                break;
            case 'section':
                title.textContent = id ? 'Editar Sección' : 'Añadir Sección';
                if (id) currentItem = this.allSections.find(s => s.id === parseInt(id, 10));
                fieldsHTML = `
                    <fieldset>
                        <legend>Información Principal</legend>
                        ${this.createSearchableSelect('section-course-select', 'Curso Base (*)', this.allCourses, currentItem?.courseId)}
                        <!-- ✅ CORRECCIÓN: La lista de docentes para el dropdown ahora viene de this.allInstructors, que se carga desde la tabla users. -->
                        ${this.createCheckboxList('Carreras (*)', 'section-career-select', this.allCareers, currentItem?.careerIds || [])}
                        ${this.createSearchableSelect('section-instructor-select', 'Docente', this.allInstructors, currentItem?.instructorId, true)}
                    </fieldset>
                    <fieldset>
                        <legend>Horarios</legend>
                        <div id="schedule-container"></div>
                        <button type="button" id="add-schedule-row" class="btn-secondary">Añadir Horario</button>
                    </fieldset>
                `;
                break;
            case 'instructor':
                title.textContent = id ? 'Editar Docente' : 'Añadir Docente';
                if (id) currentItem = this.allInstructors.find(i => i.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Docente (*)', currentItem?.name || '', true) +
                    this.createFormGroup('email', 'generic-email', 'Email (*)', currentItem?.email || '', true);
                break;
            case 'student': // ✅ NUEVO
                title.textContent = id ? 'Editar Alumno' : 'Añadir Alumno';
                if (id) currentItem = this.allStudents.find(i => i.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Alumno (*)', currentItem?.name || '', true) +
                    this.createFormGroup('email', 'generic-email', 'Email (*)', currentItem?.email || '', true);
                break;
            case 'book':
                title.textContent = id ? 'Editar Libro' : 'Añadir Libro';
                if (id) currentItem = this.allBooks.find(b => b.id === parseInt(id, 10));
                fieldsHTML = this.createFormGroup('text', 'generic-title', 'Título del Libro (*)', currentItem?.title || '', true) +
                    this.createFormGroup('text', 'generic-author', 'Autor (*)', currentItem?.author || '', true) +
                    this.createFormGroup('text', 'generic-url', 'URL del Recurso (*)', currentItem?.url || '', true) +
                    this.createFormGroup('text', 'generic-size', 'Tamaño (ej: 15 MB)', currentItem?.size || '');
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

        // Cargar datos existentes para sección
        if (type === 'section' && currentItem) {
            (currentItem.schedule || []).forEach(s => this.addScheduleRow(s.day, s.startTime, s.endTime, s.room));
        } else if (type === 'section') {
            this.addScheduleRow(); // Añadir una fila por defecto al crear
        }

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

        const sortedOptions = [...options].sort((a, b) => {
            const nameA = type === 'book' ? a.title : a.name;
            const nameB = type === 'book' ? b.title : b.name;
            return nameA.localeCompare(nameB);
        });
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
        newRow.innerHTML = `<input type="text" class="schedule-day" placeholder="Día" value="${day}" required><input type="time" class="schedule-start" value="${startTime}" required><input type="time" class="schedule-end" value="${endTime}" required><input type="text" class="schedule-room" placeholder="Salón" value="${room}"><input type="text" class="schedule-notes" placeholder="Notas/Carrera (Opcional)" value="${notes}"><button type="button" class="remove-schedule-row">×</button>`;
        container.appendChild(newRow);
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
        const url = id ? `${window.AppConfig.API_URL}/api/${type}s/${id}` : `${window.AppConfig.API_URL}/api/${type}s`;
        const method = id ? 'PUT' : 'POST';

        let body = {};

        try {
            switch (type) {
                case 'career':
                    body = {
                        name: document.getElementById('generic-name').value,
                        area: document.getElementById('generic-area').value,
                        description: document.getElementById('description').value,
                        curriculumUrl: document.getElementById('generic-url').value
                    };
                    break;
                case 'course':
                    const selectedTopics = Array.from(document.querySelectorAll('input[name="generic-topics"]:checked')).map(cb => cb.value);
                    const selectedBooks = Array.from(document.querySelectorAll('input[name="generic-books"]:checked')).map(cb => cb.value);
                    const selectedRelatedCourses = Array.from(document.querySelectorAll('input[name="generic-related-courses"]:checked')).map(cb => cb.value);
                    body = {
                        name: document.getElementById('generic-name').value, // Esto es correcto para los cursos.
                        description: document.querySelector('textarea[name="description"]')?.value || '', // Se obtiene del textarea
                        topicIds: selectedTopics,
                        bookIds: selectedBooks,
                        relatedCourseIds: selectedRelatedCourses
                    };
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
                    // ✅ SOLUCIÓN: Enviar un array                case 'topic':
                    const selectedBooksTopic = Array.from(document.querySelectorAll('input[name="generic-books"]:checked')).map(cb => cb.value);
                    body = {
                        name: document.getElementById('generic-name').value,
                        description: document.querySelector('textarea[name="description"]')?.value || '',
                        bookIds: selectedBooksTopic
                    };
                    break;
                case 'book':
                    body = {
                        title: document.getElementById('generic-title').value, // ✅ CORRECCIÓN: El ID para el título del libro es 'generic-title'.
                        author: document.getElementById('generic-author').value,
                        url: document.getElementById('generic-url').value,
                        size: document.getElementById('generic-size').value // ✅ MEJORA: Guardar el tamaño.
                    };
                    break;
                default:
                    throw new Error(`Tipo de entidad no manejado: ${type}`);
            }

            // ✅ SOLUCIÓN DEFINITIVA: Añadir el ID al cuerpo de la petición SOLO si estamos
            // actualizando un registro existente (método PUT).
            // Para la creación (POST), el ID no se incluye, permitiendo que la base de datos lo genere.
            if (method === 'PUT' && id) {
                body.id = id;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            };

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(body)
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
            await window.confirmationModal.showAlert(`Error al guardar: ${error.message}`, 'Error');
        }
    }

    async handleDelete(type, id) {
        if (!await window.confirmationModal.show(`¿Estás seguro de que quieres eliminar este elemento (${type})? Esta acción no se puede deshacer.`, 'Eliminar Elemento', 'Eliminar', 'Cancelar')) return;

        try {
            const url = `${window.AppConfig.API_URL}/api/${type}s/${id}`;
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
            await window.confirmationModal.showAlert(`Error al eliminar: ${error.message}`, 'Error');
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

}

// Inicializar administrador
window.adminManager = new AdminManager();