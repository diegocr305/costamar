import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { RadarService } from "./radar.service";
import { RadarProfileDto, RadarQueryDto, RadarTrackingDto } from "./radar.dto";
@Controller("radar")
@Roles("superadmin", "admin")
export class RadarController {
  constructor(private readonly radar: RadarService) {}
  @Get("opportunities") list(@Query() dto: RadarQueryDto) {
    return this.radar.list(dto);
  }
  @Get("opportunities/:id") detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.radar.detail(id);
  }
  @Patch("opportunities/:id/tracking") tracking(
    @CurrentUser() u: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RadarTrackingDto,
  ) {
    return this.radar.tracking(u.userId, id, dto);
  }
  @Get("profiles") profiles() {
    return this.radar.profiles();
  }
  @Post("profiles") createProfile(@Body() dto: RadarProfileDto) {
    return this.radar.saveProfile(dto);
  }
  @Patch("profiles/:id") updateProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RadarProfileDto,
  ) {
    return this.radar.saveProfile(dto, id);
  }
  @Get("sync/status") status() {
    return this.radar.status();
  }
  @Post("sync") queue() {
    return this.radar.queue();
  }
  @Get("alerts") alerts() {
    return this.radar.alerts();
  }
  @Patch("alerts/:id/read") read(
    @CurrentUser() u: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.radar.readAlert(u.userId, id);
  }
  @Post("opportunities/:id/documents")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10485760, files: 1 } }),
  )
  upload(
    @CurrentUser() u: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
  ) {
    return this.radar.upload(u.userId, id, file);
  }
  @Get("opportunities/:id/documents/:documentId") document(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.radar.document(id, documentId);
  }
}
