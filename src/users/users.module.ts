import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module.js';
import { AccountService } from './account.service.js';
import { ConsentsService } from './consents.service.js';
import { GoalsService } from './goals.service.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TokenModule],
  controllers: [MeController],
  providers: [UsersService, GoalsService, ConsentsService, AccountService],
  exports: [UsersService, ConsentsService],
})
export class UsersModule {}
