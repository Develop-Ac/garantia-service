const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../middleware/upload');
const emailService = require('../services/emailService');
const { simpleParser } = require('mailparser');

// Webhook para receber respostas de e-mail
router.post('/webhook/email-reply/:secret', async (req, res) => {
  if (req.params.secret !== process.env.WEBHOOK_SECRET_KEY) {
    console.warn('Tentativa de acesso não autorizado ao webhook.');
    return res.status(403).send('Acesso não autorizado.');
  }

  try {
    const rawEmail = req.body.toString();
    const parsedEmail = await simpleParser(rawEmail);

    const subject = parsedEmail.subject || '';
    const from = parsedEmail.from.text;
    const emailBody = parsedEmail.text || 'Corpo do e-mail não encontrado.';

    // MUDANÇA: Extrai o número da NI do assunto
    const niMatch = subject.match(/NI\s*(\d+)/i);
    if (!niMatch || !niMatch[1]) {
      console.warn('Webhook recebeu e-mail sem NI no assunto:', subject);
      return res.status(400).send('Assunto do e-mail não contém o número da NI.');
    }
    const notaInterna = niMatch[1];

    const client = await db.getLocalClient();
    try {
      // MUDANÇA: Encontra a garantia pela nota_interna
      const garantiaResult = await client.query('SELECT id FROM garantias WHERE nota_interna = $1', [notaInterna]);
      if (garantiaResult.rows.length === 0) {
        console.warn(`Webhook: Garantia com NI ${notaInterna} não encontrada.`);
        return res.status(404).send('Garantia não encontrada.');
      }
      const garantiaId = garantiaResult.rows[0].id;

      const descricao = `De: ${from}\n\n${emailBody}`;
      const historicoQuery = `
        INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao)
        VALUES ($1, $2, 'Resposta Recebida');
      `;
      await client.query(historicoQuery, [garantiaId, descricao]);

      console.log(`Webhook: Resposta de ${from} adicionada à garantia da NI ${notaInterna}.`);
      res.status(200).send('Resposta recebida com sucesso.');

    } catch (dbError) {
      console.error('Erro de base de dados no webhook:', dbError);
      res.status(500).send('Erro interno ao processar a resposta.');
    } finally {
      client.release();
    }
  } catch (parseError) {
    console.error('Erro ao processar o e-mail no webhook:', parseError);
    res.status(400).send('Formato de e-mail inválido.');
  }
});


// Busca dados de uma venda específica no ERP (agora referida como NI)
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


// GET /api/garantias
router.get('/garantias', async (req, res) => {
  const client = await db.getLocalClient();
  try {
    const result = await client.query('SELECT id, nome_fornecedor, produtos, nota_interna, status, data_criacao, tipo_garantia, nfs_compra FROM garantias ORDER BY data_criacao DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar garantias:', error);
    res.status(500).json({ message: 'Erro interno ao buscar as garantias.' });
  } finally {
    client.release();
  }
});

// GET /api/garantias/:id
router.get('/garantias/:id', async (req, res) => {
  const { id } = req.params;
  const client = await db.getLocalClient();
  try {
    const garantiaResult = await client.query('SELECT * FROM garantias WHERE id = $1', [id]);
    if (garantiaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Garantia não encontrada.' });
    }
    const garantia = garantiaResult.rows[0];

    const historicoResult = await client.query('SELECT * FROM historico_garantias WHERE garantia_id = $1 ORDER BY data_ocorrencia DESC', [id]);
    garantia.historico = historicoResult.rows;

    const anexosResult = await client.query('SELECT * FROM anexos_garantias WHERE garantia_id = $1 ORDER BY data_upload ASC', [id]);
    garantia.anexos = anexosResult.rows;

    res.json(garantia);
  } catch (error) {
    console.error(`Erro ao buscar detalhes da garantia ${id}:`, error);
    res.status(500).json({ message: 'Erro interno ao buscar detalhes da garantia.' });
  } finally {
    client.release();
  }
});


// POST /api/garantias/:id/update
router.post('/garantias/:id/update', async (req, res) => {
  const { id } = req.params;
  const { descricao, tipo_interacao, novo_status, enviar_email, destinatario } = req.body;

  if (!descricao || !tipo_interacao) {
    return res.status(400).json({ message: 'Descrição e tipo de interação são obrigatórios.' });
  }

  const client = await db.getLocalClient();
  try {
    await client.query('BEGIN');

    const historicoQuery = `
      INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao)
      VALUES ($1, $2, $3);
    `;
    await client.query(historicoQuery, [id, descricao, tipo_interacao]);

    if (novo_status) {
      const updateStatusQuery = `UPDATE garantias SET status = $1 WHERE id = $2;`;
      await client.query(updateStatusQuery, [novo_status, id]);
    }

    if (enviar_email === true && destinatario) {
      const garantiaInfo = await client.query('SELECT nota_interna FROM garantias WHERE id = $1', [id]);
      const notaInterna = garantiaInfo.rows[0].nota_interna;

      const emailData = {
        to: destinatario,
        cc: process.env.EMAIL_USER,
        subject: `Re: Abertura de Garantia - NI ${notaInterna}`,
        text: descricao,
        html: `<p>${descricao.replace(/\n/g, '<br>')}</p>`,
      };
      await emailService.sendMail(emailData);
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


// POST /api/garantias
router.post('/garantias', upload.array('anexos', 10), async (req, res) => {
  const {
    erpFornecedorId,
    nomeFornecedor,
    emailFornecedor,
    produtos,
    notaInterna,
    descricao,
    copiasEmail,
    tipoGarantia,
    nfsCompra
  } = req.body;

  if (!erpFornecedorId || !produtos || !notaInterna || !descricao || !tipoGarantia) {
    return res.status(400).json({ message: 'Dados incompletos. Verifique os campos obrigatórios.' });
  }

  const client = await db.getLocalClient();
  try {
    await client.query('BEGIN');

    const garantiaQuery = `
      INSERT INTO garantias (erp_fornecedor_id, nome_fornecedor, email_fornecedor, produtos, nota_interna, descricao, copias_email, tipo_garantia, nfs_compra)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;
    const garantiaValues = [erpFornecedorId, nomeFornecedor, emailFornecedor, produtos, notaInterna, descricao, copiasEmail, tipoGarantia, nfsCompra];
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

    const emailData = {
      to: emailFornecedor,
      cc: copiasEmail,
      subject: `Abertura de Garantia (${tipoGarantia}) - NI ${notaInterna}`,
      text: `Prezados,\n\nAbrimos um processo de garantia (${tipoGarantia}) para o(s) seguinte(s) produto(s):\n- ${produtos}\n\nReferente à Nota Interna: ${notaInterna}\n\nDescrição do problema: ${descricao}\n\nPor favor, verifiquem os anexos para mais detalhes.\n\nAtenciosamente,\nEquipa AC Acessórios.`,
      html: `<p>Prezados,</p><p>Abrimos um processo de garantia (<b>${tipoGarantia}</b>) para o(s) seguinte(s) produto(s):</p><ul><li>${produtos}</li></ul><p>Referente à Nota Interna: <b>${notaInterna}</b></p><p><b>Descrição do problema:</b> ${descricao}</p><p>Por favor, verifiquem os anexos para mais detalhes.</p><p>Atenciosamente,<br>Equipa AC Acessórios.</p>`,
      attachments: req.files.map(file => ({
        filename: file.originalname,
        path: file.path
      }))
    };
    
    await emailService.sendMail(emailData);

    const historicoQuery = `
      INSERT INTO historico_garantias (garantia_id, descricao, tipo_interacao)
      VALUES ($1, $2, 'Email Enviado');
    `;
    const historicoDesc = emailData.text;
    await client.query(historicoQuery, [novaGarantiaId, historicoDesc]);

    await client.query('COMMIT');
    
    res.status(201).json({
      message: 'Garantia criada e e-mail enviado com sucesso!',
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

module.exports = router;