import { assert, describe, test } from 'poku';
import { escapeId, format } from '../src/index.ts';

describe('Basic emojis', () => {
  test('common emojis in string', () => {
    const sql = format('INSERT INTO posts (content) VALUES (?)', [
      'Hello 👋 World 🌍',
    ]);
    assert.equal(
      sql,
      "INSERT INTO posts (content) VALUES ('Hello 👋 World 🌍')"
    );
  });

  test('emoji-only string', () => {
    const sql = format('INSERT INTO reactions (emoji) VALUES (?)', ['👍']);
    assert.equal(sql, "INSERT INTO reactions (emoji) VALUES ('👍')");
  });

  test('multiple emojis in sequence', () => {
    const sql = format('INSERT INTO messages (content) VALUES (?)', [
      '🎉🎊🎁🎈🎂',
    ]);
    assert.equal(sql, "INSERT INTO messages (content) VALUES ('🎉🎊🎁🎈🎂')");
  });
});

describe('Complex emojis (4-byte and combined)', () => {
  test('emoji with skin tone modifier', () => {
    const sql = format('INSERT INTO profiles (greeting) VALUES (?)', [
      'Hello 👋🏽 from user',
    ]);
    assert.equal(
      sql,
      "INSERT INTO profiles (greeting) VALUES ('Hello 👋🏽 from user')"
    );
  });

  test('family emoji (ZWJ sequence)', () => {
    const sql = format('INSERT INTO profiles (family) VALUES (?)', ['👨‍👩‍👧‍👦']);
    assert.equal(sql, "INSERT INTO profiles (family) VALUES ('👨‍👩‍👧‍👦')");
  });

  test('flag emoji', () => {
    const sql = format('INSERT INTO users (country) VALUES (?)', ['🇧🇷']);
    assert.equal(sql, "INSERT INTO users (country) VALUES ('🇧🇷')");
  });

  test('profession emoji (ZWJ)', () => {
    const sql = format('INSERT INTO profiles (job) VALUES (?)', [
      '👩‍💻 Developer',
    ]);
    assert.equal(sql, "INSERT INTO profiles (job) VALUES ('👩‍💻 Developer')");
  });

  test('emoji with variation selector', () => {
    const sql = format('INSERT INTO t (icon) VALUES (?)', ['☀️']);
    assert.equal(sql, "INSERT INTO t (icon) VALUES ('☀️')");
  });
});

describe('Emojis in different contexts', () => {
  test('emoji in object values', () => {
    const sql = format('UPDATE users SET ?', [
      { status: '🟢 Online', mood: '😊' },
    ]);
    assert.equal(sql, "UPDATE users SET `status` = '🟢 Online', `mood` = '😊'");
  });

  test('emoji in array', () => {
    const sql = format('INSERT INTO reactions VALUES ?', [
      [
        [1, '👍'],
        [2, '❤️'],
        [3, '😂'],
      ],
    ]);
    assert.equal(
      sql,
      "INSERT INTO reactions VALUES (1, '👍'), (2, '❤️'), (3, '😂')"
    );
  });

  test('emoji in WHERE clause', () => {
    const sql = format('SELECT * FROM posts WHERE reaction = ?', ['👍']);
    assert.equal(sql, "SELECT * FROM posts WHERE reaction = '👍'");
  });
});

describe('Chinese characters', () => {
  test('simplified Chinese', () => {
    const sql = format('INSERT INTO products (name) VALUES (?)', ['苹果手机']);
    assert.equal(sql, "INSERT INTO products (name) VALUES ('苹果手机')");
  });

  test('traditional Chinese', () => {
    const sql = format('INSERT INTO products (name) VALUES (?)', ['蘋果手機']);
    assert.equal(sql, "INSERT INTO products (name) VALUES ('蘋果手機')");
  });

  test('Chinese with numbers', () => {
    const sql = format('INSERT INTO orders (description) VALUES (?)', [
      '订单号12345，共3件商品',
    ]);
    assert.equal(
      sql,
      "INSERT INTO orders (description) VALUES ('订单号12345，共3件商品')"
    );
  });

  test('Chinese punctuation', () => {
    const sql = format('INSERT INTO notes (text) VALUES (?)', [
      '你好！这是一个测试。请问，可以吗？',
    ]);
    assert.equal(
      sql,
      "INSERT INTO notes (text) VALUES ('你好！这是一个测试。请问，可以吗？')"
    );
  });
});

describe('Japanese characters', () => {
  test('hiragana', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'こんにちは',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('こんにちは')");
  });

  test('katakana', () => {
    const sql = format('INSERT INTO products (name) VALUES (?)', [
      'コンピューター',
    ]);
    assert.equal(sql, "INSERT INTO products (name) VALUES ('コンピューター')");
  });

  test('kanji', () => {
    const sql = format('INSERT INTO words (text) VALUES (?)', ['日本語']);
    assert.equal(sql, "INSERT INTO words (text) VALUES ('日本語')");
  });

  test('mixed Japanese scripts', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'これはテスト文章です。Test 123',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('これはテスト文章です。Test 123')"
    );
  });

  test('Japanese with emoji', () => {
    const sql = format('INSERT INTO messages (content) VALUES (?)', [
      'お誕生日おめでとう🎂🎉',
    ]);
    assert.equal(
      sql,
      "INSERT INTO messages (content) VALUES ('お誕生日おめでとう🎂🎉')"
    );
  });
});

describe('Korean characters', () => {
  test('hangul', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      '안녕하세요',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('안녕하세요')");
  });

  test('Korean with spaces', () => {
    const sql = format('INSERT INTO messages (content) VALUES (?)', [
      '감사합니다 좋은 하루 되세요',
    ]);
    assert.equal(
      sql,
      "INSERT INTO messages (content) VALUES ('감사합니다 좋은 하루 되세요')"
    );
  });

  test('Korean with numbers and punctuation', () => {
    const sql = format('INSERT INTO orders (note) VALUES (?)', [
      '주문번호: 12345, 배송중입니다!',
    ]);
    assert.equal(
      sql,
      "INSERT INTO orders (note) VALUES ('주문번호: 12345, 배송중입니다!')"
    );
  });
});

describe('Russian characters', () => {
  test('Russian text', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'Привет мир',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('Привет мир')");
  });

  test('Russian with punctuation', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'Как дела? Всё хорошо!',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('Как дела? Всё хорошо!')"
    );
  });

  test('Russian with numbers', () => {
    const sql = format('INSERT INTO addresses (address) VALUES (?)', [
      'улица Ленина, дом 42, квартира 15',
    ]);
    assert.equal(
      sql,
      "INSERT INTO addresses (address) VALUES ('улица Ленина, дом 42, квартира 15')"
    );
  });

  test('Ukrainian text', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'Привіт світ',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('Привіт світ')");
  });
});

describe('Portuguese/Spanish diacritics', () => {
  test('Portuguese with accents', () => {
    const sql = format('INSERT INTO products (name) VALUES (?)', [
      'Ação promocional de verão',
    ]);
    assert.equal(
      sql,
      "INSERT INTO products (name) VALUES ('Ação promocional de verão')"
    );
  });

  test('Spanish with ñ and accents', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'El niño comió jamón con piña',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('El niño comió jamón con piña')"
    );
  });

  test('Portuguese cedilla and til', () => {
    const sql = format('INSERT INTO notes (text) VALUES (?)', [
      'Coração, canção, não, pão',
    ]);
    assert.equal(
      sql,
      "INSERT INTO notes (text) VALUES ('Coração, canção, não, pão')"
    );
  });
});

describe('French and German diacritics', () => {
  test('French with accents', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'Café, résumé, naïve, façade',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('Café, résumé, naïve, façade')"
    );
  });

  test('French with œ and other ligatures', () => {
    const sql = format('INSERT INTO words (text) VALUES (?)', [
      'Cœur, bœuf, œuvre',
    ]);
    assert.equal(sql, "INSERT INTO words (text) VALUES ('Cœur, bœuf, œuvre')");
  });

  test('German with umlauts', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'Größe, Übung, Äpfel, Öl',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('Größe, Übung, Äpfel, Öl')"
    );
  });

  test('German sharp s (ß)', () => {
    const sql = format('INSERT INTO addresses (street) VALUES (?)', ['Straße']);
    assert.equal(sql, "INSERT INTO addresses (street) VALUES ('Straße')");
  });
});

describe('Nordic characters', () => {
  test('Swedish/Norwegian with å, ä, ö', () => {
    const sql = format('INSERT INTO names (name) VALUES (?)', ['Åsa Öberg']);
    assert.equal(sql, "INSERT INTO names (name) VALUES ('Åsa Öberg')");
  });

  test('Danish with ø and æ', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'Rød grød med fløde',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('Rød grød med fløde')"
    );
  });

  test('Icelandic characters', () => {
    const sql = format('INSERT INTO words (text) VALUES (?)', [
      'Þórr, Ísland, ætt',
    ]);
    assert.equal(sql, "INSERT INTO words (text) VALUES ('Þórr, Ísland, ætt')");
  });
});

describe('Arabic script', () => {
  test('Arabic text', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'مرحبا بالعالم',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('مرحبا بالعالم')");
  });

  test('Arabic with numbers', () => {
    const sql = format('INSERT INTO orders (note) VALUES (?)', [
      'رقم الطلب: ١٢٣٤٥',
    ]);
    assert.equal(sql, "INSERT INTO orders (note) VALUES ('رقم الطلب: ١٢٣٤٥')");
  });

  test('Persian (Farsi)', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'سلام دنیا',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('سلام دنیا')");
  });
});

describe('Hebrew script', () => {
  test('Hebrew text', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'שלום עולם',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('שלום עולם')");
  });

  test('Hebrew with punctuation', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'מה שלומך? הכל בסדר!',
    ]);
    assert.equal(
      sql,
      "INSERT INTO content (text) VALUES ('מה שלומך? הכל בסדר!')"
    );
  });
});

describe('South Asian scripts', () => {
  test('Hindi (Devanagari)', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'नमस्ते दुनिया',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('नमस्ते दुनिया')");
  });

  test('Thai script', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'สวัสดีโลก',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('สวัสดีโลก')");
  });

  test('Tamil script', () => {
    const sql = format('INSERT INTO greetings (text) VALUES (?)', [
      'வணக்கம் உலகம்',
    ]);
    assert.equal(sql, "INSERT INTO greetings (text) VALUES ('வணக்கம் உலகம்')");
  });
});

describe('Greek script', () => {
  test('Greek text', () => {
    const sql = format('INSERT INTO content (text) VALUES (?)', [
      'Γειά σου κόσμε',
    ]);
    assert.equal(sql, "INSERT INTO content (text) VALUES ('Γειά σου κόσμε')");
  });

  test('Greek with numbers', () => {
    const sql = format('INSERT INTO math (formula) VALUES (?)', [
      'π ≈ 3.14159',
    ]);
    assert.equal(sql, "INSERT INTO math (formula) VALUES ('π ≈ 3.14159')");
  });
});

describe('Mathematical and technical symbols', () => {
  test('mathematical operators', () => {
    const sql = format('INSERT INTO formulas (expr) VALUES (?)', [
      'α + β = γ × δ ÷ ε',
    ]);
    assert.equal(
      sql,
      "INSERT INTO formulas (expr) VALUES ('α + β = γ × δ ÷ ε')"
    );
  });

  test('currency symbols', () => {
    const sql = format('INSERT INTO prices (text) VALUES (?)', [
      '€100, £50, ¥1000, ₹500, ₽1000, ₿0.01',
    ]);
    assert.equal(
      sql,
      "INSERT INTO prices (text) VALUES ('€100, £50, ¥1000, ₹500, ₽1000, ₿0.01')"
    );
  });

  test('arrows and shapes', () => {
    const sql = format('INSERT INTO icons (symbol) VALUES (?)', [
      '→ ← ↑ ↓ ● ○ ■ □',
    ]);
    assert.equal(sql, "INSERT INTO icons (symbol) VALUES ('→ ← ↑ ↓ ● ○ ■ □')");
  });

  test('box drawing characters', () => {
    const sql = format('INSERT INTO art (drawing) VALUES (?)', [
      '┌──┐\n│  │\n└──┘',
    ]);
    assert.equal(
      sql,
      "INSERT INTO art (drawing) VALUES ('┌──┐\\n│  │\\n└──┘')"
    );
  });
});

describe('Quotation marks and apostrophes', () => {
  test('curly double quotes', () => {
    const sql = format('INSERT INTO quotes (text) VALUES (?)', [
      '\u201CHello\u201D',
    ]);
    assert.equal(sql, "INSERT INTO quotes (text) VALUES ('\u201CHello\u201D')");
  });

  test('curly single quotes', () => {
    const sql = format('INSERT INTO quotes (text) VALUES (?)', [
      '\u2018World\u2019',
    ]);
    assert.equal(sql, "INSERT INTO quotes (text) VALUES ('\u2018World\u2019')");
  });

  test('guillemets (French quotes)', () => {
    const sql = format('INSERT INTO quotes (text) VALUES (?)', [
      '\u00ABBonjour\u00BB',
    ]);
    assert.equal(
      sql,
      "INSERT INTO quotes (text) VALUES ('\u00ABBonjour\u00BB')"
    );
  });

  test('German quotes', () => {
    const sql = format('INSERT INTO quotes (text) VALUES (?)', [
      '\u201EHallo\u201C',
    ]);
    assert.equal(sql, "INSERT INTO quotes (text) VALUES ('\u201EHallo\u201C')");
  });
});

describe('Mixed scripts in single string', () => {
  test('English with CJK and emoji', () => {
    const sql = format('INSERT INTO posts (content) VALUES (?)', [
      'Hello 你好 こんにちは 안녕 👋',
    ]);
    assert.equal(
      sql,
      "INSERT INTO posts (content) VALUES ('Hello 你好 こんにちは 안녕 👋')"
    );
  });

  test('RTL mixed with LTR', () => {
    const sql = format('INSERT INTO messages (text) VALUES (?)', [
      'Hello مرحبا שלום World',
    ]);
    assert.equal(
      sql,
      "INSERT INTO messages (text) VALUES ('Hello مرحبا שלום World')"
    );
  });

  test('multiple languages in object', () => {
    const sql = format('UPDATE translations SET ?', [
      {
        en: 'Hello',
        zh: '你好',
        ja: 'こんにちは',
        ko: '안녕',
        ru: 'Привет',
        ar: 'مرحبا',
      },
    ]);
    assert.equal(
      sql,
      "UPDATE translations SET `en` = 'Hello', `zh` = '你好', `ja` = 'こんにちは', `ko` = '안녕', `ru` = 'Привет', `ar` = 'مرحبا'"
    );
  });
});

describe('Unicode in identifiers', () => {
  test('escapeId with Unicode', () => {
    assert.equal(escapeId('表名'), '`表名`');
    assert.equal(escapeId('テーブル'), '`テーブル`');
    assert.equal(escapeId('таблица'), '`таблица`');
  });

  test('format with Unicode table name via ??', () => {
    const sql = format('SELECT * FROM ?? WHERE id = ?', ['用户表', 1]);
    assert.equal(sql, 'SELECT * FROM `用户表` WHERE id = 1');
  });
});

describe('Zero-width and invisible characters', () => {
  test('zero-width joiner (used in emoji sequences)', () => {
    const sql = format('INSERT INTO t (emoji) VALUES (?)', ['👨‍👩‍👧']);
    assert.equal(sql, "INSERT INTO t (emoji) VALUES ('👨‍👩‍👧')");
  });

  test('non-breaking space', () => {
    const sql = format('INSERT INTO t (text) VALUES (?)', ['hello\u00A0world']);
    assert.equal(sql, "INSERT INTO t (text) VALUES ('hello\u00A0world')");
  });

  test('soft hyphen', () => {
    const sql = format('INSERT INTO t (text) VALUES (?)', ['auto\u00ADmatic']);
    assert.equal(sql, "INSERT INTO t (text) VALUES ('auto\u00ADmatic')");
  });
});

describe('Unicode normalization edge cases', () => {
  test('composed vs decomposed é (NFC vs NFD)', () => {
    const composed = 'café';
    const decomposed = 'cafe\u0301';

    const sql1 = format('SELECT * FROM t WHERE name = ?', [composed]);
    const sql2 = format('SELECT * FROM t WHERE name = ?', [decomposed]);

    assert.equal(sql1, "SELECT * FROM t WHERE name = 'café'");
    assert.equal(sql2, "SELECT * FROM t WHERE name = 'cafe\u0301'");
  });

  test('full-width characters', () => {
    const sql = format('INSERT INTO t (text) VALUES (?)', ['ＡＢＣＤ１２３４']);
    assert.equal(sql, "INSERT INTO t (text) VALUES ('ＡＢＣＤ１２３４')");
  });
});
