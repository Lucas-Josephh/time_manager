import 'reflect-metadata';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ResponseMessage } from '../src/common/decorator/response-message.decorator';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

@ResponseMessage('controller_success')
class Controller {
  inherited() {}

  @ResponseMessage('method_success')
  override() {}
}
class PlainController {
  action() {}
}

function intercept(controller: typeof Controller | typeof PlainController, handler: () => void, data: unknown) {
  const context = new ExecutionContextHost([], controller, handler);
  return lastValueFrom(new ResponseInterceptor(new Reflector()).intercept(context, { handle: () => of(data) }));
}

describe('Success response messages', () => {
  it('inherits the controller message and preserves data without a response DTO', async () => {
    const data = { message: 'business data', success: false, data: [1] };
    expect(await intercept(Controller, Controller.prototype.inherited, data)).toEqual({
      success: true, message: 'controller_success', data,
    });
  });

  it('gives the method message precedence', async () => {
    expect(await intercept(Controller, Controller.prototype.override, [])).toEqual({
      success: true, message: 'method_success', data: [],
    });
  });

  it('uses the default message and preserves falsy scalar results', async () => {
    for (const data of [false, 0, '']) {
      expect(await intercept(PlainController, PlainController.prototype.action, data)).toEqual({
        success: true, message: 'request_successful', data,
      });
    }
  });

  it('propagates errors without replacing them with a success message', async () => {
    const context = new ExecutionContextHost([], Controller, Controller.prototype.override);
    const error = new Error('service failure');
    await expect(lastValueFrom(new ResponseInterceptor(new Reflector()).intercept(context, {
      handle: () => throwError(() => error),
    }))).rejects.toBe(error);
  });
});
