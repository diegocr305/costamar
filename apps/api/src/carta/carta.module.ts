import { Module } from '@nestjs/common';
import { CartaController } from './carta.controller';
import { CartaService } from './carta.service';

@Module({
  controllers: [CartaController],
  providers: [CartaService],
  exports: [CartaService],
})
export class CartaModule {}
