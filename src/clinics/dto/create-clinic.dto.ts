export class CreateClinicDto {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressCode: string;
  contactEmail: string;
  contactPhone: string;
  parentClinicId?: string | null;
  newParentName?: string | null;
}
