import postgres from 'postgres';
const sql = postgres('postgresql://postgres:Senha%401020%40@db.dgixajsmecysehwytlav.supabase.co:6543/postgres');

async function run() {
  try {
    const res = await sql`UPDATE auth.users SET encrypted_password = crypt('Senha@123', gen_salt('bf')) WHERE email = 'flpheck@gmail.com' RETURNING email`;
    console.log('Password updated for:', res);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
