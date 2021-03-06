"use strict";
/**
 * 劇場タスクコントローラー
 *
 * @namespace TheaterController
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const chevre_domain_2 = require("@motionpicture/chevre-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('chevre-jobs:controller:theater');
/**
 *
 * @memberOf TheaterController
 */
function createScreensFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const screens = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`);
        yield Promise.all(screens.map((screen) => __awaiter(this, void 0, void 0, function* () {
            // 座席数情報を追加
            screen.seats_number = screen.sections[0].seats.length;
            // 座席グレードごとの座席数情報を追加
            const seatsNumbersBySeatCode = {};
            seatsNumbersBySeatCode[chevre_domain_2.ScreenUtil.SEAT_GRADE_CODE_NORMAL] = 0;
            seatsNumbersBySeatCode[chevre_domain_2.ScreenUtil.SEAT_GRADE_CODE_PREMIERE_BOX] = 0;
            seatsNumbersBySeatCode[chevre_domain_2.ScreenUtil.SEAT_GRADE_CODE_PREMIERE_LUXURY] = 0;
            seatsNumbersBySeatCode[chevre_domain_2.ScreenUtil.SEAT_GRADE_CODE_FRONT_RECLINING] = 0;
            screen.sections[0].seats.forEach((seat) => {
                seatsNumbersBySeatCode[seat.grade.code] += 1;
            });
            screen.seats_numbers_by_seat_grade = Object.keys(seatsNumbersBySeatCode).map((seatGradeCode) => {
                return {
                    seat_grade_code: seatGradeCode,
                    seats_number: seatsNumbersBySeatCode[seatGradeCode]
                };
            });
            debug('updating screen...');
            yield chevre_domain_1.Models.Screen.findByIdAndUpdate(screen._id, screen, {
                new: true,
                upsert: true
            }).exec();
            debug('screen updated');
        })));
        debug('promised.');
    });
}
exports.createScreensFromJson = createScreensFromJson;
/**
 *
 * @memberOf TheaterController
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const theaters = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/theaters.json`);
        yield Promise.all(theaters.map((theater) => __awaiter(this, void 0, void 0, function* () {
            debug('updating theater...');
            yield chevre_domain_1.Models.Theater.findByIdAndUpdate(theater._id, theater, {
                new: true,
                upsert: true
            }).exec();
            debug('theater updated');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
