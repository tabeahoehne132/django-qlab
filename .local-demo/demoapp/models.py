from django.db import models


class BusinessGroup(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=64)
    owner = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return self.name


class Device(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("offline", "Offline"),
        ("maintenance", "Maintenance"),
    ]
    TYPE_CHOICES = [
        ("Router", "Router"),
        ("Switch", "Switch"),
        ("Firewall", "Firewall"),
        ("Server", "Server"),
    ]

    name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES)
    region = models.CharField(max_length=2)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    businessgroup = models.ForeignKey(
        BusinessGroup,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class Interface(models.Model):
    STATUS_CHOICES = [
        ("up", "Up"),
        ("down", "Down"),
        ("unknown", "Unknown"),
    ]

    device = models.ForeignKey(
        Device,
        related_name="interfaces",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    ip = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES)

    def __str__(self) -> str:
        return f"{self.device.name} · {self.name}"


class VeeamBackup(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE)
    job_name = models.CharField(max_length=255)
    size = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.job_name
