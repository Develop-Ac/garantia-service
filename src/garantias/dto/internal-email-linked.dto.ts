import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InternalEmailLinkedDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  @IsString()
  internetMessageId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsString()
  @IsNotEmpty()
  linkMode!: 'AUTO' | 'MANUAL' | 'INHERITED';

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}