from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed demo admin and agent users."

    def handle(self, *args, **options):
        User = get_user_model()
        demo_users = [
            {
                "email": "admin@smartseason.com",
                "password": "admin123",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "agent@smartseason.com",
                "password": "agent123",
                "role": User.Role.AGENT,
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        for demo_user in demo_users:
            password = demo_user.pop("password")
            email = demo_user["email"]
            user, created = User.objects.update_or_create(
                email=email,
                defaults={
                    **demo_user,
                    "username": email,
                    "is_active": True,
                },
            )
            user.set_password(password)
            user.save(update_fields=["password"])

            action = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} {email}"))
