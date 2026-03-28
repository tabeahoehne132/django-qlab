from django.contrib import admin

from qlab.models import QLabUserSettings, QueryRunHistory, SavedQuery


@admin.register(QLabUserSettings)
class QLabUserSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "theme",
        "default_page_size",
        "last_active_tab",
        "updated_at",
    )
    search_fields = ("user__username", "user__email")
    list_filter = ("theme", "last_active_tab")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SavedQuery)
class SavedQueryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "user",
        "app_label",
        "model_name",
        "is_shared",
        "last_run_at",
        "updated_at",
    )
    search_fields = ("name", "description", "user__username", "model_name", "app_label")
    list_filter = ("is_shared", "app_label", "model_name")
    readonly_fields = ("created_at", "updated_at", "last_run_at")


@admin.register(QueryRunHistory)
class QueryRunHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "model_name",
        "user",
        "status",
        "saved_query",
        "result_count",
        "duration_ms",
        "created_at",
    )
    search_fields = (
        "title",
        "model_name",
        "app_label",
        "user__username",
        "error_message",
    )
    list_filter = ("status", "app_label", "model_name", "created_at")
    readonly_fields = ("created_at",)
