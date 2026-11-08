import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { ApiResult } from '../../common/decorator/api-result.decorator';
import {
  ScheduleAssignmentListDto,
  ScheduleAssignmentQueryDto,
  ScheduleAtQueryDto,
  UserScheduleResponseDto,
} from '../dto/schedule-assignment.dto';
import {
  ApiScheduleAssignmentController,
  ApiScheduleAssignmentHistory,
  ApiUserSchedule,
} from '../schedule-assignment.swagger';
import { ScheduleAssignmentService } from '../services/schedule-assignment.service';

@ApiScheduleAssignmentController()
@Controller('schedule/users/:userId')
@UseGuards(AuthGuard)
export class ScheduleUsersController {
  constructor(private readonly assignmentService: ScheduleAssignmentService) {}

  /** Return the user's past and future assignments with pagination. */
  @Get('assignments')
  @ApiScheduleAssignmentHistory()
  @ApiResult({ type: ScheduleAssignmentListDto, status: HttpStatus.OK })
  history(
    @Param('userId') userId: string,
    @Query() query: ScheduleAssignmentQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignmentService.history(
      userId,
      query,
      request.session!.user.id,
    );
  }

  /** Return the assignment applicable at the requested instant. */
  @Get()
  @ApiUserSchedule()
  @ApiResult({ type: UserScheduleResponseDto, status: HttpStatus.OK })
  current(
    @Param('userId') userId: string,
    @Query() query: ScheduleAtQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignmentService.current(
      userId,
      query.at,
      request.session!.user.id,
    );
  }
}
