import { Controller, Get, Param } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Get('config/:erpId')
  buscarConfiguracao(@Param('erpId') erpId: string) {
    return this.fornecedoresService.buscarConfiguracao(erpId);
  }
}