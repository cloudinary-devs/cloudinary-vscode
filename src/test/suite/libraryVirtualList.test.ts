import * as assert from 'assert';
import { computeWindow } from '../../webview/client/libraryVirtualList';

suite('libraryVirtualList.computeWindow', () => {
  test('returns viewport range with buffer', () => {
    const windowRange = computeWindow({
      scrollTop: 100,
      viewportHeight: 220,
      rowHeight: 22,
      totalRows: 1000,
      buffer: 5,
    });

    assert.strictEqual(windowRange.startIdx, 0);
    assert.strictEqual(windowRange.endIdx, 19);
    assert.ok(windowRange.startOffset % 22 === 0);
  });

  test('clamps endIdx to total rows', () => {
    const windowRange = computeWindow({
      scrollTop: 10000,
      viewportHeight: 100,
      rowHeight: 22,
      totalRows: 50,
      buffer: 5,
    });

    assert.strictEqual(windowRange.endIdx, 50);
  });
});
