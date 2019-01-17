<img src="https://id-chain.github.io/square-logo300x300.png" align="left" height="140px" style="margin-right: 30px;" />

# IdentityChain Institutional Edge Agent API

This repository includes the codebase for our reusable Institutional Edge Agent API.For more information, please visit our Github Page.

<br>

## Run without [Docker]

#### Requirements

-   Running [Hyperledger Indy Node] Pool.

-   Running [MongoDB] instance which is used for persistence on top of Indy-DLT to support stateless REST API.

-   Libindy v1.6.1 installed on your system.

    > NOTE: libindy creates a `.indy_client` directory in your home directory
    > to store data. If API does not connect correctly to the pool, please
    > remove this directory to allow for new configuration settings.

-   Configuration either through environment variables or .env. Environment configuration is documented in `env-example`.

-   A `pool_transactions_genesis` file for the running pool. It can be generated using the tools in [idchain-commons] or, if running the `idchain/test-pool` docker image, read from the test-pool container with
    ```
    docker exec <CONTAINER_NAME> bash -c 'cat "/home/indy/.indy-cli/networks/$IDC_POOL_NAME/pool_transactions_genesis"' > pool_transactions_genesis
    ```
-   The high-level schema compiler situated at [idchain-schema-api]. Follow the instructions on the `README.md` of that repository on how to build and run the schema compiler HTTP api.

#### Run

```bash
# install dependencies
npm install

# run the api
npm run dev

# for tests
npm test
```

## Run with [Docker] and [Docker-Compose]

This will build and run 4 services: Indy-Pool, MongoDB, Schema-Compiler, and this API.

#### Requirements

-   [Docker] and [Docker-Compose]

-   Configuration either through environment variables or .env. Environment configuration is documented in `env-example`.

-   A `pool_transactions_genesis` file for the running pool. It can be generated using the tools in [idchain-commons] or, if running the `idchain/test-pool` docker image, read from the test-pool container with

    ```
    # start the test-pool if it is not running already
    docker-compose up pool

    # read and output the pool_transactions_genesis
    docker exec api_pool_1 bash -c 'cat "/home/indy/.indy-cli/networks/$IDC_POOL_NAME/pool_transactions_genesis"' > pool_transactions_genesis
    ```

-   The docker image built using the [idchain-commons] repository.

#### Run

```bash
# for normal deploy:
docker-compose up

# for live-reload:
# need to specify --name, --service-ports, and --use-aliases
# docker-compose run not apply these from docker-compose.yaml
docker-compose run --name idchain-api --service-ports --use-aliases -v $PWD:/home/indy/app api npm run dev

# while container is running, for tests:
docker exec -it -u indy idchain-api npm test
```

[hyperledger indy node]: https://github.com/hyperledger/indy-node
[mongodb]: https://www.mongodb.com/
[idchain-commons]: https://git.snet.tu-berlin.de/blockchain/identitychain/commons
[docker]: https://docker.com
[docker-compose]: https://docker.com/compose
