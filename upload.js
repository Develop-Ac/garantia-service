const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configura o Cloudinary com as suas credenciais do .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configura o armazenamento para o Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'garantias', // Nome da pasta onde os arquivos ficarão no Cloudinary
    allowed_formats: ['jpg', 'png', 'pdf', 'xlsx'], // Formatos permitidos
    // O resource_type "auto" permite que o Cloudinary aceite diferentes tipos de arquivo
    resource_type: 'auto' 
  }
});

const upload = multer({ storage: storage });

module.exports = upload;