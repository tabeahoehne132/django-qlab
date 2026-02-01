"""
Django REST Framework viewsets for query API.
...
"""

from rest_framework import viewsets
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from django.core.paginator import Paginator
from django.db.models import Q
from django.apps import apps

from qlab.pydantic_filter import QueryFilter
from qlab.model_validation import ValidationError
from qlab.serializers import ResponseSerializer, ModelMetadataSerializer, MetaDataRequestSerializer
from qlab.helpers import build_q, get_model_metadata
from qlab.settings import qlab_settings


class Query(viewsets.ViewSet):
    """
    ViewSet for executing dynamic queries against Django models.
    ...
    """
    
    @extend_schema(
        summary="Execute Dynamic Query",
        description=(
            "Execute a dynamic query against a Django model with custom field selection and filtering.\n\n"
            "Features:\n"
            "- Select specific fields (supports nested relations via '__' syntax)\n"
            "- Complex filtering with AND/OR/NOT operations\n"
            "- Automatic field path validation\n"
            "- Operation validation per field type\n"
            "- Paginated results (configurable page size)"
        ),
        responses={
            200: ResponseSerializer,
            400: {
                "description": "Validation error or missing required fields",
            }
        }
    )
    def post(self, request):
        """Execute a dynamic query with custom field selection and filtering."""
        try:
            # Get app_label from request or use default from settings
            app_label = request.data.get("app_label", qlab_settings.DEFAULT_APP_LABEL)
            
            query = QueryFilter(
                model=request.data["model"],
                select_fields=request.data["select_fields"],
                filter_fields=request.data.get("filter_fields", None),
                page=request.data["page"],
                app_label=app_label  # Pass app_label to validation
            )
        except ValidationError as e:
            return Response({"errors": e.errors()}, status=400)
        except KeyError as e:
            return Response({
                "errors": [{
                    "loc": e.args[0],
                    "msg": f"{e.args[0]} is required.",
                    "type": "value_error.missing"
                }]
            }, status=400)

        # Use the app_label from validated query
        app_label = query.app_label or qlab_settings.DEFAULT_APP_LABEL
        model = apps.get_model(app_label, query.model)
        
        filter_fields = getattr(query, "filter_fields", None)
        q_obj = build_q(query.filter_fields) if filter_fields else Q()
        results = model.objects.filter(q_obj).order_by('id').values(*query.select_fields)
        
        # Use page size from settings
        page_size = qlab_settings.PAGE_SIZE
        paginator = Paginator(results, page_size)
        page_obj = paginator.page(query.page)
        
        data = {
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "next": page_obj.next_page_number() if page_obj.has_next() else None,
            "previous": page_obj.previous_page_number() if page_obj.has_previous() else None,
            "results": list(page_obj.object_list)
        }
        serializer = ResponseSerializer(data)
        
        return Response(serializer.data)


class MetaData(viewsets.ViewSet):
    """
    ViewSet for retrieving model metadata for query building and autocomplete.
    ...
    """
    
    @extend_schema(
        summary="Get Model Metadata",
        description=(
            "Retrieve metadata for a Django model to enable query building and autocomplete.\n\n"
            "Returns:\n"
            "- All available fields (including nested relations)\n"
            "- Field types and properties (max_length, choices, etc.)\n"
            "- Allowed filter operations per field type\n"
            "- Complete list of valid field paths for autocomplete\n"
            "- Related model information\n\n"
            "Use this endpoint to build dynamic query UIs with proper validation."
        ),
        request=MetaDataRequestSerializer,
        responses={
            200: ModelMetadataSerializer,
            400: {
                "description": "Model not found or validation error",
            }
        }
    )
    def post(self, request):
        """Get comprehensive metadata for a Django model."""
        serializer = MetaDataRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        model_name = serializer.validated_data["model"]
        
        # Get app_label from request or use default from settings
        app_label = request.data.get("app_label", qlab_settings.DEFAULT_APP_LABEL)
        
        metadata = get_model_metadata(
            model_name,
            app_label=app_label,
            max_depth=qlab_settings.MAX_RELATION_DEPTH
        )
        
        serializer = ModelMetadataSerializer(metadata)
        return Response(serializer.data)