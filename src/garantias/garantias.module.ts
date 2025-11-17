import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multerS3 from 'multer-s3';
import { GarantiasController } from './garantias.controller';
import { GarantiasService } from './garantias.service';
import { EmailModule } from '../email/email.module';
import { getMinioConnection } from '../storage/minio-config';

const createStorage = async () => {
  const { s3, bucket, prefix } = await getMinioConnection();

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
