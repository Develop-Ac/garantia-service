import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { LinkEmailDto } from './dto/link-email.dto';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  listar() {
    return this.emailsService.listarCaixa();
  }

  @Put(':emailId/link')
  vincular(
    @Param('emailId', ParseIntPipe) emailId: number,
    @Body() dto: LinkEmailDto,
  ) {
    return this.emailsService.vincular(emailId, dto.garantiaId);
  }
}