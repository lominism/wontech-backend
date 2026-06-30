export class AdjustCreditDto {
  amount: number;
  direction: 'increase' | 'decrease';
  note?: string | null;
}
