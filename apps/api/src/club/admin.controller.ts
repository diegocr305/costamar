import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ClubAdminService } from './admin.service';
import { CampaignCouponsQueryDto, CampaignProductsDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { RedemptionHistoryDto } from './dto/redemption-history.dto';
import { ClubStaffService } from './staff.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SegmentDto } from './dto/segment.dto';
import { BadRequestException } from '@nestjs/common';

@Controller('club/admin')
@Roles('superadmin', 'admin', 'manager')
export class ClubAdminController {
  constructor(private readonly admin: ClubAdminService, private readonly staff: ClubStaffService, private readonly supabase:SupabaseService) {}
  @Get('overview') @Roles('superadmin','admin')
  overview(@CurrentUser() user:AuthenticatedUser){return this.admin.overview(user.userId);}
  @Get('members') @Roles('superadmin','admin')
  async members(@Query() dto:SegmentDto) {
    const {data,error}=await this.supabase.client.rpc('club_segment_members_survey',{p_birthday:dto.birthday==='true',p_food:dto.food??'',p_visit:dto.visit??'',p_commune:dto.commune??'',p_channel:dto.channel??'all',p_q:dto.q??'',p_page:dto.page,p_survey_status:dto.surveyStatus??''});
    if(error) throw new BadRequestException('No pudimos cargar los socios.');
    return data;
  }
  @Get('campaigns') campaigns() { return this.admin.listCampaigns(); }
  @Get('stats') stats() { return this.admin.listCampaigns(); }
  @Post('campaigns') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) { return this.admin.saveCampaign(user.userId, null, dto); }
  @Patch('campaigns/:id') update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto) { return this.admin.saveCampaign(user.userId, id, dto); }
  @Get('campaigns/:id/products') products(@Param('id', ParseUUIDPipe) id: string) { return this.admin.products(id); }
  @Put('campaigns/:id/products') setProducts(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignProductsDto) { return this.admin.saveCampaign(user.userId, id, dto); }
  @Get('campaigns/:id/coupons') coupons(@Param('id', ParseUUIDPipe) id: string, @Query() filters: CampaignCouponsQueryDto) { return this.admin.coupons(id, filters); }
  @Get('redemptions') history(@Query() filters: RedemptionHistoryDto) { return this.staff.redemptionHistory(filters); }
}
