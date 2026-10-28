import {
  ApiTeamController,
  ApiTeamAddMembers,
  ApiTeamRemoveMember,
  ApiTeamTransferMember,
} from '../team.swagger';
import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { TeamMembersService } from '../services/team-members.service';
import { AddMembersDto, TransferMemberDto } from '../dto/team-actions.dto';
@ApiTeamController()
@Controller('team/:id')
@UseGuards(AuthGuard)
export class TeamMembersController {
  constructor(private readonly members: TeamMembersService) {}
  @ApiTeamAddMembers()
  @Post('members')
  add(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @Req() req: AuthRequest,
  ) {
    return this.members.add(id, dto.memberIds, req.session!.user.id);
  }

  @ApiTeamRemoveMember()
  @Delete('members/:userId')
  remove(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.members.remove(id, userId, req.session!.user.id);
  }

  @ApiTeamTransferMember()
  @Post('transfers')
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferMemberDto,
    @Req() req: AuthRequest,
  ) {
    return this.members.transfer(
      id,
      dto.userId,
      dto.teamId,
      req.session!.user.id,
    );
  }
}
