-- BigLot.ai Phase 1: Web <-> Telegram account linking and shared chat continuity

create extension if not exists pgcrypto;

alter table chats
    add column if not exists biglot_user_id text;

create index if not exists idx_chats_biglot_user_id_created_at
    on chats (biglot_user_id, created_at desc);

alter table messages
    add column if not exists mode text,
    add column if not exists channel text,
    add column if not exists external_message_id text;

update messages
set channel = 'web'
where channel is null;

alter table messages
    alter column channel set default 'web';

create index if not exists idx_messages_chat_created_at
    on messages (chat_id, created_at desc);

create unique index if not exists idx_messages_telegram_external_unique
    on messages (chat_id, channel, external_message_id)
    where channel = 'telegram' and external_message_id is not null;

create table if not exists telegram_link_tokens (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    biglot_user_id text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_tokens_biglot_user_id
    on telegram_link_tokens (biglot_user_id);

create table if not exists telegram_links (
    id uuid primary key default gen_random_uuid(),
    biglot_user_id text not null,
    telegram_user_id bigint not null unique,
    telegram_chat_id bigint not null,
    telegram_username text,
    telegram_first_name text,
    telegram_last_name text,
    is_active boolean not null default true,
    linked_at timestamptz not null default now(),
    unlinked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_telegram_links_active_biglot_user
    on telegram_links (biglot_user_id)
    where is_active = true;

create index if not exists idx_telegram_links_biglot_user
    on telegram_links (biglot_user_id, is_active);

create table if not exists chat_channels (
    id uuid primary key default gen_random_uuid(),
    chat_id uuid not null references chats(id) on delete cascade,
    biglot_user_id text not null,
    channel text not null,
    external_chat_id text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (channel, external_chat_id)
);

create index if not exists idx_chat_channels_biglot_user
    on chat_channels (biglot_user_id, channel);

create table if not exists telegram_webhook_events (
    id uuid primary key default gen_random_uuid(),
    update_id bigint not null unique,
    status text not null default 'processing',
    error text,
    received_at timestamptz not null default now(),
    processed_at timestamptz
);

create index if not exists idx_telegram_webhook_events_status_received_at
    on telegram_webhook_events (status, received_at desc);

-- Development default (match current project behavior)
alter table telegram_link_tokens disable row level security;
alter table telegram_links disable row level security;
alter table chat_channels disable row level security;
alter table telegram_webhook_events disable row level security;
