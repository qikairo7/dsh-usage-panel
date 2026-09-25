export declare const name = "usage-panel";
export declare const inject: string[];
export declare const Config: any;
export declare function apply(ctx: Context, config?: Record<string, any>): void;
/** Minimal ambient shape; the host provides the real Context at runtime. */
interface Context {
    tools: {
        /** `output` is mandatory: register() throws without { schema, render }. */
        register(definition: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            output: {
                schema: Record<string, unknown>;
                render(args: unknown, value: any): unknown[];
                presentationMeta?(args: unknown, value: any): unknown;
            };
            execute: (args: unknown, exec: unknown) => Promise<unknown>;
        }): unknown;
    };
    /** Cordis effect: setup runs now, the returned disposer runs on fiber teardown. */
    effect(callback: () => void | (() => void), label?: string): unknown;
    /**
     * Cordis dependency injection: `callback` runs once every named service is
     * available, receiving a context that carries them. This is the ONLY way to
     * obtain `webServer` here — `ctx.get('webServer')` returns undefined forever
     * on this host (measured against the real cordis, 2026-09-25).
     */
    inject(names: string[], callback: (injected: any) => void): unknown;
    logger?: {
        info?(message: string): void;
        warn?(message: string): void;
        error?(...args: unknown[]): void;
    };
}
export {};
