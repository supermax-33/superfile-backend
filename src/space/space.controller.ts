import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
  Version,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Express, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { UpdateSpaceLogoDto } from './dto/update-space-logo.dto';
import { SpaceOwnerGuard } from './guards/space-owner.guard';
import { SpaceService } from './space.service';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
  };
}

@ApiTags('spaces')
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Version('1')
  @Post()
  @UseFilters(JwtExceptionFilter)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new space.' })
  @ApiResponse({
    status: 201,
    description: 'Space created successfully.',
    type: SpaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the name or slug of an existing space.' })
  @ApiResponse({
    status: 200,
    description: 'Space updated successfully.',
    type: SpaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can update the space.',
  })
  @ApiResponse({ status: 404, description: 'Space not found.' })
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
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a space permanently.' })
  @ApiResponse({ status: 204, description: 'Space deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can delete the space.',
  })
  @ApiResponse({ status: 404, description: 'Space not found.' })
  async remove(@Param('id') spaceId: string): Promise<void> {
    await this.spaceService.delete(spaceId);
  }

  @Version('1')
  @Put(':id/logo')
  @UseGuards(JwtAuthGuard, SpaceOwnerGuard)
  @UseFilters(JwtExceptionFilter)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateSpaceLogoDto })
  @ApiOperation({
    summary: 'Upload or replace the logo associated with a space.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logo stored successfully.',
    type: SpaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Logo file is missing or invalid.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can manage the logo.',
  })
  @ApiResponse({ status: 404, description: 'Space not found.' })
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
