import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionFilter } from './http-exception.filter';
import { FieldErrorsBuilder } from '../validation/field-errors.builder';

describe('HTTP field error exceptions', () => {
  const reply = jest.fn();
  const response = {};
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new HttpExceptionFilter({
    httpAdapter: { isHeadersSent: () => false, reply },
  } as unknown as HttpAdapterHost);
  beforeEach(() => reply.mockReset());

  it('derives the default message from the status while preserving field errors', () => {
    const errors = new FieldErrorsBuilder()
      .at('userIds', 2)
      .add('reference_not_found');
    filter.catch(errors.exception(NotFoundException), host);
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        success: false,
        message: 'not_found',
        data: {
          errors: { 'userIds[2]': { messages: ['reference_not_found'] } },
        },
      },
      404,
    );
  });

  it('preserves explicit business codes and additional details', () => {
    const errors = new FieldErrorsBuilder()
      .at('userIds', 0)
      .add('outside_management_scope');
    filter.catch(
      errors.exception(ForbiddenException, 'schedule_assignment_forbidden', {
        scope: 'users',
      }),
      host,
    );
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        success: false,
        message: 'schedule_assignment_forbidden',
        data: { scope: 'users', errors: errors.toObject() },
      },
      403,
    );
  });

  it('does not expose internal server error details', () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      filter.catch(
        new FieldErrorsBuilder()
          .add('secret', 'private')
          .exception(InternalServerErrorException),
        host,
      );
      expect(reply).toHaveBeenCalledWith(
        response,
        { success: false, message: 'internal_server_error', data: {} },
        500,
      );
    } finally {
      logger.mockRestore();
    }
  });
});
