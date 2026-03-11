from django.contrib import admin

from .models import BusinessGroup, Device, Interface, VeeamBackup


admin.site.register(BusinessGroup)
admin.site.register(Device)
admin.site.register(Interface)
admin.site.register(VeeamBackup)
