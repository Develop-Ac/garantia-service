const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../upload');
const emailService = require('../services/emailService');
const { simpleParser } = require('mailparser');

// Rota GET /api/garantias
router.get('/garantias', async (req, res) => {
    const client = await db.getLocalClient();
    try {
        const queryText = `
            SELECT 
                g.*, 
                (SELECT json_agg(h) FROM historico_garantias h WHERE h.garantia_id = g.id) as historico,
                (SELECT json_agg(a) FROM anexos_garantias a WHERE a.garantia_id = g.id) as anexos
            FROM garantias g
            ORDER BY g.data_criacao DESC
        `;
        const result = await client.query(queryText);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar garantias:', error);
        res.status(500).json({ message: 'Erro interno ao buscar as garantias.' });
    } finally {
        client.release();
    }
});

// Rota GET /api/garantias/:id
router.get('/garantias/:id', async (req, res) => {
    const { id } = req.params;
    const client = await db.getLocalClient();
    try {
        const queryText = `
            SELECT 
                g.*, 
                (SELECT json_agg(h) FROM historico_garantias h WHERE h.garantia_id = g.id) as historico,
                (SELECT json_agg(a) FROM anexos_garantias a WHERE a.garantia_id = g.id) as anexos
            FROM garantias g
            WHERE g.id = $1
        `;
        const garantiaResult = await client.query(queryText, [id]);

        if (garantiaResult.rows.length === 0) {
            return res.status(404).json({ message: 'Garantia não encontrada.' });
        }
        res.json(garantiaResult.rows[0]);
    } catch (error) {
        console.error(`Erro ao buscar detalhes da garantia ${id}:`, error);
        res.status(500).json({ message: 'Erro interno ao buscar detalhes da garantia.' });
    } finally {
        client.release();
    }
});


// Rota POST /api/garantias (CORRIGIDA)
router.post('/garantias', upload.array('anexos', 10), async (req, res) => {
    const {
        erpFornecedorId, nomeFornecedor, emailFornecedor, produtos,
        notaFiscal, // Usado como nota_interna
        descricao, copiasEmail, tipoGarantia, nfsCompra,
        outrosMeios,
        protocoloFornecedor
    } = req.body;

    if (!erpFornecedorId || !produtos || !notaFiscal || !descricao || !tipoGarantia) {
        return res.status(400).json({ message: 'Dados incompletos. Verifique os campos obrigatórios.' });
    }

    const client = await db.getLocalClient();
    try {
        await client.query('BEGIN');

        // MODIFICADO: A query agora tem 10 colunas e 10 placeholders ($1 a $10)
        const garantiaQuery = `
            INSERT INTO garantias (
                erp_fornecedor_id, nome_fornecedor, email_fornecedor, produtos, 
                nota_interna, descricao, tipo_garantia, nfs_compra, status, 
                protocolo_fornecedor
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
        // MODIFICADO: O array de valores agora tem 10 itens para corresponder à query
        const garantiaValues = [
            erpFornecedorId, nomeFornecedor, emailFornecedor, produtos, 
            notaFiscal, descricao, tipoGarantia, nfsCompra, 
            'Aguardando Aprovação do Fornecedor', // status
            protocoloFornecedor
        ];
        const result = await client.query(garantiaQuery, garantiaValues);
        const novaGarantiaId = result.rows[0].id;

        if (req.files && req.files.length > 0) {
            const anexoQuery = `
                INSERT INTO anexos_garantias (garantia_id, nome_ficheiro, path_ficheiro)
                VALUES ($1, $2, $3);
            `;
            for (const file of req.files) {
                await client.query(anexoQuery, [novaGarantiaId, file.originalname, file.path]);
            }
        }
        
        let historicoDesc;
        let historicoTipo = 'Criação do Processo';

        if (outrosMeios !== 'true') {
            const emailData = {
                to: emailFornecedor,
                cc: copiasEmail,
                subject: `Abertura de ${tipoGarantia} - Nota Fiscal ${nfsCompra || 'N/A'}`,
                html: `<p>Prezados,</p><p>Abrimos um processo de <b>${tipoGarantia}</b> para o(s) seguinte(s) produto(s):</p><ul><li>${produtos.replace(/; /g, '</li><li>')}</li></ul><p>Referente à Nota Interna: <b>${notaFiscal}</b></p><p>Referente à(s) NF(s) de Compra: <b>${nfsCompra || 'N/A'}</b></p><p><b>Descrição do problema:</b> ${descricao}</p><p>Por favor, verifiquem os anexos para mais detalhes.</p><p>Atenciosamente,<br>Equipa de Qualidade AC Acessórios.</p>`,
            };
            
            await emailService.sendMail(emailData);
            historicoDesc = emailData.html;
            historicoTipo = 'Email Enviado';
        } else {
            historicoDesc = `Processo de garantia criado manualmente (aberto por outros meios). Protocolo: ${protocoloFornecedor || 'N/A'}`;
        }

        const historicoQuery = `
            INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao)
            VALUES ($1, $2, $3);
        `;
        await client.query(historicoQuery, [novaGarantiaId, historicoDesc, historicoTipo]);

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Garantia criada com sucesso!',
            garantiaId: novaGarantiaId,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar garantia:', error);
        res.status(500).json({ message: 'Erro interno ao criar a garantia.' });
    } finally {
        client.release();
    }
});

// Rota PUT /api/garantias/:id/status
router.put('/garantias/:id/status', async (req, res) => {
    const client = await db.getLocalClient();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { novo_status, ...extraData } = req.body;

        const fields = Object.keys(extraData);
        const setClauses = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        const values = [novo_status, ...fields.map(field => extraData[field]), id];

        let updateQuery = `UPDATE garantias SET status = $1`;
        if (setClauses) {
            updateQuery += `, ${setClauses}`;
        }
        updateQuery += ` WHERE id = $${values.length};`;
        
        await client.query(updateQuery, values);

        const historicoDesc = `Status alterado para: ${novo_status}.`;
        const historicoQuery = 'INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao) VALUES ($1, $2, $3)';
        await client.query(historicoQuery, [id, historicoDesc, 'Atualização de Status']);

        await client.query('COMMIT');
        res.status(200).json({ message: `Status da garantia ${id} atualizado para ${novo_status}.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Erro ao atualizar status da garantia ${req.params.id}:`, err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
        client.release();
    }
});

// Rota POST /api/garantias/:id/update
router.post('/garantias/:id/update', upload.array('anexos', 10), async (req, res) => {
    const { id } = req.params;
    const { descricao, tipo_interacao } = req.body;
    const client = await db.getLocalClient();

    try {
        await client.query('BEGIN');

        if (descricao) {
            const historicoQuery = 'INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao) VALUES ($1, $2, $3)';
            await client.query(historicoQuery, [id, descricao, tipo_interacao || 'Nota Interna']);
        }

        if (req.files && req.files.length > 0) {
            const anexoQuery = 'INSERT INTO anexos_garantias (garantia_id, nome_ficheiro, path_ficheiro) VALUES ($1, $2, $3)';
            for (const file of req.files) {
                await client.query(anexoQuery, [id, file.originalname, file.path]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Garantia atualizada com sucesso!' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Erro ao atualizar a garantia ${id}:`, error);
        res.status(500).json({ message: 'Erro interno ao atualizar a garantia.' });
    } finally {
        client.release();
    }
});


// Rota GET /dados-erp/venda/:ni
router.get('/dados-erp/venda/:ni', async (req, res) => {
    const { ni } = req.params;
    if (!ni) {
        return res.status(400).json({ message: 'O código da Nota Interna (NI) é obrigatório.' });
    }

    try {
        const clienteQuery = `
            SELECT DISTINCT
                c.CLI_CODIGO,
                c.CLI_NOME
            FROM NF_SAIDA ns
            JOIN CLIENTES c ON ns.CLI_CODIGO = c.CLI_CODIGO
            WHERE ns.NFS = ? AND ns.EMPRESA = ?
        `;
        const clienteResult = await db.queryErp(clienteQuery, [ni, 3]);

        if (clienteResult.length === 0) {
            return res.status(404).json({ message: 'Nenhuma Nota Interna encontrada com este código para a empresa 3.' });
        }

        const cliente = clienteResult[0];
        const cliCodigo = cliente.CLI_CODIGO;

        const produtosItensQuery = `
            SELECT DISTINCT
                ni.PRO_CODIGO,
                ni.QUANTIDADE
            FROM NFS_ITENS ni
            WHERE ni.NFS = ? AND ni.EMPRESA = ?
        `;
        const produtosItensResult = await db.queryErp(produtosItensQuery, [ni, 3]);

        let produtosFinalResult = [];
        if (produtosItensResult.length > 0) {
            const productCodes = produtosItensResult.map(p => p.PRO_CODIGO);
            const placeholders = productCodes.map(() => '?').join(',');

            const produtosDescricaoQuery = `
                SELECT DISTINCT
                    p.PRO_CODIGO,
                    p.PRO_DESCRICAO
                FROM PRODUTOS p
                WHERE p.PRO_CODIGO IN (${placeholders})
            `;
            const produtosDescricaoResult = await db.queryErp(produtosDescricaoQuery, productCodes);
            
            produtosFinalResult = produtosItensResult.map(item => {
                const descricaoInfo = produtosDescricaoResult.find(d => d.PRO_CODIGO === item.PRO_CODIGO);
                return {
                    PRO_CODIGO: item.PRO_CODIGO,
                    QUANTIDADE: item.QUANTIDADE,
                    PRO_DESCRICAO: descricaoInfo ? descricaoInfo.PRO_DESCRICAO : 'Descrição não encontrada',
                };
            });
        }

        const emailQuery = `SELECT DISTINCT EMAIL FROM CLIENTES_EMAIL WHERE CLI_CODIGO = ?`;
        const emailResults = await db.queryErp(emailQuery, [cliCodigo]);
        const emails = emailResults.map(row => row.EMAIL);

        const response = {
            cliente: {
                CLI_CODIGO: cliCodigo,
                CLI_NOME: cliente.CLI_NOME,
                EMAILS: emails,
            },
            produtos: produtosFinalResult,
        };

        res.json(response);

    } catch (error) {
        console.error(`Erro ao buscar dados da NI ${ni} do ERP:`, error);
        res.status(500).json({ message: 'Erro interno ao comunicar com o ERP.' });
    }
});

module.exports = router;