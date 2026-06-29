# Crop Recommendation Data Model Design

## Purpose

This document proposes database changes for the future crop recommendation system. It does not implement migrations or models. The design is intended to work with the existing `core.User`, `Field`, and `FieldUpdate` models while keeping recommendation data auditable and easy to evolve.

## Design Principles

- Keep crop catalog data separate from user-generated recommendations.
- Preserve every recommendation request and result for history, auditing, and future ML training.
- Store enough environmental inputs to reproduce why a recommendation was generated.
- Avoid external API coupling in core recommendation records.
- Use simple relational models before adding specialized ML infrastructure.

## Proposed Models

## SoilType

Represents a normalized soil type that crops can declare compatibility with.

Fields:

- `id`: primary key.
- `name`: unique display name, for example `Loam`, `Clay`, `Sandy`, `Silt`, `Peaty`.
- `slug`: unique URL-safe identifier.
- `description`: optional text explaining the soil type.
- `created_at`: timestamp.
- `updated_at`: timestamp.

Relationships:

- Many-to-many with `Crop` through `Crop.suitable_soil_types`.
- Foreign key from `Recommendation.soil_type`.

Constraints:

- `name` unique.
- `slug` unique.
- `name` required.

Why it exists:

Soil values should not be free-text in recommendation logic. A normalized table prevents spelling variants from weakening scoring rules.

## Crop

Represents a crop that can be recommended.

Fields:

- `id`: primary key.
- `name`: unique crop name.
- `slug`: unique URL-safe identifier.
- `description`: optional text.
- `min_rainfall_mm`: minimum preferred rainfall.
- `max_rainfall_mm`: maximum preferred rainfall.
- `min_temperature_c`: minimum preferred temperature.
- `max_temperature_c`: maximum preferred temperature.
- `min_farm_size_acres`: optional minimum viable farm size.
- `max_farm_size_acres`: optional maximum practical farm size.
- `growing_days_min`: optional shortest expected growing period.
- `growing_days_max`: optional longest expected growing period.
- `risk_notes`: optional text for common risks.
- `is_active`: boolean flag for recommendation availability.
- `created_at`: timestamp.
- `updated_at`: timestamp.

Relationships:

- Many-to-many with `SoilType` through `suitable_soil_types`.
- Many-to-many with `Season` if a separate season table is added.
- Foreign key from `RecommendationResult.crop`.

Constraints:

- `name` unique.
- `slug` unique.
- Rainfall min must be less than or equal to rainfall max.
- Temperature min must be less than or equal to temperature max.
- Farm size min must be less than or equal to farm size max when both are provided.
- Growing days min must be less than or equal to growing days max when both are provided.

Why it exists:

The crop catalog is the main knowledge base for deterministic recommendations. Keeping suitability ranges in the database lets admins tune recommendations without changing scoring code later.

## Season

Represents a normalized season or planting window.

Fields:

- `id`: primary key.
- `name`: unique display name, for example `Long rains`, `Short rains`, `Dry season`.
- `slug`: unique URL-safe identifier.
- `description`: optional text.
- `start_month`: integer from 1 to 12, optional.
- `end_month`: integer from 1 to 12, optional.
- `created_at`: timestamp.
- `updated_at`: timestamp.

Relationships:

- Many-to-many with `Crop` through `Crop.suitable_seasons`.
- Foreign key from `Recommendation.season`.

Constraints:

- `name` unique.
- `slug` unique.
- Month fields must be between 1 and 12.

Why it exists:

Season values are part of scoring and filtering. A table keeps the recommendation request consistent with the crop catalog and supports regional season definitions later.

## Recommendation

Represents one recommendation request made by a user.

Fields:

- `id`: primary key.
- `requested_by`: foreign key to `User`.
- `field`: optional foreign key to `Field`.
- `location_name`: user-entered location label.
- `latitude`: optional decimal.
- `longitude`: optional decimal.
- `season`: foreign key to `Season`.
- `soil_type`: foreign key to `SoilType`.
- `rainfall_mm`: user-entered or weather-enriched rainfall value.
- `temperature_c`: user-entered or weather-enriched temperature value.
- `farm_size_acres`: positive decimal.
- `method`: choice field, initially `rule_based`; future values can include `hybrid` and `ml_model`.
- `status`: choice field such as `completed`, `failed`, or `needs_review`.
- `input_source`: choice field such as `manual`, `weather_enriched`, or `imported`.
- `notes`: optional user notes.
- `created_at`: timestamp.
- `updated_at`: timestamp.

Relationships:

- Many recommendations belong to one user.
- A recommendation may be linked to one existing field.
- One recommendation has many `RecommendationResult` rows.
- One recommendation may reference one `WeatherSnapshot`.

Constraints:

- `requested_by` required.
- `season` required.
- `soil_type` required.
- `farm_size_acres` must be greater than 0.
- `latitude` must be between -90 and 90 when provided.
- `longitude` must be between -180 and 180 when provided.
- `rainfall_mm` must be greater than or equal to 0.
- `method` should default to `rule_based`.
- `status` should default to `completed` for synchronous generation.

Why it exists:

This is the audit record for a recommendation run. It stores inputs and ownership so users can revisit history and future ML can learn from historical requests.

## RecommendationResult

Represents one crop candidate returned for a recommendation request.

Fields:

- `id`: primary key.
- `recommendation`: foreign key to `Recommendation`.
- `crop`: foreign key to `Crop`.
- `rank`: positive integer.
- `score`: decimal score.
- `confidence`: choice field such as `low`, `medium`, `high`.
- `matched_factors`: JSON object or array.
- `warnings`: JSON object or array.
- `explanation`: text explanation shown to users.
- `created_at`: timestamp.

Relationships:

- Many results belong to one recommendation.
- Each result points to one crop.

Constraints:

- Unique pair: `recommendation`, `crop`.
- Unique pair: `recommendation`, `rank`.
- `rank` must be greater than 0.
- `score` must be greater than or equal to 0.

Why it exists:

Recommendations are ranked lists, not a single answer. Storing each result makes the output reproducible and supports future analytics on which crops were recommended most often.

## WeatherSnapshot

Stores the weather data used for a recommendation when forecast integration is added.

Fields:

- `id`: primary key.
- `provider`: provider name, for example `manual`, `openweather`, or another weather API.
- `location_name`: location label.
- `latitude`: optional decimal.
- `longitude`: optional decimal.
- `forecast_start_date`: date.
- `forecast_end_date`: date.
- `rainfall_mm`: aggregated forecast rainfall.
- `min_temperature_c`: optional forecast minimum temperature.
- `max_temperature_c`: optional forecast maximum temperature.
- `avg_temperature_c`: optional forecast average temperature.
- `raw_payload`: optional JSON provider response.
- `created_at`: timestamp.

Relationships:

- One `Recommendation` may reference one `WeatherSnapshot`.

Constraints:

- `provider` required.
- Forecast start date must be before or equal to forecast end date.
- Rainfall must be greater than or equal to 0.
- Latitude and longitude range constraints when provided.

Why it exists:

Forecast data changes over time. Saving the snapshot used by a recommendation makes old recommendations explainable even after the live forecast changes.

## RecommendationHistory

Recommendation history can be represented by the `Recommendation` and `RecommendationResult` tables directly. A separate `RecommendationHistory` table is not necessary for the first implementation.

If a separate history table is later needed, it should only store audit events such as:

- `recommendation`
- `user`
- `event_type`
- `metadata`
- `created_at`

Why it is deferred:

Adding a separate history table now would duplicate the `Recommendation` record. The simpler approach is to query recommendations by user and creation date.

## Optional Future Model: RecommendationOutcome

This model can be added after users start acting on recommendations.

Fields:

- `recommendation_result`: foreign key to `RecommendationResult`.
- `field`: foreign key to `Field`.
- `selected_by`: foreign key to `User`.
- `was_planted`: boolean.
- `yield_notes`: optional text.
- `outcome_rating`: optional integer rating.
- `created_at`: timestamp.
- `updated_at`: timestamp.

Why it exists:

Outcome data can connect recommendations to real farm performance. This becomes useful for ML training and quality evaluation later.

## Relationship Summary

```text
User 1 -> many Recommendation
Field 1 -> many Recommendation (optional link)
SoilType many <-> many Crop
Season many <-> many Crop
Recommendation 1 -> many RecommendationResult
Crop 1 -> many RecommendationResult
Recommendation 0/1 -> 1 WeatherSnapshot
RecommendationResult 0/1 -> 1 RecommendationOutcome (future)
```

## Indexing Plan

Recommended indexes:

- `Crop(is_active, name)`
- `Recommendation(requested_by, created_at)`
- `Recommendation(field, created_at)`
- `Recommendation(season, soil_type)`
- `RecommendationResult(recommendation, rank)`
- `WeatherSnapshot(provider, created_at)`

These indexes support the expected list, history, detail, and generation queries without over-indexing early.

## Integration With Existing Models

The existing `Field.crop_type` is currently a free-text field. The recommendation module should not change it immediately because that would affect existing field management. Later, SmartSeason can add an optional `Field.crop` foreign key to `Crop` while preserving `crop_type` for backward compatibility.

The existing `User.role` values are enough for permissions:

- Admins can manage crop catalog records in future admin APIs.
- Agents can generate and view their own recommendations.
- Recommendation history should be filtered by `requested_by` unless an admin view explicitly requires broader access.

