const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { scanDirectory } = require('../electron/scanner.cjs');
test('recursive sizes, unicode paths, zero-byte files and junctions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shijian-test-'));
  try {
    await fs.mkdir(path.join(root, '文档', 'nested'), { recursive: true });
    await fs.writeFile(path.join(root, '文档', 'a.bin'), Buffer.alloc(100));
    await fs.writeFile(path.join(root, '文档', 'nested', 'b.bin'), Buffer.alloc(250));
    await fs.writeFile(path.join(root, 'root.txt'), Buffer.alloc(50));
    await fs.writeFile(path.join(root, 'empty.txt'), '');
    await fs.symlink(root, path.join(root, 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await scanDirectory(root);
    assert.equal(result.bytes, 400); assert.equal(result.files, 4); assert.equal(result.links, 1);
    assert.equal(result.children.find(item => item.name === '文档').bytes, 350);
    assert.equal(result.complete, true);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(scanDirectory(root, { signal: controller.signal }), /SCAN_CANCELLED/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
