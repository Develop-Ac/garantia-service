import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

export class AtualizarGarantiaDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  erpFornecedorId?: string;

  @IsOptional()
  @IsString()
  nomeFornecedor?: string;

  @IsOptional()
  @IsEmail()
  emailFornecedor?: string;

  @IsOptional()
  @IsString()
  produtos?: string;

  @IsOptional()
  @IsString()
  notaFiscal?: string;

  @IsOptional()
  @IsString()
  tipoGarantia?: string;

  @IsOptional()
  @IsString()
  nfsCompra?: string;

  @IsOptional()
  @IsString()
  protocoloFornecedor?: string;

  @IsOptional()
  @IsString()
  copiasEmail?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  outrosMeios?: boolean;

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