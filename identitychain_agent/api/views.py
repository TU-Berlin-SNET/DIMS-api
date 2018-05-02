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


class ConnectionViewSet(viewsets.ViewSet):

    def create(self, request, *args, **kwargs):
        wallet_name = request.data['wallet']
        conn_did = request.data['connection_offer']['did']
        conn_nonce = request.data['connection_offer']['nonce']
        print(wallet_name)
        print(conn_did)
        print(conn_nonce)
        return Response(status=status.HTTP_200_OK)


class EndpointViewSet(viewsets.GenericViewSet):
    """
    create: Deliver message to this endpoint
    """
    serializer_class = EndpointSerializer

    def create(self, request, *args, **kwargs):
        #message_type = request.data['type']
        #message = request.data['message']
        print(url)
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

