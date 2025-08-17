const express = require('express');
const router = express.Router();
const presionarterial = require('../Controllers/PacienteController');
const { verifyToken } = require('../Middleware/auth');

router.post('/register', presionarterial.registrarPaciente);
router.post('/login', presionarterial.loginPaciente);
router.post('/refresh', presionarterial.refresh);

router.get('/me', verifyToken, presionarterial.me);
router.put('/:id', verifyToken, presionarterial.actualizarPaciente);
router.delete('/:id', verifyToken, presionarterial.eliminarPaciente);

module.exports = router;