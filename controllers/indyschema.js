
const Schema = require('../models/indyschema');



module.exports = {

  create: async (req, res, next) => {
    let s = new Schema({name: req.body.name, attrNames: req.body.attrNames, version : req.body.version});

    s = await s.save();


    /*    await anoncreds.issuer_create_schema(government_did, 'Job-Certificate', '0.2',
      json.dumps(['first_name', 'last_name', 'salary', 'employee_status',
        'experience']))
    */
    return res.status(201).set('location', '/users/'+u._id).end();
  },

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
