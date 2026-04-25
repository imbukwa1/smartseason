from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        AGENT = "agent", "Agent"

    role = models.CharField(max_length=20, choices=Role.choices)

    def __str__(self):
        return self.get_username()


class Field(models.Model):
    class Stage(models.TextChoices):
        PLANTED = "planted", "Planted"
        GROWING = "growing", "Growing"
        READY = "ready", "Ready"
        HARVESTED = "harvested", "Harvested"

    name = models.CharField(max_length=255)
    crop_type = models.CharField(max_length=255)
    planting_date = models.DateField()
    stage = models.CharField(max_length=20, choices=Stage.choices)
    assigned_agent = models.ForeignKey(
        User,
        null=True,
        blank=True,
        limit_choices_to={"role": User.Role.AGENT},
        on_delete=models.SET_NULL,
        related_name="assigned_fields",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def status(self):
        if self.stage == self.Stage.HARVESTED:
            return "completed"

        cutoff_date = timezone.localdate() - timedelta(days=30)
        if self.stage == self.Stage.PLANTED and self.planting_date < cutoff_date:
            return "at_risk"

        return "active"

    def clean(self):
        super().clean()
        if self.assigned_agent and self.assigned_agent.role != User.Role.AGENT:
            raise ValidationError({"assigned_agent": "Assigned user must be an agent."})

    def __str__(self):
        return self.name


class FieldUpdate(models.Model):
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name="updates",
    )
    agent = models.ForeignKey(
        User,
        limit_choices_to={"role": User.Role.AGENT},
        on_delete=models.CASCADE,
        related_name="field_updates",
    )
    new_stage = models.CharField(max_length=20, choices=Field.Stage.choices)
    notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        if self.agent and self.agent.role != User.Role.AGENT:
            raise ValidationError({"agent": "Field update user must be an agent."})

    def __str__(self):
        return f"{self.field} updated to {self.new_stage}"
