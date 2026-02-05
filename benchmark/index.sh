#!/usr/bin/env bash

DIR="$(cd "$(dirname "$0")" && pwd)"

LABELS=$(node -e "import('$DIR/cases.js').then(m => m.cases.forEach((c, i) => console.log(i + ':' + c.label)))")
TOTAL=$(echo "$LABELS" | wc -l | tr -d ' ')

echo "$LABELS" | while IFS=: read -r i label; do
  echo ""
  echo "[$((i + 1))/$TOTAL] $label"
  echo ""

  hyperfine --warmup 3 -N \
    --command-name sqlstring "env CASE=$i node $DIR/sqlstring.js" \
    --command-name sql-escaper "env CASE=$i node $DIR/sql-escaper.js"
done
