import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ROLES, type UserRole } from '@costamar/shared';

export class CreateUserDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  fullName!: string;

  // Solo roles válidos; rechaza con 400 cualquier valor fuera del conjunto.
  @IsIn(ROLES, { message: `El rol debe ser uno de: ${ROLES.join(', ')}` })
  role!: UserRole;

  @IsOptional()
  @IsString()
  phone?: string;
}
