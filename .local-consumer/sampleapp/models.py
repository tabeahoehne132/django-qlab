from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=120)
    region = models.CharField(max_length=32)

    def __str__(self) -> str:
        return self.name


class Device(models.Model):
    name = models.CharField(max_length=120)
    status = models.CharField(max_length=32)
    owner = models.CharField(max_length=120, blank=True)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="devices")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name
