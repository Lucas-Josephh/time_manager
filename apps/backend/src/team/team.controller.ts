import {
  ApiTeamController,
  ApiTeamCreate,
  ApiTeamReplace,
  ApiTeamUpdate,
  ApiTeamDelete,
  ApiTeamFindAll,
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
} from '@nestjs/common';
import { TeamService } from './team.service';
import {
  PartialTeamDto,
  QueryTeamDto,
  TeamDto,
  TeamWithRelationsDto,
} from './dto/team.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';

// TODO: Implement the guard by admin or manager of the organization or its parent organizations

@ApiTeamController()
@Controller('team')
@SerializeResponse(TeamWithRelationsDto)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ResponseMessage('team_created')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiTeamCreate()
  create(@Body() dto: TeamDto) {
    return this.teamService.create(dto);
  }

  @ResponseMessage('team_updated')
  @HttpCode(HttpStatus.OK)
  @Put(':id')
  @ApiTeamReplace()
  update(@Param('id') id: string, @Body() dto: TeamDto) {
    return this.teamService.replace(id, dto);
  }

  @ResponseMessage('team_partially_updated')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiTeamUpdate()
  partialUpdate(@Param('id') id: string, @Body() dto: PartialTeamDto) {
    return this.teamService.update(id, dto);
  }

  @ResponseMessage('team_deleted')
  @HttpCode(HttpStatus.ACCEPTED)
  @Delete(':id')
  @ApiTeamDelete()
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @Get()
  @ResponseMessage('team_listed')
  @HttpCode(HttpStatus.OK)
  @ApiTeamFindAll()
  findAll(@Query() query: QueryTeamDto) {
    return this.teamService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiTeamFindOne()
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
