import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function mockHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('formatea una HttpException con el contrato estándar', () => {
    const { host, status, json } = mockHost();
    filter.catch(new BadRequestException('Dato inválido'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Dato inválido');
    expect(typeof body.timestamp).toBe('string');
  });

  it('convierte un error desconocido en 500 sin filtrar detalles internos', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('stack interno sensible'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Error interno del servidor');
    expect(body.message).not.toContain('stack interno');
  });

  it('une mensajes de validación en array', () => {
    const { host, json } = mockHost();
    const exception = new HttpException(
      { message: ['campo A inválido', 'campo B inválido'] },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('campo A inválido; campo B inválido');
  });
});
