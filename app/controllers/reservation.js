"use strict";
/**
 * 座席予約タスクコントローラー
 *
 * @namespace ReservationController
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
const gmo_service_1 = require("@motionpicture/gmo-service");
const conf = require("config");
const createDebug = require("debug");
const moment = require("moment");
const querystring = require("querystring");
const request = require("request");
const debug = createDebug('chevre-jobs:controller:reservation');
/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 *
 * @memberOf ReservationController
 */
function removeTmps() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        debug('removing temporary reservations...');
        yield chevre_domain_1.Models.Reservation.remove({
            status: chevre_domain_1.ReservationUtil.STATUS_TEMPORARY,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }).exec();
        debug('temporary reservations removed.');
        // 失敗しても、次のタスクにまかせる(気にしない)
    });
}
exports.removeTmps = removeTmps;
/**
 * CHEVRE確保上の仮予約をCHEVRE確保へ戻す
 *
 * @memberOf ReservationController
 */
function tmp2chevre() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        const ids = yield chevre_domain_1.Models.Reservation.distinct('_id', {
            status: chevre_domain_1.ReservationUtil.STATUS_TEMPORARY_ON_KEPT_BY_CHEVRE,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }).exec();
        yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
            debug('updating to STATUS_KEPT_BY_CHEVRE...id:', id);
            yield chevre_domain_1.Models.Reservation.findByIdAndUpdate(id, { status: chevre_domain_1.ReservationUtil.STATUS_KEPT_BY_CHEVRE }).exec();
            debug('updated to STATUS_KEPT_BY_CHEVRE. id:', id);
        })));
    });
}
exports.tmp2chevre = tmp2chevre;
/**
 * 固定日時を経過したら、空席ステータスにするバッチ
 *
 * @memberOf ReservationController
 */
function releaseSeatsKeptByMembers() {
    return __awaiter(this, void 0, void 0, function* () {
        if (moment(conf.get('datetimes.reservation_end_members')) < moment()) {
            // 空席にする場合はこちら
            debug('releasing reservations kept by members...');
            yield chevre_domain_1.Models.Reservation.remove({
                status: chevre_domain_1.ReservationUtil.STATUS_KEPT_BY_MEMBER
            }).exec();
            // 失敗しても、次のタスクにまかせる(気にしない)
        }
    });
}
exports.releaseSeatsKeptByMembers = releaseSeatsKeptByMembers;
/**
 * GMO離脱データを解放する(内部確保)
 * todo 空席に変更する仕様に変更
 *
 * @memberOf ReservationController
 */
function releaseGarbages() {
    return __awaiter(this, void 0, void 0, function* () {
        // 一定期間WAITING_SETTLEMENTの予約を抽出
        const WAITING_PERIOD_HOURS = -2;
        const reservations = yield chevre_domain_1.Models.Reservation.find({
            status: chevre_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT,
            updated_at: { $lt: moment().add(WAITING_PERIOD_HOURS, 'hours').toISOString() }
        }).exec();
        const paymentNos4release = [];
        const gmoUrl = (process.env.NODE_ENV === 'production') ?
            'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' :
            'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';
        const promises = reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
            // GMO取引状態参照
            debug('requesting... ');
            request.post({
                url: gmoUrl,
                form: {
                    ShopID: process.env.GMO_SHOP_ID,
                    ShopPass: process.env.GMO_SHOP_PASS,
                    OrderID: reservation.get('gmo_order_id'),
                    PayType: reservation.get('payment_method')
                }
            }, (error, response, body) => {
                const STATUS_CODE_OK = 200;
                debug('request processed.', error);
                if (error instanceof Error) {
                    throw error;
                }
                if (response.statusCode !== STATUS_CODE_OK) {
                    throw new Error(`statusCode is ${response.statusCode}`);
                }
                const searchTradeResult = querystring.parse(body);
                // GMOにない、あるいは、UNPROCESSEDであれば離脱データ
                if (searchTradeResult.ErrCode !== undefined) {
                    // M01-M01004002
                    // 指定されたオーダーIDの取引は登録されていません。
                    if (searchTradeResult.ErrCode === 'M01' && searchTradeResult.ErrInfo === 'M01004002') {
                        paymentNos4release.push(reservation.get('payment_no'));
                    }
                }
                else {
                    if (searchTradeResult.Status === gmo_service_1.Util.STATUS_CVS_UNPROCESSED ||
                        searchTradeResult.Status === gmo_service_1.Util.STATUS_CREDIT_UNPROCESSED) {
                        paymentNos4release.push(reservation.get('payment_no'));
                    }
                }
            });
        }));
        yield Promise.all(promises);
        debug('promised.');
        if (paymentNos4release.length === 0) {
            return;
        }
        // 予約削除
        debug('updating reservations...');
        yield chevre_domain_1.Models.Reservation.remove({
            payment_no: { $in: paymentNos4release }
        }).exec();
    });
}
exports.releaseGarbages = releaseGarbages;
