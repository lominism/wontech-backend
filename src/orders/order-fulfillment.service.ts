import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditLedgerReason } from '../clinics/clinic-group-credit-ledger.entity';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { InventoryStock } from '../products/stock.entity';
import { Sale } from '../sales/sale.entity';
import { Order } from './order.entity';

@Injectable()
export class OrderFulfillmentService {
  constructor(
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(ClinicGroupCreditLedgerEntry)
    private readonly ledgerRepo: Repository<ClinicGroupCreditLedgerEntry>,
  ) {}

  async decrementStock(productId: string, quantity: number): Promise<void> {
    const stock = await this.stockRepo.findOne({
      where: { product_id: productId },
    });

    if (!stock || stock.quantity_on_hand < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    stock.quantity_on_hand -= quantity;
    await this.stockRepo.save(stock);
  }

  async recordSaleAndCommission(order: Order): Promise<void> {
    if (!order.clinic_id || !order.clinic) {
      return;
    }

    const purchasedOn = new Date().toISOString().slice(0, 10);
    const sale = this.salesRepo.create({
      group_id: order.clinic.group_id,
      clinic_id: order.clinic_id,
      product_id: order.product_id,
      purchased_on: purchasedOn,
      quantity: order.quantity,
      unit_price_snapshot: order.unit_price_snapshot,
      commission_snapshot: order.commission_snapshot ?? null,
    });
    const savedSale = await this.salesRepo.save(sale);

    if (order.commission_snapshot) {
      const commissionTotal =
        Number(order.commission_snapshot) * order.quantity;
      const ledger = this.ledgerRepo.create({
        group_id: order.clinic.group_id,
        occurred_at: new Date(),
        change_amount: String(commissionTotal),
        reason: CreditLedgerReason.COMMISSION,
        related_sale_id: savedSale.id,
        note: `Commission for order ${order.order_no}`,
      });
      await this.ledgerRepo.save(ledger);
    }
  }
}
