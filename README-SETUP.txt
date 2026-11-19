AMOURA SUPABASE WEBSITE UPDATE

Files:
- index.html: public customer storefront
- admin.html: private admin sign-in and store management
- config.js: your Supabase Project URL and Publishable API key
- script.js: public product loading and order submission
- admin.js: admin login, product/photo management, and order management
- style.css: your existing AMOURA styling

IMPORTANT SETUP
1. Open config.js in a text editor.
2. Replace PASTE_YOUR_SUPABASE_PROJECT_URL_HERE with your Supabase Project URL.
3. Replace PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE with your Supabase Publishable API key.
4. Save config.js. Do not share these values in chat. Never use a service_role or secret key in frontend files.
5. Upload ALL six files to your Netlify site, replacing the old index.html, script.js and style.css. Keep all files in the same published folder.
6. Open https://YOUR-SITE-NAME.netlify.app/admin.html to sign in with the Supabase admin email and password.
7. Test adding a product with a photo. Then open the public storefront in another browser/device to confirm it appears.
8. Submit a small test order and check it in admin.html.

DATABASE EXPECTATIONS
The products table should contain: id (text primary key), name (text), price (numeric), description (text), image_url (text), created_at (timestamptz).
The orders table should contain: id (text primary key), customer_name (text), phone (text), email (text), address (text), notes (text), items (jsonb), total (numeric), status (text), created_at (timestamptz).
Storage bucket name must be: amoura-products (public read, authenticated admin-only writes).
RLS policies must match the setup you already created.

SECURITY NOTE
The public storefront does not contain a Manage Store button. Admin data access relies on Supabase Auth and your Row Level Security policies. Keep customer order SELECT restricted to your admin UID. The customer order INSERT policy you previously created allows anonymous order submissions; consider adding server-side validation/rate limiting before relying on it for high-volume sales.

SCOPE
Products, product photos, customer order submission, admin login, and order status updates use Supabase. Cart, selected appearance, contact details, and pinboard remain saved in each browser for now. SMS notifications and online payments are not included.
