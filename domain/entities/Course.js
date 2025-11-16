class Course {
    constructor({ id, nombre, carrera, temas, materiales }) {
        this.id = id;
        this.nombre = nombre;
        this.carrera = carrera;
        this.temas = temas || [];
        this.materiales = materiales || { pdfs: [], videos: [] };
    }

    isValid() {
        return this.nombre && this.nombre.trim().length > 0 && 
               this.carrera && this.carrera.trim().length > 0;
    }

    matchesSearch(query) {
        const searchTerm = query.toLowerCase();
        return this.nombre.toLowerCase().includes(searchTerm) ||
               this.carrera.toLowerCase().includes(searchTerm) ||
               this.temas.some(tema => tema.toLowerCase().includes(searchTerm));
    }
}

module.exports = Course;