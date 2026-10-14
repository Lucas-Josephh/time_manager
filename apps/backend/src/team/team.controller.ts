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
} from '@nestjs/common';
import { TeamService } from './team.service';
import { PartialTeamDto, TeamDto } from './dto/team.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ResponseMessage('team_created')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: TeamDto) {
    return this.teamService.create(dto);
  }

  @ResponseMessage('team_updated')
  @HttpCode(HttpStatus.OK)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: TeamDto) {
    return this.teamService.replace(id, dto);
  }

  @ResponseMessage('team_partially_updated')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  partialUpdate(@Param('id') id: string, @Body() dto: PartialTeamDto) {
    return this.teamService.update(id, dto);
  }

  @ResponseMessage('team_deleted')
  @HttpCode(HttpStatus.ACCEPTED)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @Get()
  @ResponseMessage('team_listed')
  @HttpCode(HttpStatus.FOUND)
  findAll() {
    return this.teamService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.FOUND)
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
