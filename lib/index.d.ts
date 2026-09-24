export declare const name = "usage-panel";
export declare const inject: string[];
export declare const Config: any;
export declare function apply(ctx: Context, config?: Record<string, any>): void;
/** Minimal ambient shape; the host provides the real Context at runtime. */
interface Context {
    connection: {
        fetch: {
            register(route: {
                path: string;
                methods: string[];
                requestBody: string;
                fetch: (request: Request) => Promise<Response>;
            }): unknown;
        };
    };
    tools: {
        register(definition: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            execute: (args: unknown, exec: unknown) => Promise<unknown>;
        }): unknown;
    };
}
export {};
