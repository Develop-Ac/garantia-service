/*
=========================================================================
 ARQUIVO: bridge.js
 - Este é um servidor local que atua como uma ponte segura para o Celta.
 - Ele recebe requisições do backend online, executa a consulta ODBC
   localmente e retorna o resultado.
=========================================================================
*/
require('dotenv').config();
const express = require('express');
const odbc = require('odbc');

const app = express();
app.use(express.json());

const PORT = process.env.BRIDGE_PORT || 4000;
const SECRET_KEY = process.env.BRIDGE_SECRET_KEY;
const erpConnectionString = process.env.ERP_ODBC_CONNECTION_STRING;

// Middleware de segurança para validar a chave secreta
const checkSecretKey = (req, res, next) => {
    const authKey = req.headers['x-bridge-secret'];
    if (authKey && authKey === SECRET_KEY) {
        next();
    } else {
        res.status(403).json({ message: 'Acesso não autorizado.' });
    }
};

// Endpoint único para executar consultas
app.post('/query-erp', checkSecretKey, async (req, res) => {
    const { sqlQuery, params = [] } = req.body;

    if (!sqlQuery) {
        return res.status(400).json({ message: 'A query SQL é obrigatória.' });
    }

    let connection;
    try {
        console.log('Ponte recebeu pedido para executar:', sqlQuery, params);
        connection = await odbc.connect(erpConnectionString);
        const data = await connection.query(sqlQuery, params);
        res.status(200).json(data);
    } catch (error) {
        console.error("Erro na conexão ODBC via ponte:", error);
        res.status(500).json({ message: 'Erro na ponte ODBC.', details: error });
    } finally {
        if (connection) await connection.close();
    }
});

app.listen(PORT, () => {
    console.log(`Ponte ODBC rodando na porta ${PORT}`);
    if (!SECRET_KEY || !erpConnectionString) {
        console.warn('AVISO: As variáveis BRIDGE_SECRET_KEY e ERP_ODBC_CONNECTION_STRING precisam estar definidas no .env!');
    }
});