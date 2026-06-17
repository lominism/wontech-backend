export type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  price: number;
  commission: number | null;
  stock: number;
  description: string;
  brand: string;
  weight: string;
  dimensions: string;
  originCountry: string;
};

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    sku: 'WT-SK-001',
    name: 'HydraGlow Serum 30ml',
    category: 'Skincare',
    price: 1290,
    commission: 129,
    stock: 142,
    description:
      'A lightweight hydrating serum infused with hyaluronic acid and botanical extracts. Absorbs quickly to plump and smooth skin, leaving a dewy, radiant finish.',
    brand: 'Wontech Labs',
    weight: '30 ml',
    dimensions: '3 x 3 x 11 cm',
    originCountry: 'South Korea',
  },
  {
    sku: 'WT-SK-002',
    name: 'Vitamin C Brightening Cream',
    category: 'Skincare',
    price: 1590,
    commission: 159,
    stock: 8,
    description:
      'Brightening day cream with stabilized Vitamin C to even skin tone and reduce the appearance of dark spots over time. Non-greasy and suitable for daily use.',
    brand: 'Wontech Labs',
    weight: '50 g',
    dimensions: '6 x 6 x 5 cm',
    originCountry: 'South Korea',
  },
  {
    sku: 'WT-DV-001',
    name: 'LED Therapy Mask',
    category: 'Devices',
    price: 8900,
    commission: 890,
    stock: 23,
    description:
      'Clinical-grade LED therapy mask delivering red and blue light wavelengths to support skin renewal and target blemishes. Rechargeable with a 20-minute auto-timer.',
    brand: 'Wontech Devices',
    weight: '420 g',
    dimensions: '24 x 19 x 12 cm',
    originCountry: 'China',
  },
  {
    sku: 'WT-DV-002',
    name: 'Microcurrent Facial Wand',
    category: 'Devices',
    price: 6500,
    commission: null,
    stock: 0,
    description:
      'Handheld microcurrent wand that delivers gentle electrical stimulation to tone and lift facial muscles. Includes conductive gel and a USB-C charging cable.',
    brand: 'Wontech Devices',
    weight: '180 g',
    dimensions: '16 x 5 x 5 cm',
    originCountry: 'China',
  },
  {
    sku: 'WT-CN-001',
    name: 'Disposable Treatment Masks (50pk)',
    category: 'Consumables',
    price: 450,
    commission: null,
    stock: 320,
    description:
      'Box of 50 single-use treatment masks made from soft, breathable non-woven fabric. Ideal for serum and mask applications during in-clinic facials.',
    brand: 'Wontech Essentials',
    weight: '500 g',
    dimensions: '22 x 15 x 10 cm',
    originCountry: 'Thailand',
  },
  {
    sku: 'WT-CN-002',
    name: 'Nitrile Gloves (100pk)',
    category: 'Consumables',
    price: 280,
    commission: null,
    stock: 56,
    description:
      'Box of 100 powder-free nitrile examination gloves. Latex-free, textured fingertips for grip, suitable for sensitive skin.',
    brand: 'Wontech Essentials',
    weight: '1.1 kg',
    dimensions: '24 x 12 x 8 cm',
    originCountry: 'Malaysia',
  },
  {
    sku: 'WT-SP-001',
    name: 'Collagen Boost Capsules',
    category: 'Supplements',
    price: 990,
    commission: 99,
    stock: 4,
    description:
      'Daily collagen supplement capsules formulated to support skin elasticity and hydration from within. 60 capsules per bottle.',
    brand: 'Wontech Nutrition',
    weight: '90 g',
    dimensions: '6 x 6 x 11 cm',
    originCountry: 'Japan',
  },
  {
    sku: 'WT-SP-002',
    name: 'Marine Collagen Powder',
    category: 'Supplements',
    price: 1490,
    commission: 149,
    stock: 78,
    description:
      'Premium marine collagen peptide powder, unflavored and easily dissolved into drinks. Supports skin, hair, and joint health.',
    brand: 'Wontech Nutrition',
    weight: '300 g',
    dimensions: '10 x 10 x 14 cm',
    originCountry: 'Japan',
  },
  {
    sku: 'WT-SK-003',
    name: 'Retinol Night Repair Cream',
    category: 'Skincare',
    price: 1890,
    commission: 189,
    stock: 35,
    description:
      'Overnight repair cream with encapsulated retinol to smooth fine lines and refine texture. Formulated with ceramides to minimize irritation.',
    brand: 'Wontech Labs',
    weight: '50 g',
    dimensions: '6 x 6 x 5 cm',
    originCountry: 'South Korea',
  },
  {
    sku: 'WT-SK-004',
    name: 'AHA/BHA Exfoliating Toner',
    category: 'Skincare',
    price: 890,
    commission: 89,
    stock: 61,
    description:
      'Gentle daily exfoliating toner with a balanced blend of AHAs and BHAs to unclog pores and brighten dull skin. Alcohol-free formula.',
    brand: 'Wontech Labs',
    weight: '200 ml',
    dimensions: '5 x 5 x 15 cm',
    originCountry: 'South Korea',
  },
];
