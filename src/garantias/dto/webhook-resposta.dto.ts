import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WebhookRespostaDto {
  @IsString()
  @IsNotEmpty()
  ni_number: string;

  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  email_body_html: string;

  @IsOptional()
  @IsString()
  message_id?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}