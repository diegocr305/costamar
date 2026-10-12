import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class SegmentDto {
 @IsOptional() @IsIn(['true','false']) birthday?: string;
 @IsOptional() @IsIn(['','seafood','hot_dishes','drinks','desserts']) food?: string;
 @IsOptional() @IsIn(['','family','couple','friends','alone','prefer_not_to_say']) visit?: string;
 @IsOptional() @IsString() @MaxLength(80) commune?: string;
 @IsOptional() @IsIn(['all','any','email','whatsapp']) channel?: string;
 @IsOptional() @IsString() @MaxLength(100) q?: string;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page=1;
}
