const express = require('express');
const router = express.Router();
const libraryController = require('../../application/controllers/libraryController');
const { auth } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(auth);

router.post('/toggle', libraryController.toggleItem);
router.get('/my-library', libraryController.getMyLibrary);
router.get('/status', libraryController.checkStatus);

module.exports = router;
