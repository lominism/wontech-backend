import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(FirebaseAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('cloudinary-signature')
  getCloudinarySignature() {
    return this.uploadsService.getImageUploadSignature();
  }
}
