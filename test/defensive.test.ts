import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format, escape, escapeId, raw } from '../src/index.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, false);

describe('Defensive: an object bound outside SET never becomes query structure', () => {
  it('should keep an object at a WHERE placeholder as one inert quoted value', () => {
    assert.strictEqual(
      format('SELECT * FROM users WHERE password = ?', [{ password: 1 }]),
      "SELECT * FROM users WHERE password = '[object Object]'"
    );
  });

  it('should keep an ownership filter as a value comparison, not a column-to-column one', () => {
    assert.strictEqual(
      format('SELECT * FROM posts WHERE user_id = ?', [
        { status: 'published' },
      ]),
      "SELECT * FROM posts WHERE user_id = '[object Object]'"
    );
  });

  it('should still expand an object where the author wrote SET', () => {
    assert.strictEqual(
      format('UPDATE users SET ? WHERE id = 1', [{ name: 'a', age: 5 }]),
      "UPDATE users SET `name` = 'a', `age` = 5 WHERE id = 1"
    );
  });
});

describe('Defensive: a stray SET keyword cannot open object expansion', () => {
  it('should stop the assignment list at WHERE so a later object stays inert', () => {
    assert.strictEqual(
      format('UPDATE users SET role = ? WHERE id = ?', ['user', { id: true }]),
      "UPDATE users SET role = 'user' WHERE id = '[object Object]'"
    );
  });

  it('should ignore a set written inside a line comment', () => {
    assert.strictEqual(
      format('SELECT * FROM t -- set here\nWHERE d = ?', [{ d: 1 }]),
      "SELECT * FROM t -- set here\nWHERE d = '[object Object]'"
    );
  });

  it('should ignore a set written inside a string literal', () => {
    assert.strictEqual(
      format("SELECT * FROM t WHERE note = 'set x = 1' AND c = ?", [{ c: 1 }]),
      "SELECT * FROM t WHERE note = 'set x = 1' AND c = '[object Object]'"
    );
  });
});

describe('Defensive: an identifier cannot break out of its backticks', () => {
  it('should double a backtick inside an identifier', () => {
    assert.strictEqual(escapeId('a`b'), '`a``b`');
  });

  it('should quote a dotted name per segment', () => {
    assert.strictEqual(escapeId('a.b'), '`a`.`b`');
  });

  it('should double the backtick of an expanded object key inside SET', () => {
    assert.strictEqual(
      format('UPDATE t SET ?', [{ 'a`b': 1 }]),
      'UPDATE t SET `a``b` = 1'
    );
  });

  it('should quote a ?? identifier taken from input', () => {
    assert.strictEqual(
      format('SELECT ?? FROM t', ['a`b']),
      'SELECT `a``b` FROM t'
    );
  });
});

describe('Defensive: the raw passthrough stays narrow', () => {
  it('should emit a developer raw() fragment verbatim', () => {
    assert.strictEqual(escape(raw('NOW()')), 'NOW()');
  });

  it('should emit verbatim only for a real toSqlString function', () => {
    assert.strictEqual(
      format('INSERT INTO logs (created_at) VALUES (?)', [
        { toSqlString: () => 'NOW()' },
      ]),
      'INSERT INTO logs (created_at) VALUES (NOW())'
    );
  });

  it('should stringify an object whose toSqlString is a string, as untrusted JSON delivers it', () => {
    assert.strictEqual(
      format('INSERT INTO logs (created_at) VALUES (?)', [
        { toSqlString: 'NOW()' },
      ]),
      "INSERT INTO logs (created_at) VALUES ('[object Object]')"
    );
  });
});
