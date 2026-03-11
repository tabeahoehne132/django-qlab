from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views import View


@method_decorator(ensure_csrf_cookie, name="dispatch")
class QLabView(View):
    """
    Serves the QLab frontend UI.

    Add to your Django project's urls.py::

        from qlab.views import QLabView

        urlpatterns = [
            path("qlab/", QLabView.as_view(), name="qlab"),
        ]

    Then run ``python manage.py collectstatic`` and make sure
    ``django.contrib.staticfiles`` is in INSTALLED_APPS.
    """

    graphiql_version: str = "0.1.0"

    def get(self, request: HttpRequest, **kwargs: object) -> HttpResponse:
        ui_path = request.path.rstrip("/") or "/"
        api_base = f"{ui_path}/api" if ui_path != "/" else "/api"
        return render(
            request,
            "qlab/index.html",
            context={
                "QLAB_VERSION": self.graphiql_version,
                "QLAB_API_BASE": api_base,
            },
        )
