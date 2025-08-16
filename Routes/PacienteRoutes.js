const express = require('express');
const router = express.Router();
const {
  registrarPaciente,
  loginPaciente,
  actualizarPaciente,
  eliminarPaciente,
  me
} = require('../Controllers/PacienteController');
const verifyToken = require('../Middleware/auth');

router.post('/register', registrarPaciente); 
router.post('/login', loginPaciente);        
router.get('/me', verifyToken, me);          
router.put('/:id', verifyToken, actualizarPaciente);       
router.delete('/:id', verifyToken, eliminarPaciente);     

module.exports = router;
