const TrainingService = require('./domain/services/trainingService');
const db = require('./infrastructure/database/db');

// Mock repository methods to avoid DB writes during test if possible, 
// OR just run against DB and rollback? 
// For simplicity, we'll let it hit DB but use a dummy user ID that we know exists or create one.
// actually, verify_flashcards.js used real DB.

// We need a valid user ID. Let's pick one from DB.
async function run() {
    try {
        // client = await db.pool.connect(); // Error: pool not exposed
        const resUser = await db.query("SELECT id FROM users LIMIT 1");
        if (resUser.rows.length === 0) {
            console.log("❌ No users found to test.");
            return;
        }
        const userId = resUser.rows[0].id;

        console.log(`🧪 Testing Modularity with User ID: ${userId}`);

        // Mock Quiz Data
        const quizData = {
            topic: 'TEST_MODULARITY',
            difficulty: 'TEST',
            score: 0,
            totalQuestions: 1,
            questions: [
                {
                    question: "Q1",
                    options: ["A", "B", "C", "D"],
                    correctAnswerIndex: 0,
                    userAnswer: 1, // Error -> Should create flashcard IF enabled
                    explanation: "Exp"
                }
            ]
        };

        // TEST 1: Default Behavior (No Options) -> Should NOT create flashcards (Arena style)
        console.log("🔹 TEST 1: Calling without options (Arena/Default)...");
        const res1 = await TrainingService.submitQuizResult(userId, { ...quizData, topic: 'TEST_ARENA' });
        console.log(`   Result: Created ${res1.flashcardsCreated} flashcards.`);
        if (res1.flashcardsCreated === 0) console.log("   ✅ PASS: No flashcards created.");
        else console.error("   ❌ FAIL: Flashcards created unexpectedly.");

        // TEST 2: With Options -> Should CREATE flashcards (Simulacro style)
        console.log("🔹 TEST 2: Calling with { createFlashcards: true } (Simulacro)...");
        const res2 = await TrainingService.submitQuizResult(userId, { ...quizData, topic: 'TEST_SIM' }, { createFlashcards: true });
        console.log(`   Result: Created ${res2.flashcardsCreated} flashcards.`);
        if (res2.flashcardsCreated === 1) console.log("   ✅ PASS: Flashcards created as requested.");
        else console.error("   ❌ FAIL: Flashcards NOT created.");

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        if (client) client.release();
        setTimeout(() => process.exit(0), 1000);
    }
}

run();
