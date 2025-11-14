import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { OpenQueryService } from '../shared/database/openquery/openquery.service';

@Module({
  controllers: [ErpController],
  providers: [ErpService, OpenQueryService],
  exports: [ErpService],
})
export class ErpModule {}
