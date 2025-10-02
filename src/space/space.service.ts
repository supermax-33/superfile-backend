import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Space, SpaceLogo, SpaceRole } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import {
  SpaceLogoResponseDto,
  SpaceResponseDto,
} from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { normalizeName, normalizeSlug, formatError } from 'utils/helpers';
import { OpenAiVectorStoreService } from '../openai/openai-vector-store.service';
import { VECTOR_STORE_NAME_PREFIX } from 'config';

type SpaceWithLogoMetadata = Space & {
  logo: Pick<SpaceLogo, 'contentType' | 'hash'> | null;
};

@Injectable()
export class SpaceService {
  private readonly logger = new Logger(SpaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiVectorStoreService,
  ) {}

  private toSpaceResponse(space: SpaceWithLogoMetadata): SpaceResponseDto {
    return new SpaceResponseDto({
      id: space.id,
      slug: space.slug,
      name: space.name,
      ownerId: space.ownerId,
      vectorStoreId: space.vectorStoreId ?? null,
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

  async create(
    ownerId: string,
    dto: CreateSpaceDto,
  ): Promise<SpaceResponseDto> {
    const normalizedName = normalizeName(dto.name);
    const normalizedSlug = normalizeSlug(dto.slug);
    const vectorStoreName = this.buildVectorStoreName(normalizedSlug);

    let vectorStoreId: string;
    try {
      vectorStoreId = await this.openAi.createVectorStore(vectorStoreName);
    } catch (error) {
      throw new InternalServerErrorException(
        formatError('Failed to provision vector store for space', error),
      );
    }

    try {
      const space = await this.prisma.$transaction(async (tx) => {
        const created = await tx.space.create({
          data: {
            name: normalizedName,
            slug: normalizedSlug,
            ownerId,
            vectorStoreId,
          },
          include: { logo: { select: { contentType: true, hash: true } } },
        });

        await tx.spaceMember.create({
          data: {
            spaceId: created.id,
            userId: ownerId,
            role: SpaceRole.OWNER,
          },
        });

        return created;
      });

      return this.toSpaceResponse(space);
    } catch (error) {
      await this.cleanupVectorStore(vectorStoreId);
      throw error;
    }
  }

  async update(
    spaceId: string,
    dto: UpdateSpaceDto,
  ): Promise<SpaceResponseDto> {
    const data: Partial<Pick<Space, 'name' | 'slug'>> = {};

    if (dto.name !== undefined) {
      const normalizedName = normalizeName(dto.name);
      if (!normalizedName) {
        throw new BadRequestException('Space name cannot be empty.');
      }
      data.name = normalizedName;
    }

    if (dto.slug !== undefined) {
      data.slug = normalizeSlug(dto.slug);
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
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { vectorStoreId: true },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    if (space.vectorStoreId) {
      try {
        await this.openAi.deleteVectorStore(space.vectorStoreId);
      } catch (error) {
        throw new InternalServerErrorException(
          formatError(
            'Failed to delete vector store associated with this space',
            error,
          ),
        );
      }
    }

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

  async findOne(spaceId: string): Promise<SpaceResponseDto> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: { logo: { select: { contentType: true, hash: true } } },
    });

    if (!space) {
      throw new NotFoundException('Space not found.');
    }

    return this.toSpaceResponse(space);
  }

  private buildVectorStoreName(slug: string): string {
    const trimmedSlug = slug.slice(0, 40) || 'space';
    return `${VECTOR_STORE_NAME_PREFIX}-${trimmedSlug}-${randomUUID()}`;
  }

  private async cleanupVectorStore(vectorStoreId: string): Promise<void> {
    try {
      await this.openAi.deleteVectorStore(vectorStoreId);
    } catch (error) {
      this.logger.warn(
        `Failed to clean up vector store ${vectorStoreId}: ${error}`,
      );
    }
  }
}
