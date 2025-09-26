import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtExceptionFilter } from 'src/auth/filters/jwt-exception.filter';
import { CreateFileDto } from './dto/create-file.dto';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FileOwnerGuard } from './guards/file-owner.guard';
import { FileService } from './file.service';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
  };
}

@ApiTags('files')
@Controller('files')
@UseFilters(JwtExceptionFilter)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Version('1')
  @Post()
  @ApiOperation({ summary: 'Create a new file record.' })
  @ApiResponse({
    status: 201,
    description: 'File created successfully.',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(
    @Body() dto: CreateFileDto,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to create a file.',
      );
    }

    return this.fileService.create(userId, dto);
  }

  @Version('1')
  @Get()
  @ApiOperation({
    summary: 'Retrieve all files owned by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files retrieved successfully.',
    type: FileResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Query() query: ListFilesQueryDto,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto[]> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to list files.',
      );
    }

    return this.fileService.findAll(userId, query);
  }

  @Version('1')
  @Get(':id')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Retrieve metadata for a specific file.' })
  @ApiResponse({
    status: 200,
    description: 'File retrieved successfully.',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async findOne(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to retrieve a file.',
      );
    }

    return this.fileService.findOne(fileId, userId);
  }

  @Version('1')
  @Patch(':id')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Update metadata for an existing file.' })
  @ApiResponse({
    status: 200,
    description: 'File updated successfully.',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  async update(
    @Param('id') fileId: string,
    @Body() dto: UpdateFileDto,
    @Req() request: RequestWithUser,
  ): Promise<FileResponseDto> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to update a file.',
      );
    }

    return this.fileService.update(fileId, userId, dto);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(FileOwnerGuard)
  @ApiOperation({ summary: 'Delete a file record permanently.' })
  @ApiResponse({ status: 204, description: 'File deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'File not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') fileId: string,
    @Req() request: RequestWithUser,
  ): Promise<void> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user context is required to delete a file.',
      );
    }

    await this.fileService.remove(fileId, userId);
  }
}
