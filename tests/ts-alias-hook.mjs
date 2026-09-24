/**
 * Test-time module alias: map `./x.js` imports (tsc Bundler style, emitted
 * as-is into lib/) back to `x.ts` when running tests directly against src/
 * via Node type stripping. Registered through ts-alias.mjs.
 */
export async function resolve(specifier, context, next) {
	try {
		return await next(specifier, context);
	} catch (e) {
		if (e !== null && typeof e === 'object' && e.code === 'ERR_MODULE_NOT_FOUND' && /\.js(\?|$)/.test(specifier)) {
			return next(specifier.replace(/\.js(\?|$)/, '.ts$1'), context);
		}
		throw e;
	}
}
