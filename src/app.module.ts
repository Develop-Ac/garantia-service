import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GarantiasModule } from './garantias/garantias.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { ErpModule } from './erp/erp.module';
import { StatusModule } from './status/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GarantiasModule,
    FornecedoresModule,
    ErpModule,
    StatusModule,
  ],
})
export class AppModule {}
