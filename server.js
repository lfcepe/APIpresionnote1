const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.listen(port, () => {
  console.log(`BackEnd corriendo en http://localhost:${port}`);
});