import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module.js';
import { GoalsService } from './goals.service.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TokenModule],
  controllers: [MeController],
  providers: [UsersService, GoalsService],
  exports: [UsersService],
})
export class UsersModule {}
