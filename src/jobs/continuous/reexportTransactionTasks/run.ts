/**
 * 取引キューエクスポートが実行中のままになっている取引を監視する
 */
import * as chevre from '@chevre/domain';
import * as createDebug from 'debug';

import { connectMongo } from '../../../connectMongo';

const debug = createDebug('chevre-jobs:*');

connectMongo().then(() => {
    let countRetry = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 500;
    const transactionRepo = new chevre.repository.Transaction(chevre.mongoose.connection);
    const RETRY_INTERVAL_MINUTES = 10;

    setInterval(
        async () => {
            if (countRetry > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            countRetry += 1;

            try {
                debug('reexporting tasks...');
                await transactionRepo.reexportTasks({ intervalInMinutes: RETRY_INTERVAL_MINUTES });
            } catch (error) {
                console.error(error);
            }

            countRetry -= 1;
        },
        INTERVAL_MILLISECONDS
    );
}).catch((err) => {
    console.error('connetMongo:', err);
    process.exit(1);
});
