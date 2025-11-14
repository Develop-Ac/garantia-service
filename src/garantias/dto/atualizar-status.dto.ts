import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

const toNumber = ({ value }: { value: any }) => {
  if (value === null || value === undefined || value === '') return undefined;
  return Number(value);
};

export class AbatimentoDto {
  @IsOptional()
  @IsString()
  nf?: string;

  @IsOptional()
  @IsString()
  parcela?: string;

  @IsOptional()
  @IsDateString()
  vencimento?: string;

  @IsNumber()
  @Transform(toNumber)
  valor: number;
}

export class AtualizarStatusGarantiaDto {
  @Expose({ name: 'novo_status' })
  @IsOptional()
  @IsInt()
  @Transform(toNumber)
  novoStatus?: number;

  @Expose({ name: 'precisa_nota_fiscal' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  precisaNotaFiscal?: boolean;

  @Expose({ name: 'frete_por_conta_de' })
  @IsOptional()
  @IsString()
  fretePorContaDe?: string;

  @IsOptional()
  @IsString()
  cfop?: string;

  @Expose({ name: 'transportadora_razao_social' })
  @IsOptional()
  @IsString()
  transportadoraRazaoSocial?: string;

  @Expose({ name: 'transportadora_cnpj' })
  @IsOptional()
  @IsString()
  transportadoraCnpj?: string;

  @Expose({ name: 'transportadora_endereco' })
  @IsOptional()
  @IsString()
  transportadoraEndereco?: string;

  @Expose({ name: 'transportadora_cidade' })
  @IsOptional()
  @IsString()
  transportadoraCidade?: string;

  @Expose({ name: 'transportadora_uf' })
  @IsOptional()
  @IsString()
  transportadoraUf?: string;

  @Expose({ name: 'transportadora_ie' })
  @IsOptional()
  @IsString()
  transportadoraIe?: string;

  @Expose({ name: 'codigo_coleta_envio' })
  @IsOptional()
  @IsString()
  codigoColetaEnvio?: string;

  @IsOptional()
  @IsString()
  obs?: string;

  @Expose({ name: 'numero_nf_devolucao' })
  @IsOptional()
  @IsString()
  numeroNfDevolucao?: string;

  @Expose({ name: 'data_coleta_envio' })
  @IsOptional()
  @IsDateString()
  dataColetaEnvio?: string;

  @Expose({ name: 'valor_credito_total' })
  @IsOptional()
  @IsNumber()
  @Transform(toNumber)
  valorCreditoTotal?: number;

  @Expose({ name: 'valor_credito_utilizado' })
  @IsOptional()
  @IsNumber()
  @Transform(toNumber)
  valorCreditoUtilizado?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbatimentoDto)
  abatimentos?: AbatimentoDto[];
}
