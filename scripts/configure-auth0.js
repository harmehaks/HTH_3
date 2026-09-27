import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { localAuth0Configuration } from './auth0-local-config.js';

// Keep unrelated lines and comments while removing duplicate managed settings.
export function updateEnvironment(text, settings) {
  const written = new Set();
  const lines = text.split(/\r?\n/).flatMap((line) => {
    const name = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/)?.[1];
    if (!Object.hasOwn(settings, name)) return [line];
    if (written.has(name)) return [];
    written.add(name);
    return [`${name}=${JSON.stringify(settings[name])}`];
  });
  for (const [name, value] of Object.entries(settings)) {
    if (!written.has(name)) lines.push(`${name}=${JSON.stringify(value)}`);
  }
  return lines.join('\n').replace(/\n*$/, '\n');
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      'Run npm run setup:auth0 in your own interactive terminal. Do not send the secret through chat.',
    );
  console.log(
    'Select Redactor_OG in Auth0, with client ID ' + localAuth0Configuration.AUTH0_CLIENT_ID,
  );
  console.log(
    'In its Credentials tab, select Client Secret (Post) and save, then copy its Client Secret.',
  );
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const input = createInterface({ input: process.stdin, output, terminal: true });
  let secret;
  try {
    secret = await new Promise((resolve, reject) => {
      input.once('SIGINT', () => reject(new Error('Cancelled; no settings were saved.')));
      input.question('Paste Client Secret (hidden): ', (answer) => resolve(answer.trim()));
      muted = true;
    });
  } finally {
    muted = false;
    input.close();
    process.stdout.write('\n');
  }
  if (
    !secret ||
    secret === localAuth0Configuration.AUTH0_CLIENT_ID ||
    secret.length < 20 ||
    /[\s*"']|MASKED|your-client-secret|replace-with|the-secret-from/i.test(secret)
  )
    throw new Error(
      'Paste the actual Client Secret for Redactor_OG, without surrounding quotes or a placeholder. Nothing was saved.',
    );
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const existing = await readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const current = dotenv.parse(existing);
  const settings = {
    ...localAuth0Configuration,
    AUTH0_CLIENT_SECRET: secret,
    AUTH0_ROLES_CLAIM: current.AUTH0_ROLES_CLAIM || 'https://redactor.app/roles',
  };
  if (!current.SESSION_SECRET || current.SESSION_SECRET.length < 32)
    settings.SESSION_SECRET = randomBytes(32).toString('hex');
  await writeFile(path, updateEnvironment(existing, settings), { mode: 0o600 });
  console.log(
    'Auth0 settings saved locally. Existing service keys and database settings were retained.',
  );
  console.log(
    'Restart the running server, then open http://localhost:3000/login for a fresh sign-in.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
