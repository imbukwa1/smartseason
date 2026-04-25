from datetime import timedelta

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from .dashboard import build_dashboard_payload
from .models import Field, FieldUpdate, User
from .permissions import IsAdmin
from .serializers import FieldSerializer, FieldUpdateSerializer
from .views import FieldViewSet


class FieldStatusTests(SimpleTestCase):
    def test_harvested_field_is_completed(self):
        field = Field(
            name="North Field",
            crop_type="Maize",
            planting_date=timezone.localdate(),
            stage=Field.Stage.HARVESTED,
        )

        self.assertEqual(field.status, "completed")

    def test_planted_field_older_than_30_days_is_at_risk(self):
        field = Field(
            name="East Field",
            crop_type="Beans",
            planting_date=timezone.localdate() - timedelta(days=31),
            stage=Field.Stage.PLANTED,
        )

        self.assertEqual(field.status, "at_risk")

    def test_other_fields_are_active(self):
        field = Field(
            name="West Field",
            crop_type="Rice",
            planting_date=timezone.localdate(),
            stage=Field.Stage.GROWING,
        )

        self.assertEqual(field.status, "active")


class FieldSerializerTests(SimpleTestCase):
    def test_field_response_includes_computed_status(self):
        field = Field(
            id=1,
            name="South Field",
            crop_type="Sorghum",
            planting_date=timezone.localdate() - timedelta(days=31),
            stage=Field.Stage.PLANTED,
        )

        data = FieldSerializer(field).data

        self.assertEqual(data["status"], "at_risk")

    def test_assigned_agent_must_have_agent_role(self):
        admin_user = User(username="admin", role=User.Role.ADMIN)
        serializer = FieldSerializer()

        with self.assertRaisesMessage(Exception, "Assigned user must be an agent."):
            serializer.validate_assigned_agent(admin_user)


class FieldUpdateSerializerTests(SimpleTestCase):
    def test_field_and_agent_are_read_only(self):
        serializer = FieldUpdateSerializer(
            data={
                "field": 10,
                "agent": 20,
                "new_stage": Field.Stage.READY,
                "notes": "Ready for harvest.",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("field", serializer.validated_data)
        self.assertNotIn("agent", serializer.validated_data)

    def test_rejects_invalid_stage(self):
        serializer = FieldUpdateSerializer(
            data={
                "new_stage": "invalid",
                "notes": "Bad stage.",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("new_stage", serializer.errors)


class FieldUpdateAccessTests(SimpleTestCase):
    def test_agent_can_update_assigned_field(self):
        agent = User(id=1, username="agent", role=User.Role.AGENT)
        field = Field(id=1, name="Field", assigned_agent=agent)

        FieldViewSet()._validate_field_update_access(agent, field)

    def test_agent_cannot_update_unassigned_field(self):
        agent = User(id=1, username="agent", role=User.Role.AGENT)
        other_agent = User(id=2, username="other", role=User.Role.AGENT)
        field = Field(id=1, name="Field", assigned_agent=other_agent)

        with self.assertRaisesMessage(
            Exception,
            "You can only post updates to fields assigned to you.",
        ):
            FieldViewSet()._validate_field_update_access(agent, field)

    def test_admin_cannot_post_field_update(self):
        admin = User(id=1, username="admin", role=User.Role.ADMIN)
        field = Field(id=1, name="Field")

        with self.assertRaisesMessage(Exception, "Only agents can post field updates."):
            FieldViewSet()._validate_field_update_access(admin, field)


class DashboardPayloadTests(SimpleTestCase):
    def test_builds_dashboard_counts_and_recent_updates(self):
        agent = User(id=1, username="agent", role=User.Role.AGENT)
        active_field = Field(
            id=1,
            name="Active Field",
            crop_type="Maize",
            planting_date=timezone.localdate(),
            stage=Field.Stage.GROWING,
            assigned_agent=agent,
        )
        at_risk_field = Field(
            id=2,
            name="Risk Field",
            crop_type="Beans",
            planting_date=timezone.localdate() - timedelta(days=31),
            stage=Field.Stage.PLANTED,
            assigned_agent=agent,
        )
        completed_field = Field(
            id=3,
            name="Done Field",
            crop_type="Rice",
            planting_date=timezone.localdate(),
            stage=Field.Stage.HARVESTED,
            assigned_agent=agent,
        )
        update = FieldUpdate(
            field=completed_field,
            agent=agent,
            new_stage=Field.Stage.HARVESTED,
            notes="Harvest finished.",
            created_at=timezone.now(),
        )

        payload = build_dashboard_payload(
            [active_field, at_risk_field, completed_field],
            [update],
        )

        self.assertEqual(payload["total_fields"], 3)
        self.assertEqual(payload["by_status"]["active"], 1)
        self.assertEqual(payload["by_status"]["at_risk"], 1)
        self.assertEqual(payload["by_status"]["completed"], 1)
        self.assertEqual(payload["by_stage"]["planted"], 1)
        self.assertEqual(payload["by_stage"]["growing"], 1)
        self.assertEqual(payload["by_stage"]["ready"], 0)
        self.assertEqual(payload["by_stage"]["harvested"], 1)
        self.assertEqual(
            payload["recent_updates"][0],
            {
                "field_name": "Done Field",
                "agent": "agent",
                "notes": "Harvest finished.",
                "date": update.created_at,
            },
        )


class IsAdminPermissionTests(SimpleTestCase):
    def test_allows_admin_users(self):
        request = APIRequestFactory().get("/api/fields/")
        request.user = User(username="admin", role=User.Role.ADMIN)

        self.assertTrue(IsAdmin().has_permission(request, None))

    def test_denies_agent_users(self):
        request = APIRequestFactory().get("/api/fields/")
        request.user = User(username="agent", role=User.Role.AGENT)

        self.assertFalse(IsAdmin().has_permission(request, None))
