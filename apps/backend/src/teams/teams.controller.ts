import { Body, Controller, Get, Post } from '@nestjs/common';
import TeamDto from './dto/team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {

  constructor(private readonly teamServices: TeamsService) {}

  @Post()
  create(@Body() dto: TeamDto) {
    // return this.teamServices.create(dto);
  }

  @Get()
  findAll() {
    return
  }
}
