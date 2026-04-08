# Boson Motors Assistant — Feature Testing Guide

**Prototype Version** | Tested via the web chat UI at the Netlify deployment URL.

> Replace vehicle names like `p15`, `t8`, `black dragon` with vehicles assigned to your account.

---

## What the Assistant Can Do

| # | Feature | Example Trigger |
|---|---------|----------------|
| 1 | Answer questions from the vehicle manual | *"How do I charge the vehicle?"* |
| 2 | List mission / path files on a vehicle | *"List missions for p15"* |
| 3 | Start a patrol mission | *"Start JayGPS3 on p15"* |
| 4 | Stop a patrol | *"Stop patrol on t8"* |
| 5 | Pause / resume an active patrol | *"Pause p15"* |
| 6 | Check vehicle status (battery, GPS, mode, hours) | *"What's the battery on t8?"* |
| 7 | List scheduled (timed/cron) missions | *"Show scheduled missions for p15"* |
| 8 | Create a support ticket | *"Report issue: t8 blade not working"* |

Authentication is handled automatically — users log in once and the token is remembered for 7 days.

---

## Test Scenarios

### 1. Manual Q&A

These questions search the vehicle PDF manual using AI and return page-referenced answers.

| Input | Expected Response |
|-------|------------------|
| `How do I charge the vehicle?` | Charging instructions with page reference badges |
| `What safety precautions should I follow?` | Safety guidelines from the manual |
| `How do I adjust the cutting height?` | Blade/cutting height instructions |
| `What do the indicator lights mean?` | LED status light explanation |
| `How do I start the vehicle manually?` | Manual start procedure (NOT treated as a command) |

---

### 2. List Mission Files

Lists path/mission files stored on the vehicle (or from Workdrive archive if vehicle is offline).

| Input | Expected Response |
|-------|------------------|
| `list missions for p15` | Numbered list of mission names for p15 |
| `show me the mission files on t8` | Numbered list for t8 |
| `what paths are available on black dragon?` | Path list for black dragon |
| `list missions for xyz999` | "Vehicle not found" with list of authorized vehicles |

**Offline vehicle behavior:** If the vehicle is unreachable, the system automatically falls back to Workdrive archive files and shows a note: *"Note: Vehicle is currently offline. These files are from Workdrive archive."*

---

### 3. Start Patrol

Starts a patrol mission on a vehicle. Supports fuzzy path matching and ordinal selection.

| Input | Expected Response |
|-------|------------------|
| `start JayGPS3 on p15` | ✅ Patrol started for JayGPS3 on p15 |
| `start jay gps 3 on p15` | Fuzzy-matches to "JayGPS3" and starts |
| `start the first mission on t8` | Starts the 1st mission in the list |
| `start the third path on black dragon` | Starts the 3rd mission by position |
| `start 2nd on p15` | Starts the 2nd mission |
| `start patrol on p15` | Asks: *"Please specify which path to start"* |
| `start XYZ on t8` | *"Could not find a mission named XYZ. Available: ..."* |

---

### 4. Stop Patrol

Stops the currently running patrol on a vehicle.

| Input | Expected Response |
|-------|------------------|
| `stop patrol on t8` | ✅ Patrol stopped on t8 |
| `stop the mission on p15` | ✅ Patrol stopped on p15 |
| `stop black dragon` | ✅ Patrol stopped on black dragon |

---

### 5. Pause / Resume

Pauses or resumes an active patrol without cancelling it.

| Input | Expected Response |
|-------|------------------|
| `pause the patrol on p15` | ⏸️ Patrol paused on p15 |
| `pause t8` | ⏸️ Patrol paused on t8 |
| `resume patrol on t8` | ▶️ Patrol resumed on t8 |
| `resume p15` | ▶️ Patrol resumed on p15 |

---

### 6. Vehicle Status

Returns a live status card for the vehicle with all available data points.

**Data returned:** Online status, Battery %, Plug state, Vehicle mode, Autonomous hours, Manual hours, Distance travelled, GPS coordinates, Firmware version, Last online time (if offline).

| Input | Expected Response |
|-------|------------------|
| `what is the battery level of t8?` | Status card with Battery: XX% highlighted |
| `is p15 online?` | 🟢 Online or 🔴 Offline with timestamp |
| `where is black dragon?` | Status card with Location: lat, lon |
| `is t8 charging?` | Plug State: Plugged/Unplugged + Battery % |
| `show me the status of p15` | Full status card |
| `how many hours has t8 run?` | Autonomous Hours + Manual Hours |

**Example response:**
```
Status for P15 Vehicle:

- Online Status: 🟢 Online
- Battery: 82%
- Plug State: Unplugged
- Mode: Autonomous
- Distance Travelled: 12.4 km
- Autonomous Hours: 8.2 hrs
- Manual Hours: 1.0 hrs
- Location: 37.77490, -122.41940
- Firmware: v2.3.1
```

---

### 7. Scheduled Missions

Lists missions that are pre-scheduled to run on a cron/time basis (different from live mission files).

| Input | Expected Response |
|-------|------------------|
| `show scheduled missions for p15` | Numbered list with mission name and schedule (e.g. `0 8 * * *` = daily at 8am) |
| `what are the timed missions for t8?` | Scheduled mission list for t8 |
| `list scheduled missions on black dragon` | Scheduled missions for black dragon |

If no scheduled missions exist: *"No scheduled missions found for p15."*

---

### 8. Support Tickets

Creates a Zoho Desk support ticket under the logged-in user's email. Ticket is visible to the Boson support team.

| Input | Expected Response |
|-------|------------------|
| `create a ticket for p15, it is not connecting` | 🎫 Ticket created. Issue: Vehicle not connecting. Priority: High |
| `report issue: t8 blade is making noise` | 🎫 Ticket created. Priority: Medium |
| `urgent: black dragon is stuck and not responding` | 🎫 Ticket created. Priority: High/Urgent |
| `log a low priority issue for p15 — battery draining fast` | 🎫 Ticket created. Priority: Low |

---

## Notes for Testers

1. **Authentication:** Log in with your Boson Motors credentials. Token is stored for 7 days if "Remember" is checked.

2. **Voice input:** Click the 🎤 button and speak. The system automatically corrects "petrol" → "patrol" (common speech recognition error).

3. **Offline vehicles:** Start/pause/resume/stop commands will return a friendly offline message if the vehicle is unreachable. List still works via Workdrive fallback.

4. **Manual vs command routing:** The assistant automatically decides whether a question is a vehicle command or a manual lookup. Questions like *"how do I start the vehicle?"* go to the manual — not the command path.

5. **Fuzzy matching:** You don't have to be exact. "jay gps 3" matches "JayGPS3". "first" selects mission #1. "black dragon" matches the vehicle by nickname.

---

## Capabilities NOT Yet Implemented

The following API endpoints exist but are not yet wired to the assistant:

- **Historical GPS track** — past coordinates over a time range
- **HMI parameters** — read/write vehicle tuning parameters (speed, blade, etc.)
- **Bringup/shutdown** — trigger vehicle startup or shutdown sequence
- **Obstacle bypass** — override obstacle detection stop
- **Path recording** — start/stop recording a new path
- **File upload/download** — upload mission files to WorkDrive or RemoteIOT
- **Rename/delete files** — manage mission files in WorkDrive

These can be added in future iterations as the prototype evolves.
