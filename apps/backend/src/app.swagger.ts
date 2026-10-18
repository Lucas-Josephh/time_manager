import { applyDecorators } from '@nestjs/common';
import {
  ApiSuccessResponse,
  ApiServerError,
} from './common/swagger/api-response.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthDto } from './app.dto';

export function ApiAppController() {
  return applyDecorators(
    ApiTags('Health'),
    ApiServerError(),
  );
}

export function ApiAppHealth() {
  return applyDecorators(
    ApiOperation({ summary: 'Vérifier que l’API répond' }),
    ApiSuccessResponse({ type: HealthDto, message: 'health_check_successful' }),
  );
}
