import { isIanaTimezone } from './is-iana-timezone.js';

describe('isIanaTimezone', () => {
  it.each(['Europe/Istanbul', 'UTC', 'America/New_York', 'Asia/Tokyo'])(
    '%s geçerli',
    (tz) => expect(isIanaTimezone(tz)).toBe(true),
  );

  it.each(['Istanbul', 'GMT+3', 'europe/istanbul', '', 42, null])(
    '%s geçersiz',
    (tz) => expect(isIanaTimezone(tz)).toBe(false),
  );
});
