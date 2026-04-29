/**
 * Returns the index (exclusive) of the first row after `startIdx` whose depth
 * is strictly less than `depth`. Use this to find where a folder's children
 * block ends in the flat row array.
 */
export function spliceOutRangeAtDepth(
  rows: Array<{ depth: number }>,
  startIdx: number,
  depth: number,
): number {
  let i = startIdx + 1;
  while (i < rows.length && rows[i].depth >= depth) {
    i++;
  }
  return i;
}
