/**
 * IDChain Agent REST API
 * Proof Request Template Controller
 */
'use strict';

const Mongoose = require('../../db');

const ProofRequestTemplate = Mongoose.model('ProofRequestTemplate');

module.exports = {
    /**
     * List proof request templates belonging to wallet
     * @param {Wallet} wallet
     * @return {Promise<ProofRequestTemplate[]>}
     */
    async list(wallet) {
        return ProofRequestTemplate.find({ wallet: wallet.id }).exec();
    },

    /**
     * Create a proof request template
     * @param {Wallet} wallet
     * @param {object} template
     * @return {Promise<ProofRequestTemplate>}
     */
    async create(wallet, template) {
        const prt = await new ProofRequestTemplate({
            wallet: wallet.id,
            template: template
        }).save();
        return prt;
    },

    /**
     * Update a proof request template
     * @param {Wallet} wallet
     * @param {String} id tempalte _id
     * @param {object} template
     * @return {Promise<ProofRequestTemplate>}
     */
    async update(wallet, id, template) {
        let prt = await ProofRequestTemplate.findOne({
            _id: id,
            wallet: wallet.id
        }).exec();
        prt.set({ template });
        return await prt.save();
    },

    /**
     * Retrieve a proof request template
     * @param {Wallet} wallet
     * @param {String} id tempalte _id
     * @return {Promise<Message>}
     */
    async retrieve(wallet, id) {
        return ProofRequestTemplate.findOne({
            _id: id,
            wallet: wallet.id
        }).exec();
    },

    /**
     * Remove a proof request template
     * @param {Wallet} wallet
     * @param {String} id template _id
     * @return {Promise<Message>}
     */
    async remove(wallet, id) {
        const template = await module.exports.retrieve(wallet, id);
        if (template) {
            await template.remove();
        }
        return template;
    }
};
