import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportEntries, parseArgs, parseConfig } from '../src/exporter.js';

const xml = (cookies = '<cookie name="n" host="h">001 &amp; True</cookie>') =>
  `<config><subdomains><subdomain>https://example.com</subdomain></subdomains><cookies>${cookies}</cookies></config>`;

test('parses singleton elements and preserves cookie strings and entities', () => {
  assert.deepEqual(parseConfig(xml()), [
    ['subdomains', '["https://example.com"]'], ['cookie:n:h', '001 & True'],
  ]);
});
test('exports the attached fixture: 38 subdomains and 46 cookies', () => {
  const entries = parseConfig(readFileSync(new URL('../config.xml', import.meta.url), 'utf8'));
  assert.equal(entries.length, 47);
  assert.equal(JSON.parse(entries[0]![1]).length, 38);
  assert.equal(entries.find(([key]) => key === 'cookie:dlp-avast:amazon')?.[1], 'mmm_amz_dlp_777_ppc_m');
  assert.equal(entries.find(([key]) => key === 'cookie:dlp-avg:filehippo')?.[1], 'Mmm_fhp_dlp_779_ppc_m');
});
test('supports empty lists and empty cookie values', () => {
  assert.deepEqual(parseConfig('<config><subdomains/><cookies/></config>'), [['subdomains', '[]']]);
  assert.equal(parseConfig(xml('<cookie name="n" host="h"/>'))[1]![1], '');
});
test('rejects malformed XML and missing sections', () => {
  for (const input of ['<config>', '<other/>', '<config><cookies/></config>']) {
    assert.throws(() => parseConfig(input));
  }
});
test('rejects DTDs and custom entities', () => {
  assert.throws(() => parseConfig('<!DOCTYPE config [<!ENTITY x "value">]>' + xml()), /DTDs/);
});
test('rejects missing attributes, ambiguous keys, nested values and duplicate keys', () => {
  for (const cookies of [
    '<cookie host="h">x</cookie>', '<cookie name="" host="h">x</cookie>',
    '<cookie name="a:b" host="h">x</cookie>', '<cookie name="n" host="h"><nested/></cookie>',
    '<cookie name="n" host="h">1</cookie><cookie name="n" host="h">2</cookie>',
  ]) assert.throws(() => parseConfig(xml(cookies)));
});
test('writes once atomically and returns only saved keys', async () => {
  const entries = parseConfig(xml());
  let calls = 0;
  const keys = await exportEntries(entries, { async mSet(values) {
    calls++;
    assert.deepEqual(values, entries);
    return 'OK';
  } });
  assert.equal(calls, 1);
  assert.deepEqual(keys, ['subdomains', 'cookie:n:h']);
});
test('propagates Redis write errors', async () => {
  await assert.rejects(exportEntries(parseConfig(xml()), { async mSet() { throw new Error('unavailable'); } }), /unavailable/);
});
test('parses verbose, spaced paths and option terminator', () => {
  assert.deepEqual(parseArgs(['-v', '/a path/config.xml']), { verbose: true, path: '/a path/config.xml' });
  assert.deepEqual(parseArgs(['--', '-config.xml']), { verbose: false, path: '-config.xml' });
  assert.deepEqual(parseArgs(['config.xml']), { verbose: false, path: 'config.xml' });
  for (const args of [[], ['-v'], ['--bad'], ['a', 'b']]) assert.throws(() => parseArgs(args), /Usage/);
});
