import { IsBoolean, IsOptional } from 'class-validator';

/** Actualización de preferencias de comunicaciones (marketing opcional). */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingWhatsapp?: boolean;
}
