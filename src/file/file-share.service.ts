import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { FilePresignedUrlService } from './presigned-url.service';
import { CreateFileShareDto } from './dto/create-file-share.dto';
import { FileShareResponseDto } from './dto/file-share-response.dto';
import { PublicFileShareResponseDto } from './dto/public-file-share-response.dto';
import { SpaceMemberService } from '../space-member/space-member.service';
import { SpaceRole } from '@prisma/client';

const INVALID_OR_EXPIRED_MESSAGE = 'Share link is invalid or has expired.';

type FileShareRecord = {
  id: string;
  fileId: string;
  spaceId: string;
  shareToken: string;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
};

type FileShareWithFile = FileShareRecord & {
  file: {
    id: string;
    filename: string;
    mimetype: string;
    size: bigint;
    s3Key: string;
  };
};

@Injectable()
export class FileShareService {
  private readonly baseShareUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly presignedUrls: FilePresignedUrlService,
    private readonly mailService: MailService,
    private readonly spaceMembers: SpaceMemberService,
    configService: ConfigService,
  ) {
    const configuredBaseUrl =
      configService.get<string>('FILE_SHARE_BASE_URL') ??
      configService.get<string>('APP_BASE_URL') ??
      configService.get<string>('APP_URL') ??
      configService.get<string>('FRONTEND_URL');

    this.baseShareUrl = (configuredBaseUrl ?? 'https://myapp.com').replace(
      /\/+$/,
      '',
    );
  }

  async createShare(
    userId: string,
    fileId: string,
    dto: CreateFileShareDto,
  ): Promise<FileShareResponseDto> {
    const file = await this.getAuthorizedFile(fileId, userId);

    const expiresAt = this.resolveExpiry(dto.expiresAt);
    const note = this.normalizeNote(dto.note);
    const shareToken = await this.generateUniqueToken();

    const share = (await this.fileShares.create({
      data: {
        fileId,
        spaceId: file.spaceId,
        shareToken,
        expiresAt,
        note,
      },
    })) as FileShareRecord;

    return this.toFileShareResponse(share);
  }

  async listShares(
    userId: string,
    fileId: string,
  ): Promise<FileShareResponseDto[]> {
    const file = await this.getAuthorizedFile(fileId, userId);

    const now = new Date();

    const shares = (await this.fileShares.findMany({
      where: {
        fileId,
        spaceId: file.spaceId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    })) as FileShareRecord[];

    return shares.map((share) => this.toFileShareResponse(share));
  }

  async revokeShare(
    userId: string,
    fileId: string,
    shareId: string,
  ): Promise<void> {
    const file = await this.getAuthorizedFile(fileId, userId);

    const share = (await this.fileShares.findFirst({
      where: { id: shareId, fileId, spaceId: file.spaceId },
      select: { id: true },
    })) as { id: string } | null;

    if (!share) {
      throw new NotFoundException('Share not found.');
    }

    await this.fileShares.delete({ where: { id: shareId } });
  }

  async getShareByToken(
    shareToken: string,
  ): Promise<PublicFileShareResponseDto> {
    const share = (await this.fileShares.findUnique({
      where: { shareToken },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            s3Key: true,
          },
        },
      },
    })) as FileShareWithFile | null;

    if (!share) {
      throw new NotFoundException(INVALID_OR_EXPIRED_MESSAGE);
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      throw new NotFoundException(INVALID_OR_EXPIRED_MESSAGE);
    }

    const url = await this.presignedUrls.getDownloadUrl(share.file.s3Key);

    return new PublicFileShareResponseDto({
      id: share.id,
      fileId: share.fileId,
      spaceId: share.spaceId,
      shareToken: share.shareToken,
      filename: share.file.filename,
      mimetype: share.file.mimetype,
      size: Number(share.file.size),
      url,
      note: share.note ?? null,
      expiresAt: share.expiresAt ?? null,
      createdAt: share.createdAt,
    });
  }

  async sendShareEmail(
    userId: string,
    fileId: string,
    shareId: string,
    recipientEmail: string,
  ): Promise<void> {
    const file = await this.getAuthorizedFile(fileId, userId);

    const share = (await this.fileShares.findFirst({
      where: { id: shareId, fileId, spaceId: file.spaceId },
      include: {
        file: { select: { filename: true } },
      },
    })) as (FileShareRecord & { file: { filename: string } }) | null;

    if (!share) {
      throw new NotFoundException('Share not found.');
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      throw new BadRequestException('Cannot email an expired share link.');
    }

    const url = this.buildShareUrl(share.shareToken);

    await this.mailService.sendFileShareEmail(
      recipientEmail,
      url,
      share.file.filename,
      share.note ?? null,
      share.expiresAt ?? null,
    );
  }

  private async getAuthorizedFile(
    fileId: string,
    userId: string,
  ): Promise<{ id: string; spaceId: string }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, spaceId: true },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    await this.spaceMembers.assertRole(file.spaceId, userId, SpaceRole.EDITOR);

    return file;
  }

  private async generateUniqueToken(): Promise<string> {
    while (true) {
      const token = randomBytes(24).toString('hex');
      const existing = (await this.fileShares.findUnique({
        where: { shareToken: token },
        select: { id: true },
      })) as { id: string } | null;

      if (!existing) {
        return token;
      }
    }
  }

  private resolveExpiry(expiresAt?: string): Date | null {
    if (!expiresAt) {
      return null;
    }

    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid expiration date.');
    }

    if (parsed <= new Date()) {
      throw new BadRequestException('Expiration must be set in the future.');
    }

    return parsed;
  }

  private normalizeNote(note?: string): string | null {
    if (!note) {
      return null;
    }

    const trimmed = note.trim();
    return trimmed.length ? trimmed : null;
  }

  private toFileShareResponse(share: FileShareRecord): FileShareResponseDto {
    return new FileShareResponseDto({
      id: share.id,
      fileId: share.fileId,
      spaceId: share.spaceId,
      shareToken: share.shareToken,
      url: this.buildShareUrl(share.shareToken),
      note: share.note ?? null,
      expiresAt: share.expiresAt ?? null,
      createdAt: share.createdAt,
    });
  }

  private buildShareUrl(token: string): string {
    return `${this.baseShareUrl}/share/${token}`;
  }

  private get fileShares() {
    return (this.prisma as unknown as { fileShare: any }).fileShare;
  }
}
