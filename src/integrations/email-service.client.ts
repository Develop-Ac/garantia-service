import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface AddressInput {
  email: string;
  name?: string;
}

interface AttachmentInput {
  fileName: string;
  objectKey: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface OutboundRequest {
  accountId: number;
  threadId?: number;
  parentMessageId?: number;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  recipients: AddressInput[];
  cc?: AddressInput[];
  bcc?: AddressInput[];
  headers?: Record<string, string>;
  attachments?: AttachmentInput[];
}

interface OutboundResponse {
  outboundMessageId: number;
}

@Injectable()
export class EmailServiceClient {
  private readonly client: AxiosInstance;
  private readonly accountId: number;

  constructor(configService: ConfigService) {
    const baseURL = configService.get<string>('EMAIL_SERVICE_URL');
    if (!baseURL) {
      throw new ServiceUnavailableException('EMAIL_SERVICE_URL nao configurado.');
    }
    this.accountId = Number(configService.get<string>('EMAIL_SERVICE_DEFAULT_ACCOUNT_ID', '0'));

    if (!this.accountId || Number.isNaN(this.accountId)) {
      throw new ServiceUnavailableException('EMAIL_SERVICE_DEFAULT_ACCOUNT_ID nao configurado.');
    }

    this.client = axios.create({
      baseURL,
      timeout: Number(configService.get<string>('EMAIL_SERVICE_TIMEOUT_MS', '5000')),
    });
  }

  async enqueueOutbound(payload: Omit<OutboundRequest, 'accountId'>): Promise<OutboundResponse> {
    try {
      const response = await this.client.post<OutboundResponse>('/api/outbound', {
        accountId: this.accountId,
        ...payload,
      });

      return response.data;
    } catch (error) {
      throw new InternalServerErrorException('Falha ao enfileirar envio no email-service.');
    }
  }
}