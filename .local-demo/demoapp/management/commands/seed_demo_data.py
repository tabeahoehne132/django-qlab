from django.core.management.base import BaseCommand

from demoapp.models import BusinessGroup, Device, Interface, VeeamBackup


class Command(BaseCommand):
    help = "Seed the local QLab demo project with sample data."

    def handle(self, *args, **options):
        if Device.objects.exists():
            self.stdout.write(self.style.WARNING("Demo data already exists."))
            return

        groups = [
            BusinessGroup.objects.create(name="Core Network", type="internal", owner="Ops"),
            BusinessGroup.objects.create(name="Cloud Platform", type="partner", owner="Infra"),
            BusinessGroup.objects.create(name="Retail Edge", type="external", owner="Field"),
        ]

        device_specs = [
            ("router-de-01", "active", "DE", "Router", groups[0], "10.0.1.1"),
            ("switch-de-07", "active", "DE", "Switch", groups[0], "10.0.1.7"),
            ("fw-core-01", "maintenance", "DE", "Firewall", groups[1], "10.0.0.1"),
            ("srv-backup-02", "active", "AT", "Server", groups[1], "10.1.0.2"),
            ("edge-retail-04", "offline", "CH", "Router", groups[2], "10.2.4.1"),
        ]

        devices = []
        for name, status, region, device_type, businessgroup, ip_address in device_specs:
            devices.append(
                Device.objects.create(
                    name=name,
                    status=status,
                    region=region,
                    type=device_type,
                    businessgroup=businessgroup,
                    ip_address=ip_address,
                )
            )

        interface_specs = [
            (devices[0], "ge-0/0/0", "10.0.1.11", "up"),
            (devices[0], "ge-0/0/1", "10.0.1.12", "up"),
            (devices[1], "xe-0/0/0", "10.0.1.21", "up"),
            (devices[2], "wan0", "10.0.0.10", "down"),
            (devices[4], "uplink", "10.2.4.11", "unknown"),
        ]
        for device, name, ip, status in interface_specs:
            Interface.objects.create(device=device, name=name, ip=ip, status=status)

        backup_specs = [
            (devices[3], "Daily VM Backup", 520),
            (devices[3], "Config Snapshots", 120),
            (devices[0], "Router Archive", 80),
        ]
        for device, job_name, size in backup_specs:
            VeeamBackup.objects.create(device=device, job_name=job_name, size=size)

        self.stdout.write(self.style.SUCCESS("Created local QLab demo data."))
