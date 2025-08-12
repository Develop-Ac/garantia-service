require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Permite o download de formulários da pasta 'form_templates'
app.use('/form_templates', express.static(path.join(__dirname, 'form_templates')));

// --- Rotas da API ---
const garantiasRoutes = require('./routes/garantias');
const fornecedoresRoutes = require('./routes/fornecedores');
const emailsRoutes = require('./routes/emails');
app.use('/api', garantiasRoutes);
app.use('/api', fornecedoresRoutes);
app.use('/api', emailsRoutes);

// --- Rota de Verificação de Status ---
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor de Garantias a funcionar!',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a rodar na porta ${PORT}`);
});