require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // Para processar JSON
app.use(express.text({ type: '*/*' })); // Para processar o corpo do e-mail do webhook

// Servir ficheiros estáticos da pasta 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Rotas da API ---
const garantiasRoutes = require('./routes/garantias');
app.use('/api', garantiasRoutes);

// --- Rota de Verificação de Status ---
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor de Garantias a funcionar!',
    timestamp: new Date().toISOString()
  });
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a rodar na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT}/status para verificar a conexão.`);
});