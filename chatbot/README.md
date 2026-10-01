# SmartRebook AI — offline presentation prototype

An interactive, front-end-only demonstration of proactive airline disruption care. All passengers, flights, policies, outcomes, and KPIs are fictional. The prototype has no backend, API keys, external packages, CDN requests, or real booking connection.

## Run

Double-click `index.html` in this folder. It works from a `file://` URL in a modern desktop browser and on a phone-sized viewport. Keep `index.html`, `styles.css`, `app.js`, and `data.js` together. No build or server is required.

Optional logic check, if Node.js is already available: run `node selfcheck.cjs`. Node is **not** needed to use the prototype.

## Three-minute presentation script

1. **Scenario A — simple case (0:00–0:55).** Leave the selector on “A · Simple delay.” Point out that the assistant sends the notification first. Open it, show the personalized message and recommended flight, then click **Confirm option 1**. Show the confirmed itinerary, S$60 voucher in the mock wallet, and give a star rating.
2. **Scenario B — complex case (0:55–1:55).** Select “B · Missed connection” and open the notification. Explain the 35-minute connection, Business cabin, Gold tier, and child traveller. Show the AI-suggested flights marked pending human confirmation. Switch to **Human agent**; Daniel appears in the priority-sorted queue. Open his case, then click **Approve suggestion 1**. Return to **Passenger view** with Scenario B selected to show the specialist confirmation and voucher.
3. **Scenario C and dashboard (1:55–3:00).** Select “C · Free-text request,” open the notification, and click the example question or type “I need to get there before my meeting tomorrow morning, can I go via Hong Kong instead?” Show the extracted `change_route`, `arrive_before_09:00`, and `via HKG` entities. The matching flight is suggested, then handed to a specialist. Switch to **AI logic / Ops dashboard** to show the seven-step trace, factor weights, matched voucher rule, output statuses, and live KPI changes. Click **Reset demo** to restore the presentation state.

## What the demo simulates

| This prototype | A real Agentforce + OpenAI + reservation-data deployment |
| --- | --- |
| Regex and keyword intent extraction | OpenAI-assisted natural-language understanding with evaluation and guardrails |
| Six fixed options per scenario in `data.js` | Live flight operations, availability, fares, connection protection, and reservation data |
| Deterministic router and weighted priority score | Monitored decision service with business rules, auditing, and policy controls |
| Illustrative voucher lookup table | Versioned compensation policy with eligibility checks and issuance controls |
| Local page state shared by three tabs | Agentforce orchestration, authenticated agent console, persistent case records, passenger messaging, and transaction-safe booking |
| Seeded and locally updated KPI cards | Telemetry and analytics from real interactions and post-service surveys |

## Explainable rules

- `routeCase()` in `app.js` implements the routing rules and six-factor score. Factor maxima are 20 + 25 + 15 + 15 + 10 + 15 = 100.
- A case is simple only with a single segment, no special requirements, and a direct option with seats departing within six hours. A tight connection, special requirement, missing direct option, or route-change request triggers a human review.
- `voucherFor()` performs a plain policy-table lookup. Exactly 4 hours matches the S$60 row. Voucher values are illustrative.
- All flight and passenger records use the fixed demo date of 14 October 2026, so the same actions have the same outcomes every run.

The footer disclaimer also appears in the interface: “Academic prototype, not affiliated with Singapore Airlines. All data is fictional.”
