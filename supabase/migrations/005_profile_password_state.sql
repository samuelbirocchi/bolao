alter table public.profiles
add column if not exists password_set_at timestamptz;
