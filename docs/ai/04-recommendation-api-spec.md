# Crop Recommendation API Specification

## Purpose

This document plans the REST API for the future crop recommendation module. It does not implement endpoints. The API follows the existing SmartSeason pattern: `/api/` prefix, JWT authentication, DRF serializers for validation, and role-aware querysets.

## Authentication

All recommendation endpoints should require JWT authentication unless explicitly noted.

Headers:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Role rules:

- Agents can generate recommendations and read their own recommendation history.
- Admins can generate recommendations and may read all recommendation records if product requirements allow.
- Crop catalog read endpoints can be available to any authenticated user.
- Crop catalog write endpoints, if added later, should be admin-only.

## Error Format

Use standard DRF validation responses:

```json
{
  "field_name": ["Validation message."]
}
```

Use `detail` for permission and not-found errors:

```json
{
  "detail": "You do not have permission to access this recommendation."
}
```

## GET /api/crops/

List active crops available for recommendation.

Authentication:

- Required.

Query parameters:

- `soil_type`: optional soil type slug.
- `season`: optional season slug.
- `is_active`: optional boolean, admin-only if inactive crops are exposed.
- `search`: optional crop name search.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Maize",
    "slug": "maize",
    "description": "Staple cereal crop.",
    "suitable_soil_types": [
      {
        "id": 1,
        "name": "Loam",
        "slug": "loam"
      }
    ],
    "suitable_seasons": [
      {
        "id": 1,
        "name": "Long rains",
        "slug": "long-rains"
      }
    ],
    "rainfall_range_mm": {
      "min": 500,
      "max": 900
    },
    "temperature_range_c": {
      "min": 18,
      "max": 30
    },
    "farm_size_range_acres": {
      "min": 0.25,
      "max": null
    },
    "risk_notes": "Sensitive to prolonged drought."
  }
]
```

Expected errors:

- `401 Unauthorized`: missing or expired token.
- `403 Forbidden`: non-admin attempts to include inactive crops if that option is restricted.

## GET /api/soil-types/

List supported soil types for recommendation forms.

Authentication:

- Required.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Loam",
    "slug": "loam",
    "description": "Balanced sand, silt, and clay soil."
  }
]
```

Expected errors:

- `401 Unauthorized`: missing or expired token.

## GET /api/seasons/

List supported planting seasons.

Authentication:

- Required.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Long rains",
    "slug": "long-rains",
    "start_month": 3,
    "end_month": 6
  }
]
```

Expected errors:

- `401 Unauthorized`: missing or expired token.

## POST /api/recommendations/generate/

Generate and persist crop recommendations.

Authentication:

- Required.

Request body:

```json
{
  "location_name": "Nakuru",
  "latitude": -0.3031,
  "longitude": 36.08,
  "season": "long-rains",
  "soil_type": "loam",
  "rainfall_mm": 720,
  "temperature_c": 24,
  "farm_size_acres": 2.5,
  "field": null,
  "notes": "Planning next planting cycle."
}
```

Required fields:

- `location_name`
- `season`
- `soil_type`
- `rainfall_mm`
- `temperature_c`
- `farm_size_acres`

Optional fields:

- `latitude`
- `longitude`
- `field`
- `notes`

Validation:

- `season` must match an existing active season.
- `soil_type` must match an existing soil type.
- `rainfall_mm` must be greater than or equal to 0.
- `temperature_c` must be within a reasonable supported range, for example -20 to 60.
- `farm_size_acres` must be greater than 0.
- `latitude` must be between -90 and 90 when provided.
- `longitude` must be between -180 and 180 when provided.
- `field`, if provided, must be visible to the authenticated user.
- At least one active crop must exist in the catalog.

Response `201`:

```json
{
  "id": 42,
  "requested_by": {
    "id": 7,
    "email": "agent@smartseason.com"
  },
  "location_name": "Nakuru",
  "season": {
    "id": 1,
    "name": "Long rains",
    "slug": "long-rains"
  },
  "soil_type": {
    "id": 1,
    "name": "Loam",
    "slug": "loam"
  },
  "rainfall_mm": 720,
  "temperature_c": 24,
  "farm_size_acres": 2.5,
  "method": "rule_based",
  "input_source": "manual",
  "created_at": "2026-06-29T15:30:00Z",
  "results": [
    {
      "rank": 1,
      "score": 92.5,
      "confidence": "high",
      "crop": {
        "id": 1,
        "name": "Maize",
        "slug": "maize"
      },
      "matched_factors": [
        "Soil type is suitable.",
        "Rainfall is within the preferred range.",
        "Temperature is within the preferred range."
      ],
      "warnings": [],
      "explanation": "Maize is highly suitable for loam soil under the provided rainfall and temperature conditions."
    }
  ]
}
```

Expected errors:

- `400 Bad Request`: invalid input, missing required fields, unsupported soil type or season.
- `401 Unauthorized`: missing or expired token.
- `403 Forbidden`: provided field is not accessible to the user.
- `404 Not Found`: provided field id does not exist or is hidden by role scoping.
- `409 Conflict`: recommendation cannot be generated because no active crops are configured.
- `503 Service Unavailable`: future weather provider is required but unavailable.

## GET /api/recommendations/

List recommendation records visible to the current user.

Authentication:

- Required.

Query parameters:

- `season`: optional season slug.
- `soil_type`: optional soil type slug.
- `crop`: optional crop slug that appeared in results.
- `field`: optional field id.
- `date_from`: optional ISO date.
- `date_to`: optional ISO date.
- `page`: optional page number when pagination is added.

Response `200`:

```json
[
  {
    "id": 42,
    "location_name": "Nakuru",
    "season": "Long rains",
    "soil_type": "Loam",
    "farm_size_acres": 2.5,
    "top_crop": {
      "id": 1,
      "name": "Maize",
      "score": 92.5,
      "confidence": "high"
    },
    "created_at": "2026-06-29T15:30:00Z"
  }
]
```

Expected errors:

- `400 Bad Request`: invalid filters, such as malformed dates.
- `401 Unauthorized`: missing or expired token.

## GET /api/recommendations/{id}/

Retrieve one recommendation and all ranked results.

Authentication:

- Required.

Response `200`:

```json
{
  "id": 42,
  "requested_by": {
    "id": 7,
    "email": "agent@smartseason.com"
  },
  "field": null,
  "location_name": "Nakuru",
  "latitude": -0.3031,
  "longitude": 36.08,
  "season": {
    "id": 1,
    "name": "Long rains",
    "slug": "long-rains"
  },
  "soil_type": {
    "id": 1,
    "name": "Loam",
    "slug": "loam"
  },
  "rainfall_mm": 720,
  "temperature_c": 24,
  "farm_size_acres": 2.5,
  "method": "rule_based",
  "status": "completed",
  "input_source": "manual",
  "notes": "Planning next planting cycle.",
  "created_at": "2026-06-29T15:30:00Z",
  "results": [
    {
      "rank": 1,
      "crop": {
        "id": 1,
        "name": "Maize",
        "slug": "maize"
      },
      "score": 92.5,
      "confidence": "high",
      "matched_factors": [
        "Soil type is suitable."
      ],
      "warnings": [],
      "explanation": "Maize is highly suitable for the provided conditions."
    }
  ],
  "weather_snapshot": null
}
```

Expected errors:

- `401 Unauthorized`: missing or expired token.
- `403 Forbidden`: user is authenticated but cannot view this record.
- `404 Not Found`: recommendation does not exist or is hidden by role scoping.

## GET /api/recommendations/history/

List historical recommendation records. This can initially behave like `GET /api/recommendations/` with history-focused sorting and filters.

Authentication:

- Required.

Query parameters:

- `limit`: optional maximum number of records.
- `date_from`: optional ISO date.
- `date_to`: optional ISO date.
- `method`: optional recommendation method.
- `field`: optional field id.

Response `200`:

```json
[
  {
    "id": 42,
    "location_name": "Nakuru",
    "top_crop_name": "Maize",
    "method": "rule_based",
    "created_at": "2026-06-29T15:30:00Z"
  }
]
```

Expected errors:

- `400 Bad Request`: invalid filters.
- `401 Unauthorized`: missing or expired token.

## Future Admin Endpoints

These should be planned but not required for the first recommendation release.

```text
POST /api/crops/
PATCH /api/crops/{id}/
DELETE /api/crops/{id}/
POST /api/soil-types/
PATCH /api/soil-types/{id}/
POST /api/seasons/
PATCH /api/seasons/{id}/
```

Authentication:

- Required.

Authorization:

- Admin only.

Expected errors:

- `400 Bad Request`: invalid catalog data.
- `401 Unauthorized`: missing or expired token.
- `403 Forbidden`: non-admin user.
- `409 Conflict`: duplicate crop, soil type, season, or invalid deletion due to existing recommendation history.

## Frontend Integration Notes

The React implementation should:

- Load soil types and seasons before displaying the generate form.
- Submit generation requests through the existing shared `api` client.
- Display validation errors inline using the existing form error style.
- Show ranked results with score, confidence, explanation, and warnings.
- Link recommendation history items to detail pages.
- Keep generation available only inside protected routes.

## Versioning Notes

Do not version the API path yet. Keep endpoints under `/api/` to match the current app. If recommendation response formats become public or mobile clients are introduced, add explicit API versioning later.

