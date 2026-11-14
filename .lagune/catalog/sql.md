# SQL vulnerabilities

> - This knowledge extends your judgment. Apply what fits the project and keep reasoning beyond the list.
> - Source: Flatt Security, "Finding an unseen SQL Injection by bypassing escape functions in mysqljs/mysql" (2022, <https://flattsecurity.medium.com/finding-an-unseen-sql-injection-by-bypassing-escape-functions-in-mysqljs-mysql-90b27f6542b4>), and Mantra Information Security, "Prepared statements, prepared to be vulnerable" (2025, <https://blog.mantrainfosec.com/blog/18/prepared-statements-prepared-to-be-vulnerable>).

## Rules

- This skill audits and explains.
- By default, it never rewrites your code.

## What to look for

### Type-confused parameter expansion

A parameterized query looks safe: the user's value goes to a `?` placeholder, never into the query text. But many SQL escapers pick how to escape by the value's runtime type, and an object or an array is escaped differently from a scalar. When a value the code assumes is a string or a number arrives as an object, the escaper expands it into SQL fragments instead of one bound value. In the MySQL family, `{ password: 1 }` bound to `WHERE password = ?` becomes ``WHERE password = `password` = 1``: the object's key is emitted as a quoted **identifier** (a column reference), and the placeholder now carries a structural expression the caller never wrote. Arrays coerce the same way, so a query string like `?id[id]=1` reaches the driver as `{ id: '1' }` and expands identically.

This bypasses the very protection the placeholder was meant to give. `` password = `password` `` compares a column to itself and is true for every non-null row, so an authentication check, an ownership filter, or a one-time-token lookup collapses into an always-true clause, without the attacker ever knowing a secret. The same shape drives mass `SELECT`, `UPDATE`, and `DELETE`: `DELETE FROM entries WHERE id = ?` with `{ id: { id: true } }` deletes every row.

The tell is a value that reaches a placeholder with its type never constrained first: a request body or query parameter destructured straight into the bind array (`db.query(sql, [req.body.password])`), where the framework parses JSON or bracketed query keys into the objects and arrays the code assumed were strings. The danger lives in the driver's default, so it is present even when every query is a prepared statement and no string is ever concatenated. It is not a flaw in the low-level escaper, which has no view of query structure by design, but in a driver that feeds user input to it untyped.

Safer shapes, applied where they fit:

- **Constrain the type before binding.** Confirm each placeholder value is the scalar its column expects (a string, a number) and reject an object or array outright, at the edge where the request is parsed, so a non-scalar can never reach the bind array.
- **Validate the request shape, not only the value.** A field that must be a string is a finding waiting to happen when the router still accepts `field[x]=y` or a nested JSON object for it. Assert the shape.
- **Turn off type-based expansion at the driver.** Where the connector offers it, enable the option that stringifies objects instead of expanding them (`stringifyObjects: true` in `mysql` / `mysql2`), so a stray object becomes an inert quoted string. Treat this as a backstop under the type check, not a replacement: it neutralizes objects, but other type-dependent shapes can still surprise a query that did not expect them.
- **Prefer an escaper that binds each placeholder value as a single scalar.** A utility that expands objects into `identifier = value` pairs by default hands query structure to the caller's data. One that treats every `?` value as one escaped scalar removes the surface. This repository, `sql-escaper`, is the drop-in that makes that the default.

### SQL built by string assembly

A query assembled by joining user input into the SQL text (`"... WHERE name = '" + name + "'"`, a template literal with an interpolated value, an ORM's raw-fragment escape hatch fed a request value) lets a crafted value close the quote and append its own clause. This is classic SQL injection. It belongs here because binding values, the fix for the type-confusion case above, gives a false sense of safety when the code still hand-joins the query around the placeholder.

Safer shape: bind every value through a parameterized query or prepared statement, never concatenation or interpolation, so the engine parses the structure once and the value stays a value. A stored procedure is not safe by being a procedure: if it concatenates its arguments into dynamic SQL inside, it injects like any other string-built query.

### Identifiers and keywords spliced from input

Table names, column names, an `ORDER BY` target, a sort direction, `LIMIT`, or the members of an `IN (...)` list cannot be bound as parameters, so code that needs them dynamic often splices them from the request. A sort column read from `?sort=` and dropped into the query is injection through a spot a placeholder cannot cover. It is the same surface the type-confusion case abuses from the other side: object expansion is dangerous precisely because it smuggles an attacker-chosen **identifier** into the query.

Safer shape: never place a raw request value where an identifier or keyword goes. Map a validated key to a code-defined identifier (`{ name: 'name', created: 'created_at' }[sortKey]`), reject anything not in the map, and pick a direction from a fixed `{ asc: 'ASC', desc: 'DESC' }` set. Where an identifier must be dynamic and no map fits, quote it with the driver's dedicated identifier escaper (not its value escaper), a distinct and weaker last resort.

## How to act on the result

- **In detect (detection):** each confirmed path from an untrusted value to a SQL query, where the value's type is not constrained to the scalar its column expects, is a finding. Describe it in plain language: what it is (an object or array reaching a placeholder and expanding into SQL structure, a value concatenated into the query text, or an identifier spliced from the request), why it matters (the concrete impact, from an always-true auth or ownership bypass to mass read, update, or delete), and the evidence (the endpoint and the bind site where the value reaches the query). Trace the data: a finding is real only when an attacker-influenced value actually reaches the query, and for the type-confusion case only when the request shape lets it arrive as a non-scalar (a JSON object, a bracketed query key). A fully code-defined value is not one. It flows through detect's normal steps and is tracked like any other finding.
- **In verify (proof):** the control holds only when an untrusted value can no longer change the query's structure. For the type-confusion case, a non-scalar can no longer reach the placeholder: the type is constrained or the request shape is validated at the edge, or the driver / escaper no longer expands objects into fragments. For string-built SQL, values are bound, not concatenated. For identifiers, the request selects a code-defined identifier by validated key, never splicing a raw one. If a crafted object, array, or string can still reshape the query, the risk is not closed: record it as such and point back to harden.
