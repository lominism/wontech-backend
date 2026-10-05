import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreditLedgerReason } from '../clinics/clinic-group-credit-ledger.entity';
import { ClinicGroupCreditLedgerEntry } from '../clinics/clinic-group-credit-ledger.entity';
import { Clinic } from '../clinics/clinic.entity';
import { InfluencerCreditLedgerReason } from '../influencers/influencer-group-credit-ledger.entity';
import { InfluencerGroupCreditLedgerEntry } from '../influencers/influencer-group-credit-ledger.entity';
import { Influencer } from '../influencers/influencer.entity';
import { InventoryStock } from '../products/stock.entity';
import { Sale } from '../sales/sale.entity';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrderFulfillmentService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
  ) {}

  async decrementStock(productId: string, quantity: number): Promise<void> {
    await this.decrementStockWith(this.stockRepo, productId, quantity);
  }

  async recordSaleAndCommission(order: Order): Promise<void> {
    await this.writeSale(this.dataSource.manager, order);
  }

  /**
   * Marks a pending order paid and records commission in one transaction.
   * Returns the order when this call performed that transition.
   * If payment already succeeded but the influencer credit is missing, records it.
   */
  async settlePaidOrder(
    orderId: string,
    provider: string,
    reference: string,
  ): Promise<Order | null> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        if (order.influencer_id) {
          await this.writeSale(manager, order);
        }
        return null;
      }

      await this.decrementStockWith(
        manager.getRepository(InventoryStock),
        order.product_id,
        order.quantity,
      );
      await this.writeSale(manager, order);

      order.status = OrderStatus.AWAITING_SHIPMENT;
      order.payment_provider = provider;
      order.payment_reference = reference;
      await manager.save(order);

      return manager.findOne(Order, {
        where: { id: order.id },
        relations: { product: true },
      });
    });
  }

  private async decrementStockWith(
    stockRepo: Repository<InventoryStock>,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const stock = await stockRepo.findOne({
      where: { product_id: productId },
    });

    if (!stock || stock.quantity_on_hand < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    stock.quantity_on_hand -= quantity;
    await stockRepo.save(stock);
  }

  private async writeSale(manager: EntityManager, order: Order): Promise<void> {
    if (!order.id) {
      return;
    }

    const existing = await manager.findOne(Sale, {
      where: { order_id: order.id },
    });
    if (existing) {
      return;
    }

    if (order.influencer_id) {
      await this.recordInfluencerSale(manager, order);
      return;
    }

    if (!order.clinic_id) {
      return;
    }

    await this.recordClinicSale(manager, order);
  }

  private async recordClinicSale(
    manager: EntityManager,
    order: Order,
  ): Promise<void> {
    const clinic =
      order.clinic?.group_id != null
        ? order.clinic
        : await manager.findOne(Clinic, { where: { id: order.clinic_id! } });

    if (!clinic?.group_id || !order.clinic_id) {
      return;
    }

    const savedSale = await manager.getRepository(Sale).save(
      manager.getRepository(Sale).create({
        order_id: order.id,
        group_id: clinic.group_id,
        clinic_id: order.clinic_id,
        product_id: order.product_id,
        purchased_on: new Date().toISOString().slice(0, 10),
        quantity: order.quantity,
        unit_price_snapshot: order.unit_price_snapshot,
        commission_snapshot: order.commission_snapshot ?? null,
      }),
    );

    if (!order.commission_snapshot) {
      return;
    }

    const commissionTotal =
      Number(order.commission_snapshot) * order.quantity;
    await manager.getRepository(ClinicGroupCreditLedgerEntry).save(
      manager.getRepository(ClinicGroupCreditLedgerEntry).create({
        group_id: clinic.group_id,
        occurred_at: new Date(),
        change_amount: String(commissionTotal),
        reason: CreditLedgerReason.COMMISSION,
        related_sale_id: savedSale.id,
        note: `Commission for order ${order.order_no}`,
      }),
    );
  }

  private async recordInfluencerSale(
    manager: EntityManager,
    order: Order,
  ): Promise<void> {
    const influencer =
      order.influencer?.group_id != null
        ? order.influencer
        : await manager.findOne(Influencer, {
            where: { id: order.influencer_id! },
          });

    if (!influencer?.group_id || !order.influencer_id) {
      return;
    }

    const savedSale = await manager.getRepository(Sale).save(
      manager.getRepository(Sale).create({
        order_id: order.id,
        influencer_group_id: influencer.group_id,
        influencer_id: order.influencer_id,
        product_id: order.product_id,
        purchased_on: new Date().toISOString().slice(0, 10),
        quantity: order.quantity,
        unit_price_snapshot: order.unit_price_snapshot,
        commission_snapshot: order.commission_snapshot ?? null,
      }),
    );

    if (!order.commission_snapshot) {
      return;
    }

    const commissionTotal =
      Number(order.commission_snapshot) * order.quantity;
    await manager.getRepository(InfluencerGroupCreditLedgerEntry).save(
      manager.getRepository(InfluencerGroupCreditLedgerEntry).create({
        group_id: influencer.group_id,
        occurred_at: new Date(),
        change_amount: String(commissionTotal),
        reason: InfluencerCreditLedgerReason.COMMISSION,
        related_sale_id: savedSale.id,
        note: `KOL commission for order ${order.order_no}`,
      }),
    );
  }
}
