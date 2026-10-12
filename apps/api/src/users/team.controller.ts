import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ROLES } from '@costamar/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TeamService } from './team.service';

export class TeamAccessDto {
 @Transform(({value}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
 @IsEmail() @MaxLength(254) email!: string;
 @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
 @IsString() @MinLength(1) @MaxLength(120) fullName!: string;
 @IsBoolean() isActive!: boolean;
}

@Controller('team')
@Roles('superadmin')
export class TeamController {
 constructor(private readonly team: TeamService) {}
 @Get('access') @Roles(...ROLES)
 access(@CurrentUser() user: AuthenticatedUser) { return {role:user.role}; }
 @Get() list() { return this.team.list(); }
 @Post() save(@CurrentUser() user: AuthenticatedUser,@Body() dto: TeamAccessDto) { return this.team.save(user.userId,dto); }
}
