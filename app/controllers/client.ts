/**
 * クライアントタスクコントローラー
 *
 * @namespace controller/client
 */

import * as chevre from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:staff');

/**
 *
 * @memberOf controller/client
 */
export async function createFromJson(): Promise<void> {
    const clients: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/clients.json`);

    // あれば更新、なければ追加
    await Promise.all(clients.map(async (client) => {
        // パスワードハッシュ化
        const SIZE = 64;
        const secretSalt = crypto.randomBytes(SIZE).toString('hex');
        client.secret_salt = secretSalt;
        client.secret_hash = chevre.CommonUtil.createHash(client.secret, secretSalt);

        debug('updating client...');
        await chevre.Models.Client.findOneAndUpdate(
            {
                _id: client.id
            },
            client,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('client updated');
    }));
    debug('promised.');
}
