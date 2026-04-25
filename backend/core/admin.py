from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Field, FieldUpdate, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("SmartSeason", {"fields": ("role",)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("SmartSeason", {"fields": ("role",)}),
    )
    list_display = ("username", "email", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "crop_type",
        "stage",
        "status",
        "assigned_agent",
        "planting_date",
    )
    list_filter = ("stage", "crop_type")
    search_fields = ("name", "crop_type", "assigned_agent__username")


@admin.register(FieldUpdate)
class FieldUpdateAdmin(admin.ModelAdmin):
    list_display = ("field", "agent", "new_stage", "created_at")
    list_filter = ("new_stage", "created_at")
    search_fields = ("field__name", "agent__username", "notes")
