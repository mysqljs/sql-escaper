/**
 * Adapted from https://github.com/mysqljs/sqlstring/blob/cd528556b4b6bcf300c3db515026935dedf7cfa1/lib/SqlString.js
 * MIT LICENSE: https://github.com/mysqljs/sqlstring/blob/cd528556b4b6bcf300c3db515026935dedf7cfa1/LICENSE
 */

import type { Raw, SqlValue, Timezone } from './types.js';
import { Buffer } from 'node:buffer';

export type { Raw, SqlValue, Timezone } from './types.js';

const regex = {
  backtick: /`/g,
  dot: /\./g,
  timezone: /([+\-\s])(\d\d):?(\d\d)?/,
  escapeChars: /[\0\b\t\n\r\x1a"'\\]/g,
};

const CHARS_ESCAPE_MAP: Record<string, string> = {
  '\0': '\\0',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\r': '\\r',
  '\x1a': '\\Z',
  '"': '\\"',
  "'": "\\'",
  '\\': '\\\\',
} as const;

const charCode = {
  singleQuote: 39,
  backslash: 92,
  dash: 45,
  slash: 47,
  asterisk: 42,
  questionMark: 63,
  newline: 10,
  space: 32,
  tab: 9,
  carriageReturn: 13,
} as const;

const isRecord = (val: unknown): val is Record<string, SqlValue> =>
  typeof val === 'object' && val !== null && !Array.isArray(val);

const isWordChar = (code: number): boolean =>
  (code >= 65 && code <= 90) ||
  (code >= 97 && code <= 122) ||
  (code >= 48 && code <= 57) ||
  code === 95;

const isWhitespace = (code: number): boolean =>
  code === charCode.space ||
  code === charCode.tab ||
  code === charCode.newline ||
  code === charCode.carriageReturn;

const toLower = (code: number): number => code | 32;

const matchesWord = (
  sql: string,
  position: number,
  word: string,
  length: number
): boolean => {
  for (let offset = 0; offset < word.length; offset++)
    if (toLower(sql.charCodeAt(position + offset)) !== word.charCodeAt(offset))
      return false;

  return (
    (position === 0 || !isWordChar(sql.charCodeAt(position - 1))) &&
    (position + word.length >= length ||
      !isWordChar(sql.charCodeAt(position + word.length)))
  );
};

const skipSqlContext = (sql: string, position: number): number => {
  const currentChar = sql.charCodeAt(position);
  const nextChar = sql.charCodeAt(position + 1);

  if (currentChar === charCode.singleQuote) {
    for (let cursor = position + 1; cursor < sql.length; cursor++) {
      if (sql.charCodeAt(cursor) === charCode.backslash) cursor++;
      else if (sql.charCodeAt(cursor) === charCode.singleQuote)
        return cursor + 1;
    }

    return sql.length;
  }

  if (currentChar === charCode.dash && nextChar === charCode.dash) {
    const lineBreak = sql.indexOf('\n', position + 2);
    return lineBreak === -1 ? sql.length : lineBreak + 1;
  }

  if (currentChar === charCode.slash && nextChar === charCode.asterisk) {
    const commentEnd = sql.indexOf('*/', position + 2);
    return commentEnd === -1 ? sql.length : commentEnd + 2;
  }

  return -1;
};

const findNextPlaceholder = (sql: string, start: number): number => {
  for (let position = start; position < sql.length; position++) {
    const contextEnd = skipSqlContext(sql, position);

    if (contextEnd !== -1) {
      position = contextEnd - 1;
      continue;
    }

    if (sql.charCodeAt(position) === charCode.questionMark) return position;
  }

  return -1;
};

const findSetKeyword = (sql: string): number => {
  const length = sql.length;

  for (let position = 0; position < length; position++) {
    const contextEnd = skipSqlContext(sql, position);

    if (contextEnd !== -1) {
      position = contextEnd - 1;
      continue;
    }

    if (matchesWord(sql, position, 'set', length)) return position;

    if (matchesWord(sql, position, 'key', length)) {
      let cursor = position + 3;

      while (cursor < length && isWhitespace(sql.charCodeAt(cursor))) cursor++;

      if (matchesWord(sql, cursor, 'update', length)) return position;
    }
  }

  return -1;
};

const isDate = (value: unknown): value is Date =>
  Object.prototype.toString.call(value) === '[object Date]';

const hasSqlString = (value: unknown): value is Raw =>
  typeof value === 'object' &&
  value !== null &&
  'toSqlString' in value &&
  typeof value.toSqlString === 'function';

const escapeString = (value: string): string => {
  regex.escapeChars.lastIndex = 0;

  let chunkIndex = 0;
  let escapedValue = '';
  let match: RegExpExecArray | null;

  for (
    match = regex.escapeChars.exec(value);
    match !== null;
    match = regex.escapeChars.exec(value)
  ) {
    escapedValue +=
      value.slice(chunkIndex, match.index) + CHARS_ESCAPE_MAP[match[0]];
    chunkIndex = regex.escapeChars.lastIndex;
  }

  if (chunkIndex === 0) return `'${value}'`;

  if (chunkIndex < value.length)
    return `'${escapedValue}${value.slice(chunkIndex)}'`;

  return `'${escapedValue}'`;
};

const pad = (number: number, length: number): string =>
  String(number).padStart(length, '0');

const convertTimezone = (tz: Timezone): number | false => {
  if (tz === 'Z') return 0;

  const timezoneMatch = tz.match(regex.timezone);
  if (timezoneMatch)
    return (
      (timezoneMatch[1]! === '-' ? -1 : 1) *
      (Number.parseInt(timezoneMatch[2]!, 10) +
        (timezoneMatch[3] ? Number.parseInt(timezoneMatch[3]!, 10) : 0) / 60) *
      60
    );

  return false;
};

export const dateToString = (date: Date, timezone: Timezone): string => {
  const adjustedDate = new Date(date);

  if (Number.isNaN(adjustedDate.getTime())) return 'NULL';

  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute: number;
  let second: number;
  let millisecond: number;

  if (timezone === 'local') {
    year = adjustedDate.getFullYear();
    month = adjustedDate.getMonth() + 1;
    day = adjustedDate.getDate();
    hour = adjustedDate.getHours();
    minute = adjustedDate.getMinutes();
    second = adjustedDate.getSeconds();
    millisecond = adjustedDate.getMilliseconds();
  } else {
    const timezoneOffsetMinutes = convertTimezone(timezone);

    if (timezoneOffsetMinutes !== false && timezoneOffsetMinutes !== 0) {
      adjustedDate.setTime(
        adjustedDate.getTime() + timezoneOffsetMinutes * 60000
      );
    }

    year = adjustedDate.getUTCFullYear();
    month = adjustedDate.getUTCMonth() + 1;
    day = adjustedDate.getUTCDate();
    hour = adjustedDate.getUTCHours();
    minute = adjustedDate.getUTCMinutes();
    second = adjustedDate.getUTCSeconds();
    millisecond = adjustedDate.getUTCMilliseconds();
  }

  // YYYY-MM-DD HH:mm:ss.mmm
  const formattedDateTime = `${pad(year, 4)}-${pad(month, 2)}-${pad(
    day,
    2
  )} ${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.${pad(
    millisecond,
    3
  )}`;

  return escapeString(formattedDateTime);
};

export const escapeId = (
  value: SqlValue,
  forbidQualified?: boolean
): string => {
  if (Array.isArray(value)) {
    const length = value.length;
    const parts = new Array<string>(length);

    for (let i = 0; i < length; i++)
      parts[i] = escapeId(value[i], forbidQualified);

    return parts.join(', ');
  }

  const identifier = String(value);

  if (forbidQualified) {
    if (identifier.indexOf('`') === -1) return `\`${identifier}\``;

    return `\`${identifier.replace(regex.backtick, '``')}\``;
  }

  if (identifier.indexOf('`') === -1 && identifier.indexOf('.') === -1)
    return `\`${identifier}\``;

  return `\`${identifier
    .replace(regex.backtick, '``')
    .replace(regex.dot, '`.`')}\``;
};

export const objectToValues = (
  object: Record<string, SqlValue>,
  timezone?: Timezone
): string => {
  let sql = '';

  for (const key in object) {
    const value = object[key];

    if (typeof value === 'function') continue;

    sql += `${(sql.length === 0 ? '' : ', ') + escapeId(key)} = ${escape(
      value,
      true,
      timezone
    )}`;
  }

  return sql;
};

export const bufferToString = (buffer: Buffer): string =>
  `X${escapeString(buffer.toString('hex'))}`;

export const arrayToList = (array: SqlValue[], timezone?: Timezone): string => {
  const length = array.length;
  const parts = new Array<string>(length);

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (Array.isArray(value)) parts[i] = `(${arrayToList(value, timezone)})`;
    else parts[i] = escape(value, true, timezone);
  }

  return parts.join(', ');
};

export const escape = (
  value: SqlValue,
  stringifyObjects?: boolean,
  timezone?: Timezone
): string => {
  if (value === undefined || value === null) return 'NULL';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number':
      return value + '';

    case 'object': {
      if (isDate(value)) return dateToString(value, timezone || 'local');
      if (Array.isArray(value)) return arrayToList(value, timezone);
      if (Buffer.isBuffer(value)) return bufferToString(value);
      if (hasSqlString(value)) return String(value.toSqlString());
      if (!(stringifyObjects === undefined || stringifyObjects === null))
        return escapeString(String(value));
      if (isRecord(value)) return objectToValues(value, timezone);

      return escapeString(String(value));
    }

    case 'string':
      return escapeString(value);

    default:
      return escapeString(String(value));
  }
};

export const format = (
  sql: string,
  values?: SqlValue | SqlValue[],
  stringifyObjects?: boolean,
  timezone?: Timezone
): string => {
  if (values === undefined || values === null) return sql;

  const valuesArray: SqlValue[] = Array.isArray(values) ? values : [values];
  const length = valuesArray.length;

  let setIndex = -2; // -2 = not yet computed, -1 = no SET found
  let result = '';
  let chunkIndex = 0;
  let valuesIndex = 0;
  let placeholderPosition = findNextPlaceholder(sql, 0);

  while (valuesIndex < length && placeholderPosition !== -1) {
    // Count consecutive question marks to detect ? vs ?? vs ???+
    let placeholderEnd = placeholderPosition + 1;
    let escapedValue: string;

    while (sql.charCodeAt(placeholderEnd) === 63) placeholderEnd++;

    const placeholderLength = placeholderEnd - placeholderPosition;
    const currentValue = valuesArray[valuesIndex];

    if (placeholderLength > 2) {
      placeholderPosition = findNextPlaceholder(sql, placeholderEnd);
      continue;
    }

    if (placeholderLength === 2) escapedValue = escapeId(currentValue);
    else if (typeof currentValue === 'number') escapedValue = `${currentValue}`;
    else if (
      typeof currentValue === 'object' &&
      currentValue !== null &&
      !stringifyObjects
    ) {
      // Lazy: compute SET position only when we first encounter an object
      if (setIndex === -2) setIndex = findSetKeyword(sql);

      if (
        setIndex !== -1 &&
        setIndex < placeholderPosition &&
        !hasSqlString(currentValue) &&
        !Array.isArray(currentValue) &&
        !Buffer.isBuffer(currentValue) &&
        !isDate(currentValue) &&
        isRecord(currentValue)
      )
        escapedValue = objectToValues(currentValue, timezone);
      else escapedValue = escape(currentValue, stringifyObjects, timezone);
    } else escapedValue = escape(currentValue, stringifyObjects, timezone);

    result += sql.slice(chunkIndex, placeholderPosition) + escapedValue;
    chunkIndex = placeholderEnd;
    valuesIndex++;
    placeholderPosition = findNextPlaceholder(sql, placeholderEnd);
  }

  if (chunkIndex === 0) return sql;

  if (chunkIndex < sql.length) return result + sql.slice(chunkIndex);

  return result;
};

export const raw = (sql: string): Raw => {
  if (typeof sql !== 'string')
    throw new TypeError('argument sql must be a string');

  return {
    toSqlString: () => sql,
  };
};
