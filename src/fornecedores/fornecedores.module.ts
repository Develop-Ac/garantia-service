import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multerS3 from 'multer-s3';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';
import { getMinioConnection } from '../storage/minio-config';
import { ErpModule } from '../erp/erp.module';

const createStorage = async () => {
  const { s3, prefix } = await getMinioConnection();

  return multerS3({
    s3,
    bucket: 'garantias',
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const safeName = file.originalname.trim().replace(/[\\/]+/g, '_');
      const key = `${prefix}${safeName}`;
      cb(null, key);
    },
  });
};

@Module({
  imports: [
    ErpModule,
    MulterModule.registerAsync({
      useFactory: async () => ({
        storage: await createStorage(),
        limits: { fileSize: 25 * 1024 * 1024 },
      }),
    }),
  ],
  controllers: [FornecedoresController],
  providers: [FornecedoresService],
})
export class FornecedoresModule {}