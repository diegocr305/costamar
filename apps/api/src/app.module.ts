import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { CartaModule } from './carta/carta.module';
import { ClubModule } from './club/club.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    HealthModule,
    CartaModule,
    ClubModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Autenticación global: toda ruta exige JWT salvo @PublicRoute()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Autorización por rol global: respeta @Roles()
    { provide: APP_GUARD, useClass: RolesGuard },
    // Formato de error estándar
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Logging estructurado de solicitudes
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
