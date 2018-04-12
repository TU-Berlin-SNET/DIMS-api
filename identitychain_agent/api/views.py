from rest_framework import viewsets
from django.contrib.auth.models import User
from django.conf import settings
from asgiref.sync import async_to_sync
from api.serializers import *
from api.models import *
from indy import error, wallet as IndyWallet

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class WalletViewSet(viewsets.ModelViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer

    def perform_create(self, serializer):
        wallet = serializer.save()
        try:
            async_to_sync(IndyWallet.create_wallet)(
                wallet.pool_name,
                str(wallet.name),
                wallet.xtype if wallet.xtype else None,
                wallet.config if wallet.config else None,
                wallet.credentials if wallet.credentials else None
            )
        except error.IndyError as err:
            # We encountered some Error with Indy so remove Wallet from
            # django as well
            # TODO better logging
            wallet.delete()
            print("IndyError: " + err)
            raise err
        return wallet


    # def list(self, request):
    #     pass
    #
    # def create(self, request):
    #     pass
    #
    # def retrieve(self, request, pk=None):
    #     pass
    #
    # def update(self, request, pk=None):
    #     pass
    #
    # def partial_update(self, request, pk=None):
    #     pass
    #
    # def destroy(self, request, pk=None):
    #     pass


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


class IndyConnectionViewSet(viewsets.ModelViewSet):
    queryset = IndyConnection.objects.all()
    serializer_class = IndyConnectionSerializer

class ProofViewSet(viewsets.ModelViewSet):
    queryset = Proof.objects.all()
    serializer_class = ProofSerializer

