/** Entry that registers the .js→.ts resolve hook for src-direct tests. */
import { register } from 'node:module';
register('./ts-alias-hook.mjs', import.meta.url);
