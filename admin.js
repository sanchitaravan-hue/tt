const state = {
  orders: [],
  reservations: [],
  token: localStorage.getItem("hotelAdminToken") || ""
};

const loginForm = document.querySelector("#loginForm");
const adminToken = document.querySelector("#adminToken");
const loginMessage = document.querySelector("#loginMessage");
const refreshButton = document.querySelector("#refreshButton");
const orderCount = document.querySelector("#orderCount");
const revenueTotal = document.querySelector("#revenueTotal");
const paidCount = document.querySelector("#paidCount");
const reservationCount = document.querySelector("#reservationCount");
const ordersTable = document.querySelector("#ordersTable");
const ordersCards = document.querySelector("#ordersCards");
const reservationsTable = document.querySelector("#reservationsTable");
const reservationsCards = document.querySelector("#reservationsCards");

const orderStatuses = ["received", "preparing", "ready", "completed", "cancelled"];
const reservationStatuses = ["requested", "confirmed", "seated", "completed", "cancelled"];

function currency(value) {
  return `&#8377;${value || 0}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": state.token,
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function statusSelect(type, id, value, statuses) {
  return `
    <select class="form-select form-select-sm status-select" data-type="${type}" data-id="${id}">
      ${statuses.map((status) => `<option value="${status}" ${status === value ? "selected" : ""}>${status}</option>`).join("")}
    </select>
  `;
}

function renderSummary() {
  const paidOrders = state.orders.filter((order) => order.paymentStatus === "paid");
  const revenue = state.orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  orderCount.textContent = state.orders.length;
  revenueTotal.innerHTML = currency(revenue);
  paidCount.textContent = paidOrders.length;
  reservationCount.textContent = state.reservations.length;
}

function renderOrders() {
  ordersTable.innerHTML =
    state.orders
      .map(
        (order) => `
          <tr>
            <td>
              <div class="fw-semibold">${order.id}</div>
              <div class="small text-muted-warm">${formatDate(order.createdAt)}</div>
            </td>
            <td>
              <div>${order.customer?.name || ""}</div>
              <div class="small text-muted-warm">${order.customer?.phone || ""}</div>
              <div class="small text-muted-warm">${order.fulfillment || ""}</div>
            </td>
            <td class="small">${(order.items || []).map((item) => `${item.quantity} x ${item.name}`).join("<br>")}</td>
            <td class="fw-semibold">${currency(order.total)}</td>
            <td>
              <span class="badge ${order.paymentStatus === "paid" ? "text-bg-success" : "text-bg-secondary"}">${order.paymentStatus || "pending"}</span>
              <div class="small text-muted-warm">${order.paymentProvider || ""}</div>
            </td>
            <td>${statusSelect("order", order.id, order.status, orderStatuses)}</td>
          </tr>
        `
      )
      .join("") || `<tr><td colspan="6" class="text-muted-warm p-4">No orders yet.</td></tr>`;

  ordersCards.innerHTML =
    state.orders
      .map(
        (order) => `
          <article class="rounded border border-white border-opacity-10 bg-white bg-opacity-10 p-3">
            <div class="d-flex justify-content-between gap-3">
              <div>
                <p class="fw-semibold mb-1">${order.id}</p>
                <p class="small text-muted-warm mb-0">${formatDate(order.createdAt)}</p>
              </div>
              <p class="fw-semibold text-warning mb-0">${currency(order.total)}</p>
            </div>
            <p class="mt-3 mb-1">${order.customer?.name || ""} <span class="text-muted-warm">${order.customer?.phone || ""}</span></p>
            <p class="small text-muted-warm mb-2">${(order.items || []).map((item) => `${item.quantity} x ${item.name}`).join(", ")}</p>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <span class="badge ${order.paymentStatus === "paid" ? "text-bg-success" : "text-bg-secondary"}">${order.paymentStatus || "pending"}</span>
              <span class="badge text-bg-dark">${order.fulfillment || ""}</span>
            </div>
            ${statusSelect("order", order.id, order.status, orderStatuses)}
          </article>
        `
      )
      .join("") || `<p class="text-muted-warm mb-0">No orders yet.</p>`;
}

function renderReservations() {
  reservationsTable.innerHTML =
    state.reservations
      .map(
        (reservation) => `
          <tr>
            <td>
              <div class="fw-semibold">${reservation.id}</div>
              <div class="small text-muted-warm">${formatDate(reservation.createdAt)}</div>
            </td>
            <td>
              <div>${reservation.name}</div>
              <div class="small text-muted-warm">${reservation.phone}</div>
            </td>
            <td>${reservation.date} ${reservation.time}</td>
            <td>${reservation.people}</td>
            <td>${reservation.seating}</td>
            <td>${statusSelect("reservation", reservation.id, reservation.status, reservationStatuses)}</td>
          </tr>
        `
      )
      .join("") || `<tr><td colspan="6" class="text-muted-warm p-4">No reservations yet.</td></tr>`;

  reservationsCards.innerHTML =
    state.reservations
      .map(
        (reservation) => `
          <article class="rounded border border-white border-opacity-10 bg-white bg-opacity-10 p-3">
            <div class="d-flex justify-content-between gap-3">
              <div>
                <p class="fw-semibold mb-1">${reservation.id}</p>
                <p class="small text-muted-warm mb-0">${formatDate(reservation.createdAt)}</p>
              </div>
              <p class="badge text-bg-warning text-dark align-self-start">${reservation.people} people</p>
            </div>
            <p class="mt-3 mb-1">${reservation.name} <span class="text-muted-warm">${reservation.phone}</span></p>
            <p class="small text-muted-warm mb-3">${reservation.date} at ${reservation.time} | ${reservation.seating}</p>
            ${statusSelect("reservation", reservation.id, reservation.status, reservationStatuses)}
          </article>
        `
      )
      .join("") || `<p class="text-muted-warm mb-0">No reservations yet.</p>`;
}

function render() {
  renderSummary();
  renderOrders();
  renderReservations();
}

async function loadAdminData() {
  if (!state.token) {
    loginMessage.textContent = "Enter the admin token to load data.";
    return;
  }

  loginMessage.textContent = "Loading admin data...";
  const [orders, reservations] = await Promise.all([api("/api/orders"), api("/api/reservations")]);
  state.orders = orders;
  state.reservations = reservations;
  render();
  loginMessage.textContent = "Dashboard updated.";
}

async function updateStatus(type, id, status) {
  const path = type === "order" ? `/api/orders/${encodeURIComponent(id)}` : `/api/reservations/${encodeURIComponent(id)}`;
  await api(path, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadAdminData();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.token = adminToken.value.trim() || state.token;
  localStorage.setItem("hotelAdminToken", state.token);
  try {
    await loadAdminData();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadAdminData();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.addEventListener("change", async (event) => {
  const select = event.target.closest(".status-select");
  if (!select) return;
  select.disabled = true;
  try {
    await updateStatus(select.dataset.type, select.dataset.id, select.value);
  } catch (error) {
    loginMessage.textContent = error.message;
    select.disabled = false;
  }
});

if (state.token) {
  adminToken.value = state.token;
  loadAdminData().catch((error) => {
    loginMessage.textContent = error.message;
  });
} else {
  render();
}
