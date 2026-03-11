from django.apps import apps
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from qlab.mixins import NeighborhoodMixin, QLabMetadataMixin, QLabMixin
from qlab.models import QLabUserSettings, QueryRunHistory, SavedQuery
from qlab.serializers import (
    QLabUserSettingsSerializer,
    QueryRunHistorySerializer,
    SavedQuerySerializer,
)
from qlab.settings import qlab_settings


class QLabFrontendApiViewSet(
    QLabMixin,
    NeighborhoodMixin,
    QLabMetadataMixin,
    viewsets.ViewSet,
):
    """
    Packaged API surface for the bundled frontend.

    Host projects can still provide their own ViewSet for custom permissions
    or queryset scoping, but these routes make the packaged UI usable out of
    the box.
    """

    permission_classes = [permissions.IsAuthenticated]


class QLabSettingsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _get_object(self):
        settings_obj, _ = QLabUserSettings.objects.get_or_create(user=self.request.user)
        return settings_obj

    @extend_schema(
        summary="Get QLab User Settings",
        responses=QLabUserSettingsSerializer,
    )
    def retrieve(self, request):
        return Response(QLabUserSettingsSerializer(self._get_object()).data)

    @extend_schema(
        summary="Update QLab User Settings",
        request=QLabUserSettingsSerializer,
        responses=QLabUserSettingsSerializer,
    )
    def partial_update(self, request):
        serializer = QLabUserSettingsSerializer(
            self._get_object(),
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SavedQueryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedQuerySerializer

    def get_queryset(self):
        return SavedQuery.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(
        summary="Run Saved Query",
        request=None,
        responses={200: "application/json"},
    )
    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        saved_query = self.get_object()
        payload = {
            **saved_query.query_payload,
            "app_label": saved_query.app_label,
            "model": saved_query.model_name,
            "saved_query_id": saved_query.id,
            "title": saved_query.name,
        }
        response = QLabFrontendApiViewSet().execute_query(request, payload)
        if response.status_code == status.HTTP_200_OK:
            saved_query.last_run_at = timezone.now()
            saved_query.save(update_fields=["last_run_at"])
        return response


class QueryRunHistoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QueryRunHistorySerializer

    def get_queryset(self):
        queryset = QueryRunHistory.objects.filter(user=self.request.user)
        model_name = self.request.query_params.get("model")
        if model_name:
            queryset = queryset.filter(model_name=model_name)
        try:
            requested_limit = int(
                self.request.query_params.get("limit", qlab_settings.MAX_HISTORY_ROWS)
            )
        except (TypeError, ValueError):
            requested_limit = qlab_settings.MAX_HISTORY_ROWS
        limit = min(max(requested_limit, 1), qlab_settings.MAX_HISTORY_ROWS)
        return queryset[:limit]


class QLabBootstrapViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedQuerySerializer

    @extend_schema(summary="Get QLab Bootstrap Data")
    def list(self, request, *args, **kwargs):
        settings_obj, _ = QLabUserSettings.objects.get_or_create(user=request.user)
        restricted_models = {
            restricted.lower() for restricted in qlab_settings.RESTRICTED_MODELS
        }
        models_index = [
            {
                "app_label": model._meta.app_label,
                "model_name": model.__name__,
                "verbose_name": str(model._meta.verbose_name),
                "verbose_name_plural": str(model._meta.verbose_name_plural),
                "count": model.objects.count(),
            }
            for model in apps.get_models()
            if (
                not qlab_settings.ALLOWED_APPS
                or model._meta.app_label in qlab_settings.ALLOWED_APPS
            )
            and model.__name__.lower() not in restricted_models
        ]

        return Response(
            {
                "user": {
                    "id": request.user.pk,
                    "username": getattr(request.user, request.user.USERNAME_FIELD, ""),
                    "is_authenticated": True,
                },
                "settings": QLabUserSettingsSerializer(settings_obj).data,
                "models": sorted(
                    models_index,
                    key=lambda item: (item["app_label"], item["model_name"]),
                ),
                "saved_queries": SavedQuerySerializer(
                    SavedQuery.objects.filter(user=request.user).order_by("name")[:20],
                    many=True,
                ).data,
                "history": QueryRunHistorySerializer(
                    QueryRunHistory.objects.filter(user=request.user)[:10],
                    many=True,
                ).data,
            }
        )
