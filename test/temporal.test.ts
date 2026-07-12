import { Temporal as TemporalPolyfill } from '@js-temporal/polyfill';
import { assert, test } from 'poku';
import { escape } from '../src/index.ts';

/**
 * Uses the polyfill on runtimes without a Temporal global so these always run
 * @todo remove this, and the @js-temporal/polyfill library, once node version 26 is lts (it is "current" for now)
 */
const Temporal = globalThis.Temporal ?? TemporalPolyfill;

test('Temporal.Instant is escaped like a Date', () => {
  const instant = Temporal.Instant.from('2012-05-07T11:42:03.002Z');

  assert.strictEqual(escape(instant, false, 'Z'), "'2012-05-07 11:42:03.002'");
});

test('Temporal.Instant honors the time zone argument', () => {
  const instant = Temporal.Instant.from('2012-05-07T11:42:03.002Z');

  assert.strictEqual(
    escape(instant, false, '+0200'),
    "'2012-05-07 13:42:03.002'"
  );
});

test('Temporal.ZonedDateTime is escaped as an absolute time', () => {
  const zoned = Temporal.Instant.from(
    '2012-05-07T11:42:03.002Z'
  ).toZonedDateTimeISO('+02:00');

  assert.strictEqual(escape(zoned, false, 'Z'), "'2012-05-07 11:42:03.002'");
});

test('Temporal.PlainDateTime is escaped ignoring the time zone', () => {
  const plain = Temporal.PlainDateTime.from('2012-05-07T11:42:03.002');

  assert.strictEqual(
    escape(plain, false, '+0200'),
    "'2012-05-07 11:42:03.002'"
  );
});

test('Temporal.PlainDate is escaped as a DATE literal', () => {
  assert.strictEqual(
    escape(Temporal.PlainDate.from('2012-05-07')),
    "'2012-05-07'"
  );
});

test('Temporal.PlainTime is escaped as a TIME literal', () => {
  assert.strictEqual(escape(Temporal.PlainTime.from('11:42:03')), "'11:42:03'");
});

test('Temporal types without a MySQL equivalent fall back to their ISO string', () => {
  assert.strictEqual(
    escape(Temporal.Duration.from({ hours: 2, minutes: 30 })),
    "'PT2H30M'"
  );
  assert.strictEqual(
    escape(Temporal.PlainYearMonth.from('2012-05')),
    "'2012-05'"
  );
  assert.strictEqual(escape(Temporal.PlainMonthDay.from('05-07')), "'05-07'");
});
