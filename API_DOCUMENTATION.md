# Boson WebApp — Backend API Documentation

**Base URL**: `http://botcontrol.bosonmotors.com:3001/api`  
**Server**: Node.js / Express  
**Auth**: JWT (Bearer token or `token` cookie)

> **Access Levels**
> - `Public` — No authentication required
> - `Private` — Valid JWT required (any role)
> - `Admin Only` — Valid JWT required **and** role must be `admin`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Vehicle Data](#2-vehicle-data)
3. [Live GPS Tracking](#3-live-gps-tracking)
4. [MQTT Live Control](#4-mqtt-live-control)
5. [Mission Scheduling](#5-mission-scheduling)
6. [WorkDrive File Management](#6-workdrive-file-management)
7. [Support Tickets](#7-support-tickets)
8. [Logs & Monitoring](#8-logs--monitoring)
9. [PDF Manuals](#9-pdf-manuals)
10. [Utilities](#10-utilities)
11. [**Admin Only**](#11-admin-only)
    - [11.1 User Management](#111-user-management)
    - [11.2 Vehicle Access & Device Control](#112-vehicle-access--device-control)
    - [11.3 GPS Tracking](#113-gps-tracking)
    - [11.4 Weather & Environment](#114-weather--environment)
    - [11.5 CPU Usage Monitoring](#115-cpu-usage-monitoring)
    - [11.6 Chatbot](#116-chatbot)
    - [11.7 Log Data APIs](#117-log-data-apis)
    - [11.8 Secrets Management](#118-secrets-management)
12. [Authentication Reference](#12-authentication-reference)
13. [Error Handling](#13-error-handling)

---

## 1. Authentication

All authentication endpoints are prefixed with `/api/auth/`.  
**Public endpoints** (no JWT required): `/login`, `/register`, `/usermanualauth`, `/resetpassword`, `/zoho`, `/oauth-data`, `/forgotpassword/*`

---

### POST `/api/auth/register`

`Public` — Register a new user account. Validates hCaptcha token before creating the account.

**Request Body**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "organizationName": "Acme Corp",
  "password": "securePassword123",
  "token": "<hcaptcha_token>"
}
```

**Response — 200 OK**
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

**Response — 400 Bad Request**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

### POST `/api/auth/login`

`Public` — Authenticate with email and password. Returns a JWT and the list of vehicles assigned to the user.

**Request Body**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response — 200 OK**
```json
{
  "token": "<jwt_token>",
  "vehicleDetails": [
    {
      "VehicleId": "VH-001",
      "VehicleName": "Mower Alpha",
      "isAutonomous": true
    }
  ],
  "containsBothVehicleType": false
}
```

Use the returned `token` as a Bearer token in subsequent requests:
```
Authorization: Bearer <jwt_token>
```

---

### POST `/api/auth/usermanualauth`

`Public` — Register/authenticate a user without OAuth (manual onboarding flow).

**Request Body**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "country": "USA"
}
```

**Response — 200 OK**
```json
{
  "message": "User authenticated successfully"
}
```

---

### POST `/api/auth/forgotpassword/:email`

`Public` — Send a password reset email to the specified address.

**URL Params**
- `email` — User's email address

**Response — 200 OK**
```json
{
  "message": "Password reset link sent"
}
```

---

### POST `/api/auth/resetpassword`

`Public` — Reset a user's password using the token from the reset email.

**Request Body**
```json
{
  "token": "<reset_token_from_email>",
  "password": "newSecurePassword456"
}
```

**Response — 200 OK**
```json
{
  "message": "Password reset successfully"
}
```

---

### GET `/api/auth/getUser/:email`

`Private` — Get a single user's profile by email.

**URL Params**
- `email` — User's email address

**Response — 200 OK**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "organizationName": "Acme Corp",
  "role": "admin"
}
```

---

### GET `/api/auth/user/vehiclelist`

`Private` — Get vehicles assigned to the currently authenticated user (derived from JWT).

**Response — 200 OK**
```json
{
  "vehicleDetails": [
    { "VehicleId": "VH-001", "VehicleName": "Mower Alpha", "isAutonomous": true }
  ],
  "containsBothVehicleType": false
}
```

---

### GET `/api/auth/zoho`

`Public` — Redirect to Zoho OAuth consent screen. Used to initiate the OAuth login flow.

Redirects the browser to the Zoho authorization URL.

---

### GET `/api/auth/oauth-data`

`Public` — Retrieve the result of a completed Zoho OAuth session.

**Query Params**
- `auth_token` — The session identifier returned after Zoho redirect

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "token": "<jwt_token>",
    "vehicleDetails": [...],
    "containsBothVehicleType": false
  }
}
```

---

### GET `/api/auth/zohoaccount`

`Private` — Retrieve Zoho account details (used for mail/WorkDrive operations).

**Response** — Raw Zoho API response

---

### POST `/api/auth/sendMail`

`Private` — Send a test email via the Zoho mail integration.

**Response — 200 OK**
```json
{
  "message": "Email sent successfully"
}
```

---

## 2. Vehicle Data

---

### GET `/api/vehiclestatsmqtt/:VehicleID/:isAutonomous`

`Private` — Get real-time vehicle stats from the MQTT data store.

**URL Params**
- `VehicleID` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response — 200 OK**
```json
{
  "data": {
    "AutonomousHours": 12.5,
    "batterySOC": 85.3,
    "DistanceTravelled": 45.2,
    "NonAutonomousHours": 3.1,
    "OnlineStatus": "Online",
    "VehicleName": "Mower Alpha",
    "PlugState": "Unplugged",
    "VehicleMode": "Autonomous",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "LastOnlineTime": "2026-04-02T10:30:00Z",
    "VersionInfo": "v2.3.1"
  }
}
```

---

### GET `/api/day/vehicledata/:VehicleID/:isAutonomous`

`Private` — Get aggregated vehicle statistics for the current day.

**URL Params**
- `VehicleID` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response** — Daily aggregated stats from InfluxDB

---

### GET `/api/status/:VehicleID`

`Private` — Get current online/offline status of a vehicle.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response — 200 OK**
```json
{
  "Online Status": "Online",
  "Last Online Time": "2026-04-02T10:30:00Z"
}
```

---

### GET `/api/vehiclebasicInfo/:VehicleId/:isAutonomous`

`Private` — Get basic identification information for a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response** — Vehicle name, ID, and type information from InfluxDB

---

### GET `/api/vehicleCharging/:VehicleID/:isAutonomous`

`Private` — Get charging status and battery information.

**URL Params**
- `VehicleID` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response** — Charging state, plug status, and SOC data

---

### GET `/api/vehiclelocation/:VehicleID`

`Private` — Get the current GPS location of a vehicle.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response — 200 OK**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

---

### GET `/api/vehiclehmistatus/:VehicleID/:isAutonomous`

`Private` — Get the current HMI (Human-Machine Interface) status.

**URL Params**
- `VehicleID` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response** — HMI state flags and diagnostics

---

### GET `/api/vehicleSpecs/:isAutonomous`

`Private` — Get vehicle specification templates for a vehicle type.

**URL Params**
- `isAutonomous` — `"true"` or `"false"`

**Response** — Specification definitions for the vehicle type

---

### GET `/api/uservehiclelist/:email`

`Private` — Get all vehicles assigned to a user.

**URL Params**
- `email` — User's email address

**Response — 200 OK**
```json
{
  "vehicleDetails": [
    { "VehicleId": "VH-001", "VehicleName": "Mower Alpha", "isAutonomous": true }
  ],
  "containsBothVehicleType": false
}
```

---

### PUT `/api/updateNickName`

`Private` — Update the display nickname of a vehicle.

**Request Body**
```json
{
  "VehicleId": "VH-001",
  "nickName": "Front Yard Mower"
}
```

**Response — 200 OK**
```json
{
  "message": "Nickname updated successfully"
}
```

---

### GET `/api/subscribeUser`

`Private` — Subscribe a user to push notifications for a vehicle.

**Query Params**
- `email` — User's email
- `vehicleId` — Target vehicle ID

**Response — 200 OK**
```json
{
  "subscribed": true
}
```

---

### GET `/api/unsubscribeUser`

`Private` — Unsubscribe a user from vehicle push notifications.

**Query Params**
- `email` — User's email
- `vehicleId` — Target vehicle ID

**Response — 200 OK**
```json
{
  "unsubscribed": true
}
```

---

### GET `/api/getUserSubscriptionInfo`

`Private` — Get all notification subscriptions for a user.

**Query Params**
- `email` — User's email

**Response — 200 OK**
```json
{
  "subscriptions": ["VH-001", "VH-003"]
}
```

---

### POST `/api/vehicleunitId/:VehicleId`

`Private` — Retrieve the Unit ID mapped to a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
{
  "unitId": "UNIT-007"
}
```

---

## 3. Live GPS Tracking

---

### GET `/api/pastcoords/:VehicleID/:timeRange/:groupbyTime/:isAutonomous`

`Private` — Get historical GPS coordinates for a vehicle over a specified time range.

**URL Params**
- `VehicleID` — Vehicle identifier
- `timeRange` — Duration string, e.g., `1h`, `6h`, `1d`, `7d`
- `groupbyTime` — Aggregation window, e.g., `1m`, `5m`, `1h`
- `isAutonomous` — `"true"` or `"false"`

**Response — 200 OK** — GeoJSON FeatureCollection
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "timestamp": "2026-04-01T08:00:00Z"
      }
    }
  ]
}
```

**Example**
```
GET /api/pastcoords/VH-001/1d/5m/true
```
Returns the last 24 hours of GPS data grouped into 5-minute intervals.

---

## 4. MQTT Live Control

These endpoints interact with the vehicle in real time via MQTT.

---

### GET `/api/golive/:VehicleId/:isAutonomous`

`Private` — Start a live data stream from the vehicle. Subscribes server-side MQTT topics for the given vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier
- `isAutonomous` — `"true"` or `"false"`

**Response** — WebSocket/SSE stream initiated; real-time data begins flowing.

---

### POST `/api/stoplive/:VehicleId`

`Private` — Stop the live data stream for a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
{
  "message": "Live stream stopped"
}
```

---

### GET `/api/getmissionFiles/:VehicleId`

`Private` — Request the list of mission files stored on the vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
{
  "topic": "/current_patrol_file/mqtt/VH-001",
  "data": ["mission_01.json", "mission_02.json"]
}
```

---

### POST `/api/getsinglemissionfile/:VehicleId/:timestamp`

`Private` — Retrieve the contents of a specific mission file by its timestamp identifier.

**URL Params**
- `VehicleId` — Vehicle identifier
- `timestamp` — Mission file timestamp key

**Response** — Mission file content (JSON path/waypoint data)

---

### POST `/api/pauseandPlay/:VehicleId/:pause`

`Private` — Pause or resume vehicle motion during an active mission.

**URL Params**
- `VehicleId` — Vehicle identifier
- `pause` — `"true"` to pause, `"false"` to resume

**Response — 200 OK**
```json
{
  "message": "Vehicle paused"
}
```

---

### POST `/api/reqImageSegData/:VehicleId`

`Private` — Request image segmentation data from the vehicle's camera.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body**
```json
{
  "isImageseg": true
}
```

**Response — 200 OK**
```json
{
  "message": "Image segmentation data requested"
}
```

---

### GET `/api/fetchHMIParam/:VehicleId`

`Private` — Fetch current HMI parameter values from the vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response** — Key-value map of HMI parameters

---

### POST `/api/updateHMIParam/:VehicleId`

`Private` — Update one or more HMI parameters on the vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body** — Arbitrary key-value pairs matching HMI parameter names:
```json
{
  "maxSpeed": 2.5,
  "cuttingHeight": 50,
  "bladeEnabled": true
}
```

**Response — 200 OK**
```json
{
  "success": true
}
```

---

### POST `/api/operateBringup/:VehicleId/`

`Private` — Trigger a bringup or shutdown sequence on the vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body**
```json
{
  "operation": "start"
}
```
Operations: `"start"`, `"stop"`, `"restart"`

**Response — 200 OK**
```json
{
  "message": "Bringup operation initiated"
}
```

---

### POST `/api/scheduleMission/:VehicleId`

`Private` — Send a mission schedule directly to the vehicle via MQTT.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body**
```json
{
  "missionData": { ... }
}
```

**Response — 200 OK**
```json
{
  "success": true,
  "missionId": "msn-1234"
}
```

---

### POST `/api/obstaclebypass/:VehicleId`

`Private` — Override the obstacle detection stop behavior.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body**
```json
{
  "bypass": true
}
```

**Response — 200 OK**
```json
{
  "message": "Obstacle bypass enabled"
}
```

---

### POST `/api/startsavePath/:VehicleId/:filename`

`Private` — Start recording the vehicle's current path to a named file.

**URL Params**
- `VehicleId` — Vehicle identifier
- `filename` — Name for the recorded path file (without extension)

**Response — 200 OK**
```json
{
  "message": "Path recording started"
}
```

---

### POST `/api/stopsavePath/:VehicleId`

`Private` — Stop recording the current path.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
{
  "message": "Path recording stopped"
}
```

---

### POST `/api/startPatrol/:VehicleId/:filename`

`Private` — Start a patrol mission from a saved path file.

**URL Params**
- `VehicleId` — Vehicle identifier
- `filename` — Name of the path file to patrol

**Response — 200 OK**
```json
{
  "message": "Patrol started"
}
```

---

### POST `/api/stopPatrol/:VehicleId`

`Private` — Stop the currently running patrol mission.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
{
  "message": "Patrol stopped"
}
```

---

### POST `/api/subscribeAlertVehicles`

`Private` — Subscribe the server to obstacle alert notifications for a vehicle (triggers FCM push notifications).

**Request Body**
```json
{
  "vehicleId": "VH-001",
  "topicName": "notifications_fcm_VH-001"
}
```

**Response — 200 OK**
```json
{
  "subscribed": true
}
```

---

## 5. Mission Scheduling

---

### POST `/api/saveScheduleMission/:VehicleId`

`Private` — Save a scheduled mission definition to the database.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request Body**
```json
{
  "missionName": "Morning Patrol",
  "schedule": "0 8 * * *",
  "missionData": {
    "waypoints": [...],
    "speed": 1.5
  }
}
```
`schedule` uses cron format (e.g., `"0 8 * * *"` = every day at 8:00 AM).

**Response — 200 OK**
```json
{
  "success": true,
  "missionFile": "morning_patrol_1711958400.json"
}
```

---

### GET `/api/getScheduleMission/:VehicleId`

`Private` — List all scheduled missions for a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response — 200 OK**
```json
[
  {
    "missionName": "Morning Patrol",
    "schedule": "0 8 * * *",
    "lastRun": "2026-04-01T08:00:00Z"
  }
]
```

---

### GET `/api/getScheduledMission/:VehicleId/:missionFile`

`Private` — Get the full details of a specific scheduled mission.

**URL Params**
- `VehicleId` — Vehicle identifier
- `missionFile` — Mission file name (as returned by `saveScheduleMission`)

**Response** — Full mission JSON including waypoints and parameters

---

### DELETE `/api/deleteScheduleMission/:VehicleId/:missionFile/:scheduleTime*`

`Private` — Delete a scheduled mission.

**URL Params**
- `VehicleId` — Vehicle identifier
- `missionFile` — Mission file name
- `scheduleTime` — Schedule cron string (URL-encoded)

**Response — 200 OK**
```json
{
  "success": true
}
```

---

### POST `/api/generateMowerPath`

`Private` — Generate an optimized mowing path for a polygon area using the Dubins curve algorithm.

**Request Body**
```json
{
  "polygonCoords": [
    [37.7749, -122.4194],
    [37.7750, -122.4190],
    [37.7748, -122.4188],
    [37.7749, -122.4194]
  ],
  "referenceLineCoords": [
    [37.7749, -122.4194],
    [37.7750, -122.4190]
  ],
  "offsetDistance": 0.5,
  "spacing": 1.0,
  "turningRadius": 0.8
}
```

| Field | Type | Description |
|-------|------|-------------|
| `polygonCoords` | `[lat, lng][]` | Boundary polygon of the area to mow |
| `referenceLineCoords` | `[lat, lng][]` | Reference line for pass direction |
| `offsetDistance` | `number` | Offset from boundary edge in meters |
| `spacing` | `number` | Row spacing between passes in meters |
| `turningRadius` | `number` | Vehicle minimum turning radius in meters |

**Response — 200 OK** — GeoJSON FeatureCollection with the optimized path
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [...]
      }
    }
  ]
}
```

---

## 6. WorkDrive File Management

Manages files stored in Zoho WorkDrive. All endpoints require a valid JWT.

---

### GET `/api/teamfolders/:folderId/subfolders`

`Private` — List all subfolders within a WorkDrive folder.

**URL Params**
- `folderId` — WorkDrive folder ID

**Response — 200 OK**
```json
[
  { "id": "folder123", "label": "VH-001 Files" },
  { "id": "folder124", "label": "VH-002 Files" }
]
```

---

### POST `/api/createFolder/:folderId`

`Private` — Create a vehicle-specific subfolder inside a WorkDrive folder.

**URL Params**
- `folderId` — Parent folder ID

**Request Body**
```json
{
  "VehicleName": "Mower Alpha"
}
```

**Response — 200 OK**
```json
{
  "message": "Folder created successfully"
}
```

---

### GET `/api/vehiclelist/:folderId`

`Private` — Get a list of vehicles derived from folder names within a WorkDrive folder.

**URL Params**
- `folderId` — WorkDrive folder ID

**Response — 200 OK**
```json
[
  { "vehicleId": "VH-001", "name": "Mower Alpha" }
]
```

---

### GET `/api/teamfolders50/:folderId/files`

`Private` — Get the first 50 files in a WorkDrive folder.

**URL Params**
- `folderId` — WorkDrive folder ID

**Response — 200 OK**
```json
[
  { "id": "file123", "name": "mission_plan.json", "type": "json" }
]
```

---

### GET `/api/teamfolders/:folderId/files`

`Private` — Get all files in a WorkDrive folder (no pagination limit).

**URL Params**
- `folderId` — WorkDrive folder ID

**Response — 200 OK**
```json
[
  { "id": "file123", "name": "mission_plan.json", "type": "json", "size": 2048 }
]
```

---

### PATCH `/api/renamefile/:fileId/:VehicleId`

`Private` — Rename a file in WorkDrive.

**URL Params**
- `fileId` — WorkDrive file ID
- `VehicleId` — Vehicle the file belongs to

**Request Body**
```json
{
  "newName": "updated_mission_plan.json"
}
```

**Response — 200 OK**
```json
{
  "success": true
}
```

---

### GET `/api/download/:fileId`

`Private` — Download a file from WorkDrive. Returns the file as a binary stream.

**URL Params**
- `fileId` — WorkDrive file ID

**Response** — Binary file stream with `Content-Disposition: attachment` header

---

### GET `/api/filecontents/:fileId`

`Private` — View or preview the contents of a WorkDrive file.

**URL Params**
- `fileId` — WorkDrive file ID

**Response** — File data or preview content

---

### PATCH `/api/delete/:fileId/:VehicleId`

`Private` — Delete (trash) a file in WorkDrive.

**URL Params**
- `fileId` — WorkDrive file ID
- `VehicleId` — Vehicle the file belongs to

**Response — 200 OK**
```json
{
  "success": true
}
```

---

### POST `/api/file/upload/:VehicleId`

`Private` — Upload a file to WorkDrive for a specific vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request** — `multipart/form-data`
- `file` — The file to upload

**Response — 200 OK**
```json
{
  "fileId": "file456",
  "name": "new_mission.json"
}
```

---

### POST `/api/file/remoteiotupload/:VehicleId`

`Private` — Upload a file directly to the RemoteIOT service for a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request** — `multipart/form-data`
- `file` — The file to upload

**Response — 200 OK**
```json
{
  "fileId": "riot-789",
  "name": "new_mission.json"
}
```

---

### POST `/api/file/uploadcombined/:VehicleId`

`Private` — Upload a file to both WorkDrive and RemoteIOT simultaneously.

**URL Params**
- `VehicleId` — Vehicle identifier

**Request** — `multipart/form-data`
- `file` — The file to upload

**Response — 200 OK**
```json
{
  "fileId": "file456",
  "workdriveId": "wd-456",
  "remoteiotId": "riot-789"
}
```

---

## 7. Support Tickets

Integrates with Zoho Desk for support ticket management.

---

### POST `/api/tickets`

`Private` — Create a new support ticket.

**Request Body**
```json
{
  "email": "john@example.com",
  "issue": "Vehicle not connecting",
  "desc": "The vehicle VH-001 has been offline since yesterday afternoon.",
  "priority": "High",
  "drivetype": "Autonomous",
  "vehicleName": "Mower Alpha",
  "vehicleId": "VH-001",
  "vehicletype": "Mower"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Reporter's email |
| `issue` | string | Short issue title |
| `desc` | string | Detailed description |
| `priority` | string | `Low`, `Medium`, `High`, `Urgent` |
| `drivetype` | string | `Autonomous` or `Manual` |
| `vehicleName` | string | Human-readable vehicle name |
| `vehicleId` | string | Vehicle identifier |
| `vehicletype` | string | Vehicle category (e.g., `Mower`) |

**Response — 200 OK**
```json
{
  "success": true,
  "ticketId": "TKT-10042"
}
```

---

### GET `/api/tickets/email/:email`

`Private` — Get all open/pending tickets for a user.

**URL Params**
- `email` — User's email address

**Response — 200 OK**
```json
[
  {
    "id": "TKT-10042",
    "subject": "Vehicle not connecting",
    "status": "Open",
    "priority": "High",
    "createdAt": "2026-04-01T09:00:00Z"
  }
]
```

---

### GET `/api/tickets/email/history/:email`

`Private` — Get resolved/closed tickets for a user.

**URL Params**
- `email` — User's email address

**Response** — Array of resolved ticket objects (same structure as above)

---

### GET `/api/ticketHistory/:email/:id`

`Private` — Get the modification history (audit trail) for a specific ticket.

**URL Params**
- `email` — User's email
- `id` — Ticket ID

**Response — 200 OK**
```json
[
  {
    "change": "Status changed from Open to In Progress",
    "timestamp": "2026-04-01T11:00:00Z",
    "agent": "support@bosonmotors.com"
  }
]
```

---

### POST `/api/tickets/:id/merge`

`Private` — Merge a related ticket into the current ticket.

**URL Params**
- `id` — Primary ticket ID

**Request Body**
```json
{
  "relatedTicketId": "TKT-10043"
}
```

**Response — 200 OK**
```json
{
  "success": true
}
```

---

## 8. Logs & Monitoring

The HTML viewer pages below do **not** require a JWT. The JSON data endpoints and the validate endpoint are restricted to admins — see [Section 11.7](#117-log-data-apis).

---

### GET `/api/serverlogs`
### GET `/api/errorlogs`
### GET `/api/loginlogs`
### GET `/api/alertlogs`

`Public` — Interactive HTML pages for browsing the corresponding log files. Open directly in a browser.

---

### POST `/api/logs/frontend`

`Private` — Log a client-side event from the frontend application.

**Request Body**
```json
{
  "event": "page_load",
  "userEmail": "john@example.com",
  "page": "/dashboard/VH-001"
}
```

**Response — 200 OK**

---

## 9. PDF Manuals

---

### GET `/api/fetchmanual/:filename`

Fetch/download a vehicle manual PDF from Google Cloud Storage (`boson-pdf-manuals` bucket). Access is restricted to whitelisted emails.

**URL Params**
- `filename` — Name of the PDF file (e.g., `mower_alpha_manual_v2.pdf`)

**Response** — PDF file stream with `Content-Type: application/pdf`

---

## 10. Utilities

---

### POST `/api/localTime/`

`Private` — Convert a UTC timestamp to local time based on the vehicle's GPS coordinates.

**Request Body**
```json
{
  "vehicleId": "VH-001",
  "timestamp": "2026-04-02T10:00:00Z",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

**Response — 200 OK**
```json
{
  "localTime": "2026-04-02T03:00:00-07:00",
  "timezone": "America/Los_Angeles"
}
```

---

## 11. Admin Only

> **All endpoints in this section require `role: admin` in the JWT.**  
> Non-admin requests will receive `403 Forbidden`.

```json
{
  "success": false,
  "error": "Access denied. Admin role required."
}
```

---

### 11.1 User Management

---

#### GET `/api/auth/getUsers`

`Admin Only` — List all registered users in the system.

**Response — 200 OK**
```json
[
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "organizationName": "Acme Corp",
    "role": "admin"
  }
]
```

---

#### POST `/api/auth/user/updaterole`

`Admin Only` — Update the role of an existing user.

**Request Body**
```json
{
  "email": "john@example.com",
  "role": "operator"
}
```

**Roles**: `admin`, `operator`, `user`

**Response — 200 OK**
```json
{
  "message": "Role updated successfully"
}
```

---

#### POST `/api/auth/delete/reg/user`

`Admin Only` — Permanently delete a registered user account.

**Request Body**
```json
{
  "email": "john@example.com"
}
```

**Response — 200 OK**
```json
{
  "message": "User deleted successfully"
}
```

---

#### POST `/api/auth/assignvehicles`

`Admin Only` — Assign one or more vehicles to a user.

**Request Body**
```json
{
  "email": "john@example.com",
  "roleassign": "operator",
  "vehicles": ["VH-001", "VH-002"]
}
```

**Response — 200 OK**
```json
{
  "message": "Vehicles assigned successfully"
}
```

---

#### POST `/api/auth/unassignvehicles`

`Admin Only` — Remove vehicle assignments from a user.

**Request Body**
```json
{
  "email": "john@example.com",
  "vehicles": ["VH-001"]
}
```

**Response — 200 OK**
```json
{
  "message": "Vehicles unassigned successfully"
}
```

---

#### GET `/api/auth/vehicleAssignCheck/:email`

`Admin Only` — Check which vehicles are currently assigned to a user.

**URL Params**
- `email` — User's email address

**Response — 200 OK**
```json
{
  "containsBothVehicleType": true,
  "vehicleDetails": [
    { "VehicleId": "VH-001", "VehicleName": "Mower Alpha", "isAutonomous": true }
  ]
}
```

---

#### GET `/api/auth/open-grafana`

`Admin Only` — Get a Grafana dashboard OAuth link for a specific vehicle.

**Query Params**
- `vehicleId` — Target vehicle ID

**Response — 200 OK**
```json
{
  "oauthUrl": "https://grafana.example.com/login/generic_oauth?...",
  "dashboardPath": "/d/abc123/vehicle-dashboard"
}
```

---

#### GET `/api/auth/latest_zoho_token`

`Admin Only` — Retrieve the latest valid Zoho OAuth access token (used for debugging integrations).

**Response — 200 OK**
```json
{
  "success": true,
  "accessToken": "<zoho_access_token>"
}
```

---

### 11.2 Vehicle Access & Device Control

---

#### GET `/api/allvehicles/status`

`Admin Only` — Get the online/offline status of every vehicle in the system.

**Response — 200 OK**
```json
[
  {
    "VehicleID": "VH-001",
    "VehicleName": "Mower Alpha",
    "status": "Online"
  }
]
```

---

#### POST `/api/connectDevice`

`Admin Only` — Open a bridge connection to a vehicle by its name.

**Request Body**
```json
{
  "vehicleName": "Mower Alpha"
}
```

**Response — 200 OK**
```json
{
  "success": true
}
```

---

#### POST `/api/deleteConnection`

`Admin Only` — Remove an active bridge connection to a vehicle.

**Request Body**
```json
{
  "vehicleId": "VH-001"
}
```

**Response — 200 OK**
```json
{
  "success": true
}
```

---

#### POST `/api/deviceStatus`

`Admin Only` — Check whether a vehicle's bridge connection is currently active.

**Request Body**
```json
{
  "vehicleId": "VH-001"
}
```

**Response — 200 OK**
```json
{
  "connected": true
}
```

---

#### GET `/api/robotAuth/:VehicleId`

`Admin Only` — Retrieve Phantom bridge authentication credentials for a vehicle.

**URL Params**
- `VehicleId` — Vehicle identifier

**Response** — Bridge authentication credentials

---

#### GET `/api/teleop-link`

`Admin Only` — Get the teleoperation session link and bridge connection info.

**Response — 200 OK**
```json
{
  "teleopLink": "https://teleop.example.com/session/abc",
  "bridgeInfo": { ... }
}
```

---

#### POST `/api/mapvinunitID`

`Admin Only` — Map a VIN (Vehicle Identification Number) to a Unit ID.

**Request Body**
```json
{
  "VIN": "1HGCM82633A004352",
  "unitId": "UNIT-007"
}
```

**Response — 200 OK**
```json
{
  "success": true,
  "message": "VIN mapped successfully"
}
```

---

### 11.3 GPS Tracking

---

#### GET `/api/today/:VehicleID`

`Admin Only` — Get today's full GPS path as a GeoJSON LineString.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response — 200 OK**
```json
{
  "type": "LineString",
  "coordinates": [
    [-122.4194, 37.7749],
    [-122.4190, 37.7752]
  ]
}
```

Coordinates are in `[longitude, latitude]` order (GeoJSON standard).

---

### 11.4 Weather & Environment

---

#### GET `/api/weather/last1Hour/:VehicleID`

`Admin Only` — Get weather sensor readings from the last 1 hour.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response — 200 OK**
```json
[
  {
    "temperature": 22.5,
    "humidity": 65.0,
    "windSpeed": 3.2,
    "timestamp": "2026-04-02T10:00:00Z"
  }
]
```

---

#### GET `/api/weather/last1Day/:VehicleID`

`Admin Only` — Get weather sensor readings from the last 24 hours.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response** — Array of weather readings (same structure as above, hourly aggregation)

---

### 11.5 CPU Usage Monitoring

---

#### GET `/api/cpu/last1Hour/:VehicleID`

`Admin Only` — Get CPU usage readings from the last 1 hour.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response — 200 OK**
```json
[
  {
    "CPU": 34.5,
    "timestamp": "2026-04-02T10:00:00Z"
  }
]
```

---

#### GET `/api/cpu/last1Day/:VehicleID`

`Admin Only` — Get CPU usage readings from the last 24 hours.

**URL Params**
- `VehicleID` — Vehicle identifier

**Response** — Array of CPU readings (same structure as above)

---

#### GET `/api/lastknowcpustats/:VehicleID`

`Admin Only` — Get the last 100 CPU usage data points (most recent readings).

**URL Params**
- `VehicleID` — Vehicle identifier

**Response** — Array of up to 100 CPU readings

---

### 11.6 Chatbot

---

#### POST `/api/chatbot`

`Admin Only` — Send a question to the AI chatbot (powered by Abacus.ai). The server automatically manages deployment lifecycle (start, health-check, stop) with up to 100 retry attempts.

**Request Body**
```json
{
  "question": "What is the current battery level of Mower Alpha?"
}
```

**Response — 200 OK**
```json
{
  "response": "Mower Alpha currently has a battery level of 85.3%."
}
```

---

### 11.7 Log Data APIs

These endpoints return raw log data as JSON. Authorization is checked against a whitelist in Google Cloud Storage (`allowed_log_viewers.txt`).

---

#### GET `/api/validate-log-viewer`

`Admin Only` — Validate whether the requesting user is authorized to access log data.

**Response — 200 OK**
```json
{
  "success": true,
  "message": "Access granted"
}
```

**Response — 403 Forbidden**
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

#### GET `/api/serverlogs/data`

`Admin Only` — Fetch server request log entries.

**Response — 200 OK**
```json
[
  {
    "date": "2026-04-02",
    "time": "10:30:00",
    "email": "john@example.com",
    "RequestMethod": "GET",
    "url": "/api/vehiclestatsmqtt/VH-001/true"
  }
]
```

---

#### GET `/api/errorlogs/data`

`Admin Only` — Fetch error log entries.

**Response — 200 OK**
```json
[
  {
    "date": "2026-04-02",
    "time": "10:31:05",
    "email": "john@example.com",
    "errorName": "InfluxDB Timeout",
    "errorMessage": "Query timed out after 5000ms"
  }
]
```

---

#### GET `/api/loginlogs/data`

`Admin Only` — Fetch login event log entries.

**Response — 200 OK**
```json
[
  {
    "date": "2026-04-02",
    "time": "09:15:00",
    "email": "john@example.com",
    "status": "success",
    "message": "Login successful"
  }
]
```

---

#### GET `/api/alertlogs/data`

`Admin Only` — Fetch vehicle alert log entries.

**Response — 200 OK**
```json
[
  {
    "timestamp": "2026-04-02T09:20:00Z",
    "level": "warning",
    "vehicleId": "VH-001",
    "title": "Obstacle Detected",
    "message": "Vehicle stopped due to obstacle on path"
  }
]
```

---

### 11.8 Secrets Management

---

#### GET `/api/all/bosonbotaisecrets`

`Admin Only` — Retrieve all secrets stored in Google Cloud Secret Manager.

**Response — 200 OK**
```json
{
  "MQTT_HOST": "mqtt.bosonmotors.com",
  "INFLUX_URL": "https://influx.internal",
  "ZOHO_CLIENT_ID": "1000.xxxxxxxxxxxx"
}
```

---

#### GET `/api/fetchsecretbyName/:secretName`

`Admin Only` — Retrieve a single secret by name from Google Cloud Secret Manager.

**URL Params**
- `secretName` — The secret name as configured in GCP

**Response — 200 OK**
```json
{
  "MQTT_HOST": "mqtt.bosonmotors.com"
}
```

---

## 12. Authentication Reference

### How to Authenticate

**Step 1** — Obtain a JWT via login:
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "password123" }
```

**Step 2** — Include the token in all subsequent requests:
```http
GET /api/vehiclestatsmqtt/VH-001/true
Authorization: Bearer <jwt_token>
```

Alternatively, send it as a cookie:
```http
Cookie: token=<jwt_token>
```

Or as a query parameter (least preferred):
```http
GET /api/vehiclestatsmqtt/VH-001/true?token=<jwt_token>
```

### Token Priority Order
1. `Authorization: Bearer <token>` header
2. `token` cookie
3. `?token=` query parameter

### JWT Payload Structure
```json
{
  "email": "user@example.com",
  "role": "admin",
  "iat": 1711958400,
  "exp": 1711994400
}
```

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access including all Admin Only endpoints |
| `operator` | Vehicle operations and file management |
| `user` | Read-only vehicle data access |

---

## 13. Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request — check request body/params |
| `401` | Unauthorized — missing or invalid JWT |
| `403` | Forbidden — valid JWT but insufficient role |
| `404` | Resource not found |
| `500` | Internal server error |

### Standard Error Response
```json
{
  "success": false,
  "error": "Descriptive error message",
  "details": { }
}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Missing or expired JWT | Re-authenticate via `/auth/login` |
| `403 Forbidden (role)` | Non-admin accessing Admin Only endpoint | Use an account with `admin` role |
| `403 Forbidden (log viewer)` | Email not in log viewer whitelist | Contact an admin to be added to `allowed_log_viewers.txt` |
| `InfluxDB Timeout` | Database query too slow | Narrow the time range or groupby window |
| `Zoho Token Expired` | Zoho access token needs refresh | Token auto-refreshes every 30 min; retry after a moment |
| `MQTT not connected` | Vehicle is offline | Check vehicle status via `/api/status/:VehicleID` |
