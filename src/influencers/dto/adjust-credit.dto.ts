export class AdjustInfluencerCreditDto {
  amount: number;
  direction: 'increase' | 'decrease';
  note?: string | null;
}
