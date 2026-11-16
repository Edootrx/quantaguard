/* QuantaGuard site logic: nav, animations, demos, and QMS Testnet wallet connection. */
"use strict";

/* WalletConnect v2 project ID (Reown). Public client identifier, safe to ship in browser code. */
const WALLETCONNECT_PROJECT_ID = "d94707b7e1f9e31da8cd587bbb44157d";

const QMS_CHAIN_ID = 19480;
const QMS_CHAIN_ID_HEX = "0x4C18";
const QMS_RPC = "https://rpc.testnet.qms.finance";
const QMS_EXPLORER = "https://testnet.qmsscan.io";
const WC_PROVIDER_CDN = "https://esm.sh/@walletconnect/ethereum-provider@2.17.2";

/* ---------------- Small helpers ---------------- */

function $(id) { return document.getElementById(id); }

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(function () { toast.classList.add("show"); });
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function () {
    toast.classList.remove("show");
    setTimeout(function () { toast.hidden = true; }, 250);
  }, 2600);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage || "Copied to clipboard");
    return true;
  } catch (err) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    showToast(ok ? (successMessage || "Copied to clipboard") : "Copy failed, please copy manually");
    return ok;
  }
}

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function hexToDecimalString(hex) {
  const wei = BigInt(hex);
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  let fracStr = frac.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  if (fracStr === "") fracStr = "0";
  return whole.toString() + "." + fracStr;
}

/* ---------------- Theme toggle (dark / light, sun and moon icons) ---------------- */

(function initTheme() {
  const root = document.documentElement;
  const btn = $("themeToggle");
  function syncLabel() {
    if (!btn) return;
    const light = root.getAttribute("data-theme") === "light";
    btn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  }
  if (btn) {
    btn.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("quantaguard-theme", next); } catch (e) { /* storage unavailable */ }
      syncLabel();
    });
  }
  syncLabel();
})();

/* ---------------- Ticker: duplicate content for a seamless loop ---------------- */

(function initTicker() {
  const track = $("tickerTrack");
  if (track) track.innerHTML += track.innerHTML;
})();

/* ---------------- Hero headline word reveal ---------------- */

(function initReveal() {
  const el = $("heroTitle");
  if (!el) return;
  const shinyEl = el.querySelector(".shiny");
  const shinyText = shinyEl ? shinyEl.textContent : "";
  const parts = [];
  el.childNodes.forEach(function (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/\s+/).filter(Boolean).forEach(function (w) { parts.push({ text: w, shiny: false }); });
    } else if (node === shinyEl) {
      shinyText.split(/\s+/).filter(Boolean).forEach(function (w) { parts.push({ text: w, shiny: true }); });
    }
  });
  el.innerHTML = "";
  parts.forEach(function (part, i) {
    const span = document.createElement("span");
    span.className = "word" + (part.shiny ? " shiny" : "");
    span.textContent = part.text;
    span.style.animationDelay = (i * 45) + "ms";
    el.appendChild(span);
    el.appendChild(document.createTextNode(" "));
  });
})();

/* ---------------- Spotlight hover ---------------- */

document.querySelectorAll(".spotlight").forEach(function (panel) {
  panel.addEventListener("pointermove", function (e) {
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width * 100) + "%");
    panel.style.setProperty("--my", ((e.clientY - rect.top) / rect.height * 100) + "%");
  });
});

/* ---------------- Magnetic primary buttons ---------------- */

if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll(".magnetic").forEach(function (btn) {
    btn.addEventListener("pointermove", function (e) {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.12;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
      btn.style.transform = "translate(" + x + "px," + y + "px)";
    });
    btn.addEventListener("pointerleave", function () { btn.style.transform = ""; });
  });
}

/* ---------------- Count-up stats ---------------- */

(function initCountUps() {
  const nums = document.querySelectorAll("[data-count]");
  if (!nums.length) return;
  const run = function (el) {
    const target = parseFloat(el.getAttribute("data-count"));
    const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    const duration = 1100;
    const start = performance.now();
    const tick = function (now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
    });
  }, { threshold: 0.4 });
  nums.forEach(function (n) { io.observe(n); });
})();

/* ---------------- Nav: mobile menu, scroll spy ---------------- */

(function initNav() {
  const burger = $("hamburger");
  const menu = $("mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      const open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () {
        menu.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }
  const spyLinks = document.querySelectorAll("[data-spy]");
  const sections = ["overview", "contracts", "product", "wallet", "demos", "roadmap", "plan"]
    .map(function (id) { return $(id); }).filter(Boolean);
  const spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        spyLinks.forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("data-spy") === entry.target.id);
        });
      }
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach(function (s) { spy.observe(s); });
})();

/* ---------------- Tracing beam on the 90-day timeline ---------------- */

(function initBeam() {
  const timeline = $("timeline");
  const fill = $("beamFill");
  if (!timeline || !fill) return;
  const update = function () {
    const rect = timeline.getBoundingClientRect();
    const viewportAnchor = window.innerHeight * 0.55;
    const progress = Math.min(1, Math.max(0, (viewportAnchor - rect.top) / rect.height));
    fill.style.height = (progress * 100) + "%";
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();

/* ---------------- Copy buttons and Discord handle ---------------- */

document.querySelectorAll(".copy-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    copyText(btn.getAttribute("data-copy"), "Copied: " + truncateAddress(btn.getAttribute("data-copy")));
  });
});

(function initDiscord() {
  const btn = $("discordCopyBtn");
  if (btn) btn.addEventListener("click", function () {
    copyText("7capital", "Discord handle copied: 7capital");
  });
})();

/* ---------------- Demo 1: guardian commitment and recovery ---------------- */

(function initGuardianDemo() {
  const input = $("guardianInput");
  const hashBtn = $("guardianHashBtn");
  const registerBtn = $("guardianRegisterBtn");
  const recoverBtn = $("guardianRecoverBtn");
  const out = $("guardianOut");
  if (!input || !hashBtn || !out) return;
  let commitment = null;
  let registered = false;

  input.addEventListener("input", function () {
    commitment = null;
    registered = false;
    registerBtn.disabled = true;
    recoverBtn.disabled = true;
  });

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return "0x" + Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  hashBtn.addEventListener("click", async function () {
    const value = input.value.trim();
    if (!value) {
      out.innerHTML = "<p class='verdict blocked'>Type a guardian identifier first.</p>";
      return;
    }
    commitment = await sha256Hex(value);
    registered = false;
    registerBtn.disabled = false;
    recoverBtn.disabled = true;
    out.innerHTML =
      "<p>Commitment for guardian <span class='mono'>" + value.replace(/</g, "") + "</span>:</p>" +
      "<p class='mono'>" + commitment + "</p>" +
      "<p>On chain, PQGuardianRegistry stores a keccak256 commitment of the guardian post-quantum public key. This browser demo uses SHA-256 and synthetic input only.</p>";
  });

  registerBtn.addEventListener("click", function () {
    if (!commitment) return;
    registered = true;
    recoverBtn.disabled = false;
    out.innerHTML =
      "<p><span class='verdict ok'>COMMITMENT REGISTERED</span></p>" +
      "<p class='mono'>" + commitment + "</p>" +
      "<p>The registry now maps the demo account to this guardian commitment, mirroring demo transaction 2 on QMSScan (block 366913). Next, simulate a recovery proposed by this guardian.</p>";
  });

  recoverBtn.addEventListener("click", function () {
    if (!registered) return;
    out.innerHTML =
      "<p><span class='verdict ok'>RECOVERY APPROVED</span></p>" +
      "<p>The guardian commitment matches the registered anchor, so the recovery proposal is accepted. On chain, the new owner takes effect only after the 48 hour timelock, and the current owner can cancel at any point during that window. The timelock is compressed to zero in this local simulation.</p>";
  });
})();

/* ---------------- Demo 2: session key policy simulator ---------------- */

(function initSessionDemo() {
  const out = $("sessionOut");
  const testBtn = $("skTestBtn");
  const resetBtn = $("skResetBtn");
  if (!out || !testBtn) return;
  let spent = 0;

  const TARGET_NAMES = {
    board: "QUBOJobBoard (0xe6Db...1C77)",
    factory: "QuantaGuardFactory (0x82AE...d5e5)",
    other: "Some other contract"
  };

  function render(message) {
    out.innerHTML = message + "<p>Spent so far under this key: <span class='mono'>" + spent.toFixed(2) + " QMS</span>.</p>";
  }

  testBtn.addEventListener("click", function () {
    const limit = parseFloat($("skLimit").value || "0");
    const expiryHours = parseFloat($("skExpiry").value || "0");
    const elapsed = parseFloat($("skElapsed").value || "0");
    const amount = parseFloat($("skAmount").value || "0");
    const allowedTarget = $("skTarget").value;
    const actionTarget = $("skActionTarget").value;

    if (amount < 0) {
      render("<p><span class='verdict blocked'>BLOCKED: invalid amount.</span> The test action amount cannot be negative.</p>");
      return;
    }
    if (elapsed > expiryHours) {
      render("<p><span class='verdict blocked'>BLOCKED: key expired.</span> Simulated time is " + elapsed + "h, the key expires at " + expiryHours + "h. On chain this call reverts.</p>");
      return;
    }
    if (allowedTarget !== "any" && actionTarget !== allowedTarget) {
      render("<p><span class='verdict blocked'>BLOCKED: target not allowed.</span> This key may only call " + TARGET_NAMES[allowedTarget] + ", not " + TARGET_NAMES[actionTarget] + ".</p>");
      return;
    }
    if (spent + amount > limit) {
      render("<p><span class='verdict blocked'>BLOCKED: spend limit exceeded.</span> Limit is " + limit.toFixed(2) + " QMS cumulative, already spent " + spent.toFixed(2) + " QMS, this action asks for " + amount.toFixed(2) + " QMS.</p>");
      return;
    }
    spent += amount;
    render("<p><span class='verdict ok'>ALLOWED.</span> The agent key spends " + amount.toFixed(2) + " QMS at " + TARGET_NAMES[actionTarget] + ", inside its limit, target policy, and expiry. This is exactly the check QuantaGuardAccount runs on chain.</p>");
  });

  resetBtn.addEventListener("click", function () {
    spent = 0;
    render("<p>Policy reset.</p>");
  });
})();

/* ---------------- Demo 3: QUBO solver ---------------- */

(function initQuboDemo() {
  const ASSETS = ["BTC", "ETH", "QMS", "USDC"];
  const Q = [
    [-0.12, 0.02, 0.01, 0.00],
    [0.02, -0.18, 0.03, 0.00],
    [0.01, 0.03, -0.25, 0.01],
    [0.00, 0.00, 0.01, -0.02]
  ];
  const tbody = document.querySelector("#quboMatrix tbody");
  const out = $("quboOut");
  const runBtn = $("quboRunBtn");
  if (!tbody || !out || !runBtn) return;

  ASSETS.forEach(function (name, i) {
    const tr = document.createElement("tr");
    let cells = "<td class='td-strong'>" + name + "</td>";
    Q[i].forEach(function (v) { cells += "<td>" + v.toFixed(2) + "</td>"; });
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });

  function energy(x) {
    let e = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) e += Q[i][j] * x[i] * x[j];
    }
    return e;
  }

  runBtn.addEventListener("click", function () {
    const results = [];
    for (let mask = 0; mask < 16; mask++) {
      const x = [0, 1, 2, 3].map(function (i) { return (mask >> i) & 1; });
      const picked = x.reduce(function (a, b) { return a + b; }, 0);
      if (picked !== 2) continue;
      results.push({ x: x, energy: energy(x) });
    }
    results.sort(function (a, b) { return a.energy - b.energy; });
    const best = results[0];
    const bestNames = ASSETS.filter(function (_, i) { return best.x[i] === 1; }).join(" + ");
    let rows = "";
    results.forEach(function (r, idx) {
      const names = ASSETS.filter(function (_, i) { return r.x[i] === 1; }).join(" + ");
      rows += "<tr" + (idx === 0 ? " class='best'" : "") + "><td>" + names + "</td><td>" + r.energy.toFixed(4) + (idx === 0 ? " (lowest, wins)" : "") + "</td></tr>";
    });
    out.innerHTML =
      "<p>Checked all 16 combinations, 6 satisfy the pick-exactly-2 constraint.</p>" +
      "<p><span class='verdict ok'>BEST: " + bestNames + "</span> with energy <span class='mono'>" + best.energy.toFixed(4) + "</span>. A solver submitting this solution for the first job posts the lowest objective score and is paid the locked 0.1 QMS on settlement.</p>" +
      "<div class='table-wrap qubo-results'><table class='table table-sm'><thead><tr><th>Selection</th><th>Energy f(x)</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
  });
})();

/* ---------------- Wallet connection ---------------- */

const walletState = {
  provider: null,
  kind: null,
  address: null,
  chainId: null,
  wcProvider: null
};

function setModalStatus(message, isError) {
  const el = $("walletModalStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function setWalletError(message) {
  const el = $("walletError");
  if (!el) return;
  if (message) { el.textContent = message; el.hidden = false; }
  else { el.textContent = ""; el.hidden = true; }
}

function openWalletModal() {
  const modal = $("walletModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  refreshModalOptions();
}
function closeWalletModal() {
  const modal = $("walletModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  setModalStatus("");
}

function refreshModalOptions() {
  const hasInjected = typeof window !== "undefined" && !!window.ethereum;
  const injBadge = $("optInjectedBadge");
  const injDesc = $("optInjectedDesc");
  if (injBadge) injBadge.textContent = hasInjected ? "Detected" : "Not detected";
  if (injDesc && !hasInjected) {
    injDesc.textContent = "No browser wallet found in this browser. Open this page inside a wallet in-app browser (MetaMask, Trust Wallet), or use WalletConnect.";
  }
  const wcBadge = $("optWalletConnectBadge");
  if (wcBadge) {
    if (WALLETCONNECT_PROJECT_ID) { wcBadge.textContent = "QR and mobile"; wcBadge.classList.remove("badge-outline"); }
    else { wcBadge.textContent = "Setup required"; }
  }
}

async function ensureQmsChain(provider) {
  const current = await provider.request({ method: "eth_chainId" });
  if (current && current.toLowerCase() === QMS_CHAIN_ID_HEX) return true;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: QMS_CHAIN_ID_HEX }]
    });
    return true;
  } catch (switchError) {
    if (switchError && switchError.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: QMS_CHAIN_ID_HEX,
          chainName: "QMS Testnet",
          nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
          rpcUrls: [QMS_RPC],
          blockExplorerUrls: [QMS_EXPLORER]
        }]
      });
      return true;
    }
    throw switchError;
  }
}

async function fetchBalance(provider, address) {
  const hex = await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"]
  });
  return hexToDecimalString(hex);
}

async function refreshWalletUI() {
  const connected = $("walletConnected");
  const disconnected = $("walletDisconnected");
  const badge = $("walletNetBadge");
  const chip = $("navWalletChip");
  if (!walletState.address) {
    if (connected) connected.hidden = true;
    if (disconnected) disconnected.hidden = false;
    if (badge) { badge.textContent = "Not connected"; badge.classList.remove("badge-live"); }
    if (chip) chip.hidden = true;
    return;
  }
  if (connected) connected.hidden = false;
  if (disconnected) disconnected.hidden = true;
  $("walletAddress").textContent = walletState.address;
  if (chip) { chip.hidden = false; $("navWalletAddr").textContent = truncateAddress(walletState.address); }
  const onQms = walletState.chainId === QMS_CHAIN_ID;
  if (badge) {
    badge.textContent = onQms ? "QMS Testnet (19480)" : "Wrong network";
    badge.classList.toggle("badge-live", onQms);
  }
  $("walletChainLine").textContent = onQms
    ? "Chain: QMS Testnet, 19480. Balance read live with eth_getBalance."
    : "Chain: " + walletState.chainId + ". Switch to QMS Testnet (19480) to use QuantaGuard.";
  $("walletSwitchBtn").hidden = onQms;
  if (onQms && walletState.provider) {
    try {
      $("walletBalance").textContent = await fetchBalance(walletState.provider, walletState.address);
    } catch (err) {
      setWalletError("Could not read balance from the QMS RPC. Please try Refresh balance.");
    }
  }
}

function attachProviderEvents(provider) {
  if (!provider || typeof provider.on !== "function" || provider._quantaguardHooked) return;
  provider._quantaguardHooked = true;
  provider.on("accountsChanged", function (accounts) {
    if (!accounts || accounts.length === 0) {
      walletState.address = null;
      refreshWalletUI();
    } else {
      walletState.address = accounts[0];
      refreshWalletUI();
    }
  });
  provider.on("chainChanged", function (chainIdHex) {
    walletState.chainId = parseInt(chainIdHex, 16);
    refreshWalletUI();
  });
  provider.on("disconnect", function () {
    walletState.address = null;
    refreshWalletUI();
  });
}

async function connectWithProvider(provider, kind) {
  setWalletError("");
  setModalStatus("Requesting account access in your wallet...");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No account was returned by the wallet.");
  walletState.provider = provider;
  walletState.kind = kind;
  walletState.address = accounts[0];
  attachProviderEvents(provider);
  setModalStatus("Connected. Checking the network...");
  try {
    await ensureQmsChain(provider);
  } catch (chainErr) {
    setWalletError("Connected, but the wallet did not switch to QMS Testnet. Use the Switch button in the Wallet section.");
  }
  const chainHex = await provider.request({ method: "eth_chainId" });
  walletState.chainId = parseInt(chainHex, 16);
  await refreshWalletUI();
  closeWalletModal();
  showToast("Wallet connected: " + truncateAddress(walletState.address));
}

async function connectInjected() {
  if (!window.ethereum) {
    setModalStatus("No browser wallet detected here. Open this page inside a wallet in-app browser, or choose WalletConnect.", true);
    return;
  }
  try {
    await connectWithProvider(window.ethereum, "injected");
  } catch (err) {
    if (err && err.code === 4001) setModalStatus("Connection request rejected in the wallet.", true);
    else setModalStatus("Connection failed: " + (err && err.message ? err.message : "unknown error"), true);
  }
}

async function connectWalletConnect() {
  if (!WALLETCONNECT_PROJECT_ID) {
    setModalStatus("WalletConnect is not configured on this deployment yet. The browser wallet option works today.", true);
    return;
  }
  try {
    setModalStatus("Loading WalletConnect. A QR code or wallet prompt will appear...");
    if (!walletState.wcProvider) {
      const module = await import(WC_PROVIDER_CDN);
      const EthereumProvider = module.EthereumProvider || module.default;
      if (!EthereumProvider) throw new Error("WalletConnect provider failed to load.");
      walletState.wcProvider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [QMS_CHAIN_ID],
        showQrModal: true,
        rpcMap: { 19480: QMS_RPC },
        metadata: {
          name: "QuantaGuard",
          description: "PQ-ready ERC-4337 smart wallet for QMS. Testnet demo.",
          url: window.location.origin,
          icons: []
        }
      });
    }
    await walletState.wcProvider.connect();
    await connectWithProvider(walletState.wcProvider, "walletconnect");
  } catch (err) {
    setModalStatus("WalletConnect failed: " + (err && err.message ? err.message : "unknown error"), true);
  }
}

async function disconnectWallet() {
  try {
    if (walletState.kind === "walletconnect" && walletState.wcProvider) {
      await walletState.wcProvider.disconnect();
    }
  } catch (err) { /* local state reset below is enough */ }
  walletState.provider = null;
  walletState.kind = null;
  walletState.address = null;
  walletState.chainId = null;
  setWalletError("");
  refreshWalletUI();
  showToast("Wallet disconnected");
}

(function initWallet() {
  document.querySelectorAll("[data-connect-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (walletState.address) {
        document.querySelector("#wallet").scrollIntoView({ behavior: "smooth" });
      } else {
        openWalletModal();
      }
    });
  });
  const modal = $("walletModal");
  if (modal) {
    modal.addEventListener("click", function (e) { if (e.target === modal) closeWalletModal(); });
  }
  const closeBtn = $("walletModalClose");
  if (closeBtn) closeBtn.addEventListener("click", closeWalletModal);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeWalletModal(); });

  const injBtn = $("optInjected");
  if (injBtn) injBtn.addEventListener("click", connectInjected);
  const wcBtn = $("optWalletConnect");
  if (wcBtn) wcBtn.addEventListener("click", connectWalletConnect);

  const discBtn = $("walletDisconnectBtn");
  if (discBtn) discBtn.addEventListener("click", disconnectWallet);
  const refreshBtn = $("walletRefreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", refreshWalletUI);
  const switchBtn = $("walletSwitchBtn");
  if (switchBtn) switchBtn.addEventListener("click", async function () {
    if (!walletState.provider) return;
    try {
      await ensureQmsChain(walletState.provider);
      const chainHex = await walletState.provider.request({ method: "eth_chainId" });
      walletState.chainId = parseInt(chainHex, 16);
      setWalletError("");
      refreshWalletUI();
    } catch (err) {
      setWalletError("Network switch failed: " + (err && err.message ? err.message : "unknown error"));
    }
  });

  if (window.ethereum && typeof window.ethereum.request === "function") {
    window.ethereum.request({ method: "eth_accounts" }).then(function (accounts) {
      if (accounts && accounts.length > 0) {
        walletState.provider = window.ethereum;
        walletState.kind = "injected";
        walletState.address = accounts[0];
        attachProviderEvents(window.ethereum);
        return window.ethereum.request({ method: "eth_chainId" }).then(function (chainHex) {
          walletState.chainId = parseInt(chainHex, 16);
          refreshWalletUI();
        });
      }
    }).catch(function () { /* silent: no wallet session yet */ });
  }
  refreshModalOptions();
})();
