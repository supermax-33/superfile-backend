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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceOwnerGuard } from './guards/space-owner.guard';
import { SpaceService } from './space.service';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { RequestWithUser } from 'types';

@ApiTags('spaces')
@ApiBearerAuth()
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Version('1')
  @Post()
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new space' })
  @ApiCreatedResponse({ type: SpaceResponseDto })
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
  @UseGuards(JwtAuthGuard, SpaceOwnerGuard)
  @ApiOperation({ summary: 'Update a space' })
  @ApiOkResponse({ type: SpaceResponseDto })
  async update(
    @Param('id') spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceResponseDto> {
    return this.spaceService.update(spaceId, dto);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, SpaceOwnerGuard)
  @UseFilters(JwtExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a space' })
  @ApiNoContentResponse({ description: 'Space deleted successfully.' })
  async remove(@Param('id') spaceId: string): Promise<void> {
    await this.spaceService.delete(spaceId);
  }

  @Version('1')
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a space' })
  @ApiOkResponse({ type: SpaceResponseDto })
  async findOne(@Param('id') spaceId: string): Promise<SpaceResponseDto> {
    return this.spaceService.findOne(spaceId);
  }

  @Version('1')
  @Put(':id/logo')
  @UseGuards(JwtAuthGuard, SpaceOwnerGuard)
  @UseFilters(JwtExceptionFilter)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload or replace a space logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: SpaceResponseDto })
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
