import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format } from '../src/index.ts';
import { localDate } from './__utils__/localDate.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, true);

describe('SELECT without values', () => {
  it('should return the query unchanged', () => {
    const query = format('SELECT * FROM users', []);

    assert.strictEqual(query, 'SELECT * FROM users');
  });
});

describe('SELECT with object parameter', () => {
  it('should generate a safe query for a legitimate string', () => {
    const query = format('SELECT * FROM users WHERE email = ?', [
      'admin@example.com',
    ]);

    assert.strictEqual(
      query,
      "SELECT * FROM users WHERE email = 'admin@example.com'"
    );
  });

  it('should not generate a SQL fragment for object { email: 1 }', () => {
    const query = format('SELECT * FROM users WHERE email = ?', [{ email: 1 }]);

    assert.strictEqual(
      query,
      "SELECT * FROM users WHERE email = '[object Object]'"
    );
  });
});

describe('SELECT with multiple parameters', () => {
  it('should generate a safe query for a wrong password', () => {
    const query = format(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      ['admin@example.com', 'wrong_password']
    );

    assert.strictEqual(
      query,
      "SELECT * FROM users WHERE email = 'admin@example.com' AND password = 'wrong_password'"
    );
  });

  it('should not alter the query structure for object { email: 1 }', () => {
    const query = format(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      [{ email: 1 }, 'user1_pass']
    );

    assert.strictEqual(
      query,
      "SELECT * FROM users WHERE email = '[object Object]' AND password = 'user1_pass'"
    );
  });
});

describe('DELETE with object parameter', () => {
  it('should generate a safe query for a legitimate id', () => {
    const query = format('DELETE FROM users WHERE id = ?', [1]);

    assert.strictEqual(query, 'DELETE FROM users WHERE id = 1');
  });

  it('should not generate a SQL fragment for object { id: true }', () => {
    const query = format('DELETE FROM users WHERE id = ?', [{ id: true }]);

    assert.strictEqual(query, "DELETE FROM users WHERE id = '[object Object]'");
  });
});

describe('SET with object parameter', () => {
  it('should stringify object instead of expanding for UPDATE SET clause', () => {
    const query = format('UPDATE users SET ?', [
      { name: 'foo', email: 'bar@test.com' },
    ]);

    assert.strictEqual(query, "UPDATE users SET '[object Object]'");
  });

  it('should stringify object when SET is immediately followed by placeholder', () => {
    const query = format('UPDATE users SET?', [{ name: 'foo' }]);

    assert.strictEqual(query, "UPDATE users SET'[object Object]'");
  });

  it('should stringify object instead of expanding for INSERT SET clause', () => {
    const query = format('INSERT INTO users SET ?', [
      { name: 'foo', email: 'bar@test.com' },
    ]);

    assert.strictEqual(query, "INSERT INTO users SET '[object Object]'");
  });

  it('should stringify object instead of expanding for ON DUPLICATE KEY UPDATE clause', () => {
    const query = format(
      'INSERT INTO users (name, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE ?',
      ['foo', 'bar@test.com', { name: 'foo', email: 'bar@test.com' }]
    );

    assert.strictEqual(
      query,
      "INSERT INTO users (name, email) VALUES ('foo', 'bar@test.com') ON DUPLICATE KEY UPDATE '[object Object]'"
    );
  });
});

describe('SELECT and INSERT with Date parameter', () => {
  it('should format Date as a valid datetime string, not as [object Object]', () => {
    const date = new Date('2026-01-01T10:30:00.000Z');
    const query = format('SELECT * FROM events WHERE created_at = ?', [date]);

    assert.strictEqual(
      query,
      `SELECT * FROM events WHERE created_at = '${localDate(date)}'`
    );
  });

  it('should format Date in INSERT statements', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const query = format(
      'INSERT INTO logs (message, created_at) VALUES (?, ?)',
      ['test', date]
    );

    assert.strictEqual(
      query,
      `INSERT INTO logs (message, created_at) VALUES ('test', '${localDate(date)}')`
    );
  });
});

describe('Object placeholder after SET but outside SET clause', () => {
  it('should stringify objects in both SET and WHERE clauses', () => {
    const query = format('UPDATE users SET ? WHERE id = ?', [
      { name: 'foo' },
      { id: 1 },
    ]);

    assert.strictEqual(
      query,
      "UPDATE users SET '[object Object]' WHERE id = '[object Object]'"
    );
  });

  it('should stringify objects in WHERE with multiple conditions after SET', () => {
    const query = format('UPDATE users SET ? WHERE id = ? AND role = ?', [
      { name: 'bar' },
      { id: 1 },
      'admin',
    ]);

    assert.strictEqual(
      query,
      "UPDATE users SET '[object Object]' WHERE id = '[object Object]' AND role = 'admin'"
    );
  });

  it('should stringify objects in WHERE after multiline UPDATE SET', () => {
    const query = format(
      `UPDATE users
       SET ?
       WHERE status = ?`,
      [{ name: 'foo', email: 'bar@test.com' }, { status: 'active' }]
    );

    assert.strictEqual(
      query,
      `UPDATE users
       SET '[object Object]'
       WHERE status = '[object Object]'`
    );
  });

  it('should stringify object in subquery after SET', () => {
    const query = format(
      'UPDATE users SET ? WHERE id IN (SELECT user_id FROM roles WHERE role = ?)',
      [{ active: true }, { role: 'admin' }]
    );

    assert.strictEqual(
      query,
      "UPDATE users SET '[object Object]' WHERE id IN (SELECT user_id FROM roles WHERE role = '[object Object]')"
    );
  });

  it('should stringify object in WHERE with ORDER BY/LIMIT after SET', () => {
    const query = format(
      'UPDATE users SET ? WHERE active = ? ORDER BY id LIMIT ?',
      [{ name: 'test' }, { active: true }, 10]
    );

    assert.strictEqual(
      query,
      "UPDATE users SET '[object Object]' WHERE active = '[object Object]' ORDER BY id LIMIT 10"
    );
  });
});

describe('Uint8Array parameter', () => {
  it('should format Uint8Array as hex string', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in hex
    const query = format('SELECT * FROM files WHERE data = ?', [data]);

    assert.strictEqual(query, "SELECT * FROM files WHERE data = X'48656c6c6f'");
  });

  it('should format Uint8Array in INSERT statements', () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const query = format('INSERT INTO files (name, data) VALUES (?, ?)', [
      'test',
      data,
    ]);

    assert.strictEqual(
      query,
      "INSERT INTO files (name, data) VALUES ('test', X'deadbeef')"
    );
  });

  it('should format empty Uint8Array', () => {
    const data = new Uint8Array([]);
    const query = format('SELECT * FROM files WHERE data = ?', [data]);

    assert.strictEqual(query, "SELECT * FROM files WHERE data = X''");
  });

  it('should not expand Uint8Array in SET clause', () => {
    const data = new Uint8Array([0x01, 0x02]);
    const query = format('UPDATE files SET ?', [data]);

    assert.strictEqual(query, "UPDATE files SET X'0102'");
  });
});

describe('SET as a column name', () => {
  it('should stringify object when SET is a column name in WHERE', () => {
    const query = format('SELECT * FROM t WHERE SET = ? AND id = ?', [
      'x',
      { id: 1 },
    ]);

    assert.strictEqual(
      query,
      "SELECT * FROM t WHERE SET = 'x' AND id = '[object Object]'"
    );
  });

  it('should stringify objects when SET is a column name with multiple objects', () => {
    const query = format('SELECT * FROM t WHERE SET = ? AND data = ?', [
      { set: 'val' },
      { data: 'test' },
    ]);

    assert.strictEqual(
      query,
      "SELECT * FROM t WHERE SET = '[object Object]' AND data = '[object Object]'"
    );
  });
});
