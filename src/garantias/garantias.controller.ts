import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { GarantiasService } from './garantias.service';
import { CriarGarantiaDto } from './dto/criar-garantia.dto';
import { AtualizarStatusGarantiaDto } from './dto/atualizar-status.dto';
import { AtualizarGarantiaDto } from './dto/atualizar-garantia.dto';
import { WebhookRespostaDto } from './dto/webhook-resposta.dto';

@Controller('garantias')
export class GarantiasController {
  constructor(private readonly garantiasService: GarantiasService) {}

  @Get()
  listar(): Promise<any> {
    return this.garantiasService.listarTodas();
  }

  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return this.garantiasService.obterPorId(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('anexos', 10))
  criar(@Body() dto: CriarGarantiaDto, @UploadedFiles() anexos: Express.Multer.File[] = []) {
    return this.garantiasService.criar(dto, anexos ?? []);
  }

  @Put(':id/status')
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarStatusGarantiaDto,
  ) {
    return this.garantiasService.atualizarStatus(id, dto);
  }

  @Post(':id/update')
  @UseInterceptors(FilesInterceptor('anexos', 10))
  registrarAtualizacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarGarantiaDto,
    @UploadedFiles() anexos: Express.Multer.File[] = [],
  ) {
    return this.garantiasService.registrarAtualizacao(id, dto, anexos ?? []);
  }

  @Post('email-reply')
  registrarWebhook(@Headers('x-n8n-secret') secret: string | undefined, @Body() dto: WebhookRespostaDto) {
    return this.garantiasService.registrarWebhook(secret, dto);
  }

  @Put(':id/marcar-como-visto')
  marcarComoVisto(@Param('id', ParseIntPipe) id: number) {
    return this.garantiasService.marcarComoVisto(id);
  }
}
