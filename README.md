
# IdentityChain Agent REST API

WIP

## Run ##
	
		npm install
		npm run dev

## Config ##

Check `.env` file for configuration of indy-pool, host and port of API and DB. If required add own `pool_transaction_genesis` file and change configuration here. 

## Requirements ##

Running [MongoDB](https://www.mongodb.com/) instance which is used for persitence on top of Indy-DLT to support stateless REST API. 

Check [Install MongoDB Community Edition](https://docs.mongodb.com/manual/administration/install-community/) on how to install MongoDB on your system.

---

NOTE: libindy creates a `.indy_client` directory in your home directory to store data. If API does not connect correctly to the pool, please remove this folder to allow for new configuration settings. 