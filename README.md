# Django QLab

A powerful Django REST Framework extension for dynamic model querying with advanced filtering, field selection, and automatic metadata generation.

## Features

🚀 **Dynamic Querying**
- Select specific fields from any model
- Support for nested relations via `__` syntax
- Automatic field path validation

🔍 **Advanced Filtering**
- Complex AND/OR/NOT operations
- Type-safe operation validation
- Support for: `is`, `is_not`, `lt`, `lte`, `gt`, `gte`, `icontains`

📊 **Model Metadata**
- Automatic field discovery
- Operation compatibility information
- Perfect for building query UIs
- Autocomplete support

✅ **Type Safety**
- Pydantic validation
- Field type checking
- Operation compatibility validation

## Installation
```bash
pip install django-qlab
```

## Quick Start

### 1. Add to INSTALLED_APPS
```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'drf_spectacular',
    'qlab',
]
```

### 2. Configure URLs
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from qlab.views import Query, MetaData

router = DefaultRouter()
router.register(r'query', Query, basename='query')
router.register(r'metadata', MetaData, basename='metadata')

urlpatterns = [
    path('api/', include(router.urls)),
]
```

### 3. Configure Settings (Optional)
```python
# settings.py
QLAB_SETTINGS = {
    'DEFAULT_APP_LABEL': 'core',  # Your main app
    'PAGE_SIZE': 100,
    'MAX_RELATION_DEPTH': 2,
}
```

## Usage Examples

### Simple Query
```python
POST /api/query/
{
  "model": "VeeamBackup",
  "select_fields": ["id", "backup_size", "backup_date"],
  "page": 1
}
```

Response:
```json
{
  "count": 250,
  "page": 1,
  "page_size": 100,
  "total_pages": 3,
  "next": 2,
  "previous": null,
  "results": [
    {"id": 1, "backup_size": 1024, "backup_date": "2024-01-15"},
  ]
}
```

### Query with Filters
```python
POST /api/query/
{
  "model": "VeeamBackup",
  "select_fields": ["id", "backup_job__name", "backup_size"],
  "filter_fields": {
    "and_operation": [
      {"field": "backup_size", "op": "gte", "value": "1000"},
      {"field": "backup_job__name", "op": "icontains", "value": "daily"}
    ]
  },
  "page": 1
}
```

### Complex Nested Filters
```python
{
  "model": "VeeamBackup",
  "select_fields": ["id", "backup_job__name"],
  "filter_fields": {
    "and_operation": [
      {"field": "backup_date", "op": "gte", "value": "2024-01-01"}
    ],
    "or_operation": [
      {"field": "backup_size", "op": "gt", "value": "10000"},
      {
        "and_operation": [
          {"field": "priority", "op": "is", "value": "high"},
          {"field": "backup_job__enabled", "op": "is", "value": "true"}
        ]
      }
    ]
  },
  "page": 1
}
```

### Get Model Metadata
```python
POST /api/metadata/
{
  "model": "Backup"
}
```

Response:
```json
{
  "model_name": "Backup",
  "app_label": "core",
  "fields": [
    {
      "name": "backup_size",
      "type": "bigint",
      "label": "Backup Size",
      "required": false,
      "allowed_operations": ["is", "is_not", "lt", "lte", "gt", "gte"]
    },
    {
      "name": "backup_job__name",
      "type": "string",
      "label": "Name",
      "required": true,
      "allowed_operations": ["is", "is_not", "icontains"],
      "max_length": 255
    }
  ],
  "all_lookups": ["id", "backup_date", "backup_job", "backup_job__name"]
}
```

## Requirements

- Python >= 3.9
- Django >= 4.0
- djangorestframework >= 3.14
- pydantic >= 2.0
- drf-spectacular >= 0.26

## Development
```bash
# Clone repository
git clone https://github.com/tabeahoehne132/django-qlab.git
cd django-qlab

# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest
```