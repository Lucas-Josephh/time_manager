import { HealthDto } from './app.dto';
import { ApiSuccessResponse, ApiServerError } from './common/swagger/api-response.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from './common/decorator/response-message.decorator';

@ApiTags('Health')
@ApiServerError()
@Controller('health')
export class AppController {

  @Get()
  @ApiOperation({ summary: 'Vérifier que l’API répond' })
  @ResponseMessage('health_check_successful')
  @ApiSuccessResponse({ type: HealthDto, message: 'health_check_successful' })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
