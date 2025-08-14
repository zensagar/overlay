// ==UserScript==
// @name         Vehicle Details Popup (Tampermonkey)
// @namespace    http://tampermonkey.net/
// @version      2025.08.13
// @description  Draggable right-side panel to capture VIN/LP/Date and inject into page fields by label text
// @author       zensagar
// @match        https://anduril.cors.amazon.dev/v5/all-tasks/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Styles (GM_addStyle) ----------
  GM_addStyle(`
    #custom-popup {
      position: fixed;
      top: 10%;
      right: 0;
      width: 320px;
      height: 85vh;
      padding: 18px 18px 12px 18px;
      background: linear-gradient(135deg, #fff 0%, #f7f7f7 100%);
      border-left: 4px solid #FF4F00;
      box-shadow: 0 8px 32px rgba(255, 79, 0, 0.10), 0 1.5px 4px rgba(0,0,0,0.10);
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      overflow-y: auto;
      z-index: 2147483647; /* max */
      border-radius: 12px 0 0 12px;
      transition: box-shadow 0.3s, border-color 0.3s, opacity 0.4s;
      cursor: move;
      opacity: 0;
    }
    #custom-popup:hover {
      box-shadow: 0 12px 32px rgba(255,79,0,0.18), 0 1.5px 4px rgba(0,0,0,0.13);
      border-left: 4px solid #FF4F00;
    }
    #custom-popup h4 {
      margin-top: 0;
      font-size: 16px;
      color: #FF4F00;
      letter-spacing: 0.5px;
    }
    #custom-popup label {
      cursor: pointer;
      color: #FF4F00;
      font-weight: 600;
    }
    #custom-popup input[type="text"],
    #custom-popup input[type="date"],
    #custom-popup select {
      width: 100%;
      padding: 7px 8px;
      font-size: 13px;
      border-radius: 6px;
      border: 1.5px solid #FF4F00;
      margin-top: 2px;
      margin-bottom: 8px;
      background: #fff;
      color: #FF4F00;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    #custom-popup input:focus, #custom-popup select:focus {
      border-color: #FF4F00;
      box-shadow: 0 0 0 2px rgba(255,79,0,0.2);
      outline: none;
      background: #fff7f0;
      color: #FF4F00;
    }
    #custom-popup button {
      padding: 5px 12px;
      font-size: 13px;
      border-radius: 6px;
      border: none;
      background: #FF4F00;
      color: #fff;
      margin-right: 6px;
      margin-bottom: 6px;
      transition: background 0.2s, box-shadow 0.2s, color 0.2s;
      box-shadow: 0 1px 4px rgba(255,79,0,0.2);
      cursor: pointer;
      font-weight: bold;
    }
    #custom-popup button:hover {
      background: #fff !important;
      color: #FF4F00 !important;
      box-shadow: 0 2px 8px rgba(255,79,0,0.3);
      border: 1.5px solid #FF4F00;
    }
    #custom-popup button:active {
      background: #FF4F00 !important;
      color: #fff !important;
    }
    #custom-popup button:disabled {
      background: #f7f7f7 !important;
      color: #FF4F00 !important;
      cursor: not-allowed !important;
      opacity: 0.7;
    }
    #custom-popup .vin-input:hover,
    #custom-popup .lp-input:hover,
    #custom-popup .date-input:hover { border-color: #FF4F00; }
    #custom-popup .vin-input, #custom-popup .lp-input, #custom-popup .date-input {
      background: #fff; color: #FF4F00;
    }
    #custom-popup .remove-btn {
      background: #dc3545; color: #fff; border: none; border-radius: 4px;
      margin-left: 6px; font-size: 14px; padding: 0 6px; cursor: pointer;
      user-select: none; line-height: 1; height: 22px;
    }
    #custom-popup .remove-btn:hover {
      background: #fff; color: #dc3545; border: 1.5px solid #dc3545;
    }
    #custom-popup #message {
      margin-top: 10px; font-size: 12px; color: #FF4F00; background: #fff7f0;
      border-radius: 4px; padding: 6px 10px; border: 1px solid #FF4F00; display: none;
    }
    #custom-popup .required { color: #FF4F00; font-weight: bold; }
    #custom-popup.minimized { height: 40px !important; overflow: hidden !important; }
    #custom-popup.minimized *:not(#minimize-popup) { display: none !important; }
    #custom-popup.minimized { min-width: 120px !important; max-width: 200px !important; cursor: pointer; }
    #minimize-popup {
      position:absolute;top:8px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#FF4F00;
    }
  `);

  // ---------- Label map ----------
  const labelTextMap = {
    "ctc-type": "CTC Type",
    "status-select": "CTC status",
    "vin-lp-date": "Vin lp issuedate",
    "other-doc-breakup": "other doc breakup",
    "rejection-reason": "rejection reason code",
    "new-asset-created": "new asset created",
    "special-type": "special type",
    "root-cause": "root cause",
    "email-sent": "email sent",
    "expiry-date": "expiration date",
    "final-expiry-date": "final expiry date",
    "flip-status": "Flip status"  // Changed to match exact case
  };

  // ---------- Helpers ----------
  const toTitleCase = (str) =>
    (str || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  function findInputByLabelText(expectedLabelText) {
    expectedLabelText = (expectedLabelText || "").toLowerCase().trim();
    const allFields = document.querySelectorAll('input, textarea, select');
    for (const field of allFields) {
      const labelId = field.getAttribute('aria-labelledby');
      if (!labelId) continue;
      const labelEl = document.getElementById(labelId);
      if (!labelEl) continue;
      const actualLabel = labelEl.textContent.trim().toLowerCase();
      if (actualLabel === expectedLabelText) return field;
    }
    return null;
  }

  function setFieldValueAndNotify(el, value) {
    if (!el) return;
    const tag = el.tagName;
    try {
      const proto =
        tag === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : tag === 'SELECT'
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;

      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(el, value);
      } else {
        el.value = value;
      }
    } catch {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitForInputAndInject(fieldKey, value) {
    const labelText = labelTextMap[fieldKey];
    if (!labelText) return;

    const tryInject = () => {
      const el = findInputByLabelText(labelText);
      if (el) {
        el.disabled = false;
        el.focus();
        setFieldValueAndNotify(el, value);
        return true;
      }
      return false;
    };

    if (tryInject()) return;

    const observer = new MutationObserver(() => {
      if (tryInject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function createInput(type, placeholder = "", isDefault = false) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginBottom = "4px";

    const input = document.createElement("input");
    input.type = type === "date" ? "date" : "text";
    input.placeholder = placeholder;
    input.className = type === "date" ? "date-input" : (type === "vin" ? "vin-input" : "lp-input");
    input.style.cssText = "flex-grow:1; padding: 4px; font-size: 10px; border: 1px solid #ccc; border-radius: 4px;";

    if (type === "vin") input.maxLength = 17;
    if (type === "lp") input.maxLength = 6;

    wrapper.appendChild(input);

    if (!isDefault) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "-";
      removeBtn.title = "Remove";
      removeBtn.className = "remove-ve-btn";
      removeBtn.addEventListener("click", () => {
        wrapper.remove();
        updateInputsDisabledState();
      });
      wrapper.appendChild(removeBtn);
    }

    return wrapper;
  }

  function initContainer(containerId, type, placeholder) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    container.appendChild(createInput(type, placeholder, true));
  }

  function updateInputsDisabledState() {
    const status = document.getElementById("status-select").value;

    ["other-doc-breakup", "new-asset-created"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = (status !== "approve");
    });

    const rootCause = document.getElementById("root-cause");
    if (rootCause) rootCause.disabled = false;

    ["vin-container", "lp-container", "date-container"].forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        Array.from(container.querySelectorAll("input,button")).forEach(el => {
          el.disabled = (status !== "approve");
        });
      }
    });

    ["add-vin", "add-lp", "add-date"].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) btn.disabled = (status !== "approve");
    });

    const statusSelect = document.getElementById("status-select");
    if (statusSelect) statusSelect.disabled = false;

    const rejectionReason = document.getElementById("rejection-reason");
    if (rejectionReason) rejectionReason.disabled = (status !== "reject");

    const expiryDate = document.getElementById("expiry-date");
    if (expiryDate) expiryDate.disabled = (status !== "approve");

    const finalExpiryDate = document.getElementById("final-expiry-date");
    if (finalExpiryDate) finalExpiryDate.disabled = true;  // Always disabled, it's read-only
  }

  function calculateFinalExpiryDate() {
    const ctcType = document.getElementById("ctc-type").value;
    const expiryDateInput = document.getElementById("expiry-date");
    const finalExpiryDate = document.getElementById("final-expiry-date");
    const dateContainer = document.getElementById("date-container");
    const firstIssueDate = dateContainer.querySelector("input").value;

    if (!ctcType) return;

    let baseDate;
    if (ctcType === "VCC") {
      if (!expiryDateInput.value) return;
      baseDate = new Date(expiryDateInput.value);
      baseDate.setMonth(baseDate.getMonth() + 1);
      baseDate.setDate(30);
    } else if (ctcType === "AFC") {
      if (!firstIssueDate) return;
      baseDate = new Date(firstIssueDate);
      baseDate.setFullYear(baseDate.getFullYear() + 1);
      baseDate.setMonth(baseDate.getMonth() + 1);
      baseDate.setDate(15);
    }

    if (baseDate) {
      const yyyy = baseDate.getFullYear();
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const dd = String(baseDate.getDate()).padStart(2, '0');
      finalExpiryDate.value = `${yyyy}-${mm}-${dd}`;
    }
  }

  function injectVinLpDate() {
    const ctcType = document.getElementById("ctc-type").value;
    const status = document.getElementById("status-select").value;

    const vinInputs = Array.from(document.querySelectorAll('#vin-container input')).map(i => i.value.trim());
    const lpInputs  = Array.from(document.querySelectorAll('#lp-container input')).map(i => i.value.trim());
    const dateInputs = Array.from(document.querySelectorAll('#date-container input')).map(i => i.value.trim());

    const maxRows = Math.max(vinInputs.length, lpInputs.length, dateInputs.length);
    const lines = [];

    for (let i = 0; i < maxRows; i++) {
      const vin = vinInputs[i] || "";
      const lp  = lpInputs[i]  || "";
      let date  = dateInputs[i] || "";

      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split("-");
        date = `${y}/${m}/${d}`;
      }
      if (vin || lp || date) {
        lines.push(`${i + 1}. VIN - ${vin}${lp ? ', LP - ' + lp : ''}${date ? ', ' + toTitleCase('issue date') + ' - ' + date : ''}`);
      }
    }

    const formattedLine = lines.join('\n');

    const specialTypeValue = document.getElementById("special-type")?.value || "";
    const rootCauseSelect = document.getElementById("root-cause");
    const rootCauseOther  = document.getElementById("root-cause-other");
    const rootCauseValue    = rootCauseSelect.value === "Others" ? (rootCauseOther.value || "") : (rootCauseSelect.value || "");
    const emailSentValue  = document.getElementById("email-sent")?.value || "";
    const finalExpiryDateValue = document.getElementById("final-expiry-date")?.value || "";
    const otherDocBreakup = document.getElementById("other-doc-breakup")?.value || "";
    const rejectionReason = document.getElementById("rejection-reason")?.value || "";
    const newAssetCreated = document.getElementById("new-asset-created")?.value || "";
    const flipStatusValue = document.getElementById("flip-status")?.value || "";

    waitForInputAndInject("ctc-type", (ctcType || "").toUpperCase());
    waitForInputAndInject("status-select", toTitleCase(status));
    waitForInputAndInject("vin-lp-date", formattedLine);
    waitForInputAndInject("other-doc-breakup", otherDocBreakup);
    waitForInputAndInject("rejection-reason", rejectionReason);
    waitForInputAndInject("new-asset-created", newAssetCreated);
    waitForInputAndInject("root-cause", rootCauseValue);
    waitForInputAndInject("email-sent", emailSentValue);
    waitForInputAndInject("expiry-date", finalExpiryDateValue);
    waitForInputAndInject("special-type", specialTypeValue);
    waitForInputAndInject("flip-status", flipStatusValue);
  }

  function createPopup() {
    if (document.getElementById('custom-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'custom-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Vehicle Details');
    popup.innerHTML = `
      <h4>Vehicle Details</h4>

      <div id="rejection-reason-container" style="margin-bottom: 15px; display:none;">
        <label for="rejection-reason">Rejection Reason Code:</label><br>
        <select id="rejection-reason">
          <option value="" selected disabled>Select a reason</option>
          <option value="Invalid Document">Invalid Document</option>
          <option value="Expired Certifcate">Expired Certifcate</option>
          <option value="Incomplete Information">Incomplete Information</option>
          <option value="Not Aunthentic">Not Aunthentic</option>
          <option value="Unclear/Illegible">Unclear/Illegiable</option>
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="status-select">Status:</label><br>
        <select id="status-select">
          <option value="" selected disabled>Select the status</option>
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="ctc-type">CTC Type:</label><br>
        <select id="ctc-type">
          <option value="" selected disabled>Select CTC type</option>
          <option value="AFC">AFC</option>
          <option value="VCC">VCC</option>
          <option value="Others">Others</option>
        </select>
      </div>

      <div style="margin-bottom: 10px;">
        <label>VIN: <span class="required">*</span></label>
        <div id="vin-container"></div>
        <button id="add-vin">+</button>
      </div>

      <div style="margin-bottom: 10px;">
        <label>LP:</label>
        <div id="lp-container"></div>
        <button id="add-lp">+</button>
      </div>

      <div style="margin-bottom: 10px;">
        <label>Issue Date: <span class="required">*</span></label>
        <div id="date-container"></div>
        <button id="add-date">+</button>
      </div>

      <div id="expiry-date-section" style="margin-bottom: 10px; display: none;">
        <label for="expiry-date">Expiry Date: <span class="required">*</span></label>
        <input id="expiry-date" type="date" />
      </div>

      <div id="final-expiry-date-section" style="margin-bottom: 10px;">
        <label for="final-expiry-date">Final Expiry Date:</label>
        <input id="final-expiry-date" type="date" disabled />
      </div>

      <div id="special-type-section" style="margin-bottom: 10px; display: none;">
        <label for="special-type">Special Type:</label><br>
        <input id="special-type" type="text" placeholder="Enter special type">
      </div>

      <div style="margin-bottom: 10px;">
        <label for="root-cause">Root Cause:</label><br>
        <select id="root-cause">
          <option value="" selected disabled>Select a root cause</option>
          <option value="Company Name Mismatch">Company Name Mismatch</option>
          <option value="TBR">TBR</option>
          <option value="Cab Card">Cab Card</option>
          <option value="LP NA|PA|Others">LP NA|PA|Others</option>
          <option value="Others">Others</option>
        </select>
        <input id="root-cause-other" type="text" placeholder="Please specify" style="display:none; margin-top:6px;" />
      </div>

      <div style="margin-bottom: 10px;">
        <label for="other-doc-breakup">Other Doc Breakup:</label><br>
        <input id="other-doc-breakup" type="text" placeholder="Enter other doc breakup">
      </div>

      <div style="margin-bottom: 10px;">
        <label for="new-asset-created">New Asset Created:</label><br>
        <select id="new-asset-created">
          <option value="" selected disabled>Select Yes or No</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <div style="margin-bottom: 10px;">
        <label for="email-sent">Email Sent: <span class="required">*</span></label><br>
        <select id="email-sent">
          <option value="" selected disabled>Select Yes or No</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <!-- Added Flip Status dropdown with exact label text -->
      <div style="margin-bottom: 10px;">
        <label for="flip-status">Flip status:</label><br>
        <select id="flip-status">
          <option value="" selected disabled>Select Flip status</option>
          <option value="Yes- 100% match">Yes- 100% match</option>
          <option value="Yes- Already flipped">Yes- Already flipped</option>
          <option value="New AFC< 100% match">New AFC< 100% match</option>
        </select>
      </div>

      <button id="submit" style="width: 100%;">Submit</button>
      <button id="reset" style="width: 100%; background: #64748b;">Reset</button>
      <p id="message">Values submitted successfully!</p>
      <button id="minimize-popup" title="Minimize">&#8211;</button>
    `;

    document.body.appendChild(popup);
    requestAnimationFrame(() => (popup.style.opacity = "1"));

    const statusSelect = document.getElementById("status-select");
    const rejectionReasonContainer = document.getElementById("rejection-reason-container");
    const ctcTypeSelect = document.getElementById("ctc-type");
    const expiryDateSection = document.getElementById("expiry-date-section");
    const specialTypeSection = document.getElementById("special-type-section");
    const rootCauseSelect = document.getElementById("root-cause");
    const rootCauseOther = document.getElementById("root-cause-other");

    statusSelect.addEventListener("change", () => {
      if (statusSelect.value === "approve") {
        specialTypeSection.style.display = "block";
      } else {
        specialTypeSection.style.display = "none";
        const sp = document.getElementById("special-type");
        if (sp) sp.value = "";
      }
      if (statusSelect.value === "reject") {
        rejectionReasonContainer.style.display = "block";
      } else {
        rejectionReasonContainer.style.display = "none";
        const rr = document.getElementById("rejection-reason");
        if (rr) rr.value = "";
      }
      updateInputsDisabledState();
    });

    ctcTypeSelect.addEventListener("change", () => {
      const isVCC = ctcTypeSelect.value === "VCC";
      expiryDateSection.style.display = isVCC ? "block" : "none";

      if (!isVCC) {
        const ed = document.getElementById("expiry-date");
        if (ed) ed.value = "";
      }

      calculateFinalExpiryDate();
    });

    rootCauseSelect.addEventListener("change", () => {
      if (rootCauseSelect.value === "Others") {
        rootCauseOther.style.display = "block";
      } else {
        rootCauseOther.style.display = "none";
        rootCauseOther.value = "";
      }
    });

    // Add event listeners to recalculate final expiry date
    document.getElementById("expiry-date").addEventListener("change", calculateFinalExpiryDate);
    document.getElementById("date-container").addEventListener("change", calculateFinalExpiryDate);

    initContainer("vin-container", "vin", "VIN");
    initContainer("lp-container", "lp", "LP");
    initContainer("date-container", "date", "");

    document.getElementById("add-vin").addEventListener("click", () => {
      document.getElementById("vin-container").appendChild(createInput("vin", "VIN", false));
      updateInputsDisabledState();
    });

    document.getElementById("add-lp").addEventListener("click", () => {
      const lpContainer = document.getElementById("lp-container");
      if (lpContainer.querySelectorAll("input").length < 6) {
        lpContainer.appendChild(createInput("lp", "LP", false));
        updateInputsDisabledState();
      }
    });

    document.getElementById("add-date").addEventListener("click", () => {
      const dateContainer = document.getElementById("date-container");
      const newInputWrapper = createInput("date", "", false);
      dateContainer.appendChild(newInputWrapper);

      const ctcType = document.getElementById("ctc-type").value;
      if (ctcType === "AFC") {
        const firstDateInput = dateContainer.querySelector("input[type='date']");
        const newDateInput = newInputWrapper.querySelector("input[type='date']");
        if (firstDateInput && newDateInput) {
          newDateInput.value = firstDateInput.value;
        }
      }
      updateInputsDisabledState();
      calculateFinalExpiryDate();
    });

    function validateBeforeSubmit() {
      const status = statusSelect.value;

      if (status === "approve") {
        const vinInputs = document.querySelectorAll("#vin-container input");
        const vinValues = Array.from(vinInputs).map(i => i.value.trim());

        for (let i = 0; i < vinValues.length; i++) {
          if (!vinValues[i]) {
            alert(`Please fill VIN in row ${i + 1}.`);
            return false;
          }
          if (vinValues[i].length !== 17) {
            alert(`VIN in row ${i + 1} must be exactly 17 characters.`);
            return false;
          }
        }

        const dateInputs = document.querySelectorAll("#date-container input");
        const dateValues = Array.from(dateInputs).map(i => i.value.trim());
        for (let i = 0; i < dateValues.length; i++) {
          if (!dateValues[i]) {
            alert(`Please fill Issue Date in row ${i + 1}.`);
            return false;
          }
        }

        if (document.getElementById("ctc-type").value === "VCC") {
          const expiryDate = document.getElementById("expiry-date").value.trim();
          if (!expiryDate) {
            alert("Please fill Expiry Date for VCC.");
            return false;
          }
        }

        const emailSent = document.getElementById("email-sent").value;
        if (!emailSent) {
          alert("Please select a value for Email Sent.");
          return false;
        }
      }

      if (status === "reject") {
        const reason = document.getElementById("rejection-reason").value.trim();
        if (!reason) {
          alert("Please enter Rejection Reason Code.");
          return false;
        }
      }
      return true;
    }

    document.getElementById("submit").addEventListener("click", () => {
      if (!validateBeforeSubmit()) return;

      injectVinLpDate();

      const msg = document.getElementById("message");
      msg.style.display = "block";
      setTimeout(() => (msg.style.display = "none"), 3500);
    });

    document.getElementById("reset").addEventListener("click", () => {
      statusSelect.value = "";
      rejectionReasonContainer.style.display = "none";
      document.getElementById("rejection-reason").value = "";
      document.getElementById("ctc-type").value = "";
      document.getElementById("root-cause").value = "";
      document.getElementById("other-doc-breakup").value = "";
      document.getElementById("new-asset-created").value = "";
      document.getElementById("email-sent").value = "";
      document.getElementById("expiry-date").value = "";
      document.getElementById("final-expiry-date").value = "";
      document.getElementById("flip-status").value = "";

      initContainer("vin-container", "vin", "VIN");
      initContainer("lp-container", "lp", "LP");
      initContainer("date-container", "date", "");

      updateInputsDisabledState();
      document.getElementById("message").style.display = "none";
    });

    updateInputsDisabledState();

    // Dragging
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    popup.addEventListener('mousedown', function(e) {
      if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'LABEL'].includes(e.target.tagName)) return;
      isDragging = true;
      const rect = popup.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      popup.style.transition = 'none';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging) {
        popup.style.left = (e.clientX - offsetX) + 'px';
        popup.style.top = (e.clientY - offsetY) + 'px';
        popup.style.right = 'auto';
        popup.style.bottom = 'auto';
        popup.style.position = 'fixed';
      }
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      popup.style.transition = '';
      document.body.style.userSelect = '';
    });

    // Minimize
    const minimizeBtn = document.getElementById("minimize-popup");
    minimizeBtn.addEventListener("click", () => {
      const p = document.getElementById("custom-popup");
      if (!p) return;
      if (!p.classList.contains("minimized")) {
        p.classList.add("minimized");
        p.style.height = "40px";
        p.style.overflow = "hidden";
        minimizeBtn.innerHTML = "&#9633;"; // Restore icon
        minimizeBtn.title = "Restore";
      } else {
        p.classList.remove("minimized");
        p.style.height = "85vh";
        p.style.overflowY = "auto";
        minimizeBtn.innerHTML = "&#8211;"; // Minimize icon
        minimizeBtn.title = "Minimize";
      }
    });
  }

  // ---------- Bootstrapping & SPA resilience ----------
  function ensurePopup() {
    if (!document.getElementById('custom-popup')) createPopup();
  }

  function waitForBodyThenInit() {
    if (document.body) {
      ensurePopup();
    } else {
      const obs = new MutationObserver(() => {
        if (document.body) { obs.disconnect(); ensurePopup(); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  // Handle SPA route changes
  const spaObserver = new MutationObserver(() => {
    // If the page re-rendered and removed our node, re-add it.
    ensurePopup();
  });
  spaObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Keyboard toggle (Alt+V)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v') {
      const p = document.getElementById('custom-popup');
      if (p) {
        p.style.display = (p.style.display === 'none') ? '' : 'none';
      } else {
        createPopup();
      }
    }
  });

  // Start
  waitForBodyThenInit();
})();
