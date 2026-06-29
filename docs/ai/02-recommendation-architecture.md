# Crop Recommendation Architecture

## Objective

The crop recommendation module should help SmartSeason users choose suitable crops for a farm or field based on location, season, soil type, rainfall, temperature, farm size, and later weather forecasts. The first production version should be deterministic, explainable, and easy to test. ML and external weather providers can be added after the core data flow is stable.

## Architecture Overview

Recommended backend pieces:

- Recommendation API: authenticated DRF endpoints that accept recommendation inputs and return ranked crops.
- Recommendation serializers: validate request input and shape response payloads.
- Recommendation service: pure Python scoring layer that evaluates crops against input conditions.
- Crop data models: store crop requirements, soil compatibility, seasonal windows, and risk notes.
- Recommendation history models: persist request inputs, generated results, selected crop, confidence, and explanation.
- Weather service interface: optional future integration for forecast enrichment.
- ML adapter interface: optional future integration for model-based scoring.

Recommended frontend pieces:

- Recommendation page for generating recommendations.
- Recommendation history view.
- Crop catalog view for admins, if catalog management is exposed later.
- API helpers can continue using the existing shared Axios client.

## Proposed Backend Flow

```text
React page
  -> POST /api/recommendations/generate/
    -> DRF serializer validates inputs
      -> Recommendation service normalizes inputs
        -> Optional weather service enriches request
        -> Rule-based scorer ranks crop candidates
        -> Optional ML adapter adjusts score later
      -> Recommendation and result rows are saved
    <- Ranked response with explanations
```

The API layer should not contain scoring rules. It should validate input, call the service, save the outcome, and return a response.

## Recommendation Service

Create a small service module when implementation begins, for example:

- `backend/core/services/recommendations.py`

Initial responsibilities:

- Normalize user input such as season names, soil type, rainfall range, and temperature range.
- Load active crops and crop suitability rules from the database.
- Calculate a score for each crop.
- Produce human-readable explanations and warnings.
- Return ranked results in a serializer-friendly structure.

The service should use plain Python functions or a small class. It should not depend on request objects or DRF classes, which keeps it testable.

Possible interface:

```python
def generate_recommendations(user, input_data):
    ...
    return RecommendationResultSet(...)
```

## Rule-Based AI Logic Layer

The first version should use weighted rule scoring. This is "AI-powered" in the practical decision-support sense: it encodes agricultural suitability rules, ranks options, and explains the reasoning. It avoids opaque recommendations while SmartSeason is still building its data foundation.

Example scoring categories:

- Soil match: crop supports the selected soil type.
- Season match: crop is suitable for the selected season.
- Rainfall match: rainfall is inside or near the crop's preferred range.
- Temperature match: temperature is inside or near the crop's preferred range.
- Farm size fit: crop is viable for the stated area.
- Local availability: future adjustment based on regional crop catalog.
- Weather risk: future adjustment based on forecast.

Suggested scoring:

- Start each crop at 0.
- Add weighted points for each matching factor.
- Subtract points for high-risk mismatches.
- Exclude crops only when the mismatch makes the crop clearly invalid.
- Return `score`, `confidence`, `matched_factors`, `warnings`, and `explanation`.

## Future Weather API Integration

Weather should be integrated through a provider interface, not directly inside the DRF view or scoring code.

Suggested module:

- `backend/core/services/weather.py`

Suggested interface:

```python
def get_forecast(location, start_date=None, days=14):
    ...
    return WeatherForecast(...)
```

The recommendation service can call this interface when forecast-based recommendations are enabled. In the first implementation, weather inputs can be manual fields supplied by the user.

Future provider responsibilities:

- Convert farm location into forecast coordinates if needed.
- Fetch rainfall and temperature forecast.
- Cache responses to avoid repeated paid/API calls.
- Save a `WeatherSnapshot` used for each recommendation.
- Fail gracefully by falling back to manual rainfall and temperature inputs.

## Future ML Model Integration

ML should be added behind an adapter after SmartSeason has enough historical recommendation and field outcome data.

Suggested module:

- `backend/core/services/ml_recommendations.py`

Suggested interface:

```python
def score_candidates(features, crop_candidates):
    ...
    return ModelScoreResult(...)
```

The rule-based score should remain available as a fallback. The ML adapter can later:

- Re-rank rule-based candidates.
- Predict yield suitability.
- Estimate risk under forecast conditions.
- Learn from recommendation outcomes and field update history.

The API contract should not change when ML is introduced. The response can include a `method` value such as `rule_based`, `hybrid`, or `ml_model`.

## Data Flow

```text
User enters location, season, soil, rainfall, temperature, and farm size
  -> Frontend posts validated form data
  -> Backend validates required fields and ranges
  -> Backend optionally enriches with forecast data
  -> Recommendation service scores active crop catalog
  -> Backend saves recommendation request and ranked results
  -> Frontend displays ranked crops with explanations
  -> User can review history later
```

## API Flow

Initial endpoints should be protected with JWT auth and follow the current `/api/` route style.

```text
GET /api/crops/
  -> list available crops

POST /api/recommendations/generate/
  -> validate inputs
  -> generate and persist recommendations
  -> return ranked results

GET /api/recommendations/
  -> list current user's recommendation records

GET /api/recommendations/{id}/
  -> retrieve one recommendation and its ranked results

GET /api/recommendations/history/
  -> list historical recommendation records, optionally filtered
```

Admin-only endpoints can be added later for crop catalog management.

## Frontend Flow

Recommended routes:

- `/recommendations`: generate recommendations and show recent history.
- `/recommendations/:id`: inspect a saved recommendation.
- `/crops`: optional admin crop catalog page in a future session.

Role behavior:

- Admins can generate recommendations for planning and see broader history if required by product rules.
- Agents can generate recommendations for their own work and see only their own history by default.

The first UI should be a practical form and result list, consistent with the current dashboard style.

## Scalability Plan

Short term:

- Keep recommendations synchronous.
- Use indexed relational tables.
- Persist every generated recommendation for auditability.
- Unit test scoring logic separately from API tests.

Medium term:

- Cache weather lookups.
- Add crop catalog admin screens.
- Add filters for location, season, soil type, and date.
- Add pagination to recommendation history.

Long term:

- Move weather fetching or ML inference to background jobs if latency grows.
- Add model versioning.
- Track recommendation outcomes by linking recommendations to fields planted later.
- Use historical field updates to improve scoring.

## Boundaries For Week 1 Session 2

The next implementation session should start with the deterministic data model and serializers. It should not introduce external weather calls or ML infrastructure yet. Those integrations should remain behind service interfaces until the core recommendation workflow is stable.

