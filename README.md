# Navigation App Backend

Backend API for a **Real-Time Navigation Application**.  
This service handles geocoding, routing, navigation metrics (distance & ETA), and address caching using PostgreSQL.

The backend is designed to be consumed by a **React frontend**.

---

## Features

- Geocode addresses to coordinates (OpenStreetMap / Nominatim)
- Calculate routes between two locations (OSRM)
- Compute distance and ETA based on user speed
- Cache destination addresses in PostgreSQL
- Fast repeat navigation using cached destinations
- Fully testable with Postman

---

## Tech Stack

- **Node.js**
- **Express.js**
- **PostgreSQL**
- **Nominatim (OpenStreetMap)** – geocoding
- **OSRM** – routing
- **GeoJSON** – route geometry



---
## Project Structure

```text
navigation-app-backend/
├─ src/
│  ├─ config/
│  │  └─ env.js
│  ├─ db/
│  │  ├─ pool.js
│  │  └─ addresses.repo.js
│  ├─ middleware/
│  │  └─ rateLimit.js
│  ├─ routes/
│  │  ├─ health.routes.js
│  │  ├─ addresses.routes.js
│  │  ├─ geocode.routes.js
│  │  ├─ route.routes.js
│  │  ├─ nav.routes.js
│  │  └─ navigate.routes.js
│  ├─ utils/
│  │  ├─ geo.utils.js
│  │  └─ http.js
│  └─ index.js
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md            
```

---
## Setup Instructions
### Install Dependencies
```
npm install
```

### Environment Variables

Create a .env file (do not commit it):

```
copy .env.example .env
```

Example .env:
```
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/navigation_app
```
---

## Database Setup (PostgreSQL)

Create a database named navigation_app, then run:
```sql
CREATE TABLE IF NOT EXISTS saved_addresses (
  id SERIAL PRIMARY KEY,
  address_text TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_created_at
  ON saved_addresses (created_at DESC);
```
---

## Running the Server

### Development (with nodemon)
```
npm run dev
```
### Production
```
npm start
```
### Server runs on:

```
http://localhost:4000
```
---
## API Endpoints
### Address History
GET ```/api/addresses```

Returns previously saved destination addresses.

---
### Geocode Address

POST ```/api/geocode```

```
{
  "address": "123 Main St, St. John's, NL"
}
```
- Converts address to coordinates
- Saves result to PostgreSQL
---
### Route Between Two Points
POST ```/api/route```

```
{
  "from": { "lat": 47.5615, "lng": -52.7126 },
  "to":   { "lat": 47.5670, "lng": -52.7070 }
}
```
Returns:
- Distance
- Duration
- GeoJSON route geometry (LineString)
---
### Navigation Metrics (Remaining Distance & ETA)
POST ```/api/nav/metrics```
```
{
  "from": { "lat": 47.5615, "lng": -52.7126 },
  "to":   { "lat": 47.5670, "lng": -52.7070 },
  "speedMps": 4
}
```
Returns:
- Remaining distance (meters & km)
- ETA (seconds & minutes)
---
### Navigate (Geocode + Route + ETA)
POST ```/api/navigate```
```
{
  "address": "123 Main St, St. John's, NL",
  "from": { "lat": 47.5615, "lng": -52.7126 },
  "speedMps": 4
}
```
Returns:
- Destination coordinates (cached or newly geocoded)
- Route geometry
- Live navigation metrics

If the address already exists:

```json
"cached": true
```