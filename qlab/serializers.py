"""
Django REST Framework serializers for the QLab query API.

Defines serializers for:
- Field and model metadata responses
- Paginated query results
- Request validation
"""

from rest_framework import serializers
from qlab.helpers import model_exists


# ---------------------------------------------------------------------------
# Field & Model Metadata
# ---------------------------------------------------------------------------


class FieldMetadataSerializer(serializers.Serializer):
    """Metadata for a single model field, including type, operations and relation info."""

    name = serializers.CharField(help_text="Full field path, e.g. 'author__first_name'")
    type = serializers.CharField(
        help_text="Field type: string, integer, boolean, foreignkey, reverse_relation, etc."
    )
    label = serializers.CharField(help_text="Human-readable field label")
    required = serializers.BooleanField(
        help_text="True if the field is not null and not blank"
    )
    primary_key = serializers.BooleanField(
        default=False, help_text="True if this field is the primary key"
    )
    allowed_operations = serializers.ListField(
        child=serializers.CharField(),
        help_text="Valid filter operations: is, is_not, lt, lte, gt, gte, icontains",
    )
    related_model = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Related model name (FK, M2M and reverse relations only)",
    )
    filter_name = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Query name to use in filter_fields (reverse relations only)",
    )
    max_length = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Maximum character length (text fields only)",
    )
    choices = serializers.ListField(
        required=False,
        allow_null=True,
        help_text="Available choices as {value, label} pairs (choice fields only)",
    )


class ModelMetadataSerializer(serializers.Serializer):
    """Complete metadata for a Django model, including all fields and valid lookup paths."""

    model_name = serializers.CharField(help_text="Name of the Django model")
    app_label = serializers.CharField(
        help_text="Django app label containing this model"
    )
    primary_key_field = serializers.CharField(help_text="Name of the primary key field")
    fields = FieldMetadataSerializer(
        many=True, help_text="All field metadata including nested relations"
    )
    all_lookups = serializers.ListField(
        child=serializers.CharField(),
        help_text="Sorted list of all valid field paths for autocomplete",
    )


# ---------------------------------------------------------------------------
# Request Validation
# ---------------------------------------------------------------------------


class MetaDataRequestSerializer(serializers.Serializer):
    """Validates that the requested model exists before retrieving its metadata."""

    model = serializers.CharField(
        help_text="Model name to retrieve metadata for (case-insensitive)"
    )

    def validate_model(self, value: str) -> str:
        if not model_exists(value):
            raise serializers.ValidationError("This model does not exist.")
        return value


# ---------------------------------------------------------------------------
# Query Response
# ---------------------------------------------------------------------------


class ResponseSerializer(serializers.Serializer):
    """Paginated query response with result list and pagination metadata."""

    count = serializers.IntegerField(
        help_text="Total number of matching records across all pages"
    )
    page = serializers.IntegerField(help_text="Current page number (1-indexed)")
    page_size = serializers.IntegerField(help_text="Number of records per page")
    total_pages = serializers.IntegerField(help_text="Total number of pages")
    next = serializers.IntegerField(
        allow_null=True, help_text="Next page number, null if on last page"
    )
    previous = serializers.IntegerField(
        allow_null=True, help_text="Previous page number, null if on first page"
    )
    results = serializers.ListField(
        help_text="List of result objects with the requested fields"
    )
