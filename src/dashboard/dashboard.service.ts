import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/clinic.entity';
import { Order, OrderSource, OrderStatus } from '../orders/order.entity';
import {
  OrderListItem,
  OrdersService,
} from '../orders/orders.service';
import { Sale } from '../sales/sale.entity';

export type DashboardRange = 'lastYear' | 'last3Months' | 'lastWeek';
export type ClinicMode = 'total' | 'active';

export type DashboardStats = {
  revenue: { value: number };
  orders: { value: number };
  unitsSold: number;
  activeClinics: number;
  revenueOverview: { month: string; revenue: number }[];
  salesBySource: { source: OrderSource; value: number }[];
  recentOrders: OrderListItem[];
};

const COUNTABLE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.AWAITING_SHIPMENT,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
];

const ALL_SOURCES = [
  OrderSource.WONTECH,
  OrderSource.LAZADA,
  OrderSource.SHOPEE,
];

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Clinic)
    private readonly clinicsRepo: Repository<Clinic>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    private readonly ordersService: OrdersService,
  ) {}

  async getStats(
    revenueRange: DashboardRange = 'lastYear',
    ordersRange: DashboardRange = 'lastYear',
    clinicMode: ClinicMode = 'total',
  ): Promise<DashboardStats> {
    const [
      revenue,
      orders,
      unitsSold,
      activeClinics,
      revenueOverview,
      salesBySource,
      recentOrders,
    ] = await Promise.all([
      this.sumRevenue(revenueRange),
      this.countOrders(ordersRange),
      this.sumUnitsSold(),
      this.countClinics(clinicMode),
      this.getRevenueOverview(),
      this.getSalesBySource(),
      this.ordersService.listRecentCountable(12),
    ]);

    return {
      revenue: { value: revenue },
      orders: { value: orders },
      unitsSold,
      activeClinics,
      revenueOverview,
      salesBySource,
      recentOrders,
    };
  }

  private rangeStart(range: DashboardRange): Date {
    const now = new Date();
    const start = new Date(now);

    switch (range) {
      case 'lastWeek':
        start.setDate(start.getDate() - 7);
        break;
      case 'last3Months':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'lastYear':
      default:
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return start;
  }

  private applyCountableFilter(
    qb: ReturnType<Repository<Order>['createQueryBuilder']>,
  ) {
    qb.andWhere('o.status IN (:...statuses)', {
      statuses: COUNTABLE_STATUSES,
    });
  }

  private async sumRevenue(range: DashboardRange): Promise<number> {
    const start = this.rangeStart(range);
    const qb = this.ordersRepo.createQueryBuilder('o');
    this.applyCountableFilter(qb);
    qb.andWhere('o.createdAt >= :start', { start });

    const row = await qb
      .select(
        'COALESCE(SUM(o.quantity * o.unit_price_snapshot::numeric), 0)',
        'total',
      )
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async countOrders(range: DashboardRange): Promise<number> {
    const start = this.rangeStart(range);
    const qb = this.ordersRepo.createQueryBuilder('o');
    this.applyCountableFilter(qb);
    qb.andWhere('o.createdAt >= :start', { start });

    return qb.getCount();
  }

  private async sumUnitsSold(): Promise<number> {
    const qb = this.ordersRepo.createQueryBuilder('o');
    this.applyCountableFilter(qb);

    const row = await qb
      .select('COALESCE(SUM(o.quantity), 0)', 'total')
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async countClinics(mode: ClinicMode): Promise<number> {
    if (mode === 'active') {
      const row = await this.salesRepo
        .createQueryBuilder('sale')
        .select('COUNT(DISTINCT sale.clinic_id)', 'total')
        .where('sale.clinic_id IS NOT NULL')
        .getRawOne<{ total: string }>();

      return Number(row?.total ?? 0);
    }

    return this.clinicsRepo.count();
  }

  private async getRevenueOverview(): Promise<
    { month: string; revenue: number }[]
  > {
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: MONTH_LABELS[start.getMonth()],
        start,
        end,
      });
    }

    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .select("TO_CHAR(DATE_TRUNC('month', o.createdAt), 'YYYY-MM')", 'month')
      .addSelect(
        'COALESCE(SUM(o.quantity * o.unit_price_snapshot::numeric), 0)',
        'revenue',
      )
      .where('o.status IN (:...statuses)', { statuses: COUNTABLE_STATUSES })
      .andWhere('o.createdAt >= :start', { start: months[0].start })
      .groupBy("DATE_TRUNC('month', o.createdAt)")
      .getRawMany<{ month: string; revenue: string }>();

    const revenueByMonth = new Map(
      rows.map((row) => [row.month, Number(row.revenue)]),
    );

    return months.map((month) => ({
      month: month.label,
      revenue: revenueByMonth.get(month.key) ?? 0,
    }));
  }

  private async getSalesBySource(): Promise<
    { source: OrderSource; value: number }[]
  > {
    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .select('o.source', 'source')
      .addSelect(
        'COALESCE(SUM(o.quantity * o.unit_price_snapshot::numeric), 0)',
        'value',
      )
      .where('o.status IN (:...statuses)', { statuses: COUNTABLE_STATUSES })
      .groupBy('o.source')
      .getRawMany<{ source: OrderSource; value: string }>();

    const valueBySource = new Map(
      rows.map((row) => [row.source, Number(row.value)]),
    );

    return ALL_SOURCES.map((source) => ({
      source,
      value: valueBySource.get(source) ?? 0,
    }));
  }
}
