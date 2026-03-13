from django.conf import settings
from django.db import models


class QLabUserSettings(models.Model):
    THEME_CHOICES = [
        ("dark", "Dark"),
        ("light", "Light"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qlab_settings",
    )
    theme = models.CharField(max_length=16, choices=THEME_CHOICES, default="dark")
    default_page_size = models.PositiveIntegerField(default=100)
    last_active_tab = models.CharField(max_length=32, default="queries")
    active_docs_key = models.CharField(max_length=64, default="overview")
    active_settings_key = models.CharField(max_length=64, default="general")
    ui_state = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "QLab user settings"
        verbose_name_plural = "QLab user settings"

    def __str__(self) -> str:
        return f"QLab settings for {self.user}"


class SavedQuery(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qlab_saved_queries",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    app_label = models.CharField(max_length=128, blank=True, default="")
    model_name = models.CharField(max_length=128)
    query_payload = models.JSONField(default=dict)
    tags = models.JSONField(default=list, blank=True)
    is_shared = models.BooleanField(default=False)
    last_run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "-updated_at"]
        unique_together = ("user", "name")

    def __str__(self) -> str:
        return f"{self.name} ({self.model_name})"


class QueryRunHistory(models.Model):
    STATUS_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("draft", "Draft"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qlab_query_history",
    )
    saved_query = models.ForeignKey(
        SavedQuery,
        on_delete=models.SET_NULL,
        related_name="runs",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True)
    app_label = models.CharField(max_length=128, blank=True, default="")
    model_name = models.CharField(max_length=128)
    query_payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="success")
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    result_count = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "QLab query run"
        verbose_name_plural = "QLab query runs"

    def __str__(self) -> str:
        return f"{self.model_name} ({self.status})"
