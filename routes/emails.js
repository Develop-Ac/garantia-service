const express = require('express');
const router = express.Router();
const db = require('../database');

// Rota para buscar todos os e-mails da caixa de entrada
router.get('/emails', async (req, res) => {
    const client = await db.getLocalClient();
    try {
        const query = `
            SELECT e.*, g.nota_interna 
            FROM caixa_de_entrada_emails e
            LEFT JOIN garantias g ON e.garantia_id = g.id
            ORDER BY e.data_recebimento DESC;
        `;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar e-mails:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    } finally {
        client.release();
    }
});

// Rota para vincular um e-mail a uma garantia
router.put('/emails/:emailId/link', async (req, res) => {
    const { emailId } = req.params;
    const { garantia_id } = req.body;
    const client = await db.getLocalClient();

    try {
        await client.query('BEGIN');

        // 1. Pega os dados do e-mail
        const emailResult = await client.query('SELECT * FROM caixa_de_entrada_emails WHERE id = $1', [emailId]);
        if (emailResult.rows.length === 0) {
            return res.status(404).json({ message: 'E-mail não encontrado.' });
        }
        const email = emailResult.rows[0];

        // 2. Vincula o e-mail à garantia
        await client.query('UPDATE caixa_de_entrada_emails SET garantia_id = $1 WHERE id = $2', [garantia_id, emailId]);

        // 3. Adiciona o e-mail ao histórico da garantia
        const descricao = `<b>De:</b> ${email.remetente}<br><hr>${email.corpo_html}`;
        const historicoQuery = `
            INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao, foi_visto, message_id, assunto)
            VALUES ($1, $2, 'Resposta Recebida', FALSE, $3, $4);
        `;
        await client.query(historicoQuery, [garantia_id, descricao, email.message_id, email.assunto]);

        // 4. Marca a garantia como tendo nova interação
        await client.query('UPDATE garantias SET tem_nova_interacao = TRUE WHERE id = $1', [garantia_id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'E-mail vinculado com sucesso!' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao vincular e-mail:', error.stack || error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    } finally {
        client.release();
    }
});

module.exports = router;