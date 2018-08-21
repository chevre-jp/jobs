/**
 * 上映イベントデータを集計する
 */
import * as chevre from '@chevre/domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';

const debug = createDebug('chevre-jobs:*');
const AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS = (process.env.AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS !== undefined)
    // tslint:disable-next-line:no-magic-numbers
    ? parseInt(process.env.AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS, 10)
    : 1;

async function main() {
    await connectMongo();
    const redisClient = chevre.redis.createClient({
        // tslint:disable-next-line:no-magic-numbers
        port: Number(<string>process.env.REDIS_PORT),
        host: <string>process.env.REDIS_HOST,
        password: <string>process.env.REDIS_KEY,
        tls: { servername: <string>process.env.REDIS_HOST }
    });

    const aggregationRepo = new chevre.repository.aggregation.ScreeningEvent(redisClient);
    const eventRepo = new chevre.repository.Event(chevre.mongoose.connection);
    const placeRepo = new chevre.repository.Place(chevre.mongoose.connection);
    const eventAvailabilityRepo = new chevre.repository.itemAvailability.ScreeningEvent(redisClient);
    const startFrom = new Date();
    const startThrough = moment(startFrom).add(AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS, 'weeks').toDate();
    await chevre.service.aggregation.aggregateScreeningEvents({
        startFrom: startFrom,
        startThrough: startThrough,
        ttl: 86400
    })({
        aggregation: aggregationRepo,
        screeningEventAvailability: eventAvailabilityRepo,
        event: eventRepo,
        place: placeRepo
    });
}

main().then(() => {
    debug('success!');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
