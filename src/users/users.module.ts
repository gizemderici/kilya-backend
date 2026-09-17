import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TokenModule],
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
