import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

const toBoolean = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return false;
};

export class CriarGarantiaDto {
  @IsString()
  @IsNotEmpty()
  erpFornecedorId: string;

  @IsString()
  @IsNotEmpty()
  nomeFornecedor: string;

  @IsOptional()
  @IsEmail()
  emailFornecedor?: string;

  @IsString()
  @IsNotEmpty()
  produtos: string;

  @IsString()
  @IsNotEmpty()
  notaFiscal: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsString()
  @IsNotEmpty()
  tipoGarantia: string;

  @IsOptional()
  @IsString()
  nfsCompra?: string;

  @IsOptional()
  @IsString()
  copiasEmail?: string;

  @IsOptional()
  @IsString()
  protocoloFornecedor?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  outrosMeios?: boolean = false;
}
