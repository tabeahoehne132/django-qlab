"""
QLabMixin and NeighborhoodMixin for Django REST Framework ViewSets.

Provides dynamic QLab query functionality as a reusable mixin.
Permissions are handled entirely via DRF permission_classes.

Usage:
    class MyQueryViewSet(QLabMixin, viewsets.ViewSet):
        permission_classes = [IsAuthenticated, MyCustomPermission]

    class MyNeighborhoodViewSet(NeighborhoodMixin, viewsets.ViewSet):
        permission_classes = [IsAuthenticated, MyCustomPermission]
"""

from time import monotonic
from typing import Optional

from django.apps import apps
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response

from qlab.helpers import build_q, get_model_metadata
from qlab.model_validation import ValidationError
from qlab.pydantic_filters import QueryFilter
from qlab.serializers import (
    MetaDataRequestSerializer,
    ModelMetadataSerializer,
    ResponseSerializer,
)
from qlab.settings import qlab_settings

# Reusable error response schema for Swagger
_ERROR_SCHEMA = inline_serializer(
    name="QLabErrorResponse",
    fields={
        "errors": serializers.ListField(
            child=inline_serializer(
                name="QLabError",
                fields={
                    "loc": serializers.ListField(child=serializers.CharField()),
                    "msg": serializers.CharField(),
                    "type": serializers.CharField(),
                    "code": serializers.CharField(),
                },
            )
        )
    },
)


def _check_restricted(model_name: str) -> Optional[Response]:
    """Return a 403 Response if the model is restricted, else None."""
    restricted = [m.lower() for m in (qlab_settings.RESTRICTED_MODELS or [])]
    if model_name.lower() in restricted:
        return Response(
            {
                "errors": [
                    {
                        "loc": ["model"],
                        "msg": f"Model '{model_name}' is restricted and cannot be queried.",
                        "type": "value_error.restricted",
                        "code": "VALUE_ERROR_RESTRICTED",
                    }
                ]
            },
            status=403,
        )
    return None


def _check_allowed_app(app_label: str) -> Optional[Response]:
    """Return a 403 Response if the app is not allowed, else None."""
    allowed_apps = qlab_settings.ALLOWED_APPS or []
    if allowed_apps and app_label not in allowed_apps:
        return Response(
            {
                "errors": [
                    {
                        "loc": ["app_label"],
                        "msg": f"App '{app_label}' is not enabled for QLab.",
                        "type": "value_error.app_not_allowed",
                        "code": "VALUE_ERROR_APP_NOT_ALLOWED",
                    }
                ]
            },
            status=403,
        )
    return None


def _record_query_history(
    request,
    *,
    payload,
    app_label: str,
    model_name: str,
    status: str,
    duration_ms: Optional[int] = None,
    result_count: Optional[int] = None,
    error_message: str = "",
) -> None:
    """Persist query execution history for authenticated users only."""
    if not getattr(request.user, "is_authenticated", False):
        return

    try:
        from qlab.models import QueryRunHistory, SavedQuery

        saved_query = None
        saved_query_id = payload.get("saved_query_id")
        if saved_query_id:
            saved_query = SavedQuery.objects.filter(
                pk=saved_query_id,
                user=request.user,
            ).first()
            if saved_query and status == "success":
                saved_query.last_run_at = timezone.now()
                saved_query.save(update_fields=["last_run_at"])

        QueryRunHistory.objects.create(
            user=request.user,
            saved_query=saved_query,
            title=payload.get("title", ""),
            app_label=app_label,
            model_name=model_name,
            query_payload=payload,
            status=status,
            duration_ms=duration_ms,
            result_count=result_count,
            error_message=error_message,
        )
    except Exception:
        # Query execution must not fail because optional history logging failed.
        pass


class QLabMixin:
    """
    Mixin for DRF ViewSets that enables dynamic QLab queries.

    Permissions and queryset scoping are handled entirely via DRF,
    allowing standard permission_classes and custom permissions to be used.

    Override get_queryset() to apply custom filtering or scoping before
    QLab processes the request.

    Example:
        class MyQueryViewSet(QLabMixin, viewsets.ViewSet):
            permission_classes = [IsAuthenticated, MyCustomPermission]

            def get_queryset(self, model):
                # Only return records belonging to the user's tenant
                return model.objects.filter(tenant=self.request.user.tenant)
    """

    def get_queryset(self, model):
        """
        Return the base queryset for QLab to filter against.

        Override this method to apply custom scoping, e.g. filtering by
        tenant, business group, or any other access restriction.

        QLab will apply its own filter conditions on top of this queryset,
        so only return the base scope here — not the final filtered result.

        Args:
            model: The resolved Django model class from the request.

        Returns:
            A QuerySet of model instances to query against.
        """
        return model.objects.all()

    def execute_query(self, request, payload):
        """Execute a QLab query payload and return a DRF Response."""
        started_at = monotonic()
        requested_model = payload.get("model", "")
        app_label = payload.get("app_label", qlab_settings.DEFAULT_APP_LABEL)
        try:
            query = QueryFilter(
                model=payload["model"],
                select_fields=payload["select_fields"],
                filter_fields=payload.get("filter_fields", None),
                page=payload.get("page", 1),
                app_label=payload.get("app_label", qlab_settings.DEFAULT_APP_LABEL),
            )
        except ValidationError as e:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=requested_model or "unknown",
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=str(e),
            )
            return Response(e.errors(), status=400)
        except KeyError as e:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=requested_model or "unknown",
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=f"{e.args[0]} is required.",
            )
            return Response(
                {
                    "errors": [
                        {
                            "loc": [e.args[0]],
                            "msg": f"{e.args[0]} is required.",
                            "type": "value_error.missing",
                            "code": "VALUE_ERROR_MISSING",
                        }
                    ]
                },
                status=400,
            )

        app_label = query.app_label or qlab_settings.DEFAULT_APP_LABEL
        allowed_app = _check_allowed_app(app_label)
        if allowed_app:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=query.model,
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=f"App '{app_label}' is not enabled for QLab.",
            )
            return allowed_app
        restricted = _check_restricted(query.model)
        if restricted:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=query.model,
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=f"Model '{query.model}' is restricted and cannot be queried.",
            )
            return restricted
        try:
            model = apps.get_model(app_label, query.model)
        except LookupError:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=query.model,
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=f"Model '{query.model}' does not exist in app '{app_label}'.",
            )
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["model"],
                            "msg": f"Model '{query.model}' does not exist in app '{app_label}'.",
                            "type": "value_error",
                            "code": "VALUE_ERROR",
                        }
                    ]
                },
                status=400,
            )

        filter_fields = getattr(query, "filter_fields", None)
        q_obj = build_q(query.filter_fields) if filter_fields else Q()

        # Always include PK in results even if not in select_fields
        pk_field = model._meta.pk.name
        select_fields = list(query.select_fields)
        pk_included = pk_field in select_fields
        if not pk_included:
            select_fields = [pk_field] + select_fields

        # Apply custom scoping via get_queryset(), then apply QLab filters on top
        try:
            raw_results = (
                self.get_queryset(model)
                .filter(q_obj)
                .order_by("id")
                .values(*select_fields)
            )

            page_size = min(
                payload.get("page_size", qlab_settings.PAGE_SIZE),
                qlab_settings.MAX_PAGE_SIZE,
            )
            paginator = Paginator(raw_results, page_size)
            try:
                page_obj = paginator.page(query.page)
            except (PageNotAnInteger, EmptyPage):
                _record_query_history(
                    request,
                    payload=payload,
                    app_label=app_label,
                    model_name=query.model,
                    status="failed",
                    duration_ms=int((monotonic() - started_at) * 1000),
                    error_message=f"Page '{query.page}' is out of range.",
                )
                return Response(
                    {
                        "errors": [
                            {
                                "loc": ["page"],
                                "msg": f"Page '{query.page}' is out of range.",
                                "type": "value_error.page",
                                "code": "VALUE_ERROR_PAGE",
                            }
                        ]
                    },
                    status=400,
                )
        except (ValueError, TypeError, DjangoValidationError) as e:
            _record_query_history(
                request,
                payload=payload,
                app_label=app_label,
                model_name=query.model,
                status="failed",
                duration_ms=int((monotonic() - started_at) * 1000),
                error_message=str(e),
            )
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["filter_fields"],
                            "msg": "One or more filter values are invalid for the selected field.",
                            "type": "value_error.filter",
                            "code": "VALUE_ERROR_FILTER",
                        }
                    ]
                },
                status=400,
            )

        if not pk_included:
            results = [{"id": row[pk_field], **row} for row in page_obj.object_list]
        else:
            results = list(page_obj.object_list)

        data = {
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "next": page_obj.next_page_number() if page_obj.has_next() else None,
            "previous": (
                page_obj.previous_page_number() if page_obj.has_previous() else None
            ),
            "results": results,
        }

        _record_query_history(
            request,
            payload=payload,
            app_label=app_label,
            model_name=query.model,
            status="success",
            duration_ms=int((monotonic() - started_at) * 1000),
            result_count=paginator.count,
        )

        return Response(ResponseSerializer(data).data)

    @extend_schema(
        summary="Execute Dynamic Query",
        description=(
            "Execute a dynamic query against a Django model.\n\n"
            "Supports field selection, AND/OR/NOT filtering, pagination, "
            "and relation traversal via __ syntax."
        ),
        request=inline_serializer(
            name="QLabQueryRequest",
            fields={
                "model": serializers.CharField(),
                "select_fields": serializers.ListField(child=serializers.CharField()),
                "filter_fields": serializers.DictField(required=False),
                "page": serializers.IntegerField(required=False, default=1),
                "page_size": serializers.IntegerField(required=False),
                "app_label": serializers.CharField(required=False),
            },
        ),
        responses={200: ResponseSerializer, 400: _ERROR_SCHEMA},
        examples=[
            OpenApiExample(
                "Simple Query",
                value={
                    "model": "Book",
                    "select_fields": ["id", "title", "published", "author__first_name"],
                },
                request_only=True,
            ),
            OpenApiExample(
                "Query with AND Filter",
                value={
                    "model": "Book",
                    "select_fields": ["id", "title"],
                    "filter_fields": {
                        "and_operation": [
                            {"field": "published", "op": "is", "value": "true"}
                        ]
                    },
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        """Execute a dynamic QLab query."""
        return self.execute_query(request, request.data)


class NeighborhoodMixin:
    """
    Mixin for DRF ViewSets that resolves all relations for a set of records.

    Automatically reads all FK, OneToOne and M2M relations from the given
    model and returns the PKs of related records per node.

    Override get_queryset() to restrict which records can be resolved,
    e.g. to enforce tenant or business group scoping.

    Guardrails:
        - MAX_NODES: Maximum number of node_pks per request (default: 100)

    Example:
        class MyNeighborhoodViewSet(NeighborhoodMixin, viewsets.ViewSet):
            permission_classes = [IsAuthenticated, MyCustomPermission]

            def get_queryset(self, model):
                return model.objects.filter(tenant=self.request.user.tenant)
    """

    def get_queryset(self, model):
        """
        Return the base queryset for neighborhood resolution.

        Override this method to restrict which records are accessible,
        e.g. by tenant, business group, or any other access restriction.

        Records not included in this queryset will be silently excluded
        from the neighborhood response, even if their IDs were requested.

        Args:
            model: The resolved Django model class from the request.

        Returns:
            A QuerySet of model instances to resolve neighborhoods for.
        """
        return model.objects.all()

    @extend_schema(
        summary="Resolve Neighborhood",
        description=(
            "Resolve all relations for a set of record IDs.\n\n"
            "Returns all FK, OneToOne and M2M relation PKs per node, "
            "including reverse relations. Each relation includes a filter_name "
            "for use in QLab query filter_fields."
        ),
        request=inline_serializer(
            name="QLabNeighborhoodRequest",
            fields={
                "model": serializers.CharField(),
                "node_pks": serializers.ListField(child=serializers.CharField()),
                "app_label": serializers.CharField(required=False),
            },
        ),
        responses={
            200: inline_serializer(
                name="QLabNeighborhoodResponse",
                fields={
                    "model": serializers.CharField(),
                    "records": serializers.ListField(child=serializers.DictField()),
                },
            ),
            400: _ERROR_SCHEMA,
        },
        examples=[
            OpenApiExample(
                "Neighborhood Request",
                value={"model": "Author", "node_pks": ["1", "2"]},
                request_only=True,
            ),
        ],
    )
    def neighborhood(self, request):
        """Resolve all relations for a set of record IDs."""
        model_name = request.data.get("model")
        app_label = request.data.get("app_label", qlab_settings.DEFAULT_APP_LABEL)
        node_pks = request.data.get("node_pks", [])

        # --- Input validation ---
        if not model_name:
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["model"],
                            "msg": "model is required.",
                            "type": "value_error.missing",
                            "code": "VALUE_ERROR_MISSING",
                        }
                    ]
                },
                status=400,
            )

        if not node_pks:
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["node_pks"],
                            "msg": "node_pks is required.",
                            "type": "value_error.missing",
                            "code": "VALUE_ERROR_MISSING",
                        }
                    ]
                },
                status=400,
            )

        # --- Guardrail: MAX_NODES ---
        max_nodes = qlab_settings.MAX_NODES
        if len(node_pks) > max_nodes:
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["node_pks"],
                            "msg": f"Too many node_pks. Maximum allowed is {max_nodes}.",
                            "type": "value_error.max_nodes",
                            "code": "VALUE_ERROR_MAX_NODES",
                        }
                    ]
                },
                status=400,
            )

        # --- Resolve model ---
        allowed_app = _check_allowed_app(app_label)
        if allowed_app:
            return allowed_app
        restricted = _check_restricted(model_name)
        if restricted:
            return restricted
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {
                    "errors": [
                        {
                            "loc": ["model"],
                            "msg": f"Model '{model_name}' does not exist in app '{app_label}'.",
                            "type": "value_error",
                            "code": "VALUE_ERROR",
                        }
                    ]
                },
                status=400,
            )

        # --- Fetch records using get_queryset() for scoping ---
        queryset = self.get_queryset(model).filter(pk__in=node_pks)

        # --- Resolve relations ---
        from django.db.models.fields.related import (
            ForeignKey,
            ManyToManyField,
            ManyToManyRel,
            ManyToOneRel,
            OneToOneField,
            OneToOneRel,
        )

        relation_fields = [
            field
            for field in model._meta.get_fields()
            if isinstance(
                field,
                (
                    ForeignKey,
                    OneToOneField,
                    ManyToManyField,  # forward
                    ManyToOneRel,
                    ManyToManyRel,
                    OneToOneRel,  # reverse
                ),
            )
        ]

        records = []
        for obj in queryset:
            relations = {}

            for field in relation_fields:
                # Forward relations: use field.name
                # Reverse relations: use related_name if set, otherwise auto-generated accessor
                if isinstance(field, (ForeignKey, OneToOneField, ManyToManyField)):
                    accessor = field.name
                else:
                    accessor = field.related_name or field.get_accessor_name()

                try:
                    if isinstance(field, (ForeignKey, OneToOneField)):
                        related_id = getattr(obj, f"{field.name}_id", None)
                        relations[accessor] = {
                            "pks": [related_id] if related_id is not None else [],
                            "filter_name": field.name,
                        }
                    elif isinstance(field, OneToOneRel):
                        related_obj = getattr(obj, accessor, None)
                        relations[accessor] = {
                            "pks": [related_obj.pk] if related_obj is not None else [],
                            "filter_name": field.related_query_name(),
                        }
                    elif isinstance(
                        field, (ManyToManyField, ManyToOneRel, ManyToManyRel)
                    ):
                        relations[accessor] = {
                            "pks": list(
                                getattr(obj, accessor).values_list("pk", flat=True)
                            ),
                            "filter_name": (
                                field.name
                                if hasattr(field, "name")
                                else field.related_query_name()
                            ),
                        }
                except Exception:
                    relations[accessor] = {"pks": [], "filter_name": accessor}

            records.append(
                {
                    "nodeId": str(obj.pk),
                    "relations": relations,
                }
            )

        return Response(
            {
                "model": f"{app_label}.{model_name}",
                "records": records,
            }
        )


class QLabMetadataMixin:
    """
    Mixin for DRF ViewSets that exposes model metadata for query building.

    Returns field types, allowed operations, relation info, and all valid
    lookup paths for a given model. Useful for building dynamic query UIs
    with autocomplete and validation.

    Permissions are handled entirely via DRF permission_classes.

    Example:
        class MyMetadataViewSet(QLabMetadataMixin, viewsets.ViewSet):
            permission_classes = [IsAuthenticated, IsAdminUser]
    """

    @extend_schema(
        summary="Get Model Metadata",
        description=(
            "Retrieve metadata for a Django model.\n\n"
            "Returns all fields, types, allowed operations, relation info, "
            "and valid lookup paths for autocomplete and validation."
        ),
        request=MetaDataRequestSerializer,
        responses={200: ModelMetadataSerializer, 400: _ERROR_SCHEMA},
        examples=[
            OpenApiExample(
                "Metadata Request",
                value={"model": "Book"},
                request_only=True,
            ),
        ],
    )
    def metadata(self, request):
        """Return metadata for a Django model."""
        serializer = MetaDataRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        model_name = serializer.validated_data["model"]
        app_label = serializer.validated_data.get(
            "app_label", qlab_settings.DEFAULT_APP_LABEL
        )
        relation_depth = serializer.validated_data.get(
            "relation_depth", qlab_settings.METADATA_MAX_RELATION_DEPTH
        )
        relation_depth = min(max(relation_depth, 0), qlab_settings.MAX_RELATION_DEPTH)
        include_reverse_relations = serializer.validated_data.get(
            "include_reverse_relations",
            qlab_settings.METADATA_INCLUDE_REVERSE_RELATIONS,
        )

        allowed_app = _check_allowed_app(app_label)
        if allowed_app:
            return allowed_app
        restricted = _check_restricted(model_name)
        if restricted:
            return restricted

        metadata = get_model_metadata(
            model_name,
            app_label=app_label,
            max_depth=relation_depth,
            include_reverse_relations=include_reverse_relations,
        )

        return Response(ModelMetadataSerializer(metadata).data)
