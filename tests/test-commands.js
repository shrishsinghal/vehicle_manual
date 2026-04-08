/**
 * Boson Motors Assistant — Test Scenarios Reference
 *
 * This file documents all supported chat commands and their expected behavior.
 * Use these inputs in the web chat UI to verify each feature end-to-end.
 *
 * Replace vehicle names (p15, t8, black dragon) with vehicles assigned
 * to your account if different.
 */

module.exports = {

  // ── 1. Manual Q&A ──────────────────────────────────────────────────────────
  manual_qa: [
    {
      input: 'How do I charge the vehicle?',
      expect: 'Answer about charging from the manual, with page reference badges'
    },
    {
      input: 'What safety precautions should I follow?',
      expect: 'Safety guidelines from the manual'
    },
    {
      input: 'How do I adjust the cutting height?',
      expect: 'Blade/cutting height instructions from the manual'
    },
    {
      input: 'What do the indicator lights mean?',
      expect: 'LED / status light explanation from the manual'
    }
  ],

  // ── 2. List Mission Files ───────────────────────────────────────────────────
  list_missions: [
    {
      input: 'list missions for p15',
      expect: 'Numbered list of mission/path names. If vehicle offline, note says files are from Workdrive archive.'
    },
    {
      input: 'show me the mission files on t8',
      expect: 'Numbered list of available mission paths for t8'
    },
    {
      input: 'what paths are available on black dragon?',
      expect: 'Numbered path list for black dragon'
    },
    {
      input: 'list missions for xyz999',
      expect: 'Error: vehicle not found, lists authorized vehicles'
    }
  ],

  // ── 3. Start Patrol ────────────────────────────────────────────────────────
  start_patrol: [
    {
      input: 'start JayGPS3 on p15',
      expect: '✅ Patrol started for JayGPS3 on p15. (or offline message if vehicle is offline)'
    },
    {
      input: 'start the first mission on t8',
      expect: 'Starts the first mission in the list by ordinal'
    },
    {
      input: 'start the third path on black dragon',
      expect: 'Starts the 3rd mission by ordinal'
    },
    {
      input: 'start jay gps 3 on p15',
      expect: 'Fuzzy-matches "jay gps 3" to "JayGPS3" and starts patrol'
    },
    {
      input: 'start patrol on p15',
      expect: 'Asks user to specify which path: "Please specify which path to start"'
    }
  ],

  // ── 4. Stop Patrol ─────────────────────────────────────────────────────────
  stop_patrol: [
    {
      input: 'stop patrol on t8',
      expect: '✅ Patrol stopped on t8. (or offline message)'
    },
    {
      input: 'stop the mission on p15',
      expect: '✅ Patrol stopped on p15.'
    },
    {
      input: 'halt black dragon',
      expect: 'Stop patrol on black dragon (or offline message)'
    }
  ],

  // ── 5. Pause / Resume ──────────────────────────────────────────────────────
  pause_resume: [
    {
      input: 'pause the patrol on p15',
      expect: '⏸️ Patrol paused on p15. (or offline/error message if not running)'
    },
    {
      input: 'resume patrol on t8',
      expect: '▶️ Patrol resumed on t8.'
    },
    {
      input: 'pause t8',
      expect: '⏸️ Patrol paused on t8.'
    }
  ],

  // ── 6. Vehicle Status ──────────────────────────────────────────────────────
  // Covers: battery SOC, online/offline, GPS location, plug state, firmware,
  //         autonomous/manual hours, distance travelled
  vehicle_status: [
    {
      input: 'what is the battery level of t8?',
      expect: 'Status block with Battery %, Online Status, Mode, Distance etc.'
    },
    {
      input: 'is p15 online?',
      expect: 'Status block showing 🟢 Online or 🔴 Offline with last-online time'
    },
    {
      input: 'where is black dragon?',
      expect: 'Status block including Location: lat, lon coordinates'
    },
    {
      input: 'is t8 charging?',
      expect: 'Status block showing Plug State (Plugged/Unplugged) and Battery %'
    },
    {
      input: 'show me the status of p15',
      expect: 'Full status card: battery, online, mode, hours, distance, location, firmware'
    },
    {
      input: 'how many hours has t8 been running autonomously?',
      expect: 'Status block with Autonomous Hours value'
    }
  ],

  // ── 7. Scheduled Missions ──────────────────────────────────────────────────
  // These are pre-scheduled (cron-based) missions — different from live mission files
  scheduled_missions: [
    {
      input: 'show scheduled missions for p15',
      expect: 'Numbered list of scheduled missions with names and cron schedule strings, or "No scheduled missions found"'
    },
    {
      input: 'what are the timed missions for t8?',
      expect: 'Scheduled missions list for t8'
    },
    {
      input: 'list scheduled missions on black dragon',
      expect: 'Scheduled missions for black dragon'
    }
  ],

  // ── 8. Support Tickets ─────────────────────────────────────────────────────
  // Creates a Zoho Desk support ticket under the logged-in user's email
  support_tickets: [
    {
      input: 'create a ticket for p15, it is not connecting',
      expect: '🎫 Support ticket created (#TKT-XXXXX). Issue: Vehicle not connecting. Priority: High.'
    },
    {
      input: 'report issue: t8 blade is making noise',
      expect: '🎫 Support ticket created. Issue: Blade is making noise. Priority: Medium.'
    },
    {
      input: 'urgent: black dragon is stuck and not responding',
      expect: '🎫 Support ticket created with High/Urgent priority for black dragon'
    },
    {
      input: 'log a low priority ticket for p15 — battery draining faster than usual',
      expect: '🎫 Support ticket created with Low priority'
    }
  ],

  // ── 9. Edge Cases ──────────────────────────────────────────────────────────
  edge_cases: [
    {
      input: 'how do I start the vehicle manually?',
      expect: 'Goes to manual Q&A (not command path) — answers from the PDF manual'
    },
    {
      input: 'start the second path on t8',
      expect: 'Ordinal "second" → index 2, starts 2nd mission'
    },
    {
      input: 'status of t8',
      expect: 'Full status card for t8 vehicle'
    },
    {
      input: 'what missions does p15 have',
      expect: 'List of mission files for p15 (same as "list missions")'
    }
  ]

};
