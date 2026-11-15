import { ApiOperation } from '@nestjs/swagger';
import {
  ApiResourceId,
  ApiValidationError,
} from '../../common/swagger/api-response.decorator';
import {
  ApiScheduleAssignmentController,
  ApiScheduleAssign,
} from '../schedule-assignment.swagger';
import {
  Body,
  Get,
  Query,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { ApiResult } from '../../common/decorator/api-result.decorator';
import {
  AssignScheduleDto,
  ScheduleAssignedUsersQueryDto,
  ScheduleAssignedUsersListDto,
  ScheduleAssignmentResponseDto,
} from '../dto/schedule-assignment.dto';
import { ScheduleAssignmentService } from '../services/assignment/schedule-assignment.service';

@ApiScheduleAssignmentController()
@Controller('schedule/:id')
@UseGuards(AuthGuard)
export class ScheduleAssignmentController {
  constructor(private readonly assignmentService: ScheduleAssignmentService) {}

  @Get('users')
  @ApiOperation({
    summary: 'Lister les utilisateurs affectés à un planning',
    description:
      'Planning exact, sans ses versions dérivées. Dernière affectation applicable à at (ISO avec offset), maintenant par défaut. Exclut les affectations remplacées et celles non encore entrées en vigueur. Résultats limités à soi-même et aux utilisateurs du périmètre de gestion ; tous pour un administrateur. Tri par nom, prénom puis identifiant.',
  })
  @ApiResourceId('schedule-morning')
  @ApiValidationError()
  @ApiResult({ type: ScheduleAssignedUsersListDto, status: HttpStatus.OK })
  users(
    @Param('id') id: string,
    @Query() query: ScheduleAssignedUsersQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignmentService.assignedUsers(
      id,
      query,
      request.session!.user.id,
    );
  }

  /** Assign the selected schedule to every authorized user atomically. */
  @Post('assignments')
  @ApiScheduleAssign()
  @ApiResult({
    type: ScheduleAssignmentResponseDto,
    isArray: true,
    status: HttpStatus.CREATED,
  })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignScheduleDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignmentService.assign(id, dto, request.session!.user.id);
  }
}
