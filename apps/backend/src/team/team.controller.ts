import { CanManageTeams } from './guards/can-manage-teams.guard';
import { ResourceExists } from '../common/guards/resource-exists.guard';
import {
  ApiTeamController,
  ApiTeamCreate,
  ApiTeamReplace,
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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { AuthGuard, type AuthRequest } from '../auth/guards/auth.guard';
import {
  AvailableTeamUserDto,
  AvailableTeamUsersParamsDto,
} from './dto/available-team-user.dto';
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
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiTeamCreate()
  @SerializeResponse(TeamWithRelationsDto)
  @CanManageTeams()
  create(@Body() dto: SetTeamDto) {
    return this.teamService.create(dto);
  }

  @ResponseMessage('team_updated')
  @HttpCode(HttpStatus.OK)
  @CanManageTeams({ teamId: 'id' })
  @Put(':id')
  @ApiTeamReplace()
  @SerializeResponse(TeamWithRelationsDto)
  replace(@Param('id') id: string, @Body() dto: SetTeamDto) {
    return this.teamService.replace(id, dto);
  }

  @ResponseMessage('team_partially_updated')
  @HttpCode(HttpStatus.OK)
  @CanManageTeams({ teamId: 'id' })
  @Patch(':id')
  @ApiTeamUpdate()
  @SerializeResponse(TeamWithRelationsDto)
  update(@Param('id') id: string, @Body() dto: PartialSetTeamDto) {
    return this.teamService.update(id, dto);
  }

  @ResponseMessage('team_deleted')
  @HttpCode(HttpStatus.ACCEPTED)
  @CanManageTeams({ teamId: 'id' })
  @Delete(':id')
  @ApiTeamDelete()
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @UseGuards(AuthGuard)
  @Get()
  @ResponseMessage('team_listed')
  @HttpCode(HttpStatus.OK)
  @ApiTeamFindAll()
  @SerializeResponse(TeamListDto)
  findAll(@Query() query: QuerySetTeamDto) {
    return this.teamService.findAll(query);
  }

  @ResourceExists('team', { trimId: true })
  @UseGuards(AuthGuard)
  @Get(':id/available-users')
  @SerializeResponse(AvailableTeamUserDto)
  @ResponseMessage('team_available_users_listed')
  @ApiTeamFindAvailableUsers()
  findAvailableUsers(
    @Param() params: AvailableTeamUsersParamsDto,
    @Req() request: AuthRequest,
  ) {
    return this.teamService.findAvailableUsers(
      params.id,
      request.session!.user.id,
    );
  }

  @ResourceExists('team')
  @UseGuards(AuthGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiTeamFindOne()
  @SerializeResponse(TeamWithRelationsDto)
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
