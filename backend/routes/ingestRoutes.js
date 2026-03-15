const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ingestPDF, ingestURL, ingestFAQ, ingestDeepURL } = require('../controllers/ingestController');
const { basicAuth } = require('../utils/auth');

const upload = multer();

router.use(basicAuth);

router.post('/pdf', upload.single('pdf'), ingestPDF);
router.post('/url', ingestURL);
router.post('/deep-url', ingestDeepURL);
router.post('/faq', ingestFAQ);

module.exports = router;
