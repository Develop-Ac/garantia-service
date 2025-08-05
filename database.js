const { Pool } = require('pg');
const axios = require('axios'); // Usado para fazer chamadas HTTP

// MODIFICADO: Garante que o modo SSL seja adicionado à string de conexão.
const connectionString = `${process.env.DATABASE_URL}?sslmode=require`;

// Conexão com o banco de dados PostgreSQL (Supabase)
const localDbPool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function getLocalClient() {
    const client = await localDbPool.connect();
    return client;
}

// MODIFICADO: Esta função agora se comunica com a ponte local.
async function queryErp(sqlQuery, params = []) {
    try {
        console.log('Backend principal enviando query para a ponte...');
        const response = await axios.post(
            `${process.env.BRIDGE_URL}/query-erp`,
            {
                sqlQuery,
                params
            },
            {
                headers: {
                    'x-bridge-secret': process.env.BRIDGE_SECRET_KEY
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Erro ao comunicar com a ponte ODBC:", error.response ? error.response.data : error.message);
        throw new Error('Falha na comunicação com o sistema ERP.');
    }
}

module.exports = {
    queryErp,
    getLocalClient
};