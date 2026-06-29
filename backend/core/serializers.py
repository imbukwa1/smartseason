from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
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
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"email": "No account was found with this email address."}
            ) from exc

        if not user.is_active:
            raise serializers.ValidationError(
                {"email": "This account is inactive. Contact an administrator."}
            )

        if not user.check_password(password):
            raise serializers.ValidationError({"password": "The password is incorrect."})

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "password", "confirm_password"]
        read_only_fields = ["id"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
            "email": {"required": True, "allow_blank": False},
        }

    def validate_email(self, email):
        normalized_email = User.objects.normalize_email(email).lower()

        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("An account with this email already exists.")

        return normalized_email

    def validate_password(self, password):
        errors = []

        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")

        if not any(character.isupper() for character in password):
            errors.append("Password must contain at least one uppercase letter.")

        if not any(character.islower() for character in password):
            errors.append("Password must contain at least one lowercase letter.")

        if not any(character.isdigit() for character in password):
            errors.append("Password must contain at least one number.")

        if errors:
            raise serializers.ValidationError(errors)

        validate_password(password)
        return password

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Password confirmation does not match."}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        email = validated_data["email"]

        user = User(
            username=email,
            role=User.Role.AGENT,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


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
