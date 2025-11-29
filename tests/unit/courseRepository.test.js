const CourseRepository = require('../../domain/repositories/courseRepository');
const db = require('../../infrastructure/database/db');

// Mock database
jest.mock('../../infrastructure/database/db');

describe('CourseRepository', () => {
    let courseRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        courseRepository = new CourseRepository();
    });

    describe('findById', () => {
        it('should return a course when found', async () => {
            const mockCourse = { id: 1, name: 'Intro to AI' };
            db.query.mockResolvedValue({ rows: [mockCourse] });

            const result = await courseRepository.findById(1);

            expect(db.query).toHaveBeenCalledWith('SELECT * FROM courses WHERE id = $1', [1]);
            expect(result).toEqual(mockCourse);
        });

        it('should return undefined when not found', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await courseRepository.findById(999);

            expect(result).toBeUndefined();
        });
    });

    describe('search', () => {
        it('should call stored procedure with normalized query', async () => {
            const query = '  Jávâ  ';
            const normalized = 'java'; // Assuming normalizeText does this
            db.query.mockResolvedValue({ rows: [] });

            await courseRepository.search(query);

            // Verify that db.query was called with the correct SQL and normalized parameter
            // Note: We are testing that the repository delegates correctly to the DB
            expect(db.query).toHaveBeenCalledWith(
                'SELECT * FROM search_courses($1)',
                expect.arrayContaining([expect.stringMatching(/java/i)])
            );
        });
    });
});
