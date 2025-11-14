import { Logger, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import * as https from 'https';
import * as net from 'net';
import multerS3 from 'multer-s3';
import { GarantiasController } from './garantias.controller';
import { GarantiasService } from './garantias.service';
import { EmailModule } from '../email/email.module';

const logger = new Logger('GarantiasStorage');

const parseEndpointList = (): string[] => {
  const list = process.env.MINIO_ENDPOINTS ?? '';
  const candidates = list
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (candidates.length > 0) {
    return candidates;
  }
  const single = (process.env.MINIO_ENDPOINT ?? '').trim();
  if (single) {
    return [single];
  }
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
    logger.warn(`Falha ao conectar em ${endpoint}, tentando proximo...`);
  }
  throw new Error(`Nenhum endpoint Minio acessível (${endpoints.join(', ')})`);
};

const createStorage = async () => {
  const endpoints = parseEndpointList();
  const endpoint = await resolveEndpoint(endpoints);
  const bucket = process.env.MINIO_BUCKET ?? 'garantias';
  const prefixEnv = process.env.MINIO_PATH_PREFIX ?? '';
  const prefix = prefixEnv ? prefixEnv.replace(/^\//, '').replace(/([^/])$/, '$1/') : '';
  const allowInsecure = (process.env.MINIO_ALLOW_INSECURE_SSL ?? 'false').toLowerCase() === 'true';
  if (allowInsecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  const isHttpsEndpoint = endpoint.startsWith('https://');
  const httpsAgent = allowInsecure && isHttpsEndpoint ? new https.Agent({ rejectUnauthorized: false }) : undefined;

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

  return multerS3({
    s3,
    bucket,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const safeName = file.originalname.replace(/\s+/g, '-');
      const key = `${prefix}${Date.now()}-${safeName}`;
      cb(null, key);
    },
  });
};

@Module({
  imports: [
    EmailModule,
    MulterModule.registerAsync({
      useFactory: async () => ({
        storage: await createStorage(),
        limits: { fileSize: 25 * 1024 * 1024 },
      }),
    }),
  ],
  controllers: [GarantiasController],
  providers: [GarantiasService],
  exports: [GarantiasService],
})
export class GarantiasModule {}
