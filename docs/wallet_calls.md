# List of Python Libindy Wrapper Calls

Almost all methods require either `wallet_name` or `wallet_handle`. Notable exceptions are methods for verification, building requests, `anon_crypt`, and `abbreviate_verkey`.

## Contents:

1. [List of Methods which require wallet name](#list-of-methods-which-require-wallet-name)
2. [List of Methods which require wallet handle](#list-of-methods-which-require-wallet-handle)
3. [List of Methods which require neither](#list-of-methods-which-require-neither)

### List of Methods which require wallet name
```
wallet
	.create_wallet
	.open_wallet
	.delete_wallet
```

### List of Methods which require wallet handle
```
wallet
	.close_wallet

anoncreds
	.issuer_create_and_store_credential_def
	.issuer_create_and_store_revoc_reg
	.issuer_create_credential_offer
	.issuer_create_credential
	.issuer_revoke_credential
	.prover_create_master_secret
	.prover_create_credential_req
	.prover_store_credential
	.prover_get_credentials
	.prover_get_credentials_for_proof_req
	.prover_create_proof

crypto
	.create_key
	.set_key_metadata
	.get_key_metadata
	.crypto_sign
	.auth_crypt
	.auth_decrypt
	.anon_decrypt

did
	.create_and_store_my_did
	.replace_keys_start
	.replace_keys_apply
	.store_their_did
	.create_key
	.set_key_metadata
	.get_key_metadata
	.key_for_did
	.key_for_local_did
	.set_endpoint_for_did
	.get_endpoint_for_did
	.set_did_metadata
	.get_did_metadata
	.get_my_did_with_meta
	.list_my_dids_with_meta

ledger
	.sign_and_submit_request
	.sign_request

pairwise
	.is_pairwise_exists
	.create_pairwise
	.list_pairwise
	.get_pairwise
	.set_pairwise_metadata
```

### List of Methods which require neither
```
anoncreds
	.issuer_create_schema
	.issuer_merge_revocation_registry_deltas
	.verifier_verify_proof
	.create_revocation_state
	.update_revocation_state

blob_storage
	.open_reader
	.open_writer

crypto
	.crypto_verify
	.anon_crypt

did
	.abbreviate_verkey

ledger
	.submit_request
	.build_get_ddo_request
	.build_nym_request
	.build_attrib_request
	.build_get_attrib_request
	.build_get_nym_request
	.build_schema_request
	.build_get_schema_request
	.parse_get_schema_response
	.build_cred_def_request
	.build_get_cred_def_request
	.parse_get_cred_def_response
	.build_node_request
	.build_get_txn_request
	.build_pool_config_request
	.build_pool_restart_request
	.build_pool_upgrade_request
	.build_revoc_reg_def_request
	.build_get_revoc_reg_def_request
	.parse_get_revoc_reg_def_response
	.build_revoc_reg_entry_request
	.build_get_revoc_reg_request
	.parse_get_revoc_reg_response
	.build_get_revoc_reg_delta_request
	.parse_get_revoc_reg_delta_response
```
