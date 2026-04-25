from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import FieldViewSet, LoginView, agents, dashboard, me
from .views import health_check


router = DefaultRouter()
router.register("fields", FieldViewSet, basename="field")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("api/auth/me/", me, name="auth-me"),
    path("api/dashboard/", dashboard, name="dashboard"),
    path("api/agents/", agents, name="agents"),
    path("api/", include(router.urls)),
]
