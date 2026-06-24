/**
 * Seed data mirrored from wontech-frontend/lib/mock-data.ts (mockClinics).
 * `key` matches mock ids so parentKey can resolve branch → parent links.
 */
export type ClinicSeed = {
  key: string;
  groupName: string;
  name: string;
  addressStreet: string;
  addressCity: string;
  addressCode: string;
  contactEmail: string;
  parentKey?: string | null;
};

export const CLINIC_SEEDS: ClinicSeed[] = [
  {
    key: 'c-1',
    groupName: 'Wontech Central Clinic',
    name: 'Wontech Central Clinic',
    addressStreet: '88 Sukhumvit Soi 24',
    addressCity: 'Khlong Toei, Bangkok',
    addressCode: '10110',
    contactEmail: 'contact@wontech-central.clinic',
    parentKey: null,
  },
  {
    key: 'c-2',
    groupName: 'Siam Skin & Wellness',
    name: 'Siam Skin & Wellness',
    addressStreet: '12 Rama I Rd',
    addressCity: 'Pathum Wan, Bangkok',
    addressCode: '10330',
    contactEmail: 'contact@siamskin.clinic',
    parentKey: null,
  },
  {
    key: 'c-3',
    groupName: 'Siam Skin & Wellness',
    name: 'Siam Skin — Sukhumvit',
    addressStreet: '101 Sukhumvit Rd',
    addressCity: 'Watthana, Bangkok',
    addressCode: '10110',
    contactEmail: 'sukhumvit@siamskin.clinic',
    parentKey: 'c-2',
  },
  {
    key: 'c-4',
    groupName: 'Siam Skin & Wellness',
    name: 'Siam Skin — Silom',
    addressStreet: '45 Silom Rd',
    addressCity: 'Bang Rak, Bangkok',
    addressCode: '10500',
    contactEmail: 'silom@siamskin.clinic',
    parentKey: 'c-2',
  },
  {
    key: 'c-5',
    groupName: 'Radiance MedSpa',
    name: 'Radiance MedSpa',
    addressStreet: '200 Phahonyothin Rd',
    addressCity: 'Chatuchak, Bangkok',
    addressCode: '10900',
    contactEmail: 'contact@radiancemedspa.clinic',
    parentKey: null,
  },
  {
    key: 'c-6',
    groupName: 'Radiance MedSpa',
    name: 'Radiance MedSpa — Ari',
    addressStreet: '8 Ari Soi 1',
    addressCity: 'Phaya Thai, Bangkok',
    addressCode: '10400',
    contactEmail: 'ari@radiancemedspa.clinic',
    parentKey: 'c-5',
  },
  {
    key: 'c-7',
    groupName: 'Glow Clinic',
    name: 'Glow Clinic',
    addressStreet: '33 Thong Lo Soi 13',
    addressCity: 'Watthana, Bangkok',
    addressCode: '10110',
    contactEmail: 'contact@glow.clinic',
    parentKey: null,
  },
];
