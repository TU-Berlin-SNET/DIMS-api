import uuid
from django.db import models
from django.conf import settings

class Wallet(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey('auth.user', related_name='wallets', on_delete=models.CASCADE)
    pool_name = models.TextField(blank=True, default=settings.POOL_NAME)
    name = models.TextField(primary_key=True, blank=True, default=uuid.uuid4)
    xtype = models.TextField(blank=True)
    config = models.TextField(blank=True)
    seed = models.TextField(blank=True)
    credentials = models.TextField(blank=True)

    class Meta:
        ordering = ['created']


class Schema(models.Model):
    created = models.DateTimeField(auto_now_add=True)

    schema_object = models.TextField()

    class Meta:
        ordering = ['created']


class ClaimDef(models.Model):
    created = models.DateTimeField(auto_now_add=True)

    schema_req_id = models.TextField()

    class Meta:
        ordering = ['created']


class Claim(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    claim_object = models.TextField()

    class Meta:
         ordering = ['created']


class ClaimOffer(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    n_id = models.IntegerField()
    schema = models.IntegerField()
    seq_no = models.IntegerField()
    class Meta:
        ordering = ['created']


class IndyConnection(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    url = models.URLField()

    class Meta:
        ordering = ['created']


class Proof(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    proof_obj= models.TextField()

    class Meta:
        ordering = ['created']




