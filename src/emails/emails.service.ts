import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async listarCaixa() {
    const emails = await this.prisma.emailCaixaEntrada.findMany({
      orderBy: { dataRecebimento: 'desc' },
      include: {
        garantia: { select: { notaInterna: true } },
      },
    });

    return emails.map((email) => ({
      id: email.id,
      remetente: email.remetente,
      assunto: email.assunto,
      corpo_html: email.corpoHtml,
      data_recebimento: email.dataRecebimento,
      garantia_id: email.garantiaId,
      nota_interna: email.garantia?.notaInterna ?? null,
      message_id: email.messageId,
      attachments: this.normalizeAttachments(email.attachments),
      to_list: email.toList ?? [],
      cc_list: email.ccList ?? [],
      bcc_list: email.bccList ?? [],
    }));
  }

  async vincular(emailId: number, garantiaId: number) {
    return this.prisma.$transaction(async (tx) => {
      const email = await tx.emailCaixaEntrada.findUnique({ where: { id: emailId } });
      if (!email) {
        throw new NotFoundException('E-mail nao encontrado.');
      }

      await tx.emailCaixaEntrada.update({
        where: { id: emailId },
        data: { garantiaId },
      });

      await this.vincularAnexosEmailNaGarantia(tx, email.attachments, garantiaId);

      await tx.historicoGarantia.create({
        data: {
          garantiaId,
          descricao: `<b>De:</b> ${email.remetente}<br><hr>${email.corpoHtml ?? ''}`,
          tipoInteracao: 'Resposta Recebida',
          foiVisto: false,
          messageId: email.messageId,
          assunto: email.assunto,
        },
      });

      await tx.garantia.update({
        where: { id: garantiaId },
        data: { temNovaInteracao: true },
      });

      return { message: 'E-mail vinculado com sucesso!' };
    });
  }

  private normalizeAttachments(raw: Prisma.JsonValue | null | undefined) {
    if (!raw) return [];

    const source = typeof raw === 'string' ? this.tryParseJson(raw) : raw;
    if (!Array.isArray(source)) return [];

    return source
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const cast = item as Record<string, unknown>;

        const filename = this.toNonEmptyString(
          cast.filename,
          cast.nome_ficheiro,
          cast.nome,
          cast.name,
        );

        const objectKey = this.toNonEmptyString(
          cast.object_key,
          cast.objectKey,
          cast.path_ficheiro,
          cast.path,
          cast.caminho,
        );

        const url = this.toNonEmptyString(cast.url, cast.link);
        const mimeType = this.toNonEmptyString(cast.mime_type, cast.mimeType, cast.type);
        const sizeBytes = this.toNumber(cast.size_bytes, cast.sizeBytes, cast.size);
        const contentId = this.toNonEmptyString(cast.content_id, cast.contentId, cast['content-id']);

        return {
          filename: filename ?? 'Anexo',
          object_key: objectKey,
          path_ficheiro: objectKey,
          url,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          content_id: contentId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  private async vincularAnexosEmailNaGarantia(
    tx: Prisma.TransactionClient,
    rawAttachments: Prisma.JsonValue | null | undefined,
    garantiaId: number,
  ) {
    const parsed = this.normalizeAttachments(rawAttachments);
    if (!parsed.length) return;

    const entries = parsed
      .map((attachment) => ({
        nome: this.toNonEmptyString(attachment.filename) ?? 'Anexo',
        path: this.toNonEmptyString(attachment.object_key, attachment.path_ficheiro, attachment.url),
      }))
      .filter((item): item is { nome: string; path: string } => Boolean(item.path));

    if (!entries.length) return;

    const uniqueByPath = new Map<string, { nome: string; path: string }>();
    for (const entry of entries) {
      if (!uniqueByPath.has(entry.path)) {
        uniqueByPath.set(entry.path, entry);
      }
    }

    const uniqueEntries = Array.from(uniqueByPath.values());
    const existing = await tx.anexoGarantia.findMany({
      where: {
        garantiaId,
        pathFicheiro: { in: uniqueEntries.map((entry) => entry.path) },
      },
      select: { pathFicheiro: true },
    });

    const existingPaths = new Set(existing.map((item) => item.pathFicheiro));
    const toCreate = uniqueEntries
      .filter((entry) => !existingPaths.has(entry.path))
      .map((entry) => ({
        garantiaId,
        nomeFicheiro: entry.nome,
        pathFicheiro: entry.path,
      }));

    if (!toCreate.length) return;

    await tx.anexoGarantia.createMany({ data: toCreate });
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value) as Prisma.JsonValue;
    } catch {
      return null;
    }
  }

  private toNonEmptyString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private toNumber(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  }

  async excluirSemVinculo(emailId: number) {
    const email = await this.prisma.emailCaixaEntrada.findUnique({
      where: { id: emailId },
      select: { id: true, garantiaId: true },
    });

    if (!email) {
      throw new NotFoundException('E-mail nao encontrado.');
    }

    if (email.garantiaId) {
      throw new ConflictException('Nao e permitido excluir e-mail vinculado a garantia.');
    }

    await this.prisma.emailCaixaEntrada.delete({ where: { id: emailId } });
    return { message: 'E-mail excluido com sucesso.' };
  }
}
