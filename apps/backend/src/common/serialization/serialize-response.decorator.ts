import { SetMetadata } from '@nestjs/common';
import type { ClassConstructor } from 'class-transformer';

export const RESPONSE_DTO_KEY = 'response_dto';

/**
 * Decorator to specify the DTO class for serializing the response data.
 *
 * @param dto
 * @constructor
 */
export const SerializeResponse = (dto: ClassConstructor<object>) =>
  SetMetadata(RESPONSE_DTO_KEY, dto);
