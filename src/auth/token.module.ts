import { Module } from '@nestjs/common';
import { TokenService } from './token.service.js';

/** Token üretimi/iptali; Auth ve Users modülleri ortak kullanır. */
@Module({
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
