const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../upload');
const emailService = require('../services/emailService');

// Rota GET /api/garantias (OTIMIZADA)
router.get('/garantias', async (req, res) => {
    const client = await db.getLocalClient();
    try {
        const queryText = `
            SELECT 
                g.*, 
                COALESCE(h.historico, '[]'::json) as historico,
                COALESCE(a.anexos, '[]'::json) as anexos
            FROM garantias g
            LEFT JOIN (
                SELECT 
                    garantia_id, 
                    json_agg(historico_garantias.* ORDER BY data_ocorrencia DESC) as historico
                FROM historico_garantias
                GROUP BY garantia_id
            ) h ON g.id = h.garantia_id
            LEFT JOIN (
                SELECT 
                    garantia_id, 
                    json_agg(anexos_garantias.* ORDER BY data_upload ASC) as anexos
                FROM anexos_garantias
                GROUP BY garantia_id
            ) a ON g.id = a.garantia_id
            ORDER BY g.data_criacao DESC;
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

// Rota GET /api/garantias/:id (OTIMIZADA)
router.get('/garantias/:id', async (req, res) => {
    const { id } = req.params;
    const client = await db.getLocalClient();
    try {
        const queryText = `
            SELECT 
                g.*, 
                COALESCE(h.historico, '[]'::json) as historico,
                COALESCE(a.anexos, '[]'::json) as anexos
            FROM garantias g
            LEFT JOIN (
                SELECT 
                    garantia_id, 
                    json_agg(historico_garantias.* ORDER BY data_ocorrencia DESC) as historico
                FROM historico_garantias
                GROUP BY garantia_id
            ) h ON g.id = h.garantia_id
            LEFT JOIN (
                SELECT 
                    garantia_id, 
                    json_agg(anexos_garantias.* ORDER BY data_upload ASC) as anexos
                FROM anexos_garantias
                GROUP BY garantia_id
            ) a ON g.id = a.garantia_id
            WHERE g.id = $1;
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

// ... (O resto do arquivo permanece o mesmo)
// POST /api/garantias
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

        const garantiaQuery = `
            INSERT INTO garantias (
                erp_fornecedor_id, nome_fornecedor, email_fornecedor, produtos, 
                nota_interna, descricao, tipo_garantia, nfs_compra, status, 
                protocolo_fornecedor
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
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
                subject: `Abertura de Processo de ${tipoGarantia} - Nota Fiscal ${nfsCompra || 'N/A'}`,
                html: `<p>Prezados,</p><p>Abrimos um processo de <b>${tipoGarantia}</b> para o(s) seguinte(s) produto(s):</p><ul><li>${produtos.replace(/; /g, '</li><li>')}</li></ul><p>Referente à(s) NF(s) de Compra: <b>${nfsCompra || 'N/A'}</b></p><p>Código de Controle Interno: <b>${notaFiscal}</b></p><p><b>Descrição do problema:</b> ${descricao}</p><p>Por favor, verifiquem os anexos para mais detalhes.</p><p>Atenciosamente,<br>Equipa de Qualidade AC Acessórios.</p>`,
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

// NOVA ROTA: Webhook para receber e-mails processados pelo N8N
router.post('/garantias/email-reply', async (req, res) => {
    // Para segurança, verificamos uma chave secreta enviada pelo N8N
    const n8nSecret = req.headers['x-n8n-secret'];
    if (n8nSecret !== process.env.N8N_SECRET_KEY) {
        console.warn('Tentativa de acesso não autorizado ao webhook do N8N.');
        return res.status(403).send('Acesso não autorizado.');
    }

    const { ni_number, sender, email_body_html } = req.body;

    if (!ni_number || !sender || !email_body_html) {
        return res.status(400).json({ message: 'Dados incompletos (NI, remetente ou corpo do e-mail faltando).' });
    }

    const client = await db.getLocalClient();
    try {
        await client.query('BEGIN');

        // 1. Encontra a garantia
        const garantiaResult = await client.query('SELECT id FROM garantias WHERE nota_interna = $1', [ni_number]);
        if (garantiaResult.rows.length === 0) {
            return res.status(200).send('Garantia não encontrada, mas processo finalizado.');
        }
        const garantiaId = garantiaResult.rows[0].id;

        // 2. Insere no histórico, marcando como NÃO VISTO
        const historicoQuery = `
            INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao, foi_visto)
            VALUES ($1, $2, 'Resposta Recebida', FALSE);
        `;
        const descricao = `<b>De:</b> ${sender}<br><hr>${email_body_html}`;
        await client.query(historicoQuery, [garantiaId, descricao]);

        // 3. Marca a garantia principal como tendo uma nova interação
        await client.query('UPDATE garantias SET tem_nova_interacao = TRUE WHERE id = $1', [garantiaId]);

        await client.query('COMMIT');
        res.status(200).send('Resposta recebida e registrada com sucesso.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro de banco de dados no webhook do N8N:', error);
        res.status(500).json({ message: 'Erro interno ao processar a resposta do e-mail.' });
    } finally {
        client.release();
    }
});
    // NOVA ROTA: Marcar interações de uma garantia como vistas
    router.put('/garantias/:id/marcar-como-visto', async (req, res) => {
        const { id } = req.params;
        const client = await db.getLocalClient();
            try {
                await client.query('BEGIN');
                // Marca a garantia principal como não tendo mais novas interações
                await client.query('UPDATE garantias SET tem_nova_interacao = FALSE WHERE id = $1', [id]);
                // Marca todos os históricos daquela garantia como vistos
                await client.query('UPDATE historico_garantias SET foi_visto = TRUE WHERE garantia_id = $1', [id]);
                await client.query('COMMIT');
                res.status(200).json({ message: 'Interações marcadas como vistas.' });
                } catch (error) {
            await client.query('ROLLBACK');
                console.error(`Erro ao marcar interações como vistas para a garantia ${id}:`, error);
                res.status(500).json({ message: 'Erro interno do servidor.' });
            } finally {
        client.release();
    }
}); 

module.exports = router;