"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 上映イベントデータを集計する
 */
const chevre = require("@chevre/domain");
const createDebug = require("debug");
const moment = require("moment");
const connectMongo_1 = require("../../../connectMongo");
const debug = createDebug('chevre-jobs:*');
const AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS = (process.env.AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS !== undefined)
    // tslint:disable-next-line:no-magic-numbers
    ? parseInt(process.env.AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS, 10)
    : 1;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield connectMongo_1.connectMongo();
        const redisClient = chevre.redis.createClient({
            // tslint:disable-next-line:no-magic-numbers
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
            password: process.env.REDIS_KEY,
            tls: { servername: process.env.REDIS_HOST }
        });
        const aggregationRepo = new chevre.repository.aggregation.ScreeningEvent(redisClient);
        const eventRepo = new chevre.repository.Event(chevre.mongoose.connection);
        const placeRepo = new chevre.repository.Place(chevre.mongoose.connection);
        const eventAvailabilityRepo = new chevre.repository.itemAvailability.ScreeningEvent(redisClient);
        const startFrom = new Date();
        const startThrough = moment(startFrom).add(AGGREGATE_SCREENING_EVENTS_PERIOD_IN_WEEKS, 'weeks').toDate();
        yield chevre.service.aggregation.aggregateScreeningEvents({
            startFrom: startFrom,
            startThrough: startThrough,
            ttl: 86400
        })({
            aggregation: aggregationRepo,
            screeningEventAvailability: eventAvailabilityRepo,
            event: eventRepo,
            place: placeRepo
        });
    });
}
main().then(() => {
    debug('success!');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
