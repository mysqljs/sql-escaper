/**
 * Adapted from https://github.com/mysqljs/sqlstring/blob/cd528556b4b6bcf300c3db515026935dedf7cfa1/test/unit/test-js
 * MIT LICENSE: https://github.com/mysqljs/sqlstring/blob/cd528556b4b6bcf300c3db515026935dedf7cfa1/LICENSE
 */

import { Buffer } from 'node:buffer';
import vm from 'node:vm';
import { assert, test } from 'poku';
import { escape, escapeId, format, objectToValues, raw } from '../src/index.ts';

test('value is quoted', () => {
  assert.equal(escapeId('id'), '`id`');
});

test('value can be a number', () => {
  assert.equal(escapeId(42), '`42`');
});

test('value can be an object', () => {
  assert.equal(escapeId({}), '`[object Object]`');
});

test('value toString is called', () => {
  assert.equal(
    escapeId({
      toString: () => 'foo',
    }),
    '`foo`'
  );
});

test('value toString is quoted', () => {
  assert.equal(
    escapeId({
      toString: () => 'f`oo',
    }),
    '`f``oo`'
  );
});

test('value containing escapes is quoted', () => {
  assert.equal(escapeId('i`d'), '`i``d`');
});

test('value containing separator is quoted', () => {
  assert.equal(escapeId('id1.id2'), '`id1`.`id2`');
});

test('value containing separator and escapes is quoted', () => {
  assert.equal(escapeId('id`1.i`d2'), '`id``1`.`i``d2`');
});

test('value containing separator is fully escaped when forbidQualified', () => {
  assert.equal(escapeId('id1.id2', true), '`id1.id2`');
});

test('arrays are turned into lists', () => {
  assert.equal(escapeId(['a', 'b', 't.c']), '`a`, `b`, `t`.`c`');
});

test('nested arrays are flattened', () => {
  assert.equal(escapeId(['a', ['b', ['t.c']]]), '`a`, `b`, `t`.`c`');
});

test('undefined -> NULL', () => {
  assert.equal(escape(undefined), 'NULL');
});

test('null -> NULL', () => {
  assert.equal(escape(null), 'NULL');
});

test('booleans convert to strings', () => {
  assert.equal(escape(false), 'false');
  assert.equal(escape(true), 'true');
});

test('numbers convert to strings', () => {
  assert.equal(escape(5), '5');
});

test('raw not escaped', () => {
  assert.equal(escape(raw('NOW()')), 'NOW()');
});

test('objects are turned into key value pairs', () => {
  assert.equal(escape({ a: 'b', c: 'd' }), "`a` = 'b', `c` = 'd'");
});

test('objects function properties are ignored', () => {
  assert.equal(escape({ a: 'b', c: () => {} }), "`a` = 'b'");
});

test('object values toSqlString is called', () => {
  assert.equal(
    escape({
      id: {
        toSqlString: () => 'LAST_INSERT_ID()',
      },
    }),
    '`id` = LAST_INSERT_ID()'
  );
});

test('objects toSqlString is called', () => {
  assert.equal(
    escape({
      toSqlString: () => '@foo_id',
    }),
    '@foo_id'
  );
});

test('objects toSqlString is not quoted', () => {
  assert.equal(
    escape({
      toSqlString: () => 'CURRENT_TIMESTAMP()',
    }),
    'CURRENT_TIMESTAMP()'
  );
});

test('nested objects are cast to strings', () => {
  assert.equal(escape({ a: { nested: true } }), "`a` = '[object Object]'");
});

test('nested objects use toString', () => {
  assert.equal(
    escape({
      a: {
        toString: () => 'foo',
      },
    }),
    "`a` = 'foo'"
  );
});

test('nested objects use toString is quoted', () => {
  assert.equal(
    escape({
      a: {
        toString: () => "f'oo",
      },
    }),
    "`a` = 'f\\'oo'"
  );
});

test('arrays are turned into lists', () => {
  assert.equal(escape([1, 2, 'c']), "1, 2, 'c'");
});

test('nested arrays are turned into grouped lists', () => {
  assert.equal(
    escape([
      [1, 2, 3],
      [4, 5, 6],
      ['a', 'b', { nested: true }],
    ]),
    "(1, 2, 3), (4, 5, 6), ('a', 'b', '[object Object]')"
  );
});

test('nested objects inside arrays are cast to strings', () => {
  assert.equal(escape([1, { nested: true }, 2]), "1, '[object Object]', 2");
});

test('nested objects inside arrays use toString', () => {
  assert.equal(
    escape([
      1,
      {
        toString: () => 'foo',
      },
      2,
    ]),
    "1, 'foo', 2"
  );
});

test('strings are quoted', () => {
  assert.equal(escape('Super'), "'Super'");
});

test('\\0 gets escaped', () => {
  assert.equal(escape('Sup\0er'), "'Sup\\0er'");
  assert.equal(escape('Super\0'), "'Super\\0'");
});

test('\\b gets escaped', () => {
  assert.equal(escape('Sup\ber'), "'Sup\\ber'");
  assert.equal(escape('Super\b'), "'Super\\b'");
});

test('\\n gets escaped', () => {
  assert.equal(escape('Sup\ner'), "'Sup\\ner'");
  assert.equal(escape('Super\n'), "'Super\\n'");
});

test('\\r gets escaped', () => {
  assert.equal(escape('Sup\rer'), "'Sup\\rer'");
  assert.equal(escape('Super\r'), "'Super\\r'");
});

test('\\t gets escaped', () => {
  assert.equal(escape('Sup\ter'), "'Sup\\ter'");
  assert.equal(escape('Super\t'), "'Super\\t'");
});

test('\\\\ gets escaped', () => {
  assert.equal(escape('Sup\\er'), "'Sup\\\\er'");
  assert.equal(escape('Super\\'), "'Super\\\\'");
});

test('\\u001a (ascii 26) gets replaced with \\Z', () => {
  assert.equal(escape('Sup\u001aer'), "'Sup\\Zer'");
  assert.equal(escape('Super\u001a'), "'Super\\Z'");
});

test('single quotes get escaped', () => {
  assert.equal(escape("Sup'er"), "'Sup\\'er'");
  assert.equal(escape("Super'"), "'Super\\''");
});

test('double quotes get escaped', () => {
  assert.equal(escape('Sup"er'), "'Sup\\\"er'");
  assert.equal(escape('Super"'), "'Super\\\"'");
});

test('dates are converted to YYYY-MM-DD HH:II:SS.sss', () => {
  const expected = '2012-05-07 11:42:03.002';
  const date = new Date(2012, 4, 7, 11, 42, 3, 2);
  const string = escape(date);

  assert.strictEqual(string, `'${expected}'`);
});

test('dates are converted to specified time zone "Z"', () => {
  const expected = '2012-05-07 11:42:03.002';
  const date = new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2));
  const string = escape(date, false, 'Z');

  assert.strictEqual(string, `'${expected}'`);
});

test('dates are converted to specified time zone "+01"', () => {
  const expected = '2012-05-07 12:42:03.002';
  const date = new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2));
  const string = escape(date, false, '+01');

  assert.strictEqual(string, `'${expected}'`);
});

test('dates are converted to specified time zone "+0200"', () => {
  const expected = '2012-05-07 13:42:03.002';
  const date = new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2));
  const string = escape(date, false, '+0200');

  assert.strictEqual(string, `'${expected}'`);
});

test('dates are converted to specified time zone "-05:00"', () => {
  const expected = '2012-05-07 06:42:03.002';
  const date = new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2));
  const string = escape(date, false, '-05:00');

  assert.strictEqual(string, `'${expected}'`);
});

test('dates are converted to UTC for unknown time zone', () => {
  const date = new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2));
  const expected = escape(date, false, 'Z');
  const string = escape(date, false, 'foo');

  assert.strictEqual(string, expected);
});

test('invalid dates are converted to null', () => {
  const date = new Date(Number.NaN);
  const string = escape(date);

  assert.strictEqual(string, 'NULL');
});

test('dates from other isolates are converted', () => {
  const expected = '2012-05-07 11:42:03.002';
  const date = vm.runInNewContext('new Date(2012, 4, 7, 11, 42, 3, 2)');
  const string = escape(date);

  assert.strictEqual(string, `'${expected}'`);
});

test('buffers are converted to hex', () => {
  const buffer = Buffer.from([0, 1, 254, 255]);
  const string = escape(buffer);

  assert.strictEqual(string, "X'0001feff'");
});

test('buffers object cannot inject SQL', () => {
  const buffer = Buffer.from([0, 1, 254, 255]);
  buffer.toString = () => "00' OR '1'='1";
  const string = escape(buffer);

  assert.strictEqual(string, "X'00\\' OR \\'1\\'=\\'1'");
});

test('NaN -> NaN', () => {
  assert.equal(escape(Number.NaN), 'NaN');
});

test('Infinity -> Infinity', () => {
  assert.equal(escape(Number.POSITIVE_INFINITY), 'Infinity');
});

test('question marks are replaced with escaped array values', () => {
  const sql = format('? and ?', ['a', 'b']);
  assert.equal(sql, "'a' and 'b'");
});

test('double quest marks are replaced with escaped id', () => {
  const sql = format('SELECT * FROM ?? WHERE id = ?', ['table', 42]);
  assert.equal(sql, 'SELECT * FROM `table` WHERE id = 42');
});

test('triple question marks are ignored', () => {
  const sql = format('? or ??? and ?', ['foo', 'bar', 'fizz', 'buzz']);
  assert.equal(sql, "'foo' or ??? and 'bar'");
});

test('extra question marks are left untouched', () => {
  const sql = format('? and ?', ['a']);
  assert.equal(sql, "'a' and ?");
});

test('extra arguments are not used', () => {
  const sql = format('? and ?', ['a', 'b', 'c']);
  assert.equal(sql, "'a' and 'b'");
});

test('question marks within values do not cause issues', () => {
  const sql = format('? and ?', ['hello?', 'b']);
  assert.equal(sql, "'hello?' and 'b'");
});

test('undefined is ignored', () => {
  const sql = format('?', undefined, false);
  assert.equal(sql, '?');
});

test('unsafe objects is not converted to values', () => {
  const sql = format('?', { hello: 'world' }, false);
  assert.equal(sql, "'[object Object]'");
});

test('objects is converted to values', () => {
  const sql = format('SET ?', { hello: 'world' }, false);
  assert.equal(sql, "SET `hello` = 'world'");
});

test('objects is not converted to values', () => {
  const sql1 = format('?', { hello: 'world' }, true);
  assert.equal(sql1, "'[object Object]'");

  const sql2 = format(
    '?',
    {
      toString: () => 'hello',
    },
    true
  );
  assert.equal(sql2, "'hello'");

  const sql3 = format(
    '?',
    {
      toSqlString: () => '@foo',
    },
    true
  );
  assert.equal(sql3, '@foo');
});

test('sql is untouched if no values are provided', () => {
  const sql = format('SELECT ??');
  assert.equal(sql, 'SELECT ??');
});

test('sql is untouched if values are provided but there are no placeholders', () => {
  const sql = format('SELECT COUNT(*) FROM table', ['a', 'b']);
  assert.equal(sql, 'SELECT COUNT(*) FROM table');
});

test('creates object', () => {
  assert.equal(typeof raw('NOW()'), 'object');
});

test('rejects number', () => {
  assert.throws(() => {
    // @ts-expect-error
    raw(42);
  });
});

test('rejects undefined', () => {
  assert.throws(() => {
    // @ts-expect-error
    raw();
  });
});

test('object has toSqlString', () => {
  assert.equal(typeof raw('NOW()').toSqlString, 'function');
});

test('toSqlString returns sql as-is', () => {
  assert.equal(
    raw("NOW() AS 'current_time'").toSqlString(),
    "NOW() AS 'current_time'"
  );
});

test('empty objects return empty string for objectToValues', () => {
  assert.equal(objectToValues({}), '');
});

test('placeholders work with arithmetic operators', () => {
  const sql = format('SELECT ? - ? + ? / ?', [10, 3, 20, 4]);
  assert.equal(sql, 'SELECT 10 - 3 + 20 / 4');
});
