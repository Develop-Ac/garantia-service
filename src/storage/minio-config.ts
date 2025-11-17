import { Logger } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import * as https from 'https';
import * as net from 'net';

const logger = new Logger('MinioConfig');

const parseEndpointList = (): string[] => {
  const list = process.env.MINIO_ENDPOINTS ?? '';
  const candidates = list
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (candidates.length > 0) return candidates;
  const single = (process.env.MINIO_ENDPOINT ?? '').trim();
  if (single) return [single];
  return ['http://127.0.0.1:9000'];
};

const canReachEndpoint = (endpoint: string, timeoutMs = 2000): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const url = new URL(endpoint);
      const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
      const socket = net.createConnection({ host: url.hostname, port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
};

const resolveEndpoint = async (endpoints: string[]): Promise<string> => {
  for (const endpoint of endpoints) {
    if (await canReachEndpoint(endpoint)) {
      if (endpoints.length > 1) {
        logger.log(`Selecionado endpoint Minio: ${endpoint}`);
      }
      return endpoint;
    }
    logger.warn(`Falha ao conectar em ${endpoint}, tentando próximo...`);
  }
  throw new Error(`Nenhum endpoint Minio acessível (${endpoints.join(', ')})`);
};

const normalizePrefix = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\//, '').replace(/([^/])$/, '$1/');
};

export interface MinioConnection {
  s3: S3Client;
  bucket: string;
  prefix: string;
  endpoint: string;
}

let cachedConnection: Promise<MinioConnection> | null = null;

export const getMinioConnection = async (): Promise<MinioConnection> => {
  if (cachedConnection) return cachedConnection;

  cachedConnection = (async () => {
    const endpoints = parseEndpointList();
    const endpoint = await resolveEndpoint(endpoints);
    const bucket = process.env.MINIO_BUCKET ?? 'garantias';
    const prefix = normalizePrefix(process.env.MINIO_PATH_PREFIX);
    const allowInsecure = (process.env.MINIO_ALLOW_INSECURE_SSL ?? 'false').toLowerCase() === 'true';

    if (allowInsecure && endpoint.startsWith('https://')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const isHttpsEndpoint = endpoint.startsWith('https://');
    const httpsAgent =
      allowInsecure && isHttpsEndpoint ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    const s3 = new S3Client({
      region: process.env.MINIO_REGION ?? 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER ?? '',
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? '',
      },
      ...(httpsAgent
        ? {
            requestHandler: new NodeHttpHandler({
              httpsAgent,
            }),
          }
        : {}),
    });

    return { s3, bucket, prefix, endpoint };
  })();

  return cachedConnection;
};
