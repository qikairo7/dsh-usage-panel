export declare const name = "usage-panel";
export declare const inject: string[];
export declare const Config: any;
export declare function apply(ctx: Context, config?: Record<string, any>): void;
/** Minimal ambient shape; the host provides the real Context at runtime. */
interface Context {
    tools: {
        register(definition: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            execute: (args: unknown, exec: unknown) => Promise<unknown>;
        }): unknown;
    };
    /** Cordis effect: setup runs now, the returned disposer runs on fiber teardown. */
    effect(callback: () => void | (() => void), label?: string): unknown;
    /** Synchronous service lookup (cordis): undefined when the service is absent. */
    get?(name: string): any;
    logger?: {
        info?(message: string): void;
        warn?(message: string): void;
        error?(...args: unknown[]): void;
    };
}
export {};
