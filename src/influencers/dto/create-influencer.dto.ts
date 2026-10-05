export class CreateInfluencerDto {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressCode: string;
  contactEmail: string;
  contactPhone: string;
  parentInfluencerId?: string | null;
  newParentName?: string | null;
}
