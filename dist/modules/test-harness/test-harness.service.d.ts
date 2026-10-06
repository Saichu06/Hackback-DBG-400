import Database from 'better-sqlite3';
export declare class TestHarnessService {
    /**
     * Executes KT3 randomized concurrent operations.
     */
    static runRandomOperations(seed?: number, count?: number, dbInstance?: Database.Database): Promise<{
        operations_run: number;
        final_trial_balance: any;
    }>;
}
