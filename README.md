# Django QLab

A powerful Django REST Framework extension for dynamic model querying with advanced filtering, field selection, and automatic metadata generation.

## Features

🚀 **Dynamic Querying**
- Select specific fields from any model
- Support for nested relations via `__` syntax
- Automatic field path validation
- Reverse relation support

🔍 **Advanced Filtering**
- Complex AND/OR/NOT operations
- Type-safe operation validation
- Support for: `is`, `is_not`, `lt`, `lte`, `gt`, `gte`, `icontains`

🔗 **Neighborhood Resolution**
- Resolve all FK, OneToOne and M2M relations for a set of records
- Includes reverse relations with correct query names
- Useful for building graph-style UIs

📊 **Model Metadata**
- Automatic field discovery including reverse relations
- Operation compatibility information
- `filter_name` for each relation field
- Perfect for building query UIs with autocomplete

🔒 **Access Control**
- Restrict specific models from being queried via `RESTRICTED_MODELS`
- Standard DRF `permission_classes` support on all ViewSets

✅ **Type Safety**
- Pydantic validation
- Field type checking
- Operation compatibility validation

---

## Installation

```bash
pip install git+https://github.com/tabeahoehne132/django-qlab.git
```

---

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

Use the provided Mixins to build your own ViewSet with full control over permissions and queryset scoping:

```python
# views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from qlab.mixins import QLabMixin, NeighborhoodMixin, QLabMetadataMixin


class QLab(QLabMixin, NeighborhoodMixin, QLabMetadataMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self, model):
        # Optional: apply custom scoping per model
        return model.objects.all()
```

```python
# urls.py
from django.urls import path
from .views import QLab

urlpatterns = [
    path('api/query/',        QLab.as_view({'post': 'post'})),
    path('api/metadata/',     QLab.as_view({'post': 'metadata'})),
    path('api/neighborhood/', QLab.as_view({'post': 'neighborhood'})),
]
```

### 3. Configure Settings (Optional)

```python
# settings.py
QLAB_SETTINGS = {
    'DEFAULT_APP_LABEL': 'myapp',
    'PAGE_SIZE': 100,
    'MAX_PAGE_SIZE': 500,
    'MAX_RELATION_DEPTH': 2,
    'MAX_FILTER_CONDITIONS': 10,
    'MAX_NODES': 100,
    'ALLOWED_APPS': [],        # Empty = all apps allowed
    'RESTRICTED_MODELS': [],   # Models blocked from all endpoints
}
```

---

## Usage Examples

### Simple Query

```json
POST /api/query/
{
  "model": "Book",
  "select_fields": ["id", "title", "published", "author__first_name"]
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
    { "id": 1, "title": "Django for Beginners", "published": true, "author__first_name": "Anna" }
  ]
}
```

### Query with Filters

```json
POST /api/query/
{
  "model": "Book",
  "select_fields": ["id", "title", "author__first_name"],
  "filter_fields": {
    "and_operation": [
      { "field": "published", "op": "is", "value": "true" },
      { "field": "author__first_name", "op": "icontains", "value": "Anna" }
    ]
  }
}
```

### Reverse Relation Filter

```json
POST /api/query/
{
  "model": "Author",
  "select_fields": ["id", "first_name", "last_name"],
  "filter_fields": {
    "and_operation": [
      { "field": "book__published", "op": "is", "value": "true" }
    ]
  }
}
```

### Complex Nested Filters

```json
POST /api/query/
{
  "model": "Book",
  "select_fields": ["id", "title"],
  "filter_fields": {
    "and_operation": [
      { "field": "published", "op": "is", "value": "true" }
    ],
    "or_operation": [
      { "field": "author__first_name", "op": "is", "value": "Anna" },
      { "field": "author__first_name", "op": "is", "value": "Max" }
    ],
    "not_operation": [
      { "field": "author__mail", "op": "icontains", "value": "@spam.com" }
    ]
  }
}
```

### Neighborhood Resolution

```json
POST /api/neighborhood/
{
  "model": "Author",
  "node_ids": ["1", "2"]
}
```

Response:

```json
{
  "model": "core.Author",
  "records": [
    {
      "nodeId": "1",
      "relations": {
        "book": { "pks": [1, 5, 12], "filter_name": "book" },
        "publisher": { "pks": [3], "filter_name": "publisher" }
      }
    }
  ]
}
```

### Get Model Metadata

```json
POST /api/metadata/
{
  "model": "Book"
}
```

Response:

```json
{
  "model_name": "Book",
  "app_label": "core",
  "primary_key_field": "id",
  "fields": [
    {
      "name": "id",
      "type": "integer",
      "label": "ID",
      "required": true,
      "primary_key": true,
      "allowed_operations": ["is", "is_not", "lt", "lte", "gt", "gte"]
    },
    {
      "name": "author",
      "type": "foreignkey",
      "label": "Author",
      "required": true,
      "allowed_operations": ["is", "is_not"],
      "related_model": "Author"
    }
  ],
  "all_lookups": ["author", "author__first_name", "author__last_name", "id", "published", "title"]
}
```

### Custom Queryset Scoping

Override `get_queryset()` to restrict which records are accessible:

```python
class QLab(QLabMixin, NeighborhoodMixin, QLabMetadataMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self, model):
        # Only return records belonging to the user's tenant
        return model.objects.filter(tenant=self.request.user.tenant)
```

---

## Requirements

- Python >= 3.9
- Django >= 4.0
- djangorestframework >= 3.14
- pydantic >= 2.0
- drf-spectacular >= 0.27

---

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
