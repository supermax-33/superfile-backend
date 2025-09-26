import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileOwnerGuard } from './guards/file-owner.guard';

@Module({
  imports: [PrismaModule],
  controllers: [FileController],
  providers: [FileService, FileOwnerGuard],
  exports: [FileService],
})
export class FileModule {}
