import { Module } from '@nestjs/common';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { ClubStaffController } from './staff.controller';
import { ClubStaffService } from './staff.service';
import { ClubAdminController } from './admin.controller';
import { ClubAdminService } from './admin.service';

@Module({
  controllers: [ClubController, ClubStaffController, ClubAdminController],
  providers: [ClubService, ClubStaffService, ClubAdminService],
  exports: [ClubService],
})
export class ClubModule {}
