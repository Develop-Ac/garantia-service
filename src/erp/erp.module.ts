import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { OpenQueryService } from '../shared/database/openquery/openquery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [ErpController],
  providers: [ErpService, OpenQueryService, PrismaService],
  exports: [ErpService],
})
export class ErpModule {}
