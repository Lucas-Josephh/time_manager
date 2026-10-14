import { Inject, Injectable, Scope, ValidationPipe } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { ValidatorOptions } from 'class-validator';
import { PartialTeamDto, TeamDto } from '../../team/dto/team.dto';
import { excludeUniqueRecord } from '../decorator/unique.decorator';
import { validationExceptionFactory } from './validation-exception.factory';

type ValidationRequest = {
  method: string;
  params: { id?: string };
};

@Injectable({ scope: Scope.REQUEST })
export class RequestValidationPipe extends ValidationPipe {
  constructor(@Inject(REQUEST) private readonly request: ValidationRequest) {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    });
  }

  protected override validate(object: object, options?: ValidatorOptions) {
    const { method, params } = this.request;
    if (
      (method === 'PUT' || method === 'PATCH') &&
      params.id &&
      (object instanceof TeamDto || object instanceof PartialTeamDto)
    ) {
      // L'identifiant vient de la route, jamais du body fourni par le client.
      excludeUniqueRecord(object, 'team', params.id);
    }
    return super.validate(object, options);
  }
}
