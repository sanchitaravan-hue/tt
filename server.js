const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MENU_FILE = path.join(ROOT, "menu.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const RESERVATIONS_FILE = path.join(DATA_DIR, "reservations.json");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";
const PAYMENT_PROVIDER = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "razorpay" : "demo";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  for (const file of [ORDERS_FILE, RESERVATIONS_FILE]) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "[]\n");
    }
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function requireAdmin(req, res) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    sendError(res, 401, "Admin access denied");
    return false;
  }
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function createId(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function validateCustomer(customer = {}) {
  const name = String(customer.name || "").trim();
  const phone = normalizePhone(customer.phone);
  if (name.length < 2) {
    throw new Error("Customer name is required");
  }
  if (phone.length < 10) {
    throw new Error("Valid mobile number is required");
  }
  return { name, phone };
}

function getMenuById() {
  return new Map(readJson(MENU_FILE).map((item) => [item.id, item]));
}

function getOrderTotals(items) {
  const menuById = getMenuById();
  const normalizedItems = items
    .map((line) => {
      const menuItem = menuById.get(String(line.id || ""));
      const quantity = Number(line.quantity);
      if (!menuItem || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return null;
      }
      return {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        lineTotal: menuItem.price * quantity
      };
    })
    .filter(Boolean);

  if (!normalizedItems.length) {
    throw new Error("Order must include at least one valid item");
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const packaging = 20;
  return {
    items: normalizedItems,
    subtotal,
    packaging,
    total: subtotal + packaging
  };
}

function requestJson(options, payload) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(options, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        const data = JSON.parse(body || "{}");
        if (response.statusCode >= 400) {
          reject(new Error(data.error?.description || data.error?.message || "External service request failed"));
          return;
        }
        resolve(data);
      });
    });
    request.on("error", reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
}

function httpsRequest(options, callback) {
  return require("https").request(options, callback);
}

function localChatReply(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("time") || text.includes("open") || text.includes("close")) {
    return "We are open from 12:00 PM to 11:00 PM, with last tandoor orders at 10:30 PM.";
  }
  if (text.includes("reserve") || text.includes("table") || text.includes("booking")) {
    return "You can reserve a table from the reservation form on this page. Add your name, phone, date, time, people count, and seating preference.";
  }
  if (text.includes("pay") || text.includes("payment") || text.includes("online")) {
    return "You can pay online from the cart using the Pay Online button, or choose Pay at Counter when placing the order.";
  }
  if (text.includes("location") || text.includes("address")) {
    return "Hotel Tandoor Corner is near Crusher Chowk, Sambhaji Nagar, Kolhapur, Maharashtra 416012.";
  }
  if (text.includes("veg") || text.includes("paneer")) {
    return "Popular veg picks include Paneer Tikka, Tandoori Broccoli, Mushroom 65, Dal Tadka, Butter Garlic Naan, and Amritsari Kulcha.";
  }
  if (text.includes("chicken") || text.includes("mutton") || text.includes("non veg")) {
    return "Guest favorites include Chicken Tikka, Murgh Malai Kebab, Mutton Seekh Kebab, Butter Chicken, and Mutton Rogan Josh.";
  }
  return "I can help with menu suggestions, opening hours, reservations, location, and payment. For a quick pick, try Chicken Tikka, Paneer Tikka, Butter Chicken, and Butter Garlic Naan.";
}

function handleMenu(req, res) {
  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed");
    return;
  }
  sendJson(res, 200, readJson(MENU_FILE));
}

async function handleOrders(req, res) {
  if (req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, readJson(ORDERS_FILE));
    return;
  }

  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const customer = validateCustomer(body.customer);
    const items = Array.isArray(body.items) ? body.items : [];
    const totals = getOrderTotals(items);
    const payment = body.payment && typeof body.payment === "object" ? body.payment : {};
    const order = {
      id: createId("ORD"),
      createdAt: new Date().toISOString(),
      status: "received",
      paymentStatus: payment.status === "paid" ? "paid" : "pay-at-counter",
      paymentProvider: payment.provider || "counter",
      paymentReference: String(payment.reference || "").trim().slice(0, 100),
      customer,
      fulfillment: body.fulfillment === "dine-in" ? "dine-in" : "pickup",
      notes: String(body.notes || "").trim().slice(0, 500),
      items: totals.items,
      subtotal: totals.subtotal,
      packaging: totals.packaging,
      total: totals.total
    };

    const orders = readJson(ORDERS_FILE);
    orders.unshift(order);
    writeJson(ORDERS_FILE, orders);
    sendJson(res, 201, order);
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handleReservations(req, res) {
  if (req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, readJson(RESERVATIONS_FILE));
    return;
  }

  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const customer = validateCustomer(body);
    const people = Number(body.people);
    const date = String(body.date || "");
    const time = String(body.time || "");
    if (!Number.isInteger(people) || people < 1 || people > 30) {
      throw new Error("Party size must be between 1 and 30");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      throw new Error("Reservation date and time are required");
    }

    const reservation = {
      id: createId("RSV"),
      createdAt: new Date().toISOString(),
      status: "requested",
      name: customer.name,
      phone: customer.phone,
      date,
      time,
      people,
      seating: String(body.seating || "outdoor").trim().slice(0, 50),
      notes: String(body.notes || "").trim().slice(0, 500)
    };

    const reservations = readJson(RESERVATIONS_FILE);
    reservations.unshift(reservation);
    writeJson(RESERVATIONS_FILE, reservations);
    sendJson(res, 201, reservation);
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handlePaymentOrder(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const totals = getOrderTotals(items);

    if (PAYMENT_PROVIDER !== "razorpay") {
      sendJson(res, 201, {
        provider: "demo",
        keyId: "demo",
        orderId: createId("PAY"),
        amount: totals.total,
        currency: "INR",
        displayAmount: totals.total
      });
      return;
    }

    const receipt = createId("RCP");
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const paymentOrder = await requestJson(
      {
        hostname: "api.razorpay.com",
        path: "/v1/orders",
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        }
      },
      {
        amount: totals.total * 100,
        currency: "INR",
        receipt
      }
    );

    sendJson(res, 201, {
      provider: "razorpay",
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      displayAmount: totals.total
    });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const received = String(signature || "");
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function handlePaymentVerify(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    if (body.provider === "demo") {
      sendJson(res, 200, {
        provider: "demo",
        status: "paid",
        reference: body.paymentId || createId("DEMO-PAY")
      });
      return;
    }

    const valid = verifyRazorpaySignature(body.orderId, body.paymentId, body.signature);
    if (!valid) {
      throw new Error("Payment verification failed");
    }
    sendJson(res, 200, {
      provider: "razorpay",
      status: "paid",
      reference: body.paymentId
    });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handleChat(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const message = String(body.message || "").trim().slice(0, 600);
    if (!message) {
      throw new Error("Message is required");
    }

    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 200, {
        provider: "local",
        reply: localChatReply(message)
      });
      return;
    }

    const menu = readJson(MENU_FILE)
      .map((item) => `${item.name} (${item.category}) - INR ${item.price}: ${item.description}`)
      .join("\n");
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are the helpful AI assistant for Hotel Tandoor Corner in Kolhapur. Answer briefly, warmly, and only about restaurant menu, ordering, payments, reservations, location, and opening hours. If asked for unrelated topics, redirect to restaurant help. Opening hours are 12:00 PM to 11:00 PM, last tandoor orders at 10:30 PM. Address: Crusher Chowk, Sambhaji Nagar, Kolhapur, Maharashtra 416012. Phone: 8668969538.\n\nMenu:\n" +
            menu
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.4,
      max_tokens: 180
    };

    try {
      const chat = await requestJson(
        {
          hostname: "api.openai.com",
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        },
        payload
      );

      sendJson(res, 200, {
        provider: "openai",
        reply: chat.choices?.[0]?.message?.content || localChatReply(message)
      });
    } catch (error) {
      sendJson(res, 200, {
        provider: "local",
        reply: localChatReply(message)
      });
    }
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handleAdminOrder(req, res, id) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "PATCH") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const allowed = new Set(["received", "preparing", "ready", "completed", "cancelled"]);
    const status = String(body.status || "");
    if (!allowed.has(status)) {
      throw new Error("Invalid order status");
    }
    const orders = readJson(ORDERS_FILE);
    const order = orders.find((item) => item.id === id);
    if (!order) {
      sendError(res, 404, "Order not found");
      return;
    }
    order.status = status;
    order.updatedAt = new Date().toISOString();
    writeJson(ORDERS_FILE, orders);
    sendJson(res, 200, order);
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handleAdminReservation(req, res, id) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "PATCH") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  try {
    const body = await parseBody(req);
    const allowed = new Set(["requested", "confirmed", "seated", "completed", "cancelled"]);
    const status = String(body.status || "");
    if (!allowed.has(status)) {
      throw new Error("Invalid reservation status");
    }
    const reservations = readJson(RESERVATIONS_FILE);
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) {
      sendError(res, 404, "Reservation not found");
      return;
    }
    reservation.status = status;
    reservation.updatedAt = new Date().toISOString();
    writeJson(RESERVATIONS_FILE, reservations);
    sendJson(res, 200, reservation);
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendError(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

ensureStore();

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === "/api/menu") {
    handleMenu(req, res);
    return;
  }
  if (pathname === "/api/orders") {
    handleOrders(req, res);
    return;
  }
  if (pathname.startsWith("/api/orders/")) {
    handleAdminOrder(req, res, decodeURIComponent(pathname.split("/").pop()));
    return;
  }
  if (pathname === "/api/reservations") {
    handleReservations(req, res);
    return;
  }
  if (pathname.startsWith("/api/reservations/")) {
    handleAdminReservation(req, res, decodeURIComponent(pathname.split("/").pop()));
    return;
  }
  if (pathname === "/api/payments/order") {
    handlePaymentOrder(req, res);
    return;
  }
  if (pathname === "/api/payments/verify") {
    handlePaymentVerify(req, res);
    return;
  }
  if (pathname === "/api/chat") {
    handleChat(req, res);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Hotel Tandoor Corner running at http://127.0.0.1:${PORT}`);
});
