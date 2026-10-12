import "reflect-metadata";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SupabaseModule } from "../supabase/supabase.module";
import { MercadoPublicoClient } from "./mercado-publico.client";
import { RadarSync } from "./radar.sync";
import { RadarEmailService } from "./radar.email";
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
    SupabaseModule,
  ],
  providers: [MercadoPublicoClient, RadarEmailService, RadarSync],
})
class RadarWorkerModule {}
async function main() {
  const app = await NestFactory.createApplicationContext(RadarWorkerModule);
  app.enableShutdownHooks();
  const sync = app.get(RadarSync);
  let stopping = false;
  const timer = setInterval(() => {
    if (!stopping) void sync.tick();
  }, 30000);
  const stop = () => {
    stopping = true;
    clearInterval(timer);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  await sync.tick();
}
void main().catch(() => {
  console.error(
    "[Radar] No se pudo iniciar el worker. Revisa la configuración.",
  );
  process.exitCode = 1;
});
