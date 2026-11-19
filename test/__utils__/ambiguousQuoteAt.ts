export const ambiguousQuoteAt = (position: number) => ({
  name: 'TypeError',
  message: `argument sql has a quote after an odd number of backslashes at position ${position}, which the SQL modes read differently: pass the string that holds it as a value instead`,
});
