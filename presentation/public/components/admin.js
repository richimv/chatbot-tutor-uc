class AdminManager {
    constructor() {
        this.currentEditingId = null;
        this.allCourses = [];
        this.allCareers = new Set();
        this.allTopics = new Set();
        this.currentPdfs = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCourses();
        this.showTab('courses');
    }

    setupEventListeners() {
        // Navegación entre pestañas
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.showTab(e.target.dataset.tab);
            });
        });

        // Formulario de curso
        document.getElementById('courseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCourse();
        });

        // Cancelar edición
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.cancelEdit();
        });

        // Búsqueda en tiempo real
        document.getElementById('adminSearch').addEventListener('input', (e) => {
            this.filterCourses(e.target.value);
        });

        // ✅ NUEVO: Botón para añadir PDF
        document.getElementById('addPdfBtn').addEventListener('click', () => {
            this.addPdfField();
        });

        // ✅ NUEVO: Delegación de eventos para botones de eliminar PDF
        document.getElementById('pdf-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-pdf-btn')) {
                this.removePdfField(e.target);
            }
        });
    }

    showTab(tabName) {
        // Ocultar todas las pestañas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Desactivar todos los botones
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
        });

        // Mostrar pestaña seleccionada
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Cargar datos específicos de la pestaña
        if (tabName === 'stats') {
            this.loadStats();
        }
    }

    async loadCourses() {
        try {
            console.log('🔄 Cargando cursos...');
            const response = await fetch('/api/cursos');
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            this.allCourses = await response.json();
            console.log('✅ Cursos cargados:', this.allCourses);
            this.updateAutocompleteData();
            this.displayCourses(this.allCourses);
            
        } catch (error) {
            console.error('❌ Error cargando cursos:', error);
            this.showMessage('Error al cargar los cursos: ' + error.message, 'error');
        }
    }

    updateAutocompleteData() {
        this.allCareers.clear();
        this.allTopics.clear();
        this.allCourses.forEach(course => {
            this.allCareers.add(course.carrera);
            course.temas.forEach(tema => this.allTopics.add(tema));
        });

        const careersDatalist = document.getElementById('careers-datalist');
        careersDatalist.innerHTML = '';
        this.allCareers.forEach(career => careersDatalist.innerHTML += `<option value="${career}">`);

        const topicsDatalist = document.getElementById('topics-datalist');
        topicsDatalist.innerHTML = '';
        this.allTopics.forEach(topic => topicsDatalist.innerHTML += `<option value="${topic}">`);
    }

    displayCourses(courses) {
        const tbody = document.getElementById('coursesTableBody');
        const emptyState = document.getElementById('emptyState');

        console.log('📊 Mostrando cursos:', courses);

        if (!courses || courses.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        tbody.innerHTML = courses.map(course => `
            <tr>
                <td><strong>${course.nombre}</strong></td>
                <td>${course.carrera}</td>
                <td>
                    <div class="topic-list">
                        ${course.temas.map(tema => `<span class="topic-tag">${tema}</span>`).join('')}
                    </div>
                </td>
                <td>
                    <div class="material-item">
                        <small>📚 ${course.materiales.pdfs ? course.materiales.pdfs.length : 0} PDFs</small>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-warning" onclick="adminManager.editCourse('${course.id}')">
                            ✏️ Editar
                        </button>
                        <button class="action-btn btn-danger" onclick="adminManager.deleteCourse('${course.id}')">
                            🗑️ Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    filterCourses(query) {
        if (!this.allCourses) return;
        
        const filtered = this.allCourses.filter(course =>
            course.nombre.toLowerCase().includes(query.toLowerCase()) ||
            course.carrera.toLowerCase().includes(query.toLowerCase()) ||
            course.temas.some(tema => tema.toLowerCase().includes(query.toLowerCase()))
        );
        this.displayCourses(filtered);
    }

    async saveCourse() {
        const formData = {
            nombre: document.getElementById('course-name').value.trim(),
            carrera: document.getElementById('course-career').value.trim(),
            temas: document.getElementById('course-topics').value.split(',').map(t => t.trim()).filter(t => t),
            materiales: {
                pdfs: this.getPdfData()
            }
        };

        // Validaciones
        if (!formData.nombre || !formData.carrera || formData.temas.length === 0) {
            this.showMessage('Nombre, carrera y al menos un tema son obligatorios', 'error');
            return;
        }

        try {
            let response;
            let url;
            let method;

            if (this.currentEditingId) {
                // Actualizar curso existente
                url = `/api/edit-curso/${this.currentEditingId}`;
                method = 'PUT';
            } else {
                // Crear nuevo curso
                url = '/api/add-curso';
                method = 'POST';
            }

            response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar curso');
            }

            const result = await response.json();
            this.showMessage(result.message, 'success');
            this.resetForm();
            await this.loadCourses();
            this.showTab('courses');

        } catch (error) {
            console.error('❌ Error guardando curso:', error);
            this.showMessage('Error al guardar el curso: ' + error.message, 'error');
        }
    }

    editCourse(courseId) {
        const course = this.allCourses.find(c => c.id == courseId);
        if (!course) {
            this.showMessage('Curso no encontrado', 'error');
            return;
        }

        this.currentEditingId = courseId;
        
        // Llenar formulario
        document.getElementById('course-name').value = course.nombre || '';
        document.getElementById('course-career').value = course.carrera || '';
        document.getElementById('course-topics').value = course.temas ? course.temas.join(', ') : '';
        this.displayPdfFields(course.materiales.pdfs || []);
        // Actualizar UI
        document.getElementById('formTitle').textContent = '✏️ Editar Curso';
        document.getElementById('submitBtn').textContent = '💾 Actualizar Curso';
        document.getElementById('cancelEdit').classList.remove('hidden');

        this.showTab('add-course');
    }

    cancelEdit() {
        this.currentEditingId = null;
        this.resetForm();
        this.showTab('courses');
    }

    resetForm() {
        document.getElementById('courseForm').reset();
        document.getElementById('formTitle').textContent = 'Agregar Nuevo Curso';
        document.getElementById('submitBtn').textContent = '💾 Guardar Curso';
        document.getElementById('cancelEdit').classList.add('hidden');
        this.currentEditingId = null;
        this.displayPdfFields([]); // Limpiar campos de PDF
    }

    addPdfField(pdf = { name: '', url: '' }) {
        const pdfList = document.getElementById('pdf-list');
        const newPdfField = document.createElement('div');
        newPdfField.className = 'pdf-field-group';
        newPdfField.innerHTML = `
            <input type="text" class="pdf-name" placeholder="Nombre del PDF" value="${pdf.name || ''}">
            <input type="text" class="pdf-url" placeholder="URL del PDF" value="${pdf.url || ''}">
            <button type="button" class="delete-pdf-btn">×</button>
        `;
        pdfList.appendChild(newPdfField);
    }

    removePdfField(button) {
        button.parentElement.remove();
    }

    displayPdfFields(pdfs) {
        const pdfList = document.getElementById('pdf-list');
        pdfList.innerHTML = ''; // Limpiar la lista
        if (pdfs && pdfs.length > 0) {
            pdfs.forEach(pdf => this.addPdfField(pdf));
        } else {
            this.addPdfField(); // Añadir un campo vacío si no hay PDFs
        }
    }

    getPdfData() {
        const pdfFields = document.querySelectorAll('.pdf-field-group');
        return Array.from(pdfFields).map(field => ({
            name: field.querySelector('.pdf-name').value.trim(),
            url: field.querySelector('.pdf-url').value.trim()
        })).filter(pdf => pdf.name && pdf.url);
    }

    async deleteCourse(courseId) {
        const course = this.allCourses.find(c => c.id == courseId);
        if (!course) {
            this.showMessage('Curso no encontrado', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de que deseas eliminar el curso "${course.nombre}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/delete-curso/${courseId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar curso');
            }

            const result = await response.json();
            this.showMessage(result.message, 'success');
            await this.loadCourses();

        } catch (error) {
            console.error('❌ Error eliminando curso:', error);
            this.showMessage('Error al eliminar el curso: ' + error.message, 'error');
        }
    }

    async loadStats() {
        const statsContent = document.getElementById('statsContent');
        
        try {
            const response = await fetch('/api/cursos');
            const courses = await response.json();

            const stats = {
                totalCursos: courses.length,
                totalTemas: courses.reduce((acc, course) => acc + (course.temas ? course.temas.length : 0), 0),
                totalPDFs: courses.reduce((acc, course) => acc + (course.materiales.pdfs ? course.materiales.pdfs.length : 0), 0),
                carrerasUnicas: [...new Set(courses.map(c => c.carrera))].length
            };

            statsContent.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="background: #e0f2fe; padding: 1.5rem; border-radius: 8px; text-align: center;">
                        <h4 style="margin: 0; color: #0369a1;">📚</h4>
                        <h3 style="margin: 0.5rem 0; color: #0369a1;">${stats.totalCursos}</h3>
                        <p style="margin: 0; color: #64748b;">Cursos Totales</p>
                    </div>
                    <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 8px; text-align: center;">
                        <h4 style="margin: 0; color: #15803d;">📖</h4>
                        <h3 style="margin: 0.5rem 0; color: #15803d;">${stats.totalTemas}</h3>
                        <p style="margin: 0; color: #64748b;">Temas Diferentes</p>
                    </div>
                    <div style="background: #fef3c7; padding: 1.5rem; border-radius: 8px; text-align: center;">
                        <h4 style="margin: 0; color: #d97706;">🎓</h4>
                        <h3 style="margin: 0.5rem 0; color: #d97706;">${stats.carrerasUnicas}</h3>
                        <p style="margin: 0; color: #64748b;">Carreras</p>
                    </div>
                    <div style="background: #fef7cd; padding: 1.5rem; border-radius: 8px; text-align: center;">
                        <h4 style="margin: 0; color: #ca8a04;">📊</h4>
                        <h3 style="margin: 0.5rem 0; color: #ca8a04;">${stats.totalPDFs}</h3>
                        <p style="margin: 0; color: #64748b;">Materiales</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('❌ Error cargando estadísticas:', error);
            statsContent.innerHTML = '<p>Error al cargar las estadísticas: ' + error.message + '</p>';
        }
    }

    showMessage(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            ${type === 'success' ? 'background: #10b981;' : ''}
            ${type === 'error' ? 'background: #ef4444;' : ''}
            ${type === 'warning' ? 'background: #f59e0b;' : ''}
            ${type === 'info' ? 'background: #3b82f6;' : ''}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }


    // En la clase AdminManager, agregar estos métodos:

    async loadAnalyticsDashboard() {
        try {
            const response = await fetch('/api/analytics');
            const analytics = await response.json();

            this.displayAnalyticsDashboard(analytics);
        } catch (error) {
            console.error('❌ Error cargando analytics:', error);
            this.showMessage('Error al cargar las estadísticas del sistema', 'error');
        }
    }

    displayAnalyticsDashboard(analytics) {
        const statsContent = document.getElementById('statsContent');
        
        const analyticsHTML = `
            <div class="analytics-dashboard">
                <!-- Predicciones -->
                <div class="analytics-section">
                    <h3>🔮 Predicciones del Sistema</h3>
                    <div class="prediction-card">
                        <h4>Curso Más Popular Próximo Mes</h4>
                        <div class="prediction-content">
                            <div class="prediction-main">
                                <span class="course-name">${analytics.popularCourse.predictedCourse}</span>
                                <span class="confidence-badge" style="background: ${this.getConfidenceColor(analytics.popularCourse.confidence)}">
                                    ${(analytics.popularCourse.confidence * 100).toFixed(1)}% confianza
                                </span>
                            </div>
                            <p class="prediction-reason">${analytics.popularCourse.reason}</p>
                            <div class="prediction-stats">
                                <span>📊 ${analytics.popularCourse.searchCount} búsquedas relacionadas</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ✅ NUEVO: Predicción de Tema Popular -->
                <div class="prediction-card topic-prediction">
                    <h4>Tema Más Buscado (Concepto)</h4>
                    <div class="prediction-content">
                        <div class="prediction-main">
                            <span class="course-name">${analytics.popularTopic.predictedTopic}</span>
                            <span class="confidence-badge" style="background: ${this.getConfidenceColor(analytics.popularTopic.confidence)}">
                                ${(analytics.popularTopic.confidence * 100).toFixed(1)}% confianza
                            </span>
                        </div>
                        <p class="prediction-reason">${analytics.popularTopic.reason}</p>
                        <div class="prediction-stats">
                            <span>📊 ${analytics.popularTopic.searchCount} búsquedas relacionadas</span>
                        </div>
                    </div>
                </div>

                <!-- Tendencias de Búsqueda -->
                <div class="analytics-section">
                    <h3>📈 Tendencias de Búsqueda</h3>
                    <div class="trends-list">
                        ${analytics.searchTrends.map((trend, index) => `
                            <div class="trend-item">
                                <span class="trend-rank">#${index + 1}</span>
                                <span class="trend-query">${trend.query}</span>
                                <span class="trend-count">${trend.count} búsquedas</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Estadísticas del Chatbot -->
                <div class="analytics-section">
                    <h3>🤖 Estadísticas del Chatbot</h3>
                    <div class="chat-stats-grid">
                        <div class="stat-card">
                            <div class="stat-number">${analytics.chatAnalytics.totalConversations}</div>
                            <div class="stat-label">Total Conversaciones</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${analytics.chatAnalytics.recentConversations}</div>
                            <div class="stat-label">Conversaciones Recientes</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${(analytics.chatAnalytics.averageConfidence * 100).toFixed(1)}%</div>
                            <div class="stat-label">Confianza Promedio</div>
                        </div>
                    </div>

                    <!-- Distribución de Intenciones -->
                    <div class="intent-distribution">
                        <h4>Distribución de Intenciones</h4>
                        <div class="intent-list">
                            ${Object.entries(analytics.chatAnalytics.intentDistribution).map(([intent, count]) => `
                                <div class="intent-item">
                                    <span class="intent-name">${this.formatIntentName(intent)}</span>
                                    <span class="intent-count">${count}</span>
                                    <div class="intent-bar" style="width: ${(count / analytics.chatAnalytics.recentConversations) * 100}%"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Resumen del Sistema -->
                <div class="analytics-section">
                    <h3>📊 Resumen del Sistema</h3>
                    <div class="system-summary">
                        <p><strong>Última actualización:</strong> ${new Date(analytics.timestamp).toLocaleString()}</p>
                        <p><strong>Total de búsquedas registradas:</strong> ${analytics.searchTrends.reduce((acc, trend) => acc + trend.count, 0)}</p>
                        <p><strong>Modelo ML:</strong> Activo y aprendiendo de las interacciones</p>
                    </div>
                </div>
            </div>
        `;

        statsContent.innerHTML = analyticsHTML;
    }

    getConfidenceColor(confidence) {
        if (confidence >= 0.8) return '#10b981';
        if (confidence >= 0.6) return '#f59e0b';
        return '#ef4444';
    }

    formatIntentName(intent) {
        const intentNames = {
            'consulta_horario': '🕐 Consulta Horario',
            'solicitar_material': '📚 Solicitar Material',
            'duda_teorica': '💡 Duda Teórica',
            'consulta_evaluacion': '📝 Consulta Evaluación',
            'consulta_administrativa': '⚙️ Consulta Administrativa',
            'consulta_general': '❓ Consulta General'
        };
        return intentNames[intent] || intent;
    }

    // Y actualizar el método loadStats para usar analytics
    async loadStats() {
        await this.loadAnalyticsDashboard();
    }
}

// Estilos para la animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .btn-secondary {
        background: #6b7280;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
    }
    
    .btn-secondary:hover {
        background: #4b5563;
    }

    .hidden {
        display: none !important;
    }
`;
document.head.appendChild(style);

// Agregar al final del archivo, después de los estilos existentes
const analyticsStyles = `
    <style>
        .analytics-dashboard {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        .analytics-section {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .analytics-section h3 {
            margin: 0 0 1.5rem 0;
            color: #1e293b;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 0.5rem;
        }

        .prediction-card {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #bae6fd;
            border-radius: 12px;
            padding: 1.5rem;
        }
        
        /* ✅ NUEVO: Estilo para la tarjeta de tema */
        .topic-prediction {
            background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
            border-color: #fde047;
        }

        .prediction-card h4 {
            margin: 0 0 1rem 0;
            color: #0369a1;
        }

        .prediction-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .course-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1e293b;
        }

        .confidence-badge {
            padding: 0.375rem 0.75rem;
            border-radius: 20px;
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
        }

        .prediction-reason {
            color: #64748b;
            margin: 0.5rem 0;
            font-size: 0.9rem;
        }

        .prediction-stats {
            color: #475569;
            font-size: 0.875rem;
        }

        .trends-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .trend-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem;
            background: #f8fafc;
            border-radius: 8px;
            transition: background 0.2s ease;
        }

        .trend-item:hover {
            background: #f1f5f9;
        }

        .trend-rank {
            background: #6366f1;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.875rem;
        }

        .trend-query {
            flex: 1;
            font-weight: 500;
            color: #1e293b;
        }

        .trend-count {
            color: #64748b;
            font-size: 0.875rem;
        }

        .chat-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .stat-card {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: #64748b;
            font-size: 0.875rem;
        }

        .intent-distribution {
            margin-top: 1.5rem;
        }

        .intent-distribution h4 {
            margin: 0 0 1rem 0;
            color: #374151;
        }

        .intent-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .intent-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem;
            background: #f8fafc;
            border-radius: 8px;
            position: relative;
        }

        .intent-name {
            flex: 1;
            font-weight: 500;
        }

        .intent-count {
            background: #e5e7eb;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 600;
        }

        .intent-bar {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            background: #dbeafe;
            border-radius: 8px;
            z-index: 1;
            opacity: 0.3;
        }

        .system-summary {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 8px;
        }

        .system-summary p {
            margin: 0.5rem 0;
            color: #475569;
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', analyticsStyles);

// Inicializar administrador
const adminManager = new AdminManager();

// Funciones globales para los onclick
window.searchCourses = () => adminManager.filterCourses(document.getElementById('adminSearch').value);
window.resetForm = () => adminManager.resetForm();