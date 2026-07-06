import { existsSync, mkdirSync } from 'fs';

export function ensureDirectory(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}
