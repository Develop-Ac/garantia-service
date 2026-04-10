import { IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpsertFornecedorConfigDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  erp_fornecedor_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsIn(['portal', 'formulario', 'email', 'whatsapp'])
  processo_tipo!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  portal_link?: string;

  @IsOptional()
  @IsString()
  formulario_path?: string;

  @IsOptional()
  @IsString()
  nome_formulario?: string;

  @IsOptional()
  @IsString()
  instrucoes?: string;
}
