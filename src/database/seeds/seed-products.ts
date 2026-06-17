import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Product } from '../../products/product.entity';
import { InventoryStock } from '../../products/stock.entity';
import { PRODUCT_SEEDS } from './products.seed-data';

dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

async function seedProducts(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [Product, InventoryStock],
    ssl: { rejectUnauthorized: false },
  });

  await dataSource.initialize();

  const productsRepo = dataSource.getRepository(Product);
  const stockRepo = dataSource.getRepository(InventoryStock);

  let created = 0;
  let skipped = 0;

  for (const item of PRODUCT_SEEDS) {
    const existing = await productsRepo.findOne({ where: { sku: item.sku } });
    if (existing) {
      console.log(`  skip  ${item.sku} (already exists)`);
      skipped++;
      continue;
    }

    const product = productsRepo.create({
      sku: item.sku,
      name: item.name,
      category: item.category,
      price: String(item.price),
      commission_amount:
        item.commission === null ? null : String(item.commission),
      description: item.description,
      brand: item.brand,
      weight: item.weight,
      dimensions: item.dimensions,
      origin_country: item.originCountry,
      image_url: null,
    });

    const saved = await productsRepo.save(product);

    const stock = stockRepo.create({
      product_id: saved.id,
      quantity_on_hand: Math.max(0, item.stock),
    });
    await stockRepo.save(stock);

    console.log(`  added ${item.sku} — ${item.name}`);
    created++;
  }

  await dataSource.destroy();

  console.log(`\nSeed complete: ${created} created, ${skipped} skipped.`);
}

seedProducts().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
