import { Expose } from 'class-transformer';
import { IsInt } from 'class-validator';

export class LinkEmailDto {
  @Expose({ name: 'garantia_id' })
  @IsInt()
  garantiaId: number;
}