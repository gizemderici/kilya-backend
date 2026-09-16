import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  type HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Prisma hata kodlarının HTTP karşılıkları.
 * Kodların listesi: https://www.prisma.io/docs/orm/reference/error-reference
 */
const PRISMA_ERRORS: Record<string, () => HttpException> = {
  // Benzersizlik ihlali (ör. aynı e-postayla ikinci kayıt)
  P2002: () => new ConflictException('Bu kayıt zaten mevcut'),
  // Yabancı anahtar ihlali (ör. olmayan bir kullanıcıya bağlı kayıt)
  P2003: () => new ConflictException('İlişkili kayıt geçersiz'),
  // Güncellenmek ya da silinmek istenen kayıt yok
  P2025: () => new NotFoundException('Kayıt bulunamadı'),
};

/**
 * Serviste yakalanmayan Prisma hatalarını anlamlı HTTP yanıtlarına çevirir.
 * Yanıt biçimi Nest'in varsayılanıyla aynıdır:
 *   { "statusCode": 409, "message": "Bu kayıt zaten mevcut", "error": "Conflict" }
 *
 * Not: Kullanıcıya özel mesajlar (ör. "Bu e-posta zaten kayıtlı") servislerde
 * doğrudan ConflictException ile verilmeli; bu filtre bir güvenlik ağıdır.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const toHttp = PRISMA_ERRORS[error.code];

    let httpError: HttpException;
    if (toHttp) {
      httpError = toHttp();
    } else {
      // Beklenmeyen veritabanı hatası: ayrıntıyı logla, istemciye sızdırma.
      this.logger.error(`Prisma hatası ${error.code}: ${error.message}`);
      httpError = new InternalServerErrorException();
    }

    const { httpAdapter } = this.adapterHost;
    httpAdapter.reply(
      host.switchToHttp().getResponse(),
      httpError.getResponse(),
      httpError.getStatus(),
    );
  }
}
