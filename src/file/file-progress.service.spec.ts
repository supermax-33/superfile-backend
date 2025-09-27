import { FileProgressService } from './file-progress.service';

describe('FileProgressService', () => {
  it('tracks upload progress and clears state on completion', () => {
    const service = new FileProgressService();
    const fileId = 'file-123';

    service.start(fileId, 1000);
    service.update(fileId, 400);

    const snapshot = service.getSnapshot(fileId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.bytesTransferred).toBe(400);
    expect(snapshot?.bytesTotal).toBe(1000);
    expect(snapshot?.percent).toBe(40);

    service.update(fileId, 1000);
    const finalSnapshot = service.getSnapshot(fileId);
    expect(finalSnapshot?.percent).toBe(100);

    service.complete(fileId);
    expect(service.getSnapshot(fileId)).toBeNull();
  });

  it('ignores updates for unknown files', () => {
    const service = new FileProgressService();

    expect(service.getSnapshot('missing')).toBeNull();
    service.update('missing', 10);
    expect(service.getSnapshot('missing')).toBeNull();
  });
});
