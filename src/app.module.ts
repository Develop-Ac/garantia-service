import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GarantiasModule } from './garantias/garantias.module';
import { EmailsModule } from './emails/emails.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { ErpModule } from './erp/erp.module';
import { StatusModule } from './status/status.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    GarantiasModule,
    EmailsModule,
    FornecedoresModule,
    ErpModule,
    StatusModule,
  ],
})
export class AppModule {}
