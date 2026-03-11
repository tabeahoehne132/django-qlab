from django.contrib import admin

from .models import Device, Team


admin.site.register(Team)
admin.site.register(Device)
