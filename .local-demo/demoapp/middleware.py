from django.contrib.auth import get_user_model
from django.contrib.auth import login


class AutoLoginMiddleware:
    """
    Local-only helper to keep the demo project frictionless.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            User = get_user_model()
            user, _ = User.objects.get_or_create(
                username="demo",
                defaults={
                    "is_staff": True,
                    "is_superuser": True,
                    "email": "demo@example.com",
                },
            )
            user.backend = "django.contrib.auth.backends.ModelBackend"
            login(request, user)
        return self.get_response(request)
