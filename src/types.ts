export type Raw = {
  toSqlString(): string;
};

/**
 * Structural shape of a Temporal value (`Temporal.Instant`, `Temporal.PlainDate`,
 * `Temporal.PlainDateTime`, ...). Declared structurally so the package does not
 * depend on the `Temporal` lib types being present. `epochMilliseconds` is only
 * populated on the absolute types (`Instant` / `ZonedDateTime`).
 */
export type TemporalLike = {
  readonly [Symbol.toStringTag]: string;
  toString(): string;
  readonly epochMilliseconds?: number;
};

export type SqlValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | TemporalLike
  | Buffer
  | Uint8Array
  | Raw
  | Record<string, unknown>
  | SqlValue[]
  | Set<SqlValue>
  | Map<string, SqlValue>
  | null
  | undefined;

export type Timezone = 'local' | 'Z' | (string & NonNullable<unknown>);
