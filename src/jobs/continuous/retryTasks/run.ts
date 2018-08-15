/**
 * タスクリトライ
 */
import * as chevre from '@chevre/domain';

import { connectMongo } from '../../../connectMongo';

connectMongo().then(() => {
    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 500;
    const RETRY_INTERVAL_MINUTES = 10;
    const taskRepo = new chevre.repository.Task(chevre.mongoose.connection);

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await chevre.service.task.retry(RETRY_INTERVAL_MINUTES)({ task: taskRepo });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
}).catch((err) => {
    console.error('connetMongo:', err);
    process.exit(1);
});
