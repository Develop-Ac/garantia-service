const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Criar a pasta 'uploads' se ela não existir
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configurar o armazenamento dos ficheiros
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Onde guardar os ficheiros
  },
  filename: function (req, file, cb) {
    // Criar um nome de ficheiro único para evitar conflitos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

module.exports = upload;