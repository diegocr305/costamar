import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class ReminderHistoryDto {
  @IsOptional() @IsIn(['email', 'whatsapp']) channel?: string;
  @IsOptional() @IsIn(['pending', 'sent', 'failed', 'skipped']) status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}export class MemberEmailHistoryDto {
  @IsOptional() @IsIn(['birthday', 'welcome']) kind?: string;
  @IsOptional() @IsIn(['pending', 'sent', 'failed', 'skipped']) status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}