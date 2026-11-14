import { assert, describe, it } from 'poku';
import { escapeId, format } from '../src/index.ts';

describe('Identifiers: a name is quoted so it can never break out', () => {
  const identifiers = [
    { name: 'a plain name', value: 'users', expected: '`users`' },
    { name: 'a name with a backtick', value: 'us`ers', expected: '`us``ers`' },
    {
      name: 'a qualified name',
      value: 'app.users',
      expected: '`app`.`users`',
    },
    {
      name: 'a qualified name with backticks',
      value: 'a`pp.us`ers',
      expected: '`a``pp`.`us``ers`',
    },
    {
      name: 'a JSON path',
      value: "data->'$.a'",
      expected: "`data->'$.a'`",
    },
    {
      name: 'a JSON operator without a dot',
      value: 'data->a',
      expected: '`data->a`',
    },
    {
      name: 'a JSON path with a backtick',
      value: "da`ta->'$.a'",
      expected: "`da``ta->'$.a'`",
    },
    {
      name: 'a JSON operator with a backtick and no dot',
      value: 'da`ta->a',
      expected: '`da``ta->a`',
    },
    {
      name: 'a dash and a greater-than sign that do not form an operator',
      value: 'a-.b>c',
      expected: '`a-`.`b>c`',
    },
    {
      name: 'a name that tries to close its quoting',
      value: 'users` WHERE 1=1 -- ',
      expected: '`users`` WHERE 1=1 -- `',
    },
    {
      name: 'a qualified name that tries to close its quoting',
      value: 'a`.`b',
      expected: '`a```.```b`',
    },
    {
      name: 'a JSON path that tries to close its quoting',
      value: 'a`->`b',
      expected: '`a``->``b`',
    },
  ];

  for (const { name, value, expected } of identifiers)
    it(`should quote ${name}`, () => {
      assert.strictEqual(escapeId(value), expected);
    });
});

describe('Identifiers: a whole name stays one identifier when qualification is forbidden', () => {
  const identifiers = [
    { name: 'a plain name', value: 'users', expected: '`users`' },
    { name: 'a name with a backtick', value: 'us`ers', expected: '`us``ers`' },
    { name: 'a dotted name', value: 'app.users', expected: '`app.users`' },
    {
      name: 'a dotted name with a backtick',
      value: 'a`pp.users',
      expected: '`a``pp.users`',
    },
    {
      name: 'a JSON path with a backtick',
      value: "da`ta->'$.a'",
      expected: "`da``ta->'$.a'`",
    },
  ];

  for (const { name, value, expected } of identifiers)
    it(`should keep ${name} whole`, () => {
      assert.strictEqual(escapeId(value, true), expected);
    });
});

describe('Identifiers: placeholders and object keys follow the same quoting', () => {
  it('should quote a JSON path with a backtick bound to an identifier placeholder', () => {
    assert.strictEqual(
      format('SELECT ?? FROM t', ["da`ta->'$.a'"]),
      "SELECT `da``ta->'$.a'` FROM t"
    );
  });

  it('should quote a JSON path with a backtick used as a SET key', () => {
    assert.strictEqual(
      format('UPDATE t SET ?', [{ "da`ta->'$.a'": 1 }]),
      "UPDATE t SET `da``ta->'$.a'` = 1"
    );
  });
});
