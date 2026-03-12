import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedQuery",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("app_label", models.CharField(blank=True, default="", max_length=128)),
                ("model_name", models.CharField(max_length=128)),
                ("query_payload", models.JSONField(default=dict)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("is_shared", models.BooleanField(default=False)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qlab_saved_queries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name", "-updated_at"],
                "unique_together": {("user", "name")},
            },
        ),
        migrations.CreateModel(
            name="QLabUserSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "theme",
                    models.CharField(
                        choices=[("dark", "Dark"), ("light", "Light")],
                        default="dark",
                        max_length=16,
                    ),
                ),
                ("default_page_size", models.PositiveIntegerField(default=100)),
                ("last_active_tab", models.CharField(default="queries", max_length=32)),
                (
                    "active_docs_key",
                    models.CharField(default="overview", max_length=64),
                ),
                (
                    "active_settings_key",
                    models.CharField(default="general", max_length=64),
                ),
                ("ui_state", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qlab_settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "QLab user settings",
                "verbose_name_plural": "QLab user settings",
            },
        ),
        migrations.CreateModel(
            name="QueryRunHistory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(blank=True, max_length=255)),
                ("app_label", models.CharField(blank=True, default="", max_length=128)),
                ("model_name", models.CharField(max_length=128)),
                ("query_payload", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("success", "Success"),
                            ("failed", "Failed"),
                            ("draft", "Draft"),
                        ],
                        default="success",
                        max_length=16,
                    ),
                ),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("result_count", models.PositiveIntegerField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "saved_query",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="runs",
                        to="qlab.savedquery",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qlab_query_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "verbose_name": "QLab query run",
                "verbose_name_plural": "QLab query runs",
            },
        ),
    ]
