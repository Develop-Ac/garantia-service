import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AnexoGarantia, Garantia, HistoricoGarantia, Prisma } from '@prisma/client';
import { Express } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CriarGarantiaDto } from './dto/criar-garantia.dto';
import { AtualizarStatusGarantiaDto } from './dto/atualizar-status.dto';
import { AtualizarGarantiaDto } from './dto/atualizar-garantia.dto';
import { WebhookRespostaDto } from './dto/webhook-resposta.dto';
import { getMinioConnection } from '../storage/minio-config';

interface TimelineEmail {
  type: 'email';
  id: number;
  remetente: string;
  destinatarios: string;
  assunto: string;
  corpo_html: string;
  foi_enviado: boolean;
  data_ocorrencia: Date;
}

interface TimelineHistorico {
  type: 'historico';
  id: number;
  descricao: string;
  tipo_interacao: string;
  foi_visto: boolean;
  data_ocorrencia: Date;
}

@Injectable()
export class GarantiasService {
  private readonly THREAD_LIMIT = 10;
  private minioPromise: Promise<Awaited<ReturnType<typeof getMinioConnection>>> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async listarTodas() {
    const garantias = await this.prisma.garantia.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        historicos: { orderBy: { dataOcorrencia: 'desc' } },
        anexos: { orderBy: { dataUpload: 'asc' } },
      },
    });

    return garantias.map((garantia) => ({
      ...this.serializeGarantia(garantia),
      historico: garantia.historicos.map((h) => this.serializeHistorico(h)),
      anexos: garantia.anexos.map((a) => this.serializeAnexo(a)),
    }));
  }

  async obterPorId(id: number) {
    const garantia = await this.prisma.garantia.findUnique({
      where: { id },
      include: {
        anexos: { orderBy: { dataUpload: 'asc' } },
        historicos: { orderBy: { dataOcorrencia: 'desc' } },
      },
    });

    if (!garantia) {
      throw new NotFoundException('Garantia nao encontrada.');
    }

    const timeline = garantia.historicos.map((historico) =>
      this.mapHistoricoToTimeline(historico, garantia),
    );

    return {
      ...this.serializeGarantia(garantia),
      anexos: garantia.anexos.map((a) => this.serializeAnexo(a)),
      timeline,
    };
  }

  async gerarUrlArquivo(key: string) {
    if (!key || key.trim().length === 0) {
      throw new BadRequestException('Informe a chave do arquivo.');
    }

    const trimmed = key.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return { ok: true, url: trimmed };
    }

    const { s3, bucket, prefix } = await this.getMinioClient();
    const finalKey = this.normalizeStorageKey(trimmed, bucket, prefix);
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: finalKey,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
      return { ok: true, url };
    } catch (error) {
      throw new BadRequestException('Não foi possível gerar o link de download.');
    }
  }

  async criar(dto: CriarGarantiaDto, anexos: Express.Multer.File[]) {
    return this.prisma.$transaction(async (tx) => {
      const garantia = await tx.garantia.create({
        data: {
          erpFornecedorId: this.normalizeFornecedorId(dto.erpFornecedorId),
          nomeFornecedor: dto.nomeFornecedor,
          emailFornecedor: dto.emailFornecedor,
          produtos: dto.produtos,
          notaInterna: dto.notaFiscal,
          descricao: dto.descricao,
          tipoGarantia: dto.tipoGarantia,
          nfsCompra: dto.nfsCompra,
          status: 1,
          protocoloFornecedor: dto.protocoloFornecedor,
          copiasEmail: dto.copiasEmail,
        },
      });

      if (anexos?.length) {
        await tx.anexoGarantia.createMany({
          data: anexos.map((file) => ({
            garantiaId: garantia.id,
            nomeFicheiro: file.originalname,
            pathFicheiro: this.getFileStoragePath(file),
          })),
        });
      }

      let descricaoHistorico = `Processo de garantia criado manualmente. Protocolo: ${dto.protocoloFornecedor ?? 'N/A'}`;
      let tipoHistorico = 'Criacao do Processo';
      let messageId: string | null = null;
      let assunto: string | null = null;

      if (!dto.outrosMeios) {
        const subject = `Abertura de Processo de ${dto.tipoGarantia} - Nota Fiscal ${dto.nfsCompra ?? 'N/A'}`;
        const listaProdutos = dto.produtos
          .split(';')
          .map((produto) => produto.trim())
          .filter(Boolean)
          .map((produto) => `<li>${produto}</li>`) // html
          .join('');

        const html = `
          <p>Prezados,</p>
          <p>Abrimos um processo de <b>${dto.tipoGarantia}</b> para o(s) seguinte(s) produto(s):</p>
          <ul>${listaProdutos}</ul>
          <p>Referente a(s) NF(s) de Compra: <b>${dto.nfsCompra ?? 'N/A'}</b></p>
          <p>Codigo de Controle Interno: <b>${dto.notaFiscal}</b></p>
          <p><b>Descricao do problema:</b> ${dto.descricao}</p>
          <p>Por favor, verifiquem os anexos para mais detalhes.</p>
          <p>Atenciosamente,<br>${process.env.EMAIL_FROM_NAME ?? 'Equipe de Qualidade AC Acessorios'}.</p>
        `;

        const text = `Prezados,\n\nAbrimos um processo de ${dto.tipoGarantia} para o(s) seguinte(s) produto(s):\n${dto.produtos}\n\nReferente a(s) NF(s) de Compra: ${dto.nfsCompra ?? 'N/A'}\nCodigo de Controle Interno: ${dto.notaFiscal}\nDescricao do problema: ${dto.descricao}\n\nAtenciosamente,\n${process.env.EMAIL_FROM_NAME ?? 'Equipe de Qualidade AC Acessorios'}`;

        const emailResponse = await this.emailService.send({
          to: dto.emailFornecedor,
          cc: dto.copiasEmail || undefined,
          subject,
          html,
          text,
          attachments: anexos?.map((file) => ({
            filename: file.originalname,
            path: this.getFileStoragePath(file),
          })),
        });

        descricaoHistorico = html;
        tipoHistorico = 'Email Enviado';
        messageId = emailResponse.messageId ?? null;
        assunto = subject;
      }

      await tx.historicoGarantia.create({
        data: {
          garantiaId: garantia.id,
          descricao: descricaoHistorico,
          tipoInteracao: tipoHistorico,
          messageId,
          assunto,
          foiVisto: true,
        },
      });

      return { message: 'Garantia criada com sucesso!', garantiaId: garantia.id };
    });
  }

  async atualizarStatus(id: number, dto: AtualizarStatusGarantiaDto) {
    const data: Prisma.GarantiaUpdateInput = {};

    if (dto.novoStatus !== undefined) data.status = dto.novoStatus;
    if (dto.precisaNotaFiscal !== undefined) data.precisaNotaFiscal = dto.precisaNotaFiscal;
    if (dto.fretePorContaDe) data.fretePorContaDe = dto.fretePorContaDe;
    if (dto.cfop) data.cfop = dto.cfop;
    if (dto.transportadoraRazaoSocial) data.transportadoraRazaoSocial = dto.transportadoraRazaoSocial;
    if (dto.transportadoraCnpj) data.transportadoraCnpj = dto.transportadoraCnpj;
    if (dto.transportadoraEndereco) data.transportadoraEndereco = dto.transportadoraEndereco;
    if (dto.transportadoraCidade) data.transportadoraCidade = dto.transportadoraCidade;
    if (dto.transportadoraUf) data.transportadoraUf = dto.transportadoraUf;
    if (dto.transportadoraIe) data.transportadoraIe = dto.transportadoraIe;
    if (dto.codigoColetaEnvio) data.codigoColetaEnvio = dto.codigoColetaEnvio;
    if (dto.obs) data.obs = dto.obs;
    if (dto.numeroNfDevolucao) data.numeroNfDevolucao = dto.numeroNfDevolucao;
    if (dto.dataColetaEnvio) data.dataColetaEnvio = new Date(dto.dataColetaEnvio);
    if (dto.valorCreditoTotal !== undefined) data.valorCreditoTotal = dto.valorCreditoTotal;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.garantia.update({ where: { id }, data });
      }

      if (dto.valorCreditoUtilizado !== undefined) {
        await tx.garantia.update({
          where: { id },
          data: {
            valorCreditoUtilizado: {
              increment: dto.valorCreditoUtilizado,
            },
          },
        });
      }

      if (dto.abatimentos?.length) {
        for (const abatimento of dto.abatimentos) {
          await tx.garantiaAbatimento.create({
            data: {
              garantiaId: id,
              nf: abatimento.nf,
              parcela: abatimento.parcela,
              vencimento: abatimento.vencimento ? new Date(abatimento.vencimento) : null,
              valor: abatimento.valor,
            },
          });
        }
      }

      const garantiaAtualizada = await tx.garantia.findUnique({ where: { id } });
      if (!garantiaAtualizada) {
        throw new NotFoundException('Garantia nao encontrada.');
      }
      return this.serializeGarantia(garantiaAtualizada);
    });
  }

  async registrarAtualizacao(id: number, dto: AtualizarGarantiaDto, anexos: Express.Multer.File[]) {
    const garantia = await this.prisma.garantia.findUnique({ where: { id } });
    if (!garantia) {
      throw new NotFoundException('Garantia nao encontrada.');
    }

    return this.prisma.$transaction(async (tx) => {
      let messageId: string | null = null;
      let assunto: string | null = null;

      if (dto.enviarEmail) {
        const destinatario = (dto.destinatario ?? garantia.emailFornecedor ?? '').trim();
        if (!destinatario) {
          throw new BadRequestException('Destinatario nao informado.');
        }

        const ccFinal = dto.copias?.trim() || dto.cc?.trim() || garantia.copiasEmail || undefined;

        const referencias = await tx.historicoGarantia.findMany({
          where: { garantiaId: id, messageId: { not: null } },
          orderBy: { dataOcorrencia: 'asc' },
          select: { messageId: true, tipoInteracao: true, assunto: true },
        });

        const thread = referencias
          .map((ref) => ({
            id: this.normalizeMessageId(ref.messageId),
            tipo: ref.tipoInteracao,
            assunto: ref.assunto,
          }))
          .filter((ref) => !!ref.id);

        const lastSubject = [...referencias]
          .reverse()
          .find((ref) => !!ref.assunto)?.assunto ?? `Garantia - NI ${garantia.notaInterna}`;
        const computedSubject = /^re:/i.test(lastSubject) ? lastSubject : `Re: ${lastSubject}`;
        assunto = computedSubject;
        const parentId = thread.length ? thread[thread.length - 1].id : undefined;

        const quoted = await this.buildQuotedThread(id, {
          ourAddress: process.env.EMAIL_FROM ?? garantia.emailFornecedor ?? '',
          toDefault: destinatario,
          ccDefault: ccFinal ?? '',
        });

        const assinatura = `Atenciosamente,<br>${process.env.EMAIL_FROM_NAME ?? 'Equipe de Qualidade AC Acessorios.'}`;
        const bodyHtml = `<p>${(dto.descricao ?? '').replace(/\n/g, '<br>')}</p><br><p>${assinatura}</p>${quoted.html}`;
        const bodyText = `${dto.descricao ?? ''}\n\n${assinatura.replace(/<br>/g, '\n')}\n\n${quoted.text}`;

        const headers: Record<string, string> = {};
        if (parentId) headers['In-Reply-To'] = parentId;
        if (thread.length) headers['References'] = thread.map((item) => item.id).join(' ');

        const email = await this.emailService.send({
          to: destinatario,
          cc: ccFinal,
          subject: computedSubject,
          html: bodyHtml,
          text: bodyText,
          attachments: anexos?.map((file) => ({ filename: file.originalname, path: file.path })),
          headers: Object.keys(headers).length ? headers : undefined,
        });

        messageId = email.messageId ?? null;
      }

      const historico = await tx.historicoGarantia.create({
        data: {
          garantiaId: id,
          descricao: dto.descricao,
          tipoInteracao: dto.enviarEmail ? 'Resposta Enviada' : dto.tipoInteracao ?? 'Nota Interna',
          foiVisto: !!dto.enviarEmail,
          messageId,
          assunto,
        },
      });

      if (anexos?.length) {
        await tx.anexoGarantia.createMany({
          data: anexos.map((file) => ({
            garantiaId: id,
            nomeFicheiro: file.originalname,
            pathFicheiro: this.getFileStoragePath(file),
          })),
        });
      }

      return { message: 'Garantia atualizada com sucesso!' };
    });
  }

  async registrarWebhook(secret: string | undefined, dto: WebhookRespostaDto) {
    const expectedSecret = process.env.N8N_SECRET_KEY ?? process.env.WEBHOOK_SECRET_KEY;
    if (!secret || secret !== expectedSecret) {
      throw new ForbiddenException('Acesso nao autorizado.');
    }

    const garantia = await this.prisma.garantia.findFirst({ where: { notaInterna: dto.ni_number } });
    if (!garantia) {
      return { message: 'Garantia nao encontrada.' };
    }

    if (dto.message_id) {
      const duplicado = await this.prisma.historicoGarantia.findFirst({ where: { messageId: dto.message_id } });
      if (duplicado) {
        return { message: 'E-mail duplicado ignorado.' };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.historicoGarantia.create({
        data: {
          garantiaId: garantia.id,
          descricao: `<b>De:</b> ${dto.sender}<br><hr>${dto.email_body_html}`,
          tipoInteracao: 'Resposta Recebida',
          foiVisto: false,
          messageId: dto.message_id ?? null,
          assunto: dto.subject ?? null,
        },
      });

      await tx.garantia.update({
        where: { id: garantia.id },
        data: { temNovaInteracao: true },
      });
    });

    return { message: 'Resposta registrada com sucesso.' };
  }

  async marcarComoVisto(id: number) {
    await this.prisma.$transaction([
      this.prisma.garantia.update({ where: { id }, data: { temNovaInteracao: false } }),
      this.prisma.historicoGarantia.updateMany({ where: { garantiaId: id }, data: { foiVisto: true } }),
    ]);

    return { message: 'Interacoes marcadas como vistas.' };
  }

  private mapHistoricoToTimeline(h: HistoricoGarantia, garantia: Garantia): TimelineEmail | TimelineHistorico {
    const tipo = (h.tipoInteracao ?? '').toLowerCase();
    const isEmail = tipo.includes('email enviado') || tipo.includes('resposta enviada') || tipo.includes('resposta recebida');

    if (isEmail) {
      const isRecebida = tipo.includes('recebida');
      const remetente = isRecebida
        ? this.extractSender(h.descricao) ?? 'Remetente desconhecido'
        : process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? 'AC Acessorios';

      const destinatarios = isRecebida ? (process.env.EMAIL_FROM ?? '') : (garantia.emailFornecedor ?? '');

      return {
        type: 'email',
        id: h.id,
        remetente,
        destinatarios,
        assunto: h.assunto ?? '(sem assunto)',
        corpo_html: h.descricao ?? '',
        foi_enviado: !isRecebida,
        data_ocorrencia: h.dataOcorrencia,
      };
    }

    return {
      type: 'historico',
      id: h.id,
      descricao: h.descricao ?? '',
      tipo_interacao: h.tipoInteracao ?? '',
      foi_visto: h.foiVisto ?? true,
      data_ocorrencia: h.dataOcorrencia,
    };
  }

  private serializeGarantia(garantia: Garantia) {
    return {
      id: garantia.id,
      erp_fornecedor_id: garantia.erpFornecedorId,
      nome_fornecedor: garantia.nomeFornecedor,
      email_fornecedor: garantia.emailFornecedor,
      produtos: garantia.produtos,
      nota_interna: garantia.notaInterna,
      descricao: garantia.descricao,
      tipo_garantia: garantia.tipoGarantia,
      nfs_compra: garantia.nfsCompra,
      status: garantia.status,
      protocolo_fornecedor: garantia.protocoloFornecedor,
      copias_email: garantia.copiasEmail,
      precisa_nota_fiscal: garantia.precisaNotaFiscal,
      frete_por_conta_de: garantia.fretePorContaDe,
      cfop: garantia.cfop,
      transportadora_razao_social: garantia.transportadoraRazaoSocial,
      transportadora_cnpj: garantia.transportadoraCnpj,
      transportadora_endereco: garantia.transportadoraEndereco,
      transportadora_cidade: garantia.transportadoraCidade,
      transportadora_uf: garantia.transportadoraUf,
      transportadora_ie: garantia.transportadoraIe,
      nf_abatida_boleto: garantia.nfAbatidaBoleto,
      tipo_credito_final: garantia.tipoCreditoFinal,
      codigo_coleta_envio: garantia.codigoColetaEnvio,
      obs: garantia.obs,
      numero_nf_devolucao: garantia.numeroNfDevolucao,
      data_coleta_envio: garantia.dataColetaEnvio,
      valor_credito_total: garantia.valorCreditoTotal,
      valor_credito_utilizado: garantia.valorCreditoUtilizado,
      tem_nova_interacao: garantia.temNovaInteracao ?? false,
      data_criacao: garantia.createdAt,
    };
  }

  private serializeHistorico(h: HistoricoGarantia) {
    return {
      id: h.id,
      garantia_id: h.garantiaId,
      descricao: h.descricao,
      tipo_interacao: h.tipoInteracao,
      foi_visto: h.foiVisto,
      data_ocorrencia: h.dataOcorrencia,
      message_id: h.messageId,
      assunto: h.assunto,
    };
  }

  private serializeAnexo(anexo: AnexoGarantia) {
    return {
      id: anexo.id,
      garantia_id: anexo.garantiaId,
      nome_ficheiro: anexo.nomeFicheiro,
      path_ficheiro: anexo.pathFicheiro,
      data_upload: anexo.dataUpload,
    };
  }

  private getFileStoragePath(file: Express.Multer.File) {
    const enriched = file as Express.Multer.File & { location?: string; key?: string };
    return enriched.location ?? enriched.path ?? enriched.key ?? file.filename ?? '';
  }

  private getMinioClient() {
    if (!this.minioPromise) {
      this.minioPromise = getMinioConnection();
    }
    return this.minioPromise;
  }

  private normalizeStorageKey(rawKey: string, bucket: string, prefix: string) {
    let key = rawKey.trim();
    key = key.split('?')[0];
    key = key.replace(/^https?:\/\/[^/]+\//i, '');
    key = key.replace(/^\/+/, '');

    const bucketPrefix = `${bucket}/`.replace(/\/+$/, '/');
    if (key.startsWith(bucketPrefix)) {
      key = key.slice(bucketPrefix.length);
    }

    const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';
    if (normalizedPrefix && key.startsWith(normalizedPrefix)) {
      return key;
    }

    return normalizedPrefix ? `${normalizedPrefix}${key}` : key;
  }

  private extractSender(html?: string | null) {
    if (!html) return null;
    const match = /<b>De:<\/b>\s*([^<]+(?:<[^>]+>)?)/i.exec(html);
    if (!match) return null;
    return match[1].replace(/<br>.*/i, '').trim();
  }

  private normalizeMessageId(messageId?: string | null) {
    if (!messageId) return null;
    const trimmed = messageId.trim();
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return trimmed;
    }
    return `<${trimmed.replace(/^<|>$/g, '')}>`;
  }

  private normalizeFornecedorId(raw?: string): number | null {
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException('erpFornecedorId invalido.');
    }
    return parsed;
  }

  private async buildQuotedThread(
    garantiaId: number,
    defaults: { ourAddress?: string; toDefault?: string; ccDefault?: string },
  ) {
    const historicos = await this.prisma.historicoGarantia.findMany({
      where: {
        garantiaId,
        tipoInteracao: { in: ['Email Enviado', 'Resposta Enviada', 'Resposta Recebida'] },
      },
      orderBy: { dataOcorrencia: 'desc' },
      take: this.THREAD_LIMIT,
    });

    const htmlParts: string[] = [];
    const textParts: string[] = [];

    historicos.forEach((historico) => {
      const subject = historico.assunto ?? '(sem assunto)';
      const sentAt = this.formatDate(historico.dataOcorrencia);
      let from = '';
      let to = '';
      let cc = '';
      let bodyHtml = '';
      let bodyText = '';

      if (/Recebida/i.test(historico.tipoInteracao ?? '')) {
        const splitted = (historico.descricao ?? '').split(/<hr\s*\/?/i);
        bodyHtml = splitted.length > 1 ? splitted.slice(1).join('<hr>') : historico.descricao ?? '';
        bodyText = bodyHtml.replace(/<[^>]+>/g, '').trim();
        from = this.extractSender(historico.descricao) ?? 'Desconhecido';
        to = defaults.ourAddress ?? '';
      } else {
        const remetentePadrao = process.env.EMAIL_FROM_NAME
          ? `${process.env.EMAIL_FROM_NAME} <${defaults.ourAddress ?? process.env.EMAIL_FROM ?? ''}>`
          : (defaults.ourAddress ?? process.env.EMAIL_FROM ?? 'AC Acessorios');
        from = remetentePadrao;
        to = defaults.toDefault ?? '';
        cc = defaults.ccDefault ?? '';
        bodyHtml = (historico.descricao ?? '').replace(/\n/g, '<br>');
        bodyText = (historico.descricao ?? '').trim();
      }

      const headerHtml = `
        <p style="margin:0"><b>De:</b> ${from}</p>
        <p style="margin:0"><b>Enviada em:</b> ${sentAt}</p>
        ${to ? `<p style="margin:0"><b>Para:</b> ${to}</p>` : ''}
        ${cc ? `<p style="margin:0"><b>Cc:</b> ${cc}</p>` : ''}
        <p style="margin:0"><b>Assunto:</b> ${subject}</p>
      `;

      htmlParts.push(`
        <div style="border-left:2px solid #ccc; margin:12px 0; padding-left:12px; color:#444">
          ${headerHtml}
          <hr style="border:none; border-top:1px solid #ddd; margin:8px 0">
          ${bodyHtml}
        </div>
      `);

      const headerTextLines = [
        `De: ${from}`,
        `Enviada em: ${sentAt}`,
        ...(to ? [`Para: ${to}`] : []),
        ...(cc ? [`Cc: ${cc}`] : []),
        `Assunto: ${subject}`,
        '----------------------------------------',
      ];
      textParts.push(`${headerTextLines.join('\n')}\n${bodyText}`);
    });

    return {
      html: htmlParts.join('\n'),
      text: textParts.join('\n\n\n'),
    };
  }

  private formatDate(date: Date) {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date);
    } catch (error) {
      return date.toISOString();
    }
  }
}
