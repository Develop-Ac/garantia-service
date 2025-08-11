const nodemailer = require('nodemailer');

// Configurar o "transportador" de e-mail usando as variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // NOVO: Ativa os logs para depuração detalhada do envio de e-mails.
  logger: true,
  debug: true,
});

// Função para enviar um e-mail
async function sendMail(mailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      ...mailOptions
    });
    console.log('E-mail enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    throw error;
  }
}

module.exports = {
  sendMail,
};