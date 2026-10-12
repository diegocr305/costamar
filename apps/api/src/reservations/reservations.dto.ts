import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsBoolean,IsDateString,IsEmpty,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min,MinLength,ValidateNested,ValidateIf } from 'class-validator';
import type { ReservationStatus } from '@costamar/shared';
export class CreateBookingDto {
 @IsUUID() requestId!:string;
 @Matches(/^[a-f0-9]{64}$/) accessToken!:string;
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(120) customerName!:string;
 @Matches(/^\+569[0-9]{8}$/) customerPhone!:string;
 @IsInt() @Min(1) @Max(100) partySize!:number;
 @IsDateString({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) reservedAt!:string;
 @IsOptional() @IsIn(['any','salon','terraza','barra']) areaPreference?:string;
 @IsOptional() @IsString() @MaxLength(500) notes?:string;
 @IsOptional() @IsEmpty() website?:string;
}
export class BookingAccessDto {@IsUUID() id!:string;@Matches(/^[a-f0-9]{64}$/) accessToken!:string;}
export class UpdateBookingDto {
 @ValidateIf((_o,v)=>v!==undefined) @IsIn(['pending','confirmed','seated','completed','cancelled','no_show']) status?:ReservationStatus;
 @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(1) @Max(100) partySize?:number;
 @ValidateIf((_o,v)=>v!==undefined) @IsDateString({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) reservedAt?:string;
 @ValidateIf((_o,v)=>v!==undefined) @IsArray() @ArrayUnique() @ArrayMaxSize(19) @IsInt({each:true}) @Min(1,{each:true}) @Max(32,{each:true}) tableNumbers?:number[];
 @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(1) @Max(100) confirmedCapacity?:number;
 @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(500) staffNote?:string;
}
export class BookingQueryDto {
 @IsOptional() @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?:string;
 @IsOptional() @IsIn(['','pending','confirmed','seated','completed','cancelled','no_show']) status?:string;
 @IsOptional() @IsString() @MaxLength(100) q?:string;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page=1;
}
class HoursDto {@IsInt() @Min(0) @Max(6) day!:number;@Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/) opens!:string;@Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/) closes!:string;@IsBoolean() isOpen!:boolean;}
class TableDto {@IsInt() @Min(1) @Max(32) number!:number;@IsOptional() @IsIn(['salon','terraza','barra']) area?:string;@IsInt() @Min(1) @Max(20) comfortable!:number;@IsInt() @Min(1) @Max(20) maximum!:number;}
class PairDto {@IsInt() a!:number;@IsInt() b!:number;@IsOptional() @IsInt() @Min(1) @Max(40) capacity!:number|null;@IsOptional() @IsBoolean() enabled?:boolean;}
export class BookingConfigDto {
 @IsInt() @Min(30) @Max(240) durationSmall!:number;
 @IsInt() @Min(30) @Max(360) durationLarge!:number;
 @IsInt() @Min(0) @Max(60) bufferMinutes!:number;
 @IsInt() @Min(0) @Max(60) toleranceMinutes!:number;
 @IsInt() @Min(0) @Max(1440) advanceMinutes!:number;
 @IsArray() @ArrayMinSize(7) @ArrayMaxSize(7) @ArrayUnique((h:HoursDto)=>h.day) @ValidateNested({each:true}) @Type(()=>HoursDto) hours!:HoursDto[];
 @IsArray() @ArrayMinSize(26) @ArrayMaxSize(26) @ArrayUnique((t:TableDto)=>t.number) @ValidateNested({each:true}) @Type(()=>TableDto) tables!:TableDto[];
 @IsArray() @ArrayMaxSize(12) @ArrayMinSize(12) @ArrayUnique((p:PairDto)=>p.a+'-'+p.b) @ValidateNested({each:true}) @Type(()=>PairDto) pairs!:PairDto[];
}
