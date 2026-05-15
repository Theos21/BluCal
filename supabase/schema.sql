-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  email text,
  biological_sex text check (biological_sex in ('male', 'female', 'other')),
  birthday date,
  height_cm numeric,
  weight_unit text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  is_metric boolean default false,
  goal text check (goal in ('lose_fat', 'build_muscle', 'maintain', 'performance')),
  goal_weight_kg numeric,
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very_active', 'athlete')),
  dietary_preferences text[] default '{}',
  pace text default 'moderate' check (pace in ('slow', 'moderate', 'aggressive')),
  apple_health_connected boolean default false,
  notif_log_reminder boolean default true,
  notif_log_reminder_hour integer default 20,
  notif_weigh_in boolean default true,
  notif_weigh_in_hour integer default 7,
  notif_weekly_summary boolean default true,
  notif_streak_alerts boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Macro targets
create table public.macro_targets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  calories integer not null,
  protein_g integer not null,
  carbs_g integer not null,
  fat_g integer not null,
  is_custom boolean default false,
  net_carbs boolean default false,
  effective_date date default current_date,
  created_at timestamptz default now()
);

-- Food log entries
create table public.food_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  name text not null,
  portion_description text,
  quantity numeric not null default 1,
  unit text not null default 'serving',
  calories integer not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric default 0,
  sugar_g numeric default 0,
  sodium_mg numeric default 0,
  saturated_fat_g numeric default 0,
  cholesterol_mg numeric default 0,
  food_database_id text,
  barcode text,
  source text check (source in ('search', 'barcode', 'bluai', 'voice', 'manual', 'recipe')) default 'manual',
  created_at timestamptz default now()
);

-- Weight entries
create table public.weight_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  weight_kg numeric not null,
  note text,
  created_at timestamptz default now()
);

-- Body measurements
create table public.measurements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  measurement_type text not null,
  value_cm numeric not null,
  created_at timestamptz default now()
);

-- Feeling / journal entries
create table public.feeling_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  hunger integer check (hunger between 1 and 5),
  energy integer check (energy between 1 and 5),
  mood integer check (mood between 1 and 5),
  created_at timestamptz default now()
);

-- Custom foods
create table public.custom_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  brand text,
  barcode text,
  serving_size numeric not null,
  serving_unit text not null,
  calories integer not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric default 0,
  sugar_g numeric default 0,
  sodium_mg numeric default 0,
  saturated_fat_g numeric default 0,
  cholesterol_mg numeric default 0,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- Recipes
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  servings integer not null default 1,
  total_yield numeric,
  yield_unit text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recipe ingredients
create table public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  calories integer not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  custom_food_id uuid references public.custom_foods(id),
  food_database_id text,
  sort_order integer default 0
);

-- Planned meals
create table public.planned_meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  planned_for date not null,
  planned_time time,
  name text not null,
  portion_description text,
  calories integer not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  recipe_id uuid references public.recipes(id),
  is_logged boolean default false,
  created_at timestamptz default now()
);

-- Accountability partners
create table public.partnerships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  partner_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, partner_id)
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.macro_targets enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.measurements enable row level security;
alter table public.feeling_entries enable row level security;
alter table public.custom_foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.planned_meals enable row level security;
alter table public.partnerships enable row level security;

-- RLS Policies (users can only access their own data)
create policy "users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "users can manage own food entries" on public.food_entries for all using (auth.uid() = user_id);
create policy "users can manage own weight entries" on public.weight_entries for all using (auth.uid() = user_id);
create policy "users can manage own measurements" on public.measurements for all using (auth.uid() = user_id);
create policy "users can manage own feeling entries" on public.feeling_entries for all using (auth.uid() = user_id);
create policy "users can manage own macro targets" on public.macro_targets for all using (auth.uid() = user_id);
create policy "users can manage own custom foods" on public.custom_foods for all using (auth.uid() = user_id);
create policy "users can manage own recipes" on public.recipes for all using (auth.uid() = user_id);
create policy "users can manage own recipe ingredients" on public.recipe_ingredients for all using (
  auth.uid() = (select user_id from public.recipes where id = recipe_id)
);
create policy "users can manage own planned meals" on public.planned_meals for all using (auth.uid() = user_id);
create policy "users can manage own partnerships" on public.partnerships for all using (
  auth.uid() = requester_id or auth.uid() = partner_id
);

-- Public custom foods viewable by all
create policy "public custom foods are viewable by all" on public.custom_foods
  for select using (is_public = true);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Water entries (added later)
create table if not exists public.water_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  amount_ml integer not null,
  created_at timestamptz default now()
);

alter table public.water_entries enable row level security;

create policy "users can manage own water entries"
  on public.water_entries for all using (auth.uid() = user_id);

-- Push notification tokens (added later)
create table if not exists public.push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  token text not null,
  platform text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.push_tokens enable row level security;

create policy "users can manage own push tokens"
  on public.push_tokens for all using (auth.uid() = user_id);

-- Progress photos
create table if not exists public.progress_photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  storage_path text not null,
  taken_at timestamptz not null default now(),
  note text,
  created_at timestamptz default now()
);

alter table public.progress_photos enable row level security;

create policy "users can manage own photos"
  on public.progress_photos for all using (auth.uid() = user_id);

-- Storage bucket for progress photos (private — accessed via signed URLs)
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "users can upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can view own photos"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
