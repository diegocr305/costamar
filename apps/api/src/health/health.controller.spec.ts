import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';
import type { HealthResponse } from './health.types';

function mockResponse(): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

describe('HealthController', () => {
  it('responde 200 cuando el estado es ok', async () => {
    const okResponse: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      components: { supabase: { status: 'up' } },
    };
    const service = {
      check: () => Promise.resolve(okResponse),
    } as unknown as HealthService;
    const controller = new HealthController(service);
    const { res, status } = mockResponse();

    await controller.check(res);
    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('responde 503 cuando el estado es degraded', async () => {
    const degradedResponse: HealthResponse = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      components: { supabase: { status: 'down', detail: 'sin conexión' } },
    };
    const service = {
      check: () => Promise.resolve(degradedResponse),
    } as unknown as HealthService;
    const controller = new HealthController(service);
    const { res, status } = mockResponse();

    await controller.check(res);
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
