# Local StewRun testing

Use the local Supabase stack for test accounts. This keeps test users and test
orders separate from both the original database and the staging project.

1. Install the Supabase CLI if it is not already available, then run
   `supabase start` from the repository root. The local stack uses the settings
   in `supabase/config.toml`; local email confirmation is disabled so test
   accounts can sign in without sending real email.
2. Copy the local API URL and publishable/anon key shown by `supabase status`
   into a separate `.env.local` used only for local development:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-or-publishable-key>
   ```

   Never copy staging or production keys into this local setup.
3. Start the app with `npm run dev`, then register a test customer and a test
   cook using email addresses such as `customer@example.com` and
   `cook@example.com`. These addresses are local test identities and do not
   send real email.
4. Complete a customer request, submit a cook offer, reserve the offer, then
   use the cook order flow to mark it ready and record cash at collection.
   Submit a customer rating after collection.
5. Use `supabase stop` when finished. Local test data stays in the local stack.
