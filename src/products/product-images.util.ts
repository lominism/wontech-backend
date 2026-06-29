const MAX_PRODUCT_IMAGES = 5;

export function normalizeImageUrls(
  imageUrls?: string[] | null,
  legacyImageUrl?: string | null,
): string[] {
  const fromArray = (imageUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
    .slice(0, MAX_PRODUCT_IMAGES);

  if (fromArray.length > 0) {
    return fromArray;
  }

  const legacy = legacyImageUrl?.trim();
  return legacy ? [legacy] : [];
}

export function primaryImageUrl(imageUrls: string[]): string | null {
  return imageUrls[0] ?? null;
}

export { MAX_PRODUCT_IMAGES };
