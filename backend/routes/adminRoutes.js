const express = require('express');
const router = express.Router();
const { addContact, getContacts, getSources, deleteSource, updateSource } = require('../controllers/adminController');
const { basicAuth } = require('../utils/auth');

router.use(basicAuth);

router.get('/verify', (req, res) => res.json({ message: 'Authenticated' }));
router.post('/contacts', addContact);
router.get('/contacts', getContacts);
router.get('/sources', getSources);
router.put('/sources/:id', updateSource);
router.delete('/sources/:id', deleteSource);

module.exports = router;
