import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { GarantiasService } from './garantias.service';
import { InternalValidarVinculoDto } from './dto/internal-validar-vinculo.dto';
import { InternalEmailLinkedDto } from './dto/internal-email-linked.dto';

@Controller('internal/garantias')
export class GarantiasInternalController {
  constructor(private readonly garantiasService: GarantiasService) {}

  @Get(':id')
  obterPorIdInterno(@Param('id', ParseIntPipe) id: number) {
    return this.garantiasService.obterResumoInterno(id);
  }

  @Get('by-codigo/:codigo')
  buscarPorCodigoInterno(@Param('codigo') codigo: string) {
    return this.garantiasService.buscarPorCodigoInterno(codigo);
  }

  @Post(':id/validar-vinculo-email')
  validarVinculoInterno(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InternalValidarVinculoDto,
  ) {
    return this.garantiasService.validarVinculoEmailInterno(id, dto);
  }

  @Post(':id/timeline/email-linked')
  registrarTimelineEmailInterno(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InternalEmailLinkedDto,
  ) {
    return this.garantiasService.registrarTimelineEmailInterno(id, dto);
  }
}