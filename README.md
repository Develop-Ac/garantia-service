# API de Garantias (NestJS + Prisma)

Backend reescrito em NestJS seguindo o mesmo padrao arquitetural do entregas-ac-backend. Utiliza Prisma para gerir o banco PostgreSQL, Nodemailer para comunicacao via e-mail e Minio (S3-compatível) para anexos.

## Preparacao do ambiente

1. Configure o arquivo `.env` (modelo ja preenchido neste repositorio).
2. Instale as dependencias:
   ```bash
   npm install
   ```
3. Gere o cliente Prisma e aplique o schema ao banco:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Opcional: gere o cliente sem migrar com `npx prisma generate`.

### Storage Minio

Preencha as variaveis:

```
MINIO_ENDPOINTS=http://10.0.2.139:9000,http://10.11.37.115:9000,http://172.18.0.21:9000,http://127.0.0.1:9000
MINIO_ENDPOINT=http://10.0.2.139:9000
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin123456
MINIO_BUCKET=garantias
MINIO_PATH_PREFIX=garantias/
```

Defina `MINIO_ENDPOINTS` com a lista de IPs/hosts apresentados pelo Easypanel (API em `:9000`). O backend testa cada endereco ate encontrar um que aceite conexao TCP e usa esse valor como endpoint oficial; `MINIO_ENDPOINT` continua aceito por retrocompatibilidade ou para ambientes que possuam apenas um host. O `MINIO_PATH_PREFIX` define a pasta interna dentro do bucket onde os anexos serao salvos.

## Execucao

- Ambiente de desenvolvimento (watch):
  ```bash
  npm run dev
  ```
- Build de producao:
  ```bash
  npm run build && npm start
  ```

## Estrutura principal

- `src/garantias`: modulo completo com regras de negocio, upload de anexos e integracao de e-mails.
- `src/emails`: listagem e vinculacao de e-mails recebidos.
- `src/fornecedores`: configuracoes especificas por fornecedor ERP.
- `src/erp`: camada que consulta o ERP via MSSQL OPENQUERY no linked server `CONSULTA`.
- `prisma/schema.prisma`: definicao das tabelas (garantias, historicos, anexos, abatimentos, fornecedores_config e caixa_de_entrada_emails).

## Integracao ERP via OPENQUERY

A API passou a reutilizar o mesmo mecanismo do `cotacao-backend`. O modulo `src/erp` injeta `OpenQueryService`, que cria um pool MSSQL (`mssql` npm) e executa `SELECT * FROM OPENQUERY(CONSULTA, '...')`. As queries internas continuam em Firebird, mas sao encapsuladas no SQL Server principal.

Preencha as variaveis do bloco `MSSQL_*` no `.env` para apontar ao servidor BI e ao linked server `CONSULTA`. Caso seja necessario rodar algum legado via ODBC direto, o `bridge.js` permanece no repositorio apenas como utilitario manual, nao sendo mais utilizado pela API NestJS.

## Baseline Prisma em banco existente

- O arquivo `prisma/migrations/0_init.sql` foi gerado via `prisma migrate diff --from-empty` e descreve toda a estrutura esperada. Use-o como referencia ou para subir novos ambientes vazios.
- Como o banco atual ja possui dados, execute `npm run prisma:validate` para validar que o schema real condiz com o Prisma (o comando roda `prisma migrate diff --exit-code`). Se houver divergencia, o comando retorna erro com o diff no console.
- Depois de validar, marque a migracao inicial como aplicada com `npm run prisma:baseline` para que o Prisma reconheca o estado atual sem tentar recriar tabelas.
- Observacao: o validador desconsidera diferencas nas tabelas legadas `emails` e `email_attachments`, pois o schema antigo utiliza tipos `bigint` diferentes dos que o Prisma consegue relacionar. Todos os demais objetos precisam bater com o banco existente.

## Rotas API (todas com prefixo `/api`)

- `GET /garantias`, `GET /garantias/:id`
- `POST /garantias`, `PUT /garantias/:id/status`, `POST /garantias/:id/update`
- `POST /garantias/email-reply`, `PUT /garantias/:id/marcar-como-visto`
- `GET /emails`, `PUT /emails/:id/link`
- `GET /fornecedores/config/:erpId`
- `GET /dados-erp/venda/:ni`
- `GET /status`

Todas as respostas continuam em portugues e com o mesmo formato de campos (snake_case) utilizado anteriormente.

## Status numericos das garantias

O campo `status` da tabela `garantias` agora guarda um codigo inteiro (1 a 16) em vez de texto. O frontend deve converter o numero para o rótulo desejado seguindo a mesma sequencia que ja era exibida:

1. Aguardando Aprovacao do Fornecedor
2. Emissao de Nota Fiscal
3. Descarte da Mercadoria
4. Aguardando Coleta
5. Aguardando Frete Cortesia
6. Aguardando Analise de Garantia
7. Aguardando Credito
8. Produto em Proxima Compra
9. Troca de Produto
10. Abatimento em Proximo Pedido
11. Credito em Conta
12. Abatimento em Boleto
13. Garantia Recebida
14. Concluida
15. Garantia Reprovada
16. Garantia Reprovada na Analise
