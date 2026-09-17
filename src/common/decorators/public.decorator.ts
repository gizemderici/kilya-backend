import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Uç noktayı JwtAuthGuard'dan muaf tutar (kayıt, giriş, sağlık kontrolü). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
