import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type Entry = readonly [key: string, value: string];
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const array = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

export function parseConfig(xml: string): Entry[] {
  // Configs have no need for DTDs or custom entities.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTDs and entity declarations are not supported');
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`Invalid XML: ${valid.err.msg}`);
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false,
    trimValues: false, alwaysCreateTextNode: true,
  }).parse(xml);
  if (!object(parsed) || !object(parsed.config)) throw new Error('Expected a <config> root');
  const config = parsed.config;
  if (!object(config.subdomains) || !object(config.cookies)) {
    throw new Error('Expected <subdomains> and <cookies> sections');
  }
  const subdomains = array(config.subdomains.subdomain).map(value => {
    if (!object(value) || typeof value['#text'] !== 'string' || !value['#text'].trim()) {
      throw new Error('Each subdomain must contain text');
    }
    return value['#text'].trim();
  });
  const entries: Entry[] = [['subdomains', JSON.stringify(subdomains)]];
  const keys = new Set<string>();
  for (const cookie of array(config.cookies.cookie)) {
    if (!object(cookie)) throw new Error('Invalid cookie');
    const name = cookie['@_name'];
    const host = cookie['@_host'];
    if (typeof name !== 'string' || typeof host !== 'string' || !name.trim() || !host.trim()) {
      throw new Error('Each cookie needs name and host attributes');
    }
    if (name.includes(':') || host.includes(':')) throw new Error('Cookie name and host cannot contain colons');
    if (Object.keys(cookie).some(key => !key.startsWith('@_') && key !== '#text')) {
      throw new Error('Cookie values must be text, not nested XML');
    }
    const value = cookie['#text'] ?? '';
    if (typeof value !== 'string') throw new Error('Cookie value must be text');
    const key = `cookie:${name}:${host}`;
    if (keys.has(key)) throw new Error(`Duplicate cookie key: ${key}`);
    keys.add(key);
    entries.push([key, value]);
  }
  return entries;
}

export interface RedisWriter {
  mSet(entries: [string, string][]): Promise<unknown>;
}

export async function exportEntries(entries: Entry[], redis: RedisWriter): Promise<string[]> {
  // A single MSET atomically replaces all keys from this file.
  await redis.mSet(entries.map(([key, value]) => [key, value]));
  return entries.map(([key]) => key);
}

export function parseArgs(args: string[]): { verbose: boolean; path: string } {
  let verbose = false;
  let path: string | undefined;
  let options = true;
  for (const arg of args) {
    if (options && arg === '--') { options = false; continue; }
    if (options && arg === '-v') { verbose = true; continue; }
    if ((options && arg.startsWith('-')) || path !== undefined) throw new Error('Usage: export.sh [-v] /path/to/xml');
    path = arg;
  }
  if (!path) throw new Error('Usage: export.sh [-v] /path/to/xml');
  return { verbose, path };
}
