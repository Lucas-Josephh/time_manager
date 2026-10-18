import { OrganizationDto, PartialOrganizationDto } from '../../organization/dto/organization.dto';
import { setOrganizationValidationContext } from '../decorator/valid-organization-parent.decorator';
import { Inject, Injectable, Scope, ValidationPipe } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { ValidatorOptions } from 'class-validator';
import { PartialSetTeamDto, SetTeamDto } from '../../team/dto/team.dto';
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
    this.applyUpdateContext(object);
    return super.validate(object, options);
  }

  private applyUpdateContext(dto: object): void {
    const { method, params } = this.request;
    const isUpdate = method === 'PUT' || method === 'PATCH';
    if (!isUpdate || !params.id) return;

    // L'identifiant vient de la route, jamais du body fourni par le client.
    if (dto instanceof SetTeamDto || dto instanceof PartialSetTeamDto) {
      excludeUniqueRecord(dto, 'team', params.id);
    }
    if (dto instanceof OrganizationDto || dto instanceof PartialOrganizationDto) {
      setOrganizationValidationContext(dto, params.id);
    }
  }
}
