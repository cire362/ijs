-- Immutable baseline schema; evolve with new migrations.
CREATE TYPE public.enum_address_suggestions_kind AS ENUM (
    'region',
    'city',
    'street'
);
CREATE TYPE public.enum_applications_status AS ENUM (
    'sent',
    'confirmed',
    'contract_signed',
    'awaiting_payment',
    'commission_available',
    'done',
    'rejected',
    'expired'
);
CREATE TYPE public.enum_event_registrations_status AS ENUM (
    'new',
    'approved',
    'rejected'
);
CREATE TYPE public.enum_events_format AS ENUM (
    'offline',
    'online',
    'hybrid'
);
CREATE TYPE public.enum_properties_sale_status AS ENUM (
    'available',
    'reserved',
    'sold'
);
CREATE TYPE public.enum_support_requests_status AS ENUM (
    'new',
    'read',
    'replied'
);
CREATE TYPE public.enum_tariff_counterparties_type AS ENUM (
    'developer',
    'contractor',
    'assignment'
);
CREATE TYPE public.enum_tariff_property_rates_category AS ENUM (
    'apartments',
    'commercial',
    'parking',
    'storage'
);
CREATE TYPE public.enum_tariff_rates_category AS ENUM (
    'apartments',
    'commercial',
    'parking',
    'storage'
);
CREATE TYPE public.enum_users_role AS ENUM (
    'agent',
    'individual',
    'developer',
    'admin'
);
CREATE TABLE public.address_suggestions (
    id integer NOT NULL,
    kind public.enum_address_suggestions_kind NOT NULL,
    label character varying(200) NOT NULL,
    label_lower character varying(200) NOT NULL,
    region character varying(200),
    region_lower character varying(200),
    city character varying(200),
    city_lower character varying(200),
    source character varying(50) DEFAULT 'nominatim'::character varying NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.address_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.address_suggestions_id_seq OWNED BY public.address_suggestions.id;
CREATE TABLE public.application_chat_messages (
    id integer NOT NULL,
    application_id integer NOT NULL,
    sender_id integer NOT NULL,
    sender_role character varying(255) NOT NULL,
    text text,
    attachment_url character varying(255),
    attachment_original_name character varying(255),
    attachment_mime_type character varying(255),
    attachment_size integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.application_chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.application_chat_messages_id_seq OWNED BY public.application_chat_messages.id;
CREATE TABLE public.applications (
    id integer NOT NULL,
    property_id integer NOT NULL,
    agent_id integer NOT NULL,
    status public.enum_applications_status DEFAULT 'sent'::public.enum_applications_status,
    expires_at timestamp with time zone,
    commission_amount numeric(14,2),
    comment text,
    client_full_name character varying(255),
    client_phone character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;
CREATE TABLE public.auth_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    refresh_token_hash character varying(128) NOT NULL,
    replaced_by_id integer,
    revoked_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    ip character varying(64),
    user_agent character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.auth_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.auth_sessions_id_seq OWNED BY public.auth_sessions.id;
CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    sender_id integer,
    sender_name character varying(255),
    sender_email character varying(255),
    text text NOT NULL,
    is_admin boolean DEFAULT false,
    room_id character varying(255) NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;
CREATE TABLE public.event_registrations (
    id integer NOT NULL,
    event_id integer NOT NULL,
    agent_id integer NOT NULL,
    status public.enum_event_registrations_status DEFAULT 'new'::public.enum_event_registrations_status,
    comment text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.event_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.event_registrations_id_seq OWNED BY public.event_registrations.id;
CREATE TABLE public.events (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    format public.enum_events_format,
    cover_image_url character varying(255),
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    is_training boolean DEFAULT false,
    capacity integer,
    created_by integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;
CREATE TABLE public.news (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    subtitle character varying(255),
    excerpt text,
    content text NOT NULL,
    is_published boolean DEFAULT true,
    published_at timestamp with time zone,
    author_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.news_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.news_id_seq OWNED BY public.news.id;
CREATE TABLE public.news_images (
    id integer NOT NULL,
    news_id integer NOT NULL,
    url character varying(255) NOT NULL,
    caption character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.news_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.news_images_id_seq OWNED BY public.news_images.id;
CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(255),
    key character varying(255),
    text text NOT NULL,
    is_read boolean DEFAULT false,
    meta json,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
CREATE TABLE public.properties (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    developer_id integer NOT NULL,
    region character varying(255) NOT NULL,
    city character varying(255) NOT NULL,
    street character varying(255),
    plot_number character varying(255),
    land_area double precision,
    house_area double precision,
    floors integer,
    rooms integer,
    finishing_type character varying(255),
    contract_type character varying(255),
    construction_type character varying(255),
    readiness_type character varying(255),
    registration character varying(255),
    sale_status public.enum_properties_sale_status DEFAULT 'available'::public.enum_properties_sale_status,
    build_stage character varying(255),
    price numeric(14,2),
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.properties_id_seq OWNED BY public.properties.id;
CREATE TABLE public.property_documents (
    id integer NOT NULL,
    property_id integer NOT NULL,
    url character varying(255) NOT NULL,
    original_name character varying(255),
    mime_type character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.property_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.property_documents_id_seq OWNED BY public.property_documents.id;
CREATE TABLE public.property_images (
    id integer NOT NULL,
    property_id integer NOT NULL,
    url character varying(255) NOT NULL,
    caption character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.property_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.property_images_id_seq OWNED BY public.property_images.id;
CREATE TABLE public.status_histories (
    id integer NOT NULL,
    application_id integer NOT NULL,
    status character varying(255) NOT NULL,
    changed_by integer,
    comment text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.status_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.status_histories_id_seq OWNED BY public.status_histories.id;
CREATE TABLE public.support_chats (
    id integer NOT NULL,
    room_id character varying(255) NOT NULL,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.support_chats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.support_chats_id_seq OWNED BY public.support_chats.id;
CREATE TABLE public.support_requests (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    message text NOT NULL,
    ip character varying(255),
    status public.enum_support_requests_status DEFAULT 'new'::public.enum_support_requests_status,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.support_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.support_requests_id_seq OWNED BY public.support_requests.id;
CREATE TABLE public.tariff_complexes (
    id integer NOT NULL,
    counterparty_id integer NOT NULL,
    name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.tariff_complexes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tariff_complexes_id_seq OWNED BY public.tariff_complexes.id;
CREATE TABLE public.tariff_counterparties (
    id integer NOT NULL,
    type public.enum_tariff_counterparties_type NOT NULL,
    name character varying(255) NOT NULL,
    user_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.tariff_counterparties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tariff_counterparties_id_seq OWNED BY public.tariff_counterparties.id;
CREATE TABLE public.tariff_property_rates (
    id integer NOT NULL,
    property_id integer NOT NULL,
    category public.enum_tariff_property_rates_category NOT NULL,
    commission_from numeric(6,3) NOT NULL,
    commission_to numeric(6,3),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.tariff_property_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tariff_property_rates_id_seq OWNED BY public.tariff_property_rates.id;
CREATE TABLE public.tariff_rates (
    id integer NOT NULL,
    complex_id integer NOT NULL,
    category public.enum_tariff_rates_category NOT NULL,
    commission_from numeric(6,3) NOT NULL,
    commission_to numeric(6,3),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.tariff_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tariff_rates_id_seq OWNED BY public.tariff_rates.id;
CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255),
    last_name character varying(255),
    first_name character varying(255),
    middle_name character varying(255),
    email character varying(255) NOT NULL,
    phone character varying(255),
    password_hash character varying(255) NOT NULL,
    role public.enum_users_role NOT NULL,
    developer_approved boolean DEFAULT false,
    developer_rejected boolean DEFAULT false,
    company_name character varying(255),
    avatar_url character varying(255),
    legal_consent_accepted_at timestamp with time zone,
    legal_consent_version character varying(255),
    legal_consent_meta json,
    marketing_consent_given boolean DEFAULT false NOT NULL,
    marketing_consent_accepted_at timestamp with time zone,
    marketing_consent_withdrawn_at timestamp with time zone,
    marketing_consent_version character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.address_suggestions ALTER COLUMN id SET DEFAULT nextval('public.address_suggestions_id_seq'::regclass);
ALTER TABLE ONLY public.application_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.application_chat_messages_id_seq'::regclass);
ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);
ALTER TABLE ONLY public.auth_sessions ALTER COLUMN id SET DEFAULT nextval('public.auth_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);
ALTER TABLE ONLY public.event_registrations ALTER COLUMN id SET DEFAULT nextval('public.event_registrations_id_seq'::regclass);
ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);
ALTER TABLE ONLY public.news ALTER COLUMN id SET DEFAULT nextval('public.news_id_seq'::regclass);
ALTER TABLE ONLY public.news_images ALTER COLUMN id SET DEFAULT nextval('public.news_images_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);
ALTER TABLE ONLY public.property_documents ALTER COLUMN id SET DEFAULT nextval('public.property_documents_id_seq'::regclass);
ALTER TABLE ONLY public.property_images ALTER COLUMN id SET DEFAULT nextval('public.property_images_id_seq'::regclass);
ALTER TABLE ONLY public.status_histories ALTER COLUMN id SET DEFAULT nextval('public.status_histories_id_seq'::regclass);
ALTER TABLE ONLY public.support_chats ALTER COLUMN id SET DEFAULT nextval('public.support_chats_id_seq'::regclass);
ALTER TABLE ONLY public.support_requests ALTER COLUMN id SET DEFAULT nextval('public.support_requests_id_seq'::regclass);
ALTER TABLE ONLY public.tariff_complexes ALTER COLUMN id SET DEFAULT nextval('public.tariff_complexes_id_seq'::regclass);
ALTER TABLE ONLY public.tariff_counterparties ALTER COLUMN id SET DEFAULT nextval('public.tariff_counterparties_id_seq'::regclass);
ALTER TABLE ONLY public.tariff_property_rates ALTER COLUMN id SET DEFAULT nextval('public.tariff_property_rates_id_seq'::regclass);
ALTER TABLE ONLY public.tariff_rates ALTER COLUMN id SET DEFAULT nextval('public.tariff_rates_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.address_suggestions
    ADD CONSTRAINT address_suggestions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.application_chat_messages
    ADD CONSTRAINT application_chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.news_images
    ADD CONSTRAINT news_images_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.property_documents
    ADD CONSTRAINT property_documents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_room_id_key UNIQUE (room_id);
ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tariff_complexes
    ADD CONSTRAINT tariff_complexes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tariff_counterparties
    ADD CONSTRAINT tariff_counterparties_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tariff_property_rates
    ADD CONSTRAINT tariff_property_rates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tariff_rates
    ADD CONSTRAINT tariff_rates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE INDEX address_suggestions_city_lower ON public.address_suggestions USING btree (city_lower);
CREATE INDEX address_suggestions_kind_label_lower ON public.address_suggestions USING btree (kind, label_lower);
CREATE UNIQUE INDEX address_suggestions_kind_label_lower_region_lower_city_lower ON public.address_suggestions USING btree (kind, label_lower, region_lower, city_lower);
CREATE INDEX address_suggestions_region_lower ON public.address_suggestions USING btree (region_lower);
CREATE INDEX auth_sessions_expires_at ON public.auth_sessions USING btree (expires_at);
CREATE UNIQUE INDEX auth_sessions_refresh_token_hash ON public.auth_sessions USING btree (refresh_token_hash);
CREATE INDEX auth_sessions_revoked_at ON public.auth_sessions USING btree (revoked_at);
CREATE INDEX auth_sessions_user_id ON public.auth_sessions USING btree (user_id);
CREATE UNIQUE INDEX event_registrations_event_id_agent_id ON public.event_registrations USING btree (event_id, agent_id);
CREATE UNIQUE INDEX notifications_user_id_key ON public.notifications USING btree (user_id, key);
CREATE UNIQUE INDEX tariff_property_rates_property_id_category ON public.tariff_property_rates USING btree (property_id, category);
CREATE UNIQUE INDEX tariff_rates_complex_id_category ON public.tariff_rates USING btree (complex_id, category);
ALTER TABLE ONLY public.application_chat_messages
    ADD CONSTRAINT application_chat_messages_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.application_chat_messages
    ADD CONSTRAINT application_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.news_images
    ADD CONSTRAINT news_images_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.property_documents
    ADD CONSTRAINT property_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.tariff_complexes
    ADD CONSTRAINT tariff_complexes_counterparty_id_fkey FOREIGN KEY (counterparty_id) REFERENCES public.tariff_counterparties(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.tariff_counterparties
    ADD CONSTRAINT tariff_counterparties_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.tariff_property_rates
    ADD CONSTRAINT tariff_property_rates_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.tariff_rates
    ADD CONSTRAINT tariff_rates_complex_id_fkey FOREIGN KEY (complex_id) REFERENCES public.tariff_complexes(id) ON UPDATE CASCADE ON DELETE CASCADE;
