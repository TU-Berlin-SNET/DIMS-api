
# IdentityChain Indy-API

Indy REST API Agent built with python using the libindy python wrapper.

## Dependencies

- Python
- Pipenv
- Targeted Python Version (w/ virtualenv): Python 3.6
- libindy ([How to Install](https://github.com/hyperledger/indy-sdk#how-to-install))

## Quickstart
```
# Install dependencies and virtualenv declared in Pipfile
pipenv install

# activate the virtualenv
pipenv shell

# switch directory
cd identitychain_agent

# optional: run migrations
python manage.py migrate

# run the dev server
python manage.py runserver

# You can now access it at localhost:8000
# Try localhost:8000/api and localhost:8000/api/overview
```

NOTE: libindy creates a `.indy_client` directory in your home directory to store data

