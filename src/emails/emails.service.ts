import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getMinioConnection } from '../storage/minio-config';
import { normalizeStorageKey } from '../storage/storage-key.util';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async excluirAnexosNoMinio(paths: string[]) {
    if (!paths.length) return;

    const { s3, bucket, prefix } = await getMinioConnection();

    for (const path of paths) {
      const trimmed = String(path || '').trim();
      if (!trimmed) continue;

      const key = normalizeStorageKey(trimmed, bucket, prefix);
      if (!key) continue;

      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
      } catch {
        this.logger.warn(`Falha ao excluir anexo no Minio: ${key}`);
      }
    }
  }

  private mapAnexoEmailToPayload(anexo: {
    nomeFicheiro: string;
    pathFicheiro: string;
    contentId?: string | null;
  }) {
    return {
      filename: anexo.nomeFicheiro,
      object_key: anexo.pathFicheiro,
      path_ficheiro: anexo.pathFicheiro,
      path: anexo.pathFicheiro,
      contentId: anexo.contentId ?? null,
      url: undefined,
    };
  }

  private async getAnexosPorEmailIds(emailIds: number[]) {
    if (!emailIds.length) {
      return new Map<number, Array<{ nomeFicheiro: string; pathFicheiro: string; contentId: string | null }>>();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        emailId: number;
        nomeFicheiro: string;
        pathFicheiro: string;
        contentId: string | null;
      }>
    >(Prisma.sql`
      SELECT
        "email_id" AS "emailId",
        "nome_ficheiro" AS "nomeFicheiro",
        "path_ficheiro" AS "pathFicheiro",
        "content_id" AS "contentId"
      FROM "gar_anexos_email"
      WHERE "email_id" IN (${Prisma.join(emailIds)})
      ORDER BY "id" ASC
    `);

    const byEmailId = new Map<number, Array<{ nomeFicheiro: string; pathFicheiro: string; contentId: string | null }>>();
    for (const row of rows) {
      const current = byEmailId.get(row.emailId) ?? [];
      current.push({ nomeFicheiro: row.nomeFicheiro, pathFicheiro: row.pathFicheiro, contentId: row.contentId });
      byEmailId.set(row.emailId, current);
    }

    return byEmailId;
  }

  async listarCaixa() {
    const emails = await this.prisma.emailCaixaEntrada.findMany({
      orderBy: { dataRecebimento: 'desc' },
      include: {
        garantia: { select: { notaInterna: true } },
      },
    });

    const anexosByEmailId = await this.getAnexosPorEmailIds(emails.map((email) => email.id));

    return emails.map((email) => ({
      id: email.id,
      remetente: email.remetente,
      assunto: email.assunto,
      corpo_html: email.corpoHtml,
      data_recebimento: email.dataRecebimento,
      garantia_id: email.garantiaId,
      nota_interna: email.garantia?.notaInterna ?? null,
      message_id: email.messageId,
      attachments: (anexosByEmailId.get(email.id) ?? []).map((anexo) => this.mapAnexoEmailToPayload(anexo)),
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

      await tx.$executeRaw`
        UPDATE "gar_anexos_email"
        SET "garantia_id" = ${garantiaId}
        WHERE "email_id" = ${emailId}
      `;

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

    const anexos = await this.prisma.$queryRaw<Array<{ pathFicheiro: string | null }>>(Prisma.sql`
      SELECT "path_ficheiro" AS "pathFicheiro"
      FROM "gar_anexos_email"
      WHERE "email_id" = ${emailId}
    `);

    const paths = anexos
      .map((item) => item.pathFicheiro)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    try {
      await this.excluirAnexosNoMinio(paths);
    } catch {
      this.logger.warn(`Falha ao inicializar exclusao de anexos no Minio para email ${emailId}`);
    }

    await this.prisma.$executeRaw`
      DELETE FROM "gar_anexos_email"
      WHERE "email_id" = ${emailId}
    `;

    await this.prisma.emailCaixaEntrada.delete({ where: { id: emailId } });
    return { message: 'E-mail excluido com sucesso.' };
  }
}
