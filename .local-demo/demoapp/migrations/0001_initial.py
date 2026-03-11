from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="BusinessGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("type", models.CharField(max_length=64)),
                ("owner", models.CharField(blank=True, max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name="Device",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("status", models.CharField(choices=[("active", "Active"), ("offline", "Offline"), ("maintenance", "Maintenance")], max_length=32)),
                ("region", models.CharField(max_length=2)),
                ("type", models.CharField(choices=[("Router", "Router"), ("Switch", "Switch"), ("Firewall", "Firewall"), ("Server", "Server")], max_length=32)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
                ("businessgroup", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="demoapp.businessgroup")),
            ],
        ),
        migrations.CreateModel(
            name="VeeamBackup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("job_name", models.CharField(max_length=255)),
                ("size", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("device", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="demoapp.device")),
            ],
        ),
        migrations.CreateModel(
            name="Interface",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("ip", models.GenericIPAddressField(blank=True, null=True)),
                ("status", models.CharField(choices=[("up", "Up"), ("down", "Down"), ("unknown", "Unknown")], max_length=32)),
                ("device", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="interfaces", to="demoapp.device")),
            ],
        ),
    ]
