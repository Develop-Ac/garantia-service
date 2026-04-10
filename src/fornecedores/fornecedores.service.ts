import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Express } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { getMinioConnection } from '../storage/minio-config';
import { normalizeStorageKey } from '../storage/storage-key.util';
import { ErpService } from '../erp/erp.service';
import { UpsertFornecedorConfigDto } from './dto/upsert-fornecedor-config.dto';
import { CopyFornecedorConfigDto } from './dto/copy-fornecedor-config.dto';

@Injectable()
export class FornecedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpService: ErpService,
  ) {}

  private readonly logger = new Logger(FornecedoresService.name);
  private readonly processoTipos = new Set(['portal', 'formulario', 'email', 'whatsapp']);

  async listarConfiguracoes() {
    const configuracoes = await this.prisma.fornecedorConfig.findMany({
      orderBy: [{ erpFornecedorId: 'asc' }],
    });

    const nomesFornecedores = await this.buscarNomesFornecedores(
      configuracoes.map((item) => item.erpFornecedorId),
    );

    const payload = await Promise.all(
      configuracoes.map(async (config) => {
        const formularioUrl = await this.buildFormularioUrl(config.formularioPath);
        return {
          id: config.id,
          erp_fornecedor_id: config.erpFornecedorId,
          nome_fornecedor: nomesFornecedores.get(config.erpFornecedorId) ?? null,
          processo_tipo: config.processoTipo,
          portal_link: config.portalLink,
          formulario_path: config.formularioPath,
          nome_formulario: config.nomeFormulario,
          formulario_url: formularioUrl,
          instrucoes: config.instrucoes,
        };
      }),
    );

    return payload;
  }

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
    const nomesFornecedores = await this.buscarNomesFornecedores([config.erpFornecedorId]);

    return {
      id: config.id,
      erp_fornecedor_id: config.erpFornecedorId,
      nome_fornecedor: nomesFornecedores.get(config.erpFornecedorId) ?? null,
      processo_tipo: config.processoTipo,
      portal_link: config.portalLink,
      formulario_path: config.formularioPath,
      nome_formulario: config.nomeFormulario,
      formulario_url: formularioUrl,
      instrucoes: config.instrucoes,
    };
  }

  async criarConfiguracao(dto: UpsertFornecedorConfigDto, formulario?: Express.Multer.File) {
    const processoTipo = this.normalizarProcessoTipo(dto.processo_tipo);
    this.validarPayload(dto, processoTipo, formulario);

    const existente = await this.prisma.fornecedorConfig.findUnique({
      where: { erpFornecedorId: dto.erp_fornecedor_id },
    });

    if (existente) {
      throw new BadRequestException('Ja existe configuracao para este ERP fornecedor id.');
    }

    const arquivoNome = this.extrairNomeArquivo(formulario);

    const created = await this.prisma.fornecedorConfig.create({
      data: {
        erpFornecedorId: dto.erp_fornecedor_id,
        processoTipo,
        portalLink: processoTipo === 'portal' ? dto.portal_link?.trim() ?? null : null,
        formularioPath:
          processoTipo === 'formulario' ? arquivoNome ?? dto.formulario_path?.trim() ?? null : null,
        nomeFormulario:
          processoTipo === 'formulario'
            ? formulario?.originalname?.trim() ?? dto.nome_formulario?.trim() ?? null
            : null,
        instrucoes: dto.instrucoes?.trim() || null,
      },
    });

    return {
      message: 'Configuracao criada com sucesso.',
      id: created.id,
    };
  }

  async atualizarConfiguracao(
    id: number,
    dto: UpsertFornecedorConfigDto,
    formulario?: Express.Multer.File,
  ) {
    const existente = await this.prisma.fornecedorConfig.findUnique({ where: { id } });

    if (!existente) {
      throw new NotFoundException('Configuracao nao encontrada.');
    }

    const processoTipo = this.normalizarProcessoTipo(dto.processo_tipo);
    this.validarPayload(dto, processoTipo, formulario, existente.formularioPath);

    const conflito = await this.prisma.fornecedorConfig.findUnique({
      where: { erpFornecedorId: dto.erp_fornecedor_id },
    });

    if (conflito && conflito.id !== id) {
      throw new BadRequestException('Ja existe configuracao para este ERP fornecedor id.');
    }

    const arquivoNome = this.extrairNomeArquivo(formulario);

    await this.prisma.fornecedorConfig.update({
      where: { id },
      data: {
        erpFornecedorId: dto.erp_fornecedor_id,
        processoTipo,
        portalLink: processoTipo === 'portal' ? dto.portal_link?.trim() ?? null : null,
        formularioPath:
          processoTipo === 'formulario'
            ? arquivoNome ?? dto.formulario_path?.trim() ?? existente.formularioPath ?? null
            : null,
        nomeFormulario:
          processoTipo === 'formulario'
            ? formulario?.originalname?.trim() ?? dto.nome_formulario?.trim() ?? existente.nomeFormulario ?? null
            : null,
        instrucoes: dto.instrucoes?.trim() || null,
      },
    });

    return {
      message: 'Configuracao atualizada com sucesso.',
      id,
    };
  }

  async copiarConfiguracao(id: number, dto: CopyFornecedorConfigDto) {
    const origem = await this.prisma.fornecedorConfig.findUnique({ where: { id } });

    if (!origem) {
      throw new NotFoundException('Configuracao de origem nao encontrada.');
    }

    const conflito = await this.prisma.fornecedorConfig.findUnique({
      where: { erpFornecedorId: dto.novo_erp_fornecedor_id },
    });

    if (conflito) {
      throw new BadRequestException('Ja existe configuracao para o novo ERP fornecedor id informado.');
    }

    const created = await this.prisma.fornecedorConfig.create({
      data: {
        erpFornecedorId: dto.novo_erp_fornecedor_id,
        processoTipo: origem.processoTipo,
        portalLink: origem.portalLink,
        formularioPath: origem.formularioPath,
        nomeFormulario: origem.nomeFormulario,
        instrucoes: origem.instrucoes,
      },
    });

    return {
      message: 'Cadastro copiado com sucesso.',
      id: created.id,
    };
  }

  private normalizarProcessoTipo(value: string): string {
    const tipo = value?.trim().toLowerCase();
    if (!this.processoTipos.has(tipo)) {
      throw new BadRequestException('processo_tipo invalido. Valores aceitos: portal, formulario, email, whatsapp.');
    }
    return tipo;
  }

  private validarPayload(
    dto: UpsertFornecedorConfigDto,
    processoTipo: string,
    formulario?: Express.Multer.File,
    formularioExistente?: string | null,
  ) {
    if (!Number.isInteger(dto.erp_fornecedor_id) || dto.erp_fornecedor_id <= 0) {
      throw new BadRequestException('erp_fornecedor_id deve ser um numero inteiro maior que zero.');
    }

    if (processoTipo === 'portal' && !dto.portal_link?.trim()) {
      throw new BadRequestException('portal_link e obrigatorio para processo_tipo portal.');
    }

    if (processoTipo === 'formulario') {
      const hasFile = Boolean(formulario?.originalname?.trim());
      const hasPath = Boolean(dto.formulario_path?.trim() || formularioExistente?.trim());
      if (!hasFile && !hasPath) {
        throw new BadRequestException('formulario e obrigatorio para processo_tipo formulario.');
      }
    }

    if ((processoTipo === 'email' || processoTipo === 'whatsapp') && !dto.instrucoes?.trim()) {
      throw new BadRequestException('instrucoes e obrigatorio para processo_tipo email e whatsapp.');
    }
  }

  private extrairNomeArquivo(formulario?: Express.Multer.File): string | null {
    const nomeOriginal = formulario?.originalname?.trim();
    if (!nomeOriginal) {
      return null;
    }
    return nomeOriginal.replace(/[\\/]+/g, '_');
  }

  private async buscarNomesFornecedores(erpIds: number[]): Promise<Map<number, string>> {
    const unicos = Array.from(new Set(erpIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!unicos.length) {
      return new Map();
    }

    const placeholders = unicos.map(() => '?').join(',');
    const query = `
      SELECT DISTINCT c.CLI_CODIGO, c.CLI_NOME
      FROM CLIENTES c
      WHERE c.CLI_CODIGO IN (${placeholders})
    `;

    try {
      const rows = await this.erpService.query<Array<{ CLI_CODIGO: number | string; CLI_NOME: string }>[number]>(
        query,
        unicos,
      );
      const mapping = new Map<number, string>();
      for (const row of rows) {
        const codigo = Number(row.CLI_CODIGO);
        const nome = String(row.CLI_NOME ?? '').trim();
        if (!Number.isNaN(codigo) && nome) {
          mapping.set(codigo, nome);
        }
      }
      return mapping;
    } catch (error) {
      this.logger.warn(`Falha ao consultar nomes no ERP: ${error}`);
      return new Map();
    }
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
