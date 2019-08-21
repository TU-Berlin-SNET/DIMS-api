/**
 * Credential Proposal Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../../controllers/credential');
const wrap = require('../../../util/asyncwrap').wrapNext;

router
    .route('/')
    .get(
        wrap(async (req, res, next) => {
            return await controller.proposal.list(req.wallet, req.query);
        })
    )
    .post(
        wrap(async (req, res, next) => {
            return await controller.proposal.create(
                req.wallet,
                req.body.recipientDid,
                req.body.comment,
                req.body.credentialProposal,
                req.body.schema,
                req.body.credentialDefinition
            );
        })
    );

router
    .route('/:credentialProposalId')
    .get(
        wrap(async (req, res, next) => {
            return await controller.proposal.retrieve(req.wallet, req.params.credentialProposalId);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return await controller.proposal.remove(req.wallet, req.params.credentialProposalId);
        })
    );

module.exports = router;
