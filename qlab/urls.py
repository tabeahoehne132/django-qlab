"""
URL configuration for QLab API endpoints.

Provides RESTful endpoints for:
- Dynamic query execution with filtering and field selection
- Model metadata retrieval for autocomplete and validation

These URLs can be included in your project's main urls.py or
registered with a Django REST Framework router.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from qlab.views import Query, MetaData


# App namespace for URL reversing
app_name = 'qlab'


urlpatterns = [
    path(
        'query/',
        Query.as_view({'post': 'post'}),
        name='query-execute'
    ),
    path(
        'metadata/',
        MetaData.as_view({'post': 'post'}),
        name='metadata-retrieve'
    ),
]


# Create a router and register viewsets
router = DefaultRouter()
router.register(r'query', Query, basename='query')
router.register(r'metadata', MetaData, basename='metadata')

# Use this in your main urls.py:
# from qlab.urls import router as qlab_router
# urlpatterns = [
#     path('api/qlab/', include(qlab_router.urls)),
# ]

