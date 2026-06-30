import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OrderReceiptEmailPayload = {
  to: string;
  customerName: string;
  orderNo: string;
  productName: string;
  quantity: number;
  total: number;
  trackingUrl: string;
};

export type ShipmentNotificationEmailPayload = {
  to: string;
  customerName: string;
  orderNo: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOrderReceipt(payload: OrderReceiptEmailPayload): Promise<void> {
    const provider = this.config.get<string>('EMAIL_PROVIDER') ?? 'log';

    if (provider === 'log') {
      this.logger.log(
        `Order receipt email to ${payload.to}: order ${payload.orderNo}, tracking ${payload.trackingUrl}`,
      );
      return;
    }

    // Placeholder for Resend/SendGrid/SES integration.
    this.logger.warn(
      `EMAIL_PROVIDER=${provider} is not implemented; receipt not sent`,
    );
  }

  async sendShipmentNotification(
    payload: ShipmentNotificationEmailPayload,
  ): Promise<void> {
    const provider = this.config.get<string>('EMAIL_PROVIDER') ?? 'log';

    if (provider === 'log') {
      this.logger.log(
        `Shipment notification to ${payload.to}: order ${payload.orderNo}, carrier ${payload.carrier}, tracking ${payload.trackingNumber}, url ${payload.trackingUrl}`,
      );
      return;
    }

    this.logger.warn(
      `EMAIL_PROVIDER=${provider} is not implemented; shipment notification not sent`,
    );
  }
}
