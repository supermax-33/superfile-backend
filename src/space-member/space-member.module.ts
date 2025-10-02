import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SpaceMemberController } from './space-member.controller';
import { SpaceMemberService } from './space-member.service';
import { SpaceRoleGuard } from './guards/space-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [SpaceMemberController],
  providers: [SpaceMemberService, SpaceRoleGuard],
  exports: [SpaceMemberService, SpaceRoleGuard],
})
export class SpaceMemberModule {}
