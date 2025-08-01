const odbc = require('odbc');

const erpConnectionString = process.env.ERP_ODBC_CONNECTION_STRING;

async function queryErp(sqlQuery, params = []) {
  let connection;
  try {
    console.log('================================================');
    console.log('EXECUNTANDO QUERY NO ERP:');
    console.log('SQL:', sqlQuery);
    console.log('Parâmetros:', params);
    console.log('================================================');

    connection = await odbc.connect(erpConnectionString);
    const data = await connection.query(sqlQuery, params);
    
    console.log('DADOS RETORNADOS:', JSON.stringify(data, null, 2));
    console.log('================================================');

    return data;
  } catch (error) {
    console.error("Erro na conexão ODBC:", error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

// ... (o resto do ficheiro permanece igual)
const { Pool } = require('pg');
const localDbPool = new Pool({
  user: process.env.LOCAL_DB_USER,
  host: process.env.LOCAL_DB_HOST,
  database: process.env.LOCAL_DB_DATABASE,
  password: process.env.LOCAL_DB_PASSWORD,
  port: process.env.LOCAL_DB_PORT,
});
async function getLocalClient() {
    const client = await localDbPool.connect();
    return client;
}

module.exports = {
  queryErp,
  getLocalClient
};