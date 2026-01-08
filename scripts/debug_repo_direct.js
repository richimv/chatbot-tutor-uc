const CourseRepository = require('../domain/repositories/courseRepository');

async function debugRepo() {
    console.log('--- Repository Debug Start ---');
    try {
        const repo = new CourseRepository();
        console.log('Repository instantiated.');

        console.log('Calling findAll()...');
        const courses = await repo.findAll();
        console.log(`✅ Success! Found ${courses.length} courses.`);
        if (courses.length > 0) {
            console.log('Sample course:', JSON.stringify(courses[0], null, 2));
        }
    } catch (error) {
        console.error('❌ Repository call failed!');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        process.exit();
    }
}

debugRepo();
