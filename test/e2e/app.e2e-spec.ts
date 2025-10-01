import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import path from 'path';
import { execSync } from 'child_process';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MailService } from '../../src/mail/mail.service';
import { S3FileStorageService } from '../../src/file/s3-file-storage.service';
import { OpenAiVectorStoreService } from '../../src/openai/openai-vector-store.service';
import { OPENAI_CLIENT_TOKEN } from '../../src/openai/openai.tokens';
import { FilePresignedUrlService } from '../../src/file/presigned-url.service';
import { GoogleOAuthGuard } from '../../src/auth/guards/google-oauth.guard';
import {
  FakeMailService,
  FakeOpenAiClient,
  FakeOpenAiVectorStoreService,
  FakeS3FileStorageService,
  FakeFilePresignedUrlService,
  FakeGoogleOAuthGuard,
} from './support/fakes';

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-id',
          email: 'google.user@example.com',
          name: 'Google Test',
          email_verified: true,
        }),
      }),
    })),
  };
});

describe('Superfile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let prismaClient: any;
  let httpServer: any;
  const mailService = new FakeMailService();
  const vectorStore = new FakeOpenAiVectorStoreService();
  const s3Storage = new FakeS3FileStorageService();
  const fileUrls = new FakeFilePresignedUrlService();
  const openAiClient = new FakeOpenAiClient(vectorStore);

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be configured to run e2e tests');
    }

    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailService)
      .overrideProvider(S3FileStorageService)
      .useValue(s3Storage)
      .overrideProvider(OpenAiVectorStoreService)
      .useValue(vectorStore)
      .overrideProvider(FilePresignedUrlService)
      .useValue(fileUrls)
      .overrideProvider(OPENAI_CLIENT_TOKEN)
      .useValue(openAiClient)
      .overrideGuard(GoogleOAuthGuard)
      .useValue(new FakeGoogleOAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning();

    await app.init();

    prisma = moduleRef.get(PrismaService);
    prismaClient = prisma as unknown as any;
    httpServer = app.getHttpServer();

    await prismaClient.conversationMessage?.deleteMany?.();
    await prismaClient.conversation?.deleteMany?.();
    await prismaClient.reminder?.deleteMany?.();
    await prismaClient.file?.deleteMany?.();
    await prismaClient.spaceLogo?.deleteMany?.();
    await prismaClient.space?.deleteMany?.();
    await prismaClient.session?.deleteMany?.();
    await prismaClient.passwordResetToken?.deleteMany?.();
    await prismaClient.verificationToken?.deleteMany?.();
    await prismaClient.user?.deleteMany?.();
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes the full workflow across all endpoints', async () => {
    const api = request(httpServer);
    const email = 'e2e.user@example.com';
    const initialPassword = 'Sup3rStr0ng!';
    const changedPassword = 'EvenB3tter!';
    const finalPassword = 'Ultimat3Pass!';
    const slugSuffix = Date.now();

    const signupRes = await api
      .post('/api/v1/auth/signup')
      .send({ email, password: initialPassword })
      .expect(201);
    expect(signupRes.body.message).toContain('Signup');

    await api
      .post('/api/v1/auth/resend-otp')
      .send({ email })
      .expect(201);

    const verificationToken = await prismaClient.verificationToken.findFirst({
      where: { user: { email } },
      orderBy: { createdAt: 'desc' },
    });
    expect(verificationToken).toBeTruthy();

    await api
      .post('/api/v1/auth/verify-email')
      .send({ code: verificationToken!.verificationToken })
      .expect(201);

    const loginRes = await api
      .post('/api/v1/auth/login')
      .send({ email, password: initialPassword })
      .expect(201);
    expect(loginRes.body.accessToken).toBeDefined();
    let accessToken = loginRes.body.accessToken as string;
    let refreshToken = loginRes.body.refreshToken as string;

    const refreshRes = await api
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(201);
    accessToken = refreshRes.body.accessToken;
    refreshToken = refreshRes.body.refreshToken;

    await api
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: changedPassword,
      })
      .expect(201);

    const loginAfterChange = await api
      .post('/api/v1/auth/login')
      .send({ email, password: changedPassword })
      .expect(201);
    accessToken = loginAfterChange.body.accessToken;
    refreshToken = loginAfterChange.body.refreshToken;

    await api.post('/api/v1/auth/forgot-password').send({ email }).expect(201);

    const resetToken = await prismaClient.passwordResetToken.findFirst({
      where: { user: { email } },
      orderBy: { createdAt: 'desc' },
    });
    expect(resetToken).toBeTruthy();

    const verifyReset = await api
      .post('/api/v1/auth/verify-reset-code')
      .send({ code: resetToken!.resetToken })
      .expect(201);
    expect(verifyReset.body.accessToken).toBeDefined();

    await api
      .post('/api/v1/auth/reset-password')
      .send({ token: verifyReset.body.accessToken, newPassword: finalPassword })
      .expect(201);

    const finalLogin = await api
      .post('/api/v1/auth/login')
      .send({ email, password: finalPassword })
      .expect(201);
    accessToken = finalLogin.body.accessToken;
    refreshToken = finalLogin.body.refreshToken;

    const googleTokenLogin = await api
      .post('/api/v1/auth/google/token')
      .send({ idToken: 'mock-id-token' })
      .expect(201);
    expect(googleTokenLogin.body.accessToken).toBeDefined();

    const googleRedirect = await api.get('/api/v1/auth/google').expect(302);
    expect(googleRedirect.headers.location).toContain('accounts.google.com');

    const googleCallback = await api.get('/api/v1/auth/google/callback').expect(200);
    expect(googleCallback.body.accessToken).toBeDefined();

    const createSpaceRes = await api
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Alpha Space', slug: `alpha-space-${slugSuffix}` })
      .expect(201);
    const spaceId = createSpaceRes.body.id as string;
    expect(spaceId).toBeDefined();

    await api
      .get(`/api/v1/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const updateSpaceRes = await api
      .patch(`/api/v1/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Alpha Space', slug: `updated-alpha-${slugSuffix}` })
      .expect(200);
    expect(updateSpaceRes.body.name).toContain('Updated Alpha Space');

    const logoPath = path.resolve(__dirname, '../../test_files/supermax.PNG');
    const logoRes = await api
      .put(`/api/v1/spaces/${spaceId}/logo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', logoPath)
      .expect(200);
    expect(logoRes.body.logo).toBeDefined();

    const spaceToDelete = await api
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Disposable Space', slug: `disposable-${slugSuffix}` })
      .expect(201);

    await api
      .delete(`/api/v1/spaces/${spaceToDelete.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const pdfPath = path.resolve(__dirname, '../../test_files/about_superfile.pdf');

    const uploadResA = await api
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('spaceId', spaceId)
      .field('note', 'Initial note')
      .attach('files', pdfPath)
      .expect(201);
    const fileA = uploadResA.body[0];
    expect(fileA.status).toBe('SUCCESS');

    const uploadResB = await api
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('spaceId', spaceId)
      .attach('files', pdfPath)
      .expect(201);
    const fileB = uploadResB.body[0];

    const uploadResC = await api
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('spaceId', spaceId)
      .attach('files', pdfPath)
      .expect(201);
    const fileC = uploadResC.body[0];

    const listFilesRes = await api
      .get('/api/v1/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ spaceId })
      .expect(200);
    expect(listFilesRes.body.length).toBeGreaterThanOrEqual(3);

    await api
      .get(`/api/v1/files/${fileA.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const noteRes = await api
      .get(`/api/v1/files/${fileA.id}/note`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(noteRes.body.note).toBe('Initial note');

    const updatedNote = await api
      .patch(`/api/v1/files/${fileA.id}/note`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'Updated note' })
      .expect(200);
    expect(updatedNote.body.note).toBe('Updated note');

    await api
      .delete(`/api/v1/files/${fileA.id}/note`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const progressRes = await api
      .get(`/api/v1/files/${fileA.id}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(progressRes.body.percent).toBe(100);

    const statusRes = await api
      .patch(`/api/v1/files/${fileA.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(statusRes.body.status).toBe('SUCCESS');

    const downloadManyRes = await api
      .post('/api/v1/files/download')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fileIds: [fileA.id, fileB.id] })
      .expect(200);
    expect(downloadManyRes.body.files).toHaveLength(2);

    const deleteManyRes = await api
      .delete('/api/v1/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fileIds: [fileC.id] })
      .expect(200);
    expect(deleteManyRes.body.deleted).toContain(fileC.id);

    const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createReminderRes = await api
      .post(`/api/v1/spaces/${spaceId}/reminders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Initial reminder',
        note: 'Remember this task',
        remindAt,
        fileIds: [fileA.id],
      })
      .expect(201);
    const reminderId = createReminderRes.body.id as string;
    expect(createReminderRes.body.files).toHaveLength(1);

    const listReminders = await api
      .get(`/api/v1/spaces/${spaceId}/reminders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(listReminders.body.length).toBe(1);

    await api
      .get(`/api/v1/spaces/${spaceId}/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const updateReminderRes = await api
      .patch(`/api/v1/spaces/${spaceId}/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Updated reminder',
        note: 'Updated note',
        remindAt,
        fileIds: [fileA.id],
      })
      .expect(200);
    expect(updateReminderRes.body.title).toBe('Updated reminder');

    const addReminderFiles = await api
      .post(`/api/v1/spaces/${spaceId}/reminders/${reminderId}/files`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fileIds: [fileB.id] })
      .expect(201);
    expect(addReminderFiles.body.files.length).toBe(2);

    const removeReminderFile = await api
      .delete(`/api/v1/spaces/${spaceId}/reminders/${reminderId}/files/${fileB.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(removeReminderFile.body.files.length).toBe(1);

    await api
      .delete(`/api/v1/spaces/${spaceId}/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const createConversationRes = await api
      .post(`/api/v1/spaces/${spaceId}/conversations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Planning conversation' })
      .expect(201);
    const conversationId = createConversationRes.body.id as string;

    const listConversationsRes = await api
      .get(`/api/v1/spaces/${spaceId}/conversations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(listConversationsRes.body.length).toBe(1);

    const initialMessages = await api
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(initialMessages.body).toHaveLength(0);

    const sseResponse = await api
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'How should I plan?' })
      .buffer(true)
      .parse((res, cb) => {
        let text = '';
        res.on('data', (chunk: Buffer) => {
          text += chunk.toString();
        });
        res.on('end', () => cb(null, text));
      })
      .expect(200);
    expect(sseResponse.text).toContain('Mock assistant response');

    const conversationMessages = await api
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(conversationMessages.body.length).toBeGreaterThanOrEqual(2);
    const assistantMessage = conversationMessages.body.find(
      (message: any) => message.role === 'ASSISTANT',
    );
    expect(assistantMessage.content).toContain('Mock assistant response');
    expect(assistantMessage.references.files[0].downloadUrl).toContain(
      'files.example.com',
    );

    await api
      .delete(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await api
      .delete(`/api/v1/files/${fileB.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const sessionsBefore = await api
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(sessionsBefore.body.length).toBeGreaterThan(0);

    const sessionId = sessionsBefore.body[0].id as string;
    await api
      .delete(`/api/v1/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const postDeletionLogin = await api
      .post('/api/v1/auth/login')
      .send({ email, password: finalPassword })
      .expect(201);
    accessToken = postDeletionLogin.body.accessToken;

    await api
      .delete('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const finalLoginForCleanup = await api
      .post('/api/v1/auth/login')
      .send({ email, password: finalPassword })
      .expect(201);
    accessToken = finalLoginForCleanup.body.accessToken;

    await api
      .delete(`/api/v1/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
