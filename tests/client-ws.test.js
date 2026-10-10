import assert from 'node:assert/strict';
import test from 'node:test';
import { resolverUrlWs } from '../imports/api/client.js';

test('resolverUrlWs usa o mesmo origem em http', () => {
  assert.equal(
    resolverUrlWs({ protocol: 'http:', host: 'localhost:3003' }),
    'ws://localhost:3003/api/v1/ws',
  );
});

test('resolverUrlWs sobe para wss em https', () => {
  assert.equal(
    resolverUrlWs({ protocol: 'https:', host: 'exemplo.com' }),
    'wss://exemplo.com/api/v1/ws',
  );
});

test('resolverUrlWs volta ao daemon em file://', () => {
  assert.equal(
    resolverUrlWs({ protocol: 'file:', host: '' }),
    'ws://127.0.0.1:1980/api/v1/ws',
  );
});
