import {
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiTeamController } from '../team.swagger';
import {
  ApiWriteErrors,
  ApiNotFoundError,
  ApiConflictError,
} from '../../common/swagger/api-response.decorator';
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
@ApiWriteErrors()
@ApiNotFoundError('not_found')
@ApiConflictError()
@Controller('team/:id')
@UseGuards(AuthGuard)
export class TeamMembersController {
  constructor(private readonly members: TeamMembersService) {}
  @ApiOperation({ summary: 'Ajouter des utilisateurs sans équipe' })
  @ApiCreatedResponse()
  @Post('members')
  add(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @Req() req: AuthRequest,
  ) {
    return this.members.add(id, dto.memberIds, req.session!.user.id);
  }

  @ApiOperation({ summary: 'Retirer un membre' })
  @ApiOkResponse()
  @Delete('members/:userId')
  remove(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.members.remove(id, userId, req.session!.user.id);
  }

  @ApiOperation({ summary: 'Transférer un membre depuis une équipe explicite' })
  @ApiCreatedResponse()
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
