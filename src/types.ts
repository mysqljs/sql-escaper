export type Raw = {
  toSqlString(): string;
};

export type SqlValue =
  | string
  | number
  | boolean
  | Date
  | Buffer
  | Raw
  | Record<string, unknown>
  | SqlValue[]
  | null
  | undefined;

export type Timezone = 'local' | 'Z' | (string & NonNullable<unknown>);
