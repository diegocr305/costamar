import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { RADAR_STAGES } from "@costamar/shared";
export class RadarQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q = "";
  @IsOptional() @IsIn(["", "compra_agil", "licitacion"]) source = "";
  @IsOptional() @IsString() @MaxLength(40) status = "";
  @IsOptional() @IsIn(["", ...RADAR_STAGES]) stage = "";
  @IsOptional() @IsIn(["true", "false"]) favorite = "false";
  @IsOptional() @IsIn(["true", "false"]) closing = "false";
  @IsOptional() @IsUUID() profile?: string;
  @IsOptional() @IsString() @MaxLength(100) commune = "";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minBudget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxBudget?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}
export class RadarTrackingDto {
  @IsOptional() @IsIn(RADAR_STAGES) stage?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsISO8601({ strict: true }) verified_closes_at?: string;
  @IsOptional() @IsBoolean() clear_verified_close?: boolean;
  @IsString() @MinLength(1) @MaxLength(60) expected_updated_at!: string;
}
export class RadarProfileDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(16, { each: true })
  regions!: number[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  keywords!: string[];
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  exclude_keywords!: string[];
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  preferred_communes!: string[];
  @IsOptional() @IsNumber() @Min(0) min_budget: number | null = null;
  @IsOptional() @IsNumber() @Min(0) max_budget: number | null = null;
  @IsBoolean() include_unknown_budget!: boolean;
  @IsBoolean() include_licitaciones!: boolean;
}
