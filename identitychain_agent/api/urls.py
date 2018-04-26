from typing import List, Any

from django.urls import path, include
from rest_framework import routers
from rest_framework.schemas import get_schema_view
from rest_framework_swagger.renderers import OpenAPIRenderer, SwaggerUIRenderer
from api.views import *

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'wallet', WalletViewSet)
router.register(r'connectionoffer', ConnectionOfferViewSet)
router.register(r'connection', ConnectionViewSet, 'connections')
router.register(r'schema', SchemaViewSet)
router.register(r'claimdef', ClaimDefViewSet)
router.register(r'claim',ClaimViewSet)
router.register(r'claimoffer',ClaimOfferViewSet)
router.register(r'connection', IndyConnectionViewSet)
router.register(r'proof', ProofViewSet)
router.register(r'endpoint', EndpointViewSet, base_name='endpoint')

schema_view = get_schema_view(title='IdentityChain API', renderer_classes=[OpenAPIRenderer, SwaggerUIRenderer])


urlpatterns: List[Any] = [
    path(r'docs/', schema_view),
    path('', include(router.urls)),
]
