import { assert, describe, test } from 'poku';
import { format, raw } from '../src/index.ts';

describe('URLs and connection strings', () => {
  test('JDBC connection string', () => {
    const connStr =
      'jdbc:mysql://localhost:3306/db?useSSL=false;serverTimezone=UTC';
    const sql = format('INSERT INTO configs (name, value) VALUES (?, ?)', [
      'database_url',
      connStr,
    ]);
    assert.equal(
      sql,
      "INSERT INTO configs (name, value) VALUES ('database_url', 'jdbc:mysql://localhost:3306/db?useSSL=false;serverTimezone=UTC')"
    );
  });

  test('legacy URL with semicolon params', () => {
    const url = 'https://example.com/search?q=test;page=2;sort=date';
    const sql = format('INSERT INTO bookmarks (url) VALUES (?)', [url]);
    assert.equal(
      sql,
      "INSERT INTO bookmarks (url) VALUES ('https://example.com/search?q=test;page=2;sort=date')"
    );
  });

  test('Redis connection string', () => {
    const redis = 'redis://user:pass@localhost:6379/0;timeout=5000';
    const sql = format('UPDATE settings SET ? WHERE key = ?', [
      { value: redis },
      'redis_url',
    ]);
    assert.equal(
      sql,
      "UPDATE settings SET `value` = 'redis://user:pass@localhost:6379/0;timeout=5000' WHERE key = 'redis_url'"
    );
  });
});

describe('Windows paths and environment variables', () => {
  test('Windows PATH variable', () => {
    const path = 'C:\\Program Files\\App;D:\\Tools;C:\\Windows\\System32';
    const sql = format('INSERT INTO env_vars (name, value) VALUES (?, ?)', [
      'PATH',
      path,
    ]);
    assert.equal(
      sql,
      "INSERT INTO env_vars (name, value) VALUES ('PATH', 'C:\\\\Program Files\\\\App;D:\\\\Tools;C:\\\\Windows\\\\System32')"
    );
  });

  test('classpath-style configuration', () => {
    const classpath = 'lib/app.jar;lib/utils.jar;lib/deps/*';
    const sql = format('INSERT INTO java_configs (classpath) VALUES (?)', [
      classpath,
    ]);
    assert.equal(
      sql,
      "INSERT INTO java_configs (classpath) VALUES ('lib/app.jar;lib/utils.jar;lib/deps/*')"
    );
  });
});

describe('CSV and delimited data', () => {
  test('semicolon-delimited CSV row', () => {
    const csvRow = 'John;Doe;john@example.com;Active';
    const sql = format('INSERT INTO imports (raw_data) VALUES (?)', [csvRow]);
    assert.equal(
      sql,
      "INSERT INTO imports (raw_data) VALUES ('John;Doe;john@example.com;Active')"
    );
  });

  test('European locale CSV (uses ; as separator)', () => {
    const data = 'Name;Price;Quantity\nCoffee;4,50;100\nBread;2,00;50';
    const sql = format(
      'INSERT INTO csv_imports (content, locale) VALUES (?, ?)',
      [data, 'de-DE']
    );
    assert.equal(
      sql,
      "INSERT INTO csv_imports (content, locale) VALUES ('Name;Price;Quantity\\nCoffee;4,50;100\\nBread;2,00;50', 'de-DE')"
    );
  });
});

describe('Code snippets and scripts stored in database', () => {
  test('JavaScript code snippet', () => {
    const code = 'const x = 1; const y = 2; return x + y;';
    const sql = format('INSERT INTO snippets (language, code) VALUES (?, ?)', [
      'javascript',
      code,
    ]);
    assert.equal(
      sql,
      "INSERT INTO snippets (language, code) VALUES ('javascript', 'const x = 1; const y = 2; return x + y;')"
    );
  });

  test('CSS rules', () => {
    const css = 'body { margin: 0; padding: 0; } .btn { color: red; }';
    const sql = format('INSERT INTO themes (name, css) VALUES (?, ?)', [
      'dark',
      css,
    ]);
    assert.equal(
      sql,
      "INSERT INTO themes (name, css) VALUES ('dark', 'body { margin: 0; padding: 0; } .btn { color: red; }')"
    );
  });

  test('shell command sequence', () => {
    const script = 'cd /app; npm install; npm run build';
    const sql = format('INSERT INTO deploy_scripts (commands) VALUES (?)', [
      script,
    ]);
    assert.equal(
      sql,
      "INSERT INTO deploy_scripts (commands) VALUES ('cd /app; npm install; npm run build')"
    );
  });
});

describe('Configuration strings', () => {
  test('INI-style config', () => {
    const config = 'debug=true;log_level=info;max_connections=100';
    const sql = format('UPDATE apps SET config = ? WHERE id = ?', [config, 1]);
    assert.equal(
      sql,
      "UPDATE apps SET config = 'debug=true;log_level=info;max_connections=100' WHERE id = 1"
    );
  });

  test('feature flags string', () => {
    const flags =
      'dark_mode:enabled;new_checkout:disabled;beta_features:enabled';
    const sql = format(
      'INSERT INTO user_settings (user_id, flags) VALUES (?, ?)',
      [42, flags]
    );
    assert.equal(
      sql,
      "INSERT INTO user_settings (user_id, flags) VALUES (42, 'dark_mode:enabled;new_checkout:disabled;beta_features:enabled')"
    );
  });
});

describe('SQL injection with semicolons', () => {
  test('classic SQL injection attempt', () => {
    const malicious = "'; DROP TABLE users; --";
    const sql = format('SELECT * FROM users WHERE username = ?', [malicious]);
    assert.equal(
      sql,
      "SELECT * FROM users WHERE username = '\\'; DROP TABLE users; --'"
    );
  });

  test('injection in login form', () => {
    const username = "admin'; DELETE FROM users WHERE '1'='1";
    const sql = format(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, 'password123']
    );
    assert.equal(
      sql,
      "SELECT * FROM users WHERE username = 'admin\\'; DELETE FROM users WHERE \\'1\\'=\\'1' AND password = 'password123'"
    );
  });

  test('stacked queries attempt', () => {
    const payload = "1; INSERT INTO admins VALUES ('hacker', 'pass'); --";
    const sql = format('SELECT * FROM products WHERE id = ?', [payload]);
    assert.equal(
      sql,
      "SELECT * FROM products WHERE id = '1; INSERT INTO admins VALUES (\\'hacker\\', \\'pass\\'); --'"
    );
  });
});

describe('CASE/WHEN for status mapping', () => {
  test('order status labels', () => {
    const sql = format(
      'SELECT id, CASE status WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? ELSE ? END AS status_label FROM orders',
      [
        'pending',
        'Pending',
        'shipped',
        'Shipped',
        'delivered',
        'Delivered',
        'Unknown',
      ]
    );
    assert.equal(
      sql,
      "SELECT id, CASE status WHEN 'pending' THEN 'Pending' WHEN 'shipped' THEN 'Shipped' WHEN 'delivered' THEN 'Delivered' ELSE 'Unknown' END AS status_label FROM orders"
    );
  });

  test('pricing tiers', () => {
    const sql = format(
      'SELECT product_id, CASE WHEN quantity >= ? THEN price * ? WHEN quantity >= ? THEN price * ? ELSE price END AS final_price FROM cart',
      [100, 0.8, 50, 0.9]
    );
    assert.equal(
      sql,
      'SELECT product_id, CASE WHEN quantity >= 100 THEN price * 0.8 WHEN quantity >= 50 THEN price * 0.9 ELSE price END AS final_price FROM cart'
    );
  });

  test('user role permissions', () => {
    const sql = format(
      'SELECT user_id, CASE role WHEN ? THEN ? WHEN ? THEN ? ELSE ? END AS can_delete FROM users WHERE id = ?',
      ['admin', true, 'moderator', true, false, 42]
    );
    assert.equal(
      sql,
      "SELECT user_id, CASE role WHEN 'admin' THEN true WHEN 'moderator' THEN true ELSE false END AS can_delete FROM users WHERE id = 42"
    );
  });
});

describe('IFNULL and COALESCE for fallbacks', () => {
  test('display name fallback chain', () => {
    const sql = format(
      'SELECT COALESCE(display_name, username, ?) AS name FROM users WHERE id = ?',
      ['Anonymous User', 123]
    );
    assert.equal(
      sql,
      "SELECT COALESCE(display_name, username, 'Anonymous User') AS name FROM users WHERE id = 123"
    );
  });

  test('price with promotional fallback', () => {
    const sql = format(
      'SELECT id, name, IFNULL(promo_price, regular_price) AS price FROM products WHERE category = ?',
      ['electronics']
    );
    assert.equal(
      sql,
      "SELECT id, name, IFNULL(promo_price, regular_price) AS price FROM products WHERE category = 'electronics'"
    );
  });

  test('shipping address fallback to billing', () => {
    const sql = format(
      'SELECT COALESCE(shipping_address, billing_address, ?) AS address FROM orders WHERE id = ?',
      ['No address provided', 456]
    );
    assert.equal(
      sql,
      "SELECT COALESCE(shipping_address, billing_address, 'No address provided') AS address FROM orders WHERE id = 456"
    );
  });
});

describe('IF() function for conditional values', () => {
  test('stock availability label', () => {
    const sql = format(
      'SELECT name, IF(stock > ?, ?, ?) AS availability FROM products',
      [0, 'In Stock', 'Out of Stock']
    );
    assert.equal(
      sql,
      "SELECT name, IF(stock > 0, 'In Stock', 'Out of Stock') AS availability FROM products"
    );
  });

  test('subscription status', () => {
    const sql = format(
      'SELECT email, IF(expires_at > ?, ?, ?) AS status FROM subscriptions',
      [raw('NOW()'), 'active', 'expired']
    );
    assert.equal(
      sql,
      "SELECT email, IF(expires_at > NOW(), 'active', 'expired') AS status FROM subscriptions"
    );
  });
});

describe('Session variables for auditing', () => {
  test('set user context for audit triggers', () => {
    const sql = format('SET @current_user_id = ?, @current_user_ip = ?', [
      42,
      '192.168.1.100',
    ]);
    assert.equal(
      sql,
      "SET @current_user_id = 42, @current_user_ip = '192.168.1.100'"
    );
  });

  test('set timezone for session', () => {
    const sql = format('SET time_zone = ?', ['-03:00']);
    assert.equal(sql, "SET time_zone = '-03:00'");
  });

  test('capture last insert id pattern', () => {
    const sql = format(
      'INSERT INTO orders (customer_id, total) VALUES (?, ?)',
      [100, 250.5]
    );
    assert.equal(
      sql,
      'INSERT INTO orders (customer_id, total) VALUES (100, 250.5)'
    );
  });
});

describe('Query comments for debugging', () => {
  test('placeholder inside block comment is NOT replaced (correct behavior)', () => {
    const sql = format(
      '/* request_id: ? */ SELECT * FROM users WHERE id = ?',
      [42]
    );
    assert.equal(sql, '/* request_id: ? */ SELECT * FROM users WHERE id = 42');
  });

  test('comment before placeholder does not affect substitution', () => {
    const sql = format('SELECT * FROM products /* filter */ WHERE active = ?', [
      true,
    ]);
    assert.equal(
      sql,
      'SELECT * FROM products /* filter */ WHERE active = true'
    );
  });

  test('single-line comment does not consume placeholders', () => {
    const sql = format(
      'SELECT * FROM users -- get all users\nWHERE status = ?',
      ['active']
    );
    assert.equal(
      sql,
      "SELECT * FROM users -- get all users\nWHERE status = 'active'"
    );
  });
});

describe('Real edge cases', () => {
  test('email with plus addressing contains no semicolons but tests escaping', () => {
    const sql = format('SELECT * FROM users WHERE email = ?', [
      'user+tag@example.com',
    ]);
    assert.equal(
      sql,
      "SELECT * FROM users WHERE email = 'user+tag@example.com'"
    );
  });

  test('JSON string stored in column', () => {
    const json = '{"items":[{"id":1},{"id":2}],"meta":{"page":1}}';
    const sql = format('UPDATE carts SET data = ? WHERE id = ?', [json, 1]);
    assert.equal(
      sql,
      'UPDATE carts SET data = \'{\\"items\\":[{\\"id\\":1},{\\"id\\":2}],\\"meta\\":{\\"page\\":1}}\' WHERE id = 1'
    );
  });

  test('HTML content with inline styles', () => {
    const html = '<div style="color: red; font-size: 14px;">Hello</div>';
    const sql = format('INSERT INTO templates (content) VALUES (?)', [html]);
    assert.equal(
      sql,
      'INSERT INTO templates (content) VALUES (\'<div style=\\"color: red; font-size: 14px;\\">Hello</div>\')'
    );
  });

  test('regex pattern stored in database', () => {
    const regex = '^[a-z]+;[0-9]+$';
    const sql = format('INSERT INTO validation_rules (pattern) VALUES (?)', [
      regex,
    ]);
    assert.equal(
      sql,
      "INSERT INTO validation_rules (pattern) VALUES ('^[a-z]+;[0-9]+$')"
    );
  });

  test('mathematical expression', () => {
    const expr = 'x = y + 1; y = z * 2; return x + y;';
    const sql = format('INSERT INTO formulas (expression) VALUES (?)', [expr]);
    assert.equal(
      sql,
      "INSERT INTO formulas (expression) VALUES ('x = y + 1; y = z * 2; return x + y;')"
    );
  });
});
