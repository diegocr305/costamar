import { Type } from 'class-transformer';
import { IsIn, ValidateIf, ValidateNested, IsDefined } from 'class-validator';
import { UpdatePreferencesDto } from './preferences.dto';
export class SurveyDto {
 @IsIn(['viewed','skipped','responded']) action!: 'viewed'|'skipped'|'responded';
 @ValidateIf(o=>o.action==='responded'||o.preferences!==undefined)
 @IsDefined() @ValidateNested() @Type(()=>UpdatePreferencesDto) preferences?:UpdatePreferencesDto;
}
