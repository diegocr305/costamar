import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Confirmación de canje por el personal. */
export class RedeemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code!: string;

  /** Productos entregados (referencias/nombres). Opcional. */
  @IsOptional()
  @IsArray()
  products?: unknown[];

  /** Referencia del consumo asociado (mesa, pedido o boleta). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  consumptionRef?: string;
}
