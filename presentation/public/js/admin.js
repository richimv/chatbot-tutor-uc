class AdminManager {
    constructor() {
        // Almacenes de datos
        this.allCareers = [];
        this.allCourses = []; // Cursos base (de courses.json)
        this.allSections = []; // Secciones (de sections.json)
        this.allInstructors = [];
        this.allTopics = []; // Nuevo almacén para temas
        this.allBooks = []; // Nuevo almacén para libros

        // Elementos del DOM
        this.sectionsContainer = document.getElementById('tab-sections');
        this.genericModal = document.getElementById('generic-modal');
        this.genericForm = document.getElementById('generic-form');
        
        this.init();
    }

    init() {
        // ✅ CORRECCIÓN: Añadir listener para cerrar el modal genérico al hacer clic afuera
        this.genericModal.addEventListener('click', (e) => {
            if (e.target === this.genericModal) this.closeGenericModal();
        });

        // Listener global para cerrar los dropdowns si se hace clic afuera
        document.addEventListener('click', (e) => {
            const openDropdown = document.querySelector('.searchable-dropdown-container.open');
            if (openDropdown) {
                const toggle = openDropdown.querySelector('.searchable-dropdown-toggle');
                const list = openDropdown.querySelector('.collapsible-list');

                // ✅ SOLUCIÓN: Cerrar si el clic NO está en la barra de búsqueda NI en la lista.
                if (!toggle.contains(e.target) && !list.contains(e.target)) {
                    openDropdown.classList.remove('open');
                    this.updateSelectedChips(openDropdown);
                    this.clearSearchInput(openDropdown);
                    
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
            if (header) header.parentElement.classList.toggle('expanded');
        });

        // Delegación de eventos para todo el contenedor principal (editar, eliminar)
        this.setupMainContainerDelegation();

        this.genericForm.addEventListener('submit', (e) => { e.preventDefault(); this.saveGenericForm(); });
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
        if (tabId === 'tab-books') this.displayBooks(); // Nueva pestaña
        if (tabId === 'tab-careers') this.displayCareers();
    }

    async loadAllData() {
        try {
            const [careersRes, coursesRes, sectionsRes, instructorsRes, topicsRes, booksRes] = await Promise.all([
                fetch('/api/careers'),
                fetch('/api/courses'),
                fetch('/api/sections'),
                fetch('/api/instructors'),
                fetch('/api/topics'),
                fetch('/api/books') // Nueva ruta para libros
            ]);

            for (const res of [careersRes, coursesRes, sectionsRes, instructorsRes, topicsRes, booksRes]) {
                if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
            }

            this.allCareers = await careersRes.json();
            this.allCourses = await coursesRes.json();
            this.allSections = await sectionsRes.json();
            this.allInstructors = await instructorsRes.json();
            this.allTopics = await topicsRes.json();
            this.allBooks = await booksRes.json(); // Cargar libros

            // ✅ CORRECCIÓN: Renderizar todas las pestañas DESPUÉS de que todos los datos se hayan cargado
            this.displaySections();
            this.displayCareers();
            this.displayBaseCourses();
            this.displayInstructors();
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
        // Ocultamos el botón de añadir sección manual, como se solicitó.
        let header = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('section')">Añadir Sección</button></div>`;
        if (!this.allSections || this.allSections.length === 0) {
            container.innerHTML = header + `<p class="empty-state">📭 No hay secciones para mostrar.</p>`;
            return;
        }

        // 1. Agrupar secciones por carrera
        const sectionsByCareer = new Map();
        this.allSections.forEach(section => {
            section.careerIds.forEach(careerId => {
                if (!sectionsByCareer.has(careerId)) {
                    sectionsByCareer.set(careerId, []);
                }
                sectionsByCareer.get(careerId).push(section);
            });
        });

        // 2. Ordenar carreras alfabéticamente por nombre
        const sortedCareerIds = [...sectionsByCareer.keys()].sort((idA, idB) => {
            const careerA = this.allCareers.find(c => c.id === idA)?.name || '';
            const careerB = this.allCareers.find(c => c.id === idB)?.name || '';
            return careerA.localeCompare(careerB);
        });

        let html = header;
        const dataForCards = { allCourses: this.allCourses, allInstructors: this.allInstructors, allCareers: this.allCareers };

        // 3. Renderizar HTML agrupado
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

        container.innerHTML = html;
    }

    setupMainContainerDelegation() {
        const mainContainer = document.getElementById('admin-main-container');
        mainContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn-small');
            const deleteBtn = e.target.closest('.delete-btn-small');

            if (editBtn) {
                e.preventDefault();
                this.openGenericModal(editBtn.dataset.type, editBtn.dataset.id);
            }

            if (deleteBtn) {
                e.preventDefault();
                this.handleDelete(deleteBtn.dataset.type, deleteBtn.dataset.id);
            }
        });
    }

    displayCareers() {
        const container = document.getElementById('tab-careers');
        if (!this.allCareers || this.allCareers.length === 0) {
            container.innerHTML = `<div class="tab-header"><button class="btn-primary" onclick="adminManager.openGenericModal('career')">Añadir Carrera</button></div><p class="empty-state">No hay carreras.</p>`;
            return;
        }
        let content = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('career')">Añadir Carrera</button></div>`;
        content += this.allCareers.map(career => createAdminItemCardHTML(career, 'career')).join('');
        container.innerHTML = content;
    }

    displayBaseCourses() {
        const container = document.getElementById('tab-courses');
        if (!this.allCourses || this.allCourses.length === 0) {
            container.innerHTML = `<div class="tab-header"><button class="btn-primary" onclick="adminManager.openGenericModal('course')">Añadir Curso Base</button></div><p class="empty-state">No hay cursos base.</p>`;
            return;
        }
        let content = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('course')">Añadir Curso Base</button></div>`;
        content += this.allCourses.map(course => createAdminItemCardHTML(course, 'course', `(${course.code})`)).join('');
        container.innerHTML = content;
    }

    displayInstructors() {
        const container = document.getElementById('tab-instructors');
        if (!this.allInstructors || this.allInstructors.length === 0) {
            container.innerHTML = `<div class="tab-header"><button class="btn-primary" onclick="adminManager.openGenericModal('instructor')">Añadir Docente</button></div><p class="empty-state">No hay docentes.</p>`;
            return;
        }
        let content = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('instructor')">Añadir Docente</button></div>`;
        content += this.allInstructors.map(instructor => createAdminItemCardHTML(instructor, 'instructor', `(${instructor.email})`)).join('');
        container.innerHTML = content;
    }

    displayTopics() {
        const container = document.getElementById('tab-topics');
        if (!this.allTopics || this.allTopics.length === 0) {
            container.innerHTML = `<div class="tab-header"><button class="btn-primary" onclick="adminManager.openGenericModal('topic')">Añadir Tema</button></div><p class="empty-state">No hay temas.</p>`;
            return;
        }
        let content = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('topic')">Añadir Tema</button></div>`;
        content += this.allTopics.map(topic => createAdminItemCardHTML(topic, 'topic')).join('');
        container.innerHTML = content;
    }

    displayBooks() {
        const container = document.getElementById('tab-books');
        if (!this.allBooks || this.allBooks.length === 0) {
            container.innerHTML = `<div class="tab-header"><button class="btn-primary" onclick="adminManager.openGenericModal('book')">Añadir Libro</button></div><p class="empty-state">No hay libros.</p>`;
            return;
        }
        let content = `<div class="tab-header"><button class="btn-primary" onclick="window.adminManager.openGenericModal('book')">Añadir Libro</button></div>`;
        content += this.allBooks.map(book => createAdminItemCardHTML(book, 'book', `by ${book.author}`)).join('');
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
                if (id) currentItem = this.allCareers.find(c => c.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre de la Carrera (*)', currentItem?.name || '', true) +
                             this.createFormGroup('text', 'generic-url', 'URL de la Malla Curricular', currentItem?.curriculumUrl || '');
                break;
            // ...
            case 'course':
                title.textContent = id ? 'Editar Curso Base' : 'Añadir Curso Base';
                if (id) currentItem = this.allCourses.find(c => c.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-name', 'Nombre del Curso (*)', currentItem?.name || '', true) +
                             this.createFormGroup('text', 'generic-code', 'Código (*)', currentItem?.code || '', true) +
                             this.createCheckboxList('Temas Asociados', 'generic-topics', this.allTopics, currentItem?.topicIds || []) +
                             this.createCheckboxList('Libros de Referencia', 'generic-books', this.allBooks, currentItem?.bookIds || [], 'book') +
                             this.createCheckboxList('Cursos Relacionados (Recomendaciones)', 'generic-related-courses', this.allCourses, currentItem?.relatedCourseIds || []);
                break;
            case 'topic':
                title.textContent = id ? 'Editar Tema' : 'Añadir Tema';
                if (id) currentItem = this.allTopics.find(t => t.id === id);
                fieldsHTML = `
                    ${this.createFormGroup('text', 'generic-name', 'Nombre del Tema (*)', currentItem?.name || '', true)}
                    <fieldset>
                        <legend>Materiales de Estudio</legend>
                        <small>Añade los PDFs y enlaces web relevantes para este tema.</small>
                        <div id="resources-container"></div>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" id="add-pdf-field" class="btn-secondary">Añadir PDF</button>
                            <button type="button" id="add-link-field" class="btn-secondary">Añadir Enlace</button>
                        </div>
                    </fieldset>
                `;
                break;
            case 'section':
                title.textContent = id ? 'Editar Sección' : 'Añadir Sección';
                if (id) currentItem = this.allSections.find(s => s.id === id);
                fieldsHTML = `
                    <fieldset>
                        <legend>Información Principal</legend>
                        ${this.createSearchableSelect('section-course-select', 'Curso Base (*)', this.allCourses, currentItem?.courseId)}
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
            case 'book':
                title.textContent = id ? 'Editar Libro' : 'Añadir Libro';
                if (id) currentItem = this.allBooks.find(b => b.id === id);
                fieldsHTML = this.createFormGroup('text', 'generic-title', 'Título del Libro (*)', currentItem?.title || '', true) +
                             this.createFormGroup('text', 'generic-author', 'Autor (*)', currentItem?.author || '', true) +
                             this.createFormGroup('text', 'generic-url', 'URL del PDF (*)', currentItem?.url || '', true);
                break;
        }

        fieldsContainer.innerHTML = fieldsHTML;
        this.genericModal.style.display = 'flex';

        // Listeners para botones dentro del modal
        const addScheduleBtn = document.getElementById('add-schedule-row');
        if (addScheduleBtn) addScheduleBtn.addEventListener('click', () => this.addScheduleRow());

        fieldsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('remove-schedule-row')) e.target.closest('.schedule-row').remove();
        });

        // Cargar datos existentes para sección
        if (type === 'section' && currentItem) {
            (currentItem.schedule || []).forEach(s => this.addScheduleRow(s.day, s.startTime, s.endTime, s.room));
        } else if (type === 'section') {
            this.addScheduleRow(); // Añadir una fila por defecto al crear
        }

        // --- Lógica específica post-renderizado ---

        // Delegación de eventos para los botones de recursos dentro del modal genérico
        fieldsContainer.addEventListener('click', e => {
            if (e.target.id === 'add-pdf-field') this.addResourceField('pdf');
            if (e.target.id === 'add-link-field') this.addResourceField('link');
            if (e.target.classList.contains('remove-resource-btn')) e.target.closest('.resource-field').remove();

            // Listener para abrir/cerrar los nuevos dropdowns
            const dropdownToggle = e.target.closest('.searchable-dropdown-toggle');
            if (dropdownToggle) {
                e.stopPropagation(); // Evitar que el listener global lo cierre inmediatamente
                const currentContainer = dropdownToggle.closest('.searchable-dropdown-container');
                
                // Cerrar todos los demás dropdowns abiertos
                document.querySelectorAll('.searchable-dropdown-container.open').forEach(openContainer => {
                    if (openContainer !== currentContainer) {
                        openContainer.classList.remove('open');
                        this.updateSelectedChips(openContainer);
                        this.clearSearchInput(openContainer);
                    }
                });

                currentContainer.classList.toggle('open');
                if (!currentContainer.classList.contains('open')) {
                    // Si el dropdown se acaba de cerrar
                    this.updateSelectedChips(currentContainer);
                    this.clearSearchInput(currentContainer);
                    // ✅ SOLUCIÓN: Desactivar el foco del input de búsqueda.
                    const searchInput = currentContainer.querySelector('.live-search-input');
                    if (searchInput) {
                        searchInput.blur();
                    }
                }
            }

            // Actualizar los chips si se hace clic en un checkbox
            if (e.target.type === 'checkbox') {
                const container = e.target.closest('.searchable-dropdown-container');
                this.updateSelectedChips(container);
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
        let optionsHTML = optional ? '<option value="">-- Ninguno --</option>' : '';
        optionsHTML += options.map(opt => `<option value="${opt.id}" ${opt.id === selectedValue ? 'selected' : ''}>${opt.name}</option>`).join('');
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
        const sortedOptions = [...options].sort((a, b) => {
            const nameA = type === 'book' ? a.title : a.name;
            const nameB = type === 'book' ? b.title : b.name;
            return nameA.localeCompare(nameB);
        });
        const itemsHTML = sortedOptions.map(opt => {
            const checked = selectedIds.includes(opt.id) ? 'checked' : '';
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
        this.genericModal.style.display = 'none';
        const fieldsContainer = document.getElementById('generic-form-fields');
        fieldsContainer.innerHTML = ''; // Limpiar contenido para evitar listeners duplicados
        const title = this.genericModal.querySelector('.modal-header h2');
        title.textContent = '';
        // Eliminar listeners específicos de recursos para evitar duplicados
        const oldFieldsContainer = document.getElementById('generic-form-fields');
        const newFieldsContainer = oldFieldsContainer.cloneNode(false);
        oldFieldsContainer.parentNode.replaceChild(newFieldsContainer, oldFieldsContainer);


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
        const url = id ? `/api/${type}s/${id}` : `/api/${type}s`;
        const method = id ? 'PUT' : 'POST';

        let body = {};

        try {
            switch (type) {
                case 'career':
                    body = {
                        name: document.getElementById('generic-name').value,
                        curriculumUrl: document.getElementById('generic-url').value
                    };
                    break;
                case 'course':
                    const selectedTopics = Array.from(document.querySelectorAll('input[name="generic-topics"]:checked')).map(cb => cb.value);
                    const selectedBooks = Array.from(document.querySelectorAll('input[name="generic-books"]:checked')).map(cb => cb.value);
                    const selectedRelatedCourses = Array.from(document.querySelectorAll('input[name="generic-related-courses"]:checked')).map(cb => cb.value);
                    body = {
                        name: document.getElementById('generic-name').value,
                        code: document.getElementById('generic-code').value,
                        description: '', // Enviamos una descripción vacía, ya que se generará dinámicamente.
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
                        instructorId: document.getElementById('section-instructor-select').value,
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
                case 'topic':
                    const pdfs = Array.from(document.querySelectorAll('.resource-field[data-type="pdf"]')).map(el => ({ name: el.querySelector('.resource-name').value, url: el.querySelector('.resource-url').value }));
                    const links = Array.from(document.querySelectorAll('.resource-field[data-type="link"]')).map(el => ({ name: el.querySelector('.resource-name').value, url: el.querySelector('.resource-url').value }));
                    body = {
                        name: document.getElementById('generic-name').value,
                        resources: { pdfs, links }
                    };
                    break;
                case 'book':
                    body = {
                        title: document.getElementById('generic-title').value,
                        author: document.getElementById('generic-author').value,
                        url: document.getElementById('generic-url').value
                    };
                    break;
                default:
                    throw new Error(`Tipo de entidad no manejado: ${type}`);
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error al guardar ${type}`);
            }

            this.closeGenericModal();
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            console.error(`❌ Error guardando ${type}:`, error);
            alert(`Error al guardar: ${error.message}`);
        }
    }

    async handleDelete(type, id) {
        if (!confirm(`¿Estás seguro de que quieres eliminar este elemento (${type})? Esta acción no se puede deshacer.`)) return;
        
        try {
            const url = `/api/${type}s/${id}`;
            const response = await fetch(url, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error al eliminar ${type}`);
            }

            alert('Elemento eliminado con éxito.');
            await this.loadAllData(); // Recargar todos los datos y refrescar la UI

        } catch (error) {
            console.error(`❌ Error eliminando ${type}:`, error);
            alert(`Error al eliminar: ${error.message}`);
        }
    }

    renderTopicResources(resources) {
        const container = document.getElementById('resources-container');
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

}

// Inicializar administrador
window.adminManager = new AdminManager();