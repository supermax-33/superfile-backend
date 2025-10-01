import 'reflect-metadata';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/google/callback';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? 'test-resend-key';
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'test-bucket';
process.env.AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-openai-key';
