import { SetMetadata } from '@nestjs/common';
import type { ClassConstructor } from 'class-transformer';

export const RESPONSE_DTO_KEY = 'response_dto';

export const SerializeResponse = (dto: ClassConstructor<object>) =>
  SetMetadata(RESPONSE_DTO_KEY, dto);
