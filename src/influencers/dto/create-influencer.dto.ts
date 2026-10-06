export class CreateInfluencerDto {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressCode: string;
  contactEmail: string;
  contactPhone: string;
  agencyId?: string | null;
  newAgencyName?: string | null;
}
