import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AuthRequest } from '../../auth/auth.types';
import { ApiResult } from '../../common/decorator/api-result.decorator';
import { ClockResponseDto } from '../dto/clock-response.dto';
import {
  ApiClockController,
  ApiClockCurrent,
  ApiClockStart,
  ApiClockStop,
} from '../clock.swagger';
import { ClockService } from '../services/clock.service';

@ApiClockController()
@Controller('clock')
@UseGuards(AuthGuard)
export class ClockController {
  constructor(private readonly clockService: ClockService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiClockCurrent()
  @ApiResult({ type: ClockResponseDto, status: HttpStatus.OK })
  current(@Req() request: AuthRequest) {
    return this.clockService.current(request.session!.user.id);
  }

  @Post('sessions')
  @ApiClockStart()
  @ApiResult({ type: ClockResponseDto, status: HttpStatus.CREATED })
  start(@Req() request: AuthRequest) {
    return this.clockService.start(request.session!.user.id);
  }

  @Put('sessions/:id/end')
  @ApiClockStop()
  @ApiResult({ type: ClockResponseDto, status: HttpStatus.OK })
  stop(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.clockService.stop(request.session!.user.id, id);
  }
}
