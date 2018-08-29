const APIResult = require('../api-result');
const WalletController = require('./wallet');
const wrap = require('../asyncwrap').wrap;

const User = require('../models/user');
const Wallet = require('../models/wallet');

/**
 * Check if user is the same as requesting user
 * @param {object} user req.user
 * @param {string} resource req.params.user
 * @return {boolean}
 */
function isSame(user, resource) {
    return resource === 'me' || resource === user.id;
}

const notFoundResult = APIResult.notFound('user not found');

module.exports = {
    create: wrap(async (req, res, next) => {
        const user = await module.exports.createUser(req.body.username, req.body.password, req.body.wallet);
        res.set('location', '/user/' + user._id);
        next(APIResult.created({ id: user._id }));
    }),

    retrieve: wrap(async (req, res, next) => {
        if (!isSame(req.user, req.params.user)) {
            return next(notFoundResult);
        }
        const result = {
            id: req.user.id,
            username: req.user.username
        };
        if (req.user.wallet) result.wallet = req.user.wallet;
        next(APIResult.success(result));
    }),

    update: wrap(async (req, res, next) => {
        if (!isSame(req.user, req.params.user)) {
            return next(notFoundResult);
        }
        if (!req.body.username && !req.body.password && !req.body.wallet) {
            return next(APIResult.badRequest('no values to update provided'));
        }
        const user = req.user;
        const updatedUser = await module.exports.updateUser(
            user,
            req.body.username,
            req.body.password,
            req.body.wallet
        );
        const result = {
            id: updatedUser.id,
            username: updatedUser.username
        };
        if (req.user.wallet) result.wallet = updatedUser.wallet;
        next(APIResult.success(result));
    }),

    delete: wrap(async (req, res, next) => {
        if (!isSame(req.user, req.params.user)) {
            return next(notFoundResult);
        }
        await req.user.remove();
        // if there is a wallet and this wallet belongs to the user
        // then it has been closed and deleted (by cascading delete)
        // and we need to set isDeleted and handle manually on this instance
        if (req.wallet && req.wallet.owner.equals(req.user._id)) {
            req.wallet.isDeleted = function() {
                return true;
            };
            req.wallet.handle = -1;
        }
        next(APIResult.noContent());
    }),

    async usernameIsTaken(username) {
        return (await User.count({ username: username }).exec()) > 0;
    },

    async createUser(username, password, wallet) {
        if (await module.exports.usernameIsTaken(username)) {
            throw APIResult.badRequest('username already taken');
        }
        let user = await new User({
            username: username,
            password: password
        });
        if (typeof wallet === 'object') {
            const walletItem = await WalletController.createWallet(wallet, user);
            user.wallet = walletItem._id;
        }
        user = await user.save();
        return user;
    },

    async updateUser(user, username, password, walletId) {
        if (username) user.username = username;
        if (password) user.password = password;
        if (walletId) {
            const wallet = await Wallet.findById(walletId).exec();
            if (!wallet || !wallet.usableBy(user)) {
                throw APIResult.notFound('could not find suitable wallet with id');
            }
            user.wallet = wallet._id;
        }
        const updatedUser = await user.save();
        return updatedUser;
    }
};
