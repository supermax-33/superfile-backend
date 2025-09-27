import { Injectable } from '@nestjs/common';
import { FileUploadProgressSnapshot, FileUploadProgressState } from 'types';

@Injectable()
export class FileProgressService {
  private readonly uploads = new Map<string, FileUploadProgressState>();

  start(fileId: string, bytesTotal: number): void {
    const now = new Date();
    this.uploads.set(fileId, {
      fileId,
      bytesTransferred: 0,
      bytesTotal,
      startedAt: now,
      updatedAt: now,
    });
  }

  update(fileId: string, bytesTransferred: number, bytesTotal?: number): void {
    const existing = this.uploads.get(fileId);
    if (!existing) {
      return;
    }

    this.uploads.set(fileId, {
      ...existing,
      bytesTransferred,
      bytesTotal: bytesTotal ?? existing.bytesTotal,
      updatedAt: new Date(),
    });
  }

  complete(fileId: string): void {
    this.uploads.delete(fileId);
  }

  fail(fileId: string): void {
    this.uploads.delete(fileId);
  }

  getSnapshot(fileId: string): FileUploadProgressSnapshot | null {
    const state = this.uploads.get(fileId);
    if (!state) {
      return null;
    }

    const safeTotal = state.bytesTotal > 0 ? state.bytesTotal : 1;
    const percent = Math.min(
      100,
      Math.max(0, Math.round((state.bytesTransferred / safeTotal) * 100)),
    );

    return {
      fileId: state.fileId,
      bytesTransferred: state.bytesTransferred,
      bytesTotal: state.bytesTotal,
      percent,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
    };
  }
}
