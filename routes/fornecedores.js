const express = require('express');
const router = express.Router();
const db = require('../database');

// Rota para buscar a configuração de um fornecedor específico pelo seu ID do ERP
router.get('/fornecedores/config/:erpId', async (req, res) => {
    const { erpId } = req.params;
    const client = await db.getLocalClient();
    try {
        const query = 'SELECT * FROM fornecedores_config WHERE erp_fornecedor_id = $1';
        const result = await client.query(query, [erpId]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            // Se não encontrar, retorna 404 para que o app saiba que é um processo padrão.
            res.status(404).json({ message: 'Nenhuma configuração especial encontrada para este fornecedor.' });
        }
    } catch (error) {
        console.error('Erro ao buscar configuração do fornecedor:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    } finally {
        client.release();
    }
});

module.exports = router;