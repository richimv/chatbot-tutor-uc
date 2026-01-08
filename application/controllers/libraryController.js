const LibraryRepository = require('../../domain/repositories/libraryRepository');
const libraryRepo = new LibraryRepository();

exports.toggleItem = async (req, res) => {
    try {
        const { type, id, action } = req.body; // type: 'course'|'book', action: 'save'|'favorite'
        const userId = req.user.id; // From auth middleware

        if (!['course', 'book'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }
        if (!['save', 'favorite'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const dbField = action === 'save' ? 'is_saved' : 'is_favorite';
        let result;

        if (type === 'course') {
            result = await libraryRepo.toggleCourse(userId, id, dbField);
        } else {
            result = await libraryRepo.toggleBook(userId, id, dbField);
        }

        res.json({ success: true, item: result });
    } catch (error) {
        console.error('Toggle library item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getMyLibrary = async (req, res) => {
    try {
        const userId = req.user.id;
        const library = await libraryRepo.getUserLibrary(userId);
        res.json(library);
    } catch (error) {
        console.error('Get library error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.checkStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await libraryRepo.getUserLibraryIds(userId);
        res.json(status);
    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
