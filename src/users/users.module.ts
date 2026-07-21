import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, AuditService],
})
export class UsersModule {}
