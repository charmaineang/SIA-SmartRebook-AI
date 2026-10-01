/* Fixed, fictional demo data. Times and outcomes never depend on the current date. */
window.DEMO_DATA = {
  date: "14 October 2026",
  manualBaselineMinutes: 22,
  passengers: {
    A: {
      id: "A", label: "A · Simple delay", name: "Amelia Tan", initials: "AT",
      tier: "KrisFlyer Silver", cabin: "Economy", route: "SIN → LHR",
      originalFlight: "DX 410", disruption: "Weather delay · 4h",
      delayHours: 4, segments: 1, connectionBuffer: null, special: [],
      urgent: false, notification: "Your flight DX 410 from SIN to LHR is delayed 4 hours due to weather. We can rebook you now. Tap to view options.",
      intro: "Hi Amelia. I’m SmartRebook AI. Your DX 410 flight to London is delayed by 4 hours because of weather. I found available seats and can help you move to an earlier arrival.",
      options: [
        { id: "A1", flight: "DX 418", route: "SIN → LHR", depart: "14 Oct · 23:10", arrive: "15 Oct · 06:20", cabin: "Economy", seats: 4, departWithinHours: 3.2, direct: true, recommended: true, note: "Earliest arrival · no extra charge" },
        { id: "A2", flight: "DX 422", route: "SIN → LHR", depart: "15 Oct · 01:35", arrive: "15 Oct · 08:50", cabin: "Economy", seats: 7, departWithinHours: 5.6, direct: true, note: "More seats available" },
        { id: "A3", flight: "DX 430", route: "SIN → LHR", depart: "15 Oct · 04:40", arrive: "15 Oct · 11:45", cabin: "Economy", seats: 9, departWithinHours: 8.7, direct: true, note: "Later departure" },
        { id: "A4", flight: "DX 432", route: "SIN → LHR", depart: "15 Oct · 06:20", arrive: "15 Oct · 13:30", cabin: "Economy", seats: 3, departWithinHours: 10.3, direct: true },
        { id: "A5", flight: "DX 434", route: "SIN → LHR", depart: "15 Oct · 08:10", arrive: "15 Oct · 15:10", cabin: "Economy", seats: 6, departWithinHours: 12.2, direct: true },
        { id: "A6", flight: "DX 438", route: "SIN → LHR", depart: "15 Oct · 10:15", arrive: "15 Oct · 17:30", cabin: "Economy", seats: 2, departWithinHours: 14.3, direct: true }
      ]
    },
    B: {
      id: "B", label: "B · Missed connection", name: "Daniel Lim", initials: "DL",
      tier: "KrisFlyer Gold", cabin: "Business", route: "SIN → SFO → YVR",
      originalFlight: "DX 520 + DX 731", disruption: "Weather delay · 3h 40m",
      delayHours: 3.67, segments: 2, connectionBuffer: 35, special: ["Child travelling"],
      urgent: true, notification: "Your SIN to SFO flight is delayed 3h 40m. Your onward YVR connection is at risk. We’re finding family-friendly alternatives now.",
      intro: "Hi Daniel. I’m SmartRebook AI. Your delayed flight leaves only 35 minutes for your SFO connection to Vancouver. I can see you’re travelling with a child, so a specialist will check the best family-friendly solution before it is confirmed.",
      options: [
        { id: "B1", flight: "DX 526 + DX 745", route: "SIN → SFO → YVR", depart: "14 Oct · 22:40", arrive: "15 Oct · 15:15", cabin: "Business", seats: 3, departWithinHours: 2.7, direct: false, recommended: true, note: "Protected connection · adjacent seats" },
        { id: "B2", flight: "DX 610 + DX 802", route: "SIN → NRT → YVR", depart: "14 Oct · 23:35", arrive: "15 Oct · 17:05", cabin: "Business", seats: 4, departWithinHours: 3.6, direct: false, note: "Longer connection buffer" },
        { id: "B3", flight: "DX 532 + DX 750", route: "SIN → SFO → YVR", depart: "15 Oct · 01:10", arrive: "15 Oct · 19:20", cabin: "Business", seats: 5, departWithinHours: 5.2, direct: false, note: "More family seats" },
        { id: "B4", flight: "DX 615 + DX 810", route: "SIN → NRT → YVR", depart: "15 Oct · 03:20", arrive: "15 Oct · 21:05", cabin: "Business", seats: 2, departWithinHours: 7.3, direct: false },
        { id: "B5", flight: "DX 540 + DX 760", route: "SIN → SFO → YVR", depart: "15 Oct · 05:00", arrive: "15 Oct · 22:30", cabin: "Business", seats: 3, departWithinHours: 9, direct: false },
        { id: "B6", flight: "DX 620 + DX 815", route: "SIN → NRT → YVR", depart: "15 Oct · 06:45", arrive: "16 Oct · 00:10", cabin: "Business", seats: 4, departWithinHours: 10.8, direct: false }
      ]
    },
    C: {
      id: "C", label: "C · Free-text request", name: "Priya Menon", initials: "PM",
      tier: "KrisFlyer Silver", cabin: "Economy", route: "SIN → LHR",
      originalFlight: "DX 450", disruption: "Weather delay · 3h",
      delayHours: 3, segments: 1, connectionBuffer: null, special: [],
      urgent: false, notification: "Your DX 450 flight to London is delayed 3 hours. Tell us what matters most and we’ll look for alternatives.",
      intro: "Hi Priya. I’m SmartRebook AI. Your flight to London is delayed by 3 hours. Tell me your arrival deadline or preferred route, and I’ll look for a match.",
      example: "I need to get there before my meeting tomorrow morning, can I go via Hong Kong instead?",
      options: [
        { id: "C1", flight: "DX 680 + DX 912", route: "SIN → HKG → LHR", via: "HKG", depart: "14 Oct · 20:50", arrive: "15 Oct · 08:15", arrivalHour: 8.25, cabin: "Economy", seats: 2, departWithinHours: 2.1, direct: false, recommended: true, note: "Via Hong Kong · before 09:00" },
        { id: "C2", flight: "DX 684 + DX 916", route: "SIN → HKG → LHR", via: "HKG", depart: "14 Oct · 22:15", arrive: "15 Oct · 10:40", arrivalHour: 10.67, cabin: "Economy", seats: 6, departWithinHours: 3.5, direct: false, note: "Via Hong Kong · later arrival" },
        { id: "C3", flight: "DX 458", route: "SIN → LHR", via: null, depart: "14 Oct · 23:25", arrive: "15 Oct · 09:35", arrivalHour: 9.58, cabin: "Economy", seats: 4, departWithinHours: 4.7, direct: true, note: "Direct · arrives after 09:00" },
        { id: "C4", flight: "DX 700 + DX 920", route: "SIN → HKG → LHR", via: "HKG", depart: "15 Oct · 00:30", arrive: "15 Oct · 12:20", arrivalHour: 12.33, cabin: "Economy", seats: 5, departWithinHours: 5.8, direct: false },
        { id: "C5", flight: "DX 720 + DX 931", route: "SIN → NRT → LHR", via: "NRT", depart: "14 Oct · 21:55", arrive: "15 Oct · 11:10", arrivalHour: 11.17, cabin: "Economy", seats: 3, departWithinHours: 3.2, direct: false },
        { id: "C6", flight: "DX 462", route: "SIN → LHR", via: null, depart: "15 Oct · 02:15", arrive: "15 Oct · 12:15", arrivalHour: 12.25, cabin: "Economy", seats: 8, departWithinHours: 7.5, direct: true }
      ]
    }
  },
  voucherPolicy: [
    { min: 2, max: 4, label: "2–<4 hours", value: 30, benefit: "Meal voucher" },
    { min: 4, max: 8, label: "4–<8 hours", value: 60, benefit: "Meal voucher" },
    { min: 8, max: Infinity, label: "8+ hours", value: 100, benefit: "Meal voucher + hotel eligibility check" }
  ],
  seededQueue: [
    { id: "Q1", name: "Marcus Lee", initials: "ML", route: "SIN → NRT → SEA", disruption: "Technical delay · 5h", reason: "Tight connection <45min", score: 82, wait: "8 min", summary: "Onward Seattle connection cannot be protected after a technical delay.", suggestions: ["DX 806 + DX 940 · SIN → NRT → SEA · 15 Oct 18:20", "DX 830 + DX 950 · SIN → ICN → SEA · 15 Oct 20:05"] },
    { id: "Q2", name: "Sofia Rahman", initials: "SR", route: "SIN → SYD", disruption: "Weather delay · 6h", reason: "Wheelchair assistance", score: 68, wait: "14 min", summary: "Accessibility support and seat availability require specialist verification.", suggestions: ["DX 270 · SIN → SYD · 15 Oct 07:40", "DX 278 · SIN → SYD · 15 Oct 10:15"] }
  ],
  seededKpis: { simpleCases: 9, simpleAutoResolved: 3, resolutions: 12, totalMinutes: 204, ratings: 10, ratingTotal: 39 }
};
