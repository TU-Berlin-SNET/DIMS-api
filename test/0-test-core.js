'use strict';

const vars = require('./0-test-vars');
const agent = vars.agent;
const bothHeaders = vars.bothHeaders;

const User = require('../models/user');

async function createUser(user) {
    let username = user.username;
    await User.remove({ username });

    const res = await agent
        .post('/api/user')
        .set(bothHeaders)
        .send(user)
        .expect(201);
    const id = res.get('location').substring(6);
    user.id = id;
    return id;
}

async function login(user) {
    return await agent
        .post('/api/login')
        .set(bothHeaders)
        .send(user)
        .expect(200);
}

module.exports = {
    createUser,
    login
};
