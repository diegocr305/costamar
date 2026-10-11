import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Alta / completar perfil del socio (V1 con cupones).
 * La identidad (user_id) NUNCA viene del body: se toma del JWT.
 * phone y birthDate son obligatorios; acceptTerms/acceptPrivacy deben ser true.
 * La validación de edad (>=18) se hace en el servicio (TZ America/Santiago).
 */
export class EnrollDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'Teléfono inválido' })
  phone!: string;

  @IsDateString(
    {},
    { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)' },
  )
  birthDate!: string;

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
