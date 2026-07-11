import type { SqlValue } from '../src/types.ts';
import { assert, test } from 'poku';
import { escape } from '../src/index.ts';

/**
 * Temporal's lib types (`esnext.temporal`) are opt-in and are not part of the
 * lib set this package builds against (`target`/`lib` ES2018), so Temporal is
 * declared structurally here rather than pulling that lib in. The tests are
 * skipped on runtimes that do not expose the Temporal global.
 */
type TemporalNamespace = {
  Instant: {
    from(iso: string): SqlValue & {
      toZonedDateTimeISO(timeZone: string): SqlValue;
    };
  };
  PlainDateTime: { from(iso: string): SqlValue };
  PlainDate: { from(iso: string): SqlValue };
  PlainTime: { from(iso: string): SqlValue };
};

const Temporal = (globalThis as { Temporal?: TemporalNamespace }).Temporal;

test('Temporal.Instant is escaped like a Date', () => {
  if (!Temporal) return;
  const instant = Temporal.Instant.from('2012-05-07T11:42:03.002Z');

  assert.strictEqual(escape(instant, false, 'Z'), "'2012-05-07 11:42:03.002'");
});

test('Temporal.Instant honors the time zone argument', () => {
  if (!Temporal) return;
  const instant = Temporal.Instant.from('2012-05-07T11:42:03.002Z');

  assert.strictEqual(
    escape(instant, false, '+0200'),
    "'2012-05-07 13:42:03.002'"
  );
});

test('Temporal.ZonedDateTime is escaped as an absolute time', () => {
  if (!Temporal) return;
  const zoned = Temporal.Instant.from(
    '2012-05-07T11:42:03.002Z'
  ).toZonedDateTimeISO('+02:00');

  assert.strictEqual(escape(zoned, false, 'Z'), "'2012-05-07 11:42:03.002'");
});

test('Temporal.PlainDateTime is escaped ignoring the time zone', () => {
  if (!Temporal) return;
  const plain = Temporal.PlainDateTime.from('2012-05-07T11:42:03.002');

  assert.strictEqual(
    escape(plain, false, '+0200'),
    "'2012-05-07 11:42:03.002'"
  );
});

test('Temporal.PlainDate is escaped as a DATE literal', () => {
  if (!Temporal) return;

  assert.strictEqual(
    escape(Temporal.PlainDate.from('2012-05-07')),
    "'2012-05-07'"
  );
});

test('Temporal.PlainTime is escaped as a TIME literal', () => {
  if (!Temporal) return;

  assert.strictEqual(escape(Temporal.PlainTime.from('11:42:03')), "'11:42:03'");
});
