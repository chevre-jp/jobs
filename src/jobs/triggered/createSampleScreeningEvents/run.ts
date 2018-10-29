// tslint:disable:insecure-random no-magic-numbers
/**
 * サンプル上映イベントデータを作成する
 */
import * as chevre from '@chevre/domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';

const debug = createDebug('chevre-jobs:*');

async function main() {
    await connectMongo();
    const eventRepo = new chevre.repository.Event(chevre.mongoose.connection);
    const placeRepo = new chevre.repository.Place(chevre.mongoose.connection);
    const ticketTypeRepo = new chevre.repository.TicketType(chevre.mongoose.connection);

    const eventSeriesList = await eventRepo.searchScreeningEventSeries({});
    // イベントシリーズをランダム選定
    const eventSeries = eventSeriesList[Math.floor(Math.random() * eventSeriesList.length)];
    // 上映ルームをランダム選定
    const movieTheater = await placeRepo.findMovieTheaterByBranchCode(eventSeries.location.branchCode);
    const screeningRooms = movieTheater.containsPlace;
    const screeningRoom = screeningRooms[Math.floor(Math.random() * screeningRooms.length)];
    const ticketTypeGroups = await ticketTypeRepo.searchTicketTypeGroups({});
    // 券種グループをランダム選定
    const ticketTypeGroup = ticketTypeGroups[Math.floor(Math.random() * ticketTypeGroups.length)];
    const duration = Math.floor((Math.random() * 90) + 90);
    const delay = Math.floor(Math.random() * 780);
    const doorTime = moment(`${moment().add(Math.floor(Math.random() * 7), 'days').format('YYYY-MM-DD')}T09:00:00+09:00`)
        .add(delay, 'minutes').toDate();
    const startDate = moment(doorTime).add(10, 'minutes').toDate();
    const endDate = moment(startDate).add(duration, 'minutes').toDate();
    const offers: chevre.factory.event.screeningEvent.IOffer = {
        typeOf: 'Offer',
        priceCurrency: chevre.factory.priceCurrency.JPY,
        availabilityEnds: endDate,
        availabilityStarts: moment(startDate).add(-7, 'days').toDate(),
        validFrom: moment(startDate).add(-3, 'days').toDate(),
        validThrough: endDate,
        eligibleQuantity: {
            value: 4,
            unitCode: chevre.factory.unitCode.C62,
            typeOf: 'QuantitativeValue'
        }
    };
    const eventAttributes: chevre.factory.event.screeningEvent.IAttributes = {
        typeOf: chevre.factory.eventType.ScreeningEvent,
        name: eventSeries.name,
        duration: moment.duration(duration, 'minutes').toISOString(),
        doorTime: doorTime,
        startDate: startDate,
        endDate: endDate,
        eventStatus: chevre.factory.eventStatusType.EventScheduled,
        location: {
            typeOf: screeningRoom.typeOf,
            branchCode: screeningRoom.branchCode,
            name: screeningRoom.name
        },
        workPerformed: eventSeries.workPerformed,
        superEvent: eventSeries,
        ticketTypeGroup: ticketTypeGroup.id,
        offers: offers
    };
    await eventRepo.saveScreeningEvent({ attributes: eventAttributes });
}

main().then(() => {
    debug('success!');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
