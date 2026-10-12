import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  controllers: [UsersController, TeamController],
  providers: [UsersService, TeamService],
  exports: [UsersService],
})
export class UsersModule {}
