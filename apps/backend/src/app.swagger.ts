import { applyDecorators } from '@nestjs/common';
import {
  ApiServerError,
} from './common/swagger/api-response.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

export function ApiAppController() {
  return applyDecorators(
    ApiTags('Health'),
    ApiServerError(),
  );
}

export function ApiAppHealth() {
  return applyDecorators(
    ApiOperation({ summary: 'Vérifier que l\'API répond' }),
  );
}
