/* Run with `node selfcheck.cjs` to exercise the offline demo's shared state. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const handlers = {};
const app = { innerHTML: "" };
const count = { textContent: "" };
const tabs = ["passenger", "agent", "ops"].map(tab => ({ dataset: { tab }, classList: { toggle() {} }, setAttribute() {} }));
const document = {
  querySelectorAll(selector) { return selector === "[data-tab]" ? tabs : []; },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#queue-count") return count;
    if (selector === ".chat-scroll") return { scrollTop: 0, scrollHeight: 500 };
    if (selector === "#chat-input") return this.chatInput;
    if (selector === "#override-input") return this.overrideInput;
    return null;
  },
  addEventListener(type, fn) { handlers[type] = fn; }
};
const context = { window: {}, document, setTimeout: fn => fn(), console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

function target(dataset = {}, id = "") {
  return { dataset, id, closest(selector) {
    if (selector === "[data-tab]" && dataset.tab) return this;
    if (selector === "[data-case]" && dataset.case) return this;
    if (selector === "[data-action]" && dataset.action) return this;
    return null;
  } };
}
async function click(action, extra = {}) { await handlers.click({ target: target({ action, ...extra }) }); }
async function tab(name) { await handlers.click({ target: target({ tab: name }) }); }
function scenario(name) { handlers.change({ target: { id: "scenario-select", value: name } }); }
function visible(text) { assert.ok(app.innerHTML.includes(text), `Expected visible text: ${text}`); }

(async () => {
  // A: proactive alert → deterministic simple route → auto-book → wallet → rating.
  visible("View your options");
  await click("open-chat");
  visible("Confirm option 1");
  await click("confirm", { option: "A1" });
  visible("You’re rebooked on DX 418");
  visible("S$60");
  await click("rate", { rating: "5" });
  visible("Thanks for rating us 5/5");
  await tab("ops");
  visible("4/10 simple cases resolved by AI");

  // B: complex case enters queue; human approval returns to the same passenger state.
  await tab("passenger"); scenario("B");
  await click("open-chat");
  await tab("agent");
  visible("Daniel Lim");
  visible("AI-SUGGESTED · PENDING HUMAN CONFIRMATION");
  const danielIndex = app.innerHTML.indexOf("Daniel Lim");
  const marcusIndex = app.innerHTML.indexOf("Marcus Lee");
  assert.ok(danielIndex < marcusIndex, "High-priority Daniel should be ahead of seeded cases");
  await click("approve-0");
  await tab("passenger");
  visible("A specialist has confirmed your rebooking");
  visible("KRISFLYER WALLET");

  // C: free text identifies route/arrival constraints, retrieves match, escalates.
  scenario("C");
  await click("open-chat");
  document.chatInput = { value: "I need to get there before my meeting tomorrow morning, can I go via Hong Kong instead?" };
  await handlers.submit({ target: { id: "chat-form" }, preventDefault() {} });
  visible("DX 680 + DX 912");
  await tab("ops");
  visible("change_route");
  visible("arrive_before_09:00");
  visible("via HKG");
  await tab("agent");
  visible("Priya Menon");
  await click("approve-0");
  await tab("passenger");
  visible("A specialist has confirmed your rebooking");

  // Reset restores the initial notification, seeded queue and baseline KPIs.
  await tab("ops"); await click("reset");
  visible("View your options");
  await tab("ops"); visible("3/9 simple cases resolved by AI");
  assert.equal(count.textContent, 2);
  console.log("PASS: Scenarios A, B and C, agent handoff, voucher, rating, KPIs and reset.");
})().catch(error => { console.error(error); process.exitCode = 1; });
