const WHATSAPP_NUMBER = "918668969538";

const state = {
  menu: [],
  cart: new Map(),
  category: "All",
  query: "",
  signaturesOnly: false
};

const reviews = [
  {
    quote: "The kebabs had a proper smoky finish, and the outdoor seating felt relaxed even on a busy night.",
    name: "Google Review Highlight"
  },
  {
    quote: "Butter chicken, garlic naan, and paneer tikka were all served hot. Great spot near Crusher Chowk.",
    name: "Local Guest Snapshot"
  },
  {
    quote: "Good Mughlai flavors, quick takeaway, and the tandoor items are the clear winners.",
    name: "Takeaway Review"
  }
];

const categoryTabs = document.querySelector("#categoryTabs");
const menuGrid = document.querySelector("#menuGrid");
const menuSearch = document.querySelector("#menuSearch");
const signatureFilter = document.querySelector("#signatureFilter");
const cartItems = document.querySelector("#cartItems");
const cartCount = document.querySelector("#cartCount");
const cartSubtotal = document.querySelector("#cartSubtotal");
const cartPackaging = document.querySelector("#cartPackaging");
const cartTotal = document.querySelector("#cartTotal");
const orderForm = document.querySelector("#orderForm");
const payOnlineButton = document.querySelector("#payOnlineButton");
const orderMessage = document.querySelector("#orderMessage");
const reservationForm = document.querySelector("#reservationForm");
const reservationMessage = document.querySelector("#reservationMessage");
const reservationWhatsApp = document.querySelector("#reservationWhatsApp");
const statusLabel = document.querySelector("#statusLabel");
const statusDot = document.querySelector("#statusDot");
const statusTicker = document.querySelector("#statusTicker");
const reviewQuote = document.querySelector("#reviewQuote");
const reviewName = document.querySelector("#reviewName");
const chatPanel = document.querySelector("#chatPanel");
const openChat = document.querySelector("#openChat");
const closeChat = document.querySelector("#closeChat");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatLog = document.querySelector("#chatLog");
const chatStatus = document.querySelector("#chatStatus");

function currency(value) {
  return `&#8377;${value}`;
}

function getWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadMenu() {
  try {
    return await api("/api/menu");
  } catch (error) {
    const response = await fetch("menu.json");
    if (!response.ok) {
      throw new Error("The menu could not be loaded from the server.");
    }
    return response.json();
  }
}

function saveLocalRecord(key, prefix, payload) {
  const records = JSON.parse(localStorage.getItem(key) || "[]");
  const record = {
    ...payload,
    id: `${prefix}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "saved-locally"
  };
  records.unshift(record);
  localStorage.setItem(key, JSON.stringify(records));
  return record;
}

function getTandoorStatus(date = new Date()) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const open = 12 * 60;
  const lastOrders = 22 * 60 + 30;
  const close = 23 * 60;

  if (totalMinutes >= open && totalMinutes < lastOrders) {
    return {
      label: "Grill is Hot",
      ticker: "Grill is Hot (Open) | Last Orders at 10:30 PM | Kitchen Resting after 11:00 PM",
      colorClass: "bg-success"
    };
  }

  if (totalMinutes >= lastOrders && totalMinutes < close) {
    return {
      label: "Last Orders for Tandoor",
      ticker: "Last Orders for Tandoor | Grill reopens at noon | Kitchen closes at 11:00 PM",
      colorClass: "bg-warning"
    };
  }

  return {
    label: "Kitchen Resting",
    ticker: "Kitchen Resting (Closed) | Grill is Hot from 12:00 PM | Last Orders at 10:30 PM",
    colorClass: "bg-danger"
  };
}

function updateStatus() {
  const status = getTandoorStatus();
  statusLabel.textContent = status.label;
  statusTicker.textContent = status.ticker;
  statusDot.className = `rounded-circle flex-shrink-0 mt-2 ${status.colorClass}`;
  statusDot.style.width = "1rem";
  statusDot.style.height = "1rem";
}

function spiceMeter(level) {
  if (!level) return '<span class="small text-muted-warm">Mild</span>';
  return Array.from({ length: level }, () => '<span aria-hidden="true">Hot</span>').join(" ");
}

function renderTabs() {
  const categories = ["All", ...new Set(state.menu.map((item) => item.category))];
  categoryTabs.innerHTML = categories
    .map((category) => {
      const active = category === state.category;
      return `
        <button
          class="btn rounded-pill flex-shrink-0 ${active ? "btn-warning text-dark" : "btn-outline-warm"}"
          type="button"
          data-category="${category}"
        >
          ${category}
        </button>
      `;
    })
    .join("");
}

function getFilteredMenu() {
  const query = state.query.trim().toLowerCase();
  return state.menu.filter((item) => {
    const matchesCategory = state.category === "All" || item.category === state.category;
    const matchesSignature = !state.signaturesOnly || item.signature;
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query);

    return matchesCategory && matchesSignature && matchesQuery;
  });
}

function renderMenu() {
  const items = getFilteredMenu();
  menuGrid.innerHTML =
    items
      .map(
        (item) => `
          <div class="col-md-6">
            <article class="panel p-4 h-100 d-flex flex-column">
              <div class="d-flex flex-wrap justify-content-between gap-3">
                <div class="min-w-0">
                  <p class="kicker mb-2">${item.category}</p>
                  <h3 class="h4 text-light mb-0">${item.name}</h3>
                </div>
                <p class="badge rounded-pill text-bg-dark border border-warning border-opacity-25 text-warning fs-6 align-self-start">${currency(item.price)}</p>
              </div>
              <p class="text-muted-warm lh-lg mt-3 mb-0 flex-grow-1">${item.description}</p>
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
                <div class="small text-flame" aria-label="Spice level ${item.spice} of 3">${spiceMeter(item.spice)}</div>
                <span class="small text-muted-warm">${item.rating.toFixed(1)} rated</span>
              </div>
              <button class="add-to-cart btn btn-ember rounded-pill w-100 mt-4 py-3" type="button" data-id="${item.id}">
                Add to Cart
              </button>
            </article>
          </div>
        `
      )
      .join("") || `<div class="col-12"><p class="panel p-4 text-muted-warm mb-0">No dishes matched that search.</p></div>`;
}

function getCartLines() {
  return [...state.cart.entries()]
    .map(([id, quantity]) => {
      const item = state.menu.find((menuItem) => menuItem.id === id);
      if (!item) return null;
      return {
        id,
        name: item.name,
        price: item.price,
        quantity,
        lineTotal: item.price * quantity
      };
    })
    .filter(Boolean);
}

function getCartTotals() {
  const lines = getCartLines();
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const packaging = lines.length ? 20 : 0;
  return {
    lines,
    subtotal,
    packaging,
    total: subtotal + packaging
  };
}

function renderCart() {
  const totals = getCartTotals();
  const quantity = totals.lines.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = `${quantity} ${quantity === 1 ? "item" : "items"}`;

  cartItems.innerHTML =
    totals.lines
      .map(
        (item) => `
          <div class="rounded border border-white border-opacity-10 bg-white bg-opacity-10 p-3">
            <div class="d-flex justify-content-between gap-3">
              <div class="min-w-0">
                <p class="fw-semibold text-light mb-1">${item.name}</p>
                <p class="small text-muted-warm mb-0">${currency(item.price)} x ${item.quantity}</p>
              </div>
              <p class="fw-semibold text-flame flex-shrink-0 mb-0">${currency(item.lineTotal)}</p>
            </div>
            <div class="d-flex align-items-center gap-2 mt-3">
              <button class="cart-step btn btn-sm btn-outline-warm rounded-circle" type="button" data-id="${item.id}" data-step="-1" aria-label="Decrease ${item.name}" style="width: 2.35rem; height: 2.35rem">-</button>
              <span class="small text-muted-warm text-center" style="min-width: 2rem">${item.quantity}</span>
              <button class="cart-step btn btn-sm btn-outline-warm rounded-circle" type="button" data-id="${item.id}" data-step="1" aria-label="Increase ${item.name}" style="width: 2.35rem; height: 2.35rem">+</button>
            </div>
          </div>
        `
      )
      .join("") || `<p class="rounded border border-white border-opacity-10 bg-white bg-opacity-10 p-3 small text-muted-warm mb-0">Your cart is empty. Add smoky favorites from the menu.</p>`;

  cartSubtotal.innerHTML = currency(totals.subtotal);
  cartPackaging.innerHTML = currency(totals.packaging);
  cartTotal.innerHTML = currency(totals.total);
}

function setCartQuantity(id, quantity) {
  if (quantity <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, quantity);
  }
  renderCart();
}

function getOrderPayload() {
  const totals = getCartTotals();
  if (!totals.lines.length) {
    throw new Error("Add at least one dish before placing the order.");
  }
  if (!orderForm.reportValidity()) {
    throw new Error("Please complete your contact details.");
  }

  const formData = new FormData(orderForm);
  return {
    customer: {
      name: formData.get("name").trim(),
      phone: formData.get("phone").trim()
    },
    fulfillment: formData.get("fulfillment"),
    notes: formData.get("notes").trim(),
    items: totals.lines.map(({ id, quantity }) => ({ id, quantity }))
  };
}

async function submitOrder(payment = {}) {
  const payload = { ...getOrderPayload(), payment };
  const order = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.cart.clear();
  renderCart();
  orderForm.reset();
  return order;
}

async function placeCounterOrder() {
  orderMessage.textContent = "Placing your order...";
  try {
    const order = await submitOrder({
      provider: "counter",
      status: "pay-at-counter"
    });
    orderMessage.innerHTML = `Order ${order.id} placed. Pay ${currency(order.total)} at the counter.`;
  } catch (error) {
    const totals = getCartTotals();
    const fallbackOrder = saveLocalRecord("hotelTandoorCornerOrders", "LOCAL-ORD", {
      items: totals.lines,
      subtotal: totals.subtotal,
      packaging: totals.packaging,
      total: totals.total
    });
    orderMessage.innerHTML = `${error.message} Saved locally as ${fallbackOrder.id}.`;
  }
}

function openRazorpay(paymentOrder, payload) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay checkout script is unavailable."));
      return;
    }

    const checkout = new window.Razorpay({
      key: paymentOrder.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "Hotel Tandoor Corner",
      description: "Online food order",
      order_id: paymentOrder.orderId,
      prefill: {
        name: payload.customer.name,
        contact: payload.customer.phone
      },
      theme: {
        color: "#f97316"
      },
      handler: async (response) => {
        try {
          const verification = await api("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify({
              provider: "razorpay",
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });
          resolve(verification);
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled."))
      }
    });

    checkout.open();
  });
}

async function payOnline() {
  let payload;
  try {
    payload = getOrderPayload();
  } catch (error) {
    orderMessage.textContent = error.message;
    return;
  }

  payOnlineButton.disabled = true;
  orderMessage.textContent = "Starting payment...";
  try {
    const paymentOrder = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({ items: payload.items })
    });

    let payment;
    if (paymentOrder.provider === "demo") {
      orderMessage.textContent = "Demo payment approved. Saving order...";
      payment = await api("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          provider: "demo",
          paymentId: `DEMO-${Date.now()}`
        })
      });
    } else {
      payment = await openRazorpay(paymentOrder, payload);
      orderMessage.textContent = "Payment received. Saving order...";
    }

    const order = await submitOrder(payment);
    orderMessage.innerHTML = `Payment received. Order ${order.id} placed for ${currency(order.total)}.`;
  } catch (error) {
    orderMessage.textContent = error.message;
  } finally {
    payOnlineButton.disabled = false;
  }
}

function startReviewCarousel() {
  let index = 0;

  function renderReview() {
    const review = reviews[index % reviews.length];
    reviewQuote.textContent = `"${review.quote}"`;
    reviewName.textContent = review.name;
    index += 1;
  }

  renderReview();
  setInterval(renderReview, 4200);
}

function appendChatMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = escapeHtml(text);
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setChatOpen(open) {
  chatPanel.classList.toggle("is-open", open);
  openChat.setAttribute("aria-expanded", String(open));
  if (open) {
    chatInput.focus();
  }
}

categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderTabs();
  renderMenu();
});

menuGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".add-to-cart");
  if (!button) return;
  const id = button.dataset.id;
  setCartQuantity(id, (state.cart.get(id) || 0) + 1);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest(".cart-step");
  if (!button) return;
  const id = button.dataset.id;
  const step = Number(button.dataset.step);
  setCartQuantity(id, (state.cart.get(id) || 0) + step);
});

menuSearch.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderMenu();
});

signatureFilter.addEventListener("click", () => {
  state.signaturesOnly = !state.signaturesOnly;
  signatureFilter.setAttribute("aria-pressed", String(state.signaturesOnly));
  signatureFilter.classList.toggle("btn-warning", state.signaturesOnly);
  signatureFilter.classList.toggle("text-dark", state.signaturesOnly);
  signatureFilter.classList.toggle("btn-outline-warm", !state.signaturesOnly);
  renderMenu();
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await placeCounterOrder();
});

payOnlineButton.addEventListener("click", payOnline);

openChat.addEventListener("click", () => {
  setChatOpen(true);
});

closeChat.addEventListener("click", () => {
  setChatOpen(false);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  appendChatMessage("user", message);
  chatInput.value = "";
  chatStatus.textContent = "Thinking...";
  chatInput.disabled = true;

  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message })
    });
    appendChatMessage("bot", response.reply);
    chatStatus.textContent = response.provider === "openai" ? "Answered by AI." : "Answered by local assistant.";
  } catch (error) {
    appendChatMessage("bot", "Sorry, I could not answer that right now. Please call 8668969538 for quick help.");
    chatStatus.textContent = error.message;
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
});

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(reservationForm);
  const payload = {
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    date: formData.get("date"),
    time: formData.get("time"),
    people: Number(formData.get("people")),
    seating: formData.get("seating"),
    notes: formData.get("notes").trim()
  };

  reservationMessage.textContent = "Saving reservation...";
  reservationWhatsApp.classList.add("d-none");
  try {
    const reservation = await api("/api/reservations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    reservationMessage.textContent = `Reservation ${reservation.id} received for ${payload.people} people.`;
    reservationWhatsApp.href = getWhatsAppUrl(
      `I'd like to book an outdoor table for ${payload.people} people on ${payload.date} at ${payload.time}. Reservation ID: ${reservation.id}.`
    );
    reservationWhatsApp.classList.remove("d-none");
  } catch (error) {
    const reservation = saveLocalRecord("hotelTandoorCornerReservations", "LOCAL-RSV", payload);
    reservationMessage.textContent = `Reservation ${reservation.id} saved on this browser for ${payload.people} people.`;
    reservationWhatsApp.href = getWhatsAppUrl(
      `I'd like to book an outdoor table for ${payload.people} people on ${payload.date} at ${payload.time}. Reservation ID: ${reservation.id}.`
    );
    reservationWhatsApp.classList.remove("d-none");
  }
  reservationForm.reset();
});

async function initMenu() {
  try {
    state.menu = await loadMenu();
  } catch (error) {
    menuGrid.innerHTML = `<div class="col-12"><p class="alert alert-danger">${error.message}</p></div>`;
    return;
  }

  renderTabs();
  renderMenu();
  renderCart();
}

updateStatus();
setInterval(updateStatus, 60000);
startReviewCarousel();
initMenu();
