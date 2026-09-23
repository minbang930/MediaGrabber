const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OrderedFragmentWriter,
  assertCaptureSessionId
} = require('../dist/mse-capture-core.js');

test('capture session ids accept only bounded safe identifiers', () => {
  assert.doesNotThrow(() => assertCaptureSessionId('mse_42_abc-XYZ'));
  assert.throws(() => assertCaptureSessionId(''), /Invalid MSE capture session id/);
  assert.throws(() => assertCaptureSessionId('../escape'), /Invalid MSE capture session id/);
  assert.throws(() => assertCaptureSessionId('a'.repeat(97)), /Invalid MSE capture session id/);
});

test('fragment writer preserves fragment and chunk order across out-of-order delivery', () => {
  const writes = [];
  const writer = new OrderedFragmentWriter((chunk) => writes.push(Buffer.from(chunk)));

  writer.append(1, 0, 1, Buffer.from('C'));
  assert.equal(Buffer.concat(writes).toString(), '');

  writer.append(0, 1, 2, Buffer.from('B'));
  assert.equal(Buffer.concat(writes).toString(), '');

  writer.append(0, 0, 2, Buffer.from('A'));

  assert.equal(Buffer.concat(writes).toString(), 'ABC');
  assert.equal(writer.bytes, 3);
  assert.equal(writer.pendingFragmentCount, 0);
  assert.doesNotThrow(() => writer.finish());
});

test('fragment writer never flushes an incomplete multi-chunk fragment', () => {
  const writes = [];
  const writer = new OrderedFragmentWriter((chunk) => writes.push(Buffer.from(chunk)));

  writer.append(0, 0, 2, Buffer.from('A'));

  assert.equal(writes.length, 0);
  assert.equal(writer.bytes, 0);
  assert.equal(writer.pendingFragmentCount, 1);
  assert.throws(() => writer.finish(), /incomplete fragments/);
});

test('duplicate chunks are ignored without replacing the first payload', () => {
  const writes = [];
  const writer = new OrderedFragmentWriter((chunk) => writes.push(Buffer.from(chunk)));

  const first = writer.append(0, 0, 2, Buffer.from('A'));
  const duplicate = writer.append(0, 0, 2, Buffer.from('X'));
  writer.append(0, 1, 2, Buffer.from('B'));

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(Buffer.concat(writes).toString(), 'AB');
  assert.equal(writer.bytes, 2);
});

test('fragment writer rejects inconsistent chunk counts and invalid indexes', () => {
  const writer = new OrderedFragmentWriter(() => {});

  writer.append(0, 0, 2, Buffer.from('A'));
  assert.throws(
    () => writer.append(0, 1, 3, Buffer.from('B')),
    /chunk count changed/
  );
  assert.throws(
    () => writer.append(-1, 0, 1, Buffer.from('A')),
    /Invalid MSE fragment index/
  );
  assert.throws(
    () => writer.append(1, 2, 2, Buffer.from('A')),
    /Invalid MSE capture chunk index/
  );
});

test('fragment writer bounds pending out-of-order fragments', () => {
  const writer = new OrderedFragmentWriter(() => {}, {
    maxPendingFragments: 2
  });

  writer.append(1, 0, 1, Buffer.from('B'));
  writer.append(2, 0, 1, Buffer.from('C'));

  assert.throws(
    () => writer.append(3, 0, 1, Buffer.from('D')),
    /Too many pending MSE capture fragments/
  );
});
