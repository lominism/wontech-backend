export class CreateClinicDto {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressCode: string;
  contactEmail: string;
  parentClinicId?: string | null;
  newParentName?: string | null;
}
