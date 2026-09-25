// 一次性诊断脚本（用后即删）：用假 ctx 直接执行宿主半边 apply()，
// 观察它是否抛错、注册了哪些路由、effect 用法如何
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const registered = [];
const effects = [];
const tools = [];

const fakeCtx = {
	connection: {
		fetch: {
			register(route) {
				registered.push(route.path);
				return () => {};
			}
		}
	},
	tools: {
		register(def) {
			tools.push(def.name);
			return () => {};
		}
	},
	effect(fn, label) {
		effects.push(label ?? '(unlabeled)');
		const disposer = fn();
		return typeof disposer === 'function' ? disposer : () => {};
	},
	logger: { info() {}, warn() {}, error(...a) { console.log('CTX-ERROR:', ...a); } },
	on() { return () => {}; }
};

const mod = require('D:/dsh安装插件skills专用/dsh-usage-panel/lib/index.js');
console.log('exports keys =', Object.keys(mod).join(','));
console.log('inject =', JSON.stringify(mod.inject));

try {
	mod.apply(fakeCtx);
	console.log('APPLY-OK');
	console.log('effects 数 =', effects.length, JSON.stringify(effects));
	console.log('注册路由数 =', registered.length);
	registered.forEach((p) => console.log('  route:', p));
	console.log('注册工具 =', JSON.stringify(tools));
} catch (err) {
	console.log('APPLY-THREW:', err && err.message);
	console.log(err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : '');
}
