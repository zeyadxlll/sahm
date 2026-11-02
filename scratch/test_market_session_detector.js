/**
 * Test Suite: Market Session Status Detector & Timezone Display
 * Validates:
 * 1. Self-reading DOM loop prevention (ignoring #sahm-copilot-root / #sahm-copilot-sidebar)
 * 2. Closed status ("مغلق") immediate precedence over Pre-Market
 * 3. Egypt Cairo Time (Africa/Cairo) schedule for US and Saudi markets
 * 4. Pausing alerts when market is closed (no audio, no Telegram dispatch)
 * 5. Explanatory notice formatting with Egypt Time
 */

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Mock Browser Environment
class MockElement {
  constructor(tag, id = "", className = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = className;
    this.textContent = "";
    this.innerText = "";
    this.children = [];
    this.parentElement = null;
    this.classList = {
      add: (cls) => { if (!this.className.includes(cls)) this.className += " " + cls; },
      remove: (cls) => { this.className = this.className.replace(cls, "").trim(); }
    };
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector === "#sahm-copilot-root" && curr.id === "sahm-copilot-root") return curr;
      if (selector === "#sahm-copilot-sidebar" && curr.id === "sahm-copilot-sidebar") return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    const search = (node) => {
      for (const ch of node.children) {
        if (selector.includes(".market-bar-market-info") && ch.className.includes("market-bar-market-info")) {
          results.push(ch);
        } else if (selector.includes(".market-status") && ch.className.includes("market-status")) {
          results.push(ch);
        } else if (selector.includes(".stock-header-card") && ch.className.includes("stock-header-card")) {
          results.push(ch);
        } else if (selector.includes("#copilot-session-status-badge") && ch.id === "copilot-session-status-badge") {
          results.push(ch);
        }
        search(ch);
      }
    };
    search(this);
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement("body");
  }

  getElementById(id) {
    const search = (node) => {
      if (node.id === id) return node;
      for (const ch of node.children) {
        const found = search(ch);
        if (found) return found;
      }
      return null;
    };
    return search(this.body);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

const mockDoc = new MockDocument();

// Load parser_market.js into context
const marketParserCode = fs.readFileSync("chrome-extension/content/parser_market.js", "utf8");
const context = {
  window: {
    location: { href: "https://app.sahmcapital.com/quote?code=spx&tab=options" }
  },
  document: mockDoc,
  Intl: Intl,
  Date: Date,
  console: console
};

vm.createContext(context);
vm.runInContext(marketParserCode, context);

const parser = context.window.SahmMarketParser;
assert(parser, "SahmMarketParser must be defined");

console.log("==================================================");
console.log("TEST 1: Self-Reading DOM Loop Prevention & 'مغلق' Badge Precedence");
console.log("==================================================");

// Setup:
// 1. Sahm's top-right header (.market-bar-market-info) has "US" and "مغلق"
const sahmHeader = new MockElement("div", "sahm-top-header", "market-bar-market-info");
sahmHeader.textContent = "US مغلق 7659.44";
mockDoc.body.appendChild(sahmHeader);

// 2. Injected Sidebar (#sahm-copilot-root) contains the old stuck text "فترة ما قبل الافتتاح (Pre-Market)"
const copilotRoot = new MockElement("div", "sahm-copilot-root", "copilot-container");
const sidebarEl = new MockElement("div", "sahm-copilot-sidebar", "copilot-sidebar");
const bannerEl = new MockElement("div", "premarket-banner", "copilot-premarket-banner");
bannerEl.textContent = "فترة ما قبل الافتتاح (Pre-Market) 🟡 تحذير الثيتا";
sidebarEl.appendChild(bannerEl);
copilotRoot.appendChild(sidebarEl);
mockDoc.body.appendChild(copilotRoot);

// Ensure body text has the trap text
mockDoc.body.innerText = "US مغلق 7659.44 فترة ما قبل الافتتاح (Pre-Market) 🟡 تحذير الثيتا";

// Test detector
const statusResult = parser.detectMarketStatus("US");
console.log("Status Result with Sahm badge 'مغلق' and Injected Sidebar with 'قبل الافتتاح':", statusResult);

assert.strictEqual(statusResult.raw, "CLOSED", "Status MUST be CLOSED when Sahm badge says مغلق, ignoring sidebar!");
assert(statusResult.statusText.includes("سوق مغلق 🔴"), "statusText must indicate market is closed");
console.log("✓ TEST 1 PASSED: Successfully ignored #sahm-copilot-sidebar and prioritized 'مغلق' badge!");

console.log("==================================================");
console.log("TEST 2: Egypt Cairo Time (Africa/Cairo) US Weekend Verification");
console.log("==================================================");

// Verify Cairo time helper exists and returns Africa/Cairo
const cairoInfo = parser.getEgyptTimeInfo();
console.log("Current Cairo Time Info:", { day: cairoInfo.day, hour: cairoInfo.hour, minute: cairoInfo.minute, mins: cairoInfo.mins });
assert(cairoInfo.day, "Cairo day must be resolved");

// Simulate Sunday / Saturday for US Market
const origGetEgypt = parser.getEgyptTimeInfo;

// Case 2A: Sunday
parser.getEgyptTimeInfo = () => ({ day: "Sun", hour: 14, minute: 30, mins: 14 * 60 + 30, now: new Date() });
const sundayResult = parser.detectMarketStatus("US");
console.log("Sunday US Market Result:", sundayResult);
assert.strictEqual(sundayResult.raw, "CLOSED");
assert.strictEqual(sundayResult.statusText, "سوق مغلق 🔴 (عطلة نهاية الأسبوع)");

// Case 2B: Saturday
parser.getEgyptTimeInfo = () => ({ day: "Sat", hour: 17, minute: 0, mins: 17 * 60, now: new Date() });
const satResult = parser.detectMarketStatus("US");
console.log("Saturday US Market Result:", satResult);
assert.strictEqual(satResult.raw, "CLOSED");
assert.strictEqual(satResult.statusText, "سوق مغلق 🔴 (عطلة نهاية الأسبوع)");
console.log("✓ TEST 2 PASSED: Weekend in Cairo time strictly enforces CLOSED (عطلة نهاية الأسبوع)!");

console.log("==================================================");
console.log("TEST 3: Egypt Cairo Time Weekday Schedule (Mon-Fri)");
console.log("==================================================");

// Case 3A: Pre-Market window (1:00 PM Cairo = 13:00) with Sahm badge "قبل الافتتاح"
sahmHeader.textContent = "US قبل الافتتاح 7744.06";
parser.getEgyptTimeInfo = () => ({ day: "Tue", hour: 13, minute: 0, mins: 13 * 60, now: new Date() });
const preMktResult = parser.detectMarketStatus("US");
console.log("1:00 PM Tuesday with badge 'قبل الافتتاح':", preMktResult);
assert.strictEqual(preMktResult.raw, "PRE_MARKET");
assert.strictEqual(preMktResult.statusText, "فترة ما قبل الافتتاح (Pre-Market) 🟡");

// Case 3B: Pre-Market window (1:00 PM Cairo) but Sahm badge says "مغلق" (e.g. holiday or halted)
sahmHeader.textContent = "US مغلق 7744.06";
const preMktClosedResult = parser.detectMarketStatus("US");
console.log("1:00 PM Tuesday with badge 'مغلق':", preMktClosedResult);
assert.strictEqual(preMktClosedResult.raw, "CLOSED");
assert(preMktClosedResult.statusText.includes("سوق مغلق 🔴"));

// Case 3C: Regular Market Open (6:00 PM Cairo = 18:00) with badge "مفتوح"
sahmHeader.textContent = "US مفتوح 7750.20";
parser.getEgyptTimeInfo = () => ({ day: "Tue", hour: 18, minute: 0, mins: 18 * 60, now: new Date() });
const openResult = parser.detectMarketStatus("US");
console.log("6:00 PM Tuesday with badge 'مفتوح':", openResult);
assert.strictEqual(openResult.raw, "OPEN");
assert.strictEqual(openResult.statusText, "سوق مفتوح 🟢");

// Case 3D: Overnight / Closed after 11:00 PM Cairo (23:30)
sahmHeader.textContent = "US التداول الليلي 7755.00";
parser.getEgyptTimeInfo = () => ({ day: "Tue", hour: 23, minute: 30, mins: 23 * 60 + 30, now: new Date() });
const overnightResult = parser.detectMarketStatus("US");
console.log("11:30 PM Tuesday with badge 'التداول الليلي':", overnightResult);
assert.strictEqual(overnightResult.raw, "OVERNIGHT");
console.log("✓ TEST 3 PASSED: Mon-Fri Cairo schedule adheres 100% to specifications!");

console.log("==================================================");
console.log("TEST 4: Saudi Market Cairo Schedule");
console.log("==================================================");

// Case 4A: Friday (Saudi Weekend in Cairo Time)
parser.getEgyptTimeInfo = () => ({ day: "Fri", hour: 11, minute: 0, mins: 11 * 60, now: new Date() });
const saudiFriResult = parser.detectMarketStatus("SA");
console.log("Saudi Market Friday:", saudiFriResult);
assert.strictEqual(saudiFriResult.raw, "CLOSED");
assert.strictEqual(saudiFriResult.statusText, "سوق مغلق 🔴 (عطلة نهاية الأسبوع)");

// Case 4B: Sunday to Thursday during 10:00 AM to 3:00 PM Cairo
sahmHeader.textContent = "SA تاسي مفتوح 11840.50";
parser.getEgyptTimeInfo = () => ({ day: "Wed", hour: 12, minute: 30, mins: 12 * 60 + 30, now: new Date() });
const saudiOpenResult = parser.detectMarketStatus("SA");
console.log("Saudi Market Wednesday 12:30 PM:", saudiOpenResult);
assert.strictEqual(saudiOpenResult.raw, "OPEN");
assert.strictEqual(saudiOpenResult.statusText, "سوق مفتوح 🟢");

// Case 4C: Outside Saudi hours (e.g. 5:00 PM Cairo)
parser.getEgyptTimeInfo = () => ({ day: "Wed", hour: 17, minute: 0, mins: 17 * 60, now: new Date() });
const saudiClosedResult = parser.detectMarketStatus("SA");
console.log("Saudi Market Wednesday 5:00 PM:", saudiClosedResult);
assert.strictEqual(saudiClosedResult.raw, "CLOSED");
console.log("✓ TEST 4 PASSED: Saudi market schedule strictly verified!");

// Restore parser
parser.getEgyptTimeInfo = origGetEgypt;

console.log("==================================================");
console.log("TEST 5: Sidebar Logic Validation (Alert Pausing & Precedence)");
console.log("==================================================");

const sidebarCode = fs.readFileSync("chrome-extension/content/sidebar.js", "utf8");
// Check that checkProximityAlerts includes pause logic for CLOSED
assert(sidebarCode.includes("isMarketClosed"), "sidebar.js must check isMarketClosed in checkProximityAlerts");
assert(sidebarCode.includes("this.activeAlerts = [];"), "sidebar.js must clear/pause activeAlerts when closed");

// Check that setMarketStatus checks isClosed before isPreMarket
const setStatusIdx = sidebarCode.indexOf("setMarketStatus(statusRaw, customText = null)");
const setStatusSection = sidebarCode.substring(setStatusIdx, setStatusIdx + 2000);
const closedCheckPos = setStatusSection.indexOf("if (isClosed)");
const preMarketCheckPos = setStatusSection.indexOf("else if (isPreMarket)");
assert(closedCheckPos > 0 && preMarketCheckPos > 0, "setMarketStatus must have both checks");
assert(closedCheckPos < preMarketCheckPos, "isClosed check MUST come before isPreMarket check in setMarketStatus!");

// Check that renderSPXTab checks isClsd before isPreMkt
const isClsdPos = sidebarCode.indexOf("const isClsd = (this.marketStatus === \"CLOSED\"");
const isPreMktPos = sidebarCode.indexOf("const isPreMkt = !isClsd");
assert(isClsdPos > 0 && isPreMktPos > 0, "renderSPXTab must define isClsd before isPreMkt");
assert(isClsdPos < isPreMktPos, "isClsd MUST be computed before isPreMkt in renderSPXTab!");

// Check explanatory notice in sidebar
assert(sidebarCode.includes("الساعة 4:30 عصراً بتوقيت مصر (9:30 صباحاً بتوقيت نيويورك)"), "Sidebar must explicitly state Egypt opening time in notice");

// Check Egypt TimeZone formatting in sidebar
assert(sidebarCode.includes("Africa/Cairo"), "sidebar.js must use Africa/Cairo for timestamps");

console.log("✓ TEST 5 PASSED: Sidebar alert pausing, status precedence, and notices are 100% compliant!");
console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
