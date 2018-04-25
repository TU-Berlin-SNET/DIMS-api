from rest_framework import serializers
from django.contrib.auth.models import User
from api.models import *


class UserSerializer(serializers.ModelSerializer):
    wallets = serializers.PrimaryKeyRelatedField(many=True, queryset=Wallet.objects.all())
    class Meta:
        model = User
        fields = ('id', 'url', 'username', 'email', 'wallets', 'is_staff')

class WalletSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')
    class Meta:
        model = Wallet
        fields = '__all__'

class SchemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schema
        fields = '__all__'

class ClaimDefSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaimDef
        fields = '__all__'


class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = '__all__'


class ClaimOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaimOffer
        fields = '__all__'



class IndyConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndyConnection
        fields = '__all__'


class ProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proof
        fields = '__all__'


