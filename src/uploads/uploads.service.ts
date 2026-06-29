import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export type CloudinarySignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

@Injectable()
export class UploadsService {
  private readonly folder: string;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }

    this.folder =
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER') ?? 'wontech/products';
  }

  getImageUploadSignature(): CloudinarySignature {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured on the server',
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp, folder: this.folder };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: this.folder,
    };
  }
}
