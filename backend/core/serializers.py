from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Field, FieldUpdate, User


class EmailTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        User = get_user_model()
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("No active account found with the given credentials") from exc

        if not user.is_active or not user.check_password(password):
            raise serializers.ValidationError("No active account found with the given credentials")

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class FieldSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    assigned_agent_username = serializers.CharField(
        source="assigned_agent.username",
        read_only=True,
    )

    class Meta:
        model = Field
        fields = [
            "id",
            "name",
            "crop_type",
            "planting_date",
            "stage",
            "assigned_agent",
            "assigned_agent_username",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def validate_assigned_agent(self, assigned_agent):
        if assigned_agent and assigned_agent.role != User.Role.AGENT:
            raise serializers.ValidationError("Assigned user must be an agent.")
        return assigned_agent


class FieldUpdateSerializer(serializers.ModelSerializer):
    agent_username = serializers.CharField(source="agent.username", read_only=True)

    class Meta:
        model = FieldUpdate
        fields = [
            "id",
            "field",
            "agent",
            "agent_username",
            "new_stage",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "field", "agent", "created_at"]


class FieldDetailSerializer(FieldSerializer):
    updates = FieldUpdateSerializer(many=True, read_only=True)

    class Meta(FieldSerializer.Meta):
        fields = FieldSerializer.Meta.fields + ["updates"]


class AgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]
