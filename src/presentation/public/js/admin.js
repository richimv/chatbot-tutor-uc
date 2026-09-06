class AdminManager {
    constructor() {
        // Almacenes de datos
        this.allCareers = [];
        this.allCourses = []; // Cursos base (de courses.json)
        this.allStudents = []; // Almacén para alumnos
        this.allTopics = []; // Almacén para temas
        this.allBooks = []; // Almacén para libros
        this.allQuestions = []; // Almacén para preguntas
        this.allCases = []; // Almacén para casuísticas

        // Estado de ordenamiento por pestaña
        this.tabSortState = {
            'tab-careers': 'date-desc',
            'tab-courses': 'date-desc',
            'tab-students': 'date-desc',
            'tab-topics': 'date-desc',
            'tab-books': 'date-desc',
            'tab-questions': 'date-desc',
            'tab-cases': 'date-desc'
        };
        this.previewTimer = null; // Debounce para previsualización

        // Estado de búsqueda y filtros persistentes
        this.searchState = {
            'tab-careers': { search: '', filter: 'all' },
            'tab-courses': { search: '', filter: 'all' },
            'tab-students': { search: '', filter: 'all' },
            'tab-topics': { search: '', filter: 'all' },
            'tab-books': { search: '', filter: 'all' },
            'tab-questions': { search: '', filter: 'all' },
            'tab-cases': { search: '', filter: 'all' }
        };
        this.selectedIds = [];
        this.selectedType = '';
        this.lastCheckedCheckbox = null;

        // Estado de Preguntas y Casuísticas
        this.currentQuestionDomain = 'all';
        this.currentQuestionSearch = '';
        this.searchTimeout = null;

        this.currentCaseDomain = 'all';
        this.currentCaseSearch = '';
        this.caseSearchTimeout = null;

        // Elementos del DOM
        this.genericModal = document.getElementById('generic-modal');
        this.genericForm = document.getElementById('generic-form');
        this.sectionsContainer = document.getElementById('admin-main-container');


        // SOLUCIÓN: Bindeo explícito para el nuevo manejador de eventos.
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

                // SOLUCIÓN: Cerrar si el clic NO está en la barra de búsqueda NI en la lista.
                if (!toggle.contains(e.target) && !list.contains(e.target)) {
                    openDropdown.classList.remove('open');
                    this._updateDropdownState(openDropdown); // SOLUCIÓN: Actualizar estado en lugar de limpiar.
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

        // SOLUCIÓN DEFINITIVA: Devolver el control del modal a admin.js.
        // Este listener se encarga de cerrar el modal genérico desde el panel de admin,
        // evitando conflictos con la lógica global de app.js.
        // SOLUCIÓN UX: Prevenir cierres accidentales al seleccionar texto y soltar fuera.
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

        // SOLUCIÓN: Listener centralizado para todos los componentes interactivos dentro del modal genérico.
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
                    this._updateDropdownState(currentContainer); // SOLUCIÓN: Actualizar estado en lugar de limpiar.
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

            // NUEVO: Listeners para el Gestor de Unidades
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

        const handleSearchFilter = (e) => {
            if (e.target.classList.contains('admin-search-input') || e.target.classList.contains('admin-type-filter')) {
                clearTimeout(this.searchTimeout);
                const input = e.target;

                this.searchTimeout = setTimeout(() => {
                    const tabId = input.dataset.targetTab || input.dataset.tab;
                    if (!tabId) return;

                    const tabContent = document.getElementById(tabId);
                    const searchInput = tabContent.querySelector('.admin-search-input');
                    const typeSelect = tabContent.querySelector('.admin-type-filter');

                    // Guardar estado
                    this.searchState[tabId] = {
                        search: searchInput ? searchInput.value.trim() : '',
                        filter: typeSelect ? typeSelect.value : 'all'
                    };

                    this.applySearchFilterForTab(tabId);
                }, 200);
            }
        };

        document.getElementById('admin-main-container').addEventListener('input', handleSearchFilter);
        document.getElementById('admin-main-container').addEventListener('change', handleSearchFilter);

        // ✅ NUEVO: Listener delegado para los controles de ordenamiento en cada pestaña
        document.getElementById('admin-main-container').addEventListener('change', (e) => {
            if (e.target.classList.contains('tab-sort-select')) {
                const tabId = e.target.dataset.tab;
                this.tabSortState[tabId] = e.target.value;
                // Re-renderizar la pestaña actual
                this.switchTab(tabId);
            }
        });

        // ✅ NUEVO: Listener delegado para los checkboxes de selección masiva (con soporte para Shift + Click)
        document.getElementById('admin-main-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('admin-item-checkbox')) {
                const currentCheckbox = e.target;
                const id = currentCheckbox.dataset.id;
                const type = currentCheckbox.dataset.type;
                this.selectedType = type;

                // Encontrar el contenedor de la pestaña activa
                const activeTab = document.querySelector('.tab-content.active');
                if (!activeTab) return;

                // Obtener todos los checkboxes en la pestaña activa
                const checkboxes = Array.from(activeTab.querySelectorAll('.admin-item-checkbox'));

                if (e.shiftKey && this.lastCheckedCheckbox && activeTab.contains(this.lastCheckedCheckbox)) {
                    const start = checkboxes.indexOf(currentCheckbox);
                    const end = checkboxes.indexOf(this.lastCheckedCheckbox);

                    if (start !== -1 && end !== -1) {
                        const rangeStart = Math.min(start, end);
                        const rangeEnd = Math.max(start, end);
                        const isChecked = currentCheckbox.checked;

                        for (let i = rangeStart; i <= rangeEnd; i++) {
                            const cb = checkboxes[i];
                            cb.checked = isChecked;

                            const itemVal = cb.dataset.id;
                            if (isChecked) {
                                if (!this.selectedIds.includes(itemVal)) {
                                    this.selectedIds.push(itemVal);
                                }
                            } else {
                                this.selectedIds = this.selectedIds.filter(itemId => itemId !== itemVal);
                            }
                        }
                    }
                } else {
                    // Clic individual
                    if (currentCheckbox.checked) {
                        if (!this.selectedIds.includes(id)) {
                            this.selectedIds.push(id);
                        }
                    } else {
                        this.selectedIds = this.selectedIds.filter(itemId => itemId !== id);
                    }
                }

                this.lastCheckedCheckbox = currentCheckbox;
                this.updateBulkActionsBar();
            }
        });

        // Botones de la barra de acciones masivas
        const cancelBtn = document.getElementById('bulk-cancel-selection-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.clearBulkSelection();
            });
        }

        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                this.handleBulkDelete();
            });
        }

    }

    switchTab(tabId) {
        this.clearBulkSelection();
        this.currentTab = tabId;
        // 1. Gestionar clases de botones
        document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // 2. Gestionar visibilidad de contenedores usando clases CSS
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = ''; // Limpiar inline styles
        });

        const activeContainer = document.getElementById(tabId);
        if (activeContainer) {
            activeContainer.classList.add('active');
            activeContainer.style.display = ''; // Dejar que CSS .tab-content.active maneje display: flex
        }

        // 3. Renderizar bajo demanda la pestaña activa
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        const activeTab = this.currentTab || document.querySelector('.admin-tabs .tab-link.active')?.dataset.tab || 'tab-careers';
        this.currentTab = activeTab;

        if (activeTab === 'tab-courses') this.displayBaseCourses();
        else if (activeTab === 'tab-topics') this.displayTopics();
        else if (activeTab === 'tab-students') this.displayStudents();
        else if (activeTab === 'tab-books') this.displayBooks();
        else if (activeTab === 'tab-careers') this.displayCareers();
        else if (activeTab === 'tab-questions') this.displayQuestions();
        else if (activeTab === 'tab-cases') this.displayCases();
    }

    // ELIMINADO: _getAuthHeaders ahora es manejado automáticamente por NetworkService


    // NUEVO: Método para obtener IDs seleccionados de un checkbox list
    getSelectedIds(name) {
        const container = document.querySelector(`.searchable-dropdown-container[data-name="${name}"]`);
        if (!container) return [];
        // Filtrar valores no numéricos para evitar NaN
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value, 10))
            .filter(id => !isNaN(id));
    }

    // NUEVO: Método de ordenamiento genérico
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
                    // SOLUCIÓN: Usar created_at si existe, sino usar ID como proxy (asumiendo serial/autoincrement)
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
            const questionsUrl = new URL(`${window.AppConfig.API_URL}/api/admin/questions`);
            questionsUrl.searchParams.append('domain', this.currentQuestionDomain || 'all');
            if (this.currentQuestionSearch) {
                questionsUrl.searchParams.append('search', this.currentQuestionSearch);
            }

            const casesUrl = new URL(`${window.AppConfig.API_URL}/api/admin/cases`);
            casesUrl.searchParams.append('domain', this.currentCaseDomain || 'all');
            if (this.currentCaseSearch) {
                casesUrl.searchParams.append('search', this.currentCaseSearch);
            }

            const [careersRes, coursesRes, studentsRes, topicsRes, booksRes, questionsRes, casesRes] = await Promise.all([
                window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/careers`),
                window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/courses`),
                window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/students`),
                window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/topics`),
                window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/books?includeHidden=true`),
                window.NetworkService.fetch(questionsUrl.toString()),
                window.NetworkService.fetch(casesUrl.toString())
            ]);

            for (const res of [careersRes, coursesRes, studentsRes, topicsRes, booksRes, questionsRes, casesRes]) {
                if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
            }

            this.allCareers = await careersRes.json();
            this.allCourses = await coursesRes.json();
            this.allStudents = await studentsRes.json();
            this.allTopics = await topicsRes.json();
            this.allBooks = await booksRes.json();
            this.allQuestions = await questionsRes.json();
            this.allCases = await casesRes.json();

            // ✅ OPTIMIZACIÓN: Renderizar de forma reactiva y limpia solo la pestaña activa
            this.renderCurrentTab();

        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            if (this.sectionsContainer) {
                this.sectionsContainer.innerHTML = `<p class="error-state">Error al cargar los datos del panel. Asegúrate de que el servidor esté funcionando y las rutas API estén correctas.</p>`;
            }
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
        const sortedCareers = this.sortData(this.allCareers, 'career', 'tab-careers');
        const itemsHTML = sortedCareers.map(career => createAdminItemCardHTML(career, 'career')).join('');
        const content = this._createTabHeaderHTML('career', 'Añadir Carrera', 'tab-careers') +
            `<div class="items-list-container">${itemsHTML || '<p class="empty-state">No hay carreras.</p>'}</div>`;
        container.innerHTML = content;
        this.applySearchFilterForTab('tab-careers');
    }

    displayBaseCourses() {
        const container = document.getElementById('tab-courses');
        const sortedCourses = this.sortData(this.allCourses, 'course', 'tab-courses');
        const itemsHTML = sortedCourses.map(course => createAdminItemCardHTML(course, 'course', course.code ? `(${course.code})` : '')).join('');
        const content = this._createTabHeaderHTML('course', 'Añadir Curso', 'tab-courses') +
            `<div class="items-list-container">${itemsHTML || '<p class="empty-state">No hay cursos base.</p>'}</div>`;
        container.innerHTML = content;
        this.applySearchFilterForTab('tab-courses');
    }

    displayStudents() {
        const container = document.getElementById('tab-students');
        const sortedStudents = this.sortData(this.allStudents, 'student', 'tab-students');
        const itemsHTML = sortedStudents.map(student => createAdminItemCardHTML(student, 'student', `(${student.email})`)).join('');
        const content = this._createTabHeaderHTML('student', 'Añadir Alumno', 'tab-students') +
            `<div class="items-list-container">${itemsHTML || '<p class="empty-state">No hay alumnos.</p>'}</div>`;
        container.innerHTML = content;
        this.applySearchFilterForTab('tab-students');
    }

    displayTopics() {
        const container = document.getElementById('tab-topics');
        const sortedTopics = this.sortData(this.allTopics, 'topic', 'tab-topics');
        const itemsHTML = sortedTopics.map(topic => createAdminItemCardHTML(topic, 'topic')).join('');
        const content = this._createTabHeaderHTML('topic', 'Añadir Tema', 'tab-topics') +
            `<div class="items-list-container">${itemsHTML || '<p class="empty-state">No hay temas.</p>'}</div>`;
        container.innerHTML = content;
        this.applySearchFilterForTab('tab-topics');
    }

    displayBooks() {
        const container = document.getElementById('tab-books');
        const sortedBooks = this.sortData(this.allBooks, 'book', 'tab-books');
        const itemsHTML = sortedBooks.map(book => createAdminItemCardHTML(book, 'book', `by ${book.author}`)).join('');

        const headerHTML = `
            <div class="tab-header-controls">
                <div class="search-sort-wrapper">
                    <div class="search-bar-container">
                        <i class="fas fa-search"></i>
                        <input type="text" class="admin-search-input" data-target-tab="tab-books" placeholder="Buscar recursos...">
                    </div>
                    <select class="admin-type-filter" data-target-tab="tab-books">
                        <option value="all">Todos los Tipos</option>
                        <option value="book">Libro/Manual</option>
                        <option value="paper">Paper Científico</option>
                        <option value="norma">Norma/Directiva</option>
                        <option value="guia">Guía Clínica</option>
                        <option value="noticia">Noticia Oficial</option>
                        <option value="video">Video</option>
                        <option value="other">Imagen/Otro</option>
                    </select>
                    <select class="tab-sort-select" data-tab="tab-books">
                        <option value="date-desc">📅 Más Recientes</option>
                        <option value="alpha-asc">🔤 A-Z</option>
                    </select>
                </div>
                <div class="action-buttons">
                    <button class="btn-secondary" onclick="window.adminManager.openGenericModal('drive-sync')">
                        <i class="fab fa-google-drive"></i> <span class="hide-mobile">Sincronizar Drive</span>
                    </button>
                    <button class="btn-primary" onclick="window.adminManager.openGenericModal('book')">
                        <i class="fas fa-plus"></i> <span class="hide-mobile">Añadir Recurso</span>
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = headerHTML + `<div class="items-list-container">${itemsHTML || '<p class="empty-state">No hay recursos.</p>'}</div>`;
        this.applySearchFilterForTab('tab-books');
    }

    displayQuestions() {
        const container = document.getElementById('tab-questions');
        const sortedQuestions = this.sortData(this.allQuestions, 'question', 'tab-questions');
        const itemsHTML = sortedQuestions.map(q => createAdminItemCardHTML(q, 'question')).join('');

        const domains = [
            { id: 'all', name: 'Todos los Dominios' },
            { id: 'medicine', name: 'Medicina / Salud' },
            { id: 'education', name: 'Educación Docente' }
        ];

        const content = `
            <div class="tab-header-controls">
                <div class="search-sort-wrapper">
                    <div class="search-bar-container">
                        <i class="fas fa-search"></i>
                        <input type="text" class="admin-search-input-dynamic" 
                            placeholder="Buscar preguntas (Servidor)..." 
                            value="${this.escapeHtml(this.currentQuestionSearch)}"
                            oninput="window.adminManager.handleDynamicSearch(this.value)">
                    </div>

                    <select class="admin-type-filter" 
                        onchange="window.adminManager.handleDomainChange(this.value)">
                        ${domains.map(d => `<option value="${d.id}" ${this.currentQuestionDomain === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>

                    <div id="questions-counter" style="font-size: 0.85rem; color: var(--text-muted); margin-left: 10px;">
                        Mostrando ${this.allQuestions.length} resultados
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn-secondary" onclick="window.adminManager.openGenericModal('bulk-question')">
                        <i class="fas fa-file-import"></i> <span class="hide-mobile">Importar</span>
                    </button>
                    <button class="btn-primary btn-ai" onclick="window.adminManager.openGenericModal('ai-question')">
                        <i class="fas fa-robot"></i> <span class="hide-mobile">Generar IA</span>
                    </button>
                    <button class="btn-primary" onclick="window.adminManager.openGenericModal('question')">
                        <i class="fas fa-plus"></i> <span class="hide-mobile">Nueva Pregunta</span>
                    </button>
                </div>
            </div>
            <div id="questions-list-container" class="items-list-container">
                ${itemsHTML || '<p class="empty-state">No hay preguntas que coincidan con los filtros.</p>'}
            </div>
        `;
        container.innerHTML = content;
    }

    handleDomainChange(domain) {
        this.currentQuestionDomain = domain;
        this.refreshQuestions();
    }

    handleDynamicSearch(val) {
        this.currentQuestionSearch = val;
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.refreshQuestions();
        }, 400);
    }

    async refreshQuestions() {
        const listContainer = document.getElementById('questions-list-container');
        const counter = document.getElementById('questions-counter');

        if (listContainer) listContainer.style.opacity = '0.5';

        try {
            const url = new URL(`${window.AppConfig.API_URL}/api/admin/questions`);
            url.searchParams.append('domain', this.currentQuestionDomain);
            if (this.currentQuestionSearch) {
                url.searchParams.append('search', this.currentQuestionSearch);
            }

            const res = await window.NetworkService.fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch questions');

            this.allQuestions = await res.json();

            const sortedQuestions = this.sortData(this.allQuestions, 'question', 'tab-questions');
            const itemsHTML = sortedQuestions.map(q => createAdminItemCardHTML(q, 'question')).join('');

            if (listContainer) {
                listContainer.innerHTML = itemsHTML || '<p class="empty-state">No hay preguntas que coincidan con los filtros.</p>';
                listContainer.style.opacity = '1';
            }
            if (counter) {
                counter.innerText = `Mostrando ${this.allQuestions.length} resultados`;
            }

        } catch (error) {
            console.error('❌ Error refrescando preguntas:', error);
            if (listContainer) listContainer.style.opacity = '1';
        }
    }

    // =========================================================================
    // 🔗 CASUÍSTICAS / CASOS CLÍNICOS (TAB-CASES)
    // =========================================================================
    displayCases() {
        const container = document.getElementById('tab-cases');
        if (!container) return;

        const sortedCases = this.sortData(this.allCases, 'case', 'tab-cases');
        const itemsHTML = sortedCases.map(c => createAdminItemCardHTML(c, 'case')).join('');

        const domains = [
            { id: 'all', name: 'Todos los Dominios' },
            { id: 'medicine', name: 'Salud Profesional' },
            { id: 'education', name: 'Educación Docente' }
        ];

        const content = `
            <div class="tab-header-controls">
                <div class="search-sort-wrapper">
                    <div class="search-bar-container">
                        <i class="fas fa-search"></i>
                        <input type="text" class="admin-search-input-dynamic" 
                            placeholder="Buscar casuísticas por código, título o texto..." 
                            value="${this.escapeHtml(this.currentCaseSearch)}"
                            oninput="window.adminManager.handleDynamicCaseSearch(this.value)">
                    </div>

                    <select class="admin-type-filter" 
                        onchange="window.adminManager.handleCaseDomainChange(this.value)">
                        ${domains.map(d => `<option value="${d.id}" ${this.currentCaseDomain === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>

                    <div id="cases-counter" style="font-size: 0.85rem; color: var(--text-muted); margin-left: 10px;">
                        Mostrando ${this.allCases.length} casuísticas
                    </div>
                </div>

                <div class="action-buttons" style="display: flex; gap: 8px;">
                    <button class="btn-secondary" onclick="window.adminManager.openGenericModal('bulk-case')">
                        <i class="fas fa-file-excel"></i> <span class="hide-mobile">Subida Masiva</span>
                    </button>
                    <button class="btn-primary" onclick="window.adminManager.openGenericModal('case')">
                        <i class="fas fa-plus"></i> <span class="hide-mobile">Nueva Casuística</span>
                    </button>
                </div>
            </div>

            <div id="cases-list-container" class="items-list-container">
                ${itemsHTML || '<p class="empty-state">No hay casuísticas registradas que coincidan con los filtros.</p>'}
            </div>
        `;
        container.innerHTML = content;
    }

    handleCaseDomainChange(domain) {
        this.currentCaseDomain = domain;
        this.refreshCases();
    }

    handleDynamicCaseSearch(val) {
        this.currentCaseSearch = val;
        clearTimeout(this.caseSearchTimeout);
        this.caseSearchTimeout = setTimeout(() => {
            this.refreshCases();
        }, 400);
    }

    async refreshCases() {
        const listContainer = document.getElementById('cases-list-container');
        const counter = document.getElementById('cases-counter');

        if (listContainer) listContainer.style.opacity = '0.5';

        try {
            const url = new URL(`${window.AppConfig.API_URL}/api/admin/cases`);
            url.searchParams.append('domain', this.currentCaseDomain || 'all');
            if (this.currentCaseSearch) {
                url.searchParams.append('search', this.currentCaseSearch);
            }

            const res = await window.NetworkService.fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch cases');

            this.allCases = await res.json();

            const sortedCases = this.sortData(this.allCases, 'case', 'tab-cases');
            const itemsHTML = sortedCases.map(c => createAdminItemCardHTML(c, 'case')).join('');

            if (listContainer) {
                listContainer.innerHTML = itemsHTML || '<p class="empty-state">No hay casuísticas registradas que coincidan con los filtros.</p>';
                listContainer.style.opacity = '1';
            }
            if (counter) {
                counter.innerText = `Mostrando ${this.allCases.length} casuísticas`;
            }

        } catch (error) {
            console.error('❌ Error refrescando casuísticas:', error);
            if (listContainer) listContainer.style.opacity = '1';
        }
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
        this.currentItem = null; 

        // Resetear botón de guardado a estado inicial para evitar fugas de estilo de otros modales (ej: de Drive Sync)
        const saveBtn = document.getElementById('generic-save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = 'Guardar';
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';
            saveBtn.style.boxShadow = '';
        }

        // Definimos los endpoints de la API para cada tipo
        switch (type) {
            // ... (el resto del switch case permanece igual)
            case 'career': {
                title.textContent = id ? 'Editar Carrera' : 'Añadir Carrera';
                if (id) this.currentItem = this.allCareers.find(c => c.id === parseInt(id, 10));

                const domains = [
                    { id: 'medicine', name: 'Salud Profesional' },
                    { id: 'education', name: 'Educación Docente' }
                ];

                const areas = [
                    { id: 'Ciencias de la Salud', name: 'Ciencias de la Salud' },
                    { id: 'Educación', name: 'Educación' }
                ];

                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre de la Carrera (*)', this.currentItem?.name || '', true) +
                    this.createSelect('generic-area', 'Área Académica (*)', areas, this.currentItem?.area || '', false) +
                    this.createSelect('generic-domain', 'Sector / Dominio (*)', domains, this.currentItem?.domain || 'medicine', false) +
                    this.createImageUploadGroup('generic-image', 'Portada (Imagen Horizontal 16:9)', this.currentItem?.image_url || '');
                break;
            }
            case 'question': {
                title.textContent = id ? 'Editar Pregunta' : 'Añadir Pregunta';
                if (id) {
                    this.currentItem = (this.allQuestions || []).find(q => String(q.id) === String(id));
                    if (!this.currentItem) {
                        try {
                            const qRes = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/admin/questions/${id}`);
                            if (qRes.ok) this.currentItem = await qRes.json();
                        } catch (err) {
                            console.warn('⚠️ No se pudo cargar pregunta individual:', err);
                        }
                    }
                }

                let optA = this.currentItem?.options?.[0] || '';
                let optB = this.currentItem?.options?.[1] || '';
                let optC = this.currentItem?.options?.[2] || '';
                let optD = this.currentItem?.options?.[3] || '';
                let optE = this.currentItem?.options?.[4] || ''; // Añadida 5ta opción
                let correctAns = this.currentItem?.correct_answer ?? 0;

                const domains = [
                    { id: 'medicine', name: 'Medicina' },
                    { id: 'education', name: 'Educación' }
                ];

                const initialDomain = this.currentItem?.domain || 'medicine';
                const initialFilteredCases = (this.allCases || []).filter(c => c.domain === initialDomain);

                fieldsHTML = `
                    <!-- Casuística Agrupada / Caso Clínico (Opcional) -->
                    <fieldset style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <legend style="color: var(--text-secondary); font-size: 0.9em; padding: 0 5px;">
                            Casuística Agrupada / Caso Clínico (Opcional)
                        </legend>
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
                            <div>
                                <label class="form-label" for="generic-case-id">Vincular a Casuística Padre</label>
                                <select id="generic-case-id" class="form-input">
                                    <option value="">-- Pregunta Independiente (Sin caso) --</option>
                                    ${initialFilteredCases.map(c => `
                                        <option value="${c.id}" ${String(this.currentItem?.case_id) === String(c.id) ? 'selected' : ''}>
                                            [${c.code}] ${this.escapeHtml(c.title || (c.description_text ? c.description_text.replace(/<[^>]*>/g, '').substring(0, 45) + '...' : c.code))}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="form-label" for="generic-case-order">Orden en el Caso</label>
                                <input type="number" id="generic-case-order" class="form-input" min="1" max="50" value="${this.currentItem?.case_order || 1}">
                            </div>
                        </div>
                    </fieldset>

                    ${this.createFormGroup('textarea', 'generic-question-text', 'Pregunta (*)', this.formatPlainTextToHtml(this.currentItem?.question_text || ''), true)}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${this.createSelect('generic-domain', 'Dominio (*)', domains, this.currentItem?.domain || 'medicine', false)}
                        <div id="generic-target-container" style="display: block;">
                            <label class="form-label" for="generic-target">Examen Objetivo (*)</label>
                            <select id="generic-target" class="form-input" onchange="
                                window.adminManager.handleQuestionTargetChange(this.value);
                                const isResidentado = this.value === 'RESIDENTADO';
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
                                ${this.currentItem?.domain === 'education' ? `
                                <option value="NOMBRAMIENTO" ${this.currentItem?.target === 'NOMBRAMIENTO' ? 'selected' : ''}>NOMBRAMIENTO</option>
                                <option value="ASCENSO" ${this.currentItem?.target === 'ASCENSO' ? 'selected' : ''}>ASCENSO</option>
                                <option value="ACCESO_CARGOS" ${this.currentItem?.target === 'ACCESO_CARGOS' ? 'selected' : ''}>ACCESO A CARGOS</option>
                                ` : `
                                <option value="ENAM" ${this.currentItem?.target === 'ENAM' ? 'selected' : ''}>ENAM</option>
                                <option value="SERUMS" ${this.currentItem?.target === 'SERUMS' ? 'selected' : ''}>SERUMS</option>
                                <option value="RESIDENTADO" ${this.currentItem?.target === 'RESIDENTADO' ? 'selected' : ''}>RESIDENTADO</option>
                                `}
                            </select>
                        </div>
                    </div>
                    
                    <div id="generic-career-wrapper" style="display: block; margin-top: 15px;">
                        <label class="form-label" for="generic-career">Carrera / Modalidad (*)</label>
                        <select id="generic-career" class="form-input">
                            ${this.currentItem?.domain === 'education' ? `
                            <option value="EBR - Inicial" ${this.currentItem?.career === 'EBR - Inicial' ? 'selected' : ''}>EBR - Nivel Inicial</option>
                            <optgroup label="EBR - Nivel Primaria">
                                <option value="EBR - Primaria" ${this.currentItem?.career === 'EBR - Primaria' ? 'selected' : ''}>EBR - Primaria (Regular)</option>
                                <option value="EBR Primaria Profesor de Innovación Pedagógica" ${this.currentItem?.career === 'EBR Primaria Profesor de Innovación Pedagógica' ? 'selected' : ''}>EBR Primaria Profesor de Innovación Pedagógica</option>
                                <option value="EBR Primaria Educación Física" ${this.currentItem?.career === 'EBR Primaria Educación Física' ? 'selected' : ''}>EBR Primaria Educación Física</option>
                            </optgroup>
                            <optgroup label="EBR - Nivel Secundaria">
                                <option value="EBR - Secundaria - Arte y Cultura" ${this.currentItem?.career === 'EBR - Secundaria - Arte y Cultura' ? 'selected' : ''}>EBR - Secundaria - Arte y Cultura</option>
                                <option value="EBR - Secundaria - Ciencias Sociales" ${this.currentItem?.career === 'EBR - Secundaria - Ciencias Sociales' ? 'selected' : ''}>EBR - Secundaria - Ciencias Sociales</option>
                                <option value="EBR - Secundaria - Ciencia y Tecnología" ${this.currentItem?.career === 'EBR - Secundaria - Ciencia y Tecnología' ? 'selected' : ''}>EBR - Secundaria - Ciencia y Tecnología</option>
                                <option value="EBR - Secundaria - Comunicación" ${this.currentItem?.career === 'EBR - Secundaria - Comunicación' ? 'selected' : ''}>EBR - Secundaria - Comunicación</option>
                                <option value="EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica" ${this.currentItem?.career === 'EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica' ? 'selected' : ''}>EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica</option>
                                <option value="EBR - Secundaria - Educación Física" ${this.currentItem?.career === 'EBR - Secundaria - Educación Física' ? 'selected' : ''}>EBR - Secundaria - Educación Física</option>
                                <option value="EBR - Secundaria - Educación Religiosa" ${this.currentItem?.career === 'EBR - Secundaria - Educación Religiosa' ? 'selected' : ''}>EBR - Secundaria - Educación Religiosa</option>
                                <option value="EBR - Secundaria - Educación para el Trabajo" ${this.currentItem?.career === 'EBR - Secundaria - Educación para el Trabajo' ? 'selected' : ''}>EBR - Secundaria - Educación para el Trabajo</option>
                                <option value="EBR - Secundaria - Inglés como Lengua Extranjera" ${this.currentItem?.career === 'EBR - Secundaria - Inglés como Lengua Extranjera' ? 'selected' : ''}>EBR - Secundaria - Inglés como Lengua Extranjera</option>
                                <option value="EBR - Secundaria - Matemática" ${this.currentItem?.career === 'EBR - Secundaria - Matemática' ? 'selected' : ''}>EBR - Secundaria - Matemática</option>
                                <option value="EBR - Secundaria - Profesor de Innovación Pedagógica" ${this.currentItem?.career === 'EBR - Secundaria - Profesor de Innovación Pedagógica' ? 'selected' : ''}>EBR - Secundaria - Profesor de Innovación Pedagógica</option>
                            </optgroup>
                            ` : `
                            <option value="Medicina Humana" ${this.currentItem?.career === 'Medicina Humana' ? 'selected' : ''}>Medicina Humana</option>
                            <option value="Enfermería" ${this.currentItem?.career === 'Enfermería' ? 'selected' : ''}>Enfermería</option>
                            `}
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                        ${this.createFormGroup('text', 'generic-topic', 'Área de Estudio (*)', this.currentItem?.topic || '', true)}
                        ${this.createFormGroup('text', 'generic-subtopic', 'Subtema (Opcional)', this.currentItem?.subtopic || '', false)}
                    </div>
                    <fieldset style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <legend style="color: var(--text-secondary); font-size: 0.9em; padding: 0 5px;">Opciones y Respuesta</legend>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            ${this.createFormGroup('text', 'generic-opt0', 'Opción A (*)', optA, true)}
                            ${this.createFormGroup('text', 'generic-opt1', 'Opción B (*)', optB, true)}
                            ${this.createFormGroup('text', 'generic-opt2', 'Opción C (*)', optC, true)}
                            <div id="opt3-container" style="display: ${(['ASCENSO', 'NOMBRAMIENTO'].includes(this.currentItem?.target)) ? 'none' : 'block'};">
                                ${this.createFormGroup('text', 'generic-opt3', 'Opción D (*)', optD, true)}
                            </div>
                            <div id="generic-opt4-wrapper" style="display: ${this.currentItem?.target?.toUpperCase() === 'RESIDENTADO' ? 'block' : 'none'};">
                                ${this.createFormGroup('text', 'generic-opt4', 'Opción E (* Solo Residentado)', optE, false)}
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            ${this.createSelect('generic-correct-ans', 'Definir Respuesta Correcta (*)', [
                    { id: 0, name: 'Opción A' }, { id: 1, name: 'Opción B' }, { id: 2, name: 'Opción C' }, { id: 3, name: 'Opción D' }, ...(this.currentItem?.target?.toUpperCase() === 'RESIDENTADO' ? [{ id: 4, name: 'Opción E' }] : [])
                ], correctAns, false)}
                        </div>
                    </fieldset>
                    ${this.createFormGroup('textarea', 'generic-explanation', 'Explicación (Opcional)', this.formatPlainTextToHtml(this.currentItem?.explanation || ''), false)}

                    ${this.createImageUploadGroup('generic-image', 'Imagen de ENUNCIADO (Opcional)', this.currentItem?.image_url || '')}
                    <div id="generic-explanation-image-upload-group" style="display: block;">
                        ${this.createImageUploadGroup('generic-explanation-image', 'Imagen de EXPLICACIÓN (GCS o Local)', this.currentItem?.explanation_image_url || '')}
                    </div>
                `;

                setTimeout(() => {
                    const domainSelect = document.getElementById('generic-domain');
                    if (domainSelect) {
                        domainSelect.onchange = (e) => this.handleDomainChangeInModal(e.target.value);
                    }
                    // Trigger handleQuestionTargetChange to ensure correct initial state
                    const targetSelect = document.getElementById('generic-target');
                    if (targetSelect) {
                        this.handleQuestionTargetChange(targetSelect.value);
                    }

                    const txtQ = document.getElementById('generic-question-text');
                    const txtE = document.getElementById('generic-explanation');
                    if (txtQ) txtQ.rows = 3;
                    if (txtE) txtE.rows = 2;
                }, 0);
                break;
            }

            case 'case': {
                title.textContent = id ? 'Editar Casuística / Caso Clínico' : 'Nueva Casuística / Caso Clínico';
                if (id) {
                    this.currentItem = (this.allCases || []).find(c => String(c.id) === String(id));
                    if (!this.currentItem) {
                        try {
                            const caseRes = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/admin/cases/${id}`);
                            if (caseRes.ok) this.currentItem = await caseRes.json();
                        } catch (err) {
                            console.warn('⚠️ No se pudo cargar casuística individual:', err);
                        }
                    }
                }

                const domains = [
                    { id: 'education', name: 'Educación Docente' },
                    { id: 'medicine', name: 'Salud Profesional' }
                ];

                fieldsHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px;">
                        ${this.createFormGroup('text', 'generic-code', 'Código Único (*)', this.currentItem?.code || '', true)}
                        ${this.createFormGroup('text', 'generic-title', 'Título de la Casuística (Opcional)', this.currentItem?.title || '', false)}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        ${this.createSelect('generic-domain', 'Dominio (*)', domains, this.currentItem?.domain || 'education', false)}
                        ${this.createFormGroup('text', 'generic-target', 'Examen / Target (Opcional)', this.currentItem?.target || '', false)}
                    </div>
                    <div style="margin-top: 10px;">
                        ${this.createFormGroup('textarea', 'generic-description', 'Enunciado Común / Situación / Caso Clínico (*)', this.formatPlainTextToHtml(this.currentItem?.description_text || ''), false)}
                    </div>
                    <div style="margin-top: 10px;">
                        ${this.createImageUploadGroup('generic-image', 'Imagen Adjunta (Opcional)', this.currentItem?.image_url || '')}
                    </div>
                `;
                break;
            }

            case 'bulk-question':
                title.textContent = '📦 Importación Inteligente de Preguntas';
                fieldsHTML = `
                    <div class="import-method-container">
                        <!-- Card 1: JSON Editor -->
                        <div class="import-method-card">
                            <div class="import-method-header">
                                <div class="import-icon-box json-icon"><i class="fas fa-code"></i></div>
                                <span class="import-method-title">Editor JSON Directo</span>
                            </div>
                            <p class="import-method-desc">Copia y pega el array JSON generado por la IA o herramientas externas. Ideal para inyecciones rápidas sin archivos.</p>
                            <textarea id="generic-bulk-json" class="form-input" placeholder='[{"question_text": "...", "options": [...], ...}]' style="min-height: 120px; font-family: monospace; font-size: 0.85rem; background: var(--bg-secondary); border: 1px solid var(--border-color);"></textarea>
                        </div>

                        <!-- Card 2: Excel Upload -->
                        <div class="import-method-card">
                            <div class="import-method-header">
                                <div class="import-icon-box excel-icon"><i class="fas fa-file-excel"></i></div>
                                <span class="import-method-title">Subida Masiva Excel / CSV</span>
                            </div>
                            <p class="import-method-desc">Sube tu archivo oficial en formato Excel o CSV. Soporta preguntas individuales y preguntas vinculadas a Casuísticas con detección automática.</p>
                            
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <button type="button" class="btn-secondary" style="flex:1; font-size: 0.85rem;" onclick="window.adminManager.downloadExcelTemplate()">
                                    <i class="fas fa-download"></i> Plantilla
                                </button>
                                <div style="flex: 2; position: relative;">
                                    <input type="file" id="generic-bulk-file" accept=".xlsx, .xls, .csv" style="display:none;">
                                    <button type="button" class="btn-primary" style="width:100%; font-size: 0.85rem; background: #22c55e; border:none;" onclick="document.getElementById('generic-bulk-file').click()">
                                        <i class="fas fa-upload"></i> Seleccionar Archivo
                                    </button>
                                </div>
                            </div>
                            <small id="generic-bulk-file-info" style="display: block; margin-top: 10px; text-align: center; color: var(--text-muted); font-style: italic;"></small>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) btn.innerHTML = '<i class="fas fa-rocket"></i> Procesar Lote';
                }, 0);
                break;
            case 'bulk-case':
                title.textContent = '📦 Importación Masiva de Casuísticas / Casos Clínicos';
                fieldsHTML = `
                    <div class="import-method-container">
                        <!-- Card 1: JSON Editor -->
                        <div class="import-method-card">
                            <div class="import-method-header">
                                <div class="import-icon-box json-icon"><i class="fas fa-code"></i></div>
                                <span class="import-method-title">Editor JSON Directo</span>
                            </div>
                            <p class="import-method-desc">Copia y pega un array JSON de casuísticas/casos clínicos para inyección directa.</p>
                            <textarea id="generic-bulk-case-json" class="form-input" placeholder='[{"code": "CASO-01", "title": "...", "description_text": "...", "domain": "education", "target": "ASCENSO", "topic": "Pedagogía"}]' style="min-height: 120px; font-family: monospace; font-size: 0.85rem; background: var(--bg-secondary); border: 1px solid var(--border-color);"></textarea>
                        </div>

                        <!-- Card 2: Excel Upload -->
                        <div class="import-method-card">
                            <div class="import-method-header">
                                <div class="import-icon-box excel-icon"><i class="fas fa-file-excel"></i></div>
                                <span class="import-method-title">Subida Masiva Excel / CSV</span>
                            </div>
                            <p class="import-method-desc">Sube tu archivo oficial con las situaciones/viñetas clínicas o pedagógicas.</p>
                            
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <button type="button" class="btn-secondary" style="flex:1; font-size: 0.85rem;" onclick="window.adminManager.downloadCaseExcelTemplate()">
                                    <i class="fas fa-download"></i> Plantilla
                                </button>
                                <div style="flex: 2; position: relative;">
                                    <input type="file" id="generic-bulk-case-file" accept=".xlsx, .xls, .csv" style="display:none;">
                                    <button type="button" class="btn-primary" style="width:100%; font-size: 0.85rem; background: #22c55e; border:none;" onclick="document.getElementById('generic-bulk-case-file').click()">
                                        <i class="fas fa-upload"></i> Seleccionar Archivo
                                    </button>
                                </div>
                            </div>
                            <small id="generic-bulk-case-file-info" style="display: block; margin-top: 10px; text-align: center; color: var(--text-muted); font-style: italic;"></small>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) btn.innerHTML = '<i class="fas fa-rocket"></i> Procesar Lote de Casos';
                    this.setupFileInputFeedback('generic-bulk-case-file', 'generic-bulk-case-file-info');
                }, 0);
                break;
            case 'ai-question':
                title.textContent = '⚡ Generador RAG (Flash Lite)';
                fieldsHTML = `
                    <div id="ai-info-banner" style="margin-bottom:20px; color:var(--text-muted); font-size:0.9rem; background: rgba(168, 85, 247, 0.08); padding: 15px; border-radius: 12px; border-left: 4px solid #a855f7;">
                        <i class="fas fa-brain" style="color: #a855f7;"></i> <b>RAG Engine:</b> <span id="ai-info-text">Generación basada en Harrison, AMIR, CTO y Normas Técnicas MINSA.</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div>
                            <label class="form-label">Dominio (*)</label>
                            <select id="ai-domain" class="form-input" onchange="window.adminManager.handleAiDomainChange(this.value)">
                                <option value="medicine" selected>Medicina</option>
                                <option value="education">Educación</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Examen Objetivo (*)</label>
                            <select id="ai-target" class="form-input" onchange="window.adminManager.handleAiTargetChange(this.value)">
                                <option value="ENAM">ENAM</option>
                                <option value="SERUMS" selected>SERUMS</option>
                                <option value="RESIDENTADO">RESIDENTADO</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label" id="ai-career-label">Carrera Profesional (*)</label>
                            <select id="ai-career" class="form-input" onchange="window.adminManager.handleAiCareerChange(this.value)">
                                <option value="Medicina Humana">Medicina Humana</option>
                                <option value="Enfermería">Enfermería</option>
                            </select>
                        </div>

                    </div>

                    <!-- Dynamic Specialty Container for Education -->
                    <div id="ai-specialty-container" style="display:none; margin-bottom: 20px;">
                        <label class="form-label">Especialidad (*)</label>
                        <select id="ai-specialty" class="form-input">
                            <!-- Populated dynamically -->
                        </select>
                    </div>

                    <h4 style="margin-bottom:12px; font-size: 1rem; display: flex; align-items: center; gap: 10px; color: var(--primary);">
                        <i class="fas fa-layer-group"></i> <span id="ai-areas-title">Configuración de Áreas de Estudio (Ejes MINSA/ENAM)</span>
                    </h4>
                    
                    <div id="ai-domain-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 14px; padding: 25px; background: var(--bg-tertiary); margin-bottom: 20px;">
                        
                        <!-- ═══ MEDICINA ═══ -->
                        <div id="ai-areas-medicine">
                            <div class="ai-study-group" data-group="A" style="margin-bottom: 25px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #6366f1; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">A</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Ciencias Básicas</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Anatomía"> Anatomía</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Fisiología"> Fisiología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Farmacología"> Farmacología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Microbiología y Parasitología"> Microbiología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Bioquímica"> Bioquímica</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Patología"> Patología</label>
                                </div>
                            </div>
                            <div class="ai-study-group" data-group="B" style="margin-bottom: 25px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #a855f7; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">B</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Ciencias Clínicas (Las 4 Grandes)</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Medicina Interna"> Medicina Interna</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Pediatría"> Pediatría</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Ginecología y Obstetricia"> Ginecología y Obst.</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Cirugía General"> Cirugía General</label>
                                </div>
                            </div>
                            <div class="ai-study-group" data-group="C" style="margin-bottom: 25px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #38bdf8; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">C</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Especialidades Clínicas</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Cardiología"> Cardiología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Gastroenterología"> Gastroenterología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Neurología"> Neurología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Nefrología"> Nefrología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Neumología"> Neumología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Endocrinología"> Endocrinología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Infectología"> Infectología</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Psiquiatría"> Psiquiatría</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Traumatología"> Traumatología</label>
                                </div>
                            </div>
                            <div class="ai-study-group" data-group="D">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #22c55e; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">D</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Salud Pública y Gestión</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Salud Pública"> Salud Pública</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Gestión de Servicios de Salud"> Gestión</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Ética e Interculturalidad"> Ética e Intercult.</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Investigación"> Investigación</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Epidemiología"> Epidemiología</label>
                                </div>
                            </div>
                        </div>

                        <!-- ═══ EDUCACIÓN ═══ -->
                        <div id="ai-areas-education" style="display: none;">
                            <div class="ai-study-group" data-group="ASCENSO" style="display: block;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">★</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Prueba Nacional Integrada (Ascenso)</strong>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 15px;">
                                    <div>
                                        <strong style="color: #60a5fa; font-size: 0.82rem; text-transform: uppercase; display: block; margin-bottom: 6px;">Enfoques y Principios del CNEB</strong>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Enfoque por competencias" checked> Enfoque por competencias</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Enfoques transversales" checked> Enfoques transversales</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Principios de la educación peruana" checked> Principios de la educación</label>
                                        </div>
                                    </div>
                                    <div>
                                        <strong style="color: #60a5fa; font-size: 0.82rem; text-transform: uppercase; display: block; margin-bottom: 6px;">Teorías y Procesos del Aprendizaje</strong>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Constructivismo y socioconstructivismo" checked> Constructivismo y socioconstructivismo</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Aprendizajes significativos" checked> Aprendizajes significativos</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Activación y recojo de saberes previos" checked> Activación y recojo de saberes previos</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Conflicto o disonancia cognitiva y demanda cognitiva" checked> Conflicto o disonancia y demanda</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Procesos auxiliares" checked> Procesos auxiliares</label>
                                        </div>
                                    </div>
                                    <div>
                                        <strong style="color: #60a5fa; font-size: 0.82rem; text-transform: uppercase; display: block; margin-bottom: 6px;">Planificación y Evaluación</strong>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Planificación pedagógica" checked> Planificación pedagógica</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Evaluación formativa y retroalimentación" checked> Evaluación y retroalimentación</label>
                                        </div>
                                    </div>
                                    <div>
                                        <strong style="color: #60a5fa; font-size: 0.82rem; text-transform: uppercase; display: block; margin-bottom: 6px;">Clima Escolar e Inclusión</strong>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Convivencia democrática y clima de aula" checked> Convivencia y clima de aula</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Educación inclusiva y DUA" checked> Educación inclusiva y DUA</label>
                                            <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Características y desarrollo del estudiante" checked> Características del estudiante</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="ai-study-group" data-group="NOMBRAMIENTO" style="display: none; margin-top: 20px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">A</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Habilidades Generales</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Comprensión Lectora"> Comprensión Lectora</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Razonamiento Lógico"> Razonamiento Lógico</label>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px; margin: 15px 0 12px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                    <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">B</span>
                                    <strong style="color: var(--text-main); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Conocimientos Pedagógicos</strong>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Teorías del Aprendizaje y Desarrollo"> Teorías del Aprendizaje</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Principios del Currículo Nacional (CNEB)"> Principios CNEB</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Evaluación Formativa y Retroalimentación"> Evaluación Formativa</label>
                                    <label class="checkbox-item"><input type="checkbox" class="ai-domain-cb" value="Convivencia Escolar y Clima de Aula"> Convivencia Escolar</label>
                                </div>
                            </div>
                        </div>


                    </div>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-bolt"></i> Iniciar Generación RAG';
                        btn.style.background = 'linear-gradient(135deg, #a855f7, #6366f1)';
                        btn.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)';
                    }
                    this.handleAiTargetChange('SERUMS');
                }, 0);
                break;

            case 'course': {
                title.textContent = id ? 'Editar Curso' : 'Añadir Curso';

                // SOLUCIÓN: Obtener detalles completos del curso (incluyendo unidades y temas) desde la API
                if (id) {
                    try {
                        const res = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/courses/${id}`);
                        if (res.ok) {
                            this.currentItem = await res.json();
                        } else {
                            console.error('Error fetching course details');
                            this.currentItem = this.allCourses.find(c => c.id === parseInt(id, 10)); // Fallback
                        }
                    } catch (e) {
                        console.error('Error in fetch course:', e);
                        this.currentItem = this.allCourses.find(c => c.id === parseInt(id, 10));
                    }
                }

                const domainsCourse = [
                    { id: 'medicine', name: 'Salud Professional' },
                    { id: 'education', name: 'Educación Docente' }
                ];

                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Curso (*)', this.currentItem?.name || '', true) +
                    this.createSelect('generic-domain', 'Sector / Dominio (*)', domainsCourse, this.currentItem?.domain || 'medicine', false) +
                    this.createCheckboxList('Carreras Asociadas', 'generic-careers', this.allCareers, this.currentItem?.careerIds || [], 'career') +
                    this.createCheckboxList('Recursos de Referencia', 'generic-books', [...this.allBooks].sort((a, b) => b.id - a.id), this.currentItem?.materials?.map(m => m.id) || this.currentItem?.bookIds || [], 'book') +
                    this.createImageUploadGroup('generic-image', 'Portada (Imagen Horizontal 16:9)', this.currentItem?.image_url || '');
                break;
            }
            case 'topic':
                title.textContent = id ? 'Editar Tema' : 'Añadir Tema';
                if (id) this.currentItem = this.allTopics.find(t => t.id === parseInt(id, 10));
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Tema (*)', this.currentItem?.name || '', true) +
                    // Descripción eliminada
                    // SOLUCIÓN: Mostrar la lista de libros para asociarlos al tema.
                    this.createCheckboxList('Libros de Referencia', 'generic-books', this.allBooks, this.currentItem?.bookIds || [], 'book') +
                    '<div id="resources-container"></div>';
                break;


            case 'student': {
                title.textContent = id ? 'Editar Alumno' : 'Añadir Alumno';
                if (id) this.currentItem = this.allStudents.find(i => i.id === id);
                
                const tiers = [
                    { id: 'free', name: 'Gratuito (Free)' },
                    { id: 'basic', name: 'Plan Básico' },
                    { id: 'advanced', name: 'Plan Avanzado' }
                ];

                const statuses = [
                    { id: 'inactive', name: 'Inactivo' },
                    { id: 'active', name: 'Activo' },
                    { id: 'expired', name: 'Expirado' }
                ];

                let currentExpiresDate = '';
                const rawDate = this.currentItem?.subscriptionExpiresAt || this.currentItem?.subscription_expires_at;
                if (rawDate) {
                    try {
                        currentExpiresDate = new Date(rawDate).toISOString().substring(0, 10);
                    } catch (e) {
                        console.error("Error parseando fecha de expiración:", e);
                    }
                }

                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Alumno (*)', this.currentItem?.name || '', true) +
                    this.createFormGroup('email', 'generic-email', 'Email (*)', this.currentItem?.email || '', true) +
                    `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        ${this.createSelect('generic-subscription-tier', 'Nivel de Membresía', tiers, this.currentItem?.subscriptionTier || this.currentItem?.subscription_tier || 'free', false)}
                        ${this.createSelect('generic-subscription-status', 'Estado de Suscripción', statuses, this.currentItem?.subscriptionStatus || this.currentItem?.subscription_status || 'inactive', false)}
                    </div>` +
                    `<div style="margin-top: 10px;">
                        ${this.createFormGroup('date', 'generic-subscription-expires-at', 'Fecha de Expiración', currentExpiresDate, false)}
                    </div>`;
                break;
            }
            case 'book': {
                title.textContent = id ? 'Editar Recurso' : 'Añadir Recurso';
                if (id) this.currentItem = this.allBooks.find(b => b.id === parseInt(id, 10));

                // Removido de aquí para hacerlo global al final del método

                // Definir tipos de recurso acordes al nuevo enfoque EdTech
                const resourceTypes = [
                    { id: 'norma', name: 'Norma Técnica/Legal' },
                    { id: 'guia', name: 'Guía de Práctica Clínica' },
                    { id: 'paper', name: 'Artículo/Paper' },
                    { id: 'noticia', name: 'Noticia Oficial (Novedades)' },
                    { id: 'video', name: 'Video' },
                    { id: 'book', name: 'Libro (Histórico)' },
                    { id: 'other', name: 'Otro' }
                ];

                const domainsBook = [
                    { id: 'medicine', name: 'Sector Salud' },
                    { id: 'education', name: 'Sector Educación' }
                ];

                fieldsHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    ${this.createSelect('generic-type', 'Tipo de Recurso (*)', resourceTypes, this.currentItem?.resource_type || 'book', false)}
                    ${this.createSelect('generic-domain', 'Sector / Dominio (*)', domainsBook, this.currentItem?.domain || 'medicine', false)}
                </div>

                <!-- Switches de Control del Recurso (Premium / Visibilidad / Apertura Directa) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div class="switch-container premium-switch" style="margin-bottom: 0;">
                        <label for="generic-is-premium" class="switch-label">
                            <i class="fas fa-crown"></i>
                            <span>
                                <strong>Acceso Premium</strong>
                                <span class="switch-desc">Requiere suscripción o vidas</span>
                            </span>
                        </label>
                        <label class="switch-control">
                            <input type="checkbox" id="generic-is-premium" ${this.currentItem?.is_premium ? 'checked' : ''}>
                            <span class="switch-slider premium-slider"></span>
                        </label>
                    </div>

                    <div class="switch-container" style="margin-bottom: 0;">
                        <label for="generic-visible" class="switch-label">
                            <i class="fas fa-eye"></i>
                            <span>
                                <strong>Visible al Público</strong>
                                <span class="switch-desc">Mostrar en buscador y catálogo</span>
                            </span>
                        </label>
                        <label class="switch-control">
                            <input type="checkbox" id="generic-visible" ${(this.currentItem === undefined || this.currentItem?.visible !== false) ? 'checked' : ''}>
                            <span class="switch-slider"></span>
                        </label>
                    </div>

                    <div class="switch-container" style="margin-bottom: 0;">
                        <label for="generic-open-directly" class="switch-label">
                            <i class="fas fa-bolt"></i>
                            <span>
                                <strong>Apertura Inmersiva</strong>
                                <span class="switch-desc">Abrir directamente en visor modal</span>
                            </span>
                        </label>
                        <label class="switch-control">
                            <input type="checkbox" id="generic-open-directly" ${this.currentItem?.open_directly ? 'checked' : ''}>
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- NUEVO: Asignación de Temas (Topics) al Recurso -->
                <div style="margin-bottom: 15px;">
                    ${this.createCheckboxList('Temas / Categorías Asociadas', 'generic-topics', this.allTopics, this.currentItem?.topics?.map(t => t.id) || this.currentItem?.topicIds || [], 'topic')}
                </div>

                <!-- NUEVO: Asignación Directa de Curso(s) -->
                <div style="margin-bottom: 15px; border-top: 1px dashed var(--border-color); padding-top: 15px;">
                    ${this.createCheckboxList('Cursos Asociados', 'generic-courses', this.allCourses, this.currentItem?.courseIds || [], 'course')}
                    <small style="color:var(--text-muted); display:block; margin-top:4px;">Asigna directamente a la biblioteca de los cursos este material sin tener que navegar a editarlos.</small>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="grid-column: 1 / -1;">
                        ${this.createFormGroup('text', 'generic-title', 'Título (*)', this.currentItem?.title || '', true)}
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <!-- UX MEJORA: Campo Autor Validado -->
                        <div class="form-group">
                            <label for="generic-author">Autor/Creador (*)</label>
                            <input type="text" id="generic-author" name="generic-author" value="${this.escapeHtml(this.currentItem?.author || '')}" required placeholder="Ej: Drake, Richard L.; Vogl, A. Wayne">
                                <small style="display: block; margin-top: 4px; color: var(--text-muted); font-size: 0.8em;">
                                    <i class="fas fa-info-circle"></i> Formato obligatorio: <b>Nombre, Apellido</b>. Separa múltiples autores con punto y coma (;).
                                </small>
                        </div>
                    </div>

                        ${this.createFormGroup('text', 'generic-url', 'URL del Recurso (Opcional)', this.currentItem?.url || '', false)}
                        <small style="display:block; color:var(--text-muted); margin-top:2px;">
                            <i class="fas fa-magic"></i> <b>Tip:</b> Si se deja vacío, se usará la <b>imagen de portada</b> como recurso (ideal para infografías/mapas).
                        </small>
                    </div>

                    <!-- NUEVO: Editor de Texto Enriquecido para el Resumen (TinyMCE - Mini Word) -->
                    <div style="grid-column: 1 / -1; margin-top: 15px;">
                        <label class="form-label" style="font-weight: 600;">Resumen del Recurso (Estilo Wikipedia, Opcional)</label>
                        <textarea id="generic-content-html" style="height: 350px;"></textarea>
                        <input type="hidden" id="hidden-content-html" name="generic-content-html" value="">
                    </div>
                </div>
                `;
                fieldsHTML += this.createImageUploadGroup('generic-image', 'Portada/Miniatura (Imagen)', this.currentItem?.image_url || '');
                
                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) {
                        btn.innerHTML = id ? '<i class="fas fa-save"></i> Guardar Cambios' : '<i class="fas fa-plus"></i> Añadir Recurso';
                    }
                }, 0);
                break;
            }

            case 'drive-sync': {
                title.textContent = 'Sincronizar Carpeta de Google Drive';

                const resourceTypes = [
                    { id: 'book', name: 'Libro / PDF' },
                    { id: 'guia', name: 'Guía de Práctica Clínica' },
                    { id: 'norma', name: 'Norma Técnica/Legal' },
                    { id: 'paper', name: 'Artículo / Paper' },
                    { id: 'noticia', name: 'Noticia Oficial (Novedades)' },
                    { id: 'video', name: 'Video Clase' },
                    { id: 'other', name: 'Otro Recurso' }
                ];

                fieldsHTML = `
                    <div class="admin-item-card" style="padding: 15px; text-align: left; background: rgba(66, 133, 244, 0.1); border: 1px solid rgba(66, 133, 244, 0.2); margin-bottom: 20px; border-radius: 12px;">
                        <p style="margin: 0; color: var(--text-main); font-size: 0.9rem;">
                            <i class="fab fa-google-drive" style="color: #4285f4; font-size: 1.2rem; margin-right: 8px;"></i>
                            <strong>Instrucciones:</strong> Ingresa el ID de la carpeta de Drive (el código al final de la URL). 
                            El sistema escaneará todos los archivos y los añadirá automáticamente al Hub.
                        </p>
                    </div>

                    ${this.createFormGroup('text', 'generic-folder-id', 'ID de la Carpeta de Google Drive (*)', '', true)}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px; margin-bottom: 20px;">
                        ${this.createSelect('generic-resource-type', 'Tipo de Recurso (*)', resourceTypes, 'book', false)}
                        ${this.createSelect('generic-domain', 'Sector / Dominio (*)', [
                            { id: 'medicine', name: 'Sector Salud' },
                            { id: 'education', name: 'Sector Educación' }
                        ], 'medicine', false)}
                        ${this.createFormGroup('text', 'generic-author', 'Nombre de Autor / Fuente', 'Admin Hub', true)}
                    </div>

                    <!-- Switches de Control del Recurso para Drive Sync (Premium / Visibilidad / Apertura Directa) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="switch-container premium-switch" style="margin-bottom: 0;">
                            <label for="generic-is-premium" class="switch-label">
                                <i class="fas fa-crown"></i>
                                <span>
                                    <strong>Acceso Premium</strong>
                                    <span class="switch-desc">Cargar recursos como Premium</span>
                                </span>
                            </label>
                            <label class="switch-control">
                                <input type="checkbox" id="generic-is-premium">
                                <span class="switch-slider premium-slider"></span>
                            </label>
                        </div>

                        <div class="switch-container" style="margin-bottom: 0;">
                            <label for="generic-visible" class="switch-label">
                                <i class="fas fa-eye"></i>
                                <span>
                                    <strong>Visible al Público</strong>
                                    <span class="switch-desc">Mostrar en buscador y catálogo</span>
                                </span>
                            </label>
                            <label class="switch-control">
                                <input type="checkbox" id="generic-visible" checked>
                                <span class="switch-slider"></span>
                            </label>
                        </div>

                        <div class="switch-container" style="margin-bottom: 0;">
                            <label for="generic-open-directly" class="switch-label">
                                <i class="fas fa-bolt"></i>
                                <span>
                                    <strong>Apertura Inmersiva</strong>
                                    <span class="switch-desc">Abrir directamente en visor modal</span>
                                </span>
                            </label>
                            <label class="switch-control">
                                <input type="checkbox" id="generic-open-directly">
                                <span class="switch-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div style="margin-top: 20px; padding: 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px dashed var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
                        <i class="fas fa-info-circle"></i> <b>Nota:</b> Los archivos duplicados serán actualizados, no creados de nuevo. Asegúrate de que la Service Account tenga acceso a esta carpeta.
                    </div>
                `;

                setTimeout(() => {
                    const btn = document.getElementById('generic-save-btn');
                    if (btn) {
                        btn.innerHTML = '<i class="fab fa-google-drive"></i> Iniciar Sincronización';
                        btn.style.background = 'linear-gradient(135deg, #4285f4, #34a853)';
                        btn.style.borderColor = 'transparent';
                    }
                }, 0);
                break;
            }
        }

        fieldsContainer.innerHTML = fieldsHTML;
        this.hydrateImagePreviews(fieldsContainer);
        this.genericModal.style.display = 'flex';

        // LÓGICA DE SUSCRIPCIONES DINÁMICAS Y CONSISTENCIA PARA ESTUDIANTES
        if (type === 'student') {
            const tierSelect = document.getElementById('generic-subscription-tier');
            const statusSelect = document.getElementById('generic-subscription-status');
            const expiresInput = document.getElementById('generic-subscription-expires-at');

            if (tierSelect && statusSelect && expiresInput) {
                const getFutureDate = (months) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + months);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                tierSelect.addEventListener('change', () => {
                    const tier = tierSelect.value;
                    if (tier === 'basic') {
                        statusSelect.value = 'active';
                        expiresInput.value = getFutureDate(2);
                    } else if (tier === 'advanced') {
                        statusSelect.value = 'active';
                        expiresInput.value = getFutureDate(4);
                    } else if (tier === 'free') {
                        if (statusSelect.value === 'active') {
                            statusSelect.value = 'pending';
                        }
                        expiresInput.value = '';
                    }
                });

                statusSelect.addEventListener('change', () => {
                    const status = statusSelect.value;
                    const tier = tierSelect.value;
                    if (status === 'pending' || status === 'expired') {
                        tierSelect.value = 'free';
                        expiresInput.value = '';
                    } else if (status === 'active') {
                        if (tier === 'free') {
                            tierSelect.value = 'basic';
                            expiresInput.value = getFutureDate(2);
                        }
                    }
                });
            }
        }

        // ✅ Inicializar TinyMCE 6 si es un recurso de tipo 'book'
        if (type === 'book') {
            setTimeout(() => {
                if (window.tinymce && window.tinymce.get('generic-content-html')) {
                    window.tinymce.get('generic-content-html').remove();
                }

                if (window.tinymce) {
                    window.tinymce.init(this.getStandardTinyMCEConfig('#generic-content-html', {
                        height: 400,
                        placeholder: 'Escribe el resumen enriquecido aquí (puedes añadir imágenes, tablas de Excel, colores y más)...',
                        setup: (editor) => {
                            editor.on('init', () => {
                                if (this.currentItem?.content_html) {
                                    editor.setContent(this.resolveHtmlImageUrls(this.currentItem.content_html));
                                }
                            });
                            editor.on('change KeyUp', () => {
                                const hidden = document.getElementById('hidden-content-html');
                                if (hidden) hidden.value = editor.getContent();
                            });
                        }
                    }));
                }

                const hidden = document.getElementById('hidden-content-html');
                if (hidden) hidden.value = this.currentItem?.content_html || '';
            }, 0);
        }

        // ✅ Inicializar TinyMCE para Casuísticas
        if (type === 'case') {
            setTimeout(() => {
                if (window.tinymce && window.tinymce.get('generic-description')) {
                    window.tinymce.get('generic-description').remove();
                }

                if (window.tinymce) {
                    window.tinymce.init(this.getStandardTinyMCEConfig('#generic-description', {
                        height: 320,
                        placeholder: 'Escribe o pega el enunciado de la casuística (puedes pegar imágenes de Word/Portapapeles, tablas, etc.)...',
                        setup: (editor) => {
                            editor.on('init', () => {
                                if (this.currentItem?.description_text) {
                                    editor.setContent(this.resolveHtmlImageUrls(this.currentItem.description_text));
                                }
                            });
                            editor.on('change KeyUp', () => {
                                editor.save();
                            });
                        }
                    }));
                }
            }, 0);
        }

        // ✅ Inicializar TinyMCE para Preguntas y Explicaciones
        if (type === 'question') {
            setTimeout(() => {
                const richFields = [
                    { id: 'generic-question-text', placeholder: 'Enunciado de la pregunta (puedes pegar imágenes de Word/Portapapeles, tablas, etc.)...', val: this.currentItem?.question_text },
                    { id: 'generic-explanation', placeholder: 'Explicación pedagógica / médica detallada (puedes añadir imágenes, tablas)...', val: this.currentItem?.explanation }
                ];
                richFields.forEach(field => {
                    if (window.tinymce && window.tinymce.get(field.id)) {
                        window.tinymce.get(field.id).remove();
                    }

                    if (window.tinymce) {
                        window.tinymce.init(this.getStandardTinyMCEConfig(`#${field.id}`, {
                            height: 250,
                            placeholder: field.placeholder,
                            setup: (editor) => {
                                editor.on('init', () => {
                                    if (field.val) {
                                        editor.setContent(this.resolveHtmlImageUrls(field.val));
                                    }
                                });
                                editor.on('change KeyUp', () => {
                                    editor.save();
                                });
                            }
                        }));
                    }
                });
            }, 0);
        }

        // SOLUCIÓN DEFINITIVA: Inicializar el estado visual de los componentes después de renderizar.
        // Esto soluciona los dos problemas reportados.
        
        // --- NUEVO: Aumentar tamaño de modal globalmente para todas las pestañas ---
        setTimeout(() => {
            const modalContent = this.genericModal.querySelector('.modal-content');
            if (modalContent) {
                if (window.innerWidth <= 768) {
                    modalContent.style.maxWidth = '100%';
                    modalContent.style.width = 'calc(100% - 16px)';
                    modalContent.style.maxHeight = '94vh';
                } else {
                    modalContent.style.maxWidth = '1100px';
                    modalContent.style.width = '95%';
                    modalContent.style.maxHeight = '92vh';
                }
            }
        }, 0);

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



        if (type === 'topic' && this.currentItem) this.renderTopicResources(this.currentItem.resources);

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

        // FEEDBACK UNIVERSAL DE ARCHIVOS: Inicializar listeners para cualquier grupo de carga de imagen presente
        const setupFileInputFeedback = (inputId, infoId) => {
            const _input = document.getElementById(inputId);
            const _info = document.getElementById(infoId);
            if (_input && _info) {
                // Eliminar listener previo si existe para evitar duplicados
                _input.onchange = null;
                _input.onchange = () => {
                    if (_input.files.length > 0) {
                        _info.replaceChildren();
                        const icon = document.createElement('i');
                        icon.className = 'fas fa-check-circle';
                        icon.style.color = 'var(--success)';
                        const label = document.createElement('span');
                        label.textContent = ` Archivo listo: ${_input.files[0].name} (Se ignorará el texto)`;
                        _info.append(icon, label);
                        _info.style.color = 'var(--success)';
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
     * NUEVO: Actualiza el estado visual de un dropdown cuando se cierra.
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

    resolveHtmlImageUrls(html) {
        if (!html || typeof html !== 'string') return '';
        const apiUrl = (window.AppConfig && window.AppConfig.API_URL) ? window.AppConfig.API_URL.replace(/\/+$/, '') : '';
        if (!apiUrl) return html;

        return html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
            let finalSrc = src;
            if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
                finalSrc = src;
            } else if (src.startsWith('/assets/') || src.startsWith('assets/')) {
                const cleanPath = src.startsWith('/') ? src : `/${src}`;
                finalSrc = `${apiUrl}${cleanPath}`;
            } else if (src.startsWith('/api/')) {
                finalSrc = `${apiUrl}${src}`;
            } else {
                finalSrc = `${apiUrl}/api/media/gcs?file=${encodeURIComponent(src)}`;
            }
            return `<img${before}src="${finalSrc}"${after}>`;
        });
    }

    formatPlainTextToHtml(text) {
        if (!text) return '';
        if (typeof text === 'string' && text.trimStart().startsWith('<')) {
            return text;
        }
        const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const paragraphs = clean.split(/\n\n+/);
        const html = paragraphs.map(p => {
            const pClean = p.trim().replace(/\n/g, '<br>');
            return pClean ? `<p>${pClean}</p>` : '';
        }).filter(Boolean).join('');
        return html;
    }

    createFormGroup(type, id, label, value = '', required = false) {
        const req = required ? 'required' : '';
        const escapedValue = this.escapeHtml(value);
        const inputHTML = type === 'textarea'
            ? `<textarea id="${id}" name="${id}" ${req}>${escapedValue}</textarea>`
            : `<input type="${type}" id="${id}" name="${id}" value="${escapedValue}" ${req}>`;
        return `<div class="form-group"><label for="${id}">${label}</label>${inputHTML}</div>`;
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Configuración unificada de TinyMCE con renderizado local en memoria (0 peticiones a GCS en edición/borrador).
     * La subida y persistencia a GCS se difiere exclusivamente al momento de enviar el formulario ("Guardar").
     */
    getStandardTinyMCEConfig(selector, options = {}) {
        const height = options.height || 260;
        const placeholder = options.placeholder || 'Escribe aquí (puedes pegar imágenes de Word o Portapapeles, tablas, etc.)...';
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const bodyTextColor = isDark ? '#f8fafc' : '#0f172a';
        const bodyBgColor = isDark ? '#121212' : '#ffffff';
        const tableBorderColor = isDark ? '#475569' : '#cbd5e1';
        const tableHeaderBg = isDark ? '#334155' : '#f1f5f9';
        const tableHeaderColor = isDark ? '#ffffff' : '#0f172a';

        return {
            entity_encoding: 'raw',
            selector: selector,
            height: height,
            menubar: options.menubar !== undefined ? options.menubar : 'edit insert view format table tools help',
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount'
            ],
            toolbar: options.toolbar || 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | table image link | removeformat | code help',
            skin: isDark ? 'oxide-dark' : 'oxide',
            content_css: isDark ? 'dark' : 'default',
            branding: false,
            promotion: false,

            // ✅ ARQUITECTURA DIFERIDA (COMMIT ON SAVE):
            // Durante la redacción o edición, las imágenes pegadas/insertadas se conservan localmente en memoria del navegador
            // como datos Base64/Data URI. NO se realiza ninguna subida a la red ni a GCS mientras el usuario esté editando,
            // cancelando o descartando cambios.
            automatic_uploads: false,
            paste_data_images: true, // ✅ Permite pegar imágenes directamente (Ctrl+V) en el canvas local
            file_picker_types: 'image',
            file_picker_callback: (callback, value, meta) => {
                if (meta.filetype === 'image') {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.onchange = function() {
                        const file = this.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = function() {
                                callback(reader.result, { alt: file.name });
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                }
            },
            relative_urls: false,    // ✅ Mantiene la URL absoluta hacia el backend/GCS
            remove_script_host: false,
            convert_urls: false,     // ✅ Evita alteraciones de URLs de Render/CDN
            placeholder: placeholder,
            content_style: `body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color: ${bodyTextColor}; background-color: ${bodyBgColor}; padding: 10px; } table { border-collapse: collapse; width: 100%; margin-bottom: 10px; } table th, table td { border: 1px solid ${tableBorderColor}; padding: 8px; } table th { background-color: ${tableHeaderBg}; color: ${tableHeaderColor}; }`,
            setup: (editor) => {
                if (typeof options.setup === 'function') {
                    options.setup(editor);
                }
                editor.on('change KeyUp', () => {
                    editor.save();
                });
            }
        };
    }

    createImageUploadGroup(id, label, value = '') {
        const escapedValue = this.escapeHtml(value);
        const safeExternalUrl = this.getSafeExternalImageUrl(value);
        const escapedPreviewUrl = this.escapeHtml(safeExternalUrl || '');

        return `
            <div class="form-group image-upload-group" data-image-upload-id="${this.escapeHtml(id)}" style="margin-bottom: 20px; border: 1.5px dashed var(--border-color); padding: 15px; border-radius: 12px; background: var(--bg-tertiary);">
                <label for="${id}-url" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i class="fas fa-image" style="color: var(--primary);"></i> ${label}
                </label>
                
                <input type="hidden" id="${id}-delete-flag" value="false">

                <div class="image-upload-actions">
                    <input type="text" id="${id}-url" name="${id}-url" value="${escapedValue}" 
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
                <div id="${id}-preview-container" style="display: ${safeExternalUrl ? 'block' : 'none'}; margin-top: 10px; text-align: center; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                    <small style="display: block; color: var(--text-muted); margin-bottom: 5px;">Vista Previa:</small>
                    <img id="${id}-preview-img" src="${escapedPreviewUrl}" alt="Preview"
                        style="max-width: 100%; max-height: 180px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
                        onerror="this.parentElement.style.display='none'">
                </div>

                <small id="${id}-file-info" style="display: block; margin-top: 8px; color: var(--text-muted); font-size: 0.85em; opacity: 0.8;">
                    <i class="fas fa-info-circle"></i> <b>Tip:</b> Si subes un archivo local, este tendrá prioridad.
                </small>
            </div>
        `;
    }

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
        const previewImg = document.getElementById(`${id}-preview-img`);
        this.revokePreviewObjectUrl(previewImg);

        if (info) {
            info.innerHTML = `<i class="fas fa-trash" style="color: var(--danger);"></i> Imagen marcada para eliminar al guardar.`;
            info.style.color = 'var(--danger)';
        }
    }

    /**
     * Actualiza la previsualización en tiempo real mientras el usuario escribe.
     */
    updateLivePreview(id) {
        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(async () => {
            const urlInput = document.getElementById(`${id}-url`);
            const previewContainer = document.getElementById(`${id}-preview-container`);
            const previewImg = document.getElementById(`${id}-preview-img`);

            if (!urlInput || !previewImg || !previewContainer) return;

            const value = urlInput.value.trim();
            // Optimización Anti-Ruido: Solo buscar si tiene al menos 4 caracteres y un punto (ej: a.png)
            if (!value || value.length < 4 || !value.includes('.')) {
                previewContainer.style.display = 'none';
                return;
            }

            await this.loadImagePreview(id, value);
        }, 750); // Aumentado a 750ms para permitir escribir nombres completos sin spam de consola
    }

    hydrateImagePreviews(root) {
        if (!root) return;
        root.querySelectorAll('.image-upload-group[data-image-upload-id]').forEach(group => {
            const id = group.dataset.imageUploadId;
            const value = document.getElementById(`${id}-url`)?.value?.trim();
            if (value) this.loadImagePreview(id, value);
        });
    }

    getSafeExternalImageUrl(value) {
        if (!value) return null;
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    revokePreviewObjectUrl(previewImg) {
        if (previewImg?.dataset?.objectUrl) {
            URL.revokeObjectURL(previewImg.dataset.objectUrl);
            delete previewImg.dataset.objectUrl;
        }
    }

    async loadImagePreview(id, value) {
        const urlInput = document.getElementById(`${id}-url`);
        const previewContainer = document.getElementById(`${id}-preview-container`);
        const previewImg = document.getElementById(`${id}-preview-img`);
        if (!urlInput || !previewContainer || !previewImg || urlInput.value.trim() !== value) return;

        let previewUrl = this.getSafeExternalImageUrl(value);
        let objectUrl = null;
        try {
            if (!previewUrl) {
                const response = await window.NetworkService.fetch(
                    `${window.AppConfig.API_URL}/api/media/preview?path=${encodeURIComponent(value)}`
                );
                if (!response.ok) throw new Error(`Vista previa no disponible (${response.status})`);
                objectUrl = URL.createObjectURL(await response.blob());
                previewUrl = objectUrl;
            }

            const tempImg = new Image();
            tempImg.onload = () => {
                if (urlInput.value.trim() !== value) {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    return;
                }
                this.revokePreviewObjectUrl(previewImg);
                previewImg.src = previewUrl;
                if (objectUrl) previewImg.dataset.objectUrl = objectUrl;
                previewContainer.style.display = 'block';
            };
            tempImg.onerror = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                if (urlInput.value.trim() === value) previewContainer.style.display = 'none';
            };
            tempImg.src = previewUrl;
        } catch (error) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (urlInput.value.trim() === value) previewContainer.style.display = 'none';
        }
    }

    createSelect(id, label, options, selectedValue, optional = false) {
        let optionsHTML = optional ? '<option value="">-- Ninguno --</option>' : '';
        optionsHTML += options.map(opt => `<option value="${this.escapeHtml(opt.id)}" ${opt.id === selectedValue ? 'selected' : ''}>${this.escapeHtml(opt.name)}</option>`).join('');
        return `<div class="form-group"><label for="${id}">${label}</label><select id="${id}">${optionsHTML}</select></div>`;
    }

    createSearchableSelect(id, label, options, selectedValue, optional = false) {
        // SOLUCIÓN: El ID de un docente es un UUID (string), no un número.
        // Se comprueba si el ID del control contiene 'instructor' para decidir si se parsea o no.
        const isInstructorSelect = id.includes('instructor');
        const finalSelectedValue = isInstructorSelect
            ? selectedValue
            : (selectedValue ? parseInt(selectedValue, 10) : null);

        let optionsHTML = optional ? '<option value="">-- Ninguno --</option>' : '';
        // MEJORA: Usar una comparación no estricta (==) para comparar el valor final (que puede ser string o número)
        // con el `opt.id` de las opciones, que siempre es un string desde el HTML.
        optionsHTML += options.map(opt => `<option value="${this.escapeHtml(opt.id)}" ${opt.id == finalSelectedValue ? 'selected' : ''}>${this.escapeHtml(opt.name)}</option>`).join('');
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
        // SOLUCIÓN: Asegurarse de que los IDs seleccionados sean números para la comparación.
        const numericSelectedIds = (selectedIds || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));

        // LÓGICA CORREGIDA: Respetar el orden pasado por el invocador.
        // Anteriormente se forzaba un orden alfabético aquí, sobrescribiendo el orden por fecha/ID.
        const sortedOptions = options; // Usar el array tal cual viene (ya ordenado)
        const itemsHTML = sortedOptions.map(opt => {
            const checked = numericSelectedIds.includes(opt.id) ? 'checked' : '';
            const displayLabel = type === 'book' ? `${opt.title} (by ${opt.author})` : opt.name;
            const safeOptionId = this.escapeHtml(opt.id);
            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="${name}-${safeOptionId}" name="${name}" value="${safeOptionId}" ${checked}>
                    <label for="${name}-${safeOptionId}">${this.escapeHtml(displayLabel)}</label>
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
        if (!container) return;
        const newRow = document.createElement('div');
        newRow.className = 'schedule-row';

        const createInput = (type, className, placeholder, value, required = false) => {
            const input = document.createElement('input');
            input.type = type;
            input.className = className;
            if (placeholder) input.placeholder = placeholder;
            input.value = String(value || '');
            input.required = required;
            return input;
        };

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-schedule-row';
        removeButton.textContent = '×';

        newRow.append(
            createInput('text', 'schedule-day', 'Día', day, true),
            createInput('time', 'schedule-start', '', startTime, true),
            createInput('time', 'schedule-end', '', endTime, true),
            createInput('text', 'schedule-room', 'Salón', room),
            createInput('text', 'schedule-notes', 'Notas/Carrera (Opcional)', notes),
            removeButton
        );
        container.appendChild(newRow);
    }

    // NUEVO: Gestor de Unidades
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
        const topicOptions = allTopics.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.name)}</option>`).join('');

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
                <div class="unit-topic-item" data-id="${this.escapeHtml(t.id)}">
                    <span class="topic-name">${this.escapeHtml(t.name)}</span>
                    <button type="button" class="remove-topic-btn" title="Quitar tema">×</button>
                    <input type="hidden" name="unit-topic-id" value="${this.escapeHtml(t.id)}">
                </div>
                `).join('');

        return `
                <div class="unit-item card-3d">
                    <div class="unit-header">
                        <input type="text" class="unit-name-input" placeholder="Nombre de la Unidad" value="${this.escapeHtml(unitName)}">
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
                pdfs.forEach(p => { materialsHTML += `<span class="material-preview-item pdf">${this.escapeHtml(p.name)}</span>`; });
                links.forEach(l => { materialsHTML += `<span class="material-preview-item link">${this.escapeHtml(l.name)}</span>`; });
            }
        });

        if (!hasMaterials) {
            previewContainer.innerHTML = '<p class="empty-state-small">Ningún material en los temas seleccionados.</p>';
        } else {
            previewContainer.innerHTML = materialsHTML;
        }
    }

    // consolidated handleDomainChangeInModal is defined below in the manual question editor section.

    /**
     * ✅ NUEVO: Manejador de cambio de dominio en el modal de Generación IA
     */
    handleAiDomainChange(domain) {
        const targetSelect = document.getElementById('ai-target');
        const careerSelect = document.getElementById('ai-career');
        const careerLabel = document.getElementById('ai-career-label');
        const specialtyContainer = document.getElementById('ai-specialty-container');
        const difficultyContainer = document.getElementById('ai-difficulty-container');
        const medicineAreas = document.getElementById('ai-areas-medicine');
        const educationAreas = document.getElementById('ai-areas-education');
        const infoText = document.getElementById('ai-info-text');
        const areasTitle = document.getElementById('ai-areas-title');

        // Uncheck all checkboxes and reset master check
        document.querySelectorAll('.ai-domain-cb').forEach(c => c.checked = false);
        const allCheck = document.getElementById('ai-domain-all');
        if (allCheck) allCheck.checked = false;

        if (domain === 'education') {
            if (targetSelect) {
                targetSelect.innerHTML = `
                    <option value="ASCENSO" selected>ASCENSO (EBR)</option>
                    <option value="NOMBRAMIENTO">NOMBRAMIENTO</option>
                    <option value="ACCESO_CARGOS">ACCESO A CARGOS</option>
                `;
            }
            if (careerSelect) {
                careerSelect.innerHTML = `
                    <option value="EBR - Inicial">EBR - Nivel Inicial</option>
                    <option value="EBR - Primaria" selected>EBR - Nivel Primaria</option>
                    <option value="EBR - Secundaria">EBR - Nivel Secundaria</option>
                `;
            }
            if (careerLabel) careerLabel.textContent = 'Nivel Educativo (*)';
            if (specialtyContainer) specialtyContainer.style.display = 'none';
            if (difficultyContainer) difficultyContainer.style.display = 'none';

            if (medicineAreas) medicineAreas.style.display = 'none';
            if (educationAreas) educationAreas.style.display = 'block';

            if (infoText) infoText.textContent = 'Generación basada en CNEB, Marco del Buen Desempeño Docente y normativas MINEDU.';
            if (areasTitle) areasTitle.textContent = 'Configuración de Áreas de Estudio (Ejes MINEDU)';

            this.handleAiTargetChange('ASCENSO');
            this.handleAiCareerChange('EBR - Primaria');
        } else {
            // Default: medicine
            if (targetSelect) {
                targetSelect.innerHTML = `
                    <option value="ENAM">ENAM</option>
                    <option value="SERUMS" selected>SERUMS</option>
                    <option value="RESIDENTADO">RESIDENTADO</option>
                `;
            }
            if (careerSelect) {
                careerSelect.innerHTML = `
                    <option value="Medicina Humana" selected>Medicina Humana</option>
                    <option value="Enfermería">Enfermería</option>
                `;
            }
            if (careerLabel) careerLabel.textContent = 'Carrera Profesional (*)';
            if (specialtyContainer) specialtyContainer.style.display = 'none';
            if (difficultyContainer) difficultyContainer.style.display = 'none';

            if (medicineAreas) medicineAreas.style.display = 'block';
            if (educationAreas) educationAreas.style.display = 'none';

            if (infoText) infoText.textContent = 'Generación basada en Harrison, AMIR, CTO y Normas Técnicas MINSA.';
            if (areasTitle) areasTitle.textContent = 'Configuración de Áreas de Estudio (Ejes MINSA/ENAM)';

            this.handleAiTargetChange('SERUMS');
        }
    }

    closeGenericModal() {
        // 1. Ocultar el modal
        this.genericModal.style.display = 'none';

        // Restaurar ancho original por si fue modificado (ej. por 'book')
        const modalContent = this.genericModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.maxWidth = '';
            modalContent.style.width = '';
        }

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
        // ✅ NUEVO: Forzar sincronización de todos los editores TinyMCE antes de procesar el formulario
        if (window.tinymce) {
            tinymce.triggerSave();
        }

        const type = this.genericForm.dataset.type;
        const id = this.genericForm.dataset.id;
        let url = id ? `${window.AppConfig.API_URL}/api/${type}s/${id}` : `${window.AppConfig.API_URL}/api/${type}s`;
        const method = id ? 'PUT' : 'POST';

        if (type === 'question') {
            url = id ? `${window.AppConfig.API_URL}/api/admin/question/${id}` : `${window.AppConfig.API_URL}/api/admin/question`;
        } else if (type === 'case') {
            url = id ? `${window.AppConfig.API_URL}/api/admin/cases/${id}` : `${window.AppConfig.API_URL}/api/admin/cases`;
        }

        let body = {};

        // MEJORA UI/UX: Bloquear botón para evitar spam clicks / duplicados
        const saveBtn = document.getElementById('generic-save-btn');
        const originalBtnText = saveBtn ? saveBtn.innerHTML : 'Guardar';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            saveBtn.disabled = true;
        }

        try {
            switch (type) {
                case 'career':
                    // AHORA USA FORMDATA
                    const careerFormData = new FormData();
                    careerFormData.append('name', document.getElementById('generic-name').value);
                    careerFormData.append('area', document.getElementById('generic-area').value);
                    careerFormData.append('domain', document.getElementById('generic-domain').value);

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
                    // AHORA USA FORMDATA
                    const courseFormData = new FormData();
                    courseFormData.append('name', document.getElementById('generic-name').value);
                    courseFormData.append('domain', document.getElementById('generic-domain').value);
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
                case 'student': {
                    const expiresAtVal = document.getElementById('generic-subscription-expires-at').value;
                    body = {
                        name: document.getElementById('generic-name').value,
                        email: document.getElementById('generic-email').value,
                        subscriptionTier: document.getElementById('generic-subscription-tier').value,
                        subscriptionStatus: document.getElementById('generic-subscription-status').value,
                        subscriptionExpiresAt: expiresAtVal ? expiresAtVal : null
                    };
                    break;
                }
                case 'topic':
                    // SOLUCIÓN: Enviar un array
                    const selectedBooksTopic = Array.from(document.querySelectorAll('input[name="generic-books"]:checked')).map(cb => cb.value);
                    body = {
                        name: document.getElementById('generic-name').value,
                        bookIds: selectedBooksTopic
                    };
                    break;
                case 'book':
                    // LÓGICA ESPECIAL: Usar FormData para subir archivos (imagen de portada)
                    const formData = new FormData();
                    formData.append('title', document.getElementById('generic-title').value);
                    formData.append('author', document.getElementById('generic-author').value);
                    formData.append('url', document.getElementById('generic-url').value);
                    // Type Field
                    formData.append('resource_type', document.getElementById('generic-type').value);
                    formData.append('domain', document.getElementById('generic-domain').value);
                    // Premium Field
                    formData.append('is_premium', document.getElementById('generic-is-premium').checked);
                    // NUEVO: visible y open_directly
                    formData.append('visible', document.getElementById('generic-visible').checked);
                    formData.append('open_directly', document.getElementById('generic-open-directly').checked);
                    // NUEVO: Resumen Enriquecido (HTML)
                    formData.append('content_html', document.getElementById('hidden-content-html').value);

                    // NUEVO: Capturar Temas Seleccionados
                    const resourceTopicIds = this.getSelectedIds('generic-topics');
                    formData.append('topicIds', JSON.stringify(resourceTopicIds));

                    // NUEVO: Capturar Cursos Asociados
                    const resourceCourseIds = this.getSelectedIds('generic-courses');
                    formData.append('courseIds', JSON.stringify(resourceCourseIds));

                    // NUEVO: Manejo de eliminación de imagen
                    const deleteImageFlag = document.getElementById('generic-image-delete-flag')?.value;
                    if (deleteImageFlag === 'true') {
                        formData.append('deleteImage', 'true');
                    }

                    // Prioridad: 1. Archivo Local | 2. URL/Texto Manual
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
                    const caseIdVal = document.getElementById('generic-case-id')?.value || null;
                    const caseOrderVal = document.getElementById('generic-case-order')?.value ? parseInt(document.getElementById('generic-case-order').value, 10) : null;
                    const qData = {
                        question_text: document.getElementById('generic-question-text').value,
                        domain: document.getElementById('generic-domain').value,
                        target: qTarget,
                        // INTEGRIDAD: Solo cambiar career si es SERUMS; si no, mantener lo que ya tenía el objeto original
                        // para evitar borrar datos accidentalmente en otros dominios.
                        career: (qTarget !== 'N/A') ? (document.getElementById('generic-career')?.value || null) : null,
                        topic: document.getElementById('generic-topic').value,
                        subtopic: document.getElementById('generic-subtopic')?.value || null,
                        case_id: caseIdVal || null,
                        case_order: caseIdVal ? (caseOrderVal || 1) : null,
                        difficulty: this.currentItem?.difficulty || 'Senior',
                        options: (qTarget === 'RESIDENTADO')
                            ? [
                                document.getElementById('generic-opt0').value,
                                document.getElementById('generic-opt1').value,
                                document.getElementById('generic-opt2').value,
                                document.getElementById('generic-opt3').value,
                                document.getElementById('generic-opt4').value
                            ]
                            : (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(qTarget))
                            ? [
                                document.getElementById('generic-opt0').value,
                                document.getElementById('generic-opt1').value,
                                document.getElementById('generic-opt2').value
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

                    // Lógica de Imagen de ENUNCIADO
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

                    // Lógica de Imagen de EXPLICACIÓN
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

                        // Áreas de Estudio seleccionadas (checkboxes)
                        const selectedStudyAreas = Array.from(document.querySelectorAll('.ai-domain-cb:checked')).map(cb => cb.value);
                        if (selectedStudyAreas.length === 0) {
                            throw new Error("Por favor selecciona al menos una Área de Estudio/Especialidad.");
                        }

                        const targetVal = document.getElementById('ai-target').value;
                        let careerVal = document.getElementById('ai-career')?.value || null;
                        const domainVal = document.getElementById('ai-domain')?.value || 'medicine';

                        // Concatenate specialty if applicable (Education)
                        if (domainVal === 'education') {
                            const specEl = document.getElementById('ai-specialty');
                            if (specEl && specEl.value && specEl.value !== 'General') {
                                if (careerVal === 'EBR - Primaria') {
                                    if (specEl.value === 'Profesor de Innovación Pedagógica') {
                                        careerVal = 'EBR Primaria Profesor de Innovación Pedagógica';
                                    } else if (specEl.value === 'Educación Física') {
                                        careerVal = 'EBR Primaria Educación Física';
                                    } else {
                                        careerVal = `EBR Primaria ${specEl.value}`;
                                    }
                                } else {
                                    careerVal = `${careerVal} - ${specEl.value}`;
                                }
                            }
                        }

                        const difficultyVal = 'Senior';

                        const reqBody = {
                            target: targetVal,
                            career: careerVal,
                            difficulty: difficultyVal,
                            domain: domainVal,
                            studyAreas: selectedStudyAreas.join(', ')
                        };
                        const aiUrl = `${window.AppConfig.API_URL}/api/admin/questions/generate-ai`;
                        const resAi = await window.NetworkService.fetch(aiUrl, {
                            method: 'POST',
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
                                        const targetVal = cols[2] ? String(cols[2]).trim().toUpperCase() : '';
                                        return {
                                            question_text: String(cols[0] || '').trim(),
                                            domain: String(cols[1] || 'medicine').trim(), // El usuario especificará GENERAL_TRIVIA en el Excel
                                            target: cols[2] ? String(cols[2]).trim() : null,
                                            career: cols[3] ? String(cols[3]).trim() : null,
                                            topic: String(cols[4] || 'General').trim(),
                                            difficulty: cols[5] ? String(cols[5]).trim() : 'Senior',
                                            options: (targetVal === 'RESIDENTADO') ? [
                                                String(cols[6] || 'Opción A').trim(),
                                                String(cols[7] || 'Opción B').trim(),
                                                String(cols[8] || 'Opción C').trim(),
                                                String(cols[9] || 'Opción D').trim(),
                                                String(cols[10] || 'Opción E').trim()
                                            ] : (['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(targetVal)) ? [
                                                String(cols[6] || 'Opción A').trim(),
                                                String(cols[7] || 'Opción B').trim(),
                                                String(cols[8] || 'Opción C').trim()
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
                                            explanation_image_url: cols[15] ? String(cols[15]).trim() : null,
                                            codigo_caso: cols[16] ? String(cols[16]).trim() : null,
                                            titulo_caso: cols[17] ? String(cols[17]).trim() : null,
                                            enunciado_caso: cols[18] ? String(cols[18]).trim() : null,
                                            imagen_caso: cols[19] ? String(cols[19]).trim() : null,
                                            orden_caso: cols[20] && !isNaN(parseInt(cols[20], 10)) ? parseInt(cols[20], 10) : null
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
                    const _response = await window.NetworkService.fetch(_url, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    const _responseData = await _response.json();
                    if (!_response.ok) throw new Error(_responseData.error || 'Error al inyectar lote.');

                    await window.confirmationModal.showAlert(`¡Éxito! ${_responseData.message}`, 'Inyección Completada');
                    this.closeGenericModal();
                    await this.loadAllData();
                    return; // Retorno anticipado
                }

                case 'bulk-case': {
                    const jsonInput = document.getElementById('generic-bulk-case-json');
                    const fileInput = document.getElementById('generic-bulk-case-file');

                    if (jsonInput && jsonInput.value.trim()) {
                        try {
                            body = JSON.parse(jsonInput.value.trim());
                            if (!Array.isArray(body)) throw new Error("El JSON debe ser un array de objetos.");
                        } catch (err) {
                            throw new Error("Error en formato JSON: " + err.message);
                        }
                    } else if (fileInput && fileInput.files.length) {
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

                                    const parsed = rows.slice(1).filter(row => row.length > 0 && row[0]).map((cols) => {
                                        if (!cols[0]) return null;
                                        return {
                                            code: String(cols[0] || '').trim(),
                                            title: cols[1] ? String(cols[1]).trim() : String(cols[0] || '').trim(),
                                            description_text: cols[2] ? String(cols[2]).trim() : '',
                                            domain: cols[3] ? String(cols[3]).trim().toLowerCase() : 'education',
                                            target: cols[4] ? String(cols[4]).trim() : 'N/A',
                                            topic: cols[5] ? String(cols[5]).trim() : 'General',
                                            image_url: cols[6] ? String(cols[6]).trim() : null
                                        };
                                    }).filter(Boolean);

                                    if (parsed.length === 0) throw new Error("No se encontraron casuísticas válidas en el documento.");
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

                    const _url = `${window.AppConfig.API_URL}/api/admin/cases/bulk`;
                    const _response = await window.NetworkService.fetch(_url, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    const _responseData = await _response.json();
                    if (!_response.ok) throw new Error(_responseData.error || 'Error al inyectar lote de casuísticas.');

                    await window.confirmationModal.showAlert(`¡Éxito! ${_responseData.message}`, 'Casuísticas Inyectadas');
                    this.closeGenericModal();
                    await this.refreshCases();
                    return;
                }

                case 'drive-sync': {
                    const syncBtn = document.getElementById('generic-save-btn');
                    const originalText = syncBtn.innerHTML;

                    try {
                        const folderId = document.getElementById('generic-folder-id').value.trim();
                        const resourceType = document.getElementById('generic-resource-type').value;
                        const author = document.getElementById('generic-author').value.trim();
                        const domainVal = document.getElementById('generic-domain').value;

                        // Capturar switches de sincronización masiva
                        const isPremium = document.getElementById('generic-is-premium').checked;
                        const visible = document.getElementById('generic-visible').checked;
                        const openDirectly = document.getElementById('generic-open-directly').checked;

                        if (!folderId) throw new Error('El ID de la carpeta es obligatorio.');

                        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Escaneando Drive...';
                        syncBtn.disabled = true;

                        const syncUrl = `${window.AppConfig.API_URL}/api/admin/drive/sync-folder`;
                        const resSync = await window.NetworkService.fetch(syncUrl, {
                            method: 'POST',
                            body: JSON.stringify({ 
                                folderId, 
                                resourceType, 
                                author, 
                                domain: domainVal,
                                is_premium: isPremium,
                                visible: visible,
                                open_directly: openDirectly
                            })
                        });

                        const resDataSync = await resSync.json();
                        if (!resSync.ok) throw new Error(resDataSync.error || 'Error en la sincronización de Drive');

                        await window.confirmationModal.showAlert(
                            `🚀 ¡Sincronización Exitosa!\n\n${resDataSync.message}`,
                            'Drive Bridge'
                        );

                        this.closeGenericModal();
                        await this.loadAllData();
                        return; // Fin del flujo exitoso
                    } catch (err) {
                        throw err; // Burbujea al catch general
                    } finally {
                        if (syncBtn) {
                            syncBtn.innerHTML = originalText;
                            syncBtn.disabled = false;
                        }
                    }
                }
                


                case 'case': {
                    const descVal = window.tinymce && window.tinymce.get('generic-description')
                        ? window.tinymce.get('generic-description').getContent()
                        : (document.getElementById('generic-description')?.value || '');

                    const rawTitle = document.getElementById('generic-title')?.value?.trim() || '';
                    const caseCode = document.getElementById('generic-code')?.value?.trim() || '';
                    const cleanDesc = descVal.replace(/<[^>]*>/g, '').trim();
                    const caseTitle = rawTitle && rawTitle !== '' ? rawTitle : (cleanDesc.length > 50 ? cleanDesc.substring(0, 47) + '...' : cleanDesc || caseCode);

                    const caseFormData = new FormData();
                    caseFormData.append('code', caseCode);
                    caseFormData.append('title', caseTitle);
                    caseFormData.append('domain', document.getElementById('generic-domain')?.value || 'education');
                    caseFormData.append('target', document.getElementById('generic-target')?.value || '');
                    caseFormData.append('description_text', descVal);

                    const fileInput = document.getElementById('generic-image-file');
                    const urlInput = document.getElementById('generic-image-url');
                    const deleteImgFlag = document.getElementById('generic-image-delete-flag');

                    if (fileInput && fileInput.files[0]) {
                        caseFormData.append('caseImage', fileInput.files[0]);
                    } else if (urlInput && urlInput.value.trim()) {
                        caseFormData.append('image_url', urlInput.value.trim());
                    } else if (method === 'PUT' && deleteImgFlag && deleteImgFlag.value === 'true') {
                        caseFormData.append('deleteImage', 'true');
                        caseFormData.append('image_url', '');
                    }

                    body = caseFormData;
                    break;
                }

                default:
                    throw new Error(`Tipo de entidad no manejado: ${type}`);
            }

            // SOLUCIÓN DEFINITIVA: Añadir el ID al cuerpo de la petición SOLO si estamos
            // actualizando un registro existente (método PUT) Y si NO estamos usando FormData.
            // (Si usamos FormData, no podemos mezclarlo con JSON body fácilmente aquí).
            if (method === 'PUT' && id && !(body instanceof FormData)) {
                body.id = id;
            }

            const response = await window.NetworkService.fetch(url, {
                method: method,
                body: (body instanceof FormData) ? body : JSON.stringify(body)
            });

            let responseData = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            }

            if (!response.ok) {
                const errorMsg = responseData.error || responseData.message || `Error ${response.status} al guardar ${type}`;
                throw new Error(errorMsg);
            }

            const successMessage = (type === 'student' && method === 'POST')
                ? '¡Alumno registrado con éxito! El usuario podrá ingresar directamente con su cuenta de Google.'
                : '¡Guardado con éxito!';
            await window.confirmationModal.showAlert(successMessage, 'Éxito');

            this.closeGenericModal();
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            if (error.message === 'Unauthorized') return; // NetworkService ya manejó el logout

            console.error(`❌ Error guardando ${type}:`, error);
            await window.confirmationModal.showAlert(`Error al guardar: ${error.message}`, 'Error');
        } finally {
            // MEJORA UI/UX: Restaurar botón independientemente de si hubo éxito o error
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
            } else if (type === 'case') {
                url = `${window.AppConfig.API_URL}/api/admin/cases/${id}`;
            }

            const response = await window.NetworkService.fetch(url, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error al eliminar ${type}`);
            }

            await window.confirmationModal.showAlert('Elemento eliminado con éxito.', 'Éxito');
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            if (error.message === 'Unauthorized') return;
            console.error(`❌ Error eliminando ${type}:`, error);
            await window.confirmationModal.showAlert(`Error al eliminar: ${error.message}`, 'Error');
        }
    }

    // Manejador informativo para usuarios (Hub Academia utiliza Google OAuth exclusivamente)
    async handleResetPassword(userId) {
        const user = this.allStudents.find(s => s.id === userId);
        const userName = user ? user.name : 'este usuario';
        await window.confirmationModal.showAlert(
            `Hub Academia utiliza autenticación exclusiva mediante Google OAuth. ${userName} puede acceder directamente haciendo clic en "Continuar con Google" con su correo vinculado, por lo que no requiere contraseñas locales ni restablecimiento manual.`,
            'Autenticación Google OAuth'
        );
    }

    renderTopicResources(resources) {
        const container = document.getElementById('resources-container');
        if (!container) return; // SAFETY CHECK: Evitar crash si el contenedor no existe.
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
        const escapedName = this.escapeHtml(name);
        const escapedUrl = this.escapeHtml(url);
        div.innerHTML = `
                <input type="text" placeholder="Nombre del ${type}" value="${escapedName}" class="resource-name">
                    <input type="text" placeholder="URL del recurso" value="${escapedUrl}" class="resource-url">
                        <button type="button" class="remove-resource-btn">❌</button>
                        `;
        container.appendChild(div);

        // El botón de eliminar se maneja por delegación de eventos
    }

    // NUEVO: Función auxiliar para crear el encabezado de las pestañas con la barra de búsqueda y ordenamiento.
    _createTabHeaderHTML(type, buttonLabel, tabId) {
        const currentSort = this.tabSortState[tabId] || 'date-desc';
        // UX MEJORA: Ocultar el filtro de ordenamiento en la pestaña "Secciones" ya que tiene su propio agrupamiento.
        const showSort = tabId !== 'tab-sections';

        const sortSelectHTML = showSort ? `
                        <select class="tab-sort-select" data-tab="${tabId}">
                            <option value="date-desc" ${currentSort === 'date-desc' ? 'selected' : ''}>📅 Más Recientes</option>
                            <option value="date-asc" ${currentSort === 'date-asc' ? 'selected' : ''}>📅 Más Antiguos</option>
                            <option value="alpha-asc" ${currentSort === 'alpha-asc' ? 'selected' : ''}>🔤 A-Z</option>
                            <option value="alpha-desc" ${currentSort === 'alpha-desc' ? 'selected' : ''}>🔤 Z-A</option>
                        </select>
                        ` : '';

        const searchPlaceholder = tabId === 'tab-students' ? 'Buscar por nombre o correo...' : 'Buscar...';

        return `
            <div class="tab-header-controls">
                <div class="search-sort-wrapper">
                    <div class="search-bar-container">
                        <i class="fas fa-search"></i>
                        <input type="text"
                            class="admin-search-input"
                            placeholder="${searchPlaceholder}"
                            data-target-tab="${tabId}">
                    </div>
                    ${sortSelectHTML}
                </div>
                <button class="btn-primary" onclick="window.adminManager.openGenericModal('${type}')">
                    <i class="fas fa-plus"></i> <span>${buttonLabel}</span>
                </button>
            </div>
        `;
    }

    // NUEVO: Generador dinámico de Plantilla Excel para usuarios
    downloadExcelTemplate() {
        if (typeof window.XLSX !== 'undefined') {
            const ws_data = [
                [
                    'PREGUNTA (*)', 
                    'DOMINIO (medicine/education)', 
                    'TARGET (ENAM/SERUMS/RESIDENTADO/ASCENSO/NOMBRAMIENTO)', 
                    'CARRERA / MODALIDAD (Solo SERUMS o Educación)', 
                    'AREA_ESTUDIO / EJE TEMÁTICO (*)', 
                    'DIFICULTAD (Senior)', 
                    'OPCION_A (*)', 
                    'OPCION_B (*)', 
                    'OPCION_C (*)', 
                    'OPCION_D (Vacío en Educación)', 
                    'OPCION_E (Solo RESIDENTADO)', 
                    'INDEX_CORRECTA (0=A, 1=B, 2=C, 3=D, 4=E) (*)', 
                    'EXPLICACION', 
                    'URL_IMAGEN_ENUNCIADO', 
                    'SUBTEMA (OPCIONAL)', 
                    'URL_IMAGEN_EXPLICACION',
                    'CODIGO_CASO (Opcional - Ej: CASO-01)',
                    'TITULO_CASO (Opcional)',
                    'ENUNCIADO_CASO (Opcional - Contexto / Viñeta)',
                    'IMAGEN_CASO (Opcional)',
                    'ORDEN_CASO (Opcional - 1, 2, 3...)'
                ],
                [
                    '¿Fármaco de elección en tormenta tiroidea?', 
                    'medicine', 
                    'ENAM', 
                    '', 
                    'Cardiología', 
                    'Senior', 
                    'Propiltiouracilo', 
                    'Metimazol', 
                    'Yodo', 
                    'Propranolol', 
                    '', 
                    '0', 
                    'Bloquea la conversión periférica de T4 a T3 urgentemente.', 
                    '', 
                    'Emergencias Endocrinas', 
                    '',
                    '', '', '', '', ''
                ],
                [
                    '¿Cuál es la presunción diagnóstica inicial más probable?', 
                    'medicine', 
                    'ENAM', 
                    'Medicina Humana', 
                    'Pediatría', 
                    'Senior', 
                    'Laringitis aguda (Crup)', 
                    'Epiglotitis aguda', 
                    'Aspiración de cuerpo extraño', 
                    'Traqueítis bacteriana', 
                    '', 
                    '0', 
                    'El cuadro de estridor inspiratorio y tos perruna tras cuadro catarral es típico de Crup.', 
                    '', 
                    'Infecciones Respiratorias', 
                    '',
                    'CASO-PED-01',
                    'Lactante con estridor laríngeo',
                    'Lactante de 18 meses es traído a emergencia por presentar fiebre, disfonía, estridor inspiratorio y tos perruna de 2 días de evolución que empeora por las noches.',
                    '',
                    '1'
                ],
                [
                    'Respecto al paciente del caso, ¿cuál es el tratamiento farmacológico de primera línea?', 
                    'medicine', 
                    'ENAM', 
                    'Medicina Humana', 
                    'Pediatría', 
                    'Senior', 
                    'Dexametasona oral en dosis única', 
                    'Amoxicilina oral por 7 días', 
                    'Salbutamol nebulizado', 
                    'Antihistamínicos orales', 
                    '', 
                    '0', 
                    'La dexametasona (0.15 a 0.6 mg/kg) es el pilar terapéutico en todo nivel de gravedad de Crup.', 
                    '', 
                    'Terapéutica Pediátrica', 
                    '',
                    'CASO-PED-01',
                    'Lactante con estridor laríngeo',
                    'Lactante de 18 meses es traído a emergencia por presentar fiebre, disfonía, estridor inspiratorio y tos perruna de 2 días de evolución que empeora por las noches.',
                    '',
                    '2'
                ],
                [
                    'Un docente desea que sus estudiantes de Primaria construyan activamente el concepto de fuerza. ¿Cuál de las siguientes acciones es más pertinente para iniciar este proceso?', 
                    'education', 
                    'ASCENSO', 
                    'EBR - Primaria', 
                    'Teorías y Procesos del Aprendizaje', 
                    'Senior', 
                    'Pedir a los estudiantes que empujen diferentes objetos del aula y describan qué sintieron o qué observaron en los objetos al realizar esta acción.', 
                    'Explicar en la pizarra que la fuerza es la interacción entre dos cuerpos y luego resolver un cuestionario con ejemplos de fuerzas.', 
                    'Mostrar un video animado donde se definen los tipos de fuerza y pedir a los estudiantes que copien las definiciones en sus cuadernos.', 
                    '', 
                    '', 
                    '0', 
                    'El constructivismo implica que los estudiantes experimenten directamente para construir el conocimiento a partir de sus saberes previos.', 
                    '', 
                    'Principios Constructivistas', 
                    '',
                    'CASO-EBR-01',
                    'Situación de aprendizaje en el aula',
                    'En una sesión de aprendizaje de 4to de primaria, los estudiantes presentan dificultades para interpretar datos en un gráfico de barras.',
                    '',
                    '1'
                ]
            ];
            const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
            
            // Configurar anchos de columna para que sea fácil de visualizar
            ws['!cols'] = [
                { wch: 45 }, // PREGUNTA
                { wch: 15 }, // DOMINIO
                { wch: 15 }, // TARGET
                { wch: 25 }, // CARRERA
                { wch: 25 }, // AREA_ESTUDIO
                { wch: 15 }, // DIFICULTAD
                { wch: 20 }, // OPCION_A
                { wch: 20 }, // OPCION_B
                { wch: 20 }, // OPCION_C
                { wch: 20 }, // OPCION_D
                { wch: 20 }, // OPCION_E
                { wch: 15 }, // INDEX_CORRECTA
                { wch: 40 }, // EXPLICACION
                { wch: 25 }, // URL_IMAGEN_ENUNCIADO
                { wch: 20 }, // SUBTEMA
                { wch: 25 }, // URL_IMAGEN_EXPLICACION
                { wch: 20 }, // CODIGO_CASO
                { wch: 30 }, // TITULO_CASO
                { wch: 50 }, // ENUNCIADO_CASO
                { wch: 25 }, // IMAGEN_CASO
                { wch: 15 }  // ORDEN_CASO
            ];

            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Preguntas");
            window.XLSX.writeFile(wb, "HubAcademia_Plantilla_Banco_Preguntas.xlsx");
        } else {
            console.error('SheetJS no detectado');
            if (window.confirmationModal) {
                window.confirmationModal.showAlert("No se cargaron los recursos para descargar el excel. Refresca la página.", "Descarga de Plantilla");
            } else {
                alert("No se cargaron los recursos para descargar el excel. Refresca la página.");
            }
        }
    }

    // NUEVO: Generador dinámico de Plantilla Excel exclusiva para Casuísticas / Casos Clínicos
    downloadCaseExcelTemplate() {
        if (typeof window.XLSX !== 'undefined') {
            const ws_data = [
                [
                    'CODIGO_CASO (*)', 
                    'TITULO_CASO (*)', 
                    'ENUNCIADO_CASO / SITUACION (*)', 
                    'DOMINIO (medicine/education)', 
                    'TARGET (ENAM/SERUMS/RESIDENTADO/ASCENSO/NOMBRAMIENTO)', 
                    'AREA_ESTUDIO / EJE TEMATICO (*)', 
                    'URL_IMAGEN_CASO (Opcional)'
                ],
                [
                    'CASO-PED-01', 
                    'Lactante con estridor laríngeo', 
                    'Lactante de 18 meses es traído a emergencia por presentar fiebre, disfonía, estridor inspiratorio y tos perruna de 2 días de evolución que empeora por las noches.', 
                    'medicine', 
                    'ENAM', 
                    'Pediatría', 
                    ''
                ],
                [
                    'CASO-EBR-01', 
                    'Situación de aprendizaje en el aula', 
                    'En una sesión de aprendizaje de 4to de primaria, los estudiantes presentan dificultades para interpretar datos en un gráfico de barras.', 
                    'education', 
                    'ASCENSO', 
                    'Evaluación Formativa y Retroalimentación', 
                    ''
                ]
            ];
            const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
            
            ws['!cols'] = [
                { wch: 20 }, // CODIGO_CASO
                { wch: 35 }, // TITULO_CASO
                { wch: 60 }, // ENUNCIADO_CASO
                { wch: 15 }, // DOMINIO
                { wch: 15 }, // TARGET
                { wch: 25 }, // AREA_ESTUDIO
                { wch: 25 }  // URL_IMAGEN_CASO
            ];

            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Casuisticas");
            window.XLSX.writeFile(wb, "HubAcademia_Plantilla_Casuisticas.xlsx");
        } else {
            console.error('SheetJS no detectado');
            if (window.confirmationModal) {
                window.confirmationModal.showAlert("No se cargaron los recursos para descargar el excel. Refresca la página.", "Descarga de Plantilla");
            } else {
                alert("No se cargaron los recursos para descargar el excel. Refresca la página.");
            }
        }
    }

    handleAiTargetChange(target) {
        const domainSelect = document.getElementById('ai-domain');
        const domain = domainSelect ? domainSelect.value : 'medicine';

        if (domain === 'medicine') {
            const groupA = document.querySelector('#ai-areas-medicine .ai-study-group[data-group="A"]');
            const groupB = document.querySelector('#ai-areas-medicine .ai-study-group[data-group="B"]');
            const groupC = document.querySelector('#ai-areas-medicine .ai-study-group[data-group="C"]');
            const groupD = document.querySelector('#ai-areas-medicine .ai-study-group[data-group="D"]');

            if (target === 'SERUMS') {
                if (groupA) groupA.style.display = 'none';
                if (groupB) groupB.style.display = 'none';
                if (groupC) groupC.style.display = 'none';
                if (groupD) groupD.style.display = 'block';

                // Desmarcar todos los checkboxes de los grupos ocultados (A, B, C)
                document.querySelectorAll('#ai-areas-medicine .ai-study-group[data-group="A"] .ai-domain-cb, #ai-areas-medicine .ai-study-group[data-group="B"] .ai-domain-cb, #ai-areas-medicine .ai-study-group[data-group="C"] .ai-domain-cb').forEach(cb => cb.checked = false);
            } else {
                if (groupA) groupA.style.display = 'block';
                if (groupB) groupB.style.display = 'block';
                if (groupC) groupC.style.display = 'block';
                if (groupD) groupD.style.display = 'block';
            }
        } else if (domain === 'education') {
            const groups = document.querySelectorAll('#ai-areas-education .ai-study-group');
            groups.forEach(g => {
                if (g.dataset.group === target) {
                    g.style.display = 'block';
                    // Auto-check all of them by default
                    g.querySelectorAll('.ai-domain-cb').forEach(cb => cb.checked = true);
                } else {
                    g.style.display = 'none';
                }
            });
        }
    }

    handleAiCareerChange(level) {
        const specialtyContainer = document.getElementById('ai-specialty-container');
        const specialtySelect = document.getElementById('ai-specialty');
        
        if (!specialtyContainer || !specialtySelect) return;

        let options = [];
        if (level === 'EBR Primaria' || level === 'EBR - Primaria') {
            options = [
                { value: 'General', text: 'Primaria Regular' },
                { value: 'Profesor de Innovación Pedagógica', text: 'Profesor de Innovación Pedagógica' },
                { value: 'Educación Física', text: 'Educación Física' }
            ];
        } else if (level === 'EBR Secundaria' || level === 'EBR - Secundaria') {
            options = [
                { value: 'Arte y Cultura', text: 'Arte y Cultura' },
                { value: 'Ciencias Sociales', text: 'Ciencias Sociales' },
                { value: 'Ciencia y Tecnología', text: 'Ciencia y Tecnología' },
                { value: 'Comunicación', text: 'Comunicación' },
                { value: 'Desarrollo Personal, Ciudadanía y Cívica', text: 'Desarrollo Personal, Ciudadanía y Cívica' },
                { value: 'Educación Física', text: 'Educación Física' },
                { value: 'Educación Religiosa', text: 'Educación Religiosa' },
                { value: 'Educación para el Trabajo', text: 'Educación para el Trabajo' },
                { value: 'Inglés como Lengua Extranjera', text: 'Inglés como Lengua Extranjera' },
                { value: 'Matemática', text: 'Matemática' },
                { value: 'Profesor de Innovación Pedagógica', text: 'Profesor de Innovación Pedagógica' }
            ];
        }

        if (options.length > 0) {
            specialtySelect.innerHTML = options.map(o => `<option value="${o.value}">${o.text}</option>`).join('');
            specialtyContainer.style.display = 'block';
        } else {
            specialtyContainer.style.display = 'none';
            specialtySelect.innerHTML = '<option value="General">General</option>';
        }
    }

    /**
     * ✅ Lógica para el Editor de Preguntas Manual
     */
    handleDomainChangeInModal(domain) {
        const targetSelect = document.getElementById('generic-target');
        const careerSelect = document.getElementById('generic-career');
        const explImageGroup = document.getElementById('generic-explanation-image-upload-group');
        
        const targetContainer = document.getElementById('generic-target-container');
        const careerWrapper = document.getElementById('generic-career-wrapper');

        const isTrivia = domain === 'GENERAL_TRIVIA';

        if (targetContainer) targetContainer.style.display = isTrivia ? 'none' : 'block';
        if (careerWrapper) careerWrapper.style.display = isTrivia ? 'none' : 'block';
        if (explImageGroup) explImageGroup.style.display = isTrivia ? 'none' : 'block';

        if (domain === 'education') {
            if (targetSelect) {
                targetSelect.innerHTML = `
                    <option value="NOMBRAMIENTO">NOMBRAMIENTO</option>
                    <option value="ASCENSO" selected>ASCENSO</option>
                    <option value="ACCESO_CARGOS">ACCESO A CARGOS</option>
                `;
            }
            if (careerSelect) {
                const currentVal = this.currentItem?.career || '';
                careerSelect.innerHTML = `
                    <option value="EBR - Inicial" ${currentVal === 'EBR - Inicial' ? 'selected' : ''}>EBR - Nivel Inicial</option>
                    <optgroup label="EBR - Nivel Primaria">
                        <option value="EBR - Primaria" ${currentVal === 'EBR - Primaria' ? 'selected' : ''}>EBR - Primaria (Regular)</option>
                        <option value="EBR Primaria Profesor de Innovación Pedagógica" ${currentVal === 'EBR Primaria Profesor de Innovación Pedagógica' ? 'selected' : ''}>EBR Primaria Profesor de Innovación Pedagógica</option>
                        <option value="EBR Primaria Educación Física" ${currentVal === 'EBR Primaria Educación Física' ? 'selected' : ''}>EBR Primaria Educación Física</option>
                    </optgroup>
                    <optgroup label="EBR - Nivel Secundaria">
                        <option value="EBR - Secundaria - Arte y Cultura" ${currentVal === 'EBR - Secundaria - Arte y Cultura' ? 'selected' : ''}>EBR - Secundaria - Arte y Cultura</option>
                        <option value="EBR - Secundaria - Ciencias Sociales" ${currentVal === 'EBR - Secundaria - Ciencias Sociales' ? 'selected' : ''}>EBR - Secundaria - Ciencias Sociales</option>
                        <option value="EBR - Secundaria - Ciencia y Tecnología" ${currentVal === 'EBR - Secundaria - Ciencia y Tecnología' ? 'selected' : ''}>EBR - Secundaria - Ciencia y Tecnología</option>
                        <option value="EBR - Secundaria - Comunicación" ${currentVal === 'EBR - Secundaria - Comunicación' ? 'selected' : ''}>EBR - Secundaria - Comunicación</option>
                        <option value="EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica" ${currentVal === 'EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica' ? 'selected' : ''}>EBR - Secundaria - Desarrollo Personal, Ciudadanía y Cívica</option>
                        <option value="EBR - Secundaria - Educación Física" ${currentVal === 'EBR - Secundaria - Educación Física' ? 'selected' : ''}>EBR - Secundaria - Educación Física</option>
                        <option value="EBR - Secundaria - Educación Religiosa" ${currentVal === 'EBR - Secundaria - Educación Religiosa' ? 'selected' : ''}>EBR - Secundaria - Educación Religiosa</option>
                        <option value="EBR - Secundaria - Educación para el Trabajo" ${currentVal === 'EBR - Secundaria - Educación para el Trabajo' ? 'selected' : ''}>EBR - Secundaria - Educación para el Trabajo</option>
                        <option value="EBR - Secundaria - Inglés como Lengua Extranjera" ${currentVal === 'EBR - Secundaria - Inglés como Lengua Extranjera' ? 'selected' : ''}>EBR - Secundaria - Inglés como Lengua Extranjera</option>
                        <option value="EBR - Secundaria - Matemática" ${currentVal === 'EBR - Secundaria - Matemática' ? 'selected' : ''}>EBR - Secundaria - Matemática</option>
                        <option value="EBR - Secundaria - Profesor de Innovación Pedagógica" ${currentVal === 'EBR - Secundaria - Profesor de Innovación Pedagógica' ? 'selected' : ''}>EBR - Secundaria - Profesor de Innovación Pedagógica</option>
                    </optgroup>
                `;
            }
            this.handleQuestionTargetChange('ASCENSO');
        } else if (domain === 'medicine') {
            if (targetSelect) {
                targetSelect.innerHTML = `
                    <option value="ENAM">ENAM</option>
                    <option value="SERUMS" selected>SERUMS</option>
                    <option value="RESIDENTADO">RESIDENTADO</option>
                    <option value="N/A">N/A (Quiz Arena)</option>
                `;
            }
            if (careerSelect) {
                const currentVal = this.currentItem?.career || '';
                careerSelect.innerHTML = `
                    <option value="Medicina Humana" ${currentVal === 'Medicina Humana' ? 'selected' : ''}>Medicina Humana</option>
                    <option value="Enfermería" ${currentVal === 'Enfermería' ? 'selected' : ''}>Enfermería</option>
                `;
            }
            this.handleQuestionTargetChange('SERUMS');
        } else {
            this.handleQuestionTargetChange('N/A');
        }

        const caseSelect = document.getElementById('generic-case-id');
        if (caseSelect) {
            const currentCaseId = caseSelect.value || this.currentItem?.case_id || '';
            const filteredCases = (this.allCases || []).filter(c => !domain || domain === 'all' || c.domain === domain);
            caseSelect.innerHTML = `
                <option value="">-- Pregunta Independiente (Sin caso) --</option>
                ${filteredCases.map(c => `
                    <option value="${c.id}" ${String(currentCaseId) === String(c.id) ? 'selected' : ''}>
                        [${c.code}] ${this.escapeHtml(c.title || (c.description_text ? c.description_text.replace(/<[^>]*>/g, '').substring(0, 45) + '...' : c.code))}
                    </option>
                `).join('')}
            `;
        }
    }

    handleQuestionTargetChange(target) {
        const optionDContainer = document.getElementById('opt3-container');
        const optionDInput = document.getElementById('generic-opt3');
        const optionsSelect = document.getElementById('generic-correct-ans');
        const isEducation = ['ASCENSO', 'NOMBRAMIENTO', 'ACCESO_CARGOS'].includes(target);

        if (optionDContainer) {
            if (isEducation) {
                optionDContainer.style.display = 'none';
                if (optionDInput) {
                     optionDInput.removeAttribute('required');
                }
                // If correct answer was 3 (Option D), reset to 0
                if (optionsSelect && optionsSelect.value === '3') {
                     optionsSelect.value = '0';
                }
                // Hide option D in correct answer select
                if (optionsSelect && optionsSelect.options[3]) {
                     optionsSelect.options[3].style.display = 'none';
                }
            } else {
                optionDContainer.style.display = 'block';
                if (optionDInput) {
                     optionDInput.setAttribute('required', 'required');
                }
                if (optionsSelect && optionsSelect.options[3]) {
                     optionsSelect.options[3].style.display = 'block';
                }
            }
        }
    }

    clearBulkSelection() {
        this.selectedIds = [];
        this.selectedType = '';
        this.lastCheckedCheckbox = null;
        document.querySelectorAll('.admin-item-checkbox').forEach(cb => cb.checked = false);
        const bar = document.getElementById('admin-bulk-actions-bar');
        if (bar) {
            bar.classList.remove('active');
        }
    }

    updateBulkActionsBar() {
        const bar = document.getElementById('admin-bulk-actions-bar');
        const text = document.getElementById('bulk-actions-text');
        if (!bar || !text) return;

        const count = this.selectedIds.length;
        if (count > 0) {
            text.textContent = `${count} elemento${count > 1 ? 's' : ''} seleccionado${count > 1 ? 's' : ''}`;
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    }

    async handleBulkDelete() {
        if (this.selectedIds.length === 0) return;

        const type = this.selectedType;
        const count = this.selectedIds.length;

        const confirmMsg = `¿Estás seguro de que quieres eliminar masivamente estos ${count} elementos (${type})? Esta acción no se puede deshacer y eliminará permanentemente todos los recursos e imágenes asociadas.`;

        if (!await window.confirmationModal.show(confirmMsg, 'Eliminación Masiva', 'Eliminar Todo', 'Cancelar')) {
            return;
        }

        try {
            const bulkBtn = document.getElementById('bulk-delete-btn');
            const originalHTML = bulkBtn.innerHTML;
            bulkBtn.disabled = true;
            bulkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

            const response = await window.NetworkService.fetch(`${window.AppConfig.API_URL}/api/admin/bulk-delete`, {
                method: 'DELETE',
                body: JSON.stringify({
                    type: type,
                    ids: this.selectedIds
                })
            });

            bulkBtn.disabled = false;
            bulkBtn.innerHTML = originalHTML;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar elementos en lote');
            }

            const result = await response.json();
            this.clearBulkSelection();

            await window.confirmationModal.showAlert(`Eliminación masiva completada con éxito. Se eliminaron ${result.deleted} elementos.`, 'Éxito');
            await this.loadAllData();

        } catch (error) {
            console.error('❌ Error en borrado masivo:', error);
            await window.confirmationModal.showAlert(`Error al eliminar en lote: ${error.message}`, 'Error');
        }
    }

    applySearchFilterForTab(tabId) {
        const state = this.searchState[tabId];
        if (!state) return;

        const tabContent = document.getElementById(tabId);
        if (!tabContent) return;

        // Apply values to inputs if they exist
        const searchInput = tabContent.querySelector('.admin-search-input');
        if (searchInput) {
            searchInput.value = state.search;
        }

        const typeSelect = tabContent.querySelector('.admin-type-filter');
        if (typeSelect) {
            typeSelect.value = state.filter;
        }

        const sortSelect = tabContent.querySelector('.tab-sort-select');
        if (sortSelect && this.tabSortState[tabId]) {
            sortSelect.value = this.tabSortState[tabId];
        }

        // Apply visual display filters
        const items = tabContent.querySelectorAll('.admin-item-card, .item-card');
        const searchVal = (state.search || '').trim().toLowerCase();

        items.forEach(item => {
            let matchesText = true;
            if (searchVal) {
                const textContent = item.textContent.toLowerCase();
                const emailAttr = (item.dataset.email || '').toLowerCase();
                const nameAttr = (item.dataset.name || '').toLowerCase();
                matchesText = textContent.includes(searchVal) || emailAttr.includes(searchVal) || nameAttr.includes(searchVal);
            }

            let matchesType = true;
            if (state.filter !== 'all') {
                matchesType = item.dataset.resourceType === state.filter;
            }

            const matches = matchesText && matchesType;
            item.style.display = matches ? '' : 'none';
        });

        // Toggle empty state
        const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
        let emptyState = tabContent.querySelector('.search-empty-state');

        if (visibleItems.length === 0 && state.search !== '') {
            if (!emptyState) {
                emptyState = document.createElement('p');
                emptyState.className = 'search-empty-state empty-state';
                emptyState.textContent = `🔍 No se encontraron resultados para "${state.search}"`;
                tabContent.appendChild(emptyState);
            } else {
                emptyState.textContent = `🔍 No se encontraron resultados para "${state.search}"`;
                emptyState.style.display = '';
            }
        } else if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}

// Inicializar administrador cuando el DOM y los servicios estén listos
document.addEventListener('DOMContentLoaded', () => {
    if (!window.NetworkService) {
        console.error('❌ [Admin] NetworkService no detectado. Reintentando en 100ms...');
        setTimeout(() => {
            if (window.NetworkService) window.adminManager = new AdminManager();
            else console.error('❌ [Admin] Fallo crítico: NetworkService no disponible.');
        }, 100);
        return;
    }
    window.adminManager = new AdminManager();
});
