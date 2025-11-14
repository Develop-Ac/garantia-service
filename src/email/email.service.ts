import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SentMessageInfo, SendMailOptions } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT ?? 465),
    secure: Number(process.env.EMAIL_PORT ?? 0) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  });

  async send(options: SendMailOptions): Promise<SentMessageInfo> {
    const from = options.from ?? process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
    const response = await this.transporter.sendMail({ ...options, from });
    this.logger.log(`E-mail enviado: ${response.messageId}`);
    return response;
  }
}