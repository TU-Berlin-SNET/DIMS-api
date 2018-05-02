import requests
import json
from rest_framework import viewsets, permissions, status, mixins
from rest_framework.response import Response
from rest_framework.reverse import reverse
from django.contrib.auth.models import User
from django.conf import settings
from asgiref.sync import async_to_sync
from api.serializers import *
from api.models import *
from api.permissions import *
from indy import error, signus, ledger, pool, anoncreds, pairwise, crypto, wallet as IndyWallet

pool_handle = async_to_sync(pool.open_pool_ledger)(settings.POOL_NAME, None)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class WalletViewSet(viewsets.ModelViewSet):
    """
    retrieve:
    Return given Wallet.

    create:
    Create a new Wallet (optionally with given name and settings)

    destroy:
    Delete given Wallet
    """
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def perform_create(self, serializer):
        wallet = serializer.save(owner=self.request.user)
        try:
            async_to_sync(IndyWallet.create_wallet)(
                wallet.pool_name,
                str(wallet.name),
                wallet.xtype if wallet.xtype else None,
                wallet.config if wallet.config else None,
                wallet.credentials if wallet.credentials else None
            )
            return wallet
        except error.IndyError as err:
            # We encountered some Error with Indy so remove Wallet from
            # django as well (disabled until we have an endpoint to import)
            print("IndyError: " + str(err))
            # wallet.delete()
            # raise err
        return wallet

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        instance.open();
        pairwises = async_to_sync(pairwise.list_pairwise)(instance.handle)
        instance.close()

        serializer = self.get_serializer(instance)
        data = serializer.data
        data['pairwise'] = pairwises
        return Response(data)


class ConnectionOfferViewSet(viewsets.ModelViewSet):
    queryset = ConnectionOffer.objects.all()
    serializer_class = ConnectionOfferSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = serializer.validated_data['wallet']
        wallet_handle = wallet.open()

        (issueDID, isNew) = IssueDID.objects.get_or_create(wallet=wallet)
        if issueDID.did == '':
            did_json = json.dumps({'seed': wallet.seed}) if wallet.seed else None
            (did, key) = async_to_sync(signus.create_and_store_my_did)(wallet_handle, did_json)
            issueDID.did = did
            issueDID.save()

        (from_to_did, from_to_key) = async_to_sync(signus.create_and_store_my_did)(wallet_handle, "{}")
        endpoint = request.scheme + '://' + request.get_host() + reverse('api-root') + '/endpoint'
        async_to_sync(signus.set_endpoint_for_did)(wallet_handle, from_to_did, endpoint, from_to_key)
        nym_request = async_to_sync(ledger.build_nym_request)(issueDID.did, from_to_did, from_to_key, None, None)
        async_to_sync(ledger.sign_and_submit_request)(pool_handle, wallet_handle, issueDID.did, nym_request)
        serializer.save(did=from_to_did)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ConnectionViewSet(viewsets.GenericViewSet):
    serializer_class = ConnectionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = serializer.validated_data['wallet']
        connection_offer = serializer.validated_data['connection_offer']
        from_to_did = connection_offer['did']
        # FIXME: nonce somehow disappears in serializer..???
        # nonce = connection_offer['nonce']
        nonce = request.data['connection_offer']['nonce']
        print(from_to_did)
        print(nonce)

        wallet_handle = wallet.open()
        (to_from_did, to_from_key) = async_to_sync(signus.create_and_store_my_did)(wallet_handle, "{}")
        from_to_verkey = async_to_sync(signus.key_for_did)(pool_handle, wallet_handle, from_to_did)
        connection_response = json.dumps({
            'did': to_from_did,
            'verkey': to_from_key,
            'nonce': nonce
        }).encode('utf-8')
        anoncrypted_conn_response = async_to_sync(crypto.crypto_box_seal)(from_to_verkey, connection_response)
        payload = json.dumps({
            'type': 'anon',
            'target': 'accept_connection',
            'ref': nonce,
            'message': anoncrypted_conn_response
        })
        endpoint = async_to_sync(signus.get_endpoint_for_did)(wallet_handle, pool_handle, from_to_did)
        print(connection_response)
        print(anoncrypted_conn_response)
        print(endpoint)
        requests.post(endpoint, data=payload, headers={'content-type': 'application/json'})
        wallet.close()

        return Response(status=status.HTTP_200_OK)


class EndpointViewSet(viewsets.GenericViewSet):
    """
    create: Deliver message to this endpoint
    """
    serializer_class = EndpointSerializer

    def create(self, request, *args, **kwargs):
        print('RECEIVED MESSAGE AT ENDPOINT')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        crypto_type = serializer.validated_data['type']
        target = serializer.validated_data['target']
        ref = serializer.validated_data['ref']
        message = serializer.validated_data['message']
        print(crypto_type)
        print(target)
        print(ref)
        print(message)
        if not ref == 'accept_connection':
            raise NotImplementedError()
        connection_offer = ConnectionOffer.objects.get(pk=ref)
        wallet = connection_offer.wallet
        from_to_did = connection_offer.did
        nonce = connection_offer.nonce
        print(connection_offer)
        print(wallet)
        print(from_to_did)
        print(nonce)
        wallet_handle = wallet.open()
        from_to_key = async_to_sync(signus.key_for_local_did)(wallet_handle, from_to_did)
        conn_response = async_to_sync(crypto.crypto_box_seal_open)(wallet_handle, from_to_key, message)
        to_from_did = conn_response['did']
        to_from_key = conn_response['verkey']
        print(conn_response)
        print(to_from_did)
        print(to_from_key)
        if not nonce == conn_response['nonce']:
            return Response('nonce mismatch', status=status.HTTP_400_BAD_REQUEST)
        issueDID = IssueDID.objects.get(wallet=wallet)
        nym_request = async_to_sync(ledger.build_nym_request)(issueDID.did, to_from_did, to_from_key, None, None)
        async_to_sync(ledger.sign_and_submit_request)(pool_handle, wallet_handle, issueDID.did, nym_request)
        async_to_sync(pairwise.create_pairwise)(wallet_handle, to_from_did, from_to_did, None)
        wallet.close()

        return Response(status=status.HTTP_200_OK)


class SchemaViewSet(viewsets.ModelViewSet):
    queryset = Schema.objects.all()
    serializer_class = SchemaSerializer


class ClaimDefViewSet(viewsets.ModelViewSet):
    queryset = ClaimDef.objects.all()
    serializer_class = ClaimDefSerializer


class ClaimViewSet(viewsets.ModelViewSet):
    queryset = Claim.objects.all()
    serializer_class = ClaimSerializer


class ClaimOfferViewSet(viewsets.ModelViewSet):
    queryset = ClaimOffer.objects.all()
    serializer_class = ClaimOfferSerializer


class ProofViewSet(viewsets.ModelViewSet):
    queryset = Proof.objects.all()
    serializer_class = ProofSerializer

class RevocationViewSet(viewsets.ModelViewSet):
    queryset = Revocation.objects.all()
    serializer_class = RevocationSerializer
