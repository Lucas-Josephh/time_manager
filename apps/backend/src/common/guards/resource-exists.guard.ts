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

const RESOURCE = 'required_resource';

type ResourceOptions = {
  model: ReferenceModel;
  param: string;
  trimId: boolean;
};

type ResourceDelegate = {
  findUniqueOrThrow(args: {
    where: { id: string };
    select: { id: true };
  }): PromiseLike<{ id: string }>;
};

@Injectable()
export class ResourceExistsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Checks if a resource exists in the database based on the provided options.
   *
   * @param context
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<ResourceOptions>(RESOURCE, context.getHandler());
    if (!options)
      return true;

    const request = context.switchToHttp().getRequest<{
      params: Record<string, string | undefined>;
    }>();

    const rawId = request.params[options.param];
    // Missing or blank IDs are left to the parameter DTO's format validators.
    if (!rawId?.trim()) return true;

    const id = options.trimId ? rawId.trim() : rawId;
    const delegate = this.prisma[options.model] as unknown as ResourceDelegate;
    await delegate.findUniqueOrThrow({ where: { id }, select: { id: true } });
    return true;
  }
}

/**
 * Decorator that checks if a resource exists in the database before proceeding with the request.
 *
 * @param model - The model name of the resource to check (e.g., 'user', 'team').
 * @param options - Optional parameters:
 *  - param: The name of the request parameter that contains the resource ID (default: 'id').
 *  - trimId: Whether to trim whitespace from the resource ID (default: false).
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
