import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from './common/decorator/response-message.decorator';

@ApiTags('Health')
@Controller('health')
export class AppController {

  @Get()
  @ApiOperation({ summary: 'Vérifier que l’API répond' })
  @ResponseMessage('health_check_successful')
  @ApiOkResponse({
    description: 'Cela permet de vérifier que l\'API répond correctement.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'], example: 'ok' },
      },
    },
  })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
