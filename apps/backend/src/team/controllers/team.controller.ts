import { ApiResult } from '../../common/decorator/api-result.decorator';
import { AvailableUsersQueryDto, SetManagerDto } from '../dto/team-actions.dto';
import {
  ApiTeamController,
  ApiTeamCreate,
  ApiTeamUpdate,
  ApiTeamDelete,
  ApiTeamFindAll,
  ApiTeamFindAvailableUsers,
  ApiTeamFindOne,
  ApiTeamSetManager,
} from '../team.swagger';
import {
  HttpStatus,
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

@ApiTeamController()
@Controller('team')
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ApiTeamCreate()
  @Post()
  @ApiResult({
    type: TeamWithRelationsDto,
    status: HttpStatus.CREATED,
    message: 'team_created',
  })
  create(@Body() dto: SetTeamDto, @Req() request: AuthRequest) {
    return this.teamService.create(dto, request.session!.user.id);
  }

  @ApiTeamUpdate()
  @Patch(':id')
  @ApiResult({
    type: TeamWithRelationsDto,
    status: HttpStatus.OK,
    message: 'team_partially_updated',
  })
  update(
    @Param('id') id: string,
    @Body() dto: PartialSetTeamDto,
    @Req() request: AuthRequest,
  ) {
    return this.teamService.update(id, dto, request.session!.user.id);
  }

  @ApiTeamDelete()
  @Delete(':id')
  @ApiResult({
    type: TeamDetailsDto,
    status: HttpStatus.OK,
    message: 'team_deleted',
  })
  delete(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.teamService.delete(id, request.session!.user.id);
  }

  @ApiTeamFindAll()
  @Get()
  @ApiResult({
    type: TeamListDto,
    status: HttpStatus.OK,
    message: 'team_listed',
  })
  findAll(@Query() query: QuerySetTeamDto, @Req() request: AuthRequest) {
    return this.teamService.findAll(query, request.session!.user.id);
  }


  @ApiTeamFindAvailableUsers()
  @Get('available-users')
  @ApiResult({
    type: UserSummaryDto,
    status: HttpStatus.OK,
    message: 'team_available_users_listed',
    isArray: true,
  })
  findAvailableUsers(
    @Req() request: AuthRequest,
    @Query() query: AvailableUsersQueryDto,
  ) {
    return this.teamService.findAvailableUsers(request.session!.user.id, query);
  }

  @ApiTeamFindOne()
  @Get(':id')
  @ApiResult({
    type: TeamWithRelationsDto,
    status: HttpStatus.OK,
  })
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.teamService.findOne(id, request.session!.user.id);
  }

  @ApiTeamSetManager()
  @Patch(':id/manager')
  @ApiResult({
    type: TeamWithRelationsDto,
    status: HttpStatus.OK,
  })
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
