import { ApiOperation } from '@nestjs/swagger';
import { ApiResult } from '../../common/decorator/api-result.decorator';
import {
  HttpStatus,
  Body,
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Post,
  UseGuards, Req,
} from '@nestjs/common';
import {
  CreateScheduleDto,
  QueryScheduleDto,
  ScheduleListDto,
  ScheduleTreeDto,
  ScheduleResponseDto,
  UpdateScheduleDto,
} from '../dto/schedule.dto';
import { ScheduleService } from '../services/schedule.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ApiScheduleController,
  ApiScheduleCreate,
  ApiScheduleFindAll,
  ApiScheduleFindOne,
  ApiScheduleUpdate,
} from '../schedule.swagger';
import { AuthRequest } from '../../auth/auth.types';

@ApiScheduleController()
@UseGuards(AuthGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiScheduleCreate()
  @ApiResult({
    type: ScheduleResponseDto,
    status: HttpStatus.CREATED,
  })
  create(@Body() dto: CreateScheduleDto, @Req() request: AuthRequest) {
    return this.scheduleService.create(dto, request.session!.user.id);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Arborescence des plannings', description: 'Retourne les racines et tous leurs descendants dans children, sans pagination.' })
  @ApiResult({ type: ScheduleTreeDto, isArray: true, status: HttpStatus.OK })
  tree() {
    return this.scheduleService.tree();
  }

  @Get(':id/tree')
  @ApiOperation({ summary: 'Sous-arborescence d’un planning', description: 'Retourne un tableau contenant le planning demandé et tous ses descendants. Planning absent : 404.' })
  @ApiResult({ type: ScheduleTreeDto, isArray: true, status: HttpStatus.OK })
  subtree(@Param('id') id: string) {
    return this.scheduleService.tree(id);
  }

  @Get(':id')
  @ApiScheduleFindOne()
  @ApiResult({
    type: ScheduleResponseDto,
    allowEmpty: true,
    status: HttpStatus.OK,
  })
  findOne(@Param('id') id: string) {
    return this.scheduleService.findOne(id);
  }

  @Get()
  @ApiScheduleFindAll()
  @ApiResult({
    type: ScheduleListDto,
    status: HttpStatus.OK,
  })
  findAll(@Query() filters: QueryScheduleDto) {
    return this.scheduleService.findAll(filters);
  }

  @Patch(':id')
  @ApiScheduleUpdate()
  @ApiResult({
    type: ScheduleResponseDto,
    status: HttpStatus.OK,
  })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto, @Req() request: AuthRequest) {
    return this.scheduleService.update(id, dto, request.session!.user.id);
  }
}
