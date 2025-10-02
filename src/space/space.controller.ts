import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceService } from './space.service';
import { RequireSpaceRole } from '../space-member/decorators/require-space-role.decorator';
import { SpaceRoleGuard } from '../space-member/guards/space-role.guard';
import { SpaceRole } from '@prisma/client';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';

@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Version('1')
  @Post()
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateSpaceDto,
    @Req() request: RequestWithUser,
  ): Promise<SpaceResponseDto> {
    const ownerId = request.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to create a space.',
      );
    }

    return this.spaceService.create(ownerId, dto);
  }

  @Version('1')
  @Patch(':id')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'id' })
  async update(
    @Param('id') spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceResponseDto> {
    return this.spaceService.update(spaceId, dto);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'id' })
  @UseFilters(JwtExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') spaceId: string): Promise<void> {
    await this.spaceService.delete(spaceId);
  }

  @Version('1')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.VIEWER, { spaceIdParam: 'id' })
  @Get(':id')
  async findOne(@Param('id') spaceId: string): Promise<SpaceResponseDto> {
    return this.spaceService.findOne(spaceId);
  }

  @Version('1')
  @Put(':id/logo')
  @UseGuards(JwtAuthGuard, SpaceRoleGuard)
  @RequireSpaceRole(SpaceRole.OWNER, { spaceIdParam: 'id' })
  @UseFilters(JwtExceptionFilter)
  @UseInterceptors(FileInterceptor('file'))
  async updateLogo(
    @Param('id') spaceId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<SpaceResponseDto> {
    if (!file) {
      throw new BadRequestException('A logo file must be provided.');
    }

    return this.spaceService.updateLogo(spaceId, file);
  }
}
