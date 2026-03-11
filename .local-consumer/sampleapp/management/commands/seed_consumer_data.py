from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from sampleapp.models import Device, Team
from qlab.models import QueryRunHistory, QLabUserSettings, SavedQuery


class Command(BaseCommand):
    help = "Seed a minimal consumer test setup for qlab."

    def handle(self, *args, **options):
        team_a, _ = Team.objects.get_or_create(name="Ops", region="DE")
        team_b, _ = Team.objects.get_or_create(name="Core", region="NL")
        team_c, _ = Team.objects.get_or_create(name="Access", region="AT")
        team_d, _ = Team.objects.get_or_create(name="Edge", region="CH")

        seed_rows = [
            ("edge-1", "active", "alice", team_a),
            ("edge-2", "planned", "bob", team_a),
            ("core-1", "active", "carol", team_b),
        ]
        owners = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"]
        teams = [team_a, team_b, team_c, team_d]
        statuses = ["active", "planned", "offline", "maintenance"]

        for index in range(4, 61):
            team = teams[index % len(teams)]
            status = statuses[index % len(statuses)]
            owner = owners[index % len(owners)]
            seed_rows.append((f"device-{index:02d}", status, owner, team))

        for name, status, owner, team in seed_rows:
            Device.objects.get_or_create(
                name=name,
                defaults={
                    "status": status,
                    "owner": owner,
                    "team": team,
                },
            )

        User = get_user_model()
        if not User.objects.filter(username="qlab").exists():
            User.objects.create_superuser("qlab", "qlab@example.com", "qlabpass")
        user = User.objects.get(username="qlab")

        QLabUserSettings.objects.get_or_create(user=user)

        saved_payloads = [
            (
                "Device query",
                "Device",
                {
                    "model": "Device",
                    "app_label": "sampleapp",
                    "select_fields": ["id", "name", "status", "owner", "team"],
                    "filter_fields": {
                        "or_operation": [
                            {"field": "team__id", "op": "is", "value": "1"},
                            {"field": "id", "op": "is", "value": "1"},
                        ]
                    },
                    "page": 1,
                    "page_size": 100,
                    "title": "Device query",
                },
                "Devices filtered to one team for payload scroll testing.",
            ),
            (
                "Active devices",
                "Device",
                {
                    "model": "Device",
                    "app_label": "sampleapp",
                    "select_fields": ["id", "name", "status", "owner", "team__name", "team__region"],
                    "filter_fields": {
                        "and_operation": [
                            {"field": "status", "op": "is", "value": "active"},
                        ]
                    },
                    "page": 1,
                    "page_size": 100,
                    "title": "Active devices",
                },
                "Active device inventory across teams.",
            ),
            (
                "Swiss edge estate",
                "Device",
                {
                    "model": "Device",
                    "app_label": "sampleapp",
                    "select_fields": ["id", "name", "status", "owner", "team__name", "team__region"],
                    "filter_fields": {
                        "and_operation": [
                            {"field": "team__region", "op": "is", "value": "CH"},
                        ]
                    },
                    "page": 1,
                    "page_size": 100,
                    "title": "Swiss edge estate",
                },
                "Devices for the Swiss edge team.",
            ),
            (
                "Team lookup drilldown",
                "Team",
                {
                    "model": "Team",
                    "app_label": "sampleapp",
                    "select_fields": ["id", "name", "region", "devices__id", "devices__name", "devices__status"],
                    "filter_fields": {
                        "or_operation": [
                            {"field": "region", "op": "is", "value": "DE"},
                            {"field": "devices__status", "op": "is", "value": "active"},
                        ]
                    },
                    "page": 1,
                    "page_size": 100,
                    "title": "Team lookup drilldown",
                },
                "Team-focused query with nested device lookups.",
            ),
        ]

        saved_queries = []
        for name, model_name, payload, description in saved_payloads:
            saved_query, _ = SavedQuery.objects.update_or_create(
                user=user,
                name=name,
                defaults={
                    "description": description,
                    "app_label": "sampleapp",
                    "model_name": model_name,
                    "query_payload": payload,
                    "tags": [],
                    "is_shared": False,
                    "last_run_at": timezone.now(),
                },
            )
            saved_queries.append(saved_query)

        QueryRunHistory.objects.all().delete()
        for index in range(1, 26):
            linked_query = saved_queries[index % len(saved_queries)]
            QueryRunHistory.objects.create(
                user=user,
                saved_query=linked_query if index % 2 == 0 else None,
                title=f"{linked_query.name} run {index}",
                app_label="sampleapp",
                model_name=linked_query.model_name,
                query_payload=linked_query.query_payload,
                status="success" if index % 7 else "failed",
                duration_ms=20 + index * 3,
                result_count=5 + index,
                error_message="" if index % 7 else "Synthetic failure for testing.",
            )

        self.stdout.write(self.style.SUCCESS("Consumer test data created."))
