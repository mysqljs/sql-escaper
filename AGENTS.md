# SQL Escaper

> This file orients any AI agent (and human) working in this repository. Read it before making changes: it points to the skill that keeps new code secure and sets the project's engineering approaches.

## Skills

- Whenever you build or change code, including its tests and documentation, use the `/lagune` skill, to improve safety by default.
- Use the `/engineering` skill whenever you build or change code, so it follows the project's approaches.

## Development

When you write or change code in `./src`, apply the approaches below, grouped by engineering area, so new code matches how the rest of it is already built.

Don't cause a regression: every input, security vectors included, must come out byte-identical, and the full suite must stay green. These approaches change how the code runs, never what it produces.

- **Character codes over strings:** classify and compare characters by their numeric code, never by cutting substrings or running a regex to inspect a single character.
- **Bitwise case folding:** normalize ASCII case with a bit operation instead of allocating a lowercased copy.
- **Lookup tables over branch chains:** index a small preallocated table by character code to branch in one load instead of a chain of equality checks, and group candidate keywords under a cheap key so a match tests a handful rather than the whole set.
- **Constants built once at module load:** keep every table, map, and regex at module scope so none is rebuilt on a call.
- **Early-return the common path:** detect the no-work case first and return the input essentially unchanged, so the costly path runs only when there is real work.
- **Chunk in bulk, handle only the exceptions:** copy untouched runs with a single slice and emit a replacement only at each character that needs one, instead of appending character by character or looping once per regex match.
- **Compute the expensive thing lazily and once:** defer a costly scan behind a sentinel, run it only when a value actually needs it, then reuse and advance that result rather than scanning again from the start.
- **Cheap checks before expensive ones:** order type and shape tests so the cheap intrinsic checks run before anything that stringifies or allocates, and dispatch on the primitive type first.
- **Hoist loop invariants:** read lengths and other values that do not change into locals once before iterating, not on every pass.
- **Scan by hand, reuse the regex:** walk characters directly for parsing, and where a regex is unavoidable reuse a single instance instead of allocating one per call.
- **Own-property, monomorphic iteration:** iterate only own keys behind a hoisted ownership guard that checks before it reads, so inherited getters never fire and property access stays monomorphic.
- **Integer sentinels and numeric range tests:** encode absent or not-yet-computed state as reserved integers instead of null or a boxed option, and test character ranges with plain numeric comparisons.
- **Manual padding over general calls:** pad fixed-width numbers by magnitude with branches and concatenation instead of a general-purpose padding call.

### Tests

- `npm run test:node`
- `bun run test:bun`
- `deno task test:deno`

### Linter and Formatter

- `npm run lint`
- `npm run lint:fix`
