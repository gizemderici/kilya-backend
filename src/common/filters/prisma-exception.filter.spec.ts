import { type ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

function setup() {
  const reply = vi.fn();
  const response = {};
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return {
    filter: new PrismaExceptionFilter(adapterHost),
    reply,
    host,
    response,
  };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('test', {
    code,
    clientVersion: 'test',
  });

describe('PrismaExceptionFilter', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Bu kayıt zaten mevcut'],
    ['P2003', HttpStatus.CONFLICT, 'İlişkili kayıt geçersiz'],
    ['P2025', HttpStatus.NOT_FOUND, 'Kayıt bulunamadı'],
  ])('%s → %i', (code, status, message) => {
    const { filter, reply, host, response } = setup();

    filter.catch(prismaError(code), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ statusCode: status, message }),
      status,
    );
  });

  it('bilinmeyen kodda 500 döner ve ayrıntıyı sızdırmaz', () => {
    const { filter, reply, host } = setup();
    const logSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(prismaError('P1001'), host);

    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(body)).not.toContain('test');
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
