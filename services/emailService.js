const nodemailer = require('nodemailer');

// Configurar o "transportador" de e-mail usando as variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true para a porta 465, false para as outras
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Função para enviar um e-mail
async function sendMail(mailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: mailOptions.to,
      cc: mailOptions.cc,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments: mailOptions.attachments
    });
    console.log('E-mail enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    throw error;
  }
}

// Função para obter o URL de preview do Ethereal
function getTestMessageUrl(info) {
    return nodemailer.getTestMessageUrl(info);
}

module.exports = {
  sendMail,
  getTestMessageUrl
};