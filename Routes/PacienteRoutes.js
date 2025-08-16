const express = require('express');
const router = express.Router();

const {
  registrarPaciente,
  loginPaciente,
  actualizarPaciente,
  eliminarPaciente,
} = require('../Controllers/PacienteController');

// Endpoints de auth
router.post('/register', registrarPaciente);
router.post('/login',    loginPaciente);

// Endpoints CRUD (opcionales)
router.put('/:id',       actualizarPaciente);
router.delete('/:id',    eliminarPaciente);

module.exports = router;
