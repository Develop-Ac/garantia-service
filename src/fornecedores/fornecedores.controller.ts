import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { FornecedoresService } from './fornecedores.service';
import { UpsertFornecedorConfigDto } from './dto/upsert-fornecedor-config.dto';
import { CopyFornecedorConfigDto } from './dto/copy-fornecedor-config.dto';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Get('config')
  listarConfiguracoes() {
    return this.fornecedoresService.listarConfiguracoes();
  }

  @Get('config/:erpId')
  buscarConfiguracao(@Param('erpId') erpId: string) {
    return this.fornecedoresService.buscarConfiguracao(erpId);
  }

  @Post('config')
  @UseInterceptors(FileInterceptor('formulario'))
  criarConfiguracao(
    @Body() dto: UpsertFornecedorConfigDto,
    @UploadedFile() formulario?: Express.Multer.File,
  ) {
    return this.fornecedoresService.criarConfiguracao(dto, formulario);
  }

  @Patch('config/:id')
  @UseInterceptors(FileInterceptor('formulario'))
  atualizarConfiguracao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFornecedorConfigDto,
    @UploadedFile() formulario?: Express.Multer.File,
  ) {
    return this.fornecedoresService.atualizarConfiguracao(id, dto, formulario);
  }

  @Post('config/:id/copy')
  copiarConfiguracao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CopyFornecedorConfigDto,
  ) {
    return this.fornecedoresService.copiarConfiguracao(id, dto);
  }
}