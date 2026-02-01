"""
Pydantic filter for query validation.

This module defines QueryFilter, the main Pydantic model that validates
complete query requests including:
- Model existence and accessibility
- Field path validation (select and filter fields)
- Operation compatibility with field types
- Pagination parameters

QueryFilter performs comprehensive validation before query execution,
ensuring type safety and preventing invalid database queries.
"""

from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from django.apps import apps

from qlab.helpers import (
    model_exists,
    is_valid_lookup_syntax,
    flatten_filter_conditions,
    check_attribute_operation,
    validate_field_path
)
from qlab.model_validation import Filter, ValidationError
from qlab.settings import qlab_settings 


class QueryFilter(BaseModel):
    """
    Main validation model for dynamic query requests.
    
    Validates all aspects of a query request including model selection,
    field paths, filter operations, and pagination. Performs multi-stage
    validation to ensure the query is safe and executable.
    
    Validation Stages:
        1. Field-level: Validate individual fields (page, model)
        2. Model-level: Cross-validate fields and filters together
        3. Operation-level: Ensure operations match field types
    
    Attributes:
        model: Name of the Django model to query
        select_fields: List of field paths to return in results
        filter_fields: Optional Filter object with query conditions
        page: Page number for pagination (1-indexed, default: 1)
    
    Raises:
        ValidationError: If any validation fails, with detailed error information
    
    Example - Simple Query:
        >>> query = QueryFilter(
        ...     model="Backup",
        ...     select_fields=["id", "backup_size", "backup_date"],
        ...     page=1
        ... )
    
    Example - Query with Filters:
        >>> query = QueryFilter(
        ...     model="Backup",
        ...     select_fields=["id", "backup_job__name"],
        ...     filter_fields=Filter(
        ...         and_operation=[
        ...             Condition(field="backup_size", op="gte", value="1000"),
        ...             Condition(field="backup_date", op="gte", value="2024-01-01")
        ...         ]
        ...     ),
        ...     page=2
        ... )
    
    Example - Validation Error:
        >>> try:
        ...     query = QueryFilter(
        ...         model="InvalidModel",
        ...         select_fields=["id"],
        ...         page=1
        ...     )
        ... except ValidationError as e:
        ...     print(e.errors())
        {'validation_error': [{'loc': ('model',), 'msg': "Model 'InvalidModel' does not exist", ...}]}
    """
    model: str
    select_fields: list[str]
    filter_fields: Optional[Filter] = None
    page: int = 1
    app_label: Optional[str] = None

    @field_validator("page")
    def validate_page(cls, page: int) -> int:
        """
        Validate that page number is positive.
        
        Pages are 1-indexed, so the minimum valid page is 1.
        
        Args:
            page: Page number from request
        
        Returns:
            Validated page number
        
        Raises:
            ValidationError: If page < 1
        
        Example:
            >>> QueryFilter(model="Test", select_fields=["id"], page=1)  # Valid
            >>> QueryFilter(model="Test", select_fields=["id"], page=0)  # ValidationError
            >>> QueryFilter(model="Test", select_fields=["id"], page=-1)  # ValidationError
        """
        if page < 1:
            raise ValidationError([{
                "loc": ("page",),
                "msg": "Page must be at least 1.",
                "type": "value_error"
            }])
        return page

    @field_validator("model")
    def validate_model(cls, model: str) -> str:
        """
        Validate that the requested model exists.
        
        Performs case-insensitive search across all installed Django apps
        to verify the model is available for querying.
        
        Args:
            model: Model name from request
        
        Returns:
            Validated model name
        
        Raises:
            ValidationError: If model doesn't exist in any app
        
        Example:
            >>> QueryFilter(model="Backup", select_fields=["id"], page=1)  # Valid
            >>> QueryFilter(model="NonExistent", select_fields=["id"], page=1)  # ValidationError
        """
        model_check = model_exists(model)
        if not model_check:
            raise ValidationError([{
                "loc": ("model",),
                "msg": f"Model '{model}' does not exist.",
                "type": "value_error"
            }])
        return model

    @model_validator(mode="after")
    def validate_fields(self):
        """
        Validate all field paths and filter operations.
        
        Performs comprehensive validation after all field-level validators
        have run. This includes:
        
        1. Select field validation:
           - Check field path syntax (__ for relations)
           - Verify each field exists in the model
           - Provide helpful suggestions for common mistakes
        
        2. Filter field validation:
           - Validate all filter field paths
           - Ensure operations are compatible with field types
           - Check nested filter conditions
        
        Returns:
            Self (validated instance)
        
        Raises:
            ValidationError: If any field or operation is invalid, with all errors collected
        
        Example Errors:
            # Invalid field path
            {'loc': ('field',), 'msg': "Field 'invalid_field' does not exist in model Backup"}
            
            # Wrong syntax (should use __ for relations)
            {'loc': ('field',), 'msg': "Field 'backup_job_name' does not exist. Did you mean 'backup_job__name'?"}
            
            # Invalid operation for field type
            {'loc': ('filter_fields', 'backup_size'), 'msg': "Operation 'icontains' is not allowed for field 'backup_size'."}
        """
        # Get the actual Django model class
        app_label = self.app_label or qlab_settings.DEFAULT_APP_LABEL
        model = apps.get_model(app_label, self.model)
        errors = []

        # --- Validate Select Fields ---
        for field in self.select_fields:
            self._validate_field(model, field, errors)

        # --- Validate Filter Fields ---
        if self.filter_fields:
            # Flatten nested filters to get all conditions
            all_conditions = flatten_filter_conditions(self.filter_fields)

            for cond in all_conditions:
                # First validate the field path exists
                valid_field = self._validate_field(model, cond.field, errors)

                # Then check if the operation is allowed for this field type
                if valid_field:
                    if not check_attribute_operation(model, cond.field, cond.op):
                        errors.append({
                            "loc": ("filter_fields", cond.field),
                            "msg": f"Operation '{cond.op}' is not allowed for field '{cond.field}'.",
                            "type": "operation_not_allowed",
                        })

        # Raise all collected errors at once for better UX
        if errors:
            raise ValidationError(errors)
        
        return self

    def _validate_field(self, model, field: str, errors: list) -> bool:
        """
        Validate a single field path.
        
        Internal helper method that validates field syntax and existence.
        Used by both select field and filter field validation.
        
        Args:
            model: Django model class to validate against
            field: Field path to validate (e.g., "backup_job__name")
            errors: List to append error dictionaries to
        
        Returns:
            True if field is valid, False otherwise
        
        Side Effects:
            Appends error dictionaries to errors list if validation fails
        
        Validation Steps:
            1. Check syntax (alphanumeric, underscores, __ for relations)
            2. Verify field exists in model
            3. For related fields, recursively validate the path
        
        Example:
            >>> errors = []
            >>> query._validate_field(Backup, "id", errors)
            True
            >>> errors
            []
            
            >>> errors = []
            >>> query._validate_field(Backup, "invalid_field", errors)
            False
            >>> errors
            [{'loc': ('field',), 'msg': "Field 'invalid_field' does not exist...", ...}]
        """
        # First check if the syntax is valid (alphanumeric + underscores + __)
        if not is_valid_lookup_syntax(field):
            errors.append({
                "loc": ("field",),
                "msg": f"Field '{field}' syntax is incorrect. Use __ for relations and _ for attributes.",
                "type": "syntax_error"
            })
            return False
        else:
            # Syntax is valid, now check if the field actually exists
            return validate_field_path(model, field, errors)