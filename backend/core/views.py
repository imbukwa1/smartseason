from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.views import TokenObtainPairView

from .dashboard import build_dashboard_payload
from .models import Field, FieldUpdate, User
from .permissions import IsAdmin
from .serializers import (
    EmailTokenObtainPairSerializer,
    AgentSerializer,
    FieldDetailSerializer,
    FieldSerializer,
    FieldUpdateSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user
    fields = Field.objects.select_related("assigned_agent")
    updates = FieldUpdate.objects.select_related("field", "agent")

    if user.role != User.Role.ADMIN:
        fields = fields.filter(assigned_agent=user)
        updates = updates.filter(field__assigned_agent=user)

    recent_updates = updates.order_by("-created_at")[:5]
    return Response(build_dashboard_payload(fields, recent_updates))


@api_view(["GET"])
@permission_classes([IsAdmin])
def agents(request):
    queryset = User.objects.filter(role=User.Role.AGENT).order_by("email", "username")
    return Response(AgentSerializer(queryset, many=True).data)


class FieldViewSet(ModelViewSet):
    serializer_class = FieldSerializer

    def get_serializer_class(self):
        if self.action == "retrieve":
            return FieldDetailSerializer
        return super().get_serializer_class()

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Field.objects.select_related("assigned_agent")
            .prefetch_related("updates__agent")
            .order_by("-created_at")
        )

        if user.role == User.Role.ADMIN:
            return queryset

        return queryset.filter(assigned_agent=user)

    @action(detail=True, methods=["get", "post"], url_path="updates")
    def updates(self, request, pk=None):
        if request.method == "GET":
            field = self.get_object()
            updates = field.updates.select_related("agent").order_by("-created_at")
            serializer = FieldUpdateSerializer(updates, many=True)
            return Response(serializer.data)

        field = get_object_or_404(Field.objects.all(), pk=pk)
        self._validate_field_update_access(request.user, field)

        serializer = FieldUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            update = serializer.save(field=field, agent=request.user)
            field.stage = update.new_stage
            field.save(update_fields=["stage", "updated_at"])

        return Response(FieldUpdateSerializer(update).data, status=201)

    def _validate_field_update_access(self, user, field):
        if user.role != User.Role.AGENT:
            raise PermissionDenied("Only agents can post field updates.")

        if field.assigned_agent_id != user.id:
            raise PermissionDenied("You can only post updates to fields assigned to you.")
