import { Module } from "@nestjs/common";
import { RadarController } from "./radar.controller";
import { RadarService } from "./radar.service";
import { MercadoPublicoClient } from "./mercado-publico.client";
import { RadarGeneralService } from "./radar.general";
@Module({
  controllers: [RadarController],
  providers: [RadarService, MercadoPublicoClient, RadarGeneralService],
})
export class RadarModule {}
