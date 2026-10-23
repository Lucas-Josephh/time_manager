import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReferenceModel } from '../decorator/reference.decorator';
import { requireResource } from '../require-resource';

const RESOURCE = 'required_resource';

type ResourceOptions = {
  model: ReferenceModel;
  param: string;
  trimId: boolean;
};

type ResourceDelegate = {
  findUnique(args: {
    where: { id: string };
    select: { id: true };
  }): PromiseLike<{ id: string } | null>;
};

@Injectable()
export class ResourceExistsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<ResourceOptions>(RESOURCE, context.getHandler());
    if (!options) return true;

    const request = context.switchToHttp().getRequest<{
      params: Record<string, string | undefined>;
    }>();
    const rawId = request.params[options.param];
    // Missing or blank IDs are left to the parameter DTO's format validators.
    if (!rawId?.trim()) return true;

    const id = options.trimId ? rawId.trim() : rawId;
    const delegate = this.prisma[options.model] as unknown as ResourceDelegate;
    await requireResource(delegate.findUnique({ where: { id }, select: { id: true } }));
    return true;
  }
}

/**
 * Decorator that checks if a resource exists in the database before proceeding with the request.
 *
 * @param model
 * @param options
 * @constructor
 */
export function ResourceExists(
  model: ReferenceModel,
  options: { param?: string; trimId?: boolean } = {},
) {
  return applyDecorators(
    SetMetadata(RESOURCE, { model, param: 'id', trimId: false, ...options }),
    UseGuards(ResourceExistsGuard),
  );
}
