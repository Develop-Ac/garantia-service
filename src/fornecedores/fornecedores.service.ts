import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { getMinioConnection } from '../storage/minio-config';
import { normalizeStorageKey } from '../storage/storage-key.util';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(FornecedoresService.name);

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

    const formularioUrl = await this.buildFormularioUrl(config.formularioPath);

    return {
      id: config.id,
      erp_fornecedor_id: config.erpFornecedorId,
      processo_tipo: config.processoTipo,
      portal_link: config.portalLink,
      formulario_path: config.formularioPath,
      nome_formulario: config.nomeFormulario,
      formulario_url: formularioUrl,
      instrucao: config.instrucao,
    };
  }

  private async buildFormularioUrl(path?: string | null): Promise<string | null> {
    const trimmed = path?.trim();
    if (!trimmed) {
      return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    try {
      const { s3, bucket, prefix } = await getMinioConnection();
      const normalizedKey = normalizeStorageKey(trimmed, bucket, prefix);
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: normalizedKey,
      });
      return await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
    } catch (error) {
      this.logger.warn(`Falha ao gerar link do formulario (${trimmed}): ${error}`);
      return null;
    }
  }
}
