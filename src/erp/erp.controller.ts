import { BadRequestException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ErpService } from './erp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dados-erp')
export class ErpController {
  constructor(
    private readonly erpService: ErpService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('venda/:ni')
  async buscarDadosVenda(@Param('ni') ni: string) {
    if (!ni) {
      throw new BadRequestException('O codigo da Nota Interna (NI) e obrigatorio.');
    }

    const clienteQuery = `
      SELECT DISTINCT c.CLI_CODIGO, c.CLI_NOME
      FROM NF_SAIDA ns
      JOIN CLIENTES c ON ns.CLI_CODIGO = c.CLI_CODIGO
      WHERE ns.NFS = ? AND ns.EMPRESA = ?
    `;
    const clienteResult = await this.erpService.query(clienteQuery, [ni, 3]);

    if (!clienteResult.length) {
      throw new NotFoundException('Nenhuma Nota Interna encontrada para o codigo informado.');
    }

    const cliente = clienteResult[0];
    const cliCodigo = cliente.CLI_CODIGO;

    const produtosItensQuery = `
      SELECT DISTINCT ni.PRO_CODIGO, ni.QUANTIDADE
      FROM NFS_ITENS ni
      WHERE ni.NFS = ? AND ni.EMPRESA = ?
    `;
    const produtosItensResult = await this.erpService.query(produtosItensQuery, [ni, 3]);

    let produtos = [] as Array<{ PRO_CODIGO: string; QUANTIDADE: number; PRO_DESCRICAO: string }>;
    if (produtosItensResult.length) {
      const codigos = produtosItensResult.map((item: any) => item.PRO_CODIGO);
      const placeholders = codigos.map(() => '?').join(',');
      const produtosDescricaoQuery = `
        SELECT DISTINCT p.PRO_CODIGO, p.PRO_DESCRICAO
        FROM PRODUTOS p
        WHERE p.PRO_CODIGO IN (${placeholders})
      `;
      const descricoes = await this.erpService.query(produtosDescricaoQuery, codigos);
      produtos = produtosItensResult.map((item: any) => {
        const descricaoEncontrada = descricoes.find((desc: any) => desc.PRO_CODIGO === item.PRO_CODIGO);
        return {
          PRO_CODIGO: item.PRO_CODIGO,
          QUANTIDADE: item.QUANTIDADE,
          PRO_DESCRICAO: descricaoEncontrada?.PRO_DESCRICAO ?? 'Descricao nao encontrada',
        };
      });
    }

    const emailQuery = `SELECT DISTINCT EMAIL FROM CLIENTES_EMAIL WHERE CLI_CODIGO = ?`;
    const emailResult = await this.erpService.query(emailQuery, [cliCodigo]);
    const emails = emailResult.map((row: any) => row.EMAIL);

    const fornecedorConfig = await this.prisma.fornecedorConfig.findUnique({
      where: { erpFornecedorId: Number(cliCodigo) },
    });

    return {
      cliente: {
        CLI_CODIGO: cliCodigo,
        CLI_NOME: cliente.CLI_NOME,
        EMAILS: emails,
      },
      produtos,
      fornecedorConfig: fornecedorConfig
        ? {
            id: fornecedorConfig.id,
            erp_fornecedor_id: fornecedorConfig.erpFornecedorId,
            processo_tipo: fornecedorConfig.processoTipo,
            portal_link: fornecedorConfig.portalLink,
            formulario_path: fornecedorConfig.formularioPath,
            nome_formulario: fornecedorConfig.nomeFormulario,
          }
        : null,
    };
  }
}
