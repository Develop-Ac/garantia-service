import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class InternalValidarVinculoDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsOptional()
  @IsString()
  messageId?: string | null;

  @IsOptional()
  @IsNumber()
  threadId?: number | null;

  @IsString()
  @IsNotEmpty()
  linkMode!: 'AUTO' | 'MANUAL' | 'INHERITED';

  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @IsNumber()
  confidenceScore!: number;

  @IsOptional()
  @IsString()
  matchedValue?: string | null;
}