import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

export class AtualizarGarantiaDto {
  @IsString()
  descricao: string;

  @Expose({ name: 'tipo_interacao' })
  @IsOptional()
  @IsString()
  tipoInteracao?: string;

  @Expose({ name: 'enviar_email' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  enviarEmail?: boolean;

  @IsOptional()
  @IsString()
  destinatario?: string;

  @IsOptional()
  @IsString()
  copias?: string;

  @IsOptional()
  @IsString()
  cc?: string;
}