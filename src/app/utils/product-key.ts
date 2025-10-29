export const createProductKey = (gtin: string | null | undefined, gln?: string | null | undefined): string => {
  const normalizedGtin = gtin ?? '';
  const normalizedGln = gln ?? '';

  return `${normalizedGtin}::${normalizedGln}`;
};

export const extractGtinFromKey = (key: string | null | undefined): string => {
  if (!key) {
    return '';
  }

  const [gtin] = key.split('::', 2);
  return gtin ?? '';
};

export const extractGlnFromKey = (key: string | null | undefined): string => {
  if (!key) {
    return '';
  }

  const [, gln] = key.split('::', 2);
  return gln ?? '';
};
