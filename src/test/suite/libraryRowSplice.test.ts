import * as assert from 'assert';
import { spliceOutRangeAtDepth } from '../../webview/client/libraryRowSplice';

suite('spliceOutRangeAtDepth', () => {
  test('removes contiguous rows at target depth (exclusive boundary)', () => {
    const rows = [
      { depth: 0 },
      { depth: 1 },
      { depth: 1 },
      { depth: 2 },
      { depth: 1 },
      { depth: 0 },
    ];

    const end = spliceOutRangeAtDepth(rows, 1, 1);
    assert.strictEqual(end, 5);
  });
});
