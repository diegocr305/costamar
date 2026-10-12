import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Actualización de preferencias de comunicaciones (marketing opcional). */
export class UpdatePreferencesDto {
  @ValidateIf((_o,v) => v !== undefined) @IsString() @MaxLength(80) commune?: string;
  @ValidateIf((_o,v) => v !== undefined) @IsArray() @ArrayMaxSize(4) @ArrayUnique()
  @IsIn(['seafood','hot_dishes','drinks','desserts'], {each:true}) foodPreferences?: string[];
  @ValidateIf((_o,v) => v !== undefined) @IsIn(['','family','couple','friends','alone','not_visited','prefer_not_to_say']) visitType?: string;
  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingWhatsapp?: boolean;
}
