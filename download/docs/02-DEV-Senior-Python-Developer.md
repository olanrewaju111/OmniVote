# Senior Python Developer — OmniVote Monitor v2.1

> **Version:** 2.1 · **Last Updated:** 2025-07-09 · **Classification:** Internal Development Guide

---

## Table of Contents

1. [Role Context](#1-role-context)
2. [Required Python Services](#2-required-python-services-to-be-built)
3. [Technology Stack Recommendations](#3-technology-stack-recommendations)
4. [API Contract — Python Services → Next.js Frontend](#4-api-contract--python-services--nextjs-frontend)
5. [Database Schema Considerations](#5-database-schema-considerations)
6. [Data Volumes](#6-data-volumes)
7. [ML Model Requirements](#7-ml-model-requirements)
8. [Testing Requirements](#8-testing-requirements)
9. [Deployment](#9-deployment)
10. [Integration Points with Next.js](#10-integration-points-with-nextjs)

---

## 1. Role Context

You are joining the OmniVote Monitor v2.1 project as the **Senior Python Developer**. The application is currently a **Next.js/TypeScript monolith** backed by **SQLite** (via Prisma ORM). Your mandate is to build the **Python backend microservices, data processing pipelines, ML/AI models, and integration layers** that the Next.js frontend and existing API routes will consume.

### Current Architecture

| Component | Technology | Port | Notes |
|-----------|-----------|------|-------|
| Frontend + API | Next.js 15 / TypeScript | :3000 | Monolith — serves UI and all API routes |
| Database | SQLite (Prisma) | file-based | 23 models defined in `schema.prisma` |
| WhatsApp Bridge | Go | :9090 | Separate service, handles WABA messaging |

### Your Domain

The TypeScript monolith was built for rapid prototyping. As the system scales toward national-election workloads (10,000+ polling units, 50,000+ incidents, 100,000+ OSINT posts), the Next.js layer cannot efficiently handle ML inference, heavy data processing, real-time streaming, or long-running background tasks. Your Python services will **offload these concerns** into dedicated, horizontally scalable microservices.

### Guiding Principles

- **Each service is independently deployable** and communicates over HTTP (REST) or WebSocket.
- **Shared nothing at the code level** — services share the database but not code.
- **All ML/AI calls currently stubbed or simulated in the Next.js API routes must be replaced** with real Python service endpoints.
- **Backward compatibility** — existing Next.js API contracts must not break during migration. The Next.js layer will proxy requests to Python services transparently.

---

## 2. Required Python Services (To Be Built)

### 2.1 AI/ML Service (`ml-service`)

**Port:** `8001` · **Primary responsibility:** All machine-learning inference and AI-powered analysis.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ml/classify-incident` | POST | Classify 14 incident types from text descriptions using a multi-class NLP model. Input: `{ description: string }`. Output: `{ type: IncidentType, confidence: float, allScores: Record<string, float> }`. |
| `/api/ml/sentiment` | POST | Analyze OSINT post sentiment. Returns one of `POSITIVE`, `NEGATIVE`, `NEUTRAL`, `MIXED` with confidence score. Input: `{ text: string }`. |
| `/api/ml/cib-score` | POST | Compute a Coordinated Inauthentic Behavior (CIB) score between 0 and 1 for an OSINT post. Considers posting patterns, network overlap, temporal coordination, and content similarity. |
| `/api/ml/bot-detect` | POST | Identify bot accounts from posting patterns, engagement metrics, and follower ratios. Features include: posting frequency, engagement ratio, follower/following ratio, account age, content similarity to other accounts. Returns binary classification with probability. |
| `/api/ml/fake-news` | POST | Classify OSINT posts as fake news. Uses NLP-based classification with optional fact-check API integration. Returns `{ isFakeNews: boolean, confidence: float, factCheckResult?: object }`. |
| `/api/ml/deepfake-detect` | POST | Analyze uploaded images or videos for manipulation. **Currently simulated** — production implementation should use pre-trained models (FaceForensics++, DeepFakeDetection). Accepts multipart file upload. Returns `{ isDeepfake: boolean, confidence: float, manipulationRegions?: object[] }`. |
| `/api/ml/stego-analysis` | POST | Perform steganography analysis on images. Includes **real ELA (Error Level Analysis)**, noise pattern analysis, and metadata comparison. **Currently simulated** for non-ELA components. Accepts image file upload. Returns `{ hasSteganography: boolean, elaScore: float, noiseAnomaly: boolean, metadataAnomalies: string[] }`. |
| `/api/ml/flashpoint-forecast` | POST | Predict violence, intimidation, and logistics risk scores per state. Uses the `"ensemble_v2"` model label. Input: `{ stateIds: string[], historicalData?: object }`. Output: per-state risk scores for each category. |
| `/api/ml/summarize` | POST | Generate AI-powered summaries for incidents or OSINT post collections. Input: `{ texts: string[], maxLength?: number }`. Output: `{ summary: string, keyPoints: string[] }`. |

### 2.2 Data Processing Pipeline (`pipeline-service`)

**Port:** `8002` · **Primary responsibility:** Heavy computation, data aggregation, and ETL workflows.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline/pvt-compare` | POST | Run parallel vote tabulation comparison. Compares official results against independently submitted PVT data. Flags anomalies with >5% delta threshold. Input: `{ pollingUnitId: string }` or batch mode. Output: `{ matches: boolean, delta: float, anomalies: Anomaly[] }`. |
| `/api/pipeline/sankey-data` | GET | Compute state-to-party vote flow data for Sankey diagram visualization. Aggregates votes by state and party. Returns `{ nodes: SankeyNode[], links: SankeyLink[] }`. |
| `/api/pipeline/osint-ingest` | POST | Trigger or configure OSINT ingestion from supported platforms. Platforms: **X (Twitter), Facebook, YouTube, TikTok, Instagram, WhatsApp Channels, News sites, RSS feeds**. Supports scheduled and on-demand ingestion. |
| `/api/pipeline/suppression-analysis` | GET | Analyze voter suppression reports for patterns — geographic clustering, demographic targeting, temporal patterns. Returns `{ patterns: SuppressionPattern[], riskAreas: GeoFeature[] }`. |
| `/api/pipeline/geospatial-analysis` | POST | GPS anomaly detection, spatial clustering (DBSCAN), and hotspot identification (KDE) for incidents and security events. Input: `{ type: "incidents" \| "security", bounds?: GeoBounds }`. Output: `{ clusters: Cluster[], hotspots: Hotspot[], anomalies: GeoAnomaly[] }`. |

### 2.3 WhatsApp Integration Service (`whatsapp-service`)

**Port:** `8003` · **Primary responsibility:** Enhanced WhatsApp messaging, potentially replacing or complementing the existing Go bridge on `:9090`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/send` | POST | Send templated or freeform WhatsApp messages. Supports text, image, audio, video, and document media types. |
| `/api/whatsapp/render-template` | POST | Render one of **128 message templates** with variable substitution. Input: `{ templateId: string, variables: Record<string, string> }`. Output: rendered message ready for sending. |
| `/api/whatsapp/delivery-status` | POST (webhook) | Webhook handler for delivery receipts from WABA. Updates message delivery status in the database. |
| `/api/whatsapp/campaign-stats` | GET | Retrieve delivery statistics for a campaign: sent, delivered, read, failed counts. |
| `/api/whatsapp/rate-limit-status` | GET | Current rate limit utilization. WABA compliance: **1,000 messages/minute per campaign**. Returns `{ remaining: number, resetAt: ISO8601 }`. |
| `/api/whatsapp/upload-media` | POST | Upload and process media (image/audio/video) for use in WhatsApp messages. Handles resizing, compression, and format conversion as needed. |

**Rate Limiting Implementation:** Implement a token-bucket or sliding-window rate limiter compliant with WhatsApp Business API limits. Track per-campaign message counts in Redis. When limit is approached, queue excess messages and send them in the next window.

### 2.4 Real-Time Event Service (`realtime-service`)

**Port:** `8004` · **Primary responsibility:** WebSocket server replacing 30-second polling, live alerts, and event streaming.

| Feature | Description |
|---------|-------------|
| **WebSocket Server** | Clients connect via `ws://host:8004/ws`. Connection requires JWT authentication in the handshake query parameter. Supports room-based subscriptions (e.g., `situation-room`, `live-feed`, `security-monitor`). |
| **Alert Broadcasting** | When a new alert is created or an incident severity escalates, push the alert to all subscribed clients in the relevant room. Message format: `{ type: "ALERT", payload: Alert }`. |
| **Dead-Man's Switch Timer** | Monitor check-in deadlines for field observers. If an observer fails to check in within the configured window, trigger escalation. The timer runs in Celery and broadcasts timeout events via WebSocket. Message format: `{ type: "DEAD_MANS_SWITCH", payload: { observerId, lastCheckin, escalationLevel } }`. |
| **Live Feed** | Push new incidents, OSINT posts, and security events to the Situation Room and Live Feed views in real-time. Clients subscribe to specific event types. Message format: `{ type: "INCIDENT_NEW" \| "OSINT_NEW" \| "SECURITY_NEW", payload: object }`. |

---

## 3. Technology Stack Recommendations

### Core Framework

| Library | Version | Purpose |
|---------|---------|---------|
| **FastAPI** | >=0.110 | Async web framework with automatic OpenAPI docs and native type hints |
| **Uvicorn** | >=0.29 | ASGI server with HTTP/1.1 and WebSocket support |
| **Pydantic** | >=2.0 | Data validation and serialization (used by FastAPI natively) |

### Machine Learning & AI

| Library | Purpose |
|---------|---------|
| **scikit-learn** | Classical ML models (SVM, Random Forest, Logistic Regression) for classification and regression tasks |
| **TensorFlow** or **PyTorch** | Deep learning models for deepfake detection, NLP fine-tuning |
| **transformers** (HuggingFace) | Pre-trained NLP models (BERT, RoBERTa) for classification, sentiment, summarization |
| **spaCy** | Industrial-strength NLP pipeline for entity recognition, tokenization, and text preprocessing |
| **nltk** | Supplementary NLP utilities (stopwords, lemmatization) |

### Computer Vision & Steganography

| Library | Purpose |
|---------|---------|
| **OpenCV** (`cv2`) | Image processing, ELA computation, video frame extraction |
| **Pillow** (`PIL`) | Image I/O, format conversion, basic manipulation |
| **torchvision** | Pre-trained vision models for deepfake detection |
| **stegano** | Steganography detection and analysis tools |
| **numpy** | Numerical computation for ELA and noise analysis |

### Data Processing

| Library | Purpose |
|---------|---------|
| **pandas** | Tabular data manipulation, aggregation, comparison |
| **numpy** | Numerical arrays for statistical computation |
| **scipy** | Statistical tests, spatial analysis (KD-Tree, spatial distance) |
| **scikit-learn (sklearn.cluster)** | DBSCAN clustering for geospatial analysis |

### Real-Time & Messaging

| Library | Purpose |
|---------|---------|
| **websockets** | WebSocket server implementation |
| **Redis** | Pub/Sub for inter-service messaging, rate limiting state, Celery broker |
| **Celery** | Distributed task queue for background processing (OSINT ingestion, model training, scheduled forecasts) |

### Networking & HTTP

| Library | Purpose |
|---------|---------|
| **httpx** | Async HTTP client for calling external APIs (fact-check services, social media APIs, Next.js proxy endpoints) |

### Database

| Library | Purpose |
|---------|---------|
| **SQLAlchemy 2.0** (async) | ORM for database access, matching the existing Prisma schema |
| **asyncpg** | Async PostgreSQL driver (for the planned SQLite → PostgreSQL migration) |
| **alembic** | Database migration management |

### Logging & Observability

| Library | Purpose |
|---------|---------|
| **structlog** | Structured JSON logging for production |
| **prometheus-client** | Metrics exposition for monitoring |

---

## 4. API Contract — Python Services → Next.js Frontend

### Architecture Pattern

```
┌──────────────┐     HTTP/WS      ┌──────────────────┐     HTTP      ┌──────────────────┐
│              │ ◄──────────────► │                  │ ◄───────────► │   ml-service     │
│  Next.js     │                  │   Python API     │              │   :8001          │
│  Frontend    │ ◄──────────────► │   Gateway        │ ◄───────────► ├──────────────────┤
│  :3000       │      REST        │   :8000          │              │ pipeline-service │
│              │                  │  (optional)      │ ◄───────────► │   :8002          │
│              │ ◄──── WebSocket ─┤                  │ ◄───────────► ├──────────────────┤
└──────────────┘                  └──────────────────┘              │ whatsapp-service │
                                                                       :8003          │
                                                                       ├──────────────────┤
                                                                       │ realtime-service │
                                                                       :8004 (WS)       │
                                                                       └──────────────────┘
```

### Communication Rules

1. **Python services run as separate processes** on their own ports. The Next.js layer (or an optional Python API Gateway) calls them via HTTP REST.
2. **Current Next.js API routes will be refactored to proxy** to Python services. For example, `POST /api/incidents` in Next.js will call the Python ML service for classification and summarization before storing the result.
3. **All services share the same database** (currently SQLite; planned migration to PostgreSQL). Use SQLAlchemy 2.0 async models that match the Prisma schema.
4. **Authentication:** JWT tokens are passed in the `Authorization: Bearer <token>` header. Python services must validate the JWT and extract the user identity before processing requests.
5. **Error responses** follow a consistent format: `{ error: { code: string, message: string, details?: object } }`.

### Example Request Flow

```
Client → POST /api/incidents (Next.js)
  → Next.js validates JWT
  → Next.js calls ml-service:8001/api/ml/classify-incident
  → Next.js calls ml-service:8001/api/ml/summarize
  → Next.js stores incident with AI results in DB
  → Next.js calls realtime-service:8004 (WebSocket broadcast)
  → Next.js returns response to client
```

---

## 5. Database Schema Considerations

### Existing Prisma Models (23 total)

The project defines 23 Prisma models. Python services must create equivalent SQLAlchemy 2.0 async models. Key models relevant to Python services:

| Model | Python-Relevant Fields | Service |
|-------|----------------------|---------|
| **Incident** | `aiSummary`, `aiFlags` (JSON), `type`, `severity`, `description` | ml-service, realtime-service |
| **OsintPost** | `sentiment`, `cibScore`, `isFakeNews`, `isBotSuspect`, `platform`, `content` | ml-service, pipeline-service |
| **EvidenceDossier** | Linked to stego scan results | ml-service |
| **StegoScanResult** | `elaScore`, `noiseAnomaly`, `hasSteganography`, `metadataAnomalies` | ml-service |
| **FlashpointForecast** | `stateId`, `violenceScore`, `intimidationScore`, `logisticsScore`, `modelVersion` | ml-service |
| **SecurityEvent** | `type`, `severity`, `location`, `timestamp` | pipeline-service, realtime-service |
| **PvtSubmission** | Raw PVT data from field observers | pipeline-service |
| **ResultComparison** | Comparison results, delta, anomaly flags | pipeline-service |

### Schema Synchronization Strategy

1. **Prisma remains the source of truth** for schema definition.
2. Python SQLAlchemy models must be manually kept in sync. Consider generating them from the Prisma schema using a script.
3. All Python services should use **async sessions** via `AsyncSession` from SQLAlchemy's `ext.asyncio`.
4. During the PostgreSQL migration, both Prisma and SQLAlchemy will point to the same PostgreSQL instance.

---

## 6. Data Volumes

### Current (Development / Pilot)

| Entity | Current Count |
|--------|--------------|
| Polling Units | ~350–400 |
| Incidents | ~200+ |
| OSINT Posts | ~75 |
| Security Events | ~120 |

### Expected Scale (National Election)

| Entity | Expected Count |
|--------|---------------|
| Polling Units | 10,000+ |
| Incidents | 50,000+ |
| OSINT Posts | 100,000+ |
| Security Events | 200,000+ |

### Performance Implications

- Python services **must handle 10x current volumes** without degradation.
- Batch processing endpoints (PVT comparison, OSINT ingestion) must support chunked processing and async background tasks.
- Database queries must use proper indexing. The planned PostgreSQL migration is critical for handling this scale.
- ML inference should be **batched** where possible (e.g., classify 100 OSINT posts in a single request rather than 100 individual requests).
- Implement **caching** (Redis) for frequently requested data like Sankey flow data and flashpoint forecasts with TTL-based invalidation.

---

## 7. ML Model Requirements

### 7.1 Incident Classifier

- **Task:** Multi-class classification (14 incident types)
- **Input:** Text description of the incident
- **Output:** Incident type label + confidence + scores for all 14 classes
- **Training Data:** Historical incident records from previous elections
- **Model:** Fine-tuned transformer (e.g., `distilbert-base-uncased`) or SVM with TF-IDF features for faster inference
- **Target Accuracy:** >= 85% F1 macro-average

### 7.2 Sentiment Analyzer

- **Task:** 4-class classification (`POSITIVE`, `NEGATIVE`, `NEUTRAL`, `MIXED`)
- **Input:** OSINT post text (may include Nigerian Pidgin English, Hausa, Yoruba, Igbo)
- **Output:** Sentiment label + confidence
- **Training Data:** Nigerian political text corpus; consider multilingual models
- **Model:** Fine-tuned `twitter-xlm-roberta-base` or similar multilingual sentiment model
- **Target Accuracy:** >= 80% F1 macro-average

### 7.3 CIB (Coordinated Inauthentic Behavior) Detector

- **Task:** Regression (0–1 score)
- **Input:** Post metadata + author metadata + network features (posts from same author, similar timestamps, similar content)
- **Output:** CIB score between 0 (organic) and 1 (coordinated)
- **Features:** Posting time clustering, content similarity (Jaccard/TF-IDF), shared URLs/hashtags, account creation patterns
- **Model:** Gradient boosting (XGBoost/LightGBM) or neural network
- **Evaluation:** AUC-ROC >= 0.85

### 7.4 Bot Detector

- **Task:** Binary classification (bot / human)
- **Input:** Account features
- **Features:** Posting frequency (posts/day), engagement ratio (likes+retweets / followers), follower/following ratio, account age in days, bio length, username pattern, content diversity
- **Output:** `isBotSuspect: boolean` + `botProbability: float`
- **Model:** Random Forest or Gradient Boosting classifier
- **Target:** Precision >= 90% (minimize false positives — we do not want to wrongly flag real accounts)

### 7.5 Fake News Detector

- **Task:** Binary classification
- **Input:** OSINT post text + optional URL for fact-check
- **Output:** `isFakeNews: boolean` + `confidence: float` + optional fact-check API result
- **Model:** Fine-tuned transformer with claim verification head
- **Enhancement:** Integrate with fact-check APIs (e.g., Google Fact Check Tools API, Africa Check) for additional verification

### 7.6 Deepfake Detector

- **Task:** Binary classification on images/videos
- **Input:** Uploaded image or video file
- **Output:** `isDeepfake: boolean` + `confidence: float` + manipulation region bounding boxes
- **Model:** Pre-trained models from FaceForensics++ or DeepFakeDetection datasets
- **Current Status:** **Simulated** — returns random scores. Production implementation requires GPU infrastructure.

### 7.7 Steganography Analysis

- **Task:** Image forensics (NOT ML-based for core ELA)
- **Components:**
  - **ELA (Error Level Analysis):** Re-save image at known quality, compute difference. High-ELA regions indicate manipulation or hidden data. **This is the real, production component.**
  - **Noise Analysis:** Compute noise variance across image regions. Inconsistent noise patterns suggest tampering.
  - **Metadata Comparison:** Compare EXIF/IPTC metadata against image content for inconsistencies (e.g., GPS location vs. visible landmarks, creation date vs. content).
- **Libraries:** OpenCV for ELA computation, Pillow for metadata extraction, numpy for noise analysis
- **Current Status:** ELA is real; noise analysis and metadata comparison are **simulated**.

### 7.8 Flashpoint Forecaster

- **Task:** Time-series forecasting / multi-output regression
- **Input:** Historical incident/security event data per state, temporal features (election timeline, day-of-week, time-of-day), contextual features (political tension indicators)
- **Output:** Per-state risk scores: `{ violenceScore: float, intimidationScore: float, logisticsScore: float }`
- **Model Label:** `"ensemble_v2"` — ensemble of LSTM + Prophet + gradient boosting
- **Model:** Time-series model (Prophet or LSTM) for trend + ML model for feature-based prediction, combined in an ensemble
- **Training Frequency:** Retrain daily during active election monitoring periods

---

## 8. Testing Requirements

### 8.1 Unit Tests (pytest)

- All service functions, utility modules, and data transformation logic must have unit tests.
- Use `pytest` with `pytest-asyncio` for async test support.
- Mock external dependencies (databases, external APIs, ML models) using `unittest.mock` or `pytest-mock`.
- **Target coverage:** >= 80% line coverage per service.

### 8.2 Integration Tests (FastAPI TestClient)

- Use `httpx.AsyncClient` with FastAPI's `TestClient` to test full request/response cycles.
- Test against a real (test) database or SQLite in-memory database.
- Verify that API contracts match the expected request/response schemas.
- Test authentication middleware — valid tokens, expired tokens, missing tokens.

### 8.3 ML Model Tests

- **Accuracy benchmarks:** Each model must have a benchmark script that runs against a held-out test set and logs precision, recall, F1, and AUC-ROC.
- **Confusion matrices:** Generate and log confusion matrices for classification models.
- **Regression tests:** For trained models, store predictions on a fixed input set and assert that retrained models do not deviate beyond an acceptable threshold (model drift detection).
- **Performance tests:** Measure inference latency per model. Target: < 200ms for text models, < 2s for image models.

### 8.4 Performance / Load Tests (locust)

- Use `locust` to simulate concurrent load on all Python service endpoints.
- Test scenarios:
  - 100 concurrent requests to `/api/ml/classify-incident`
  - 50 concurrent WebSocket connections to `realtime-service`
  - Batch PVT comparison with 1,000 polling units
- **Performance targets:** p95 latency < 500ms for REST endpoints, < 100ms for WebSocket message delivery.

### 8.5 Data Pipeline Tests

- End-to-end tests using sample data that matches the Next.js seed scripts.
- Verify that OSINT ingestion pipeline correctly processes and stores data from each platform.
- Verify that PVT comparison engine correctly identifies anomalies at the >5% delta threshold.
- Verify that Sankey data aggregation matches expected vote flow totals.

---

## 9. Deployment

### Containerization

- Each Python service (`ml-service`, `pipeline-service`, `whatsapp-service`, `realtime-service`) is packaged as a separate **Docker container**.
- Use multi-stage Docker builds to minimize image size:
  - **Builder stage:** Install Python dependencies, build any compiled extensions.
  - **Runtime stage:** Copy installed packages, copy application code, set entrypoint.
- Base image: `python:3.12-slim` for services, `python:3.12` for ML service (includes build tools for TensorFlow/PyTorch if needed).

### Configuration

- All configuration is via **environment variables** (no config files in the container).
- Required variables per service:

```bash
# Common
DATABASE_URL=sqlite:///./omnivote.db  # or postgresql+asyncpg://...
REDIS_URL=redis://redis:6379/0
JWT_SECRET=<shared-with-nextjs>
LOG_LEVEL=INFO
SERVICE_PORT=8001

# ml-service specific
ML_MODEL_DIR=/app/models
ML_BATCH_SIZE=32
ML_DEVICE=cpu  # or cuda

# whatsapp-service specific
WABA_API_URL=https://graph.facebook.com/v18.0
WABA_PHONE_NUMBER_ID=<id>
WABA_ACCESS_TOKEN=<token>
WABA_RATE_LIMIT_PER_MINUTE=1000
WABA_VERIFY_TOKEN=<token>

# realtime-service specific
WS_HEARTBEAT_INTERVAL=30
DEAD_MANS_SWITCH_DEFAULT_MINUTES=120
```

### Health Check Endpoints

Every service must expose:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Returns `{ status: "ok", service: "<name>", version: "<semver>", uptime: seconds }`. Include database connectivity check and Redis connectivity check. |
| `GET /ready` | Readiness probe — returns 200 only if all dependencies (DB, Redis, ML models loaded) are available. |

### Structured Logging

- Use `structlog` for all logging output.
- Log format: JSON with fields: `timestamp`, `level`, `service`, `request_id`, `message`, and any additional context.
- All HTTP requests should be logged with method, path, status code, and duration.
- ML inference calls should log model version, input hash (not raw input for PII), and latency.

### Graceful Shutdown

- Handle `SIGTERM` and `SIGINT` signals.
- On shutdown: stop accepting new requests, finish in-flight requests (with timeout), close database connections, flush logs, then exit.
- For `realtime-service`: close all WebSocket connections with a close frame before shutting down.
- For Celery workers: finish the current task, then stop.

---

## 10. Integration Points with Next.js

### Migration Strategy

The Next.js codebase currently contains **simulated AI calls** in its API routes. The migration path is:

1. **Build the Python service** with the real implementation.
2. **Modify the Next.js API route** to call the Python service via HTTP instead of using the simulated function.
3. **Keep the same Next.js API contract** — the frontend should not need any changes.
4. **Add fallback logic** — if the Python service is unreachable, fall back to the simulated behavior (with a warning log) during the transition period.

### Specific Integration Map

| Next.js Route | Current Behavior | Python Service Replacement |
|--------------|-----------------|---------------------------|
| `POST /api/incidents` | Simulated classification + summarization | `ml-service:8001/api/ml/classify-incident` + `/api/ml/summarize` |
| `GET /api/osint` | Simulated sentiment, CIB, bot scores | `ml-service:8001/api/ml/sentiment` + `/api/ml/cib-score` + `/api/ml/bot-detect` |
| `POST /api/evidence` (action: `SCAN_STEGO`) | Simulated stego analysis | `ml-service:8001/api/ml/stego-analysis` |
| `GET /api/flashpoint` | Simulated forecasts | `ml-service:8001/api/ml/flashpoint-forecast` |
| `POST /api/pvt` (action: `RUN_COMPARISON`) | Basic comparison logic | `pipeline-service:8002/api/pipeline/pvt-compare` |
| `GET /api/pvt/sankey` | Computed in Next.js | `pipeline-service:8002/api/pipeline/sankey-data` |
| `GET /api/osint/ingest` | Not implemented | `pipeline-service:8002/api/pipeline/osint-ingest` |
| WebSocket (Situation Room) | 30-second polling | `realtime-service:8004/ws` (native WebSocket) |
| WhatsApp sends | Delegates to Go bridge :9090 | `whatsapp-service:8003/api/whatsapp/send` (optional replacement) |

### Recommended Proxy Implementation in Next.js

```typescript
// Example: Next.js API route proxying to Python ML service
async function classifyIncident(description: string) {
  const response = await fetch(`${process.env.ML_SERVICE_URL}/api/ml/classify-incident`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    // Fallback to simulated behavior during transition
    console.warn('[ML Service unavailable, using fallback]');
    return getSimulatedClassification(description);
  }

  return response.json();
}
```

### Service Discovery

During development, services are configured via `.env` files:

```env
ML_SERVICE_URL=http://localhost:8001
PIPELINE_SERVICE_URL=http://localhost:8002
WHATSAPP_SERVICE_URL=http://localhost:8003
REALTIME_SERVICE_URL=ws://localhost:8004
```

In production (Docker Compose / Kubernetes), use internal DNS names:

```env
ML_SERVICE_URL=http://ml-service:8001
PIPELINE_SERVICE_URL=http://pipeline-service:8002
WHATSAPP_SERVICE_URL=http://whatsapp-service:8003
REALTIME_SERVICE_URL=ws://realtime-service:8004
```

---

## Appendix A: Service Startup Checklist

For each Python service, ensure the following before it enters the ready state:

- [ ] Environment variables loaded and validated (fail fast on missing required vars)
- [ ] Database connection pool initialized and connectivity verified
- [ ] Redis connection established
- [ ] ML models loaded into memory (for `ml-service`)
- [ ] Celery workers registered (for background task services)
- [ ] WebSocket server listening (for `realtime-service`)
- [ ] Health check endpoint responding with `200 OK`
- [ ] OpenAPI docs accessible at `/docs`

## Appendix B: File Structure Suggestion

```
services/
├── ml-service/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan events
│   │   ├── config.py            # Settings via pydantic-settings
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API route modules
│   │   ├── services/            # Business logic
│   │   ├── ml/
│   │   │   ├── incident_classifier.py
│   │   │   ├── sentiment_analyzer.py
│   │   │   ├── cib_detector.py
│   │   │   ├── bot_detector.py
│   │   │   ├── fake_news_detector.py
│   │   │   ├── deepfake_detector.py
│   │   │   ├── stego_analyzer.py
│   │   │   ├── flashpoint_forecaster.py
│   │   │   └── summarizer.py
│   │   ├── tasks/               # Celery tasks
│   │   └── tests/
│   ├── models/                  # Saved ML model weights
│   └── tests/
├── pipeline-service/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── services/
│   │   │   ├── pvt_comparison.py
│   │   │   ├── sankey_aggregation.py
│   │   │   ├── osint_ingestion/
│   │   │   ├── suppression_analysis.py
│   │   │   └── geospatial.py
│   │   └── tests/
├── whatsapp-service/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── services/
│   │   │   ├── message_sender.py
│   │   │   ├── template_engine.py
│   │   │   ├── rate_limiter.py
│   │   │   └── media_processor.py
│   │   ├── templates/           # 128 message templates
│   │   └── tests/
├── realtime-service/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── websocket/
│   │   │   ├── connection_manager.py
│   │   │   ├── rooms.py
│   │   │   └── auth.py
│   │   ├── services/
│   │   │   ├── alert_broadcaster.py
│   │   │   ├── dead_mans_switch.py
│   │   │   └── live_feed.py
│   │   └── tests/
└── shared/
    ├── docker-compose.yml
    ├── docker-compose.dev.yml
    └── .env.example
```

---

*This document is a living guide. Update it as the architecture evolves, models are trained, and services are deployed.*