import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CopyFornecedorConfigDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  novo_erp_fornecedor_id!: number;
}
