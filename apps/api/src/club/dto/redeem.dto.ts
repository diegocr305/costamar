import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignProductDto } from './campaign.dto';

/** Confirmación de canje por el personal. */
export class RedeemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code!: string;

  /** Productos entregados (referencias/nombres). Opcional. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CampaignProductDto)
  products?: CampaignProductDto[];

  /** Referencia del consumo asociado (mesa, pedido o boleta). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  consumptionRef?: string;
}
