export const normalizeStorageKey = (rawKey: string, bucket: string, prefix: string) => {
  let key = rawKey.trim();
  if (!key) {
    return key;
  }

  key = key.split('?')[0];
  key = key.replace(/^https?:\/\/[^/]+\//i, '');
  key = key.replace(/^\/+/, '');

  const bucketPrefix = `${bucket}/`.replace(/\/+$/, '/');
  if (key.startsWith(bucketPrefix)) {
    key = key.slice(bucketPrefix.length);
  }

  const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';
  if (normalizedPrefix && key.startsWith(normalizedPrefix)) {
    return key;
  }

  return normalizedPrefix ? `${normalizedPrefix}${key}` : key;
};

