import {
  ApiAppController,
  ApiAppHealth,
} from './app.swagger';

import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from './common/decorator/response-message.decorator';

@ApiAppController()
@Controller('health')
export class AppController {

  @Get()
  @ApiAppHealth()
  @ResponseMessage('health_check_successful')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
