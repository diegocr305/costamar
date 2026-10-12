import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import type { CampaignProductRole, CampaignStatus } from '@costamar/shared';

export class CampaignProductDto {
  @IsUUID() productId!: string;
  @IsIn(['drink', 'dessert', 'gift']) role!: CampaignProductRole;
}

export class CampaignFieldsDto {
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagePath?: string | null;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) startsAt?: string | null;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) endsAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) maxCoupons?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(3650) validityDays?: number | null;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString() @MaxLength(200) benefit?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['draft', 'active', 'paused', 'closed']) status?: CampaignStatus;
  @ValidateIf((_o, v) => v !== undefined)
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CampaignProductDto)
  products?: CampaignProductDto[];
}

export class UpdateCampaignDto extends CampaignFieldsDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) name?: string;
}

export class CreateCampaignDto extends CampaignFieldsDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MinLength(3) @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}

export class CampaignProductsDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CampaignProductDto)
  products!: CampaignProductDto[];
}

export class CampaignCouponsQueryDto {
  @IsOptional() @IsIn(['issued', 'redeemed', 'expired', 'void']) status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
