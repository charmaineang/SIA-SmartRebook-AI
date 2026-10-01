/* All state lives in this page. No network calls, storage, or hidden AI service. */
(function () {
  "use strict";
  const D = window.DEMO_DATA;
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const freshSession = () => ({ started: false, busy: false, status: "alert", messages: [], shown: 2, intent: "disruption_rebook", entities: [], routeChange: false, urgent: false, matching: null, score: null, factors: [], reason: "", selectedOption: null, rating: null, recorded: false, query: "" });
  const newState = () => ({ tab: "passenger", scenario: "A", transitioning: false, sessions: { A: freshSession(), B: freshSession(), C: freshSession() }, queue: D.seededQueue.map(x => ({ ...x, suggestions: [...x.suggestions] })), selectedCase: "Q1", kpis: { ...D.seededKpis }, agentNote: "", overrideOpen: false });
  let state = newState();
  const P = () => D.passengers[state.scenario];
  const S = () => state.sessions[state.scenario];

  function voucherFor(hours) {
    // Policy lookup is deliberately rule-based and independent of the router.
    return D.voucherPolicy.find(row => hours >= row.min && hours < row.max) || null;
  }

  function understand(text) {
    // Small, deterministic NLP stand-in. Keywords and regex expose the extracted intent/entities.
    const q = text.toLowerCase();
    const viaHKG = /(?:via|through)\s+(?:hong\s*kong|hkg)|hong\s*kong|\bhkg\b/.test(q);
    const hourMatch = q.match(/before\s+(?:my\s+meeting\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    let deadline = hourMatch ? Number(hourMatch[1]) + Number(hourMatch[2] || 0) / 60 : null;
    if (hourMatch && hourMatch[3] === "pm" && deadline < 12) deadline += 12;
    if (deadline === null && /tomorrow morning|before my meeting/.test(q)) deadline = 9;
    let intent = "general_help";
    if (/human|agent|person|specialist|representative/.test(q)) intent = "human_handoff";
    else if (/refund|money back/.test(q)) intent = "refund";
    else if (/hotel|accommodation/.test(q)) intent = "hotel";
    else if (/meal|food|voucher/.test(q)) intent = "meal_voucher";
    else if (/baggage|bag|luggage/.test(q)) intent = "baggage";
    else if (viaHKG || /different route|go via|change route/.test(q)) intent = "change_route";
    else if (/rebook|flight|option|earlier|arrive|meeting/.test(q)) intent = "rebook";
    const entities = [];
    if (deadline !== null) entities.push(`arrive_before_${String(Math.floor(deadline)).padStart(2, "0")}:${String(Math.round((deadline % 1) * 60)).padStart(2, "0")}`);
    if (viaHKG) entities.push("via HKG");
    return { intent, entities, deadline, viaHKG };
  }

  function routeCase(passenger, session) {
    // Weighted, explainable priority: maxima total 100. These are illustrative demo weights.
    const f = [
      ["Itinerary complexity", 20, passenger.segments > 1 ? 20 : session.routeChange ? 16 : 0],
      ["Connection tightness", 25, passenger.connectionBuffer == null ? 0 : passenger.connectionBuffer < 45 ? 25 : passenger.connectionBuffer < 60 ? 18 : 0],
      ["Disruption severity", 15, passenger.delayHours >= 8 ? 15 : passenger.delayHours >= 4 ? 10 : passenger.delayHours >= 2 ? 7 : 0],
      ["Time sensitivity", 15, session.urgent || passenger.urgent ? 15 : passenger.delayHours >= 4 ? 5 : 2],
      ["Cabin / loyalty tier", 10, (passenger.cabin === "Business" ? 7 : 0) + (passenger.tier.includes("Gold") ? 3 : passenger.tier.includes("Silver") ? 2 : 0)],
      ["Special requirements", 15, passenger.special.length ? 15 : 0]
    ];
    const score = f.reduce((sum, row) => sum + row[2], 0);
    const eligible = passenger.options.some(o => o.direct && o.seats > 0 && o.departWithinHours <= 6);
    // Simple requires all three conditions. Any listed complexity trigger forces human review.
    const tightConnection = passenger.segments > 1 && passenger.connectionBuffer != null && passenger.connectionBuffer < 60;
    const complex = tightConnection || passenger.special.length > 0 || !eligible || session.routeChange || passenger.segments !== 1;
    const reasons = [];
    if (tightConnection) reasons.push(`Tight connection <60min (${passenger.connectionBuffer}min)`);
    if (passenger.special.length) reasons.push(...passenger.special);
    if (session.routeChange) reasons.push("Passenger route change");
    if (!eligible) reasons.push("No direct alternative within 6h");
    if (passenger.cabin === "Business") reasons.push("Premium cabin");
    return { complexity: complex ? "Complex" : "Simple", score, factors: f, reason: reasons.join(" · ") || "Single segment · seats within 6h" };
  }

  function applyRoute() {
    const s = S(), result = routeCase(P(), s);
    s.score = result.score; s.factors = result.factors; s.reason = result.reason; s.complexity = result.complexity;
    return result;
  }

  function push(role, text, type = "text", extra = {}) { S().messages.push({ role, text, type, ...extra }); }
  async function bot(text, type = "text", extra = {}) {
    const scenario = state.scenario;
    state.sessions[scenario].busy = true;
    render();
    await pause(750);
    state.sessions[scenario].messages.push({ role: "bot", text, type, ...extra });
    state.sessions[scenario].busy = false;
    render();
  }

  async function startChat() {
    const s = S(); if (s.started || s.busy) return;
    state.transitioning = true;
    s.started = true; s.status = "chat";
    applyRoute();
    await bot(P().intro);
    if (state.scenario === "C") {
      await bot("What time do you need to arrive? You can also tell me if you prefer a particular connection.", "example");
    } else {
      await bot(state.scenario === "B" ? "I found three possible journeys. These are AI-suggested and pending human confirmation." : "Here are your best available alternatives. You can confirm one immediately.", "options");
      if (state.scenario === "B") escalate("Connection and child travelling require specialist review.", false);
    }
    state.transitioning = false;
    render();
  }

  function matchingOptions(passenger, parsed) {
    return passenger.options.filter(o => {
      const clock = o.arrive.split(" · ")[1] || "00:00";
      const arrivalHour = o.arrivalHour ?? (Number(clock.slice(0,2)) + Number(clock.slice(3,5))/60);
      return o.seats > 0 && (!parsed.viaHKG || o.via === "HKG") && (parsed.deadline == null || arrivalHour < parsed.deadline);
    });
  }

  async function handleQuery(text) {
    const s = S(); if (!s.started || s.busy || !text.trim()) return;
    const query = text.trim().slice(0, 400);
    push("user", query); s.query = query;
    const parsed = understand(query);
    s.intent = parsed.intent; s.entities = parsed.entities;
    s.routeChange = parsed.intent === "change_route";
    s.urgent = parsed.deadline != null;
    s.matching = matchingOptions(P(), parsed);
    applyRoute();
    if (parsed.intent === "human_handoff") { escalate("Passenger requested a human specialist."); return; }
    if (parsed.intent === "change_route" || parsed.intent === "rebook") {
      if (s.matching.length) {
        const summary = parsed.entities.length ? `I understood: ${parsed.intent} · ${parsed.entities.join(" · ")}. ` : "";
        await bot(`${summary}I found ${s.matching.length} matching option${s.matching.length === 1 ? "" : "s"}. ${s.complexity === "Complex" ? "A specialist must confirm a route change or complex itinerary." : "You can confirm a direct option below."}`, "options", { filtered: true });
      } else {
        await bot(`I understood ${parsed.intent}${parsed.entities.length ? ` with ${parsed.entities.join(" and ")}` : ""}, but no mock flight matches every constraint. I’ll send this to a specialist to review.`);
      }
      if (s.complexity === "Complex" || !s.matching.length) escalate("Route or timing constraints require specialist review.", false);
      return;
    }
    const replies = {
      refund: "I can record your refund request, but a specialist needs to check eligibility and ticket conditions. I’ll pass along this conversation if you choose Talk to a human.",
      hotel: "For delays of 8 hours or more, the illustrative policy includes a hotel eligibility check. I can ask a specialist to review your situation.",
      meal_voucher: `The illustrative policy matches ${voucherFor(P().delayHours)?.label || "no voucher row"}. Your wallet voucher is issued when your rebooking is confirmed.`,
      baggage: "I can include your baggage question in a specialist handoff. Your baggage status is not connected to a live system in this demo.",
      general_help: "I can help with rebooking, refund, hotel, meal vouchers, baggage, or a human specialist. Tell me what you need."
    };
    await bot(replies[parsed.intent]);
  }

  function escalate(reason, addMessage = true) {
    const s = S(), p = P();
    if (s.status === "resolved") return;
    if (s.status !== "escalated") {
      s.status = "escalated";
      const options = (s.matching || p.options).slice(0, 3);
      state.queue.push({ id: p.id, name: p.name, initials: p.initials, route: p.route, disruption: p.disruption, reason: s.reason, score: s.score, wait: "Just now", summary: `${p.name}: ${p.disruption}. ${reason} ${s.query ? `Passenger said: “${s.query}”` : ""}`, suggestions: options.map(o => `${o.flight} · ${o.route} · arrives ${o.arrive}`), optionIds: options.map(o => o.id), scenario: p.id });
      state.selectedCase = p.id;
    }
    if (addMessage) push("bot", "I’ve sent your case and my suggested options to a human specialist. You’ll see their confirmation here.");
    else push("bot", "Your case and my suggested options are now in the specialist queue. No booking change has been made yet.");
    render();
  }

  async function confirmOption(optionId) {
    const s = S(), p = P();
    if (s.busy || s.status === "resolved") return;
    const option = p.options.find(o => o.id === optionId);
    if (!option) return;
    push("user", `Confirm ${option.flight}`);
    applyRoute();
    // Even in an otherwise simple case, an indirect or late option needs review.
    if (s.complexity === "Complex" || !option.direct || option.departWithinHours > 6 || option.seats < 1) {
      await bot("This journey needs specialist confirmation. I’ve attached your selected option to the case.");
      s.selectedOption = option.id;
      escalate("Passenger selected an AI-suggested option.", false);
      return;
    }
    s.selectedOption = option.id;
    await bot(`Confirmed. You’re rebooked on ${option.flight}, departing ${option.depart} and arriving ${option.arrive}. Your updated itinerary is ready in this demo.`, "resolved");
    finishResolution(p.id, 2);
  }

  function finishResolution(scenario, minutes) {
    const s = state.sessions[scenario], p = D.passengers[scenario];
    s.status = "resolved";
    if (!s.recorded) {
      state.kpis.resolutions++; state.kpis.totalMinutes += minutes;
      if (s.complexity === "Simple") { state.kpis.simpleCases++; state.kpis.simpleAutoResolved++; }
      s.recorded = true;
    }
    s.messages.push({ role: "bot", type: "wallet", text: "", voucher: voucherFor(p.delayHours) });
    s.messages.push({ role: "bot", type: "rating", text: "" });
    render();
  }

  function approveCase(index) {
    const item = state.queue.find(c => c.id === state.selectedCase);
    if (!item || !item.suggestions[index]) return;
    if (item.scenario) {
      const s = state.sessions[item.scenario], p = D.passengers[item.scenario];
      s.selectedOption = item.optionIds[index];
      s.messages.push({ role: "bot", type: "resolved", text: `A specialist has confirmed your rebooking. Your new journey is ${item.suggestions[index]}.` });
      finishResolution(item.scenario, 8);
      state.agentNote = `Approved for ${p.name}. Passenger view updated.`;
    } else {
      state.kpis.resolutions++; state.kpis.totalMinutes += 8;
      state.agentNote = `Approved for ${item.name}. This seeded case has been closed.`;
    }
    state.queue = state.queue.filter(c => c.id !== item.id);
    state.selectedCase = state.queue[0]?.id || null;
    state.overrideOpen = false;
    render();
  }

  function render() {
    document.querySelectorAll("[data-tab]").forEach(el => { el.classList.toggle("active", el.dataset.tab === state.tab); el.setAttribute("aria-selected", el.dataset.tab === state.tab ? "true" : "false"); });
    $("#queue-count").textContent = state.queue.length;
    $("#app").innerHTML = state.tab === "passenger" ? renderPassenger() : state.tab === "agent" ? renderAgent() : renderOps();
    const chat = $(".chat-scroll"); if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function renderPassenger() {
    const p = P(), s = S();
    const badge = s.status === "resolved" ? ["Resolved", "green"] : s.status === "escalated" ? ["Specialist reviewing", "amber"] : ["Disruption detected", "amber"];
    return `<div class="section-heading"><div><div class="overline">PASSENGER EXPERIENCE</div><h2>A journey that starts with care</h2><p>The assistant reaches out as soon as disruption is detected.</p></div><label class="select-wrap">DEMO SCENARIO <select id="scenario-select" aria-label="Demo scenario" ${state.transitioning || s.busy ? "disabled" : ""}>${Object.values(D.passengers).map(x => `<option value="${x.id}" ${x.id === state.scenario ? "selected" : ""}>${escapeHTML(x.label)}</option>`).join("")}</select></label></div>
      <div class="passenger-grid"><aside class="side-stack"><div class="surface side-card"><div class="side-label">PASSENGER PROFILE</div><div class="profile-row"><div class="avatar">${p.initials}</div><div><strong>${escapeHTML(p.name)}</strong><span>${escapeHTML(p.tier)}</span></div></div><div class="detail-list"><div class="detail-row"><span>Cabin</span><strong>${p.cabin}</strong></div><div class="detail-row"><span>Itinerary</span><strong>${p.segments} segment${p.segments > 1 ? "s" : ""}</strong></div><div class="detail-row"><span>Requirement</span><strong>${escapeHTML(p.special.join(", ") || "None")}</strong></div></div></div><div class="surface side-card"><div class="side-label">CURRENT JOURNEY</div><div class="route-art">${escapeHTML(p.route).replaceAll("→", '<span class="arrow">→</span>')}</div><div class="detail-row"><span>Flight</span><strong>${escapeHTML(p.originalFlight)}</strong></div><div class="detail-row"><span>Disruption</span><strong>${escapeHTML(p.disruption)}</strong></div><span class="status-pill ${badge[1]}">● ${badge[0]}</span></div></aside>
      <div><div class="phone"><div class="phone-top"><div><strong>SmartRebook AI</strong><small>Disruption care · Online demo</small></div><div class="avatar">✦</div></div><div class="phone-body">${s.started ? renderChat() : renderNotification()}</div></div><p class="side-note">Interactive passenger device · all flight and booking data is fictional</p></div>
      <aside class="side-stack"><div class="surface side-card"><div class="side-label">JOURNEY PROGRESS</div>${[["Alert sent",true],["Options identified",s.started],["Specialist review",s.status === "escalated" || (s.status === "resolved" && s.complexity === "Complex")],["Journey confirmed",s.status === "resolved"]].map(([label,done],i) => `<div class="journey-step ${done ? "done" : i === (s.started ? 2 : 1) ? "current" : ""}"><span class="step-dot">${done ? "✓" : i + 1}</span><span>${label}</span></div>`).join("")}</div><div class="callout">Human support is always available. Complex itineraries are reviewed before a booking is changed.</div></aside></div>`;
  }

  function renderNotification() {
    const p = P();
    return `<div class="notification-screen"><div class="phone-date">WEDNESDAY · 14 OCTOBER 2026</div><button class="push" data-action="open-chat" type="button"><div class="push-head"><span><span class="push-icon">✦</span> SMARTREBOOK AI</span><span>NOW</span></div><strong>Travel update for ${escapeHTML(p.name.split(" ")[0])}</strong><p>${escapeHTML(p.notification)}</p><div class="push-cta">View your options &nbsp; →</div></button><p class="notification-hint">Tap the notification to begin the conversation</p></div><div class="chat-controls"><p class="transparency">I’m an AI assistant. I can resolve simple changes; complex cases are reviewed by a specialist.</p><button class="human-btn" type="button" data-action="open-human">Talk to a human ↗</button></div>`;
  }

  function renderChat() {
    const s = S();
    return `<div class="chat-scroll" aria-label="Passenger chat"><div class="chat-date">TODAY · 14 OCTOBER</div>${s.messages.map(renderMessage).join("")}${s.busy ? '<div class="message bot"><div class="bubble typing" aria-label="Assistant typing"><i></i><i></i><i></i></div></div>' : ""}</div><div class="chat-controls"><p class="transparency">I’m an AI assistant. I can resolve simple changes; complex cases are reviewed by a specialist.</p><form id="chat-form" class="composer"><input id="chat-input" type="text" maxlength="400" autocomplete="off" placeholder="Ask about your journey…" aria-label="Message SmartRebook AI" ${s.busy ? "disabled" : ""}><button class="send" type="submit" aria-label="Send message" ${s.busy ? "disabled" : ""}>➤</button></form><button class="human-btn" type="button" data-action="human">Talk to a human ↗</button></div>`;
  }

  function renderMessage(m) {
    if (m.type === "wallet") return `<div class="message bot"><div class="wallet"><div class="wallet-head"><span>✦ KRISFLYER WALLET</span><span>ADDED ✓</span></div><div class="wallet-amount">S$${m.voucher?.value || 0}</div><p>${escapeHTML(m.voucher?.benefit || "No voucher")} · illustrative ${escapeHTML(m.voucher?.label || "")} rule</p></div></div>`;
    if (m.type === "rating") return `<div class="rating-card"><strong>How was this experience?</strong><div class="rating-stars" aria-label="Satisfaction rating">${[1,2,3,4,5].map(n => `<button class="star ${S().rating && n <= S().rating ? "selected" : ""}" data-action="rate" data-rating="${n}" aria-label="Rate ${n} out of 5" type="button">★</button>`).join("")}</div><small>${S().rating ? `Thanks for rating us ${S().rating}/5.` : "Your feedback updates the User KPI."}</small></div>`;
    let addition = "";
    if (m.type === "options") {
      const s = S(), list = (m.filtered ? s.matching : P().options) || P().options;
      const visible = list.slice(0, s.shown);
      addition = `<div class="chat-label">${s.complexity === "Complex" ? "AI-SUGGESTED · PENDING HUMAN CONFIRMATION" : "AVAILABLE FLIGHT OPTIONS"}</div>${visible.map(renderOption).join("")}${s.status !== "resolved" ? `<div class="quick-row">${visible[0] ? `<button class="quick primary" data-action="confirm" data-option="${visible[0].id}" type="button">Confirm option 1</button>` : ""}${list.length > s.shown ? '<button class="quick" data-action="more" type="button">Show more options</button>' : ""}<button class="quick" data-action="human" type="button">Talk to a human</button></div>` : ""}`;
    }
    if (m.type === "example") addition = `<div class="quick-row"><button class="quick" data-action="example" type="button">Try: “Via Hong Kong before my meeting”</button></div>`;
    return `<div class="message ${m.role}"><div class="bubble">${escapeHTML(m.text)}</div><div class="message-meta">${m.role === "bot" ? "SmartRebook AI" : "You"} · 14 Oct</div></div>${addition}`;
  }

  function renderOption(o) {
    return `<div class="option-card ${o.recommended ? "recommended" : ""}"><div class="option-top"><strong>${escapeHTML(o.flight)}</strong>${o.recommended ? '<span class="mini-chip amber">✦ Recommended</span>' : ""}</div><div class="option-route">${escapeHTML(o.route)}</div><div class="option-times"><div><strong>${escapeHTML(o.depart.split(" · ")[1])}</strong><small>${escapeHTML(o.depart.split(" · ")[0])}</small></div><div class="flight-line"></div><div><strong>${escapeHTML(o.arrive.split(" · ")[1])}</strong><small>${escapeHTML(o.arrive.split(" · ")[0])}</small></div></div><div class="option-foot"><span>${escapeHTML(o.cabin)} · ${o.seats} seats left</span><span class="option-note">${escapeHTML(o.note || "Available")}</span></div></div>`;
  }

  function renderAgent() {
    const queue = [...state.queue].sort((a,b) => b.score - a.score);
    const item = state.queue.find(c => c.id === state.selectedCase) || queue[0];
    return `<div class="section-heading"><div><div class="overline">HUMAN IN THE LOOP</div><h2>Specialist workbench</h2><p>AI prepares the case. A person confirms complex journey changes.</p></div><span class="status-pill navy">${queue.length} cases awaiting review</span></div><div class="agent-layout"><section class="panel"><div class="panel-heading"><div><h3>Escalation queue</h3><p>Sorted by weighted priority score · highest first</p></div><span class="mini-chip amber">● LIVE DEMO</span></div><div class="queue-wrap">${queue.length ? `<table class="queue-table"><thead><tr><th>Passenger / route</th><th>Disruption</th><th>Complexity reason</th><th>Priority</th><th>Wait</th></tr></thead><tbody>${queue.map(c => `<tr class="queue-row ${item?.id === c.id ? "selected" : ""}" data-case="${c.id}" tabindex="0" role="button" aria-label="Open case for ${escapeHTML(c.name)}"><td><div class="queue-name"><span class="avatar">${escapeHTML(c.initials)}</span><span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.route)}</small></span></div></td><td>${escapeHTML(c.disruption)}</td><td class="reason">${escapeHTML(c.reason)}</td><td><span class="score">${c.score}</span> / 100</td><td>${escapeHTML(c.wait)}</td></tr>`).join("")}</tbody></table>` : '<div class="empty-queue">All cases reviewed. Start another passenger scenario to add a case.</div>'}</div></section><section class="panel"><div class="panel-heading"><div><h3>Case review</h3><p>Decision support with clear human approval</p></div><span class="mini-chip gray">SPECIALIST</span></div>${item ? renderCase(item) : '<div class="empty-queue">Select a case from the queue.</div>'}</section></div>`;
  }

  function renderCase(c) {
    return `<div class="case-body"><div class="case-top"><span class="avatar">${escapeHTML(c.initials)}</span><div><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.route)} · Priority ${c.score}/100</p></div></div><div class="case-summary"><strong>Conversation summary</strong><br>${escapeHTML(c.summary)}</div><div class="case-section-title">RANKED SOLUTIONS</div>${c.suggestions.map((s,i) => `<div class="suggestion"><span class="suggestion-label">AI-SUGGESTED · PENDING HUMAN CONFIRMATION · ${i+1}</span><strong>${escapeHTML(s)}</strong><p>${i === 0 ? "Best available fit for the passenger’s constraints" : "Alternate route for specialist review"}</p></div>`).join("")}${state.overrideOpen ? `<form id="override-form"><label class="case-section-title" for="override-input">EDIT / OVERRIDE SUGGESTION 1</label><input id="override-input" class="override-input" maxlength="150" value="${escapeHTML(c.suggestions[0] || "")}" aria-label="Edited suggestion"><button class="button gold" type="submit">Save override</button></form>` : ""}<div class="agent-actions"><button class="button primary" data-action="approve-0" ${!c.suggestions[0] ? "disabled" : ""}>Approve suggestion 1</button><button class="button" data-action="approve-1" ${!c.suggestions[1] ? "disabled" : ""}>Approve suggestion 2</button><button class="button" data-action="override">Edit / override</button><button class="button" data-action="contact">Contact passenger</button></div>${state.agentNote ? `<p class="agent-note">${escapeHTML(state.agentNote)}</p>` : '<p class="agent-note">Approval updates the passenger conversation on this page.</p>'}</div>`;
  }

  function metricCard(title, value, suffix, target, progress, note) {
    return `<div class="kpi-card"><h4>${title}</h4><div class="kpi-value">${value}<span>${suffix}</span></div><div class="kpi-target"><span>${note}</span><strong>Target ${target}</strong></div><div class="progress"><span style="width:${Math.max(0,Math.min(100,progress))}%"></span></div></div>`;
  }

  function renderOps() {
    const p = P(), s = S(), policy = voucherFor(p.delayHours), k = state.kpis;
    const auto = Math.round(100*k.simpleAutoResolved/k.simpleCases);
    const avg = k.totalMinutes/k.resolutions;
    const saved = Math.round(100*(1-avg/D.manualBaselineMinutes));
    const sat = Math.round(100*k.ratingTotal/(5*k.ratings));
    const options = (s.matching || p.options).slice(0,3);
    const trace = [
      ["Inputs received", `${p.originalFlight} · ${p.route} · ${p.disruption}. Booking, mock flight-ops, profile, passenger query, and compensation policy loaded.`, `<span class="mini-chip green">Booking</span><span class="mini-chip green">Flight ops</span><span class="mini-chip green">Profile</span><span class="mini-chip green">Policy</span>`],
      ["NLP intent recognition", s.started ? `Intent: ${s.intent}${s.query ? ` · Query: “${escapeHTML(s.query)}”` : " · Proactive disruption alert"}` : "Waiting for passenger to open the alert.", s.started ? `<span class="mini-chip ${s.query ? "green" : "gray"}">${escapeHTML(s.intent)}</span>${s.entities.map(e => `<span class="mini-chip amber">${escapeHTML(e)}</span>`).join("")}` : ""],
      ["RAG retrieval · mock flight-ops", s.started ? `Retrieved ${p.options.length} live flight options from mock flight-ops data. Top matches: ${options.map(o => escapeHTML(o.flight)).join(", ") || "none"}.` : "Six fixed, fictional flight records are ready for retrieval.", s.started ? options.map(o => `<span class="mini-chip gray">${escapeHTML(o.flight)} · ${o.seats} seats</span>`).join("") : ""],
      ["Agentic decision router", s.started ? `Complexity: ${s.complexity} · Priority score: ${s.score}/100 · ${escapeHTML(s.reason)}` : "Awaiting a passenger interaction to classify the case.", s.started ? `<span class="mini-chip ${s.complexity === "Complex" ? "amber" : "green"}">${s.complexity.toUpperCase()}</span><span class="mini-chip gray">${s.score} / 100</span>` : ""],
      ["Action taken", s.status === "resolved" ? (s.complexity === "Simple" ? "Auto-rebooked after passenger confirmation." : "Specialist approved the AI-suggested rebooking.") : s.status === "escalated" ? "Escalated to human specialist; booking change pending." : "No booking change yet.", s.status === "resolved" ? '<span class="mini-chip green">Confirmed</span>' : s.status === "escalated" ? '<span class="mini-chip amber">Human review</span>' : ""],
      ["Voucher calculation", policy ? `Rule matched: ${policy.label} → S$${policy.value} ${policy.benefit.toLowerCase()}. ${s.status === "resolved" ? "Added to mock KrisFlyer wallet." : "Issued only after confirmation."}` : "No illustrative policy row matched.", policy ? `<span class="mini-chip ${s.status === "resolved" ? "green" : "gray"}">S$${policy.value} · ${escapeHTML(policy.label)}</span>` : ""],
      ["Outputs sent", "Passenger, Customer Service, Reservation System, and KrisFlyer wallet share the same demo state.", [["Passenger",s.started],["Customer Service",s.status === "escalated" || s.status === "resolved"],["Reservation System",s.status === "resolved"],["KrisFlyer wallet",s.status === "resolved"]].map(([label,on]) => `<span class="mini-chip ${on ? "green" : "gray"}">${on ? "✓" : "○"} ${label}</span>`).join("")]
    ];
    return `<div class="section-heading"><div><div class="overline">DECISION INTELLIGENCE</div><h2>Every decision, visible</h2><p>Deterministic mock reasoning trace for ${escapeHTML(p.name)} · ${escapeHTML(p.label)}.</p></div><button class="reset" type="button" data-action="reset">↺ Reset demo</button></div><div class="ops-grid"><section class="panel"><div class="panel-heading"><div><h3>Agent reasoning trace</h3><p>Step-by-step pipeline · updates as the passenger interacts</p></div><span class="mini-chip green">● TRACE ACTIVE</span></div><div class="trace-list">${trace.map((t,i) => { const phase = i === 0 || (s.started && i <= 3) || (s.status === "escalated" && i === 4) || (s.status === "resolved" && i >= 4) ? "complete" : i === 1 && !s.started || i === 5 && s.started ? "active" : ""; return `<div class="trace-step ${phase}"><div class="trace-num">${String(i+1).padStart(2,"0")}</div><div class="trace-content"><h4>${t[0]}</h4><p>${t[1]}</p>${t[2] ? `<div class="trace-tags">${t[2]}</div>` : ""}${i === 3 && s.started ? `<div class="trace-detail"><strong>Priority factors · weighted sum</strong>${s.factors.map(f => `<div class="factor-row"><span>${f[0]} (max ${f[1]})</span><strong>+${f[2]}</strong></div>`).join("")}</div>` : ""}</div></div>`; }).join("")}</div></section><div class="ops-side"><section class="panel"><div class="panel-heading"><div><h3>Live performance</h3><p>Seeded baseline + completed demo actions</p></div></div>${metricCard("AI automation KPI",auto,"%", "≥40%",auto/40*100,`${k.simpleAutoResolved}/${k.simpleCases} simple cases resolved by AI`)}${metricCard("Operational KPI",saved,"% faster", "−30%",saved/30*100,`${avg.toFixed(1)} min average vs ${D.manualBaselineMinutes} min manual`)}${metricCard("User KPI",sat,"%", "≥80%",sat/80*100,`${(k.ratingTotal/k.ratings).toFixed(1)}/5 average satisfaction · ${k.ratings} ratings`)}</section><section class="panel"><div class="panel-heading"><div><h3>Voucher policy</h3><p>Rule-based lookup · illustrative values</p></div></div><div class="policy-body"><table class="policy-table"><thead><tr><th>Delay</th><th>Meal value</th><th>Additional check</th></tr></thead><tbody>${D.voucherPolicy.map(row => `<tr class="${row === policy ? "matched" : ""}"><td>${row.label}</td><td>S$${row.value}</td><td>${row.min >= 8 ? "Hotel eligibility" : "—"}</td></tr>`).join("")}</tbody></table><p class="policy-note">Matched row is highlighted for this passenger. These values are fictional and are not an airline policy.</p></div></section></div></div>`;
  }

  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]"); if (tab) { state.tab = tab.dataset.tab; render(); return; }
    const row = e.target.closest("[data-case]"); if (row) { state.selectedCase = row.dataset.case; state.agentNote = ""; state.overrideOpen = false; render(); return; }
    const action = e.target.closest("[data-action]"); if (!action) return;
    const a = action.dataset.action;
    if (a === "open-chat") await startChat();
    else if (a === "open-human") { await startChat(); escalate("Passenger requested a human specialist."); }
    else if (a === "human") escalate("Passenger requested a human specialist.");
    else if (a === "confirm") await confirmOption(action.dataset.option);
    else if (a === "more") { S().shown = Math.min(P().options.length, S().shown + 2); render(); }
    else if (a === "example") await handleQuery(P().example);
    else if (a === "rate") { const n = Number(action.dataset.rating); if (!S().rating) { state.kpis.ratings++; state.kpis.ratingTotal += n; } else state.kpis.ratingTotal += n-S().rating; S().rating = n; render(); }
    else if (a === "approve-0") approveCase(0);
    else if (a === "approve-1") approveCase(1);
    else if (a === "override") { state.overrideOpen = !state.overrideOpen; render(); }
    else if (a === "contact") { const c = state.queue.find(x => x.id === state.selectedCase); if (c?.scenario) { state.sessions[c.scenario].messages.push({ role:"bot", text:"A specialist is reviewing your journey and will confirm your rebooking shortly." }); state.agentNote = `Message sent to ${c.name} in Passenger view.`; } else state.agentNote = `Contact noted for ${c?.name || "passenger"}.`; render(); }
    else if (a === "reset") { state = newState(); render(); }
  });
  document.addEventListener("change", e => { if (e.target.id === "scenario-select" && !state.transitioning && !S().busy) { state.scenario = e.target.value; render(); } });
  document.addEventListener("submit", async e => {
    if (e.target.id === "chat-form") { e.preventDefault(); const input = $("#chat-input"); const value = input.value; input.value = ""; await handleQuery(value); }
    if (e.target.id === "override-form") { e.preventDefault(); const c = state.queue.find(x => x.id === state.selectedCase), value = $("#override-input").value.trim(); if (c && value) { c.suggestions[0] = value.slice(0,150); state.overrideOpen = false; state.agentNote = "Suggestion 1 edited. Human approval is still required."; render(); } }
  });
  document.addEventListener("keydown", e => { const row = e.target.closest?.("[data-case]"); if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); row.click(); } });
  render();
})();
