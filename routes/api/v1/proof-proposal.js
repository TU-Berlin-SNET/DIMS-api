/**
 * Proof Proposal Routes
 */
'use strict';

const router = require('express').Router();
const controller = require('../../../controllers/proof');
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
                req.body.attributes,
                req.body.predicates
            );
        })
    );

router
    .route('/:proofProposalId')
    .get(
        wrap(async (req, res, next) => {
            return await controller.proposal.retrieve(req.wallet, req.params.proofProposalId);
        })
    )
    .delete(
        wrap(async (req, res, next) => {
            return await controller.proposal.remove(req.wallet, req.params.proofProposalId);
        })
    );

module.exports = router;
