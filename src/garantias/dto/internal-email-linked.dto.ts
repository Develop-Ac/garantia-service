import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class InternalEmailAttachmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  emailAttachmentId?: number;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsBoolean()
  isInline?: boolean;

  @IsOptional()
  @IsString()
  storageBucket?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;
}

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  emailServiceMessageId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  emailServiceThreadId?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InternalEmailAttachmentDto)
  @IsArray()
  attachments?: InternalEmailAttachmentDto[];
}