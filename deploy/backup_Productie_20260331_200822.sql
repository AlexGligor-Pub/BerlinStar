--
-- PostgreSQL database dump
--

\restrict vJLne0EPk0jeSJYjcWcbAcflQbxJELq91y46MYC2cVss5XigTCoz122xvzELY2O

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: item_type; Type: TYPE; Schema: public; Owner: berlinstar
--

CREATE TYPE public.item_type AS ENUM (
    'PRODUS',
    'SERVICE'
);


ALTER TYPE public.item_type OWNER TO berlinstar;

--
-- Name: pay_method; Type: TYPE; Schema: public; Owner: berlinstar
--

CREATE TYPE public.pay_method AS ENUM (
    'NEPLATIT',
    'CARD',
    'CASH',
    'OP',
    'PARTIAL'
);


ALTER TYPE public.pay_method OWNER TO berlinstar;

--
-- Name: programare_status; Type: TYPE; Schema: public; Owner: berlinstar
--

CREATE TYPE public.programare_status AS ENUM (
    'Programat',
    'In lucru',
    'Executat',
    'Anulat'
);


ALTER TYPE public.programare_status OWNER TO berlinstar;

--
-- Name: tip_anvelopa; Type: TYPE; Schema: public; Owner: berlinstar
--

CREATE TYPE public.tip_anvelopa AS ENUM (
    'iarna',
    'vara',
    'ms',
    'altele'
);


ALTER TYPE public.tip_anvelopa OWNER TO berlinstar;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean NOT NULL,
    username character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255),
    image_url character varying(500),
    is_locked boolean DEFAULT false NOT NULL,
    locked_at timestamp with time zone
);


ALTER TABLE public.accounts OWNER TO berlinstar;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO berlinstar;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO berlinstar;

--
-- Name: anvelope; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.anvelope (
    id integer NOT NULL,
    account_id integer NOT NULL,
    client_id integer,
    marca_id integer,
    dimensiune_id integer,
    tip public.tip_anvelopa DEFAULT 'vara'::public.tip_anvelopa NOT NULL,
    adancime double precision,
    comments text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.anvelope OWNER TO berlinstar;

--
-- Name: anvelope_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.anvelope_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anvelope_id_seq OWNER TO berlinstar;

--
-- Name: anvelope_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.anvelope_id_seq OWNED BY public.anvelope.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id integer NOT NULL,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    image_path character varying(500),
    account_id integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT '1970-01-01 00:00:00'::timestamp without time zone NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.categories OWNER TO berlinstar;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO berlinstar;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: cazare_anvelope_items; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.cazare_anvelope_items (
    id integer NOT NULL,
    account_id integer NOT NULL,
    cazare_id integer NOT NULL,
    anvelopa_id integer
);


ALTER TABLE public.cazare_anvelope_items OWNER TO berlinstar;

--
-- Name: cazare_anvelope_items_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.cazare_anvelope_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cazare_anvelope_items_id_seq OWNER TO berlinstar;

--
-- Name: cazare_anvelope_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.cazare_anvelope_items_id_seq OWNED BY public.cazare_anvelope_items.id;


--
-- Name: cazari_anvelope; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.cazari_anvelope (
    id integer NOT NULL,
    account_id integer NOT NULL,
    client_id integer,
    employee_id integer,
    loc_cazare_id integer,
    data_checkin date NOT NULL,
    data_checkout date,
    comments text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    dep_anvelope boolean DEFAULT true NOT NULL,
    dep_capace boolean DEFAULT false NOT NULL,
    dep_roti_complete boolean DEFAULT false NOT NULL,
    dep_antifurturi boolean DEFAULT false NOT NULL,
    dep_prezoane boolean DEFAULT false NOT NULL,
    referinta_cazare_id integer,
    montate_pe_masina boolean DEFAULT false NOT NULL
);


ALTER TABLE public.cazari_anvelope OWNER TO berlinstar;

--
-- Name: cazari_anvelope_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.cazari_anvelope_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cazari_anvelope_id_seq OWNER TO berlinstar;

--
-- Name: cazari_anvelope_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.cazari_anvelope_id_seq OWNED BY public.cazari_anvelope.id;


--
-- Name: clienti; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.clienti (
    id integer NOT NULL,
    account_id integer NOT NULL,
    tip character varying(10) DEFAULT 'fizic'::character varying NOT NULL,
    nume character varying(200) NOT NULL,
    cui character varying(50),
    reprezentant character varying(200),
    telefon character varying(50),
    email character varying(255),
    adresa text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    comments text,
    description text,
    numar_masina character varying(50)
);


ALTER TABLE public.clienti OWNER TO berlinstar;

--
-- Name: clienti_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.clienti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clienti_id_seq OWNER TO berlinstar;

--
-- Name: clienti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.clienti_id_seq OWNED BY public.clienti.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    account_id integer NOT NULL,
    cui bigint NOT NULL,
    name character varying(300) NOT NULL,
    address text,
    nr_reg_com character varying(50),
    phone character varying(50),
    postal_code character varying(20),
    is_vat_payer boolean,
    registration_status character varying(200),
    description text,
    comments text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    tva_percentage double precision,
    logo_path character varying(500),
    background_path character varying(500),
    website character varying(500),
    bank_name character varying(200),
    iban character varying(50),
    capital_social double precision DEFAULT '200'::double precision
);


ALTER TABLE public.companies OWNER TO berlinstar;

--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.companies_id_seq OWNER TO berlinstar;

--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    image_path character varying(500),
    account_id integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT '1970-01-01 00:00:00'::timestamp without time zone NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.departments OWNER TO berlinstar;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    account_id integer NOT NULL,
    location_id integer,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.devices OWNER TO berlinstar;

--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_id_seq OWNER TO berlinstar;

--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: dimensiuni_anvelope; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.dimensiuni_anvelope (
    id integer NOT NULL,
    account_id integer NOT NULL,
    valoare character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.dimensiuni_anvelope OWNER TO berlinstar;

--
-- Name: dimensiuni_anvelope_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.dimensiuni_anvelope_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dimensiuni_anvelope_id_seq OWNER TO berlinstar;

--
-- Name: dimensiuni_anvelope_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.dimensiuni_anvelope_id_seq OWNED BY public.dimensiuni_anvelope.id;


--
-- Name: disclaimers; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.disclaimers (
    id integer NOT NULL,
    account_id integer NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    title text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.disclaimers OWNER TO berlinstar;

--
-- Name: disclaimers_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.disclaimers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.disclaimers_id_seq OWNER TO berlinstar;

--
-- Name: disclaimers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.disclaimers_id_seq OWNED BY public.disclaimers.id;


--
-- Name: employee_locations; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.employee_locations (
    employee_id integer NOT NULL,
    location_id integer NOT NULL
);


ALTER TABLE public.employee_locations OWNER TO berlinstar;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    account_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    image_path character varying(500),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    target numeric(12,2) NOT NULL,
    current_target_accumulation numeric(12,2) NOT NULL
);


ALTER TABLE public.employees OWNER TO berlinstar;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO berlinstar;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.items (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    price numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL,
    unit character varying(50) NOT NULL,
    is_deleted boolean NOT NULL,
    type public.item_type NOT NULL,
    category_id integer NOT NULL,
    image_path character varying(500),
    account_id integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.items OWNER TO berlinstar;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO berlinstar;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: location_departments; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.location_departments (
    location_id integer NOT NULL,
    department_id integer NOT NULL
);


ALTER TABLE public.location_departments OWNER TO berlinstar;

--
-- Name: locations; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    account_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    disclaimer_id integer,
    company_id integer,
    register_id integer,
    image_path character varying(500)
);


ALTER TABLE public.locations OWNER TO berlinstar;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO berlinstar;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: locuri_cazare; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.locuri_cazare (
    id integer NOT NULL,
    account_id integer NOT NULL,
    nume character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.locuri_cazare OWNER TO berlinstar;

--
-- Name: locuri_cazare_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.locuri_cazare_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locuri_cazare_id_seq OWNER TO berlinstar;

--
-- Name: locuri_cazare_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.locuri_cazare_id_seq OWNED BY public.locuri_cazare.id;


--
-- Name: marci_anvelope; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.marci_anvelope (
    id integer NOT NULL,
    account_id integer NOT NULL,
    nume character varying(200) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.marci_anvelope OWNER TO berlinstar;

--
-- Name: marci_anvelope_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.marci_anvelope_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marci_anvelope_id_seq OWNER TO berlinstar;

--
-- Name: marci_anvelope_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.marci_anvelope_id_seq OWNED BY public.marci_anvelope.id;


--
-- Name: programari; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.programari (
    id integer NOT NULL,
    account_id integer NOT NULL,
    titlu character varying(200) NOT NULL,
    notite text,
    client_id integer,
    location_id integer NOT NULL,
    department_id integer,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status public.programare_status DEFAULT 'Programat'::public.programare_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.programari OWNER TO berlinstar;

--
-- Name: programari_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.programari_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.programari_id_seq OWNER TO berlinstar;

--
-- Name: programari_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.programari_id_seq OWNED BY public.programari.id;


--
-- Name: receipt_items; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.receipt_items (
    id integer NOT NULL,
    receipt_id integer NOT NULL,
    name character varying(200) NOT NULL,
    price numeric(10,2) NOT NULL,
    qty integer NOT NULL,
    unit character varying(50) NOT NULL,
    employee_id integer,
    account_id integer
);


ALTER TABLE public.receipt_items OWNER TO berlinstar;

--
-- Name: receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipt_items_id_seq OWNER TO berlinstar;

--
-- Name: receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.receipt_items_id_seq OWNED BY public.receipt_items.id;


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.receipts (
    id integer NOT NULL,
    account_id integer NOT NULL,
    titlu character varying(200) NOT NULL,
    descriere text,
    date_tehn text,
    created_at timestamp with time zone NOT NULL,
    total numeric(10,2) NOT NULL,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    updated_at timestamp with time zone,
    pay_method public.pay_method DEFAULT 'NEPLATIT'::public.pay_method NOT NULL,
    partial_pay numeric(10,2),
    client_id integer,
    deviz_serie character varying(50) NOT NULL,
    deviz_nr integer NOT NULL,
    factura_serie character varying(50) NOT NULL,
    factura_nr integer NOT NULL,
    chitanta_serie character varying(50) NOT NULL,
    chitanta_nr integer NOT NULL,
    programare_id integer,
    location_id integer
);


ALTER TABLE public.receipts OWNER TO berlinstar;

--
-- Name: receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipts_id_seq OWNER TO berlinstar;

--
-- Name: receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.receipts_id_seq OWNED BY public.receipts.id;


--
-- Name: registers; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.registers (
    id integer NOT NULL,
    account_id integer NOT NULL,
    name character varying(200) NOT NULL,
    deviz_serie character varying(50) DEFAULT ''::character varying NOT NULL,
    deviz_numar integer DEFAULT 0 NOT NULL,
    factura_serie character varying(50) DEFAULT ''::character varying NOT NULL,
    factura_numar integer DEFAULT 0 NOT NULL,
    chitanta_serie character varying(50) DEFAULT ''::character varying NOT NULL,
    chitanta_numar integer DEFAULT 0 NOT NULL,
    aviz_serie character varying(50) DEFAULT ''::character varying NOT NULL,
    aviz_numar integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    company_id integer
);


ALTER TABLE public.registers OWNER TO berlinstar;

--
-- Name: registers_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.registers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registers_id_seq OWNER TO berlinstar;

--
-- Name: registers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.registers_id_seq OWNED BY public.registers.id;


--
-- Name: themes_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.themes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.themes_id_seq OWNER TO berlinstar;

--
-- Name: themes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.themes_id_seq OWNED BY public.departments.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: anvelope id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope ALTER COLUMN id SET DEFAULT nextval('public.anvelope_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: cazare_anvelope_items id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazare_anvelope_items ALTER COLUMN id SET DEFAULT nextval('public.cazare_anvelope_items_id_seq'::regclass);


--
-- Name: cazari_anvelope id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope ALTER COLUMN id SET DEFAULT nextval('public.cazari_anvelope_id_seq'::regclass);


--
-- Name: clienti id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.clienti ALTER COLUMN id SET DEFAULT nextval('public.clienti_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.themes_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: dimensiuni_anvelope id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.dimensiuni_anvelope ALTER COLUMN id SET DEFAULT nextval('public.dimensiuni_anvelope_id_seq'::regclass);


--
-- Name: disclaimers id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.disclaimers ALTER COLUMN id SET DEFAULT nextval('public.disclaimers_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: locuri_cazare id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locuri_cazare ALTER COLUMN id SET DEFAULT nextval('public.locuri_cazare_id_seq'::regclass);


--
-- Name: marci_anvelope id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.marci_anvelope ALTER COLUMN id SET DEFAULT nextval('public.marci_anvelope_id_seq'::regclass);


--
-- Name: programari id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari ALTER COLUMN id SET DEFAULT nextval('public.programari_id_seq'::regclass);


--
-- Name: receipt_items id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipt_items ALTER COLUMN id SET DEFAULT nextval('public.receipt_items_id_seq'::regclass);


--
-- Name: receipts id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts ALTER COLUMN id SET DEFAULT nextval('public.receipts_id_seq'::regclass);


--
-- Name: registers id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.registers ALTER COLUMN id SET DEFAULT nextval('public.registers_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.accounts (id, name, description, created_at, updated_at, is_deleted, username, password, email, image_url, is_locked, locked_at) FROM stdin;
1	Alex Gligor	\N	2026-03-23 21:03:19.334094+00	\N	f	alexgligor	QURBU1Rvb2xzMQ==	\N	\N	t	2026-03-23 21:03:19.33146+00
2	ASCET COM	\N	2026-03-23 21:14:15.801191+00	\N	f	ascetcom	NTE1NDMxMA==	ascetcom@yahoo.com	\N	f	\N
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.alembic_version (version_num) FROM stdin;
x5y6z0a1b2c3
\.


--
-- Data for Name: anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.anvelope (id, account_id, client_id, marca_id, dimensiune_id, tip, adancime, comments, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.247222+00	\N	f	\N
2	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.394893+00	\N	f	\N
3	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.510014+00	\N	f	\N
4	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.625685+00	\N	f	\N
5	2	1	1	1	vara	4	\N	2026-03-24 00:50:02.658092+00	\N	f	\N
6	2	1	1	1	vara	4	\N	2026-03-24 00:50:02.910036+00	\N	f	\N
7	2	1	1	1	vara	4	\N	2026-03-24 00:50:03.023672+00	\N	f	\N
8	2	1	1	1	vara	4	\N	2026-03-24 00:50:03.135964+00	\N	f	\N
9	2	1	1	1	vara	1	\N	2026-03-24 10:52:13.30981+00	\N	f	\N
10	2	3	2	2	vara	6	\N	2026-03-24 12:46:04.991755+00	\N	f	\N
11	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.117326+00	\N	f	\N
12	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.240404+00	\N	f	\N
13	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.362653+00	\N	f	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.categories (id, name, department_id, is_deleted, deleted_at, image_path, account_id, created_at, updated_at) FROM stdin;
1	Reglare geometrie	1	f	\N	\N	2	2026-03-23 21:51:55.567192+00	\N
2	Anvelope - roți complete	2	f	\N	\N	2	2026-03-23 21:52:17.074026+00	\N
3	Vulcanizare Camioane	3	f	\N	\N	2	2026-03-23 21:52:39.52384+00	\N
4	13–14 țoli	4	f	\N	\N	2	2026-03-23 21:53:01.393949+00	\N
5	15–16 țoli	4	f	\N	\N	2	2026-03-23 21:53:20.618749+00	\N
6	17–18 țoli	4	f	\N	\N	2	2026-03-23 21:53:33.565557+00	\N
7	19–20 țoli	4	f	\N	\N	2	2026-03-23 21:53:47.84152+00	\N
9	23–24 țoli	4	f	\N	\N	2	2026-03-23 21:54:09.527158+00	\N
10	Alte materiale	4	f	\N	\N	2	2026-03-23 21:54:36.268209+00	\N
12	Echilibrare Premium	4	f	\N	\N	2	2026-03-23 21:55:08.393454+00	\N
14	Înlocuit valvă	4	f	\N	\N	2	2026-03-23 21:55:39.456296+00	\N
15	Presiune Roată	4	f	\N	\N	2	2026-03-23 21:56:02.982023+00	\N
8	21–22 țoli	4	f	\N	\N	2	2026-03-23 21:53:58.091976+00	\N
11	Aplicat petec	4	f	\N	\N	2	2026-03-23 21:54:50.405897+00	\N
13	Îndreptat jantă	4	f	\N	\N	2	2026-03-23 21:55:25.352567+00	2026-03-24 00:23:12.419262+00
\.


--
-- Data for Name: cazare_anvelope_items; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.cazare_anvelope_items (id, account_id, cazare_id, anvelopa_id) FROM stdin;
21	2	1	1
22	2	1	2
23	2	1	3
24	2	1	4
25	2	2	5
26	2	2	6
27	2	2	7
28	2	2	8
29	2	3	9
30	2	4	10
31	2	4	11
32	2	4	12
33	2	4	13
\.


--
-- Data for Name: cazari_anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.cazari_anvelope (id, account_id, client_id, employee_id, loc_cazare_id, data_checkin, data_checkout, comments, created_at, updated_at, is_deleted, deleted_at, dep_anvelope, dep_capace, dep_roti_complete, dep_antifurturi, dep_prezoane, referinta_cazare_id, montate_pe_masina) FROM stdin;
1	2	1	2	1	2026-03-24	\N	\N	2026-03-24 00:47:50.750953+00	2026-03-24 00:49:32.732255+00	f	\N	t	f	f	f	f	\N	f
2	2	1	28	1	2026-03-24	\N	\N	2026-03-24 00:50:03.257682+00	\N	t	2026-03-24 00:51:40.205582+00	t	f	f	f	f	\N	f
3	2	1	21	1	2026-03-24	\N	\N	2026-03-24 10:52:13.500569+00	\N	f	\N	t	f	f	f	f	\N	f
4	2	3	21	1	2026-03-24	2026-03-25	4ANV +4J +4 CAPAC	2026-03-24 12:46:05.492937+00	2026-03-25 09:18:47.189115+00	f	\N	t	f	f	f	f	\N	f
\.


--
-- Data for Name: clienti; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.clienti (id, account_id, tip, nume, cui, reprezentant, telefon, email, adresa, created_at, updated_at, is_deleted, deleted_at, comments, description, numar_masina) FROM stdin;
1	2	juridic	PROFESSOR PRIME S.R.L.	47829189	\N	\N	\N	JUD. TIMIŞ, SAT GIARMATA COM. GIARMATA, STR. PRIMĂVERII, NR.90	2026-03-24 00:42:04.891609+00	\N	f	\N	\N	\N	\N
2	2	juridic	ASCET	\N	LITA ROMEO	5456452121	\N	\N	2026-03-24 12:35:25.186749+00	\N	f	\N	\N	\N	\N
3	2	juridic	ASCET COM SRL	5154310	LITA	454225	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. 1 MAI, BL.S5, SC.1, AP.1	2026-03-24 12:36:56.106899+00	\N	f	\N	\N	\N	\N
4	2	fizic	STANESCU COSTINEL	\N	\N	076911051411	\N	\N	2026-03-24 14:38:31.612695+00	\N	f	\N	\N	\N	\N
5	2	fizic	LUNGU IONELA	\N	\N	0727828751	\N	\N	2026-03-24 15:04:46.196838+00	\N	f	\N	\N	\N	\N
6	2	fizic	LUNGU RADU	\N	\N	545854551451	\N	\N	2026-03-24 15:36:20.334712+00	\N	f	\N	\N	\N	\N
7	2	fizic	iovita adrian	\N	\N	04784	\N	\N	2026-03-25 07:40:22.894012+00	\N	f	\N	\N	\N	\N
8	2	fizic	grecu marian	\N	\N	0723806933	\N	\N	2026-03-25 08:08:46.123586+00	\N	f	\N	\N	\N	\N
9	2	fizic	eptisa	\N	\N	\N	\N	\N	2026-03-25 09:57:02.775969+00	\N	f	\N	\N	\N	\N
10	2	juridic	BUSCHA BAR SRL	29559869	stan luis	0726154222	\N	JUD. DOLJ, SAT GHERCEŞTI COM. GHERCEŞTI, STR. AVIATORILOR, NR.10, UNITATEA U14/C6.1	2026-03-25 10:44:51.300889+00	\N	f	\N	\N	\N	\N
11	2	fizic	ANDREI TUDOR	\N	\N	0723961337	\N	\N	2026-03-25 11:12:27.733578+00	\N	f	\N	\N	\N	\N
12	2	juridic	RAIMAN TOBACCO S.R.L.	48814780	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. TRAIAN LALESCU, NR.19	2026-03-25 11:22:39.109705+00	\N	f	\N	\N	\N	\N
14	2	juridic	COLDRENT SRL	30007280	Saveluc Robert	0736101828	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ANA IPĂTESCU, NR.127	2026-03-25 12:00:35.112966+00	\N	f	\N	\N	\N	\N
15	2	juridic	METALROM INDUSTRY SRL	RO16300608	BELETU GIAN'ANTONIO	0746556886	\N	JUD. VASLUI, MUN. BÂRLAD, BLD. REPUBLICII, NR.320	2026-03-25 12:38:24.162297+00	\N	f	\N	\N	\N	\N
16	2	fizic	SINCU GRIGORE	\N	\N	0752278693	\N	\N	2026-03-25 13:03:43.055981+00	\N	f	\N	\N	\N	\N
17	2	fizic	LUPU SORIN	\N	\N	0745139768	\N	\N	2026-03-25 13:24:34.217584+00	\N	f	\N	\N	\N	\N
18	2	fizic	STANCIOIU MARIA MIRELA	\N	\N	0726694206	\N	\N	2026-03-25 13:50:07.280954+00	\N	f	\N	\N	\N	\N
19	2	fizic	spach	\N	\N	0753052796	\N	\N	2026-03-25 14:03:09.16159+00	\N	f	\N	\N	\N	\N
20	2	juridic	NATURAL SRL	1543994	\N	\N	\N	JUD. OLT, MUN. SLATINA, STR. PITEŞTI, NR.110K	2026-03-25 14:21:02.483888+00	\N	f	\N	\N	\N	\N
21	2	juridic	ESCULAP SRL	2326721	\N	0726227333	\N	JUD. DOLJ, MUN. CRAIOVA, ALEEA HORTENSIEI, NR.2, BL.158D, SC.1, AP.3	2026-03-25 14:24:21.055134+00	\N	f	\N	\N	\N	\N
22	2	fizic	RUJOIU CRISTINA	\N	\N	0786296769	\N	\N	2026-03-25 14:55:16.745252+00	\N	f	\N	\N	\N	\N
23	2	fizic	LUNGU GEORGE	\N	\N	0767201343	\N	\N	2026-03-26 06:22:09.27507+00	\N	f	\N	\N	\N	\N
24	2	fizic	LICA STEFAN	\N	\N	0761406098	\N	\N	2026-03-26 07:19:29.659197+00	\N	f	\N	\N	\N	\N
25	2	juridic	GEBRUDER WEISS SRL	RO6614115	\N	0372678500	\N	\N	2026-03-26 08:06:11.159188+00	\N	f	\N	\N	\N	\N
26	2	juridic	MEM HEALTHCARE & RESEARCH S.R.L.	39327122	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ALEXANDRU IOAN CUZA, NR.5, BL.ROMARTA	2026-03-26 08:07:34.803534+00	\N	f	\N	\N	\N	\N
27	2	juridic	TECHNO TEAM GROUP S.R.L.	34308561	\N	\N	\N	JUD. DOLJ, COM. MALU MARE, STR HENRY FORD, NR.20	2026-03-26 08:19:57.716943+00	\N	f	\N	\N	\N	\N
28	2	juridic	SUPERFOOD COMPANY SRL	RO6045338	\N	\N	\N	JUD. ILFOV, SAT PANTELIMON ORŞ. PANTELIMON, STR. IZLAZULUI, NR.3	2026-03-26 08:26:05.281174+00	\N	f	\N	\N	\N	\N
29	2	juridic	DIVERSINST SRL	RO3730476	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. VASLUI, NR.3	2026-03-26 08:40:17.558498+00	\N	f	\N	\N	\N	\N
30	2	fizic	relea ovidiu	\N	\N	0723322303	\N	\N	2026-03-26 08:49:40.672188+00	\N	f	\N	\N	\N	\N
31	2	juridic	NATURAL SRL	1543994	\N	\N	\N	JUD. OLT, MUN. SLATINA, STR. PITEŞTI, NR.110K	2026-03-26 09:21:51.411635+00	\N	f	\N	\N	\N	\N
32	2	fizic	TONCA ROMEO	\N	\N	0748216005	\N	\N	2026-03-26 10:39:26.29797+00	\N	f	\N	\N	\N	\N
33	2	juridic	TONCA N. ROMEO-NICOLAE  AGENT ASIGURARI	36481410	\N	\N	\N	JUD. DOLJ, ORŞ. SEGARCEA, STR. REPUBLICII, NR.78, BL.J3, SC.1, ET.1	2026-03-26 10:39:53.47744+00	\N	f	\N	\N	\N	\N
34	2	juridic	VILAMIR COM SRL	16482895	\N	\N	\N	JUD. DOLJ, SAT PREAJBA COM. MALU MARE, STR. HENRY FORD, NR.18A	2026-03-26 11:12:56.761729+00	\N	f	\N	\N	\N	\N
35	2	fizic	dimescu	\N	\N	\N	\N	\N	2026-03-26 11:19:22.741439+00	\N	f	\N	\N	\N	\N
36	2	juridic	ALBALACT SA	RO1755369	\N	\N	\N	JUD. ALBA, SAT OIEJDEA COM. GALDA DE JOS,  DN1 KM 392+600	2026-03-26 12:27:08.78588+00	\N	f	\N	\N	\N	\N
37	2	juridic	TOP RUBBER COVER S.R.L.	RO36737802	\N	\N	\N	JUD. GORJ, ORŞ. TURCENI, STR. 1 MARTIE, CAMERA NR. 1, BL.P12, SC.1, ET.3, AP.12	2026-03-26 13:14:51.571303+00	\N	f	\N	\N	\N	\N
38	2	fizic	POPA ALEXANDRU	\N	\N	0749269840	\N	\N	2026-03-26 14:08:02.439878+00	\N	f	\N	\N	\N	\N
39	2	fizic	popa alexandru	\N	\N	\N	\N	\N	2026-03-26 15:16:03.439825+00	\N	f	\N	\N	\N	\N
40	2	juridic	COOL OPTIC MEDICAL SRL	37526153	\N	\N	\N	JUD. DOLJ, SAT GÂRLEŞTI COM. GHERCEŞTI, STR. EROILOR, NR.93	2026-03-27 06:58:02.784415+00	\N	f	\N	\N	\N	\N
41	2	fizic	pop	\N	\N	2346778986	\N	\N	2026-03-27 07:10:59.018232+00	\N	f	\N	\N	\N	\N
42	2	juridic	LABORATORIUM LIFE SCIENCE SRL	RO29662316	\N	\N	\N	JUD. GALAŢI, ORŞ. TÂRGU BUJOR, STR. ABATORULUI, NR.16, CAMERA 2	2026-03-27 07:52:32.738245+00	\N	f	\N	\N	\N	\N
43	2	fizic	TRANA MARIUS	\N	\N	0767571750	\N	\N	2026-03-27 07:57:43.555808+00	\N	f	\N	\N	\N	\N
44	2	juridic	STROIE ARDELEANUL SRL	RO31656650	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. 1 MAI, NR.82, BL.A7B, SC.1, AP.33	2026-03-27 08:13:00.801587+00	\N	f	\N	\N	\N	\N
45	2	juridic	TTT ASIG SRL	35257644	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. PANTELIMON, NR.4	2026-03-27 10:25:31.517565+00	\N	f	\N	\N	\N	\N
46	2	juridic	CESIVO AGRICULTURA S.R.L.	41001445	\N	\N	\N	JUD. DOLJ, SAT COŞOVENI COM. COŞOVENI, STR. PRINCIPALĂ, NR.45	2026-03-27 11:33:48.485624+00	\N	f	\N	\N	\N	\N
47	2	juridic	DUO ANTEEA SRL	36857795	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. PARÎNGULUI, NR.98B	2026-03-27 11:57:55.791801+00	\N	f	\N	\N	\N	\N
48	2	juridic	OLTENIA GARDEN SRL	RO11289053	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI,  , TARLAUA 83. PARCELA 675	2026-03-27 12:51:47.525188+00	\N	f	\N	\N	\N	\N
49	2	fizic	NEDIANU VASILE	\N	\N	\N	\N	\N	2026-03-27 14:13:56.855397+00	\N	f	\N	\N	\N	\N
50	2	fizic	ZAMFIR MARIUS	\N	\N	0738121000	\N	\N	2026-03-30 05:53:28.123309+00	\N	f	\N	\N	\N	DJ 47 DXM
51	2	fizic	NENIU MARIUS	\N	\N	0760284808	\N	\N	2026-03-30 05:57:34.268613+00	\N	f	\N	\N	\N	\N
52	2	juridic	CASSIA BUSINESS SRL	RO4518979	\N	0771575093	\N	\N	2026-03-30 06:15:27.746543+00	\N	f	\N	\N	\N	\N
53	2	juridic	CRIS-TIM FAMILY HOLDING S.A.	13533870	\N	\N	\N	JUD. PRAHOVA, SAT FILIPEŞTII DE PĂDURE COM. FILIPEŞTII DE PĂDURE, STR. GĂRII, NR.661	2026-03-30 06:29:54.262086+00	\N	f	\N	\N	\N	\N
54	2	juridic	POPMENT S.R.L.	RO44346643	\N	0792771199	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CAL. BUCUREŞTI, NR.47	2026-03-30 07:24:07.971341+00	\N	f	\N	\N	\N	DJ 15 ZTU
55	2	juridic	CONSTRUCTII ERBASU SA	RO430008	\N	0766476688	\N	MUNICIPIUL BUCUREŞTI, SECTOR 1, STR. NICOLAE G. CARAMFIL, NR.72, PARTER. AP. 1 (CAMERELE 2 ŞI 4). AP.2, BL.XXII A	2026-03-30 08:01:18.137481+00	\N	f	\N	\N	\N	B 160 SCE
56	2	fizic	stancu valentin	\N	\N	0746048608	\N	\N	2026-03-30 08:28:25.900031+00	\N	f	\N	\N	\N	\N
57	2	juridic	HOUSENEAG S.R.L.	RO41681040	NEAGOE DUMITRU	\N	\N	JUD. VÂLCEA, SAT OLTEŢU COM. ZĂTRENI, OLTEŢU, NR.91	2026-03-30 09:21:17.445802+00	\N	f	\N	\N	\N	VL25HSN
59	2	fizic	BARANESCU DORINEL	\N	\N	0765215240	\N	\N	2026-03-30 09:33:05.582979+00	\N	f	\N	\N	PASSAT B8	\N
60	2	juridic	PLUS PAN SRL	RO27969161	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, CAL. BUCUREŞTI, NR.325C	2026-03-30 09:40:16.190319+00	\N	f	\N	\N	\N	\N
62	2	juridic	NEDA-MAIA SRL	RO27423401	\N	0761145897	\N	\N	2026-03-30 10:08:28.324151+00	\N	f	\N	\N	\N	\N
13	2	fizic	lita romeo	\N	\N	0767122920	\N	\N	2026-03-25 11:37:01.405559+00	\N	t	2026-03-31 08:49:19.237806+00	\N	\N	\N
58	2	fizic	lita  marius	\N	\N	1445645452	\N	\N	2026-03-30 09:28:25.240338+00	\N	t	2026-03-31 08:49:22.49544+00	\N	\N	\N
61	2	fizic	LITA ADRIAN	\N	\N	0765122920	\N	\N	2026-03-30 09:46:50.185923+00	\N	t	2026-03-31 08:49:32.547901+00	\N	FFFFH	\N
63	2	juridic	ADALMAR COM SRL	RO7678877	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. BRAZDA LUI NOVAC, BL.C8A, SC.1, AP.20	2026-03-30 10:34:16.149805+00	\N	f	\N	\N	\N	\N
64	2	juridic	DANIEL ACHIM	AUTONOM	\N	0721215491	\N	\N	2026-03-30 10:55:14.801101+00	\N	f	\N	\N	x7	B 717 RTT
65	2	fizic	RUSU ALIN	\N	\N	0774045935	\N	\N	2026-03-30 12:06:59.920532+00	\N	f	\N	\N	\N	DJ 23 RSU
66	2	fizic	george	\N	\N	0766664412	\N	\N	2026-03-30 12:22:01.18611+00	\N	f	\N	\N	SEAT	DJ23AGN
67	2	fizic	chifu iulia	\N	\N	0757014399	\N	\N	2026-03-30 12:41:23.208083+00	\N	f	\N	\N	toyota ch r	DJ 06 YUL
69	2	fizic	liviu	\N	\N	0769513919	\N	\N	2026-03-31 05:56:00.242842+00	\N	f	\N	\N	logan	DJ08YUD
70	2	juridic	TIMSORT  SRL	28646070	OPRISOR TOMICA	\N	\N	JUD. GORJ, SAT SCOARŢA COM. SCOARŢA, STR. TRANDAFIRILOR, NR.25	2026-03-31 06:19:13.091178+00	\N	f	\N	\N	\N	\N
71	2	juridic	liviu	\N	\N	0769513919	\N	\N	2026-03-31 06:39:24.689409+00	\N	f	\N	\N	ford tranzit	DJ75MTH
72	2	juridic	LIVIU	MED TEHNICA	\N	0769513919	\N	\N	2026-03-31 06:46:49.006046+00	\N	f	\N	\N	\N	DJ75MTH
73	2	fizic	george	\N	\N	0722176600	\N	\N	2026-03-31 07:24:03.788096+00	\N	f	\N	\N	renault	DJ30RAN
74	2	fizic	ANDRITOIU DAN	\N	\N	0748 360 000	\N	\N	2026-03-31 07:38:23.995618+00	\N	f	\N	\N	\N	DJ 17 ZCC
76	2	juridic	SECPRAL PRO INSTALATII SRL	RO10166281	\N	0762661399	\N	JUD. CLUJ, MUN. CLUJ-NAPOCA, STR.  VLAD TEPES, NR.2	2026-03-31 08:07:55.028654+00	\N	f	\N	\N	nica mihai	\N
77	2	juridic	BRICIU ROMAN	RO24830141	ROMAN	0744910683	\N	\N	2026-03-31 08:13:44.033346+00	\N	f	\N	\N	FORD TRANZIT 0744910683	DJ12GOA
68	2	fizic	LITA ROMEO	\N	\N	0767122920	\N	\N	2026-03-30 13:44:43.256104+00	\N	t	2026-03-31 08:49:25.965778+00	\N	\N	\N
75	2	fizic	LITA  ROMEO-1	\N	\N	0767122920	\N	\N	2026-03-31 08:06:32.342637+00	2026-03-31 08:49:40.968651+00	f	\N	\N	\N	DJ77LIT
78	2	fizic	ROMEO LITA	\N	\N	0767122920	\N	\N	2026-03-31 08:50:20.960857+00	\N	f	\N	\N	\N	\N
79	2	fizic	STANICA LAURIANA	\N	\N	454	\N	\N	2026-03-31 08:53:21.529085+00	\N	f	\N	\N	\N	\N
80	2	juridic	ASCET COM SRL	5154310	HOTU NICU	454545	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. 1 MAI, BL.S5, SC.1, AP.1	2026-03-31 08:55:03.856331+00	\N	f	\N	\N	\N	\N
81	2	fizic	HOTU MARIAN NICUSOR	\N	\N	07656145251	WA	CRAIOAV	2026-03-31 08:58:37.17866+00	\N	f	\N	\N	SMEN	DJ18HOT
82	2	fizic	HOTU NICU	\N	\N	FSDAFAS	SADF	FSDA	2026-03-31 08:59:41.868338+00	\N	f	\N	\N	S	\N
83	2	fizic	CATANEA  IULIAN	\N	\N	021830807	\N	\N	2026-03-31 09:35:49.603975+00	\N	f	\N	\N	SCIROCCO	DJ93LUZ
84	2	fizic	alex cercel	\N	\N	0773765587	\N	\N	2026-03-31 09:45:01.928448+00	\N	f	\N	\N	bmw x6	DJ77CER
85	2	juridic	ELCO SRL	RO17549527	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR CORNEȘULUI, NR.92	2026-03-31 09:55:32.312961+00	\N	f	\N	\N	\N	\N
86	2	fizic	marin florian	\N	\N	\N	\N	\N	2026-03-31 10:13:36.222091+00	\N	f	\N	\N	\N	\N
87	2	fizic	TECU ANDREI	\N	\N	0735726172	\N	\N	2026-03-31 10:52:08.818703+00	\N	f	\N	\N	\N	DJ 35 XSX
88	2	juridic	marigab	RO15094917	stefan	0764312342	\N	\N	2026-03-31 10:59:37.718249+00	\N	f	\N	\N	porsche	B666EFI
89	2	juridic	SOUDAL SRL	ro14509161	\N	0769650131	\N	JUD. DÂMBOVIŢA, SAT CREVEDIA COM. CREVEDIA, ŞOS. BUCUREŞTI-TÂRGOVIŞTE, NR.697C, "CREVEDIA LOGISTIC PARC"	2026-03-31 11:33:59.474652+00	\N	f	\N	\N	\N	DB 23 SDL
90	2	juridic	DOROS IMPEX SRL	RO5862392	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. TOAMNEI, NR.30-32	2026-03-31 12:01:06.769718+00	\N	f	\N	\N	\N	\N
91	2	fizic	BUJOR ANA LILIANA	\N	\N	0760617949	\N	\N	2026-03-31 12:05:27.031983+00	\N	f	\N	\N	\N	OT 33 LYL
92	2	juridic	sc valtmar srl	\N	\N	0761626131	\N	\N	2026-03-31 12:21:09.810147+00	\N	f	\N	\N	\N	\N
93	2	fizic	silviu banica	\N	\N	0751168417	\N	\N	2026-03-31 12:27:31.448125+00	\N	f	\N	\N	audi q7	DJ28BUV
94	2	juridic	MEDIKON S.R.L.	42958034	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. CARACAL, NR.109, BIROUL E2-22, ET.2	2026-03-31 12:47:31.465466+00	\N	f	\N	\N	\N	\N
95	2	fizic	BUNGIU DAN	\N	\N	0770 403 115	\N	\N	2026-03-31 13:15:57.954384+00	\N	f	\N	\N	\N	\N
96	2	fizic	chirea valeriu	\N	\N	0744699117	\N	\N	2026-03-31 13:21:12.270828+00	\N	f	\N	\N	\N	\N
97	2	fizic	marian	\N	\N	0768455727	\N	\N	2026-03-31 13:56:40.073695+00	\N	f	\N	\N	seria s7	DJ77VNS
98	2	fizic	sile	\N	\N	0724571173	\N	\N	2026-03-31 14:06:32.649996+00	\N	f	\N	\N	HYUNDAI KONA	DJ17PCU
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.companies (id, account_id, cui, name, address, nr_reg_com, phone, postal_code, is_vat_payer, registration_status, description, comments, created_at, updated_at, is_deleted, deleted_at, tva_percentage, logo_path, background_path, website, bank_name, iban, capital_social) FROM stdin;
1	1	47829189	PROFESSOR PRIME S.R.L.	JUD. TIMIŞ, SAT GIARMATA COM. GIARMATA, STR. PRIMĂVERII, NR.90	J2023001139353	0744138843	307210	f	INREGISTRAT din data 16.03.2023	\N	\N	2026-03-23 21:04:50.303658+00	\N	f	\N	\N	\N	\N	professorprime.ro	\N	\N	200
2	2	5154310	ASCET COM SRL	JUD. DOLJ, MUN. CRAIOVA, BLD. 1 MAI, BL.S5, SC.1, AP.1	J16/3351/1993	0786345577	\N	t	INREGISTRAT din data 03.02.1994	\N	\N	2026-03-23 21:17:16.610746+00	2026-03-28 15:30:26.451059+00	f	\N	21	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/companies/logos/1b51e6d462e049199e7fe0d1f6deda01.png	\N	www.anvelopeascet.ro/	Banca Transilvania	RO15BTRL01701202471096XX	200
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.departments (id, name, description, is_deleted, deleted_at, image_path, account_id, created_at, updated_at) FROM stdin;
1	Geometrie	Reglaj geometrie roți	f	\N	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/departments/f805028e0aaf402dbe63af7f9c246821.png	2	2026-03-23 21:49:06.478545+00	2026-03-23 21:50:41.297092+00
2	Hotel Anvelope	Anvelope și roți complete	f	\N	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/departments/6b71da3f1ad84cfea3c30336f82c1e3e.png	2	2026-03-23 21:49:25.168284+00	2026-03-23 21:50:51.032918+00
3	Vulcanizare Camioane	\N	f	\N	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/departments/bef5c157129e45f981c78e3e579cb82f.png	2	2026-03-23 21:49:46.312766+00	2026-03-23 21:51:01.6452+00
4	Vulcanizare Turisme	\N	f	\N	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/departments/d50bf7e08ecb4a4d9a70f93f469eade5.png	2	2026-03-23 21:50:04.673028+00	2026-03-23 21:51:13.332967+00
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.devices (id, name, account_id, location_id, created_at) FROM stdin;
1	Argintiu-Capra-UZ9R	1	1	2026-03-23 21:03:53.272289+00
2	Solar-Corb-M9Q4	2	2	2026-03-23 21:16:09.095832+00
3	Polar-Urs-A2R8	2	2	2026-03-23 22:25:52.467316+00
4	Verde-Urs-INNV	2	2	2026-03-23 22:27:59.058429+00
5	Albastru-Vultur-M30P	2	2	2026-03-23 23:02:28.889665+00
6	Solar-Cerb-NVLF	1	1	2026-03-24 05:52:06.998542+00
7	Argintiu-Corb-S1FM	2	2	2026-03-24 06:54:02.191146+00
8	Argintiu-Capra-0HUY	2	2	2026-03-24 06:55:42.746888+00
9	Polar-Capra-PDKO	2	2	2026-03-24 07:04:13.443831+00
10	Lunar-Capra-HO8P	2	2	2026-03-24 07:11:09.614942+00
11	Solar-Leu-J29S	2	2	2026-03-24 07:15:55.510946+00
12	Solar-Leu-J29S	2	2	2026-03-24 07:15:55.624191+00
13	Auriu-Vultur-IBOJ	2	2	2026-03-24 07:17:08.155809+00
14	Solar-Tigru-BS20	2	2	2026-03-24 07:23:53.13364+00
15	Verde-Bison-JFRW	2	2	2026-03-25 06:21:33.766966+00
16	Auriu-Cerb-JMUQ	2	2	2026-03-25 14:05:02.923877+00
17	Auriu-Vultur-Z6NU	2	2	2026-03-25 20:14:49.615249+00
18	Verde-Leu-3FPK	2	2	2026-03-26 06:02:58.269186+00
19	Auriu-Cerb-UTS9	2	2	2026-03-27 09:07:02.250649+00
20	Auriu-Tigru-6HJD	2	2	2026-03-27 12:56:13.84333+00
21	Polar-Urs-XZ9M	2	2	2026-03-30 08:26:06.771342+00
22	Lunar-Capra-7YIX	2	2	2026-03-30 11:49:14.763454+00
\.


--
-- Data for Name: dimensiuni_anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.dimensiuni_anvelope (id, account_id, valoare, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	17	2026-03-24 00:47:28.374173+00	\N	f	\N
2	2	225/45/17	2026-03-24 12:42:44.657814+00	\N	f	\N
3	2	215/55/17	2026-03-30 13:21:44.941179+00	\N	f	\N
\.


--
-- Data for Name: disclaimers; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.disclaimers (id, account_id, text, created_at, updated_at, is_deleted, deleted_at, title) FROM stdin;
1	2	In cazul aparitiei unui litigiu de refuz de plata, in sensul celor prevazute in art.3, alin.5 din OG 82/2000 (cu modificarilesi completarile ulterioare), se prezuma dreptul unitatii service de\naplicare a retentiei asupra vehiculului, conform art.2495 C.Cv.(legea 287/2009 republicata, publicata in M.O. Nr.505/2011).\nCertificat de calitate si garantie - Unitatea service garanteaza lucrarea executata si piesele inlocuite , conform legii nr. 296/2004, dupa cum urmeaza:\n- 30 zile pentru manopera de la data receptiei autovehiculului\n- garantie piese furnizate de unitatea sevice , in baza legii 449/2003, conform declaratiei producatorului/princonventie intre parti , 12 luni de la data predarii vehiculului.	2026-03-23 21:17:58.291634+00	\N	f	\N	Disclamer 1
\.


--
-- Data for Name: employee_locations; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.employee_locations (employee_id, location_id) FROM stdin;
14	2
7	2
21	2
15	2
3	2
29	2
17	2
6	2
25	2
16	2
22	2
24	2
11	2
9	2
13	2
10	2
18	2
28	2
4	2
12	2
1	2
8	2
2	2
23	2
20	2
27	2
19	2
26	2
5	2
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.employees (id, account_id, name, description, image_path, created_at, updated_at, is_deleted, deleted_at, target, current_target_accumulation) FROM stdin;
28	2	NITA LAURENTIU	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/62df79d71a484576b3bf8f47a6597acd.png	2026-03-23 22:15:15.199171+00	2026-03-23 22:15:46.784466+00	f	\N	25000.00	0.00
12	2	ONCICA MARIUS	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/0e33b3aea7844b62bdd5e79fb2b1500d.png	2026-03-23 22:05:31.585104+00	2026-03-23 22:05:46.955859+00	f	\N	25000.00	3203.00
2	2	LUNGU NICU	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/61e7df8f562341d28fa501d3fc2d3a3d.png	2026-03-23 21:59:06.069577+00	2026-03-23 22:00:16.769491+00	f	\N	25000.00	0.00
18	2	DICU NICOLAE C.	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/8794b9c912b748828357402bb012e808.png	2026-03-23 22:09:08.040896+00	2026-03-23 22:09:17.599628+00	f	\N	25000.00	9020.00
8	2	CALUTOIU DANIEL	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/a755bae9360c416dab88d4b854a0a545.png	2026-03-23 22:03:18.994594+00	2026-03-23 22:03:35.20452+00	f	\N	25000.00	444.00
4	2	CERNAT ANA-MARIA	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/52ed86ab43fe448494f28f378b814993.png	2026-03-23 22:00:51.826214+00	2026-03-23 22:01:04.474235+00	f	\N	25000.00	40870.00
1	2	LUNGU IONELA	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/60f656df5a8c4e91b4a3ce59eb816419.png	2026-03-23 21:58:41.843697+00	2026-03-23 22:00:05.489405+00	f	\N	25000.00	720.00
20	2	OPRAN CLAUDIU	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/0d4b7e011576497f8e1efd024becde94.png	2026-03-23 22:10:30.009357+00	2026-03-23 22:10:39.057309+00	f	\N	25000.00	4300.00
23	2	LIVEZEANU M-COSTINEL	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/dabd4bbb560d434285688d1f2b4b5188.png	2026-03-23 22:12:15.469922+00	2026-03-23 22:12:32.28833+00	f	\N	25000.00	3514.00
14	2	PETROSANU CONSTANTIN	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/ec2ba175257146b29aaa8b49b56a2b9e.png	2026-03-23 22:06:54.1811+00	2026-03-23 22:07:05.282611+00	f	\N	25000.00	1624.00
29	2	OPRISAN IULIAN	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/43e82bf3ac8349a284f1adf8efc398b3.png	2026-03-23 22:16:13.036799+00	2026-03-23 22:16:21.842535+00	f	\N	25000.00	0.00
9	2	DUMITRU SANDU G.	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/224ac259865648e0a1e91ab1d5095ca3.png	2026-03-23 22:03:53.222443+00	2026-03-23 22:04:03.817135+00	f	\N	25000.00	0.00
10	2	ION MARIAN	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/52377e7c9ef84e15b9f95299f5bfca41.png	2026-03-23 22:04:20.466189+00	2026-03-23 22:04:32.820808+00	f	\N	25000.00	1240.00
27	2	IONITA RAZVAN	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/b962543491c34532911744e5a0cb6352.png	2026-03-23 22:14:42.658727+00	2026-03-23 22:14:56.678463+00	f	\N	25000.00	296.00
24	2	MIREA CATALIN	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/fd14b58bd9e9498faebedab063f3fb27.png	2026-03-23 22:13:04.931784+00	2026-03-23 22:13:14.589621+00	f	\N	25000.00	10344.00
7	2	STANCU VALENTIN	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/1812869956f841178bf93e362d2129e0.png	2026-03-23 22:02:43.856593+00	2026-03-23 22:02:56.370024+00	f	\N	25000.00	0.00
16	2	VASILE COSTEL	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/3b56eb3199054e948e1c5d15380011ad.png	2026-03-23 22:08:01.015951+00	2026-03-23 22:08:13.167086+00	f	\N	25000.00	192.00
15	2	STAN STEFANITA	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/44f79e585e564ff9b89dfdc224a7c6ad.png	2026-03-23 22:07:23.424631+00	2026-03-23 22:07:40.709185+00	f	\N	25000.00	2263.00
11	2	ONCICA I. IONUT	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/9774b46bc41045879f4e5fb393ed4b74.png	2026-03-23 22:04:49.690075+00	2026-03-23 22:05:00.190464+00	f	\N	25000.00	528.00
5	2	GEORGESCU F-LARISA	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/f5866a2a79be4e8a9c9a109891b1eb81.png	2026-03-23 22:01:20.997433+00	2026-03-23 22:01:43.55113+00	f	\N	25000.00	28142.00
21	2	BARANESCU DORINEL	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/28dcf849568945b0bd01efb3fbf793ac.png	2026-03-23 22:11:12.590343+00	2026-03-23 22:11:25.065518+00	f	\N	25000.00	11967.00
25	2	TANASESCU STEFAN	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/ffb66924aba948efa4b0784b3d9174bb.png	2026-03-23 22:13:33.263426+00	2026-03-23 22:13:50.157182+00	f	\N	25000.00	2180.00
13	2	PARVA GHEORGHE	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/feabbfbbd3584fe9bb1f0e1f2a97b12a.png	2026-03-23 22:06:10.190896+00	2026-03-23 22:06:34.479256+00	f	\N	25000.00	0.00
3	2	LUNGU RADU	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/9138e2eb26d94e05b1c9fefc8a70ca67.png	2026-03-23 21:59:27.119019+00	2026-03-23 22:00:28.464247+00	f	\N	25000.00	0.00
26	2	PAUNESCU CRISTIAN	ITP	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/24a355235aad48728688678ffec14362.png	2026-03-23 22:14:08.983536+00	2026-03-23 22:14:20.333288+00	f	\N	25000.00	0.00
19	2	FOTA DANIEL-COSMIN	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/16231bb1391f46a3b51b654db0fab9d2.png	2026-03-23 22:09:39.90885+00	2026-03-23 22:10:10.895514+00	f	\N	25000.00	4870.00
22	2	HOTU MARIAN N.	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/6b94c41f1625498dabd31912fa00972d.png	2026-03-23 22:11:40.952722+00	2026-03-23 22:11:50.158431+00	f	\N	25000.00	6617.00
17	2	BUTA O. BOGDAN	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/a75f54e0ea9f46798aaaa138dadaf662.png	2026-03-23 22:08:35.724623+00	2026-03-23 22:08:49.151217+00	f	\N	25000.00	730.00
6	2	LITA ROMEO	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/440c7099207d43b3985b1409affec13c.png	2026-03-23 22:02:07.117691+00	2026-03-23 22:02:21.901253+00	f	\N	25000.00	40095.00
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.items (id, name, description, created_at, deleted_at, price, currency, unit, is_deleted, type, category_id, image_path, account_id, updated_at) FROM stdin;
23	Executat pană 22,5 toli radial 125	\N	2026-03-23 23:08:27.129487+00	\N	180.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ee63d21c2f0c45cbbc32bbaae6051108.png	2	2026-03-24 00:14:02.472801+00
26	Echilibrat roată aliaj 22,5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/d70a5d074ceb43ef9ac4e702ede0fcd0.png	2	2026-03-24 14:26:56.176268+00
21	Echilibrat roata 22,5 toli	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/d32e2b29b44a49b7b4e5afa062b5b7bd.png	2	2026-03-24 00:15:28.946552+00
19	Înlocuit roată axa dublă 20 , 22.5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	50.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/d05a06beb3ab4bf2bf11133ff0890430.png	2	2026-03-24 00:12:51.048807+00
17	Înlocuit anvelopă 20 , 22.5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	80.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8daa07dcf1364f93a0184e6803eb8b5f.png	2	2026-03-24 00:12:29.977452+00
28	Prelungitor valvă	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/b2cbdaaf479f4368a0e625659c2f6f14.png	2	2026-03-24 00:16:29.640972+00
30	Executat pana camera 20 țoli	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/51b4eb03dbae4ad1aa6777f9ebca0dd7.png	2	2026-03-24 00:17:16.564867+00
32	Echilibrat roata 17.5	\N	2026-03-23 23:08:27.129487+00	\N	60.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/e986c2de3e6a4a1e8ba4dd6fcaa48201.png	2	2026-03-24 00:17:51.435466+00
34	Demontat rezerva camion	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/567b1cdcb10d4e02ae8d9b899ae174f8.png	2	2026-03-24 00:18:27.835182+00
36	Verificare presiune/roată aer	\N	2026-03-23 23:08:27.129487+00	\N	2.00	Ron	buc	f	SERVICE	15	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ddca188bdb324a2d99579e5e2ee5e61f.png	2	2026-03-24 00:19:11.697857+00
3	Verificare geometrie	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	buc	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a562077c6df3461babc908c2100a0436.png	2	2026-03-24 00:08:20.303576+00
6	Turisme / suv 19"-24" inch	\N	2026-03-23 23:08:27.129487+00	\N	300.00	Ron	BUC	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0fbef0e64cea4f388e6a6f7731c52fc0.png	2	2026-03-24 00:09:04.190044+00
8	Tarif ora de complexitate	\N	2026-03-23 23:08:27.129487+00	\N	160.00	Ron	ORA	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c551913d10cd4fc89d879f037241ac1e.png	2	2026-03-24 00:09:31.398896+00
10	Cazare Anvelope 17''-18'	\N	2026-03-23 23:08:27.129487+00	\N	140.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/2cd5c16e9d154ff1a4d39dd937d26504.png	2	2026-03-24 00:10:44.645047+00
13	Cazare Roti complete 13'' - 16''	\N	2026-03-23 23:08:27.129487+00	\N	150.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/5cec3fd319574d84bafa0eb09e2684c4.png	2	2026-03-24 00:11:09.824738+00
15	Cazare Roti complete 19''-21''	\N	2026-03-23 23:08:27.129487+00	\N	200.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0e21ff49ab6a4494a15a834ab47f97b3.png	2	2026-03-24 00:11:24.958211+00
38	Presiune/roată AZOT jeep	\N	2026-03-23 23:08:27.129487+00	\N	8.00	Ron	buc	f	SERVICE	15	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/aba4f038f2dd45bdabc35ca162bad26a.png	2	2026-03-24 00:19:35.779864+00
45	Inlocuit valva turism tubeless	\N	2026-03-23 23:08:27.129487+00	\N	6.00	Ron	buc	f	SERVICE	14	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/b2147c4463f24073b3fe5fae7614e17d.png	2	2026-03-24 00:21:34.523573+00
47	Inlocuit valva cameră	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	buc	f	SERVICE	14	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/2808b387fa144c1fabce7910a06c0e2a.png	2	2026-03-24 00:22:25.330725+00
49	Îndreptat jantă aliaj	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/5e6563b7fe5c4ed0a572e57d60ad2e83.png	2	2026-03-24 00:23:30.73922+00
52	13 aliaj	\N	2026-03-23 23:08:27.129487+00	\N	150.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/6abbd962800e46a4be8ea5965b6949db.png	2	2026-03-24 00:24:06.314968+00
40	Aplicat petec TIP TOP NR 2	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	buc	f	SERVICE	11	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/24ab3401e7964d7d8cfb249ae436e6f9.png	2	2026-03-24 00:26:34.341027+00
41	Aplicat petec TIP TOP NR 3	\N	2026-03-23 23:08:27.129487+00	\N	50.00	Ron	buc	f	SERVICE	11	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/9e177bd62e2a470ea2fea5804ec37e53.png	2	2026-03-24 00:26:49.86679+00
44	Aplicat petec TIP TOP 115	\N	2026-03-23 23:08:27.129487+00	\N	85.00	Ron	buc	f	SERVICE	11	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0939bf1ae2094f04a72faedeb164d24a.png	2	2026-03-24 00:27:48.210497+00
60	Efectuat pană tubeless (cu snur)	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a9c0dc3956b2427eb57fbd3bf7a538a0.png	2	2026-03-24 00:35:59.012344+00
62	Echilibrat jantă oțel	\N	2026-03-23 23:08:27.129487+00	\N	18.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/37656d9c99c44d4d89ba01f24bc434cb.png	2	2026-03-24 00:36:21.497853+00
64	Înlocuit anvelopa Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	18.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a5d565f692654d5380ecfafc5d49baa8.png	2	2026-03-24 00:36:44.045558+00
66	Înlocuit anvelopa camioneta C	\N	2026-03-23 23:08:27.129487+00	\N	23.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/6a840aa9852d4d07b4be391839321527.png	2	2026-03-24 00:37:09.520593+00
68	Executat pana camioneta C	\N	2026-03-23 23:08:27.129487+00	\N	50.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0c29965fccb5454dabe1eeff2d46667b.png	2	2026-03-24 00:37:41.036845+00
70	Înlocuit roata turism (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	16.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/182662ede9c248d1b99d75ca752069b5.png	2	2026-03-24 00:38:08.573837+00
55	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	12.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/12e038336ba845618d4aefa227998ec4.png	2	2026-03-24 00:38:33.198773+00
57	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	17.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/7dfb657471144c7f93c29c3070652e24.png	2	2026-03-24 00:38:50.446847+00
1	Deblocat suruburi	\N	2026-03-23 23:08:27.129487+00	\N	60.00	Ron	BUC	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0fdf69f2f7d34d1f85c8452b9598c6b0.png	2	2026-03-24 00:07:48.091774+00
2	Constatare defectiuni	\N	2026-03-23 23:08:27.129487+00	\N	60.00	Ron	buc	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a4cf48c97e4548aa8156793871afa310.png	2	2026-03-24 00:07:59.218654+00
14	Cazare Roti complete 17''-18'	\N	2026-03-23 23:08:27.129487+00	\N	160.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8ce0f0002ca943f1b6e38979c862b992.png	2	2026-03-24 00:11:17.104784+00
4	Turisme axa fata	\N	2026-03-23 23:08:27.129487+00	\N	180.00	Ron	BUC	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/aa3c880f26854360ad5413222871945c.png	2	2026-03-24 00:08:42.116355+00
5	Turisme / SUV 13"-18" inch	\N	2026-03-23 23:08:27.129487+00	\N	250.00	Ron	BUC	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/456af51d1f9541fabf2b87b4b52cb0bb.png	2	2026-03-24 00:08:55.561656+00
7	Autoutilitare axa simpla/dubla	\N	2026-03-23 23:08:27.129487+00	\N	300.00	Ron	BUC	f	SERVICE	1	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/811bb145a45a48efb51210bcd8a232e2.png	2	2026-03-24 00:09:20.59997+00
9	Cazare Anvelope 13'' - 16''	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/bc57bc2bcb2e446ebd00349cde80f7ed.png	2	2026-03-24 00:10:31.506022+00
11	Cazare Anvelope 19''-21''	\N	2026-03-23 23:08:27.129487+00	\N	150.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ba0bebbabbbb475f96eab20f97b77235.png	2	2026-03-24 00:10:52.283658+00
12	Cazare Anvelope 22''-24''	\N	2026-03-23 23:08:27.129487+00	\N	180.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/897d2ab0ce4f4750b29cc542fdd00e68.png	2	2026-03-24 00:11:00.647894+00
16	Cazare Roti complete 22''-24''	\N	2026-03-23 23:08:27.129487+00	\N	250.00	Ron	BUC	f	SERVICE	2	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/515b3808cc2b439f8f6ea47c2fbf08c5.png	2	2026-03-24 00:11:36.517734+00
18	Înlocuit roată 20 , 22.5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/0888307385c54daaafaf528bdeefc138.png	2	2026-03-24 00:12:39.491951+00
20	Executat pană 22,5 toli UP8	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a821de10d48645e3a5c80eddbf436744.png	2	2026-03-24 00:13:04.143665+00
22	Executat pană 22,5 toli radial 115	\N	2026-03-23 23:08:27.129487+00	\N	130.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/46864dfc1c87465c8429c3bde8816730.png	2	2026-03-24 00:13:34.43207+00
24	Executat pană 22,5 toli radial 135	\N	2026-03-23 23:08:27.129487+00	\N	220.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c8934ae404db435da0ee658663a5b938.png	2	2026-03-24 00:14:15.977827+00
25	Echilibrat roată oțel 22,5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/bb07112c4d504dc687e52ce6ba6ea899.png	2	2026-03-24 00:15:43.162904+00
94	Echilibrat janta Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	45.00	Ron	BUC	f	SERVICE	9	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ca54311ec2174f0388b339705a9a0322.png	2	2026-03-23 23:08:27.129487+00
103	Echilibrat Hunter RFE 21"-22" Turisme	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/579c0b5155424516b0993facf519e506.png	2	2026-03-24 00:25:08.578044+00
105	Echilibrat Hunter RFE 17"-18" SUV	\N	2026-03-23 23:08:27.129487+00	\N	80.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/5c083e12e1f44d038272f8be4c50802f.png	2	2026-03-24 00:25:27.830245+00
107	Echilibrat Hunter RFE 21"-22" SUV	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/32986a80a8b54d4a8bc16355af37bad2.png	2	2026-03-24 00:25:47.089989+00
95	Saci	\N	2026-03-23 23:08:27.129487+00	\N	2.00	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8d21b67561db4483bf1e78bef25dcc8b.png	2	2026-03-24 00:28:08.052676+00
97	Plumb Hofmann	\N	2026-03-23 23:08:27.129487+00	\N	10.00	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c15a876296644bb6b6f2c3abe4f8db4c.png	2	2026-03-24 00:28:30.677349+00
99	Curatare butuc	\N	2026-03-23 23:08:27.129487+00	\N	10.00	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/95f1e27f809e42c8a566a408e8f7657b.png	2	2026-03-24 00:29:31.109446+00
92	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	35.00	Ron	BUC	f	SERVICE	9	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/82f194e639c44ff0ba336d6b6de1998d.png	2	2026-03-24 00:30:15.635839+00
88	Înlocuit anvelopa Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	32.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ca8020694e05448baf4438df83b6a619.png	2	2026-03-23 23:08:27.129487+00
86	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	26.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/7ab7ee7049b94ffdb4f4f4642f9744e4.png	2	2026-03-24 00:31:25.358845+00
75	Înlocuit anvelopa Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	20.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/56e76a437c9f4c8f81770cb4d128cb50.png	2	2026-03-23 23:08:27.129487+00
90	Înlocuit roata turism (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	26.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/97813ece5bda4a2386b47a861b78713c.png	2	2026-03-24 00:32:13.861205+00
79	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	23.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/70deb5ba7bf541949a97527e0bfa9bf1.png	2	2026-03-24 00:32:44.038892+00
81	Înlocuit anvelopa Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	26.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/b2abe181e1f14ceeb010a48880ad8ff7.png	2	2026-03-24 00:33:09.21792+00
83	Înlocuit roata turism (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	24.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/fb450aeec42144059bb790608a6a398d.png	2	2026-03-24 00:33:29.576741+00
72	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	18.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c1361535f0c740ba9e481d2f6b7849ee.png	2	2026-03-24 00:34:35.97389+00
73	Echilibrat jantă oțel	\N	2026-03-23 23:08:27.129487+00	\N	21.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ea8c2e0c7767498b987d868ed1e3de0a.png	2	2026-03-24 00:34:46.483293+00
27	Valva roata 22	\N	2026-03-23 23:08:27.129487+00	\N	30.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/cca99f431afb43e48c1c79518a96f154.png	2	2026-03-24 14:22:06.43597+00
29	Clema prelungitor valva	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ef2908e32d494932b2ce47c446b4875a.png	2	2026-03-24 00:16:39.596219+00
104	Echilibrat Hunter RFE 23"-24" Turisme	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/70d6fd99ef01440ba957c3e00fab78a7.png	2	2026-03-24 00:25:18.06626+00
31	Înlocuit anvelopa 17,5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	50.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/37eba8a8dea34ca1afb0519c2c11dfe6.png	2	2026-03-24 00:17:41.063445+00
33	Presiune roata camion 17.5,22.5 toli	\N	2026-03-23 23:08:27.129487+00	\N	7.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/99c6eae66b50499eb39010ceab4c0992.png	2	2026-03-24 00:18:11.260711+00
35	Verificat roți (strâns roata)	\N	2026-03-23 23:08:27.129487+00	\N	10.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/3fc0ff0d9bd64d9cbcb785026fa53f6d.png	2	2026-03-24 00:18:47.101084+00
37	Presiune roata AZOT turism	\N	2026-03-23 23:08:27.129487+00	\N	5.00	Ron	buc	f	SERVICE	15	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/3b694c541c58493ea605ca98d8c403d8.png	2	2026-03-24 00:19:27.163109+00
39	Verificare presiune AZOT turism/jeep	\N	2026-03-23 23:08:27.129487+00	\N	5.00	Ron	buc	f	SERVICE	15	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8e14acc06dba4257880a016f01e2f551.png	2	2026-03-24 00:19:45.194626+00
46	Inlocuit valva senzor	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	buc	f	SERVICE	14	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/7e8270f06ae6416d92d2c0b22aec27ca.png	2	2026-03-24 00:21:56.630959+00
51	Îndreptat jantă aliaj	\N	2026-03-23 23:08:27.129487+00	\N	140.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a5f05901f5eb401aaf3a7b809adb6cf2.png	2	2026-03-24 00:23:57.271256+00
100	Echilibrat Hunter RFE 15"-16" Turisme	\N	2026-03-23 23:08:27.129487+00	\N	60.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/e0802d1aa51242afbf84a61673fb9ad3.png	2	2026-03-24 00:24:45.549452+00
101	Echilibrat Hunter RFE 17"-18" Turisme	\N	2026-03-23 23:08:27.129487+00	\N	70.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/f4bd7f8862644586897ebb6325180ff3.png	2	2026-03-24 00:24:53.816263+00
102	Echilibrat Hunter RFE 19"-20" Turisme	\N	2026-03-23 23:08:27.129487+00	\N	80.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/fdf808b26efc4df8a71c68fe0fb73b95.png	2	2026-03-24 00:25:01.490953+00
106	Echilibrat Hunter RFE 19"-20" SUV	\N	2026-03-23 23:08:27.129487+00	\N	90.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ae6dc99f42a543a892f7fd421eccb087.png	2	2026-03-24 00:25:37.303474+00
48	Inlocuit valva ascunsă (set 4 buc)	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	buc	f	SERVICE	14	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/10a439a4ee6142d3bb09c2ff3ff5f196.png	2	2026-03-24 00:22:42.741193+00
50	Îndreptat jantă aliaj	\N	2026-03-23 23:08:27.129487+00	\N	130.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a669d98d252b42c4962c5062f96064fa.png	2	2026-03-24 00:23:43.177146+00
53	Sudura janta	\N	2026-03-23 23:08:27.129487+00	\N	180.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/842a2fb922c04657ba425e62f2568917.png	2	2026-03-24 00:24:19.087328+00
108	Echilibrat Hunter RFE 23"-24" SUV	\N	2026-03-23 23:08:27.129487+00	\N	130.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/e62fecdc5c184e6486ccb3d8ea980008.png	2	2026-03-24 00:25:55.348185+00
42	Aplicat petec TIP TOP UP 8	\N	2026-03-23 23:08:27.129487+00	\N	70.00	Ron	buc	f	SERVICE	11	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/b89472e7a960413e8c13d247ca001134.png	2	2026-03-24 00:27:05.787963+00
43	Aplicat petec TIP TOP 110	\N	2026-03-23 23:08:27.129487+00	\N	75.00	Ron	buc	f	SERVICE	11	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/cd2ae0c6c0d44036b404004cb5fedcee.png	2	2026-03-24 00:27:34.581842+00
96	Coliere	\N	2026-03-23 23:08:27.129487+00	\N	0.50	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/5eba7751e0ba44bebdbefdbef325154e.png	2	2026-03-24 00:28:18.252047+00
98	Valve metalice	\N	2026-03-23 23:08:27.129487+00	\N	20.00	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/3f90a22086ae4099872e46d30f43028d.png	2	2026-03-24 00:28:40.32782+00
91	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	30.00	Ron	BUC	f	SERVICE	9	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c4e9dc7edb78406cbf9ae884aa564ce7.png	2	2026-03-24 00:30:05.475055+00
54	Efectuat pană tubeless (cu șnur)	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/c19412d9003f41edb4fb29fe4e4b6082.png	2	2026-03-24 00:38:22.313568+00
93	Înlocuit anvelopa Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	35.00	Ron	BUC	f	SERVICE	9	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8d3a51399ef649a9b2da9b08a853c5b4.png	2	2026-03-24 00:30:52.85347+00
85	Efectuat pana tubeless (cu snur)	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/050a1127a1384e55a57493b54ed37fae.png	2	2026-03-24 00:31:14.011695+00
87	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	32.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/a0947b11adcd4078996cfb87be693d7b.png	2	2026-03-24 00:31:38.250084+00
89	Echilibrat janta Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	BUC	f	SERVICE	8	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/57fc2fa2bbb04f1dbe8f83a5a1bdd6b9.png	2	2026-03-24 00:31:59.69066+00
78	Efectuat pana tubeless (cu snur)	\N	2026-03-23 23:08:27.129487+00	\N	40.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/19a392e6e5614396895fc048d143043d.png	2	2026-03-24 00:32:28.441603+00
80	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	26.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/e0a5c7c940ac491eb0c540ff5e35bda5.png	2	2026-03-24 00:32:54.580567+00
82	Echilibrat janta Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	30.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/16ace53cd01544cda346e3947f4151e1.png	2	2026-03-24 00:33:19.603719+00
84	Înlocuit roata camioneta / jeep (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	7	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/cb4afda601524fefbe975a7b99a54c9d.png	2	2026-03-24 00:34:04.55761+00
71	Efectuat pana tubeless (cu snur)	\N	2026-03-23 23:08:27.129487+00	\N	35.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/9c8916635d6f4a4ea7fcf94d12a61134.png	2	2026-03-24 00:34:25.483802+00
74	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	24.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/4a9d24f13fbf4e208c9b6879edaad3eb.png	2	2026-03-24 00:34:58.61666+00
76	Echilibrat janta Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	24.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/aa41c493ebcf445badad08b4d78352e4.png	2	2026-03-23 23:08:27.129487+00
77	Înlocuit roata turism (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	18.00	Ron	BUC	f	SERVICE	6	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/2b7c659c2d3f4f80a05c7d769958779d.png	2	2026-03-24 00:35:43.295022+00
61	Înlocuit anvelopa	\N	2026-03-23 23:08:27.129487+00	\N	15.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/b128160a0cf649e6b22577fddb7e4f17.png	2	2026-03-24 00:36:09.707427+00
63	Echilibrat janta aliaj turism	\N	2026-03-23 23:08:27.129487+00	\N	19.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/9789ccd79c4e4feea7397cb1a8cfa489.png	2	2026-03-24 00:36:32.826254+00
65	Echilibrat janta Jeep (SUV)	\N	2026-03-23 23:08:27.129487+00	\N	19.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/20c4d3684b8747e2af4d25a6c39bf025.png	2	2026-03-24 00:36:58.956711+00
67	Echilibrat janta camioneta C	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/84ec431cd7bd4fb5844bae8cdda840ab.png	2	2026-03-24 00:37:22.023507+00
69	Demontat rezerva camioneta C	\N	2026-03-23 23:08:27.129487+00	\N	30.00	Ron	BUC	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/6ef513e55bf741739285a91cc51de7f1.png	2	2026-03-24 00:37:54.791044+00
56	Echilibrat jantă oțel	\N	2026-03-23 23:08:27.129487+00	\N	14.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/7f5399d0ff7448e8a65c3efe43f27e86.png	2	2026-03-24 00:38:42.03653+00
58	Înlocuit roata turism (Permutare)	\N	2026-03-23 23:08:27.129487+00	\N	12.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/034b950aad954f0899442364e10cc656.png	2	2026-03-24 00:39:01.070997+00
59	Demontat rezervă (sub mașină) – Turisme	\N	2026-03-23 23:08:27.129487+00	\N	25.00	Ron	BUC	f	SERVICE	4	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/bf1388eab9dc4153b433af6827b5452a.png	2	2026-03-24 00:39:29.454353+00
109	Înlocuit roată (Permutare) 17.5 țoli	Permutare	2026-03-30 12:09:39.726488+00	\N	40.00	RON	buc	f	SERVICE	3	\N	2	2026-03-30 12:13:42.434823+00
\.


--
-- Data for Name: location_departments; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.location_departments (location_id, department_id) FROM stdin;
2	1
2	4
2	3
2	2
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.locations (id, account_id, name, description, created_at, updated_at, is_deleted, deleted_at, disclaimer_id, company_id, register_id, image_path) FROM stdin;
1	1	Timisoara	\N	2026-03-23 21:03:52.030461+00	\N	f	\N	\N	\N	\N	\N
2	2	Craiova	\N	2026-03-23 21:16:07.996726+00	\N	f	\N	1	2	1	\N
\.


--
-- Data for Name: locuri_cazare; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.locuri_cazare (id, account_id, nume, description, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	C1	\N	2026-03-24 00:47:58.781979+00	\N	f	\N
\.


--
-- Data for Name: marci_anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.marci_anvelope (id, account_id, nume, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	Continental	2026-03-24 00:47:20.480993+00	\N	f	\N
2	2	MICHELIN	2026-03-24 12:42:17.513449+00	\N	f	\N
3	2	LING LONG	2026-03-30 13:21:25.898511+00	\N	f	\N
\.


--
-- Data for Name: programari; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.programari (id, account_id, titlu, notite, client_id, location_id, department_id, start_time, end_time, status, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	Test	Test	11	2	1	2026-04-01 07:30:00+00	2026-04-01 10:00:00+00	Programat	2026-03-30 19:40:39.983296+00	2026-03-30 19:41:05.603267+00	f	\N
2	2	VHGH	\N	\N	2	3	2026-04-01 05:30:00+00	2026-04-01 06:30:00+00	Programat	2026-03-31 07:39:14.153675+00	\N	f	\N
\.


--
-- Data for Name: receipt_items; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.receipt_items (id, receipt_id, name, price, qty, unit, employee_id, account_id) FROM stdin;
1	1	Turisme / suv 19"-24" inch	300.00	1	BUC	3	2
2	1	Cazare Anvelope 19''-21''	150.00	1	BUC	3	2
3	1	Cazare Anvelope 22''-24''	180.00	1	BUC	3	2
4	2	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
5	2	Înlocuit anvelopa	18.00	4	BUC	24	2
6	2	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
7	2	225/55/17 michelin a6__4 buc dot 5019 anvelope	0.00	4	buc	24	2
8	3	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
9	3	Înlocuit anvelopa	18.00	4	BUC	24	2
10	3	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
11	3	225/55/17 michelin a6__4 buc dot 5019 anvelope	0.00	4	buc	24	2
12	4	DEZENT AR DARK 7X15 5X114,3 ET40	1050.00	4	buc	6	2
13	4	225/60/18 HANKOOK K135A	680.00	4	buc	6	2
14	4	SENZOR UVS4062	250.00	4	buc	6	2
15	5	DEZENT AR DARK 7X15 5X114,3 ET40	1050.00	4	buc	6	2
16	5	225/60/18 HANKOOK K135A	680.00	4	buc	6	2
17	5	SENZOR UVS4062	250.00	4	buc	6	2
18	5	Înlocuit anvelopa	18.00	4	BUC	21	2
19	5	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
20	5	custodie anv jante capace nokian wr suv 4 225 55 19 dot 0622 mm 6 6 6 6	200.00	1	buc4	21	2
21	6	DEZENT AR DARK 7X15 5X114,3 ET40	1000.00	4	buc	6	2
22	6	225/60/18 HANKOOK K135A	650.00	4	buc	6	2
23	6	SENZOR UVS4062	180.00	4	buc	6	2
24	7	DEZENT AR DARK 7X15 5X114,3 ET40	1000.00	4	buc	6	2
25	7	225/60/18 HANKOOK K135A	650.00	4	buc	6	2
26	7	SENZOR UVS4062	180.00	4	buc	6	2
27	7	Înlocuit anvelopa	1.00	4	BUC	21	2
28	7	Echilibrat janta aliaj turism	1.00	4	BUC	21	2
29	7	custodie anv jante capace nokian wr suv 4 225 55 19 dot 0622 mm 6 6 6 6	2.00	1	buc4	21	2
30	8	DEZENT AR DARK 7X15 5X114,3 ET40	1000.00	4	buc	6	2
31	8	225/60/18 HANKOOK K135A	650.00	4	buc	6	2
32	8	SENZOR UVS4062	180.00	4	buc	6	2
33	8	Înlocuit anvelopa	1.00	4	BUC	21	2
34	8	Echilibrat janta aliaj turism	1.00	4	BUC	21	2
35	8	custodie anv jante capace nokian wr suv 4 225 55 19 dot 0622 mm 6 6 6 6	2.00	1	buc4	21	2
36	9	DEZENT AR DARK 7X15 5X114,3 ET40	1000.00	4	buc	6	2
37	9	225/60/18 HANKOOK K135A	650.00	4	buc	6	2
38	9	SENZOR UVS4062	180.00	4	buc	6	2
39	9	Înlocuit anvelopa	0.00	4	BUC	21	2
40	9	Echilibrat janta aliaj turism	0.00	4	BUC	21	2
41	9	custodie anv jante capace nokian wr suv 4 225 55 19 dot 0622 mm 6 6 6 6	0.00	1	buc4	21	2
42	10	DEZENT AR DARK 7X15 5X114,3 ET40	1001.00	4	buc	6	2
43	10	225/60/18 HANKOOK K135A	650.00	4	buc	6	2
44	10	SENZOR UVS4062	180.00	4	buc	6	2
45	10	Înlocuit anvelopa	0.00	4	BUC	21	2
46	10	Echilibrat janta aliaj turism	0.00	4	BUC	21	2
47	10	custodie anv jante capace nokian wr suv 4 225 55 19 dot 0622 mm 6 6 6 6	0.00	1	buc4	21	2
48	11	Echilibrat janta camioneta C	25.00	2	BUC	21	2
49	11	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
50	12	205/55/16 MICHELIN PRIMACY 5	500.00	4	buc	4	2
51	13	205/55/16 MICHELIN PRIMACY 5	500.00	4	buc	4	2
52	13	Cazare Anvelope 17''-18'	140.00	1	BUC	5	2
53	13	Înlocuit anvelopa	18.00	4	BUC	5	2
54	13	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	5	2
57	14	MICHE	500.00	4	buc	6	2
58	14	Echilibrat jantă oțel	18.00	5	BUC	21	2
59	15	225	100.00	4	buc	6	2
60	16	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
68	18	Înlocuit anvelopa camioneta C	23.00	4	BUC	23	2
69	18	Echilibrat janta camioneta C	25.00	4	BUC	23	2
70	17	midf	300.00	4	buc	6	2
71	17	Inlocuit valva cameră	40.00	1	buc	12	2
72	17	Îndreptat jantă aliaj	120.00	1	buc	13	2
78	19	2255017	500.00	2	buc	6	2
79	19	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
80	20	RIKEN	180.00	4	buc	1	2
81	21	FDAS	500.00	4	buc	3	2
82	22	FDAS	500.00	4	buc	3	2
83	23	FDAS	500.00	5	buc	3	2
84	24	FDAS	500.00	5	buc	3	2
85	24	Inlocuit valva senzor	25.00	1	buc	21	2
89	25	FDAS	500.00	5	buc	3	2
90	25	Inlocuit valva senzor	25.00	1	buc	21	2
91	25	Echilibrat jantă oțel	21.00	1	BUC	28	2
94	26	2255017	500.00	2	buc	6	2
95	26	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
96	26	Cazare Anvelope 19''-21''	150.00	1	BUC	6	2
97	27	Echilibrat janta aliaj turism	20.00	1	BUC	15	2
98	28	Aplicat petec TIP TOP NR 3	50.00	1	buc	10	2
99	29	Aplicat petec TIP TOP NR 3	50.00	1	buc	14	2
100	30	Înlocuit anvelopa	18.00	2	BUC	21	2
101	30	Echilibrat janta aliaj turism	24.00	2	BUC	21	2
102	31	Echilibrat jantă oțel	18.00	4	BUC	21	2
103	31	Înlocuit anvelopa	15.00	4	BUC	21	2
104	31	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
105	32	Înlocuit anvelopa	18.00	4	BUC	10	2
106	32	Echilibrat janta aliaj turism	24.00	4	BUC	10	2
107	32	Inlocuit valva turism tubeless	6.00	4	buc	10	2
108	33	Aplicat petec TIP TOP NR 2	40.00	1	buc	10	2
109	34	225/45/17 KUMHO	600.00	4	buc	4	2
110	35	Înlocuit roata turism (Permutare)	18.00	4	BUC	22	2
111	36	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
112	37	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
113	37	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
114	37	spalat int ext	55.00	1	buc	21	2
115	38	Înlocuit anvelopa	15.00	4	BUC	24	2
116	38	Echilibrat jantă oțel	18.00	4	BUC	24	2
117	38	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
122	40	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
123	40	Înlocuit anvelopa	15.00	4	BUC	21	2
124	41	Înlocuit anvelopa	15.00	4	BUC	23	2
125	41	Echilibrat jantă oțel	18.00	4	BUC	23	2
126	41	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
131	43	215/55/18 MICHELIN PRIMACY 5 XL 99V	750.00	4	buc	5	2
132	44	Înlocuit anvelopa Jeep (SUV)	20.00	2	BUC	10	2
133	44	Echilibrat janta Jeep (SUV)	24.00	4	BUC	10	2
134	39	275/40/21 MICHELIN PILOT SPORT EV	1550.00	2	buc	6	2
135	39	305/35/21 MICHELIN PILOT SPORT EV	2150.00	2	buc	6	2
136	45	MONTAT SENZORI	25.00	4	buc	21	2
137	46	MONTAT SENZORI	25.00	4	buc	21	2
138	47	Îndreptat jantă aliaj	130.00	1	buc	14	2
139	42	275/40/21 MICHELIN PILOT SPORT EV	1550.00	2	buc	6	2
140	42	305/35/21 MICHELIN PILOT SPORT EV	2160.00	2	buc	6	2
141	42	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
142	42	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
143	42	Plumb Hofmann	10.00	4	buc	24	2
144	42	Saci	2.00	4	buc	24	2
146	48	205/55/16 RIKEN SUMMER 3 91V	260.00	2	buc	5	2
147	48	Înlocuit anvelopa	15.00	4	BUC	10	2
148	48	Echilibrat janta aliaj turism	19.00	4	BUC	10	2
149	49	Înlocuit anvelopa	18.00	4	BUC	21	2
150	49	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
159	50	Înlocuit anvelopa	18.00	4	BUC	23	2
160	50	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
161	50	Inlocuit valva turism tubeless	6.00	4	buc	23	2
162	50	Saci	2.00	4	buc	23	2
163	50	Cazare Roti complete 17''-18'	160.00	1	BUC	25	2
167	52	Turisme / suv 19"-24" inch	300.00	2	BUC	22	2
168	52	13 aliaj	150.00	1	buc	14	2
176	53	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
177	53	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
178	53	Înlocuit anvelopa	23.00	4	BUC	24	2
179	53	Îndreptat jantă aliaj	130.00	2	buc	14	2
180	53	Plumb Hofmann	10.00	4	buc	24	2
186	51	245/45/19 PIRELLI P-ZERO PZ4 * RFT	1150.00	2	buc	6	2
187	51	275/70/19 PIRELLI P-ZERO PZ4 *RFT	1180.00	2	buc	6	2
188	51	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
189	51	Înlocuit roata turism (Permutare)	24.00	4	BUC	21	2
190	51	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
191	51	spalat int ext turism	55.00	1	buc	21	2
192	54	Înlocuit anvelopa	15.00	4	BUC	24	2
193	54	Echilibrat jantă oțel	18.00	4	BUC	24	2
194	54	Saci	2.00	4	buc	24	2
195	55	Înlocuit anvelopa	15.00	4	BUC	10	2
196	55	Echilibrat jantă oțel	18.00	4	BUC	10	2
198	56	205/55/16 KUMHO HS52 91V	300.00	1	buc	5	2
199	56	Înlocuit anvelopa	15.00	1	BUC	10	2
200	56	Echilibrat janta aliaj turism	19.00	1	BUC	10	2
201	57	Echilibrat Hunter RFE 21"-22" SUV	100.00	4	buc	24	2
202	57	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
203	58	205/60/16 RIKEN SUMMER 3 XL 96V	330.00	4	buc	5	2
204	59	Înlocuit anvelopa	15.00	1	BUC	10	2
205	59	Echilibrat jantă oțel	18.00	1	BUC	10	2
207	60	Echilibrat janta aliaj turism	32.00	4	BUC	21	2
208	60	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
210	61	195/65/15 MICHELIN PRIMACY 4 91H	430.00	2	buc	5	2
211	61	Înlocuit anvelopa	15.00	2	BUC	10	2
212	61	Echilibrat janta aliaj turism	19.00	2	BUC	10	2
213	62	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
214	63	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
215	63	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
216	64	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
217	64	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
218	64	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
219	65	Cazare Roti complete 22''-24''	250.00	1	BUC	24	2
220	65	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
221	66	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
222	67	Cazare Anvelope 22''-24''	180.00	1	BUC	21	2
223	67	Echilibrat Hunter RFE 23"-24" SUV	130.00	4	buc	21	2
224	68	Înlocuit anvelopă 20 , 22.5 țoli	100.00	1	BUC	10	2
227	69	185/60 R14 SAILUN ATR ELITE 82H	210.00	4	buc	5	2
228	69	Înlocuit anvelopa	12.00	4	BUC	11	2
229	69	Echilibrat jantă oțel	14.00	4	BUC	11	2
233	71	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
234	71	Înlocuit anvelopa	18.00	4	BUC	24	2
235	71	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
236	72	Echilibrat janta aliaj turism	19.00	4	BUC	8	2
237	73	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
238	73	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
239	73	spalat int ext  turism	55.00	1	buc	21	2
242	70	205/50 R17 SAILUN ATREZZO 4 SEASONS XL 93W	300.00	4	buc	5	2
243	70	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
245	75	Turisme axa fata	180.00	1	BUC	17	2
244	70	Înlocuit anvelopa	18.00	4	BUC	24	2
246	74	315/35/21 HANKOOK K137A	1600.00	2	buc	4	2
247	74	275/40/21 HANKOOK K137A	1300.00	2	buc	4	2
248	74	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
249	74	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
250	76	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
251	76	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
252	76	Saci	2.00	4	buc	12	2
253	77	Înlocuit roata turism (Permutare)	25.00	1	BUC	15	2
254	78	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
255	78	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
256	79	Înlocuit anvelopa	15.00	1	BUC	10	2
257	80	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
258	81	Aplicat petec TIP TOP NR 3	50.00	1	buc	8	2
259	81	Echilibrat janta Jeep (SUV)	30.00	1	BUC	8	2
260	82	Turisme axa fata	180.00	1	BUC	17	2
261	83	Turisme axa fata	180.00	1	BUC	18	2
262	84	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
263	84	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
264	85	Înlocuit anvelopa	18.00	4	BUC	24	2
265	85	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
266	86	Turisme axa fata	180.00	1	BUC	20	2
268	88	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
269	89	Îndreptat jantă aliaj	200.00	1	buc	14	2
270	90	Verificare geometrie	120.00	1	buc	19	2
271	87	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
272	87	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
273	91	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
274	91	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
275	91	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
277	93	Echilibrat janta Jeep (SUV)	40.00	2	BUC	21	2
278	93	Înlocuit anvelopa Jeep (SUV)	32.00	2	BUC	21	2
279	93	Inlocuit valva senzor	25.00	2	buc	21	2
280	92	Înlocuit anvelopa	15.00	4	BUC	25	2
281	92	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
282	94	programat senzori	30.00	4	buc	21	2
283	95	205/55 R16 KUMHO HS52 91V	280.00	4	buc	5	2
284	96	Turisme / SUV 13"-18" inch	250.00	1	BUC	17	2
285	97	Turisme axa fata	180.00	1	BUC	19	2
287	98	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
289	100	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
290	101	Cazare Anvelope 17''-18'	140.00	1	BUC	25	2
291	101	Înlocuit anvelopa	18.00	4	BUC	25	2
292	101	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
293	102	235/45/17 MICHELIN PRIMACY 5	630.00	4	buc	4	2
294	103	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
295	103	Înlocuit anvelopa	18.00	4	BUC	21	2
296	104	Înlocuit anvelopa	18.00	4	BUC	12	2
297	104	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
298	105	Autoutilitare axa simpla/dubla	300.00	1	BUC	19	2
308	99	275/40/19 MICHELIN PS 5 105Y XL	1140.00	1	buc	4	2
309	99	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
310	99	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
311	99	Plumb Hofmann	10.00	4	buc	24	2
312	99	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
313	106	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
314	106	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
317	107	Înlocuit anvelopa	15.00	4	BUC	23	2
318	107	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
319	108	Turisme axa fata	180.00	1	BUC	18	2
320	109	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
321	110	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
322	111	Turisme axa fata	180.00	1	BUC	20	2
323	112	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	25	2
324	113	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
325	113	Înlocuit anvelopa	15.00	4	BUC	25	2
327	114	255/45 R19 MICHELIN PRIMACY 5 ENERGY 104W	1120.00	4	buc	5	2
329	116	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
330	117	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
331	117	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
332	117	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
333	118	255/45 R19 MICHELIN PRIMACY 5 ENERGY 104W	1120.00	4	buc	5	2
334	118	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
335	118	Echilibrat Hunter RFE 19"-20" SUV	90.00	4	buc	25	2
336	118	Cazare Anvelope 19''-21''	150.00	1	BUC	25	2
337	119	Înlocuit anvelopa	23.00	4	BUC	27	2
338	119	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
339	120	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
340	120	Saci	2.00	4	buc	12	2
341	121	Turisme axa fata	180.00	1	BUC	18	2
342	115	225/40/19 MICHELIN PS5	930.00	4	buc	4	2
343	115	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
344	115	Înlocuit anvelopa	23.00	4	BUC	21	2
345	122	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
346	122	Înlocuit anvelopa	18.00	4	BUC	23	2
347	122	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
348	123	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
349	123	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
350	123	Saci	2.00	4	buc	12	2
351	124	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
352	124	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
353	124	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
357	126	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
358	126	Înlocuit anvelopa	23.00	2	BUC	21	2
359	126	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
360	125	Înlocuit anvelopa	15.00	4	BUC	22	2
361	125	Echilibrat jantă oțel	18.00	4	BUC	22	2
362	125	Coliere	0.50	8	buc	22	2
363	127	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
364	127	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
365	127	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
366	128	Îndreptat jantă aliaj	120.00	1	buc	12	2
367	128	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	12	2
368	128	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
369	128	Cazare Roti complete 19''-21''	200.00	1	BUC	12	2
370	129	Turisme axa fata	180.00	1	BUC	19	2
371	130	Echilibrat janta camioneta C	25.00	4	BUC	24	2
372	130	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
373	131	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
374	132	Constatare defectiuni	60.00	1	buc	20	2
378	134	Verificare geometrie	120.00	1	buc	18	2
379	133	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
380	133	Echilibrat Hunter RFE 21"-22" SUV	100.00	4	buc	22	2
381	133	Plumb Hofmann	10.00	4	buc	22	2
382	135	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
384	137	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
385	137	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
386	138	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
387	138	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
388	139	Cazare Anvelope 19''-21''	150.00	1	BUC	12	2
389	139	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	12	2
390	139	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
391	139	Plumb Hofmann	10.00	4	buc	12	2
392	140	Turisme axa fata	180.00	1	BUC	20	2
393	136	245/50/18 MICHELIN PRIMACY 3 ZP * 100Y	990.00	4	buc	5	2
394	136	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
395	136	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
396	141	Înlocuit anvelopă 20 , 22.5 țoli	100.00	2	BUC	15	2
397	142	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
398	142	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
399	143	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
400	143	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
401	144	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
402	145	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
403	146	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
404	146	Înlocuit anvelopa	15.00	4	BUC	24	2
405	146	Saci	2.00	4	buc	24	2
407	148	Turisme axa fata	180.00	1	BUC	20	2
408	147	205/60/16 MICHELIN PRIMACY 5	600.00	4	buc	4	2
409	147	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
410	147	Înlocuit anvelopa	15.00	4	BUC	21	2
411	147	Saci	2.00	4	buc	21	2
412	149	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
413	150	Înlocuit anvelopa	18.00	4	BUC	15	2
414	150	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
415	150	Inlocuit valva turism tubeless	6.00	4	buc	15	2
416	151	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
417	151	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
418	151	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
419	152	Turisme axa fata	180.00	1	BUC	18	2
421	154	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
422	154	Înlocuit anvelopa	18.00	4	BUC	24	2
423	155	Îndreptat jantă aliaj	180.00	1	buc	14	2
424	156	Verificare geometrie	120.00	1	buc	20	2
426	158	Autoutilitare axa simpla/dubla	300.00	1	BUC	19	2
430	159	Constatare defectiuni	60.00	1	buc	18	2
432	160	235/65/16C MICHELIN AGILIS 3 121/119R	960.00	4	buc	5	2
433	160	Înlocuit anvelopa camioneta C	23.00	4	BUC	16	2
434	160	Echilibrat janta camioneta C	25.00	4	BUC	16	2
435	153	215/55/17 UNIROYAL RAINSPORT 5 94Y	625.00	2	buc	5	2
436	153	Saci	2.00	2	buc	21	2
437	153	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
438	153	Înlocuit anvelopa	18.00	4	BUC	21	2
440	161	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
441	162	Înlocuit anvelopa	23.00	4	BUC	22	2
442	162	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
443	162	Inlocuit valva turism tubeless	6.00	4	buc	22	2
444	162	Saci	2.00	4	buc	22	2
445	162	Plumb Hofmann	10.00	4	buc	22	2
446	163	Verificare geometrie	120.00	1	buc	20	2
447	164	Verificare geometrie	120.00	1	buc	18	2
449	166	Aplicat petec TIP TOP NR 3	50.00	1	buc	10	2
450	166	Echilibrat janta Jeep (SUV)	30.00	1	BUC	10	2
452	157	185/65/15 KUMHO ES31 88T	250.00	4	buc	5	2
453	157	Înlocuit anvelopa	15.00	4	BUC	24	2
454	157	Echilibrat jantă oțel	18.00	4	BUC	24	2
455	157	Saci	2.00	6	buc	24	2
456	157	Inlocuit valva turism tubeless	6.00	4	buc	24	2
457	168	Înlocuit roată axa dublă 20 , 22.5 țoli	50.00	1	BUC	15	2
458	169	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
459	169	Echilibrat janta camioneta C	25.00	4	BUC	12	2
460	170	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	10	2
461	170	Echilibrat janta Jeep (SUV)	30.00	4	BUC	10	2
462	171	Verificare geometrie	120.00	1	buc	18	2
463	167	185/65/15 MICHELIN PRIMACY 4	430.00	4	buc	4	2
464	167	Echilibrat jantă oțel	21.00	4	BUC	21	2
465	167	Înlocuit anvelopa	18.00	4	BUC	21	2
466	167	Inlocuit valva turism tubeless	6.00	4	buc	21	2
467	172	Înlocuit anvelopa camioneta C	23.00	4	BUC	11	2
468	172	Echilibrat janta camioneta C	25.00	4	BUC	11	2
472	165	VALVA SENZOT SK921	70.00	1	buc	4	2
473	165	Înlocuit anvelopa	18.00	4	BUC	23	2
474	165	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
475	165	Îndreptat jantă aliaj	120.00	1	buc	14	2
476	173	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
477	174	Înlocuit anvelopa	23.00	4	BUC	22	2
478	174	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
479	175	Înlocuit anvelopa	18.00	4	BUC	24	2
480	175	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
481	176	Înlocuit anvelopa	15.00	4	BUC	15	2
482	176	Echilibrat jantă oțel	18.00	4	BUC	15	2
483	177	Turisme axa fata	180.00	1	BUC	18	2
484	178	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
485	178	Înlocuit anvelopa	23.00	4	BUC	23	2
486	178	Sudura janta	180.00	2	buc	23	2
487	179	Verificare geometrie	120.00	1	buc	18	2
488	180	Turisme axa fata	180.00	1	BUC	20	2
489	181	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
490	182	Turisme axa fata	180.00	1	BUC	18	2
491	183	Înlocuit anvelopa	15.00	4	BUC	12	2
492	183	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
493	184	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
494	184	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
495	184	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
496	185	13 aliaj	150.00	2	buc	14	2
497	186	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
498	186	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
499	187	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
500	188	Verificare geometrie	120.00	1	buc	18	2
501	189	Înlocuit anvelopa camioneta C	23.00	4	BUC	23	2
502	189	Echilibrat janta camioneta C	25.00	4	BUC	23	2
503	190	Autoutilitare axa simpla/dubla	300.00	1	BUC	20	2
504	191	Turisme axa fata	180.00	1	BUC	18	2
505	192	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
506	192	Înlocuit anvelopa	15.00	4	BUC	24	2
507	193	Verificare geometrie	120.00	1	buc	19	2
508	194	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
509	194	Echilibrat Hunter RFE 21"-22" SUV	100.00	4	buc	21	2
510	195	Verificare geometrie	120.00	1	buc	17	2
511	196	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
512	196	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
513	197	Înlocuit anvelopa Jeep (SUV)	32.00	3	BUC	22	2
514	197	Echilibrat janta Jeep (SUV)	40.00	3	BUC	22	2
515	198	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
516	199	Turisme axa fata	180.00	1	BUC	20	2
517	200	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
518	201	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
519	201	Echilibrat Hunter RFE 21"-22" SUV	100.00	4	buc	21	2
522	203	195/75/16C RIKEN CARGO SPEED EVO 110/108R	420.00	2	buc	5	2
523	203	Înlocuit anvelopa camioneta C	23.00	2	BUC	11	2
524	203	Echilibrat janta camioneta C	25.00	2	BUC	11	2
525	204	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	8	2
526	204	Echilibrat janta Jeep (SUV)	40.00	4	BUC	8	2
527	205	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
528	206	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
529	202	195/65/15  SAILUN ELITE	200.00	4	buc	4	2
530	202	Înlocuit anvelopa	15.00	4	BUC	21	2
531	202	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
532	207	Turisme axa fata	180.00	1	BUC	18	2
533	208	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
535	210	Turisme axa fata	180.00	1	BUC	18	2
536	211	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
537	211	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
538	209	205/55/16 RIKEN ALL SEASON 91V	300.00	2	buc	5	2
539	209	Echilibrat janta aliaj turism	19.00	2	BUC	25	2
540	209	Înlocuit anvelopa	15.00	2	BUC	25	2
541	209	Saci	2.00	1	buc	25	2
542	209	Inlocuit valva turism tubeless	6.00	2	buc	25	2
543	212	Turisme / suv 19"-24" inch	300.00	1	BUC	20	2
544	213	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
545	213	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
546	214	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
548	216	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
549	217	Turisme axa fata	180.00	1	BUC	18	2
550	218	Turisme axa fata	180.00	1	BUC	19	2
552	215	225/50/17 SAILUN ATREZZO ELIT 2	330.00	2	buc	6	2
553	215	Înlocuit anvelopa	18.00	2	BUC	11	2
554	215	Echilibrat janta aliaj turism	24.00	2	BUC	11	2
555	215	Îndreptat jantă aliaj	120.00	1	buc	14	2
556	220	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
557	220	Înlocuit anvelopa	18.00	4	BUC	22	2
558	220	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
559	221	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
560	222	Înlocuit anvelopa	18.00	4	BUC	24	2
561	222	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
563	223	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
564	224	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
565	224	Plumb Hofmann	10.00	4	buc	21	2
566	224	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
567	219	215/55/16 RIKEN ALL SEASON XL 97V	340.00	2	buc	5	2
568	219	Înlocuit anvelopa	18.00	2	BUC	22	2
569	219	Echilibrat janta aliaj turism	24.00	2	BUC	22	2
570	225	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
571	225	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
572	225	Aplicat petec TIP TOP NR 3	50.00	1	buc	12	2
573	225	Plumb Hofmann	10.00	4	buc	12	2
574	225	Inlocuit valva senzor	25.00	1	buc	12	2
575	225	Cazare Anvelope 19''-21''	150.00	1	BUC	12	2
577	226	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
578	226	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
579	227	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
581	229	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
586	233	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
587	233	Înlocuit anvelopa	15.00	4	BUC	22	2
588	233	Echilibrat jantă oțel	18.00	4	BUC	22	2
582	230	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
583	230	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
589	234	225/50/17 KUMHO PS72 XL 98Y	460.00	4	buc	5	2
590	235	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
591	228	315/80/22.5 ROYAL BLACK DV210	1750.00	4	buc	6	2
592	228	Prelungitor valvă	25.00	4	BUC	15	2
593	236	Turisme / suv 19"-24" inch	300.00	1	BUC	20	2
594	237	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
595	238	225/50/17 KUMHO PS72 XL 98Y	460.00	4	buc	5	2
596	238	Înlocuit anvelopa	18.00	4	BUC	22	2
597	238	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
598	238	Saci	2.00	2	buc	22	2
600	239	205/60/16 RIKEN SUMMER 3 XL 96V	330.00	4	buc	5	2
601	239	Înlocuit anvelopa	15.00	4	BUC	24	2
602	239	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
603	240	Turisme axa fata	180.00	1	BUC	18	2
604	241	set oplaciuye fte 1515	300.00	1	buc	7	2
605	241	manopera	200.00	1	ora	7	2
606	242	placute frana fata	250.00	1	buc	7	2
607	242	manopera	0.00	200	ora	7	2
608	242	placute frana gdb1515	200.00	1	buc	7	2
609	243	Turisme axa fata	180.00	1	BUC	18	2
610	244	Turisme axa fata	180.00	1	BUC	19	2
611	245	Turisme axa fata	180.00	1	BUC	20	2
614	246	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
615	246	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
616	232	245/50/18 HANKOOK K137A	830.00	4	buc	4	2
617	232	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
618	232	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
619	231	245/40/19 BRIDGESTONE T005 RFT	970.00	2	buc	4	2
620	231	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
621	231	Înlocuit anvelopa	18.00	2	BUC	21	2
622	247	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
623	248	Verificare geometrie	120.00	1	buc	18	2
626	250	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
627	250	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
630	249	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
631	249	Înlocuit anvelopa	18.00	4	BUC	21	2
632	249	SPALAT INT EXT	65.00	1	ora	6	2
633	252	Verificare geometrie	120.00	1	buc	3	2
637	253	Turisme axa fata	180.00	1	BUC	3	2
638	254	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
639	254	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
640	251	MANOPEARA	50.00	1	ora	6	2
641	251	CUREA ACCESORII 6PK1138CT	70.00	1	buc	6	2
642	255	Cazare Anvelope 19''-21''	150.00	1	BUC	6	2
643	256	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
644	256	Înlocuit anvelopa	15.00	4	BUC	22	2
645	256	Echilibrat jantă oțel	18.00	4	BUC	22	2
646	257	Turisme axa fata	180.00	1	BUC	20	2
647	258	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
648	259	Turisme axa fata	180.00	1	BUC	20	2
649	260	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
651	261	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
652	261	Echilibrat janta Jeep (SUV)	40.00	4	BUC	23	2
653	261	Plumb Hofmann	10.00	4	buc	23	2
654	262	Turisme axa fata	180.00	1	BUC	18	2
655	263	Înlocuit anvelopa	18.00	4	BUC	22	2
656	263	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
657	264	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
658	264	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
659	264	Plumb Hofmann	10.00	4	buc	21	2
660	264	Cazare Anvelope 22''-24''	180.00	1	BUC	21	2
661	265	Înlocuit anvelopa camioneta C	23.00	2	BUC	24	2
662	265	Echilibrat janta camioneta C	25.00	2	BUC	24	2
663	265	Inlocuit valva turism tubeless	6.00	2	buc	24	2
664	266	Turisme axa fata	180.00	1	BUC	19	2
665	267	Presiune roata camion 17.5,22.5 toli	7.00	14	BUC	15	2
666	267	Înlocuit roată 20 , 22.5 țoli	50.00	1	BUC	15	2
667	268	FILTRU AER     C28100	70.00	1	buc	7	2
668	268	FILTRU ULEI    HU711/51X	50.00	1	buc	7	2
669	268	FILTRU COMBUSTIBIL	200.00	1	buc	7	2
670	268	FILTRU POLEN    CUK22013	100.00	1	buc	7	2
671	268	MANOPERA	300.00	1	ora	7	2
672	268	ULEI FORD 5W30 5L	230.00	1	buc	7	2
673	268	ULEI FORD 5W30 1L	75.00	2	buc	7	2
674	269	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
675	270	Înlocuit anvelopa	18.00	4	BUC	22	2
676	270	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
677	270	Saci	2.00	4	buc	22	2
678	271	Turisme axa fata	180.00	1	BUC	19	2
680	273	Echilibrat janta camioneta C	25.00	4	BUC	24	2
681	273	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
682	273	Inlocuit valva turism tubeless	6.00	4	buc	24	2
684	274	Turisme axa fata	180.00	1	BUC	20	2
685	275	Turisme axa fata	180.00	1	BUC	18	2
687	277	Înlocuit anvelopa	18.00	4	BUC	21	2
688	277	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
689	276	225/45/17 MCHELIN PS5	300.00	4	buc	6	2
690	278	Înlocuit anvelopa	18.00	4	BUC	21	2
691	278	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
692	272	225/45/17 MICHELIN PILOT SPORT 5 XL 94Y	540.00	2	buc	5	2
693	272	Înlocuit anvelopa	18.00	2	BUC	22	2
694	272	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
695	279	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
696	280	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
697	280	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
698	281	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
699	282	Cazare Anvelope 17''-18'	70.00	1	BUC	24	2
700	282	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
701	282	Înlocuit anvelopa	18.00	4	BUC	24	2
702	283	Înlocuit anvelopa	15.00	2	BUC	22	2
703	283	Echilibrat jantă oțel	18.00	2	BUC	22	2
704	283	Înlocuit roata turism (Permutare)	16.00	2	BUC	22	2
705	284	215/55/17 mifvsd54fg5sd	500.00	1	buc	21	2
706	285	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
707	286	195/55/16 RIKEN ALL SEASON	310.00	4	buc	4	2
709	288	Autoutilitare axa simpla/dubla	300.00	1	BUC	20	2
710	289	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
711	287	295/60/22.5 GITI GDR675	2300.00	4	buc	4	2
712	287	Înlocuit anvelopă 20 , 22.5 țoli	80.00	4	BUC	15	2
713	290	215/55/17 MICHELIN PS5	250.00	4	buc	6	2
715	292	Turisme axa fata	180.00	1	BUC	18	2
716	293	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
717	294	Deblocat suruburi	60.00	1	BUC	6	2
719	296	Verificare geometrie	120.00	1	buc	19	2
720	297	Echilibrat janta camioneta C	25.00	4	BUC	21	2
721	297	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
722	297	Inlocuit valva turism tubeless	6.00	4	buc	21	2
723	298	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
724	298	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
725	295	JANTA 9.00X22.5	850.00	1	buc	6	2
726	295	Înlocuit anvelopă 20 , 22.5 țoli	80.00	12	BUC	15	2
727	299	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
728	299	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
729	300	Turisme axa fata	180.00	1	BUC	18	2
730	301	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
731	302	schimb ulei filtre piese client	100.00	1	buc	27	2
732	303	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
733	303	Înlocuit anvelopa	15.00	4	BUC	24	2
734	303	Echilibrat jantă oțel	18.00	4	BUC	24	2
735	304	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
736	304	Saci	2.00	8	buc	22	2
738	306	Verificare geometrie	120.00	1	buc	18	2
739	307	Deblocat suruburi	60.00	1	BUC	6	2
740	308	Înlocuit anvelopa	15.00	4	BUC	24	2
741	308	Echilibrat jantă oțel	18.00	4	BUC	24	2
742	305	205/55/16 RIKEN SUMMER 3 91V	260.00	2	buc	5	2
743	305	Înlocuit anvelopa	15.00	2	BUC	23	2
744	305	Echilibrat janta aliaj turism	19.00	2	BUC	23	2
745	309	Turisme axa fata	180.00	1	BUC	19	2
746	310	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
747	310	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
750	311	Echilibrat janta camioneta C	25.00	2	BUC	21	2
751	311	Înlocuit anvelopa camioneta C	23.00	6	BUC	21	2
752	312	Turisme axa fata	180.00	1	BUC	18	2
753	313	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
754	313	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
756	291	Deblocat suruburi	60.00	1	BUC	6	2
757	291	215/55/17 MIC	200.00	1	buc	6	2
759	315	Turisme axa fata	180.00	1	BUC	22	2
760	316	Inlocuit valva senzor	25.00	1	buc	6	2
761	317	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
762	317	Înlocuit anvelopa	23.00	1	BUC	23	2
763	318	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
764	319	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
765	320	Înlocuit anvelopa	12.00	4	BUC	24	2
766	320	Echilibrat janta aliaj turism	17.00	4	BUC	24	2
767	321	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
768	321	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
769	321	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
770	321	Presiune/roată AZOT jeep	8.00	4	buc	22	2
771	314	2155517  MIV	200.00	2	buc	6	2
772	314	Aplicat petec TIP TOP NR 3	50.00	1	buc	29	2
773	314	Demontat rezervă (sub mașină) – Turisme	25.00	1	BUC	29	2
774	322	Înlocuit anvelopa	23.00	4	BUC	24	2
775	322	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
777	323	165/70/14 RIKEN ALL SEASON XL 85T	240.00	2	buc	5	2
778	323	Înlocuit anvelopa	12.00	2	BUC	11	2
779	323	Echilibrat jantă oțel	14.00	2	BUC	11	2
780	324	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
781	324	Echilibrat Hunter RFE 21"-22" SUV	100.00	4	buc	21	2
782	324	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
783	325	Înlocuit anvelopa camioneta C	23.00	4	BUC	22	2
784	325	Echilibrat janta camioneta C	25.00	4	BUC	22	2
785	325	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
786	326	Înlocuit anvelopa	15.00	4	BUC	22	2
787	326	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
788	326	Saci	2.00	4	buc	22	2
791	328	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
792	328	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
794	330	Turisme axa fata	180.00	1	BUC	18	2
801	327	275/35/22 MICHELIN PS4S	1800.00	2	buc	6	2
802	327	315/30/22 MICHELIN PS 4S	2200.00	2	buc	6	2
803	327	Înlocuit anvelopa	26.00	4	BUC	22	2
804	327	Plumb Hofmann	10.00	4	buc	22	2
805	327	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	22	2
806	327	Cazare Anvelope 22''-24''	135.00	1	BUC	22	2
807	331	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
808	331	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
809	332	245/40/20 GRIPMAX MS	680.00	2	buc	6	2
810	332	275/35/20 GRIPMAX MS	750.00	2	buc	6	2
811	332	AVANS 300	0.00	1	buc	6	2
812	329	205/55/16 KUMHO HS52 91V	280.00	4	buc	5	2
813	329	Înlocuit anvelopa	15.00	4	BUC	24	2
814	329	Echilibrat jantă oțel	18.00	4	BUC	24	2
815	329	Coliere	0.50	8	buc	24	2
816	329	Inlocuit valva turism tubeless	6.00	4	buc	24	2
819	335	Verificare geometrie	120.00	1	buc	18	2
824	333	225/65/16C VIKING TRANS TECH	540.00	2	buc	6	2
825	333	Înlocuit anvelopa camioneta C	23.00	2	BUC	14	2
826	333	Echilibrat janta camioneta C	25.00	2	BUC	14	2
831	336	Turisme axa fata	180.00	1	BUC	18	2
841	338	Înlocuit anvelopa	18.00	4	BUC	14	2
842	338	Echilibrat janta aliaj turism	24.00	4	BUC	14	2
843	339	Înlocuit anvelopa	15.00	4	BUC	15	2
844	339	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
845	340	Înlocuit anvelopa	23.00	4	BUC	22	2
846	340	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
848	342	Turisme axa fata	180.00	1	BUC	18	2
849	343	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
850	343	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
851	343	Aplicat petec TIP TOP NR 2	40.00	2	buc	24	2
852	341	205/55/16 RIKEN ALL SEASON	300.00	2	buc	4	2
853	341	Înlocuit anvelopa	15.00	2	BUC	22	2
854	341	Echilibrat janta aliaj turism	19.00	2	BUC	22	2
855	341	Inlocuit valva turism tubeless	6.00	2	buc	22	2
864	344	Echilibrat janta Jeep (SUV)	24.00	8	BUC	24	2
865	334	235/55/19 MICHELIN PRYMACY 5 ENERGY	890.00	4	buc	6	2
866	334	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
867	334	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
868	334	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
869	337	245/40/20 GRIPMAX MS	680.00	2	buc	6	2
870	337	275/35/20 GRIPMAX MS	750.00	2	buc	6	2
871	337	VALVA SKA921	60.00	1	buc	6	2
872	337	montat valva senzor	25.00	1	buc	23	2
873	337	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
874	337	Înlocuit anvelopa	23.00	4	BUC	23	2
875	337	AV B300	0.00	1	buc	6	2
\.


--
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.receipts (id, account_id, titlu, descriere, date_tehn, created_at, total, is_deleted, deleted_at, updated_at, pay_method, partial_pay, client_id, deviz_serie, deviz_nr, factura_serie, factura_nr, chitanta_serie, chitanta_nr, programare_id, location_id) FROM stdin;
2	2	Dj92Web	\N	\N	2026-03-24 07:01:51.142288+00	308.00	t	2026-03-24 14:02:49.144992+00	2026-03-24 07:02:53.342418+00	NEPLATIT	\N	\N	AS26D	2		0		0	\N	\N
37	2	DJ 94 WON RAIMAN AIMAN	anv montate pirelli p zero 265 40 20 mm 5 5 6 6 presiune 2,5 fata spate nm 140 \n custodie anv  jante capace michelin alpin 5 265 40 20 2722 mm 5 5 5 5	\N	2026-03-25 09:36:44.677793+00	575.00	f	\N	2026-03-25 09:39:17.733112+00	OP	\N	\N	AS26D	25		0		0	\N	\N
1	2	Test	\N	\N	2026-03-24 00:41:28.896601+00	630.00	t	2026-03-24 07:51:12.405878+00	2026-03-24 00:42:12.660922+00	NEPLATIT	\N	1	AS26D	1		0		0	\N	\N
13	2	DJ 77 MNC	\N	\N	2026-03-24 10:50:58.219614+00	2292.00	f	\N	2026-03-24 14:09:07.830428+00	CASH	\N	\N	AS26D	10		0		0	\N	\N
32	2	dj 63  kta	\N	\N	2026-03-25 09:07:20.843438+00	192.00	f	\N	2026-03-25 09:09:02.644353+00	CASH	\N	\N	AS26D	21		0		0	\N	\N
26	2	DJ83JUL	\N	\N	2026-03-24 15:37:55.270208+00	1290.00	t	2026-03-25 06:44:58.088716+00	2026-03-24 15:44:20.995635+00	NEPLATIT	\N	5		0		0		0	\N	\N
19	2	DJ66EBE	BMW X1 \nSTANESCU COSTINEL	MONTAJ ANV NUMAI FATA	2026-03-24 14:32:15.656863+00	1140.00	t	2026-03-25 06:45:06.69186+00	2026-03-24 14:41:03.694022+00	NEPLATIT	\N	4	AS26D	13		0		0	\N	\N
18	2	DJ 52 TTG DU,ITRU MARIAN 0767531269 KM 200.000	FORD TRANSIT CUSTOM anv client hankook  vantra 225 65 16c mm 7 7 7 7 presiune fata spate 3,5 nm 160	\N	2026-03-24 14:17:28.920003+00	192.00	f	\N	2026-03-24 14:19:34.73084+00	OP	\N	\N	AS26D	12		0		0	\N	\N
31	2	B 108 NNB EPTISA POPESCU ALIN 0722217995 KM  101.900	anv montate 185 65 15 kumhoo ecowing mm 6 6 5 5 presiune 2,3 fata spate nm 110   anv custodie 185 65 15 sebring winter dot 3820 mm 5 5 5 5	\N	2026-03-25 09:00:08.720843+00	252.00	f	\N	2026-03-25 09:15:28.915813+00	OP	\N	\N	AS26D	20		0		0	\N	\N
11	2	DJ 53 HMD LITA CATALIN 072153382 KM 110.000	anv client uzate taloane rupte mm 3 3 2 2 unyroial 2 buc conti 2 buc 225 65 16c presiune 4,0 fata spate  soferul refuza inlocuirea valvelor.  nm 180	\N	2026-03-24 10:22:21.640602+00	142.00	f	\N	2026-03-24 12:12:20.067949+00	OP	\N	\N	AS26D	6		0		0	\N	\N
9	2	DJ34ALA	PATRU LAURENTIU 0744819480 km 70.000 RENAULT KOLEOS 2 PRESIUNE 2,6 FATA 2,5 SPATE NM 120	\N	2026-03-24 09:12:23.958311+00	7320.00	f	\N	2026-03-24 12:18:46.235099+00	CARD	\N	\N	AS26D	5		0		0	\N	\N
3	2	Dj92Web	\N	\N	2026-03-24 07:33:55.414986+00	308.00	f	\N	2026-03-24 12:19:56.003852+00	CARD	\N	\N	AS26D	3		0		0	\N	\N
27	2	dfhghj55	\N	\N	2026-03-25 07:41:04.380656+00	20.00	t	2026-03-25 07:54:02.845264+00	2026-03-25 07:41:15.970492+00	CASH	\N	7		0		0		0	\N	\N
36	2	VOLVO XC90 DJ 69 SAH	MICHELIN PS4 SUV 275/45/20 6mm (sau montat 4 roti)	\N	2026-03-25 09:25:23.076545+00	120.00	f	\N	2026-03-25 09:42:19.567889+00	CARD	\N	\N		0		0		0	\N	\N
28	2	dj 44frt	\N	\N	2026-03-25 07:52:28.470994+00	50.00	f	\N	2026-03-25 07:56:04.890075+00	OP	\N	\N	AS26D	17		0		0	\N	\N
12	2	DJ 77 MNC	\N	\N	2026-03-24 10:45:41.225409+00	2000.00	f	\N	2026-03-24 12:40:42.44698+00	CASH	\N	\N	AS26D	7		0		0	\N	\N
10	2	DJ34ALA	PATRU LAURENTIU 0744819480 km 70.000 RENAULT KOLEOS 2 PRESIUNE 2,6 FATA 2,5 SPATE NM 120	\N	2026-03-24 09:32:57.140612+00	7324.00	t	2026-03-24 12:53:17.202185+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
14	2	DJ77LIT	\N	\N	2026-03-24 12:33:12.983304+00	2090.00	t	2026-03-24 13:25:50.079858+00	2026-03-24 12:40:22.837598+00	CASH	\N	3	AS26D	8		0		0	\N	\N
15	2	DJ75POP	\N	\N	2026-03-24 12:55:34.925873+00	400.00	t	2026-03-24 13:25:54.373557+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
17	2	dj 77 lit	luta ahwbjwq	\N	2026-03-24 14:07:30.001293+00	1360.00	t	2026-03-24 14:52:20.274146+00	2026-03-24 14:28:37.097945+00	NEPLATIT	\N	\N	AS26D	11		0		0	\N	\N
8	2	DJ34ALA	PATRU LAURENTIU 0744819480 km 70.000 RENAULT KOLEOS 2 PRESIUNE 2,6 FATA 2,5 SPATE NM 120	\N	2026-03-24 09:11:16.948737+00	7330.00	t	2026-03-24 14:02:24.832244+00	2026-03-24 09:11:36.268093+00	NEPLATIT	\N	\N	AS26D	4		0		0	\N	\N
7	2	DJ34ALA	PATRU LAURENTIU 0744819480 km 70.000 RENAULT KOLEOS 2 PRESIUNE 2,6 FATA 2,5 SPATE NM 120	\N	2026-03-24 09:10:31.782726+00	7330.00	t	2026-03-24 14:02:29.102028+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
6	2	DJ34ALA	\N	\N	2026-03-24 09:06:39.14509+00	7320.00	t	2026-03-24 14:02:33.803652+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
5	2	DJ34ALA	PATRU LAURENTIU 0744819480 km 70.000 RENAULT KOLEOS 2 PRESIUNE 2,6 FATA 2,5 SPATE NM 120	\N	2026-03-24 09:06:17.89123+00	8288.00	t	2026-03-24 14:02:38.428932+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
4	2	DJ34ALA	\N	\N	2026-03-24 08:29:00.807892+00	7920.00	t	2026-03-24 14:02:42.916812+00	2026-03-24 09:37:07.910149+00	NEPLATIT	\N	\N		0		0		0	\N	\N
16	2	OT 14 TDA DAN TRANDAFIR 0766394923 KM 125.000	anv client pirelli p zero 235 55 19 presiune fata spate 2,4 nm 120	\N	2026-03-24 13:58:49.072784+00	120.00	f	\N	2026-03-24 14:02:46.070303+00	CASH	\N	\N	AS26D	9		0		0	\N	\N
20	2	DJ76LLC	\N	\N	2026-03-24 14:56:32.202235+00	720.00	f	\N	2026-03-24 14:57:49.017666+00	CASH	\N	\N	AS26D	14		0		0	\N	\N
33	2	dj 14 hmt	\N	\N	2026-03-25 09:17:50.254961+00	40.00	f	\N	2026-03-25 09:20:17.216226+00	CASH	\N	\N	AS26D	22		0		0	\N	\N
29	2	dj015201	\N	\N	2026-03-25 08:08:47.438953+00	50.00	f	\N	2026-03-25 08:11:34.633694+00	CARD	\N	8	AS26D	18		0		0	\N	\N
25	2	DJ65ASC RADU LUNGU	\N	\N	2026-03-24 15:34:58.714888+00	2546.00	t	2026-03-24 15:36:52.557178+00	2026-03-24 15:36:33.331095+00	NEPLATIT	\N	6		0		0		0	\N	\N
24	2	DJ65ASC RADU LUNGU	\N	\N	2026-03-24 15:33:28.013903+00	2525.00	t	2026-03-24 15:36:55.155045+00	2026-03-24 15:33:38.134983+00	NEPLATIT	\N	\N	AS26D	16		0		0	\N	\N
23	2	DJ65ASC RADU LUNGU	\N	\N	2026-03-24 15:29:08.195242+00	2500.00	t	2026-03-24 15:36:57.854263+00	2026-03-24 15:29:22.844761+00	NEPLATIT	\N	\N	AS26D	15		0		0	\N	\N
22	2	DJ65ASC RADU LUNGU	\N	\N	2026-03-24 15:28:54.152441+00	2000.00	t	2026-03-24 15:37:00.795063+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
21	2	DJ65ASC RADU LUNGU	\N	\N	2026-03-24 15:28:12.510841+00	2000.00	t	2026-03-24 15:37:03.397494+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
35	2	dj 19mhn	\N	michelin 225 50 17	2026-03-25 09:20:29.527562+00	72.00	f	\N	2026-03-25 09:21:16.451883+00	CARD	\N	\N	AS26D	23		0		0	\N	\N
30	2	DJ 10 AGL  LAURENTIU  0751649120 KM 260.000	anv client china 245 40 18 mm 4 4	\N	2026-03-25 08:31:08.211169+00	84.00	f	\N	2026-03-25 09:03:40.115004+00	OP	\N	\N	AS26D	19		0		0	\N	\N
40	2	DJ 31 GLM FLORIN 0755043755 KM 168 900	anv client 195 55 16  conti eco contact 6 mm 7 7 7 7 presiune fata spate 2,6 3,3 nm 120	\N	2026-03-25 10:05:04.932679+00	136.00	f	\N	2026-03-25 10:05:51.018165+00	CARD	\N	\N	AS26D	27		0		0	\N	\N
34	2	DJ 77 MNC	\N	\N	2026-03-25 09:20:15.77852+00	2400.00	f	\N	2026-03-25 09:30:36.403555+00	CARD	\N	\N	AS26D	24		0		0	\N	\N
48	2	DJ 21 BNV	\N	\N	2026-03-25 10:49:07.979137+00	656.00	f	\N	2026-03-25 11:35:11.192579+00	CARD	\N	\N	AS26D	35		0		0	\N	\N
38	2	LOGAN B 120 EPT	\N	\N	2026-03-25 09:57:39.305864+00	252.00	f	\N	2026-03-25 09:58:20.155916+00	OP	\N	9	AS26D	26		0		0	\N	\N
39	2	DJ17RJF	\N	\N	2026-03-25 09:57:59.757967+00	7400.00	t	2026-03-25 10:24:20.570967+00	2026-03-25 10:23:28.285328+00	NEPLATIT	\N	\N		0		0		0	\N	\N
46	2	DJ 53 AGA BMW G30 GALCA ADRIAN 0765178726 KM	\N	\N	2026-03-25 10:24:57.803986+00	100.00	f	\N	2026-03-25 10:25:57.836785+00	CARD	\N	\N	AS26D	30		0		0	\N	\N
41	2	LOGAN B107JVR	\N	\N	2026-03-25 10:07:48.651022+00	252.00	f	\N	2026-03-25 10:08:33.886323+00	OP	\N	9	AS26D	28		0		0	\N	\N
44	2	dj 79 ayn	\N	\N	2026-03-25 10:22:03.595337+00	136.00	f	\N	2026-03-25 10:23:42.895883+00	CASH	\N	\N	AS26D	29		0		0	\N	\N
43	2	DJ 21 YCE	\N	\N	2026-03-25 10:21:32.709337+00	3000.00	t	2026-03-25 10:37:29.547531+00	2026-03-25 10:22:00.336825+00	NEPLATIT	\N	\N		0		0		0	\N	\N
42	2	DJ17RJF	\N	\N	2026-03-25 10:20:51.778015+00	7756.00	f	\N	2026-03-25 10:47:31.531638+00	OP	\N	10	AS26D	32		0		0	\N	\N
49	2	DB 36 AXS HYUNDAI SEBI 0729133632 KM 6.500	anv client 225 45 17 michelin primacy 4 mm 7 7 7 7 presiune 2.3 fata spate nm 120	\N	2026-03-25 10:59:22.771219+00	168.00	f	\N	2026-03-25 11:03:21.428249+00	CASH	\N	\N	AS26D	33		0		0	\N	\N
50	2	DB12WBY	225 -50-17-KUMHOWP52+Mm 7\nDot 2125_\n4 anv 4aliajFARA. CAPCE\n\nmontat 225/50/7 /firestone roadhawk -4 buc	\N	2026-03-25 11:12:49.964543+00	360.00	f	\N	2026-03-25 11:21:05.296804+00	CARD	\N	11	AS26D	34		0		0	\N	\N
45	2	DJ 53 AGA BMW G30 GALCA ADRIAN 0765178726 KM	\N	\N	2026-03-25 10:23:43.983143+00	100.00	f	\N	2026-03-25 14:15:46.259903+00	CARD	\N	\N		0		0		0	\N	\N
47	2	dj04eca	\N	\N	2026-03-25 10:31:29.564156+00	130.00	f	\N	2026-03-25 14:17:02.530565+00	CARD	\N	\N	AS26D	31		0		0	\N	\N
60	2	B596NWA MERCEDES	custodie anv jante capace michelin pilot alpin 5 suv  235 55 19 255 50 19 mm 7 7 7 7 dot 35 25 \nanv montate conti eco contact 6 255 45 20 285 40 20 mm 7 7 7 7 presiune 2,5 nm 140	\N	2026-03-25 13:40:28.199281+00	328.00	f	\N	2026-03-25 13:47:32.209926+00	CARD	\N	\N	AS26D	44		0		0	\N	\N
85	2	BMW DJ 99 XLD	sailun 225/50/17\n\nPirelli 225/50/17 (sau montat 4 anvelope)	\N	2026-03-26 07:31:57.935129+00	168.00	f	\N	2026-03-26 07:34:22.528458+00	CARD	\N	\N	AS26D	65		0		0	\N	\N
68	2	dj 65 grb	\N	\N	2026-03-25 14:47:15.574523+00	100.00	f	\N	2026-03-25 14:48:23.001687+00	OP	\N	\N	AS26D	51		0		0	\N	\N
61	2	VL 78 MYT	\N	\N	2026-03-25 13:50:43.72822+00	928.00	f	\N	2026-03-25 13:55:04.227771+00	CASH	\N	18	AS26D	45		0		0	\N	\N
53	2	BMW DJ 11 SSR   45000 km	MICHELIN PA5 225/40/19 6mm dot=2724\nMICHELIN PA5 255/35/19 6mm dot=3824    (custodie=4 anvelope)\n\n\nMICHELIN PS4S 225/40/19 6mm\nMICHELIN PS4S 255/35/19 6mm     (sau montat 4 anvelope)	\N	2026-03-25 12:00:38.297687+00	646.00	f	\N	2026-03-25 12:03:40.265902+00	CARD	\N	14	AS26D	37		0		0	\N	\N
67	2	DJ 66 WDR  DRAGOSI BARA  0760561999 km 91.200	anv montate michelin pilot sport 4 suv 285 35 23 325 30 23 mm 7 7 7 7 presiune 2,5 nm 160 \ncustodie anv jante capace 3 buc 285 40 22 325 35 22 pirelli sotto winter mm 6 6 m6 6 dot 4024 4223	\N	2026-03-25 14:44:18.715274+00	700.00	f	\N	2026-03-25 14:48:56.796808+00	CARD	\N	\N	AS26D	52		0		0	\N	\N
80	2	dj 16 plv	205 55 16 hankook	\N	2026-03-26 07:19:01.428924+00	76.00	f	\N	2026-03-26 07:23:10.675072+00	CARD	\N	\N	AS26D	61		0		0	\N	\N
52	2	dj75pop	mota 225/55/17 kioc 4 dAKSJ KAPRE Jabez	custode \n225844s jwd \nkjaqnwfgz q\nw ,lanwj	2026-03-25 11:37:59.564854+00	750.00	t	2026-03-25 12:52:09.731292+00	2026-03-25 11:40:21.981568+00	NEPLATIT	\N	13	AS26D	36		0		0	\N	\N
62	2	gj 06705	matador 225 55 17	\N	2026-03-25 13:59:53.739426+00	96.00	f	\N	2026-03-25 14:06:00.018893+00	CASH	\N	\N	AS26D	47		0		0	\N	\N
55	2	dj 24 uat	\N	\N	2026-03-25 12:53:12.198779+00	132.00	f	\N	2026-03-25 12:55:51.152135+00	CASH	\N	\N	AS26D	40		0		0	\N	\N
63	2	dj 10 sph	continental 215 60 17	\N	2026-03-25 14:04:12.258966+00	176.00	f	\N	2026-03-25 14:15:02.876079+00	CARD	\N	19	AS26D	46		0		0	\N	\N
59	2	dj 22 kld	\N	\N	2026-03-25 13:36:38.930523+00	33.00	f	\N	2026-03-25 14:15:32.008959+00	CASH	\N	\N	AS26D	43		0		0	\N	\N
51	2	DJ77XRA RAZVAN	custodie  anv jante michelin pilot pa4 245 50 18 mm 5  5 5 5dot 3417	\N	2026-03-25 11:25:59.663784+00	5291.00	f	\N	2026-03-25 14:16:01.594736+00	OP	\N	12	AS26D	38		0		0	\N	\N
56	2	OT 05 CVN	\N	\N	2026-03-25 13:04:21.350655+00	334.00	f	\N	2026-03-25 13:10:51.446628+00	CASH	\N	16	AS26D	41		0		0	\N	\N
57	2	DJ 88 PBP PORSCHE ROBERT 0733444444	anv client michelin pilot sport 4 suv 285 40 21 315 35 21 mm 5 5 5 5 presiune 2,4  2,6 nm160	\N	2026-03-25 13:21:34.57625+00	528.00	f	\N	2026-03-25 13:24:09.259349+00	OP	\N	\N	AS26D	42		0		0	\N	\N
58	2	DJ 13 LUP	\N	\N	2026-03-25 13:25:07.064523+00	1320.00	t	2026-03-25 13:26:49.795366+00	\N	NEPLATIT	\N	17		0		0		0	\N	\N
75	2	DJ10TON	\N	\N	2026-03-26 07:01:34.551538+00	180.00	f	\N	2026-03-26 09:55:10.035876+00	CASH	\N	\N		0		0		0	\N	\N
54	2	MEGANE VS 46 MET	KUMHO 205/55/16 6mm 2,30 barii (sau montat 4 anvelope)	\N	2026-03-25 12:38:35.109013+00	140.00	f	\N	2026-03-25 13:30:49.025552+00	CASH	\N	15	AS26D	39		0		0	\N	\N
69	2	DJ 19 MAE	\N	\N	2026-03-25 14:55:38.669099+00	944.00	f	\N	2026-03-25 15:13:21.638596+00	CASH	\N	22	AS26D	53		0		0	\N	\N
64	2	DJ 19 NWA	anv montate conti eco contact 6 235 55 18 mm 5 5 4 4 presiune 2,6 fata 2,3 spate nm 140 \ncustodie anv  michelin pilot alpin 5 235 55 18 mm 7 7 7 7 dot 2522	\N	2026-03-25 14:17:04.42879+00	316.00	f	\N	2026-03-25 14:25:31.191676+00	CARD	\N	\N	AS26D	48		0		0	\N	\N
70	2	GJ 96 LNG	\N	\N	2026-03-26 06:22:56.223442+00	1368.00	f	\N	2026-03-26 07:10:39.092073+00	OP	\N	23	AS26D	57		0		0	\N	\N
66	2	dj 01 haa	hankook 225 50 17	\N	2026-03-25 14:24:27.729051+00	96.00	f	\N	2026-03-25 14:27:15.015982+00	CARD	\N	21	AS26D	49		0		0	\N	\N
65	2	MERCEDES  OT 29 PPE	PIRELLI 295/40/22 5-6mm 2,50 barii (SAU MONTAT)\n\nCONTINENTAL WINTCONT. 295/40/22 6mm dot=3822 ( custodie= 4 anvelope,4 jante aliaj,2 capace centru)	\N	2026-03-25 14:21:05.626344+00	410.00	f	\N	2026-03-25 14:27:56.456723+00	OP	\N	20	AS26D	50		0		0	\N	\N
71	2	TESLA DJ 01 EDB	KUMHO WINTERCRAFT 235/45/18 6mm dot=3222 (custodie=4 anvelope)\n\n\nKUMHO 235/45/18 7mm 2,90 bari (sau montat)	\N	2026-03-26 06:37:15.274966+00	308.00	f	\N	2026-03-26 06:38:48.411067+00	CARD	\N	\N	AS26D	54		0		0	\N	\N
72	2	dj 99 xsx	\N	\N	2026-03-26 06:39:18.163656+00	76.00	f	\N	2026-03-26 06:41:19.948236+00	CARD	\N	\N		0		0		0	\N	\N
73	2	DJ 86 RFC RADUCANU km 15 000FLORIN0746104146	anv montate toyo proxes   215 55 18  mm 7 7 7 7 presiune fata spate 2,5 nm 120 \n\ncustodie anv  jante capace bridgestone blizzak  215 55 18 mm7 7 7 7dot 1224	\N	2026-03-26 06:43:30.525096+00	311.00	f	\N	2026-03-26 06:47:34.413601+00	CARD	\N	\N	AS26D	55		0		0	\N	\N
76	2	dj09 sbs	\N	\N	2026-03-26 07:09:52.659721+00	184.00	f	\N	2026-03-26 07:11:54.098798+00	CASH	\N	\N	AS26D	58		0		0	\N	\N
77	2	OT19SCR	\N	\N	2026-03-26 07:11:07.728078+00	25.00	f	\N	2026-03-26 07:12:51.038806+00	CASH	\N	\N		0		0		0	\N	\N
81	2	dj02wgb	\N	\N	2026-03-26 07:24:00.942441+00	80.00	f	\N	2026-03-26 07:25:44.617795+00	CASH	\N	\N	AS26D	62		0		0	\N	\N
78	2	SANGYONG DJ 21 POE	KUMHO 235/55/18 6mm 2,50 (sau montat 4 roti)\n\n\nDEBICA 225/60/17 6mm dot=3522 (custodie=4 anvelope,4jante aliaj,4capace centru)	\N	2026-03-26 07:14:40.867148+00	256.00	f	\N	2026-03-26 07:16:10.038078+00	PARTIAL	116.00	\N	AS26D	59		0		0	\N	\N
83	2	DJ19CER	\N	\N	2026-03-26 07:28:32.460573+00	180.00	f	\N	2026-03-26 07:31:54.893521+00	CASH	\N	\N	AS26D	63		0		0	\N	\N
79	2	dj 18 kfa	\N	\N	2026-03-26 07:17:57.015823+00	15.00	f	\N	2026-03-26 07:21:51.281762+00	CARD	\N	24	AS26D	60		0		0	\N	\N
84	2	DJ 81 WXW BMW X3 ADELIN 0744562616 km 169 000	anv   client apolo sumer 245 50 18 mm 4 4 4 4 presiune 2,4 fata spate nm 140	\N	2026-03-26 07:31:40.123647+00	176.00	f	\N	2026-03-26 07:32:46.198267+00	CASH	\N	\N	AS26D	64		0		0	\N	\N
90	2	OT06ETE	\N	\N	2026-03-26 08:02:23.331742+00	120.00	f	\N	2026-03-26 08:04:17.647993+00	CASH	\N	25	AS26D	67		0		0	\N	\N
82	2	DJ99XSX	\N	\N	2026-03-26 07:25:18.450334+00	180.00	f	\N	2026-03-26 08:06:40.921557+00	CARD	\N	\N		0		0		0	\N	\N
86	2	Gj96LNG	\N	\N	2026-03-26 07:35:24.515553+00	180.00	f	\N	2026-03-26 08:07:26.256691+00	CASH	\N	\N		0		0		0	\N	\N
89	2	gr 25 wss	\N	\N	2026-03-26 08:00:38.08085+00	200.00	f	\N	2026-03-26 08:06:50.868281+00	CARD	\N	25	AS26D	66		0		0	\N	\N
87	2	MERCEDES DJ 77 MUN	BRIDGESTONE BLIZZAK 235/60/18 3mm dot=3519, recomand înlocuirea anvelopelor de iarna (custodie=4anvelope,4jante aliaj)\n\nMICHELIN PS4 235/55/19 5mm (sau montat 4 roti)	\N	2026-03-26 07:51:41.11648+00	280.00	f	\N	2026-03-26 08:09:14.156296+00	CARD	\N	26	AS26D	68		0		0	\N	\N
92	2	DJ50 TTG	\N	\N	2026-03-26 08:17:06.686322+00	136.00	f	\N	2026-03-26 09:48:22.523441+00	OP	\N	27	AS26D	69		0		0	\N	\N
91	2	dj 22 rsm	\N	\N	2026-03-26 08:15:02.618864+00	316.00	f	\N	2026-03-26 08:20:49.960319+00	CARD	\N	\N	AS26D	70		0		0	\N	\N
95	2	IF 78 ARS	\N	\N	2026-03-26 08:26:27.874084+00	1120.00	f	\N	2026-03-26 09:35:30.209196+00	CASH	\N	28	AS26D	81		0		0	\N	\N
96	2	DJ90BZA	\N	\N	2026-03-26 08:26:40.633365+00	250.00	f	\N	2026-03-26 08:36:15.809798+00	CASH	\N	\N		0		0		0	\N	\N
97	2	DJ50TTG	\N	\N	2026-03-26 08:27:40.065807+00	180.00	f	\N	2026-03-26 08:39:19.807672+00	OP	\N	\N	AS26D	72		0		0	\N	\N
94	2	DJ 38 SPM MERCEDES VITO VRAJITORU LIVIU 0730848668	programat senzori	\N	2026-03-26 08:26:12.933565+00	120.00	f	\N	2026-03-26 08:40:28.407085+00	CASH	\N	\N	AS26D	73		0		0	\N	\N
102	2	DJ 14 ATX	\N	\N	2026-03-26 08:57:56.57257+00	2520.00	f	\N	2026-03-26 09:08:05.749915+00	CARD	\N	\N	AS26D	78		0		0	\N	\N
74	2	DJ 55 MDF	\N	\N	2026-03-26 06:46:20.745563+00	6088.00	f	\N	2026-03-26 09:53:26.738506+00	OP	\N	\N	AS26D	56		0		0	\N	\N
88	2	Fără numar	\N	\N	2026-03-26 07:52:19.69292+00	300.00	f	\N	2026-03-26 10:05:24.353151+00	OP	\N	\N		0		0		0	\N	\N
110	2	OT73LDR	\N	\N	2026-03-26 10:02:37.315335+00	300.00	f	\N	2026-03-26 10:06:48.495039+00	OP	\N	\N		0		0		0	\N	\N
118	2	DJ 77 RYG	custodie noua 4 anvelope hankook winter i.cept evo2 255 45 19 dot 4623 mm5	\N	2026-03-26 11:17:03.614678+00	5094.00	f	\N	2026-03-26 11:27:17.755183+00	CARD	\N	33	AS26D	92		0		0	\N	\N
98	2	RANGE ROVER B 51 WSD	MICHELIN PS4 SUV 285/45/22	\N	2026-03-26 08:30:43.692644+00	160.00	f	\N	2026-03-26 08:42:09.870531+00	CASH	\N	29	AS26D	74		0		0	\N	\N
111	2	DJ33YKA	\N	\N	2026-03-26 10:11:16.429835+00	180.00	f	\N	2026-03-26 10:16:02.09374+00	CASH	\N	\N	AS26D	86		0		0	\N	\N
100	2	OT07CSY	\N	\N	2026-03-26 08:50:25.81011+00	250.00	f	\N	2026-03-26 08:56:32.197669+00	CASH	\N	\N	AS26D	75		0		0	\N	\N
103	2	DJ 43 DXD ALEX tesla  0769691964 KM 33 000	anv client bridgestone elentra 235 45 18 mm 3 3 5 5 presiune fata spate 2,9 nm 175	\N	2026-03-26 09:00:53.303198+00	168.00	f	\N	2026-03-26 09:03:09.833836+00	CASH	\N	\N	AS26D	76		0		0	\N	\N
101	2	dj 14 atx	montat hankook 225 45 17\ncustodie 4 anvelope 235 45 17 kumho winter dot 2123 mm 6	\N	2026-03-26 08:51:19.570656+00	308.00	f	\N	2026-03-26 09:07:43.863144+00	CARD	\N	30	AS26D	77		0		0	\N	\N
104	2	dj 67 rmg	\N	\N	2026-03-26 09:10:10.326584+00	168.00	f	\N	2026-03-26 09:13:38.664792+00	CASH	\N	\N	AS26D	79		0		0	\N	\N
112	2	DJ 90 SNY MERCEDES	anv client pirelli p zero 225 40 19 255 35 19  anvelopa SF deformata hunter nu poate remedia problema	\N	2026-03-26 10:30:10.560312+00	320.00	f	\N	2026-03-26 10:34:31.473+00	OP	\N	\N	AS26D	87		0		0	\N	\N
99	2	OT 14 PPE	MICHELIN PS5 245/45/19 5mm 2,30 bari (2 anvelope montat)\nMICHELIN PS5 275/40/19 6mm 2,30 bari (1 anvelopa montat)\nHANKOOK WINT. 275/40/19 6mm dot=3023\nHANKOOK WINT. 245/45/19 6mm dot=2823 (cust 4anve)	\N	2026-03-26 08:41:39.565256+00	1554.00	f	\N	2026-03-26 09:31:23.776897+00	OP	\N	31	AS26D	80		0		0	\N	\N
126	2	B 222 AXX  AUDI A5 DANIEL 0721215491 240.000	anv montate pirelli p zero 255 35 19 mm 6 6 goodyear eagle f1 255 35 19 5 5 presiune 2,4 nm 120 \n\ncustodie anv jante capace verdestein winter 245 40 18 dot  1518 mm 5 5 5 5	\N	2026-03-26 12:24:36.675814+00	310.00	f	\N	2026-03-26 12:25:49.864655+00	OP	\N	\N	AS26D	99		0		0	\N	\N
106	2	DJ 32 XEX ford kuga COLAN DANIEL 0723584237 km 40. 546	ANV CLIENT CONTI ECO CONTACT 6 245 45 20 MM 5 5 5 5 PRESIUNE 2,4  fata spate nm 120	\N	2026-03-26 09:35:17.391052+00	220.00	f	\N	2026-03-26 09:37:52.70105+00	CASH	\N	\N	AS26D	82		0		0	\N	\N
113	2	TM 05 DZE OVIDIU 0734526570 KM145 000	anv client kumho ecowing 185 60 15 mm 8 8 8 8 presiune 2,3 fata spate nm 120	\N	2026-03-26 10:36:38.424014+00	136.00	f	\N	2026-03-26 10:44:47.528266+00	CASH	\N	\N	AS26D	88		0		0	\N	\N
107	2	DJ-01CGS	RIKEN215/60/16 4anv client ( montate)	\N	2026-03-26 09:38:01.22859+00	136.00	f	\N	2026-03-26 09:41:41.691262+00	CARD	\N	\N	AS26D	83		0		0	\N	\N
93	2	DJ 50 ACL JEGA GABRIEL 0770994458 KM 151,700	anv client gripmax winter  285 35 21 325 30 21 anv deformate presiune 2,5 fata spate nm 140	\N	2026-03-26 08:19:46.441482+00	194.00	f	\N	2026-03-26 09:47:55.434269+00	OP	\N	\N	AS26D	71		0		0	\N	\N
108	2	GJ77MTX	\N	\N	2026-03-26 09:48:27.101+00	180.00	f	\N	2026-03-26 09:50:29.711059+00	OP	\N	\N	AS26D	84		0		0	\N	\N
105	2	DJ84BLK	\N	\N	2026-03-26 09:14:40.010777+00	300.00	f	\N	2026-03-26 09:55:41.780738+00	OP	\N	\N		0		0		0	\N	\N
121	2	HIM33	\N	\N	2026-03-26 11:51:07.883706+00	180.00	f	\N	2026-03-26 11:53:33.881801+00	CASH	\N	\N	AS26D	94		0		0	\N	\N
109	2	B 122 XWX MAZDA RADU DOROBANTU 0742044424 KM 25.000	anv client toyo proxes 235 50 20 mm 7 7 7 7 nm 120	\N	2026-03-26 09:58:16.286192+00	120.00	f	\N	2026-03-26 10:01:48.147776+00	CARD	\N	\N	AS26D	85		0		0	\N	\N
116	2	DJ52WLW	\N	\N	2026-03-26 10:58:10.876494+00	250.00	f	\N	2026-03-26 11:01:49.658463+00	CASH	\N	\N	AS26D	89		0		0	\N	\N
120	2	dj20vhv	4 anvelope falken 205 65 16	\N	2026-03-26 11:21:37.538563+00	84.00	f	\N	2026-03-26 12:59:32.628523+00	CARD	\N	\N	AS26D	93		0		0	\N	\N
115	2	DJ 62 BBI MERCEDES 0721830807 KM 85.000	presiune 2,5 fata spate nm 140	\N	2026-03-26 10:50:31.581779+00	3916.00	f	\N	2026-03-26 12:00:24.294226+00	CASH	\N	\N	AS26D	95		0		0	\N	\N
117	2	TESLA B 226 ANK	HANKOOK 255/45/19 6mm (sau montat)\nMICHELIN PA 255/45/19 6mm dot=2523 (custodie 4 anvelope)	\N	2026-03-26 11:12:58.822555+00	374.00	f	\N	2026-03-26 11:13:44.767288+00	CARD	\N	34	AS26D	90		0		0	\N	\N
119	2	dj 90 dnd	montat 4 anv hankook 255 40 19	\N	2026-03-26 11:19:25.384941+00	196.00	f	\N	2026-03-26 11:20:47.219451+00	CARD	\N	35	AS26D	91		0		0	\N	\N
125	2	ab 96 zzu	195 55 16 continental	\N	2026-03-26 12:18:19.704012+00	136.00	f	\N	2026-03-26 12:27:33.056136+00	OP	\N	36	AS26D	100		0		0	\N	\N
124	2	NISSAN DJ 45 DMN 37762 km	MICHELIN A7 235/50/19 6mm dot=2224 (custodie=4anvelope)\nCONTINENTAL ECOCONT. 235/50/19 5mm 2,40 bari (sau montat 4 anvelope)	\N	2026-03-26 12:06:49.030255+00	374.00	f	\N	2026-03-26 12:09:10.856087+00	CASH	\N	\N	AS26D	97		0		0	\N	\N
122	2	MERCEDES B-142-SMS	KUMHO 245/45/18 dot 1725 7mm (CUSTODIE 4ANV)\nMichelin 245/45/18 (4 anv sau montat)	\N	2026-03-26 12:04:38.588256+00	308.00	f	\N	2026-03-26 12:31:24.319308+00	CARD	\N	\N	AS26D	96		0		0	\N	\N
123	2	dj 34 ssm	pe masina sau montat alte anvelope ce nu sunt in carte in caz de atinge eu nu raspund	\N	2026-03-26 12:06:36.117014+00	232.00	f	\N	2026-03-26 12:22:54.794927+00	OP	\N	\N	AS26D	98		0		0	\N	\N
135	2	dj 67 ccr	\N	\N	2026-03-26 13:34:41.531411+00	76.00	f	\N	2026-03-26 13:37:58.387804+00	CASH	\N	\N	AS26D	107		0		0	\N	\N
127	2	OT 77 PPE PORSCHE  DANIEL 0721215491 KM 120.000	anv montate michelin pilot sport 4 suv 265 45 20 295 40 20 mm 5 5 6 6 presiune 2,4 nm 160 \n\ncustodie anv michelin pilot alpin 265 45 20 295 40 20 mm 6 6 5 5  dot 3625	\N	2026-03-26 12:45:03.180237+00	370.00	f	\N	2026-03-26 12:48:12.688615+00	OP	\N	\N	AS26D	101		0		0	\N	\N
129	2	DJ51BLK	\N	\N	2026-03-26 13:00:07.796867+00	180.00	f	\N	2026-03-26 13:03:36.498041+00	CASH	\N	\N		0		0		0	\N	\N
133	2	b 990 yra	\N	\N	2026-03-26 13:12:43.383778+00	568.00	f	\N	2026-03-26 14:06:41.71683+00	CARD	\N	37	AS26D	104		0		0	\N	\N
130	2	TRANSIT B 28 TEH	GOODYEAR 215/65/16C 5-6 mm(sau montat)	\N	2026-03-26 13:00:39.735465+00	192.00	f	\N	2026-03-26 13:04:59.425258+00	OP	\N	27	AS26D	102		0		0	\N	\N
137	2	AUDI Q7 DJ 22 AFA 130500 km	PIRELLI PZERO 285/40/21 5mm 2,60 bari	\N	2026-03-26 14:23:28.114556+00	288.00	f	\N	2026-03-26 14:24:49.589048+00	CARD	\N	\N	AS26D	108		0		0	\N	\N
131	2	DJ15CAF	\N	\N	2026-03-26 13:02:31.835863+00	250.00	f	\N	2026-03-26 13:09:36.073828+00	CARD	\N	\N	AS26D	103		0		0	\N	\N
134	2	B28TEH	\N	\N	2026-03-26 13:14:21.630156+00	120.00	f	\N	2026-03-26 13:16:55.500779+00	OP	\N	\N	AS26D	105		0		0	\N	\N
128	2	is42cre	4 anvepope plus 4 capace plus 4 jante custodie 275 50 20 preli winter dot 2718 mm3	\N	2026-03-26 12:54:00.049044+00	608.00	f	\N	2026-03-26 13:20:59.068516+00	CARD	\N	\N	AS26D	106		0		0	\N	\N
136	2	OT 95 AXP	\N	\N	2026-03-26 14:08:05.725519+00	4136.00	f	\N	2026-03-26 15:21:33.687056+00	CARD	\N	39	AS26D	111		0		0	\N	\N
132	2	dj09cfc	\N	\N	2026-03-26 13:08:47.904142+00	60.00	f	\N	2026-03-26 14:30:13.042159+00	CASH	\N	\N		0		0		0	\N	\N
138	2	DJ 33 SCM MIREA CECIL 0744339615 KM22.000	custodie anv jante capace  conti winter contact 245 45 19 mm 2624 mm 7 7 7 7 \nanv montate bridgestone turanza 245 45 19 mm 5 5 7 7 presiune 2,4 fata   2,7 spate nm 120	\N	2026-03-26 14:40:41.387895+00	304.00	f	\N	2026-03-26 14:42:28.288547+00	CARD	\N	\N	AS26D	109		0		0	\N	\N
139	2	b 20 ttu	au ramas in custodie 4 anvelope 285 40 21 2 bucati si 315 35 21 2 bucati brigestone winter dot 20 23 mm5 si cele de fata ar trebui schimbate	\N	2026-03-26 14:40:51.33254+00	478.00	f	\N	2026-03-26 14:44:23.278026+00	CARD	\N	\N	AS26D	110		0		0	\N	\N
140	2	Dj20MOM	\N	\N	2026-03-26 15:03:44.690495+00	180.00	f	\N	2026-03-26 15:33:01.4381+00	CARD	\N	\N	AS26D	112		0		0	\N	\N
141	2	OT84RCN	\N	\N	2026-03-27 06:35:58.510499+00	200.00	f	\N	2026-03-27 06:37:13.373468+00	CARD	\N	\N	AS26D	113		0		0	\N	\N
114	2	DJ 77 RYG	\N	\N	2026-03-26 10:40:38.332864+00	4480.00	t	2026-03-30 08:12:34.021974+00	2026-03-26 10:41:03.551864+00	NEPLATIT	\N	33		0		0		0	\N	\N
250	2	dj 27 erf	245 45 19 michelin	\N	2026-03-30 09:06:02.38576+00	224.00	f	\N	2026-03-30 09:08:12.427143+00	CARD	\N	\N		0		0		0	\N	\N
142	2	FORD DJ 25 MCM	NOKIAN TYRES WR SNOW 215/55/17 6mm dot=2421 (cust 4anvelope,4 jante aliaj,4 capace centru)\nCONTINENTAL ULTRACONTACT 235/45/18 7mm 2,40 bari( sau montat)	\N	2026-03-27 06:58:05.306163+00	256.00	f	\N	2026-03-27 06:58:42.285671+00	CARD	\N	40	AS26D	114		0		0	\N	\N
143	2	DJ 53 ELF FORD PUMA TUDOR 0765017072  KM 150.000	anv client terminate conti contact 5215 55 17 mm4 4 2 2 nm 120	\N	2026-03-27 07:07:33.633557+00	176.00	f	\N	2026-03-27 07:10:12.826301+00	OP	\N	\N	AS26D	115		0		0	\N	\N
144	2	DJ09RFX	\N	\N	2026-03-27 07:13:45.352257+00	300.00	f	\N	2026-03-27 07:22:53.771563+00	OP	\N	\N	AS26D	116		0		0	\N	\N
145	2	DJ01FLX	\N	\N	2026-03-27 07:20:04.58757+00	300.00	f	\N	2026-03-27 07:23:15.488497+00	OP	\N	\N	AS26D	117		0		0	\N	\N
172	2	b504m	\N	\N	2026-03-27 09:13:19.503992+00	192.00	f	\N	2026-03-27 09:16:46.252949+00	OP	\N	\N	AS26D	134		0		0	\N	\N
146	2	SKODA B 197 FRT	NEXEN 205/55/16 6mm 2,40 bari (sau montat)\nANVELOPELE NU MAI RAMAN IN CUSTODIE	\N	2026-03-27 07:29:49.683128+00	144.00	f	\N	2026-03-27 07:30:53.638068+00	OP	\N	\N	AS26D	118		0		0	\N	\N
181	2	DJ78FAD	\N	\N	2026-03-27 09:53:53.835687+00	250.00	f	\N	2026-03-27 09:59:31.755473+00	CASH	\N	\N	AS26D	141		0		0	\N	\N
149	2	B315HkN	\N	\N	2026-03-27 07:34:39.557045+00	300.00	f	\N	2026-03-27 07:40:39.718364+00	CARD	\N	\N	AS26D	119		0		0	\N	\N
160	2	DJ 91 NDS	\N	\N	2026-03-27 08:14:32.190485+00	4032.00	f	\N	2026-03-27 08:27:43.897744+00	CARD	\N	44	AS26D	127		0		0	\N	\N
147	2	DJ 09 WBC AUDI A4 MARIAN 0724718482 KM 115 000	presiune 2,4  fata spate nm 120	\N	2026-03-27 07:29:50.742579+00	2544.00	f	\N	2026-03-27 07:44:31.749653+00	OP	\N	\N	AS26D	120		0		0	\N	\N
184	2	MERCEDES. DJ 75 SSP 270000 km	IMPERIAL 255/45/20 6mm dot 1625 (custodie 4 anvelope)\n\n\nKUMHO 255/45/20 6mm (sau montat 3 anvelope)\nDAVANTI 255/45/20 6mm (sa montat 1 anvelopa)	\N	2026-03-27 10:25:33.040676+00	374.00	f	\N	2026-03-27 10:26:17.434418+00	CARD	\N	45	AS26D	145		0		0	\N	\N
150	2	dj01zan	\N	\N	2026-03-27 07:44:53.171205+00	192.00	f	\N	2026-03-27 07:47:59.720816+00	CARD	\N	\N	AS26D	121		0		0	\N	\N
162	2	dj 92 wrc	4 anv continental 245 45 19	\N	2026-03-27 08:25:58.137885+00	268.00	f	\N	2026-03-27 08:28:05.929605+00	CARD	\N	\N	AS26D	128		0		0	\N	\N
165	2	DJ 41 CNC	MICHELIN 245/50/18 4anv CLIENT (montate)	\N	2026-03-27 08:31:05.293907+00	358.00	f	\N	2026-03-27 09:21:51.737829+00	CASH	\N	\N	AS26D	135		0		0	\N	\N
151	2	b553atm	4 amvepope custodie goodear winter 215 55 17 dot 23 25 mm 6	\N	2026-03-27 07:49:45.813506+00	316.00	f	\N	2026-03-27 07:55:54.251149+00	OP	\N	\N	AS26D	122		0		0	\N	\N
161	2	DJ04RXT	\N	\N	2026-03-27 08:23:35.783074+00	250.00	f	\N	2026-03-27 08:29:37.5419+00	CARD	\N	\N	AS26D	129		0		0	\N	\N
152	2	DJ13LUP	\N	\N	2026-03-27 07:53:11.102861+00	180.00	f	\N	2026-03-27 07:58:35.113225+00	CASH	\N	\N	AS26D	123		0		0	\N	\N
154	2	SKODA DJ 04 RXT 90000 km	MICHELIN 225/45/17 6mm 2,40 bari ( sau montat)	\N	2026-03-27 07:59:58.031649+00	168.00	f	\N	2026-03-27 08:04:40.144641+00	CASH	\N	\N	AS26D	124		0		0	\N	\N
156	2	DJ25ZMZ	\N	\N	2026-03-27 08:07:32.276946+00	120.00	f	\N	2026-03-27 08:09:30.518461+00	CASH	\N	\N		0		0		0	\N	\N
158	2	DJ36NTA	\N	\N	2026-03-27 08:08:02.410268+00	300.00	f	\N	2026-03-27 08:31:29.010282+00	OP	\N	\N		0		0		0	\N	\N
155	2	ot12 bdi	\N	\N	2026-03-27 08:05:09.182756+00	180.00	f	\N	2026-03-27 08:15:03.101493+00	CASH	\N	\N		0		0		0	\N	\N
166	2	b605rbt	\N	\N	2026-03-27 08:31:11.608533+00	80.00	f	\N	2026-03-27 08:32:25.371256+00	CARD	\N	\N	AS26D	130		0		0	\N	\N
159	2	DJ40ALD	\N	\N	2026-03-27 08:12:36.172284+00	60.00	f	\N	2026-03-27 08:16:38.218135+00	CARD	\N	\N	AS26D	125		0		0	\N	\N
164	2	OT12BDI	\N	\N	2026-03-27 08:30:35.44621+00	120.00	f	\N	2026-03-27 08:34:43.654696+00	CARD	\N	\N		0		0		0	\N	\N
163	2	dj75ani	\N	\N	2026-03-27 08:30:01.029434+00	120.00	f	\N	2026-03-27 08:35:51.154763+00	CASH	\N	\N		0		0		0	\N	\N
148	2	0744790099	\N	\N	2026-03-27 07:33:32.499361+00	180.00	f	\N	2026-03-27 08:36:07.924626+00	CARD	\N	\N		0		0		0	\N	\N
153	2	GL 11 MEI SKODA SUPERB GEORGE 0747259342 km 164.000	anv client riken uhp 215 55 17 mm 7 7 presiune 2,5 fata spate nm 120	\N	2026-03-27 07:53:46.859676+00	1422.00	f	\N	2026-03-27 08:20:19.408135+00	CARD	\N	42	AS26D	126		0		0	\N	\N
182	2	DJ12FHL	\N	\N	2026-03-27 10:02:15.060359+00	180.00	f	\N	2026-03-27 10:05:09.276738+00	OP	\N	\N	AS26D	142		0		0	\N	\N
173	2	B321CFH	\N	\N	2026-03-27 09:22:48.65294+00	250.00	f	\N	2026-03-27 09:28:36.661502+00	CARD	\N	\N	AS26D	136		0		0	\N	\N
174	2	dj 21 wht	255 40 20 michelin	\N	2026-03-27 09:27:44.417711+00	196.00	f	\N	2026-03-27 09:32:22.055823+00	CARD	\N	\N	AS26D	137		0		0	\N	\N
157	2	DJ 18 BZV	\N	\N	2026-03-27 08:07:51.392264+00	1168.00	f	\N	2026-03-27 08:43:54.338416+00	CASH	\N	43	AS26D	131		0		0	\N	\N
168	2	OT01EXX	\N	\N	2026-03-27 08:49:45.664573+00	50.00	f	\N	2026-03-27 08:50:57.518919+00	CASH	\N	\N		0		0		0	\N	\N
175	2	AUDI DJ 27 WSD	sau montat HANKOOK 245/45/18 6mm 2,40 bari\nClientul nu doreste indreptarea jantei de pe dreapta spate	\N	2026-03-27 09:32:50.033815+00	168.00	f	\N	2026-03-27 09:34:41.2056+00	CARD	\N	\N		0		0		0	\N	\N
169	2	b400ssm	4 anvepope riken 207 75 16 c	\N	2026-03-27 09:01:18.577752+00	192.00	f	\N	2026-03-27 09:05:45.902658+00	OP	\N	\N		0		0		0	\N	\N
171	2	DJ16GUI	\N	\N	2026-03-27 09:07:53.661803+00	120.00	f	\N	2026-03-27 09:12:10.938578+00	CARD	\N	\N		0		0		0	\N	\N
167	2	DJ 14 RKP DACIA LOGAN LUNGU LAURENTIU	presiune 2,3 fata spate nm 120	\N	2026-03-27 08:41:38.987607+00	1900.00	f	\N	2026-03-27 09:13:25.334805+00	CASH	\N	\N	AS26D	132		0		0	\N	\N
170	2	dj34ssm	\N	\N	2026-03-27 09:04:04.249266+00	224.00	f	\N	2026-03-27 09:14:16.506981+00	OP	\N	\N	AS26D	133		0		0	\N	\N
176	2	DJ12FHL	\N	\N	2026-03-27 09:33:50.074677+00	132.00	f	\N	2026-03-27 09:37:02.404651+00	OP	\N	\N	AS26D	138		0		0	\N	\N
183	2	dj27lyr	\N	\N	2026-03-27 10:06:31.126404+00	136.00	f	\N	2026-03-27 10:08:51.151796+00	CARD	\N	\N	AS26D	143		0		0	\N	\N
177	2	DJ14RKP	\N	\N	2026-03-27 09:36:56.331332+00	180.00	f	\N	2026-03-27 09:40:32.142896+00	CASH	\N	\N	AS26D	139		0		0	\N	\N
180	2	dj10vxa	\N	\N	2026-03-27 09:52:04.289894+00	180.00	f	\N	2026-03-27 10:11:44.810011+00	CASH	\N	\N		0		0		0	\N	\N
179	2	DJ74LAD	\N	\N	2026-03-27 09:48:35.097553+00	120.00	f	\N	2026-03-27 09:55:44.562237+00	CARD	\N	\N	AS26D	140		0		0	\N	\N
185	2	dj71cxp	\N	\N	2026-03-27 10:30:54.374862+00	300.00	f	\N	2026-03-27 10:32:33.257646+00	CARD	\N	\N		0		0		0	\N	\N
178	2	DJ 44  CAB MERCEDES CATALIN BARBULESCU 0755788935 KM 260.000	anv client kumho ecstra sport 245 40 20  275 35 20 presiune fata spate 2,5 nm 140	\N	2026-03-27 09:41:40.443358+00	556.00	f	\N	2026-03-27 10:20:04.788074+00	CARD	\N	\N	AS26D	144		0		0	\N	\N
188	2	DJ24FDK	\N	\N	2026-03-27 10:49:46.073709+00	120.00	f	\N	2026-03-27 11:08:25.15285+00	OP	\N	\N	AS26D	148		0		0	\N	\N
186	2	DJ 14 BNW MAZDA CX5 dindere 0722557762 km 112.000	custodie anv jante capace  kumho winter izen225 65 17 2212 mm 5 5 5 5 \nanv montate michelin pilot sport 4  225 55 19 mm 6 6 66  presiun e 2,5 fata spate nm 120	\N	2026-03-27 10:41:15.352507+00	280.00	f	\N	2026-03-27 10:43:02.38452+00	CARD	\N	\N	AS26D	146		0		0	\N	\N
187	2	DJ11NSA	\N	\N	2026-03-27 10:47:13.939789+00	250.00	f	\N	2026-03-27 10:50:37.224526+00	CARD	\N	\N	AS26D	147		0		0	\N	\N
189	2	Wolkswagen transporter TM-77-AHC	HANKOOK215/65/16c 4anv client (sau montat)	\N	2026-03-27 11:04:51.792609+00	192.00	f	\N	2026-03-27 11:06:05.241234+00	OP	\N	\N	AS26D	149		0		0	\N	\N
192	2	SKODA DJ 78 CES	KUMHO 205/55/16 6mm (4 anvelope sau montat)	\N	2026-03-27 11:34:38.148325+00	136.00	f	\N	2026-03-27 11:45:16.902169+00	OP	\N	46	AS26D	152		0		0	\N	\N
191	2	DJ61PAU	\N	\N	2026-03-27 11:31:41.526485+00	180.00	f	\N	2026-03-27 11:41:29.159736+00	CARD	\N	\N	AS26D	150		0		0	\N	\N
193	2	DJ23NDL	\N	\N	2026-03-27 11:34:52.590551+00	120.00	f	\N	2026-03-27 11:39:25.299463+00	CASH	\N	\N		0		0		0	\N	\N
194	2	DJ 11 XTX MERCEDES G CLASS 0727789208 CRISTI 37.000	custodie anv jante capace michelin pilot alpin 275 45 21 mm 6 6 6 6 3424\nanv montate pirelli scorpion zero 295 40 22 mm 7 7 5 5 presiune fata spate 2,4 nm 160	\N	2026-03-27 11:35:18.379149+00	600.00	f	\N	2026-03-27 11:40:54.054543+00	OP	\N	\N	AS26D	151		0		0	\N	\N
195	2	OT21SEI	\N	\N	2026-03-27 11:45:19.256145+00	120.00	f	\N	2026-03-27 11:50:24.60451+00	CASH	\N	\N	AS26D	153		0		0	\N	\N
197	2	b888 lvt	\N	\N	2026-03-27 12:01:49.663563+00	216.00	f	\N	2026-03-27 12:07:13.715923+00	CARD	\N	\N	AS26D	155		0		0	\N	\N
190	2	DJ42KTL	\N	\N	2026-03-27 11:17:16.016963+00	300.00	f	\N	2026-03-27 15:37:11.351749+00	CARD	\N	\N		0		0		0	\N	\N
248	2	DJ62BBI	\N	\N	2026-03-30 08:59:59.100451+00	120.00	f	\N	2026-03-30 09:24:08.294049+00	CASH	\N	\N	AS26D	188		0		0	\N	\N
213	2	DJ 26 RDV HZUNDAI TUCSON VLAD HAROSA 0742845055 KM 36.000	custodie anv jante capace  hankook winter icept suv evo 2 215 65 17 dot 4921 mm 6 6 6 6 \nanv montate continental eco contact 6 215 65 17 mm  5 5 5 5 \npresiune 2,5 fata spate nm 120	\N	2026-03-27 15:07:47.324179+00	256.00	f	\N	2026-03-27 15:08:36.159738+00	CARD	\N	\N	AS26D	164		0		0	\N	\N
196	2	BMW DJ 05 ATG	MICHELIN PA ZP 245/45/18 7mm dot 2424 (custodie 4 anvelope,4 jante aliaj,4capace)\nPIRELI P ZERO 275/35/19 3mm (sau montat 2 roti+recomand inlocurea anvelopelor)\nPIRELI 245/40/19 7mm (mont.2 roti)	\N	2026-03-27 11:57:56.933664+00	264.00	f	\N	2026-03-27 12:02:18.387666+00	CARD	\N	47	AS26D	154		0		0	\N	\N
198	2	DJ51GMD	\N	\N	2026-03-27 12:03:50.608317+00	250.00	f	\N	2026-03-27 12:08:42.324185+00	CASH	\N	\N	AS26D	156		0		0	\N	\N
199	2	DJ01LJN	\N	\N	2026-03-27 12:28:38.095101+00	180.00	f	\N	2026-03-27 12:33:11.503748+00	CASH	\N	\N		0		0		0	\N	\N
200	2	VL12HEY	\N	\N	2026-03-27 12:29:35.77261+00	250.00	f	\N	2026-03-27 12:33:43.781855+00	CARD	\N	\N		0		0		0	\N	\N
201	2	DJ 02 CPO  MERCEDES GLS CRISTI 0728122642 km 31.000	anv client conti eco contact 6 285 45 22  325 40 22 mm 8 8 8 8 presiune fata spate 2,2 nm 160	\N	2026-03-27 12:30:13.432897+00	528.00	f	\N	2026-03-27 12:50:12.216599+00	OP	\N	\N	AS26D	157		0		0	\N	\N
214	2	DJ 28 DSD MERCEDES VLAD IONESCU 0726227333KM 232.000	anv client gren max all 225 55 16 mm 4 4 5 5 presiune fata spate 2,4 nm 140 anvelope china deformate se recomanda inlocuirea anvelopelor	\N	2026-03-27 15:16:20.074092+00	76.00	f	\N	2026-03-27 15:20:32.656068+00	CARD	\N	\N		0		0		0	\N	\N
212	2	dj25zwi	\N	\N	2026-03-27 14:54:06.221549+00	300.00	f	\N	2026-03-27 15:33:53.712879+00	CASH	\N	\N		0		0		0	\N	\N
223	2	DJ77RZG	\N	\N	2026-03-30 06:15:42.005321+00	300.00	f	\N	2026-03-30 06:18:36.268422+00	CARD	\N	\N		0		0		0	\N	\N
216	2	DJ 99 CCK RENAULT NASTASIE MARIAN 0726603056 KM 30.000	anv client 215 45 20 goodyear ultra grip  mm 5 5 5 5 presiune fata  2,6  spate 2,5 nm 120	\N	2026-03-30 05:48:35.896567+00	104.00	f	\N	2026-03-30 05:51:18.015248+00	CARD	\N	\N	AS26D	165		0		0	\N	\N
203	2	DJ 70 GRD	\N	\N	2026-03-27 12:52:33.900992+00	936.00	f	\N	2026-03-27 12:58:25.428209+00	OP	\N	48	AS26D	158		0		0	\N	\N
204	2	ot62ssm	\N	\N	2026-03-27 13:02:47.198897+00	288.00	f	\N	2026-03-27 13:03:57.098296+00	OP	\N	\N	AS26D	159		0		0	\N	\N
205	2	DJ77MIN	\N	\N	2026-03-27 13:11:20.194616+00	250.00	f	\N	2026-03-27 13:21:30.457505+00	CARD	\N	\N		0		0		0	\N	\N
202	2	DJ 17 AUU peugeot boghian ioan 0746926858 km 272.000	clientul nu vrea valve presiune 2,2 nm 120	\N	2026-03-27 12:50:14.501946+00	936.00	f	\N	2026-03-27 13:24:37.664791+00	CASH	\N	\N	AS26D	160		0		0	\N	\N
226	2	HYUNDAI DJ 23 KSG	MICHELIN PRIMACY 5225/60/17 7mm 2,4 bari (sau montat)	\N	2026-03-30 06:35:56.39239+00	176.00	f	\N	2026-03-30 06:37:35.353806+00	CASH	\N	\N		0		0		0	\N	\N
207	2	AR69ASD	\N	\N	2026-03-27 13:36:16.760274+00	180.00	f	\N	2026-03-27 13:38:54.367341+00	CASH	\N	\N	AS26D	161		0		0	\N	\N
208	2	DJ33RKM	\N	\N	2026-03-27 14:01:55.997332+00	300.00	f	\N	2026-03-27 14:06:07.042395+00	CARD	\N	\N		0		0		0	\N	\N
224	2	DJ016630 BMW X4 STEFI 0767484341 KM 40/000	anv client conti sport  contact 7 245 45 20 275 40 20 mm 8 8 8 8presiune fata    spate 2,4 nm  140	\N	2026-03-30 06:18:50.332049+00	264.00	f	\N	2026-03-30 06:20:52.000881+00	CASH	\N	\N	AS26D	169		0		0	\N	\N
210	2	GJ07PWT	\N	\N	2026-03-27 14:23:46.986154+00	180.00	f	\N	2026-03-27 14:29:27.218737+00	CASH	\N	\N		0		0		0	\N	\N
206	2	DJ43MHN	\N	\N	2026-03-27 13:18:45.50209+00	250.00	f	\N	2026-03-27 14:36:44.772783+00	CASH	\N	\N		0		0		0	\N	\N
218	2	B200CFH	\N	\N	2026-03-30 05:51:42.58773+00	180.00	f	\N	2026-03-30 06:27:03.563649+00	OP	\N	\N		0		0		0	\N	\N
209	2	OT 11 SRE JETTA TILE 072222222 KM 165.000	\N	\N	2026-03-27 14:14:31.29531+00	682.00	f	\N	2026-03-27 14:46:37.79902+00	CASH	\N	49	AS26D	162		0		0	\N	\N
211	2	DJ 19 THE ford puma MIREA CECIL 0744339615	ANV MONTATE CONTI ECO CONTACT 5 215 50 18 MM 6 6 6 6 PRESIUNE 2,4 FATA SAPTE NM 120  ANVELOPELE DE IARNA SE RIDICA NU RAMAN IN CUSTODIE	\N	2026-03-27 14:43:33.842989+00	176.00	f	\N	2026-03-27 14:49:37.801682+00	CARD	\N	\N	AS26D	163		0		0	\N	\N
225	2	b666bao	4 anvelope hankok winter 235 55 20 m6 dot 34 23	\N	2026-03-30 06:34:27.161551+00	489.00	f	\N	2026-03-30 06:47:56.047718+00	CARD	\N	\N	AS26D	172		0		0	\N	\N
220	2	dj 17 yni	custodie 4 anv falken eurowinter 175 65 17 dot 3125 mm7\nmontat goodiear 175 65 17	\N	2026-03-30 05:58:02.147458+00	308.00	f	\N	2026-03-30 06:02:30.674599+00	CASH	\N	\N	AS26D	167		0		0	\N	\N
215	2	DJ42LOR	\N	\N	2026-03-30 05:45:51.230747+00	864.00	f	\N	2026-03-30 06:02:49.820519+00	CARD	\N	51	AS26D	166		0		0	\N	\N
227	2	B666BAO	\N	\N	2026-03-30 06:44:05.55762+00	300.00	f	\N	2026-03-30 06:52:31.253111+00	CARD	\N	\N	AS26D	173		0		0	\N	\N
222	2	MEGANE DJ 45 RRR	RIKEN UHP 205/50/17 6mm 2,40 (sau montat 4 anvelope)	\N	2026-03-30 06:08:38.462658+00	168.00	f	\N	2026-03-30 06:09:38.993285+00	CARD	\N	\N	AS26D	168		0		0	\N	\N
221	2	DJ10ECW	\N	\N	2026-03-30 06:04:59.452069+00	250.00	f	\N	2026-03-30 06:15:36.410744+00	CARD	\N	52		0		0		0	\N	\N
237	2	DJ23WSP	\N	\N	2026-03-30 07:47:02.130448+00	300.00	f	\N	2026-03-30 07:49:11.352844+00	CASH	\N	\N		0		0		0	\N	\N
217	2	B461CFH	\N	\N	2026-03-30 05:49:28.08892+00	180.00	f	\N	2026-03-30 06:30:22.456182+00	OP	\N	53	AS26D	170		0		0	\N	\N
238	2	DJ 15 ZTU	\N	\N	2026-03-30 07:53:31.115099+00	2012.00	f	\N	2026-03-30 08:10:48.920652+00	CARD	\N	54	AS26D	180		0		0	\N	\N
230	2	VITARA DJ 38 NYS	CONTINENTAL WINTCONT. 215/55/17 7mm dot=2522 (cust.4 anv.,4 jante aliaj)\nCONTINENTAL ECOCONT. 215/55/17 6mm 2,4 bari (sau montat)	\N	2026-03-30 07:03:17.596745+00	256.00	f	\N	2026-03-30 07:04:00.666454+00	CARD	\N	\N	AS26D	175		0		0	\N	\N
233	2	b 108 nll	custodie 4 anv sebring snow 185 65 15 dot 3820 mm5\nmontat michelin 185 65 15	\N	2026-03-30 07:17:40.543895+00	252.00	f	\N	2026-03-30 07:18:31.506497+00	OP	\N	\N	AS26D	177		0		0	\N	\N
229	2	DJ84SOS	\N	\N	2026-03-30 07:00:42.422507+00	300.00	f	\N	2026-03-30 07:09:04.43586+00	CARD	\N	\N	AS26D	176		0		0	\N	\N
219	2	DJ 47 DXM	\N	\N	2026-03-30 05:53:55.470757+00	764.00	f	\N	2026-03-30 06:31:15.003266+00	CASH	\N	50	AS26D	171		0		0	\N	\N
239	2	B 160 SCE	\N	\N	2026-03-30 08:06:54.314879+00	1456.00	f	\N	2026-03-30 08:22:40.768033+00	OP	\N	55	AS26D	181		0		0	\N	\N
236	2	MH07WVW	\N	\N	2026-03-30 07:46:25.245929+00	300.00	f	\N	2026-03-30 07:51:56.739431+00	CASH	\N	\N	AS26D	179		0		0	\N	\N
228	2	DJ168	\N	\N	2026-03-30 06:55:39.358697+00	7100.00	f	\N	2026-03-30 07:32:34.226516+00	OP	\N	\N	AS26D	174		0		0	\N	\N
235	2	VL70SCL	\N	\N	2026-03-30 07:29:53.114763+00	250.00	f	\N	2026-03-30 07:34:17.148333+00	CASH	\N	\N	AS26D	178		0		0	\N	\N
234	2	DJ 15 ZTU	\N	\N	2026-03-30 07:24:36.548697+00	1840.00	t	2026-03-30 08:12:43.553109+00	\N	NEPLATIT	\N	54		0		0		0	\N	\N
242	2	dj01geo	\N	\N	2026-03-30 08:34:53.448238+00	450.00	t	2026-03-30 09:52:52.125115+00	2026-03-30 08:35:16.015691+00	NEPLATIT	\N	\N	AS26D	184		0		0	\N	\N
240	2	DJ89SXA	\N	\N	2026-03-30 08:22:30.184774+00	180.00	f	\N	2026-03-30 08:28:34.814545+00	CASH	\N	\N	AS26D	182		0		0	\N	\N
247	2	DJ20PEA	\N	\N	2026-03-30 08:59:01.851212+00	250.00	f	\N	2026-03-30 10:02:32.449468+00	CASH	\N	\N	AS26D	187		0		0	\N	\N
245	2	DJ15ZTU	\N	\N	2026-03-30 08:40:01.698039+00	180.00	f	\N	2026-03-30 08:42:58.887321+00	CARD	\N	\N		0		0		0	\N	\N
243	2	OT55ELE	\N	\N	2026-03-30 08:35:35.73455+00	180.00	f	\N	2026-03-30 08:41:55.00878+00	CARD	\N	\N		0		0		0	\N	\N
244	2	DJ19AOW	\N	\N	2026-03-30 08:37:06.6186+00	180.00	f	\N	2026-03-30 08:42:01.535146+00	CASH	\N	\N		0		0		0	\N	\N
246	2	BMW X6 DJ 31 WBW	MICHELIN LAT.ALPIN 255/50/19 6mm dot=3625 (cus.4 anve.,4 jante aliaj,4 capace)\n\nMICHELIN LAT.SPORT 315/35/20 5mm 2,4 bari\nMICHELIN LAT.SPORT 275/40/20 5mm 2,4 bari (sau montat)	\N	2026-03-30 08:53:41.448617+00	320.00	f	\N	2026-03-30 08:55:12.59659+00	CASH	\N	\N	AS26D	185		0		0	\N	\N
241	2	dj65ank	\N	\N	2026-03-30 08:29:09.500235+00	500.00	t	2026-03-30 09:52:49.686144+00	2026-03-30 08:29:20.524029+00	NEPLATIT	\N	56	AS26D	183		0		0	\N	\N
231	2	TUBOMET BMW G 30 GEORGE	anv client spate 275 35 19 bridgestone turanza mm 5 5  presiune fata spate 2,7 nm 140	\N	2026-03-30 07:13:46.538975+00	2072.00	f	\N	2026-03-30 09:46:55.408041+00	OP	\N	\N	AS26D	194		0		0	\N	\N
302	2	DJ30RAN	\N	\N	2026-03-31 07:24:07.317874+00	100.00	f	\N	2026-03-31 07:25:17.477932+00	CASH	\N	73	ASC-D	220		0		0	\N	2
265	2	SPRINTER DJ 05 GRS	CONTINENTAL 235/65/16C 5mm (sau montat)	\N	2026-03-30 11:02:11.877094+00	108.00	f	\N	2026-03-30 11:02:58.246082+00	OP	\N	\N	AS26D	200		0		0	\N	\N
283	2	dj 26 dvs	debica 195 65 15	\N	2026-03-30 13:07:48.740072+00	98.00	f	\N	2026-03-30 13:09:29.057885+00	CASH	\N	\N		0		0		0	\N	\N
266	2	DJ17RXB	\N	\N	2026-03-30 11:03:43.970818+00	180.00	f	\N	2026-03-30 11:06:56.591726+00	CARD	\N	\N		0		0		0	\N	\N
264	2	B717 RTT	anv custodie pirelli scorpion 285 40 22 315 35 22dot 3424   3124 mm 6 6 6 6 \nanv montate conti contact 7 285 40 22 315 35 22 mm 3 3 6 6 presiune fata spate  2,4 nm 160	\N	2026-03-30 10:58:16.008033+00	508.00	f	\N	2026-03-30 11:07:55.268188+00	OP	\N	\N	AS26D	201		0		0	\N	\N
267	2	DJ05RSB	\N	\N	2026-03-30 11:13:03.599575+00	148.00	f	\N	2026-03-30 11:14:41.341113+00	OP	\N	\N		0		0		0	\N	\N
268	2	DJ 12 GOA	\N	\N	2026-03-30 11:14:45.365387+00	1100.00	t	2026-03-30 11:15:45.629614+00	\N	NEPLATIT	\N	\N		0		0		0	\N	\N
254	2	TOYOTA CHR DJ 47 DBR	MICHELIN PRIMACY 3 225/50/18 5mm 2,5bari (sau montat)	\N	2026-03-30 09:40:17.420595+00	176.00	f	\N	2026-03-30 09:41:21.697303+00	OP	\N	60	AS26D	192		0		0	\N	\N
249	2	TUBOMET BMW S7 GEORGE	anv client 245 50 18 mm 7 7 7 7 goodyear eagle presiune fata spate 2,4 nm 140	\N	2026-03-30 09:00:55.015035+00	233.00	f	\N	2026-03-30 09:42:13.975512+00	OP	\N	\N	AS26D	189		0		0	\N	\N
232	2	TUBOMET BMW X3 GEORGE	presiune 2,5 fata spate nm 140	\N	2026-03-30 07:14:23.066648+00	3496.00	f	\N	2026-03-30 09:43:38.151498+00	OP	\N	\N	AS26D	193		0		0	\N	\N
269	2	BORA VL 08 DJB	michelin 195/65/15 5mm 2,3 bari	\N	2026-03-30 11:18:05.932753+00	76.00	f	\N	2026-03-30 11:21:21.14911+00	CARD	\N	\N		0		0		0	\N	\N
256	2	b 124 ept	custodie 4 anv 185 65 15 gislaved dot 2722 mm 6\nmontat 185 65 15 continental	\N	2026-03-30 09:49:13.243189+00	252.00	f	\N	2026-03-30 09:49:53.760191+00	OP	\N	\N	AS26D	196		0		0	\N	\N
253	2	DJ69XRK DORINEL	PASSAT B9	NEAGRA	2026-03-30 09:33:08.578843+00	180.00	t	2026-03-30 09:50:32.260616+00	2026-03-30 09:35:50.170622+00	NEPLATIT	\N	59	AS26D	191		0		0	\N	\N
257	2	tr75mai	\N	\N	2026-03-30 09:50:43.503001+00	180.00	f	\N	2026-03-30 10:00:25.568275+00	CASH	\N	\N		0		0		0	\N	\N
270	2	b 211 sik	goodiear 235 45 18	\N	2026-03-30 11:31:50.900064+00	176.00	f	\N	2026-03-30 11:32:20.557202+00	CARD	\N	\N		0		0		0	\N	\N
258	2	MH03GYL	\N	\N	2026-03-30 10:04:16.263029+00	250.00	f	\N	2026-03-30 10:08:44.190408+00	CARD	\N	62	AS26D	197		0		0	\N	\N
279	2	DJ17JCV	\N	\N	2026-03-30 12:35:46.124934+00	250.00	f	\N	2026-03-30 12:40:10.538721+00	CARD	\N	\N		0		0		0	\N	\N
259	2	DJ61DAA	\N	\N	2026-03-30 10:10:40.262855+00	180.00	f	\N	2026-03-30 10:14:57.010349+00	CASH	\N	\N	AS26D	198		0		0	\N	\N
271	2	DJ11MRE	\N	\N	2026-03-30 12:03:11.233181+00	180.00	f	\N	2026-03-30 12:06:24.193746+00	CASH	\N	\N	AS26D	202		0		0	\N	\N
261	2	LEXUS B 805 AUM	MICHELI PS4 235/50/21 5mm 2,5 bari (sau montat)	\N	2026-03-30 10:33:25.151119+00	328.00	f	\N	2026-03-30 10:37:29.594325+00	CASH	\N	63	AS26D	199		0		0	\N	\N
260	2	dj82abt	\N	\N	2026-03-30 10:31:53.163891+00	250.00	f	\N	2026-03-30 10:41:52.410194+00	CASH	\N	\N		0		0		0	\N	\N
262	2	DJ52MPM	\N	\N	2026-03-30 10:41:01.589516+00	180.00	f	\N	2026-03-30 10:44:19.978166+00	CASH	\N	\N		0		0		0	\N	\N
263	2	dj 17 rxb	205 50 17 dunlop	\N	2026-03-30 10:43:19.031747+00	168.00	f	\N	2026-03-30 10:44:56.196304+00	CARD	\N	\N		0		0		0	\N	\N
293	2	dj 26 sss	255 45 20 kumho	\N	2026-03-31 06:13:00.006656+00	120.00	f	\N	2026-03-31 06:14:18.018397+00	CASH	\N	\N	ASC-D	211		0		0	\N	2
273	2	RENAULT DJ 44 BIO	FIRESTONE 205/65/16C 8mm 4 bari	\N	2026-03-30 12:09:23.106155+00	216.00	f	\N	2026-03-30 12:10:40.235976+00	CASH	\N	\N		0		0		0	\N	\N
285	2	DJ44BIO	\N	\N	2026-03-30 13:23:03.665971+00	250.00	f	\N	2026-03-30 13:25:57.366763+00	CASH	\N	\N		0		0		0	\N	\N
255	2	DJ75LIT	GGGGGGG	HHHHH	2026-03-30 09:48:58.061158+00	150.00	t	2026-03-30 12:17:21.819191+00	2026-03-30 09:49:03.592434+00	NEPLATIT	\N	61	AS26D	195		0		0	\N	\N
252	2	DJ77LIT	\N	\N	2026-03-30 09:28:42.283972+00	120.00	t	2026-03-30 12:17:25.351796+00	2026-03-30 09:28:49.486485+00	NEPLATIT	\N	58	AS26D	190		0		0	\N	\N
280	2	DJ 06 YUL	custodie anv jante capace hankook winter icept evo 3 225 50 18 mm7 7 7 7 dot 2123 \nanv montate michelin primacy3 225 50 18 mm 6 6 6 6 presiune 2,3 fata spate  nm 120	\N	2026-03-30 12:41:33.922698+00	256.00	f	\N	2026-03-30 12:44:36.785487+00	CARD	\N	67	AS26D	206		0		0	\N	\N
251	2	VL25HSN	PASSAT B6	\N	2026-03-30 09:21:19.514009+00	120.00	f	\N	2026-03-30 12:17:57.54814+00	CARD	\N	57	AS26D	186		0		0	\N	\N
275	2	GJ02RDL	\N	\N	2026-03-30 12:18:05.005438+00	180.00	f	\N	2026-03-30 12:21:05.532239+00	CASH	\N	\N		0		0		0	\N	\N
274	2	B204CFH	\N	\N	2026-03-30 12:17:33.035331+00	180.00	f	\N	2026-03-30 12:21:46.504768+00	OP	\N	\N		0		0		0	\N	\N
277	2	DJ 23 AGN	\N	\N	2026-03-30 12:22:44.817543+00	168.00	f	\N	2026-03-30 13:29:43.019533+00	CASH	\N	\N	AS26D	205		0		0	\N	\N
287	2	DB 12 PAX KONPAX	\N	\N	2026-03-31 05:35:39.025334+00	9520.00	f	\N	2026-03-31 06:06:55.764063+00	OP	\N	\N	ASC-D	210		0		0	\N	2
272	2	DJ 23 RSU	\N	\N	2026-03-30 12:07:23.334758+00	1212.00	f	\N	2026-03-30 12:48:24.401702+00	CARD	\N	65	AS26D	203		0		0	\N	\N
281	2	DJ23RSU	\N	\N	2026-03-30 12:56:52.369517+00	250.00	f	\N	2026-03-30 12:58:46.968293+00	CARD	\N	\N		0		0		0	\N	\N
278	2	DJ 23 AGN	\N	\N	2026-03-30 12:31:05.785151+00	168.00	t	2026-03-30 13:30:11.911078+00	2026-03-30 13:29:48.283988+00	CASH	\N	\N	AS26D	207		0		0	\N	\N
282	2	MERCEDES DJ 20 MJD	CONTINENTAL WINTCONT. 225/45/18 5 mm dot 3621 (custodie 2 anvelope)\n\nCONTINENTAL 225/45/18 5mm 2,5 bari (sau montat 4 anvelope)	\N	2026-03-30 13:06:15.105883+00	238.00	f	\N	2026-03-30 13:08:47.719165+00	CARD	\N	\N	AS26D	208		0		0	\N	\N
276	2	DJ77LIT	MARCA AUTO :\nPASSAT B6 \n250.000 KM	OBSERVATII \nRECOMANDARE GEOMETRIE	2026-03-30 12:22:33.694414+00	1200.00	t	2026-03-31 05:54:25.862191+00	2026-03-30 12:23:19.121648+00	NEPLATIT	\N	61	AS26D	204		0		0	\N	\N
292	2	DJ83DMC	\N	\N	2026-03-31 06:12:28.66627+00	180.00	f	\N	2026-03-31 06:58:35.262509+00	OP	\N	\N		0		0		0	\N	2
290	2	DJ77LIT	\N	\N	2026-03-31 06:08:29.070755+00	1000.00	t	2026-03-31 08:05:05.575348+00	\N	NEPLATIT	\N	13		0		0		0	\N	2
297	2	DJ75MTH	anv client michelin agilis 235 65 16 mm7 7 5 5 presiune 4.2 fata spate nm 180	jante axa spate ovalizate  si anvelope axa spate dot vechi 2018	2026-03-31 06:41:26.764001+00	216.00	f	\N	2026-03-31 06:43:03.508027+00	OP	\N	71	ASC-D	215		0		0	\N	2
294	2	DJ77LIT	\N	\N	2026-03-31 06:13:27.235213+00	60.00	t	2026-03-31 06:26:03.417297+00	\N	NEPLATIT	\N	61		0		0		0	\N	2
295	2	DJ14YMI  TIMSORT	\N	\N	2026-03-31 06:19:15.738718+00	1810.00	f	\N	2026-03-31 06:52:15.179708+00	OP	\N	70	ASC-D	212		0		0	\N	2
288	2	DJ36NIT	\N	\N	2026-03-31 05:55:12.354802+00	300.00	f	\N	2026-03-31 06:21:55.790733+00	OP	\N	\N		0		0		0	\N	2
296	2	vl61RUS	\N	\N	2026-03-31 06:21:39.164267+00	120.00	f	\N	2026-03-31 06:23:23.025401+00	CASH	\N	\N		0		0		0	\N	2
289	2	DJ08YUD	anv client michelin  primacy4  185 65 15 mm 5 5 5 5 presiune 2,2 fata spate nm 110	\N	2026-03-31 05:56:48.777288+00	76.00	f	\N	2026-03-31 06:42:32.020482+00	OP	\N	69	ASC-D	214		0		0	\N	2
298	2	TOAREG DJ 26 SFC 150000 km	MICHELIN PA5 235/65/17 6mm dot 2921 (cust.4 anv.,4 jante aliaj,4 cap.centru)\n\nMICHELIN PS5 255/55/18 6mm 2,5 bari (sau montat)	\N	2026-03-31 06:41:53.59536+00	256.00	f	\N	2026-03-31 06:44:51.781743+00	CASH	\N	\N	ASC-D	216		0		0	\N	2
286	2	DJ 83 DMC DOMARCONS	\N	\N	2026-03-31 05:22:27.348234+00	1240.00	f	\N	2026-03-31 06:58:48.924656+00	OP	\N	\N		0		0		0	\N	2
299	2	dj 01 vna	custodie 4 anv 4 jante aliaj 4 capace micheli lat alp 235 65 17 dot 2516 mm5\nmontat michelin pil sport 235 60 18	\N	2026-03-31 07:00:42.448807+00	256.00	f	\N	2026-03-31 07:01:28.966358+00	CASH	\N	\N	ASC-D	217		0		0	\N	2
304	2	dj 69 bam	235 50 18 kumho	\N	2026-03-31 07:37:06.01329+00	112.00	f	\N	2026-03-31 08:19:15.855033+00	CASH	\N	\N	ASC-D	228		0		0	\N	2
300	2	BH69AVP	\N	\N	2026-03-31 07:14:12.284168+00	180.00	f	\N	2026-03-31 07:17:15.23332+00	CARD	\N	\N	ASC-D	218		0		0	\N	2
301	2	DJ69FBY	\N	\N	2026-03-31 07:16:49.882569+00	300.00	f	\N	2026-03-31 07:20:28.281876+00	CASH	\N	\N	ASC-D	219		0		0	\N	2
303	2	LOGAN B 209 EPT	HANKOOK WINTER ICEPT 185/65/15 6mm dot 2921 (cust.4 anvelope)\n\nCONTINENTAL 185/65/15 4mm 2,3 bari (sau montat)	\N	2026-03-31 07:35:25.624069+00	252.00	f	\N	2026-03-31 07:36:16.69635+00	OP	\N	\N	ASC-D	221		0		0	\N	2
306	2	DJ46SAV	\N	\N	2026-03-31 07:58:34.594895+00	120.00	f	\N	2026-03-31 08:04:33.12717+00	CARD	\N	\N	ASC-D	222		0		0	\N	2
284	2	DJ15LIT	passar b6	oay ewgybdh sahj17   cfaqwerqwfe wq	2026-03-30 13:10:05.934778+00	500.00	t	2026-03-31 08:05:03.057519+00	2026-03-31 05:58:08.056235+00	NEPLATIT	\N	13	AS26D	209		0		0	\N	\N
307	2	DJ77LIT	D	SD	2026-03-31 08:04:43.520759+00	60.00	t	2026-03-31 08:05:08.868174+00	\N	NEPLATIT	\N	2		0		0		0	\N	2
342	2	DJ08NYD	\N	\N	2026-03-31 13:40:47.484002+00	180.00	f	\N	2026-03-31 13:44:30.242598+00	CASH	\N	\N		0		0		0	\N	2
321	2	dj 90 pmr	custodie 4 anv 225 65 17 bridgestone blizak dot 2723 mm5\nmontat michelin 225 65 17	\N	2026-03-31 10:13:40.66424+00	348.00	f	\N	2026-03-31 10:24:59.628572+00	CASH	\N	86	ASC-D	236		0		0	\N	2
317	2	LEXUS DJ 07 MPH	DUNLOP SPORT MAX 245/40/19 2buc 275/40/19 2buc sau (echilibrat)	\N	2026-03-31 09:04:34.064201+00	127.00	f	\N	2026-03-31 09:05:43.532687+00	OP	\N	\N	ASC-D	232		0		0	\N	2
314	2	DJ71LIT	\N	\N	2026-03-31 08:50:36.304278+00	475.00	t	2026-03-31 14:36:07.731175+00	2026-03-31 10:42:21.070501+00	NEPLATIT	\N	\N	ASC-D	237		0		0	\N	2
308	2	CADDY CJ 45 SPI	DOUBLE 195/65/15 5mm 2,5 bari (sau montat)	\N	2026-03-31 08:07:58.102703+00	132.00	f	\N	2026-03-31 08:08:55.847302+00	CASH	\N	76	ASC-D	223		0		0	\N	2
305	2	DJ 17 ZCC skoda	\N	\N	2026-03-31 07:38:44.07017+00	588.00	f	\N	2026-03-31 08:10:27.447714+00	CARD	\N	74	ASC-D	224		0		0	\N	2
326	2	db 23 sdl	hankook 195.55.16	\N	2026-03-31 11:34:04.116059+00	144.00	f	\N	2026-03-31 11:35:07.312802+00	CARD	\N	89	ASC-D	241		0		0	\N	2
310	2	ot 11 wvw	custodie 4 anv 4jante aliaj 4 capace mich alp 7 235 60 18 dot 2725 mm 7\nmontat iokohama 235 60 18	\N	2026-03-31 08:12:40.710251+00	236.00	f	\N	2026-03-31 08:13:50.914606+00	CARD	\N	\N	ASC-D	225		0		0	\N	2
331	2	DJ28BUV	custodie anv jante capace  michelin pilot alpin 5 suv 285 45 20 mm 6 6 6 6 dot 3822 \nanv montate pirelli scorpion verde 285 45 20 mm 5 5 4 4 presiune 2,5 fata spate nm 140	\N	2026-03-31 12:29:40.291851+00	304.00	f	\N	2026-03-31 12:31:41.919205+00	CASH	\N	93	ASC-D	244		0		0	\N	2
318	2	DJ93LUZ	anv client michelin primacy5 225 45 17 mm 7 7 7 7 presiune fata  spate 2,3 nm 120	\N	2026-03-31 09:36:04.478153+00	96.00	f	\N	2026-03-31 09:46:50.546845+00	CASH	\N	83	ASC-D	233		0		0	\N	2
309	2	OT37GBI	\N	\N	2026-03-31 08:10:53.682702+00	180.00	f	\N	2026-03-31 08:17:34.055444+00	CASH	\N	\N	ASC-D	227		0		0	\N	2
311	2	DJ12GOA	anv client riken cargo        195 75 16 c presiune fata spate  4,5 nm 180	jante ruginite la etansare si plan de prindere  se recomanda inlocuirea jantelor 6 buc	2026-03-31 08:15:36.225447+00	188.00	f	\N	2026-03-31 08:19:43.703046+00	CASH	\N	77	ASC-D	226		0		0	\N	2
312	2	DJ52FLN	\N	\N	2026-03-31 08:17:26.441157+00	180.00	f	\N	2026-03-31 08:23:07.922488+00	CASH	\N	\N	ASC-D	229		0		0	\N	2
315	2	DJ05KOK	\N	\N	2026-03-31 08:53:25.307308+00	180.00	t	2026-03-31 10:53:20.554684+00	2026-03-31 08:53:31.797406+00	NEPLATIT	\N	79	ASC-D	231		0		0	\N	2
316	2	DJ05POY	\N	\N	2026-03-31 08:55:17.376077+00	25.00	t	2026-03-31 10:53:24.450304+00	\N	NEPLATIT	\N	80		0		0		0	\N	2
313	2	dj 75 bra	michelin 225 45 18\nkumho 205 55 16	\N	2026-03-31 08:30:34.857106+00	172.00	f	\N	2026-03-31 08:32:48.287907+00	CASH	\N	\N	ASC-D	230		0		0	\N	2
319	2	DJ77CER	anv client conti premium contact 6 275 35 22 315 30 22 presiune fata spate 2,4 nm 150  anvelope uzate	\N	2026-03-31 09:46:09.550828+00	100.00	f	\N	2026-03-31 09:48:02.580191+00	CARD	\N	84	ASC-D	234		0		0	\N	2
322	2	SKODA DJ 01 CVI	GOODYEAR 235/40/19 5mm 2,80bari (sau montat 4 anvelope)	\N	2026-03-31 10:54:14.438052+00	196.00	f	\N	2026-03-31 10:55:01.540931+00	CARD	\N	\N		0		0		0	\N	2
320	2	DJ 36 ELC	RIKEN 155/65/14 6mm 2,2 bari	\N	2026-03-31 09:56:12.835509+00	116.00	f	\N	2026-03-31 09:58:18.507094+00	OP	\N	85	ASC-D	235		0		0	\N	2
328	2	PORSHE B 888 RPD	PIRELLI PZERO 315/35/21 5mm 2,60 bari\nPIRELLI PZERO 285/40/21 5mm 2,40 bari  (sau montat 4 anvelope )	\N	2026-03-31 12:01:08.009501+00	288.00	f	\N	2026-03-31 12:02:52.783124+00	CARD	\N	90	ASC-D	243		0		0	\N	2
323	2	DJ 35 XSX	\N	\N	2026-03-31 10:54:32.522691+00	532.00	f	\N	2026-03-31 11:01:55.067251+00	CARD	\N	87	ASC-D	238		0		0	\N	2
330	2	DJ07PPS	\N	\N	2026-03-31 12:15:07.864998+00	180.00	f	\N	2026-03-31 12:19:48.816465+00	CARD	\N	\N		0		0		0	\N	2
325	2	gj 38 mrg	custodie 4 anv mich agilis alpin 235 65 16c dot 2624 mm6\nmontat mich agilis3 235 65 16c	\N	2026-03-31 11:11:57.538498+00	312.00	f	\N	2026-03-31 11:20:29.427755+00	OP	\N	88	ASC-D	239		0		0	\N	2
324	2	B666EFI	anvelope montate michelin pilot sport 4 suv 285 45 21 305 40 21 mm 7 7 7 7 \nanvelope custodie michelin pilot alpin  285 45 21 305 40 21 mm 7 7 7 7 dot 3525	\N	2026-03-31 11:01:42.846789+00	678.00	f	\N	2026-03-31 11:20:43.368001+00	OP	\N	88	ASC-D	240		0		0	\N	2
291	2	DJ77LIT	1	2	2026-03-31 06:11:02.82904+00	260.00	t	2026-03-31 14:36:13.709711+00	2026-03-31 08:38:07.851013+00	NEPLATIT	\N	75	ASC-D	213		0		0	\N	2
336	2	OT07LHE	\N	\N	2026-03-31 12:58:27.688765+00	180.00	f	\N	2026-03-31 13:02:39.525158+00	CASH	\N	\N	ASC-D	249		0		0	\N	2
333	2	DJ09TGC	\N	\N	2026-03-31 12:37:48.548787+00	1176.00	f	\N	2026-03-31 12:45:46.461139+00	OP	\N	\N	ASC-D	246		0		0	\N	2
339	2	DJ29CLT	\N	\N	2026-03-31 13:19:17.184529+00	136.00	f	\N	2026-03-31 13:23:52.060801+00	CASH	\N	\N	ASC-D	251		0		0	\N	2
343	2	RENAULT DJ 18 WVI	GOODYEAR 215/60/17 3-4mm 2,40 bari (sau montat 4 anvelope)	\N	2026-03-31 13:48:14.600031+00	256.00	f	\N	2026-03-31 13:49:28.943447+00	CARD	\N	\N		0		0		0	\N	2
335	2	DJ38DER	\N	\N	2026-03-31 12:44:13.356993+00	120.00	f	\N	2026-03-31 12:49:34.240269+00	CASH	\N	\N	ASC-D	248		0		0	\N	2
340	2	dj 85 khi	245 40 20 pirelli	\N	2026-03-31 13:21:35.731312+00	196.00	f	\N	2026-03-31 13:23:55.365345+00	CASH	\N	96	ASC-D	252		0		0	\N	2
338	2	OT10WDZ	\N	\N	2026-03-31 13:14:09.972786+00	168.00	f	\N	2026-03-31 13:16:16.583153+00	CARD	\N	95	ASC-D	250		0		0	\N	2
341	2	OT 11 SBE	\N	\N	2026-03-31 13:35:00.839384+00	680.00	f	\N	2026-03-31 13:56:07.795272+00	CASH	\N	\N	ASC-D	254		0		0	\N	2
337	2	DJ77VNS	\N	\N	2026-03-31 12:59:11.697154+00	3141.00	f	\N	2026-03-31 14:38:57.283817+00	CASH	\N	97	ASC-D	255		0		0	\N	2
334	2	DJ97KON	BRIDGESTONE blizak 235/60/18 3-4mm dot 3520 (cust. 4 anv.,4 jante aliaj)	\N	2026-03-31 12:41:54.044754+00	3944.00	f	\N	2026-03-31 14:35:22.467484+00	NEPLATIT	\N	94	ASC-D	247		0		0	\N	2
329	2	OT 33 LYL	\N	\N	2026-03-31 12:05:53.044579+00	1280.00	f	\N	2026-03-31 13:41:08.842271+00	CARD	\N	91	ASC-D	253		0		0	\N	2
327	2	DJ50WXX	custodie 3 anvelope\n2buc 315 30 22 dot 2022 mm5 pirelli pzero\n1buc 275 35 22 dot 1622mm5 pirelli pzero	\N	2026-03-31 11:40:50.93257+00	8679.00	f	\N	2026-03-31 14:35:59.278731+00	CASH	\N	92	ASC-D	242		0		0	\N	2
332	2	DJ77VNS	\N	\N	2026-03-31 12:29:57.503779+00	2860.00	t	2026-03-31 14:36:55.150122+00	2026-03-31 12:38:00.508639+00	NEPLATIT	\N	\N	ASC-D	245		0		0	\N	2
344	2	DJ17PUC	\N	\N	2026-03-31 14:06:47.007755+00	192.00	f	\N	2026-03-31 14:07:46.044873+00	CASH	\N	98		0		0		0	\N	2
\.


--
-- Data for Name: registers; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.registers (id, account_id, name, deviz_serie, deviz_numar, factura_serie, factura_numar, chitanta_serie, chitanta_numar, aviz_serie, aviz_numar, created_at, updated_at, is_deleted, deleted_at, company_id) FROM stdin;
1	2	Registru 2026	ASC-D	255	ASC-F	0	ASC-C	0	ASC-A	0	2026-03-23 21:19:34.163908+00	2026-03-31 06:02:22.000353+00	f	\N	2
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.accounts_id_seq', 2, true);


--
-- Name: anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.anvelope_id_seq', 13, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.categories_id_seq', 15, true);


--
-- Name: cazare_anvelope_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.cazare_anvelope_items_id_seq', 33, true);


--
-- Name: cazari_anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.cazari_anvelope_id_seq', 4, true);


--
-- Name: clienti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.clienti_id_seq', 98, true);


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.companies_id_seq', 2, true);


--
-- Name: devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.devices_id_seq', 22, true);


--
-- Name: dimensiuni_anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.dimensiuni_anvelope_id_seq', 3, true);


--
-- Name: disclaimers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.disclaimers_id_seq', 1, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.employees_id_seq', 29, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.items_id_seq', 109, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.locations_id_seq', 2, true);


--
-- Name: locuri_cazare_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.locuri_cazare_id_seq', 1, true);


--
-- Name: marci_anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.marci_anvelope_id_seq', 3, true);


--
-- Name: programari_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.programari_id_seq', 2, true);


--
-- Name: receipt_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.receipt_items_id_seq', 875, true);


--
-- Name: receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.receipts_id_seq', 344, true);


--
-- Name: registers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.registers_id_seq', 1, true);


--
-- Name: themes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.themes_id_seq', 4, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: accounts pk_accounts; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT pk_accounts PRIMARY KEY (id);


--
-- Name: anvelope pk_anvelope; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT pk_anvelope PRIMARY KEY (id);


--
-- Name: categories pk_categories; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT pk_categories PRIMARY KEY (id);


--
-- Name: cazare_anvelope_items pk_cazare_anvelope_items; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazare_anvelope_items
    ADD CONSTRAINT pk_cazare_anvelope_items PRIMARY KEY (id);


--
-- Name: cazari_anvelope pk_cazari_anvelope; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT pk_cazari_anvelope PRIMARY KEY (id);


--
-- Name: clienti pk_clienti; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.clienti
    ADD CONSTRAINT pk_clienti PRIMARY KEY (id);


--
-- Name: companies pk_companies; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT pk_companies PRIMARY KEY (id);


--
-- Name: devices pk_devices; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT pk_devices PRIMARY KEY (id);


--
-- Name: dimensiuni_anvelope pk_dimensiuni_anvelope; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.dimensiuni_anvelope
    ADD CONSTRAINT pk_dimensiuni_anvelope PRIMARY KEY (id);


--
-- Name: disclaimers pk_disclaimers; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.disclaimers
    ADD CONSTRAINT pk_disclaimers PRIMARY KEY (id);


--
-- Name: employee_locations pk_employee_locations; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT pk_employee_locations PRIMARY KEY (employee_id, location_id);


--
-- Name: employees pk_employees; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT pk_employees PRIMARY KEY (id);


--
-- Name: items pk_items; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT pk_items PRIMARY KEY (id);


--
-- Name: location_departments pk_location_themes; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.location_departments
    ADD CONSTRAINT pk_location_themes PRIMARY KEY (location_id, department_id);


--
-- Name: locations pk_locations; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT pk_locations PRIMARY KEY (id);


--
-- Name: locuri_cazare pk_locuri_cazare; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locuri_cazare
    ADD CONSTRAINT pk_locuri_cazare PRIMARY KEY (id);


--
-- Name: marci_anvelope pk_marci_anvelope; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.marci_anvelope
    ADD CONSTRAINT pk_marci_anvelope PRIMARY KEY (id);


--
-- Name: receipt_items pk_receipt_items; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT pk_receipt_items PRIMARY KEY (id);


--
-- Name: receipts pk_receipts; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT pk_receipts PRIMARY KEY (id);


--
-- Name: registers pk_registers; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.registers
    ADD CONSTRAINT pk_registers PRIMARY KEY (id);


--
-- Name: departments pk_themes; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT pk_themes PRIMARY KEY (id);


--
-- Name: programari programari_pkey; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari
    ADD CONSTRAINT programari_pkey PRIMARY KEY (id);


--
-- Name: accounts uq_accounts_username; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT uq_accounts_username UNIQUE (username);


--
-- Name: departments uq_themes_name; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_themes_name UNIQUE (name);


--
-- Name: ix_accounts_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_accounts_is_deleted_id ON public.accounts USING btree (is_deleted, id);


--
-- Name: ix_accounts_username; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE UNIQUE INDEX ix_accounts_username ON public.accounts USING btree (username);


--
-- Name: ix_anvelope_account_id_client_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_anvelope_account_id_client_id ON public.anvelope USING btree (account_id, client_id);


--
-- Name: ix_anvelope_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_anvelope_account_id_is_deleted_id ON public.anvelope USING btree (account_id, is_deleted, id);


--
-- Name: ix_categories_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_categories_account_id_is_deleted_id ON public.categories USING btree (account_id, is_deleted, id);


--
-- Name: ix_categories_department_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_categories_department_id_is_deleted_id ON public.categories USING btree (department_id, is_deleted, id);


--
-- Name: ix_cazare_anvelope_items_cazare_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_cazare_anvelope_items_cazare_id ON public.cazare_anvelope_items USING btree (cazare_id);


--
-- Name: ix_cazari_anvelope_account_id_data_checkin; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_cazari_anvelope_account_id_data_checkin ON public.cazari_anvelope USING btree (account_id, data_checkin);


--
-- Name: ix_cazari_anvelope_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_cazari_anvelope_account_id_is_deleted_id ON public.cazari_anvelope USING btree (account_id, is_deleted, id);


--
-- Name: ix_clienti_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_clienti_account_id_is_deleted_id ON public.clienti USING btree (account_id, is_deleted, id);


--
-- Name: ix_companies_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_companies_account_id_is_deleted_id ON public.companies USING btree (account_id, is_deleted, id);


--
-- Name: ix_departments_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_departments_account_id_is_deleted_id ON public.departments USING btree (account_id, is_deleted, id);


--
-- Name: ix_departments_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_departments_is_deleted_id ON public.departments USING btree (is_deleted, id);


--
-- Name: ix_devices_account_id_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_devices_account_id_id ON public.devices USING btree (account_id, id);


--
-- Name: ix_devices_location_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_devices_location_id ON public.devices USING btree (location_id);


--
-- Name: ix_dimensiuni_anvelope_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_dimensiuni_anvelope_account_id_is_deleted_id ON public.dimensiuni_anvelope USING btree (account_id, is_deleted, id);


--
-- Name: ix_disclaimers_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_disclaimers_account_id_is_deleted_id ON public.disclaimers USING btree (account_id, is_deleted, id);


--
-- Name: ix_employees_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_employees_account_id_is_deleted_id ON public.employees USING btree (account_id, is_deleted, id);


--
-- Name: ix_items_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_items_account_id_is_deleted_id ON public.items USING btree (account_id, is_deleted, id);


--
-- Name: ix_items_category_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_items_category_id_is_deleted_id ON public.items USING btree (category_id, is_deleted, id);


--
-- Name: ix_items_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_items_is_deleted_id ON public.items USING btree (is_deleted, id);


--
-- Name: ix_items_type_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_items_type_is_deleted_id ON public.items USING btree (type, is_deleted, id);


--
-- Name: ix_location_themes_theme_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_location_themes_theme_id ON public.location_departments USING btree (department_id);


--
-- Name: ix_locations_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_locations_account_id_is_deleted_id ON public.locations USING btree (account_id, is_deleted, id);


--
-- Name: ix_locuri_cazare_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_locuri_cazare_account_id_is_deleted_id ON public.locuri_cazare USING btree (account_id, is_deleted, id);


--
-- Name: ix_marci_anvelope_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_marci_anvelope_account_id_is_deleted_id ON public.marci_anvelope USING btree (account_id, is_deleted, id);


--
-- Name: ix_programari_account_id_start_time; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_programari_account_id_start_time ON public.programari USING btree (account_id, start_time);


--
-- Name: ix_programari_location_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_programari_location_id ON public.programari USING btree (location_id);


--
-- Name: ix_receipt_items_account_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_receipt_items_account_id ON public.receipt_items USING btree (account_id);


--
-- Name: ix_receipts_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_receipts_account_id_is_deleted_id ON public.receipts USING btree (account_id, is_deleted, id);


--
-- Name: ix_registers_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_registers_account_id_is_deleted_id ON public.registers USING btree (account_id, is_deleted, id);


--
-- Name: anvelope fk_anvelope_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT fk_anvelope_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: anvelope fk_anvelope_client_id_clienti; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT fk_anvelope_client_id_clienti FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE SET NULL;


--
-- Name: anvelope fk_anvelope_dimensiune_id_dimensiuni_anvelope; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT fk_anvelope_dimensiune_id_dimensiuni_anvelope FOREIGN KEY (dimensiune_id) REFERENCES public.dimensiuni_anvelope(id) ON DELETE SET NULL;


--
-- Name: anvelope fk_anvelope_marca_id_marci_anvelope; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT fk_anvelope_marca_id_marci_anvelope FOREIGN KEY (marca_id) REFERENCES public.marci_anvelope(id) ON DELETE SET NULL;


--
-- Name: categories fk_categories_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT fk_categories_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: categories fk_categories_theme_id_themes; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT fk_categories_theme_id_themes FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: cazare_anvelope_items fk_cazare_anvelope_items_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazare_anvelope_items
    ADD CONSTRAINT fk_cazare_anvelope_items_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: cazare_anvelope_items fk_cazare_anvelope_items_anvelopa_id_anvelope; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazare_anvelope_items
    ADD CONSTRAINT fk_cazare_anvelope_items_anvelopa_id_anvelope FOREIGN KEY (anvelopa_id) REFERENCES public.anvelope(id) ON DELETE SET NULL;


--
-- Name: cazare_anvelope_items fk_cazare_anvelope_items_cazare_id_cazari_anvelope; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazare_anvelope_items
    ADD CONSTRAINT fk_cazare_anvelope_items_cazare_id_cazari_anvelope FOREIGN KEY (cazare_id) REFERENCES public.cazari_anvelope(id) ON DELETE CASCADE;


--
-- Name: cazari_anvelope fk_cazari_anvelope_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT fk_cazari_anvelope_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: cazari_anvelope fk_cazari_anvelope_client_id_clienti; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT fk_cazari_anvelope_client_id_clienti FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE SET NULL;


--
-- Name: cazari_anvelope fk_cazari_anvelope_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT fk_cazari_anvelope_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cazari_anvelope fk_cazari_anvelope_loc_cazare_id_locuri_cazare; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT fk_cazari_anvelope_loc_cazare_id_locuri_cazare FOREIGN KEY (loc_cazare_id) REFERENCES public.locuri_cazare(id) ON DELETE SET NULL;


--
-- Name: cazari_anvelope fk_cazari_anvelope_referinta_cazare_id_cazari_anvelope; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.cazari_anvelope
    ADD CONSTRAINT fk_cazari_anvelope_referinta_cazare_id_cazari_anvelope FOREIGN KEY (referinta_cazare_id) REFERENCES public.cazari_anvelope(id) ON DELETE SET NULL;


--
-- Name: clienti fk_clienti_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.clienti
    ADD CONSTRAINT fk_clienti_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: companies fk_companies_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT fk_companies_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: devices fk_devices_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: devices fk_devices_location_id_locations; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_devices_location_id_locations FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: dimensiuni_anvelope fk_dimensiuni_anvelope_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.dimensiuni_anvelope
    ADD CONSTRAINT fk_dimensiuni_anvelope_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: disclaimers fk_disclaimers_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.disclaimers
    ADD CONSTRAINT fk_disclaimers_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: employee_locations fk_employee_locations_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT fk_employee_locations_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_locations fk_employee_locations_location_id_locations; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employee_locations
    ADD CONSTRAINT fk_employee_locations_location_id_locations FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: employees fk_employees_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: items fk_items_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT fk_items_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: items fk_items_category_id_categories; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT fk_items_category_id_categories FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: location_departments fk_location_themes_location_id_locations; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.location_departments
    ADD CONSTRAINT fk_location_themes_location_id_locations FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: location_departments fk_location_themes_theme_id_themes; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.location_departments
    ADD CONSTRAINT fk_location_themes_theme_id_themes FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: locations fk_locations_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: locations fk_locations_company_id_companies; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_company_id_companies FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: locations fk_locations_disclaimer_id_disclaimers; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_disclaimer_id_disclaimers FOREIGN KEY (disclaimer_id) REFERENCES public.disclaimers(id) ON DELETE SET NULL;


--
-- Name: locations fk_locations_register_id_registers; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_register_id_registers FOREIGN KEY (register_id) REFERENCES public.registers(id) ON DELETE SET NULL;


--
-- Name: locuri_cazare fk_locuri_cazare_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.locuri_cazare
    ADD CONSTRAINT fk_locuri_cazare_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: marci_anvelope fk_marci_anvelope_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.marci_anvelope
    ADD CONSTRAINT fk_marci_anvelope_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: receipt_items fk_receipt_items_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT fk_receipt_items_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: receipt_items fk_receipt_items_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT fk_receipt_items_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: receipt_items fk_receipt_items_receipt_id_receipts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT fk_receipt_items_receipt_id_receipts FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE;


--
-- Name: receipts fk_receipts_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: receipts fk_receipts_client_id_clienti; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_client_id_clienti FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE SET NULL;


--
-- Name: registers fk_registers_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.registers
    ADD CONSTRAINT fk_registers_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: registers fk_registers_company_id_companies; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.registers
    ADD CONSTRAINT fk_registers_company_id_companies FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: departments fk_themes_account_id_accounts; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_themes_account_id_accounts FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: programari programari_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari
    ADD CONSTRAINT programari_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: programari programari_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari
    ADD CONSTRAINT programari_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE SET NULL;


--
-- Name: programari programari_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari
    ADD CONSTRAINT programari_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: programari programari_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.programari
    ADD CONSTRAINT programari_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: receipts receipts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_programare_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_programare_id_fkey FOREIGN KEY (programare_id) REFERENCES public.programari(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict vJLne0EPk0jeSJYjcWcbAcflQbxJELq91y46MYC2cVss5XigTCoz122xvzELY2O

