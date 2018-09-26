# IdentityChain Agent REST API

## Running locally

### Without Docker

#### Requirements

-   Running [Hyperledger Indy Node] Pool.

-   Running [MongoDB] instance which is used for persistence on top of Indy-DLT to support stateless REST API.

-   Libindy v1.6.1 installed on your system.

-   Configuration either through environment variables or .env

-   A `pool_transactions_genesis` file for the running pool. It can be generated using the tools in [idchain-commons] or, if running the `idchain/test-pool`, read from the test-pool container with
    ```
    docker exec api_pool_1 bash -c 'cat "/home/indy/.indy-cli/networks/$POOL_NAME/pool_transactions_genesis"' > pool_transactions_genesis
    ```

> NOTE: libindy creates a `.indy_client` directory in your home directory
> to store data. If API does not connect correctly to the pool, please
> remove this folder to allow for new configuration settings.

#### Run

```bash
# install dependencies
npm install

# run the api
npm run dev

# for tests
npm test
```

#### Config

Check `env-example` file for configuration variables of indy-pool, host and port of API
and DB, and create your own `.env` file or set environment variables.
If required add own `pool_transaction_genesis` file.

### With Docker Compose

This will build and run 4 services: Indy-Pool, MongoDB, and this API.

#### Requirements

-   [Docker] and [docker-compose]

-   Configuration either through environment variables or .env

-   A `pool_transactions_genesis` file for the running pool. It can be generated using the tools in [idchain-commons] or, if running the `idchain/test-pool`, read from the test-pool container with

    ```
    # start the test-pool if it is not running already
    docker-compose run pool

    # read and output the pool_transactions_genesis
    docker exec api_pool_1 bash -c 'cat "/home/indy/.indy-cli/networks/$POOL_NAME/pool_transactions_genesis"' > pool_transactions_genesis
    ```

#### Run

```bash
# for normal deploy
docker-compose up

# or for live-reload
# need to specify name because container_name is ignored, see https://github.com/docker/compose/issues/2061
docker-compose run --name idchain-api --service-ports -v $PWD:/home/indy/app api npm run dev

# for tests
docker exec -it -u indy idchain-api npm test
```

[hyperledger indy node]: https://github.com/hyperledger/indy-node
[mongodb]: https://www.mongodb.com/
[idchain-commons]: https://git.snet.tu-berlin.de/blockchain/identitychain/commons
[docker]: https://docker.com
[docker-compose]: https://docker.com/compose
