import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Clinic } from '../../clinics/clinic.entity';
import { ClinicGroup } from '../../clinics/clinic-group.entity';
import { CLINIC_SEEDS } from './clinics.seed-data';

dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

async function seedClinics(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    ssl: { rejectUnauthorized: false },
  });

  await dataSource.initialize();

  const clinicsRepo = dataSource.getRepository(Clinic);
  const groupsRepo = dataSource.getRepository(ClinicGroup);

  const groupIdsByName = new Map<string, string>();
  const clinicIdsByKey = new Map<string, string>();

  let created = 0;
  let skipped = 0;

  const roots = CLINIC_SEEDS.filter((item) => !item.parentKey);
  const branches = CLINIC_SEEDS.filter((item) => item.parentKey);

  for (const item of [...roots, ...branches]) {
    const existing = await clinicsRepo.findOne({ where: { name: item.name } });
    if (existing) {
      console.log(`  skip  ${item.name} (already exists)`);
      clinicIdsByKey.set(item.key, existing.id);
      skipped++;
      continue;
    }

    let groupId = groupIdsByName.get(item.groupName);
    if (!groupId) {
      let group = await groupsRepo.findOne({ where: { name: item.groupName } });
      if (!group) {
        group = await groupsRepo.save(
          groupsRepo.create({ name: item.groupName }),
        );
        console.log(`  group ${item.groupName}`);
      }
      groupId = group.id;
      groupIdsByName.set(item.groupName, groupId);
    }

    const parentClinicId = item.parentKey
      ? (clinicIdsByKey.get(item.parentKey) ?? null)
      : null;

    if (item.parentKey && !parentClinicId) {
      throw new Error(
        `Parent clinic "${item.parentKey}" not found for "${item.name}"`,
      );
    }

    const clinic = clinicsRepo.create({
      name: item.name,
      address_street: item.addressStreet,
      address_city: item.addressCity,
      address_code: item.addressCode,
      contact_email: item.contactEmail,
      group_id: groupId,
      parent_clinic_id: parentClinicId,
    });

    const saved = await clinicsRepo.save(clinic);
    clinicIdsByKey.set(item.key, saved.id);
    console.log(`  added ${item.name}`);
    created++;
  }

  await dataSource.destroy();

  console.log(`\nSeed complete: ${created} created, ${skipped} skipped.`);
}

seedClinics().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
