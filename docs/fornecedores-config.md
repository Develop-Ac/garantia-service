# Fornecedores Config API

## Objetivo
Cadastro base de configuracao por fornecedor para garantia usando a tabela gar_fornecedores_config.

## Regras de negocio
- Unicidade por erp_fornecedor_id.
- processo_tipo aceitos: portal, formulario, email, whatsapp.
- Para portal: portal_link obrigatorio.
- Para formulario: arquivo obrigatorio na criacao e upload no bucket garantias.
- Para email e whatsapp: instrucoes obrigatorio.

## Endpoints
- GET /api/fornecedores/config
  - Lista todos os cadastros com nome_fornecedor resolvido via ERP.
- GET /api/fornecedores/config/:erpId
  - Retorna cadastro por ERP fornecedor id.
- POST /api/fornecedores/config
  - Cria cadastro. Aceita multipart/form-data com campo formulario.
- PATCH /api/fornecedores/config/:id
  - Atualiza cadastro. Aceita multipart/form-data com campo formulario.
- POST /api/fornecedores/config/:id/copy
  - Copia cadastro existente exigindo novo_erp_fornecedor_id.

## Campos persistidos
- erp_fornecedor_id
- processo_tipo
- portal_link
- formulario_path (mantido no formato de nome de arquivo)
- nome_formulario
- instrucoes

## Observacoes de upload
- Upload do formulario utiliza bucket garantias.
- formulario_path permanece com nome do arquivo para manter compatibilidade com o comportamento atual.
