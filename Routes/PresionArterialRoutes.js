// Routes/PresionArterialRoutes.js
const express = require('express');
const router = express.Router();
const presionArterial = require('../Controllers/PresionArterialController');

router.post('/', presionArterial.crearToma);             
router.get('/by-date', presionArterial.obtenerPorFecha); 
router.get('/weekly', presionArterial.obtenerSemana);    
router.get('/monthly-report', presionArterial.reporteMensualPDF); 

module.exports = router;
