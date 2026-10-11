import { Module } from '@nestjs/common';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { ClubStaffController } from './staff.controller';
import { ClubStaffService } from './staff.service';

@Module({
  controllers: [ClubController, ClubStaffController],
  providers: [ClubService, ClubStaffService],
  exports: [ClubService],
})
export class ClubModule {}
