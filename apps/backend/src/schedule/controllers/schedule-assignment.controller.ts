import {
  ApiScheduleAssignmentController,
  ApiScheduleAssign,
} from '../schedule-assignment.swagger';
import {
  Body,
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
  ScheduleAssignmentResponseDto,
} from '../dto/schedule-assignment.dto';
import { ScheduleAssignmentService } from '../services/schedule-assignment.service';

@ApiScheduleAssignmentController()
@Controller('schedule/:id')
@UseGuards(AuthGuard)
export class ScheduleAssignmentController {
  constructor(private readonly assignmentService: ScheduleAssignmentService) {}

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
