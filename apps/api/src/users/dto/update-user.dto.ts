import { IsIn, IsOptional, IsString } from 'class-validator';
import { ROLES, type UserRole } from '@costamar/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(ROLES, { message: `El rol debe ser uno de: ${ROLES.join(', ')}` })
  role?: UserRole;
}
