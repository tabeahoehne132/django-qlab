"""
Helper utilities for dynamic query system.

This module provides core functionality for:
- Model metadata extraction for autocomplete and validation
- Query filter construction (Pydantic Filter -> Django Q objects)
- Field path validation with helpful error messages
- Operation validation per field type
"""

from typing import List, Optional
from django.apps import apps
from django.db.models import ForeignKey, ManyToManyField
from django.core.exceptions import FieldDoesNotExist
from django.db import models
from django.db.models import Q
import re

from qlab.model_validation import Filter, Condition
from qlab.settings import qlab_settings 


def get_field_type_name(field) -> str:
    """
    Map Django field instances to string type names for frontend consumption.
    
    Args:
        field: Django model field instance
    
    Returns:
        String representation of field type (e.g., "string", "integer", "foreignkey")
        Returns "unknown" if field type is not mapped
    
    Example:
        >>> field = models.CharField(max_length=100)
        >>> get_field_type_name(field)
        'string'
    """
    type_mapping = {
        models.CharField: "string",
        models.TextField: "text",
        models.EmailField: "email",
        models.URLField: "url",
        models.SlugField: "slug",
        models.IntegerField: "integer",
        models.BigIntegerField: "bigint",
        models.SmallIntegerField: "smallint",
        models.PositiveIntegerField: "positiveint",
        models.FloatField: "float",
        models.DecimalField: "decimal",
        models.BooleanField: "boolean",
        models.DateField: "date",
        models.DateTimeField: "datetime",
        models.TimeField: "time",
        models.ForeignKey: "foreignkey",
        models.OneToOneField: "onetoone",
        models.ManyToManyField: "manytomany",
        models.UUIDField: "uuid",
        models.JSONField: "json",
        models.FileField: "file",
        models.ImageField: "image",
    }
    
    for field_class, type_name in type_mapping.items():
        if isinstance(field, field_class):
            return type_name
    
    return "unknown"


def get_allowed_operations(field) -> List[str]:
    """
    Determine which filter operations are valid for a given field type.
    
    Operations:
        - is/is_not: Exact match (available for all types)
        - lt/lte/gt/gte: Comparison operators (numbers, dates)
        - icontains: Case-insensitive substring search (text fields)
    
    Args:
        field: Django model field instance
    
    Returns:
        List of allowed operation strings for this field type
    
    Example:
        >>> field = models.IntegerField()
        >>> get_allowed_operations(field)
        ['is', 'is_not', 'lt', 'lte', 'gt', 'gte']
    """
    FIELD_OPS = {
        # --- Text fields: support equality and substring search ---
        models.CharField: ["is", "is_not", "icontains"],
        models.TextField: ["is", "is_not", "icontains"],
        models.EmailField: ["is", "is_not", "icontains"],
        models.SlugField: ["is", "is_not", "icontains"],
        models.URLField: ["is", "is_not", "icontains"],
        models.FilePathField: ["is", "is_not", "icontains"],
        models.GenericIPAddressField: ["is", "is_not", "icontains"],

        # --- Numeric fields: support equality and comparison ---
        models.IntegerField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.FloatField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.DecimalField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.PositiveIntegerField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.BigIntegerField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.SmallIntegerField: ["is", "is_not", "lt", "lte", "gt", "gte"],

        # --- Boolean: only equality checks ---
        models.BooleanField: ["is", "is_not"],

        # --- Date/time fields: support equality and comparison ---
        models.DateField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.DateTimeField: ["is", "is_not", "lt", "lte", "gt", "gte"],
        models.TimeField: ["is", "is_not", "lt", "lte", "gt", "gte"],

        # --- Relations: equality only (or contains for M2M) ---
        models.ForeignKey: ["is", "is_not"],
        models.OneToOneField: ["is", "is_not"],
        models.ManyToManyField: ["is", "is_not", "icontains"],

        # --- Special types ---
        models.UUIDField: ["is", "is_not", "icontains"],
        models.JSONField: ["is", "is_not", "icontains"],
        models.FileField: ["is", "is_not"],
        models.ImageField: ["is", "is_not"],
    }
    
    for field_type, allowed_ops in FIELD_OPS.items():
        if isinstance(field, field_type):
            return list(allowed_ops)
    
    return []


def extract_field_metadata(
    model: type[models.Model],
    prefix: str = "",
    max_depth: int = 2,
    current_depth: int = 0,
    visited_models: Optional[set] = None
) -> tuple[List[dict], List[str]]:
    """
    Recursively extract metadata for all fields in a model, including related fields.
    
    This function traverses the model's field hierarchy, following ForeignKey and
    ManyToMany relationships up to a maximum depth. It prevents infinite loops
    by tracking visited models.
    
    Args:
        model: Django model class to extract metadata from
        prefix: Field path prefix for nested relations (e.g., "backup_job")
        max_depth: Maximum depth to traverse relations (default: 2)
        current_depth: Current recursion depth (internal use)
        visited_models: Set of already visited models to prevent cycles (internal use)
    
    Returns:
        Tuple of:
            - List of field metadata dictionaries, each containing:
                - name: Full field path (e.g., "backup_job__name")
                - type: Field type string
                - label: Human-readable label
                - required: Whether field is required
                - allowed_operations: Valid filter operations
                - max_length: Maximum length (text fields only)
                - choices: Available choices (choice fields only)
                - related_model: Related model name (FK/M2M only)
            - List of all valid lookup paths for autocomplete
    
    Example:
        >>> fields, lookups = extract_field_metadata(VeeamBackup, max_depth=2)
        >>> lookups
        ['id', 'backup_date', 'backup_job', 'backup_job__id', 'backup_job__name', ...]
    """
    if visited_models is None:
        visited_models = set()

    # Prevent circular reference loops
    model_id = (model._meta.app_label, model._meta.model_name)
    if model_id in visited_models:
        return [], []
    
    visited_models.add(model_id)
    
    fields_metadata = []
    all_lookups = []
    
    # Iterate through all model fields
    for field in model._meta.get_fields():
        # Skip auto-created reverse relations
        if hasattr(field, 'auto_created') and field.auto_created:
            continue
        
        field_name = field.name
        # Build full lookup path (e.g., "backup_job__name")
        full_field_path = f"{prefix}__{field_name}" if prefix else field_name

        # Build base field metadata
        field_info = {
            "name": full_field_path,
            "type": get_field_type_name(field),
            "label": str(getattr(field, 'verbose_name', field_name)),
            "required": not getattr(field, 'null', True) and not getattr(field, 'blank', True),
            "allowed_operations": get_allowed_operations(field),
        }

        # Add optional metadata if present
        if hasattr(field, 'max_length') and field.max_length:
            field_info["max_length"] = field.max_length
        
        if hasattr(field, 'choices') and field.choices:
            field_info["choices"] = [
                {'value': choice[0], 'label': str(choice[1])}
                for choice in field.choices
            ]
        
        # Add related model information
        if isinstance(field, (models.ForeignKey, models.OneToOneField, models.ManyToManyField)):
            field_info["related_model"] = field.related_model.__name__
        
        fields_metadata.append(field_info)
        all_lookups.append(full_field_path)
        
        # Recursively process related fields
        if isinstance(field, (models.ForeignKey, models.OneToOneField, models.ManyToManyField)):
            related_model = field.related_model
            
            # Only recurse if we haven't hit max depth
            if current_depth < max_depth:
                related_fields, related_lookups = extract_field_metadata(
                    model=related_model,
                    prefix=full_field_path,
                    max_depth=max_depth,
                    current_depth=current_depth + 1,
                    visited_models=visited_models.copy()  # Copy to allow sibling branches
                )
                fields_metadata.extend(related_fields)
                all_lookups.extend(related_lookups)
    
    return fields_metadata, all_lookups


def get_model_metadata(model_name: str, app_label: str = "core", max_depth: int = 2) -> dict:
    """
    Get comprehensive metadata for a Django model.
    
    This is the main entry point for retrieving model metadata for use in
    autocomplete, validation, and query building UIs.
    
    Args:
        model_name: Name of the Django model (e.g., "VeeamBackup")
        app_label: Django app containing the model (default: "core")
        max_depth: Maximum depth for traversing relations (default: 2)
    
    Returns:
        Dictionary containing:
            - model_name: Name of the model
            - app_label: Django app label
            - fields: List of all field metadata (including nested relations)
            - all_lookups: Sorted list of all valid field paths
    
    Raises:
        LookupError: If model doesn't exist
    
    Example:
        >>> metadata = get_model_metadata("VeeamBackup", max_depth=2)
        >>> metadata['all_lookups'][:3]
        ['backup_date', 'backup_job', 'backup_job__id']
    """
    if app_label is None:
        app_label = qlab_settings.DEFAULT_APP_LABEL
    if max_depth is None:
        max_depth = qlab_settings.MAX_RELATION_DEPTH
    model = apps.get_model(app_label, model_name)
    
    fields, lookups = extract_field_metadata(model, max_depth=max_depth)
    
    return {
        "model_name": model.__name__,
        "app_label": app_label,
        "fields": fields,
        "all_lookups": sorted(lookups)  # Sort for better UX
    }


def build_q(filter_obj: Filter) -> Q:
    """
    Convert a Pydantic Filter object into a Django Q object.
    
    Recursively processes nested Filter objects and combines them using
    Django's Q object API for complex AND/OR/NOT queries.
    
    Args:
        filter_obj: Pydantic Filter containing and_operation, or_operation, or not_operation
    
    Returns:
        Django Q object ready to use in QuerySet.filter()
    
    Example:
        >>> filter_obj = Filter(
        ...     and_operation=[
        ...         Condition(field="backup_size", op="gt", value="1000"),
        ...         Condition(field="backup_job__name", op="icontains", value="daily")
        ...     ]
        ... )
        >>> q = build_q(filter_obj)
        >>> VeeamBackup.objects.filter(q)
    """
    q = Q()

    # AND: All conditions must be true
    if filter_obj.and_operation:
        for item in filter_obj.and_operation:
            q &= build_q(item) if isinstance(item, Filter) else condition_to_q(item)

    # OR: At least one condition must be true
    if filter_obj.or_operation:
        or_q = Q()
        for item in filter_obj.or_operation:
            or_q |= build_q(item) if isinstance(item, Filter) else condition_to_q(item)
        q |= or_q

    # NOT: Negate the conditions
    if filter_obj.not_operation:
        for item in filter_obj.not_operation:
            q &= ~build_q(item) if isinstance(item, Filter) else ~condition_to_q(item)

    return q


def condition_to_q(cond: Condition) -> Q:
    """
    Convert a single Condition into a Django Q object.
    
    Maps operation types to Django's field lookup syntax:
        - is -> exact match
        - is_not -> negated exact match
        - lt/lte/gt/gte -> comparison lookups
        - icontains -> case-insensitive substring search
    
    Args:
        cond: Condition with field, operation, and value
    
    Returns:
        Django Q object for this condition
    
    Example:
        >>> cond = Condition(field="backup_size", op="gte", value="1000")
        >>> q = condition_to_q(cond)
        >>> # Equivalent to: Q(backup_size__gte=1000)
    """
    lookup = cond.field
    value = cond.value

    if cond.op == "is":
        return Q(**{lookup: value})
    elif cond.op == "is_not":
        return ~Q(**{lookup: value})
    elif cond.op == "lt":
        return Q(**{f"{lookup}__lt": value})
    elif cond.op == "lte":
        return Q(**{f"{lookup}__lte": value})
    elif cond.op == "gt":
        return Q(**{f"{lookup}__gt": value})
    elif cond.op == "gte":
        return Q(**{f"{lookup}__gte": value})
    elif cond.op == "icontains":
        return Q(**{f"{lookup}__icontains": value})


def is_valid_lookup_syntax(lookup: str) -> bool:
    """
    Validate Django field lookup syntax.
    
    Valid syntax:
        - Starts with letter or underscore
        - Contains only alphanumeric and underscores
        - Relations separated by double underscore (__)
    
    Args:
        lookup: Field path to validate (e.g., "backup_job__name")
    
    Returns:
        True if syntax is valid, False otherwise
    
    Example:
        >>> is_valid_lookup_syntax("backup_job__name")
        True
        >>> is_valid_lookup_syntax("123invalid")
        False
        >>> is_valid_lookup_syntax("spaces not allowed")
        False
    """
    pattern = r'^[A-Za-z_][A-Za-z0-9_]*(__[A-Za-z_][A-Za-z0-9_]*)*$'
    return bool(re.match(pattern, lookup))


def flatten_filter_conditions(filter_obj: Filter) -> List[Condition]:
    """
    Extract all Condition objects from a nested Filter structure.
    
    Recursively flattens nested Filter objects to get a flat list of
    all Condition objects for validation purposes.
    
    Args:
        filter_obj: Nested Filter object
    
    Returns:
        Flat list of all Condition objects
    
    Example:
        >>> filter_obj = Filter(
        ...     and_operation=[
        ...         Condition(field="size", op="gt", value="100"),
        ...         Filter(or_operation=[
        ...             Condition(field="name", op="is", value="test")
        ...         ])
        ...     ]
        ... )
        >>> conditions = flatten_filter_conditions(filter_obj)
        >>> len(conditions)
        2
    """
    conditions = []

    for group in ["and_operation", "or_operation", "not_operation"]:
        items = getattr(filter_obj, group) or []
        for item in items:
            if isinstance(item, Filter):
                # Recursively flatten nested filters
                conditions.extend(flatten_filter_conditions(item))
            else:
                # Base case: it's a Condition
                conditions.append(item)

    return conditions


def validate_field_path(model, field_path: str, errors: list) -> bool:
    """
    Validate that a field path exists in the model and provide helpful suggestions.
    
    Recursively validates field paths including relations (using __ separator).
    Provides helpful error messages with suggestions for common mistakes.
    
    Args:
        model: Django model class to validate against
        field_path: Field path to validate (e.g., "backup_job__name")
        errors: List to append error dictionaries to
    
    Returns:
        True if field path is valid, False otherwise
    
    Side Effects:
        Appends error dictionaries to the errors list if validation fails
    
    Example:
        >>> errors = []
        >>> validate_field_path(VeeamBackup, "backup_job__name", errors)
        True
        >>> validate_field_path(VeeamBackup, "invalid_field", errors)
        False
        >>> errors
        [{'loc': ('field',), 'msg': "Field 'invalid_field' does not exist...", ...}]
    """
    if "__" not in field_path:
        # Simple field (no relations)
        field_names = [f.name for f in model._meta.get_fields()]
        if field_path not in field_names:
            # Try to provide helpful suggestion
            suggested = field_path.replace("_", "__")
            if any(suggested.startswith(f.name + "__") for f in model._meta.get_fields()):
                errors.append({
                    "loc": ("field",),
                    "msg": f"Field '{field_path}' does not exist. Did you mean '{suggested}'?",
                    "type": "value_error"
                })
            else:
                errors.append({
                    "loc": ("field",),
                    "msg": f"Field '{field_path}' does not exist in model {model.__name__}",
                    "type": "value_error"
                })
            return False
        return True
    else:
        # Related field (has __ separator)
        related_name, remaining_path = field_path.split("__", 1)
        
        try:
            related_field = model._meta.get_field(related_name)
        except FieldDoesNotExist:
            errors.append({
                "loc": ("field",),
                "msg": f"Field '{related_name}' does not exist in model {model}",
                "type": "value_error"
            })
            return False

        # Ensure it's actually a relation field
        if not isinstance(related_field, (ForeignKey, ManyToManyField)):
            errors.append({
                "loc": ("field",),
                "msg": f"Field '{related_field}' is not a relation field in model {model}",
                "type": "value_error"
            })
            return False 

        # Recursively validate the remaining path
        related_model = related_field.related_model
        return validate_field_path(related_model, remaining_path, errors)


def model_exists(model_name: str):
    """
    Check if a model exists in any installed Django app.
    
    Case-insensitive search across all registered Django apps.
    
    Args:
        model_name: Name of the model to search for
    
    Returns:
        Model class if found, None otherwise
    
    Example:
        >>> model = model_exists("VeeamBackup")
        >>> model.__name__
        'VeeamBackup'
        >>> model_exists("NonExistentModel")
        None
    """
    for app_config in apps.get_app_configs():
        for model in app_config.get_models():
            if model.__name__.lower() == model_name.lower():
                return model
    return None


def check_attribute_operation(model, field_name: str, op: str) -> bool:
    """
    Validate that an operation is allowed for a specific field type.
    
    Ensures type safety by preventing invalid operations like:
        - Comparison operators on text fields
        - Substring search on numeric fields
        - Invalid operations on boolean fields
    
    Args:
        model: Django model class
        field_name: Name of the field to check
        op: Operation to validate (e.g., "is", "gte", "icontains")
    
    Returns:
        True if operation is allowed for this field type, False otherwise
    
    Example:
        >>> check_attribute_operation(VeeamBackup, "backup_size", "gte")
        True  # Numbers support comparison
        >>> check_attribute_operation(VeeamBackup, "backup_size", "icontains")
        False  # Numbers don't support substring search
    """
    field = model._meta.get_field(field_name)

    FIELD_OPS = {
        # --- Text fields: support equality and substring search ---
        models.CharField: {"is", "is_not", "icontains", "iexact", "startswith", "endswith"},
        models.TextField: {"is", "is_not", "icontains", "iexact", "startswith", "endswith"},
        models.EmailField: {"is", "is_not", "icontains", "iexact"},
        models.SlugField: {"is", "is_not", "icontains", "iexact"},
        models.URLField: {"is", "is_not", "icontains", "iexact"},
        models.FilePathField: {"is", "is_not", "icontains"},
        models.GenericIPAddressField: {"is", "is_not", "icontains", "iexact"},

        # --- Numeric fields: support equality and comparison ---
        models.IntegerField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.FloatField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.DecimalField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.PositiveIntegerField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.BigIntegerField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.SmallIntegerField: {"is", "is_not", "lt", "lte", "gt", "gte"},

        # --- Boolean: only equality checks ---
        models.BooleanField: {"is", "is_not"},

        # --- Date/time fields: support equality and comparison ---
        models.DateField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.DateTimeField: {"is", "is_not", "lt", "lte", "gt", "gte"},
        models.TimeField: {"is", "is_not", "lt", "lte", "gt", "gte"},

        # --- Relations: equality only (or contains for M2M) ---
        models.ForeignKey: {"is", "is_not"},
        models.OneToOneField: {"is", "is_not"},
        models.ManyToManyField: {"is", "is_not", "icontains"},

        # --- Special types ---
        models.UUIDField: {"is", "is_not", "icontains", "iexact"},
        models.JSONField: {"is", "is_not", "icontains"},
        models.FileField: {"is", "is_not"},
        models.ImageField: {"is", "is_not"},
    }

    # Check if operation is allowed for this field type
    for field_type, allowed_ops in FIELD_OPS.items():
        if isinstance(field, field_type) and op in allowed_ops:
            return True 
    return False