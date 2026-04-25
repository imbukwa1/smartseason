from .models import Field


def build_dashboard_payload(fields, recent_updates):
    field_list = list(fields)
    by_status = {
        "active": 0,
        "at_risk": 0,
        "completed": 0,
    }
    by_stage = {
        Field.Stage.PLANTED: 0,
        Field.Stage.GROWING: 0,
        Field.Stage.READY: 0,
        Field.Stage.HARVESTED: 0,
    }

    for field in field_list:
        by_status[field.status] += 1
        by_stage[field.stage] += 1

    return {
        "total_fields": len(field_list),
        "by_status": by_status,
        "by_stage": by_stage,
        "recent_updates": [
            {
                "field_name": update.field.name,
                "agent": update.agent.username,
                "notes": update.notes,
                "date": update.created_at,
            }
            for update in recent_updates
        ],
    }
