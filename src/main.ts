import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load correct env file
dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 👇 Allow multiple frontends (dev + prod)
  const allowedOrigins =
    process.env.FRONTEND_URLS?.split(',') || ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow tools like Postman / curl
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();