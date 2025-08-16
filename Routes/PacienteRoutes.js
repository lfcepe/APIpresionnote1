const express = require('express');
const router = express.Router();
const { registrarPaciente, loginPaciente, actualizarPaciente, eliminarPaciente, me } =
  require('../Controllers/PacienteController');
const verifyToken = require('../Middlewares/auth');

// públicos
router.post('/register', registrarPaciente);
router.post('/login', loginPaciente);

// protegido: perfil del usuario actual
router.get('/me', verifyToken, me);

// si quieres proteger updates/borrados:
router.put('/:id', verifyToken, actualizarPaciente);
router.delete('/:id', verifyToken, eliminarPaciente);

module.exports = router;
