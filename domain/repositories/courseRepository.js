const fs = require('fs').promises;
const path = require('path');

class CourseRepository {
    constructor() {
        this.filePath = path.join(__dirname, '../../infrastructure/database/courses.json');
        this.courses = [];
        this.loadCourses();
    }

    async loadCourses() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            this.courses = JSON.parse(data);
            console.log(`📚 CourseRepository: ${this.courses.length} cursos cargados.`);
        } catch (error) {
            console.error('❌ Error cargando cursos:', error);
            this.courses = [];
        }
    }

    async saveCourses() {
        try {
            await fs.writeFile(this.filePath, JSON.stringify(this.courses, null, 2), 'utf8');
            console.log('💾 Cursos guardados exitosamente.');
        } catch (error) {
            console.error('❌ Error guardando cursos:', error);
            throw new Error('No se pudo guardar el curso.');
        }
    }

    async findAll() {
        return this.courses;
    }

    async findById(id) {
        return this.courses.find(course => course.id === id);
    }

    _normalizeText(text) {
        if (!text) return '';
        return text
            .toString()
            .normalize('NFD') // Separa los caracteres de sus acentos
            .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
            .toLowerCase();
    }

    async search(query) {
        const normalizedQuery = this._normalizeText(query);
        return this.courses.filter(course =>
            this._normalizeText(course.nombre).includes(normalizedQuery) ||
            this._normalizeText(course.carrera).includes(normalizedQuery) ||
            course.temas.some(tema => this._normalizeText(tema).includes(normalizedQuery)) ||
            (course.docente && this._normalizeText(course.docente).includes(normalizedQuery))
        );
    }

    async create(courseData) {
        const newCourse = {
            id: Date.now().toString(),
            ...courseData
        };
        this.courses.push(newCourse);
        await this.saveCourses();
        return newCourse;
    }

    async update(id, courseData) {
        const index = this.courses.findIndex(course => course.id === id);
        if (index === -1) return null;
        this.courses[index] = { ...this.courses[index], ...courseData };
        await this.saveCourses();
        return this.courses[index];
    }

    async delete(id) {
        const index = this.courses.findIndex(course => course.id === id);
        if (index === -1) return null;
        const [deletedCourse] = this.courses.splice(index, 1);
        await this.saveCourses();
        return deletedCourse;
    }
}

module.exports = CourseRepository;