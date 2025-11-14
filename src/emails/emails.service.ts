import { Injectable, NotFoundException } from '@nestjs/common';
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
}
