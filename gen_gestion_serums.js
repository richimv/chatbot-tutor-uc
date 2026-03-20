
const MLService = require('./domain/services/mlService');

async function run() {
    try {
        console.log("🤖 Iniciando Generación Especial: Gestión de Servicios de Salud...");
        
        const result = await MLService.generateRAGQuestions(
            'SERUMS', 
            'Avanzado', 
            'Gestión de Servicios de Salud', 
            'Medicina', 
            5, 
            'advanced', 
            'medicine'
        );
        
        console.log("--- RESULTADO JSON ---");
        console.log(JSON.stringify(result, null, 2));
        console.log("--- FIN ---");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error:", e.message);
        process.exit(1);
    }
}
run();
