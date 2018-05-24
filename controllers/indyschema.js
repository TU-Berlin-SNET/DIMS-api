
const Schema = require('../models/indyschema');
const indy = require('indy-sdk');



module.exports = {

  create: wrap(async (req, res, next) => {
    let s = new Schema({name: req.body.name, attrNames: req.body.attrNames, version : req.body.version});
    const w = await Wallet.findOne({owner: req.user, _id:req.body.walletname}).exec();


    let [id, schema] = await indy.issuerCreateSchema(w.issueDid, s.name,s.version, s.attrNames);


    const request = await indy.buildSchemaRequest(w.issueDid, schema);
    const wh = await indy.openWallet(w._id, w.config, w.credentials);
    const ph = await indy.openPoolLedger(process.env.POOL_NAME);
    await indy.signAndSubmitRequest(ph, wh, w.issueDid, request);
    s = await s.save();
    return res.status(201).send(w);



    /*    await anoncreds.issuer_create_schema(government_did, 'Job-Certificate', '0.2',
      json.dumps(['first_name', 'last_name', 'salary', 'employee_status',
        'experience']))
    */
   // return res.status(201).set('location', '/users/'+u._id).end();
  }),

  retrieve: wrap(async (req, res, next) => {
    // TODO return user's wallets, too
    if (req.user.id === req.params.id) {
      return res.status(200).set('content-type', 'application/json').send(req.user);
    }
    next();
  })


};


/*
listAllWalletsByOwner: async (req, res, next) => {
  console.log("HelloWallets")
  let w = await Wallet.find({owner: req.user});
  return res.status(200).send(w);
},*/
