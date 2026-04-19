type DebugResourceOptions = {
    clearError(): void;
    reportError(error: unknown): void;
    run(): Promise<void>;
    setLoading(value: boolean): void;
};

async function runDebugResource(options: DebugResourceOptions): Promise<void> {
    options.setLoading(true);
    options.clearError();
    try {
        await options.run();
    } catch (error) {
        options.reportError(error);
    } finally {
        options.setLoading(false);
    }
}

export {
    runDebugResource
};
