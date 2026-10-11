import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Alta / completar perfil del socio.
 * La identidad (user_id) NUNCA viene del body: se toma del JWT.
 * acceptTerms y acceptPrivacy son obligatorios (deben ser true).
 * El marketing es opcional e independiente.
 */
export class EnrollDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'Teléfono inválido' })
  phone?: string;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptPrivacy!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingWhatsapp?: boolean;
}
