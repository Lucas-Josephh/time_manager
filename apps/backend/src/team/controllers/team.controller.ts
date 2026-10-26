import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiWriteErrors, ApiNotFoundError, ApiConflictError } from '../../common/swagger/api-response.decorator';
import { AvailableUsersQueryDto, SetManagerDto } from '../dto/team-actions.dto';
import {
  ApiTeamController,
  ApiTeamCreate,
  ApiTeamUpdate,
  ApiTeamDelete,
  ApiTeamFindAll,
  ApiTeamFindAvailableUsers,
  ApiTeamFindOne,
} from '../team.swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from '../services/team.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { UserSummaryDto } from '../../user/dto/user.dto';
import {
  PartialSetTeamDto,
  QuerySetTeamDto,
  SetTeamDto,
  TeamDetailsDto,
  TeamListDto,
  TeamWithRelationsDto,
} from '../dto/team.dto';
import { ResponseMessage } from '../../common/decorator/response-message.decorator';
import { SerializeResponse } from '../../common/serialization/serialize-response.decorator';

@ApiTeamController()
@Controller('team')
@UseGuards(AuthGuard)
@SerializeResponse(TeamDetailsDto)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ResponseMessage('team_created')
  @ApiTeamCreate()
  @SerializeResponse(TeamWithRelationsDto)
  @Post()
  create(@Body() dto: SetTeamDto, @Req() request: AuthRequest) {
    return this.teamService.create(dto, request.session!.user.id);
  }

  @ResponseMessage('team_partially_updated')
  @ApiTeamUpdate()
  @SerializeResponse(TeamWithRelationsDto)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: PartialSetTeamDto,
    @Req() request: AuthRequest,
  ) {
    return this.teamService.update(id, dto, request.session!.user.id);
  }

  @ResponseMessage('team_deleted')
  @ApiTeamDelete()
  @Delete(':id')
  delete(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.teamService.delete(id, request.session!.user.id);
  }

  @ResponseMessage('team_listed')
  @ApiTeamFindAll()
  @SerializeResponse(TeamListDto)
  @Get()
  findAll(@Query() query: QuerySetTeamDto, @Req() request: AuthRequest) {
    return this.teamService.findAll(query, request.session!.user.id);
  }

  @SerializeResponse(UserSummaryDto)
  @ResponseMessage('team_available_users_listed')
  @ApiTeamFindAvailableUsers()
  @Get('available-users')
  findAvailableUsers(
    @Req() request: AuthRequest,
    @Query() query: AvailableUsersQueryDto,
  ) {
    return this.teamService.findAvailableUsers(request.session!.user.id, query);
  }

  @ApiTeamFindOne()
  @SerializeResponse(TeamWithRelationsDto)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.teamService.findOne(id, request.session!.user.id);
  }

  @SerializeResponse(TeamWithRelationsDto)
  @ApiOperation({ summary: 'Nommer ou retirer le manager', description: 'Admin ou manager d’organisation requis. Un membre de cette équipe doit être retiré explicitement avant sa nomination.' })
  @ApiOkResponse({ type: TeamWithRelationsDto })
  @ApiWriteErrors()
  @ApiNotFoundError('not_found')
  @ApiConflictError()
  @Patch(':id/manager')
  setManager(
    @Param('id') id: string,
    @Body() dto: SetManagerDto,
    @Req() request: AuthRequest,
  ) {
    return this.teamService.setManager(
      id,
      dto.managerId,
      request.session!.user.id,
    );
  }
}
