# Environment variables used in API project

## Variables defined at system level

These variables determine IP addresses and ports the components of the IDCHAIN project bind their sockets to,
as well as HTTP url used by API component. The variables are normally set in the .profile of an user.

### public IP address of the host
``PUBLIC_IP=`curl -s ident.me```

### Network where public IP address belongs 
The network is hard coded as class C ( 24 bit mask )
``PUBLIC_NETWORK=`echo $PUBLIC_IP | sed -e 's/\.[0-9]\+$/.0/'```

### subnet for docker-compose network
`API_SUBNET="${PUBLIC_NETWORK}/24"`


### address and port API service binds the HTTP socket on
`APP_HOST="0.0.0.0"`

`APP_PORT=8000`

### default endpoint for indy agent to agent communication

`APP_ENDPOINT=http://${APP_HOST}:${APP_PORT}/indy`

### Indy pool has to use PUBLIC_IP to bind its sockets 
`POOL_IP=${PUBLIC_IP}`

### port range which indy pool nodes bind to
`POOL_PORTS=9701-9708`

### (exclusive) initial port of POOL_PORTS range
`PORTSTART=9700`

### IP address and port the database bounds its socket 
`DB_HOST=0.0.0.0`

`DB_PORT=27017`



## Variables defined at application level 

These variables determine various properties of services within IDCHAIN project. They are normally set in .env script used by docker-compose and other scripts.

### bcrypt saltOrRounds configuration
SALTROUNDS=10

### Java web token salt 
```JWT_SECRET=your_jwt_secret```  

### wallet provider/cache time between retries of opening a wallet in ms
```WALLETCACHE_WAIT_TIME=300```

### wallet provider/cache max retries before it fails
```WALLETCACHE_MAX_RETRIES=3```

### API logger log level
```LOG_LEVEL=debug```

### low-level rust indy-sdk/libindy log level
```RUST_LOG=debug```

### database user username and password
```DB_USER=```

```DB_PASSWORD=```



### name for the pool
```POOL_NAME=testPool```

### path to pool\_transactions\_genesis
```GENESIS_TXN=pool_transactions_genesis```
