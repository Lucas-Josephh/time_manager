import { CanManageTeams } from './guards/can-manage-teams.guard';
import {
  ApiTeamController,
  ApiTeamCreate,
  ApiTeamUpdate,
  ApiTeamDelete,
  ApiTeamFindAll,
  ApiTeamFindAvailableUsers,
  ApiTeamFindOne,
} from './team.swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/auth.types';
import { AvailableTeamUserDto } from './dto/available-team-user.dto';
import {
  PartialSetTeamDto,
  QuerySetTeamDto,
  SetTeamDto,
  TeamDetailsDto,
  TeamListDto,
  TeamWithRelationsDto,
} from './dto/team.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';

@ApiTeamController()
@Controller('team')
@SerializeResponse(TeamDetailsDto)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ResponseMessage('team_created')
  @ApiTeamCreate()
  @SerializeResponse(TeamWithRelationsDto)
  @CanManageTeams()
  @Post()
  create(@Body() dto: SetTeamDto, @Req() request: AuthRequest) {
    return this.teamService.create(dto, request.session!.user.id);
  }

  @ResponseMessage('team_partially_updated')
  @ApiTeamUpdate()
  @SerializeResponse(TeamWithRelationsDto)
  @CanManageTeams({ teamId: 'id' })
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
  @CanManageTeams({ teamId: 'id' })
  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @ResponseMessage('team_listed')
  @ApiTeamFindAll()
  @SerializeResponse(TeamListDto)
  @UseGuards(AuthGuard)
  @Get()
  findAll(@Query() query: QuerySetTeamDto) {
    return this.teamService.findAll(query);
  }

  @UseGuards(AuthGuard)
  @Get('available-users')
  @SerializeResponse(AvailableTeamUserDto)
  @ResponseMessage('team_available_users_listed')
  @ApiTeamFindAvailableUsers()
  findAvailableUsers(@Req() request: AuthRequest) {
    return this.teamService.findAvailableUsers(request.session!.user.id);
  }

  @ApiTeamFindOne()
  @SerializeResponse(TeamWithRelationsDto)
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
