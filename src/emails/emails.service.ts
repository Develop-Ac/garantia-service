import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapAnexoEmailToPayload(anexo: {
    nomeFicheiro: string;
    pathFicheiro: string;
  }) {
    return {
      filename: anexo.nomeFicheiro,
      object_key: anexo.pathFicheiro,
      path_ficheiro: anexo.pathFicheiro,
      path: anexo.pathFicheiro,
      url: undefined,
    };
  }

  private async getAnexosPorEmailIds(emailIds: number[]) {
    if (!emailIds.length) {
      return new Map<number, Array<{ nomeFicheiro: string; pathFicheiro: string }>>();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        emailId: number;
        nomeFicheiro: string;
        pathFicheiro: string;
      }>
    >(Prisma.sql`
      SELECT
        "email_id" AS "emailId",
        "nome_ficheiro" AS "nomeFicheiro",
        "path_ficheiro" AS "pathFicheiro"
      FROM "gar_anexos_email"
      WHERE "email_id" IN (${Prisma.join(emailIds)})
      ORDER BY "id" ASC
    `);

    const byEmailId = new Map<number, Array<{ nomeFicheiro: string; pathFicheiro: string }>>();
    for (const row of rows) {
      const current = byEmailId.get(row.emailId) ?? [];
      current.push({ nomeFicheiro: row.nomeFicheiro, pathFicheiro: row.pathFicheiro });
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

    await this.prisma.emailCaixaEntrada.delete({ where: { id: emailId } });
    return { message: 'E-mail excluido com sucesso.' };
  }
}
