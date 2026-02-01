"""
Django REST Framework serializers for query API responses.

This module defines serializers for:
- Model metadata responses (field information, allowed operations, lookups)
- Query execution responses (paginated results)
- Request validation (metadata requests)

These serializers ensure consistent API response structure and provide
automatic OpenAPI/Swagger documentation via drf-spectacular.
"""

from rest_framework import serializers
from qlab.helpers import model_exists


class FieldMetadataSerializer(serializers.Serializer):
    """
    Serializer for individual field metadata.
    
    Represents all metadata for a single model field, including type information,
    validation rules, and allowed filter operations.
    
    Fields:
        name: Full field path (e.g., "backup_job__name" for related fields)
        type: Field type identifier (string, integer, foreignkey, etc.)
        label: Human-readable field label
        required: Whether the field is required (not null and not blank)
        related_model: Name of related model (for ForeignKey/M2M fields only)
        allowed_operations: List of valid filter operations for this field type
        max_length: Maximum character length (for text fields only)
        choices: Available choices (for choice fields only)
    
    Example Response:
        {
            "name": "backup_size",
            "type": "bigint",
            "label": "Backup Size",
            "required": false,
            "allowed_operations": ["is", "is_not", "lt", "lte", "gt", "gte"],
            "max_length": null,
            "choices": null,
            "related_model": null
        }
    
    Example Response (ForeignKey):
        {
            "name": "backup_job",
            "type": "foreignkey",
            "label": "Backup Job",
            "required": true,
            "allowed_operations": ["is", "is_not"],
            "related_model": "BackupJob"
        }
    
    Example Response (Choice Field):
        {
            "name": "status",
            "type": "string",
            "label": "Status",
            "required": true,
            "allowed_operations": ["is", "is_not", "icontains"],
            "max_length": 20,
            "choices": [
                {"value": "active", "label": "Active"},
                {"value": "inactive", "label": "Inactive"}
            ]
        }
    """
    name = serializers.CharField(
        help_text="Full field path including relations (e.g., 'backup_job__name')"
    )
    type = serializers.CharField(
        help_text="Field type: string, integer, boolean, foreignkey, etc."
    )
    label = serializers.CharField(
        help_text="Human-readable field label"
    )
    required = serializers.BooleanField(
        help_text="Whether this field is required (not null and not blank)"
    )
    related_model = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Name of related model (for ForeignKey/ManyToMany fields only)"
    )
    allowed_operations = serializers.ListField(
        child=serializers.CharField(),
        help_text="List of valid filter operations: is, is_not, lt, lte, gt, gte, icontains"
    )
    max_length = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Maximum character length (for text fields only)"
    )
    choices = serializers.ListField(
        required=False,
        allow_null=True,
        help_text="Available choices with value/label pairs (for choice fields only)"
    )


class ModelMetadataSerializer(serializers.Serializer):
    """
    Serializer for complete model metadata.
    
    Represents all metadata for a Django model, including all fields
    (both direct and related) and a complete list of valid lookup paths
    for autocomplete functionality.
    
    Fields:
        model_name: Name of the Django model
        app_label: Django app containing the model
        fields: List of all field metadata (includes nested relations)
        all_lookups: Sorted list of all valid field paths for autocomplete
    
    Usage:
        Used by the metadata endpoint to provide comprehensive model information
        for building query UIs with autocomplete, validation, and field type hints.
    
    Example Response:
        {
            "model_name": "Backup",
            "app_label": "core",
            "fields": [
                {
                    "name": "id",
                    "type": "integer",
                    "label": "ID",
                    "required": true,
                    "allowed_operations": ["is", "is_not", "lt", "lte", "gt", "gte"]
                },
                {
                    "name": "backup_job__name",
                    "type": "string",
                    "label": "Name",
                    "required": true,
                    "allowed_operations": ["is", "is_not", "icontains"],
                    "max_length": 255,
                    "related_model": "BackupJob"
                }
            ],
            "all_lookups": [
                "backup_date",
                "backup_job",
                "backup_job__id",
                "backup_job__name",
                "backup_size",
                "id"
            ]
        }
    """
    model_name = serializers.CharField(
        help_text="Name of the Django model"
    )
    app_label = serializers.CharField(
        help_text="Django app label containing this model"
    )
    fields = FieldMetadataSerializer(
        many=True,
        help_text="List of all field metadata including nested relations"
    )
    all_lookups = serializers.ListField(
        child=serializers.CharField(),
        help_text="Sorted list of all valid field paths for autocomplete"
    )


class MetaDataRequestSerializer(serializers.Serializer):
    """
    Serializer for metadata request validation.
    
    Validates that the requested model exists before attempting to
    retrieve its metadata.
    
    Fields:
        model: Name of the Django model to retrieve metadata for
    
    Validation:
        - Checks that the model exists in any installed Django app
        - Case-insensitive model name matching
    
    Example Request:
        {
            "model": "Backup"
        }
    
    Example Validation Error:
        {
            "model": ["This model does not exist."]
        }
    """
    model = serializers.CharField(
        help_text="Name of the Django model (case-insensitive)"
    )

    def validate_model(self, model: str) -> str:
        """
        Validate that the requested model exists.
        
        Args:
            model: Model name to validate
        
        Returns:
            Validated model name
        
        Raises:
            serializers.ValidationError: If model doesn't exist in any app
        
        Example:
            >>> serializer = MetaDataRequestSerializer(data={"model": "VeeamBackup"})
            >>> serializer.is_valid()
            True
            >>> serializer = MetaDataRequestSerializer(data={"model": "InvalidModel"})
            >>> serializer.is_valid()
            False
            >>> serializer.errors
            {'model': ['This model does not exist.']}
        """
        if not model_exists(model):
            raise serializers.ValidationError("This model does not exist.")
        return model


class ResponseSerializer(serializers.Serializer):
    """
    Serializer for paginated query responses.
    
    Provides structured pagination metadata along with query results.
    Follows standard pagination patterns for consistent API responses.
    
    Fields:
        count: Total number of results across all pages
        page: Current page number (1-indexed)
        page_size: Number of results per page (default: 100)
        total_pages: Total number of pages available
        next: Next page number (null if on last page)
        previous: Previous page number (null if on first page)
        results: List of result objects with selected fields
    
    Pagination:
        - Page size is fixed at 100 items
        - Pages are 1-indexed (first page is 1, not 0)
        - Next/previous are page numbers, not URLs
    
    Example Response (First Page):
        {
            "count": 250,
            "page": 1,
            "page_size": 100,
            "total_pages": 3,
            "next": 2,
            "previous": null,
            "results": [
                {"id": 1, "name": "Backup 1", "size": 1024},
                {"id": 2, "name": "Backup 2", "size": 2048},
                ...
            ]
        }
    
    Example Response (Middle Page):
        {
            "count": 250,
            "page": 2,
            "page_size": 100,
            "total_pages": 3,
            "next": 3,
            "previous": 1,
            "results": [...]
        }
    
    Example Response (Last Page):
        {
            "count": 250,
            "page": 3,
            "page_size": 100,
            "total_pages": 3,
            "next": null,
            "previous": 2,
            "results": [
                {"id": 201, "name": "Backup 201", "size": 512},
                ...
            ]
        }
    
    Example Response (Empty Results):
        {
            "count": 0,
            "page": 1,
            "page_size": 100,
            "total_pages": 0,
            "next": null,
            "previous": null,
            "results": []
        }
    """
    count = serializers.IntegerField(
        help_text="Total number of results across all pages"
    )
    page = serializers.IntegerField(
        help_text="Current page number (1-indexed)"
    )
    page_size = serializers.IntegerField(
        help_text="Number of results per page (fixed at 100)"
    )
    total_pages = serializers.IntegerField(
        help_text="Total number of pages available"
    )
    next = serializers.IntegerField(
        allow_null=True,
        help_text="Next page number (null if on last page)"
    )
    previous = serializers.IntegerField(
        allow_null=True,
        help_text="Previous page number (null if on first page)"
    )
    results = serializers.ListField(
        help_text="List of result objects with selected fields"
    )