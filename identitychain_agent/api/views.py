from rest_framework import viewsets, permissions
from django.contrib.auth.models import User
from asgiref.sync import async_to_sync
from api.serializers import *
from api.models import *
from api.permissions import *
from indy import error, signus, ledger, wallet as IndyWallet


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
                # FIXME: maybe move to "virtual"(?) attribute on model
                wallet.xtype if wallet.xtype else None,
                wallet.config if wallet.config else None,
                wallet.credentials if wallet.credentials else None
            )
            # TODO create issuer DID?
            # FIXME how to distinguish between wallet which may write
            # on ledger and wallet which may not?
            return wallet
        except error.IndyError as err:
            # TODO more granular error handling
            # We encountered some Error with Indy so remove Wallet from
            # django as well
            # TODO better logging
            print("IndyError: " + str(err))
            wallet.delete()
            raise err

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

