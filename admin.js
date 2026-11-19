
const isConfigReady = () => {
  const url = window.AMOURA_SUPABASE_URL || "";
  const key = window.AMOURA_SUPABASE_PUBLISHABLE_KEY || "";

  return (
    !!url &&
    !!key &&
    !/PASTE_|YOUR_/.test(url) &&
    !/PASTE_|YOUR_/.test(key)
  );
};

const el = id => document.getElementById(id);

const fmt = value =>
  Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });

const safe = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

let sb = null;
let currentProducts = [];

function message(id, text) {
  const element = el(id);
  if (element) element.textContent = text;
}

function setLoginState(signedIn) {
  el("loginPanel").classList.toggle("hidden", signedIn);
  el("dashboard").classList.toggle("hidden", !signedIn);
}

async function refreshSession() {
  try {
    if (!sb) {
      setLoginState(false);
      message(
        "loginMessage",
        "Store setup is not finished. Check config.js and reload."
      );
      return;
    }

    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    const session = data.session;
    setLoginState(!!session);

    if (session) {
      message("signedInAs", session.user.email || "Signed in");
      await loadProducts();
      await loadOrders();
    }
  } catch (error) {
    console.error("Session error:", error);
    setLoginState(false);
    message("loginMessage", error.message || "Could not check login.");
  }
}


el("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const loginForm = event.currentTarget;

  if (!sb) {
    message("loginMessage", "Supabase is not configured. Check config.js.");
    return;
  }

  const form = new FormData(loginForm);
  const button = loginForm.querySelector('[type="submit"]');

  message("loginMessage", "Signing in...");
  if (button) button.disabled = true;

  try {
    const { error } = await sb.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password")
    });

    if (error) throw error;

    loginForm.reset();
    await refreshSession();

  } catch (error) {
    console.error("Login error:", error);
    message("loginMessage", error.message || "Login failed.");
  } finally {
    if (button) button.disabled = false;
  }
});

el("logoutBtn").addEventListener("click", async () => {
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    await refreshSession();
  } catch (error) {
    alert(error.message || "Could not log out.");
  }
});

async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    message("productList", "Could not load products: " + error.message);
    return;
  }

  currentProducts = data || [];

  el("productList").innerHTML = currentProducts.length
    ? currentProducts.map(product => `
      <div class="admin-row">
        ${product.image_url
          ? `<img src="${safe(product.image_url)}" alt="">`
          : "♡"}
        <div style="flex:1">
          <strong>${safe(product.name)}</strong>
          <div>${fmt(product.price)}</div>
        </div>
c        <button data-edit="${safe(product.id)}">Edit</button>
        <button data-delete="${safe(product.id)}" class="secondary">Delete</button>
      </div>
    `).join("")
    : "No products yet.";
}

function resetForm() {
  el("productForm").reset();
  el("productForm").elements.id.value = "";
  el("formHeading").textContent = "Add a product";
  el("saveProductBtn").textContent = "Save product";
}

el("cancelEdit").addEventListener("click", resetForm);

el("productList").addEventListener("click", async event => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");

  if (edit) {
    const product = currentProducts.find(
      item => item.id === edit.dataset.edit
    );

    if (!product) return;

    const form = el("productForm");
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.price.value = product.price;
    form.elements.description.value = product.description || "";

    el("formHeading").textContent = "Edit product";
    el("saveProductBtn").textContent = "Save changes";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (del && confirm("Delete this product?")) {
    const product = currentProducts.find(
      item => item.id === del.dataset.delete
    );

    const { error } = await sb
      .from("products")
      .delete()
      .eq("id", del.dataset.delete);

    if (error) {
      message("productMessage", error.message);
      return;
    }

    if (product?.image_url) {
      const marker = "/storage/v1/object/public/amoura-products/";
      const position = product.image_url.indexOf(marker);

      if (position >= 0) {
        const path = product.image_url.slice(position + marker.length);

        await sb.storage
          .from("amoura-products")
          .remove([decodeURIComponent(path)]);
      }
    }

    await loadProducts();
  }
});

el("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const id = data.get("id") || ("p-" + crypto.randomUUID());
  const oldProduct = currentProducts.find(product => product.id === id);
  let image_url = oldProduct?.image_url || "";
  const file = form.elements.photo.files[0];

  message("productMessage", "Saving product...");
  el("saveProductBtn").disabled = true;


  try {
    if (file) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        throw new Error("Choose an image smaller than 5 MB.");
      }

      const extension = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      const path = `${id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await sb.storage
        .from("amoura-products")
        .upload(path, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: imageData } = sb.storage
        .from("amoura-products")
        .getPublicUrl(path);

      image_url = imageData.publicUrl;
    }

    const product = {
      id,
      name: data.get("name").trim(),
      price: Number(data.get("price")),
      description: data.get("description").trim(),
      image_url
    };

    const { error } = await sb.from("products").upsert(product);

    if (error) throw error;

    message("productMessage", "Product saved successfully.");
    resetForm();
    await loadProducts();

  } catch (error) {
    console.error("Product save error:", error);
    message("productMessage", error.message || "Could not save product.");
  } finally {
    el("saveProductBtn").disabled = false;
  }
});

function renderOrders(orders) {
  el("ordersList").innerHTML = orders?.length
    ? orders.map(order => `
      <article class="order-admin">
        <div class="admin-row">
          <strong>Order ${safe(order.id)}</strong>
          <strong>${fmt(order.total)}</strong>
        </div>
        <p>
          <b>${safe(order.customer_name)}</b> · ${safe(order.phone)}<br>
          ${safe(order.address)}
        </p>
        <p>
          ${(order.items || []).map(item =>
            `${safe(item.name)} × ${Number(item.quantity) || 1}`
          ).join("<br>")}
        </p>
        <p>
          ${safe(order.email || "")}
          ${order.notes ? " · " + safe(order.notes) : ""}
        </p>
        <label>
          Status
          <select class="status-select" data-status="${safe(order.id)}">
            ${["New", "Preparing", "Ready to ship", "Completed", "Cancelled"]
              .map(status => `
                <option ${order.status === status ? "selected" : ""}>
                  ${status}
                </option>
              `).join("")}
          </select>
        </label>
        <small class="admin-muted">
          ${order.created_at
            ? new Date(order.created_at).toLocaleString()
            : ""}
        </small>
      </article>
    `).join("")
    : "No customer orders yet.";
}

async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    message("ordersList", "Could not load orders: " + error.message);
    return;
  }

  
function renderOrders(orders) {}
  const ordersList = el("ordersList");

  ordersList.innerHTML = orders?.length
    ? orders.map(order => `
      <article class="order-admin">
        <div class="admin-row">
          <strong>Order ${safe(order.id)}</strong>
          <strong>${fmt(order.total)}</strong>
        </div>

        <p>
          <b>${safe(order.customer_name)}</b> · ${safe(order.phone)}<br>
          ${safe(order.address)}
        </p>

        <p>
          ${(order.items || []).map(item =>
            `${safe(item.name)} × ${Number(item.quantity) || 1}`
          ).join("<br>")}
        </p>

        <p>
          ${safe(order.email || "")}
          ${order.notes ? " · " + safe(order.notes) : ""}
        </p>

        <label>
          Order Status
          <select class="status-select" data-status="${safe(order.id)}">
            ${["New", "Preparing", "Ready to ship", "Completed", "Cancelled"]
              .map(status => `
                <option ${order.status === status ? "selected" : ""}>
                  ${status}
                </option>
              `).join("")}
          </select>
        </label>

        <hr>

        <h4>GCash Payment</h4>

        <p>
          Payment Method: ${safe(order.payment_method || "GCash")}<br>
          Payment Status: <strong>${safe(order.payment_status || "Pending")}</strong>
        </p>

        ${
          order.receipt_url
            ? `<p>
                <a href="#" class="receipt-link"
                   data-order-id="${safe(order.id)}"
                   target="_blank" rel="noopener">
                  Loading receipt...
                </a>
              </p>`
            : "<p>No payment receipt uploaded.</p>"
        }

        ${
          order.receipt_url
            ? `<label>
                Verify Payment
                <select class="payment-select"
                        data-payment="${safe(order.id)}">
                  ${["Pending", "Verified", "Rejected"]
                    .map(status => `
                      <option value="${status}"
                        ${(order.payment_status || "Pending") === status ? "selected" : ""}>
                        ${status}
                      </option>
                    `).join("")}
                </select>
              </label>
              <small class="payment-message" data-message="${safe(order.id)}"></small>`
            : ""
        }

        <hr>

        <small class="admin-muted">
          ${order.created_at
            ? new Date(order.created_at).toLocaleString()
            : ""}
        </small>
      </article>
    `).join("")
    : "No customer orders yet.";

  // Generate secure links for private payment receipts
  orders?.forEach(async order => {
    if (!order.receipt_url) return;

    const link = [...ordersList.querySelectorAll(".receipt-link")]
      .find(item => item.dataset.orderId === order.id);

    if (!link) return;

    try {
      const { data, error } = await sb.storage
        .from("amoura-receipts")
        .createSignedUrl(order.receipt_url, 300);

      if (error) throw error;

      link.href = data.signedUrl;
      link.textContent = "View GCash Receipt ♡";

    } catch (error) {
      console.error("Receipt loading error:", error);
      link.textContent = "Unable to load receipt";
    }
  });

  // Update payment status
  ordersList.querySelectorAll(".payment-select").forEach(select => {
    select.addEventListener("change", async () => {
      const orderId = select.dataset.payment;
      const newStatus = select.value;
      const message = [...ordersList.querySelectorAll(".payment-message")]
        .find(item => item.dataset.message === orderId);

      select.disabled = true;
      if (message) message.textContent = "Updating...";

      try {
        const { error } = await sb
          .from("orders")
          .update({ payment_status: newStatus })
          .eq("id", orderId);

        if (error) throw error;

        if (message) message.textContent = "Payment status updated!";

      } catch (error) {
        console.error("Payment update error:", error);
        if (message) message.textContent = "Update failed: " + error.message;
      } finally {
        select.disabled = false;
      }
    });
  });
}
