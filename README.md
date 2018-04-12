
# IdentityChain Indy-API

Indy REST API Agent built with python using the libindy python wrapper.

## Dependencies

- Python
- Pipenv
- Targeted Python Version (w/ virtualenv): Python 3.6
- libindy ([How to Install](https://github.com/hyperledger/indy-sdk#how-to-install))

## Configuration

Indy and django related configuration can be changed in `identitychain_agent/identitychain_agent/settings.py`. We provide two pool genesis transactions which provide the configuration for connecting to indy:

  * `pool_transactions_genesis.local` for connecting to a pool running at 10.20.30.xx locally
  * `pool_transactions_genesis.remote`(default) for connecting to a remote pool running at `"REPLACE"`

This can be changed by either editing the files directly or changing `POOL_TXN_PATH` in `settings.py`

## Quickstart
```
# Install dependencies and virtualenv declared in Pipfile
pipenv install

# activate the virtualenv
pipenv shell

# switch directory
cd identitychain_agent

# optional: make and run migrations
python manage.py makemigrations
python manage.py migrate

# run the dev server
python manage.py runserver

# You can now access it at localhost:8000
# Try localhost:8000/api and localhost:8000/api/overview
```

NOTE: libindy creates a `.indy_client` directory in your home directory to store data

