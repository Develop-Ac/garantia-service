import { Controller, Get } from '@nestjs/common';

@Controller()
export class StatusController {
  @Get('status')
  status() {
    return {
      status: 'ok',
      message: 'Servidor de Garantias em execucao!',
      timestamp: new Date().toISOString(),
    };
  }
}