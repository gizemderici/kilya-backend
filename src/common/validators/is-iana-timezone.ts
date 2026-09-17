import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Geçerli bir IANA saat dilimi adı mı ("Europe/Istanbul", "UTC")?
 * Intl.supportedValuesOf listesi bazı takma adları (UTC gibi) içermediği için
 * doğrudan Intl.DateTimeFormat'a soruyoruz; bilinmeyen ad RangeError fırlatır.
 * Büyük/küçük harf farkı kabul edilmez: Android da ID'yi olduğu gibi gönderir.
 */
export function isIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const resolved = new Intl.DateTimeFormat('en', {
      timeZone: value,
    }).resolvedOptions().timeZone;
    return resolved === value;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isIanaTimezone',
      target: target.constructor,
      propertyName,
      options: {
        message: 'Geçerli bir saat dilimi girin (ör. Europe/Istanbul)',
        ...options,
      },
      validator: { validate: isIanaTimezone },
    });
  };
}
