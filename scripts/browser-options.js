import { existsSync } from 'node:fs';
import { join } from 'node:path';
export function browserOptions() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
    return { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
  if (process.env.PLAYWRIGHT_CHANNEL) return { channel: process.env.PLAYWRIGHT_CHANNEL };
  if (process.platform === 'win32') {
    const roots = [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES].filter(Boolean);
    if (roots.some((root) => existsSync(join(root, 'Microsoft/Edge/Application/msedge.exe'))))
      return { channel: 'msedge' };
  }
  return {};
}
