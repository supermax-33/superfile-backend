import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Space, SpaceLogo } from '@prisma/client';
import { Express } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import {
  SpaceLogoResponseDto,
  SpaceResponseDto,
} from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';

type SpaceWithLogoMetadata = Space & {
  logo: Pick<SpaceLogo, 'contentType' | 'hash'> | null;
};

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ownerId: string,
    dto: CreateSpaceDto,
  ): Promise<SpaceResponseDto> {
    const space = await this.prisma.space.create({
      data: {
        name: this.normalizeName(dto.name),
        slug: this.normalizeSlug(dto.slug),
        ownerId,
      },
      include: { logo: { select: { contentType: true, hash: true } } },
    });

    return this.toSpaceResponse(space);
  }

  async update(
    spaceId: string,
    dto: UpdateSpaceDto,
  ): Promise<SpaceResponseDto> {
    const data: Partial<Pick<Space, 'name' | 'slug'>> = {};

    if (dto.name !== undefined) {
      const normalizedName = this.normalizeName(dto.name);
      if (!normalizedName) {
        throw new BadRequestException('Space name cannot be empty.');
      }
      data.name = normalizedName;
    }

    if (dto.slug !== undefined) {
      data.slug = this.normalizeSlug(dto.slug);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided to update the space.',
      );
    }

    const space = await this.prisma.space.update({
      where: { id: spaceId },
      data,
      include: { logo: { select: { contentType: true, hash: true } } },
    });

    return this.toSpaceResponse(space);
  }

  async delete(spaceId: string): Promise<void> {
    await this.prisma.space.delete({ where: { id: spaceId } });
  }

  async updateLogo(
    spaceId: string,
    file: Express.Multer.File,
  ): Promise<SpaceResponseDto> {
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    await this.prisma.spaceLogo.upsert({
      where: { spaceId },
      create: {
        spaceId,
        data: file.buffer,
        contentType: file.mimetype,
        hash,
      },
      update: {
        data: file.buffer,
        contentType: file.mimetype,
        hash,
      },
    });

    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: { logo: { select: { contentType: true, hash: true } } },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    return this.toSpaceResponse(space);
  }

  async getOwnerId(spaceId: string): Promise<string | null> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true },
    });

    return space?.ownerId ?? null;
  }

  private toSpaceResponse(space: SpaceWithLogoMetadata): SpaceResponseDto {
    return new SpaceResponseDto({
      id: space.id,
      slug: space.slug,
      name: space.name,
      ownerId: space.ownerId,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      logo: space.logo
        ? new SpaceLogoResponseDto({
            contentType: space.logo.contentType ?? null,
            hash: space.logo.hash ?? null,
          })
        : null,
    });
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }

  private normalizeName(name: string): string {
    return name.trim();
  }
}
