import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarConfiguracao(erpId: string) {
    const parsedId = Number(erpId);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException('Fornecedor invalido.');
    }

    const config = await this.prisma.fornecedorConfig.findUnique({
      where: { erpFornecedorId: parsedId },
    });

    if (!config) {
      throw new NotFoundException('Nenhuma configuracao especial encontrada para este fornecedor.');
    }

    return {
      id: config.id,
      erp_fornecedor_id: config.erpFornecedorId,
      processo_tipo: config.processoTipo,
      portal_link: config.portalLink,
      formulario_path: config.formularioPath,
      nome_formulario: config.nomeFormulario,
    };
  }
}
