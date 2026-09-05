# Carely — AI Healthcare Appointment & Patient Assistant

Carely is a polished, responsive front-end prototype for a clinic operations workspace. It turns the original product specification into a focused first release: a clinic administrator can review the day, monitor doctors, search appointments, create new bookings, and ask an AI-style assistant about the schedule.

## What is included

- Responsive clinic dashboard with overview metrics, today’s appointments, recent activity, and doctor availability.
- Appointment management view with search, status labels, and a tabular schedule.
- Patients, doctors, analytics, messages, and workspace settings views.
- Appointment creation modal with client-side validation.
- Local persistence via `localStorage`, so newly created appointments survive a refresh.
- Carely AI interaction for simple schedule questions and quick prompts.
- Accessible labels, keyboard-friendly modal dismissal, responsive mobile navigation, and a calm healthcare-oriented visual system.

## Run locally

This is a dependency-free static prototype. From the project directory, run:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

Opening `index.html` directly also works, but a local server is recommended for a production-like preview.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Application markup and page views |
| `styles.css` | Responsive visual system and component styles |
| `app.js` | Navigation, appointment state, modal, search, and assistant interactions |

## Production next steps

The current implementation intentionally keeps data local so the interface can be reviewed without credentials or external services. A production healthcare deployment should move authentication, appointment conflict checking, role-based access, audit logging, notifications, encrypted document storage, and AI/RAG workflows to a reviewed backend. Medical data handling also requires a jurisdiction-specific privacy and security assessment before launch.

Recommended backend boundaries are a REST or typed API for appointments and availability, PostgreSQL for transactional data, object storage for authorized documents, a background worker for reminders, and a retrieval layer restricted to approved clinic knowledge. The AI assistant should remain administrative and informational; it should not diagnose, triage emergencies, or make treatment decisions.
