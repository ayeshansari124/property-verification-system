import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject unauthenticated access to protected assignments endpoint', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .send({
        name: 'E2E Test Assignment',
        propertyIds: ['315f4e5e-4bb9-48f8-baf3-98a0d2380927'],
      })
      .expect(401);
  });

  it('should reject unauthenticated access to pending reviews', async () => {
    await request(app.getHttpServer()).get('/reviews/pending').expect(401);
  });
});
