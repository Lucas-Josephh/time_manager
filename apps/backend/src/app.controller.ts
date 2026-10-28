import {
  ApiAppController,
  ApiAppHealth,
} from './app.swagger';

import { Controller, Get } from '@nestjs/common';
import { ApiResult } from './common/decorator/api-result.decorator';
import { HealthDto } from './app.dto';

@ApiAppController()
@Controller('health')
export class AppController {

  @Get()
  @ApiAppHealth()
  @ApiResult({
    type: HealthDto,
    message: 'health_check_successful',
  })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
