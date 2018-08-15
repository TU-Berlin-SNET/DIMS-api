/**
 * IdChain Agent REST API
 * Authentication and UserProvider Middleware
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const JwtStrategy = require('passport-jwt').Strategy;
const jwt = require('jsonwebtoken');

const log = require('../log').log;
const User = require('../models/user');

const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

passport.use(
    new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password',
            session: false
        },
        function(username, password, done) {
            User.findOne({ username }, async (err, user) => {
                if (err) {
                    return done(err);
                }

                if (!user) {
                    return done(null, false, { message: 'User not found.' });
                }

                let check = await user.checkPassword(password);
                if (!check) {
                    return done(null, false, { message: 'User not found.' });
                }
                return done(null, user);
            });
        }
    )
);

passport.use(
    new JwtStrategy(jwtOptions, function(payload, done) {
        User.findById(payload.id, (err, user) => {
            if (err) {
                return done(err);
            }
            if (user) {
                done(null, user);
            } else {
                done(null, false);
            }
        });
    })
);

module.exports = passport.authenticate('jwt', { session: false });

module.exports.login = async (req, res, next) => {
    await passport.authenticate('local', function(err, user) {
        let body, status;
        if (user == false) {
            body = { error: 'Login failed' };
            status = 401;
        } else {
            const payload = {
                id: user.id
            };
            let jwtsecret = process.env.JWT_SECRET;
            const token = jwt.sign(payload, jwtsecret, { expiresIn: '1h' });

            body = { user: user.displayName, token: 'Bearer ' + token };
            status = 200;
        }

        return res.status(status).send(body);
    })(req, res);
};
