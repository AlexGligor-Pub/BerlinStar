--
-- PostgreSQL database dump
--

\restrict ciQBokvjA6MIiVasPhYLWUbKx61M0EIhZRaqapko1zJMaQtAAtNFAwJQmJguMJl

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
    deleted_at timestamp with time zone,
    profil_id integer
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
    montate_pe_masina boolean DEFAULT false NOT NULL,
    numar_masina character varying(50)
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
-- Name: client_vehicole; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.client_vehicole (
    id integer NOT NULL,
    account_id integer NOT NULL,
    client_id integer NOT NULL,
    numar_masina character varying(50) NOT NULL,
    marca character varying(100),
    model character varying(100),
    numar_kilometrii integer,
    vin character varying(17),
    observatii text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.client_vehicole OWNER TO berlinstar;

--
-- Name: client_vehicole_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.client_vehicole_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_vehicole_id_seq OWNER TO berlinstar;

--
-- Name: client_vehicole_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.client_vehicole_id_seq OWNED BY public.client_vehicole.id;


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
-- Name: general_settings; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.general_settings (
    id integer NOT NULL,
    account_id integer NOT NULL,
    use_factura boolean DEFAULT true NOT NULL,
    use_aviz boolean DEFAULT true NOT NULL,
    afiseaza_tehnician_deviz boolean DEFAULT false NOT NULL
);


ALTER TABLE public.general_settings OWNER TO berlinstar;

--
-- Name: general_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.general_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.general_settings_id_seq OWNER TO berlinstar;

--
-- Name: general_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.general_settings_id_seq OWNED BY public.general_settings.id;


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
-- Name: profiluri_anvelope; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.profiluri_anvelope (
    id integer NOT NULL,
    account_id integer NOT NULL,
    valoare character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.profiluri_anvelope OWNER TO berlinstar;

--
-- Name: profiluri_anvelope_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.profiluri_anvelope_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profiluri_anvelope_id_seq OWNER TO berlinstar;

--
-- Name: profiluri_anvelope_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.profiluri_anvelope_id_seq OWNED BY public.profiluri_anvelope.id;


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
-- Name: vehicole; Type: TABLE; Schema: public; Owner: berlinstar
--

CREATE TABLE public.vehicole (
    id integer NOT NULL,
    account_id integer NOT NULL,
    receipt_id integer NOT NULL,
    numar_masina character varying(50) NOT NULL,
    marca character varying(100),
    model character varying(100),
    numar_kilometrii integer,
    vin character varying(17),
    observatii text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.vehicole OWNER TO berlinstar;

--
-- Name: vehicole_id_seq; Type: SEQUENCE; Schema: public; Owner: berlinstar
--

CREATE SEQUENCE public.vehicole_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicole_id_seq OWNER TO berlinstar;

--
-- Name: vehicole_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: berlinstar
--

ALTER SEQUENCE public.vehicole_id_seq OWNED BY public.vehicole.id;


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
-- Name: client_vehicole id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.client_vehicole ALTER COLUMN id SET DEFAULT nextval('public.client_vehicole_id_seq'::regclass);


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
-- Name: general_settings id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.general_settings ALTER COLUMN id SET DEFAULT nextval('public.general_settings_id_seq'::regclass);


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
-- Name: profiluri_anvelope id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.profiluri_anvelope ALTER COLUMN id SET DEFAULT nextval('public.profiluri_anvelope_id_seq'::regclass);


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
-- Name: vehicole id; Type: DEFAULT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.vehicole ALTER COLUMN id SET DEFAULT nextval('public.vehicole_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.accounts (id, name, description, created_at, updated_at, is_deleted, username, password, email, image_url, is_locked, locked_at) FROM stdin;
1	Alex Gligor	\N	2026-03-23 21:03:19.334094+00	\N	f	alexgligor	QURBU1Rvb2xzMQ==	\N	\N	t	2026-03-23 21:03:19.33146+00
2	ASCET COM	\N	2026-03-23 21:14:15.801191+00	\N	f	ascetcom	NTE1NDMxMA==	ascetcom@yahoo.com	\N	f	\N
3	Ban	\N	2026-04-04 17:19:04.030518+00	\N	f	Iosif	YmFuYmFu	baniosif@test.com	\N	t	2026-04-04 17:19:04.02966+00
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.alembic_version (version_num) FROM stdin;
b3c4d5e6f7a8
a2b3c4d5e6f7
\.


--
-- Data for Name: anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.anvelope (id, account_id, client_id, marca_id, dimensiune_id, tip, adancime, comments, created_at, updated_at, is_deleted, deleted_at, profil_id) FROM stdin;
1	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.247222+00	\N	f	\N	\N
2	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.394893+00	\N	f	\N	\N
3	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.510014+00	\N	f	\N	\N
4	2	1	1	1	vara	6	\N	2026-03-24 00:47:50.625685+00	\N	f	\N	\N
5	2	1	1	1	vara	4	\N	2026-03-24 00:50:02.658092+00	\N	f	\N	\N
6	2	1	1	1	vara	4	\N	2026-03-24 00:50:02.910036+00	\N	f	\N	\N
7	2	1	1	1	vara	4	\N	2026-03-24 00:50:03.023672+00	\N	f	\N	\N
8	2	1	1	1	vara	4	\N	2026-03-24 00:50:03.135964+00	\N	f	\N	\N
9	2	1	1	1	vara	1	\N	2026-03-24 10:52:13.30981+00	\N	f	\N	\N
10	2	3	2	2	vara	6	\N	2026-03-24 12:46:04.991755+00	\N	f	\N	\N
11	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.117326+00	\N	f	\N	\N
12	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.240404+00	\N	f	\N	\N
13	2	3	2	2	vara	6	\N	2026-03-24 12:46:05.362653+00	\N	f	\N	\N
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

COPY public.cazari_anvelope (id, account_id, client_id, employee_id, loc_cazare_id, data_checkin, data_checkout, comments, created_at, updated_at, is_deleted, deleted_at, dep_anvelope, dep_capace, dep_roti_complete, dep_antifurturi, dep_prezoane, referinta_cazare_id, montate_pe_masina, numar_masina) FROM stdin;
1	2	1	2	1	2026-03-24	\N	\N	2026-03-24 00:47:50.750953+00	2026-03-24 00:49:32.732255+00	f	\N	t	f	f	f	f	\N	f	\N
2	2	1	28	1	2026-03-24	\N	\N	2026-03-24 00:50:03.257682+00	\N	t	2026-03-24 00:51:40.205582+00	t	f	f	f	f	\N	f	\N
3	2	1	21	1	2026-03-24	\N	\N	2026-03-24 10:52:13.500569+00	\N	f	\N	t	f	f	f	f	\N	f	\N
4	2	3	21	1	2026-03-24	2026-03-25	4ANV +4J +4 CAPAC	2026-03-24 12:46:05.492937+00	2026-03-25 09:18:47.189115+00	f	\N	t	f	f	f	f	\N	f	\N
\.


--
-- Data for Name: client_vehicole; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.client_vehicole (id, account_id, client_id, numar_masina, marca, model, numar_kilometrii, vin, observatii, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	354	TM11ETY	Citroen	C4	\N	\N	\N	2026-04-07 22:26:44.853536+00	\N	f	\N
2	2	355	DJ90ALE	vw	golf	\N	\N	\N	2026-04-08 05:49:39.383469+00	\N	f	\N
3	2	357	DJ99MAY	reno	\N	\N	\N	\N	2026-04-08 05:51:39.285335+00	\N	f	\N
4	2	356	IS06PHA	skoda	fabia	\N	\N	\N	2026-04-08 05:53:24.178661+00	\N	f	\N
5	2	358	DJ19DMN	BMW	\N	\N	\N	\N	2026-04-08 06:13:42.514814+00	\N	f	\N
6	2	359	OT70AME	TOYOTA 	CHR 	\N	\N	\N	2026-04-08 06:24:58.091964+00	\N	f	\N
7	2	361	B126CPX	geely	\N	\N	\N	\N	2026-04-08 06:27:04.216662+00	\N	f	\N
8	2	362	DJ26DRL	Bmw	\N	\N	\N	\N	2026-04-08 06:30:17.08602+00	\N	f	\N
9	2	363	CJ62THT	TOYOTA	\N	\N	\N	\N	2026-04-08 06:41:06.127834+00	\N	f	\N
10	2	365	DJ43YVS	TOYOTA 	yaris	\N	\N	\N	2026-04-08 06:59:59.076275+00	\N	f	\N
11	2	364	DJ08WRR	VW	\N	\N	\N	\N	2026-04-08 07:10:04.343256+00	\N	f	\N
12	2	366	DJ01DVR	\N	volvo	\N	\N	\N	2026-04-08 07:16:16.647457+00	\N	f	\N
13	2	368	DJ16UHL	NISSAN	\N	\N	\N	\N	2026-04-08 07:32:03.258033+00	\N	f	\N
14	2	369	DJ41MLS	vw	golf	\N	\N	\N	2026-04-08 07:34:34.271989+00	\N	f	\N
15	2	370	DJ14ARG	VW 	\N	\N	\N	\N	2026-04-08 07:44:30.87121+00	\N	f	\N
16	2	371	DJ96GNZ	\N	mercedes gle	\N	\N	\N	2026-04-08 07:46:13.06484+00	\N	f	\N
17	2	75	DJ77LIT	VW	PASSAT 	\N	ADS A	\N	2026-04-08 07:47:38.0386+00	\N	f	\N
18	2	372	DJ17MRV	MERCEDES	\N	\N	\N	\N	2026-04-08 08:21:20.123627+00	\N	f	\N
19	2	374	DJ66DMC	dacia	logan	\N	\N	\N	2026-04-08 08:31:57.103463+00	\N	f	\N
20	2	376	DJ22BOZCEREALCOM	jeep	\N	\N	\N	\N	2026-04-08 08:42:39.32085+00	\N	f	\N
21	2	377	ECKKM4	bmw	\N	\N	\N	\N	2026-04-08 08:56:39.004492+00	\N	f	\N
22	2	378	DJ03AIB	BMW	\N	\N	\N	\N	2026-04-08 08:57:31.530984+00	\N	f	\N
23	2	379	DJ07SPW	vw	golf	\N	\N	\N	2026-04-08 09:06:18.787324+00	\N	f	\N
24	2	380	DJ87TCD	hiundai 	\N	\N	\N	\N	2026-04-08 09:08:41.567767+00	\N	f	\N
25	2	381	DJ92TBN	ford	puma	\N	\N	\N	2026-04-08 09:12:31.202601+00	\N	f	\N
26	2	383	DJ03AXH	TOYOTA	\N	\N	\N	\N	2026-04-08 09:27:44.111452+00	\N	f	\N
27	2	384	DJ50XPT	land rover	evog	\N	\N	\N	2026-04-08 09:35:29.526846+00	\N	f	\N
28	2	385	B102DLV	ford	transit couries	\N	\N	\N	2026-04-08 09:53:46.120743+00	\N	f	\N
29	2	386	DJ17FIY	porsche	\N	\N	\N	\N	2026-04-08 10:00:00.488659+00	\N	f	\N
30	2	387	DJ03VXX	bmw	\N	\N	\N	\N	2026-04-08 10:16:28.294581+00	\N	f	\N
31	2	388	DJ19DYS	bmw	x3	\N	\N	\N	2026-04-08 10:34:50.83309+00	\N	f	\N
32	2	389	DJ14GCM	BMW	X1	\N	\N	\N	2026-04-08 10:39:19.929355+00	\N	f	\N
33	2	390	DJ66FRT	toyota	\N	\N	\N	\N	2026-04-08 11:10:38.389466+00	\N	f	\N
34	2	392	DJ27RAC	\N	mercedes	\N	\N	\N	2026-04-08 11:11:20.134775+00	\N	f	\N
35	2	393	B100VXS	FORD	\N	\N	\N	\N	2026-04-08 11:16:14.75897+00	\N	f	\N
36	2	394	DJ52DRV	\N	mercedes	\N	\N	\N	2026-04-08 11:22:05.579209+00	\N	f	\N
37	2	396	DJ18JYE	peugeot	\N	\N	\N	\N	2026-04-08 11:40:27.556664+00	\N	f	\N
38	2	397	OT26PPE	mercedes	\N	\N	\N	\N	2026-04-08 11:48:56.520538+00	\N	f	\N
39	2	398	OT06FOC	mercedes	\N	\N	\N	\N	2026-04-08 11:59:53.757998+00	\N	f	\N
40	2	400	DJ03MAP	FIAT	\N	\N	\N	\N	2026-04-08 12:17:40.387947+00	\N	f	\N
41	2	395	DJ56DEY	BMW	S3	\N	\N	\N	2026-04-08 12:20:40.475848+00	\N	f	\N
42	2	402	DJ38RXA	\N	bmw	\N	\N	\N	2026-04-08 12:41:19.174011+00	\N	f	\N
43	2	403	DJ92NOI	FORD 	eco sport 	\N	\N	\N	2026-04-08 12:57:07.987532+00	\N	f	\N
44	2	404	DJ24PAB	RENOULT	KANGOO	\N	\N	\N	2026-04-08 13:02:07.831296+00	\N	f	\N
45	2	407	DJ07YMG	peugeot	\N	\N	\N	\N	2026-04-08 13:33:33.799412+00	\N	f	\N
46	2	408	DJ01CEC	RENOULT	\N	\N	\N	\N	2026-04-08 13:35:49.947908+00	\N	f	\N
47	2	406	DJ14GWJ	BMW	X5	\N	\N	\N	2026-04-08 13:35:58.8435+00	\N	f	\N
48	2	409	DJ78DRC	lexus	nx	\N	\N	\N	2026-04-08 13:52:41.299754+00	\N	f	\N
49	2	411	DJ43COM	vw	pasat	\N	\N	\N	2026-04-08 14:09:39.674871+00	\N	f	\N
50	2	412	B 958 ALM 	audi	\N	\N	\N	\N	2026-04-09 05:38:05.679749+00	\N	f	\N
51	2	414	DJ12BEC	AUDI	A6	\N	\N	\N	2026-04-09 05:44:31.7928+00	\N	f	\N
52	2	415	DJ25ASK	AUDI	\N	\N	\N	\N	2026-04-09 05:45:35.042395+00	\N	f	\N
53	2	417	DJ60ALE	audii	\N	\N	\N	\N	2026-04-09 05:49:09.326826+00	\N	f	\N
54	2	418	DJ26PTX	mazda	\N	\N	\N	\N	2026-04-09 05:50:48.019544+00	\N	f	\N
55	2	416	DJ10KMR	vw	\N	\N	\N	\N	2026-04-09 06:06:39.392084+00	\N	f	\N
56	2	420	SB76KON	DACIA	DUSTER	\N	\N	\N	2026-04-09 06:14:02.712676+00	\N	f	\N
57	2	422	TM59AHC	\N	w pasat	\N	\N	\N	2026-04-09 06:18:56.605148+00	\N	f	\N
58	2	423	DJ18ABY	YAMAHA	\N	\N	\N	\N	2026-04-09 06:22:36.923688+00	\N	f	\N
59	2	421	DJ82FRT	toyota	\N	\N	\N	\N	2026-04-09 06:33:36.66733+00	\N	f	\N
60	2	425	DJ99BAS	bmw	\N	\N	\N	\N	2026-04-09 06:42:23.536368+00	\N	f	\N
61	2	428	DJ98ARG	reno	\N	\N	\N	\N	2026-04-09 06:56:27.639133+00	\N	f	\N
62	2	426	DJ25DME	mustamg	\N	\N	\N	\N	2026-04-09 07:02:43.379688+00	\N	f	\N
63	2	431	DJ24EDS	AUDI 	A3	\N	\N	\N	2026-04-09 07:14:06.3428+00	\N	f	\N
64	2	433	DJ08ROW	vw	caddy	\N	\N	\N	2026-04-09 07:21:19.652165+00	\N	f	\N
65	2	432	VL28KOA	nissan	\N	\N	\N	\N	2026-04-09 07:28:26.215068+00	\N	f	\N
66	2	434	DJ81MLS	GOLF	\N	\N	\N	\N	2026-04-09 07:35:12.979662+00	\N	f	\N
67	2	436	DJ20AWD	audii	\N	\N	\N	\N	2026-04-09 07:43:28.669907+00	\N	f	\N
68	2	437	DJ02CVS	TOYOTA 	CHR  	\N	\N	\N	2026-04-09 07:48:48.7792+00	\N	f	\N
69	2	438	B53CPR	ford 	\N	\N	\N	\N	2026-04-09 07:56:55.703592+00	\N	f	\N
70	2	442	DJ18SNE	ford	\N	\N	\N	\N	2026-04-09 08:11:45.303728+00	\N	f	\N
71	2	443	DJ22SFV	AUDI	Q5	\N	\N	\N	2026-04-09 08:15:35.808528+00	\N	f	\N
72	2	439	DJ16FNA	\N	\N	\N	\N	\N	2026-04-09 08:20:40.138536+00	\N	f	\N
73	2	444	DJ24SCI	vw	passat	\N	\N	\N	2026-04-09 08:24:47.970821+00	\N	f	\N
74	2	447	DJ36WLW	toyota 	\N	\N	\N	\N	2026-04-09 08:40:51.228044+00	\N	f	\N
75	2	450	DJ04DFT	AUDI 	A8	\N	\N	\N	2026-04-09 08:43:46.037268+00	\N	f	\N
76	2	451	GJ92TRM	bmw	\N	\N	\N	\N	2026-04-09 08:44:26.814113+00	\N	f	\N
77	2	24	DJ1LLL	BMW 	1	\N	\N	\N	2026-04-09 08:58:10.93944+00	\N	f	\N
78	2	454	DJ69ACR	MERCEDES	\N	\N	\N	\N	2026-04-09 09:06:19.677849+00	\N	f	\N
79	2	456	B809MST	BMW 	\N	\N	\N	\N	2026-04-09 09:18:49.179557+00	\N	f	\N
80	2	458	DJ34CNC	mercedes	\N	\N	\N	\N	2026-04-09 09:21:49.559935+00	\N	f	\N
81	2	459	DJ08DOX	volvo	\N	\N	\N	\N	2026-04-09 09:23:38.94461+00	\N	f	\N
82	2	464	DJ17DWH	kia rio 	\N	\N	\N	\N	2026-04-09 09:52:18.594996+00	\N	f	\N
83	2	463	OT96DRB	bmw 	\N	\N	\N	\N	2026-04-09 09:52:37.936711+00	\N	f	\N
84	2	465	DJ21MCY	TOYOTA	\N	\N	\N	\N	2026-04-09 09:53:44.790291+00	\N	f	\N
85	2	466	DJ77AVL	VW 	passat	\N	\N	\N	2026-04-09 09:59:48.444165+00	\N	f	\N
86	2	470	B228WGT	skoda	scala	\N	\N	\N	2026-04-09 10:23:02.848597+00	\N	f	\N
87	2	471	DJ92LFB	\N	bmw	\N	\N	\N	2026-04-09 10:26:25.407246+00	\N	f	\N
88	2	472	DJ89MKE	AUDI	A4 	\N	\N	\N	2026-04-09 10:31:53.039689+00	\N	f	\N
89	2	468	DJ93FRT	toyota	\N	\N	\N	\N	2026-04-09 10:37:46.014058+00	\N	f	\N
90	2	461	DJ96AFC	polo	\N	\N	\N	\N	2026-04-09 10:39:16.015102+00	\N	f	\N
91	2	476	DJ96ROT	sandero	\N	\N	\N	\N	2026-04-09 10:55:55.983135+00	\N	f	\N
92	2	477	DJ08GFL	hyundai	tucson	\N	\N	\N	2026-04-09 11:04:36.639268+00	\N	f	\N
93	2	478	DJ72NYS	FORD	\N	\N	\N	\N	2026-04-09 11:16:57.743057+00	\N	f	\N
94	2	475	DJ74MAN	bmw	\N	\N	\N	\N	2026-04-09 11:19:30.926338+00	\N	f	\N
95	2	480	DJ79SAG	hiundai 	\N	\N	\N	\N	2026-04-09 11:20:25.757451+00	\N	f	\N
96	2	479	B189PPE	SKODA 	KAROQ	\N	\N	\N	2026-04-09 11:21:33.466577+00	\N	f	\N
97	2	482	DJ01KEL	BMW	\N	\N	\N	\N	2026-04-09 11:49:26.541703+00	\N	f	\N
98	2	474	DJ70SYF	HYUNDAI	TUCSON 	\N	\N	\N	2026-04-09 12:05:22.113927+00	\N	f	\N
99	2	484	B272YUS	mazda	cx80	\N	\N	\N	2026-04-09 12:07:56.353306+00	\N	f	\N
100	2	485	DJ30DDR	bmw	\N	\N	\N	\N	2026-04-09 12:09:27.953244+00	\N	f	\N
101	2	487	OT17LVK	ford	\N	\N	\N	\N	2026-04-09 12:21:18.651301+00	\N	f	\N
102	2	488	B972MEN	MAZDA	\N	\N	\N	\N	2026-04-09 12:30:30.574421+00	\N	f	\N
103	2	489	CJ27WTC	ford	kuga	\N	\N	\N	2026-04-09 12:35:58.088453+00	\N	f	\N
104	2	491	DJ02DEV	FORD 	MONDEO	\N	\N	\N	2026-04-09 12:38:49.150414+00	\N	f	\N
105	2	493	DJ33AKI	reno	\N	\N	\N	\N	2026-04-09 12:46:21.957677+00	\N	f	\N
106	2	495	DJ59RAF	mercedes	\N	\N	\N	\N	2026-04-09 13:09:45.58288+00	\N	f	\N
107	2	497	DJ17WSD	bmw	\N	\N	\N	\N	2026-04-09 13:11:38.293118+00	\N	f	\N
108	2	498	DJ17VWM	AUDI	Q5	\N	\N	\N	2026-04-09 13:17:47.344229+00	\N	f	\N
109	2	486	DJ30TOB	tigoan	\N	\N	\N	\N	2026-04-09 13:23:49.201796+00	\N	f	\N
110	2	500	B71RMA	PEUGEOT 	2008	\N	\N	\N	2026-04-09 13:26:07.120452+00	\N	f	\N
111	2	499	OT61AVS	sckoda	\N	\N	\N	\N	2026-04-09 13:30:24.3168+00	\N	f	\N
112	2	502	DJ28BYM	MERCEDES	\N	\N	\N	\N	2026-04-09 13:58:51.61922+00	\N	f	\N
113	2	504	DJ13XEN	vw	PASSAT	\N	\N	\N	2026-04-09 14:03:09.788909+00	\N	f	\N
114	2	506	DJ13MBT	TOYOTA	COROLLA	\N	\N	\N	2026-04-14 07:06:48.959488+00	\N	f	\N
115	2	507	DJ07UAU	mercedes	\N	\N	\N	\N	2026-04-14 07:15:42.198709+00	\N	f	\N
116	2	509	DJ22JUS	dacia	sandero	\N	\N	\N	2026-04-14 07:52:00.805344+00	\N	f	\N
117	2	510	DJ19ABS	bmw	\N	\N	\N	\N	2026-04-14 07:59:36.883101+00	\N	f	\N
118	2	511	DJ92BTY	TOYOTA	YARIS	\N	16000	\N	2026-04-14 08:00:54.154737+00	\N	f	\N
119	2	512	DJ23MDG	audii	\N	\N	\N	\N	2026-04-14 08:05:43.960906+00	\N	f	\N
120	2	514	DJ70AXG	hyundai	\N	\N	\N	\N	2026-04-14 08:33:40.333878+00	\N	f	\N
121	2	515	DJ27GMG	HYUNDAI 	TUCSON 	\N	\N	\N	2026-04-14 08:40:21.213349+00	\N	f	\N
122	2	516	DJ60XBX	mercedes	\N	\N	\N	\N	2026-04-14 08:40:43.452641+00	\N	f	\N
123	2	508	OT50WOU	mercedes	\N	\N	\N	\N	2026-04-14 08:58:13.573919+00	\N	f	\N
124	2	517	DJ81RNY	nissan	\N	\N	\N	\N	2026-04-14 09:03:21.844656+00	\N	f	\N
125	2	518	B283MTH	bmw	\N	\N	\N	\N	2026-04-14 09:27:48.694896+00	\N	f	\N
126	2	519	DJ03CSS	bmw	\N	\N	\N	\N	2026-04-14 09:38:36.300835+00	\N	f	\N
127	2	520	DJ96FLX	LEXUS	RX	\N	\N	\N	2026-04-14 09:41:35.35147+00	\N	f	\N
128	2	521	DJ97MSA	kia	\N	\N	\N	\N	2026-04-14 09:50:56.736754+00	\N	f	\N
129	2	522	VL14XCX	vw tiguan	\N	\N	\N	\N	2026-04-14 09:53:19.368746+00	\N	f	\N
130	2	524	DJ19AAL	peugeot	3008	\N	\N	\N	2026-04-14 10:13:28.620751+00	\N	f	\N
131	2	525	DJ54BIL	opel	\N	\N	\N	\N	2026-04-14 10:15:42.143277+00	\N	f	\N
132	2	527	B969VDA	LEXUS 	ES30 	\N	\N	\N	2026-04-14 10:21:27.42266+00	\N	f	\N
133	2	528	DJ06XDA	reno	\N	\N	\N	\N	2026-04-14 10:36:43.557606+00	\N	f	\N
134	2	529	B223MIK	toyota	\N	\N	\N	\N	2026-04-14 10:40:18.566332+00	\N	f	\N
135	2	530	DJ98XMI	vw	passat	\N	\N	\N	2026-04-14 10:45:17.198262+00	\N	f	\N
136	2	531	DJ33WBX	BMW 	S2	\N	\N	\N	2026-04-14 10:53:51.504734+00	\N	f	\N
137	2	532	DJ88HIT	scoda	\N	\N	\N	\N	2026-04-14 10:59:13.447603+00	\N	f	\N
138	2	534	DJ27KRA	vw	\N	\N	\N	\N	2026-04-14 11:10:45.241574+00	\N	f	\N
139	2	535	B10POM	bmw	\N	\N	\N	\N	2026-04-14 11:11:26.201001+00	\N	f	\N
140	2	536	B403EEA	mercedes	\N	\N	\N	\N	2026-04-14 11:26:59.647753+00	\N	f	\N
141	2	537	DJ24VFE	hyundai	\N	\N	\N	\N	2026-04-14 11:35:05.074264+00	\N	f	\N
142	2	538	B234JCB	SKODA	KAROQ	\N	\N	\N	2026-04-14 11:38:49.537415+00	\N	f	\N
143	2	540	DJ11SVM	kia	\N	\N	\N	\N	2026-04-14 11:39:46.420336+00	\N	f	\N
144	2	542	DJ30DIA	toiota	\N	\N	\N	\N	2026-04-14 11:52:28.597965+00	\N	f	\N
145	2	526	DJ83DME	dacia	duster	\N	\N	\N	2026-04-14 12:06:11.637579+00	\N	f	\N
146	2	544	B311JJJ	mercedes glc	\N	\N	\N	\N	2026-04-14 12:08:00.953198+00	\N	f	\N
147	2	543	DJ50DDM	TOYOTA	\N	\N	\N	\N	2026-04-14 12:08:14.69767+00	\N	f	\N
148	2	545	DJ45CPD	kia	\N	\N	\N	\N	2026-04-14 12:19:16.874659+00	\N	f	\N
149	2	546	DJ81FRT	toyota	\N	\N	\N	\N	2026-04-14 12:31:08.803419+00	\N	f	\N
150	2	539	DJ99JSS	OPEL	CORSA	\N	\N	\N	2026-04-14 12:47:01.633224+00	\N	f	\N
151	2	548	DJ09EWY	daia	duster	\N	\N	\N	2026-04-14 12:52:09.427441+00	\N	f	\N
152	2	547	B127VGL	mercedes 	\N	\N	\N	\N	2026-04-14 13:07:32.877942+00	\N	f	\N
153	2	549	DJ09SID	audi	\N	\N	\N	\N	2026-04-14 13:18:16.924437+00	\N	f	\N
154	2	550	DJ24MXT	AUDI	\N	\N	\N	\N	2026-04-14 13:20:09.024884+00	\N	f	\N
155	2	551	DJ21UBU	toyota	\N	\N	\N	\N	2026-04-14 13:36:46.391539+00	\N	f	\N
156	2	552	DJ86GBR	hiundai	\N	\N	\N	\N	2026-04-14 13:48:00.398998+00	\N	f	\N
157	2	553	OT95TOY	bmw	\N	\N	\N	\N	2026-04-14 13:56:51.186367+00	\N	f	\N
158	2	554	DJ98APM	volvo 	xc 60	\N	\N	\N	2026-04-14 13:59:48.336294+00	\N	f	\N
159	2	555	OT23PWG	BMW 	S5 	\N	\N	\N	2026-04-14 14:03:39.668437+00	\N	f	\N
160	2	558	DJ20NMN	AUDI	\N	\N	\N	\N	2026-04-15 05:45:21.34622+00	\N	f	\N
161	2	556	DJ98AUM	skoda	\N	\N	\N	\N	2026-04-15 05:46:35.562055+00	\N	f	\N
162	2	560	DJ66BAU	MERCEDES 	SPRINTER	\N	\N	\N	2026-04-15 05:53:54.596459+00	\N	f	\N
163	2	561	DJ17AIP	ford puma	\N	\N	\N	\N	2026-04-15 05:59:12.588685+00	\N	f	\N
164	2	563	DJ32MDE	bmw x5	\N	\N	\N	\N	2026-04-15 06:04:21.708965+00	\N	f	\N
165	2	564	DJ44LDE	RENOULT	\N	\N	\N	\N	2026-04-15 06:14:03.199976+00	\N	f	\N
166	2	562	DJ69WSW	hyundai	\N	\N	\N	\N	2026-04-15 06:15:48.71893+00	\N	f	\N
167	2	566	B98RPE	opel	\N	\N	\N	\N	2026-04-15 06:28:01.857547+00	\N	f	\N
168	2	568	DJ10NBI	TOYOTA	CHR	\N	\N	\N	2026-04-15 06:32:30.799973+00	\N	f	\N
169	2	569	DJ45DGM	kia	\N	\N	\N	\N	2026-04-15 06:34:29.705966+00	\N	f	\N
170	2	572	OT10POP	LEXUS 	rx	\N	\N	\N	2026-04-15 07:07:50.645658+00	\N	f	\N
171	2	573	DJ73MLS	wv	golf	\N	\N	\N	2026-04-15 07:19:14.872893+00	\N	f	\N
172	2	570	DJ70ABM	bmw	\N	\N	\N	\N	2026-04-15 07:22:50.524295+00	\N	f	\N
173	2	575	DJ21WKS	toyota	\N	\N	\N	\N	2026-04-15 07:29:49.270667+00	\N	f	\N
174	2	576	DJ62SOF	OPEL	astra j	\N	\N	\N	2026-04-15 07:37:38.240637+00	\N	f	\N
175	2	579	DJ09FPE	opel astra	\N	\N	\N	\N	2026-04-15 07:40:16.436483+00	\N	f	\N
176	2	577	B266MTC	skoda	\N	\N	26000	\N	2026-04-15 07:54:26.182208+00	\N	f	\N
177	2	581	DJ15NSD	HYUNDAI 	TUCSON 	\N	\N	\N	2026-04-15 08:12:35.971961+00	\N	f	\N
178	2	583	DJ44AAX	AUDI	QU	\N	\N	\N	2026-04-15 08:17:24.245726+00	\N	f	\N
179	2	582	DJ96KAM	skoda	\N	\N	\N	\N	2026-04-15 08:17:27.130174+00	\N	f	\N
180	2	584	DJ01VAE	tiguan	\N	\N	\N	\N	2026-04-15 08:25:59.498169+00	\N	f	\N
181	2	586	HPKL2004	bmw	\N	\N	\N	\N	2026-04-15 08:51:22.075838+00	\N	f	\N
182	2	589	DJ22TAT	wv	TIGUAN	\N	\N	\N	2026-04-15 09:02:10.957494+00	\N	f	\N
183	2	590	DJ68DRC	mercedes 	\N	\N	\N	\N	2026-04-15 09:12:12.314001+00	\N	f	\N
184	2	587	DJ18VLZ	\N	\N	\N	\N	\N	2026-04-15 09:16:34.992591+00	\N	f	\N
185	2	592	GJ66SND	AUDI	S8	\N	\N	\N	2026-04-15 09:24:37.687747+00	\N	f	\N
186	2	594	DJ05WMO	mercedes	\N	\N	\N	\N	2026-04-15 09:34:02.129473+00	\N	f	\N
187	2	595	VL99AZG	bmw	\N	\N	\N	\N	2026-04-15 09:34:54.205115+00	\N	f	\N
188	2	596	OT14CCP	MERCEDES 	vito	\N	\N	\N	2026-04-15 09:50:39.80516+00	\N	f	\N
189	2	593	DJ76NAT	mg	\N	\N	\N	\N	2026-04-15 09:55:09.301383+00	\N	f	\N
190	2	597	DJ10RXA	mercedes	\N	\N	\N	\N	2026-04-15 10:04:04.519827+00	\N	f	\N
191	2	598	DJ90SCH	mercedes v300	\N	\N	\N	\N	2026-04-15 10:11:44.121178+00	\N	f	\N
192	2	599	B135RNV	wv 	ID3	\N	\N	\N	2026-04-15 10:19:03.073924+00	\N	f	\N
193	2	600	DJ91ANB	BYD	sealu	\N	\N	\N	2026-04-15 10:49:49.444596+00	\N	f	\N
194	2	602	DJ04AKM	mercedes	\N	\N	\N	\N	2026-04-15 10:51:13.359353+00	\N	f	\N
195	2	603	B881RBL	seat	\N	\N	\N	\N	2026-04-15 10:58:35.923677+00	\N	f	\N
196	2	604	DJ60SHO	tesla	\N	\N	\N	\N	2026-04-15 10:58:50.818347+00	\N	f	\N
197	2	601	DJ10NLE	logan	\N	\N	\N	\N	2026-04-15 11:15:14.914521+00	\N	f	\N
198	2	606	DJ37RDI	toyota	\N	\N	\N	\N	2026-04-15 11:20:52.424148+00	\N	f	\N
199	2	608	VL33TER	ISUZU	LS	\N	\N	\N	2026-04-15 11:27:27.644911+00	\N	f	\N
200	2	609	B456BTC 	MERCEDES 	G CLASS	\N	\N	\N	2026-04-15 11:35:02.225334+00	\N	f	\N
201	2	607	DJ28CBS	passat	\N	\N	\N	\N	2026-04-15 11:45:12.377363+00	\N	f	\N
202	2	610	OT05BOR	Scoda	\N	\N	\N	\N	2026-04-15 11:53:50.64809+00	\N	f	\N
203	2	612	DJ28GIL	nissan	\N	\N	\N	\N	2026-04-15 12:22:42.949481+00	\N	f	\N
204	2	614	DJ14TAT	golf	\N	\N	215000	\N	2026-04-15 12:52:51.16453+00	\N	f	\N
205	2	615	DJ01XEI	audii	\N	\N	\N	\N	2026-04-15 12:56:19.352257+00	\N	f	\N
206	2	616	DJ77SFP	audi	\N	\N	\N	\N	2026-04-15 13:01:17.890716+00	\N	f	\N
207	2	613	IF99GRK	opel	\N	\N	\N	\N	2026-04-15 13:20:11.16775+00	\N	f	\N
208	2	619	DJ84BNC	BMW 	E91	\N	\N	\N	2026-04-15 13:35:25.29646+00	\N	f	\N
209	2	617	DJ09UZT	seat	\N	\N	\N	\N	2026-04-15 13:39:36.003096+00	\N	f	\N
210	2	621	DJ017189	\N	tesla	\N	\N	\N	2026-04-15 14:01:32.276466+00	\N	f	\N
211	2	618	DJ70XAS	TOYOTA	COROLLA 	\N	\N	\N	2026-04-15 14:08:36.326999+00	\N	f	\N
212	2	620	DJ12FSM	hyundai	\N	\N	20000	\N	2026-04-15 14:17:22.914867+00	\N	f	\N
213	2	622	DJ02DST	MERCEDES 	VITO	\N	\N	\N	2026-04-15 14:20:17.426823+00	\N	f	\N
214	2	624	DJW29KIR	vw	tiguan	\N	\N	\N	2026-04-16 05:41:19.812743+00	\N	f	\N
215	2	625	DJ52AMV	mercedes	\N	\N	\N	\N	2026-04-16 05:45:36.133662+00	\N	f	\N
216	2	628	DJ01CPK	bmw	\N	\N	\N	\N	2026-04-16 06:00:51.783037+00	\N	f	\N
217	2	629	DJ77XZZ	BMW	G30 	\N	\N	\N	2026-04-16 06:02:48.794204+00	\N	f	\N
218	2	627	B121LRB	renault	\N	\N	\N	\N	2026-04-16 06:04:40.823005+00	\N	f	\N
219	2	631	DJ11DBZ	honda	\N	\N	\N	\N	2026-04-16 06:08:22.917345+00	\N	f	\N
220	2	633	DJ25ADU	MERCEDES	E CLASS	\N	\N	\N	2026-04-16 06:32:46.377078+00	\N	f	\N
221	2	632	B85CZS	sandero	\N	\N	\N	\N	2026-04-16 06:45:36.466489+00	\N	f	\N
222	2	634	DJ74RIC	opel	astra	\N	\N	\N	2026-04-16 06:47:03.769281+00	\N	f	\N
223	2	637	DJ73YGI	BMW	S3	\N	\N	\N	2026-04-16 06:57:50.00326+00	\N	f	\N
224	2	638	DJ29AEA	seat	\N	\N	\N	\N	2026-04-16 07:13:04.247071+00	\N	f	\N
225	2	639	DJ55BAS	MERCEDES 	glc	\N	\N	\N	2026-04-16 07:15:34.614826+00	\N	f	\N
226	2	640	DJ96TAD	\N	passat	\N	\N	\N	2026-04-16 07:19:48.866451+00	\N	f	\N
227	2	641	DJ15MWM	mercedes	\N	\N	\N	\N	2026-04-16 07:20:46.182956+00	\N	f	\N
228	2	642	DJ17WKW	Suzuki	vitara	\N	\N	\N	2026-04-16 07:25:11.570256+00	\N	f	\N
229	2	644	DJ05DSS	toyota	\N	\N	\N	\N	2026-04-16 07:31:13.513558+00	\N	f	\N
230	2	645	MH29DEI	MERCEDES 	gle 	\N	\N	\N	2026-04-16 07:36:37.728531+00	\N	f	\N
231	2	643	DJ67XDK	renault	\N	\N	\N	\N	2026-04-16 07:51:36.642081+00	\N	f	\N
232	2	646	DJ19AZV	Mitsubishi	\N	\N	\N	\N	2026-04-16 08:03:01.822861+00	\N	f	\N
233	2	647	DJ27PCO	pejout	\N	\N	\N	\N	2026-04-16 08:05:15.821025+00	\N	f	\N
234	2	648	DJ82GMM	BMW 	X1	\N	\N	\N	2026-04-16 08:05:40.964191+00	\N	f	\N
235	2	649	B444ANJ	TOYOTA	RAV4	\N	\N	\N	2026-04-16 08:09:42.061593+00	\N	f	\N
236	2	650	DJ11BGB	bmw	\N	\N	\N	\N	2026-04-16 08:21:59.697958+00	\N	f	\N
237	2	651	DJ10RIM	logan	\N	\N	\N	\N	2026-04-16 08:29:42.432745+00	\N	f	\N
238	2	654	DJ66SEA	lexus	rx450	\N	\N	\N	2026-04-16 08:43:35.144288+00	\N	f	\N
239	2	655	WESDY586	MERCEDES 	cla	\N	\N	\N	2026-04-16 08:47:55.860403+00	\N	f	\N
240	2	657	DJ80MET	wv 	TRANSPORTER	\N	\N	\N	2026-04-16 08:57:50.588905+00	\N	f	\N
241	2	659	DJ88VAP	range rover	\N	\N	\N	\N	2026-04-16 09:02:00.378948+00	\N	f	\N
242	2	652	DJ51MRG	bmw	\N	\N	\N	\N	2026-04-16 09:03:27.57523+00	\N	f	\N
243	2	660	B17TCM	mercedes	gls	\N	\N	\N	2026-04-16 09:13:05.081431+00	\N	f	\N
244	2	664	DJ22WTF	RENAULT 	megan 	\N	\N	\N	2026-04-16 09:27:16.757547+00	\N	f	\N
245	2	665	TM86MNX	duster	\N	\N	\N	\N	2026-04-16 09:29:15.350511+00	\N	f	\N
246	2	662	DJ17HFO	tesla	\N	\N	\N	\N	2026-04-16 09:38:03.701293+00	\N	f	\N
247	2	666	B221RDW	toyota	\N	\N	\N	\N	2026-04-16 09:39:59.966643+00	\N	f	\N
248	2	667	DJ73DYN	audi	q5	\N	\N	\N	2026-04-16 09:44:22.33848+00	\N	f	\N
249	2	668	DJ63HSD	toiota	\N	\N	\N	\N	2026-04-16 10:01:40.502861+00	\N	f	\N
250	2	669	DJ14SZU	skoda	\N	\N	\N	\N	2026-04-16 10:10:12.358921+00	\N	f	\N
251	2	670	DJ39ADO	renoult	\N	\N	\N	\N	2026-04-16 10:12:21.856966+00	\N	f	\N
252	2	672	B335AMI	AUDI	Q5	\N	\N	\N	2026-04-16 10:15:06.749684+00	\N	f	\N
253	2	674	DJ65SEK	logan	\N	\N	\N	\N	2026-04-16 10:22:43.260147+00	\N	f	\N
254	2	675	DJ93DYN	audi	a6	\N	\N	\N	2026-04-16 10:35:39.380071+00	\N	f	\N
255	2	673	B81WGT	skoda	\N	\N	\N	\N	2026-04-16 10:35:45.590136+00	\N	f	\N
256	2	681	DJ55WET	doker	\N	\N	\N	\N	2026-04-16 10:48:10.313779+00	\N	f	\N
257	2	682	B05WGT	Skoda	\N	\N	\N	\N	2026-04-16 10:49:48.58915+00	\N	f	\N
258	2	680	DJ16VDD	hyundai	\N	\N	\N	\N	2026-04-16 10:54:38.074702+00	\N	f	\N
259	2	683	DJ09BAV	bmw	\N	\N	\N	\N	2026-04-16 11:14:14.790665+00	\N	f	\N
260	2	684	DJ11NWN	vw	passat	\N	\N	\N	2026-04-16 11:16:53.71945+00	\N	f	\N
261	2	687	DJ38ETC	toiota corrola	\N	\N	\N	\N	2026-04-16 11:30:09.371846+00	\N	f	\N
262	2	689	DJ10KYM	passat	\N	\N	\N	\N	2026-04-16 11:43:00.216571+00	\N	f	\N
263	2	690	DJ07YSN	vw	polo	\N	\N	\N	2026-04-16 11:44:26.135563+00	\N	f	\N
264	2	686	DJ84YAB	mercedes 	\N	\N	\N	\N	2026-04-16 11:49:24.909538+00	\N	f	\N
265	2	691	DJ69AAM	bmw	\N	\N	\N	\N	2026-04-16 11:58:19.223076+00	\N	f	\N
266	2	693	OT34CIA	\N	ford	\N	\N	\N	2026-04-16 12:05:36.789816+00	\N	f	\N
267	2	692	DJ22DLC	skoda	\N	\N	\N	\N	2026-04-16 12:07:48.517293+00	\N	f	\N
268	2	695	DJ51SKY	bmw	x1	\N	\N	\N	2026-04-16 12:12:45.312449+00	\N	f	\N
269	2	698	DJ77TYR	BMW	X5	\N	\N	\N	2026-04-16 12:24:51.251121+00	\N	f	\N
270	2	699	DJ65KAM	toyota	\N	\N	\N	\N	2026-04-16 12:24:58.956995+00	\N	f	\N
271	2	697	DJ66RBC	mercedes	\N	\N	\N	\N	2026-04-16 12:25:37.965813+00	\N	f	\N
272	2	700	DJ77SET	audi	a6	\N	\N	\N	2026-04-16 12:34:40.456352+00	\N	f	\N
273	2	701	DJ52ACD	nissan	\N	\N	\N	\N	2026-04-16 12:35:26.990896+00	\N	f	\N
274	2	702	DJ18FJD	bmw	\N	\N	\N	\N	2026-04-16 12:54:56.431574+00	\N	f	\N
275	2	703	MH12PRV	bmw	\N	\N	\N	\N	2026-04-16 12:56:13.475776+00	\N	f	\N
276	2	706	DJ02DBI	bmw	\N	\N	\N	\N	2026-04-16 13:08:17.481579+00	\N	f	\N
277	2	707	B717PXZ	BMW	M2	\N	\N	\N	2026-04-16 13:12:19.342161+00	\N	f	\N
278	2	705	B486MXM	mercedes	\N	\N	\N	\N	2026-04-16 13:24:03.038816+00	\N	f	\N
279	2	696	DJ01PFY	mercedes	\N	\N	\N	\N	2026-04-16 13:24:20.288983+00	\N	f	\N
280	2	688	B145ELC	jogeer	\N	\N	\N	\N	2026-04-16 13:36:35.84701+00	\N	f	\N
281	2	709	IF17LSN	skoda	\N	\N	\N	\N	2026-04-16 13:40:14.863977+00	\N	f	\N
282	2	708	DJ01ATG	BMW	G30	\N	\N	\N	2026-04-16 13:40:58.068049+00	\N	f	\N
283	2	710	DJ20MVM	range rover	\N	\N	\N	\N	2026-04-16 14:00:22.174719+00	\N	f	\N
284	2	694	DJ18RCY	FORD	\N	\N	\N	\N	2026-04-16 14:07:09.109346+00	\N	f	\N
285	2	711	AB21AUA	Dacia	\N	\N	\N	\N	2026-04-16 14:09:06.34244+00	\N	f	\N
286	2	713	DJ57MLA	vw 	CADDY	\N	\N	\N	2026-04-16 14:20:07.397599+00	\N	f	\N
287	2	716	DJ08EMY	AUDI	A5	\N	\N	\N	2026-04-17 05:31:04.784263+00	\N	f	\N
288	2	717	DJ14UPE	toiota iaris	\N	\N	\N	\N	2026-04-17 05:40:33.384334+00	\N	f	\N
289	2	718	DJ29MRM	kia	\N	\N	\N	\N	2026-04-17 05:49:54.11129+00	\N	f	\N
290	2	715	DJ23TGO	toiota	\N	\N	\N	\N	2026-04-17 05:53:39.095351+00	\N	f	\N
291	2	719	DJ50CSN	iveco	\N	\N	\N	\N	2026-04-17 05:55:23.292396+00	\N	f	\N
292	2	720	DJ88SET	volvo	\N	\N	\N	\N	2026-04-17 06:10:34.504365+00	\N	f	\N
293	2	723	DJ85SFD	mercedes	\N	\N	\N	\N	2026-04-17 06:22:52.122625+00	\N	f	\N
294	2	724	DJ09WYO	toyota	land cruser	\N	\N	\N	2026-04-17 06:28:25.258877+00	\N	f	\N
295	2	722	DJ70CSN	toyota	\N	\N	\N	\N	2026-04-17 06:33:26.115098+00	\N	f	\N
296	2	726	DJ10RRC	toiota	\N	\N	\N	\N	2026-04-17 06:38:28.448928+00	\N	f	\N
297	2	728	DJ64MCA	FORD	FOCUS	\N	\N	\N	2026-04-17 06:46:11.989016+00	\N	f	\N
298	2	727	DJ44MET	vw	\N	\N	\N	\N	2026-04-17 06:56:32.953219+00	\N	f	\N
299	2	730	DJ18HOB	OPEL	ASTR	\N	\N	\N	2026-04-17 07:01:40.023281+00	\N	f	\N
300	2	733	B889HAF	ford	\N	\N	\N	\N	2026-04-17 07:02:26.347186+00	\N	f	\N
301	2	734	IS10PHA	opel	\N	\N	\N	\N	2026-04-17 07:03:43.544056+00	\N	f	\N
302	2	735	DJ85SPY	toiota c hr	\N	\N	\N	\N	2026-04-17 07:11:24.700987+00	\N	f	\N
303	2	736	DJ22MKV	GOF 	\N	\N	\N	\N	2026-04-17 07:11:36.077181+00	\N	f	\N
304	2	738	B889HAF	ford	\N	\N	\N	\N	2026-04-17 07:26:14.621862+00	\N	f	\N
305	2	737	DJ06CTI	vw	\N	\N	\N	\N	2026-04-17 07:30:10.317442+00	\N	f	\N
306	2	740	DJ17JOJ	logan	\N	\N	\N	\N	2026-04-17 07:40:27.653285+00	\N	f	\N
307	2	741	DJ16LSA	mercedes	\N	\N	\N	\N	2026-04-17 07:42:11.876846+00	\N	f	\N
308	2	742	SB88KON	crafter	\N	\N	\N	\N	2026-04-17 07:54:05.874478+00	\N	f	\N
309	2	743	B22FBT	TOYOTA	COROLLA	\N	\N	\N	2026-04-17 07:58:14.184145+00	\N	f	\N
310	2	744	DJ11YTG	opel	\N	\N	\N	\N	2026-04-17 08:00:16.673457+00	\N	f	\N
311	2	745	DJ58PMD	mercedes	\N	\N	\N	\N	2026-04-17 08:02:50.078583+00	\N	f	\N
312	2	746	DJ97REG	bmw	\N	\N	\N	\N	2026-04-17 08:06:35.015757+00	\N	f	\N
313	2	750	DJ93NCT	DACIA	sandero	\N	\N	\N	2026-04-17 08:23:00.880113+00	\N	f	\N
314	2	747	B76YND	audi	\N	\N	\N	\N	2026-04-17 08:26:36.125682+00	\N	f	\N
315	2	751	DJ74ELF	fiat	ducato	\N	\N	\N	2026-04-17 08:33:38.196165+00	\N	f	\N
316	2	753	DJ20CHR	opel	\N	\N	\N	\N	2026-04-17 08:46:06.73244+00	\N	f	\N
317	2	752	DJ66GMI	bmw	\N	\N	\N	\N	2026-04-17 08:54:39.211084+00	\N	f	\N
318	2	756	DJ96DCL	TOYOTA 	CHR	\N	\N	\N	2026-04-17 08:57:13.020088+00	\N	f	\N
319	2	758	DJ93REI	w golf	\N	\N	\N	\N	2026-04-17 09:09:47.963649+00	\N	f	\N
320	2	759	DJ28AEB	TOYOTA	AURIS	\N	\N	\N	2026-04-17 09:18:25.806853+00	\N	f	\N
321	2	757	B44NDN	peugeot	\N	\N	120000	\N	2026-04-17 09:30:17.716232+00	\N	f	\N
322	2	760	DJ29EGE	bmw	\N	\N	\N	\N	2026-04-17 09:36:52.624057+00	\N	f	\N
323	2	761	DJ66GMI	bmw	\N	\N	\N	\N	2026-04-17 09:39:38.691237+00	\N	f	\N
324	2	762	DJ09ZAM	bmw	x6	\N	\N	\N	2026-04-17 09:41:41.793083+00	\N	f	\N
325	2	766	DJ13BMW	BMW 	S3	\N	\N	\N	2026-04-17 09:50:39.548645+00	\N	f	\N
326	2	767	DJ83DRO	bmw	\N	\N	\N	\N	2026-04-17 09:55:09.040178+00	\N	f	\N
327	2	768	DJ16YJO	reno	\N	\N	\N	\N	2026-04-17 10:04:05.935912+00	\N	f	\N
328	2	770	DJ08GLD	toyota	\N	\N	\N	\N	2026-04-17 10:06:18.701946+00	\N	f	\N
329	2	773	DJ14VNK	mitsubishi	\N	\N	\N	\N	2026-04-17 10:25:51.322222+00	\N	f	\N
330	2	774	DJ20HIM	BMW	s6	\N	\N	\N	2026-04-17 10:30:58.290939+00	\N	f	\N
331	2	775	DJ76FLA	dacia	\N	\N	\N	\N	2026-04-17 10:32:53.611627+00	\N	f	\N
332	2	772	DJ15HGW	dokeer	\N	\N	\N	\N	2026-04-17 10:33:03.881287+00	\N	f	\N
333	2	778	DJ08VSE	hyundai	\N	\N	\N	\N	2026-04-17 10:49:08.027452+00	\N	f	\N
334	2	742	SB53CCI	dacia	jogger	\N	\N	\N	2026-04-17 11:01:01.098644+00	\N	f	\N
335	2	779	SB64CCI	dacia	\N	\N	\N	\N	2026-04-17 11:12:11.88449+00	\N	f	\N
336	2	777	DJ82MDL	ford	\N	\N	\N	\N	2026-04-17 11:16:06.887012+00	\N	f	\N
337	2	780	DJ77MYM	bmw	\N	\N	\N	\N	2026-04-17 11:29:49.428172+00	\N	f	\N
338	2	781	DJ82AUG	w golf	\N	\N	\N	\N	2026-04-17 11:43:06.493227+00	\N	f	\N
339	2	771	DJ96LAM	ford	\N	\N	\N	\N	2026-04-17 11:54:48.429141+00	\N	f	\N
340	2	783	B09DXC	MERCEDES 	\N	\N	\N	\N	2026-04-17 11:55:16.352336+00	\N	f	\N
341	2	764	DJ13SUI	vw	\N	\N	\N	\N	2026-04-17 12:05:09.802205+00	\N	f	\N
342	2	784	DJ06DFX	volvo	\N	\N	\N	\N	2026-04-17 12:08:11.228838+00	\N	f	\N
343	2	785	DJ18XOV	renault	\N	\N	\N	\N	2026-04-17 12:13:24.450029+00	\N	f	\N
344	2	786	DJ01ELM	loghy	\N	\N	\N	\N	2026-04-17 12:16:07.60093+00	\N	f	\N
345	2	787	DJ07LWR	fiat	doblo	\N	\N	\N	2026-04-17 12:26:40.197356+00	\N	f	\N
346	2	791	DJ08KOD	honda civic	\N	\N	\N	\N	2026-04-17 13:04:09.379683+00	\N	f	\N
347	2	792	VL78MWM	TOYOTA 	CHR	\N	\N	\N	2026-04-17 13:12:14.782406+00	\N	f	\N
348	2	788	CJ62TLW	skoda	\N	\N	\N	\N	2026-04-17 13:12:59.984436+00	\N	f	\N
349	2	794	DJ05CXX	mazda	\N	\N	\N	\N	2026-04-17 13:20:18.025495+00	\N	f	\N
350	2	795	DJ08AXG	toyota	\N	\N	\N	\N	2026-04-17 13:23:53.451857+00	\N	f	\N
351	2	798	DJ71NKY	dacia	dokker	\N	\N	\N	2026-04-17 13:32:02.975416+00	\N	f	\N
352	2	799	DJ09LPX	ford focus	\N	\N	\N	\N	2026-04-17 13:39:01.830972+00	\N	f	\N
353	2	797	DJ55BMD	vw	\N	\N	\N	\N	2026-04-17 13:40:29.245859+00	\N	f	\N
354	2	800	DJ94RNO	TOYOTA 	CHR	\N	\N	\N	2026-04-17 13:47:02.717217+00	\N	f	\N
355	2	803	DJ26GHF	bmw	x3	\N	\N	\N	2026-04-17 13:59:50.424712+00	\N	f	\N
356	2	802	DJ28JOK	MERCEDES 	\N	\N	\N	\N	2026-04-17 13:59:55.62642+00	\N	f	\N
357	2	801	DJ16CDV	vw	\N	\N	\N	\N	2026-04-17 14:02:55.827446+00	\N	f	\N
358	2	804	DJ22XAS	vw	taigo	\N	\N	\N	2026-04-17 14:04:17.697896+00	\N	f	\N
359	2	805	DJ31PES	tiguan	\N	\N	\N	\N	2026-04-17 14:10:13.213967+00	\N	f	\N
360	2	806	DJ18WIB	mazda	\N	\N	\N	\N	2026-04-17 14:15:56.629334+00	\N	f	\N
361	2	807	DJ29EXV	reno koleos	\N	\N	\N	\N	2026-04-17 14:19:29.957255+00	\N	f	\N
362	2	808	TC233224	FORD	kuga	\N	\N	\N	2026-04-17 14:40:48.311262+00	\N	f	\N
363	2	811	DJ10DCO	nissan x trail	\N	\N	\N	\N	2026-04-20 05:39:32.948495+00	\N	f	\N
364	2	809	B953BCE	hyundai	\N	\N	\N	\N	2026-04-20 05:46:18.827297+00	\N	f	\N
365	2	812	DJ55KLS	MAZDA	6	\N	\N	\N	2026-04-20 05:50:51.151773+00	\N	f	\N
366	2	814	SB57CCI	toyta	\N	\N	\N	\N	2026-04-20 05:55:03.435359+00	\N	f	\N
367	2	815	DJ90VFM	DACIA 	DUSTER	\N	\N	\N	2026-04-20 06:01:35.094079+00	\N	f	\N
368	2	813	DJ68FRT	toyota	\N	\N	\N	\N	2026-04-20 06:06:51.204669+00	\N	f	\N
369	2	817	DJ08ZAM	audii q3	\N	\N	\N	\N	2026-04-20 06:07:47.750165+00	\N	f	\N
370	2	818	DJ82MOM	RENAULT 	SIMBOL	\N	\N	\N	2026-04-20 06:10:35.516783+00	\N	f	\N
371	2	820	DJ82BLU	toyota	\N	\N	\N	\N	2026-04-20 06:26:28.94398+00	\N	f	\N
372	2	823	DJ99BDM	audii	\N	\N	\N	\N	2026-04-20 06:40:00.174107+00	\N	f	\N
373	2	821	DJ28ATT	hyundai	\N	\N	\N	\N	2026-04-20 06:46:31.235625+00	\N	f	\N
374	2	825	B55PXS	wv	CRAFTER	\N	\N	\N	2026-04-20 06:57:06.208579+00	\N	f	\N
375	2	826	DJ33GPC	FORD 	KUGA	\N	\N	\N	2026-04-20 07:10:08.341926+00	\N	f	\N
376	2	827	B108RTT	vw	taigo	\N	\N	\N	2026-04-20 07:19:41.003855+00	\N	f	\N
377	2	829	OT41ULI	bmw	\N	\N	\N	\N	2026-04-20 07:31:21.13742+00	\N	f	\N
378	2	830	DJ33GPC	FORD 	KUGA	\N	\N	\N	2026-04-20 07:31:43.109164+00	\N	f	\N
379	2	828	DJ28KID	RENAULT 	MEGANE 	\N	\N	\N	2026-04-20 07:41:41.382541+00	\N	f	\N
380	2	832	DJ55CNE	renault	megane	\N	\N	\N	2026-04-20 07:44:47.929743+00	\N	f	\N
381	2	831	DJ22BNC	mercedes	\N	\N	\N	\N	2026-04-20 08:03:10.260058+00	\N	f	\N
382	2	836	DJ21ASI	MERCEDES	GLA	\N	\N	\N	2026-04-20 08:18:04.201252+00	\N	f	\N
383	2	838	OT41ULI	bmw	\N	\N	\N	\N	2026-04-20 08:19:47.346652+00	\N	f	\N
384	2	837	DJ28RMN	ford	\N	\N	\N	\N	2026-04-20 08:30:48.165077+00	\N	f	\N
385	2	839	DJ55JAM	mercedes gle	\N	\N	\N	\N	2026-04-20 08:34:03.84149+00	\N	f	\N
386	2	841	DJ44GBX	PEUGEOT 	5008	\N	\N	\N	2026-04-20 08:47:07.747424+00	\N	f	\N
387	2	835	DJ22LXA	golf	\N	\N	\N	\N	2026-04-20 08:52:26.660595+00	\N	f	\N
388	2	842	DJ13CLP	skoda	octavia	\N	\N	\N	2026-04-20 08:59:13.317632+00	\N	f	\N
389	2	843	SB74CON	BMW 	X4	\N	\N	\N	2026-04-20 09:02:11.273858+00	\N	f	\N
390	2	845	DJ28NNN	mazda 	\N	\N	\N	\N	2026-04-20 09:20:00.557566+00	\N	f	\N
391	2	847	OT93RMS	RENAULT	MASTER	\N	\N	\N	2026-04-20 09:29:18.594861+00	\N	f	\N
392	2	850	DJ07WRM	toyota	corolla	\N	\N	\N	2026-04-20 09:33:51.657797+00	\N	f	\N
393	2	846	DJ64HAR	opel	\N	\N	\N	\N	2026-04-20 09:38:56.069456+00	\N	f	\N
394	2	852	DJ88MYH	RENAULT 	KANGOO	\N	\N	\N	2026-04-20 09:53:18.477445+00	\N	f	\N
395	2	853	DJ90LDO	iveco	\N	\N	\N	\N	2026-04-20 09:54:10.768191+00	\N	f	\N
396	2	854	DJ01ACV	vw	jetta	\N	\N	\N	2026-04-20 10:13:45.258811+00	\N	f	\N
397	2	855	DJ54SEA	ford edge	\N	\N	\N	\N	2026-04-20 10:16:30.41508+00	\N	f	\N
398	2	856	DJ90LDO	iveco	\N	\N	\N	\N	2026-04-20 10:16:51.488709+00	\N	f	\N
399	2	858	B707FRT	MERCEDES	GLC 	\N	\N	\N	2026-04-20 10:30:11.405689+00	\N	f	\N
400	2	857	DJ21EPK	HYUNDAI 	i30	\N	\N	\N	2026-04-20 10:30:39.166145+00	\N	f	\N
401	2	862	DJ21LED	skoda kodiac	\N	\N	\N	\N	2026-04-20 10:52:55.047013+00	\N	f	\N
402	2	863	OT92DRE	mercedes	cla220	\N	\N	\N	2026-04-20 10:53:48.835998+00	\N	f	\N
403	2	864	DJ23DKU	bmw	x5	\N	\N	\N	2026-04-20 10:57:06.031603+00	\N	f	\N
404	2	860	DJ18XDS	byd	\N	\N	\N	\N	2026-04-20 11:04:49.329676+00	\N	f	\N
405	2	865	DJ73MCR	TOYOTA	CHR	\N	\N	\N	2026-04-20 11:09:49.420157+00	\N	f	\N
406	2	867	DJ65NTY	DACIA 	JOGGER	\N	\N	\N	2026-04-20 11:34:06.599494+00	\N	f	\N
407	2	868	SB53CCI	dacia	jogger	\N	\N	\N	2026-04-20 11:34:56.656147+00	\N	f	\N
408	2	869	DJ79CCC	ford	kuga	\N	\N	\N	2026-04-20 11:42:52.966964+00	\N	f	\N
409	2	870	B123JWF	duster	\N	\N	\N	\N	2026-04-20 11:49:46.983678+00	\N	f	\N
410	2	873	B701DEE	SKODA	OCTAVIA 	\N	\N	\N	2026-04-20 12:01:01.315246+00	\N	f	\N
411	2	874	DJ06AVZ	MERCEDES 	SPRINTER	\N	\N	\N	2026-04-20 12:01:43.506087+00	\N	f	\N
412	2	875	DJ17ASL	volvo	xc60	\N	\N	\N	2026-04-20 12:07:04.91821+00	\N	f	\N
413	2	871	B188FRT	jogeer	\N	\N	\N	\N	2026-04-20 12:12:17.700823+00	\N	f	\N
414	2	876	DJ65AGM	peugeot	508	\N	\N	\N	2026-04-20 12:15:50.012862+00	\N	f	\N
415	2	879	B615FRT	audii	\N	\N	\N	\N	2026-04-20 12:25:04.223138+00	\N	f	\N
416	2	878	DJ01BOM	mercedes	\N	\N	\N	\N	2026-04-20 12:35:57.051748+00	\N	f	\N
417	2	881	DJ25CSN	MERCEDES	VITO	\N	\N	\N	2026-04-20 12:47:27.938812+00	\N	f	\N
418	2	882	OT91AXG	vw	golf	\N	\N	\N	2026-04-20 12:53:42.863839+00	\N	f	\N
419	2	883	DJ95MUS	MERCEDES 	 G CLASS	\N	\N	\N	2026-04-20 12:55:13.687663+00	\N	f	\N
420	2	884	SB40GUH	ford focus	\N	\N	\N	\N	2026-04-20 12:57:51.002583+00	\N	f	\N
421	2	880	DJ18DKS	logan	\N	\N	\N	\N	2026-04-20 13:05:13.090549+00	\N	f	\N
422	2	888	DJ08WRM	TOYOTA	COROLLA	\N	\N	\N	2026-04-20 13:24:00.82207+00	\N	f	\N
423	2	889	DJ06GTB	opel	\N	\N	\N	\N	2026-04-20 13:24:51.712646+00	\N	f	\N
424	2	891	B993AXC	toiota	\N	\N	\N	\N	2026-04-20 13:26:21.000171+00	\N	f	\N
425	2	886	TM14MEV	remault	\N	\N	\N	\N	2026-04-20 13:27:48.188857+00	\N	f	\N
426	2	892	DJ11AIV	peugeot	206	\N	\N	\N	2026-04-20 13:29:31.733065+00	\N	f	\N
427	2	894	DJ85SBM	NISAN	QASHQAI	\N	\N	\N	2026-04-20 13:31:11.190171+00	\N	f	\N
428	2	899	DJ83ARG	FORD	KUGA	\N	\N	\N	2026-04-20 13:50:28.868644+00	\N	f	\N
429	2	900	DJ82SYB	dacia 	doker	\N	\N	\N	2026-04-20 13:51:41.321344+00	\N	f	\N
430	2	898	B151EBP	logan	\N	\N	\N	\N	2026-04-20 13:58:23.826448+00	\N	f	\N
431	2	902	DJ83DRO	bmw	\N	\N	\N	\N	2026-04-20 14:00:49.764905+00	\N	f	\N
432	2	903	B971RMA	mitsubishi outlender	\N	\N	\N	\N	2026-04-20 14:03:31.53215+00	\N	f	\N
433	2	905	DJ04TNX	toyota	\N	\N	\N	\N	2026-04-20 14:21:00.759349+00	\N	f	\N
434	2	906	DJ83KIK	vw	POLO	\N	\N	\N	2026-04-20 14:24:17.367692+00	\N	f	\N
435	2	907	DJ88SBA	BMW 	X5 	\N	\N	\N	2026-04-20 14:29:11.580352+00	\N	f	\N
436	2	908	B100WBC	metcedes	\N	\N	\N	\N	2026-04-20 14:38:41.740041+00	\N	f	\N
437	2	910	DJ07MXO	vw	golf	\N	\N	\N	2026-04-21 05:49:38.411024+00	\N	f	\N
438	2	909	DJ23TMO	OPEL 	 CROSSLAND X	\N	\N	\N	2026-04-21 05:50:15.286617+00	\N	f	\N
439	2	913	B08DFX	ford 	\N	\N	\N	\N	2026-04-21 06:01:32.461721+00	\N	f	\N
440	2	914	DJ97BAU	kia	\N	\N	\N	\N	2026-04-21 06:01:57.174874+00	\N	f	\N
441	2	916	DJ07MXO	vw	golf	\N	\N	\N	2026-04-21 06:14:50.502636+00	\N	f	\N
442	2	918	DJ10PDZ	FORD	TRANZIT	\N	\N	\N	2026-04-21 06:25:51.791117+00	\N	f	\N
443	2	919	B577LGK	toiota	\N	\N	\N	\N	2026-04-21 06:29:51.100758+00	\N	f	\N
444	2	920	DJ32HER	bmw	\N	\N	\N	\N	2026-04-21 06:33:11.268425+00	\N	f	\N
445	2	922	B125SXV	ford	puma	\N	\N	\N	2026-04-21 06:37:45.063758+00	\N	f	\N
446	2	923	DJ92HER	w t roc	\N	\N	\N	\N	2026-04-21 06:40:48.894239+00	\N	f	\N
447	2	926	DJ63HLW	BMW	X3	\N	\N	\N	2026-04-21 06:53:30.980461+00	\N	f	\N
448	2	924	DJ02ABM	toyota	\N	\N	\N	\N	2026-04-21 07:01:23.295655+00	\N	f	\N
449	2	927	B124RUI	ford kuga	\N	\N	\N	\N	2026-04-21 07:15:19.090042+00	\N	f	\N
450	2	929	DJ03GON	skoda	\N	\N	\N	\N	2026-04-21 07:17:36.75522+00	\N	f	\N
451	2	928	DJ01KJW	mercedes	\N	\N	\N	\N	2026-04-21 07:32:18.933604+00	\N	f	\N
452	2	932	DJ77EZN	RANGE ROVER 	VELAR 	\N	\N	\N	2026-04-21 07:36:22.572876+00	\N	f	\N
453	2	934	DJ21MXM	toiota rav 4	\N	\N	\N	\N	2026-04-21 07:49:18.380352+00	\N	f	\N
454	2	935	DJ02NYH	logan	\N	\N	\N	\N	2026-04-21 07:59:40.889425+00	\N	f	\N
455	2	937	DJ20HSD	toyota	\N	\N	\N	\N	2026-04-21 08:03:47.304388+00	\N	f	\N
456	2	938	DJ29PEL	RENAULT 	FLUENCE	\N	\N	\N	2026-04-21 08:06:32.243584+00	\N	f	\N
457	2	941	B881WTW	toyota	rav4	\N	\N	\N	2026-04-21 08:26:43.15035+00	\N	f	\N
458	2	943	DJ08RXY	golf 5	\N	\N	\N	\N	2026-04-21 08:28:05.966712+00	\N	f	\N
459	2	940	DJ57ALP	ford	\N	\N	\N	\N	2026-04-21 08:28:47.949455+00	\N	f	\N
460	2	944	DJ06XOJ	renoult	\N	\N	\N	\N	2026-04-21 08:33:22.483199+00	\N	f	\N
461	2	945	IF14VWZ	DACIA 	LOGAN	\N	\N	\N	2026-04-21 08:42:52.526749+00	\N	f	\N
462	2	946	B716DAB	mrrcedes	\N	\N	120000	\N	2026-04-21 09:01:19.604248+00	\N	f	\N
463	2	949	DJ01MSW	toyota	yariscross	\N	\N	\N	2026-04-21 09:04:10.051979+00	\N	f	\N
464	2	952	DJ22FAG	NISSAN 	\N	\N	\N	\N	2026-04-21 09:10:52.359783+00	\N	f	\N
465	2	954	B611BKT	dacia	jogger	\N	\N	\N	2026-04-21 09:17:50.288801+00	\N	f	\N
466	2	948	DJ70TIN	scoda	\N	\N	\N	\N	2026-04-21 09:41:44.021922+00	\N	f	\N
467	2	957	DB17FAL	VW	TRANSPORTER 	\N	\N	\N	2026-04-21 09:46:14.243107+00	\N	f	\N
468	2	958	DJ19BTW	ford	\N	\N	\N	\N	2026-04-21 09:54:57.262853+00	\N	f	\N
469	2	959	DJ97NAT	ford	\N	\N	\N	\N	2026-04-21 09:56:37.705925+00	\N	f	\N
470	2	962	DJ20RIX	mercedes	\N	\N	\N	\N	2026-04-21 10:10:43.695784+00	\N	f	\N
471	2	950	GJ66CCA	bmw	\N	\N	\N	\N	2026-04-21 10:12:16.066046+00	\N	f	\N
472	2	963	GJ66CCA	bmw	\N	\N	\N	\N	2026-04-21 10:32:52.950843+00	\N	f	\N
473	2	961	B600BKT	ford	\N	\N	\N	\N	2026-04-21 10:33:27.885024+00	\N	f	\N
474	2	964	DJ76COX	BMW	S3	\N	\N	\N	2026-04-21 10:40:19.943006+00	\N	f	\N
475	2	965	DJ18DWV	volvo	\N	\N	\N	\N	2026-04-21 11:01:42.145932+00	\N	f	\N
476	2	966	IS36ACG	skoda	octavia	\N	\N	\N	2026-04-21 11:03:33.507709+00	\N	f	\N
477	2	967	DJ11DDD	mercedes gle	\N	\N	\N	\N	2026-04-21 11:15:43.714141+00	\N	f	\N
478	2	968	B126REB	wolcswaghen	crafter	\N	\N	\N	2026-04-21 11:23:01.064432+00	\N	f	\N
479	2	972	DJ44HZI	opel 	\N	\N	\N	\N	2026-04-21 11:48:45.505005+00	\N	f	\N
480	2	974	DJ08XML	skoda	\N	\N	\N	\N	2026-04-21 11:51:57.177591+00	\N	f	\N
481	2	976	DJ88MHN	\N	\N	\N	\N	\N	2026-04-21 12:01:24.238162+00	\N	f	\N
482	2	977	DJ89KIM	reno megane	\N	\N	\N	\N	2026-04-21 12:05:57.7093+00	\N	f	\N
483	2	978	DJ03STM	mercedes	spintaer	\N	\N	\N	2026-04-21 12:07:59.09919+00	\N	f	\N
484	2	980	DJ69NIS	BMW	X5	\N	\N	\N	2026-04-21 12:14:05.303176+00	\N	f	\N
485	2	981	DJ70NIS	AUDI	Q5	\N	\N	\N	2026-04-21 12:14:58.32288+00	\N	f	\N
486	2	982	DJ84NIS	BMW 	X6	\N	\N	\N	2026-04-21 12:16:10.959801+00	\N	f	\N
487	2	983	B2275ELM	jogger	\N	\N	\N	\N	2026-04-21 12:18:59.192039+00	\N	f	\N
488	2	985	B89JBD	vw	caddy	\N	\N	\N	2026-04-21 12:32:06.385054+00	\N	f	\N
489	2	988	B325MGA	w chedi	\N	\N	\N	\N	2026-04-21 12:40:12.351844+00	\N	f	\N
490	2	987	DJ31LCC	bmw	\N	\N	\N	\N	2026-04-21 12:46:23.188257+00	\N	f	\N
491	2	989	DJ03VRD	AUDI	Q7	\N	\N	\N	2026-04-21 12:47:24.9936+00	\N	f	\N
492	2	991	DJ77RKK	TOYOTA	CHR 	\N	\N	\N	2026-04-21 13:11:26.819403+00	\N	f	\N
493	2	992	DJ20CDE	w tiguan	\N	\N	\N	\N	2026-04-21 13:12:26.144478+00	\N	f	\N
494	2	993	OT12MSM	Vw	tiguan	\N	\N	\N	2026-04-21 13:13:57.282757+00	\N	f	\N
495	2	994	OT12MSM	Vw	tiguan	\N	\N	\N	2026-04-21 13:37:56.027487+00	\N	f	\N
496	2	995	DJ25CHE	duster 	\N	\N	\N	\N	2026-04-21 13:38:08.760478+00	\N	f	\N
497	2	996	DJ83DRC	TOYOTA	YARIS 	\N	\N	\N	2026-04-21 13:42:44.546917+00	\N	f	\N
498	2	998	OT08DSD	dacia	logan	\N	\N	\N	2026-04-21 13:49:59.226029+00	\N	f	\N
499	2	997	DJ51GED	mercedes	\N	\N	\N	\N	2026-04-21 14:01:12.152736+00	\N	f	\N
500	2	1000	B124SRY	bmw	745e	\N	\N	\N	2026-04-21 14:17:47.827468+00	\N	f	\N
501	2	1001	DJ77SHM	bmw	\N	\N	\N	\N	2026-04-22 05:41:28.797655+00	\N	f	\N
502	2	1002	B650PHA	w crafter	\N	\N	\N	\N	2026-04-22 05:45:58.356578+00	\N	f	\N
503	2	1003	DJ13ZKN	kia	sportage	\N	\N	\N	2026-04-22 05:48:57.067593+00	\N	f	\N
504	2	1004	B139BOL	MERCEDES 	g class	\N	\N	\N	2026-04-22 05:51:39.40567+00	\N	f	\N
505	2	1005	DJ21BAO	toyota	corola	\N	\N	\N	2026-04-22 05:54:16.420944+00	\N	f	\N
506	2	1008	DJ11MTY	toyota	\N	\N	\N	\N	2026-04-22 06:03:20.242467+00	\N	f	\N
507	2	1009	MH07SRZ	dacia	duster	\N	\N	\N	2026-04-22 06:31:00.39426+00	\N	f	\N
508	2	1011	DJ09SMC	mercedes	\N	\N	\N	\N	2026-04-22 06:37:37.713032+00	\N	f	\N
509	2	1010	DJ11DOZ	opel	\N	\N	\N	\N	2026-04-22 06:41:56.555332+00	\N	f	\N
510	2	1013	DJ67TGP	dacia	logan	\N	\N	\N	2026-04-22 06:44:56.530364+00	\N	f	\N
511	2	1012	DJ61CMM	VOLVO	XC60	\N	\N	\N	2026-04-22 06:45:26.988042+00	\N	f	\N
512	2	1016	OT01WHL	VOLVO	xc60	\N	\N	\N	2026-04-22 07:20:03.307322+00	\N	f	\N
513	2	1014	DJ95DRT	nissan	\N	\N	\N	\N	2026-04-22 07:21:35.338454+00	\N	f	\N
514	2	1017	DJ22FKJ	mercedes vito	\N	\N	\N	\N	2026-04-22 07:24:41.160575+00	\N	f	\N
515	2	1019	DJ77AVG	bmw	\N	\N	\N	\N	2026-04-22 07:35:02.440142+00	\N	f	\N
516	2	1020	B06EJO	toyota	rav4	\N	\N	\N	2026-04-22 07:45:47.716433+00	\N	f	\N
517	2	1018	B122TYA	skoda	\N	\N	\N	\N	2026-04-22 07:50:14.163799+00	\N	f	\N
518	2	1024	B06EJO	toyota	rav4	\N	\N	\N	2026-04-22 08:09:01.508908+00	\N	f	\N
519	2	1015	DJ17RCG	MERCEDES	SPRINTER	\N	\N	\N	2026-04-22 08:09:16.341689+00	\N	f	\N
520	2	1025	OT11RLK	AUDI	A3	\N	\N	\N	2026-04-22 08:10:07.279862+00	\N	f	\N
521	2	1021	OT80MAF	dacia	duster	\N	\N	\N	2026-04-22 08:22:03.813993+00	\N	f	\N
522	2	1026	DJ69YVO	toyota	\N	\N	1200	\N	2026-04-22 08:22:40.803567+00	\N	f	\N
523	2	1027	B118SVV	renout	\N	\N	\N	\N	2026-04-22 08:40:56.440438+00	\N	f	\N
524	2	1030	DJ12DAN	MAZDA 	CX3P	\N	\N	\N	2026-04-22 08:45:22.711428+00	\N	f	\N
525	2	1028	DJ07XGK	logan	\N	\N	\N	\N	2026-04-22 08:51:39.634898+00	\N	f	\N
526	2	1033	DJ18AZV	BMW	S3	\N	\N	\N	2026-04-22 08:59:45.098293+00	\N	f	\N
527	2	1035	DJ97DRB	toyota	\N	\N	\N	\N	2026-04-22 09:09:35.288683+00	\N	f	\N
528	2	1037	DJ17UZR	ford 	kuga	\N	\N	\N	2026-04-22 09:21:16.518343+00	\N	f	\N
529	2	1038	GJ37MRC	mercedes	\N	\N	\N	\N	2026-04-22 09:26:19.952221+00	\N	f	\N
530	2	1039	DJ66ECO	w crafter	\N	\N	\N	\N	2026-04-22 09:30:25.539308+00	\N	f	\N
531	2	1041	DJ29KWG	LAND  ROVER	\N	\N	\N	\N	2026-04-22 09:37:15.743981+00	\N	f	\N
532	2	1043	DJ67FRT	toyota	\N	\N	\N	\N	2026-04-22 09:43:32.063058+00	\N	f	\N
533	2	1045	DJ03BDS	mazda	cx5	\N	\N	\N	2026-04-22 10:07:19.617958+00	\N	f	\N
534	2	1046	DJ38ECL	MERCEDES	CITAN	\N	\N	\N	2026-04-22 10:14:14.752537+00	\N	f	\N
535	2	1040	DJ16SJP	bmw	\N	\N	\N	\N	2026-04-22 10:14:57.031736+00	\N	f	\N
536	2	1047	DJ03BDS	mazda	cx5	\N	\N	\N	2026-04-22 10:30:37.553273+00	\N	f	\N
537	2	1048	DJ08MW	toyota	\N	\N	\N	\N	2026-04-22 10:32:38.108981+00	\N	f	\N
538	2	1050	DJ48EKO	crafter	\N	\N	\N	\N	2026-04-22 10:41:19.831062+00	\N	f	\N
539	2	1051	DJ88BUM	MERCEDES 	glk	\N	\N	\N	2026-04-22 10:43:54.315941+00	\N	f	\N
540	2	1052	DJ09STM	iveco	\N	\N	\N	\N	2026-04-22 10:46:37.23162+00	\N	f	\N
541	2	1053	DJ07XYA	mercedes 	\N	\N	\N	\N	2026-04-22 10:55:05.439921+00	\N	f	\N
542	2	1054	B206VVV	touareg	\N	\N	\N	\N	2026-04-22 11:20:07.949132+00	\N	f	\N
543	2	1056	DJ88DDD	bentley	\N	\N	\N	\N	2026-04-22 11:30:51.933619+00	\N	f	\N
544	2	1057	B410DEM	mercedes	\N	\N	\N	\N	2026-04-22 11:31:43.131657+00	\N	f	\N
545	2	1058	DJ45CSA	mercedes vito	\N	\N	\N	\N	2026-04-22 11:46:03.459974+00	\N	f	\N
546	2	1060	B121PEV	dacia	\N	\N	\N	\N	2026-04-22 11:52:43.316648+00	\N	f	\N
547	2	1062	B410DEM	mercedes	\N	\N	\N	\N	2026-04-22 12:00:53.630732+00	\N	f	\N
548	2	1064	CJ77TRV	scoda rapid	\N	\N	\N	\N	2026-04-22 12:14:42.773241+00	\N	f	\N
549	2	1065	DJ19WSC	RANGE ROVER 	\N	\N	\N	\N	2026-04-22 12:20:50.146244+00	\N	f	\N
550	2	1067	OT23BXA	vw	passat	\N	\N	\N	2026-04-22 12:32:59.222302+00	\N	f	\N
551	2	1070	OT75FAR	SKODA	KODIAQ	\N	\N	\N	2026-04-22 13:20:41.411913+00	\N	f	\N
552	2	1068	DJ76ZEN	toiota	\N	\N	\N	\N	2026-04-22 13:22:08.346368+00	\N	f	\N
553	2	1072	OT60AGM	mercedes	\N	\N	\N	\N	2026-04-22 13:23:29.26315+00	\N	f	\N
554	2	1074	DJ12GPX	VOLVO	\N	\N	\N	\N	2026-04-22 13:27:43.40917+00	\N	f	\N
555	2	1075	DJ91DAL	w golf	\N	\N	\N	\N	2026-04-22 13:37:31.071415+00	\N	f	\N
556	2	1077	DJ21MUM	hundai	i20	\N	\N	\N	2026-04-22 13:51:02.673676+00	\N	f	\N
557	2	1078	DJ23SMD	TOYOTA	AURIS	\N	\N	\N	2026-04-22 13:57:06.8591+00	\N	f	\N
558	2	1079	DJ24NMA	hiundai kona	\N	\N	\N	\N	2026-04-22 13:59:05.341041+00	\N	f	\N
559	2	1081	DJ10KOD	audi	\N	\N	\N	\N	2026-04-22 14:07:42.477611+00	\N	f	\N
560	2	1083	DJ29ALI	ford	focus	\N	\N	\N	2026-04-22 14:17:27.20594+00	\N	f	\N
561	2	1085	DJ17TWW	toiota	\N	\N	\N	\N	2026-04-23 05:26:47.869751+00	\N	f	\N
562	2	1086	DJ23AEI	suzuchi	\N	\N	\N	\N	2026-04-23 05:51:12.16473+00	\N	f	\N
563	2	1090	DJ21HER	toiota c hr	\N	\N	\N	\N	2026-04-23 05:51:16.556027+00	\N	f	\N
564	2	1091	OT10FAB	PORSCHE	\N	\N	\N	\N	2026-04-23 06:08:42.036334+00	\N	f	\N
565	2	1089	DJ12TDT	bmw	x3	\N	\N	\N	2026-04-23 06:12:26.516145+00	\N	f	\N
566	2	1094	DJ05AZA	MERCEDES	 S MAYBAC 	\N	\N	\N	2026-04-23 06:51:18.845098+00	\N	f	\N
567	2	1095	DJ09LRY	taigo	\N	\N	\N	\N	2026-04-23 06:58:04.828341+00	\N	f	\N
568	2	1096	B118GPJ	ford puma	\N	\N	\N	\N	2026-04-23 07:11:17.198567+00	\N	f	\N
569	2	1097	DJ15VMZ	mercedes	gle	\N	\N	\N	2026-04-23 07:19:22.346833+00	\N	f	\N
570	2	1099	DJ23XMG	mercedes	\N	\N	\N	\N	2026-04-23 07:32:23.006047+00	\N	f	\N
571	2	1100	DJ89MLS	audi	\N	\N	\N	\N	2026-04-23 07:43:45.869667+00	\N	f	\N
572	2	1101	DJ28WUW	BMW	G30	\N	\N	\N	2026-04-23 08:07:18.105035+00	\N	f	\N
573	2	1102	DJ12GDB	iveco	\N	\N	\N	\N	2026-04-23 08:08:19.734168+00	\N	f	\N
574	2	1104	DJ64YVA	bmw	\N	\N	\N	\N	2026-04-23 08:19:59.455207+00	\N	f	\N
575	2	1105	DJ28BRA	opel	vivaro	\N	\N	\N	2026-04-23 08:21:12.026125+00	\N	f	\N
576	2	1107	DJ23MLS	mercedes	\N	\N	\N	\N	2026-04-23 08:25:40.289023+00	\N	f	\N
577	2	1109	OT77BIV	vw	passat b7	\N	\N	\N	2026-04-23 08:39:27.972554+00	\N	f	\N
578	2	1110	B300GHM	MERCEDES 	\N	\N	\N	\N	2026-04-23 08:40:38.639308+00	\N	f	\N
579	2	1111	B196SYS	opel	corsa	\N	\N	\N	2026-04-23 08:42:12.502381+00	\N	f	\N
580	2	1106	DJ77BIB	audi	\N	\N	\N	\N	2026-04-23 08:49:13.357863+00	\N	f	\N
581	2	1112	DJ77MTO	\N	opel	\N	\N	\N	2026-04-23 08:56:15.794074+00	\N	f	\N
582	2	1113	DJ88UMF	ford	\N	\N	60000	\N	2026-04-23 09:26:15.055689+00	\N	f	\N
583	2	1114	DJ28ECO	WV 	CRAFTER	\N	\N	\N	2026-04-23 09:29:00.816747+00	\N	f	\N
584	2	1115	DJ37PER	BMW	X5	\N	\N	\N	2026-04-23 09:32:34.680044+00	\N	f	\N
585	2	1117	OT30ABD	bmw	\N	\N	\N	\N	2026-04-23 09:42:26.207433+00	\N	f	\N
586	2	1118	DJ88GBL	toareg	\N	\N	\N	\N	2026-04-23 09:57:18.703252+00	\N	f	\N
587	2	1116	DJ67AMN	toyota	\N	\N	\N	\N	2026-04-23 09:57:57.24618+00	\N	f	\N
588	2	1108	DJ01NSA	hiunday	santafee	\N	\N	\N	2026-04-23 09:59:37.121645+00	\N	f	\N
589	2	1119	DJ88GBL	toareg	\N	\N	\N	\N	2026-04-23 10:17:05.221063+00	\N	f	\N
590	2	1120	DJ15GRJ	IVECO	DAYLI	\N	\N	\N	2026-04-23 10:22:12.81526+00	\N	f	\N
591	2	1121	DJ01LCC	mercedes glc	\N	\N	\N	\N	2026-04-23 10:34:29.108708+00	\N	f	\N
592	2	1122	DJ73GMC	bmw	\N	\N	\N	\N	2026-04-23 10:44:00.390859+00	\N	f	\N
593	2	1124	DJ15LMS	lodgi	\N	\N	\N	\N	2026-04-23 10:59:40.746813+00	\N	f	\N
594	2	1125	DJ46WTK	BMW	S3GT	\N	\N	\N	2026-04-23 11:06:55.926488+00	\N	f	\N
595	2	1126	DJ78LVY	mini cooper	\N	\N	\N	\N	2026-04-23 11:17:31.789422+00	\N	f	\N
596	2	1127	DJ36TEH	\N	ducato	\N	\N	\N	2026-04-23 11:19:44.964594+00	\N	f	\N
597	2	1128	DJ73GMC	bmw	f10	\N	\N	\N	2026-04-23 11:20:31.587727+00	\N	f	\N
598	2	1130	DJ59LNA	nissan	\N	\N	\N	\N	2026-04-23 11:34:38.657929+00	\N	f	\N
599	2	1131	OT14SXG	mercedes	vito	\N	\N	\N	2026-04-23 11:39:03.703116+00	\N	f	\N
600	2	1132	B06TFR	mazda cx 60	\N	\N	\N	\N	2026-04-23 11:41:45.439486+00	\N	f	\N
601	2	1134	B24ZKK	skoda	\N	\N	\N	\N	2026-04-23 11:43:31.684738+00	\N	f	\N
602	2	1136	DJ01NNN	MERCEDES	G CLASS	\N	\N	\N	2026-04-23 12:04:32.198726+00	\N	f	\N
603	2	1133	DJ87AMA	seat	\N	\N	\N	\N	2026-04-23 12:14:18.036803+00	\N	f	\N
604	2	1137	DJ17HJD	opel	astra-j	\N	\N	\N	2026-04-23 12:19:24.093891+00	\N	f	\N
605	2	1138	DJ67WFX	vw	passat	\N	\N	\N	2026-04-23 12:26:00.99134+00	\N	f	\N
606	2	1141	DJ12JLI	mercedes gle	\N	\N	\N	\N	2026-04-23 12:48:14.423941+00	\N	f	\N
607	2	1143	DJ08KVG	opel	\N	\N	\N	\N	2026-04-23 13:05:36.296283+00	\N	f	\N
608	2	1144	DJ91MOD	vw	tiguan	\N	\N	\N	2026-04-23 13:21:10.914652+00	\N	f	\N
609	2	1145	DJ37DRC	mercedes	\N	\N	\N	\N	2026-04-23 13:23:03.646204+00	\N	f	\N
610	2	1146	DJ02EXL	WV	TIGUAN	\N	\N	\N	2026-04-23 13:29:32.956582+00	\N	f	\N
611	2	1147	DJ91MOD	vw	tiguan	\N	\N	\N	2026-04-23 13:42:43.3784+00	\N	f	\N
612	2	1148	DJ99NRM	w cc	\N	\N	\N	\N	2026-04-23 13:59:06.93869+00	\N	f	\N
613	2	1149	OT82CXP	hiundai i10	\N	\N	\N	\N	2026-04-24 05:28:05.303057+00	\N	f	\N
614	2	1151	B115VJW	logan	\N	\N	\N	\N	2026-04-24 05:54:50.210835+00	\N	f	\N
615	2	1150	DJ90MHN	skoda	kodiaq	\N	\N	\N	2026-04-24 06:00:16.929834+00	\N	f	\N
616	2	1153	DJ86ERH	hiundai tucton	\N	\N	\N	\N	2026-04-24 06:09:46.543296+00	\N	f	\N
617	2	1154	B618FRT	audi	\N	\N	\N	\N	2026-04-24 06:19:24.537389+00	\N	f	\N
618	2	1155	DJ05SHY	opel	igsinia	\N	\N	\N	2026-04-24 06:23:08.794468+00	\N	f	\N
619	2	1157	DJ27VVV	BMW	SER5	\N	\N	\N	2026-04-24 06:31:20.01637+00	\N	f	\N
620	2	1156	DJ77AFA	ford	\N	\N	\N	\N	2026-04-24 06:45:27.029043+00	\N	f	\N
621	2	1160	DJ27ROZ	opel 	\N	\N	\N	\N	2026-04-24 07:07:48.087292+00	\N	f	\N
622	2	1162	DJ17FBF	dacia doker	\N	\N	\N	\N	2026-04-24 07:09:03.968217+00	\N	f	\N
623	2	1163	DJ11WOG	tiguoan	\N	\N	\N	\N	2026-04-24 07:10:44.379986+00	\N	f	\N
624	2	1164	DJ85AZS	bmw	x1	\N	\N	\N	2026-04-24 07:13:14.037149+00	\N	f	\N
625	2	1165	MHA DJ 99	ford	\N	\N	\N	\N	2026-04-24 07:19:48.804289+00	\N	f	\N
626	2	1166	DJ67MOV	HONDA	CR  V	\N	\N	\N	2026-04-24 07:23:01.462596+00	\N	f	\N
627	2	1159	DJ67GRS	skoda	\N	\N	\N	\N	2026-04-24 07:24:46.229588+00	\N	f	\N
628	2	1167	DJ71DEA	vw	golf	\N	\N	\N	2026-04-24 07:27:25.255148+00	\N	f	\N
629	2	1168	DJ17FBF	dacia doker	\N	\N	\N	\N	2026-04-24 07:30:55.261122+00	\N	f	\N
630	2	1169	DJ90GRB	iveco	\N	\N	\N	\N	2026-04-24 07:40:38.508317+00	\N	f	\N
631	2	1170	OT41CCP	range rover	\N	\N	\N	\N	2026-04-24 07:52:22.676915+00	\N	f	\N
632	2	1171	DJ12 MWK	LADA 	III8	\N	\N	\N	2026-04-24 08:03:38.105442+00	\N	f	\N
633	2	1172	DJ15KTM	ram	\N	\N	\N	\N	2026-04-24 08:08:40.51405+00	\N	f	\N
634	2	1173	DJ07XRM	audi a5	\N	\N	\N	\N	2026-04-24 08:17:32.393004+00	\N	f	\N
635	2	1176	DJ30PPM	vw	golf7	\N	\N	\N	2026-04-24 08:25:52.381539+00	\N	f	\N
636	2	1178	CJ70GFT	SKODA	SCALA	\N	\N	\N	2026-04-24 08:34:01.41186+00	\N	f	\N
637	2	1179	DJ89NOY	mayda	3	\N	\N	\N	2026-04-24 08:39:46.305693+00	\N	f	\N
638	2	1181	B807RSH	renoult	\N	\N	\N	\N	2026-04-24 08:41:45.876385+00	\N	f	\N
639	2	1180	DJ66AEA	ford	focus	\N	\N	\N	2026-04-24 08:42:01.982477+00	\N	f	\N
640	2	1182	DJ 85 DES	mini couper	\N	\N	\N	\N	2026-04-24 08:44:17.824702+00	\N	f	\N
641	2	1183	DJ23SPM	bmw	x1	\N	26000	\N	2026-04-24 08:50:24.753584+00	\N	f	\N
642	2	1184	DJ09LNA	skoda	octavia	\N	\N	\N	2026-04-24 09:05:42.708831+00	\N	f	\N
643	2	1185	DJ72MAX	audii a4	\N	\N	\N	\N	2026-04-24 09:08:50.738399+00	\N	f	\N
644	2	1186	DJ016127	dacia	duster	\N	\N	\N	2026-04-24 09:09:15.154967+00	\N	f	\N
645	2	1187	VL58SKY	skoda	\N	\N	\N	\N	2026-04-24 09:24:26.137973+00	\N	f	\N
646	2	1188	DJ33AMT	mercedes 	\N	\N	\N	\N	2026-04-24 09:30:15.500654+00	\N	f	\N
647	2	1191	DJ50HPY	vw	tiguan	\N	\N	\N	2026-04-24 09:55:39.063976+00	\N	f	\N
648	2	1193	DJ10SPO	renault	\N	\N	\N	\N	2026-04-24 09:56:00.815657+00	\N	f	\N
649	2	1192	OT25TAX	bmw	\N	\N	\N	\N	2026-04-24 09:57:54.828342+00	\N	f	\N
650	2	1194	DJ18HWW	renoult	\N	\N	\N	\N	2026-04-24 10:02:08.946032+00	\N	f	\N
651	2	1197	OT54DRS	mercedes	sprinter	\N	\N	\N	2026-04-24 10:15:27.061725+00	\N	f	\N
652	2	1198	DJ02MSB	mazda	\N	\N	\N	\N	2026-04-24 10:31:16.217764+00	\N	f	\N
653	2	1195	B666KMG	BMW	\N	\N	\N	\N	2026-04-24 10:35:07.030776+00	\N	f	\N
654	2	1189	B110BUI	ford	focus	\N	\N	\N	2026-04-24 10:46:11.071666+00	\N	f	\N
655	2	1201	OT25TAX	bmw	\N	\N	\N	\N	2026-04-24 11:02:40.83013+00	\N	f	\N
656	2	1202	DJ08WOW	opel	\N	\N	\N	\N	2026-04-24 11:04:38.149008+00	\N	f	\N
657	2	1205	DJ15TAV	dacia	duster	\N	\N	\N	2026-04-24 11:17:56.498088+00	\N	f	\N
658	2	1206	DJ83LKA	hiunday	hrv	\N	\N	\N	2026-04-24 11:19:58.389549+00	\N	f	\N
659	2	1207	DJ54KTL	wolkswagen	\N	\N	\N	\N	2026-04-24 11:32:21.468215+00	\N	f	\N
660	2	1208	DJ11DAX	mercedes	\N	\N	\N	\N	2026-04-24 11:36:01.563581+00	\N	f	\N
661	2	1209	B580DEM	volvo	xc40	\N	\N	\N	2026-04-24 11:47:25.370805+00	\N	f	\N
662	2	1211	DJ55AED	ford	ecosport	\N	\N	\N	2026-04-24 11:58:58.604866+00	\N	f	\N
663	2	1212	B72DIA	bmw	\N	\N	\N	\N	2026-04-24 12:10:45.074554+00	\N	f	\N
664	2	1213	TR85LAV	scoda	octavia	\N	\N	\N	2026-04-24 12:11:07.692892+00	\N	f	\N
665	2	1210	DJ67HMT	TOYOTA	COROLLA	\N	\N	\N	2026-04-24 12:26:59.567103+00	\N	f	\N
666	2	1215	DJ09LNG	skoda	octavia	\N	\N	\N	2026-04-24 12:35:14.064921+00	\N	f	\N
667	2	1216	B777PXZ	bmw	\N	\N	\N	\N	2026-04-24 12:40:55.38117+00	\N	f	\N
668	2	1219	DJ54DRC	bmw	\N	\N	\N	\N	2026-04-24 12:47:43.239683+00	\N	f	\N
669	2	1222	DJ47DNI	bmw	\N	\N	\N	\N	2026-04-24 12:59:16.377628+00	\N	f	\N
670	2	1217	DJ22TXR	TOYOTA	\N	\N	\N	\N	2026-04-24 13:01:41.430073+00	\N	f	\N
671	2	1223	DJ97AME	peugeot 307	\N	\N	\N	\N	2026-04-24 13:12:12.803862+00	\N	f	\N
672	2	1225	OT86MXA	vw	passat b8	\N	\N	\N	2026-04-24 13:20:05.703244+00	\N	f	\N
673	2	1227	B180TEX	toyota	\N	\N	\N	\N	2026-04-24 13:26:54.327706+00	\N	f	\N
674	2	1224	DJ51TAB	TORES  SANG YONG	\N	\N	\N	\N	2026-04-24 13:29:07.749421+00	\N	f	\N
675	2	1228	B223RAX	nissan	qashqai	\N	\N	\N	2026-04-24 13:33:21.365594+00	\N	f	\N
676	2	1229	DJ13MSI	DACIA	LOGAN	\N	\N	\N	2026-04-24 13:39:14.624395+00	\N	f	\N
677	2	1230	AG27PPA	skoda 	octavia	\N	\N	\N	2026-04-24 13:46:22.171832+00	\N	f	\N
678	2	1232	DJ14LDP	audii q5	\N	\N	\N	\N	2026-04-24 13:50:03.558678+00	\N	f	\N
681	2	1234	DJ44TRI	DACIA 	LOGAN	\N	\N	\N	2026-04-24 14:20:57.024724+00	\N	f	\N
679	2	1233	DJ89ABO	hiundai ioniq6	\N	\N	\N	\N	2026-04-24 14:08:36.448099+00	\N	f	\N
680	2	1231	DJ17XWA	BMW	\N	\N	\N	\N	2026-04-24 14:09:31.00882+00	\N	f	\N
682	2	1235	DJ20WAA	golf 	\N	\N	\N	\N	2026-04-27 05:36:43.500351+00	\N	f	\N
683	2	1236	OT73AWA	golf 5	\N	\N	\N	\N	2026-04-27 05:47:27.78173+00	\N	f	\N
684	2	1238	OT13SXS	nisan	\N	\N	\N	\N	2026-04-27 05:50:45.28153+00	\N	f	\N
685	2	1239	B134ELC	dacia	\N	\N	\N	\N	2026-04-27 05:59:48.083929+00	\N	f	\N
686	2	1237	DJ10FGH	renault	\N	\N	\N	\N	2026-04-27 06:08:20.089925+00	\N	f	\N
687	2	1241	DJ72MLA	TOYOTA	RAV4	\N	\N	\N	2026-04-27 06:26:30.831723+00	\N	f	\N
688	2	1242	DJ86FDL	reno talisman	\N	\N	\N	\N	2026-04-27 06:33:14.862897+00	\N	f	\N
689	2	1240	DJ15DGR	passat	\N	\N	\N	\N	2026-04-27 06:36:03.60361+00	\N	f	\N
690	2	1243	DJ52DAL	renoult	\N	\N	\N	\N	2026-04-27 06:40:51.590298+00	\N	f	\N
691	2	1244	B111NDF	mercedes	gle	\N	\N	\N	2026-04-27 07:00:46.375294+00	\N	f	\N
692	2	1245	DJ99WZV	toiota c hr	\N	\N	\N	\N	2026-04-27 07:01:25.902572+00	\N	f	\N
693	2	1246	DJ33DKW	clio	\N	\N	3000	\N	2026-04-27 07:02:24.905433+00	\N	f	\N
694	2	1247	B234DAL	FORD	PUMA	\N	\N	\N	2026-04-27 07:02:44.389222+00	\N	f	\N
695	2	1249	DJ04MVR	volvo	\N	\N	\N	\N	2026-04-27 07:27:07.957011+00	\N	f	\N
696	2	1250	DJ01WPM	vw	\N	\N	\N	\N	2026-04-27 07:33:33.205708+00	\N	f	\N
697	2	1251	DJ04EDJ	logan	\N	\N	\N	\N	2026-04-27 07:36:26.071262+00	\N	f	\N
698	2	1252	DJ54SMD	renault	\N	\N	\N	\N	2026-04-27 07:43:49.837788+00	\N	f	\N
699	2	1253	DJ68DCA	PEUGEOT	BOXER	\N	\N	\N	2026-04-27 07:44:09.99635+00	\N	f	\N
700	2	1254	DJ017538	nisan	\N	\N	\N	\N	2026-04-27 07:46:58.046848+00	\N	f	\N
701	2	1255	B15 DAL	FORD	TRANSIT	\N	\N	\N	2026-04-27 07:59:30.858978+00	\N	f	\N
702	2	1256	B740KWR	toyota	\N	\N	\N	\N	2026-04-27 08:03:02.529595+00	\N	f	\N
703	2	1257	DJ77WLN	vw	\N	\N	\N	\N	2026-04-27 08:06:56.539927+00	\N	f	\N
704	2	1259	GJ03LWX	wolsvagen	golf	\N	\N	\N	2026-04-27 08:23:00.812833+00	\N	f	\N
705	2	1260	DJ28MEM	nubira	\N	\N	\N	\N	2026-04-27 08:26:55.488604+00	\N	f	\N
706	2	1261	DJ28KIK	audii a4	\N	\N	\N	\N	2026-04-27 08:29:17.140386+00	\N	f	\N
707	2	1258	DJ03DLA	mazda	\N	\N	\N	\N	2026-04-27 08:30:16.704763+00	\N	f	\N
708	2	1262	DJ30SDA	vw	touran	\N	\N	\N	2026-04-27 08:35:23.268551+00	\N	f	\N
709	2	1266	DJ52WSW	MERCEDES 	GLE	\N	\N	\N	2026-04-27 08:57:07.588137+00	\N	f	\N
710	2	1267	B987MIV	toyota	\N	\N	\N	\N	2026-04-27 09:01:14.277782+00	\N	f	\N
711	2	1269	DJ11EGC	porshe	\N	\N	\N	\N	2026-04-27 09:03:51.026354+00	\N	f	\N
712	2	1268	DJ21FCJ	peugot boxer	\N	\N	\N	\N	2026-04-27 09:03:57.923112+00	\N	f	\N
713	2	1263	DJ75AFR	MERCEDES 	vito	\N	\N	\N	2026-04-27 09:06:45.91781+00	\N	f	\N
714	2	1264	B265CPK	lexus	\N	\N	\N	\N	2026-04-27 09:12:34.538756+00	\N	f	\N
715	2	1270	DJ01DNI	mercedes e300	\N	\N	\N	\N	2026-04-27 09:18:42.887221+00	\N	f	\N
716	2	1271	DJ74 KLA	BMW	X4	\N	\N	\N	2026-04-27 09:36:01.420466+00	\N	f	\N
717	2	1272	DJ68PPZ	mercedes	gls	\N	\N	\N	2026-04-27 09:41:42.05188+00	\N	f	\N
718	2	1273	B19GRN	bmw	\N	\N	\N	\N	2026-04-27 09:53:59.166792+00	\N	f	\N
719	2	1274	B164AUA	IVECO	DAILY	\N	\N	\N	2026-04-27 10:01:08.096584+00	\N	f	\N
720	2	1265	B55WSM	vw	touareg	\N	\N	\N	2026-04-27 10:06:56.132439+00	\N	f	\N
721	2	1275	DJ01KWH	renoult	\N	\N	\N	\N	2026-04-27 10:08:10.533116+00	\N	f	\N
722	2	1276	B84SRO	bmw	\N	\N	79000	\N	2026-04-27 10:18:33.54011+00	\N	f	\N
723	2	1279	DJ15AAN	mercedes	\N	\N	\N	\N	2026-04-27 10:29:00.757884+00	\N	f	\N
724	2	1280	DJ72YDA	dacia 	doker	\N	\N	\N	2026-04-27 10:31:39.646424+00	\N	f	\N
725	2	1281	DJ42DAL	DACIA	LOGAN	\N	\N	\N	2026-04-27 10:33:35.536899+00	\N	f	\N
726	2	1282	DJ08XTZ	skoda	\N	\N	\N	\N	2026-04-27 10:46:51.644805+00	\N	f	\N
727	2	1283	DJ18FOE	skoda	\N	\N	\N	\N	2026-04-27 10:47:31.22297+00	\N	f	\N
728	2	1284	DJ08WHO	vw	toareg	\N	\N	\N	2026-04-27 10:58:21.835156+00	\N	f	\N
729	2	1285	DJ08XTZ	skoda	\N	\N	\N	\N	2026-04-27 11:00:17.979933+00	\N	f	\N
730	2	1286	DJ77DDD	bentlei	\N	\N	\N	\N	2026-04-27 11:01:40.151456+00	\N	f	\N
731	2	1277	DJ42MDS	bmw	\N	\N	\N	\N	2026-04-27 11:01:55.915601+00	\N	f	\N
732	2	1287	DJ20CRK	TOYOTA	RAV 4	\N	\N	\N	2026-04-27 11:09:41.488934+00	\N	f	\N
733	2	1288	DJ59AAB	FORD 	TRANSIT	\N	\N	\N	2026-04-27 11:11:22.782325+00	\N	f	\N
734	2	1290	DJ03AES	bmw	\N	\N	\N	\N	2026-04-27 11:19:09.845656+00	\N	f	\N
735	2	1289	DJ55DIR	VW	CRAFTER	\N	\N	\N	2026-04-27 11:32:52.148152+00	\N	f	\N
736	2	1291	DJ66SEM	toareg	\N	\N	\N	\N	2026-04-27 11:39:15.599771+00	\N	f	\N
737	2	1292	B40ELN	ford puma	\N	\N	\N	\N	2026-04-27 11:41:05.2266+00	\N	f	\N
738	2	1293	DJ04DIL	TOYOTA	COROLLA	\N	\N	\N	2026-04-27 11:49:31.920886+00	\N	f	\N
739	2	1294	DJ90WLF	bmw	s6	\N	\N	\N	2026-04-27 11:49:45.688178+00	\N	f	\N
740	2	1295	DJ40AMB	skoda	\N	\N	\N	\N	2026-04-27 11:50:31.15377+00	\N	f	\N
741	2	1296	DJ08YWO	loganm	\N	\N	\N	\N	2026-04-27 11:54:43.097586+00	\N	f	\N
742	2	1298	DJ19STM	bmw	x5	\N	\N	\N	2026-04-27 12:10:28.315356+00	\N	f	\N
743	2	1299	DJ88TTG	FORD	TRANSIT CUSTOM 	\N	\N	\N	2026-04-27 12:19:53.915858+00	\N	f	\N
744	2	1300	DJ55DIR	VW	CRAFTER	\N	\N	\N	2026-04-27 12:28:45.975474+00	\N	f	\N
745	2	1297	DJ72KOA	bmw	\N	\N	\N	\N	2026-04-27 12:30:40.785362+00	\N	f	\N
746	2	1301	DJ70MXM	BMW	X5	\N	\N	\N	2026-04-27 12:40:31.739871+00	\N	f	\N
747	2	1302	DJ70DCI	renoult	\N	\N	\N	\N	2026-04-27 12:41:11.863821+00	\N	f	\N
748	2	1303	CJ99HBT	skoda	\N	\N	\N	\N	2026-04-27 12:41:29.689775+00	\N	f	\N
749	2	1304	DJ26AAC	opel	\N	\N	\N	\N	2026-04-27 13:09:07.961799+00	\N	f	\N
750	2	1305	DJ42SOF	golf	\N	\N	\N	\N	2026-04-27 13:15:59.602355+00	\N	f	\N
751	2	1306	DJ36SMN	opel	\N	\N	\N	\N	2026-04-27 13:19:02.614015+00	\N	f	\N
752	2	1307	DJ10SMG	TOYOTA	AYGO X	\N	\N	\N	2026-04-27 13:22:05.780186+00	\N	f	\N
753	2	1308	VL25BDP	nissan	\N	\N	\N	\N	2026-04-27 13:25:33.958905+00	\N	f	\N
754	2	1309	DJ77CLR	mercedes 	sprinter	\N	\N	\N	2026-04-27 13:44:51.690763+00	\N	f	\N
755	2	1310	DJ17ZDB	toiota	\N	\N	\N	\N	2026-04-27 13:46:05.307417+00	\N	f	\N
756	2	1311	B145TTG	FORD	transit custom 	\N	\N	\N	2026-04-27 13:49:39.914929+00	\N	f	\N
757	2	1312	DJ41DAV	renoult	\N	\N	\N	\N	2026-04-27 13:56:57.597841+00	\N	f	\N
758	2	1313	DJ22WXS	vw	tiguan	\N	\N	\N	2026-04-27 14:03:23.210659+00	\N	f	\N
759	2	1314	DJ98YRD	bmw	x5	\N	\N	\N	2026-04-27 14:06:08.401469+00	\N	f	\N
760	2	1315	DJ89SMI	bmw	\N	\N	\N	\N	2026-04-27 14:11:56.076428+00	\N	f	\N
761	2	1316	DJ01WIB	BMW	x1	\N	\N	\N	2026-04-27 14:19:38.267569+00	\N	f	\N
762	2	1318	DJ37KIS	skoda	\N	\N	365000	\N	2026-04-28 05:22:23.550401+00	\N	f	\N
763	2	1320	DJ57LXA	reno captur	\N	\N	\N	\N	2026-04-28 05:31:12.906646+00	\N	f	\N
764	2	1319	DJ25GRS	vw	up	\N	\N	\N	2026-04-28 05:40:46.798618+00	\N	f	\N
765	2	1323	B100HPZ	tesla	3	\N	\N	\N	2026-04-28 05:46:24.567763+00	\N	f	\N
766	2	1321	DJ40EME	skoda	\N	\N	\N	\N	2026-04-28 05:52:14.325003+00	\N	f	\N
767	2	1325	DJ83BAF	skoda super	\N	\N	\N	\N	2026-04-28 06:00:25.55438+00	\N	f	\N
768	2	1328	B444VPV	PORSCHE	MACAN	\N	\N	\N	2026-04-28 06:19:11.515962+00	\N	f	\N
769	2	1327	DJ90BLD	NISSAN 	QASHQAI	\N	\N	\N	2026-04-28 06:32:42.638483+00	\N	f	\N
770	2	1329	DJ83BAF	skoda super	\N	\N	\N	\N	2026-04-28 06:42:26.685634+00	\N	f	\N
771	2	1330	DJ11BGX	\N	\N	\N	\N	\N	2026-04-28 06:42:26.859878+00	\N	f	\N
772	2	1331	DJ35MXR	volvo	\N	\N	\N	\N	2026-04-28 06:52:33.487002+00	\N	f	\N
773	2	1332	DJ37KIS	skoda	\N	\N	365000	\N	2026-04-28 06:57:59.5768+00	\N	f	\N
774	2	1333	DJ42NIK	bmw	5	\N	\N	\N	2026-04-28 06:59:24.009051+00	\N	f	\N
775	2	1334	B911PHA	w transporter	\N	\N	\N	\N	2026-04-28 07:00:14.160735+00	\N	f	\N
776	2	1335	DJ17VRJ	vw	golf	\N	\N	\N	2026-04-28 07:04:36.067274+00	\N	f	\N
778	2	1337	B17NSL	mercedes	\N	\N	\N	\N	2026-04-28 07:13:34.168978+00	\N	f	\N
777	2	1336	DJ25CCD	RENAULT 	\N	\N	\N	\N	2026-04-28 07:11:01.775628+00	\N	f	\N
779	2	1338	DJ13ESR	bmw x5	\N	\N	\N	\N	2026-04-28 07:14:03.062861+00	\N	f	\N
780	2	1339	B700XWB	DACIA	DUSTER	\N	\N	\N	2026-04-28 07:18:53.306722+00	\N	f	\N
781	2	1340	DJ016782	toyota	corolla	\N	\N	\N	2026-04-28 07:27:08.67495+00	\N	f	\N
782	2	1342	DJ89KXN	toyota 	corolla	\N	\N	\N	2026-04-28 07:28:01.31519+00	\N	f	\N
784	2	1341	DJ09UIN	toyota	\N	\N	\N	\N	2026-04-28 07:33:46.829217+00	\N	f	\N
783	2	1343	DJ66DPM	Chevrolet 	aveo	\N	\N	\N	2026-04-28 07:30:46.705448+00	\N	f	\N
785	2	1344	IS80PHA	OPEL 	INSIGNIA	\N	\N	\N	2026-04-28 07:35:45.187677+00	\N	f	\N
786	2	1345	DJ98RED	opel	corsa	\N	\N	\N	2026-04-28 07:38:59.923059+00	\N	f	\N
787	2	1346	DJ66RMN	nissan	\N	\N	\N	\N	2026-04-28 07:42:16.388529+00	\N	f	\N
788	2	1348	DJ32LMD	lexus 	nx300h	\N	\N	\N	2026-04-28 08:02:54.031597+00	\N	f	\N
789	2	1349	DJ20CDO	bmw	520	\N	\N	\N	2026-04-28 08:06:26.670396+00	\N	f	\N
790	2	1347	DJ48ELC	dacia	\N	\N	\N	\N	2026-04-28 08:09:22.410253+00	\N	f	\N
791	2	1350	DJ33JES	mercedes sprinter	\N	\N	\N	\N	2026-04-28 08:20:57.307528+00	\N	f	\N
792	2	1351	DJ20NOV	Hyundai 	santa fe	\N	\N	\N	2026-04-28 08:28:33.318536+00	\N	f	\N
793	2	1355	DJ89LHU	mazda	cx30	\N	\N	\N	2026-04-28 08:42:44.985916+00	\N	f	\N
794	2	1354	GJ37MRC	mercedes	\N	\N	\N	\N	2026-04-28 08:43:48.486999+00	\N	f	\N
795	2	1356	DJ06EDJ	dacia	logan	\N	\N	\N	2026-04-28 08:45:34.132644+00	\N	f	\N
796	2	1357	B994BSC	ssangyong	\N	\N	\N	\N	2026-04-28 08:48:17.68185+00	\N	f	\N
797	2	1358	DJ38AID	kia sportage	\N	\N	\N	\N	2026-04-28 08:50:41.031546+00	\N	f	\N
798	2	1352	DJ55RDW	bmw	\N	\N	\N	\N	2026-04-28 08:55:28.044069+00	\N	f	\N
799	2	1359	DJ17UTU	toyota	corola cros	\N	\N	\N	2026-04-28 08:55:28.707648+00	\N	f	\N
800	2	1360	DJ10WYT	VW	GOLF	\N	\N	\N	2026-04-28 09:01:25.939931+00	\N	f	\N
801	2	1364	B707AMX	MERCEDES	E CLASS	\N	\N	\N	2026-04-28 09:46:48.869772+00	\N	f	\N
802	2	1367	DJ33ACV	toiota rav 4	\N	\N	\N	\N	2026-04-28 10:10:20.018822+00	\N	f	\N
803	2	1366	DJ59DMK	Peugeot 	407	\N	\N	\N	2026-04-28 10:10:31.767162+00	\N	f	\N
804	2	1368	IS25PHA	OPEL	CORSA	\N	\N	\N	2026-04-28 10:11:18.060184+00	\N	f	\N
805	2	1369	DJ79LEX	mercedes	gleA	\N	\N	\N	2026-04-28 10:28:28.693025+00	\N	f	\N
806	2	1371	B263SPA	HYUNDAI	KONA	\N	\N	\N	2026-04-28 10:38:21.266265+00	\N	f	\N
807	2	1372	DJ90KHY	reno katjar	\N	\N	\N	\N	2026-04-28 10:50:48.740379+00	\N	f	\N
808	2	1373	DJ29ASZ	passat	\N	\N	\N	\N	2026-04-28 10:51:10.863203+00	\N	f	\N
809	2	1374	DJ017371	vw	golf	\N	\N	\N	2026-04-28 10:58:41.901561+00	\N	f	\N
810	2	1377	DJ10WAD	AUDI	A 4	\N	\N	\N	2026-04-28 11:06:56.322032+00	\N	f	\N
811	2	1376	DJ31SUA	MERCEDES	gle	\N	\N	\N	2026-04-28 11:06:58.17913+00	\N	f	\N
812	2	1379	DJ90KHY	reno katjar	\N	\N	\N	\N	2026-04-28 11:09:20.795726+00	\N	f	\N
813	2	1381	DJ13WDX	vw	caddy	\N	\N	\N	2026-04-28 11:10:56.552969+00	\N	f	\N
814	2	1380	DJ13FHM	bmv	\N	\N	\N	\N	2026-04-28 11:20:21.124433+00	\N	f	\N
815	2	1382	DJ45EDI	opel	\N	\N	\N	\N	2026-04-28 11:25:06.932595+00	\N	f	\N
816	2	1378	B129TTG	\N	ford	\N	\N	\N	2026-04-28 11:27:56.627929+00	\N	f	\N
817	2	1383	DJ21MBK	SKODA	OCTAVIA 	\N	\N	\N	2026-04-28 11:31:56.939046+00	\N	f	\N
818	2	1384	DJ18AKD	Ford	kuga	\N	\N	\N	2026-04-28 11:50:16.688163+00	\N	f	\N
819	2	1385	DJ74AWD	mazda	cx3	\N	\N	\N	2026-04-28 11:53:49.6187+00	\N	f	\N
820	2	1375	DJ10EPS	toyota	\N	\N	\N	\N	2026-04-28 11:55:16.318075+00	\N	f	\N
821	2	1386	DJ01ECD	toiota c hr	\N	\N	\N	\N	2026-04-28 12:06:00.432136+00	\N	f	\N
822	2	1387	DJ12SWY	logan	\N	\N	\N	\N	2026-04-28 12:16:55.591634+00	\N	f	\N
823	2	1391	DJ75SRJ	vw	touran	\N	195000	\N	2026-04-28 12:34:39.136458+00	\N	f	\N
824	2	1392	DJ38BOL	BMW	X3	\N	\N	\N	2026-04-28 12:36:04.493259+00	\N	f	\N
825	2	1390	DJ01YAY	mercedes	\N	\N	\N	\N	2026-04-28 12:50:39.873312+00	\N	f	\N
826	2	1393	DJ14JJP	vw	tiguan	\N	\N	\N	2026-04-28 13:00:44.788156+00	\N	f	\N
827	2	1394	DJ16FHZ	dacia	logan	\N	\N	\N	2026-04-28 13:01:29.448262+00	\N	f	\N
828	2	1395	DJ37DYM	volvo	\N	\N	\N	\N	2026-04-28 13:07:19.680677+00	\N	f	\N
829	2	1396	DJ77WND	mercedes gle	\N	\N	\N	\N	2026-04-28 13:10:22.882835+00	\N	f	\N
830	2	1397	DJ95ADP	vw	taigo	\N	\N	\N	2026-04-28 13:18:53.732389+00	\N	f	\N
831	2	1398	DJ01SMS	PORSCHE	\N	\N	\N	\N	2026-04-28 13:21:45.877979+00	\N	f	\N
832	2	1399	DJ22VVV	bmw	\N	\N	\N	\N	2026-04-28 13:32:56.315101+00	\N	f	\N
833	2	1400	DJ21XCN	porsche	\N	\N	\N	\N	2026-04-28 13:33:23.579489+00	\N	f	\N
834	2	1402	OT05BTA	bmw x   5	\N	\N	\N	\N	2026-04-28 14:01:20.146528+00	\N	f	\N
835	2	1404	DJ99AXM	BNW	X6	\N	\N	\N	2026-04-28 14:18:44.51219+00	\N	f	\N
836	2	1406	DJ98EWA	skoda	\N	\N	\N	\N	2026-04-29 05:33:35.932447+00	\N	f	\N
837	2	1409	DJ17UMZ	renault	trafic	\N	\N	\N	2026-04-29 05:44:34.202401+00	\N	f	\N
838	2	1410	DJ88NET	mercedes	\N	\N	\N	\N	2026-04-29 05:52:37.573449+00	\N	f	\N
839	2	1411	DJ39MLI	HYUNDAI 	tucson 	\N	\N	\N	2026-04-29 05:55:59.771247+00	\N	f	\N
840	2	1407	DJ09GCB	mercedes	clas e	\N	\N	\N	2026-04-29 06:00:22.864962+00	\N	f	\N
841	2	1405	DJ17CMU	boxer	\N	\N	\N	\N	2026-04-29 06:07:39.143233+00	\N	f	\N
842	2	1412	B232PHA	\N	\N	\N	\N	\N	2026-04-29 06:15:08.725628+00	\N	f	\N
843	2	1413	DJ22TSN	VOLVO	XC60	\N	\N	\N	2026-04-29 06:19:09.888142+00	\N	f	\N
844	2	1414	B882ZRO	hyundai	\N	\N	\N	\N	2026-04-29 06:19:56.330443+00	\N	f	\N
845	2	1415	DJ22CFC	mercedes	\N	\N	\N	\N	2026-04-29 06:38:55.783414+00	\N	f	\N
846	2	1416	CL25ADM	renault	master	\N	\N	\N	2026-04-29 06:39:53.055945+00	\N	f	\N
847	2	1417	B329AXA	BMW	x4	\N	\N	\N	2026-04-29 06:43:23.011569+00	\N	f	\N
848	2	1418	DJ01FAU	MERCEDES	GLA	\N	\N	\N	2026-04-29 07:05:58.036051+00	\N	f	\N
849	2	1419	DJ38RDM	mercedes	vito	\N	\N	\N	2026-04-29 07:11:53.473081+00	\N	f	\N
850	2	1420	DJ39LUX	opel	\N	\N	\N	\N	2026-04-29 07:13:24.069869+00	\N	f	\N
851	2	1421	DJ21TYI	bmw x3	\N	\N	\N	\N	2026-04-29 07:14:53.549931+00	\N	f	\N
852	2	1423	DJ58ADT	vw	gofl	\N	\N	\N	2026-04-29 07:22:30.990856+00	\N	f	\N
853	2	1424	NT52KBE	iveco	\N	\N	\N	\N	2026-04-29 07:36:35.230695+00	\N	f	\N
854	2	1426	DJ97WWW	mercedes	\N	\N	\N	\N	2026-04-29 07:38:39.12143+00	\N	f	\N
855	2	1425	GJ08CRN	mercedes	\N	\N	\N	\N	2026-04-29 07:38:50.925859+00	\N	f	\N
856	2	1427	DJ09XGN	dacia	logan	\N	\N	\N	2026-04-29 07:45:00.250323+00	\N	f	\N
857	2	1430	DJ77NRO	AUDI 	A6 	\N	\N	\N	2026-04-29 08:03:24.16779+00	\N	f	\N
858	2	1431	DJ99NMM	VW	GOLF	\N	\N	\N	2026-04-29 08:05:11.578988+00	\N	f	\N
859	2	1432	B41LUB	renout	megan	\N	\N	\N	2026-04-29 08:11:35.92198+00	\N	f	\N
860	2	1433	GJ18CSM	bmw	7	\N	\N	\N	2026-04-29 08:12:43.565018+00	\N	f	\N
861	2	1429	DJ65AAB	ford puma	\N	\N	\N	\N	2026-04-29 08:13:54.976128+00	\N	f	\N
862	2	1434	B216ELM	ford	transit	\N	\N	\N	2026-04-29 08:17:49.819797+00	\N	f	\N
863	2	1436	DJ33WAA	toyota	\N	\N	\N	\N	2026-04-29 08:28:44.743035+00	\N	f	\N
864	2	1437	DJ01VAD	toyota	gt86	\N	\N	\N	2026-04-29 08:38:31.994252+00	\N	f	\N
865	2	1438	DJ94CAR	mercedes	\N	\N	\N	\N	2026-04-29 08:39:00.395712+00	\N	f	\N
866	2	1441	DJ66KIK	FORD	PUMA	\N	\N	\N	2026-04-29 08:53:26.196656+00	\N	f	\N
867	2	1442	DJ44WRW	mercedes glc	\N	\N	\N	\N	2026-04-29 08:56:51.783655+00	\N	f	\N
868	2	1444	B102VPV	mercedes	\N	\N	\N	\N	2026-04-29 09:23:43.201029+00	\N	f	\N
869	2	1445	DJ20VTC	MERCEDES	GLC	\N	\N	\N	2026-04-29 09:24:00.370978+00	\N	f	\N
870	2	1446	DJ45CNG	ford	\N	\N	\N	\N	2026-04-29 09:26:22.717153+00	\N	f	\N
871	2	1447	DJ32LAC	toyota	\N	\N	\N	\N	2026-04-29 09:40:07.137556+00	\N	f	\N
872	2	1450	DJ09TAN	toiota corolla	\N	\N	\N	\N	2026-04-29 10:01:52.840726+00	\N	f	\N
873	2	1451	DJ57MRU	dacia 	logan	\N	\N	\N	2026-04-29 10:02:44.675637+00	\N	f	\N
874	2	1449	DJ18MJP	opel	\N	\N	\N	\N	2026-04-29 10:14:18.040457+00	\N	f	\N
875	2	1452	DJ12EXZ	toyota	yaris	\N	\N	\N	2026-04-29 10:15:30.333627+00	\N	f	\N
876	2	1453	DJ99MCM	volvo	xc60	\N	\N	\N	2026-04-29 10:23:16.249843+00	\N	f	\N
877	2	1455	DJ11LLL	SEAT	LEON	\N	\N	\N	2026-04-29 10:32:01.504681+00	\N	f	\N
878	2	1456	DJ26JTM	audii	\N	\N	\N	\N	2026-04-29 10:33:08.964101+00	\N	f	\N
879	2	1458	DJ30STY	volvo	xc40	\N	\N	\N	2026-04-29 10:41:03.94656+00	\N	f	\N
880	2	1459	DJ15AZA	skoda	octavia	\N	\N	\N	2026-04-29 11:06:13.366168+00	\N	f	\N
881	2	1460	DJ71REY	bmw	\N	\N	\N	\N	2026-04-29 11:07:34.989613+00	\N	f	\N
882	2	1461	DJ03NXT	dacia	\N	\N	\N	\N	2026-04-29 11:14:28.38873+00	\N	f	\N
883	2	1462	DJ21STK	BMW	X5	\N	\N	\N	2026-04-29 11:17:35.917948+00	\N	f	\N
884	2	1464	DJ39EMC	NISAN	NAVARA	\N	\N	\N	2026-04-29 11:19:17.437159+00	\N	f	\N
885	2	1463	DJ64LKY	bmw	\N	\N	\N	\N	2026-04-29 11:24:29.231619+00	\N	f	\N
886	2	1465	B300MTR	renault	\N	\N	\N	\N	2026-04-29 11:31:25.385749+00	\N	f	\N
887	2	1466	DJ10ASC	bmw	\N	\N	\N	\N	2026-04-29 11:31:39.470067+00	\N	f	\N
888	2	1467	DJ72PAT	mercedes	\N	\N	\N	\N	2026-04-29 11:46:38.652585+00	\N	f	\N
889	2	1469	DJ77LYE	vw	passat	\N	\N	\N	2026-04-29 11:46:59.615051+00	\N	f	\N
890	2	1470	DJ84TUR	mercedes gle	\N	\N	\N	\N	2026-04-29 11:50:09.923716+00	\N	f	\N
891	2	1471	DJ60WSL	VOLVO	XC60	\N	\N	\N	2026-04-29 11:52:23.0108+00	\N	f	\N
892	2	1472	DJ30AVV	mercedes	\N	\N	\N	\N	2026-04-29 11:54:57.849728+00	\N	f	\N
893	2	1474	DJ12XVI	audi	\N	\N	\N	\N	2026-04-29 12:04:45.02177+00	\N	f	\N
894	2	1476	TR41LUP	ford	\N	\N	240000	\N	2026-04-29 12:14:47.889066+00	\N	f	\N
895	2	1477	B611MXS	FORD	FOCUS	\N	\N	\N	2026-04-29 12:23:02.599337+00	\N	f	\N
896	2	1475	DJ37POE	bmw g12	\N	\N	\N	\N	2026-04-29 13:06:05.954453+00	\N	f	\N
897	2	1478	DJ67DMS	KIA	CEED	\N	\N	\N	2026-04-29 13:06:06.249841+00	\N	f	\N
898	2	1479	DJ65MYK	toyota	\N	\N	\N	\N	2026-04-29 13:12:27.797963+00	\N	f	\N
899	2	1481	VL91ADR	seat	\N	\N	\N	\N	2026-04-29 13:22:41.567578+00	\N	f	\N
900	2	1482	DJ26TIS	hyundai	\N	\N	\N	\N	2026-04-29 13:23:54.049245+00	\N	f	\N
901	2	1483	B125HSX	FORD	PUMA	\N	\N	\N	2026-04-29 13:41:59.693423+00	\N	f	\N
902	2	1484	B707XDD	mercedes	gle	\N	\N	\N	2026-04-29 13:48:31.107836+00	\N	f	\N
903	2	1485	MS38HLD	skoda	\N	\N	\N	\N	2026-04-29 13:50:31.205094+00	\N	f	\N
904	2	1486	DJ94WBW	mercedes	gle	\N	\N	\N	2026-04-29 13:50:34.272895+00	\N	f	\N
905	2	1487	DJ28CJU	skoda	\N	\N	\N	\N	2026-04-29 14:01:01.876201+00	\N	f	\N
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
134	2	fizic	bondoc	\N	\N	0761332430	\N	\N	2026-04-02 07:40:13.535299+00	\N	f	\N	\N	\N	DJ77SAA
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
99	2	fizic	sultana iulian	\N	\N	0768836563	\N	\N	2026-04-01 05:35:49.905561+00	\N	f	\N	\N	\N	\N
100	2	fizic	liviu	\N	\N	0769513919	\N	\N	2026-04-01 05:46:09.696499+00	\N	f	\N	\N	ford focus	DJ35MTH
101	2	fizic	valsan bogdan	\N	\N	0765419133	\N	\N	2026-04-01 06:01:48.525761+00	\N	f	\N	\N	\N	\N
102	2	fizic	IONITA RAZVAN	\N	\N	\N	\N	\N	2026-04-01 06:09:30.13186+00	\N	f	\N	\N	\N	DJ17ION
103	2	fizic	capatana bogdan	\N	\N	0723570052	\N	\N	2026-04-01 06:59:25.805094+00	\N	f	\N	\N	\N	\N
104	2	fizic	BADAN LAURENTIU	\N	\N	0773935671	\N	\N	2026-04-01 07:03:16.410421+00	\N	f	\N	\N	\N	DJ01KXN
105	2	juridic	varulean adrian	RO26126852	\N	0721270178	\N	\N	2026-04-01 08:15:23.978937+00	\N	f	\N	\N	porsche	B999ANV
106	2	fizic	TUTUNARU MARIUS	\N	\N	0747370235	\N	\N	2026-04-01 08:26:22.674609+00	\N	f	\N	\N	\N	FORD
107	2	fizic	papusoiu aurel	\N	\N	0784953716	\N	\N	2026-04-01 08:50:30.507418+00	\N	f	\N	\N	\N	\N
108	2	fizic	dobrescu florentin	\N	\N	0723613231	\N	\N	2026-04-01 09:27:28.322417+00	\N	f	\N	\N	\N	\N
109	2	fizic	GABI	\N	\N	0749198585	\N	\N	2026-04-01 09:41:50.376967+00	\N	f	\N	\N	\N	DJ17KZX
110	2	fizic	mitsubishi asx	\N	\N	0727272797	\N	\N	2026-04-01 09:46:17.814875+00	\N	f	\N	\N	toma	DJ33ASX
111	2	fizic	DAN	\N	\N	0767971299	\N	\N	2026-04-01 09:50:35.520293+00	\N	f	\N	\N	\N	\N
112	2	fizic	cioroianu marius	\N	\N	0763691566	\N	\N	2026-04-01 10:14:19.672646+00	\N	f	\N	\N	\N	\N
113	2	fizic	ENE IOM	\N	\N	0744484947	\N	\N	2026-04-01 10:29:31.760027+00	\N	f	\N	\N	opel corsa	DJ13EON
114	2	fizic	SOREANU GABRIEL	\N	\N	0743925292	\N	\N	2026-04-01 10:44:10.149493+00	\N	f	\N	\N	\N	DJ10JOL
115	2	juridic	WONDER MED S.R.L.	43382249	\N	0765 306 209	\N	JUD. DOLJ, MUN. CRAIOVA, STR. HORIA, NR.33	2026-04-01 10:44:27.247451+00	\N	f	\N	\N	\N	\N
116	2	fizic	NITU VALENTIN	\N	\N	0744770692	\N	\N	2026-04-01 11:04:47.072717+00	\N	f	\N	\N	\N	DJ15JDW
117	2	fizic	costi marinescu	\N	\N	0740853846	\N	\N	2026-04-01 11:13:19.442251+00	\N	f	\N	\N	touareg	DJ95TOP
118	2	fizic	tomescu cristian	\N	\N	0732146927	\N	\N	2026-04-01 11:19:16.966339+00	\N	f	\N	\N	\N	\N
119	2	juridic	SIMONA COŞOVEANU PEDIATRIE S.R.L.	42935260	\N	0743 524 804	\N	JUD. DOLJ, MUN. CRAIOVA, PRC. CÂMPUL LIBERTĂŢII 1848, NR.21, VILA 23	2026-04-01 11:27:18.983705+00	\N	f	\N	\N	\N	\N
120	2	fizic	ALIN	\N	\N	0766634194	\N	\N	2026-04-01 11:28:16.101584+00	\N	f	\N	\N	\N	DJ19EYE
121	2	fizic	BARBU FLORIAN	\N	\N	0761055522	\N	\N	2026-04-01 12:06:53.388604+00	\N	f	\N	\N	\N	DJ62RAF
122	2	juridic	AGROLAND AGRIBUSINESS S.A.	37478862	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CAL. BUCUREŞTI, NR.136/1	2026-04-01 12:27:36.504169+00	\N	f	\N	\N	\N	\N
123	2	juridic	union business  travel	RO46639720	PAUNOIU VALENTIN	0773773142	\N	\N	2026-04-01 12:28:14.457256+00	\N	f	\N	\N	\N	DJ03UBT
124	2	juridic	FIVA STROIE S.R.L.	40498398	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. POPOVENI, NR.8, BL.I40, SC.2, AP.2	2026-04-01 12:44:17.699116+00	\N	f	\N	\N	\N	\N
125	2	juridic	pislaru madalin	RO2325645	\N	0722666455	\N	\N	2026-04-01 13:12:15.714063+00	\N	f	\N	\N	\N	B104WPO
126	2	fizic	OPRISAN IULIAN	\N	\N	0744169882	\N	\N	2026-04-01 13:31:22.342276+00	\N	f	\N	\N	\N	OT 07 AZR
127	2	fizic	saninoiu carmen	\N	\N	0765228990	\N	\N	2026-04-02 05:52:40.700566+00	\N	f	\N	\N	\N	\N
128	2	fizic	margineanu constantin	\N	\N	0770954962	\N	\N	2026-04-02 06:15:07.737675+00	\N	f	\N	\N	\N	\N
129	2	fizic	stefan turcu	\N	\N	0728255015	\N	\N	2026-04-02 06:42:11.807834+00	\N	f	\N	\N	\N	\N
130	2	fizic	ion	\N	\N	0740432759	\N	\N	2026-04-02 06:54:29.502704+00	\N	f	\N	\N	\N	DJ11PTK
131	2	fizic	q7	\N	\N	0740432759	\N	\N	2026-04-02 07:09:10.892715+00	\N	f	\N	\N	\N	AUDI
132	2	fizic	ion	\N	\N	0740432759	\N	\N	2026-04-02 07:09:57.673816+00	\N	f	\N	\N	\N	DJ11PTK
133	2	fizic	patrulescu mihai	\N	\N	0723566116	\N	\N	2026-04-02 07:14:02.341435+00	\N	f	\N	\N	\N	DJ40EME
135	2	fizic	DUMITRESCU ALEXANDRU FLORIN	\N	\N	0721 073 914	\N	\N	2026-04-02 07:49:22.894195+00	\N	f	\N	\N	\N	DJ 17 HTF
136	2	juridic	DIVERSINST SRL	RO3730476	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. VASLUI, NR.3	2026-04-02 08:09:33.840023+00	\N	f	\N	\N	\N	\N
137	2	fizic	laurentiu	\N	\N	0745357976	\N	\N	2026-04-02 08:14:12.253202+00	\N	f	\N	\N	\N	DJ76XLA
138	2	fizic	BOLOCAN	\N	\N	0722365002	\N	\N	2026-04-02 08:46:44.324133+00	\N	f	\N	\N	\N	DJ55ECO
139	2	fizic	anca george	\N	\N	0746055859	\N	\N	2026-04-02 09:17:19.089939+00	\N	f	\N	\N	\N	DJ62AGL
140	2	fizic	vladutescu robert	\N	\N	0761352620	\N	\N	2026-04-02 09:37:02.892094+00	\N	f	\N	\N	\N	\N
141	2	fizic	dragosi lefter	\N	\N	0745420639	\N	\N	2026-04-02 10:02:55.80895+00	\N	f	\N	\N	\N	\N
142	2	fizic	florin	\N	\N	0761414171	\N	\N	2026-04-02 10:15:05.810847+00	\N	f	\N	\N	\N	B150TTG
143	2	fizic	ford	\N	\N	0723566745	\N	\N	2026-04-02 10:18:07.930807+00	\N	f	\N	\N	puma st	DJ37HLY
144	2	fizic	dan	\N	\N	0723566745	\N	\N	2026-04-02 10:19:04.276868+00	\N	f	\N	\N	\N	DJ37HLX
145	2	fizic	nkjkkjh	\N	\N	n00000000	\N	\N	2026-04-02 11:02:04.463721+00	\N	f	\N	\N	\N	HHJGG
146	2	fizic	stanmarius	\N	\N	0723693193	\N	\N	2026-04-02 11:12:57.32993+00	\N	f	\N	\N	\N	\N
147	2	fizic	stanuca florin	\N	\N	0770226854	\N	\N	2026-04-02 11:41:47.663349+00	\N	f	\N	\N	\N	DJ 20 DWD
148	2	fizic	teaca daniel	\N	\N	0787263061	\N	\N	2026-04-02 12:00:32.081168+00	\N	f	\N	\N	\N	DJ54TEA
149	2	fizic	claudiu	\N	\N	0770552258	\N	\N	2026-04-02 12:03:11.383185+00	\N	f	\N	\N	\N	DJ18YSE
150	2	fizic	NICOLCIOIU DAN	\N	\N	0723566745	\N	\N	2026-04-02 12:42:29.201097+00	\N	f	\N	\N	\N	DJ73MSD
151	2	fizic	tita marin dan	\N	\N	0746133402	\N	\N	2026-04-02 12:48:57.136769+00	\N	f	\N	\N	\N	\N
152	2	juridic	TEKI GENCOM SRL	RO14194411	TEACA DAN	0768883133	\N	JUD. DOLJ, MUN. CRAIOVA, ALEEA HORTENSIEI, NR.9, BL.154D, SC.1, AP.13	2026-04-02 13:00:11.967319+00	\N	f	\N	\N	\N	\N
153	2	fizic	NISTOR GIGI	\N	\N	0765906455	\N	\N	2026-04-02 13:46:18.458699+00	\N	f	\N	\N	\N	DJ81NIS
154	2	fizic	DOANA STEFANITA	\N	\N	0770290712	\N	\N	2026-04-02 13:46:56.603033+00	\N	f	\N	\N	\N	DGF DM 28
155	2	fizic	doru mihai	\N	\N	0763078972	\N	\N	2026-04-02 13:48:35.193158+00	\N	f	\N	\N	\N	\N
156	2	fizic	dmila	\N	\N	\N	\N	\N	2026-04-03 05:33:35.698475+00	\N	f	\N	\N	\N	VL74DAM
157	2	fizic	georgiana ratoiu	\N	\N	0733943411	\N	\N	2026-04-03 05:41:38.396047+00	\N	f	\N	\N	\N	\N
158	2	fizic	daniel	\N	\N	0768781459	\N	\N	2026-04-03 05:49:21.684409+00	\N	f	\N	\N	\N	DJ26GYO
159	2	fizic	TUDOR	\N	\N	0744160341	\N	\N	2026-04-03 06:03:33.696028+00	\N	f	\N	\N	\N	OT14TUD
160	2	fizic	florin                 gatajescu	\N	\N	0767964036	\N	\N	2026-04-03 06:06:00.82375+00	\N	f	\N	\N	\N	DJ14 GTJ
161	2	fizic	MOSORESCU CRISTIAN	\N	\N	0740203909	\N	\N	2026-04-03 06:13:58.925448+00	\N	f	\N	\N	\N	DJ16MOS
162	2	fizic	bonea danut	\N	\N	0740008479	\N	\N	2026-04-03 06:25:09.649694+00	\N	f	\N	\N	\N	\N
163	2	fizic	mihai	\N	\N	0753403196	\N	\N	2026-04-03 06:25:59.947672+00	\N	f	\N	\N	\N	BT38NIS
164	2	fizic	STAN MARIUS	\N	\N	0723693193	\N	\N	2026-04-03 06:27:37.031017+00	\N	f	\N	\N	\N	DJ15XIA
165	2	fizic	STOIAN VALERICA	\N	\N	0767 553 686	\N	\N	2026-04-03 06:34:39.215589+00	\N	f	\N	\N	\N	\N
166	2	juridic	ELGEKA - FERFELIS ROMANIA SA	RO4071993	\N	\N	\N	MUNICIPIUL BUCUREŞTI, SECTOR 3, STR. DRUMUL INTRE TARLALE, NR.150-158, CAMERA 1, ET.2	2026-04-03 06:36:33.232016+00	\N	f	\N	\N	\N	\N
167	2	fizic	celoiu nicolaie	\N	\N	0742031288	\N	\N	2026-04-03 06:41:57.775632+00	\N	f	\N	\N	\N	\N
168	2	juridic	PLAST - EDILITARE SRL	RO31783484	\N	0722 402 768	\N	JUD. DOLJ, SAT DUDOVICEŞTI COM. ŞIMNICU DE SUS, STR. CRAIOVEI, NR.203	2026-04-03 06:44:10.745874+00	\N	f	\N	\N	\N	CJ 28 UFF
169	2	juridic	CESIVO AGRICULTURA S.R.L.	41001445	\N	\N	\N	JUD. DOLJ, SAT COŞOVENI COM. COŞOVENI, STR. PRINCIPALĂ, NR.45	2026-04-03 06:52:03.102066+00	\N	f	\N	\N	ANV  185,65,15KAUMHO  ECOWING	DJ74CES
170	2	fizic	DRAGAN	\N	\N	\N	\N	\N	2026-04-03 06:59:48.359364+00	\N	f	\N	\N	BAVARIA	MAI60382
171	2	fizic	ciuca cosmin	\N	\N	0742632505	\N	\N	2026-04-03 07:12:21.450792+00	\N	f	\N	\N	\N	\N
172	2	fizic	manolache gabriel	\N	\N	0723660705	\N	\N	2026-04-03 07:14:50.764724+00	\N	f	\N	\N	\N	DJ77LRD
173	2	fizic	CIUPITU FLORI	\N	\N	0787437899	\N	\N	2026-04-03 07:21:30.154496+00	\N	f	\N	\N	\N	DJ09TJH
174	2	fizic	sarbu iliuta	\N	\N	0724665849	\N	\N	2026-04-03 07:37:36.115714+00	\N	f	\N	\N	\N	\N
175	2	fizic	COSMIN SASU	\N	\N	0766277128	\N	\N	2026-04-03 07:41:24.890835+00	\N	f	\N	\N	\N	DJ37SAS
176	2	fizic	cristi	\N	\N	\N	\N	\N	2026-04-03 07:51:31.29843+00	\N	f	\N	\N	\N	\N
177	2	fizic	DRAGOS	\N	\N	0762285737	\N	\N	2026-04-03 07:54:12.956455+00	\N	f	\N	\N	\N	B115JUB
178	2	juridic	METALIMPEX ROMANIA SRL	RO13635501	\N	\N	\N	JUD. ARGEŞ, SAT ARGEŞELU COM. MĂRĂCINENI,  , NR.537C	2026-04-03 07:54:35.660407+00	\N	f	\N	\N	\N	\N
179	2	fizic	iliuta	\N	\N	0724665849	\N	\N	2026-04-03 08:17:28.93215+00	\N	f	\N	\N	\N	DJ02SPM
180	2	fizic	JEGA GABRIEL	\N	\N	0770994458	\N	\N	2026-04-03 08:29:45.482491+00	\N	f	\N	\N	\N	DJ42MDS
181	2	fizic	cioboata alin	\N	\N	0772035515	\N	\N	2026-04-03 08:36:11.143129+00	\N	f	\N	\N	\N	\N
182	2	fizic	RIZA LUCIAN	\N	\N	0722717175	\N	\N	2026-04-03 08:37:40.984751+00	\N	f	\N	\N	\N	DJ11YIY
183	2	fizic	gherla codrin	\N	\N	0745394954	\N	\N	2026-04-03 08:48:53.426948+00	\N	f	\N	\N	\N	DJ01PLU
184	2	fizic	BURDUSEL DRAGOSI	\N	\N	0724077957	\N	\N	2026-04-03 08:57:48.429131+00	\N	f	\N	\N	\N	DJ21BDG
185	2	fizic	popa florin	\N	\N	0787275570	\N	\N	2026-04-03 09:03:34.103887+00	\N	f	\N	\N	\N	DJ77FXI
186	2	fizic	RULESCU  ANDREI	\N	\N	0773759361	\N	\N	2026-04-03 09:08:58.83618+00	\N	f	\N	\N	\N	\N
187	2	fizic	romeo	\N	\N	\N	\N	\N	2026-04-03 09:11:11.499338+00	\N	f	\N	\N	\N	\N
188	2	fizic	rodian	\N	\N	0750813879	\N	\N	2026-04-03 09:24:17.343059+00	\N	f	\N	\N	\N	\N
189	2	fizic	FANE	\N	\N	\N	\N	\N	2026-04-03 09:25:10.481242+00	\N	f	\N	\N	\N	\N
190	2	fizic	fabian stoenica	\N	\N	0733031495	\N	\N	2026-04-03 09:36:03.34813+00	\N	f	\N	\N	\N	\N
191	2	fizic	robert	\N	\N	0756258196	\N	\N	2026-04-03 10:11:10.129858+00	\N	f	\N	\N	\N	DJ22APR
192	2	fizic	eptisa	\N	\N	\N	\N	\N	2026-04-03 10:13:38.805444+00	\N	f	\N	\N	\N	B201EPT
193	2	fizic	neagoe valentin	\N	\N	0761659294	\N	\N	2026-04-03 10:19:45.505127+00	\N	f	\N	\N	\N	\N
194	2	fizic	ionut	\N	\N	0756554926	\N	\N	2026-04-03 10:39:43.51916+00	\N	f	\N	\N	\N	DJ26KZY
195	2	fizic	doru	\N	\N	0733686519	\N	\N	2026-04-03 10:40:12.95146+00	\N	f	\N	\N	\N	DJ19LUD
196	2	fizic	SABIE MARIUS	\N	\N	0769859526	\N	\N	2026-04-03 10:42:28.328132+00	\N	f	\N	\N	\N	B245FRT
197	2	fizic	sirbu liviu	\N	\N	0785010100	\N	\N	2026-04-03 10:48:14.280508+00	\N	f	\N	\N	\N	DJ78SFR
198	2	juridic	MED-GYN TRUŞCĂ S.R.L.	45787770	\N	0722 461 291	\N	JUD. DOLJ, MUN. CRAIOVA, STR. BRAZDA LUI NOVAC, NR.100, BL.40IVA, SC.1, AP.3	2026-04-03 11:10:27.78323+00	\N	f	\N	\N	\N	\N
199	2	fizic	robert	\N	\N	0725505567	\N	\N	2026-04-03 11:35:59.752743+00	\N	f	\N	\N	joc cap bara df	DJ64PAM
200	2	fizic	DANCIULESCU CATALIN	\N	\N	0799107911	\N	\N	2026-04-03 11:43:50.775688+00	\N	f	\N	\N	DINAMIC 92	B126DIN
201	2	fizic	DINU DOREL	\N	\N	0766217239	\N	\N	2026-04-03 11:44:57.208396+00	\N	f	\N	\N	\N	DJ03DYA
202	2	fizic	negrea viorel	\N	\N	0740432759	\N	\N	2026-04-03 11:52:39.593855+00	\N	f	\N	\N	\N	DJ79LRD
203	2	fizic	ALEX POPA	\N	\N	0749269840	\N	\N	2026-04-03 12:06:07.332389+00	\N	f	\N	\N	\N	OT95AXP
204	2	fizic	IORGA GERON	\N	\N	0746598470	\N	\N	2026-04-03 12:08:28.993861+00	\N	f	\N	\N	\N	DJ24JRY
205	2	fizic	mihai florescu	\N	\N	0730853200	\N	\N	2026-04-03 12:18:48.271767+00	\N	f	\N	\N	\N	\N
206	2	fizic	dragos	\N	\N	0727311096	\N	\N	2026-04-03 12:21:48.236069+00	\N	f	\N	\N	\N	DJ99RXF
207	2	fizic	ionescu dragos	\N	\N	0728248840	\N	\N	2026-04-03 12:52:05.567694+00	\N	f	\N	\N	\N	\N
208	2	fizic	tosmac adrian	\N	\N	0727787693	\N	\N	2026-04-03 12:53:07.014946+00	\N	f	\N	\N	\N	OT10AZK
209	2	fizic	CELEA MARINEL	\N	\N	393533451296	\N	\N	2026-04-03 13:02:19.254205+00	\N	f	\N	\N	\N	\N
210	2	fizic	giulea cristian	\N	\N	0765356250	\N	\N	2026-04-03 13:02:32.425357+00	\N	f	\N	\N	\N	\N
211	2	fizic	victor stroescu	\N	\N	0743083659	\N	\N	2026-04-03 13:57:50.809447+00	\N	f	\N	\N	\N	\N
291	2	fizic	paul	\N	\N	0767443266	\N	\N	2026-04-06 14:03:09.052284+00	\N	f	\N	\N	\N	DJ12AIC
212	2	fizic	CATRINA CONSTANTIN	\N	\N	0763227050	\N	\N	2026-04-03 14:05:35.223937+00	\N	f	\N	\N	\N	DJ10VUT
213	2	fizic	popescu cristian	\N	\N	0769055796	\N	\N	2026-04-06 05:29:58.367135+00	\N	f	\N	\N	\N	\N
214	2	juridic	TODOME FERO SRL	RO26228399	\N	\N	\N	JUD. DOLJ, SAT LEU COM. LEU, LEU, TARLAUA 54,PARCELA 3, LOTUL 2(1/2A)	2026-04-06 05:37:27.642198+00	\N	f	\N	\N	\N	\N
215	2	fizic	claudiu	\N	\N	0743294011	\N	\N	2026-04-06 05:41:50.303418+00	\N	f	\N	\N	\N	B173DNC
216	2	fizic	ADRIAN PANA	\N	\N	0730702222	\N	\N	2026-04-06 05:59:26.749238+00	\N	f	\N	\N	\N	MOTO
217	2	fizic	rau gabriel	\N	\N	0745113374	\N	\N	2026-04-06 06:00:10.910935+00	\N	f	\N	\N	\N	DJ75RAU
218	2	fizic	balanoiu	\N	\N	0767034707	\N	\N	2026-04-06 06:06:08.055955+00	\N	f	\N	\N	\N	DJ45BLN
219	2	fizic	STANCIU TUDOR	\N	\N	0723 464 673	\N	\N	2026-04-06 06:12:35.811011+00	\N	f	\N	\N	\N	\N
220	2	fizic	mufi	\N	\N	0748889698	\N	\N	2026-04-06 06:18:33.926215+00	\N	f	\N	\N	\N	\N
221	2	fizic	ardeleanu felix	\N	\N	0769262748	\N	\N	2026-04-06 06:20:37.439528+00	\N	f	\N	\N	\N	DJ30PTL
222	2	fizic	adrian	\N	\N	0745435503	\N	\N	2026-04-06 06:25:14.559732+00	\N	f	\N	\N	\N	DJ21PEC
223	2	fizic	celea marinel	\N	\N	\N	\N	\N	2026-04-06 06:26:44.870487+00	\N	f	\N	\N	\N	\N
224	2	fizic	nicolae	\N	\N	0744572398	\N	\N	2026-04-06 06:47:09.888734+00	\N	f	\N	\N	\N	DJ11MUS
225	2	fizic	STOIAN MARCEL	\N	\N	0770158073	\N	\N	2026-04-06 06:53:37.314501+00	\N	f	\N	\N	\N	\N
226	2	fizic	boiborici daniel	\N	\N	0761117483	\N	\N	2026-04-06 07:02:59.745154+00	\N	f	\N	\N	\N	DJ71DND
227	2	fizic	balana ovidiu	\N	\N	0757170362	\N	\N	2026-04-06 07:08:25.191749+00	\N	f	\N	\N	\N	\N
228	2	fizic	iulian	\N	\N	0741680064	\N	\N	2026-04-06 07:09:28.87159+00	\N	f	\N	\N	\N	DJ89FMX
229	2	fizic	CRISTINA	\N	\N	0752228553	\N	\N	2026-04-06 07:14:13.448101+00	\N	f	\N	\N	\N	CJ24BTT
230	2	juridic	BIROU EXECUTOR JUDECATORESC - IONILETE  RAOL-FLORIN	RO29850727	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ÎNFRĂŢIRII, NR.8, BL.C18, SC.1, AP.3	2026-04-06 07:17:01.431985+00	\N	f	\N	\N	\N	\N
231	2	fizic	qfort	\N	\N	0728828888	\N	\N	2026-04-06 07:27:14.650176+00	\N	f	\N	\N	\N	B341FRT
232	2	fizic	felix	\N	\N	\N	0769262748	\N	2026-04-06 07:30:29.888566+00	\N	f	\N	\N	\N	DJ30PTL
233	2	fizic	cioana dan	\N	\N	0722592301	\N	\N	2026-04-06 07:36:34.21344+00	\N	f	\N	\N	\N	DJ78MRX
234	2	fizic	popescu lucian	\N	\N	0756689148	\N	\N	2026-04-06 07:39:58.305287+00	\N	f	\N	\N	\N	\N
235	2	fizic	ENCULESCU DAN	\N	\N	0753 524 414	\N	\N	2026-04-06 07:46:58.997922+00	\N	f	\N	\N	\N	\N
236	2	fizic	dumitru	\N	\N	0724464027	\N	\N	2026-04-06 07:54:29.890731+00	\N	f	\N	\N	\N	VL22DAN
237	2	fizic	mircea mihai	\N	\N	0723564128	\N	\N	2026-04-06 08:00:30.363829+00	\N	f	\N	\N	\N	\N
238	2	fizic	virgil	\N	\N	0769270350	\N	\N	2026-04-06 08:01:29.10377+00	\N	f	\N	\N	\N	DJ28GIE
239	2	fizic	virgil	\N	\N	\N	\N	\N	2026-04-06 08:02:31.844336+00	\N	f	\N	\N	\N	DJ78GIE
240	2	juridic	DR. IVANOV LYUBOMIR S.R.L.	42420050	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. VALTER MĂRĂCINEANU, NR.4B	2026-04-06 08:08:43.57915+00	\N	f	\N	\N	\N	\N
241	2	fizic	dumitru mircea	\N	\N	0754022501	\N	\N	2026-04-06 08:13:42.277065+00	\N	f	\N	\N	\N	\N
242	2	fizic	emilian	\N	\N	0745822870	\N	\N	2026-04-06 08:17:36.352963+00	\N	f	\N	\N	\N	DJ26EAM
243	2	fizic	durau nicu	\N	\N	0741124494	\N	\N	2026-04-06 08:18:47.226268+00	\N	f	\N	\N	\N	DJ87LNA
244	2	fizic	ciprian	\N	\N	0733030451	\N	\N	2026-04-06 08:48:41.113992+00	\N	f	\N	\N	\N	DJ44MTY
245	2	juridic	VENDING & SERVICE SOLUTIONS PBR SRL	RO29718913	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, ALEEA 6 MAGNOLIA, NR.1	2026-04-06 08:53:05.429571+00	\N	f	\N	\N	\N	\N
246	2	fizic	barbulescu florin	\N	\N	0761932836	\N	\N	2026-04-06 08:54:01.517515+00	\N	f	\N	\N	\N	\N
247	2	fizic	mihai	\N	\N	0764286742	\N	\N	2026-04-06 09:10:20.937684+00	\N	f	\N	\N	\N	DJ20GXM
248	2	fizic	tolos ciprian	\N	\N	0761384345	\N	\N	2026-04-06 09:10:39.218869+00	\N	f	\N	\N	\N	DJ89CIP
249	2	fizic	dobre alin	\N	\N	0761414166	\N	\N	2026-04-06 09:25:16.310605+00	\N	f	\N	\N	\N	\N
250	2	fizic	ionut	\N	\N	0758900110	\N	\N	2026-04-06 09:26:48.671825+00	\N	f	\N	\N	\N	DJ09CFC
251	2	fizic	iancu maria	\N	\N	0761564689	\N	\N	2026-04-06 09:29:28.410035+00	\N	f	\N	\N	\N	B955TIO
252	2	juridic	AWIM EXPERT SRL	26676546	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. CAROL I, NR.150, BL.C1, SC.1, AP.5	2026-04-06 09:30:27.418039+00	\N	f	\N	\N	\N	\N
253	2	fizic	mif prev psi	\N	\N	0766707868	\N	\N	2026-04-06 09:34:36.252528+00	\N	f	\N	\N	\N	\N
254	2	fizic	mic cristian	\N	\N	0738060907	\N	\N	2026-04-06 09:53:32.571501+00	\N	f	\N	\N	\N	DJ66MYC
255	2	fizic	zglimbea dan	\N	\N	0722602710	\N	\N	2026-04-06 09:59:13.113383+00	\N	f	\N	\N	\N	\N
256	2	fizic	iulian	\N	\N	0726688181	\N	\N	2026-04-06 10:02:50.344422+00	\N	f	\N	\N	\N	B50MHX
257	2	fizic	ilie	\N	\N	\N	\N	\N	2026-04-06 10:08:29.804166+00	\N	f	\N	\N	\N	OT02MZN
258	2	fizic	isarescu	\N	\N	0762567041	\N	\N	2026-04-06 10:19:10.913058+00	\N	f	\N	\N	\N	GJ55YRA
259	2	fizic	costi	\N	\N	0761354856	\N	\N	2026-04-06 10:20:10.086447+00	\N	f	\N	\N	\N	\N
260	2	fizic	cosmin	\N	\N	0747333311	\N	\N	2026-04-06 10:24:38.559309+00	\N	f	\N	\N	\N	DJ81CLC
261	2	fizic	florian	\N	\N	0766707868	\N	\N	2026-04-06 10:33:02.47096+00	\N	f	\N	\N	\N	OT08MIF
262	2	juridic	WAL SOLUTIONS S.R.L.	RO47726132	\N	\N	\N	JUD. OLT, ORŞ. BALŞ, STR. PLOPULUI, NR.18A	2026-04-06 10:41:38.078717+00	\N	f	\N	\N	\N	\N
263	2	fizic	mircea	\N	\N	0722662985	\N	\N	2026-04-06 10:48:26.952536+00	\N	f	\N	\N	\N	DJ85WKS
264	2	fizic	catalin	\N	\N	0770794366	\N	\N	2026-04-06 10:50:08.460709+00	\N	f	\N	\N	\N	DJ82MOD
265	2	juridic	PIESE KOSKOMON UTILAJE S.R.L.	RO39928939	\N	0742 036 076	\N	\N	2026-04-06 10:55:01.386478+00	\N	f	\N	\N	\N	\N
266	2	fizic	cornel	\N	\N	\N	\N	\N	2026-04-06 10:59:58.130222+00	\N	f	\N	\N	\N	GJ60SND
267	2	fizic	stanescu	\N	\N	\N	\N	\N	2026-04-06 11:08:25.657844+00	\N	f	\N	\N	\N	DJ55YRA
268	2	fizic	HALDEA GABI	\N	\N	0766 368 615	\N	\N	2026-04-06 11:10:14.440213+00	\N	f	\N	\N	\N	\N
269	2	fizic	mugescu tiberiu	\N	\N	0766663337	\N	\N	2026-04-06 11:20:33.038683+00	\N	f	\N	\N	\N	DJ84ZHO
270	2	fizic	radu	\N	\N	0767989859	\N	\N	2026-04-06 11:40:49.898404+00	\N	f	\N	\N	\N	DJ18CNF
271	2	fizic	catargena rada	\N	\N	0724478866	\N	\N	2026-04-06 11:43:39.474391+00	\N	f	\N	\N	\N	DJ12CAR
272	2	fizic	balaci marian	\N	\N	0761646467	\N	\N	2026-04-06 11:49:33.600549+00	\N	f	\N	\N	\N	\N
273	2	fizic	marian	\N	\N	0771216170	\N	\N	2026-04-06 11:57:36.194924+00	\N	f	\N	\N	\N	DJ57PTC
274	2	fizic	catana ionel	\N	\N	0744794546	\N	\N	2026-04-06 11:57:39.426648+00	\N	f	\N	\N	\N	DJ24XTX
275	2	fizic	bundur alexandru	\N	\N	0762878083	\N	\N	2026-04-06 12:11:42.107478+00	\N	f	\N	\N	\N	DJ96WID
276	2	fizic	tibi	\N	\N	0766663337	\N	\N	2026-04-06 12:24:35.534785+00	\N	f	\N	\N	\N	DJ84ZHO
277	2	fizic	golumbeanu bogdan	\N	\N	0784588452	\N	\N	2026-04-06 12:28:53.864861+00	\N	f	\N	\N	\N	GJ03MEG
278	2	fizic	DUMITRICA DUMITRU	\N	\N	0722 148 618	\N	\N	2026-04-06 12:30:00.821544+00	\N	f	\N	\N	\N	\N
279	2	fizic	dan sfeta	\N	\N	0767370061	\N	\N	2026-04-06 12:33:46.658955+00	\N	f	\N	\N	\N	\N
280	2	fizic	muscalagiu nicolae	\N	\N	0754439797	\N	\N	2026-04-06 12:38:48.226632+00	\N	f	\N	\N	\N	DJ50MUS
281	2	fizic	MANESCU DRAGOS	\N	\N	0740091432	\N	\N	2026-04-06 12:43:29.965328+00	\N	f	\N	\N	\N	B816DVR
282	2	fizic	pleniceanu lidia	\N	\N	0747097920	\N	\N	2026-04-06 12:55:05.156941+00	\N	f	\N	\N	\N	\N
283	2	fizic	VLAD	\N	\N	0724293244	\N	\N	2026-04-06 13:16:10.508943+00	\N	f	\N	\N	\N	DJ08SVT
284	2	fizic	bmw	\N	\N	\N	\N	\N	2026-04-06 13:27:54.344432+00	\N	f	\N	\N	\N	DJ98LRI
285	2	fizic	grigoruta isabela	\N	\N	07622	\N	\N	2026-04-06 13:29:48.040356+00	\N	f	\N	\N	\N	\N
286	2	fizic	SIMODE	\N	\N	\N	\N	\N	2026-04-06 13:34:57.346553+00	\N	f	\N	\N	\N	DJ10MIC
287	2	fizic	GABRIEL PETRIA	\N	\N	0720510580	\N	\N	2026-04-06 13:37:12.035388+00	\N	f	\N	\N	\N	DJ16HSD
288	2	fizic	fiedler dorina	\N	\N	0741072059	\N	\N	2026-04-06 13:46:43.234198+00	\N	f	\N	\N	\N	\N
289	2	juridic	DAVID`S STAR DISTRIBUTION S.R.L.	RO43441353	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. GEORGE ENESCU, NR.74, BL.17, SC.4, AP.5	2026-04-06 13:49:45.383172+00	\N	f	\N	\N	\N	\N
290	2	fizic	BOGDAN	\N	\N	0771626876	\N	\N	2026-04-06 13:53:02.887187+00	\N	f	\N	\N	\N	DJ17HRL
292	2	fizic	cosmin covaci	\N	\N	0733439093	\N	\N	2026-04-06 14:18:37.298081+00	\N	f	\N	\N	\N	MOTO
293	2	juridic	TOPSERV MOTORS SRL	ro16462065	\N	0760369697	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CAL. BUCUREŞTI, NR.139/6	2026-04-06 14:21:06.425445+00	\N	f	\N	\N	\N	\N
1235	2	fizic	cotea mihai	\N	\N	0745607647	\N	\N	2026-04-27 05:36:32.632244+00	\N	f	\N	\N	\N	\N
1237	2	fizic	dolana	\N	\N	0721798052	\N	\N	2026-04-27 05:49:15.451728+00	\N	f	\N	\N	\N	\N
1239	2	fizic	gheorghita andrei	\N	\N	0786376533	\N	\N	2026-04-27 05:59:42.834838+00	\N	f	\N	\N	\N	\N
1253	2	fizic	IONUT	\N	\N	0761644514	\N	\N	2026-04-27 07:43:32.628699+00	\N	f	\N	\N	\N	\N
1254	2	fizic	giulio	\N	\N	0724119388	\N	\N	2026-04-27 07:46:44.338735+00	\N	f	\N	\N	\N	\N
1255	2	juridic	DALICOS COM SRL	RO2303981	\N	0722263142	\N	JUD. DOLJ, MUN. CRAIOVA, ALEEA 3 CASTANILOR, NR.10, BL.F, SC.1, AP.2	2026-04-27 07:59:28.811905+00	\N	f	\N	\N	\N	\N
1273	2	fizic	bmw	\N	\N	\N	\N	\N	2026-04-27 09:53:10.862758+00	\N	f	\N	\N	\N	\N
1292	2	fizic	petrescu costin	\N	\N	0726244942	\N	\N	2026-04-27 11:41:02.977131+00	\N	f	\N	\N	\N	\N
1295	2	fizic	cristi	\N	\N	0790188045	\N	\N	2026-04-27 11:50:29.971896+00	\N	f	\N	\N	\N	\N
1309	2	fizic	smeu gabriel	\N	\N	0769456601	\N	\N	2026-04-27 13:44:48.010721+00	\N	f	\N	\N	\N	\N
1313	2	juridic	OLTENIA FRUCT SRL	33003801	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. GEORGE FOTINO, NR.7, BL.8, SC.3, AP.5	2026-04-27 14:03:21.950301+00	\N	f	\N	\N	\N	\N
1314	2	fizic	madalin	\N	\N	\N	\N	\N	2026-04-27 14:05:50.921129+00	\N	f	\N	\N	\N	\N
1316	2	fizic	BUCUR IOAN	\N	\N	0742297516	\N	\N	2026-04-27 14:18:57.210268+00	\N	f	\N	\N	\N	\N
1328	2	juridic	METALCOM SRL	RO6778720	\N	0752122921	\N	JUD. DOLJ, MUN. CRAIOVA, CAL. BUCUREŞTI, NR.191	2026-04-28 06:19:09.431+00	\N	f	\N	\N	\N	\N
1343	2	fizic	marcel	\N	\N	074887079	\N	\N	2026-04-28 07:30:16.575592+00	\N	f	\N	\N	\N	\N
1355	2	fizic	munteanu mirabela	\N	\N	0746418037	\N	\N	2026-04-28 08:42:09.844022+00	\N	f	\N	\N	\N	\N
1359	2	fizic	dinca dan	\N	\N	0744304662	\N	\N	2026-04-28 08:54:53.659419+00	\N	f	\N	\N	\N	\N
1362	2	fizic	POLISEA	\N	\N	0723202041	\N	\N	2026-04-28 09:08:45.969056+00	\N	f	\N	\N	\N	\N
1374	2	fizic	octavian	\N	\N	0747199288	\N	\N	2026-04-28 10:58:33.544419+00	\N	f	\N	\N	\N	\N
1375	2	fizic	DINULESCU IONUT	\N	\N	0723 575 176	\N	\N	2026-04-28 11:01:57.168781+00	2026-04-28 11:30:17.587798+00	f	\N	\N	\N	\N
1390	2	fizic	bazavan dragos	\N	\N	0741040607	\N	\N	2026-04-28 12:33:00.816376+00	\N	f	\N	\N	\N	\N
1406	2	fizic	cobotea alin	\N	\N	0761293312	\N	\N	2026-04-29 05:33:27.838885+00	\N	f	\N	\N	\N	\N
1410	2	fizic	iancu catalin	\N	\N	0740098178	\N	\N	2026-04-29 05:52:34.746899+00	\N	f	\N	\N	\N	\N
1422	2	fizic	SCINTEIE PETRE	\N	\N	0762298139	\N	\N	2026-04-29 07:19:44.725934+00	\N	f	\N	\N	km36000	\N
1430	2	fizic	MIRCEA NEGRILA	\N	\N	0740098178	\N	\N	2026-04-29 08:02:21.288134+00	\N	f	\N	\N	\N	\N
1429	2	fizic	RICU COSMIN	\N	\N	0768 366 497	\N	\N	2026-04-29 07:49:37.840984+00	2026-04-29 08:13:50.296919+00	f	\N	\N	\N	\N
1441	2	fizic	PANTUCU	\N	\N	\N	\N	\N	2026-04-29 08:52:36.955828+00	\N	f	\N	\N	\N	\N
1464	2	juridic	ELECTROMONTAJ	\N	\N	0765722407	\N	\N	2026-04-29 11:18:45.483174+00	\N	f	\N	\N	\N	\N
1482	2	fizic	flori	\N	\N	0765041397	\N	\N	2026-04-29 13:23:49.852286+00	\N	f	\N	\N	\N	\N
294	2	fizic	cotea  mihai	\N	\N	0745607647	\N	\N	2026-04-06 14:29:44.115278+00	\N	f	\N	\N	\N	DJ01WTE
1236	2	fizic	mitrache iulian	\N	\N	0766900438	\N	\N	2026-04-27 05:47:04.612933+00	\N	f	\N	\N	\N	\N
1259	2	fizic	popescu catalin	\N	\N	0769491149	\N	\N	2026-04-27 08:22:47.987735+00	\N	f	\N	\N	\N	\N
1263	2	fizic	FLORIN	\N	\N	0761 172 286	\N	\N	2026-04-27 08:39:26.103626+00	2026-04-27 09:06:41.219597+00	f	\N	\N	\N	\N
1276	2	fizic	nicolaescu	\N	\N	0737014255	\N	\N	2026-04-27 10:18:00.230404+00	\N	f	\N	\N	\N	\N
1280	2	fizic	danut	\N	\N	0770273889	\N	\N	2026-04-27 10:31:19.438781+00	\N	f	\N	\N	\N	\N
1293	2	fizic	LICA DANUT	\N	\N	0740131771	\N	\N	2026-04-27 11:47:38.395447+00	\N	f	\N	\N	\N	\N
1310	2	fizic	afrem lidia	\N	\N	0756044970	\N	\N	2026-04-27 13:45:58.866947+00	\N	f	\N	\N	\N	\N
1311	2	fizic	CLAUDIU OLARIU	\N	\N	0741063263	\N	\N	2026-04-27 13:46:52.894196+00	\N	f	\N	\N	\N	\N
1317	2	fizic	CRISTI GHERASIM	\N	\N	\N	\N	\N	2026-04-27 14:19:36.090753+00	\N	f	\N	\N	\N	\N
1329	2	fizic	florian	\N	\N	0723230953	\N	\N	2026-04-28 06:42:04.996646+00	\N	f	\N	\N	\N	\N
1344	2	fizic	GAPSEA CRISTIAN	\N	\N	0752654609	\N	\N	2026-04-28 07:34:26.373893+00	\N	f	\N	\N	\N	\N
1356	2	juridic	ASOCIAŢIA DE DEZVOLTARE INTERCOMUNITARĂ DE GESTIONARE A DEŞEURILOR "ECODOLJ"	26186870	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. NICOLAE TITULESCU, NR.22, ET.1, AP.CORP B	2026-04-28 08:45:32.044484+00	\N	f	\N	\N	\N	\N
1376	2	fizic	DINU ALEXANDRU	\N	\N	0774420474	\N	\N	2026-04-28 11:05:31.509807+00	\N	f	\N	\N	\N	\N
1379	2	fizic	daniel	\N	\N	0763672751	\N	\N	2026-04-28 11:09:01.761638+00	\N	f	\N	\N	\N	\N
1383	2	fizic	BICA MARIUS	\N	\N	0742978333	\N	\N	2026-04-28 11:31:28.814741+00	\N	f	\N	\N	\N	\N
1393	2	fizic	cristi	\N	\N	0724584549	\N	\N	2026-04-28 13:00:14.552237+00	\N	f	\N	\N	\N	\N
1408	2	fizic	CASA NOASTRA      POPESCU STEFAN	\N	\N	0763645160	\N	\N	2026-04-29 05:42:54.943337+00	2026-04-29 05:43:34.569093+00	f	\N	\N	km18029	\N
1423	2	fizic	andrei	\N	\N	0767160824	\N	\N	2026-04-29 07:22:17.821264+00	\N	f	\N	\N	\N	\N
1434	2	juridic	electromontaje	\N	\N	\N	\N	\N	2026-04-29 08:17:48.585432+00	\N	f	\N	\N	\N	\N
1444	2	juridic	victor trica	ro6778720	\N	0752122921	\N	\N	2026-04-29 09:23:38.344111+00	\N	f	\N	\N	\N	\N
1465	2	juridic	MATRA SRL	ro6287579	avram sorin	0757551022	\N	JUD. OLT, ORŞ. SCORNICEŞTI, BLD. MUNCII, BL.69L1, SC.A, AP.2	2026-04-29 11:31:07.825052+00	\N	f	\N	\N	\N	\N
1466	2	fizic	claudiu	\N	\N	0744788581	\N	\N	2026-04-29 11:31:32.4481+00	\N	f	\N	\N	\N	\N
1483	2	juridic	KLASS-WAGEN SRL	RO17197919	\N	0785538447	\N	JUD. TIMIŞ, MUN. TIMIŞOARA, BLD. 16 DECEMBRIE 1989, NR.35, AP.2 CAMERA 2	2026-04-29 13:41:37.2681+00	\N	f	\N	\N	\N	\N
1484	2	fizic	DRAGOS SCARLAT	\N	\N	0767557937	\N	\N	2026-04-29 13:46:49.000069+00	\N	f	\N	\N	\N	\N
295	2	fizic	cotea	\N	\N	0745607647	\N	\N	2026-04-06 14:30:25.701293+00	\N	f	\N	\N	\N	DJ01WTE
296	2	fizic	cocheci razvan	\N	\N	0740058938	\N	\N	2026-04-07 05:45:13.433205+00	\N	f	\N	\N	\N	DJ78MLS
297	2	fizic	BARBU COSTINEL	\N	\N	0765323766	\N	\N	2026-04-07 05:59:14.624462+00	\N	f	\N	\N	\N	DJ66BBU
298	2	fizic	virtosu mihaela	\N	\N	0766398619	\N	\N	2026-04-07 06:14:07.973144+00	\N	f	\N	\N	\N	\N
299	2	fizic	CALIN ELVIS	\N	\N	0722 873 621	\N	\N	2026-04-07 06:16:17.846771+00	\N	f	\N	\N	\N	\N
300	2	fizic	george	\N	\N	0740303735	\N	\N	2026-04-07 06:29:41.609317+00	\N	f	\N	\N	\N	DJ88AAE
301	2	fizic	ion	\N	\N	0720044127	\N	\N	2026-04-07 06:36:45.187443+00	\N	f	\N	\N	\N	DJ27KIO
302	2	fizic	OBRETIN	\N	\N	0766814227	\N	\N	2026-04-07 06:47:33.095452+00	\N	f	\N	\N	\N	DJ 87 DRO
303	2	fizic	baran daniel	\N	\N	0768395505	\N	\N	2026-04-07 07:01:00.924339+00	\N	f	\N	\N	\N	DJ86BRN
304	2	fizic	PARSU CONSTANTIN	\N	\N	0723722089	\N	\N	2026-04-07 07:01:47.971162+00	\N	f	\N	\N	\N	B119DWW
305	2	fizic	fieraru catalin	\N	\N	0765110480	\N	\N	2026-04-07 07:15:17.652182+00	\N	f	\N	\N	\N	\N
306	2	fizic	TUFISI ION	\N	\N	0764147747	\N	\N	2026-04-07 07:15:36.426467+00	\N	f	\N	\N	\N	GJ64NKY
307	2	fizic	VLAD	\N	\N	0724293244	\N	\N	2026-04-07 07:17:18.594689+00	\N	f	\N	\N	\N	DJ 12 SVT
308	2	fizic	VLAD	\N	\N	0724293244	\N	\N	2026-04-07 07:18:08.151399+00	\N	f	\N	\N	\N	DJ12SVT
309	2	fizic	goghez	\N	\N	0720541203	\N	\N	2026-04-07 07:45:21.840353+00	\N	f	\N	\N	\N	ESNT8601
310	2	fizic	zorila valentin	\N	\N	0761334037	\N	\N	2026-04-07 07:49:08.48107+00	\N	f	\N	\N	\N	\N
311	2	fizic	FRUNZA MARIUS	\N	\N	0773981987	\N	\N	2026-04-07 07:52:23.135045+00	\N	f	\N	\N	\N	DJ52ELF
312	2	fizic	MIHAELA	\N	\N	0730062620	\N	\N	2026-04-07 07:57:15.846557+00	\N	f	\N	\N	\N	DJ18CZU
313	2	fizic	octavian	\N	\N	0765505101	\N	\N	2026-04-07 07:58:00.18144+00	\N	f	\N	\N	\N	DJ19DCB
314	2	fizic	COSMIN SASU	\N	\N	0766277128	\N	\N	2026-04-07 08:11:27.835082+00	\N	f	\N	\N	\N	DJ73SAS
315	2	fizic	POPESCU VICTOR	\N	\N	0745688443	\N	\N	2026-04-07 08:15:00.365414+00	\N	f	\N	\N	\N	\N
316	2	fizic	calina nelu	\N	\N	0766555768	\N	\N	2026-04-07 08:37:26.053243+00	\N	f	\N	\N	\N	\N
317	2	fizic	SCARLATESCU ROBERT	\N	\N	0757013975	\N	\N	2026-04-07 08:39:48.789746+00	\N	f	\N	\N	\N	DJ75RSC
318	2	fizic	VERA BARBU	\N	\N	0765400107	\N	\N	2026-04-07 08:41:58.846345+00	\N	f	\N	\N	\N	\N
319	2	fizic	ALEXANDRA	\N	\N	\N	\N	\N	2026-04-07 08:47:17.856322+00	\N	f	\N	\N	\N	DJ48SFI
320	2	fizic	cosmin sasu	\N	\N	0766277128	\N	\N	2026-04-07 08:50:53.565821+00	\N	f	\N	\N	\N	DJ77TLX
321	2	fizic	SADOVEANU DAN	\N	\N	0765248612	\N	\N	2026-04-07 09:20:23.037123+00	\N	f	\N	\N	\N	DJ42MAS
322	2	fizic	electroflux	\N	\N	\N	\N	\N	2026-04-07 09:21:28.312639+00	\N	f	\N	\N	\N	\N
323	2	fizic	DANIEL	\N	\N	0742157904	\N	\N	2026-04-07 09:37:22.803502+00	\N	f	\N	\N	\N	B803PRM
324	2	fizic	sanda cornel	\N	\N	0766949901	\N	\N	2026-04-07 09:56:13.0513+00	\N	f	\N	\N	\N	B660SND
325	2	juridic	PROMA MACHINERY SRL	19062560	\N	\N	\N	MUNICIPIUL BUCUREŞTI, SECTOR 3, STR BURNIŢEI, NR.24, BIROUL B84, ET.1	2026-04-07 10:03:46.501036+00	\N	f	\N	\N	\N	\N
326	2	fizic	ALMAJANU NICOLAE	\N	\N	0769219219	\N	\N	2026-04-07 10:06:29.375006+00	\N	f	\N	\N	\N	TR07ALM
327	2	fizic	mihai luta	\N	\N	0724454136	\N	\N	2026-04-07 10:34:02.581268+00	\N	f	\N	\N	\N	DJ30LMI
328	2	fizic	dumitrascu mihai	\N	\N	0740131754	\N	\N	2026-04-07 10:34:03.881932+00	\N	f	\N	\N	\N	\N
329	2	fizic	FLORIN ILIE	\N	\N	0755043755	\N	\N	2026-04-07 10:39:01.714411+00	\N	f	\N	\N	\N	DJ13GLM
330	2	fizic	NEDELCU ANDREI	\N	\N	0773 788 519	\N	\N	2026-04-07 10:41:01.479958+00	\N	f	\N	\N	\N	\N
331	2	fizic	ALIN	\N	\N	0773839835	\N	\N	2026-04-07 10:44:25.27244+00	\N	f	\N	\N	\N	DJ77CHR
332	2	fizic	MARIAN	\N	\N	0773348456	\N	\N	2026-04-07 10:48:20.409347+00	\N	f	\N	\N	\N	DJ13ZAZ
333	2	juridic	next maintenance	RO32232548	SAIZU CRISTIAN	0768061411	\N	\N	2026-04-07 10:54:29.302115+00	\N	f	\N	\N	\N	DJ39NXT
334	2	fizic	ALIN	\N	\N	\N	\N	\N	2026-04-07 10:59:25.436217+00	\N	f	\N	\N	\N	DJ70CHR
335	2	fizic	mircea	\N	\N	\N	\N	\N	2026-04-07 11:09:08.285295+00	\N	f	\N	\N	\N	DJ93GMA
336	2	fizic	GHEONEA	\N	\N	\N	\N	\N	2026-04-07 11:12:25.873988+00	\N	f	\N	\N	\N	WP63RLY
337	2	fizic	RAZVAN	\N	\N	07960783474	\N	\N	2026-04-07 11:19:41.836035+00	\N	f	\N	\N	\N	\N
338	2	fizic	MARIN	\N	\N	0032493937322	\N	\N	2026-04-07 11:47:06.340722+00	\N	f	\N	\N	\N	2AFN034
339	2	fizic	marcu florin	\N	\N	0762867773	\N	\N	2026-04-07 11:55:08.12333+00	\N	f	\N	\N	\N	\N
340	2	fizic	ionut	\N	\N	0765027179	\N	\N	2026-04-07 12:06:25.577829+00	\N	f	\N	\N	\N	OT25WAG
341	2	juridic	LKW STORE & SERVICES S.R.L.	26425331	\N	\N	\N	JUD. DOLJ, SAT BRANIŞTE COM. PODARI, STR. CALAFATULUI, NR.117, T22. P1	2026-04-07 12:11:32.683559+00	\N	f	\N	\N	\N	\N
342	2	fizic	maiuru	\N	\N	0761662930	\N	\N	2026-04-07 12:23:40.852229+00	\N	f	\N	\N	\N	\N
343	2	fizic	OLARIUL DANIEL	\N	\N	0745534671	\N	\N	2026-04-07 12:38:12.897422+00	\N	f	\N	\N	\N	DJ49DGE
344	2	fizic	gherman david	\N	\N	0762698286	\N	\N	2026-04-07 12:47:01.564455+00	\N	f	\N	\N	\N	\N
345	2	fizic	ciocan alin	\N	\N	0767299405	\N	\N	2026-04-07 13:04:48.906243+00	\N	f	\N	\N	\N	DJ29DVY
346	2	fizic	andreescu cosmin	\N	\N	0752448521	\N	\N	2026-04-07 13:14:37.032296+00	\N	f	\N	\N	\N	\N
347	2	fizic	daniel	\N	\N	0770536897	\N	\N	2026-04-07 13:31:48.001833+00	\N	f	\N	\N	\N	DJ43DEY
348	2	fizic	POPESCU GEANI	\N	\N	0740 995 425	\N	\N	2026-04-07 13:33:45.879969+00	\N	f	\N	\N	\N	\N
349	2	fizic	nicu	\N	\N	0756131916	\N	\N	2026-04-07 13:52:00.393176+00	\N	f	\N	\N	\N	\N
350	2	fizic	SPIRIDON DANIEL	\N	\N	0799615853	\N	\N	2026-04-07 14:08:18.281357+00	\N	f	\N	\N	\N	DJ06SDL
351	2	fizic	toyota	\N	\N	\N	\N	\N	2026-04-07 14:08:58.555242+00	\N	f	\N	\N	\N	DJ03PRO
352	2	juridic	ENDO SCAN S.R.L.	46623660	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR MĂRĂŞEŞTI, NR.1	2026-04-07 14:18:23.739825+00	\N	f	\N	\N	\N	\N
353	2	fizic	sandu	\N	\N	0032493937322	\N	\N	2026-04-07 14:18:57.433969+00	\N	f	\N	\N	\N	2HOR857
354	2	fizic	Alex Gligor	\N	\N	\N	\N	\N	2026-04-07 22:26:44.639565+00	\N	f	\N	\N	\N	\N
355	2	fizic	ALEX	\N	\N	0739473877	\N	\N	2026-04-08 05:48:05.060746+00	\N	f	\N	\N	\N	\N
356	2	juridic	PHARMA SA	RO13591928	\N	\N	\N	JUD. IAŞI, MUN. IAŞI, ŞOS. BUCIUM, NR.73E	2026-04-08 05:50:57.884043+00	\N	f	\N	\N	\N	\N
357	2	fizic	nastasie marian	\N	\N	0726603056	\N	\N	2026-04-08 05:51:35.758258+00	\N	f	\N	\N	\N	\N
358	2	fizic	DIMIAN ALIN	\N	\N	0766308096	\N	\N	2026-04-08 06:13:20.490817+00	\N	f	\N	\N	\N	\N
359	2	fizic	COSMIN TITU	\N	\N	0742028461	\N	\N	2026-04-08 06:23:35.518531+00	\N	f	\N	\N	\N	\N
360	2	fizic	CIUCA CLAUDIU	\N	\N	0763 573 458	\N	\N	2026-04-08 06:26:55.153449+00	\N	f	\N	\N	\N	\N
361	2	fizic	bonea iliean	\N	\N	0745237552	\N	\N	2026-04-08 06:27:00.192907+00	\N	f	\N	\N	\N	\N
362	2	fizic	voicu	\N	\N	0770051032	\N	\N	2026-04-08 06:29:39.014619+00	\N	f	\N	\N	\N	\N
363	2	fizic	FLORIN	\N	\N	0767302604	\N	\N	2026-04-08 06:39:41.7493+00	\N	f	\N	\N	\N	\N
364	2	fizic	VERONICA	\N	\N	0770568234	\N	\N	2026-04-08 06:49:06.750237+00	\N	f	\N	\N	\N	\N
365	2	fizic	ALEXANDRU	\N	\N	0766672896	\N	\N	2026-04-08 06:59:48.969998+00	\N	f	\N	\N	\N	\N
366	2	fizic	manescu  dragosi	\N	\N	0740091432	\N	\N	2026-04-08 07:16:12.967589+00	\N	f	\N	\N	\N	\N
367	2	fizic	stoian marinela 0765967502	\N	\N	\N	\N	\N	2026-04-08 07:25:08.261301+00	\N	f	\N	\N	\N	\N
368	2	fizic	CAZACU MARIN CLAUDIU	\N	\N	0765617083	\N	\N	2026-04-08 07:31:21.854866+00	\N	f	\N	\N	\N	\N
369	2	fizic	boicea adrian	\N	\N	0748207378	\N	\N	2026-04-08 07:33:50.351664+00	\N	f	\N	\N	\N	\N
370	2	fizic	ARGENTOIANU Florin	\N	\N	0723150985	\N	\N	2026-04-08 07:44:27.430694+00	\N	f	\N	\N	\N	\N
371	2	fizic	zavoi paul	\N	\N	0744921271	\N	\N	2026-04-08 07:44:36.609692+00	\N	f	\N	\N	\N	\N
373	2	fizic	MIA SORIN	\N	\N	0786 414 142	\N	\N	2026-04-08 07:55:30.719952+00	\N	f	\N	\N	\N	\N
372	2	fizic	GORUN RAZVAN	\N	\N	0728 135 837	\N	\N	2026-04-08 07:46:05.091746+00	2026-04-08 08:20:48.465574+00	f	\N	\N	\N	\N
374	2	fizic	MANDA ION	\N	\N	0770115582	\N	\N	2026-04-08 08:31:45.024901+00	\N	f	\N	\N	\N	\N
375	2	fizic	MANOLACHE COSMIN	\N	\N	0765 846 483	\N	\N	2026-04-08 08:42:05.816487+00	\N	f	\N	\N	\N	\N
376	2	juridic	CEREALCOM DOLJ SRL	RO9646278	\N	\N	\N	JUD. DOLJ, ORŞ. SEGARCEA, STR. REPUBLICII, NR.3, LOC.SEGARCEA	2026-04-08 08:42:35.380642+00	\N	f	\N	\N	\N	\N
377	2	fizic	gabriel	\N	\N	0767389589	\N	\N	2026-04-08 08:56:33.965929+00	\N	f	\N	\N	\N	\N
378	2	fizic	IONUT	\N	\N	0767152391	\N	\N	2026-04-08 08:57:03.276484+00	\N	f	\N	\N	\N	\N
379	2	fizic	DANIEL MARIUTA	\N	\N	0765469238	\N	\N	2026-04-08 09:04:18.501294+00	\N	f	\N	\N	\N	\N
380	2	fizic	ticudeanu andrei	\N	\N	0740222364	\N	\N	2026-04-08 09:08:19.751701+00	\N	f	\N	\N	\N	\N
381	2	fizic	NITU TIBERIU	\N	\N	0744770692	\N	\N	2026-04-08 09:12:27.320018+00	\N	f	\N	\N	\N	\N
382	2	fizic	FERBIER BOGDAN	\N	\N	0731 165 590	\N	\N	2026-04-08 09:27:03.821222+00	\N	f	\N	\N	\N	\N
383	2	fizic	HALDEA ANDREA	\N	\N	0768030842	\N	\N	2026-04-08 09:27:38.984499+00	\N	f	\N	\N	\N	\N
384	2	fizic	MULTESCU FLAVIUS	\N	\N	0769697670	\N	\N	2026-04-08 09:35:22.309741+00	\N	f	\N	\N	\N	\N
385	2	juridic	AMI GASTRO SRL	RO25718112	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ION MAIORESCU, NR.5, BL.4, SC.A, AP.11	2026-04-08 09:53:43.398669+00	\N	f	\N	\N	\N	\N
386	2	fizic	PANCOMEXIM0740250504	\N	\N	0740250504	\N	\N	2026-04-08 09:59:57.799986+00	\N	f	\N	\N	\N	\N
387	2	fizic	silviu	\N	\N	0765469268	\N	\N	2026-04-08 10:16:25.226742+00	\N	f	\N	\N	\N	\N
388	2	fizic	MARINESCU CATALIN	\N	\N	0766294869	\N	\N	2026-04-08 10:33:55.156449+00	\N	f	\N	\N	\N	\N
389	2	fizic	marius gelu	\N	\N	0722676796	\N	\N	2026-04-08 10:39:12.465251+00	\N	f	\N	\N	\N	\N
390	2	fizic	qfort	\N	\N	\N	\N	\N	2026-04-08 10:41:48.279835+00	\N	f	\N	\N	\N	\N
391	2	fizic	MILA ALIN	\N	\N	0743 010 908	\N	\N	2026-04-08 10:43:14.990117+00	\N	f	\N	\N	\N	\N
392	2	fizic	romanescu florin	\N	\N	0722787685	\N	\N	2026-04-08 11:10:44.893329+00	\N	f	\N	\N	\N	\N
393	2	fizic	adrian	\N	\N	0722279391	\N	\N	2026-04-08 11:15:40.727665+00	\N	f	\N	\N	\N	\N
394	2	fizic	vilcea alina maria	\N	\N	0744507959	\N	\N	2026-04-08 11:22:00.827182+00	\N	f	\N	\N	\N	\N
396	2	fizic	mihai	\N	\N	0768562262	\N	\N	2026-04-08 11:40:10.470704+00	\N	f	\N	\N	\N	\N
397	2	juridic	POP INDUSTRY SRL	6759221	\N	\N	\N	JUD. OLT, MUN. SLATINA, STR. CIREAŞOV, NR.12	2026-04-08 11:48:55.090216+00	\N	f	\N	\N	\N	\N
398	2	fizic	oprea c tin	\N	\N	0767684322	\N	\N	2026-04-08 11:58:50.135824+00	\N	f	\N	\N	\N	\N
399	2	fizic	fronie	\N	\N	\N	\N	\N	2026-04-08 12:06:07.416814+00	\N	f	\N	\N	\N	\N
400	2	fizic	NICOLA NUTI	\N	\N	0723167428	\N	\N	2026-04-08 12:17:22.254143+00	\N	f	\N	\N	\N	\N
395	2	fizic	BURLAN MARIUS	\N	\N	0774 479 968	\N	\N	2026-04-08 11:34:37.683986+00	2026-04-08 12:19:42.486864+00	f	\N	\N	\N	\N
401	2	fizic	mihai	\N	\N	0756169059	\N	\N	2026-04-08 12:39:47.485589+00	\N	f	\N	\N	\N	\N
402	2	fizic	radu ana maria	\N	\N	0746022303	\N	\N	2026-04-08 12:41:16.382135+00	\N	f	\N	\N	\N	\N
403	2	fizic	CALIN GHERCEA SILVIU	\N	\N	0784185555	\N	\N	2026-04-08 12:57:02.8525+00	\N	f	\N	\N	\N	\N
404	2	fizic	client	\N	\N	\N	\N	\N	2026-04-08 13:01:40.80532+00	\N	f	\N	\N	\N	\N
405	2	fizic	alex mitrica	\N	\N	0787865926	\N	\N	2026-04-08 13:20:00.218834+00	\N	f	\N	\N	\N	\N
406	2	fizic	TEACA ALIN	\N	\N	0724049835	\N	\N	2026-04-08 13:28:43.469251+00	\N	f	\N	\N	\N	\N
407	2	fizic	popescu emanuel	\N	\N	07665686	\N	\N	2026-04-08 13:33:30.797612+00	\N	f	\N	\N	\N	\N
408	2	fizic	DINU CORNEL	\N	\N	0723052845	\N	\N	2026-04-08 13:35:18.695268+00	\N	f	\N	\N	\N	\N
409	2	fizic	ADRIAN	\N	\N	0744366459	\N	\N	2026-04-08 13:52:36.924803+00	\N	f	\N	\N	\N	\N
410	2	fizic	rares	\N	\N	0771678570	\N	\N	2026-04-08 13:54:42.018444+00	\N	f	\N	\N	\N	\N
411	2	fizic	COMAN	\N	\N	0740178517	\N	\N	2026-04-08 14:09:30.519931+00	\N	f	\N	\N	\N	\N
412	2	fizic	mirea alexandru	\N	\N	0722544855	\N	\N	2026-04-09 05:37:00.859957+00	\N	f	\N	\N	\N	\N
413	2	fizic	ANGHEL ALIN	\N	\N	0741012507	\N	\N	2026-04-09 05:37:42.489184+00	\N	f	\N	\N	\N	\N
414	2	fizic	BIVOLARU CATALIN	\N	\N	0741252075	\N	\N	2026-04-09 05:41:13.350627+00	\N	f	\N	\N	\N	\N
415	2	fizic	COSTI	\N	\N	0766639367	\N	\N	2026-04-09 05:45:11.840061+00	\N	f	\N	\N	\N	\N
417	2	fizic	popa catalin	\N	\N	0724151316	\N	\N	2026-04-09 05:49:07.254889+00	\N	f	\N	\N	\N	\N
418	2	juridic	PRINTEX S.R.L.	RO6590814	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, CALEA BUCURESTI, NR.14, BL.A14, SC.1, AP.13	2026-04-09 05:49:35.62866+00	\N	f	\N	\N	\N	\N
416	2	fizic	DONDERA GHEORGHE	\N	\N	0741 220 897	\N	\N	2026-04-09 05:47:57.447916+00	2026-04-09 05:49:39.263338+00	f	\N	\N	\N	\N
419	2	fizic	DAVID CLAUDIU	\N	\N	0745209239	\N	\N	2026-04-09 06:06:39.379233+00	\N	f	\N	\N	bucsi brate fata rupte	\N
420	2	fizic	RADOMIREANU FLORIAN	\N	\N	0741236967	\N	\N	2026-04-09 06:13:33.867257+00	\N	f	\N	\N	\N	\N
421	2	fizic	qfort	\N	\N	\N	\N	\N	2026-04-09 06:16:19.096339+00	2026-04-09 06:17:39.203442+00	f	\N	\N	\N	\N
422	2	fizic	ionascu costinel	\N	\N	0760022446	\N	\N	2026-04-09 06:18:54.017604+00	\N	f	\N	\N	\N	\N
423	2	fizic	albert	\N	\N	0768424646	\N	\N	2026-04-09 06:21:16.557262+00	\N	f	\N	\N	\N	\N
424	2	fizic	ionut	\N	\N	0746393703	\N	\N	2026-04-09 06:38:01.496733+00	\N	f	\N	\N	\N	\N
425	2	fizic	BUICA SORIN	\N	\N	0756816816	\N	\N	2026-04-09 06:42:22.312236+00	\N	f	\N	\N	\N	\N
426	2	fizic	demetrescu	\N	\N	0724505650	\N	\N	2026-04-09 06:44:17.183997+00	\N	f	\N	\N	\N	\N
427	2	fizic	cristian	\N	\N	0723110024	\N	\N	2026-04-09 06:50:54.754858+00	\N	f	\N	\N	\N	\N
428	2	fizic	argentoianu	\N	\N	0723150985	\N	\N	2026-04-09 06:56:14.137969+00	\N	f	\N	\N	\N	\N
429	2	fizic	CIUCA IULIAN	\N	\N	0762 883 247	\N	\N	2026-04-09 06:58:41.066889+00	\N	f	\N	\N	\N	\N
430	2	fizic	matei	\N	\N	0733891557	\N	\N	2026-04-09 07:05:26.947407+00	\N	f	\N	\N	\N	\N
431	2	fizic	olteanu stefan	\N	\N	0768862091	\N	\N	2026-04-09 07:12:28.762996+00	\N	f	\N	\N	\N	\N
432	2	fizic	ovidiu	\N	\N	0757431645	\N	\N	2026-04-09 07:12:46.104864+00	\N	f	\N	\N	\N	\N
433	2	juridic	NOVARIS ENERGY S.R.L.	48679063	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. LĂMÎIŢEI, NR.2, BL.K9, SC.1, AP.4	2026-04-09 07:21:06.154511+00	\N	f	\N	\N	\N	\N
434	2	fizic	PREDESCU MARIUS	\N	\N	0748207374	\N	\N	2026-04-09 07:34:42.165691+00	\N	f	\N	\N	\N	\N
436	2	fizic	tufisi andrei	\N	\N	0735196655	\N	\N	2026-04-09 07:42:55.896142+00	\N	f	\N	\N	\N	\N
437	2	fizic	VIORICA SAPOI	\N	\N	0748129482	\N	\N	2026-04-09 07:46:44.756667+00	\N	f	\N	\N	\N	\N
438	2	fizic	adrian	\N	\N	\N	\N	\N	2026-04-09 07:56:53.67419+00	\N	f	\N	\N	\N	\N
439	2	fizic	nicoleta	\N	\N	0745292348	\N	\N	2026-04-09 08:05:10.66235+00	\N	f	\N	\N	\N	\N
440	2	fizic	DUMITRU SARACIN	\N	\N	0749582139	\N	\N	2026-04-09 08:07:17.850488+00	\N	f	\N	\N	\N	\N
441	2	fizic	BEMSA	\N	\N	0752775100	\N	\N	2026-04-09 08:08:16.047847+00	\N	f	\N	\N	\N	\N
442	2	fizic	plosca liviu	\N	\N	0787656619	\N	\N	2026-04-09 08:11:43.087113+00	\N	f	\N	\N	\N	\N
443	2	fizic	STANCIULESCU FLORIN	\N	\N	0724553745	\N	\N	2026-04-09 08:15:32.73934+00	\N	f	\N	\N	\N	\N
444	2	fizic	SIRBU CALIN	\N	\N	0724303096	\N	\N	2026-04-09 08:24:24.682301+00	\N	f	\N	\N	\N	\N
445	2	fizic	iulian	\N	\N	\N	\N	\N	2026-04-09 08:25:08.860813+00	\N	f	\N	\N	\N	\N
446	2	fizic	EUGEN STOICA	\N	\N	0774688663	\N	\N	2026-04-09 08:26:54.019997+00	\N	f	\N	\N	\N	\N
447	2	fizic	luiza	\N	\N	0723650300	\N	\N	2026-04-09 08:31:23.716243+00	\N	f	\N	\N	\N	\N
1238	2	fizic	silviu	\N	\N	0744558877	\N	\N	2026-04-27 05:50:44.185341+00	\N	f	\N	\N	\N	\N
449	2	fizic	DRAGOS	\N	\N	0737725060	\N	\N	2026-04-09 08:42:22.737365+00	\N	f	\N	\N	\N	\N
450	2	fizic	DOFILITA       DANIEL	\N	\N	0766676589	\N	\N	2026-04-09 08:43:15.406533+00	\N	f	\N	\N	\N	\N
451	2	juridic	Bavaria service	\N	\N	\N	\N	\N	2026-04-09 08:44:22.836601+00	\N	f	\N	\N	\N	\N
435	2	fizic	BALAN PAUL	\N	\N	0768 459 018	\N	\N	2026-04-09 07:40:10.666131+00	2026-04-09 08:48:26.225171+00	f	\N	\N	\N	\N
452	2	fizic	ionut dinu	\N	\N	0799494913	\N	\N	2026-04-09 08:50:36.956725+00	\N	f	\N	\N	\N	\N
24	2	fizic	LICA LICA	\N	\N	07666666666	\N	\N	2026-03-26 07:19:29.659197+00	2026-04-09 08:58:00.809347+00	f	\N	\N	\N	\N
453	2	fizic	popescu emil	\N	\N	0756550398	\N	\N	2026-04-09 08:58:38.324399+00	\N	f	\N	\N	\N	\N
454	2	fizic	ACRIVOPOL RARES	\N	\N	0747044460	\N	\N	2026-04-09 09:05:51.278791+00	\N	f	\N	\N	\N	\N
455	2	fizic	mihai	\N	\N	0756029776	\N	\N	2026-04-09 09:11:50.69401+00	\N	f	\N	\N	\N	\N
456	2	fizic	stancu marius	\N	\N	\N	0766417135	\N	2026-04-09 09:18:16.989961+00	\N	f	\N	\N	\N	\N
457	2	fizic	cristian	\N	\N	0736191392	\N	\N	2026-04-09 09:18:46.724733+00	\N	f	\N	\N	\N	\N
458	2	fizic	emil popescu	\N	\N	\N	\N	\N	2026-04-09 09:20:55.710066+00	\N	f	\N	\N	\N	\N
459	2	juridic	PRESTJOINT MED S.R.L.	38762306	\N	0743122002	\N	JUD. DOLJ, MUN. CRAIOVA, STR. DR. DIMITRIE GEROTA, NR.6, BL.A10, SC.1, AP.8	2026-04-09 09:23:20.778134+00	\N	f	\N	\N	\N	\N
1260	2	fizic	vasile daniel	\N	\N	0784131351	\N	\N	2026-04-27 08:26:42.265458+00	\N	f	\N	\N	\N	\N
461	2	fizic	PARASCHIV MARIAN	\N	\N	0770 501 151	\N	\N	2026-04-09 09:31:28.551715+00	\N	f	\N	\N	\N	\N
460	2	fizic	DAN	\N	\N	0034642293759	\N	\N	2026-04-09 09:27:17.129417+00	2026-04-09 09:34:00.579647+00	f	\N	\N	\N	\N
465	2	fizic	bortoi manuel	\N	\N	0731999761	\N	\N	2026-04-09 09:53:24.888673+00	\N	f	\N	\N	\N	\N
1240	2	fizic	iovan	\N	\N	0766998762	\N	\N	2026-04-27 06:17:09.837287+00	\N	f	\N	\N	\N	\N
1241	2	fizic	MARINESCU LIVIU	\N	\N	0770201350	\N	\N	2026-04-27 06:24:49.1836+00	\N	f	\N	\N	\N	\N
1242	2	fizic	florin vasiloiu	\N	\N	0744921478	\N	\N	2026-04-27 06:33:13.081584+00	\N	f	\N	\N	\N	\N
1261	2	fizic	pantucu c tin	\N	\N	0723666427	\N	\N	2026-04-27 08:29:07.700577+00	\N	f	\N	\N	\N	\N
1277	2	fizic	sandu	\N	\N	0786035603	\N	\N	2026-04-27 10:26:52.160097+00	\N	f	\N	\N	\N	\N
1278	2	fizic	ARNAUTU CRISTI	\N	\N	\N	\N	\N	2026-04-27 10:27:17.126364+00	\N	f	\N	\N	\N	\N
1294	2	fizic	alexandru lupu	\N	\N	0764455737	\N	\N	2026-04-27 11:48:46.474562+00	\N	f	\N	\N	\N	\N
1298	2	fizic	cosimin	\N	\N	0741507972	\N	\N	2026-04-27 12:10:12.479998+00	\N	f	\N	\N	\N	\N
1312	2	fizic	asan virgil	\N	\N	0747113652	\N	\N	2026-04-27 13:56:50.301279+00	\N	f	\N	\N	\N	\N
1315	2	fizic	simigiu	\N	\N	0724297782	\N	\N	2026-04-27 14:11:49.916075+00	\N	f	\N	\N	\N	\N
1330	2	fizic	ovidiu	\N	\N	0766361658	\N	\N	2026-04-28 06:42:22.664546+00	\N	f	\N	\N	\N	\N
1332	2	fizic	DUMITRESCU	\N	\N	0762670035	\N	\N	2026-04-28 06:57:37.591037+00	\N	f	\N	\N	\N	\N
1345	2	fizic	raduta ana	\N	\N	0745028993	\N	\N	2026-04-28 07:38:58.224422+00	\N	f	\N	\N	\N	\N
1346	2	fizic	iancu mugurel	\N	\N	0766562113	\N	\N	2026-04-28 07:41:59.420767+00	\N	f	\N	\N	\N	\N
1349	2	fizic	diaconu cosmin	\N	\N	0762079415	\N	\N	2026-04-28 08:05:58.541838+00	\N	f	\N	\N	\N	\N
1357	2	fizic	tugui daniel	\N	\N	0740915405	\N	\N	2026-04-28 08:48:09.490314+00	\N	f	\N	\N	\N	\N
1377	2	fizic	ANTONIE VALENTIN	\N	\N	0722607950	\N	\N	2026-04-28 11:06:25.355744+00	\N	f	\N	\N	\N	\N
1381	2	fizic	simion	\N	\N	0784903248	\N	\N	2026-04-28 11:10:55.524986+00	\N	f	\N	\N	\N	\N
1382	2	fizic	chichi	\N	\N	0755205610	\N	\N	2026-04-28 11:24:59.174289+00	\N	f	\N	\N	\N	\N
1394	2	fizic	alexandru	\N	\N	0744361420	\N	\N	2026-04-28 13:01:28.269636+00	\N	f	\N	\N	\N	\N
1397	2	fizic	alex	\N	\N	0740971101	\N	\N	2026-04-28 13:18:35.909272+00	\N	f	\N	\N	\N	\N
1399	2	fizic	radu	\N	\N	0731661269	\N	\N	2026-04-28 13:24:26.516069+00	\N	f	\N	\N	\N	\N
1412	2	fizic	GRIGORIE	\N	\N	0758926772	\N	\N	2026-04-29 06:14:34.285308+00	\N	f	\N	\N	\N	\N
1415	2	fizic	cirstea	\N	\N	0751935355	\N	\N	2026-04-29 06:23:09.054808+00	\N	f	\N	\N	\N	\N
1425	2	fizic	luis	\N	\N	0737354469	\N	\N	2026-04-29 07:38:22.735846+00	\N	f	\N	\N	\N	\N
1435	2	fizic	MATEI MIHAI     AGROLAND	\N	\N	0720046826	\N	\N	2026-04-29 08:19:05.615758+00	2026-04-29 08:19:34.289152+00	f	\N	\N	\N	\N
1446	2	fizic	ciuta gheorghe	\N	\N	0720379219	\N	\N	2026-04-29 09:26:19.091693+00	\N	f	\N	\N	\N	\N
1449	2	fizic	vali	\N	\N	0724320205	\N	\N	2026-04-29 09:57:04.332903+00	\N	f	\N	\N	\N	\N
1450	2	fizic	talpeanu	\N	\N	07217555444	\N	\N	2026-04-29 10:01:50.724667+00	\N	f	\N	\N	\N	\N
1469	2	fizic	denis	\N	\N	0767161201	\N	\N	2026-04-29 11:46:42.32768+00	\N	f	\N	\N	\N	\N
1475	2	fizic	GLIGA	\N	\N	0784 122 420	\N	\N	2026-04-29 12:10:41.107737+00	2026-04-29 13:05:33.467204+00	f	\N	\N	ALIN	\N
1485	2	fizic	roman luiza	\N	\N	0751108892	\N	\N	2026-04-29 13:49:18.356931+00	2026-04-29 14:06:11.508372+00	f	\N	\N	\N	\N
462	2	fizic	CIUNGU ALEXANDRA	\N	\N	0768 360 127	\N	\N	2026-04-09 09:32:59.183737+00	2026-04-09 10:52:50.327727+00	f	\N	\N	\N	\N
1243	2	fizic	mustafa octavian	\N	\N	0724340907	\N	\N	2026-04-27 06:40:29.271757+00	\N	f	\N	\N	\N	\N
1245	2	fizic	andrei voiculescu	\N	\N	0746302420	\N	\N	2026-04-27 07:01:17.228645+00	\N	f	\N	\N	\N	\N
1246	2	fizic	ion	\N	\N	0723506321	\N	\N	2026-04-27 07:02:23.206328+00	\N	f	\N	\N	\N	\N
1262	2	fizic	cosmin	\N	\N	0761694501	\N	\N	2026-04-27 08:34:59.380862+00	\N	f	\N	\N	\N	\N
1267	2	fizic	Brezoi danut	\N	\N	0744815042	\N	\N	2026-04-27 09:01:10.03936+00	\N	f	\N	\N	\N	\N
1270	2	fizic	nicola masrius	\N	\N	0760677927	\N	\N	2026-04-27 09:18:40.468814+00	\N	f	\N	\N	\N	\N
1279	2	fizic	vava mihai	\N	\N	0747990084	\N	\N	2026-04-27 10:28:58.982826+00	\N	f	\N	\N	\N	\N
1296	2	fizic	adrian	\N	\N	0724581106	\N	\N	2026-04-27 11:51:01.479777+00	\N	f	\N	\N	\N	\N
1300	2	fizic	cristian	\N	\N	\N	\N	\N	2026-04-27 12:28:44.73776+00	\N	f	\N	\N	\N	\N
1318	2	fizic	cristi	\N	\N	0762670035	\N	\N	2026-04-28 05:22:14.57423+00	\N	f	\N	\N	\N	\N
1321	2	fizic	mihai	\N	\N	0723566116	\N	\N	2026-04-28 05:43:07.103392+00	\N	f	\N	\N	\N	\N
1331	2	fizic	mihai	\N	\N	0763698251	\N	\N	2026-04-28 06:52:13.237913+00	\N	f	\N	\N	\N	\N
1347	2	fizic	SANDU	\N	\N	0766 462 047	\N	\N	2026-04-28 07:46:10.042115+00	\N	f	\N	\N	\N	\N
1358	2	fizic	voicu valentin	\N	\N	0739884916	\N	\N	2026-04-28 08:50:39.933243+00	\N	f	\N	\N	\N	\N
1360	2	fizic	COJOCARU VASILE	\N	\N	0744223832	\N	\N	2026-04-28 09:01:13.523087+00	\N	f	\N	\N	\N	\N
1380	2	fizic	florescu	\N	\N	0743080598	\N	\N	2026-04-28 11:10:12.792735+00	\N	f	\N	\N	\N	\N
1378	2	juridic	TECHNO TEAM GROUP S.R.L.	ro34308561	\N	\N	\N	JUD. DOLJ, COM. MALU MARE, STR HENRY FORD, NR.20	2026-04-28 11:07:35.464138+00	2026-04-28 11:27:48.429639+00	f	\N	\N	\N	\N
1395	2	fizic	diaconu	\N	\N	0721298611	\N	\N	2026-04-28 13:07:15.006219+00	\N	f	\N	\N	\N	\N
1400	2	fizic	neamtu marius cristian	\N	\N	0757033888	\N	\N	2026-04-28 13:32:45.024764+00	\N	f	\N	\N	\N	\N
1413	2	fizic	TISAN CRISTIAN	\N	\N	0723685619	\N	\N	2026-04-29 06:19:07.381159+00	\N	f	\N	\N	\N	\N
1417	2	fizic	ADRIAN MECU	\N	\N	0725510801	\N	\N	2026-04-29 06:43:20.122978+00	\N	f	\N	\N	\N	\N
1426	2	fizic	anghel lucian	\N	\N	0741034959	\N	\N	2026-04-29 07:38:37.697346+00	\N	f	\N	\N	\N	\N
1447	2	juridic	FANTANELE SANTOUR SPORT SRL	14092578	\N	\N	\N	JUD. DOLJ, SAT FÂNTÂNELE COM. RADOVAN	2026-04-29 09:39:51.92653+00	\N	f	\N	\N	\N	\N
1470	2	fizic	grigorie cristian	\N	\N	0745259500	\N	\N	2026-04-29 11:50:08.275014+00	\N	f	\N	\N	\N	\N
1472	2	fizic	VLAD AVRAM	\N	\N	0728186168	\N	\N	2026-04-29 11:54:56.787706+00	\N	f	\N	\N	\N	\N
1473	2	fizic	CIROMAT	\N	\N	0753312716	\N	\N	2026-04-29 12:03:07.285746+00	\N	f	\N	\N	km526510	\N
1486	2	fizic	barbosu eugen	\N	\N	0725521521	\N	\N	2026-04-29 13:50:25.205121+00	\N	f	\N	\N	\N	\N
1487	2	fizic	carju bogdan	\N	\N	0741262134	\N	\N	2026-04-29 13:59:57.223373+00	\N	f	\N	\N	\N	\N
463	2	fizic	bogdan	\N	\N	0738563801	\N	\N	2026-04-09 09:33:53.201115+00	\N	f	\N	\N	\N	\N
464	2	fizic	olteanu alin	\N	\N	0724048884	\N	\N	2026-04-09 09:52:16.939082+00	\N	f	\N	\N	\N	\N
466	2	fizic	ducu vasile	\N	\N	0773801225	\N	\N	2026-04-09 09:59:14.937637+00	\N	f	\N	\N	\N	\N
448	2	fizic	NEAGU DANIEL	\N	\N	0738 827 557	\N	\N	2026-04-09 08:37:40.316608+00	2026-04-09 10:03:15.541766+00	f	\N	\N	\N	\N
467	2	fizic	popesccu	\N	\N	072246392	\N	\N	2026-04-09 10:06:59.773006+00	\N	f	\N	\N	\N	\N
468	2	fizic	qfort	\N	\N	\N	\N	\N	2026-04-09 10:12:29.155474+00	\N	f	\N	\N	\N	\N
470	2	juridic	WESTGATE ROMANIA SRL	17017651	\N	\N	\N	MUNICIPIUL BUCUREŞTI, SECTOR 5, BLD TUDOR VLADIMIRESCU, NR.29A, BIROUL 50. AFI TECH PARK 1, ET.5	2026-04-09 10:23:00.599819+00	\N	f	\N	\N	\N	\N
471	2	fizic	bildea laura	\N	\N	0741282552	\N	\N	2026-04-09 10:26:24.180417+00	\N	f	\N	\N	\N	\N
472	2	fizic	POPA MIHAI	\N	\N	0727375133	\N	\N	2026-04-09 10:31:03.86935+00	\N	f	\N	\N	\N	\N
473	2	fizic	radu	\N	\N	0755757825	\N	\N	2026-04-09 10:45:13.97094+00	\N	f	\N	\N	\N	\N
475	2	fizic	manuela lungu	\N	\N	0723523276	\N	\N	2026-04-09 10:55:23.036724+00	\N	f	\N	\N	\N	\N
476	2	fizic	rotaru alin	\N	\N	0744762302	\N	\N	2026-04-09 10:55:34.757473+00	\N	f	\N	\N	\N	\N
477	2	fizic	FLORIN GHERGHINA	\N	\N	0745239489	\N	\N	2026-04-09 11:04:33.489533+00	\N	f	\N	\N	\N	\N
478	2	fizic	COBANU DANIEL	\N	\N	0726951493	\N	\N	2026-04-09 11:16:52.030103+00	\N	f	\N	\N	\N	\N
479	2	fizic	DANIEL ACHIM	\N	\N	0721215491	\N	\N	2026-04-09 11:19:17.873173+00	\N	f	\N	\N	RTT	\N
480	2	fizic	sifos arpad	\N	\N	0745181892	\N	\N	2026-04-09 11:20:18.960249+00	\N	f	\N	\N	\N	\N
481	2	fizic	cerna marina	\N	\N	0742231333	\N	\N	2026-04-09 11:25:20.994878+00	\N	f	\N	\N	\N	\N
469	2	fizic	RADUCANU MITEL RAZVAN	\N	\N	0770 979 817	\N	\N	2026-04-09 10:20:27.516067+00	2026-04-09 11:44:56.327727+00	f	\N	\N	\N	\N
482	2	fizic	MOSOIU DANIEL	\N	\N	0743171719	\N	\N	2026-04-09 11:48:53.551331+00	\N	f	\N	\N	\N	\N
483	2	fizic	GESTADMIN	\N	\N	0767806200	\N	\N	2026-04-09 12:00:45.186015+00	\N	f	\N	\N	\N	\N
474	2	juridic	IOSIF  IOANA - CADASTRU	40407705	\N	0723 226 396	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, STR. MAGNOLIA, NR.86	2026-04-09 10:53:40.124223+00	2026-04-09 12:04:56.23025+00	f	\N	\N	\N	\N
484	2	juridic	ALINIMI FARM SRL	31144170	\N	\N	\N	JUD. DOLJ, SAT SADOVA COM. SADOVA, STR. DR. ŞTEFAN IORGULESCU, NR.25	2026-04-09 12:07:18.912876+00	\N	f	\N	\N	\N	\N
485	2	fizic	robert	\N	\N	0767327021	\N	\N	2026-04-09 12:09:01.501923+00	\N	f	\N	\N	\N	\N
487	2	fizic	pirvu liviu	\N	\N	0787406585	\N	\N	2026-04-09 12:21:14.392888+00	\N	f	\N	\N	\N	\N
488	2	fizic	ION EUGEN	\N	\N	0765739901	\N	\N	2026-04-09 12:29:58.364807+00	\N	f	\N	\N	\N	\N
490	2	fizic	neacsu	\N	\N	0754284543	\N	\N	2026-04-09 12:35:56.277009+00	\N	f	\N	\N	anvelope vechi si uzate	\N
489	2	juridic	CHIS & CHIS SRL	14221850	\N	0742048982	\N	JUD. CLUJ, MUN. CLUJ-NAPOCA, STR. FRUNZIŞULUI, NR.2	2026-04-09 12:35:09.617178+00	2026-04-09 12:35:56.847455+00	f	\N	\N	\N	\N
491	2	fizic	MARICA ALIN	\N	\N	0726704763	\N	\N	2026-04-09 12:38:47.190979+00	\N	f	\N	\N	\N	\N
492	2	fizic	dragos	\N	\N	0737725060	\N	\N	2026-04-09 12:42:40.890621+00	\N	f	\N	\N	\N	\N
493	2	fizic	minoiu ionut	\N	\N	0759358058	\N	\N	2026-04-09 12:46:19.810279+00	\N	f	\N	\N	\N	\N
494	2	fizic	deaconu ionut	\N	\N	0754453270	\N	\N	2026-04-09 12:53:43.614588+00	\N	f	\N	\N	anvelope uzate	\N
495	2	fizic	ROMANESCU FLORIN	\N	\N	0722787685	\N	\N	2026-04-09 13:09:41.815059+00	\N	f	\N	\N	\N	\N
496	2	fizic	iulian	\N	\N	0764938015	\N	\N	2026-04-09 13:11:05.898361+00	\N	f	\N	\N	\N	\N
497	2	fizic	sorin dinulescu	\N	\N	0788249522	\N	\N	2026-04-09 13:11:29.359515+00	\N	f	\N	\N	\N	\N
498	2	fizic	POPESCU LUCIAN	\N	\N	0723344347	\N	\N	2026-04-09 13:17:40.7085+00	\N	f	\N	\N	\N	\N
499	2	fizic	stanoi	\N	\N	0729804097	\N	\N	2026-04-09 13:22:34.777051+00	\N	f	\N	\N	\N	\N
486	2	fizic	TOBA ANDREI	\N	\N	0743 657 376	\N	\N	2026-04-09 12:17:34.067283+00	2026-04-09 13:23:46.823545+00	f	\N	\N	\N	\N
500	2	fizic	ROSU ANDREI	\N	\N	0723132844	\N	\N	2026-04-09 13:25:24.225096+00	\N	f	\N	\N	\N	\N
501	2	fizic	stoian cosmin	\N	\N	0736949899	\N	\N	2026-04-09 13:48:14.309617+00	\N	f	\N	\N	\N	\N
502	2	fizic	BARBU BOGDAN	\N	\N	0753041367	\N	\N	2026-04-09 13:58:17.313931+00	\N	f	\N	\N	\N	\N
503	2	fizic	radulescu florin	\N	\N	0745033358	\N	\N	2026-04-09 14:01:42.548776+00	\N	f	\N	\N	\N	\N
504	2	fizic	TEACA ALIN	\N	\N	0724049835	\N	\N	2026-04-09 14:03:05.38968+00	\N	f	\N	\N	\N	\N
505	2	fizic	dan vasilescu	\N	\N	0722435625	\N	\N	2026-04-14 05:49:15.431329+00	\N	f	\N	\N	\N	\N
506	2	fizic	NITU OVIDIU	\N	\N	0767746751	\N	\N	2026-04-14 07:06:46.453073+00	\N	f	\N	\N	\N	\N
507	2	fizic	ovidiu	\N	\N	0741935932	\N	\N	2026-04-14 07:15:37.729817+00	\N	f	\N	\N	\N	\N
509	2	fizic	PAPONI CORINA	\N	\N	0741050091	\N	\N	2026-04-14 07:51:58.450033+00	\N	f	\N	\N	\N	\N
510	2	fizic	bogdan	\N	\N	0740238138	\N	\N	2026-04-14 07:52:28.241067+00	\N	f	\N	\N	\N	\N
511	2	fizic	BEATRICE GHERCEA	\N	\N	0773394158	\N	\N	2026-04-14 08:00:24.300247+00	\N	f	\N	\N	\N	\N
512	2	fizic	manea razvan	\N	\N	0785956763	\N	\N	2026-04-14 08:05:36.330283+00	\N	f	\N	\N	\N	\N
513	2	juridic	CASA NOASTRA S.R.L.	7510066	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CALEA BUCURESTI, NR.113	2026-04-14 08:08:06.837997+00	\N	f	\N	\N	\N	\N
514	2	fizic	albert	\N	\N	0722597155	\N	\N	2026-04-14 08:14:22.400731+00	\N	f	\N	\N	\N	\N
515	2	fizic	MIU LIVIU	\N	\N	0745382354	\N	\N	2026-04-14 08:38:02.557237+00	\N	f	\N	\N	\N	\N
516	2	fizic	bogdan	\N	\N	0766408361	\N	\N	2026-04-14 08:40:19.656275+00	\N	f	\N	\N	\N	\N
508	2	juridic	CENTRUL MEDICAL DE SĂNĂTATE MINTALĂ ALARES SRL	35669815	\N	0769890079	\N	JUD. OLT, MUN. SLATINA, STR. VINTILĂ VODĂ, NR.7	2026-04-14 07:26:59.968664+00	2026-04-14 08:58:09.69988+00	f	\N	\N	\N	\N
517	2	fizic	geoge ramona	\N	\N	0724275941	\N	\N	2026-04-14 09:03:13.329702+00	\N	f	\N	\N	\N	\N
518	2	juridic	STAR DENTAL CLINIC S.R.L.	40477867	\N	0741244700	\N	JUD. DOLJ, MUN. CRAIOVA, STR. 13 SEPTEMBRIE, NR.14B, BL.C3, ET.2, AP.11	2026-04-14 09:27:29.825391+00	\N	f	\N	\N	\N	\N
519	2	fizic	sebastian	\N	\N	0767098078	\N	\N	2026-04-14 09:38:35.136116+00	\N	f	\N	\N	\N	\N
520	2	fizic	ZAVOI  ELECTRO FLUX	\N	\N	\N	\N	\N	2026-04-14 09:40:09.658611+00	\N	f	\N	\N	\N	\N
521	2	fizic	troaca andi	\N	\N	0744440489	\N	\N	2026-04-14 09:50:43.370212+00	\N	f	\N	\N	\N	\N
522	2	fizic	dumitru ilie	\N	\N	0745377391	\N	\N	2026-04-14 09:53:12.43683+00	\N	f	\N	\N	\N	\N
523	2	fizic	laurentiu	\N	\N	0724296893	\N	\N	2026-04-14 09:54:34.561151+00	\N	f	\N	\N	\N	\N
524	2	fizic	andreas dumitru	\N	\N	0799931400	\N	\N	2026-04-14 10:13:24.327999+00	\N	f	\N	\N	\N	\N
525	2	fizic	rosu marius	\N	\N	0761697722	\N	\N	2026-04-14 10:15:40.272845+00	\N	f	\N	\N	\N	\N
526	2	juridic	PETRODAV BUILDING S.R.L.	RO43241851	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. DACIA, NR.98, BL.M5, SC.1, AP.19	2026-04-14 10:19:54.15273+00	\N	f	\N	\N	\N	\N
527	2	fizic	VDA	\N	\N	\N	\N	\N	2026-04-14 10:21:23.770304+00	\N	f	\N	\N	\N	\N
528	2	fizic	rosu marius	\N	\N	0761697722	\N	\N	2026-04-14 10:36:42.095653+00	\N	f	\N	\N	\N	\N
529	2	fizic	ionut	\N	\N	0758164674	\N	\N	2026-04-14 10:40:05.726361+00	\N	f	\N	\N	\N	\N
530	2	fizic	POPA MAURICIU	\N	\N	0744831178	\N	\N	2026-04-14 10:45:15.589065+00	\N	f	\N	\N	\N	\N
531	2	fizic	DAN	\N	\N	0731101959	\N	\N	2026-04-14 10:52:31.607925+00	\N	f	\N	\N	\N	\N
532	2	fizic	negulescu mihail	\N	\N	0728959543	\N	\N	2026-04-14 10:59:06.677963+00	\N	f	\N	\N	\N	\N
533	2	fizic	meleanca alin	\N	\N	0784505089	\N	\N	2026-04-14 11:09:27.118504+00	\N	f	\N	\N	\N	\N
534	2	fizic	florin	\N	\N	0757042539	\N	\N	2026-04-14 11:10:43.813034+00	\N	f	\N	\N	\N	\N
535	2	fizic	MIRCEA	\N	\N	0726371752	\N	\N	2026-04-14 11:11:21.818523+00	\N	f	\N	\N	\N	\N
536	2	fizic	valceleanu	\N	\N	0734213676	\N	\N	2026-04-14 11:26:58.361752+00	\N	f	\N	\N	\N	\N
537	2	fizic	sipos arpad	\N	\N	0745181892	\N	\N	2026-04-14 11:34:58.632507+00	\N	f	\N	\N	\N	\N
538	2	fizic	tera romania	\N	\N	0761741900	\N	\N	2026-04-14 11:38:03.563163+00	\N	f	\N	\N	\N	\N
1244	2	fizic	ticu dan	\N	\N	0761682787	\N	\N	2026-04-27 07:00:45.098681+00	\N	f	\N	\N	\N	\N
540	2	fizic	stocheci radu	\N	\N	0730606237	\N	\N	2026-04-14 11:39:44.374968+00	\N	f	\N	\N	\N	\N
541	2	fizic	BADEA MARIAN	\N	\N	0761614900	\N	\N	2026-04-14 11:51:05.248958+00	\N	f	\N	\N	\N	\N
542	2	fizic	diana	\N	\N	0768583671	\N	\N	2026-04-14 11:52:14.812755+00	\N	f	\N	\N	\N	\N
543	2	fizic	dinu alin	\N	\N	0767572356	\N	\N	2026-04-14 12:07:43.44976+00	\N	f	\N	\N	\N	\N
544	2	fizic	dinu ion	\N	\N	0744536893	\N	\N	2026-04-14 12:07:46.772484+00	\N	f	\N	\N	\N	\N
546	2	fizic	ghizdavescu cristina	\N	\N	0722441166	\N	\N	2026-04-14 12:30:59.251561+00	\N	f	\N	\N	\N	\N
548	2	juridic	OLAARU TAXI S.R.L.	28301682	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. RECUNOŞTINŢEI, NR.32	2026-04-14 12:52:07.126594+00	\N	f	\N	\N	\N	\N
1247	2	fizic	COSTIN PETRESCU	\N	\N	0726244942	\N	\N	2026-04-27 07:02:35.400535+00	\N	f	\N	\N	\N	\N
1264	2	fizic	micu	\N	\N	0744791049	\N	\N	2026-04-27 08:41:29.853026+00	\N	f	\N	\N	\N	\N
1269	2	juridic	EUROGENETIC SRL	6218633	\N	\N	\N	JUD. OLT, ORŞ. BALŞ, STR. NICOLAE BĂLCESCU, NR.19, BL.23, SC.3, AP.40	2026-04-27 09:03:46.670488+00	\N	f	\N	\N	\N	\N
1281	2	fizic	FLORIN FIERTU	\N	\N	0744798946	\N	\N	2026-04-27 10:32:30.458441+00	\N	f	\N	\N	\N	\N
1282	2	fizic	marcu mihai	\N	\N	\N	\N	\N	2026-04-27 10:46:50.55776+00	\N	f	\N	\N	\N	\N
1299	2	fizic	OLARIU VICTOR	\N	\N	\N	0741063263	\N	2026-04-27 12:19:52.064909+00	\N	f	\N	\N	\N	\N
1301	2	fizic	GEANI  cancescu	\N	\N	0730444422	\N	\N	2026-04-27 12:37:33.306745+00	\N	f	\N	\N	\N	\N
1303	2	juridic	matei daniel	banca transilvania	\N	0770918742	\N	\N	2026-04-27 12:40:58.333108+00	\N	f	\N	\N	\N	\N
1319	2	fizic	STROE ROBERT	\N	\N	0725 505 737	\N	\N	2026-04-28 05:29:40.879135+00	\N	f	\N	\N	\N	\N
1320	2	fizic	ricuta c tin	\N	\N	0726080635	\N	\N	2026-04-28 05:31:09.169763+00	\N	f	\N	\N	\N	\N
1323	2	fizic	beniamin	\N	\N	0750167494	\N	\N	2026-04-28 05:46:03.334002+00	\N	f	\N	\N	\N	\N
1325	2	fizic	barbulescu florian	\N	\N	0723230953	\N	\N	2026-04-28 05:59:35.455404+00	\N	f	\N	\N	\N	\N
1333	2	fizic	nicu	\N	\N	0732406601	\N	\N	2026-04-28 06:58:49.038558+00	\N	f	\N	\N	\N	\N
1336	2	fizic	DIMA	\N	\N	0749181877	\N	\N	2026-04-28 07:10:15.385117+00	\N	f	\N	\N	\N	\N
1340	2	juridic	CLOUD SOFTWARE SERVICES SRL	34141462	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. MIHAI VITEAZUL, NR.37, TARLAUA 12, PARCELA 184/10	2026-04-28 07:27:02.367941+00	\N	f	\N	\N	\N	\N
1348	2	juridic	LUMIDOR IMOBILIARE S.R.L.	ro39401849	\N	0740054810	\N	JUD. DOLJ, MUN. CRAIOVA, STR. PESCĂRUŞULUI, NR.40D, ET.2, AP.5	2026-04-28 08:02:33.605609+00	\N	f	\N	\N	\N	\N
1363	2	fizic	stefan fanel	\N	\N	0764544999	\N	\N	2026-04-28 09:41:37.632927+00	\N	f	\N	\N	\N	\N
1370	2	fizic	MARIAN	\N	\N	0765815025	\N	\N	2026-04-28 10:29:00.243407+00	\N	f	\N	\N	\N	\N
1371	2	fizic	STANCU ION	\N	\N	0749193590	\N	\N	2026-04-28 10:37:21.508437+00	\N	f	\N	\N	\N	\N
1384	2	fizic	bighea alex	\N	\N	0744561055	\N	\N	2026-04-28 11:50:05.165727+00	\N	f	\N	\N	\N	\N
1396	2	fizic	dutu nicusor	\N	\N	0769269724	\N	\N	2026-04-28 13:09:23.450047+00	\N	f	\N	\N	\N	\N
1401	2	fizic	antonela	\N	\N	\N	\N	\N	2026-04-28 13:48:16.788736+00	\N	f	\N	\N	\N	\N
1414	2	fizic	sebastian ochiescu	\N	\N	0747042119	\N	\N	2026-04-29 06:19:47.824807+00	\N	f	\N	\N	\N	\N
1428	2	fizic	LICA MAGDA	\N	\N	0726344943	\N	\N	2026-04-29 07:48:35.636675+00	\N	f	\N	\N	\N	\N
1433	2	fizic	bmw	\N	\N	\N	\N	\N	2026-04-29 08:12:26.651225+00	\N	f	\N	\N	bavaria	\N
1448	2	fizic	CHIREA ADRIANA	\N	\N	0735087583	\N	\N	2026-04-29 09:42:19.025888+00	\N	f	\N	\N	\N	\N
1451	2	fizic	marinel popa	\N	\N	0743518639	\N	\N	2026-04-29 10:02:14.083628+00	\N	f	\N	\N	\N	\N
1452	2	fizic	marius	\N	\N	0748116561	\N	\N	2026-04-29 10:15:12.734549+00	\N	f	\N	\N	\N	\N
1471	2	fizic	STEFAN LAZARESCU	\N	\N	0722310600	\N	\N	2026-04-29 11:51:59.803351+00	\N	f	\N	\N	\N	\N
1474	2	juridic	costi lazar	31197221	\N	0767584888	\N	\N	2026-04-29 12:04:36.169781+00	\N	f	\N	\N	\N	\N
1476	2	fizic	cristi	\N	\N	0751265124	\N	\N	2026-04-29 12:14:45.670003+00	\N	f	\N	\N	\N	\N
1477	2	fizic	LACRARU ROBERT	\N	\N	0740361386	\N	\N	2026-04-29 12:22:12.674454+00	\N	f	\N	\N	\N	\N
545	2	fizic	vlad	\N	\N	0745639080	\N	\N	2026-04-14 12:19:09.041417+00	\N	f	\N	\N	\N	\N
539	2	fizic	MATEI CLAUDIU	\N	\N	0723 584 269	\N	\N	2026-04-14 11:38:16.297654+00	2026-04-14 12:46:44.223135+00	f	\N	\N	\N	\N
547	2	fizic	marian	\N	\N	0763856192	\N	\N	2026-04-14 12:51:59.587125+00	\N	f	\N	\N	\N	\N
549	2	fizic	ANDREI	\N	\N	0766975775	\N	\N	2026-04-14 13:17:56.002723+00	\N	f	\N	\N	\N	\N
550	2	fizic	toni	\N	\N	0760605808	\N	\N	2026-04-14 13:19:53.283501+00	\N	f	\N	\N	\N	\N
551	2	fizic	iliescu amelia	\N	\N	0784838555	\N	\N	2026-04-14 13:36:14.620651+00	\N	f	\N	\N	\N	\N
552	2	fizic	gabriel	\N	\N	0786604543	\N	\N	2026-04-14 13:47:58.356445+00	\N	f	\N	\N	\N	\N
553	2	fizic	papuc toni	\N	\N	0745252871	\N	\N	2026-04-14 13:56:49.989814+00	\N	f	\N	\N	\N	\N
554	2	fizic	COSMIN NITU	\N	\N	0737506071	\N	\N	2026-04-14 13:59:31.42897+00	\N	f	\N	\N	\N	\N
555	2	fizic	PETRE VICTOR	\N	\N	0767128259	\N	\N	2026-04-14 14:02:54.904858+00	\N	f	\N	\N	\N	\N
556	2	fizic	nedelcu	\N	\N	0773788519	\N	\N	2026-04-15 05:33:08.630968+00	\N	f	\N	\N	\N	\N
558	2	fizic	nistor nicolae	\N	\N	0722480728	\N	\N	2026-04-15 05:44:34.006712+00	\N	f	\N	\N	\N	\N
559	2	fizic	DURLA DORIN	\N	\N	0745864181	\N	\N	2026-04-15 05:49:06.163791+00	\N	f	\N	\N	\N	\N
560	2	fizic	GHIMISI DORU	\N	\N	0774650073	\N	\N	2026-04-15 05:52:56.395485+00	\N	f	\N	\N	\N	\N
557	2	fizic	MARE GIGEL	\N	\N	0771 583 424	\N	\N	2026-04-15 05:39:38.373833+00	2026-04-15 05:54:39.457952+00	f	\N	\N	\N	\N
561	2	fizic	ocoleanu picu	\N	\N	0757081922	\N	\N	2026-04-15 05:58:42.397992+00	\N	f	\N	\N	\N	\N
562	2	fizic	catalin	\N	\N	0722540226	\N	\N	2026-04-15 05:59:37.978214+00	\N	f	\N	\N	\N	\N
563	2	juridic	KODIAK JEWELLERY S.R.L.	40395503	\N	0765612762	\N	JUD. DOLJ, SAT BREASTA COM. BREASTA, STR. ITALIENILOR, NR.25A	2026-04-15 06:04:15.592776+00	\N	f	\N	\N	\N	\N
564	2	fizic	ionescu gabriel	\N	\N	0768166777	\N	\N	2026-04-15 06:13:55.116337+00	\N	f	\N	\N	\N	\N
565	2	fizic	BOTEADANIEL	\N	\N	0732119957	\N	\N	2026-04-15 06:16:09.721081+00	\N	f	\N	\N	\N	\N
566	2	fizic	militaru sorin	\N	\N	0722794420	\N	\N	2026-04-15 06:27:51.310944+00	\N	f	\N	\N	\N	\N
567	2	fizic	FOCULESCU ION	\N	\N	0742197591	\N	\N	2026-04-15 06:27:53.342973+00	2026-04-15 06:28:38.670022+00	f	\N	\N	\N	\N
568	2	fizic	EXOTIC	\N	\N	\N	\N	\N	2026-04-15 06:32:26.268787+00	\N	f	\N	\N	\N	\N
569	2	fizic	marciu	\N	\N	0742016864	\N	\N	2026-04-15 06:34:22.229909+00	\N	f	\N	\N	\N	\N
570	2	fizic	cristian	\N	\N	0745382622	\N	\N	2026-04-15 06:54:41.325074+00	\N	f	\N	\N	\N	\N
571	2	fizic	marius	\N	\N	\N	\N	\N	2026-04-15 06:59:24.783809+00	\N	f	\N	\N	\N	\N
572	2	fizic	DANIEL ACHIM	\N	\N	0721215491	\N	\N	2026-04-15 07:07:49.228054+00	\N	f	\N	\N	\N	\N
573	2	juridic	SOLAREX IMPEX SRL	4174140	\N	0742211186	\N	JUD. DOLJ, MUN. CRAIOVA, STR. RIULUI, NR.419	2026-04-15 07:19:13.234039+00	\N	f	\N	\N	\N	\N
574	2	fizic	BICA CRISTIAN	\N	\N	0773836696	\N	\N	2026-04-15 07:26:31.289143+00	\N	f	\N	\N	\N	\N
575	2	fizic	ghiorghita lelia	\N	\N	0722404396	\N	\N	2026-04-15 07:29:27.917772+00	\N	f	\N	\N	\N	\N
576	2	fizic	SABIN SBIRCEA	\N	\N	0761629124	\N	\N	2026-04-15 07:35:14.848065+00	\N	f	\N	\N	\N	\N
577	2	fizic	adrian	\N	\N	\N	0747288059	\N	2026-04-15 07:37:04.389321+00	\N	f	\N	\N	\N	\N
578	2	fizic	craciun ana maeia	\N	\N	078482443	\N	\N	2026-04-15 07:38:23.560899+00	\N	f	\N	\N	\N	\N
579	2	fizic	munteanu mihai	\N	\N	0722676536	\N	\N	2026-04-15 07:40:15.124633+00	\N	f	\N	\N	\N	\N
580	2	fizic	DOROBANTU IONUT	\N	\N	0764827629	\N	\N	2026-04-15 07:53:04.138528+00	\N	f	\N	\N	\N	\N
581	2	fizic	GEANTA NICUSOR	\N	\N	0723766230	\N	\N	2026-04-15 08:11:40.969265+00	\N	f	\N	\N	\N	\N
582	2	fizic	ciurea mihai	\N	\N	0763496394	\N	\N	2026-04-15 08:17:09.990744+00	\N	f	\N	\N	\N	\N
583	2	fizic	PATRU ALIN	\N	\N	0721206813	\N	\N	2026-04-15 08:17:22.635347+00	\N	f	\N	\N	\N	\N
584	2	fizic	vaietisi florian aurel	\N	\N	0764369951	\N	\N	2026-04-15 08:25:47.792662+00	\N	f	\N	\N	\N	\N
585	2	fizic	bogdan	\N	\N	0762137284	\N	\N	2026-04-15 08:48:45.53274+00	\N	f	\N	\N	\N	\N
586	2	fizic	stefan ionut	\N	\N	15510621514	\N	\N	2026-04-15 08:49:26.013483+00	\N	f	\N	\N	\N	\N
587	2	fizic	mitrulescu	\N	\N	0751124015	\N	\N	2026-04-15 08:56:10.553159+00	\N	f	\N	\N	\N	\N
588	2	fizic	GRIG EMI	\N	\N	0745656907	\N	\N	2026-04-15 09:00:50.855285+00	\N	f	\N	\N	\N	\N
589	2	fizic	CIOCAN LUCIAN VALERIU	\N	\N	0723613149	\N	\N	2026-04-15 09:02:09.380431+00	\N	f	\N	\N	\N	\N
590	2	fizic	sfeclan maria	\N	\N	0724808829	\N	\N	2026-04-15 09:12:10.755546+00	\N	f	\N	\N	\N	\N
591	2	fizic	DINU IOAN	\N	\N	077031253	\N	\N	2026-04-15 09:14:15.593107+00	\N	f	\N	\N	\N	\N
592	2	fizic	SANDA CORNEL	\N	\N	0766949901	\N	\N	2026-04-15 09:22:16.59534+00	\N	f	\N	\N	\N	\N
593	2	fizic	brindusescu costel	\N	\N	0763653390	\N	\N	2026-04-15 09:26:45.105403+00	\N	f	\N	\N	\N	\N
594	2	fizic	mitroi ovidiu	\N	\N	0757012106	\N	\N	2026-04-15 09:33:58.926853+00	\N	f	\N	\N	\N	\N
595	2	fizic	popescu ionut	\N	\N	0762726022	\N	\N	2026-04-15 09:33:59.132777+00	\N	f	\N	\N	\N	\N
596	2	fizic	CRUCERU LAVINEL	\N	\N	0735040940	\N	\N	2026-04-15 09:48:24.167653+00	\N	f	\N	\N	\N	\N
597	2	fizic	madalin gaman	\N	\N	0749268274	\N	\N	2026-04-15 10:03:46.71546+00	\N	f	\N	\N	\N	\N
598	2	fizic	mitrache bogdan	\N	\N	0761648268	\N	\N	2026-04-15 10:11:42.351313+00	\N	f	\N	\N	\N	\N
599	2	juridic	RENOVATIO MOBILITY SRL	RO28486190	\N	0770869642	\N	MUNICIPIUL BUCUREŞTI, SECTOR 1, ŞOS NORDULUI, NR.62D, ET.3	2026-04-15 10:19:01.338719+00	\N	f	\N	\N	\N	\N
600	2	fizic	BANCU TITU	\N	\N	0766752492	\N	\N	2026-04-15 10:47:41.540437+00	\N	f	\N	\N	\N	\N
601	2	fizic	mihnea	\N	\N	0763180999	\N	\N	2026-04-15 10:49:36.54694+00	\N	f	\N	\N	\N	\N
602	2	fizic	alexandru	\N	\N	0766684812	\N	\N	2026-04-15 10:50:57.796863+00	\N	f	\N	\N	\N	\N
603	2	fizic	iliescu ionut	\N	\N	0743171712	\N	\N	2026-04-15 10:58:34.72121+00	\N	f	\N	\N	\N	\N
604	2	fizic	ilie mare dragos	\N	\N	0728283410	\N	\N	2026-04-15 10:58:42.882054+00	\N	f	\N	\N	\N	\N
605	2	fizic	MEDINTU COSTEL	\N	\N	0767533183	\N	\N	2026-04-15 11:04:13.564295+00	\N	f	\N	\N	\N	\N
606	2	fizic	radu	\N	\N	0762716398	\N	\N	2026-04-15 11:20:49.026945+00	\N	f	\N	\N	\N	\N
607	2	fizic	bogdan	\N	\N	0771022854	\N	\N	2026-04-15 11:22:59.488704+00	\N	f	\N	\N	\N	\N
608	2	fizic	TANASIE LAURENTIU	\N	\N	0732393170	\N	\N	2026-04-15 11:27:26.29036+00	\N	f	\N	\N	\N	\N
609	2	fizic	SUCIU BOGDAN	\N	\N	0761101310	\N	\N	2026-04-15 11:34:03.962897+00	\N	f	\N	\N	\N	\N
610	2	fizic	bratu catalin	\N	\N	0744994435	\N	\N	2026-04-15 11:53:30.199559+00	\N	f	\N	\N	\N	\N
611	2	fizic	craciun adrian	\N	\N	0744557705	\N	\N	2026-04-15 12:13:55.564824+00	\N	f	\N	\N	\N	\N
612	2	fizic	ghituran	\N	\N	0769270350	\N	\N	2026-04-15 12:22:40.984003+00	\N	f	\N	\N	\N	\N
614	2	fizic	ciocan	\N	\N	0723361931	\N	\N	2026-04-15 12:52:44.556328+00	\N	f	\N	\N	\N	\N
615	2	fizic	ENACHE ALIN	\N	\N	0722 429 479	\N	\N	2026-04-15 12:56:19.239627+00	\N	f	\N	\N	\N	\N
616	2	fizic	baluta claudiu	\N	\N	0740011347	\N	\N	2026-04-15 13:01:05.922739+00	\N	f	\N	\N	\N	\N
617	2	fizic	alina ionica	\N	\N	0757073258	\N	\N	2026-04-15 13:11:11.205349+00	\N	f	\N	\N	\N	\N
618	2	fizic	ALEXANDRA SORA	\N	\N	0766 442 578	\N	\N	2026-04-15 13:13:35.604832+00	\N	f	\N	\N	\N	\N
613	2	fizic	GRECU MARIN	\N	\N	0757 646 183	\N	\N	2026-04-15 12:45:15.760725+00	2026-04-15 13:20:01.846022+00	f	\N	\N	\N	\N
619	2	fizic	DOBRE ADRIAN	\N	\N	0773948556	\N	\N	2026-04-15 13:35:23.797921+00	\N	f	\N	\N	\N	\N
620	2	fizic	floricel	\N	\N	0751771734	\N	\N	2026-04-15 13:57:49.728814+00	\N	f	\N	\N	\N	\N
621	2	fizic	adrian gavrila	\N	\N	0744705158	\N	\N	2026-04-15 14:01:21.789565+00	\N	f	\N	\N	\N	\N
622	2	fizic	DESESRTIME	\N	\N	0351417419	\N	\N	2026-04-15 14:17:18.163338+00	\N	f	\N	\N	\N	\N
623	2	fizic	SCAFIGEA GEORGE	\N	\N	642 245 034	\N	\N	2026-04-16 05:25:46.085979+00	2026-04-16 05:37:07.002618+00	f	\N	\N	\N	\N
624	2	fizic	constantin	\N	\N	0762670035	\N	\N	2026-04-16 05:41:17.491204+00	\N	f	\N	\N	\N	\N
625	2	fizic	alin	\N	\N	0761134108	\N	\N	2026-04-16 05:45:28.854943+00	\N	f	\N	\N	\N	\N
626	2	fizic	radu	\N	\N	0768146681	\N	\N	2026-04-16 05:47:20.590592+00	\N	f	\N	\N	\N	\N
627	2	fizic	rosca	\N	\N	0768808303	\N	\N	2026-04-16 05:53:12.914858+00	\N	f	\N	\N	\N	\N
628	2	fizic	micu eugen	\N	\N	0744624655	\N	\N	2026-04-16 06:00:44.128332+00	\N	f	\N	\N	\N	\N
629	2	fizic	BULUGIU ANDREI	\N	\N	0762184368	\N	\N	2026-04-16 06:02:26.560964+00	\N	f	\N	\N	\N	\N
630	2	fizic	george	\N	\N	\N	\N	\N	2026-04-16 06:03:51.951676+00	\N	f	\N	\N	bucsi brate fata rupte joc cab bara sf	\N
631	2	fizic	voicu	\N	\N	0785945902	\N	\N	2026-04-16 06:08:21.481833+00	\N	f	\N	\N	\N	\N
632	2	fizic	ghita	\N	\N	0771779660	\N	\N	2026-04-16 06:24:36.915886+00	\N	f	\N	\N	\N	\N
633	2	fizic	TRANA FLORIN	\N	\N	0741047566	\N	\N	2026-04-16 06:31:23.788811+00	\N	f	\N	\N	\N	\N
634	2	fizic	untaru	\N	\N	0740186647	\N	\N	2026-04-16 06:46:28.978595+00	\N	f	\N	\N	\N	\N
635	2	fizic	kiles daniela	\N	\N	0727635542	\N	\N	2026-04-16 06:51:25.737663+00	\N	f	\N	\N	\N	\N
636	2	fizic	CIUCA MIHAELA	\N	\N	0740280816	\N	\N	2026-04-16 06:55:36.041126+00	\N	f	\N	\N	\N	\N
637	2	fizic	CEZAR PRUNOIU	\N	\N	0722894065	\N	\N	2026-04-16 06:57:34.128316+00	\N	f	\N	\N	\N	\N
638	2	fizic	andra	\N	\N	0766969322	\N	\N	2026-04-16 06:58:56.383575+00	\N	f	\N	\N	\N	\N
639	2	fizic	BUICA SORIN	\N	\N	0756816816	\N	\N	2026-04-16 07:12:34.079216+00	\N	f	\N	\N	\N	\N
640	2	fizic	tigae dragos	\N	\N	0752033710	\N	\N	2026-04-16 07:19:46.894942+00	\N	f	\N	\N	\N	\N
641	2	fizic	carlotescu marinela	\N	\N	0740135494	\N	\N	2026-04-16 07:20:30.301026+00	\N	f	\N	\N	\N	\N
642	2	fizic	preda aurel	\N	\N	0740005903	\N	\N	2026-04-16 07:24:48.200036+00	\N	f	\N	\N	\N	\N
643	2	fizic	turcu	\N	\N	0740091555	\N	\N	2026-04-16 07:28:55.752612+00	\N	f	\N	\N	\N	\N
644	2	fizic	spach liviu	\N	\N	0753052796	\N	\N	2026-04-16 07:30:22.938788+00	2026-04-16 07:30:34.092146+00	f	\N	\N	\N	\N
645	2	fizic	DAN	\N	\N	0723566745	\N	\N	2026-04-16 07:36:34.349613+00	\N	f	\N	\N	\N	\N
646	2	fizic	vaicar romeo	\N	\N	0723787957	\N	\N	2026-04-16 08:02:45.250431+00	\N	f	\N	\N	\N	\N
647	2	fizic	purece cristi	\N	\N	0735847040	\N	\N	2026-04-16 08:04:58.48606+00	\N	f	\N	\N	\N	\N
648	2	fizic	MADALIN  GAMAN	\N	\N	0749268274	\N	\N	2026-04-16 08:05:38.444986+00	\N	f	\N	\N	\N	\N
649	2	fizic	IONUT RADICI	\N	\N	0721823669	\N	\N	2026-04-16 08:09:34.335357+00	\N	f	\N	\N	\N	\N
650	2	fizic	barbulescu giorgiana	\N	\N	0786908630	\N	\N	2026-04-16 08:10:31.765527+00	\N	f	\N	\N	\N	\N
651	2	fizic	mario	\N	\N	0755504205	\N	\N	2026-04-16 08:29:34.380012+00	\N	f	\N	\N	\N	\N
652	2	fizic	marius	\N	\N	0762898141	\N	\N	2026-04-16 08:34:40.145298+00	\N	f	\N	\N	\N	\N
653	2	juridic	argentoianu	2005144	\N	0723150985	\N	\N	2026-04-16 08:39:48.706259+00	\N	f	\N	\N	\N	\N
654	2	juridic	POLISEA SA	6440035	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, STR. CALEA BUCURESTI, NR.137	2026-04-16 08:43:05.969858+00	\N	f	\N	\N	\N	\N
655	2	fizic	TRANA MIHAI	\N	\N	0724018866	\N	\N	2026-04-16 08:47:54.574159+00	\N	f	\N	\N	\N	\N
656	2	fizic	TANASIE DUMITRU	\N	\N	0746 761 260	\N	\N	2026-04-16 08:48:27.345353+00	\N	f	\N	\N	\N	\N
657	2	juridic	METALCOM SRL	RO6778720	\N	0752122921	\N	JUD. DOLJ, MUN. CRAIOVA, CAL. BUCUREŞTI, NR.191	2026-04-16 08:57:48.819532+00	\N	f	\N	\N	\N	\N
659	2	juridic	trica victor	Ro6778720	\N	0752122921	\N	\N	2026-04-16 09:01:43.724498+00	\N	f	\N	\N	\N	\N
660	2	juridic	PROLUNI STRUCTURI S.R.L.	33976902	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. ATENA, NR.19	2026-04-16 09:13:02.989991+00	\N	f	\N	\N	\N	\N
661	2	fizic	zorzonel cristian	\N	\N	0728244771	\N	\N	2026-04-16 09:18:02.036503+00	\N	f	\N	\N	\N	\N
662	2	fizic	stoica ion	\N	\N	0722654712	\N	\N	2026-04-16 09:18:02.942531+00	\N	f	\N	\N	\N	\N
663	2	fizic	nicoleta	\N	\N	0756666643	\N	\N	2026-04-16 09:23:45.068895+00	\N	f	\N	\N	\N	\N
664	2	fizic	teo grecu	\N	\N	0722112727	\N	\N	2026-04-16 09:27:14.800843+00	\N	f	\N	\N	\N	\N
665	2	fizic	daniel lazarescu	\N	\N	0740887035	\N	\N	2026-04-16 09:28:51.421969+00	\N	f	\N	\N	\N	\N
658	2	fizic	CIOCAN ALESSIO	\N	\N	0740 544 665	\N	\N	2026-04-16 08:59:19.944615+00	2026-04-16 09:33:33.126512+00	f	\N	\N	\N	\N
666	2	fizic	zanfir andrei	\N	\N	0749011013	\N	\N	2026-04-16 09:39:41.032923+00	\N	f	\N	\N	\N	\N
667	2	fizic	alexandru	\N	\N	0753432335	\N	\N	2026-04-16 09:43:48.880439+00	\N	f	\N	\N	\N	\N
668	2	fizic	tican sorin	\N	\N	0729002326	\N	\N	2026-04-16 10:01:01.492898+00	\N	f	\N	\N	\N	\N
669	2	fizic	dobre	\N	\N	0740002637	\N	\N	2026-04-16 10:10:04.404752+00	\N	f	\N	\N	\N	\N
670	2	fizic	marian	\N	\N	0722279753	\N	\N	2026-04-16 10:11:45.0779+00	\N	f	\N	\N	\N	\N
671	2	fizic	cosmin	\N	\N	\N	\N	\N	2026-04-16 10:12:06.372881+00	\N	f	\N	\N	\N	\N
672	2	fizic	RADU STEFAN	\N	\N	0744385000	\N	\N	2026-04-16 10:13:11.529391+00	\N	f	\N	\N	\N	\N
673	2	fizic	emilia	\N	\N	0755077502	\N	\N	2026-04-16 10:21:12.126771+00	\N	f	\N	\N	\N	\N
674	2	fizic	barbulescu iosif	\N	\N	0722623293	\N	\N	2026-04-16 10:22:20.080689+00	\N	f	\N	\N	\N	\N
675	2	fizic	gigi dinu	\N	\N	0752174147	\N	\N	2026-04-16 10:35:37.482555+00	\N	f	\N	\N	\N	\N
676	2	fizic	PHARMA	\N	\N	0766013290	\N	\N	2026-04-16 10:37:00.938073+00	\N	f	\N	\N	\N	\N
677	2	fizic	vasile	\N	\N	0755425377	\N	\N	2026-04-16 10:37:47.606599+00	\N	f	\N	\N	\N	\N
678	2	fizic	popa	\N	\N	0764046046	\N	\N	2026-04-16 10:38:35.551676+00	\N	f	\N	\N	\N	\N
680	2	fizic	mihai	\N	\N	0725656738	\N	\N	2026-04-16 10:47:51.908285+00	\N	f	\N	\N	\N	\N
681	2	fizic	cosmin	\N	\N	0760868228	\N	\N	2026-04-16 10:48:08.681407+00	\N	f	\N	\N	\N	\N
682	2	fizic	ionut	\N	\N	0732301275	\N	\N	2026-04-16 10:49:43.843315+00	\N	f	\N	\N	\N	\N
679	2	fizic	RADUT CLEMEN FLORIN	\N	\N	0757 389 939	\N	\N	2026-04-16 10:46:14.932449+00	2026-04-16 11:06:25.856293+00	f	\N	\N	\N	\N
683	2	fizic	peter	\N	\N	0771709963	\N	\N	2026-04-16 11:07:42.155416+00	\N	f	\N	\N	\N	\N
684	2	fizic	ION PREDOIANU	\N	\N	0767782838	\N	\N	2026-04-16 11:16:42.706475+00	\N	f	\N	\N	\N	\N
685	2	fizic	octavian	\N	\N	\N	\N	\N	2026-04-16 11:23:33.324019+00	\N	f	\N	\N	\N	\N
686	2	fizic	yancu stefan	\N	\N	0749464755	\N	\N	2026-04-16 11:28:40.551344+00	\N	f	\N	\N	\N	\N
687	2	fizic	eugen buldur	\N	\N	0723272216	\N	\N	2026-04-16 11:30:08.357008+00	\N	f	\N	\N	\N	\N
688	2	fizic	POPI PAULIN	\N	\N	\N	\N	\N	2026-04-16 11:37:28.137953+00	\N	f	\N	\N	\N	\N
689	2	fizic	iulian catanea	\N	\N	0721830807	\N	\N	2026-04-16 11:42:50.766041+00	\N	f	\N	\N	\N	\N
690	2	fizic	ANGEL RABABOC	\N	\N	0745475346	\N	\N	2026-04-16 11:44:24.331569+00	\N	f	\N	\N	\N	\N
691	2	fizic	aron albert	\N	\N	0773773878	\N	\N	2026-04-16 11:58:15.448139+00	\N	f	\N	\N	\N	\N
692	2	fizic	lucian	\N	\N	0723043054	\N	\N	2026-04-16 12:02:51.772878+00	\N	f	\N	\N	\N	\N
693	2	fizic	balan cristinel	\N	\N	0784206464	\N	\N	2026-04-16 12:05:34.888711+00	\N	f	\N	\N	\N	\N
694	2	juridic	DEFIC GLOBE S.R.L.	RO47247270	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. CARACAL, NR.5, PARTER.  CORP 2	2026-04-16 12:10:45.643073+00	\N	f	\N	\N	\N	\N
695	2	fizic	pungan oana	\N	\N	0725749004	\N	\N	2026-04-16 12:12:20.597368+00	\N	f	\N	\N	\N	\N
697	2	fizic	rebeca	\N	\N	0742702890	\N	\N	2026-04-16 12:23:16.8703+00	\N	f	\N	\N	\N	\N
698	2	fizic	ARI	\N	\N	0742077431	\N	\N	2026-04-16 12:24:47.733015+00	\N	f	\N	\N	\N	\N
699	2	fizic	kamal	\N	\N	0767377007	\N	\N	2026-04-16 12:24:54.889268+00	\N	f	\N	\N	\N	\N
700	2	fizic	MUNTEANU ION NARCIS	\N	\N	0741139876	\N	\N	2026-04-16 12:34:38.107099+00	\N	f	\N	\N	\N	\N
701	2	fizic	ioana luiza	\N	\N	0724354289	\N	\N	2026-04-16 12:35:01.825633+00	\N	f	\N	\N	\N	\N
702	2	fizic	birău gabriel	\N	\N	0730610366	\N	\N	2026-04-16 12:54:38.873506+00	\N	f	\N	\N	\N	\N
703	2	fizic	cosmin	\N	\N	0762382869	\N	\N	2026-04-16 12:55:52.202439+00	\N	f	\N	\N	\N	\N
704	2	fizic	gheghina cristian	\N	\N	0775346640	\N	\N	2026-04-16 13:01:03.647331+00	\N	f	\N	\N	\N	\N
705	2	fizic	marcel	\N	\N	0723554625	\N	\N	2026-04-16 13:07:01.17557+00	\N	f	\N	\N	\N	\N
706	2	juridic	S.C.P.E.J ALBU IONUŢ- ELIAN ŞI MUŞAT MARIAN	30027113	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ION MAIORESCU, NR.3, BL.2-4, ET.PARTER	2026-04-16 13:07:59.192162+00	\N	f	\N	\N	\N	\N
707	2	fizic	AUTONOM	\N	\N	\N	\N	\N	2026-04-16 13:10:35.383853+00	\N	f	\N	\N	\N	\N
696	2	fizic	STANESCU CLAUDIU	\N	\N	0744 982 898	\N	\N	2026-04-16 12:21:32.65834+00	2026-04-16 13:24:12.442136+00	f	\N	\N	\N	\N
708	2	fizic	BUTUROAGA ANCA	\N	\N	0769674731	\N	\N	2026-04-16 13:37:50.307974+00	\N	f	\N	\N	\N	\N
709	2	fizic	mohorea silviu	\N	\N	0723621436	\N	\N	2026-04-16 13:40:11.426128+00	\N	f	\N	\N	\N	\N
710	2	fizic	manolache gabriel	\N	\N	0723660705	\N	\N	2026-04-16 14:00:21.134998+00	\N	f	\N	\N	\N	\N
711	2	juridic	Elit	\N	\N	\N	\N	\N	2026-04-16 14:08:52.173465+00	2026-04-16 14:09:03.131114+00	f	\N	\N	\N	\N
712	2	fizic	catalin	\N	\N	0771757253	\N	\N	2026-04-16 14:11:17.388311+00	\N	f	\N	\N	\N	\N
713	2	fizic	COSTIN MAGUREANU	\N	\N	0761757430	\N	\N	2026-04-16 14:19:25.307479+00	\N	f	\N	\N	\N	\N
714	2	fizic	ionel	\N	\N	0742393464	\N	\N	2026-04-17 05:28:04.18121+00	\N	f	\N	\N	\N	\N
720	2	fizic	munteanu teodor	\N	\N	0770849815	\N	\N	2026-04-17 06:10:33.114499+00	\N	f	\N	\N	\N	\N
716	2	fizic	ENACHE MARIAN	\N	\N	0723134107	\N	\N	2026-04-17 05:30:16.646302+00	\N	f	\N	\N	\N	\N
715	2	fizic	BACELAN IONEL	\N	\N	0742 393 464	\N	\N	2026-04-17 05:28:04.336705+00	2026-04-17 05:33:33.129186+00	f	\N	\N	\N	\N
717	2	fizic	enache madalin	\N	\N	0728078278	\N	\N	2026-04-17 05:40:26.39134+00	\N	f	\N	\N	\N	\N
718	2	fizic	Mugurel cernea	\N	\N	0740048143	\N	\N	2026-04-17 05:49:49.676337+00	\N	f	\N	\N	\N	\N
719	2	juridic	casa noastra srl	\N	\N	\N	\N	\N	2026-04-17 05:55:21.135632+00	\N	f	\N	\N	\N	\N
721	2	fizic	petre	\N	\N	0765636762	\N	\N	2026-04-17 06:14:46.345681+00	\N	f	\N	\N	\N	\N
723	2	fizic	iordachiescu andrei	\N	\N	0745586771	\N	\N	2026-04-17 06:22:10.098754+00	\N	f	\N	\N	\N	\N
1248	2	fizic	WHITE	\N	\N	0742353004	\N	\N	2026-04-27 07:02:40.338229+00	\N	f	\N	\N	km157791	\N
1268	2	juridic	DIVERS ECO TECH SRL	ro31119320	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, CAL. BUCUREŞTI, NR.325C, PARCUL INDUSTRIAL HIGH-TECH INDUSTRY PARK CRAIOVA. UNITATEA NR. 7	2026-04-27 09:03:07.71663+00	\N	f	\N	\N	\N	\N
1265	2	fizic	NEDELEA CRISTIAN	\N	\N	0745 618 978	\N	\N	2026-04-27 08:42:36.735416+00	2026-04-27 10:42:00.39847+00	f	\N	\N	\N	\N
1283	2	fizic	trandafir viorel	\N	\N	0748234512	\N	\N	2026-04-27 10:47:25.869913+00	\N	f	\N	\N	\N	\N
1284	2	fizic	lucian	\N	\N	0744586253	\N	\N	2026-04-27 10:58:07.082687+00	\N	f	\N	\N	\N	\N
1285	2	fizic	MIHAI	\N	\N	0000	\N	\N	2026-04-27 11:00:13.347926+00	\N	f	\N	\N	\N	\N
1289	2	fizic	DIRMON CRISTIAN	\N	\N	0749 416 659	\N	\N	2026-04-27 11:18:43.70984+00	2026-04-27 11:32:10.689178+00	f	\N	\N	\N	\N
1302	2	fizic	deca cosmin	\N	\N	0766713328	\N	\N	2026-04-27 12:40:53.748056+00	\N	f	\N	\N	\N	\N
1305	2	fizic	dorin	\N	\N	0769619930	\N	\N	2026-04-27 13:15:58.200019+00	\N	f	\N	\N	\N	\N
1322	2	fizic	ALIN	\N	\N	07410112507	\N	\N	2026-04-28 05:45:26.583225+00	\N	f	\N	\N	\N	\N
1334	2	fizic	adrian ganea	\N	\N	0773312426	\N	\N	2026-04-28 07:00:12.731884+00	\N	f	\N	\N	\N	\N
1342	2	juridic	CLOUD SOFTWARE SERVICES SRL	34141462	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. MIHAI VITEAZUL, NR.37, TARLAUA 12, PARCELA 184/10	2026-04-28 07:27:59.608615+00	\N	f	\N	\N	\N	\N
1350	2	fizic	franculescu gabriel	\N	\N	0773825061	\N	\N	2026-04-28 08:19:50.709233+00	\N	f	\N	\N	\N	\N
1364	2	fizic	MITRICA MARIAN	\N	\N	0765815025	\N	\N	2026-04-28 09:46:40.304225+00	\N	f	\N	\N	\N	\N
1365	2	fizic	eugen	\N	\N	0765013160	\N	\N	2026-04-28 10:08:26.414959+00	2026-04-28 10:09:06.870027+00	f	\N	\N	\N	\N
1366	2	fizic	eugen	\N	\N	0765013160	\N	\N	2026-04-28 10:09:56.571244+00	\N	f	\N	\N	\N	\N
1385	2	fizic	POPESCU CATALIN	\N	\N	0722561756	\N	\N	2026-04-28 11:51:50.900245+00	\N	f	\N	\N	\N	\N
1391	2	fizic	bobocel	\N	\N	0774559529	\N	\N	2026-04-28 12:34:18.43223+00	\N	f	\N	\N	\N	\N
1398	2	fizic	robert stamin	\N	\N	\N	\N	\N	2026-04-28 13:19:06.876244+00	\N	f	\N	\N	\N	\N
1416	2	juridic	AD MONTAJ SOLUTION S.R.L.	ro29140495	\N	0769599978	\N	JUD. CĂLĂRAŞI, MUN. OLTENIŢA, BLD. REPUBLICII, NR.39, CAMERA 2, BL.R, SC.A, ET.3, AP.11	2026-04-29 06:39:28.660763+00	\N	f	\N	\N	\N	\N
1418	2	fizic	POPA BOGDAN	\N	\N	0744372889	\N	\N	2026-04-29 07:03:24.512985+00	\N	f	\N	\N	\N	\N
1431	2	fizic	MIRCEA NEGRILA	\N	\N	0740098178	\N	\N	2026-04-29 08:05:01.745157+00	\N	f	\N	\N	\N	\N
1453	2	fizic	MARINESCU MARIAN	\N	\N	0722369681	\N	\N	2026-04-29 10:22:01.527624+00	\N	f	\N	\N	\N	\N
1454	2	fizic	gae sorin	\N	\N	0762684640	\N	\N	2026-04-29 10:29:07.429223+00	\N	f	\N	\N	\N	\N
1455	2	fizic	CIOCANESCU LOREDANA	\N	\N	0747095371	\N	\N	2026-04-29 10:31:59.844346+00	\N	f	\N	\N	\N	\N
1456	2	fizic	andronie dragosi	\N	\N	0750745653	\N	\N	2026-04-29 10:33:00.11455+00	\N	f	\N	\N	\N	\N
1457	2	fizic	COJOCARU ALIN	\N	\N	0723150041	\N	\N	2026-04-29 10:35:34.789911+00	\N	f	\N	\N	\N	\N
1463	2	fizic	andrei	\N	\N	0742031145	\N	\N	2026-04-29 11:18:15.756576+00	\N	f	\N	\N	\N	\N
1478	2	fizic	ZAHARIA	\N	\N	\N	\N	\N	2026-04-29 13:04:49.46591+00	\N	f	\N	\N	\N	\N
722	2	fizic	qfort	\N	\N	\N	\N	\N	2026-04-17 06:15:33.134447+00	\N	f	\N	\N	\N	\N
724	2	juridic	IL CAPO TOUR SRL	13830146	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, STR. GHEORGHIŢĂ GEOLGĂU, NR.181	2026-04-17 06:27:56.5185+00	\N	f	\N	\N	\N	\N
725	2	fizic	nicolae	\N	\N	0722853030	\N	\N	2026-04-17 06:29:30.393919+00	\N	f	\N	\N	\N	\N
726	2	fizic	vasile cosmin	\N	\N	0724289710	\N	\N	2026-04-17 06:38:27.384387+00	\N	f	\N	\N	\N	\N
727	2	fizic	nicolae	\N	\N	0771536242	\N	\N	2026-04-17 06:40:17.336901+00	\N	f	\N	\N	\N	\N
728	2	fizic	STANCU MIRCEA	\N	\N	0746251501	\N	\N	2026-04-17 06:44:10.079996+00	\N	f	\N	\N	\N	\N
729	2	fizic	RAZVAN	\N	\N	0771572140	\N	\N	2026-04-17 06:56:25.09761+00	\N	f	\N	\N	\N	\N
730	2	juridic	YRY - EMY S.R.L.	50731813	\N	0771028082	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ROVINARI, NR.55	2026-04-17 07:01:38.083353+00	\N	f	\N	\N	\N	\N
731	2	fizic	alex	\N	\N	0751214052	\N	\N	2026-04-17 07:02:14.078516+00	\N	f	\N	\N	\N	\N
732	2	fizic	CESIVO	\N	\N	0730607409	\N	\N	2026-04-17 07:02:24.547593+00	\N	f	\N	\N	\N	\N
733	2	juridic	HYDROAGRIFER S.R.L.	33870471	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, ALEEA 1 AEROPORTULUI, NR.2	2026-04-17 07:02:24.791933+00	\N	f	\N	\N	\N	\N
734	2	fizic	ica adrian	\N	\N	0767208413	\N	\N	2026-04-17 07:03:36.572764+00	\N	f	\N	\N	\N	\N
735	2	fizic	spiridonescu ioana	\N	\N	0745307631	\N	\N	2026-04-17 07:11:21.639478+00	\N	f	\N	\N	\N	\N
736	2	fizic	ADRIANA	\N	\N	0758065850	\N	\N	2026-04-17 07:11:22.004353+00	\N	f	\N	\N	\N	\N
737	2	fizic	cristi	\N	\N	0773878303	\N	\N	2026-04-17 07:15:15.837607+00	\N	f	\N	\N	\N	\N
738	2	fizic	badea Cătălin	\N	\N	\N	\N	\N	2026-04-17 07:26:13.296765+00	\N	f	\N	\N	\N	\N
739	2	fizic	BAZAVAN PETRE	\N	\N	0722213125	\N	\N	2026-04-17 07:32:33.405243+00	\N	f	\N	\N	\N	\N
740	2	fizic	popescu	\N	\N	0744614377	\N	\N	2026-04-17 07:40:14.749995+00	\N	f	\N	\N	\N	\N
741	2	fizic	citu sorin	\N	\N	0729822990	\N	\N	2026-04-17 07:42:09.902926+00	\N	f	\N	\N	\N	\N
742	2	juridic	CON-A OPERATIONS S.R.L.	15036274	\N	\N	\N	JUD. SIBIU, SAT ŞELIMBĂR COM. ŞELIMBĂR, STR. MIHAI VITEAZU, NR.2B	2026-04-17 07:54:03.560307+00	\N	f	\N	\N	\N	\N
743	2	fizic	RADU SORIN	\N	\N	0766249125	\N	\N	2026-04-17 07:58:07.461018+00	\N	f	\N	\N	\N	\N
744	2	fizic	ion	\N	\N	0771364567	\N	\N	2026-04-17 08:00:05.360047+00	\N	f	\N	\N	\N	\N
745	2	fizic	păun lucian	\N	\N	0724577936	\N	\N	2026-04-17 08:02:33.009708+00	\N	f	\N	\N	\N	\N
746	2	juridic	REGO DUMAGRI SRL	ro35704912	\N	0767728201	\N	JUD. DOLJ, MUN. CRAIOVA, STR. HENRI COANDĂ, NR.89, BL.45, SC.2, AP.2	2026-04-17 08:06:27.472077+00	\N	f	\N	\N	\N	\N
747	2	fizic	cosmin	\N	\N	0749657854	\N	\N	2026-04-17 08:10:56.769006+00	\N	f	\N	\N	\N	\N
748	2	fizic	bagdan	\N	\N	07676019531	\N	\N	2026-04-17 08:13:28.997053+00	\N	f	\N	\N	joc bucsi df	\N
749	2	fizic	FUIOREA	\N	\N	0765215621	\N	\N	2026-04-17 08:16:53.756816+00	\N	f	\N	\N	\N	\N
750	2	fizic	nedelcu	\N	\N	0729315852	\N	\N	2026-04-17 08:22:19.002051+00	\N	f	\N	\N	\N	\N
751	2	juridic	electro-flux	\N	\N	\N	\N	\N	2026-04-17 08:33:36.54676+00	\N	f	\N	\N	\N	\N
752	2	fizic	catalin	\N	\N	0768025400	\N	\N	2026-04-17 08:39:35.607142+00	\N	f	\N	\N	\N	\N
753	2	fizic	ghita cristina	\N	\N	0750433706	\N	\N	2026-04-17 08:45:30.744597+00	\N	f	\N	\N	\N	\N
754	2	fizic	florin dascalu	\N	\N	0745109552	\N	\N	2026-04-17 08:46:19.596266+00	\N	f	\N	\N	\N	\N
755	2	fizic	COSMIN	\N	\N	0749657854	\N	\N	2026-04-17 08:55:39.247239+00	\N	f	\N	\N	\N	\N
756	2	fizic	RENATO	\N	\N	0725576234	\N	\N	2026-04-17 08:56:59.346473+00	\N	f	\N	\N	\N	\N
757	2	fizic	doru	\N	\N	0740188221	\N	\N	2026-04-17 09:08:14.966398+00	\N	f	\N	\N	\N	\N
758	2	fizic	calina aurel	\N	\N	0745493049	\N	\N	2026-04-17 09:09:46.688776+00	\N	f	\N	\N	\N	\N
759	2	fizic	RADU	\N	\N	0722703365	\N	\N	2026-04-17 09:17:29.824018+00	\N	f	\N	\N	\N	\N
760	2	fizic	baduca campeanu georgiana	\N	\N	0728912456	\N	\N	2026-04-17 09:36:28.514699+00	\N	f	\N	\N	\N	\N
761	2	fizic	catalin	\N	\N	\N	\N	\N	2026-04-17 09:39:35.32636+00	\N	f	\N	\N	\N	\N
762	2	fizic	MIHAI ZAMFIR	\N	\N	0723696451	\N	\N	2026-04-17 09:41:38.424791+00	\N	f	\N	\N	\N	\N
763	2	fizic	VASILICA DOREL	\N	\N	0775 613 537	\N	\N	2026-04-17 09:42:33.639174+00	\N	f	\N	\N	\N	\N
766	2	fizic	elvis	\N	\N	0733602796	\N	\N	2026-04-17 09:50:08.699601+00	\N	f	\N	\N	\N	\N
767	2	fizic	andrei	\N	\N	0740161347	\N	\N	2026-04-17 09:55:06.012475+00	\N	f	\N	\N	\N	\N
768	2	fizic	calugaru silviu	\N	\N	0774602782	\N	\N	2026-04-17 10:03:55.57967+00	\N	f	\N	\N	\N	\N
769	2	fizic	gheorghe	\N	\N	0729033124	\N	\N	2026-04-17 10:04:31.182028+00	\N	f	\N	\N	\N	\N
770	2	fizic	dumitrescu luigi	\N	\N	0724513330	\N	\N	2026-04-17 10:06:00.238135+00	\N	f	\N	\N	\N	\N
771	2	fizic	LITA AUREL	\N	\N	0727 726 578	\N	\N	2026-04-17 10:09:23.956453+00	\N	f	\N	\N	\N	\N
772	2	fizic	adi	\N	\N	0771705739	\N	\N	2026-04-17 10:18:31.116512+00	\N	f	\N	\N	\N	\N
773	2	fizic	ANDREI CATALIN	\N	\N	0761716614	\N	\N	2026-04-17 10:25:49.364674+00	\N	f	\N	\N	\N	\N
774	2	fizic	NEAGOE BOGDAN	\N	\N	0765339445	\N	\N	2026-04-17 10:30:48.107739+00	\N	f	\N	\N	\N	\N
775	2	fizic	marian serbanoiu	\N	\N	0768104556	\N	\N	2026-04-17 10:32:46.303671+00	\N	f	\N	\N	\N	\N
776	2	fizic	nicolae ovidiu	\N	\N	0765227268	\N	\N	2026-04-17 10:36:07.422699+00	\N	f	\N	\N	\N	\N
777	2	fizic	madalina	\N	\N	0761216829	\N	\N	2026-04-17 10:41:28.106866+00	\N	f	\N	\N	\N	\N
778	2	fizic	vasile marian	\N	\N	0760833788	\N	\N	2026-04-17 10:48:58.666625+00	\N	f	\N	\N	\N	\N
779	2	fizic	oncioiu	\N	\N	0730120654	\N	\N	2026-04-17 11:12:09.980294+00	\N	f	\N	\N	\N	\N
780	2	fizic	barbu lucia	\N	\N	0765613709	\N	\N	2026-04-17 11:29:44.203541+00	\N	f	\N	\N	\N	\N
781	2	fizic	dina maria	\N	\N	0785112736	\N	\N	2026-04-17 11:43:04.989407+00	\N	f	\N	\N	\N	\N
782	2	fizic	DINCA C_TIN	\N	\N	0744922851	\N	\N	2026-04-17 11:43:17.807088+00	\N	f	\N	\N	\N	\N
765	2	fizic	BATANOIU ADRIAN	\N	\N	0747 294 553	\N	\N	2026-04-17 09:45:00.858992+00	2026-04-17 11:49:24.838992+00	f	\N	\N	\N	\N
783	2	fizic	TITA SORIN	\N	\N	07666880	\N	\N	2026-04-17 11:52:29.665265+00	\N	f	\N	\N	\N	\N
796	2	fizic	serban	\N	\N	0749260290	\N	\N	2026-04-17 13:28:13.235143+00	\N	f	\N	\N	\N	\N
764	2	juridic	TELECAST VIBE MEDICAL S.R.L.	48407158	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, ALEEA 1 CASTANILOR, NR.2A, BL.65A1, SC.1, AP.2	2026-04-17 09:43:38.438906+00	2026-04-17 12:05:00.034743+00	f	\N	\N	\N	\N
784	2	fizic	aurel mihai	\N	\N	0740304688	\N	\N	2026-04-17 12:08:09.637564+00	\N	f	\N	\N	\N	\N
785	2	fizic	mihai	\N	\N	0722430846	\N	\N	2026-04-17 12:11:19.461518+00	\N	f	\N	\N	\N	\N
786	2	fizic	mihai	\N	\N	0724259408	\N	\N	2026-04-17 12:15:51.233563+00	\N	f	\N	\N	\N	\N
787	2	fizic	georgescu ionut	\N	\N	0720558622	\N	\N	2026-04-17 12:26:07.438775+00	\N	f	\N	\N	\N	\N
788	2	fizic	ionut	\N	\N	0741012564	\N	\N	2026-04-17 12:47:47.061835+00	\N	f	\N	\N	\N	\N
789	2	fizic	con_a	\N	\N	0741236967	\N	\N	2026-04-17 12:48:54.464856+00	\N	f	\N	\N	\N	\N
790	2	fizic	marcel	\N	\N	0785081110	\N	\N	2026-04-17 12:59:16.920527+00	\N	f	\N	\N	\N	\N
791	2	fizic	codrut	\N	\N	0722253967	\N	\N	2026-04-17 13:04:07.991728+00	\N	f	\N	\N	\N	\N
792	2	fizic	RENATO	\N	\N	0723822318	\N	\N	2026-04-17 13:11:16.804682+00	\N	f	\N	\N	\N	\N
793	2	fizic	rada	\N	\N	0722586766	\N	\N	2026-04-17 13:12:09.341707+00	\N	f	\N	\N	\N	\N
794	2	fizic	petcu	\N	\N	0720032161	\N	\N	2026-04-17 13:16:41.93819+00	\N	f	\N	\N	\N	\N
795	2	fizic	Gomotarceanu Razvan	\N	\N	0741166682	\N	\N	2026-04-17 13:22:34.22875+00	\N	f	\N	\N	\N	\N
797	2	fizic	ilie	\N	\N	0771095355	\N	\N	2026-04-17 13:31:43.467394+00	\N	f	\N	\N	\N	\N
798	2	fizic	GULIE	\N	\N	0760520877	\N	\N	2026-04-17 13:32:01.950985+00	\N	f	\N	\N	\N	\N
799	2	fizic	burdusel florentina	\N	\N	0730344918	\N	\N	2026-04-17 13:38:59.866919+00	\N	f	\N	\N	\N	\N
800	2	fizic	renato	\N	\N	\N	\N	\N	2026-04-17 13:46:58.375882+00	\N	f	\N	\N	\N	\N
801	2	fizic	catalin	\N	\N	0760607406	\N	\N	2026-04-17 13:50:23.232314+00	\N	f	\N	\N	\N	\N
802	2	fizic	neacsu	\N	\N	0754284543	\N	\N	2026-04-17 13:59:22.599424+00	\N	f	\N	\N	\N	\N
803	2	juridic	CAPITAL INFUSE ADVISOR S.R.L.	41091278	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. EMANOIL CHINEZU, NR.12, BL.H2, SC.C, ET.1, AP.5	2026-04-17 13:59:44.484583+00	\N	f	\N	\N	\N	\N
804	2	fizic	GEANTA NICUSOR	\N	\N	0723766230	\N	\N	2026-04-17 14:03:26.050046+00	\N	f	\N	\N	\N	\N
805	2	fizic	pesea radu	\N	\N	0749123543	\N	\N	2026-04-17 14:09:50.298216+00	\N	f	\N	\N	\N	\N
806	2	fizic	andrei	\N	\N	0763403940	\N	\N	2026-04-17 14:15:49.291736+00	\N	f	\N	\N	\N	\N
807	2	fizic	tanasescu silviu	\N	\N	0753052949	\N	\N	2026-04-17 14:19:22.096956+00	\N	f	\N	\N	\N	\N
808	2	fizic	TODOR	\N	\N	0764893971	\N	\N	2026-04-17 14:38:08.599355+00	\N	f	\N	\N	\N	\N
809	2	fizic	constantin	\N	\N	0721979491	\N	\N	2026-04-20 05:31:44.533009+00	\N	f	\N	\N	\N	\N
810	2	fizic	nitela	\N	\N	\N	\N	\N	2026-04-20 05:34:44.147408+00	\N	f	\N	\N	\N	\N
811	2	fizic	cocora adrian	\N	\N	0767785207	\N	\N	2026-04-20 05:39:06.685863+00	\N	f	\N	\N	\N	\N
812	2	fizic	TERPEZICEANU CLAUDIU	\N	\N	0729 137 592	\N	\N	2026-04-20 05:41:53.635211+00	\N	f	\N	\N	\N	\N
813	2	fizic	qfort	\N	\N	\N	\N	\N	2026-04-20 05:53:39.42419+00	\N	f	\N	\N	\N	\N
814	2	fizic	oncioiu	\N	\N	0730120654	\N	\N	2026-04-20 05:54:51.161603+00	\N	f	\N	\N	\N	\N
815	2	fizic	FLORIN  VANATORU	\N	\N	0760193759	\N	\N	2026-04-20 06:01:17.659308+00	\N	f	\N	\N	\N	\N
816	2	fizic	BOGDAN	\N	\N	0760143180	\N	\N	2026-04-20 06:02:41.59249+00	2026-04-20 06:03:03.393045+00	f	\N	\N	anvelope fata uzate int	\N
817	2	fizic	mihai zamfir	\N	\N	0723696451	\N	\N	2026-04-20 06:06:06.952865+00	\N	f	\N	\N	\N	\N
818	2	fizic	OVIDIU	\N	\N	0741201913	\N	\N	2026-04-20 06:09:40.017386+00	\N	f	\N	\N	\N	\N
819	2	fizic	preda marius	\N	\N	0766243467	\N	\N	2026-04-20 06:16:51.882618+00	\N	f	\N	\N	\N	\N
820	2	fizic	nistor daniel	\N	\N	0727363891	\N	\N	2026-04-20 06:25:56.29231+00	\N	f	\N	\N	\N	\N
821	2	fizic	gabriel	\N	\N	0723593755	\N	\N	2026-04-20 06:29:47.105693+00	\N	f	\N	\N	\N	\N
822	2	fizic	adrian	\N	\N	0768245936	\N	\N	2026-04-20 06:38:46.506523+00	\N	f	\N	\N	\N	\N
823	2	fizic	braica ion	\N	\N	0762654003	\N	\N	2026-04-20 06:39:53.917708+00	\N	f	\N	\N	\N	\N
825	2	juridic	PROFLEX SUD SRL	RO28465510	\N	0765249614	\N	JUD. MUREŞ, MUN. REGHIN, STR. IERBUŞULUI, NR.38B, CORP 2. BIROU	2026-04-20 06:57:04.310101+00	\N	f	\N	\N	\N	\N
824	2	fizic	PACESCU TONI	\N	\N	0773 358 934	\N	\N	2026-04-20 06:53:26.249726+00	2026-04-20 07:07:32.6372+00	f	\N	\N	km360000	\N
826	2	fizic	GIDAZI	\N	\N	0764821063	\N	\N	2026-04-20 07:10:06.212114+00	\N	f	\N	\N	\N	\N
827	2	juridic	ROMASTRU TRADING SRL	6769462	\N	\N	\N	MUNICIPIUL BUCUREŞTI, SECTOR 1, STR. BIHARIA, NR.67-77, ET.2	2026-04-20 07:19:39.32822+00	\N	f	\N	\N	\N	\N
828	2	fizic	ISTRATE ADRIAN	\N	\N	0720 044 575	\N	\N	2026-04-20 07:20:09.531318+00	\N	f	\N	\N	\N	\N
829	2	fizic	langa iulian	\N	\N	0728551406	\N	\N	2026-04-20 07:30:22.699556+00	\N	f	\N	\N	\N	\N
830	2	fizic	amza stelian	\N	\N	0764821063	\N	\N	2026-04-20 07:31:33.271546+00	\N	f	\N	\N	\N	\N
831	2	fizic	bancu nicusor	\N	\N	0769351296	\N	\N	2026-04-20 07:34:04.501434+00	\N	f	\N	\N	\N	\N
832	2	fizic	chira eugen	\N	\N	0745573367	\N	\N	2026-04-20 07:44:46.723446+00	\N	f	\N	\N	\N	\N
833	2	fizic	claudiu	\N	\N	0736271007	\N	\N	2026-04-20 07:45:15.224064+00	\N	f	\N	\N	\N	\N
834	2	fizic	VADUVA	\N	\N	0721546702	\N	\N	2026-04-20 07:48:06.985434+00	\N	f	\N	\N	\N	\N
836	2	fizic	AVRAM SORIN	\N	\N	0740304669	\N	\N	2026-04-20 08:15:39.825658+00	\N	f	\N	\N	\N	\N
837	2	fizic	nicolae	\N	\N	0747850011	\N	\N	2026-04-20 08:16:06.814228+00	\N	f	\N	\N	\N	\N
838	2	fizic	langa iulian	\N	\N	0728551406	\N	\N	2026-04-20 08:19:44.610984+00	\N	f	\N	\N	\N	\N
839	2	fizic	mihai josceanu	\N	\N	0749208736	\N	\N	2026-04-20 08:33:40.88065+00	\N	f	\N	\N	\N	\N
840	2	fizic	bancu nicusor	\N	\N	\N	\N	\N	2026-04-20 08:42:28.130186+00	\N	f	\N	\N	\N	\N
841	2	fizic	STANCIU. MARIAN	\N	\N	0736069914	\N	\N	2026-04-20 08:47:06.305055+00	\N	f	\N	\N	\N	\N
835	2	fizic	LUTA ADRIAN	\N	\N	0784 705 040	\N	\N	2026-04-20 07:50:26.507142+00	2026-04-20 08:51:54.927548+00	f	\N	\N	\N	\N
842	2	fizic	ROXANA	\N	\N	0723519198	\N	\N	2026-04-20 08:58:35.61359+00	\N	f	\N	\N	\N	\N
843	2	fizic	ONCIOIU CONSTANTIN	\N	\N	0730120654	\N	\N	2026-04-20 09:02:10.149549+00	\N	f	\N	\N	\N	\N
844	2	fizic	adi	\N	\N	\N	\N	\N	2026-04-20 09:15:25.453158+00	\N	f	\N	\N	\N	\N
845	2	fizic	nica mircea	\N	\N	0722232374	\N	\N	2026-04-20 09:19:55.64212+00	\N	f	\N	\N	\N	\N
846	2	fizic	harega	\N	\N	0720540404	\N	\N	2026-04-20 09:26:48.816615+00	\N	f	\N	\N	\N	\N
847	2	juridic	RAMSES S.R.L.	4741228	\N	0721823669	\N	JUD. OLT, MUN. SLATINA, BLD. ALEXANDRU IOAN CUZA, NR.39, BL.4, SC.A, ET.2, AP.4	2026-04-20 09:29:17.107066+00	\N	f	\N	\N	\N	\N
848	2	fizic	miu stefan	\N	\N	0767484341	\N	\N	2026-04-20 09:30:28.567264+00	\N	f	\N	\N	\N	\N
849	2	fizic	andrei	\N	\N	0775289177	\N	\N	2026-04-20 09:32:37.578289+00	\N	f	\N	\N	masina are probleme cu virajul si cu anv df	\N
850	2	juridic	ECORIDE OLTENIA S.R.L.	52152630	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. GRIGORE PLEŞOIANU, NR.15J	2026-04-20 09:33:49.788941+00	\N	f	\N	\N	\N	\N
851	2	fizic	manda	\N	\N	0722465211	\N	\N	2026-04-20 09:46:31.115246+00	\N	f	\N	\N	bucsi brate fata rupte st dr	\N
852	2	fizic	MIHAI  TRANA	\N	\N	0724018866	\N	\N	2026-04-20 09:52:53.691032+00	\N	f	\N	\N	\N	\N
853	2	fizic	leoveanu ovidiu	\N	\N	0729793045	\N	\N	2026-04-20 09:53:57.695718+00	\N	f	\N	\N	\N	\N
854	2	juridic	AVIOANE CRAIOVA SA	2326144	\N	\N	\N	JUD. DOLJ, SAT GHERCEŞTI COM. GHERCEŞTI, STR. AVIATORILOR, NR.10	2026-04-20 10:13:43.960782+00	\N	f	\N	\N	\N	\N
855	2	fizic	dumitru cristina	\N	\N	0772072738	\N	\N	2026-04-20 10:16:11.417025+00	\N	f	\N	\N	\N	\N
856	2	fizic	ovidiu	\N	\N	0729793045	\N	\N	2026-04-20 10:16:44.911926+00	\N	f	\N	\N	\N	\N
857	2	fizic	calin	\N	\N	0762474488	\N	\N	2026-04-20 10:29:49.501644+00	\N	f	\N	\N	\N	\N
858	2	juridic	CASA NOASTRA S.R.L.	RO7510066	\N	0758256800	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CALEA BUCURESTI, NR.113	2026-04-20 10:30:09.062423+00	\N	f	\N	\N	\N	\N
859	2	fizic	cosmin	\N	\N	0749657854	\N	\N	2026-04-20 10:32:49.184738+00	\N	f	\N	\N	\N	\N
860	2	fizic	cristina	\N	\N	0744609640	\N	\N	2026-04-20 10:38:04.269266+00	\N	f	\N	\N	\N	\N
861	2	fizic	stefan	\N	\N	0773937792	\N	\N	2026-04-20 10:52:14.773515+00	\N	f	\N	\N	\N	\N
862	2	fizic	andrei logofatu	\N	\N	0766676824	\N	\N	2026-04-20 10:52:27.831096+00	\N	f	\N	\N	\N	\N
863	2	fizic	fanuica andrea	\N	\N	0754555202	\N	\N	2026-04-20 10:53:01.224172+00	\N	f	\N	\N	\N	\N
864	2	fizic	POPESCU DAVID	\N	\N	0740150515	\N	\N	2026-04-20 10:57:04.776288+00	\N	f	\N	\N	\N	\N
865	2	fizic	RUSAN RAZVAN	\N	\N	0774048125	\N	\N	2026-04-20 11:08:50.446336+00	\N	f	\N	\N	\N	\N
866	2	fizic	calin stefan	\N	\N	0766528562	\N	\N	2026-04-20 11:28:05.496282+00	\N	f	\N	\N	\N	\N
867	2	fizic	MIRCEA	\N	\N	0773955427	\N	\N	2026-04-20 11:33:10.127099+00	\N	f	\N	\N	\N	\N
868	2	fizic	oncioiu	\N	\N	0730120654	\N	\N	2026-04-20 11:34:53.355214+00	\N	f	\N	\N	\N	\N
869	2	fizic	COLTAN LOREDANA	\N	\N	0729604847	\N	\N	2026-04-20 11:42:48.831573+00	\N	f	\N	\N	\N	\N
870	2	fizic	gheorghe adrian	\N	\N	0728180700	\N	\N	2026-04-20 11:49:46.148788+00	\N	f	\N	\N	\N	\N
871	2	fizic	q fort	\N	\N	\N	\N	\N	2026-04-20 11:52:33.263398+00	\N	f	\N	\N	\N	\N
872	2	fizic	zamfir	\N	\N	0745683665	\N	\N	2026-04-20 11:55:21.757759+00	\N	f	\N	\N	\N	\N
873	2	fizic	SMARANDACHE ALINA	\N	\N	0740051024	\N	\N	2026-04-20 11:59:31.717576+00	\N	f	\N	\N	\N	\N
874	2	juridic	AVIZOO ROM S.R.L.	RO38762225	\N	0766664186	\N	JUD. DOLJ, SAT BEHARCA COM. COŢOFENII DIN FAŢĂ, G, NR.13	2026-04-20 12:01:42.200258+00	\N	f	\N	\N	\N	\N
875	2	fizic	tataru lucian	\N	\N	0759457832	\N	\N	2026-04-20 12:06:34.341365+00	\N	f	\N	\N	\N	\N
876	2	fizic	MATEI MIU	\N	\N	0724531452	\N	\N	2026-04-20 12:15:48.592847+00	\N	f	\N	\N	\N	\N
877	2	fizic	popescu	\N	\N	0769741668	\N	\N	2026-04-20 12:19:22.198878+00	\N	f	\N	\N	\N	\N
878	2	fizic	marin	\N	\N	0744528402	\N	\N	2026-04-20 12:22:50.228266+00	\N	f	\N	\N	\N	\N
879	2	fizic	dragosi	\N	\N	0758256800	\N	\N	2026-04-20 12:25:03.350905+00	\N	f	\N	\N	\N	\N
880	2	fizic	costel	\N	\N	0728188232	\N	\N	2026-04-20 12:43:49.660148+00	\N	f	\N	\N	\N	\N
881	2	juridic	CASA NOASTRA S.R.L.	RO7510066	\N	0758256800	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CALEA BUCURESTI, NR.113	2026-04-20 12:47:22.590142+00	\N	f	\N	\N	\N	\N
882	2	fizic	ANDREI	\N	\N	0751930348	\N	\N	2026-04-20 12:53:41.908843+00	\N	f	\N	\N	\N	\N
883	2	fizic	MUSCALAGIU NICOLAE	\N	\N	0744572398	\N	\N	2026-04-20 12:54:06.219463+00	\N	f	\N	\N	\N	\N
884	2	fizic	popescu daniel	\N	\N	0751139460	\N	\N	2026-04-20 12:57:50.129616+00	\N	f	\N	\N	\N	\N
885	2	fizic	ovidiu	\N	\N	0784095341	\N	\N	2026-04-20 13:03:36.330473+00	\N	f	\N	\N	\N	\N
886	2	fizic	dan	\N	\N	0741099940	\N	\N	2026-04-20 13:13:29.967857+00	\N	f	\N	\N	\N	\N
887	2	fizic	SPIRIDON FLORIN	\N	\N	0737168788	\N	\N	2026-04-20 13:15:48.5375+00	\N	f	\N	\N	\N	\N
888	2	fizic	JUJEA MICHI	\N	\N	0766665833	\N	\N	2026-04-20 13:23:57.526333+00	\N	f	\N	\N	\N	\N
889	2	fizic	tudor nicolae	\N	\N	0765243167	\N	\N	2026-04-20 13:24:05.306057+00	\N	f	\N	\N	\N	\N
890	2	fizic	tudor nicolae	\N	\N	0765243167	\N	\N	2026-04-20 13:25:31.207486+00	\N	f	\N	\N	\N	\N
891	2	fizic	camelia bitu	\N	\N	0752072610	\N	\N	2026-04-20 13:26:19.373183+00	\N	f	\N	\N	\N	\N
892	2	fizic	MANDEA VIORICA	\N	\N	0765974014	\N	\N	2026-04-20 13:29:30.178018+00	\N	f	\N	\N	\N	\N
893	2	juridic	LOMPRY TRANS S.R.L.	6820905	\N	\N	\N	JUD. GORJ, COM. BUMBEŞTI-PIŢIC	2026-04-20 13:31:09.459895+00	\N	f	\N	\N	\N	\N
894	2	fizic	BARBUCEANU GABRIEL	\N	\N	0720022473	\N	\N	2026-04-20 13:31:09.827425+00	\N	f	\N	\N	\N	\N
895	2	fizic	mihai	\N	\N	0768930274	\N	\N	2026-04-20 13:35:20.835497+00	\N	f	\N	\N	anvelope uzate	\N
896	2	juridic	jane	simode	\N	\N	\N	\N	2026-04-20 13:37:23.777187+00	\N	f	\N	\N	\N	\N
897	2	fizic	DINUT MARIN	\N	\N	0730510283	km 567070	\N	2026-04-20 13:42:43.130973+00	\N	f	\N	\N	\N	\N
898	2	fizic	buica	\N	\N	0786199939	\N	\N	2026-04-20 13:43:37.903031+00	\N	f	\N	\N	\N	\N
899	2	fizic	DANIELA	\N	\N	0723056115	\N	\N	2026-04-20 13:49:48.887098+00	\N	f	\N	\N	\N	\N
900	2	fizic	barbulescu sorin	\N	\N	0720581188	\N	\N	2026-04-20 13:51:29.604675+00	\N	f	\N	\N	\N	\N
902	2	fizic	oprea	\N	\N	0740161347	\N	\N	2026-04-20 14:00:43.774879+00	\N	f	\N	\N	anvelope fata uzate	\N
903	2	fizic	rosu marius	\N	\N	0722538905	\N	\N	2026-04-20 14:03:08.142011+00	\N	f	\N	\N	\N	\N
901	2	juridic	LOMPRY TRANS S.R.L.	6820905	\N	0744115640	\N	JUD. GORJ, COM. BUMBEŞTI-PIŢIC	2026-04-20 13:55:44.992528+00	2026-04-20 14:14:50.086953+00	f	\N	\N	km560000	\N
904	2	fizic	mihai	\N	\N	0756564043	\N	\N	2026-04-20 14:18:27.114561+00	\N	f	\N	\N	\N	\N
905	2	fizic	tudor nicolae	\N	\N	0765243167	\N	\N	2026-04-20 14:20:47.890947+00	\N	f	\N	\N	\N	\N
906	2	fizic	CRISTINA	\N	\N	0751285883	\N	\N	2026-04-20 14:21:16.056298+00	\N	f	\N	\N	\N	\N
907	2	fizic	BOGDAN SPAITU	\N	\N	0767437499	\N	\N	2026-04-20 14:29:01.7556+00	\N	f	\N	\N	\N	\N
908	2	fizic	SEBASTIAN	\N	\N	0769602104	\N	\N	2026-04-20 14:38:31.52727+00	\N	f	\N	\N	\N	\N
909	2	fizic	TEODORESCU OANA	\N	\N	0766741036	\N	\N	2026-04-21 05:48:52.064783+00	\N	f	\N	\N	\N	\N
910	2	fizic	mario	\N	\N	0755504205	\N	\N	2026-04-21 05:49:05.388826+00	\N	f	\N	\N	\N	\N
911	2	fizic	catalin	\N	\N	0768930866	\N	\N	2026-04-21 05:52:08.029203+00	\N	f	\N	\N	\N	\N
912	2	fizic	cristian	\N	\N	0751167809	\N	\N	2026-04-21 05:59:16.071797+00	\N	f	\N	\N	\N	\N
913	2	fizic	florin	\N	\N	0757065031	\N	\N	2026-04-21 06:01:12.420243+00	\N	f	\N	\N	\N	\N
914	2	fizic	sdiaconu ciprian	\N	\N	0722451595	\N	\N	2026-04-21 06:01:55.776922+00	\N	f	\N	\N	\N	\N
916	2	fizic	mario	\N	\N	0755504205	\N	\N	2026-04-21 06:14:45.726276+00	\N	f	\N	\N	\N	\N
917	2	fizic	iordache	\N	\N	0768786685	\N	\N	2026-04-21 06:24:30.75706+00	\N	f	\N	\N	joc cap bara si bieleta sf	\N
918	2	fizic	PATRU DUMITRU	\N	\N	0784181693	\N	\N	2026-04-21 06:25:39.631959+00	\N	f	\N	\N	\N	\N
919	2	fizic	florina	\N	\N	0770670984	\N	\N	2026-04-21 06:29:45.89502+00	\N	f	\N	\N	\N	\N
920	2	fizic	floricel alexandra	\N	\N	0761207111	\N	\N	2026-04-21 06:32:36.558625+00	\N	f	\N	\N	\N	\N
921	2	fizic	dorinel	\N	\N	0784964655	\N	\N	2026-04-21 06:34:33.14511+00	\N	f	\N	\N	\N	\N
922	2	juridic	TIAB SA	1555115	\N	\N	\N	MUNICIPIUL BUCUREŞTI, SECTOR 1, STR. PICTOR ARTHUR VERONA, NR.17	2026-04-21 06:37:43.124097+00	\N	f	\N	\N	\N	\N
923	2	fizic	preda daniel	\N	\N	0778709952	\N	\N	2026-04-21 06:40:47.406359+00	\N	f	\N	\N	\N	\N
924	2	fizic	mitica	\N	\N	0744552325	\N	\N	2026-04-21 06:41:24.179572+00	\N	f	\N	\N	\N	\N
925	2	fizic	nistor daniel	\N	\N	0727363891	\N	\N	2026-04-21 06:41:31.876215+00	\N	f	\N	\N	\N	\N
915	2	fizic	CONSTANTIN ALEXANDRU	\N	\N	00393 473 079 564	\N	\N	2026-04-21 06:14:21.300347+00	2026-04-21 06:44:52.101681+00	f	\N	\N	\N	\N
926	2	fizic	POPESCU SORIN	\N	\N	0744601989	\N	\N	2026-04-21 06:51:37.248963+00	\N	f	\N	\N	\N	\N
927	2	fizic	urdes costel	\N	\N	0743137346	\N	\N	2026-04-21 07:15:16.91981+00	\N	f	\N	\N	\N	\N
928	2	fizic	octavian	\N	\N	0727691819	\N	\N	2026-04-21 07:15:57.969913+00	\N	f	\N	\N	\N	\N
929	2	fizic	gigiu valentin	\N	\N	0771629007	\N	\N	2026-04-21 07:16:16.756249+00	\N	f	\N	\N	\N	\N
930	2	fizic	staicu adrian	\N	\N	0722521394	\N	\N	2026-04-21 07:23:21.806759+00	\N	f	\N	\N	\N	\N
931	2	fizic	urleteanu petrisor	\N	\N	0746251557	\N	\N	2026-04-21 07:26:31.596843+00	\N	f	\N	\N	\N	\N
932	2	fizic	ELECTROFLUX	\N	\N	07...........nu vrea sa dea nr	\N	\N	2026-04-21 07:36:04.488307+00	\N	f	\N	\N	\N	\N
933	2	fizic	BALASA CATALIN	\N	\N	0785353011	\N	\N	2026-04-21 07:43:29.722928+00	\N	f	\N	\N	KM210000	\N
934	2	fizic	micu cornel	\N	\N	0733103773	\N	\N	2026-04-21 07:49:16.902601+00	\N	f	\N	\N	\N	\N
935	2	fizic	cristian	\N	\N	0745369223	\N	\N	2026-04-21 07:49:24.355037+00	\N	f	\N	\N	\N	\N
936	2	fizic	gabriel besliu	\N	\N	0724311883	\N	\N	2026-04-21 08:03:00.282439+00	\N	f	\N	\N	\N	\N
937	2	fizic	ignat marcel	\N	\N	0760397397	\N	\N	2026-04-21 08:03:19.848223+00	\N	f	\N	\N	\N	\N
938	2	fizic	PELEA   NICOLAE	\N	\N	0766512191	\N	\N	2026-04-21 08:06:28.74295+00	\N	f	\N	\N	\N	\N
939	2	fizic	ILIE STEFAN	\N	\N	0766615953	\N	\N	2026-04-21 08:10:32.254186+00	\N	f	\N	\N	\N	\N
940	2	fizic	laur	\N	\N	0740010555	\N	\N	2026-04-21 08:11:06.643117+00	\N	f	\N	\N	\N	\N
941	2	juridic	CENTRO TRANS CORPORATION SRL	4680899	\N	\N	\N	JUD. DOLJ, SAT PADEA COM. DRĂNIC	2026-04-21 08:26:03.123219+00	\N	f	\N	\N	\N	\N
942	2	fizic	EPINGEAC DORU	\N	\N	0727874331	\N	\N	2026-04-21 08:27:13.728192+00	\N	f	\N	\N	\N	\N
943	2	fizic	toma anton	\N	\N	0763763966	\N	\N	2026-04-21 08:27:54.01501+00	\N	f	\N	\N	\N	\N
944	2	fizic	socaciu dan	\N	\N	0724872520	\N	\N	2026-04-21 08:33:00.360026+00	\N	f	\N	\N	\N	\N
945	2	fizic	FLORIN	\N	\N	0758646611	\N	\N	2026-04-21 08:42:50.507799+00	\N	f	\N	\N	\N	\N
946	2	fizic	popeci	\N	\N	\N	\N	\N	2026-04-21 08:45:30.647101+00	\N	f	\N	\N	\N	\N
947	2	fizic	UNGUREANU MARIAN	\N	\N	0741040947	\N	\N	2026-04-21 08:57:12.361413+00	\N	f	\N	\N	\N	\N
949	2	fizic	VARZARU MIRCEA	\N	\N	0723319498	\N	\N	2026-04-21 09:04:05.930229+00	\N	f	\N	\N	\N	\N
951	2	fizic	MIHAI IONUT	\N	\N	0743 409 540	\N	\N	2026-04-21 09:10:10.163751+00	\N	f	\N	\N	\N	\N
952	2	fizic	LAURENTIU	\N	\N	\N	\N	\N	2026-04-21 09:10:17.418552+00	\N	f	\N	\N	\N	\N
953	2	fizic	cioabla ileana	\N	\N	0735435300	\N	\N	2026-04-21 09:13:39.302179+00	\N	f	\N	\N	\N	\N
954	2	fizic	popescu cosmin	\N	\N	0761593077	\N	\N	2026-04-21 09:17:35.043766+00	\N	f	\N	\N	\N	\N
955	2	fizic	FLORI CRISTIAN	\N	\N	0760 039 002	\N	\N	2026-04-21 09:33:48.937325+00	\N	f	\N	\N	\N	\N
956	2	fizic	STINGA OVIDIU	\N	\N	0763 699 559	\N	\N	2026-04-21 09:34:36.022673+00	\N	f	\N	\N	\N	\N
948	2	fizic	PISICA TINEL	\N	\N	0764 882 060	\N	\N	2026-04-21 09:00:13.511041+00	2026-04-21 09:41:32.140439+00	f	\N	\N	\N	\N
957	2	fizic	FALCASI IONUT	\N	\N	0784985624	\N	\N	2026-04-21 09:45:03.671363+00	\N	f	\N	\N	\N	\N
958	2	fizic	cioroianu dan	\N	\N	0721334122	\N	\N	2026-04-21 09:54:49.358287+00	\N	f	\N	\N	\N	\N
959	2	fizic	vintila alexandru	\N	\N	0723519895	\N	\N	2026-04-21 09:56:32.439232+00	\N	f	\N	\N	\N	\N
960	2	fizic	petrisor	\N	\N	0746251557	\N	\N	2026-04-21 09:56:33.907801+00	\N	f	\N	\N	\N	\N
961	2	fizic	cosmin	\N	\N	0761593077	\N	\N	2026-04-21 10:07:39.42308+00	\N	f	\N	\N	\N	\N
962	2	fizic	iordache cristian	\N	\N	0726113003	\N	\N	2026-04-21 10:10:40.691343+00	\N	f	\N	\N	\N	\N
950	2	fizic	VACARU ROBERT	\N	\N	0724 534 471	\N	\N	2026-04-21 09:09:26.879672+00	2026-04-21 10:10:52.844534+00	f	\N	\N	\N	\N
963	2	fizic	robert	\N	\N	0724534471	\N	\N	2026-04-21 10:32:44.724584+00	\N	f	\N	\N	\N	\N
964	2	fizic	COSMIN	\N	\N	0725251139	\N	\N	2026-04-21 10:40:18.54412+00	\N	f	\N	\N	\N	\N
965	2	fizic	marius	\N	\N	0762622667	\N	\N	2026-04-21 10:49:26.730165+00	\N	f	\N	\N	\N	\N
966	2	juridic	ACCORDING GROUP SRL	7563613	\N	\N	\N	JUD. IAŞI, MUN. IAŞI, ŞOS. NICOLINA, NR.223C	2026-04-21 11:03:31.835614+00	\N	f	\N	\N	\N	\N
967	2	fizic	neamtu daniel	\N	\N	0727727496	\N	\N	2026-04-21 11:15:41.970007+00	\N	f	\N	\N	\N	\N
968	2	fizic	pop	\N	\N	0744562572	\N	\N	2026-04-21 11:22:13.154189+00	\N	f	\N	\N	\N	\N
969	2	fizic	ovidiu	\N	\N	0763699599	\N	\N	2026-04-21 11:22:50.470406+00	2026-04-21 11:22:57.095412+00	f	\N	\N	\N	\N
970	2	fizic	STEFAN GAE	\N	\N	0770480418	\N	\N	2026-04-21 11:34:57.744768+00	\N	f	\N	\N	\N	\N
971	2	fizic	PATRU ALIN	\N	\N	0767414610	\N	\N	2026-04-21 11:36:45.401398+00	\N	f	\N	\N	km83000	\N
972	2	fizic	pruna andrei	\N	\N	0762438144	\N	\N	2026-04-21 11:48:19.333522+00	\N	f	\N	\N	\N	\N
974	2	fizic	gligor	\N	\N	0723134109	\N	\N	2026-04-21 11:51:10.075637+00	\N	f	\N	\N	\N	\N
975	2	fizic	marinel	\N	\N	0722632188	\N	\N	2026-04-21 12:00:07.939053+00	\N	f	\N	\N	\N	\N
976	2	juridic	ROBERT AUTO S.R.L.	22298278	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. CONSTANTIN BRANCOVEANU, NR.89, BL.10A, SC.2, AP.2	2026-04-21 12:00:51.058957+00	\N	f	\N	\N	\N	\N
977	2	fizic	baraga ion	\N	\N	0735329936	\N	\N	2026-04-21 12:05:49.888226+00	\N	f	\N	\N	\N	\N
978	2	fizic	neicu marius	\N	\N	0768802427	\N	\N	2026-04-21 12:07:44.387706+00	2026-04-21 12:07:48.184932+00	f	\N	\N	\N	\N
979	2	fizic	Marcel	\N	\N	0721043388	\N	\N	2026-04-21 12:12:43.980444+00	\N	f	\N	\N	\N	\N
980	2	fizic	NISTORESCU	\N	\N	0724572202	\N	\N	2026-04-21 12:13:28.19272+00	\N	f	\N	\N	\N	\N
981	2	fizic	NISTORESCU	\N	\N	0724572202	\N	\N	2026-04-21 12:14:49.814995+00	\N	f	\N	\N	\N	\N
982	2	fizic	nistorescu	\N	\N	0724572202	\N	\N	2026-04-21 12:15:32.387939+00	\N	f	\N	\N	\N	\N
983	2	fizic	nicu	\N	\N	0754020308	\N	\N	2026-04-21 12:18:50.157424+00	\N	f	\N	\N	\N	\N
973	2	juridic	DUO ANTEEA SRL	RO36857795	BUTUROAGA TEODORA	0740037185	\N	JUD. DOLJ, MUN. CRAIOVA, STR. PARÎNGULUI, NR.98B	2026-04-21 11:50:23.200686+00	2026-04-21 12:22:50.831113+00	f	\N	\N	\N	\N
984	2	fizic	ion	\N	\N	0726619281	\N	\N	2026-04-21 12:29:36.464745+00	\N	f	\N	\N	422000km	\N
985	2	juridic	Mega construct	\N	\N	\N	\N	\N	2026-04-21 12:32:04.246809+00	\N	f	\N	\N	\N	\N
986	2	fizic	marin ristoiu	\N	\N	0752303906	\N	\N	2026-04-21 12:32:41.552681+00	\N	f	\N	\N	\N	\N
987	2	fizic	cristina	\N	\N	0744609640	\N	\N	2026-04-21 12:38:38.490803+00	\N	f	\N	\N	\N	\N
988	2	fizic	ghita	\N	\N	0720220603	\N	\N	2026-04-21 12:40:10.307988+00	\N	f	\N	\N	\N	\N
989	2	fizic	BOGDAN TRICA	\N	\N	0769661662	\N	\N	2026-04-21 12:45:20.40114+00	\N	f	\N	\N	\N	\N
990	2	fizic	stefan florescu	\N	\N	\N	\N	\N	2026-04-21 13:04:20.486093+00	\N	f	\N	\N	\N	\N
991	2	fizic	AURASI	\N	\N	0743294011	\N	\N	2026-04-21 13:10:50.038438+00	\N	f	\N	\N	\N	\N
992	2	fizic	dorin ciucu	\N	\N	0732123699	\N	\N	2026-04-21 13:12:24.163649+00	\N	f	\N	\N	\N	\N
993	2	fizic	MARCU SORIN	\N	\N	0752188199	\N	\N	2026-04-21 13:13:54.728283+00	\N	f	\N	\N	\N	\N
994	2	fizic	MARCU SORIN	\N	\N	0752188199	\N	\N	2026-04-21 13:37:49.2654+00	\N	f	\N	\N	\N	\N
995	2	fizic	cherciu catalin	\N	\N	0760743353	\N	\N	2026-04-21 13:38:06.303239+00	\N	f	\N	\N	\N	\N
996	2	fizic	CLAUDIU	\N	\N	0743294011	\N	\N	2026-04-21 13:42:27.656559+00	\N	f	\N	\N	\N	\N
997	2	fizic	bogdan	\N	\N	0760309511	\N	\N	2026-04-21 13:47:41.024883+00	\N	f	\N	\N	\N	\N
998	2	fizic	DANIEL	\N	\N	0751839279	\N	\N	2026-04-21 13:49:57.393868+00	\N	f	\N	\N	\N	\N
999	2	fizic	viorel	\N	\N	0767888218	\N	\N	2026-04-21 14:06:25.008295+00	\N	f	\N	\N	\N	\N
1000	2	juridic	CALF BIJOU SRL	3872012	\N	\N	\N	JUD. DOLJ, SAT BUCOVĂŢ COM. BUCOVĂŢ	2026-04-21 14:17:46.190344+00	\N	f	\N	\N	\N	\N
1001	2	fizic	smaranda	\N	\N	0729127574	\N	\N	2026-04-22 05:23:52.850253+00	\N	f	\N	\N	\N	\N
1002	2	fizic	calin marian	\N	\N	0757111748	\N	\N	2026-04-22 05:45:57.199422+00	\N	f	\N	\N	\N	\N
1003	2	fizic	BALASOIU NICOLAIE	\N	\N	0745086779	\N	\N	2026-04-22 05:48:02.667883+00	\N	f	\N	\N	\N	\N
1004	2	fizic	boldici	\N	\N	\N	\N	\N	2026-04-22 05:51:34.092384+00	\N	f	\N	\N	\N	\N
1005	2	fizic	bangau marian	\N	\N	0755782914	\N	\N	2026-04-22 05:53:26.447327+00	\N	f	\N	\N	\N	\N
1006	2	fizic	BAILESCU CARLA	\N	\N	0724580020	\N	\N	2026-04-22 05:56:53.521199+00	\N	f	\N	\N	\N	\N
1007	2	fizic	BARBU ALIN	\N	\N	0762081218	\N	\N	2026-04-22 05:58:48.942966+00	\N	f	\N	\N	\N	\N
1008	2	fizic	ciprian	\N	\N	0733030451	\N	\N	2026-04-22 06:03:11.851188+00	\N	f	\N	\N	\N	\N
1009	2	juridic	LEGOGIS S.R.L.	47669118	\N	\N	\N	JUD. MEHEDINŢI, MUN. DROBETA-TURNU SEVERIN, STR. AL. I. CUZA, NR.36	2026-04-22 06:30:58.648249+00	\N	f	\N	\N	\N	\N
1010	2	fizic	popa	\N	\N	0744631988	\N	\N	2026-04-22 06:31:01.471806+00	\N	f	\N	\N	\N	\N
1011	2	fizic	sandu tudorel	\N	\N	0745838796	\N	\N	2026-04-22 06:37:32.970852+00	\N	f	\N	\N	\N	\N
1012	2	fizic	MARIUS	\N	\N	0762622667	\N	\N	2026-04-22 06:44:32.169276+00	\N	f	\N	\N	\N	\N
1013	2	fizic	Catalin	\N	\N	0766213669	\N	\N	2026-04-22 06:44:48.445426+00	\N	f	\N	\N	\N	\N
1014	2	fizic	tamer	\N	\N	0767785737	\N	\N	2026-04-22 07:02:45.17259+00	\N	f	\N	\N	\N	\N
1016	2	fizic	IVANCEA COSTEL	\N	\N	0743826301	\N	\N	2026-04-22 07:20:00.380941+00	\N	f	\N	\N	\N	\N
1017	2	fizic	rotaru adi	\N	\N	0744992299	\N	\N	2026-04-22 07:24:09.660611+00	\N	f	\N	\N	\N	\N
1018	2	fizic	dana	\N	\N	0725104090	\N	\N	2026-04-22 07:34:04.932383+00	\N	f	\N	\N	\N	\N
1019	2	fizic	fugaru gicu	\N	\N	0745658511	\N	\N	2026-04-22 07:34:46.980578+00	\N	f	\N	\N	\N	\N
1020	2	juridic	BEJO ROMANIA SRL	19019853	\N	\N	\N	JUD. ILFOV, ORŞ. MĂGURELE, MĂGURELE, NR.96B	2026-04-22 07:45:46.395109+00	\N	f	\N	\N	\N	\N
1022	2	fizic	MANUEL	\N	\N	0761274072	\N	\N	2026-04-22 08:01:18.872336+00	\N	f	\N	\N	\N	\N
1023	2	fizic	adrian	\N	\N	072897083	\N	\N	2026-04-22 08:04:59.016738+00	\N	f	\N	\N	\N	\N
1024	2	fizic	florin	\N	\N	0728041596	\N	\N	2026-04-22 08:08:59.642854+00	\N	f	\N	\N	\N	\N
1015	2	fizic	ROBERT	\N	\N	0765 854 914	\N	\N	2026-04-22 07:11:12.319905+00	2026-04-22 08:09:14.705281+00	f	\N	\N	\N	\N
1025	2	fizic	RALUCA	\N	\N	0761234161	\N	\N	2026-04-22 08:09:55.845736+00	\N	f	\N	\N	\N	\N
1021	2	fizic	BATRINCA ALIN	\N	\N	0769 651 969	\N	\N	2026-04-22 07:52:30.2138+00	2026-04-22 08:22:02.324597+00	f	\N	\N	\N	\N
1026	2	fizic	geogau	\N	\N	0721290669	\N	\N	2026-04-22 08:22:35.436319+00	\N	f	\N	\N	\N	\N
1027	2	fizic	ionica florin	\N	\N	0736717184	\N	\N	2026-04-22 08:40:03.118192+00	\N	f	\N	\N	\N	\N
1028	2	fizic	doru	\N	\N	0771720798	\N	\N	2026-04-22 08:40:42.642021+00	\N	f	\N	\N	\N	\N
1029	2	fizic	PHARMA PLUS 2	\N	\N	0742058800	\N	\N	2026-04-22 08:41:50.37804+00	\N	f	\N	\N	\N	\N
1030	2	fizic	CIOACA FLORIAN	\N	\N	0744789863	\N	\N	2026-04-22 08:45:19.328299+00	\N	f	\N	\N	\N	\N
1031	2	fizic	liviu	\N	\N	0773885395	\N	\N	2026-04-22 08:51:04.790326+00	\N	f	\N	\N	\N	\N
1032	2	fizic	TUCA ION	\N	\N	0721605463	km 170392	\N	2026-04-22 08:54:41.490171+00	\N	f	\N	\N	\N	\N
1033	2	fizic	VAICAR ROMEO	\N	\N	0723787957	\N	\N	2026-04-22 08:59:28.11853+00	\N	f	\N	\N	\N	\N
1034	2	fizic	cosmin	\N	\N	0749657854	\N	\N	2026-04-22 09:01:37.011371+00	\N	f	\N	\N	\N	\N
1035	2	fizic	baluta claudiu	\N	\N	0740102941	\N	\N	2026-04-22 09:09:21.246235+00	\N	f	\N	\N	\N	\N
1036	2	fizic	COSTEA COSTINEL	\N	\N	0767168364	km 238576	\N	2026-04-22 09:20:54.098594+00	\N	f	\N	\N	\N	\N
1037	2	fizic	badoiu constantin	\N	\N	0748071693	\N	\N	2026-04-22 09:21:00.971661+00	\N	f	\N	\N	\N	\N
1038	2	fizic	mircea	\N	\N	0767132641	\N	\N	2026-04-22 09:26:18.525818+00	\N	f	\N	\N	\N	\N
1039	2	fizic	tudor vali	\N	\N	0745621560	\N	\N	2026-04-22 09:30:19.560087+00	\N	f	\N	\N	\N	\N
1041	2	fizic	geica vicentiu	\N	\N	0723668240	\N	\N	2026-04-22 09:37:10.421275+00	\N	f	\N	\N	\N	\N
1042	2	fizic	CHEHNE SABER	\N	\N	0765016108	\N	\N	2026-04-22 09:37:40.376134+00	\N	f	\N	\N	\N	\N
1043	2	fizic	burci claudia	\N	\N	0766354868	\N	\N	2026-04-22 09:43:11.115742+00	\N	f	\N	\N	\N	\N
1044	2	fizic	ionut	\N	\N	0765388223	\N	\N	2026-04-22 09:57:39.687253+00	\N	f	\N	\N	\N	\N
1045	2	fizic	BADESCU MARIUS	\N	\N	0770204076	\N	\N	2026-04-22 10:07:09.941616+00	\N	f	\N	\N	\N	\N
1046	2	fizic	CIUTA MARIAN	\N	\N	0765258070	\N	\N	2026-04-22 10:14:09.939992+00	\N	f	\N	\N	\N	\N
1040	2	fizic	BEJENARU LUDOVIC	\N	\N	0769 684 644	\N	\N	2026-04-22 09:33:00.466484+00	2026-04-22 10:14:31.390903+00	f	\N	\N	\N	\N
1047	2	fizic	marius	\N	\N	0770204076	\N	\N	2026-04-22 10:30:18.02138+00	\N	f	\N	\N	\N	\N
1048	2	fizic	vărzaru mircea	\N	\N	0723319498	\N	\N	2026-04-22 10:32:30.151129+00	\N	f	\N	\N	\N	\N
1049	2	fizic	PARASCHIVU DANIEL	\N	\N	0773860455	\N	\N	2026-04-22 10:33:51.546841+00	\N	f	\N	\N	\N	\N
1050	2	fizic	dica madalin	\N	\N	0767550578	\N	\N	2026-04-22 10:41:14.998638+00	\N	f	\N	\N	\N	\N
1051	2	fizic	BOURU AUREL	\N	\N	0749773603	\N	\N	2026-04-22 10:42:26.930339+00	\N	f	\N	\N	\N	\N
1052	2	fizic	neicu marius	\N	\N	0768802427	\N	\N	2026-04-22 10:46:36.087729+00	\N	f	\N	\N	\N	\N
1053	2	fizic	blagoie alexia	\N	\N	0752365330	\N	\N	2026-04-22 10:54:21.091754+00	\N	f	\N	\N	\N	\N
1054	2	fizic	voinea alex	\N	\N	0765212598	\N	\N	2026-04-22 11:19:42.45119+00	\N	f	\N	\N	\N	\N
1055	2	fizic	COSMIN	\N	\N	0732842946	\N	\N	2026-04-22 11:29:12.977172+00	\N	f	\N	\N	\N	\N
1056	2	juridic	CASA NOASTRA S.R.L.	7510066	\N	\N	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CALEA BUCURESTI, NR.113	2026-04-22 11:30:43.986158+00	\N	f	\N	\N	\N	\N
1057	2	fizic	dragan	\N	\N	0746027562	\N	\N	2026-04-22 11:31:38.631839+00	\N	f	\N	\N	\N	\N
1061	2	juridic	ELECTRO-FLUX SRL	RO15022384	\N	\N	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. COMPLEXULUI, NR.6A	2026-04-22 11:56:49.546796+00	\N	f	\N	\N	\N	\N
1249	2	fizic	manescu dragos	\N	\N	0740091432	\N	\N	2026-04-27 07:26:55.78107+00	\N	f	\N	\N	\N	\N
1266	2	juridic	ELKAVER TRANS SRL	RO9385750	\N	0747057090	\N	JUD. DOLJ, MUN. CRAIOVA, CALEA BUCURESTI, NR.12, BL.M8, SC.B, AP.18	2026-04-27 08:54:49.491625+00	\N	f	\N	\N	\N	\N
1286	2	juridic	CASA NOASTRA S.R.L.	7510066	\N	0758256800	\N	JUD. DOLJ, SAT PIELEŞTI COM. PIELEŞTI, CALEA BUCURESTI, NR.113	2026-04-27 11:01:14.121107+00	\N	f	\N	\N	\N	\N
1304	2	fizic	adi	\N	\N	0763809997	\N	\N	2026-04-27 13:08:57.452779+00	\N	f	\N	\N	\N	\N
1324	2	fizic	VOINICU SIMONA	\N	\N	0767471268	\N	\N	2026-04-28 05:47:41.660146+00	\N	f	\N	\N	km75113	\N
1335	2	fizic	vrajitoru	\N	\N	\N	\N	\N	2026-04-28 07:04:34.920833+00	\N	f	\N	\N	\N	\N
1338	2	fizic	garbovan ovidiu	\N	\N	0766361658	\N	\N	2026-04-28 07:13:21.422117+00	\N	f	\N	\N	\N	\N
1351	2	fizic	novac	\N	\N	0725896706	\N	\N	2026-04-28 08:28:01.072597+00	\N	f	\N	\N	\N	\N
1353	2	fizic	CIPRIAN	\N	\N	0773360567	\N	\N	2026-04-28 08:39:19.521644+00	\N	f	\N	\N	\N	\N
1367	2	fizic	stefan c tin	\N	\N	0745054033	\N	\N	2026-04-28 10:10:18.405485+00	\N	f	\N	\N	\N	\N
1368	2	fizic	GAPSEA CRISTIAN	\N	\N	0752654609	\N	\N	2026-04-28 10:10:30.050681+00	\N	f	\N	\N	\N	\N
1386	2	fizic	orban darius	\N	\N	0771217251	\N	\N	2026-04-28 12:05:57.988764+00	\N	f	\N	\N	\N	\N
1392	2	fizic	ALEX	\N	\N	0760709632	\N	\N	2026-04-28 12:35:27.531856+00	\N	f	\N	\N	\N	\N
1402	2	fizic	gabi	\N	\N	0770994458	\N	\N	2026-04-28 14:00:46.365711+00	\N	f	\N	\N	\N	\N
1403	2	fizic	MARINESCU COSMIN	\N	\N	0760758155	km700000	\N	2026-04-28 14:03:21.894152+00	\N	f	\N	\N	\N	\N
1419	2	juridic	RD MOBILE EXPEDITION S.R.L.	ro37791877	\N	0749492444	\N	JUD. DOLJ, MUN. CRAIOVA, STR. FĂGĂRAŞ, NR.40, BL.D21A, SC.2, AP.1	2026-04-29 07:11:34.579172+00	\N	f	\N	\N	\N	\N
1436	2	fizic	ungureanu aurel	\N	\N	0722781516	\N	\N	2026-04-29 08:28:30.822882+00	\N	f	\N	\N	\N	\N
1458	2	fizic	simode	\N	\N	\N	\N	\N	2026-04-29 10:40:16.936224+00	\N	f	\N	\N	\N	\N
1461	2	fizic	bolovan augustin	\N	\N	0764667470	\N	\N	2026-04-29 11:14:22.12295+00	\N	f	\N	\N	\N	\N
1479	2	fizic	mihaela stanescu	\N	\N	0745905327	\N	\N	2026-04-29 13:11:48.820472+00	\N	f	\N	\N	\N	\N
1058	2	fizic	popescu george	\N	\N	0763065564	\N	\N	2026-04-22 11:46:02.180626+00	\N	f	\N	\N	\N	\N
1059	2	fizic	staicu	\N	\N	0770940592	\N	\N	2026-04-22 11:51:02.509409+00	\N	f	\N	\N	\N	\N
1060	2	fizic	sandu daniel	\N	\N	0767787649	\N	\N	2026-04-22 11:52:40.411779+00	\N	f	\N	\N	\N	\N
1062	2	fizic	emil	\N	\N	0746027562	\N	\N	2026-04-22 12:00:49.637702+00	\N	f	\N	\N	\N	\N
1063	2	fizic	rosculete george	\N	\N	\N	\N	\N	2026-04-22 12:09:15.164937+00	\N	f	\N	\N	\N	\N
1064	2	fizic	ciolan andrea	\N	\N	0744683329	\N	\N	2026-04-22 12:14:38.451446+00	\N	f	\N	\N	\N	\N
1065	2	juridic	METRECONS SOLUTION S.R.L.	RO43702335	\N	0770940592	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ELIZA OPRAN, NR.28	2026-04-22 12:20:46.987486+00	\N	f	\N	\N	\N	\N
1066	2	fizic	BUICA IULIAN	\N	\N	0757129448	\N	\N	2026-04-22 12:23:14.887821+00	\N	f	\N	\N	km380000	\N
1067	2	fizic	ARVATESCU BIANCA	\N	\N	0766630895	\N	\N	2026-04-22 12:32:57.567692+00	\N	f	\N	\N	\N	\N
1068	2	fizic	camelia	\N	\N	0755889815	\N	\N	2026-04-22 13:01:08.557008+00	\N	f	\N	\N	\N	\N
1069	2	fizic	guta	\N	\N	0727934614	\N	\N	2026-04-22 13:15:56.376326+00	\N	f	\N	\N	\N	\N
1070	2	fizic	TUTUIANU MARIUS	\N	\N	0761689138	\N	\N	2026-04-22 13:20:37.756805+00	\N	f	\N	\N	\N	\N
1071	2	fizic	podarascu	\N	\N	\N	\N	\N	2026-04-22 13:22:44.176539+00	\N	f	\N	\N	\N	\N
1072	2	fizic	tutuianu marius	\N	\N	0761689138	\N	\N	2026-04-22 13:23:19.784702+00	\N	f	\N	\N	\N	\N
1073	2	fizic	TANASE GABRIEL	\N	\N	0760583705	\N	\N	2026-04-22 13:24:53.16107+00	\N	f	\N	\N	\N	\N
1074	2	fizic	PIRVU FLORIN	\N	\N	0760083080	\N	\N	2026-04-22 13:27:39.136609+00	\N	f	\N	\N	\N	\N
1075	2	fizic	chiriac mihai george	\N	\N	0765950085	\N	\N	2026-04-22 13:37:13.951215+00	\N	f	\N	\N	\N	\N
1076	2	fizic	electroflux	\N	\N	\N	\N	\N	2026-04-22 13:46:11.958661+00	\N	f	\N	\N	\N	\N
1077	2	fizic	popa bogdan	\N	\N	0744772526	\N	\N	2026-04-22 13:50:05.590221+00	\N	f	\N	\N	\N	\N
1078	2	fizic	LIVIU	\N	\N	0721334231	\N	\N	2026-04-22 13:56:58.665797+00	\N	f	\N	\N	\N	\N
1079	2	fizic	popescu mihaela	\N	\N	0743851161	\N	\N	2026-04-22 13:59:04.220807+00	\N	f	\N	\N	\N	\N
1080	2	fizic	MITOI	\N	\N	0741168313	\N	\N	2026-04-22 14:03:49.319534+00	\N	f	\N	\N	\N	\N
1081	2	fizic	caluianu costinel	\N	\N	0762999081	\N	\N	2026-04-22 14:07:37.523445+00	\N	f	\N	\N	\N	\N
1082	2	fizic	IULIAN	\N	\N	\N	\N	\N	2026-04-22 14:11:22.135735+00	\N	f	\N	\N	\N	\N
1083	2	fizic	DASOVEANU VICTOR	\N	\N	0771 788 560	\N	\N	2026-04-22 14:12:34.38565+00	\N	f	\N	\N	\N	\N
1084	2	fizic	razvan	\N	\N	0762391158	\N	\N	2026-04-22 14:13:01.22412+00	\N	f	\N	\N	\N	\N
1085	2	fizic	slavulete marian	\N	\N	0744615657	\N	\N	2026-04-23 05:26:41.051237+00	\N	f	\N	\N	\N	\N
1086	2	fizic	adrian	\N	\N	0764563037	\N	\N	2026-04-23 05:35:46.019629+00	\N	f	\N	\N	\N	\N
1087	2	fizic	LAZARESCU ANDREA	\N	\N	0767108512	km 263045	\N	2026-04-23 05:45:12.484605+00	\N	f	\N	\N	\N	\N
1088	2	fizic	marian	\N	\N	0771216170	\N	\N	2026-04-23 05:45:31.182692+00	\N	f	\N	\N	\N	\N
1090	2	fizic	ionescu cristian	\N	\N	0726182785	\N	\N	2026-04-23 05:50:50.018786+00	\N	f	\N	\N	\N	\N
1091	2	fizic	VIOREL  INCROSNATU	\N	\N	0742105105	\N	\N	2026-04-23 06:08:36.274667+00	\N	f	\N	\N	\N	\N
1089	2	fizic	TAVI CIUCA	\N	\N	0722875239	\N	\N	2026-04-23 05:50:17.842866+00	2026-04-23 06:11:54.25488+00	f	\N	\N	\N	\N
1093	2	fizic	ALEXANDRU	\N	\N	0760466123	\N	\N	2026-04-23 06:43:11.205225+00	\N	f	\N	\N	\N	\N
1094	2	fizic	AZALIS BOGDAN	\N	\N	\N	\N	\N	2026-04-23 06:50:05.401008+00	\N	f	\N	\N	\N	\N
1092	2	fizic	COCOS MIHAI	\N	\N	0785 401 666	\N	\N	2026-04-23 06:37:19.700023+00	2026-04-23 06:57:09.826998+00	f	\N	\N	\N	\N
1095	2	fizic	loredana	\N	\N	0755468553	\N	\N	2026-04-23 06:57:22.292356+00	2026-04-23 06:58:01.324648+00	f	\N	\N	\N	\N
1096	2	fizic	ciocionoiu alin	\N	\N	0747035628	\N	\N	2026-04-23 07:11:03.743211+00	\N	f	\N	\N	\N	\N
1097	2	fizic	BIRTAN MARIAN	\N	\N	0769098609	\N	\N	2026-04-23 07:16:45.69841+00	\N	f	\N	\N	\N	\N
1098	2	fizic	STELEA COSMIN	\N	\N	0744594496	\N	\N	2026-04-23 07:25:26.746745+00	\N	f	\N	\N	\N	\N
1099	2	fizic	marinescu stefania	\N	\N	0769052458	\N	\N	2026-04-23 07:32:00.745041+00	\N	f	\N	\N	\N	\N
1100	2	fizic	iulian	\N	\N	0743036309	\N	\N	2026-04-23 07:42:08.655425+00	\N	f	\N	\N	\N	\N
1101	2	fizic	UNGUREANU STEFAN	\N	\N	0784797401	\N	\N	2026-04-23 08:07:16.584434+00	\N	f	\N	\N	\N	\N
1102	2	juridic	GARDA BLOK SRL	24604489	\N	\N	\N	JUD. DOLJ, SAT SECUI COM. TEASC, STR. BECHETULUI, NR.21	2026-04-23 08:08:14.713288+00	\N	f	\N	\N	\N	\N
1103	2	juridic	filip dilganu	casa noastra	\N	\N	\N	\N	2026-04-23 08:09:52.591554+00	\N	f	\N	\N	\N	\N
1104	2	fizic	ivan mihai	\N	\N	0722281489	\N	\N	2026-04-23 08:19:35.452569+00	\N	f	\N	\N	\N	\N
1105	2	fizic	sarbu	\N	\N	0793233679	\N	\N	2026-04-23 08:20:32.643247+00	\N	f	\N	\N	\N	\N
1106	2	fizic	balan	\N	\N	o784412929	\N	\N	2026-04-23 08:21:46.766833+00	\N	f	\N	\N	\N	\N
1107	2	fizic	doru sache	\N	\N	0748034537	\N	\N	2026-04-23 08:25:32.531814+00	\N	f	\N	\N	\N	\N
1109	2	fizic	ionut	\N	\N	0764038058	\N	\N	2026-04-23 08:39:08.260707+00	\N	f	\N	\N	\N	\N
1110	2	fizic	CATALIN BALANA	\N	\N	0762263463	\N	\N	2026-04-23 08:39:28.397882+00	\N	f	\N	\N	\N	\N
1111	2	fizic	floricel marius	\N	\N	0728994070	\N	\N	2026-04-23 08:41:35.846173+00	\N	f	\N	\N	\N	\N
1112	2	fizic	bondoc victor	\N	\N	0721080748	\N	\N	2026-04-23 08:56:14.158181+00	\N	f	\N	\N	\N	\N
1113	2	fizic	florinel	\N	\N	0732370969	\N	\N	2026-04-23 09:17:12.914871+00	\N	f	\N	\N	\N	\N
1114	2	juridic	ECOPLANT SRL	RO15809876	\N	0764784717	\N	JUD. DOLJ, MUN. CRAIOVA, STR. IOANA RADU, NR.35	2026-04-23 09:28:13.552271+00	\N	f	\N	\N	\N	\N
1115	2	fizic	PERA DUCU	\N	\N	0723619618	\N	\N	2026-04-23 09:30:52.524808+00	\N	f	\N	\N	\N	\N
1116	2	fizic	nastase alexandrina	\N	\N	0735537453	\N	\N	2026-04-23 09:37:16.230327+00	\N	f	\N	\N	\N	\N
1117	2	fizic	pistol bianca	\N	\N	0761137122	\N	\N	2026-04-23 09:41:42.684311+00	\N	f	\N	\N	\N	\N
1118	2	fizic	selaru robert	\N	\N	0745429422	\N	\N	2026-04-23 09:55:14.105399+00	\N	f	\N	\N	\N	\N
1108	2	fizic	RUSU IULIAN	\N	\N	0763 478 030	\N	\N	2026-04-23 08:37:01.319139+00	2026-04-23 09:59:27.549846+00	f	\N	\N	\N	\N
1119	2	fizic	ROBERT SELARU	\N	\N	\N	\N	\N	2026-04-23 10:16:42.469816+00	\N	f	\N	\N	\N	\N
1120	2	juridic	DOLPLAST SRL	RO6779547	\N	0772287824	\N	JUD. DOLJ, MUN. CRAIOVA, STR. GÎRLEŞTI, NR.119	2026-04-23 10:22:10.753439+00	\N	f	\N	\N	\N	\N
1121	2	fizic	cristina popirlan	\N	\N	0744609640	\N	\N	2026-04-23 10:33:28.332734+00	\N	f	\N	\N	\N	\N
1122	2	fizic	guta cosmin	\N	\N	0728065149	\N	\N	2026-04-23 10:43:53.621235+00	\N	f	\N	\N	\N	\N
1123	2	fizic	BARBU PETRISOR	\N	\N	0762907373	\N	\N	2026-04-23 10:52:30.560434+00	\N	f	\N	\N	km23130	\N
1124	2	fizic	solarex	\N	\N	\N	\N	\N	2026-04-23 10:59:34.240849+00	\N	f	\N	\N	\N	\N
1125	2	fizic	TUCA	\N	\N	0773851272	\N	\N	2026-04-23 11:06:04.165753+00	\N	f	\N	\N	\N	\N
1126	2	fizic	iovan adi	\N	\N	0767559976	\N	\N	2026-04-23 11:17:03.45446+00	\N	f	\N	\N	\N	\N
1127	2	juridic	tehnocolor	\N	\N	\N	\N	\N	2026-04-23 11:19:43.570209+00	\N	f	\N	\N	\N	\N
1128	2	fizic	GUTA COSMIN	\N	\N	0728065149	\N	\N	2026-04-23 11:20:13.649726+00	\N	f	\N	\N	\N	\N
1129	2	fizic	atanasiu	\N	\N	0761010107	\N	\N	2026-04-23 11:22:22.014421+00	\N	f	\N	\N	\N	\N
1130	2	fizic	malachi elena	\N	\N	0752236443	\N	\N	2026-04-23 11:34:34.208198+00	\N	f	\N	\N	\N	\N
1131	2	fizic	sandu	\N	\N	0754028218	\N	\N	2026-04-23 11:38:39.970063+00	\N	f	\N	\N	\N	\N
1132	2	fizic	taifer	\N	\N	0760799519	\N	\N	2026-04-23 11:41:27.837801+00	\N	f	\N	\N	\N	\N
1133	2	fizic	MATEI GHEORGHE	\N	\N	0746 047 285	\N	\N	2026-04-23 11:42:17.144883+00	\N	f	\N	\N	\N	\N
1134	2	fizic	atanasiu	\N	\N	0761010107	\N	\N	2026-04-23 11:43:23.042132+00	\N	f	\N	\N	\N	\N
1135	2	fizic	virgil sandoi	\N	\N	0768668158	\N	\N	2026-04-23 11:57:21.983031+00	\N	f	\N	\N	\N	\N
1136	2	fizic	RADU	\N	\N	\N	\N	\N	2026-04-23 12:04:19.763951+00	\N	f	\N	\N	\N	\N
1137	2	fizic	sandoi	\N	\N	076868158	\N	\N	2026-04-23 12:19:06.341757+00	\N	f	\N	\N	\N	\N
1138	2	fizic	florin	\N	\N	\N	\N	\N	2026-04-23 12:25:01.346487+00	\N	f	\N	\N	\N	\N
1139	2	fizic	antonie valentin	\N	\N	0760797168	\N	\N	2026-04-23 12:37:21.701273+00	\N	f	\N	\N	\N	\N
1140	2	fizic	mageri silviu	\N	\N	0749026791	\N	\N	2026-04-23 12:44:41.843921+00	\N	f	\N	\N	\N	\N
1141	2	fizic	teica dragosi	\N	\N	0745640106	\N	\N	2026-04-23 12:48:12.615935+00	\N	f	\N	\N	\N	\N
1142	2	fizic	ILIUTA ELVIS	\N	\N	0773750312	\N	\N	2026-04-23 12:48:37.116943+00	\N	f	\N	\N	\N	\N
1143	2	fizic	duta eugen	\N	\N	0774633040	\N	\N	2026-04-23 13:05:29.974163+00	\N	f	\N	\N	\N	\N
1144	2	fizic	ORLANDO	\N	\N	0764142737	\N	\N	2026-04-23 13:20:56.078357+00	\N	f	\N	\N	\N	\N
1145	2	fizic	ovidiu	\N	\N	0766567151	\N	\N	2026-04-23 13:22:55.529271+00	\N	f	\N	\N	\N	\N
1250	2	fizic	patrulescu ion	\N	\N	0741170032	\N	\N	2026-04-27 07:33:32.088603+00	\N	f	\N	\N	\N	\N
1252	2	fizic	savulea dorel	\N	\N	0722920873	\N	\N	2026-04-27 07:43:26.539807+00	\N	f	\N	\N	\N	\N
1256	2	fizic	klass wagen	\N	\N	\N	\N	\N	2026-04-27 08:02:51.701364+00	\N	f	\N	\N	\N	\N
1257	2	fizic	marinescu valentin	\N	\N	0744979742	\N	\N	2026-04-27 08:06:52.355748+00	\N	f	\N	\N	\N	\N
1258	2	fizic	bordei	\N	\N	0744964468	\N	\N	2026-04-27 08:14:34.386611+00	\N	f	\N	\N	\N	\N
1271	2	fizic	GHITA CLAUDIA	\N	\N	0738822108	\N	\N	2026-04-27 09:35:59.400005+00	\N	f	\N	\N	\N	\N
1287	2	fizic	CRISTIAN CATANA	\N	\N	0765527763	\N	\N	2026-04-27 11:09:20.748728+00	\N	f	\N	\N	\N	\N
1288	2	fizic	COSTINEL	\N	\N	0769812266	\N	\N	2026-04-27 11:10:24.424944+00	\N	f	\N	\N	\N	\N
1290	2	fizic	calota silviu	\N	\N	0765505382	\N	\N	2026-04-27 11:19:08.23758+00	\N	f	\N	\N	\N	\N
1306	2	fizic	bogdan	\N	\N	0743605346	\N	\N	2026-04-27 13:18:19.850999+00	\N	f	\N	\N	\N	\N
1326	2	fizic	IONESCU LIVIU	\N	\N	0745077183	\N	\N	2026-04-28 06:05:34.960892+00	\N	f	\N	\N	km27650	\N
1337	2	fizic	nicusor	\N	\N	0723344502	\N	\N	2026-04-28 07:13:16.639805+00	\N	f	\N	\N	\N	\N
1341	2	fizic	olteanu	\N	\N	0736247168	\N	\N	2026-04-28 07:27:35.930535+00	\N	f	\N	\N	\N	\N
1352	2	fizic	radu	\N	\N	0744594939	\N	\N	2026-04-28 08:33:42.447751+00	\N	f	\N	\N	\N	\N
1361	2	fizic	PEPTENARU VIOREL	\N	\N	0749 670 339	\N	\N	2026-04-28 09:04:02.130189+00	2026-04-28 10:25:00.723481+00	f	\N	\N	\N	\N
1369	2	juridic	CABINET DE AVOCAT ZARZĂRĂ M. MIHAELA-MARGARETA	22478678	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. SĂRARILOR, BL.M35, SC.1, ET.1, AP.5	2026-04-28 10:28:26.448868+00	\N	f	\N	\N	\N	\N
1387	2	fizic	state	\N	\N	0744287655	\N	\N	2026-04-28 12:08:24.611687+00	\N	f	\N	\N	\N	\N
1389	2	fizic	FIRANESCU AUREL	\N	\N	0744 535 068	\N	\N	2026-04-28 12:15:16.836427+00	\N	f	\N	\N	\N	\N
1404	2	fizic	DANIEL CALN	\N	\N	0723602300	\N	\N	2026-04-28 14:18:42.919552+00	\N	f	\N	\N	\N	\N
1420	2	fizic	popescu violeta	\N	\N	0733982407	\N	\N	2026-04-29 07:13:17.665447+00	\N	f	\N	\N	\N	\N
1427	2	fizic	gheorghe	\N	\N	0766487842	\N	\N	2026-04-29 07:44:40.227925+00	\N	f	\N	\N	\N	\N
1437	2	fizic	ianis	\N	\N	0739556900	\N	\N	2026-04-29 08:38:09.574856+00	\N	f	\N	\N	\N	\N
1439	2	fizic	SORIN	\N	\N	0773960673	\N	\N	2026-04-29 08:41:46.90429+00	\N	f	\N	\N	\N	\N
1442	2	fizic	dan rosu	\N	\N	\N	\N	\N	2026-04-29 08:56:44.821243+00	\N	f	\N	\N	\N	\N
1443	2	fizic	BALUTA COSMIN	\N	\N	0756383233	\N	\N	2026-04-29 09:01:48.616905+00	\N	f	\N	\N	\N	\N
1459	2	juridic	PRO LAND OIL SRL	ro5276180	\N	0738857606	\N	JUD. DOLJ, MUN. CRAIOVA, STR. BIRSESTI, NR.8	2026-04-29 11:05:57.020925+00	\N	f	\N	\N	\N	\N
1462	2	fizic	STAICU RALUCA	\N	\N	0784235735	\N	\N	2026-04-29 11:17:23.355385+00	\N	f	\N	\N	\N	\N
1480	2	fizic	adrian	\N	\N	07	\N	\N	2026-04-29 13:15:48.097643+00	\N	f	\N	\N	\N	\N
1146	2	fizic	ROSU MARIUS	\N	\N	0762766416	\N	\N	2026-04-23 13:29:30.960103+00	\N	f	\N	\N	\N	\N
1147	2	fizic	orlando	\N	\N	\N	\N	\N	2026-04-23 13:42:34.837912+00	\N	f	\N	\N	\N	\N
1148	2	fizic	nastase radu	\N	\N	0753078790	\N	\N	2026-04-23 13:57:21.935929+00	\N	f	\N	\N	\N	\N
1149	2	fizic	cristina pavel	\N	\N	0751362327	\N	\N	2026-04-24 05:26:03.21364+00	\N	f	\N	\N	\N	\N
1150	2	fizic	NEATU CRISTIAN	\N	\N	0721 240 321	\N	\N	2026-04-24 05:29:08.67345+00	\N	f	\N	\N	\N	\N
1151	2	fizic	CIUCA AUREL	\N	\N	0765 433 825	\N	\N	2026-04-24 05:32:19.024446+00	\N	f	\N	\N	\N	\N
1153	2	fizic	erhan ioan	\N	\N	0764764781	\N	\N	2026-04-24 06:09:21.261685+00	\N	f	\N	\N	\N	\N
1152	2	fizic	GAMANU FLORIN	\N	\N	0755 055 085	\N	\N	2026-04-24 05:33:32.201583+00	2026-04-24 06:12:53.034524+00	f	\N	\N	km869180	\N
1154	2	fizic	bogdan dobrescu	\N	\N	0799210138	\N	\N	2026-04-24 06:19:11.144019+00	\N	f	\N	\N	\N	\N
1155	2	fizic	tache andrei	\N	\N	0764667063	\N	\N	2026-04-24 06:23:05.18165+00	\N	f	\N	\N	\N	\N
1156	2	fizic	viorel	\N	\N	0766564617	\N	\N	2026-04-24 06:29:02.055609+00	\N	f	\N	\N	\N	\N
1157	2	juridic	REVAD SRL	RO23421530	\N	0749156927	\N	JUD. DOLJ, MUN. CRAIOVA, STR. PAŞCANI, NR.10, BL.B29, SC.1, ET.PART, AP.2	2026-04-24 06:31:18.480112+00	\N	f	\N	\N	\N	\N
1158	2	fizic	andrei	\N	\N	0764667063	\N	\N	2026-04-24 06:38:29.76679+00	\N	f	\N	\N	\N	\N
1159	2	fizic	BUZATU SORIN	\N	\N	0764 877 499	\N	\N	2026-04-24 06:39:41.229719+00	\N	f	\N	\N	\N	\N
1161	2	fizic	NEGRILA MARIN	\N	\N	0724673142	\N	\N	2026-04-24 06:56:27.434896+00	\N	f	\N	\N	KM400000	\N
1160	2	fizic	constantin	\N	\N	0749281447	\N	\N	2026-04-24 06:54:39.525636+00	2026-04-24 07:07:43.597895+00	f	\N	\N	\N	\N
1162	2	fizic	vasilan marin	\N	\N	0722232422	\N	\N	2026-04-24 07:08:11.318457+00	\N	f	\N	\N	\N	\N
1163	2	fizic	nedea gabriel	\N	\N	0744646025	\N	\N	2026-04-24 07:10:31.736851+00	\N	f	\N	\N	\N	\N
1164	2	fizic	neacsu	\N	\N	0761667000	\N	\N	2026-04-24 07:12:44.690144+00	\N	f	\N	\N	\N	\N
1165	2	fizic	mihaela	\N	\N	0745505668	\N	\N	2026-04-24 07:19:40.431489+00	\N	f	\N	\N	\N	\N
1166	2	fizic	ONDIN	\N	\N	0722524064	\N	\N	2026-04-24 07:22:59.958657+00	\N	f	\N	\N	\N	\N
1167	2	fizic	DUMITRESCU ANDREEA	\N	\N	0768222802	\N	\N	2026-04-24 07:27:22.839323+00	\N	f	\N	\N	\N	\N
1168	2	fizic	vasile	\N	\N	0722232422	\N	\N	2026-04-24 07:30:53.592853+00	\N	f	\N	\N	\N	\N
1169	2	fizic	serban constantin	\N	\N	0737358956	\N	\N	2026-04-24 07:40:27.250935+00	\N	f	\N	\N	\N	\N
1170	2	fizic	niculescu ovidiu	\N	\N	0726992796	\N	\N	2026-04-24 07:52:11.036219+00	\N	f	\N	\N	\N	\N
1171	2	fizic	MIRCEA PARLOGEA	\N	\N	0723737611	\N	\N	2026-04-24 08:02:59.446331+00	\N	f	\N	\N	\N	\N
1172	2	fizic	coc george emilian	\N	\N	0754033534	\N	\N	2026-04-24 08:08:32.770601+00	\N	f	\N	\N	\N	\N
1173	2	fizic	blejoiu razvan	\N	\N	0740525840	blejoiu.razvan@gmail	\N	2026-04-24 08:17:29.754665+00	\N	f	\N	\N	\N	\N
1174	2	fizic	ioradchioiu alin	\N	\N	0761722508	\N	\N	2026-04-24 08:19:54.508338+00	\N	f	\N	\N	\N	\N
1175	2	fizic	ROSOFT	\N	\N	0726651351	\N	\N	2026-04-24 08:21:51.443383+00	\N	f	\N	\N	\N	\N
1176	2	fizic	adrian	\N	\N	0753059347	\N	\N	2026-04-24 08:25:31.915757+00	\N	f	\N	\N	\N	\N
1177	2	fizic	STRIMBEANU VICTOR	\N	\N	0731 367 914	\N	\N	2026-04-24 08:28:09.860981+00	\N	f	\N	\N	\N	\N
1178	2	juridic	BANCA TRANSILVANIA S.A.	\N	\N	0755143237	\N	\N	2026-04-24 08:33:50.38424+00	\N	f	\N	\N	\N	\N
1179	2	fizic	Jan	\N	\N	\N	\N	\N	2026-04-24 08:38:49.127235+00	\N	f	\N	\N	\N	\N
1180	2	fizic	CIRCIUMARU ALEXANDRU	\N	\N	0768177038	\N	\N	2026-04-24 08:41:12.798397+00	\N	f	\N	\N	\N	\N
1181	2	fizic	cosmin	\N	\N	0749079279	\N	\N	2026-04-24 08:41:14.645403+00	\N	f	\N	\N	\N	\N
1182	2	fizic	ciprian	\N	\N	0742277637	\N	\N	2026-04-24 08:43:28.612108+00	\N	f	\N	\N	\N	\N
1183	2	juridic	SUPERMEDICAL SRL	21203776	\N	0767215694	\N	JUD. DOLJ, SAT CÂRCEA COM. CÂRCEA, STR. CRAIOVEI, NR.12A	2026-04-24 08:50:10.876441+00	\N	f	\N	\N	\N	\N
1184	2	fizic	MIREA IOAN	\N	\N	0722221225	\N	\N	2026-04-24 09:05:40.579118+00	\N	f	\N	\N	\N	\N
1185	2	fizic	craciunoiu iancu	\N	\N	0740200874	\N	\N	2026-04-24 09:08:37.681812+00	\N	f	\N	\N	\N	\N
1186	2	fizic	damian	\N	\N	0748992434	\N	\N	2026-04-24 09:08:53.074129+00	\N	f	\N	\N	\N	\N
1187	2	fizic	musete ilie	\N	\N	0733965062	\N	\N	2026-04-24 09:23:54.496438+00	\N	f	\N	\N	\N	\N
1188	2	fizic	amt service	\N	\N	\N	\N	\N	2026-04-24 09:26:25.802672+00	\N	f	\N	\N	\N	\N
1189	2	fizic	BALANEL	\N	\N	0726 333 127	\N	\N	2026-04-24 09:31:13.611019+00	\N	f	\N	\N	\N	\N
1190	2	fizic	MACIUCA ALIN	\N	\N	0723 034 818	\N	\N	2026-04-24 09:32:05.9204+00	\N	f	\N	\N	\N	\N
1191	2	fizic	ARNAUTU ADRIAN	\N	\N	0763684303	\N	\N	2026-04-24 09:54:48.539584+00	\N	f	\N	\N	\N	\N
1192	2	fizic	gheorghe gheorghe	\N	\N	0769646979	\N	\N	2026-04-24 09:55:37.934465+00	\N	f	\N	\N	\N	\N
1193	2	fizic	cruceru razvan	\N	\N	0729385821	\N	\N	2026-04-24 09:55:57.827054+00	\N	f	\N	\N	\N	\N
1194	2	fizic	camarasu ileana	\N	\N	0771205052	\N	\N	2026-04-24 10:01:58.958836+00	\N	f	\N	\N	\N	\N
1195	2	fizic	STANESCU CODRUT	\N	\N	0762 434 133	\N	\N	2026-04-24 10:08:51.875565+00	\N	f	\N	\N	\N	\N
1196	2	fizic	IOSIF ADRIAN	\N	\N	0723 226 396	\N	\N	2026-04-24 10:13:32.343284+00	\N	f	\N	\N	\N	\N
1197	2	fizic	bogdan	\N	\N	\N	\N	\N	2026-04-24 10:15:08.700755+00	\N	f	\N	\N	\N	\N
1198	2	fizic	militaru stefan	\N	\N	0733447448	\N	\N	2026-04-24 10:30:35.328223+00	\N	f	\N	\N	\N	\N
1199	2	fizic	iosif	\N	\N	0722623293	\N	\N	2026-04-24 10:31:32.744196+00	\N	f	\N	\N	\N	\N
1200	2	fizic	ionescu florentin	\N	\N	0724048938	\N	\N	2026-04-24 10:33:33.725433+00	\N	f	\N	\N	\N	\N
1201	2	fizic	mariana	\N	\N	0769646979	\N	\N	2026-04-24 11:02:37.316841+00	\N	f	\N	\N	\N	\N
1202	2	fizic	badea ionut	\N	\N	0742219371	\N	\N	2026-04-24 11:04:36.852165+00	\N	f	\N	\N	\N	\N
1203	2	fizic	nina cristian	\N	\N	0732113133	\N	\N	2026-04-24 11:15:05.221162+00	\N	f	\N	\N	\N	\N
1204	2	fizic	METALIMPEX	\N	\N	0766105477	\N	\N	2026-04-24 11:17:31.076549+00	\N	f	\N	\N	\N	\N
1205	2	fizic	octavian	\N	\N	\N	\N	\N	2026-04-24 11:17:41.561356+00	\N	f	\N	\N	\N	\N
1206	2	juridic	LUKAND ELECTRIC DESIGN S.R.L.	47123700	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. SĂRARILOR, NR.26B, BL.A, SC.1, ET.2, AP.14	2026-04-24 11:19:57.143241+00	\N	f	\N	\N	\N	\N
1207	2	fizic	catalin	\N	\N	0743143481	\N	\N	2026-04-24 11:32:15.266249+00	\N	f	\N	\N	\N	\N
1208	2	fizic	oncica sorin	\N	\N	0769070510	\N	\N	2026-04-24 11:35:52.557323+00	\N	f	\N	\N	\N	\N
1209	2	fizic	jean	\N	\N	\N	\N	\N	2026-04-24 11:47:07.942781+00	\N	f	\N	\N	\N	\N
1211	2	juridic	DAX MOBIL SRL	21228851	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, STR. ROMAIN ROLLAND, NR.30	2026-04-24 11:58:57.234821+00	\N	f	\N	\N	\N	\N
1212	2	fizic	daja catalin	\N	\N	0729660911	\N	\N	2026-04-24 12:10:30.799696+00	\N	f	\N	\N	\N	\N
1213	2	fizic	stanoi	\N	\N	0729804097	\N	\N	2026-04-24 12:10:50.205308+00	\N	f	\N	\N	\N	\N
1214	2	fizic	ODINA ANDREEA	\N	\N	0752427130	\N	\N	2026-04-24 12:12:19.066169+00	\N	f	\N	\N	\N	\N
1210	2	juridic	HAMAT IMPEX SRL	RO4552547	\N	0770 201 773	\N	JUD. DOLJ, COM. CÂRCEA, STR. TUDOR VLADIMIRESCU, NR.17	2026-04-24 11:54:58.753571+00	2026-04-24 12:26:57.990012+00	f	\N	\N	\N	\N
1215	2	fizic	LUNGU BOGDAN	\N	\N	0764630437	\N	\N	2026-04-24 12:34:09.472038+00	\N	f	\N	\N	\N	\N
1216	2	fizic	daniel	\N	\N	0721215491	\N	\N	2026-04-24 12:40:44.596858+00	\N	f	\N	\N	\N	\N
1217	2	fizic	MIHAI	\N	\N	0749170286	\N	\N	2026-04-24 12:46:21.51211+00	\N	f	\N	\N	\N	\N
1218	2	fizic	Victor	\N	\N	0773302383	\N	\N	2026-04-24 12:46:33.241299+00	\N	f	\N	\N	\N	\N
1219	2	fizic	sfeclan cristina	\N	\N	0722474761	\N	\N	2026-04-24 12:47:32.062646+00	\N	f	\N	\N	\N	\N
1220	2	juridic	cauc ion	lactalis	\N	0790557107	\N	\N	2026-04-24 12:54:53.584542+00	\N	f	\N	\N	\N	\N
1221	2	fizic	CRACIUNOIU ALIN	\N	\N	0771 195 034	\N	\N	2026-04-24 12:57:59.980645+00	\N	f	\N	\N	\N	\N
1222	2	fizic	CIOACA FLORIAN	\N	\N	0744789863	\N	\N	2026-04-24 12:59:14.571455+00	\N	f	\N	\N	\N	\N
1223	2	fizic	amelia brandt	\N	\N	0728119948	\N	\N	2026-04-24 13:12:11.276952+00	\N	f	\N	\N	\N	\N
1224	2	fizic	TITA	\N	\N	0741170099	\N	\N	2026-04-24 13:16:10.32929+00	\N	f	\N	\N	\N	\N
1225	2	fizic	marian cretu	\N	\N	0745188902	\N	\N	2026-04-24 13:19:46.289199+00	\N	f	\N	\N	\N	\N
1226	2	fizic	GRIGORE ALBERT	\N	\N	0764 912 056	\N	\N	2026-04-24 13:25:59.25033+00	\N	f	\N	\N	\N	\N
1227	2	fizic	apostol lucia	\N	\N	0720030193	\N	\N	2026-04-24 13:26:32.891926+00	\N	f	\N	\N	\N	\N
1228	2	juridic	NARDAGRIF SRL	34952081	\N	\N	\N	JUD. DOLJ, MUN. CRAIOVA, BLD. OLTENIA, NR.26, BL.23, SC.5, AP.1	2026-04-24 13:33:19.742965+00	\N	f	\N	\N	\N	\N
1229	2	fizic	MASIAN	\N	\N	0774632604	\N	\N	2026-04-24 13:39:08.64995+00	\N	f	\N	\N	\N	\N
1230	2	fizic	POPA PAUL	\N	\N	0747037027	\N	\N	2026-04-24 13:46:04.074619+00	\N	f	\N	\N	\N	\N
1231	2	fizic	ADRIAN	\N	\N	0746902054	\N	\N	2026-04-24 13:48:37.23927+00	2026-04-24 13:49:01.221751+00	f	\N	\N	\N	\N
1232	2	fizic	chiutu sorin	\N	\N	0729528472	\N	\N	2026-04-24 13:49:49.455866+00	\N	f	\N	\N	\N	\N
1233	2	fizic	boangiu alexandru	\N	\N	0766672896	\N	\N	2026-04-24 14:08:34.93294+00	\N	f	\N	\N	\N	\N
1234	2	fizic	TRIFU VIOREL	\N	\N	0726348378	\N	\N	2026-04-24 14:20:55.180437+00	\N	f	\N	\N	\N	\N
1251	2	fizic	balasoiu mihai	\N	\N	0765254780	\N	\N	2026-04-27 07:36:22.693614+00	\N	f	\N	\N	\N	\N
1272	2	fizic	pupaza andrei	\N	\N	0785227647	\N	\N	2026-04-27 09:41:17.721444+00	\N	f	\N	\N	\N	\N
1274	2	fizic	VASILE SORIN	\N	\N	0769971569	\N	\N	2026-04-27 10:01:06.734976+00	\N	f	\N	\N	\N	\N
1275	2	fizic	dumitrescu alin	\N	\N	0768834004	\N	\N	2026-04-27 10:07:43.016921+00	\N	f	\N	\N	\N	\N
1291	2	fizic	cristian ratoi	\N	\N	0740610500	\N	\N	2026-04-27 11:39:07.235427+00	\N	f	\N	\N	\N	\N
1297	2	fizic	OPREA CRISTI	\N	\N	0766 571 224	\N	\N	2026-04-27 12:06:26.935701+00	2026-04-27 12:30:32.015643+00	f	\N	\N	\N	\N
1307	2	fizic	SANDITA MARIN	\N	\N	0763089211	\N	\N	2026-04-27 13:22:04.236902+00	\N	f	\N	\N	\N	\N
1308	2	fizic	bogdan	\N	\N	0752344892	\N	\N	2026-04-27 13:25:07.832623+00	\N	f	\N	\N	\N	\N
1327	2	fizic	BEZNA IONUT	\N	\N	0746267610	\N	\N	2026-04-28 06:16:40.806282+00	\N	f	\N	\N	\N	\N
1339	2	juridic	PLAST - EDILITARE SRL	31783484	\N	0771638375	\N	JUD. DOLJ, SAT DUDOVICEŞTI COM. ŞIMNICU DE SUS, STR. CRAIOVEI, NR.203	2026-04-28 07:18:45.240173+00	\N	f	\N	\N	\N	\N
1354	2	fizic	PIRVULESCU MIRCEA	\N	\N	0767 132 641	\N	\N	2026-04-28 08:42:09.843028+00	2026-04-28 09:54:38.590745+00	f	\N	\N	\N	\N
1372	2	fizic	chirita daniel	\N	\N	0763672751	\N	\N	2026-04-28 10:50:37.47093+00	\N	f	\N	\N	\N	\N
1373	2	fizic	serbam dan	\N	\N	0732215225	\N	\N	2026-04-28 10:51:02.647402+00	\N	f	\N	\N	\N	\N
1388	2	fizic	FIRESCU FLORIN	\N	\N	0767302604	\N	\N	2026-04-28 12:11:01.647069+00	\N	f	\N	\N	\N	\N
1405	2	fizic	BREZOI DANUT	\N	\N	0744 815 042	\N	\N	2026-04-29 05:25:34.12547+00	\N	f	\N	\N	\N	\N
1409	2	fizic	robert	\N	\N	0774632094	\N	\N	2026-04-29 05:44:02.937567+00	\N	f	\N	\N	\N	\N
1411	2	fizic	ionescu	\N	\N	0727020029	\N	\N	2026-04-29 05:55:29.809258+00	\N	f	\N	\N	\N	\N
1407	2	fizic	BIRDAU GHEORGHE	\N	\N	0725 425 058	\N	\N	2026-04-29 05:41:37.093871+00	2026-04-29 06:00:08.765058+00	f	\N	\N	\N	\N
1421	2	fizic	ruican dan	\N	\N	0774431384	\N	\N	2026-04-29 07:14:52.288016+00	\N	f	\N	\N	\N	\N
1424	2	juridic	kober srl	\N	\N	\N	\N	\N	2026-04-29 07:36:33.573905+00	\N	f	\N	\N	\N	\N
1432	2	fizic	turcu adriana	\N	\N	0728210696	\N	\N	2026-04-29 08:11:19.017363+00	\N	f	\N	\N	\N	\N
1438	2	fizic	mohanu rogeri	\N	\N	0763310935	\N	\N	2026-04-29 08:38:52.535039+00	\N	f	\N	\N	\N	\N
1440	2	fizic	andrei	\N	\N	0722448071	\N	\N	2026-04-29 08:47:27.487223+00	\N	f	\N	\N	\N	\N
1445	2	fizic	STEFAN POPECI	\N	\N	\N	\N	\N	2026-04-29 09:23:57.826401+00	\N	f	\N	\N	\N	\N
1460	2	fizic	ILINCA RAUL	\N	\N	0749285686	\N	\N	2026-04-29 11:06:47.418027+00	\N	f	\N	\N	\N	\N
1467	2	fizic	dragos	\N	\N	0771750853	\N	\N	2026-04-29 11:33:25.480788+00	\N	f	\N	\N	\N	\N
1468	2	fizic	MITROIU IONUT	\N	\N	0787 784 818	\N	\N	2026-04-29 11:44:36.733383+00	\N	f	\N	\N	\N	\N
1481	2	fizic	catalin	\N	\N	\N	\N	\N	2026-04-29 13:22:35.140211+00	\N	f	\N	\N	\N	\N
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.companies (id, account_id, cui, name, address, nr_reg_com, phone, postal_code, is_vat_payer, registration_status, description, comments, created_at, updated_at, is_deleted, deleted_at, tva_percentage, logo_path, background_path, website, bank_name, iban, capital_social) FROM stdin;
1	1	47829189	PROFESSOR PRIME S.R.L.	JUD. TIMIŞ, SAT GIARMATA COM. GIARMATA, STR. PRIMĂVERII, NR.90	J2023001139353	0744138843	307210	f	INREGISTRAT din data 16.03.2023	\N	\N	2026-03-23 21:04:50.303658+00	\N	f	\N	\N	\N	\N	professorprime.ro	\N	\N	200
2	2	5154310	ASCET COM SRL	JUD. DOLJ, MUN. CRAIOVA, BLD. 1 MAI, BL.S5, SC.1, AP.1	J16/3351/1993	0786345577	\N	t	INREGISTRAT din data 03.02.1994	\N	\N	2026-03-23 21:17:16.610746+00	2026-04-07 23:02:09.765755+00	f	\N	21	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/companies/logos/b03dd8d73d0f4e5093c0ec56466c90ee.png	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/companies/backgrounds/5372af64445b4d17a56154a1d4618c5d.png	www.anvelopeascet.ro/	Banca Transilvania	RO15BTRL01701202471096XX	200
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
23	Rapid-Bison-YAX7	2	2	2026-04-01 06:02:42.996618+00
24	Rapid-Tigru-67F8	2	2	2026-04-01 08:57:27.436063+00
25	Verde-Bison-PQ64	2	2	2026-04-02 21:56:20.782573+00
26	Auriu-Cerb-I2WH	2	2	2026-04-04 17:18:05.397859+00
27	Albastru-Leu-VV49	3	3	2026-04-04 17:39:44.926449+00
28	Polar-Cerb-J7UN	2	2	2026-04-04 17:40:36.589194+00
29	Auriu-Cerb-0K36	2	2	2026-04-07 22:01:23.132687+00
30	Solar-Capra-NX8A	2	2	2026-04-07 22:04:42.95961+00
31	Polar-Vultur-AF3M	2	2	2026-04-07 22:09:39.90733+00
32	Polar-Urs-V154	2	2	2026-04-07 22:24:25.563442+00
33	Solar-Cerb-QICE	2	2	2026-04-17 05:31:46.829601+00
34	Argintiu-Tigru-3JUI	2	2	2026-04-20 19:23:21.519233+00
35	Lunar-Tigru-XGTJ	2	2	2026-04-23 07:42:46.272042+00
36	Lunar-Capra-1JSI	2	2	2026-04-23 07:44:05.300084+00
37	Solar-Tigru-J55Q	2	2	2026-04-23 07:44:43.968748+00
38	Solar-Corb-ERFC	2	2	2026-04-23 07:45:19.127708+00
39	Polar-Leu-2KLV	2	2	2026-04-23 08:47:34.140098+00
40	Verde-Capra-D3FO	2	2	2026-04-24 07:25:18.389115+00
41	Solar-Leu-ZE04	2	2	2026-04-24 09:54:29.947157+00
42	Polar-Cerb-A7KM	2	2	2026-04-27 06:00:32.054703+00
43	Argintiu-Cerb-9PEG	2	2	2026-04-27 07:31:26.938415+00
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
8	2	CALUTOIU DANIEL	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/a755bae9360c416dab88d4b854a0a545.png	2026-03-23 22:03:18.994594+00	2026-03-23 22:03:35.20452+00	f	\N	25000.00	2465.00
4	2	CERNAT ANA-MARIA	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/52ed86ab43fe448494f28f378b814993.png	2026-03-23 22:00:51.826214+00	2026-03-23 22:01:04.474235+00	f	\N	25000.00	41940.00
14	2	PETROSANU CONSTANTIN	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/ec2ba175257146b29aaa8b49b56a2b9e.png	2026-03-23 22:06:54.1811+00	2026-03-23 22:07:05.282611+00	f	\N	25000.00	5488.00
13	2	PARVA GHEORGHE	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/feabbfbbd3584fe9bb1f0e1f2a97b12a.png	2026-03-23 22:06:10.190896+00	2026-03-23 22:06:34.479256+00	f	\N	25000.00	702.00
6	2	LITA ROMEO	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/69bd9d5b8d8340d09797c8d2c2d59f1c.png	2026-03-23 22:02:07.117691+00	2026-04-08 08:34:36.961664+00	f	\N	25000.00	271219.00
15	2	STAN STEFANITA	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/44f79e585e564ff9b89dfdc224a7c6ad.png	2026-03-23 22:07:23.424631+00	2026-03-23 22:07:40.709185+00	f	\N	25000.00	13096.00
25	2	TANASESCU STEFAN	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/ffb66924aba948efa4b0784b3d9174bb.png	2026-03-23 22:13:33.263426+00	2026-03-23 22:13:50.157182+00	f	\N	25000.00	13935.00
20	2	OPRAN CLAUDIU	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/0d4b7e011576497f8e1efd024becde94.png	2026-03-23 22:10:30.009357+00	2026-03-23 22:10:39.057309+00	f	\N	25000.00	4470.00
9	2	DUMITRU SANDU G.	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/224ac259865648e0a1e91ab1d5095ca3.png	2026-03-23 22:03:53.222443+00	2026-03-23 22:04:03.817135+00	f	\N	25000.00	756.00
12	2	ONCICA MARIUS	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/0e33b3aea7844b62bdd5e79fb2b1500d.png	2026-03-23 22:05:31.585104+00	2026-03-23 22:05:46.955859+00	f	\N	25000.00	19060.00
24	2	MIREA CATALIN	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/fd14b58bd9e9498faebedab063f3fb27.png	2026-03-23 22:13:04.931784+00	2026-03-23 22:13:14.589621+00	f	\N	25000.00	39284.00
5	2	GEORGESCU F-LARISA	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/f5866a2a79be4e8a9c9a109891b1eb81.png	2026-03-23 22:01:20.997433+00	2026-03-23 22:01:43.55113+00	f	\N	25000.00	163970.00
28	2	NITA LAURENTIU	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/62df79d71a484576b3bf8f47a6597acd.png	2026-03-23 22:15:15.199171+00	2026-03-23 22:15:46.784466+00	f	\N	25000.00	386.00
19	2	FOTA DANIEL-COSMIN	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/16231bb1391f46a3b51b654db0fab9d2.png	2026-03-23 22:09:39.90885+00	2026-03-23 22:10:10.895514+00	f	\N	25000.00	5630.00
29	2	OPRISAN IULIAN	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/43e82bf3ac8349a284f1adf8efc398b3.png	2026-03-23 22:16:13.036799+00	2026-03-23 22:16:21.842535+00	f	\N	25000.00	1378.00
16	2	VASILE COSTEL	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/3b56eb3199054e948e1c5d15380011ad.png	2026-03-23 22:08:01.015951+00	2026-03-23 22:08:13.167086+00	f	\N	25000.00	2000.00
22	2	HOTU MARIAN N.	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/6b94c41f1625498dabd31912fa00972d.png	2026-03-23 22:11:40.952722+00	2026-03-23 22:11:50.158431+00	f	\N	25000.00	54462.00
7	2	STANCU VALENTIN	AGENT VANZARI	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/1812869956f841178bf93e362d2129e0.png	2026-03-23 22:02:43.856593+00	2026-03-23 22:02:56.370024+00	f	\N	25000.00	3690.00
1	2	LUNGU IONELA	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/60f656df5a8c4e91b4a3ce59eb816419.png	2026-03-23 21:58:41.843697+00	2026-03-23 22:00:05.489405+00	f	\N	25000.00	27852.00
17	2	BUTA O. BOGDAN	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/a75f54e0ea9f46798aaaa138dadaf662.png	2026-03-23 22:08:35.724623+00	2026-03-23 22:08:49.151217+00	f	\N	25000.00	970.00
10	2	ION MARIAN	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/52377e7c9ef84e15b9f95299f5bfca41.png	2026-03-23 22:04:20.466189+00	2026-03-23 22:04:32.820808+00	f	\N	25000.00	1123.00
23	2	LIVEZEANU M-COSTINEL	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/dabd4bbb560d434285688d1f2b4b5188.png	2026-03-23 22:12:15.469922+00	2026-03-23 22:12:32.28833+00	f	\N	25000.00	31038.00
26	2	PAUNESCU CRISTIAN	ITP	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/24a355235aad48728688678ffec14362.png	2026-03-23 22:14:08.983536+00	2026-03-23 22:14:20.333288+00	f	\N	25000.00	0.00
27	2	IONITA RAZVAN	MECANICA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/b962543491c34532911744e5a0cb6352.png	2026-03-23 22:14:42.658727+00	2026-03-23 22:14:56.678463+00	f	\N	25000.00	40672.00
2	2	LUNGU NICU	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/61e7df8f562341d28fa501d3fc2d3a3d.png	2026-03-23 21:59:06.069577+00	2026-03-23 22:00:16.769491+00	f	\N	25000.00	3488.00
21	2	BARANESCU DORINEL	HALA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/28dcf849568945b0bd01efb3fbf793ac.png	2026-03-23 22:11:12.590343+00	2026-03-23 22:11:25.065518+00	f	\N	25000.00	56314.00
18	2	DICU NICOLAE C.	GEOMETRIE	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/8794b9c912b748828357402bb012e808.png	2026-03-23 22:09:08.040896+00	2026-03-23 22:09:17.599628+00	f	\N	25000.00	41136.00
3	2	LUNGU RADU	ADMINISTRATOR/FACTURARE/MANAGEMENT	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/9138e2eb26d94e05b1c9fefc8a70ca67.png	2026-03-23 21:59:27.119019+00	2026-03-23 22:00:28.464247+00	f	\N	25000.00	42510.00
11	2	ONCICA I. IONUT	FATA	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/employees/9774b46bc41045879f4e5fb393ed4b74.png	2026-03-23 22:04:49.690075+00	2026-03-23 22:05:00.190464+00	f	\N	25000.00	1222.00
\.


--
-- Data for Name: general_settings; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.general_settings (id, account_id, use_factura, use_aviz, afiseaza_tehnician_deviz) FROM stdin;
2	3	t	t	f
1	2	f	f	t
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.items (id, name, description, created_at, deleted_at, price, currency, unit, is_deleted, type, category_id, image_path, account_id, updated_at) FROM stdin;
23	Executat pană 22,5 toli radial 125	\N	2026-03-23 23:08:27.129487+00	\N	180.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ee63d21c2f0c45cbbc32bbaae6051108.png	2	2026-03-24 00:14:02.472801+00
26	Echilibrat roată aliaj 22,5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/d70a5d074ceb43ef9ac4e702ede0fcd0.png	2	2026-03-24 14:26:56.176268+00
52	Îndreptat jantă aliaj	\N	2026-03-23 23:08:27.129487+00	\N	150.00	Ron	buc	f	SERVICE	13	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/6abbd962800e46a4be8ea5965b6949db.png	2	2026-04-07 11:59:57.879635+00
19	Înlocuit roată axa dublă 20 , 22.5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	50.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/d05a06beb3ab4bf2bf11133ff0890430.png	2	2026-03-24 00:12:51.048807+00
17	Înlocuit anvelopă 20 , 22.5 țoli	\N	2026-03-23 23:08:27.129487+00	\N	100.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8daa07dcf1364f93a0184e6803eb8b5f.png	2	2026-04-01 08:59:08.2595+00
21	Executat pană 22,5 toli radial 110	\N	2026-03-23 23:08:27.129487+00	\N	120.00	Ron	BUC	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/9ca4bda06416451ea653dfccf97ce032.png	2	2026-04-01 13:59:20.503645+00
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
95	Saci	\N	2026-03-23 23:08:27.129487+00	\N	3.00	Ron	buc	f	SERVICE	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/8d21b67561db4483bf1e78bef25dcc8b.png	2	2026-04-03 09:59:40.936425+00
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
107	Echilibrat Hunter RFE 21"-22" SUV	\N	2026-03-23 23:08:27.129487+00	\N	110.00	Ron	buc	f	SERVICE	12	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/32986a80a8b54d4a8bc16355af37bad2.png	2	2026-04-01 14:01:51.193718+00
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
109	Înlocuit roată (Permutare) 17.5 țoli	Permutare	2026-03-30 12:09:39.726488+00	\N	40.00	RON	buc	f	SERVICE	3	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/bc4b716aade64a79b0a886a23f146c90.png	2	2026-04-01 13:01:20.305913+00
111	SENZOR TPMS UVS4062 BLACK	\N	2026-04-03 10:36:19.918349+00	\N	250.00	RON	BUC	f	PRODUS	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/ed8ac87d7eca478b9a5cdfe4a8664b00.png	2	2026-04-03 10:40:44.156259+00
110	SENZOR TPMS UVS4060	\N	2026-04-03 10:20:28.393066+00	\N	250.00	RON	BUC	f	PRODUS	10	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/4a1932fba9e244e8b0211959ff498cc7.png	2	2026-04-03 10:40:34.159554+00
112	Inlocuit roata duba C (Permutare)	\N	2026-04-29 09:04:02.176182+00	\N	25.00	RON	buc	f	SERVICE	5	https://professorprimeprod.nbg1.your-objectstorage.com/accounts/2/items/818b0d66ed6c4ca79c2fe390b3f464d6.png	2	2026-04-29 09:08:36.269769+00
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
3	3	T1	\N	2026-04-04 17:39:43.988699+00	\N	f	\N	\N	\N	\N	\N
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
-- Data for Name: profiluri_anvelope; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.profiluri_anvelope (id, account_id, valoare, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
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
1081	415	285/40/23 PIRELLI PZERO PZ4	2300.00	2	buc	6	2
1082	415	325/35/23 PIRELLI PZERO PZ4	1980.00	2	buc	6	2
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
1083	415	STORNO AVANS	-1000.00	1	buc	6	2
268	88	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
269	89	Îndreptat jantă aliaj	200.00	1	buc	14	2
270	90	Verificare geometrie	120.00	1	buc	19	2
271	87	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
272	87	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
273	91	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
274	91	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
275	91	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
2844	1022	MANOPERA	250.00	1	buc	6	2
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
1084	415	Cazare Roti complete 22''-24''	250.00	1	BUC	24	2
1085	415	Înlocuit anvelopa Jeep (SUV)	35.00	4	BUC	24	2
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
1086	415	Echilibrat janta Jeep (SUV)	45.00	4	BUC	24	2
1087	415	Plumb Hofmann	10.00	4	buc	24	2
1088	415	Îndreptat jantă aliaj	140.00	1	buc	14	2
1089	417	Înlocuit anvelopa	15.00	4	BUC	23	2
1090	417	Echilibrat jantă oțel	18.00	4	BUC	23	2
1091	417	Inlocuit valva turism tubeless	6.00	4	buc	23	2
1114	427	205/50/17 MICHELIN PRIMACY 5	640.00	4	buc	4	2
1115	427	Înlocuit anvelopa	18.00	4	BUC	22	2
1116	427	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1156	449	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1161	451	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1162	451	Saci	2.00	4	buc	21	2
1186	457	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
1192	461	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
1193	461	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
1217	473	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
1278	493	Înlocuit anvelopa	18.00	4	BUC	24	2
1279	493	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1336	511	Înlocuit anvelopa	15.00	4	BUC	22	2
1337	511	Echilibrat jantă oțel	18.00	4	BUC	22	2
1359	524	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
1360	524	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1361	524	Presiune/roată AZOT jeep	8.00	4	buc	27	2
1365	526	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
1366	526	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	22	2
1367	526	Plumb Hofmann	10.00	4	buc	22	2
1395	539	Înlocuit anvelopa	15.00	4	BUC	24	2
1396	539	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1397	539	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
1404	544	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
1405	544	Echilibrat janta camioneta C	25.00	4	BUC	23	2
1406	544	Înlocuit anvelopa camioneta C	23.00	1	BUC	23	2
1407	544	Inlocuit valva turism tubeless	6.00	4	buc	23	2
1408	544	Aplicat petec TIP TOP NR 2	40.00	1	buc	23	2
1435	555	Verificare geometrie	120.00	1	buc	18	2
1440	557	225/65/16C RIKEN CARGO SPEED EVO 112/110T	460.00	4	buc	5	2
1441	557	Echilibrat janta camioneta C	25.00	4	BUC	24	2
1442	557	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
1443	557	Inlocuit valva turism tubeless	6.00	4	buc	24	2
1475	563	225/50 R17 MICHELIN PRIMACY 5 XL 98W	650.00	4	buc	5	2
1476	563	Înlocuit anvelopa	18.00	4	BUC	22	2
1477	563	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1478	563	Îndreptat jantă aliaj	120.00	1	buc	22	2
1489	570	225/45/17 KUMHO PS 72	350.00	2	buc	4	2
1490	570	Înlocuit anvelopa	18.00	4	BUC	27	2
1491	570	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1516	590	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
1517	590	Înlocuit anvelopa	15.00	4	BUC	27	2
1518	590	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
1523	593	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1524	593	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1549	603	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
1550	603	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
1566	608	Înlocuit anvelopa	15.00	4	BUC	22	2
1567	608	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1568	608	Saci	3.00	4	buc	22	2
1600	621	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1639	635	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1675	646	Echilibrat jantă oțel	18.00	4	BUC	27	2
1676	646	Înlocuit anvelopa	15.00	4	BUC	27	2
1697	657	Turisme / suv 19"-24" inch	300.00	1	BUC	20	2
1703	661	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
1704	661	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1721	668	Înlocuit anvelopa	18.00	4	BUC	22	2
1722	668	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1723	668	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
1741	675	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
1742	675	Înlocuit anvelopa	26.00	4	BUC	27	2
1743	675	Echilibrat janta aliaj turism	32.00	4	BUC	27	2
1802	701	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
1803	701	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
1807	702	235/50/19 BARUM BRAVURIS 6	620.00	4	buc	6	2
1808	702	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
1809	702	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
1831	710	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
1832	710	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
1849	720	Verificare geometrie	120.00	1	buc	18	2
1870	704	VALVA RDV026	60.00	1	buc	6	2
1871	704	Înlocuit anvelopa	26.00	4	BUC	21	2
1872	704	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
1873	704	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1874	704	taxa complexitate	180.00	1	buc	21	2
1875	704	Plumb Hofmann	10.00	4	buc	21	2
1890	731	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1891	731	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
1915	739	Înlocuit anvelopa	15.00	4	BUC	23	2
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
1092	418	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
1093	418	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
1094	419	Inlocuit valva cameră	40.00	1	buc	6	2
1117	431	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
1157	450	Înlocuit anvelopa	15.00	4	BUC	23	2
1158	450	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1159	450	Inlocuit valva turism tubeless	6.00	4	buc	23	2
1194	462	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	23	2
1195	462	Echilibrat janta Jeep (SUV)	40.00	4	BUC	23	2
1200	465	Echilibrat jantă oțel	18.00	4	BUC	21	2
1201	465	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
1218	474	Turisme axa fata	180.00	1	BUC	20	2
1219	475	Verificare geometrie	120.00	1	buc	18	2
1253	483	Turisme axa fata	180.00	1	BUC	18	2
1299	488	DEZENT AP 7X17 5X112 ET40	850.00	4	buc	6	2
1300	488	AVANS	-1000.00	1	buc	6	2
1301	488	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
1302	488	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1310	502	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1311	502	Efectuat pana tubeless (cu snur)	35.00	1	BUC	22	2
1316	506	Înlocuit anvelopa	15.00	1	BUC	25	2
1317	506	Echilibrat jantă oțel	18.00	1	BUC	25	2
1319	508	Echilibrat Hunter RFE 23"-24" SUV	130.00	4	buc	22	2
1320	508	Plumb Hofmann	10.00	4	buc	22	2
1340	513	Înlocuit roata turism (Permutare)	18.00	4	BUC	23	2
1341	513	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
1368	527	Înlocuit anvelopa	15.00	4	BUC	24	2
1369	527	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1372	529	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1373	529	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1379	533	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
1380	533	Înlocuit anvelopa	15.00	4	BUC	27	2
1381	533	Echilibrat jantă oțel	18.00	4	BUC	27	2
1398	540	Înlocuit anvelopa	15.00	4	BUC	27	2
1399	540	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
1436	553	255/40/21 PIRELLI P-ZERO PZ4 *	1500.00	2	buc	6	2
1457	564	MONTAT ANV MOTO	25.00	1	buc	21	2
1458	564	ECHILIBRAT MOTO	40.00	1	buc	21	2
1467	567	225/45/18 MICHELIN PS5	790.00	4	buc	6	2
1468	567	achitate anv	-3160.00	1	buc	6	2
1469	567	Cazare Roti complete 17''-18'	160.00	1	BUC	6	2
1474	573	inlocuit filtre si ulei bucsi brate piese ascet man 500	500.00	1	ora	29	2
1492	578	Înlocuit anvelopa	18.00	4	BUC	22	2
1493	578	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1520	592	Înlocuit anvelopa	15.00	2	BUC	12	2
1521	592	Echilibrat janta aliaj turism	19.00	2	BUC	12	2
1522	592	Înlocuit roata turism (Permutare)	16.00	2	BUC	12	2
1534	597	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1535	597	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1536	597	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1552	605	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1612	623	Verificare geometrie	120.00	1	buc	18	2
1626	629	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
1627	629	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
1628	629	Inlocuit valva turism tubeless	6.00	4	buc	22	2
1638	634	Verificare geometrie	120.00	1	buc	18	2
1642	637	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
1677	648	Turisme axa fata	180.00	1	BUC	19	2
1688	647	205/55 R16 RIKEN SUMMER 3 91V	260.00	2	buc	5	2
1689	647	Îndreptat jantă aliaj	120.00	1	buc	15	2
1690	647	Înlocuit anvelopa	15.00	2	BUC	15	2
1691	647	Echilibrat janta aliaj turism	19.00	2	BUC	15	2
1698	658	225/40/18 MICHELIN PS 5	580.00	2	buc	4	2
1701	660	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
1702	660	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1711	664	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
1712	664	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1719	667	MONTAT ANV MOTO	25.00	2	buc	21	2
1720	667	ECHILIBRAT MOTO	40.00	2	buc	21	2
1744	676	Turisme axa fata	180.00	1	BUC	18	2
1777	690	Turisme axa fata	180.00	1	BUC	18	2
1805	703	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1835	713	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
1836	713	Înlocuit anvelopa	18.00	4	BUC	22	2
1837	713	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1876	728	Înlocuit anvelopa	18.00	4	BUC	24	2
1877	728	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1878	728	Saci	3.00	4	buc	24	2
1893	732	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
1902	737	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1904	735	175/65/15 KUMHO ES31	270.00	4	buc	4	2
1905	735	Înlocuit anvelopa	15.00	4	BUC	22	2
1906	735	Echilibrat jantă oțel	18.00	4	BUC	22	2
1907	735	Inlocuit valva turism tubeless	6.00	4	buc	22	2
1916	739	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1918	741	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1919	741	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1922	743	Deblocat suruburi	60.00	1	BUC	1	2
1926	745	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1929	746	Înlocuit anvelopa	15.00	4	BUC	24	2
1930	746	Echilibrat jantă oțel	18.00	4	BUC	24	2
1095	420	Înlocuit roată (Permutare) 17.5 țoli	50.00	1	buc	15	2
577	226	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
578	226	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
579	227	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
581	229	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
1099	423	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
586	233	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
587	233	Înlocuit anvelopa	15.00	4	BUC	22	2
588	233	Echilibrat jantă oțel	18.00	4	BUC	22	2
1100	423	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
1118	432	Înlocuit anvelopa	15.00	4	BUC	15	2
1119	432	Echilibrat jantă oțel	18.00	4	BUC	15	2
1126	436	Echilibrat jantă oțel	18.00	4	BUC	27	2
1165	453	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1196	463	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1204	468	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	22	2
1205	468	Echilibrat janta Jeep (SUV)	30.00	2	BUC	22	2
1206	468	13 aliaj	150.00	1	buc	22	2
1207	468	Saci	2.00	2	buc	22	2
1225	479	Înlocuit anvelopa	18.00	4	BUC	23	2
1226	479	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
1227	480	215/60/17 MICHELIN PRIMACY 5 96H  DOT 2024	600.00	4	buc	4	2
1228	480	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1229	480	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
1230	480	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
1257	485	Înlocuit anvelopa	23.00	4	BUC	22	2
1258	485	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
1259	485	Saci	2.00	4	buc	22	2
1298	499	Constatare defectiuni	60.00	1	buc	18	2
1306	500	Înlocuit anvelopa	12.00	4	BUC	24	2
1307	500	Echilibrat jantă oțel	14.00	4	BUC	24	2
1325	505	215/65/17 KUMHO HS52 XL 103V	430.00	4	buc	5	2
1326	505	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
1327	505	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
1328	505	Saci	2.00	4	buc	12	2
1342	514	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1346	517	Echilibrat janta aliaj turism	24.00	1	BUC	21	2
1347	517	Înlocuit anvelopa	18.00	1	BUC	21	2
1348	517	Inlocuit valva senzor	25.00	1	buc	21	2
1370	528	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
1371	528	Saci	2.00	4	buc	22	2
1375	531	Verificare geometrie	120.00	1	buc	18	2
1402	543	Echilibrat jantă oțel	18.00	4	BUC	21	2
1403	543	Înlocuit anvelopa	15.00	4	BUC	21	2
1413	545	235 65 16c MICHELIN	200.00	2	buc	25	2
1414	545	Echilibrat janta camioneta C	25.00	2	BUC	25	2
1415	545	Înlocuit anvelopa camioneta C	23.00	2	BUC	25	2
1416	546	Înlocuit anvelopa	15.00	4	BUC	15	2
1417	546	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
1424	551	Înlocuit anvelopa	18.00	4	BUC	27	2
1425	551	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1426	551	Cazare Anvelope 17''-18'	140.00	1	BUC	27	2
1427	551	inlocit ulei si filtre pisese asc	200.00	1	ora	27	2
1500	582	Înlocuit anvelopa	15.00	4	BUC	27	2
1501	582	Echilibrat jantă oțel	18.00	4	BUC	27	2
1502	582	Saci	3.00	4	buc	27	2
1507	584	Turisme axa fata	180.00	1	BUC	18	2
1508	585	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
1525	589	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	2	buc	5	2
1526	589	Înlocuit anvelopa	15.00	2	BUC	15	2
1527	589	Echilibrat janta aliaj turism	19.00	2	BUC	15	2
1528	589	Inlocuit valva turism tubeless	6.00	2	buc	15	2
1570	610	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1613	624	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1614	622	195/70/15C  RIKEN CARGO WINTER	380.00	2	buc	6	2
1615	622	Înlocuit anvelopa camioneta C	23.00	2	BUC	12	2
1643	638	inlocuit tampoane motor si furtun turbo piese ascet	400.00	1	ora	29	2
1678	649	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
1713	665	225/40/18 MICHELIN PS 5	580.00	2	buc	4	2
1714	665	Cazare Roti complete 17''-18'	160.00	1	BUC	12	2
1715	665	Înlocuit anvelopa	18.00	2	BUC	12	2
1716	665	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
1717	665	Îndreptat jantă aliaj	120.00	1	buc	12	2
1724	662	255/50 R19 MICHELIN PRIMACY 5 ENERGY	950.00	2	buc	5	2
1725	662	235/55 R19 MICHELIN PRIMACY 5 ENERGY	830.00	2	buc	5	2
1726	662	Plumb Hofmann	10.00	4	buc	24	2
1727	662	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
1728	662	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
1748	678	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1750	680	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
1751	680	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
1778	691	Înlocuit roata turism (Permutare)	16.00	4	BUC	27	2
1779	692	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1780	692	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1781	693	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
1782	693	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1785	695	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	11	2
1786	695	Echilibrat janta Jeep (SUV)	24.00	4	BUC	11	2
1810	705	Înlocuit anvelopa	15.00	4	BUC	24	2
1811	705	Echilibrat jantă oțel	18.00	4	BUC	24	2
1812	705	Coliere	0.50	8	buc	24	2
1838	714	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
1839	714	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
2189	819	Saci	3.00	4	buc	27	2
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
1096	421	Cazare Anvelope 22''-24''	180.00	1	BUC	3	2
1122	434	Turisme axa fata	180.00	1	BUC	18	2
2453	895	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
2454	895	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
2462	897	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
1197	464	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	23	2
1198	464	Echilibrat janta Jeep (SUV)	40.00	4	BUC	23	2
1199	464	Plumb Hofmann	10.00	4	buc	23	2
2463	897	Echilibrat Hunter RFE 19"-20" SUV	90.00	4	buc	24	2
2464	897	Plumb Hofmann	10.00	4	buc	24	2
2465	898	Înlocuit anvelopa	23.00	4	BUC	22	2
1234	469	285/35/20 MICHELIN PILOT SPORT 4S XL 104Y	1570.00	2	buc	5	2
1235	469	255/40/20 MICHELIN PILOT SPORT 4S XL 101Y	1270.00	2	buc	5	2
1236	469	13 aliaj	150.00	1	buc	12	2
1237	469	Înlocuit anvelopa	23.00	4	BUC	12	2
1238	469	Echilibrat janta aliaj turism	26.00	4	BUC	12	2
1239	469	Plumb Hofmann	10.00	4	buc	12	2
1260	482	215/55/16 RIKEN SUMMER 3 XL 97H	330.00	4	buc	5	2
1261	482	Înlocuit anvelopa	15.00	4	BUC	25	2
1262	482	Echilibrat jantă oțel	18.00	4	BUC	25	2
1263	482	Inlocuit valva turism tubeless	6.00	4	buc	25	2
1264	482	Saci	2.00	4	buc	25	2
1303	494	195/65/15 RIKEN SUMMER 3 91H	240.00	2	buc	5	2
1304	494	Înlocuit anvelopa	15.00	4	BUC	25	2
1305	494	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
1308	501	Înlocuit anvelopa	18.00	5	BUC	12	2
1309	501	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
1323	509	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1324	509	Curatare butuc	10.00	2	buc	24	2
1343	515	Înlocuit anvelopa	15.00	4	BUC	24	2
1344	515	Echilibrat jantă oțel	18.00	4	BUC	24	2
1345	516	Constatare defectiuni	60.00	1	buc	18	2
1374	530	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1409	541	195/60 R16 KUMHO ES31 89H	450.00	4	buc	5	2
1410	541	Înlocuit anvelopa	15.00	4	BUC	22	2
1411	541	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1412	541	Inlocuit valva turism tubeless	6.00	4	buc	22	2
1428	552	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
1429	552	Efectuat pană tubeless (cu snur)	25.00	1	BUC	21	2
1430	552	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1444	558	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1445	558	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3023	1100	Saci	3.00	8	buc	24	2
1473	572	Constatare defectiuni	60.00	1	buc	18	2
1503	583	Înlocuit anvelopa	15.00	4	BUC	15	2
1504	583	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
1505	577	215/75 R16C RIKEN ALL SEASON 116/114R	510.00	2	buc	5	2
1506	577	Înlocuit anvelopa camioneta C	23.00	2	BUC	12	2
1530	595	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
1531	595	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1573	612	Înlocuit anvelopa	15.00	4	BUC	21	2
1574	612	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1621	626	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
1622	626	Înlocuit anvelopa	23.00	4	BUC	24	2
1623	626	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
1644	639	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1645	639	Îndreptat jantă aliaj	120.00	1	buc	22	2
1679	650	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
1680	650	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	21	2
1694	656	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
1695	656	Înlocuit anvelopa	18.00	4	BUC	22	2
1696	656	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1718	666	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1752	681	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
1753	681	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1783	694	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
1784	694	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	27	2
1793	696	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1841	716	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
1842	716	Înlocuit anvelopa	18.00	4	BUC	24	2
1843	716	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1855	723	245/45 R18 MICHELIN PILOT SPORT 5 XL 100Y	760.00	4	buc	5	2
1856	723	Înlocuit anvelopa	18.00	4	BUC	24	2
1857	723	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1858	723	Saci	3.00	4	buc	24	2
1860	725	CONDUCTA 116037	150.00	1	buc	6	2
1861	725	MANOPERA	150.00	1	buc	6	2
1882	730	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
1894	733	245/45 R19 MICHELIN PILOT SOIRT 5 XL 102Y	1050.00	2	buc	5	2
1895	733	Înlocuit anvelopa	23.00	2	BUC	24	2
1896	733	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
1900	736	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
1901	736	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
1912	738	225/45/17 GOODYEAR EAGLE F1 ASY 6 XL 94Y	500.00	4	buc	5	2
1913	738	Înlocuit anvelopa	18.00	4	BUC	12	2
1914	738	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
1917	740	Turisme axa fata	180.00	1	BUC	18	2
1920	742	Echilibrat Hunter RFE 17"-18" SUV	80.00	4	buc	21	2
1923	744	Înlocuit anvelopa	15.00	2	BUC	21	2
1924	744	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1925	744	ANV SH FALKEN 205 55 16	150.00	2	buc	21	2
1950	750	Înlocuit anvelopa	18.00	4	BUC	23	2
1951	750	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
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
1097	422	Înlocuit anvelopa	18.00	4	BUC	24	2
709	288	Autoutilitare axa simpla/dubla	300.00	1	BUC	20	2
710	289	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
711	287	295/60/22.5 GITI GDR675	2300.00	4	buc	4	2
712	287	Înlocuit anvelopă 20 , 22.5 țoli	80.00	4	BUC	15	2
713	290	215/55/17 MICHELIN PS5	250.00	4	buc	6	2
1098	422	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
715	292	Turisme axa fata	180.00	1	BUC	18	2
716	293	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
717	294	Deblocat suruburi	60.00	1	BUC	6	2
1123	435	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
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
1124	435	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
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
1125	435	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
2455	896	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	15	2
750	311	Echilibrat janta camioneta C	25.00	2	BUC	21	2
751	311	Înlocuit anvelopa camioneta C	23.00	6	BUC	21	2
752	312	Turisme axa fata	180.00	1	BUC	18	2
753	313	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
754	313	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2456	896	Echilibrat janta Jeep (SUV)	30.00	4	BUC	15	2
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
1101	424	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1102	424	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
819	335	Verificare geometrie	120.00	1	buc	18	2
1103	425	Înlocuit anvelopa	15.00	4	BUC	23	2
1104	425	Echilibrat jantă oțel	18.00	4	BUC	23	2
1130	438	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1131	438	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
824	333	225/65/16C VIKING TRANS TECH	540.00	2	buc	6	2
825	333	Înlocuit anvelopa camioneta C	23.00	2	BUC	14	2
826	333	Echilibrat janta camioneta C	25.00	2	BUC	14	2
2457	887	235/60 R16 FIRESTONE ROADHAWK 2 XL 104H	520.00	4	buc	5	2
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
876	345	Turisme axa fata	180.00	3	BUC	2	2
877	345	Reducere	-540.00	1	buc	2	2
878	345	Constatare defectiuni	60.00	1	buc	2	2
879	346	Înlocuit anvelopa	15.00	4	BUC	22	2
880	346	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
882	348	Înlocuit anvelopa	15.00	4	BUC	24	2
883	348	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
884	349	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
885	349	Înlocuit anvelopa	15.00	4	BUC	21	2
886	350	Turisme axa fata	180.00	1	BUC	19	2
887	351	205/55/16 KUMHO HA32	390.00	2	buc	6	2
888	351	Înlocuit anvelopa	15.00	2	BUC	10	2
889	351	Echilibrat janta aliaj turism	19.00	2	BUC	10	2
890	351	Înlocuit roata turism (Permutare)	16.00	2	BUC	10	2
891	352	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
892	352	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
893	352	Inlocuit valva senzor	25.00	4	buc	22	2
894	353	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
895	347	205/55/16 KUMHO HA32	390.00	2	buc	6	2
896	347	Efectuat pană tubeless (cu snur)	25.00	1	BUC	27	2
897	347	Înlocuit anvelopa	15.00	2	BUC	27	2
898	347	Echilibrat jantă oțel	18.00	2	BUC	27	2
899	354	Cazare Anvelope 13'' - 16''	60.00	1	BUC	27	2
900	355	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
901	356	Echilibrat jantă oțel	18.00	4	BUC	21	2
902	356	Înlocuit anvelopa	15.00	4	BUC	21	2
903	357	Înlocuit anvelopa camioneta C	23.00	4	BUC	10	2
904	357	Echilibrat janta camioneta C	25.00	4	BUC	10	2
905	357	Inlocuit valva turism tubeless	6.00	4	buc	10	2
906	358	Înlocuit anvelopa	15.00	4	BUC	15	2
907	358	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
908	358	Inlocuit valva turism tubeless	6.00	4	buc	15	2
909	359	Turisme axa fata	180.00	1	BUC	20	2
910	360	215/60/17 RIKEN SUMMER 3	360.00	4	buc	6	2
911	360	Înlocuit anvelopa Jeep (SUV)	0.00	4	BUC	6	2
912	360	Echilibrat janta Jeep (SUV)	0.00	4	BUC	6	2
913	361	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
914	361	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
916	363	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
917	364	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
918	364	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
919	365	Turisme axa fata	180.00	1	BUC	17	2
926	367	Turisme axa fata	180.00	1	BUC	19	2
1105	426	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
1133	441	Turisme axa fata	180.00	1	BUC	18	2
1136	443	Înlocuit anvelopa	18.00	4	BUC	21	2
1137	443	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
941	370	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
948	373	195/65/15 KUMHO ES31	260.00	2	buc	4	2
949	374	Înlocuit anvelopa	26.00	4	BUC	21	2
950	374	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
951	374	Plumb Hofmann	10.00	4	buc	21	2
952	374	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1138	443	Inlocuit valva turism tubeless	6.00	4	buc	21	2
1144	446	Turisme axa fata	180.00	1	BUC	18	2
1146	447	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
1147	447	Saci	2.00	4	buc	24	2
1202	466	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1203	467	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1240	476	215/55/18 MICHELIN PRIMACY 5 ENERGY XL 99V	780.00	4	buc	5	2
1241	476	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1242	476	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
1243	476	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1265	486	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
1318	507	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1349	518	Înlocuit anvelopa	15.00	4	BUC	22	2
1350	518	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1376	532	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
1377	532	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
1378	532	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
1387	536	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
1388	536	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
1389	536	Plumb Hofmann	10.00	4	buc	23	2
1390	536	Echilibrat Hunter RFE 17"-18" SUV	80.00	4	buc	23	2
1418	547	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1446	559	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1447	559	Înlocuit anvelopa	26.00	4	BUC	21	2
1448	559	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
1449	559	Plumb Hofmann	10.00	4	buc	21	2
1479	574	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1509	586	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
1529	594	Înlocuit roata turism (Permutare)	12.00	4	BUC	27	2
1537	598	Înlocuit anvelopa	15.00	4	BUC	25	2
1538	598	Echilibrat jantă oțel	18.00	4	BUC	25	2
1539	598	Cazare Anvelope 13'' - 16''	120.00	1	BUC	25	2
1575	611	Înlocuit anvelopa	15.00	4	BUC	24	2
1576	611	Echilibrat jantă oțel	18.00	4	BUC	24	2
1577	611	Coliere	0.50	8	buc	24	2
1578	613	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
1584	604	2354517 KUMHO HS52	370.00	2	BUC	6	2
1585	604	Înlocuit anvelopa	18.00	2	BUC	27	2
1586	604	Echilibrat janta aliaj turism	24.00	2	BUC	27	2
1593	616	Echilibrat jantă oțel	18.00	2	BUC	24	2
1594	616	Înlocuit roata turism (Permutare)	16.00	2	BUC	24	2
1595	617	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
1596	618	Autoutilitare axa simpla/dubla	300.00	1	BUC	20	2
1624	627	Îndreptat jantă aliaj	180.00	2	buc	15	2
1625	628	Verificare geometrie	120.00	1	buc	18	2
1635	633	Cazare Roti complete 22''-24''	250.00	1	BUC	27	2
1636	633	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	27	2
1637	633	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
1665	645	Sudura janta	350.00	1	buc	16	2
1666	606	ULEI CASTROL EDGE 0W20 V 1L	100.00	2	buc	6	2
1667	606	ULEI CASTROL EDGE 0W20 V 4L	380.00	1	buc	6	2
1668	606	HU8014Z	50.00	1	buc	6	2
1669	606	BIELETA ANTIRULIU 3543001	90.00	2	buc	6	2
1670	606	BIELETA ANTIRULIU 3371301	85.00	2	buc	6	2
1671	606	MANOPERA	270.00	1	buc	6	2
1684	652	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1685	652	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1729	669	Echilibrat jantă oțel	18.00	4	BUC	21	2
1730	669	Înlocuit anvelopa	15.00	4	BUC	21	2
1756	683	Echilibrat Hunter RFE 21"-22" Turisme	100.00	5	buc	21	2
1757	683	Înlocuit anvelopa	26.00	4	BUC	21	2
1758	683	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1787	689	315/35 R21 MICHELIN PS4 SUV RFT *	1900.00	2	buc	3	2
1788	689	275/40 R21 MICHELIN PS4 SUV RFT *	1750.00	2	buc	3	2
1789	689	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
1790	689	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	22	2
1791	689	Plumb Hofmann	10.00	4	buc	22	2
1792	689	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
1794	697	Turisme axa fata	180.00	1	BUC	18	2
1819	706	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
1820	706	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
1821	706	Cazare Anvelope 17''-18'	140.00	1	BUC	6	2
1822	706	CAPAC 4M0601173D	15.00	2	buc	6	2
1840	715	245/45 R18 MICHELIN PILOT SPORT 5 XL 100Y	760.00	4	buc	5	2
1844	717	Turisme axa fata	180.00	1	BUC	18	2
1859	724	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1862	726	Înlocuit anvelopa	18.00	4	BUC	22	2
1863	726	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1864	726	13 aliaj	150.00	4	buc	22	2
1885	478	215/60/17 MICHELIN PRIMACY 5 96H  DOT 2024	600.00	4	buc	4	2
1886	478	Cazare Anvelope 17''-18'	140.00	1	BUC	27	2
1897	734	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
1898	734	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
935	368	215/60/17 RIKEN SUMMER 3	360.00	4	buc	6	2
936	368	Înlocuit anvelopa Jeep (SUV)	0.00	4	BUC	6	2
937	368	Echilibrat janta Jeep (SUV)	0.00	4	BUC	6	2
942	371	Verificare geometrie	120.00	1	buc	17	2
943	362	235/45/18 MICHELIN PRIMACY 5	820.00	4	buc	6	2
944	362	Înlocuit anvelopa	18.00	4	BUC	23	2
945	362	Plumb Hofmann	10.00	4	buc	23	2
946	362	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
947	372	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
953	375	195/65/15 KUMHO ES31	260.00	2	buc	4	2
954	375	Înlocuit anvelopa	15.00	4	BUC	24	2
955	375	Echilibrat jantă oțel	18.00	4	BUC	24	2
956	369	Înlocuit anvelopa	15.00	4	BUC	27	2
957	369	Echilibrat jantă oțel	19.00	4	BUC	27	2
958	369	MANOPERA SCHIMB ULEI	250.00	1	ora	27	2
959	376	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
960	376	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
961	376	Presiune/roată AZOT jeep	8.00	4	buc	27	2
962	377	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
963	378	Înlocuit anvelopa camioneta C	23.00	6	BUC	22	2
964	378	Echilibrat janta camioneta C	25.00	2	BUC	22	2
965	378	Inlocuit valva turism tubeless	6.00	6	buc	22	2
969	380	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
970	380	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
971	379	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
972	379	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
973	379	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
974	381	Turisme axa fata	180.00	1	BUC	19	2
975	382	Cazare Anvelope 19''-21''	150.00	1	BUC	2	2
977	384	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
978	385	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
981	386	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
982	386	Plumb Hofmann	10.00	4	buc	22	2
984	388	Verificare geometrie	120.00	1	buc	18	2
985	389	Înlocuit anvelopa	12.00	4	BUC	23	2
986	389	Echilibrat jantă oțel	14.00	4	BUC	23	2
987	383	215/65/16 KUMHO HA 32	480.00	4	buc	4	2
988	383	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
989	383	Înlocuit anvelopa	15.00	4	BUC	21	2
990	390	Înlocuit anvelopa	15.00	4	BUC	14	2
991	390	Echilibrat janta aliaj turism	19.00	4	BUC	14	2
992	391	Verificare geometrie	120.00	1	buc	18	2
993	392	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	24	2
994	392	Plumb Hofmann	10.00	4	buc	24	2
995	387	225/50/17 MICHELIN PRIMACY 5	650.00	4	buc	6	2
996	387	Înlocuit anvelopa	18.00	4	BUC	27	2
997	387	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
998	393	Echilibrat janta camioneta C	25.00	2	BUC	23	2
999	393	Înlocuit anvelopa camioneta C	23.00	2	BUC	23	2
1000	394	Înlocuit anvelopa	18.00	4	BUC	22	2
1001	394	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1002	394	Inlocuit valva senzor	25.00	3	buc	22	2
1003	394	Îndreptat jantă aliaj	120.00	1	buc	22	2
1009	366	FILTRU ULEI W7008	30.00	1	buc	7	2
1010	366	ULEI FORD 5W30 5L	230.00	1	buc	7	2
1011	366	DISC FRANA SPATE  DF4372	130.00	2	buc	7	2
1012	366	PLACUTE FRANA SPATE GDB1621	115.00	1	buc	7	2
1013	366	MANOPERA	400.00	1	ora	7	2
1014	395	Echilibrat jantă oțel	18.00	4	BUC	21	2
1015	395	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1017	397	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
1018	398	INLOCUIT FILTU SI ULEI SI PLACUTE SI DISCURI SPATE PIESE ASCET MANOPERA 400	400.00	1	ora	29	2
1019	396	225/50/17 MICHELIN PRIMACY 5 XL 98W	650.00	4	buc	5	2
1020	396	Înlocuit anvelopa	18.00	4	BUC	24	2
1021	396	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1022	396	Saci	2.00	4	buc	24	2
1023	399	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1024	399	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1025	400	Înlocuit anvelopa camioneta C	23.00	6	BUC	22	2
1026	400	Echilibrat janta camioneta C	25.00	2	BUC	22	2
1027	401	Înlocuit anvelopa	15.00	4	BUC	27	2
1028	401	Echilibrat jantă oțel	18.00	4	BUC	27	2
1029	402	Executat pană 22,5 toli radial 115	120.00	1	BUC	15	2
1031	404	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
1036	407	Turisme axa fata	180.00	1	BUC	18	2
1037	408	Înlocuit anvelopa	18.00	4	BUC	27	2
1038	408	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1039	408	Inlocuit valva turism tubeless	6.00	4	buc	27	2
1040	409	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1041	409	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1042	403	Îndreptat jantă aliaj	160.00	1	buc	14	2
1044	406	190/55/17 MICHELIN POWER GP2	1130.00	1	buc	4	2
1045	406	120/70/17 MICHELIN POWER GP2	830.00	1	buc	4	2
1046	406	AVANS	-100.00	1	buc	4	2
1047	406	demontat  montat roti moto IULICA = MOSU	50.00	2	buc	21	2
1048	406	valve moto	25.00	2	buc	21	2
1049	406	ECHILIBRAT MOTO	40.00	2	buc	21	2
1050	406	MONTAT ANV MOTO	25.00	2	buc	21	2
1051	411	Îndreptat jantă aliaj	170.00	1	buc	14	2
1052	410	385/55/22.5 ROYAL BLACK SL007	1700.00	2	buc	4	2
1053	410	Înlocuit anvelopă 20 , 22.5 țoli	80.00	2	BUC	15	2
1059	412	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1062	414	Înlocuit anvelopa	18.00	2	BUC	21	2
1054	410	Echilibrat roată oțel 22,5 țoli	100.00	2	BUC	15	2
1055	405	235/35/19 MICHELIN PILOT SPORT 4S XL 91Y	890.00	4	buc	5	2
1056	405	Înlocuit anvelopa	23.00	4	BUC	23	2
1057	405	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
1058	405	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
1060	413	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1061	413	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1073	416	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
2458	887	AVANS	-1000.00	1	buc	5	2
1134	442	Înlocuit anvelopa	18.00	4	BUC	15	2
1135	442	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
1155	448	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
1174	452	275/45/21 MICHELIN PS4 SUV	1390.00	2	buc	6	2
1175	452	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
1176	452	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
1177	452	13 aliaj	150.00	1	buc	22	2
2459	887	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	21	2
1244	481	Verificare geometrie	120.00	1	buc	18	2
1266	487	315/80/22.5 MICHELIN  X WORKS HD D	3750.00	4	buc	4	2
1267	487	385/65/22.5 MICHELIN X WORKS T	3680.00	2	buc	4	2
1270	489	inlocuit placute fata spate piese asc man 400	400.00	1	ora	29	2
1271	490	Înlocuit anvelopa	15.00	4	BUC	22	2
1272	490	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1273	490	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
1281	492	PLACUTE FRANA FATA  13046027852	300.00	1	buc	7	2
1282	492	MANOPERA	400.00	1	ora	7	2
1283	492	PLACUTE FRANA SAPTE 13046072932	210.00	1	buc	7	2
1284	495	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1288	497	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
1289	497	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
1290	498	225/45/17 MICHELIN PS 5	540.00	4	buc	4	2
1291	498	Înlocuit anvelopa	18.00	4	BUC	27	2
1292	498	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1293	498	Saci	2.00	4	buc	27	2
1313	504	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1314	504	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1351	519	Turisme axa fata	180.00	1	BUC	18	2
1382	534	Turisme axa fata	180.00	1	BUC	18	2
1391	537	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1392	537	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1419	548	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1420	548	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1450	560	inlocuit capete bara piese client man 100	100.00	1	ora	28	2
1466	569	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
1471	571	Înlocuit anvelopa	15.00	4	BUC	27	2
1472	571	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
1480	575	Autoutilitare axa simpla/dubla	300.00	1	BUC	20	2
1494	579	Turisme axa fata	180.00	1	BUC	18	2
1497	581	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
1498	581	Înlocuit anvelopa	23.00	4	BUC	24	2
1499	581	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	24	2
1510	587	Înlocuit anvelopa	15.00	4	BUC	22	2
1511	587	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1540	599	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
1541	599	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1581	607	215/60/165 GOODYEAR VECTOR 4S GEN 3	700.00	1	buc	6	2
1582	607	Înlocuit anvelopa	15.00	1	BUC	8	2
1583	607	Echilibrat janta aliaj turism	19.00	1	BUC	8	2
1598	620	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
1599	620	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
1608	614	315/35/21 MICHELIN PS4 SUV RUNFLAT  *	1900.00	2	buc	6	2
1609	614	275/40/21 MICHELIN PS4 SUV * RFT	1750.00	2	buc	6	2
1610	614	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
1611	614	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	21	2
1629	630	Înlocuit anvelopa	26.00	4	BUC	21	2
1630	630	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
1631	630	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1648	631	235/60/18 MICHELIN PS4 SUV	880.00	2	buc	6	2
1649	631	255/55/18 MICHELIN PS4 SUV	830.00	2	buc	6	2
1650	631	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
1651	631	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
1652	631	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
1661	643	Înlocuit anvelopa	18.00	4	BUC	24	2
1662	643	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1663	643	Saci	3.00	4	buc	24	2
1686	653	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
1687	653	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1699	659	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1700	659	Înlocuit anvelopa	15.00	4	BUC	21	2
1731	670	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1732	670	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1734	672	Verificare geometrie	120.00	1	buc	18	2
1735	673	Înlocuit anvelopa	26.00	4	BUC	22	2
1736	673	Echilibrat janta aliaj turism	32.00	4	BUC	22	2
1737	673	Plumb Hofmann	10.00	4	buc	22	2
1760	685	Înlocuit anvelopa	12.00	2	BUC	24	2
1761	685	Echilibrat jantă oțel	14.00	2	BUC	24	2
1763	687	Înlocuit anvelopa	18.00	4	BUC	27	2
1764	687	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1773	684	185/65/15 SAILUN ATREZZO ELLIT	180.00	4	buc	6	2
1774	684	Echilibrat jantă oțel	18.00	4	BUC	21	2
1775	684	Înlocuit anvelopa	15.00	4	BUC	21	2
1776	684	Saci	3.00	4	buc	21	2
1795	698	anv sh 205 60 16 riken	125.00	4	buc	21	2
1063	414	Echilibrat janta aliaj turism	24.00	2	BUC	21	2
2460	887	Echilibrat janta Jeep (SUV)	19.00	4	BUC	21	2
2461	887	Saci	3.00	4	buc	21	2
1109	428	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1110	428	Echilibrat jantă oțel	14.00	4	BUC	21	2
1111	428	Coliere	0.50	8	buc	21	2
1112	429	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
1139	444	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
1140	444	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
1141	444	Plumb Hofmann	10.00	4	buc	23	2
1143	439	225/60/17 MICHELIN PRIMACY 5 99V	930.00	2	buc	4	2
1151	445	185/65/15 KUMHO HA32 ALL SEASON 88H	300.00	4	buc	5	2
1152	445	Înlocuit anvelopa	15.00	4	BUC	23	2
1153	445	Echilibrat jantă oțel	18.00	4	BUC	23	2
1154	445	Inlocuit valva turism tubeless	6.00	4	buc	23	2
1178	454	Echilibrat jantă oțel	18.00	4	BUC	23	2
1182	440	215/50/18 KUMHO PS 71	450.00	2	buc	4	2
1183	440	SENSOE UVS4060	225.00	4	buc	6	2
1184	440	Înlocuit anvelopa	18.00	2	BUC	21	2
1185	440	Echilibrat janta aliaj turism	24.00	2	BUC	21	2
1188	459	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
1189	459	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
1190	459	Deblocat suruburi	60.00	4	BUC	27	2
1211	471	Înlocuit anvelopa Jeep (SUV)	32.00	2	BUC	23	2
1212	471	Echilibrat janta Jeep (SUV)	40.00	2	BUC	23	2
1213	471	Saci	2.00	2	buc	23	2
1214	471	Inlocuit valva senzor	25.00	1	buc	23	2
1245	472	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	10	2
1246	472	Echilibrat janta Jeep (SUV)	19.00	4	BUC	10	2
1247	472	Inlocuit valva turism tubeless	6.00	4	buc	10	2
1254	484	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
1255	484	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
1256	484	Saci	2.00	4	buc	23	2
1274	491	225/45/17 MICHELIN PS 5	540.00	4	buc	4	2
2470	900	Inlocuit valva senzor	25.00	4	buc	27	2
1329	503	165/70/14 KUMHO ES31	290.00	4	buc	6	2
1330	503	Echilibrat jantă oțel	14.00	4	BUC	21	2
1331	503	Înlocuit anvelopa	12.00	4	BUC	21	2
1332	503	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1338	512	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1339	512	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
1352	520	Înlocuit anvelopa	15.00	4	BUC	24	2
1353	520	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1356	522	Turisme axa fata	180.00	1	BUC	18	2
1362	525	Înlocuit anvelopa	18.00	4	BUC	22	2
1363	525	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1364	525	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
1421	549	Turisme axa fata	180.00	1	BUC	20	2
1432	554	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1433	554	Înlocuit anvelopa	15.00	4	BUC	22	2
1434	554	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
1437	556	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1438	556	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
1451	561	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1452	561	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1459	565	Turisme axa fata	180.00	1	BUC	18	2
1464	568	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1465	568	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1481	576	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
1512	588	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
1513	588	Înlocuit anvelopa	15.00	4	BUC	24	2
1514	588	Echilibrat jantă oțel	18.00	4	BUC	24	2
1519	591	Turisme axa fata	180.00	1	BUC	18	2
1542	600	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1543	600	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1546	602	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	15	2
1547	602	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
1548	602	Aplicat petec TIP TOP NR 2	40.00	1	buc	15	2
1569	609	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
1597	619	Turisme axa fata	180.00	1	BUC	18	2
1616	625	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
1617	625	Înlocuit roata turism (Permutare)	24.00	4	BUC	27	2
1640	636	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
1641	636	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
1653	640	Turisme axa fata	180.00	1	BUC	18	2
1654	641	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1655	641	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1656	641	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1657	641	SENZOR TPMS UVS4060	250.00	4	BUC	21	2
1692	654	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1733	671	Înlocuit anvelopă 20 , 22.5 țoli	100.00	2	BUC	15	2
1762	686	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1796	698	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1797	698	Înlocuit anvelopa	15.00	4	BUC	21	2
1823	707	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	22	2
1824	707	Cazare Roti complete 22''-24''	250.00	1	BUC	22	2
1845	718	Înlocuit anvelopa	18.00	4	BUC	23	2
1846	718	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
1865	722	225/50/18 KUMHO HS 52	600.00	4	buc	4	2
1866	722	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
1867	722	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
1868	722	Saci	3.00	4	buc	12	2
1887	729	205/55 R16 KUMHO HS52	280.00	4	buc	3	2
1113	430	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1120	433	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
1121	433	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
1148	437	205/55/16 MICHELIN PRIMACY 5	470.00	4	buc	4	2
1149	437	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1150	437	Înlocuit anvelopa	15.00	4	BUC	21	2
1179	455	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
1180	455	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1181	456	Turisme axa fata	180.00	1	BUC	18	2
1187	458	Verificare geometrie	120.00	1	buc	18	2
1191	460	Înlocuit anvelopă 20 , 22.5 țoli	100.00	8	BUC	15	2
1221	477	inlocuit placute fata manopera 150	150.00	1	ora	28	2
1248	470	195/75/*16C MICHELIN CROSS CLIMATE	770.00	4	buc	6	2
1249	470	Echilibrat janta camioneta C	25.00	2	BUC	24	2
1250	470	Înlocuit anvelopa camioneta C	23.00	6	BUC	24	2
1251	470	Inlocuit valva turism tubeless	6.00	6	buc	24	2
1285	496	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1286	496	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1287	496	Saci	2.00	4	buc	21	2
1333	510	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
1334	510	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
1335	510	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
1354	521	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
1355	521	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
1357	523	Echilibrat jantă oțel	18.00	4	BUC	25	2
1358	523	Inlocuit valva turism tubeless	6.00	4	buc	25	2
1385	535	SENZOR TPMS UVS4060	250.00	1	BUC	6	2
1386	535	SENZOR TPMS UVS4062 BLACK	250.00	1	BUC	6	2
1393	538	Înlocuit anvelopa	15.00	4	BUC	24	2
1394	538	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
1401	542	Turisme axa fata	180.00	1	BUC	18	2
1422	550	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
1423	550	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
1453	562	Aplicat petec TIP TOP NR 2	40.00	1	buc	21	2
1454	562	Înlocuit anvelopa Jeep (SUV)	20.00	1	BUC	21	2
1455	562	Echilibrat janta Jeep (SUV)	24.00	1	BUC	21	2
1482	566	275/50/20 MICHELIN PS 4 SUV	1550.00	4	buc	4	2
1483	566	AVANS	-2000.00	1	buc	4	2
1484	566	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
1485	566	Echilibrat Hunter RFE 19"-20" SUV	90.00	4	buc	25	2
1486	566	Plumb Hofmann	10.00	4	buc	25	2
1487	566	Saci	3.00	4	buc	25	2
1495	580	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
1496	580	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
1532	596	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1533	596	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1544	601	Înlocuit anvelopa	18.00	4	BUC	25	2
1545	601	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
1591	615	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
1592	615	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1634	632	Turisme axa fata	180.00	1	BUC	19	2
1658	642	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
1659	642	Înlocuit anvelopa	15.00	4	BUC	27	2
1660	642	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
1664	644	Turisme axa fata	180.00	1	BUC	18	2
1681	651	Înlocuit anvelopa	15.00	4	BUC	24	2
1682	651	Echilibrat jantă oțel	18.00	4	BUC	24	2
1683	651	Coliere	0.50	8	buc	24	2
1693	655	Turisme axa fata	180.00	1	BUC	19	2
1707	663	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
1708	663	Înlocuit anvelopa	26.00	4	BUC	24	2
1709	663	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	24	2
1710	663	Plumb Hofmann	10.00	4	buc	24	2
1738	674	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1739	674	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1740	674	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1745	677	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
1746	677	Înlocuit anvelopa	23.00	4	BUC	24	2
1747	677	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
1749	679	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
1754	682	Înlocuit anvelopa	15.00	4	BUC	22	2
1755	682	Echilibrat jantă oțel	18.00	4	BUC	22	2
1765	688	Înlocuit anvelopa	18.00	4	BUC	22	2
1766	688	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
1767	688	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
1798	699	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
1799	699	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1800	700	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
1801	700	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
1825	708	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	21	2
1826	708	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
1827	708	Plumb Hofmann	10.00	4	buc	21	2
1828	708	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
1829	709	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
1830	709	Echilibrat jantă oțel	18.00	4	BUC	24	2
1833	711	185/65/15 RIKEN SUMMER 3	250.00	4	buc	6	2
1834	712	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
1847	719	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
1848	719	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
1869	727	Turisme axa fata	180.00	1	BUC	18	2
1888	729	Echilibrat janta aliaj turism	0.00	4	BUC	3	2
1889	729	Înlocuit anvelopa	0.00	4	BUC	3	2
1892	721	245/45 R19 MICHELIN PILOT SOIRT 5 XL 102Y	1050.00	2	buc	5	2
2466	898	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
2467	898	Plumb Hofmann	10.00	4	buc	22	2
2468	898	Inlocuit valva senzor	25.00	4	buc	22	2
2476	902	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2477	902	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2498	912	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
1948	748	CILINDRU FRANA  F026002019	150.00	1	buc	6	2
1949	748	MANOPERA	200.00	1	buc	6	2
2499	912	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2515	919	SENZOR UVS 4060	250.00	4	buc	6	2
2516	919	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2536	926	JANTA R1.1347	480.00	2	buc	6	2
2537	926	Înlocuit anvelopa camioneta C	23.00	2	BUC	13	2
2538	926	Executat pana camioneta C	50.00	1	BUC	13	2
2539	926	Inlocuit valva turism tubeless	6.00	2	buc	13	2
2564	933	Înlocuit anvelopa	23.00	4	BUC	24	2
2565	933	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
2566	933	Plumb Hofmann	10.00	4	buc	24	2
2595	942	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2596	942	Înlocuit anvelopa	18.00	4	BUC	21	2
2602	945	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2607	947	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
2608	947	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2609	936	235/65/16C RIKEN CARGO EVO	490.00	4	buc	6	2
2610	936	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
2611	936	Echilibrat janta camioneta C	25.00	4	BUC	12	2
2619	953	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2620	953	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2637	959	Înlocuit roata turism (Permutare)	18.00	4	BUC	28	2
2674	968	245/45/18 RIKEN SUMMER 3	400.00	2	buc	4	2
2675	968	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2676	968	Înlocuit anvelopa	18.00	4	BUC	21	2
2677	968	Îndreptat jantă aliaj	120.00	1	buc	21	2
2686	974	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
2687	974	Echilibrat janta camioneta C	25.00	4	BUC	21	2
2688	974	Inlocuit valva turism tubeless	6.00	4	buc	21	2
2689	970	195/65 R15 HANKOOK VENTUS PRIME 3 K125 91H	320.00	1	buc	5	2
2690	970	Înlocuit anvelopa	15.00	2	BUC	11	2
2691	970	Echilibrat jantă oțel	18.00	2	BUC	11	2
2692	970	Înlocuit roata turism (Permutare)	16.00	2	BUC	11	2
2695	976	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
2696	976	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
2697	976	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
2711	985	Înlocuit anvelopa	18.00	4	BUC	12	2
2712	985	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
2719	977	205/55/16 BRIDGESTONE TURANZA 6	450.00	2	buc	6	2
2720	977	Înlocuit anvelopa	15.00	4	BUC	25	2
2721	977	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
2724	989	Îndreptat jantă aliaj	150.00	1	buc	14	2
2731	993	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
2732	993	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2775	1003	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
2776	1003	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
2794	1006	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
2795	1006	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
2810	1011	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2811	1011	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
2812	1011	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
2818	1013	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2822	1016	245/45/18 MICHELIN PS5	760.00	2	buc	3	2
2823	1016	275/40/18 MICHELIN PS5	1220.00	2	buc	3	2
2832	1020	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
2833	1020	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
2834	1020	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
2845	1022	SET RULMENT ROATA 30147520016	570.00	1	buc	6	2
2855	1028	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
2856	1028	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
2864	1035	Echilibrat janta aliaj turism	26.00	4	BUC	12	2
2871	1033	205/55 R16 KUMHO HS52	280.00	4	buc	5	2
2872	1033	Înlocuit anvelopa	15.00	4	BUC	22	2
2873	1033	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2877	1032	195/65/15 KUMHO ES31	260.00	4	buc	1	2
2878	1032	Înlocuit anvelopa	15.00	4	BUC	27	2
2879	1032	Echilibrat jantă oțel	18.00	4	BUC	27	2
2880	1032	Inlocuit valva turism tubeless	6.00	4	buc	27	2
2881	1039	CAP BARA FDR529	60.00	1	buc	6	2
2882	1039	CAP BARA FDR530	60.00	1	buc	6	2
2883	1039	MANOPERA	150.00	1	buc	1	2
2884	1039	REGLAJ GEOMETRIE	250.00	1	buc	1	2
2892	1038	205/55 R16 KUMHO HS52 91V	280.00	4	buc	5	2
2893	1038	Înlocuit anvelopa	15.00	4	BUC	25	2
2894	1038	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
2904	1043	215/55 R16 RIKEN SUMMER 3 XL 97H	330.00	2	buc	5	2
2905	1043	Înlocuit anvelopa	15.00	2	BUC	11	2
2906	1043	Echilibrat janta aliaj turism	19.00	2	BUC	11	2
2907	1043	Inlocuit valva turism tubeless	6.00	2	buc	16	2
2909	1045	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2910	1046	Autoutilitare axa simpla/dubla	300.00	1	BUC	19	2
2914	1049	Verificare geometrie	120.00	1	buc	19	2
2915	1050	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
2916	1050	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
2928	1055	Verificare geometrie	120.00	1	buc	20	2
3486	1277	AVANS 1000	-1000.00	1	buc	6	2
2503	914	Turisme axa fata	180.00	1	BUC	18	2
2507	916	Echilibrat jantă oțel	18.00	4	BUC	25	2
2550	921	275/45/21 MICHELIN PS4 SUV	1390.00	2	buc	6	2
2551	921	315/40/21 MICHELIN PS4 SUV	1770.00	2	buc	6	2
2552	921	Echilibrat janta Jeep (SUV)	40.00	4	BUC	6	2
2553	921	Înlocuit anvelopa Jeep (SUV)	32.50	4	BUC	6	2
2554	921	FACTURA ACHITATA	-6610.00	1	buc	6	2
2579	937	215/65 R16 RIKEN SUMMER	350.00	4	buc	3	2
2591	940	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
2592	940	Înlocuit anvelopa	15.00	4	BUC	22	2
2593	940	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2612	948	Deblocat suruburi	60.00	1	BUC	29	2
2621	954	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
2622	954	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
2623	954	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
2624	955	Echilibrat roată oțel 22,5 țoli	100.00	2	BUC	15	2
2625	956	Înlocuit anvelopa	18.00	4	BUC	27	2
2626	956	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2641	952	185/65 R15 KUMHO ES31 88T	270.00	4	buc	5	2
2642	952	Înlocuit anvelopa	15.00	4	BUC	21	2
2643	952	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2656	964	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2657	965	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
2658	965	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
2661	963	205/55/16 MICHELIN PRIMACY 5	470.00	2	buc	4	2
2662	963	Înlocuit anvelopa	15.00	4	BUC	12	2
2663	963	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2671	969	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
2672	969	Saci	3.00	4	buc	25	2
2673	969	Plumb Hofmann	10.00	4	buc	25	2
2681	972	Înlocuit anvelopa	18.00	4	BUC	27	2
2682	972	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2693	975	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
2694	975	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
2699	978	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
2700	978	Echilibrat jantă oțel	18.00	4	BUC	23	2
2701	979	Înlocuit anvelopa	15.00	4	BUC	27	2
2702	979	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2703	979	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
2705	981	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
2706	982	Echilibrat janta Jeep (SUV)	30.00	4	BUC	15	2
2722	988	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2723	988	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2737	996	Înlocuit anvelopa	15.00	4	BUC	15	2
2738	996	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
2739	996	Cazare Anvelope 13'' - 16''	120.00	1	BUC	8	2
2761	986	215/60/17 KUMHO PS72	450.00	4	buc	6	2
2762	986	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2763	986	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2777	1001	FILTRU COMB WK5005/1	170.00	1	buc	6	2
2778	1001	FILTRU ULEI HU6014/1Z	60.00	1	buc	6	2
2779	1001	FILTRU POLEN CUK25001	180.00	1	buc	6	2
2780	1001	FILTRU AER C24024	140.00	1	buc	6	2
2781	1001	ULEI BMW 5W30 1L	70.00	5	buc	6	2
2782	1001	DISC FRANA DF4807S	295.00	2	buc	6	2
2783	1001	SET PLACUTE FRANA GDB1942	300.00	1	buc	6	2
2784	1001	SENZOR GIC340	60.00	1	buc	6	2
2785	1001	MANOPERA	600.00	1	buc	6	2
2786	1001	Îndreptat jantă aliaj	140.00	1	buc	29	2
2800	1007	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2801	1007	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
2813	1002	235/50/18 KUMHO PS71	460.00	4	buc	6	2
2814	1002	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2815	1002	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2816	1002	Saci	3.00	4	buc	27	2
2824	1017	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2825	1017	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
2826	1017	Plumb Hofmann	10.00	4	buc	21	2
2852	1026	Înlocuit anvelopa	15.00	4	BUC	27	2
2853	1026	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2857	1029	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
2858	1029	Saci	3.00	4	buc	12	2
2860	1031	Înlocuit roata turism (Permutare)	18.00	4	BUC	27	2
2863	1034	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2885	1037	255/45/19 CONTINENTAL SPORT CONTACT 7 T0	1330.00	4	buc	6	2
2886	1037	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
2887	1037	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2897	1042	Echilibrat janta camioneta C	25.00	4	BUC	21	2
2898	1042	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
2899	1042	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
2913	1048	Verificare geometrie	120.00	1	buc	18	2
2917	1044	245/45/18 MICHELIN PS5	760.00	2	buc	6	2
2918	1044	275/40/18 MICHELIN PS5	1220.00	2	buc	6	2
2919	1044	FACTURAT ANVELOPE	-3960.00	1	buc	6	2
2920	1044	Înlocuit anvelopa	18.00	4	BUC	21	2
2921	1044	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2922	1051	Turisme axa fata	180.00	1	BUC	18	2
2923	1052	Înlocuit anvelopa	15.00	4	BUC	27	2
2924	1052	Echilibrat jantă oțel	18.00	4	BUC	27	2
2925	1053	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2926	1053	Saci	3.00	4	buc	24	2
2929	1056	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2930	1056	Înlocuit anvelopa	18.00	4	BUC	21	2
2933	1058	Înlocuit anvelopa	15.00	4	BUC	24	2
1952	750	Îndreptat jantă aliaj	150.00	3	buc	14	2
1953	751	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
1954	751	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
1955	752	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
1957	754	Înlocuit anvelopa	18.00	4	BUC	24	2
1958	754	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
1959	755	Înlocuit anvelopa	15.00	4	BUC	23	2
1960	755	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2471	900	Înlocuit anvelopa	18.00	4	BUC	27	2
2472	900	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2473	901	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
2474	901	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2475	901	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
1966	757	Înlocuit anvelopa	18.00	4	BUC	21	2
1967	757	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2478	903	Turisme axa fata	180.00	1	BUC	18	2
1969	759	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
1970	759	Înlocuit anvelopa	15.00	4	BUC	27	2
1971	759	Echilibrat jantă oțel	18.00	4	BUC	27	2
2504	915	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
2505	915	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
2506	915	Plumb Hofmann	10.00	4	buc	23	2
2522	922	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
2523	922	Înlocuit anvelopa	15.00	8	BUC	24	2
2524	922	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2555	930	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2556	930	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2557	930	Saci	3.00	4	buc	27	2
4061	1477	315/80/22.5 LING LONG KMA400 ON OFF	1850.00	2	buc	6	2
1986	761	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
1987	761	Înlocuit anvelopa Jeep (SUV)	20.00	2	BUC	22	2
1988	761	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
1989	753	275/35 R19 MICHELIN PILOT SPORT 5 XL 100Y	1280.00	2	buc	5	2
1990	753	Înlocuit anvelopa	23.00	4	BUC	12	2
1991	753	Echilibrat janta aliaj turism	26.00	4	BUC	12	2
1992	753	Cazare Anvelope 19''-21''	150.00	1	BUC	5	2
1993	758	165/70/14 SAILUN ALL SEASON	190.00	4	buc	4	2
1994	758	Înlocuit anvelopa	12.00	4	BUC	12	2
1995	758	Echilibrat jantă oțel	14.00	4	BUC	12	2
1998	762	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
1999	762	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2000	762	Îndreptat jantă aliaj	150.00	1	buc	14	2
2001	760	205/55/16 MICHELIN PRIMACY 5 ENERGY	470.00	4	buc	6	2
2002	760	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2003	760	Înlocuit anvelopa	15.00	4	BUC	21	2
2004	760	Saci	3.00	4	buc	21	2
2005	763	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2006	764	Înlocuit roata turism (Permutare)	25.00	4	BUC	15	2
2008	766	Cazare Roti complete 19''-21''	200.00	1	BUC	22	2
2009	766	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2010	767	225/50 R17 MICHELIN PRIMACY 5	650.00	2	buc	5	2
2012	768	Deblocat suruburi	60.00	1	BUC	6	2
2013	769	Îndreptat jantă aliaj	150.00	1	buc	14	2
2014	769	Sudura janta	150.00	1	buc	16	2
2016	771	Sudura janta	200.00	1	buc	16	2
2017	770	225/75 R16C RIKEN CARGO SPEED EVO 118/116R	490.00	2	buc	5	2
2018	770	Înlocuit anvelopa camioneta C	23.00	2	BUC	10	2
2019	770	Echilibrat janta camioneta C	25.00	2	BUC	10	2
2020	770	Inlocuit valva turism tubeless	6.00	2	buc	10	2
2030	773	225/50 R17 MICHELIN PRIMACY 5	650.00	2	buc	5	2
2031	773	Înlocuit anvelopa	18.00	2	BUC	23	2
2032	773	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2033	773	Saci	3.00	4	buc	23	2
2034	774	Înlocuit anvelopa	15.00	4	BUC	21	2
2035	774	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2036	775	Îndreptat jantă aliaj	180.00	2	buc	14	2
2037	772	265/50/20 MICHELIN PS4 SUV	1400.00	4	buc	4	2
2038	772	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
2039	772	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
2040	776	Înlocuit anvelopa	18.00	4	BUC	27	2
2041	776	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2042	777	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2043	777	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2044	756	215/55/17 ORIUM UHP	330.00	1	buc	6	2
2045	756	AVANS	-200.00	1	buc	6	2
2046	756	Înlocuit anvelopa	18.00	1	BUC	10	2
2047	756	Echilibrat janta aliaj turism	24.00	4	BUC	16	2
2048	778	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
2049	778	Echilibrat jantă oțel	18.00	4	BUC	21	2
2050	779	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2051	779	Cazare Roti complete 19''-21''	200.00	1	BUC	22	2
2052	780	Înlocuit anvelopa	18.00	4	BUC	24	2
2053	780	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2055	782	Înlocuit anvelopa	15.00	4	BUC	15	2
2056	782	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
2057	783	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
2059	785	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2060	785	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
2061	785	Saci	3.00	3	buc	21	2
2062	784	205/55 R17 MICHELIN CROSSCLIMATE 3 XL 95V	700.00	1	buc	5	2
2063	784	Îndreptat jantă aliaj	170.00	1	buc	14	2
2078	787	Echilibrat janta aliaj turism	26.00	2	BUC	15	2
2079	787	Îndreptat jantă aliaj	180.00	2	buc	15	2
2479	904	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2484	907	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
2072	781	205/65/16 MICHELIN PRIMACY 5	800.00	4	buc	3	2
2073	781	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	24	2
2074	781	Echilibrat janta Jeep (SUV)	19.00	4	BUC	24	2
2075	781	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
2076	786	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
2077	786	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
2081	789	Înlocuit anvelopa	23.00	4	BUC	27	2
2082	789	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
2083	790	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2084	790	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2089	788	225/50/17 KUMHO PS72	460.00	4	buc	3	2
2090	788	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2091	788	Înlocuit anvelopa	18.00	4	BUC	21	2
2092	788	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
2097	792	Inlocuit valva senzor	25.00	1	buc	14	2
2098	792	Înlocuit roata camioneta / jeep (Permutare)	25.00	1	BUC	14	2
2099	793	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
2100	793	Înlocuit anvelopa	15.00	4	BUC	27	2
2101	793	Echilibrat jantă oțel	18.00	4	BUC	27	2
2102	794	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
2103	794	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
2104	795	Înlocuit anvelopa	15.00	2	BUC	23	2
2105	795	Echilibrat janta aliaj turism	19.00	2	BUC	23	2
2106	796	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2107	796	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
2111	791	255/40 R19 MICHELIN PILOT SPORT 5 XL 100Y	950.00	2	buc	5	2
2112	791	Echilibrat janta aliaj turism	24.00	3	BUC	12	2
2113	791	Înlocuit anvelopa	18.00	3	BUC	12	2
2114	791	Inlocuit valva turism tubeless	6.00	3	buc	12	2
2115	799	Înlocuit anvelopa	15.00	4	BUC	27	2
2116	799	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2123	801	Îndreptat jantă aliaj	150.00	4	buc	14	2
2124	801	Înlocuit anvelopa	23.00	4	BUC	24	2
2125	801	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
2126	801	Plumb Hofmann	10.00	4	buc	24	2
2127	801	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
2129	797	MICHELIN CROSS  195/70/15C	670.00	2	buc	1	2
2130	797	Înlocuit anvelopa camioneta C	23.00	2	BUC	22	2
2131	797	Echilibrat janta camioneta C	25.00	2	BUC	22	2
2132	800	195/65/15 SAILUN  ATRRZZO 4 S ALL SEASON	240.00	4	buc	6	2
2133	800	Echilibrat jantă oțel	18.00	4	BUC	12	2
2134	800	Înlocuit anvelopa	15.00	4	BUC	12	2
2136	804	Înlocuit anvelopa	15.00	4	BUC	23	2
2137	804	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2138	804	Saci	3.00	2	buc	23	2
2139	798	255/35 R18 RIKEN SUMMER 3 XL 94W	400.00	2	buc	5	2
2140	798	225/40 R18 RIKEN SUMMER 3 XL 92Y	330.00	2	buc	5	2
2141	798	Înlocuit anvelopa	18.00	4	BUC	24	2
2142	798	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2143	798	Sudura janta	180.00	2	buc	24	2
2144	805	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	12	2
2145	805	Echilibrat janta Jeep (SUV)	19.00	4	BUC	12	2
2146	806	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
2147	806	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
2148	806	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
2149	749	FILTRU POLEN   CUK21002	100.00	1	buc	7	2
2150	749	MANOPERA	250.00	1	ora	7	2
2151	749	ULEI TOTAL QUARTZ 0W 30 5L	320.00	1	buc	7	2
2152	749	FILTRU ULEI  HU7033Z	40.00	1	buc	7	2
2153	749	FILTRU AER  9802348680	90.00	1	buc	7	2
2154	749	FILTRU COMBUSTIBIL   F026402533	110.00	1	buc	7	2
2155	807	Aplicat petec TIP TOP NR 2	40.00	1	buc	15	2
2156	808	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2157	808	Saci	3.00	4	buc	21	2
2158	809	Înlocuit anvelopa	15.00	4	BUC	23	2
2159	809	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2160	803	185/65/15  SAILUN ATREZZO 4 S ALL	240.00	4	buc	6	2
2161	803	Înlocuit anvelopa	15.00	4	BUC	15	2
2162	803	Echilibrat jantă oțel	18.00	4	BUC	15	2
2163	810	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
2164	810	Saci	3.00	4	buc	12	2
2169	802	285/35/23 PIRELLI PZERO PZ4 - L	3700.00	2	buc	6	2
2170	802	Înlocuit anvelopa Jeep (SUV)	35.00	2	BUC	24	2
2171	802	Echilibrat Hunter RFE 23"-24" SUV	130.00	2	buc	24	2
2172	802	Plumb Hofmann	10.00	2	buc	24	2
2173	802	Îndreptat jantă aliaj	150.00	1	buc	14	2
2174	811	Înlocuit roata turism (Permutare)	12.00	4	BUC	27	2
2175	812	Înlocuit anvelopa	15.00	3	BUC	23	2
2176	812	Echilibrat janta aliaj turism	19.00	3	BUC	23	2
2177	813	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2178	813	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
2179	813	Saci	3.00	4	buc	21	2
2180	814	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2181	814	Saci	3.00	4	buc	24	2
2182	815	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
2183	815	Saci	3.00	4	buc	12	2
2184	816	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2185	817	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2186	817	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
2187	818	Constatare defectiuni	60.00	1	buc	18	2
2188	819	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2190	820	Înlocuit anvelopa	23.00	2	BUC	21	2
2191	820	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
2192	820	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
2193	821	Înlocuit anvelopa	18.00	4	BUC	23	2
2194	821	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2480	905	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
2196	823	Înlocuit anvelopa	18.00	4	BUC	22	2
2197	823	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2204	826	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
2205	827	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2206	827	Saci	3.00	4	buc	22	2
2207	828	MONTAT  ANV MOTO	25.00	1	buc	21	2
2208	828	ECHILIBRAT MOTO	30.00	1	buc	21	2
2481	905	Echilibrat janta camioneta C	25.00	4	BUC	12	2
2488	910	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
2489	910	Înlocuit roata turism (Permutare)	18.00	4	BUC	22	2
2490	911	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
2491	911	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2492	911	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2500	913	Înlocuit anvelopa	15.00	5	BUC	27	2
2501	913	Echilibrat janta aliaj turism	19.00	5	BUC	27	2
2502	913	MONTAT SCUT PROTECTIE PIESE CLIENT	100.00	1	buc	27	2
2508	917	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
2509	917	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2510	917	Înlocuit anvelopa	18.00	4	BUC	21	2
2542	928	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
2543	928	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2544	928	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2569	931	235/55/19 BARUM BARUM BRAVURIS 6	650.00	4	buc	6	2
2570	931	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2571	931	Înlocuit roata turism (Permutare)	24.00	4	BUC	21	2
2572	931	Inlocuit valva turism tubeless	6.00	4	buc	21	2
2573	931	CURATAT  JANTE  ETANSARE	10.00	4	buc	21	2
2574	935	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
2575	935	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2576	935	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2580	938	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
2581	938	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
2582	938	Echilibrat Hunter RFE 19"-20" SUV	90.00	4	buc	12	2
2588	939	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2589	939	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2590	939	Saci	3.00	4	buc	24	2
2597	943	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
2598	943	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2613	949	Înlocuit roata turism (Permutare)	18.00	4	BUC	24	2
2614	949	Saci	3.00	4	buc	24	2
2615	950	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
2627	941	215/60 R17 MICHELIN PRIMACY 5 96H	670.00	4	buc	5	2
2628	941	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2629	941	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2630	941	Saci	3.00	2	buc	24	2
2631	941	Inlocuit valva turism tubeless	6.00	4	buc	24	2
2632	957	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
2633	957	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2634	957	Aplicat petec TIP TOP NR 2	40.00	1	buc	22	2
2638	960	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
2639	960	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	23	2
2640	960	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
2648	961	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2649	961	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2650	961	Plumb Hofmann	10.00	4	buc	24	2
2651	961	Inlocuit valva turism tubeless	6.00	4	buc	24	2
2664	967	Înlocuit anvelopa	18.00	4	BUC	22	2
2665	967	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2679	971	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
2680	971	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2704	980	Îndreptat jantă aliaj	170.00	2	buc	14	2
2707	983	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2708	983	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2709	983	Saci	3.00	4	buc	21	2
2725	990	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
2726	990	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2729	992	Înlocuit anvelopa	12.00	4	BUC	12	2
2730	992	Echilibrat jantă oțel	14.00	4	BUC	12	2
2791	994	275/35/22 MICHELIN PS4 SUV	1620.00	2	buc	6	2
2792	994	315/30/22 MICHELIN PS4 SUV	1930.00	2	buc	6	2
2793	994	MONTAJ+ECHILIBRAT	300.00	1	buc	1	2
2802	1008	CUSTODIE ANV 2  BUC	40.00	2	buc	21	2
2803	1008	Înlocuit anvelopa	26.00	4	BUC	21	2
2804	1008	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
2805	1008	Plumb Hofmann	10.00	4	buc	21	2
2806	1008	Îndreptat jantă aliaj	150.00	2	buc	21	2
2808	1010	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	23	2
2809	1010	Înlocuit anvelopa	23.00	4	BUC	23	2
2817	1012	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2820	1015	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
2821	1015	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2827	1018	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
2828	1018	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
2835	1021	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
2836	1021	Cazare Roti complete 13'' - 16''	150.00	1	BUC	8	2
2841	1023	Înlocuit anvelopa	15.00	4	BUC	27	2
2198	824	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2199	824	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2200	822	185/60 R15 HANKOOK K125	380.00	4	buc	5	2
2201	822	Înlocuit anvelopa	15.00	4	BUC	27	2
2202	822	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2203	825	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
2209	829	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
2210	829	Înlocuit anvelopa	15.00	4	BUC	27	2
2211	829	Echilibrat jantă oțel	18.00	4	BUC	27	2
2212	830	Verificare geometrie	120.00	1	buc	18	2
2213	831	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
2214	831	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
2215	831	Plumb Hofmann	10.00	4	buc	24	2
2482	906	Înlocuit anvelopa	18.00	4	BUC	22	2
2217	833	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
2218	834	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
2219	834	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2220	835	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2483	906	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2511	918	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
2530	923	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2224	837	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
2225	837	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
2226	838	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
2227	839	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2228	839	Înlocuit anvelopa	15.00	4	BUC	21	2
2229	839	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
2230	840	Înlocuit anvelopa	15.00	4	BUC	24	2
2231	840	Echilibrat jantă oțel	18.00	4	BUC	24	2
2232	840	Inlocuit valva turism tubeless	6.00	4	buc	24	2
2233	841	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
2234	841	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
2235	842	Înlocuit anvelopa	15.00	4	BUC	23	2
2236	842	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2237	842	Saci	3.00	4	buc	23	2
2238	843	205/55 R16 KUMHO HS52 91V	280.00	4	buc	5	2
2239	832	245/45/18 MICHELIN PS5	760.00	4	buc	6	2
2240	832	Înlocuit anvelopa	18.00	4	BUC	22	2
2241	832	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2242	832	Inlocuit valva turism tubeless	6.00	4	buc	22	2
2243	832	Saci	3.00	4	buc	22	2
2540	927	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2245	845	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
2246	845	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2247	845	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2248	846	Echilibrat jantă oțel	18.00	4	BUC	27	2
2249	847	225/45 R17 SAILUN ATR ELITE 2	250.00	4	buc	3	2
2250	848	Îndreptat jantă aliaj	180.00	2	buc	14	2
2251	849	Echilibrat roată aliaj 22,5 țoli	120.00	1	BUC	15	2
2252	849	Executat pană 22,5 toli radial 115	130.00	1	BUC	15	2
2253	850	Înlocuit anvelopa	18.00	4	BUC	22	2
2254	850	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2255	850	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
2256	851	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2257	851	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2258	851	Inlocuit valva turism tubeless	6.00	4	buc	23	2
2259	852	Echilibrat jantă oțel	18.00	4	BUC	27	2
2260	852	Înlocuit anvelopa	15.00	4	BUC	27	2
2541	927	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2263	853	Înlocuit anvelopa	18.00	4	BUC	24	2
2264	853	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2265	853	Saci	3.00	4	buc	24	2
2266	854	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
2267	855	Îndreptat jantă aliaj	150.00	1	buc	14	2
2547	929	Înlocuit anvelopa	18.00	4	BUC	24	2
2548	929	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
2271	858	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2272	858	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
2273	859	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	15	2
2274	859	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
2289	860	Înlocuit anvelopa	26.00	2	BUC	21	2
2290	860	Echilibrat janta aliaj turism	32.00	2	BUC	21	2
2292	856	ALTERNATOR 30588	900.00	1	buc	6	2
2293	856	MNAOPERA	250.00	1	buc	6	2
2294	765	DE AS	150.00	4	buc	6	2
2295	765	DS A	300.00	3	buc	3	2
2296	765	Turisme / suv 19"-24" inch	300.00	1	BUC	6	2
2297	765	225	100.00	4	buc	6	2
2298	765	Aplicat petec TIP TOP NR 2	40.00	1	buc	6	2
2299	765	Inlocuit valva cameră	40.00	1	buc	6	2
2300	765	Îndreptat jantă aliaj	150.00	1	buc	6	2
2301	862	205/55 R16 KUMHO HS52 91V	280.00	4	buc	5	2
2302	862	Cazare Roti complete 13'' - 16''	150.00	1	BUC	12	2
2303	862	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2304	862	Înlocuit anvelopa	15.00	4	BUC	12	2
2305	863	Turisme axa fata	180.00	1	BUC	18	2
2306	864	Turisme / suv 19"-24" inch	300.00	1	BUC	6	2
2549	929	Sudura janta	180.00	2	buc	16	2
2560	932	Cazare Roti complete 19''-21''	200.00	1	BUC	22	2
2561	932	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
2583	934	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
2584	934	Echilibrat janta aliaj turism	24.00	5	BUC	27	2
2314	865	Înlocuit anvelopa	18.00	4	BUC	23	2
2315	865	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2316	865	Plumb Hofmann	10.00	4	buc	23	2
2485	908	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
2486	908	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
2493	899	205/60 R16 RIKEN SUMMER 3	330.00	4	buc	5	2
2291	861	Echilibrat Hunter RFE 19"-20" Turisme	80.00	1	buc	24	2
2317	866	Înlocuit roata turism (Permutare)	18.00	4	BUC	12	2
2318	867	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
2319	868	Înlocuit anvelopa	18.00	4	BUC	27	2
2320	868	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2321	844	235/50/19 MICHELIN CROSS CLIMATE 2 SUV	980.00	4	buc	6	2
2322	844	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
2323	844	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
2324	844	Inlocuit valva turism tubeless	6.00	4	buc	22	2
2325	869	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2494	899	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	25	2
2495	899	Echilibrat Hunter RFE 17"-18" SUV	80.00	4	buc	25	2
2496	899	Inlocuit valva turism tubeless	6.00	4	buc	25	2
2497	899	Saci	3.00	4	buc	25	2
4062	1477	Înlocuit anvelopă 20 , 22.5 țoli	80.00	2	BUC	8	2
2334	870	Înlocuit anvelopa	18.00	2	BUC	14	2
2335	870	Echilibrat janta aliaj turism	24.00	2	BUC	14	2
2336	870	Sudura janta	120.00	1	buc	16	2
2337	870	245/40/18 RIKEN UHP	380.00	2	buc	6	2
2339	873	SET DISTANTIERI 5X112 X18	375.00	4	buc	6	2
2340	874	Înlocuit anvelopa	15.00	4	BUC	22	2
2341	874	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2342	874	Presiune roata AZOT turism	5.00	4	buc	22	2
2343	875	Înlocuit anvelopa	15.00	4	BUC	22	2
2344	875	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2345	875	Presiune roata AZOT turism	5.00	4	buc	22	2
2346	875	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
2347	876	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
2348	876	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2349	876	Efectuat pana tubeless (cu snur)	40.00	1	BUC	27	2
2350	877	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
2351	877	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
2352	877	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2360	878	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2361	878	Înlocuit anvelopa	15.00	4	BUC	21	2
2362	878	Inlocuit valva turism tubeless	6.00	4	buc	21	2
2363	878	Saci	3.00	4	buc	21	2
2364	857	245/45/18 MICHELIN PILOT SPORT 5 XL 100Y	760.00	4	buc	5	2
2365	857	Înlocuit anvelopa	18.00	4	BUC	15	2
2366	857	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
2368	879	Turisme axa fata	180.00	1	BUC	18	2
2369	747	FILTRU ULEI   W7043	60.00	1	buc	7	2
2370	747	FILTRU AER C16134/2	60.00	1	buc	7	2
2371	747	FILTRU POLEN CUK25007	80.00	1	buc	7	2
2372	747	FILTRU COMBUSTIBIL PU7011Z	100.00	1	buc	7	2
2373	747	ULEI FORD 5W30 5L	235.00	1	buc	7	2
2374	747	ULEI FORD 5W30 1L	50.00	1	buc	7	2
2375	747	MANOPERA	250.00	1	ora	7	2
2379	882	Înlocuit anvelopa	15.00	4	BUC	24	2
2380	882	Echilibrat jantă oțel	18.00	4	BUC	24	2
2381	883	Înlocuit anvelopa	18.00	4	BUC	22	2
2382	883	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2383	884	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2384	885	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	27	2
2385	885	Echilibrat janta Jeep (SUV)	19.00	4	BUC	27	2
2386	885	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
2392	871	165/70 R14 RIKEN ROAD XL 81T	220.00	4	buc	5	2
2393	871	Înlocuit anvelopa	12.00	4	BUC	23	2
2394	871	Echilibrat jantă oțel	14.00	4	BUC	23	2
2395	871	Inlocuit valva turism tubeless	6.00	4	buc	23	2
2396	886	235/65/16C MICHELIN CROSS CLIMATE	1070.00	2	buc	6	2
2397	886	Înlocuit anvelopa camioneta C	23.00	2	BUC	25	2
2398	886	Echilibrat janta camioneta C	25.00	2	BUC	25	2
2399	872	205/60 R16 BRIDGESTONE RURANZA 6	450.00	2	buc	5	2
2400	872	Înlocuit anvelopa	15.00	4	BUC	13	2
2401	872	Echilibrat janta aliaj turism	19.00	4	BUC	13	2
2402	872	Inlocuit valva turism tubeless	6.00	4	buc	13	2
2405	881	205/55/16 MICHELIN PRIMACY ENERGY	470.00	4	buc	6	2
2406	881	Înlocuit anvelopa	15.00	4	BUC	25	2
2407	881	Echilibrat jantă oțel	18.00	4	BUC	25	2
2408	888	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
2409	888	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
2413	836	195/75 R16C RIKEN ALL SEASONS	460.00	2	buc	5	2
2414	836	Înlocuit anvelopa camioneta C	23.00	6	BUC	6	2
2415	836	Echilibrat janta camioneta C	25.00	2	BUC	6	2
2416	889	Înlocuit anvelopa	18.00	4	BUC	23	2
2417	889	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
2422	891	Înlocuit anvelopa	18.00	4	BUC	22	2
2423	891	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2424	892	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
2425	892	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2426	892	Echilibrat Hunter RFE 17"-18" SUV	80.00	4	buc	21	2
2435	893	Înlocuit anvelopa	26.00	4	BUC	15	2
2436	893	Echilibrat janta aliaj turism	32.00	4	BUC	15	2
2437	893	Cazare Anvelope 19''-21''	150.00	1	BUC	6	2
2444	890	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
2445	890	Înlocuit anvelopa	15.00	4	BUC	27	2
2446	890	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2447	890	PREZOZNE M14 X 1,25	25.00	4	buc	27	2
2487	909	Turisme axa fata	180.00	1	BUC	18	2
2443	894	PREZON BM -----	25.00	4	buc	6	2
2448	880	245/70 R16 KUMHO AT52 XL 111T	570.00	4	buc	5	2
2449	880	AVANS	-500.00	1	buc	5	2
2450	880	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	12	2
2451	880	Echilibrat janta Jeep (SUV)	19.00	4	BUC	12	2
2452	880	Inlocuit valva turism tubeless	6.00	4	buc	12	2
2513	920	Înlocuit anvelopa	15.00	4	BUC	24	2
2514	920	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2531	924	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2532	924	Înlocuit anvelopa	15.00	4	BUC	21	2
2533	924	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
2534	925	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4063	1477	Valva roata 22	30.00	1	BUC	8	2
2585	934	SPALAT EXTERIOR	30.00	1	buc	3	2
2603	944	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
2604	944	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
2605	944	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
2606	946	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
2617	951	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
2635	958	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
2636	958	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2652	962	Înlocuit anvelopa	23.00	4	BUC	27	2
2653	962	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
2654	962	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
2667	966	275/35/19 PIRELLI PZ4 *	1300.00	2	buc	6	2
2668	966	FACTURAT ANVELOPELE	-2600.00	1	buc	6	2
2669	966	Înlocuit anvelopa	23.00	4	BUC	27	2
2670	966	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
2683	973	Înlocuit anvelopa	15.00	4	BUC	15	2
2684	973	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
2685	973	Cazare Anvelope 13'' - 16''	120.00	1	BUC	8	2
2710	984	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
2716	987	SENZORI	250.00	4	buc	21	2
2717	987	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2718	987	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
2727	991	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
2728	991	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
2740	997	Înlocuit anvelopa	15.00	4	BUC	27	2
2741	997	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2742	998	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2743	999	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
2744	999	Echilibrat Hunter RFE 19"-20" SUV	90.00	4	buc	25	2
2745	999	Plumb Hofmann	10.00	4	buc	25	2
2746	1000	Înlocuit anvelopa	15.00	4	BUC	12	2
2747	1000	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2787	1004	Înlocuit anvelopă 20 , 22.5 țoli	100.00	2	BUC	15	2
2788	1004	Executat pană 22,5 toli radial 110	120.00	1	BUC	15	2
2789	1005	Cazare Roti complete 13'' - 16''	150.00	1	BUC	25	2
2790	1005	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
2796	995	195/65/15 MICHELIN PRIMACY 5	430.00	2	buc	6	2
2797	995	Înlocuit anvelopa	15.00	2	BUC	11	2
2798	995	Echilibrat jantă oțel	18.00	2	BUC	11	2
2799	995	Inlocuit valva turism tubeless	6.00	2	buc	11	2
2807	1009	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
2819	1014	Echilibrat janta aliaj turism	26.00	4	BUC	25	2
2829	1019	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
2830	1019	Înlocuit anvelopa	15.00	4	BUC	22	2
2831	1019	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
2842	1023	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2843	1023	Inlocuit valva turism tubeless	6.00	4	buc	27	2
2846	1024	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2854	1027	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2859	1030	Constatare defectiuni	60.00	1	buc	17	2
2865	1036	PIVOT 401611363R	180.00	1	buc	6	2
2866	1036	PIVOT 401606563R	180.00	1	buc	6	2
2867	1036	MANOPERA	400.00	1	buc	6	2
2868	1036	Autoutilitare axa simpla/dubla	300.00	1	BUC	6	2
2876	1040	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
2888	1025	Înlocuit anvelopa Jeep (SUV)	35.00	4	BUC	21	2
2889	1025	Echilibrat Hunter RFE 23"-24" SUV	130.00	4	buc	21	2
2890	1025	Plumb Hofmann	10.00	4	buc	21	2
2891	1025	Cazare Roti complete 22''-24''	250.00	1	BUC	21	2
2895	1041	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2896	1041	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2911	1047	Turisme / suv 19"-24" inch	200.00	1	BUC	6	2
2912	1047	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
2927	1054	Verificare geometrie	120.00	1	buc	20	2
2931	1057	Înlocuit anvelopa	15.00	4	BUC	27	2
2932	1057	Echilibrat jantă oțel	18.00	4	BUC	27	2
2934	1058	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
2935	1059	Înlocuit anvelopa	15.00	4	BUC	12	2
2936	1059	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2937	1060	Aplicat petec TIP TOP NR 3	50.00	1	buc	15	2
2938	1061	Înlocuit anvelopa	15.00	4	BUC	21	2
2939	1061	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
2940	1061	Inlocuit valva turism tubeless	6.00	4	buc	21	2
2942	1063	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
2943	1063	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
2944	1064	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
2945	1064	Plumb Hofmann	10.00	4	buc	21	2
2946	1064	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
2947	1065	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
2948	1066	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
2949	1066	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
2964	1071	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
2965	1071	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
4064	1482	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4065	1485	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4066	1485	Înlocuit anvelopa	18.00	4	BUC	21	2
4067	1485	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
4070	1487	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
4071	1487	Înlocuit anvelopa	15.00	4	BUC	23	2
4072	1487	Echilibrat jantă oțel	18.00	4	BUC	23	2
4137	1510	Verificare geometrie	120.00	1	buc	18	2
4208	1538	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4270	1557	Cazare Anvelope 13'' - 16''	120.00	1	BUC	12	2
4271	1557	Înlocuit anvelopa Jeep (SUV)	18.00	3	BUC	12	2
4272	1557	Echilibrat janta Jeep (SUV)	19.00	4	BUC	12	2
4345	1579	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
4346	1579	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
4351	1581	Înlocuit anvelopa	18.00	4	BUC	22	2
4352	1581	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4422	1602	Turisme axa fata	180.00	1	BUC	18	2
4597	1655	215/55 R17 BRIDGESTONE TURANZA 6 XL 98W	620.00	2	buc	5	2
4664	1683	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
4665	1683	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4705	1701	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
4709	1704	Înlocuit anvelopa	15.00	4	BUC	27	2
4710	1704	Echilibrat jantă oțel	18.00	4	BUC	27	2
4711	1704	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
4756	1718	RIKEN ROAD////  185/65/14	250.00	2	buc	1	2
4757	1718	Înlocuit anvelopa	12.00	4	BUC	23	2
4758	1718	Echilibrat janta aliaj turism	17.00	4	BUC	23	2
4768	1724	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
4792	1730	Înlocuit anvelopa	26.00	4	BUC	24	2
4793	1730	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	24	2
4794	1730	Plumb Hofmann	10.00	4	buc	24	2
4795	1730	Îndreptat jantă aliaj	150.00	1	buc	14	2
4796	1732	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	27	2
4797	1732	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
4800	1722	385/65/22.5  MICHELIN MULTI T	3500.00	2	buc	6	2
4801	1722	INLOCUIT+PERMUTAT ANVELOPE	360.00	1	buc	1	2
4837	1746	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4840	1741	205/75 R16C RIKEN ALL SEASON 110/108R	470.00	2	buc	5	2
4841	1741	Înlocuit anvelopa camioneta C	23.00	2	BUC	10	2
4842	1741	Echilibrat janta camioneta C	25.00	2	BUC	10	2
4843	1741	Inlocuit valva turism tubeless	6.00	2	buc	10	2
4846	1750	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	22	2
4847	1750	Plumb Hofmann	10.00	4	buc	22	2
4984	1799	Înlocuit anvelopa camioneta C	23.00	4	BUC	22	2
4985	1799	Echilibrat janta camioneta C	25.00	4	BUC	22	2
5000	1802	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5006	1805	Înlocuit roata turism (Permutare)	16.00	4	BUC	24	2
5007	1806	Înlocuit roata turism (Permutare)	16.00	4	BUC	23	2
5052	1824	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	23	2
5053	1824	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
5117	1836	Înlocuit anvelopa	15.00	4	BUC	21	2
5118	1836	Echilibrat jantă oțel	18.00	4	BUC	21	2
5184	1853	Cazare Anvelope 17''-18'	140.00	1	BUC	15	2
5185	1853	Înlocuit anvelopa	18.00	4	BUC	15	2
5186	1853	Echilibrat janta aliaj turism	24.00	4	BUC	8	2
5188	1855	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
5190	1857	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
5191	1857	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
5242	1873	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
5249	1878	Înlocuit anvelopa	23.00	4	BUC	22	2
5250	1878	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
5256	1872	225/75 R16C RIKEN CARGO SPEED EVO 112/110T	460.00	2	buc	5	2
5257	1872	Echilibrat janta camioneta C	25.00	4	BUC	24	2
5258	1872	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
5285	1889	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
5286	1889	Înlocuit anvelopa	18.00	4	BUC	23	2
5287	1889	Inlocuit valva turism tubeless	6.00	3	buc	23	2
5293	1893	Echilibrat janta camioneta C	25.00	2	BUC	24	2
5294	1893	Înlocuit anvelopa camioneta C	23.00	6	BUC	24	2
5295	1893	PRELUNGITOR	25.00	1	buc	24	2
5323	1906	Înlocuit anvelopa	18.00	4	BUC	15	2
5324	1906	Echilibrat janta aliaj turism	24.00	4	BUC	8	2
5337	1911	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
5338	1911	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
5358	1918	Turisme axa fata	180.00	1	BUC	18	2
5383	1931	Inlocuit valva senzor	25.00	4	buc	24	2
5395	1934	Înlocuit anvelopa camioneta C	23.00	1	BUC	25	2
5396	1934	Echilibrat janta camioneta C	25.00	1	BUC	25	2
5397	1934	Inlocuit valva turism tubeless	6.00	1	buc	25	2
5398	1934	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
5399	1935	Înlocuit roata turism (Permutare)	18.00	4	BUC	27	2
5404	1940	Înlocuit anvelopa	18.00	4	BUC	27	2
5405	1940	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2950	1067	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
2951	1067	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4069	1486	Verificare geometrie	120.00	1	buc	18	2
4073	1488	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
2954	1069	Înlocuit anvelopa	15.00	4	BUC	12	2
2955	1069	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2956	1068	265/45/20 MICHELIN PA5	1700.00	1	buc	6	2
2957	1068	PROFORMA ACHITATA	-1700.00	1	buc	6	2
2958	1068	Echilibrat janta Jeep (SUV)	30.00	1	BUC	21	2
2959	1068	Înlocuit anvelopa Jeep (SUV)	26.00	1	BUC	21	2
2960	1062	SENZOR UVS4060	200.00	3	buc	6	2
2961	1062	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2962	1070	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
2963	1070	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
2966	1072	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
2967	1073	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
2968	1073	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
2969	1074	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
2970	1074	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2971	1075	Înlocuit anvelopa	15.00	2	BUC	27	2
2972	1075	Echilibrat janta aliaj turism	19.00	2	BUC	27	2
2973	1076	245/45/17 KUMHO HA32	600.00	4	buc	6	2
2974	1077	Înlocuit anvelopa	15.00	4	BUC	12	2
2975	1077	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
2976	1078	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
2977	1078	Înlocuit roata turism (Permutare)	24.00	4	BUC	24	2
4074	1488	Cazare Roti complete 17''-18'	160.00	1	BUC	12	2
4138	1511	Înlocuit anvelopa	15.00	4	BUC	27	2
2980	1079	Înlocuit anvelopa	18.00	4	BUC	21	2
2981	1079	Echilibrat Hunter RFE 17"-18" Turisme	70.00	4	buc	21	2
2982	1080	215/65 R16 RIKEN ALL SEASON SUV XL 98H	400.00	2	buc	5	2
2983	1081	Înlocuit anvelopa camioneta C	23.00	4	BUC	25	2
2984	1081	Echilibrat janta camioneta C	25.00	4	BUC	25	2
2985	1082	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	23	2
2986	1082	Echilibrat janta Jeep (SUV)	40.00	4	BUC	23	2
2987	1082	Plumb Hofmann	10.00	4	buc	23	2
4139	1511	Echilibrat jantă oțel	18.00	4	BUC	27	2
2990	1084	Înlocuit anvelopa	18.00	4	BUC	27	2
2991	1084	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
2992	1085	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
2993	1086	COMPRESOR WCP102N	850.00	1	buc	6	2
2994	1087	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
2995	1087	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
2996	1087	Saci	3.00	4	buc	12	2
2997	1088	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
2998	1089	Îndreptat jantă aliaj	120.00	3	buc	21	2
2999	1089	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
3000	1089	Înlocuit anvelopa	23.00	4	BUC	21	2
3001	1090	Înlocuit anvelopa	15.00	4	BUC	22	2
3002	1090	Echilibrat jantă oțel	18.00	4	BUC	22	2
3003	1083	275/35 R20 KUMHO PS72 XL 102Y	900.00	2	buc	5	2
3004	1083	245/40 R20 KUMHO PS72 XL 99Y	800.00	2	buc	5	2
3005	1083	Înlocuit anvelopa	23.00	4	BUC	15	2
3006	1083	Echilibrat janta aliaj turism	26.00	4	BUC	15	2
3007	1083	Îndreptat jantă aliaj	150.00	1	buc	15	2
3008	1091	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
3009	1091	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
3010	1091	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
3011	1092	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3012	1092	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
3013	1093	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3014	1094	Înlocuit anvelopa	18.00	4	BUC	22	2
3015	1094	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3016	1095	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3017	1096	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3018	1097	Înlocuit anvelopa	15.00	4	BUC	23	2
3019	1097	Echilibrat jantă oțel	18.00	4	BUC	23	2
3020	1097	Coliere	0.50	4	buc	23	2
3021	1098	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
3022	1099	Înlocuit roata turism (Permutare)	16.00	4	BUC	22	2
3038	1109	225/45/18 HANKOOK S1 EVO K127	660.00	1	buc	6	2
4209	1537	205/55/16 MICHELIN PRIMACY 5	470.00	4	buc	3	2
4210	1537	Înlocuit anvelopa	15.00	3	BUC	16	2
4211	1537	Echilibrat janta aliaj turism	19.00	3	BUC	10	2
4212	1537	Îndreptat jantă aliaj	160.00	1	buc	14	2
4277	1559	Înlocuit anvelopa	18.00	4	BUC	25	2
4278	1559	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
4350	1580	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4423	1603	Înlocuit roata turism (Permutare)	18.00	4	BUC	22	2
4424	1603	4 PREZOANE 09801F	10.00	4	buc	22	2
4425	1603	SCOS ANTIFURT	50.00	4	buc	22	2
4532	1631	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
4533	1631	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
4534	1631	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
4536	1633	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
4662	1681	235/45 R18 MICHELIN CROSSCLIMATE 2	830.00	2	buc	5	2
4706	1702	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
4707	1702	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
4838	1747	Înlocuit anvelopa	18.00	4	BUC	23	2
4839	1747	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
4924	1778	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	24	2
4925	1778	Echilibrat janta Jeep (SUV)	30.00	2	BUC	24	2
3024	1100	Înlocuit anvelopa	23.00	4	BUC	24	2
3025	1100	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
3026	1101	Înlocuit anvelopa	15.00	4	BUC	27	2
3027	1101	Echilibrat jantă oțel	18.00	4	BUC	27	2
3028	1102	Înlocuit anvelopa camioneta C	23.00	4	BUC	15	2
3029	1102	Echilibrat janta camioneta C	25.00	4	BUC	15	2
3030	1103	Verificare geometrie	120.00	1	buc	18	2
3031	1104	Echilibrat janta aliaj turism	19.00	4	BUC	16	2
3033	1106	Înlocuit anvelopa	15.00	4	BUC	22	2
3034	1106	Echilibrat jantă oțel	18.00	4	BUC	22	2
3035	1107	Înlocuit anvelopa	15.00	4	BUC	23	2
3036	1107	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3037	1108	Înlocuit roata turism (Permutare)	16.00	4	BUC	27	2
3039	1105	235/65 R16C MICHELIN AGILIS 3 121/119R	960.00	2	buc	5	2
3040	1105	Înlocuit anvelopa camioneta C	23.00	2	BUC	12	2
3041	1105	Echilibrat janta camioneta C	25.00	2	BUC	12	2
3043	1111	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3044	1112	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
3045	1112	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3046	1113	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
3047	1114	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3048	1114	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3050	1110	MICHELIN PRIMACY 5//205/55/16	470.00	4	buc	1	2
3051	1110	Înlocuit anvelopa	15.00	4	BUC	23	2
3052	1110	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3053	1116	Echilibrat jantă oțel	14.00	4	BUC	24	2
3054	1116	Coliere	0.50	8	buc	24	2
3055	1117	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
3056	1117	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
3057	1118	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
3058	1118	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3059	1119	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3060	1119	SCOS PREZON RUPT	150.00	1	buc	27	2
3061	1120	Echilibrat janta camioneta C	25.00	4	BUC	22	2
3062	1121	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
3063	1121	Înlocuit roata turism (Permutare)	18.00	4	BUC	27	2
3065	1123	Aplicat petec TIP TOP NR 2	40.00	1	buc	12	2
3066	1123	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
3067	1123	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
3068	1123	Saci	3.00	2	buc	12	2
3070	1125	Înlocuit roata turism (Permutare)	26.00	4	BUC	21	2
3071	1126	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3072	1126	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
3073	1127	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
3074	1127	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
3075	1128	Îndreptat jantă aliaj	120.00	1	buc	21	2
3076	1129	Înlocuit anvelopa	18.00	4	BUC	24	2
3077	1129	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
3078	1130	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3079	1131	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
3080	1131	Înlocuit roata turism (Permutare)	18.00	4	BUC	23	2
3081	1132	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
3082	1132	Îndreptat jantă aliaj	150.00	2	buc	27	2
3083	1133	Înlocuit anvelopa	18.00	4	BUC	12	2
3084	1133	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3085	1134	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
3086	1134	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
3087	1135	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
3088	1135	Înlocuit anvelopa	23.00	4	BUC	21	2
3089	1135	Plumb Hofmann	10.00	4	buc	21	2
3090	1135	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
3091	1136	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	27	2
3092	1136	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
3093	1136	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
3094	1124	235/55 R19 MICHELIN PRIMACY 5 ENERGY XL 105V	830.00	4	buc	5	2
3095	1124	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3096	1124	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3097	1124	Plumb Hofmann	10.00	4	buc	22	2
3098	1124	Saci	3.00	4	buc	22	2
3099	1115	205/60 R16 KUMHO HS51 92H	390.00	2	buc	5	2
3100	1115	Înlocuit anvelopa	15.00	2	BUC	27	2
3101	1115	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3102	1137	Înlocuit anvelopa	15.00	4	BUC	23	2
3103	1137	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3104	1138	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3105	1138	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
3106	1139	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3107	1139	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3108	1122	255/70 R16 GOODYEAR WRANGLER AT ADV 111T	860.00	4	buc	5	2
3109	1122	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	25	2
3110	1122	Echilibrat janta Jeep (SUV)	19.00	4	BUC	25	2
3111	1140	Înlocuit anvelopa	18.00	4	BUC	23	2
3112	1140	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
3113	1141	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	12	2
3114	1141	Echilibrat janta Jeep (SUV)	19.00	4	BUC	12	2
3115	1142	Echilibrat jantă oțel	18.00	4	BUC	21	2
3116	1142	Aplicat petec TIP TOP NR 2	40.00	1	buc	21	2
3117	1142	Înlocuit anvelopa	15.00	1	BUC	21	2
3119	1144	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3120	1145	Înlocuit anvelopa	15.00	4	BUC	22	2
3121	1145	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3144	1151	Înlocuit anvelopa	15.00	4	BUC	22	2
3537	1300	235/55/19	900.00	4	buc	2	2
4075	1484	225/65/16C VIKING TRANSTECH	590.00	4	buc	6	2
3123	1147	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3124	1147	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4076	1484	Înlocuit anvelopa camioneta C	23.00	4	BUC	10	2
4077	1484	Echilibrat janta camioneta C	25.00	4	BUC	16	2
4143	1512	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
4144	1512	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4145	1512	Înlocuit anvelopa	18.00	4	BUC	21	2
4215	1541	Înlocuit roata turism (Permutare)	18.00	4	BUC	27	2
4216	1541	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
4284	1562	Verificare geometrie	120.00	1	buc	18	2
3135	1149	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
3136	1149	Echilibrat janta camioneta C	25.00	4	BUC	24	2
3137	1149	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
3138	1143	235/55 R18 MICHELIN PRIMACY 5 100V	730.00	4	buc	5	2
3139	1143	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
3140	1143	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3141	1143	Saci	3.00	4	buc	27	2
3142	1150	215/45/18 KUMHO HA32	580.00	4	buc	6	2
3143	1150	AVANS 1000	-1000.00	1	buc	6	2
3146	1152	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3147	1152	Înlocuit anvelopa	18.00	4	BUC	21	2
3148	1152	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
4288	1564	Cazare Anvelope 13'' - 16''	120.00	1	BUC	12	2
4289	1564	Înlocuit anvelopa	15.00	4	BUC	12	2
4290	1564	Echilibrat jantă oțel	18.00	4	BUC	12	2
4357	1585	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
4358	1585	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
4359	1585	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4361	1587	Cazare Roti complete 19''-21''	200.00	1	BUC	22	2
4362	1587	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
4365	1584	195/65/15 RIKEN ALL  SEASON	280.00	2	buc	6	2
4366	1584	Înlocuit anvelopa	15.00	4	BUC	27	2
4367	1584	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
4426	1604	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
4427	1604	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4436	1605	235/55 R18 MICHELIN PRIMACY 5 100V	730.00	4	buc	5	2
4437	1605	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4438	1605	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4439	1605	Saci	3.00	4	buc	24	2
4440	1605	Inlocuit valva turism tubeless	6.00	4	buc	24	2
4447	1607	205/65 R17.5 LINGLONG LT20	700.00	4	buc	5	2
4448	1607	Înlocuit anvelopa 17,5 țoli	50.00	2	BUC	15	2
4449	1607	Înlocuit anvelopa 17,5 țoli	50.00	2	BUC	8	2
4450	1607	PIULITA 07663F	20.00	1	buc	5	2
4535	1632	Echilibrat jantă oțel	14.00	4	BUC	25	2
4602	1658	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4666	1684	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4671	1686	225/40 R19 CONTINENTAL SPORT CONTACT 7 93Y	940.00	2	buc	5	2
4672	1686	AVANS ANVELOPE	-1880.00	1	buc	5	2
4676	1688	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
4677	1688	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4712	1705	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
4713	1705	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
4714	1705	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4715	1706	Cazare Anvelope 22''-24''	180.00	1	BUC	24	2
4716	1706	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
4717	1706	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
4722	1703	315/70/22.5 CONTINENTAL  PROS S+	3300.00	1	buc	6	2
4723	1703	Înlocuit anvelopă 20 , 22.5 țoli	100.00	2	BUC	15	2
4769	1725	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4836	1745	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
4856	1752	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4857	1752	Înlocuit anvelopa camioneta C	23.00	5	BUC	21	2
4858	1752	Inlocuit valva turism tubeless	6.00	1	buc	21	2
4928	1775	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4929	1775	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
4930	1775	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
4933	1781	Înlocuit anvelopa	23.00	4	BUC	27	2
4934	1781	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
4996	1801	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
4997	1801	Înlocuit anvelopa	23.00	4	BUC	21	2
4998	1801	Plumb Hofmann	10.00	4	buc	21	2
4999	1801	Saci	3.00	4	buc	21	2
5054	1825	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
5055	1825	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5123	1831	235/50/18 HANKOOK VENTUS PRIME 4	600.00	4	buc	6	2
5124	1831	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
5125	1831	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
5192	1858	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
5193	1858	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
5214	1865	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
5215	1865	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
5262	1881	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
5263	1881	Cazare Roti complete 17''-18'	160.00	1	BUC	25	2
5288	1890	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
5289	1890	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
5325	1907	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
5326	1907	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
5366	1920	Înlocuit anvelopa	15.00	4	BUC	22	2
5367	1920	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
5371	1923	Turisme axa fata	180.00	1	BUC	18	2
3145	1151	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3149	1153	Turisme axa fata	180.00	1	BUC	18	2
3150	1154	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
3151	1154	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
3152	1155	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3153	1156	Înlocuit anvelopa	18.00	4	BUC	15	2
3154	1156	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
3155	1157	Înlocuit anvelopa	15.00	4	BUC	27	2
3156	1157	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3157	1158	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
3158	1158	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3159	1159	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
3160	1159	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3161	1159	Înlocuit anvelopa	18.00	4	BUC	21	2
3162	1159	PIULITE  2434886	20.00	4	buc	21	2
3163	1160	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	15	2
3164	1161	Înlocuit anvelopa	15.00	4	BUC	27	2
3165	1161	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3166	1146	SENZOR TPMS UVS4060	250.00	2	BUC	6	2
3167	1146	Înlocuit anvelopa	15.00	4	BUC	25	2
3168	1146	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
3169	1146	Cazare Anvelope 13'' - 16''	120.00	1	BUC	25	2
3170	1162	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3171	1163	Înlocuit anvelopa	15.00	1	BUC	15	2
3172	1163	Echilibrat jantă oțel	18.00	1	BUC	15	2
3173	1164	Echilibrat janta camioneta C	25.00	2	BUC	24	2
3174	1164	Înlocuit anvelopa camioneta C	23.00	2	BUC	24	2
3175	1165	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3176	1165	Înlocuit anvelopa	15.00	4	BUC	23	2
3177	1166	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
3178	1166	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3179	1166	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3180	1167	ANV SH 205 55 16	100.00	2	buc	21	2
3181	1167	Înlocuit anvelopa	15.00	2	BUC	21	2
3182	1167	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3185	1169	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
3186	1148	FILTRU ULEI HU6020Z	80.00	1	buc	6	2
3187	1148	FILTRU AER C45004	200.00	1	buc	6	2
3188	1148	FILTRU POLEN FP26023	190.00	1	buc	6	2
3189	1148	ULEI MERCEDES 5W40 5L	280.00	1	buc	6	2
3190	1148	ULEI MERCEDES 5W40 1L	60.00	1	buc	6	2
3191	1148	MANOPERA	250.00	1	buc	6	2
3192	1170	Înlocuit anvelopa	18.00	4	BUC	27	2
3193	1170	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3194	1171	Cazare Roti complete 17''-18'	160.00	1	BUC	15	2
3195	1171	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
3203	1173	Înlocuit roata turism (Permutare)	16.00	4	BUC	28	2
3204	1174	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
3205	1174	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3206	1175	Echilibrat janta camioneta C	25.00	4	BUC	24	2
3207	1175	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
3208	1176	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3209	1176	Înlocuit anvelopa	15.00	4	BUC	21	2
3210	1176	Inlocuit valva senzor	25.00	4	buc	21	2
3211	1177	Echilibrat janta aliaj turism	19.00	2	BUC	27	2
3212	1177	Înlocuit roata turism (Permutare)	16.00	2	BUC	27	2
3218	1168	315/40 R21 MICHELIN PS4 SUV MO	1770.00	2	buc	3	2
3219	1168	275/45 R21 MICHELIN PS4 SUV MO	1390.00	2	buc	3	2
3220	1168	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	23	2
3221	1168	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	23	2
3222	1168	Saci	3.00	4	buc	23	2
3223	1178	Înlocuit anvelopa	23.00	2	BUC	22	2
3224	1178	Echilibrat janta aliaj turism	26.00	2	BUC	22	2
3225	1178	Plumb Hofmann	10.00	2	buc	22	2
3226	1179	Turisme axa fata	180.00	1	BUC	18	2
3227	1180	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	15	2
3228	1180	Echilibrat janta Jeep (SUV)	19.00	4	BUC	15	2
3229	1181	Înlocuit anvelopa	15.00	4	BUC	21	2
3230	1181	Echilibrat jantă oțel	18.00	4	BUC	21	2
3231	1182	Înlocuit anvelopa	23.00	4	BUC	27	2
3232	1182	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
3233	1183	Echilibrat janta camioneta C	25.00	4	BUC	24	2
3234	1183	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
3235	1184	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
3236	1184	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
3237	1185	Turisme axa fata	180.00	1	BUC	18	2
3238	1172	FILTRU AER C27107	70.00	1	buc	6	2
3239	1172	FILTRU COMBUSTIBIL PU9001/1X	140.00	1	buc	6	2
3240	1172	FILTRU POLEN CU2442	60.00	1	buc	6	2
3241	1172	ULEI GM 5W30 5L	200.00	1	buc	6	2
3242	1172	ULEI GM 5W30 1L	40.00	1	buc	6	2
3243	1172	MANOPERA	250.00	1	buc	6	2
3244	1172	FILTRU ULEI JFOECO104	40.00	1	buc	6	2
3245	1186	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3246	1186	Înlocuit anvelopa	18.00	4	BUC	27	2
3247	1187	Verificare geometrie	120.00	1	buc	18	2
3248	1188	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
3249	1188	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3250	1189	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
3251	1189	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3252	1190	Înlocuit roata turism (Permutare)	18.00	4	BUC	21	2
3253	1191	Înlocuit anvelopa	15.00	4	BUC	27	2
3254	1191	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3255	1192	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3256	1193	Constatare defectiuni	60.00	1	buc	18	2
3257	1194	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
3258	1194	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
3259	1195	275/35/19 SAILUN ATREZZO ZER2 XL 100Y	490.00	2	buc	5	2
3262	1198	Înlocuit anvelopa	18.00	4	BUC	21	2
3263	1198	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3264	1198	ANV SH 225 50 17	100.00	4	buc	21	2
3265	1199	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3266	1200	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3267	1200	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3268	1201	Turisme axa fata	180.00	1	BUC	18	2
4083	1490	Înlocuit anvelopa camioneta C	23.00	4	BUC	22	2
3273	1204	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3274	1204	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
3279	1206	Înlocuit anvelopa	15.00	4	BUC	22	2
3280	1206	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4084	1490	Echilibrat janta camioneta C	25.00	4	BUC	22	2
4097	1497	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
4098	1497	Înlocuit anvelopa	15.00	4	BUC	21	2
4099	1497	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
4147	1514	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
4154	1518	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	25	2
4160	1520	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
4161	1520	Saci	3.00	4	buc	24	2
4217	1542	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4218	1542	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4285	1563	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4286	1563	Înlocuit anvelopa	18.00	4	BUC	21	2
4287	1563	Saci	3.00	4	buc	21	2
4291	1565	Înlocuit anvelopa	26.00	4	BUC	27	2
4292	1565	Echilibrat janta aliaj turism	32.00	4	BUC	27	2
4293	1565	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
4294	1565	Îndreptat jantă aliaj	150.00	2	buc	27	2
4295	1565	Sudura janta	180.00	1	buc	27	2
4360	1586	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4537	1634	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4538	1634	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4539	1634	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
4562	1640	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	23	2
4563	1640	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
4564	1640	Saci	3.00	4	buc	23	2
4606	1654	275/35 R20 PIRELLI P-ZERO PZ4 RFT *	1350.00	2	buc	5	2
4607	1654	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	27	2
4608	1654	Echilibrat janta Jeep (SUV)	30.00	2	BUC	27	2
4667	1685	Turisme axa fata	180.00	1	BUC	18	2
4718	1707	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
4719	1707	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4720	1708	Înlocuit anvelopa	15.00	4	BUC	27	2
4721	1708	Echilibrat jantă oțel	18.00	4	BUC	27	2
4724	1709	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4725	1709	Înlocuit anvelopa	18.00	4	BUC	21	2
4775	1729	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
4776	1729	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4844	1748	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4859	1753	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4861	1754	225/75 R16C MICHELIN AGILIS CROSSCLIMATE	1240.00	2	buc	5	2
4862	1754	Înlocuit anvelopa camioneta C	23.00	2	BUC	25	2
4863	1754	Echilibrat janta camioneta C	25.00	2	BUC	25	2
4864	1754	Inlocuit valva turism tubeless	6.00	2	buc	25	2
4931	1779	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4938	1776	MATADOR MPS400//195/75/16C	480.00	2	buc	1	2
4939	1776	Înlocuit anvelopa camioneta C	23.00	2	BUC	13	2
4940	1776	Echilibrat janta camioneta C	25.00	2	BUC	13	2
4941	1776	Inlocuit valva turism tubeless	6.00	2	buc	13	2
5008	1807	Turisme axa fata	180.00	1	BUC	18	2
5129	1832	215/60/17 RIKEN SUMMER 3	450.00	4	buc	6	2
5130	1832	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
5131	1832	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5132	1839	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
5133	1839	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
5153	1848	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
5194	1859	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5245	1876	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5292	1892	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5308	1900	Înlocuit anvelopa	23.00	4	BUC	21	2
5309	1900	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
5310	1900	Plumb Hofmann	10.00	4	buc	21	2
5312	1902	Înlocuit anvelopa	15.00	4	BUC	21	2
5313	1902	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
5327	1908	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5330	1910	Constatare defectiuni	60.00	1	buc	17	2
5340	1913	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
5341	1913	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
5372	1924	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
5373	1924	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
5386	1933	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
5387	1933	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
5400	1936	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
5401	1937	Înlocuit roata turism (Permutare)	18.00	4	BUC	23	2
5406	1941	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5409	1942	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
5428	1946	Efectuat pană tubeless (cu șnur)	25.00	1	BUC	23	2
3269	1202	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
3270	1202	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3271	1202	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
3275	1205	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
3276	1205	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
3277	1205	Înlocuit anvelopa	23.00	1	BUC	21	2
3278	1205	Îndreptat jantă aliaj	150.00	1	buc	21	2
3281	1207	Înlocuit roata turism (Permutare)	16.00	2	BUC	27	2
3282	1207	Înlocuit anvelopa	15.00	2	BUC	27	2
3283	1207	Echilibrat jantă oțel	18.00	2	BUC	27	2
3284	1208	Înlocuit anvelopa	18.00	4	BUC	12	2
3285	1208	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3286	1209	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3287	1209	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
3289	1211	Înlocuit anvelopa	15.00	4	BUC	24	2
3290	1211	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3291	1212	Înlocuit anvelopa	15.00	4	BUC	22	2
3292	1212	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3293	1213	Înlocuit anvelopa	15.00	4	BUC	27	2
3294	1213	Echilibrat jantă oțel	18.00	4	BUC	27	2
3295	1213	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3299	1215	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
3300	1215	Înlocuit anvelopa	18.00	4	BUC	23	2
3301	1216	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
3302	1216	Înlocuit anvelopa	15.00	4	BUC	22	2
3303	1216	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3304	1210	245/45/18 MICHELIN PRIMACY 3 RFT	870.00	2	buc	6	2
3305	1210	Înlocuit anvelopa	18.00	2	BUC	11	2
3306	1210	Echilibrat janta aliaj turism	24.00	4	BUC	11	2
3307	1210	Cazare Roti complete 17''-18'	160.00	1	BUC	11	2
3308	1197	205/65 R16C MATADOR MPS400 107/105T	530.00	2	buc	5	2
3309	1197	Înlocuit anvelopa camioneta C	23.00	2	BUC	15	2
3310	1197	Echilibrat janta camioneta C	25.00	2	BUC	15	2
3311	1197	Inlocuit valva turism tubeless	6.00	2	buc	15	2
3313	1203	205/55 R16 RIKEN SUMMER 3 91V	260.00	4	buc	5	2
3314	1203	Înlocuit anvelopa	15.00	4	BUC	27	2
3315	1203	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3316	1218	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3317	1218	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	21	2
3318	1218	Cazare Anvelope 22''-24''	180.00	1	BUC	21	2
3319	1196	225/40 R18 MICHELIN PILOT SPORT 5 XL 92Y	580.00	4	buc	5	2
3320	1196	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3321	1196	Înlocuit anvelopa	18.00	4	BUC	21	2
3322	1196	Inlocuit valva senzor	25.00	4	buc	21	2
3323	1196	Îndreptat jantă aliaj	120.00	1	buc	21	2
3324	1219	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
3325	1220	Înlocuit anvelopa	12.00	4	BUC	27	2
3326	1220	Echilibrat jantă oțel	14.00	4	BUC	27	2
3327	1220	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3328	1221	Înlocuit anvelopa	15.00	4	BUC	27	2
3329	1221	Echilibrat jantă oțel	18.00	4	BUC	27	2
3330	1222	Echilibrat janta camioneta C	25.00	2	BUC	23	2
3331	1222	Înlocuit anvelopa camioneta C	23.00	2	BUC	23	2
3332	1223	Înlocuit anvelopa	15.00	4	BUC	15	2
3333	1223	Echilibrat jantă oțel	18.00	4	BUC	15	2
3334	1224	Turisme axa fata	180.00	1	BUC	18	2
3337	1225	Înlocuit anvelopa	18.00	4	BUC	22	2
3338	1225	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3339	1225	Plumb Hofmann	10.00	4	buc	22	2
3341	1226	225/50/18 KUMHO HS52	600.00	4	buc	6	2
3342	1226	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
3343	1226	Echilibrat Hunter RFE 17"-18" Turisme	70.00	4	buc	21	2
3344	1226	Înlocuit anvelopa	18.00	4	BUC	21	2
3345	1227	Verificare geometrie	120.00	1	buc	18	2
3346	1228	Înlocuit anvelopa	15.00	4	BUC	27	2
3347	1228	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3348	1228	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3349	1229	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
3350	1229	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3351	1214	MSW 85 6X15 4X100 ET35 TOYOTA YARIS	550.00	4	buc	6	2
3352	1214	175/65/15 HANKOOK K435	360.00	4	buc	6	2
3353	1214	AVANS 500	-500.00	1	buc	6	2
3354	1214	Înlocuit anvelopa	15.00	4	BUC	23	2
3355	1214	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3356	1214	Plumb Hofmann	10.00	4	buc	23	2
3357	1214	Inlocuit valva senzor	25.00	4	buc	23	2
3358	1230	Verificare geometrie	120.00	1	buc	18	2
3361	1231	Înlocuit anvelopa	15.00	4	BUC	24	2
3362	1231	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3363	1231	Îndreptat jantă aliaj	120.00	1	buc	14	2
3364	1232	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
3365	1232	Înlocuit anvelopa	15.00	4	BUC	22	2
3366	1232	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3367	1232	Inlocuit valva turism tubeless	6.00	4	buc	22	2
3368	1233	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3369	1217	225/50/18 BRIDGESTONE TURANZA 6	760.00	4	buc	6	2
3370	1217	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
3371	1217	ECHILIBRAT HUNTER	40.00	4	buc	21	2
3372	1234	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
3373	1234	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
3374	1235	Îndreptat jantă aliaj	120.00	1	buc	9	2
3375	1235	Echilibrat janta aliaj turism	19.00	4	BUC	9	2
3376	1235	Înlocuit anvelopa	15.00	4	BUC	9	2
3377	1235	ANV SH 205 60 16	125.00	4	buc	9	2
3378	1236	Înlocuit anvelopa	15.00	4	BUC	27	2
3379	1236	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3380	1236	Inlocuit valva turism tubeless	6.00	4	buc	27	2
4080	1489	Înlocuit anvelopa	23.00	2	BUC	24	2
4081	1489	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
4082	1489	Îndreptat jantă aliaj	130.00	2	buc	14	2
4094	1496	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4095	1496	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4096	1496	Inlocuit valva turism tubeless	6.00	4	buc	24	2
4155	1517	JANTA R11347	480.00	1	buc	5	2
4156	1517	Înlocuit anvelopa camioneta C	23.00	1	BUC	15	2
4157	1517	Echilibrat janta camioneta C	25.00	1	BUC	15	2
4158	1517	Inlocuit valva turism tubeless	6.00	1	buc	15	2
4432	1606	185/65 R15 MICHELIN PRIMACY 4 88T	430.00	4	buc	5	2
4433	1606	Înlocuit anvelopa	15.00	4	BUC	27	2
4434	1606	Echilibrat jantă oțel	18.00	3	BUC	27	2
4451	1611	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4452	1611	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4453	1611	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
4540	1626	FILTRU ULEI HU7046Z	60.00	1	buc	6	2
4541	1626	FILTRU AER C17011	140.00	1	buc	6	2
4542	1626	FILTRU COMB WK6008	150.00	1	buc	6	2
4543	1626	FILTRU POLOEN CUK31003	160.00	1	buc	6	2
4544	1626	ULEI 0W30 5L GS55545M4EUR	270.00	1	buc	6	2
4545	1626	MANOPERA	250.00	1	buc	6	2
4546	1626	ULEI 0W30 1L GS55545M2EUR	70.00	1	buc	3	2
4555	1638	Înlocuit anvelopa	15.00	4	BUC	25	2
4556	1638	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
4557	1638	Cazare Anvelope 13'' - 16''	120.00	1	BUC	25	2
4609	1649	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	4	buc	5	2
4610	1649	Înlocuit anvelopa	15.00	4	BUC	24	2
4611	1649	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
4612	1649	Inlocuit valva turism tubeless	6.00	4	buc	24	2
4616	1661	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4619	1663	Cazare Roti complete 17''-18'	160.00	1	BUC	12	2
4620	1663	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
4623	1665	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4668	1672	235/40/18 MICHELIN PS5	700.00	2	buc	6	2
4669	1672	255/35/18 MICHELIN PS5	950.00	2	buc	6	2
4670	1672	INLOC+ECHILIBRAT+CUSTODIE	812.00	1	buc	1	2
4681	1690	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
4772	1728	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	25	2
4773	1728	Echilibrat janta Jeep (SUV)	40.00	4	BUC	25	2
4774	1728	Cazare Anvelope 19''-21''	150.00	1	BUC	25	2
4865	1755	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4868	1757	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
4869	1757	Înlocuit anvelopa	18.00	4	BUC	21	2
4870	1757	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4871	1758	Turisme axa fata	180.00	1	BUC	18	2
4873	1760	Înlocuit anvelopa	15.00	2	BUC	27	2
4874	1760	Echilibrat jantă oțel	18.00	2	BUC	27	2
4942	1782	Înlocuit roata turism (Permutare)	16.00	4	BUC	27	2
5009	1808	Echilibrat jantă oțel	18.00	4	BUC	27	2
5010	1808	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
5135	1841	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5154	1844	Înlocuit anvelopa	15.00	4	BUC	25	2
5155	1844	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
5156	1844	Presiune roata AZOT turism	5.00	4	buc	25	2
5157	1844	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
5158	1849	Înlocuit anvelopa	15.00	4	BUC	22	2
5159	1849	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
5163	1840	225/45/18 MICHELIN PILOT SPORT 5	790.00	4	buc	6	2
5164	1840	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
5165	1840	Înlocuit anvelopa	18.00	4	BUC	21	2
5166	1840	Inlocuit valva turism tubeless	6.00	4	buc	21	2
5167	1840	Saci	3.00	2	buc	21	2
5195	1860	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
5205	1863	Turisme axa fata	180.00	1	BUC	18	2
5246	1877	Înlocuit anvelopa camioneta C	23.00	4	BUC	15	2
5247	1877	Echilibrat janta camioneta C	25.00	4	BUC	15	2
5248	1877	Cazare Roti complete 13'' - 16''	150.00	1	BUC	8	2
5296	1894	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
5297	1894	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
5328	1909	Înlocuit anvelopa Jeep (SUV)	20.00	2	BUC	22	2
5329	1909	Echilibrat janta Jeep (SUV)	24.00	2	BUC	22	2
5331	1901	195/65/16C RIKEN CSP	260.00	4	buc	6	2
5332	1901	Înlocuit anvelopa camioneta C	23.00	4	BUC	6	2
5333	1901	Echilibrat janta camioneta C	25.00	4	BUC	6	2
5334	1901	FACTURAT ANVELOPE CU SERVICII	-1232.00	1	buc	6	2
5335	1901	INEL CENTRARE	35.00	4	buc	6	2
5336	1901	PREZON 18538F	20.00	20	buc	6	2
5342	1912	235/60 R18 PIRELLI SCORP VERDE ALL	690.00	2	buc	3	2
5343	1912	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
5344	1912	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5345	1914	Echilibrat janta camioneta C	25.00	2	BUC	14	2
5346	1914	Înlocuit roata turism (Permutare)	25.00	2	BUC	14	2
5374	1925	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
5375	1926	Înlocuit anvelopa	15.00	4	BUC	21	2
5376	1926	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3381	1237	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3382	1237	Saci	3.00	4	buc	21	2
3383	1238	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
3384	1238	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	23	2
3385	1239	Înlocuit roata turism (Permutare)	16.00	4	BUC	27	2
3386	1240	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
3387	1240	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3388	1240	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3389	1241	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
3390	1241	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
3391	1241	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3392	1242	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
3393	1243	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3395	1245	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3396	1245	Înlocuit anvelopa	15.00	4	BUC	27	2
3397	1245	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3398	1244	215/45 R18 MICHELIN PILOT SPORT 5 XL 93Y	780.00	1	buc	5	2
3399	1244	Înlocuit anvelopa	18.00	1	BUC	21	2
3400	1244	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
3401	1244	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
3402	1246	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
3403	1246	Echilibrat janta camioneta C	25.00	4	BUC	12	2
3404	1247	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
3405	1248	Turisme axa fata	180.00	1	BUC	19	2
3406	1249	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3407	1249	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	27	2
3408	1249	Echilibrat janta Jeep (SUV)	19.00	4	BUC	27	2
3409	1250	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
3410	1250	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3411	1251	Echilibrat jantă oțel	14.00	4	BUC	21	2
3412	1251	Coliere	0.50	4	buc	21	2
3413	1252	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	15	2
3414	1252	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
3415	1253	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
3416	1253	Saci	3.00	4	buc	12	2
3417	1254	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
3418	1255	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3421	1256	255/35/19 BRID TURANZA 6 MO ENLITEN	1050.00	1	buc	6	2
3422	1256	ANVELOPA FACTURATA	-1050.00	1	buc	6	2
3423	1256	Înlocuit anvelopa	23.00	1	BUC	24	2
3424	1256	Echilibrat janta aliaj turism	26.00	1	BUC	24	2
3425	1257	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
3426	1257	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
3427	1257	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
3429	1259	Înlocuit anvelopa camioneta C	23.00	4	BUC	25	2
3430	1259	Echilibrat janta camioneta C	25.00	4	BUC	25	2
3431	1258	185/65 R15 RIKEN SUMMER 3 XL 92H	250.00	2	buc	5	2
3432	1258	Înlocuit roata turism (Permutare)	16.00	2	BUC	15	2
3433	1258	Înlocuit anvelopa	15.00	2	BUC	15	2
3434	1258	Echilibrat jantă oțel	18.00	2	BUC	15	2
3435	1260	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3436	1261	Înlocuit anvelopa	15.00	4	BUC	24	2
3437	1261	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3438	1261	Verificare presiune AZOT turism/jeep	5.00	4	buc	24	2
3443	1264	Înlocuit anvelopa	23.00	4	BUC	22	2
3444	1264	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	22	2
3445	1264	Îndreptat jantă aliaj	120.00	1	buc	22	2
3446	1265	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3447	1262	205/55 R16 KUMHO HS52 91V	300.00	1	buc	5	2
3448	1262	205/55 R16 KUMHO HS52 91V	280.00	3	buc	5	2
3449	1262	AVANS ANVELOPE	-500.00	1	buc	5	2
3450	1262	Echilibrat jantă oțel	18.00	4	BUC	25	2
3451	1262	Înlocuit anvelopa	15.00	4	BUC	25	2
3452	1262	Saci	3.00	4	buc	25	2
3453	1266	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3454	1267	Verificare geometrie	120.00	1	buc	18	2
3455	1268	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	15	2
3456	1268	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
3458	1270	Cazare Anvelope 22''-24''	180.00	1	BUC	27	2
3459	1270	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	27	2
3460	1270	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
3464	1271	Înlocuit roata turism (Permutare)	24.00	4	BUC	25	2
3465	1271	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
3466	1271	Cazare Anvelope 19''-21''	150.00	1	BUC	25	2
3467	1272	Verificare geometrie	120.00	1	buc	18	2
3468	1273	Înlocuit anvelopa	15.00	4	BUC	27	2
3469	1273	Echilibrat jantă oțel	18.00	4	BUC	27	2
3470	1274	Cazare Anvelope 22''-24''	180.00	1	BUC	22	2
3471	1274	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
3472	1274	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
3473	1274	Plumb Hofmann	10.00	4	buc	22	2
3474	1275	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3475	1263	RIKEN SUMMER3	330.00	4	buc	1	2
3476	1263	Înlocuit anvelopa	15.00	4	BUC	25	2
3477	1263	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
3478	1263	Inlocuit valva turism tubeless	6.00	4	buc	25	2
3481	1269	195/50 R15 RIKEN ROAD PERFORMANCE 82V	250.00	2	buc	5	2
3482	1269	Înlocuit anvelopa	15.00	2	BUC	27	2
3483	1269	Echilibrat janta aliaj turism	19.00	2	BUC	27	2
3484	1269	Inlocuit valva turism tubeless	6.00	2	buc	27	2
3485	1277	245/45/18 MICHELIN PRIMACY 5	830.00	4	buc	6	2
3505	1285	Înlocuit anvelopa	15.00	4	BUC	24	2
3780	1383	Saci	3.00	4	buc	24	2
3487	1278	Înlocuit anvelopa	15.00	4	BUC	24	2
3488	1278	Echilibrat jantă oțel	18.00	4	BUC	24	2
3489	1278	Inlocuit valva turism tubeless	6.00	4	buc	24	2
3499	1280	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
4162	1521	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4171	1519	195/75/16C ROYAL BLACK	350.00	6	buc	6	2
4172	1519	Înlocuit anvelopa camioneta C	23.00	6	BUC	22	2
4173	1519	Echilibrat janta camioneta C	25.00	2	BUC	22	2
4224	1540	245/50 R19 YOKOHAMA ADVAN SPORT V107	890.00	4	buc	5	2
4225	1540	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
4226	1540	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
4227	1540	Saci	3.00	4	buc	25	2
4299	1566	Înlocuit anvelopa	15.00	4	BUC	22	2
4300	1566	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4301	1566	CAPAC PREZON	6.00	1	buc	22	2
4302	1566	Saci	3.00	2	buc	22	2
4306	1568	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4368	1589	Înlocuit anvelopa	18.00	2	BUC	12	2
4369	1589	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
4370	1589	Îndreptat jantă aliaj	120.00	1	buc	12	2
4371	1589	Inlocuit valva turism tubeless	6.00	2	buc	12	2
4372	1590	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
4442	1610	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4443	1610	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4454	1608	215/55 R17 KUMHO HS52	490.00	4	buc	3	2
4455	1608	Înlocuit anvelopa	18.00	4	BUC	12	2
4456	1608	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
4457	1608	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
4552	1636	Verificare geometrie	120.00	1	buc	18	2
4613	1660	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4614	1660	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4615	1660	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
4621	1664	Înlocuit anvelopă 20 , 22.5 țoli	100.00	3	BUC	15	2
4622	1664	Înlocuit anvelopă 20 , 22.5 țoli	100.00	3	BUC	8	2
4625	1666	Cazare Roti complete 17''-18'	160.00	1	BUC	24	2
4626	1666	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4678	1689	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
4679	1689	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
4680	1689	Înlocuit roata turism (Permutare)	24.00	4	BUC	24	2
4780	1731	Înlocuit anvelopa camioneta C	23.00	2	BUC	18	2
4781	1731	Echilibrat janta camioneta C	25.00	2	BUC	18	2
4782	1731	Constatare defectiuni	60.00	1	buc	18	2
4866	1756	Înlocuit anvelopa	18.00	4	BUC	22	2
4867	1756	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4872	1759	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4878	1763	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	12	2
4879	1763	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
4880	1763	Cazare Anvelope 19''-21''	150.00	1	BUC	12	2
4944	1784	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
4945	1784	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4946	1784	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4960	1790	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
5011	1809	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
5012	1809	Înlocuit anvelopa	18.00	2	BUC	21	2
5025	1812	205/55 R16 RIKEN SUMMER 3 91V	260.00	4	buc	5	2
5026	1812	Înlocuit anvelopa	15.00	4	BUC	24	2
5027	1812	Echilibrat jantă oțel	18.00	4	BUC	24	2
5028	1812	Inlocuit valva turism tubeless	6.00	4	buc	24	2
5029	1812	Saci	3.00	4	buc	24	2
5033	1813	275/40/20 MICHELIN PS4 ZP	1180.00	2	buc	4	2
5034	1813	Echilibrat janta Jeep (SUV)	30.00	2	BUC	21	2
5035	1813	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	21	2
5082	1830	Echilibrat janta aliaj turism	26.00	4	BUC	21	2
5083	1830	Înlocuit anvelopa	23.00	4	BUC	21	2
5085	1820	225/45/18 KUMHO PS72	530.00	2	buc	6	2
5086	1820	245/40/18 KUMHO PS72	490.00	2	buc	6	2
5087	1820	FACTURAT	-2040.00	1	buc	6	2
5088	1820	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
5089	1820	Înlocuit anvelopa	18.00	4	BUC	24	2
5090	1820	Plumb Hofmann	10.00	4	buc	24	2
5200	1862	275/50/20 MICHELIN PS4 SUV	1530.00	4	buc	6	2
5201	1862	FACTURATE	-6120.00	1	buc	6	2
5202	1862	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
5203	1862	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
5204	1862	4 PREZOANE A0009904518	50.00	4	buc	22	2
5211	1861	Înlocuit roata turism (Permutare)	16.00	4	BUC	29	2
5212	1861	Cazare Roti complete 13'' - 16''	150.00	1	BUC	29	2
5213	1861	MANOPERA	60.00	1	buc	1	2
5216	1866	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
5217	1866	Aplicat petec TIP TOP NR 2	40.00	1	buc	22	2
5218	1866	Cazare Roti complete 19''-21''	200.00	1	BUC	22	2
5251	1879	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
5300	1896	Turisme axa fata	180.00	1	BUC	18	2
5305	1895	Înlocuit anvelopa	18.00	4	BUC	12	2
5306	1895	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
5307	1895	Verificare geometrie	120.00	1	buc	18	2
5347	1915	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
5348	1915	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
5349	1915	Plumb Hofmann	10.00	4	buc	23	2
5377	1927	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
5407	1942	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	22	2
5408	1942	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
3490	1279	Înlocuit roata turism (Permutare)	24.00	4	BUC	21	2
3491	1279	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
3492	1279	Îndreptat jantă aliaj	150.00	1	buc	21	2
3493	1279	Plumb Hofmann	10.00	4	buc	21	2
3494	1276	235/55/17 CONTI  PREMIUM 6	800.00	4	buc	6	2
3495	1276	ANVELOPE FACTURATEW	-3200.00	1	buc	6	2
3496	1276	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
3497	1276	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
3498	1276	SPALAT EXT	40.00	1	buc	25	2
3500	1281	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
3501	1281	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3502	1282	Echilibrat janta camioneta C	25.00	4	BUC	25	2
3503	1283	Echilibrat janta aliaj turism	32.00	4	BUC	12	2
3504	1284	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
3508	1287	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
3509	1287	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3511	1289	Echilibrat janta aliaj turism	17.00	2	BUC	21	2
3512	1289	Înlocuit anvelopa	12.00	2	BUC	21	2
3513	1286	195/75 R16C MICHELIN AGILIS 3	700.00	2	buc	3	2
3514	1286	Înlocuit anvelopa camioneta C	23.00	2	BUC	12	2
3515	1286	Echilibrat janta camioneta C	25.00	2	BUC	12	2
3520	1291	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
3521	1291	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3522	1291	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3523	1291	VALVA VLTPMS13	60.00	1	buc	22	2
3524	1292	Verificare geometrie	120.00	1	buc	18	2
4086	1492	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
3526	1294	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
3527	1294	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
3528	1294	Cazare Anvelope 17''-18'	140.00	1	BUC	25	2
4087	1492	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
4088	1493	Înlocuit anvelopa	18.00	4	BUC	15	2
4089	1493	Echilibrat janta aliaj turism	24.00	4	BUC	8	2
4090	1494	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
4091	1494	Înlocuit anvelopa	15.00	4	BUC	23	2
4092	1494	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
4163	1522	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
4164	1522	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
4239	1546	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	2	buc	5	2
4240	1546	Înlocuit anvelopa	15.00	2	BUC	25	2
4241	1546	Echilibrat janta aliaj turism	19.00	2	BUC	25	2
4242	1546	Inlocuit valva turism tubeless	6.00	2	buc	25	2
4250	1550	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
4251	1550	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
4307	1569	Înlocuit anvelopa camioneta C	23.00	6	BUC	25	2
4308	1569	Echilibrat janta camioneta C	25.00	6	BUC	25	2
4320	1572	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
4321	1572	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4322	1572	Inlocuit valva senzor	25.00	4	buc	23	2
4323	1572	VALVA TPMS	60.00	1	buc	23	2
4327	1561	255/45 R20 MICHELIN PILOT SPORT 5 XL 105Y	1270.00	4	buc	5	2
4328	1561	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
4329	1561	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
4330	1561	Saci	3.00	2	buc	24	2
4388	1588	205/45 R16 TIGAR SUMMER 3 XL 87W	310.00	4	buc	5	2
4389	1588	AVANS	-1000.00	1	buc	5	2
4390	1588	Înlocuit anvelopa	15.00	4	BUC	27	2
4391	1588	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
4392	1588	Inlocuit valva turism tubeless	6.00	4	buc	27	2
4458	1612	315/60/22.5 DUNLOP SP446	2850.00	4	buc	6	2
4471	1609	245/70/17.5 LING LONG LS20	920.00	2	buc	6	2
4477	1622	Înlocuit anvelopa	15.00	5	BUC	22	2
4478	1622	Echilibrat janta aliaj turism	19.00	5	BUC	22	2
4479	1622	Îndreptat jantă aliaj	150.00	2	buc	22	2
4480	1622	Demontat rezervă (sub mașină) – Turisme	25.00	1	BUC	22	2
4481	1623	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
4482	1623	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4483	1624	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4565	1641	Înlocuit anvelopa	15.00	4	BUC	24	2
4566	1641	Echilibrat jantă oțel	18.00	4	BUC	24	2
4567	1641	Saci	3.00	4	buc	24	2
4580	1648	Cazare Roti complete 19''-21''	200.00	1	BUC	27	2
4581	1648	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
4617	1662	Înlocuit anvelopa	15.00	4	BUC	22	2
4618	1662	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4632	1668	Înlocuit anvelopa	23.00	4	BUC	22	2
4633	1668	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
4634	1668	Saci	3.00	4	buc	22	2
4682	1691	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4694	1695	Înlocuit anvelopa	15.00	2	BUC	25	2
4695	1695	Echilibrat janta aliaj turism	19.00	2	BUC	25	2
4728	1712	SENZOR TPMS UVS4060	250.00	1	BUC	6	2
4798	1733	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
4799	1733	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4971	1793	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	25	2
5013	1810	Cazare Roti complete 13'' - 16''	150.00	1	BUC	12	2
5014	1810	Înlocuit roata turism (Permutare)	16.00	4	BUC	12	2
5021	1815	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
5022	1815	Înlocuit anvelopa	18.00	4	BUC	12	2
5023	1815	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
5024	1815	Îndreptat jantă aliaj	120.00	1	buc	12	2
3506	1285	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
4093	1495	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3510	1288	Constatare defectiuni	60.00	1	buc	18	2
4165	1523	Înlocuit anvelopa	15.00	4	BUC	27	2
4166	1523	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3518	1290	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3519	1290	Aplicat petec TIP TOP NR 2	40.00	1	buc	24	2
3529	1295	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3530	1295	Înlocuit anvelopa	15.00	4	BUC	21	2
3531	1296	Verificare geometrie	120.00	1	buc	18	2
4167	1523	Saci	3.00	2	buc	27	2
3533	1298	Turisme axa fata	180.00	1	BUC	18	2
3534	1299	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
3535	1299	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3536	1299	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3538	1293	225/40/18 KUMHO PS72 92Y	380.00	4	buc	6	2
3539	1293	Înlocuit anvelopa	18.00	4	BUC	12	2
3540	1293	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3541	1293	Îndreptat jantă aliaj	120.00	1	buc	12	2
3542	1293	Saci	3.00	4	buc	12	2
3543	1301	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
3544	1301	Înlocuit roata turism (Permutare)	24.00	4	BUC	24	2
3545	1302	285/40/21 GRIP MAX	800.00	4	buc	2	2
3546	1302	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	2	2
3547	1302	Echilibrat janta Jeep (SUV)	40.00	4	BUC	2	2
3549	1304	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
3550	1304	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
3551	1304	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
3552	1305	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
3553	1305	Înlocuit roata turism (Permutare)	24.00	4	BUC	21	2
3554	1305	Plumb Hofmann	10.00	4	buc	21	2
3560	1309	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
3561	1309	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
3562	1309	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4174	1525	Înlocuit anvelopa camioneta C	23.00	4	BUC	15	2
4175	1525	Echilibrat janta camioneta C	25.00	4	BUC	8	2
4178	1528	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
4179	1528	Înlocuit roata turism (Permutare)	26.00	4	BUC	24	2
4230	1545	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
4231	1545	Înlocuit roata turism (Permutare)	26.00	4	BUC	24	2
4232	1545	Saci	3.00	4	buc	24	2
4393	1591	Turisme axa fata	180.00	1	BUC	18	2
4407	1597	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
4408	1597	Înlocuit anvelopa	15.00	4	BUC	23	2
4409	1597	Inlocuit valva turism tubeless	6.00	4	buc	23	2
4459	1613	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
4465	1615	Turisme axa fata	180.00	1	BUC	18	2
4470	1617	195/65 R15 RIKEN SUMMER 3	240.00	2	buc	3	2
4509	1628	Înlocuit anvelopa	18.00	4	BUC	22	2
4510	1628	Echilibrat jantă oțel	21.00	4	BUC	22	2
4511	1628	Îndreptat jantă aliaj	130.00	1	buc	14	2
4569	1642	Înlocuit roata turism (Permutare)	16.00	4	BUC	29	2
4570	1642	Cazare Roti complete 13'' - 16''	150.00	1	BUC	3	2
4627	1667	Echilibrat janta camioneta C	25.00	4	BUC	23	2
4683	1692	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
4684	1692	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4685	1692	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4729	1713	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
4730	1713	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4731	1714	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4802	1734	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
4882	1765	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
4950	1783	165/70 R14 SAILUN ATREZZO 4 SEASON 81T	190.00	2	buc	5	2
4951	1783	Înlocuit anvelopa	12.00	2	BUC	21	2
4952	1783	Echilibrat jantă oțel	14.00	2	BUC	21	2
4953	1783	Înlocuit roata turism (Permutare)	12.00	2	BUC	21	2
4954	1786	Turisme axa fata	180.00	1	BUC	20	2
4969	1792	Cazare Roti complete 13'' - 16''	150.00	1	BUC	15	2
4970	1792	Înlocuit roata turism (Permutare)	16.00	4	BUC	8	2
5113	1834	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5114	1835	Turisme axa fata	180.00	1	BUC	18	2
5137	1843	185/65/15 MICHELIN PRIMACY 4	430.00	2	buc	6	2
5220	1868	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
5221	1868	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
5222	1868	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
5259	1880	Înlocuit anvelopa camioneta C	23.00	4	BUC	14	2
5260	1880	Echilibrat janta camioneta C	25.00	4	BUC	16	2
5261	1880	Inlocuit valva turism tubeless	6.00	4	buc	16	2
5272	1874	315/70/22.5 DURAVIS R-STEER 002	3080.00	2	buc	6	2
5273	1874	INLOCUIT+ECHILIBRAT+COTURII+EXTENSII	440.00	1	buc	1	2
5280	1886	Echilibrat janta camioneta C	25.00	4	BUC	10	2
5281	1886	Înlocuit anvelopa camioneta C	23.00	4	BUC	10	2
5301	1897	Înlocuit anvelopa	15.00	4	BUC	15	2
5302	1897	Echilibrat jantă oțel	18.00	4	BUC	8	2
5316	1904	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
5364	1919	Înlocuit anvelopa	15.00	4	BUC	14	2
5365	1919	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
5368	1921	Turisme axa fata	180.00	1	BUC	18	2
5378	1928	Îndreptat jantă aliaj	170.00	1	buc	14	2
5384	1932	Înlocuit anvelopa	15.00	4	BUC	22	2
5385	1932	Echilibrat jantă oțel	18.00	4	BUC	22	2
5393	1934	Înlocuit anvelopa Jeep (SUV)	18.00	2	BUC	25	2
5394	1934	Echilibrat janta Jeep (SUV)	19.00	2	BUC	25	2
4100	1491	225/55 R17 MICHELIN PRIMACY 5 XL 101W	700.00	4	buc	5	2
3555	1306	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
4101	1491	Înlocuit anvelopa	18.00	4	BUC	27	2
3557	1297	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3558	1297	Înlocuit anvelopa	15.00	4	BUC	21	2
3559	1308	Turisme axa fata	180.00	1	BUC	18	2
4102	1491	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3564	1310	185/65/15 MICHELIN PRIMACY 4	430.00	4	buc	6	2
3565	1311	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	22	2
3566	1311	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
3567	1311	Coliere	0.50	8	buc	22	2
3568	1311	Saci	3.00	4	buc	22	2
3569	1312	Verificare geometrie	120.00	1	buc	18	2
4103	1491	Saci	3.00	4	buc	27	2
3571	1307	MICHELIN PRIMACY 5 /// 205/55/16	470.00	4	buc	1	2
3572	1307	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3573	1307	Înlocuit anvelopa	15.00	4	BUC	21	2
3574	1307	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
3575	1313	235/65/16C RIKEN CSP EVO	490.00	2	buc	6	2
3576	1313	Înlocuit anvelopa camioneta C	23.00	2	BUC	25	2
3577	1313	Echilibrat janta camioneta C	25.00	2	BUC	25	2
3578	1303	255/40/21 PIRELLI PZERO PZ4 VOL NCS	1400.00	2	buc	6	2
3579	1303	Înlocuit anvelopa	26.00	2	BUC	12	2
3580	1303	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
3581	1303	Plumb Hofmann	10.00	4	buc	12	2
3582	1314	Înlocuit anvelopa	15.00	4	BUC	27	2
3583	1314	Echilibrat jantă oțel	18.00	4	BUC	27	2
3584	1314	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3586	1316	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
3587	1316	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
3588	1316	Plumb Hofmann	10.00	4	buc	24	2
3589	1317	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3590	1318	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
3591	1318	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3592	1318	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3594	1320	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
3595	1321	255/50/19 BRIDGESTONE TURANZA 6	800.00	4	buc	6	2
3596	1322	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
3597	1322	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
3598	1322	Cazare Anvelope 19''-21''	150.00	1	BUC	25	2
3601	1323	Înlocuit anvelopa	15.00	2	BUC	24	2
3602	1323	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3603	1324	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3604	1324	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	21	2
3605	1324	Plumb Hofmann	10.00	4	buc	21	2
3606	1325	Înlocuit anvelopa	15.00	4	BUC	22	2
3607	1325	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3608	1325	Coliere	0.50	8	buc	22	2
3609	1325	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
3610	1326	Turisme axa fata	180.00	1	BUC	18	2
3611	1327	Înlocuit anvelopa	15.00	4	BUC	27	2
3612	1327	Echilibrat jantă oțel	18.00	4	BUC	27	2
3613	1327	Inlocuit valva turism tubeless	6.00	5	buc	27	2
3614	1328	Înlocuit anvelopa 17,5 țoli	50.00	2	BUC	15	2
3615	1328	Echilibrat roata 17.5	60.00	2	BUC	15	2
3617	1330	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3618	1330	Înlocuit anvelopa	15.00	4	BUC	21	2
3622	1331	Echilibrat janta camioneta C	25.00	4	BUC	12	2
3623	1331	Aplicat petec TIP TOP NR 2	40.00	1	buc	12	2
3624	1332	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3625	1332	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3629	1335	Înlocuit anvelopa	12.00	4	BUC	24	2
3630	1335	Echilibrat jantă oțel	14.00	4	BUC	24	2
3631	1333	Înlocuit anvelopa	15.00	4	BUC	27	2
3632	1333	Echilibrat jantă oțel	18.00	4	BUC	27	2
3633	1336	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
3634	1336	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
3636	1337	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
3637	1338	MICHELIN PRIMACY 5///205/55/16	470.00	2	buc	1	2
3638	1315	275/40/21 HANKOOK W330	1220.00	1	buc	6	2
3639	1315	Înlocuit anvelopa	26.00	2	BUC	12	2
3640	1315	Echilibrat janta aliaj turism	32.00	1	BUC	12	2
3641	1329	195/75/16C MICHELIN CROSS CLIMATE	770.00	2	buc	6	2
3642	1329	Înlocuit anvelopa camioneta C	23.00	2	BUC	16	2
3643	1339	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3644	1339	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
3645	1340	Înlocuit anvelopa	15.00	4	BUC	12	2
3646	1340	Echilibrat jantă oțel	18.00	4	BUC	12	2
3647	1340	Inlocuit valva turism tubeless	6.00	4	buc	12	2
3650	1341	Înlocuit anvelopa	15.00	4	BUC	27	2
3651	1341	Echilibrat jantă oțel	18.00	4	BUC	27	2
3652	1341	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
3653	1342	Turisme axa fata	180.00	1	BUC	18	2
3654	1343	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3655	1343	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3656	1343	Saci	3.00	4	buc	22	2
3657	1334	315/70/22.5 ROYAL BLACK SL102 DIRECTIE	1550.00	2	buc	6	2
3658	1334	295/60/22.5 JINYU JD577	1600.00	4	buc	6	2
3659	1334	Înlocuit anvelopă 20 , 22.5 țoli	100.00	6	BUC	15	2
3660	1334	Echilibrat roată oțel 22,5 țoli	100.00	2	BUC	15	2
3661	1344	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3662	1345	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3664	1347	Înlocuit anvelopa	15.00	4	BUC	21	2
3665	1347	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3666	1347	Cazare Anvelope 13'' - 16''	120.00	1	BUC	21	2
4104	1498	Turisme axa fata	180.00	1	BUC	18	2
4113	1502	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4114	1502	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
4115	1503	Cazare Anvelope 13'' - 16''	120.00	1	BUC	12	2
4116	1503	Înlocuit anvelopa camioneta C	23.00	6	BUC	12	2
4117	1503	Echilibrat janta camioneta C	25.00	2	BUC	12	2
4118	1504	Înlocuit anvelopa	18.00	4	BUC	25	2
4119	1504	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
4128	1507	Turisme axa fata	180.00	1	BUC	18	2
4168	1524	Cazare Roti complete 19''-21''	200.00	1	BUC	23	2
4169	1524	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4170	1524	Plumb Hofmann	10.00	4	buc	23	2
4234	1547	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4236	1549	Înlocuit anvelopa	26.00	4	BUC	21	2
4237	1549	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	21	2
4238	1549	Plumb Hofmann	10.00	4	buc	21	2
4243	1544	205/55/17 KUMHO HS51	530.00	2	buc	6	2
4244	1544	Înlocuit anvelopa	18.00	4	BUC	27	2
4245	1544	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
4246	1544	Cazare Anvelope 17''-18'	140.00	1	BUC	27	2
4311	1570	PREZOANE	25.00	4	buc	21	2
4312	1570	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
4313	1570	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
4403	1595	Cazare Roti complete 17''-18'	160.00	1	BUC	22	2
4404	1595	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
4460	1614	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
4461	1614	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
4462	1614	Plumb Hofmann	10.00	4	buc	24	2
4463	1614	Înlocuit anvelopa	23.00	2	BUC	24	2
4464	1614	Îndreptat jantă aliaj	120.00	2	buc	24	2
4571	1643	Verificare geometrie	120.00	1	buc	18	2
4628	1639	Înlocuit anvelopa	18.00	1	BUC	12	2
4629	1639	Echilibrat janta aliaj turism	24.00	1	BUC	12	2
4630	1639	Verificare geometrie	120.00	1	buc	18	2
4631	1639	Inlocuit valva senzor	25.00	1	buc	6	2
4637	1671	Înlocuit anvelopa	15.00	4	BUC	24	2
4638	1671	Echilibrat jantă oțel	18.00	4	BUC	24	2
4644	1674	Verificare geometrie	120.00	1	buc	18	2
4646	1670	225/40 R18 KUMHO PS72 XL 92Y	380.00	4	buc	5	2
4647	1670	Înlocuit anvelopa	18.00	4	BUC	25	2
4648	1670	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
4649	1670	Îndreptat jantă aliaj	120.00	2	buc	25	2
4686	1693	Înlocuit anvelopa	18.00	4	BUC	22	2
4687	1693	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4732	1715	Înlocuit anvelopa	15.00	4	BUC	22	2
4733	1715	Echilibrat jantă oțel	18.00	4	BUC	22	2
4734	1715	Coliere	0.50	8	buc	22	2
4803	1735	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	12	2
4804	1735	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
4805	1735	Plumb Hofmann	10.00	4	buc	12	2
4816	1727	235/65 R17 MICHELIN CROSSCLIMATE 3	720.00	4	buc	5	2
4817	1727	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4818	1727	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4819	1727	Inlocuit valva turism tubeless	6.00	4	buc	24	2
4820	1727	Saci	3.00	1	buc	24	2
4883	1762	225/45 R17 RIKEN SUMMER 3 XL 94V	300.00	4	buc	5	2
4884	1762	Înlocuit anvelopa	18.00	4	BUC	22	2
4885	1762	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4886	1764	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4887	1764	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
4900	1770	Înlocuit anvelopa	18.00	4	BUC	22	2
4901	1770	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4955	1787	Verificare geometrie	120.00	1	buc	18	2
4965	1785	DEZENT KB DARK 7.5X18 5X112/40/57.1	1050.00	4	buc	6	2
4966	1785	235/45/18 MICHELIN PRIMACY 5	820.00	4	buc	6	2
4967	1785	AVANS 500	-500.00	1	buc	6	2
4968	1785	Saci	3.00	4	buc	22	2
5020	1814	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5031	1817	Echilibrat janta camioneta C	25.00	2	BUC	22	2
5032	1817	SCHIMBAT SENZOR FRANE	50.00	1	buc	27	2
5126	1837	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
5127	1838	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
5128	1838	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
5142	1845	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
5143	1845	Saci	3.00	4	buc	21	2
5149	1847	Verificare geometrie	120.00	1	buc	18	2
5150	1833	195/65/15 KUMHO HA32	270.00	4	buc	6	2
5151	1833	Echilibrat jantă oțel	18.00	4	BUC	24	2
5152	1833	Înlocuit anvelopa	15.00	4	BUC	24	2
5160	1846	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
5161	1846	Echilibrat janta camioneta C	25.00	4	BUC	12	2
5162	1846	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5223	1869	Verificare geometrie	120.00	1	buc	18	2
5224	1870	Înlocuit anvelopa Jeep (SUV)	32.00	2	BUC	22	2
5225	1870	Echilibrat janta Jeep (SUV)	40.00	2	BUC	22	2
5226	1870	Saci	3.00	2	buc	22	2
5227	1870	DEMONTAT MONTAT SENZOR PRESIUNE	30.00	1	buc	22	2
5264	1882	Înlocuit anvelopa	15.00	4	BUC	23	2
5265	1882	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
5266	1882	Presiune roata AZOT turism	5.00	4	buc	23	2
5267	1875	MICHELIN PRIMACY 5 XL 101W	700.00	4	buc	5	2
5268	1875	Înlocuit anvelopa	18.00	4	BUC	12	2
5269	1875	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
5270	1875	Saci	3.00	4	buc	12	2
3667	1319	RIKEN SUMMER3// 205/55/16	260.00	4	buc	1	2
3668	1319	Înlocuit anvelopa	15.00	4	BUC	12	2
3669	1319	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
3670	1348	Cazare Roti complete 17''-18'	160.00	1	BUC	25	2
3671	1348	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
3672	1348	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	25	2
3673	1348	Inlocuit valva senzor	25.00	4	buc	25	2
3674	1348	Plumb Hofmann	10.00	4	buc	25	2
3675	1346	PREZON M14X1.5	15.00	20	buc	6	2
3676	1346	Înlocuit anvelopa	23.00	4	BUC	24	2
3677	1346	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
3678	1346	Inlocuit valva senzor	25.00	4	buc	24	2
3686	1350	Înlocuit anvelopa	15.00	4	BUC	24	2
3687	1350	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3688	1350	Inlocuit valva turism tubeless	6.00	4	buc	24	2
3689	1351	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
3690	1351	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3691	1352	Turisme axa fata	180.00	1	BUC	18	2
3692	1353	Înlocuit anvelopa	15.00	4	BUC	12	2
3693	1353	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
3694	1349	JANTA 2539657	550.00	1	buc	6	2
3695	1349	205/60/16 KUMHO HS51	390.00	4	buc	6	2
3696	1349	Înlocuit anvelopa	15.00	4	BUC	27	2
3697	1349	Echilibrat jantă oțel	18.00	4	BUC	27	2
3698	1354	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
3699	1354	Înlocuit anvelopa	15.00	4	BUC	22	2
3700	1354	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3701	1355	Turisme axa fata	180.00	1	BUC	18	2
3704	1357	Constatare defectiuni	60.00	1	buc	18	2
3705	1358	Echilibrat janta camioneta C	25.00	2	BUC	21	2
3706	1358	Înlocuit anvelopa camioneta C	23.00	6	BUC	21	2
3707	1359	Înlocuit anvelopa	18.00	4	BUC	27	2
3708	1359	Echilibrat jantă oțel	21.00	4	BUC	27	2
3709	1360	Cazare Roti complete 17''-18'	160.00	1	BUC	23	2
3710	1360	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
3711	1361	Verificare geometrie	120.00	1	buc	18	2
3712	1362	Înlocuit anvelopa	18.00	4	BUC	24	2
3713	1362	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
3714	1362	Aplicat petec TIP TOP NR 2	40.00	1	buc	24	2
3715	1363	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	22	2
3716	1363	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
3717	1363	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
3718	1364	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
3719	1364	Saci	3.00	4	buc	25	2
3720	1356	215/65 R15C FIRESTONE VANHAWK MULTISEASON	630.00	2	buc	5	2
3721	1356	AVANS	-600.00	1	buc	5	2
3722	1356	Înlocuit anvelopa camioneta C	23.00	4	BUC	15	2
3723	1356	Echilibrat janta camioneta C	25.00	4	BUC	15	2
3726	1367	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3727	1367	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
3729	1369	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
3730	1369	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3738	1370	Înlocuit anvelopa	23.00	2	BUC	24	2
3739	1370	Echilibrat janta aliaj turism	26.00	2	BUC	24	2
3740	1370	Inlocuit valva turism tubeless	6.00	2	buc	24	2
3741	1370	Saci	3.00	2	buc	24	2
3742	1371	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3743	1371	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3744	1372	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
3745	1372	Înlocuit anvelopa	15.00	4	BUC	23	2
3746	1372	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3747	1373	Înlocuit anvelopa	15.00	4	BUC	12	2
3748	1373	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
3749	1374	Înlocuit anvelopa camioneta C	23.00	6	BUC	25	2
3750	1374	Echilibrat janta camioneta C	25.00	4	BUC	25	2
3751	1375	MICHELIN PRIMACY 5//205/50/17	640.00	4	buc	1	2
3752	1366	225/50/17 DUINLOP BLUERESP	610.00	4	buc	6	2
3753	1366	Înlocuit anvelopa	18.00	4	BUC	27	2
3754	1366	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3755	1366	Saci	3.00	4	buc	27	2
3756	1365	265/40/22 YOKOHAMA V107	1200.00	4	buc	6	2
3757	1365	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
3758	1365	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3759	1368	185/65/15 RIKEN ALL	280.00	4	buc	6	2
3760	1368	Înlocuit anvelopa	15.00	4	BUC	15	2
3761	1368	Echilibrat jantă oțel	18.00	4	BUC	15	2
3762	1368	Inlocuit valva turism tubeless	6.00	4	buc	15	2
3763	1376	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3764	1376	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3765	1377	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
3766	1377	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3767	1378	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
3768	1378	Înlocuit roata turism (Permutare)	26.00	4	BUC	24	2
3769	1378	Plumb Hofmann	10.00	4	buc	24	2
3770	1379	Echilibrat janta Jeep (SUV)	30.00	4	BUC	12	2
3771	1380	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
3772	1380	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
3773	1380	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
3774	1381	Echilibrat jantă oțel	18.00	4	BUC	21	2
3775	1381	Înlocuit anvelopa	15.00	4	BUC	21	2
3776	1381	Coliere	0.50	8	buc	21	2
3777	1382	Aplicat petec TIP TOP NR 2	50.00	1	buc	15	2
3778	1382	Echilibrat janta camioneta C	25.00	1	BUC	15	2
3779	1383	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
3781	1384	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
3782	1385	Înlocuit anvelopa	15.00	4	BUC	22	2
3783	1385	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
3784	1385	Inlocuit valva turism tubeless	6.00	4	buc	22	2
4105	1499	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
4106	1499	Înlocuit anvelopa	15.00	4	BUC	23	2
4107	1499	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
4125	1506	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4126	1506	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	23	2
4127	1506	Echilibrat janta Jeep (SUV)	30.00	4	BUC	23	2
4247	1548	215/55/17 MICHELIN PRIMACY 5	670.00	4	buc	22	2
4248	1548	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4249	1548	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4314	1567	MICHELIN PRIMACY 3 ZP/  225/45/18	920.00	4	buc	1	2
4315	1567	AVANS	-1000.00	1	buc	1	2
4316	1567	Sudura janta	180.00	1	buc	22	2
4317	1567	Înlocuit anvelopa	18.00	4	BUC	22	2
4318	1567	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4336	1571	235/55/19 KUMHO HA32	590.00	4	buc	6	2
4337	1571	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
4338	1571	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
4339	1571	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
4397	1592	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4398	1592	Îndreptat jantă aliaj	120.00	1	buc	15	2
4475	1621	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4476	1621	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
4572	1644	Cazare Roti complete 13'' - 16''	150.00	1	BUC	24	2
4573	1644	Echilibrat jantă oțel	18.00	4	BUC	24	2
4574	1645	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
4575	1645	Înlocuit anvelopa	18.00	4	BUC	22	2
4576	1645	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4577	1646	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4583	1650	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	4	buc	5	2
4635	1669	Verificare geometrie	120.00	1	buc	18	2
4691	1694	Înlocuit anvelopa	18.00	4	BUC	27	2
4692	1694	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
4693	1694	PREZON BM 14X1,25	25.00	4	ora	27	2
4735	1716	Înlocuit roata turism (Permutare)	16.00	4	BUC	27	2
4736	1716	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
4751	1721	Înlocuit anvelopa	18.00	2	BUC	24	2
4752	1721	Echilibrat janta aliaj turism	24.00	2	BUC	24	2
4753	1721	Plumb Hofmann	10.00	2	buc	24	2
4830	1742	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
4831	1742	Înlocuit anvelopa	18.00	4	BUC	22	2
4832	1742	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4833	1743	Turisme axa fata	180.00	1	BUC	18	2
4888	1766	Înlocuit anvelopa Jeep (SUV)	32.00	2	BUC	24	2
4889	1766	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
4890	1766	Cazare Roti complete 19''-21''	200.00	1	BUC	24	2
4907	1771	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
4956	1788	Înlocuit anvelopa	15.00	4	BUC	15	2
4957	1788	Echilibrat jantă oțel	18.00	4	BUC	8	2
4961	1791	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
4962	1791	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4963	1791	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4964	1791	Plumb Hofmann	10.00	4	buc	24	2
5036	1818	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5041	1821	Echilibrat janta camioneta C	25.00	1	BUC	15	2
5042	1821	Echilibrat janta camioneta C	25.00	1	BUC	8	2
5100	1823	275/40 R19 GRIPMAX SUREGRIP PRO SPORT	490.00	2	buc	5	2
5101	1823	245/45 R19 GRIPMAX SUREGRIP PRO SPORT	430.00	2	buc	5	2
5102	1823	Înlocuit anvelopa	23.00	4	BUC	23	2
5103	1823	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
5104	1823	Îndreptat jantă aliaj	150.00	1	buc	14	2
5168	1850	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
5169	1850	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
5187	1854	175/65 R14 DEBICA PASSIO 2 XL 86T	250.00	2	buc	5	2
5189	1856	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5228	1867	195/75/16C MICHELIN AGILIS 3	700.00	4	buc	6	2
5229	1867	Înlocuit anvelopa camioneta C	23.00	4	BUC	8	2
5230	1867	Inlocuit valva turism tubeless	25.00	1	buc	16	2
5231	1867	Prelungitor valvă	25.00	2	BUC	16	2
5271	1875	Turisme axa fata	180.00	1	BUC	19	2
5274	1883	Înlocuit anvelopa	18.00	4	BUC	24	2
5275	1883	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
5276	1883	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
5277	1884	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
5282	1887	Cazare Roti complete 13'' - 16''	150.00	1	BUC	21	2
5283	1887	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
5314	1903	Înlocuit anvelopa	18.00	4	BUC	12	2
5315	1903	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
5353	1917	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
5359	1899	265/60/18 BFG ALL TERRAIN	1450.00	4	buc	3	2
5360	1899	Înlocuit anvelopa Jeep (SUV)	20.00	5	BUC	24	2
5361	1899	Echilibrat janta Jeep (SUV)	24.00	5	BUC	24	2
5362	1899	Demontat rezervă (sub mașină) – Turisme	25.00	1	BUC	24	2
5363	1899	Inlocuit valva turism tubeless	6.00	5	buc	24	2
5369	1922	Înlocuit anvelopa	15.00	4	BUC	27	2
5370	1922	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
5379	1929	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
5380	1930	Turisme axa fata	180.00	1	BUC	18	2
5381	1931	Înlocuit anvelopa	18.00	4	BUC	24	2
5382	1931	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
3785	1386	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
3786	1386	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3787	1386	Saci	3.00	4	buc	27	2
4108	1500	Înlocuit anvelopă 20 , 22.5 țoli	100.00	1	BUC	15	2
4181	1529	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
4182	1529	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4183	1530	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
4188	1531	Echilibrat jantă oțel	18.00	4	BUC	21	2
4189	1531	Înlocuit anvelopa	15.00	4	BUC	21	2
4190	1531	Saci	3.00	2	buc	21	2
4191	1526	205/60/16 KUMHO HS51	390.00	4	buc	6	2
4192	1526	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	24	2
4193	1526	Echilibrat janta Jeep (SUV)	19.00	4	BUC	24	2
4194	1526	Saci	3.00	4	buc	24	2
4199	1534	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
4201	1536	Echilibrat janta aliaj turism	24.00	1	BUC	12	2
4202	1536	Înlocuit roata turism (Permutare)	18.00	1	BUC	12	2
4253	1551	RIKEN CSP CARGO//185/14C	360.00	1	buc	1	2
4254	1551	Înlocuit anvelopa camioneta C	23.00	1	BUC	11	2
4324	1573	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
4325	1573	Înlocuit anvelopa	15.00	4	BUC	27	2
4326	1573	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
4333	1576	Înlocuit anvelopa camioneta C	23.00	3	BUC	25	2
4334	1576	Echilibrat janta camioneta C	25.00	2	BUC	25	2
4335	1576	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	25	2
4399	1593	Înlocuit anvelopa	15.00	4	BUC	12	2
4400	1593	Echilibrat jantă oțel	18.00	4	BUC	12	2
4468	1618	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
4469	1618	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4488	1619	CAP DE BARA  5310659	450.00	1	buc	6	2
4489	1619	BIELETA DIRECTIE 5178931	550.00	1	buc	6	2
4490	1619	MANOPERA	200.00	1	buc	6	2
4491	1619	GEOMETRIE	250.00	1	buc	6	2
4492	1625	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
4493	1625	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
4503	1616	165/70 R14 RIKEN ALL SEASON XL 85T	240.00	2	buc	5	2
4504	1616	Înlocuit anvelopa	12.00	2	BUC	27	2
4505	1616	Echilibrat jantă oțel	14.00	2	BUC	27	2
4506	1616	Înlocuit roata turism (Permutare)	12.00	2	BUC	27	2
4578	1647	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
4579	1647	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
4645	1675	Echilibrat janta Jeep (SUV)	30.00	4	BUC	15	2
4696	1696	Înlocuit anvelopa	18.00	4	BUC	22	2
4697	1696	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4698	1696	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
4740	1717	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4741	1717	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
4742	1711	215/55/18 KUMHO PS71	480.00	2	buc	6	2
4743	1711	Înlocuit anvelopa Jeep (SUV)	20.00	2	BUC	12	2
4744	1711	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
4745	1711	Saci	3.00	4	buc	12	2
4808	1737	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
4809	1737	DEMONTAT +MONTAT SENZOR PRESIUNE	30.00	1	buc	22	2
4891	1761	205/55/16 MICHELIN PRIMACY 5	470.00	4	buc	4	2
4892	1761	Înlocuit anvelopa	15.00	4	BUC	23	2
4893	1761	Echilibrat jantă oțel	18.00	4	BUC	23	2
4894	1767	Cazare Anvelope 13'' - 16''	120.00	1	BUC	12	2
4895	1767	Înlocuit anvelopa	15.00	4	BUC	12	2
4896	1767	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
4898	1769	Înlocuit anvelopa	15.00	4	BUC	12	2
4899	1769	Echilibrat jantă oțel	18.00	4	BUC	12	2
4972	1789	215/55/18 RIKEN ULTRA HIGH PERF	350.00	4	buc	6	2
4973	1789	FACTURAT -ACHITATA ANVELOPE	-350.00	4	buc	6	2
4974	1789	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
4975	1789	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
4977	1795	Echilibrat janta Jeep (SUV)	40.00	4	BUC	27	2
5004	1804	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
5005	1804	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
5056	1826	Înlocuit anvelopa	23.00	4	BUC	27	2
5057	1826	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
5072	1819	205/55/16 SAILUN ATREZO ELIT	240.00	4	buc	6	2
5073	1819	Înlocuit anvelopa	15.00	4	BUC	21	2
5074	1819	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
5075	1819	Îndreptat jantă aliaj	120.00	1	buc	21	2
5076	1819	Inlocuit valva turism tubeless	6.00	4	buc	21	2
5176	1851	Cazare Anvelope 17''-18'	140.00	1	BUC	24	2
5177	1851	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
5178	1851	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
5232	1864	Echilibrat janta aliaj turism	32.00	4	BUC	21	2
5233	1864	Înlocuit anvelopa	26.00	4	BUC	21	2
5234	1864	Plumb Hofmann	10.00	4	buc	21	2
5235	1864	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
5236	1864	SPALAT EXTERIOR	30.00	1	buc	21	2
5237	1864	Turisme / suv 19"-24" inch	300.00	1	BUC	19	2
5278	1885	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	21	2
5279	1885	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
5290	1891	Cazare Roti complete 13'' - 16''	150.00	1	BUC	15	2
5291	1891	Echilibrat janta aliaj turism	19.00	4	BUC	8	2
5317	1898	215/55 R17 RIKEN SUMMER 3	350.00	2	buc	5	2
5318	1898	Înlocuit anvelopa	18.00	4	BUC	22	2
5319	1898	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
5320	1898	Saci	3.00	2	buc	22	2
3788	1387	Echilibrat jantă oțel	18.00	4	BUC	23	2
3789	1387	Coliere	0.50	8	buc	23	2
3790	1388	Echilibrat jantă oțel	18.00	4	BUC	21	2
3791	1388	Înlocuit anvelopa	15.00	4	BUC	21	2
3792	1389	Înlocuit anvelopa	15.00	4	BUC	12	2
3793	1389	Echilibrat jantă oțel	18.00	4	BUC	12	2
3794	1390	Înlocuit anvelopa	18.00	3	BUC	15	2
3795	1390	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
4109	1501	Înlocuit anvelopa camioneta C	23.00	6	BUC	22	2
3797	1392	Înlocuit anvelopa	18.00	4	BUC	27	2
3798	1392	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3799	1392	Inlocuit valva senzor	25.00	4	buc	27	2
3800	1393	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
3801	1393	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	24	2
3802	1393	Echilibrat janta Jeep (SUV)	19.00	4	BUC	24	2
4110	1501	Echilibrat janta camioneta C	25.00	6	BUC	22	2
4111	1501	VALVA SENZOR                     COD73902021	60.00	1	buc	22	2
3805	1396	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3806	1396	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
3807	1396	Saci	3.00	4	buc	21	2
3808	1397	PLACUTE FRANA  GDB1814	240.00	1	buc	3	2
3809	1397	MANOPERA	350.00	1	buc	3	2
3810	1397	PLACUTE FRANA GDB2107	170.00	1	buc	3	2
3811	1398	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3812	1399	Cazare Anvelope 17''-18'	140.00	1	BUC	22	2
3813	1399	Înlocuit anvelopa	18.00	4	BUC	22	2
3814	1399	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3815	1399	Inlocuit valva turism tubeless	6.00	4	buc	22	2
3816	1400	Înlocuit anvelopa	15.00	4	BUC	23	2
3817	1400	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3818	1401	205/60 R16 KUMHO HS51 92H	390.00	4	buc	5	2
4112	1501	EXTENSI	40.00	2	buc	22	2
3820	1403	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	24	2
3821	1403	Echilibrat janta Jeep (SUV)	19.00	4	BUC	24	2
3826	1391	195/65 R15 KUMHO ES31 91H	260.00	4	buc	5	2
3827	1391	Înlocuit anvelopa	15.00	4	BUC	22	2
3828	1391	Echilibrat jantă oțel	18.00	4	BUC	22	2
3829	1391	Inlocuit valva turism tubeless	6.00	4	buc	22	2
3830	1395	195/75 R16C MICHELIN AGILIS CROSSCLIMATE 110/108R	770.00	4	buc	5	2
3831	1395	Înlocuit anvelopa camioneta C	23.00	4	BUC	13	2
3832	1395	Inlocuit valva turism tubeless	6.00	4	buc	13	2
3833	1395	Prelungitor valvă	25.00	2	BUC	13	2
3834	1404	Echilibrat Hunter RFE 15"-16" Turisme	60.00	4	buc	21	2
3835	1404	Inlocuit valva turism tubeless	6.00	4	buc	21	2
3836	1404	INLOCUIT VALVE	10.00	4	buc	21	2
3838	1405	Înlocuit anvelopa	18.00	4	BUC	23	2
3839	1405	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
3840	1406	Cazare Anvelope 17''-18'	140.00	1	BUC	27	2
3841	1406	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
3842	1406	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
3843	1407	Turisme axa fata	180.00	1	BUC	18	2
3844	1408	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3845	1408	Saci	3.00	4	buc	22	2
3846	1394	275/40 R18 MICHELIN PILOT SPORT 5 XL 103Y	1220.00	2	buc	5	2
3847	1394	Înlocuit anvelopa	18.00	4	BUC	12	2
3848	1394	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3851	1410	Cazare Anvelope 13'' - 16''	120.00	1	BUC	24	2
3852	1410	Înlocuit anvelopa	15.00	4	BUC	24	2
3853	1410	Echilibrat jantă oțel	18.00	4	BUC	24	2
3856	1412	Turisme / SUV 13"-18" inch	250.00	1	BUC	17	2
3857	1413	Înlocuit anvelopa	15.00	4	BUC	27	2
3858	1413	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3859	1414	Echilibrat Hunter RFE 17"-18" Turisme	70.00	4	buc	21	2
3860	1414	Plumb Hofmann	10.00	4	buc	21	2
3861	1414	Înlocuit anvelopa	18.00	4	BUC	21	2
3862	1411	225/60/17 KUMHO HS52	530.00	2	buc	6	2
3863	1411	ANVELOPE FACTURATE	-1060.00	1	buc	6	2
3864	1402	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	2	buc	5	2
3865	1402	Echilibrat janta aliaj turism	19.00	4	BUC	13	2
3866	1402	Înlocuit anvelopa	15.00	4	BUC	13	2
3867	1402	Inlocuit valva turism tubeless	6.00	4	buc	13	2
3868	1415	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3869	1416	Înlocuit anvelopa	15.00	4	BUC	24	2
3870	1416	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
3871	1417	Cazare Anvelope 19''-21''	150.00	1	BUC	22	2
3872	1417	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
3873	1417	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
3874	1418	Turisme axa fata	180.00	1	BUC	18	2
3875	1419	Înlocuit anvelopa Jeep (SUV)	20.00	6	BUC	23	2
3876	1419	Echilibrat janta Jeep (SUV)	24.00	2	BUC	23	2
3877	1419	CUSTODIE ANV 17C	30.00	6	buc	23	2
3878	1420	FILTRU ULEI 1520900Q0F	50.00	1	buc	6	2
3879	1420	FIULTRU AER C25040	60.00	1	buc	6	2
3880	1420	FILTRU POLEN CU25003	80.00	1	buc	6	2
3881	1420	ULEI CASTROIL EDGE 5W30 5L LL	270.00	1	buc	6	2
3882	1420	MANOPERA	150.00	1	buc	6	2
3883	1421	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	15	2
3884	1421	Echilibrat janta Jeep (SUV)	24.00	4	BUC	15	2
3885	1409	235/45/18 RIKEN ULTRA HP	330.00	2	buc	6	2
3886	1409	AVANS 300	-300.00	1	buc	6	2
3887	1409	Înlocuit anvelopa	18.00	4	BUC	11	2
3888	1409	Echilibrat janta aliaj turism	24.00	4	BUC	11	2
3893	1424	Cazare Anvelope 19''-21''	150.00	1	BUC	27	2
3894	1424	Înlocuit anvelopa	23.00	4	BUC	27	2
3895	1424	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
3896	1424	Presiune roata AZOT turism	5.00	4	buc	27	2
3898	1426	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
3899	1426	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
3900	1426	Saci	3.00	4	buc	12	2
3901	1427	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3902	1428	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
3903	1428	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3905	1422	205/55 R16 MICHELIN PRIMACY 5 ENERGY	470.00	4	buc	3	2
3906	1422	Înlocuit anvelopa	18.00	4	BUC	22	2
3907	1422	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
3908	1422	Inlocuit valva turism tubeless	6.00	4	buc	22	2
3909	1422	Saci	3.00	4	buc	22	2
3910	1430	Cazare Anvelope 13'' - 16''	120.00	1	BUC	23	2
3911	1430	Echilibrat janta camioneta C	25.00	4	BUC	23	2
3912	1430	Înlocuit anvelopa camioneta C	23.00	4	BUC	23	2
3913	1431	Înlocuit anvelopa camioneta C	23.00	2	BUC	15	2
3914	1431	Echilibrat janta camioneta C	25.00	2	BUC	15	2
3919	1423	235/55/19 VIKING NEW GEN	490.00	4	buc	6	2
3920	1423	Echilibrat janta Jeep (SUV)	30.00	4	BUC	6	2
3921	1423	Înlocuit roata turism (Permutare)	24.00	4	BUC	6	2
3924	1434	Înlocuit anvelopa	15.00	4	BUC	27	2
3925	1434	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3926	1425	275/35 R19 PIRELLI P-ZERO RFT * XL 100Y	1400.00	2	buc	5	2
3927	1425	Înlocuit anvelopa	23.00	2	BUC	11	2
3928	1425	Echilibrat janta aliaj turism	26.00	2	BUC	11	2
3929	1435	Turisme / SUV 13"-18" inch	250.00	1	BUC	20	2
3933	1438	Înlocuit anvelopa	15.00	4	BUC	22	2
3934	1438	Echilibrat jantă oțel	18.00	4	BUC	22	2
3935	1439	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
3936	1439	Cazare Roti complete 17''-18'	160.00	1	BUC	27	2
3937	1440	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
4184	1527	175/70 R14 DEBICA PASSIO 2 84T	320.00	4	buc	5	2
4185	1527	Înlocuit anvelopa	12.00	4	BUC	12	2
4186	1527	Echilibrat jantă oțel	14.00	4	BUC	12	2
4187	1527	Inlocuit valva turism tubeless	6.00	4	buc	12	2
4195	1532	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	15	2
4196	1532	Echilibrat janta Jeep (SUV)	30.00	4	BUC	8	2
4197	1533	Înlocuit anvelopa	15.00	4	BUC	22	2
4198	1533	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4255	1552	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
4256	1552	Înlocuit anvelopa	18.00	4	BUC	12	2
4257	1552	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
4265	1556	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4266	1556	Cazare Roti complete 17''-18'	160.00	1	BUC	21	2
4279	1560	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4401	1594	Înlocuit anvelopa	15.00	4	BUC	25	2
4402	1594	Echilibrat jantă oțel	18.00	4	BUC	25	2
4410	1598	CAP BARA JTE438	180.00	1	buc	6	2
4411	1598	CAP DE BARA JTE439	180.00	1	buc	6	2
4412	1598	PIVOT JBJ817	90.00	1	buc	6	2
4413	1598	PVOT JBJ1049	90.00	1	buc	6	2
4414	1598	MANOPERA	400.00	1	buc	6	2
4415	1598	GOMETRIE	300.00	1	buc	6	2
4420	1601	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
4421	1601	Echilibrat janta Jeep (SUV)	24.00	4	BUC	25	2
4528	1620	195/75/16C RIKEN ALL	460.00	2	buc	6	2
4529	1620	Înlocuit anvelopa camioneta C	23.00	2	BUC	12	2
4530	1620	Echilibrat janta camioneta C	25.00	2	BUC	12	2
4531	1620	Demontat rezerva camioneta C	30.00	1	BUC	12	2
4549	1630	225/65/16C RIKEN CARGO CSP	460.00	4	buc	6	2
4550	1630	Înlocuit anvelopa camioneta C	23.00	4	BUC	15	2
4551	1630	Echilibrat janta camioneta C	25.00	4	BUC	8	2
4584	1651	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4585	1651	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4586	1651	Inlocuit valva turism tubeless	6.00	4	buc	24	2
4587	1627	KIT CUREA ACCESORII K016PK1198	250.00	1	buc	6	2
4588	1627	MANOPERA	250.00	1	buc	6	2
4598	1656	Autoutilitare axa simpla/dubla	300.00	1	BUC	18	2
4600	1657	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
4601	1657	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
4641	1673	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
4642	1673	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	22	2
4643	1673	Echilibrat janta Jeep (SUV)	19.00	4	BUC	22	2
4699	1697	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4703	1700	Înlocuit anvelopa	15.00	4	BUC	27	2
4704	1700	Echilibrat jantă oțel	18.00	4	BUC	27	2
4746	1719	Înlocuit anvelopa camioneta C	23.00	4	BUC	25	2
4747	1719	Echilibrat janta camioneta C	25.00	4	BUC	25	2
4810	1738	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4811	1738	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
4834	1744	Echilibrat jantă oțel	18.00	4	BUC	21	2
4835	1744	Înlocuit anvelopa	15.00	4	BUC	21	2
4902	1768	205/55/16 RIKEN ALL SEASON	300.00	2	buc	4	2
4903	1768	Înlocuit anvelopa	15.00	3	BUC	23	2
4904	1768	Echilibrat janta aliaj turism	19.00	2	BUC	23	2
4905	1768	Echilibrat jantă oțel	18.00	1	BUC	23	2
4906	1768	Inlocuit valva turism tubeless	6.00	1	buc	23	2
4976	1794	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4979	1797	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	27	2
4980	1797	Echilibrat janta Jeep (SUV)	30.00	4	BUC	27	2
4982	1796	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
4983	1796	Verificare geometrie	120.00	1	buc	18	2
5043	1822	Echilibrat janta aliaj turism	24.00	4	BUC	12	2
3917	1432	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
3918	1432	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3922	1433	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
3923	1433	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3930	1436	Înlocuit anvelopa	15.00	3	BUC	24	2
3931	1436	Echilibrat jantă oțel	18.00	4	BUC	24	2
3932	1437	Verificare geometrie	120.00	1	buc	18	2
3938	1441	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3939	1442	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	21	2
3940	1442	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
3941	1443	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
3942	1443	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3947	1429	GOODYEAR EFICIENT GRIP //215/65/16	620.00	4	buc	1	2
3948	1429	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	24	2
3949	1429	Echilibrat janta Jeep (SUV)	19.00	4	BUC	24	2
3950	1429	Inlocuit valva turism tubeless	6.00	4	buc	24	2
3951	1429	Saci	3.00	4	buc	24	2
3952	1444	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
3953	1445	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
3954	1445	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
3955	1446	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
3956	1446	Înlocuit anvelopa	15.00	4	BUC	21	2
3957	1447	Înlocuit anvelopa	15.00	4	BUC	24	2
3958	1447	Echilibrat jantă oțel	18.00	4	BUC	24	2
3959	1448	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	27	2
3960	1448	Aplicat petec TIP TOP NR 3	50.00	1	buc	27	2
3961	1449	Înlocuit anvelopa	15.00	4	BUC	15	2
3962	1449	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
3963	1450	Înlocuit anvelopa	23.00	4	BUC	24	2
3964	1450	Echilibrat janta aliaj turism	26.00	4	BUC	24	2
3965	1450	Saci	3.00	4	buc	24	2
3966	1451	295/60/22.5 GITI TRACT	2300.00	4	buc	6	2
3968	1453	Cazare Roti complete 13'' - 16''	150.00	1	BUC	27	2
3969	1453	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
3970	1454	Înlocuit anvelopa camioneta C	23.00	4	BUC	22	2
3971	1454	Echilibrat janta camioneta C	25.00	4	BUC	22	2
3972	1455	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
3973	1455	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3975	1457	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
3976	1457	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
3977	1457	Plumb Hofmann	10.00	4	buc	21	2
3978	1457	Cazare Anvelope 22''-24''	180.00	1	BUC	21	2
3979	1458	Înlocuit anvelopa	15.00	4	BUC	12	2
3980	1458	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
3981	1456	235/55/18 SALIUN ATR ELITE 2	400.00	4	buc	6	2
3982	1456	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	14	2
3983	1456	Echilibrat janta Jeep (SUV)	24.00	4	BUC	14	2
3984	1456	Cazare Roti complete 13'' - 16''	150.00	1	BUC	14	2
3985	1459	Înlocuit anvelopa camioneta C	23.00	2	BUC	15	2
3990	1452	MICHELIN  PRIMACY4/185/60/15	490.00	4	buc	1	2
3991	1452	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
3992	1452	Înlocuit anvelopa	15.00	4	BUC	23	2
3993	1452	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
3994	1452	Presiune roata AZOT turism	5.00	4	buc	23	2
3998	1461	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
3999	1461	Saci	3.00	4	buc	24	2
4000	1461	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
4001	1462	225/40 R18 MICHELIN PS5	580.00	1	buc	3	2
4002	1460	155/65/14 TIGAR ALL	250.00	4	buc	6	2
4003	1460	Înlocuit anvelopa	12.00	4	BUC	27	2
4004	1460	Echilibrat janta aliaj turism	17.00	4	BUC	27	2
4005	1460	Inlocuit valva turism tubeless	6.00	4	buc	27	2
4006	1463	Înlocuit anvelopa	15.00	4	BUC	23	2
4007	1463	Echilibrat jantă oțel	18.00	4	BUC	23	2
4008	1464	Echilibrat janta Jeep (SUV)	24.00	4	BUC	21	2
4012	1465	235/55/19 MICHELIN PRIMACY 5 ENERGY	830.00	4	buc	6	2
4013	1465	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
4014	1465	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	21	2
4015	1465	Inlocuit valva turism tubeless	6.00	4	buc	21	2
4016	1465	Saci	3.00	8	buc	21	2
4017	1468	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
4018	1468	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4019	1468	Cazare Anvelope 17''-18'	140.00	1	BUC	27	2
4020	1469	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
4021	1469	Echilibrat janta camioneta C	25.00	4	BUC	12	2
4022	1469	Valve metalice	20.00	4	buc	12	2
4023	1469	Îndreptat jantă aliaj	120.00	1	buc	12	2
4024	1470	Echilibrat janta Jeep (SUV)	40.00	4	BUC	23	2
4025	1466	MICHELIN PRIMACY5//225/60/18	750.00	4	buc	1	2
4026	1466	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4027	1466	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4028	1466	Saci	3.00	4	buc	24	2
4029	1471	Înlocuit anvelopa	15.00	4	BUC	27	2
4030	1471	Echilibrat jantă oțel	18.00	4	BUC	27	2
4032	1473	Înlocuit anvelopa	15.00	4	BUC	15	2
4033	1473	Echilibrat janta aliaj turism	19.00	4	BUC	15	2
4034	1473	Inlocuit valva turism tubeless	6.00	4	buc	15	2
4035	1474	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4036	1475	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
4037	1467	195/70 R15C MATADOR MPS400 ALL SEASONS 140/102R	420.00	4	buc	5	2
4048	1478	Înlocuit anvelopa	15.00	4	BUC	27	2
4049	1478	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
4038	1467	Înlocuit anvelopa camioneta C	23.00	4	BUC	25	2
4039	1467	Echilibrat janta camioneta C	25.00	2	BUC	25	2
4040	1476	Echilibrat janta aliaj turism	24.00	4	BUC	21	2
4041	1476	Înlocuit anvelopa	18.00	4	BUC	21	2
4042	1476	Cazare Anvelope 17''-18'	140.00	1	BUC	21	2
4044	1472	215/60 R17 KUMHO PS71 96H	450.00	4	buc	5	2
4045	1472	Saci	3.00	2	buc	24	2
4046	1472	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4047	1472	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4051	1479	Cazare Anvelope 13'' - 16''	120.00	1	BUC	12	2
4052	1479	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
4053	1479	Echilibrat janta camioneta C	25.00	4	BUC	12	2
4054	1480	Înlocuit anvelopa	18.00	4	BUC	15	2
4055	1480	Echilibrat janta aliaj turism	24.00	4	BUC	15	2
4056	1480	Cazare Anvelope 17''-18'	140.00	1	BUC	15	2
4129	1508	Echilibrat Hunter RFE 21"-22" Turisme	100.00	4	buc	24	2
4130	1508	Saci	3.00	4	buc	24	2
4135	1509	Echilibrat janta camioneta C	25.00	4	BUC	22	2
4136	1509	Înlocuit anvelopa camioneta C	23.00	4	BUC	22	2
4203	1535	195/65 R15 RIKEN SNOW 91H	260.00	2	buc	5	2
4204	1535	Înlocuit anvelopa	15.00	2	BUC	24	2
4205	1535	Echilibrat jantă oțel	18.00	2	BUC	24	2
4206	1535	Inlocuit valva turism tubeless	6.00	2	buc	24	2
4262	1554	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	27	2
4263	1554	Echilibrat janta Jeep (SUV)	24.00	4	BUC	27	2
4264	1554	Saci	3.00	4	buc	27	2
4332	1575	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
4405	1596	MONTAT ANV MOTO	25.00	2	buc	21	2
4406	1596	ECHILIBRAT MOTO	30.00	2	buc	21	2
4416	1599	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	24	2
4417	1599	Echilibrat janta Jeep (SUV)	24.00	4	BUC	24	2
4526	1629	Turisme axa fata	180.00	1	BUC	18	2
4589	1652	Înlocuit anvelopa	23.00	3	BUC	25	2
4590	1652	Echilibrat janta aliaj turism	26.00	4	BUC	25	2
4591	1652	ETANSARE JANTA	20.00	1	buc	25	2
4592	1652	Îndreptat jantă aliaj	150.00	3	buc	22	2
4593	1653	Înlocuit anvelopa	15.00	4	BUC	23	2
4594	1653	Echilibrat jantă oțel	18.00	4	BUC	23	2
4595	1653	Coliere	0.50	8	buc	23	2
4603	1659	Cazare Anvelope 17''-18'	140.00	1	BUC	12	2
4604	1659	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
4605	1659	Echilibrat janta Jeep (SUV)	24.00	4	BUC	12	2
4650	1676	Înlocuit anvelopa	15.00	4	BUC	24	2
4651	1676	Echilibrat janta aliaj turism	19.00	4	BUC	24	2
4652	1677	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4653	1677	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	23	2
4654	1677	Echilibrat Hunter RFE 21"-22" SUV	110.00	4	buc	23	2
4655	1677	Plumb Hofmann	10.00	4	buc	23	2
4656	1678	Înlocuit anvelopa	18.00	4	BUC	15	2
4657	1678	Echilibrat janta aliaj turism	24.00	4	BUC	8	2
4659	1680	Înlocuit anvelopa camioneta C	23.00	6	BUC	12	2
4660	1680	Echilibrat janta camioneta C	25.00	2	BUC	12	2
4700	1698	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	21	2
4701	1698	Echilibrat janta Jeep (SUV)	19.00	4	BUC	21	2
4748	1720	Înlocuit anvelopa	15.00	4	BUC	27	2
4749	1720	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
4821	1739	Cazare Anvelope 19''-21''	150.00	1	BUC	23	2
4822	1739	Înlocuit anvelopa	23.00	4	BUC	23	2
4823	1739	Echilibrat janta aliaj turism	26.00	4	BUC	23	2
4908	1772	Turisme axa fata	180.00	1	BUC	18	2
4916	1774	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
4917	1774	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
4918	1774	Saci	3.00	4	buc	22	2
4922	1777	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
4923	1777	Echilibrat janta aliaj turism	19.00	4	BUC	23	2
4935	1780	MICHELIN CROSS CLIM /225/55/17	770.00	2	buc	1	2
4936	1780	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4937	1780	Înlocuit anvelopa	18.00	2	BUC	23	2
4989	1800	Efectuat pană tubeless (cu șnur)	25.00	1	BUC	24	2
4990	1800	Înlocuit anvelopa	18.00	2	BUC	24	2
4991	1800	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4992	1800	Îndreptat jantă aliaj	120.00	2	buc	22	2
5001	1803	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
5002	1803	Îndreptat jantă aliaj	150.00	1	buc	22	2
5003	1803	Sudura janta	180.00	3	buc	22	2
5044	1822	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	12	2
5061	1816	185/65/15 MICHELIN CROSS CLIAMATE 2	450.00	4	buc	6	2
5062	1816	Înlocuit anvelopa	15.00	4	BUC	24	2
5063	1816	Echilibrat jantă oțel	18.00	4	BUC	24	2
5064	1816	Coliere	0.50	4	buc	24	2
5065	1816	Saci	3.00	4	buc	24	2
5066	1816	Turisme axa fata	180.00	1	BUC	18	2
5110	1829	Înlocuit anvelopa	15.00	4	BUC	12	2
5111	1829	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
5112	1829	Turisme axa fata	180.00	1	BUC	20	2
5181	1842	205/55 R16 MICHELIN PRIMACY 5 ENERGY 91V	470.00	4	buc	5	2
5182	1842	Înlocuit anvelopa	15.00	4	BUC	27	2
5183	1842	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
5238	1871	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
5239	1871	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
5240	1871	Saci	3.00	4	buc	25	2
5284	1888	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
5321	1905	Echilibrat janta camioneta C	25.00	4	BUC	24	2
5322	1905	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
4050	1478	Cazare Anvelope 13'' - 16''	120.00	1	BUC	27	2
4057	1481	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
4059	1483	Echilibrat jantă oțel	18.00	4	BUC	27	2
4131	1505	275/45/21 MICHELIN PS4 SUV	1390.00	2	buc	6	2
4132	1505	315/40/21 MICHELIN PS4 SUV	1770.00	2	buc	6	2
4133	1505	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	12	2
4134	1505	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
4146	1513	195/75 R16C ROYAL BLACK ROYAL COMMERCIAL BSW 6PR 107/105R	350.00	6	buc	5	2
4148	1515	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
4149	1515	Echilibrat janta camioneta C	25.00	4	BUC	12	2
4150	1516	Înlocuit anvelopa	15.00	4	BUC	22	2
4151	1516	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4152	1516	Inlocuit valva turism tubeless	6.00	4	buc	22	2
4213	1539	Turisme axa fata	180.00	1	BUC	18	2
4219	1543	Echilibrat janta Jeep (SUV)	40.00	4	BUC	21	2
4220	1543	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	21	2
4221	1543	Plumb Hofmann	10.00	4	buc	21	2
4222	1543	Cazare Anvelope 22''-24''	180.00	1	BUC	21	2
4267	1555	195/75/16C MATADOR MPS400	480.00	4	buc	6	2
4268	1555	Înlocuit anvelopa camioneta C	23.00	4	BUC	24	2
4269	1555	Inlocuit valva turism tubeless	6.00	3	buc	24	2
4273	1558	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	22	2
4274	1558	Echilibrat janta Jeep (SUV)	30.00	4	BUC	22	2
4275	1558	Saci	3.00	4	buc	22	2
4276	1558	SPALAT INT EXT CEARA	75.00	1	buc	22	2
4280	1553	255/45/19 MICHELIN PRIMACY 5 ENERGY	1120.00	4	buc	6	2
4281	1553	Echilibrat Hunter RFE 19"-20" Turisme	80.00	4	buc	23	2
4282	1553	Înlocuit anvelopa	23.00	4	BUC	23	2
4340	1577	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
4341	1577	Înlocuit anvelopa	18.00	4	BUC	23	2
4342	1578	Înlocuit anvelopa	15.00	4	BUC	15	2
4343	1578	Echilibrat janta aliaj turism	19.00	4	BUC	8	2
4344	1578	Cazare Anvelope 13'' - 16''	120.00	1	BUC	8	2
4347	1574	185/65/15 RIKEN SUMMER3	250.00	4	buc	6	2
4348	1574	Înlocuit anvelopa	15.00	4	BUC	27	2
4349	1574	Echilibrat jantă oțel	18.00	4	BUC	27	2
4353	1582	Echilibrat janta camioneta C	25.00	4	BUC	24	2
4354	1582	Înlocuit anvelopa camioneta C	23.00	2	BUC	24	2
4355	1583	Turisme / SUV 13"-18" inch	250.00	1	BUC	18	2
4418	1600	Înlocuit anvelopa	23.00	4	BUC	27	2
4419	1600	Echilibrat janta aliaj turism	26.00	4	BUC	27	2
4547	1635	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
4548	1635	Echilibrat janta camioneta C	25.00	4	BUC	12	2
4553	1637	225/45 R18 MICHELIN PILOT SPORT 5 *	790.00	2	buc	5	2
4554	1637	255/40 R18 MICHELIN PILOT SPORT 5 *	1080.00	2	buc	5	2
4658	1679	Echilibrat janta Jeep (SUV)	40.00	4	BUC	22	2
4663	1682	Echilibrat janta aliaj turism	24.00	4	BUC	24	2
4673	1687	Cazare Anvelope 17''-18'	140.00	1	BUC	23	2
4674	1687	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	23	2
4675	1687	Echilibrat janta Jeep (SUV)	24.00	4	BUC	23	2
4702	1699	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
4755	1723	Echilibrat janta aliaj turism	19.00	4	BUC	12	2
4763	1710	225/50/17 MICHELIN PRIMACY 5	650.00	4	buc	6	2
4764	1710	Înlocuit anvelopa	18.00	4	BUC	22	2
4765	1710	Echilibrat janta aliaj turism	24.00	4	BUC	22	2
4766	1710	Cazare Roti complete 13'' - 16''	150.00	1	BUC	22	2
4767	1710	Saci	3.00	4	buc	22	2
4787	1726	205/65 R16C RIKEN ALL SEASON 107/105T	470.00	2	buc	5	2
4788	1726	ANV SH 205 65 16C	200.00	2	buc	21	2
4789	1726	Echilibrat janta camioneta C	25.00	4	BUC	21	2
4790	1726	Înlocuit anvelopa camioneta C	23.00	4	BUC	21	2
4791	1726	Inlocuit valva turism tubeless	6.00	4	buc	21	2
4824	1740	Înlocuit anvelopa	18.00	4	BUC	27	2
4825	1740	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
4826	1740	Îndreptat jantă aliaj	150.00	1	buc	27	2
4845	1749	Verificare geometrie	120.00	1	buc	17	2
4848	1736	245/45/18 MICHELIN PS5	760.00	2	buc	6	2
4849	1736	275/40/18 MICHELIN PS5	1220.00	2	buc	6	2
4850	1736	Înlocuit anvelopa	18.00	4	BUC	27	2
4851	1736	Echilibrat janta aliaj turism	24.00	4	BUC	27	2
4852	1736	Saci	3.00	4	buc	27	2
4853	1751	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	25	2
4854	1751	Echilibrat janta Jeep (SUV)	30.00	4	BUC	25	2
4855	1751	Cazare Anvelope 19''-21''	150.00	1	BUC	25	2
4910	1773	235/65/16C MICHELIN AGILIS 3	960.00	2	buc	6	2
4911	1773	Înlocuit anvelopa camioneta C	23.00	4	BUC	12	2
4912	1773	Echilibrat janta camioneta C	25.00	4	BUC	12	2
4981	1798	Turisme axa fata	180.00	1	BUC	20	2
5015	1811	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
5016	1811	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5017	1811	Saci	3.00	4	buc	22	2
5058	1827	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
5059	1827	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	25	2
5060	1827	Cazare Anvelope 17''-18'	140.00	1	BUC	25	2
5119	1828	235/65 R16C MICHELIN AGILIS 3 121/119R	960.00	2	buc	5	2
5120	1828	Înlocuit anvelopa camioneta C	23.00	3	BUC	11	2
5121	1828	Echilibrat janta camioneta C	25.00	4	BUC	11	2
5122	1828	Sudura janta	200.00	1	buc	16	2
5179	1852	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
5180	1852	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5412	1943	Cazare Roti complete 19''-21''	200.00	1	BUC	21	2
5413	1943	Înlocuit roata camioneta / jeep (Permutare)	25.00	4	BUC	21	2
5416	1944	Echilibrat janta Jeep (SUV)	30.00	4	BUC	24	2
5417	1944	Înlocuit anvelopa Jeep (SUV)	26.00	4	BUC	24	2
5424	1938	225/75/16C RIKEBN CSP	490.00	2	buc	6	2
5425	1938	Înlocuit anvelopa camioneta C	23.00	2	BUC	16	2
5426	1938	Echilibrat janta camioneta C	25.00	2	BUC	15	2
5427	1938	Inlocuit roata duba C (Permutare)	25.00	1	buc	15	2
5418	1939	235/50 R19 MICHELIN PRIMACY 5 ENERGY MO XL 103W	900.00	2	buc	5	2
5419	1939	Înlocuit anvelopa Jeep (SUV)	26.00	2	BUC	11	2
5420	1939	Echilibrat janta Jeep (SUV)	30.00	2	BUC	10	2
5429	1946	Echilibrat janta aliaj turism	24.00	4	BUC	23	2
5440	1945	SET PLACUTE FRANA 0986494613	220.00	1	buc	6	2
5441	1945	MANOPERA	300.00	1	buc	6	2
5442	1945	AVANS 200	-220.00	1	buc	6	2
5443	1947	PIULITA M12X1.5	15.00	20	buc	6	2
5444	1947	Echilibrat janta aliaj turism	19.00	4	BUC	21	2
5445	1949	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
5446	1950	Verificare geometrie	120.00	1	buc	18	2
5447	1951	Echilibrat janta aliaj turism	19.00	4	BUC	25	2
5448	1948	275/35 R20 MICHELIN PILOT SPORT 4S XL 102Y	1230.00	2	buc	5	2
5449	1948	245/40 R20 MICHELIN PILOT SPORT 4S XL 99Y	1170.00	2	buc	5	2
5450	1948	AVANS	-2000.00	1	buc	5	2
5451	1948	Înlocuit anvelopa	23.00	4	BUC	22	2
5452	1948	Echilibrat janta aliaj turism	26.00	4	BUC	22	2
5453	1948	Îndreptat jantă aliaj	120.00	3	buc	22	2
5454	1952	Înlocuit anvelopa Jeep (SUV)	18.00	4	BUC	23	2
5455	1952	Echilibrat janta Jeep (SUV)	19.00	4	BUC	23	2
5456	1952	Cazare Roti complete 13'' - 16''	150.00	1	BUC	23	2
5457	1952	Coliere	0.50	8	buc	23	2
5458	1953	Turisme / SUV 13"-18" inch	250.00	1	BUC	19	2
5459	1916	Înlocuit anvelopa	23.00	4	BUC	21	2
5460	1916	Cazare Anvelope 19''-21''	150.00	1	BUC	21	2
5461	1916	SPALAT AUTO	30.00	1	buc	1	2
5462	1916	Echilibrat janta Jeep (SUV)	30.00	4	BUC	21	2
5463	1954	Verificare geometrie	120.00	1	buc	18	2
5464	1955	Înlocuit anvelopa	15.00	4	BUC	27	2
5465	1955	Echilibrat janta aliaj turism	19.00	4	BUC	27	2
5466	1956	Înlocuit anvelopa	18.00	4	BUC	25	2
5467	1956	Echilibrat janta aliaj turism	24.00	4	BUC	25	2
5468	1957	Cazare Anvelope 19''-21''	150.00	1	BUC	24	2
5469	1957	Echilibrat janta Jeep (SUV)	40.00	4	BUC	24	2
5470	1957	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	24	2
5471	1958	Înlocuit anvelopa Jeep (SUV)	20.00	4	BUC	22	2
5472	1958	Echilibrat janta Jeep (SUV)	24.00	4	BUC	22	2
5473	1958	Inlocuit valva turism tubeless	6.00	4	buc	22	2
5476	1960	Cazare Anvelope 13'' - 16''	120.00	1	BUC	22	2
5477	1960	Echilibrat janta aliaj turism	19.00	4	BUC	22	2
5478	1960	Înlocuit anvelopa	15.00	4	BUC	22	2
5479	1960	CAPAC PREZON P0321601173AZ37	6.00	3	buc	22	2
5480	1959	Înlocuit anvelopa Jeep (SUV)	32.00	4	BUC	12	2
5481	1959	Echilibrat janta Jeep (SUV)	40.00	4	BUC	12	2
5482	1959	Turisme / suv 19"-24" inch	300.00	1	BUC	18	2
5483	1961	Turisme axa fata	180.00	1	BUC	17	2
\.


--
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.receipts (id, account_id, titlu, descriere, date_tehn, created_at, total, is_deleted, deleted_at, updated_at, pay_method, partial_pay, client_id, deviz_serie, deviz_nr, factura_serie, factura_nr, chitanta_serie, chitanta_nr, programare_id, location_id) FROM stdin;
2	2	Dj92Web	\N	\N	2026-03-24 07:01:51.142288+00	308.00	t	2026-03-24 14:02:49.144992+00	2026-03-24 07:02:53.342418+00	NEPLATIT	\N	\N	AS26D	2		0		0	\N	\N
1245	2	B953BCE	\N	4 ANVELOPE RIKEN 205 55 16 DOT 30 22 MM 7	2026-04-20 05:46:18.543392+00	256.00	f	\N	2026-04-20 05:47:39.891274+00	CARD	\N	809	ASC-D	927		0		0	\N	2
37	2	DJ 94 WON RAIMAN AIMAN	anv montate pirelli p zero 265 40 20 mm 5 5 6 6 presiune 2,5 fata spate nm 140 \n custodie anv  jante capace michelin alpin 5 265 40 20 2722 mm 5 5 5 5	\N	2026-03-25 09:36:44.677793+00	575.00	f	\N	2026-03-25 09:39:17.733112+00	OP	\N	\N	AS26D	25		0		0	\N	\N
1	2	Test	\N	\N	2026-03-24 00:41:28.896601+00	630.00	t	2026-03-24 07:51:12.405878+00	2026-03-24 00:42:12.660922+00	NEPLATIT	\N	1	AS26D	1		0		0	\N	\N
1275	2	DJ37BNC	\N	\N	2026-04-20 08:42:48.944363+00	250.00	f	\N	2026-04-20 08:46:10.949843+00	CARD	\N	840		0		0		0	\N	2
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
12	2	DJ 77 MNC	\N	\N	2026-03-24 10:45:41.225409+00	2000.00	t	2026-04-08 18:07:04.60031+00	2026-03-24 12:40:42.44698+00	CASH	\N	\N	AS26D	7		0		0	\N	\N
44	2	dj 79 ayn	\N	\N	2026-03-25 10:22:03.595337+00	136.00	f	\N	2026-03-25 10:23:42.895883+00	CASH	\N	\N	AS26D	29		0		0	\N	\N
43	2	DJ 21 YCE	\N	\N	2026-03-25 10:21:32.709337+00	3000.00	t	2026-03-25 10:37:29.547531+00	2026-03-25 10:22:00.336825+00	NEPLATIT	\N	\N		0		0		0	\N	\N
42	2	DJ17RJF	\N	\N	2026-03-25 10:20:51.778015+00	7756.00	f	\N	2026-03-25 10:47:31.531638+00	OP	\N	10	AS26D	32		0		0	\N	\N
49	2	DB 36 AXS HYUNDAI SEBI 0729133632 KM 6.500	anv client 225 45 17 michelin primacy 4 mm 7 7 7 7 presiune 2.3 fata spate nm 120	\N	2026-03-25 10:59:22.771219+00	168.00	f	\N	2026-03-25 11:03:21.428249+00	CASH	\N	\N	AS26D	33		0		0	\N	\N
50	2	DB12WBY	225 -50-17-KUMHOWP52+Mm 7\nDot 2125_\n4 anv 4aliajFARA. CAPCE\n\nmontat 225/50/7 /firestone roadhawk -4 buc	\N	2026-03-25 11:12:49.964543+00	360.00	f	\N	2026-03-25 11:21:05.296804+00	CARD	\N	11	AS26D	34		0		0	\N	\N
47	2	dj04eca	\N	\N	2026-03-25 10:31:29.564156+00	130.00	f	\N	2026-03-25 14:17:02.530565+00	CARD	\N	\N	AS26D	31		0		0	\N	\N
13	2	DJ 77 MNC	\N	\N	2026-03-24 10:50:58.219614+00	2292.00	t	2026-04-08 18:07:04.60031+00	2026-03-24 14:09:07.830428+00	CASH	\N	\N	AS26D	10		0		0	\N	\N
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
1246	2	SB57CCI	\N	\N	2026-04-20 05:55:03.164224+00	192.00	f	\N	2026-04-20 05:58:45.272147+00	CARD	\N	814		0		0		0	\N	2
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
1247	2	DJ90VFM	\N	\N	2026-04-20 06:01:34.751815+00	96.00	f	\N	2026-04-20 06:02:17.536571+00	CASH	\N	815	ASC-D	929		0		0	\N	2
142	2	FORD DJ 25 MCM	NOKIAN TYRES WR SNOW 215/55/17 6mm dot=2421 (cust 4anvelope,4 jante aliaj,4 capace centru)\nCONTINENTAL ULTRACONTACT 235/45/18 7mm 2,40 bari( sau montat)	\N	2026-03-27 06:58:05.306163+00	256.00	f	\N	2026-03-27 06:58:42.285671+00	CARD	\N	40	AS26D	114		0		0	\N	\N
1458	2	DJ21BAO	\N	ANVELOPELE NU MAI RAMAN IN CUSTOPDIE	2026-04-22 05:54:16.137609+00	136.00	f	\N	2026-04-22 05:56:12.987676+00	CARD	\N	1005		0		0		0	\N	2
1278	2	DJ13CLP	\N	ANVELOPE CLIENT HANKOOK 195/65/15 8MM	2026-04-20 08:59:13.060302+00	156.00	f	\N	2026-04-20 09:00:11.930894+00	CARD	\N	842	ASC-D	946		0		0	\N	2
1280	2	DJ25ELP	\N	\N	2026-04-20 09:15:30.832771+00	300.00	f	\N	2026-04-20 09:19:19.231455+00	CASH	\N	844	ASC-D	947		0		0	\N	2
1306	2	DJ59KLN	\N	\N	2026-04-20 11:28:10.012426+00	96.00	f	\N	2026-04-20 11:30:35.449443+00	CARD	\N	866	ASC-D	963		0		0	\N	2
1479	2	B118SVV	\N	4 ANVELOPE CUSTODIE 225 65 16 C MM 6 2 SI 2 RECOMAND SCHIMABREA ADU 4 MM DOT 33 25	2026-04-22 08:40:56.050866+00	312.00	f	\N	2026-04-22 08:42:42.405912+00	CARD	\N	1027	ASC-D	1096		0		0	\N	2
1324	2	DJ95MUS	\N	ANV CLIENT PIRELLI SCORPION VERDE 295 40 22 MM 6 6 7 7 PRESIUNE FATA SPATE 2,4 NM 160	2026-04-20 12:55:13.421305+00	608.00	f	\N	2026-04-20 12:56:48.795364+00	CARD	\N	883	ASC-D	973		0		0	\N	2
1620	2	DJ90GRB	\N	\N	2026-04-24 07:07:14.140147+00	1046.00	f	\N	2026-04-24 07:42:16.994334+00	OP	\N	1169	ASC-D	1224		0		0	\N	2
1327	2	DJ18DKS	\N	\N	2026-04-20 13:05:12.836331+00	162.00	f	\N	2026-04-20 13:06:14.203682+00	CARD	\N	880		0		0		0	\N	2
1527	2	DJ21MUM	\N	\N	2026-04-22 13:26:00.499165+00	1408.00	f	\N	2026-04-22 13:54:52.274955+00	CASH	\N	1077	ASC-D	1143		0		0	\N	2
1480	2	DJ15UVR	\N	245/45/18 MIC ALPIN5 MM4  DOT 2922    4ANV	2026-04-22 08:43:57.654447+00	308.00	f	\N	2026-04-22 08:48:10.533965+00	CASH	\N	1029	ASC-D	1097		0		0	\N	2
1328	2	DJ26SRT	\N	\N	2026-04-20 13:15:49.572735+00	220.00	f	\N	2026-04-20 13:16:48.924741+00	OP	\N	887	ASC-D	976		0		0	\N	2
1371	2	B124RUI	\N	225 65 17 BRIDGESTONE	2026-04-21 07:15:18.796487+00	176.00	f	\N	2026-04-21 07:16:44.535457+00	OP	\N	927	ASC-D	1006		0		0	\N	2
1372	2	DJ03GON	\N	KORMORAN 185/60/15 4BUC SAU MONTAT\nCUSTODIE 4ANV RIKEN SNOW 185/60/15 DOT3223 6MM 4BUC	2026-04-21 07:17:36.46599+00	256.00	f	\N	2026-04-21 07:23:12.242775+00	CARD	\N	929	ASC-D	1007		0		0	\N	2
1374	2	DJ09TEH	\N	\N	2026-04-21 07:26:40.787782+00	238.00	f	\N	2026-04-21 07:28:30.454197+00	CASH	\N	931		0		0		0	\N	2
1541	2	DJ23AEI	\N	4ANV CONTINENTAL215\\55\\17 6MM 4JANTEALIAJDOT2522	2026-04-23 05:51:11.841928+00	232.00	f	\N	2026-04-23 05:53:33.640135+00	CARD	\N	1086	ASC-D	1151		0		0	\N	2
1397	2	DJ70UOI	\N	\N	2026-04-21 09:12:02.498311+00	760.00	f	\N	2026-04-21 09:27:38.654818+00	CARD	\N	\N	ASC-D	1026		0		0	\N	2
1482	2	DJ66FRZ	\N	PROBLEME CU SUSPENSIA	2026-04-22 08:51:20.177861+00	300.00	f	\N	2026-04-22 08:55:33.897538+00	CASH	\N	1031	ASC-D	1100		0		0	\N	2
1634	2	DJ15KTM	\N	ANV CLIENT ANTARES 275/55/20 4BUC SAU MONTAT\nCUSTODIE NOUA 4ANV TROCMAH X-PRIVILO 275/55/20 DOT3524 6MM 4BUC	2026-04-24 08:08:40.167681+00	374.00	f	\N	2026-04-24 08:18:16.996459+00	OP	\N	1172	ASC-D	1227		0		0	\N	2
1402	2	DJ18LMS	\N	\N	2026-04-21 09:34:54.070689+00	1100.00	f	\N	2026-04-21 11:27:19.781557+00	OP	\N	956	ASC-D	1046		0		0	\N	2
1575	2	DJ88GBL	\N	\N	2026-04-23 10:17:04.871123+00	300.00	f	\N	2026-04-23 10:27:45.922697+00	CARD	\N	1119		0		0		0	\N	2
1558	2	DJ27DEB	\N	ANVELOPELE PE FATA AU DOT 4911 MONTATE CU ACORDUL CLIENTULUI.RECOMAND INLOCUIREA LOR\n275 40 20 SPATE \n245 45 20 FATA CONTINENTAL	2026-04-23 08:19:51.476448+00	311.00	f	\N	2026-04-23 10:33:26.030958+00	CASH	\N	\N		0		0		0	\N	2
1420	2	DJ22FAG	\N	\N	2026-04-21 11:29:41.509023+00	610.00	f	\N	2026-04-21 12:06:12.585968+00	CASH	\N	952	ASC-D	1047		0		0	\N	2
1484	2	B33YWU	\N	\N	2026-04-22 08:51:40.801692+00	2552.00	f	\N	2026-04-22 09:51:11.91834+00	CARD	\N	1036	ASC-D	1110		0		0	\N	2
1442	2	DJ77RKK	\N	ANV MONTATE HANKOOK VENTUS EVO 215 60 17 MM 6 6 4 4 PRESIUNE FATA SPATE 2,3 NM 110	2026-04-21 13:11:26.448311+00	176.00	f	\N	2026-04-21 13:11:40.100306+00	CASH	\N	991	ASC-D	1062		0		0	\N	2
1689	2	B223RAX	\N	CONTINENTAL 235/50/19 6MM\n\n\nMICHELIN ALPIN 7 235/50/19 7MM DOT=2524 ( CUSTODIE 4 ANVELOPE )	2026-04-24 13:33:21.017597+00	366.00	f	\N	2026-04-24 13:35:16.632841+00	CARD	\N	1228	ASC-D	1265		0		0	\N	2
1501	2	DJ48EKO	\N	CONTINELTA 205 70 16C	2026-04-22 10:41:19.537944+00	428.00	f	\N	2026-04-22 10:42:00.375175+00	OP	\N	1050	ASC-D	1116		0		0	\N	2
1594	2	B302MNX	\N	\N	2026-04-23 12:44:43.24425+00	132.00	f	\N	2026-04-23 12:51:21.069401+00	OP	\N	1140	ASC-D	1193		0		0	\N	2
1522	2	OT75FAR	\N	ANV MONTATE HANKOOK VENTUS S1 EVO 235 50 19 MM6 6 6 6 PRESIUNE FATA SPATE 2,5 NM, 120 \nCUSTODIE ANV JANTRE  CAPACE 235 55  18 CONTINENTAL WINTER CONTACT TS870 MM 6 6 6 6 DOT	2026-04-22 13:20:41.120151+00	280.00	f	\N	2026-04-22 13:24:30.177833+00	CASH	\N	1070	ASC-D	1137		0		0	\N	2
1613	2	DJ04ELP	\N	ANVELOPE CLIENT\n\nMICHELIN 255/45/20 ( ANV UZATESI IMBATRANITE )	2026-04-24 06:30:09.377869+00	120.00	f	\N	2026-04-24 09:07:25.520368+00	OP	\N	\N	ASC-D	1231		0		0	\N	2
1651	2	DJ50HPY	\N	ANVELOPE CLIENT \n\nMICHELIN 215/65/17 8MM	2026-04-24 09:55:38.76083+00	200.00	f	\N	2026-04-24 09:56:15.464196+00	CARD	\N	1191	ASC-D	1236		0		0	\N	2
1600	2	DJ37DRC	\N	\N	2026-04-23 13:23:03.363213+00	196.00	f	\N	2026-04-23 13:24:24.526907+00	CARD	\N	1145	ASC-D	1199		0		0	\N	2
1601	2	DJ02EXL	\N	\N	2026-04-23 13:29:32.434022+00	176.00	f	\N	2026-04-23 13:30:15.404787+00	CASH	\N	1146	ASC-D	1200		0		0	\N	2
1615	2	DJ05SHY	\N	\N	2026-04-24 06:38:59.76873+00	180.00	f	\N	2026-04-24 06:43:02.539729+00	CARD	\N	1155		0		0		0	\N	2
1706	2	B111NDF	\N	MICHELIN PA5 285/40/22 6MM DOT=3924\nMICHELIN PA5 325/35/22 6MM DOT=1624 ( CUSTODIE 4 ANVELOPE )	2026-04-27 07:00:46.081267+00	468.00	f	\N	2026-04-27 07:01:45.631658+00	CARD	\N	1244	ASC-D	1279		0		0	\N	2
1667	2	DJ54KTL	\N	ROTI COMPLETE CLIENT UNIROYAL 205/60/17C 4BUC SAU MONTAT	2026-04-24 11:32:21.047445+00	100.00	f	\N	2026-04-24 11:35:21.325199+00	CARD	\N	1207		0		0		0	\N	2
1700	2	DJ10FGH	\N	\N	2026-04-27 06:08:19.542597+00	132.00	f	\N	2026-04-27 06:12:25.761558+00	CARD	\N	1237	ASC-D	1275		0		0	\N	2
1683	2	DJ22TXR	\N	\N	2026-04-24 13:01:41.140953+00	176.00	f	\N	2026-04-24 13:04:08.79201+00	CASH	\N	1217	ASC-D	1261		0		0	\N	2
1694	2	DJ77XWA	\N	\N	2026-04-24 14:09:30.728079+00	268.00	f	\N	2026-04-24 14:13:24.993264+00	CARD	\N	1231	ASC-D	1269		0		0	\N	2
1704	2	DJ15DGR	\N	4ANV 195\\65\\15 KUMHO 6MM DOT2323	2026-04-27 06:36:03.314409+00	252.00	f	\N	2026-04-27 06:37:54.42783+00	CASH	\N	1240	ASC-D	1277		0		0	\N	2
1710	2	DJ28KIK	\N	CUSTODIE 4ANV 4JANTE ALIAJ MICHELIN ALP 7 205 60 16 DOT 2925 MM 7	2026-04-27 07:09:17.928361+00	2930.00	f	\N	2026-04-27 08:31:21.789452+00	CARD	\N	1261	ASC-D	1291		0		0	\N	2
1705	2	DJ52DAL	\N	CUSTODIE 4ANV MICHELIN PILOT ALPIN5 215/55/18 DOT2722 MM6\nMONTATE 4ANV KUMHO 215/55/18	2026-04-27 06:40:51.291012+00	316.00	f	\N	2026-04-27 06:41:43.479156+00	CARD	\N	1243	ASC-D	1278		0		0	\N	2
1703	2	DJ11BEK	\N	\N	2026-04-27 06:34:17.804879+00	3500.00	f	\N	2026-04-27 07:05:37.508874+00	OP	\N	1248	ASC-D	1282		0		0	\N	2
1709	2	B234DAL	\N	ANV CLIENT GOODYEAR ASIMETRIC 3 215 55 17 MM 6 6 6 6  PRESIUNE FATA SPATE 2,4 NM 120	2026-04-27 07:02:44.111645+00	168.00	f	\N	2026-04-27 07:03:53.038975+00	OP	\N	1247	ASC-D	1280		0		0	\N	2
1708	2	DJ33DKW	\N	\N	2026-04-27 07:02:24.6182+00	132.00	f	\N	2026-04-27 07:04:47.52561+00	CASH	\N	1246		0		0		0	\N	2
1707	2	DJ99WZV	\N	CUSTODIE 4 ANV 4JANTE ALIAJ 4CAPACE NOKIAN WR 215 60 17 DOT 2618 MM 5\nMONTAT BRIDGESTONE 215 60 17	2026-04-27 07:01:25.610575+00	256.00	f	\N	2026-04-27 07:04:24.519252+00	CARD	\N	1245	ASC-D	1281		0		0	\N	2
1697	2	OT73AWA	\N	FALKEN 205 55 16	2026-04-27 05:47:27.481177+00	76.00	f	\N	2026-04-27 14:25:50.420089+00	CASH	\N	1236	ASC-D	1272		0		0	\N	2
1711	2	DJ017538	\N	\N	2026-04-27 07:23:29.310753+00	1108.00	f	\N	2026-04-27 07:49:39.816204+00	CARD	\N	1254	ASC-D	1286		0		0	\N	2
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
352	2	dj 94 bgv	\N	michelin 235 50 19	2026-04-01 06:01:50.746125+00	324.00	f	\N	2026-04-01 06:03:35.583864+00	CARD	\N	101	ASC-D	260		0		0	\N	2
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
1321	2	DJ19EMT	\N	\N	2026-04-20 12:39:53.070739+00	3200.00	t	2026-04-20 13:00:48.026824+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
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
1326	2	DJ21DIU	\N	\N	2026-04-20 13:03:39.368839+00	180.00	f	\N	2026-04-20 13:07:11.975343+00	CASH	\N	885	ASC-D	975		0		0	\N	2
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
345	2	TM88TYH	\N	Strangere roti 90N	2026-03-31 22:42:12.210443+00	60.00	t	2026-03-31 22:44:56.879758+00	2026-03-31 22:42:39.125896+00	NEPLATIT	\N	\N	ASC-D	256		0		0	\N	2
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
329	2	OT 33 LYL	\N	\N	2026-03-31 12:05:53.044579+00	1280.00	f	\N	2026-03-31 13:41:08.842271+00	CARD	\N	91	ASC-D	253		0		0	\N	2
327	2	DJ50WXX	custodie 3 anvelope\n2buc 315 30 22 dot 2022 mm5 pirelli pzero\n1buc 275 35 22 dot 1622mm5 pirelli pzero	\N	2026-03-31 11:40:50.93257+00	8679.00	f	\N	2026-03-31 14:35:59.278731+00	CASH	\N	92	ASC-D	242		0		0	\N	2
332	2	DJ77VNS	\N	\N	2026-03-31 12:29:57.503779+00	2860.00	t	2026-03-31 14:36:55.150122+00	2026-03-31 12:38:00.508639+00	NEPLATIT	\N	\N	ASC-D	245		0		0	\N	2
344	2	DJ17PUC	\N	\N	2026-03-31 14:06:47.007755+00	192.00	f	\N	2026-03-31 14:07:46.044873+00	CASH	\N	98		0		0		0	\N	2
334	2	DJ97KON	BRIDGESTONE blizak 235/60/18 3-4mm dot 3520 (cust. 4 anv.,4 jante aliaj)	\N	2026-03-31 12:41:54.044754+00	3944.00	f	\N	2026-04-01 05:41:36.718306+00	OP	\N	94	ASC-D	247		0		0	\N	2
346	2	b 856 mth	\N	4 anv client goodiear 205 60 16	2026-04-01 05:35:52.154557+00	136.00	f	\N	2026-04-01 05:41:07.604672+00	OP	\N	99	ASC-D	257		0		0	\N	2
349	2	DJ35MTH	\N	anv client michelin primacy  4  205 60 16 mm 6 6 6 6 presiune  2,4 nm  120	2026-04-01 05:48:03.640196+00	136.00	f	\N	2026-04-01 05:51:06.845879+00	OP	\N	100	ASC-D	259		0		0	\N	2
348	2	dj 45 mth	\N	\N	2026-04-01 05:47:50.53874+00	136.00	f	\N	2026-04-01 05:50:06.943252+00	OP	\N	\N	ASC-D	258		0		0	\N	2
350	2	B389CFH	\N	\N	2026-04-01 05:50:42.803138+00	180.00	f	\N	2026-04-01 06:03:23.612413+00	CARD	\N	\N		0		0		0	\N	2
353	2	DJ12KDG	\N	\N	2026-04-01 06:05:14.95745+00	250.00	f	\N	2026-04-01 13:26:06.996046+00	CASH	\N	\N		0		0		0	\N	2
357	2	DJ12HBV	\N	\N	2026-04-01 06:22:46.256233+00	216.00	f	\N	2026-04-01 06:23:56.466289+00	OP	\N	\N	ASC-D	264		0		0	\N	2
355	2	dj 01 mth	\N	\N	2026-04-01 06:11:30.417931+00	160.00	f	\N	2026-04-01 06:16:17.686961+00	OP	\N	\N	ASC-D	263		0		0	\N	2
1485	2	DJ18AZV	\N	ANV MONTATE RODAX RX  MOTIONE 225 45 18 245 40 18 MM8 8 8 8                     PRESIUNE FATA SPATE 2,4 NM 120 \nANV CUSTODIE     MICHELIN ALPIN 5 225 50 17 MM 4 4 4 4 DOT3013	2026-04-22 08:59:44.790146+00	328.00	f	\N	2026-04-22 09:04:21.997633+00	CARD	\N	1033	ASC-D	1103		0		0	\N	2
1443	2	DJ20CDE	\N	HANKOOK 215 65 17	2026-04-21 13:12:25.835102+00	176.00	f	\N	2026-04-21 13:13:46.413038+00	CARD	\N	992		0		0		0	\N	2
1250	2	DJ08ZAM	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4CAPACE 20 PREZOANE MICH ALP 5 215 65 16 DOT 3817 MM 5\nMONTAT MICHELIN 235 55 17	2026-04-20 06:07:47.505404+00	246.00	f	\N	2026-04-20 06:09:06.955081+00	CARD	\N	817	ASC-D	930		0		0	\N	2
1251	2	DJ82MOM	\N	ANV CLIENT KORMORAN ROAD 175 65 14 MM 7 7 7 7 PRESIUNE FATA SPATE 2,2 NM 110	2026-04-20 06:10:35.274834+00	58.00	f	\N	2026-04-20 06:11:46.833738+00	CARD	\N	818		0		0		0	\N	2
1319	2	DJ07GTB	\N	\N	2026-04-20 12:27:05.323299+00	1176.00	f	\N	2026-04-20 14:39:17.395065+00	CASH	\N	889	ASC-D	986		0		0	\N	2
1279	2	SB74CON	\N	ANV CLIENT PIRELLI PY4 245 45 20 275 40 20 MM 8 8 8 8 PRESIUNE FATA SPATE 2,4 NM 140	2026-04-20 09:02:11.008969+00	406.00	f	\N	2026-04-20 09:03:25.885126+00	CARD	\N	843		0		0		0	\N	2
1281	2	DJ28NNN	\N	\N	2026-04-20 09:20:00.322758+00	176.00	f	\N	2026-04-20 09:20:37.071211+00	CARD	\N	845		0		0		0	\N	2
1331	2	DJ12TLX	\N	\N	2026-04-20 13:25:34.17226+00	140.00	f	\N	2026-04-20 14:48:42.146631+00	CASH	\N	890		0		0		0	\N	2
1276	2	DJ01LDF	\N	\N	2026-04-20 08:52:17.73653+00	216.00	f	\N	2026-04-20 09:58:02.684734+00	CASH	\N	\N	ASC-D	950		0		0	\N	2
1277	2	DJ76WAY	\N	\N	2026-04-20 08:54:47.454523+00	2320.00	f	\N	2026-04-20 09:59:57.752662+00	CARD	\N	\N	ASC-D	948		0		0	\N	2
1297	2	DJ65NTY	\N	HANKOOK VENTUS 205 60 16 MM 8 8 8 8 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-20 10:43:13.05676+00	136.00	f	\N	2026-04-20 11:36:28.632914+00	CASH	\N	867	ASC-D	964		0		0	\N	2
1504	2	DJ07XYA	\N	2 ANVELOPE 225 45 18 2 ANVELOPE 255 40 18 MICHELIN	2026-04-22 10:55:04.908777+00	168.00	f	\N	2026-04-22 11:01:21.064428+00	CASH	\N	1053	ASC-D	1119		0		0	\N	2
1486	2	B79ZND	\N	\N	2026-04-22 09:01:39.179546+00	120.00	f	\N	2026-04-22 09:07:52.382563+00	CARD	\N	\N	ASC-D	1102		0		0	\N	2
1330	2	DJ08WRM	\N	ANV CLIENT  BRIDGESTONE ECOPIA 205 55 16 MM 7 7  77 PRESIUNE FATA SPATE 2,4 NM 110	2026-04-20 13:24:00.441101+00	136.00	f	\N	2026-04-20 13:26:12.668931+00	CASH	\N	888		0		0		0	\N	2
1376	2	DJ21MXM	\N	225 60 18 DUNLOP	2026-04-21 07:49:18.101007+00	176.00	f	\N	2026-04-21 07:49:58.435451+00	CASH	\N	934	ASC-D	1012		0		0	\N	2
1332	2	B993AXC	\N	225 65 17 BRIDGESTONE	2026-04-20 13:26:20.625726+00	176.00	f	\N	2026-04-20 13:27:54.289883+00	CARD	\N	891		0		0		0	\N	2
1461	2	MH07SRZ	\N	ANVELOPE CLIENT \nMICHELIN PRIMACY 5 215/60/17 8MM	2026-04-22 06:29:19.718656+00	188.00	f	\N	2026-04-22 06:32:00.712872+00	CARD	\N	1009	ASC-D	1078		0		0	\N	2
1335	2	DJ11AIV	\N	ANVELOPE CLIENT\nMICHELIN 175/65/14 6MM	2026-04-20 13:29:31.364533+00	104.00	f	\N	2026-04-20 13:42:20.97485+00	CASH	\N	892	ASC-D	979		0		0	\N	2
1377	2	DJ02NYH	\N	4JANTE OTEL 4CAPACE ROATA 3ANV MICHELIN 5MM  DOT4117 1SEMPERITO 5MM DOT 3121	2026-04-21 07:59:40.607397+00	226.00	f	\N	2026-04-21 08:02:01.633751+00	CASH	\N	935	ASC-D	1013		0		0	\N	2
1339	2	DJ83ARG	\N	ANV CLIENT MICHELIN PRIMACY 5 235 55 17 MM 7 7 7 7  PRESIUNE FATA SPATE 2,4 NM 120	2026-04-20 13:50:28.587015+00	176.00	f	\N	2026-04-20 13:51:30.280013+00	CARD	\N	899	ASC-D	981		0		0	\N	2
1382	2	GJ88MRG	\N	\N	2026-04-21 08:10:33.535426+00	75.00	f	\N	2026-04-21 08:12:45.571069+00	CARD	\N	939	ASC-D	1017		0		0	\N	2
1334	2	B392WOW	\N	\N	2026-04-20 13:27:57.426712+00	10300.00	f	\N	2026-04-20 14:19:48.93789+00	OP	\N	901	ASC-D	984		0		0	\N	2
1523	2	DJ76ZEN	\N	\N	2026-04-22 13:22:08.017267+00	142.00	f	\N	2026-04-22 13:36:41.684745+00	CARD	\N	1068	ASC-D	1138		0		0	\N	2
1384	2	DJ96EPS	\N	\N	2026-04-21 08:27:23.581074+00	76.00	f	\N	2026-04-21 08:28:51.845902+00	CARD	\N	942		0		0		0	\N	2
1502	2	DJ88BUM	\N	ANV MONTATE KUMHO ECSTA 235 60 17 MM 7 7 6 6  PRESIUNE FATA SPATE 2,4  NM 140 \nCUSTODIE ANV JANTE CAPACE NOKIAN WR SUV4 235 60 17 MM 7 7 7 7  5119	2026-04-22 10:43:54.023545+00	256.00	f	\N	2026-04-22 10:46:19.155125+00	CASH	\N	1051	ASC-D	1117		0		0	\N	2
1398	2	RAIL3190	\N	\N	2026-04-21 09:13:48.12997+00	250.00	f	\N	2026-04-21 09:16:53.083465+00	CASH	\N	953	ASC-D	1027		0		0	\N	2
1466	2	B06EJO	\N	\N	2026-04-22 07:09:20.992592+00	3188.00	f	\N	2026-04-22 08:16:02.973354+00	CARD	\N	1020	ASC-D	1093		0		0	\N	2
1400	2	B611BKT	\N	ANV CLIENT HANKOOK 205/60/16 4BUC SAU MONTAT	2026-04-21 09:17:49.846377+00	136.00	f	\N	2026-04-21 09:18:44.047733+00	CARD	\N	954	ASC-D	1028		0		0	\N	2
1399	2	DJ91MXC	\N	CUSTODIE 4 ANV HANKOOK WINTER ICEPT EVO3 245 40 18 DOT 1924 MM6\nMONTAT HANKOOK VENTUS 245 40 18	2026-04-21 09:14:25.373033+00	332.00	f	\N	2026-04-21 11:07:09.171993+00	CASH	\N	\N	ASC-D	1029		0		0	\N	2
1507	2	DJ19ZIC	\N	\N	2026-04-22 11:29:13.813761+00	180.00	f	\N	2026-04-22 11:31:57.080364+00	CASH	\N	1055	ASC-D	1122		0		0	\N	2
1481	2	DJ12DAN	\N	\N	2026-04-22 08:45:22.233659+00	76.00	f	\N	2026-04-22 08:50:54.748339+00	CASH	\N	1030	ASC-D	1098		0		0	\N	2
1421	2	DJ50ASI	\N	\N	2026-04-21 11:35:07.473193+00	176.00	f	\N	2026-04-21 11:36:15.982682+00	CARD	\N	970	ASC-D	1048		0		0	\N	2
1503	2	DJ09STM	\N	6 ANVELOPE CUSTODIE MICHELIN 195 75 16 C DOT 32 22	2026-04-22 10:46:36.968471+00	308.00	f	\N	2026-04-22 10:50:12.43511+00	CARD	\N	1052	ASC-D	1118		0		0	\N	2
1525	2	B160JCB	\N	\N	2026-04-22 13:24:54.632184+00	192.00	f	\N	2026-04-22 13:51:23.576325+00	CARD	\N	1073	ASC-D	1141		0		0	\N	2
1460	2	DJ11DOZ	\N	\N	2026-04-22 06:26:28.650761+00	1140.00	f	\N	2026-04-22 11:39:34.288396+00	OP	\N	1010	ASC-D	1124		0		0	\N	2
1595	2	DJ12JLI	\N	CUSTODIE 4 ANV 4JANTE ALIAJ GOODIEAR ULTRA GRIP 3BUC MICHELIN ALP 1BUC 255 55 18 DOT 3121 MM 5\nMONTAT 265 45 20 BRIDGESTONE	2026-04-23 12:48:14.148385+00	280.00	f	\N	2026-04-23 12:48:42.961832+00	CASH	\N	1141	ASC-D	1192		0		0	\N	2
1577	2	DJ73GMC	\N	ANV CLIENT HANKOOK 245/45/18 4BUC	2026-04-23 10:44:00.030208+00	168.00	f	\N	2026-04-23 10:46:08.676005+00	CASH	\N	1122	ASC-D	1177		0		0	\N	2
1528	2	DJ12GPX	\N	ANVELOPE CLIENT\nDUNLOP 265/45/21 2-4 MM 2,5 BARI\n- ANVELOPELE SAU MONTATVLA CEREREA CLIENTULUI\n- RECOMAND INLOCUIREA ANVELOPELOR	2026-04-22 13:27:43.125283+00	264.00	f	\N	2026-04-22 13:30:58.832789+00	CARD	\N	1074		0		0		0	\N	2
1542	2	DJ21HER	\N	215 60 17 CONTINENTAL	2026-04-23 05:51:16.224281+00	176.00	f	\N	2026-04-23 05:52:02.158132+00	CARD	\N	1090	ASC-D	1150		0		0	\N	2
1574	2	DJ15LMS	\N	\N	2026-04-23 10:13:09.080105+00	1132.00	f	\N	2026-04-23 11:01:03.613416+00	OP	\N	1124	ASC-D	1180		0		0	\N	2
1578	2	CJ54BTH	\N	205 /55/16  SEMPERIT SPEED GRIP5 MM6   DOT 4622     4 ANV	2026-04-23 10:52:32.928677+00	256.00	f	\N	2026-04-23 10:54:01.398615+00	OP	\N	1123	ASC-D	1178		0		0	\N	2
1559	2	DJ64YVA	\N	\N	2026-04-23 08:19:58.967979+00	168.00	f	\N	2026-04-23 08:22:25.450079+00	CARD	\N	1104	ASC-D	1166		0		0	\N	2
1614	2	DJ27VVV	\N	CUSTODIE 245/40/19 MICHELIN PILOT ALPIN5 2BUC 275/35/10 2BUC 4JANTE ALIAJ+4ANV+4CAPACE\nROTTI COMPLETE MICHELIN 275/30/20 2BUC 245/35/20 2BUC SAU MONTAT	2026-04-24 06:31:19.68909+00	630.00	f	\N	2026-04-24 06:33:54.184308+00	CARD	\N	1157	ASC-D	1208		0		0	\N	2
1597	2	DJ08KVG	\N	ANV CLIENT CONTINENTAL 195/60/15 4ANV SAU MONTAT	2026-04-23 13:05:36.011014+00	160.00	f	\N	2026-04-23 13:13:33.722835+00	CARD	\N	1143	ASC-D	1194		0		0	\N	2
1635	2	IF09JCB	\N	\N	2026-04-24 08:20:00.956847+00	192.00	f	\N	2026-04-24 08:25:08.585639+00	CARD	\N	1174		0		0		0	\N	2
1619	2	MHA	\N	\N	2026-04-24 07:06:44.636142+00	1450.00	f	\N	2026-04-24 08:23:08.972253+00	CARD	\N	1165	ASC-D	1217		0		0	\N	2
1637	2	DJ35NOW	\N	\N	2026-04-24 08:29:01.051441+00	3740.00	t	2026-04-24 09:30:25.57595+00	\N	NEPLATIT	\N	1177		0		0		0	\N	2
1652	2	OT25TAX	\N	245 35 19 BUC 2 275 30 19 BUC 2 HANKOOK	2026-04-24 09:57:54.527742+00	643.00	f	\N	2026-04-24 09:58:27.874156+00	CASH	\N	1192	ASC-D	1237		0		0	\N	2
1669	2	B580DEM	\N	\N	2026-04-24 11:47:25.090386+00	120.00	f	\N	2026-04-24 12:46:43.835114+00	OP	\N	1209	ASC-D	1257		0		0	\N	2
1691	2	AG27PPA	\N	\N	2026-04-24 13:46:21.899929+00	250.00	f	\N	2026-04-24 13:55:19.428558+00	CARD	\N	1230	ASC-D	1267		0		0	\N	2
372	2	DJ25DZG	\N	\N	2026-04-01 08:14:08.207444+00	250.00	f	\N	2026-04-01 08:19:51.662703+00	CASH	\N	\N		0		0		0	\N	2
356	2	DJ30MTH	\N	anv client  michelin  primacy  185 65 15 mm 2 2 2 2 presiune 2, 2nm 110 anv terminate jante ovalizate	2026-04-01 06:14:04.816255+00	132.00	f	\N	2026-04-01 06:15:54.251792+00	OP	\N	\N	ASC-D	262		0		0	\N	2
382	2	djh15ljik	\N	\N	2026-04-01 09:17:06.447347+00	150.00	t	2026-04-02 05:48:19.299148+00	\N	NEPLATIT	\N	75		0		0		0	\N	2
358	2	DJ22TNN	\N	\N	2026-04-01 06:36:31.339389+00	160.00	f	\N	2026-04-01 06:39:30.696054+00	CARD	\N	\N	ASC-D	265		0		0	\N	2
359	2	DJ03MES	\N	\N	2026-04-01 06:44:48.942622+00	180.00	f	\N	2026-04-01 06:47:44.314113+00	CASH	\N	\N		0		0		0	\N	2
1248	2	DJ53DRY	\N	\N	2026-04-20 06:03:09.568736+00	180.00	f	\N	2026-04-20 06:08:35.458444+00	CASH	\N	816		0		0		0	\N	2
374	2	B999AVN	\N	anv custodie  michelin pilot alpin  245 35 20 305 30 21  mm 7 7 7 7 dot 4125\nanv montate michelin pilot sport 4s   245 35 20 305 30 21 mm 7 7 7 7 presiune fata spate 2.3 spate 2,7 nm 160  transfer nr	2026-04-01 08:18:13.016426+00	694.00	f	\N	2026-04-01 08:21:30.37296+00	CARD	\N	105	ASC-D	274		0		0	\N	2
361	2	dj 12 zbz	\N	montat kumho 245 40 19\ncustodie 4anv 4jante aliaj 4 capace hankook winter icept rs3 225 55 17 dot 4324 mm6	2026-04-01 06:59:57.183605+00	264.00	f	\N	2026-04-01 07:00:38.557561+00	CASH	\N	103	ASC-D	266		0		0	\N	2
375	2	DJ 07 SHH	\N	MICHELIN 195/65/15 6mm 1buc\nSava 195/65/15  3mm 1buc\nSau montat 4 anvelope	2026-04-01 08:32:11.870606+00	652.00	f	\N	2026-04-01 08:32:59.519296+00	CARD	\N	\N	ASC-D	275		0		0	\N	2
363	2	DJ11TLA	\N	\N	2026-04-01 07:11:58.758155+00	300.00	f	\N	2026-04-01 07:18:58.832035+00	CARD	\N	\N	ASC-D	267		0		0	\N	2
369	2	DJ01KXN	\N	INLOCUIT FILTRE SI ULEI PIESE CLIENT MAN 250	2026-04-01 07:32:59.549299+00	386.00	f	\N	2026-04-01 08:47:16.943871+00	CASH	\N	104	ASC-D	271		0		0	\N	2
364	2	B315 RAL	\N	\N	2026-04-01 07:18:40.286595+00	192.00	f	\N	2026-04-01 07:26:10.178222+00	CASH	\N	\N	ASC-D	269		0		0	\N	2
365	2	DJ12ZBZ	\N	\N	2026-04-01 07:24:22.76961+00	180.00	f	\N	2026-04-01 07:27:08.4966+00	CASH	\N	\N		0		0		0	\N	2
367	2	OT88MDG	\N	\N	2026-04-01 07:26:36.536613+00	180.00	f	\N	2026-04-01 07:29:52.741949+00	CASH	\N	\N		0		0		0	\N	2
354	2	DJ17ION	\N	\N	2026-04-01 06:09:39.413935+00	60.00	t	2026-04-01 07:32:16.539065+00	\N	NEPLATIT	\N	102		0		0		0	\N	2
347	2	DJ67SIM	\N	glma dr spate	2026-04-01 05:40:33.169326+00	871.00	t	2026-04-01 08:48:02.080781+00	2026-04-01 06:06:30.732279+00	NEPLATIT	\N	75	ASC-D	261		0		0	\N	2
383	2	DJ 33 ASX	\N	presiune 2,4 fata spate nm 130	2026-04-01 09:17:47.259599+00	2056.00	f	\N	2026-04-01 09:47:47.013082+00	CARD	\N	110	ASC-D	278		0		0	\N	2
370	2	dj 40 mea	\N	145 40 19 alpia	2026-04-01 07:38:31.245902+00	104.00	f	\N	2026-04-01 07:46:30.834358+00	CASH	\N	\N	ASC-D	272		0		0	\N	2
371	2	DJ90MSL	\N	\N	2026-04-01 07:49:58.042831+00	120.00	f	\N	2026-04-01 07:53:55.53088+00	CASH	\N	\N		0		0		0	\N	2
394	2	dj 10 wma	\N	225 55 17 kumho	2026-04-01 10:21:28.973326+00	363.00	f	\N	2026-04-01 10:22:05.041963+00	CASH	\N	112	ASC-D	286		0		0	\N	2
390	2	OT98DAN	\N	\N	2026-04-01 09:51:05.027614+00	136.00	f	\N	2026-04-01 09:57:49.316074+00	CARD	\N	111	ASC-D	283		0		0	\N	2
362	2	OT11WAX	\N	CUSTODIE NOUA MICHELIN ALPIN7 DOT3525 7mm 4anv	2026-04-01 07:06:22.08985+00	3488.00	f	\N	2026-04-01 08:07:25.183989+00	OP	\N	64	ASC-D	273		0		0	\N	2
376	2	DJ75WMT	\N	\N	2026-04-01 08:48:04.056829+00	208.00	f	\N	2026-04-01 08:49:35.411851+00	CARD	\N	106	ASC-D	276		0		0	\N	2
386	2	dj 17 VVD	\N	245 40 19 pirelli	2026-04-01 09:28:06.180614+00	160.00	f	\N	2026-04-01 09:30:23.442835+00	CASH	\N	108	ASC-D	279		0		0	\N	2
378	2	dj 60 ctm	\N	195 75 16c giti	2026-04-01 08:50:56.647692+00	224.00	f	\N	2026-04-01 08:51:57.396473+00	OP	\N	107	ASC-D	277		0		0	\N	2
351	2	DJ67SIM	\N	\N	2026-04-01 05:53:46.543115+00	880.00	f	\N	2026-04-01 09:10:02.461782+00	CASH	\N	\N		0		0		0	\N	2
392	2	DJ 01 YBJ	\N	BRIDGESTONE 275/35/20 6mm 2,40 bari	2026-04-01 10:01:24.836957+00	360.00	f	\N	2026-04-01 10:01:54.581155+00	CARD	\N	\N		0		0		0	\N	2
368	2	DJ97CAA	\N	sau montat 4 anvelope, 2,40 bari	2026-04-01 07:30:11.827692+00	1440.00	f	\N	2026-04-02 09:25:20.184314+00	OP	\N	\N		0		0		0	\N	2
381	2	DJ45PAN	\N	\N	2026-04-01 09:12:52.941677+00	180.00	f	\N	2026-04-01 09:17:23.613976+00	CASH	\N	\N		0		0		0	\N	2
396	2	DJ 24 MNN	\N	\N	2026-04-01 10:44:39.254517+00	2776.00	f	\N	2026-04-01 11:19:18.745092+00	CARD	\N	115	ASC-D	289		0		0	\N	2
384	2	DJ07WWZ	\N	\N	2026-04-01 09:18:14.694686+00	300.00	f	\N	2026-04-01 09:20:33.221698+00	CASH	\N	\N		0		0		0	\N	2
373	2	DJ 07 SHH	\N	\N	2026-04-01 08:15:16.862257+00	520.00	t	2026-04-01 09:30:54.499966+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
385	2	dj50red	\N	\N	2026-04-01 09:24:33.512922+00	250.00	f	\N	2026-04-01 09:31:40.811458+00	CASH	\N	\N		0		0		0	\N	2
379	2	DJ09DRC	\N	\N	2026-04-01 09:05:00.49739+00	316.00	f	\N	2026-04-01 09:32:27.543256+00	OP	\N	\N	ASC-D	280		0		0	\N	2
389	2	TM-66-EWI	\N	anv client GREEN-MAX 165/70/14 4anv (montate)	2026-04-01 09:38:32.533928+00	104.00	f	\N	2026-04-01 09:40:23.07584+00	OP	\N	\N	ASC-D	281		0		0	\N	2
387	2	DJ17KZX	\N	\N	2026-04-01 09:33:00.107089+00	2768.00	f	\N	2026-04-01 10:10:19.146239+00	OP	\N	\N	ASC-D	284		0		0	\N	2
388	2	DJ60CTM	\N	\N	2026-04-01 09:33:13.413309+00	120.00	f	\N	2026-04-01 09:41:55.034329+00	OP	\N	\N	ASC-D	282		0		0	\N	2
397	2	B746CIT	\N	\N	2026-04-01 10:48:44.327847+00	300.00	f	\N	2026-04-01 10:50:34.108736+00	CARD	\N	\N	ASC-D	288		0		0	\N	2
393	2	DJ 76 WID	\N	anv client BRIDGESTONE 215/70/15C 2 anv ( montate) recomand anv	2026-04-01 10:09:59.537812+00	96.00	f	\N	2026-04-01 10:11:53.706487+00	CARD	\N	\N	ASC-D	285		0		0	\N	2
395	2	DJ13EON	\N	/custodie anv jante otel tigar winter 185 65 15 mm 6 6 6 6 dot 2417 \nanv montate conti eco contact 185 65 18 mm 7  7 7 7 presiune fata spate 2,3 nm 120	2026-04-01 10:34:03.897532+00	222.00	f	\N	2026-04-01 10:34:59.698356+00	CASH	\N	113	ASC-D	287		0		0	\N	2
399	2	DJ95TOP	\N	anv montate goodyear eagle f 1 275 45 20  mm 6 6 6 6 presiune fata spate 2,5 nm 160  se schimba nr auto \ncustodie anv jante capace conti all season  contact 2 255 60 18 mm 5 5 4 4 dot 1424	2026-04-01 11:18:24.62024+00	280.00	f	\N	2026-04-01 11:34:40.020817+00	CARD	\N	117	ASC-D	293		0		0	\N	2
402	2	DJ13XEM	\N	\N	2026-04-01 11:20:52.949596+00	120.00	f	\N	2026-04-01 11:22:26.690319+00	OP	\N	\N	ASC-D	292		0		0	\N	2
366	2	DJ 10 JOL	\N	\N	2026-04-01 07:25:59.343908+00	1035.00	f	\N	2026-04-01 11:04:16.337402+00	CASH	\N	114	ASC-D	270		0		0	\N	2
398	2	DJ 10 JOL	\N	SCHIMBAT DISCURI PLACHETI SPATE   ULEI F ULEI	2026-04-01 10:59:39.579494+00	400.00	t	2026-04-01 11:04:17.301641+00	\N	NEPLATIT	\N	114		0		0		0	\N	2
401	2	DJ15JDW	\N	\N	2026-04-01 11:20:30.456833+00	132.00	f	\N	2026-04-01 11:23:05.353061+00	CARD	\N	116	ASC-D	291		0		0	\N	2
400	2	bh 29 teh	\N	195 75 16c hankook	2026-04-01 11:20:07.908251+00	188.00	f	\N	2026-04-01 11:21:19.870523+00	CASH	\N	118	ASC-D	290		0		0	\N	2
391	2	DJ02WND	\N	\N	2026-04-01 09:58:05.38335+00	120.00	f	\N	2026-04-01 13:10:04.273599+00	CASH	\N	\N		0		0		0	\N	2
408	2	DJ19EYE	\N	\N	2026-04-01 11:47:05.501138+00	192.00	f	\N	2026-04-01 11:48:24.125916+00	CARD	\N	120	ASC-D	294		0		0	\N	2
404	2	DJ-44-GRB	\N	michelin 245/40/18 recomand anvelope	2026-04-01 11:24:01.445122+00	96.00	f	\N	2026-04-01 12:57:00.856655+00	OP	\N	\N	ASC-D	303		0		0	\N	2
407	2	DJ44GRB	\N	\N	2026-04-01 11:44:36.299267+00	180.00	f	\N	2026-04-01 11:53:19.868987+00	OP	\N	\N	ASC-D	296		0		0	\N	2
403	2	DJ15RNB	\N	\N	2026-04-01 11:22:37.629774+00	160.00	f	\N	2026-04-01 12:03:22.07148+00	CASH	\N	\N		0		0		0	\N	2
406	2	MOTOR	\N	\N	2026-04-01 11:32:34.822343+00	2140.00	f	\N	2026-04-01 12:11:10.412232+00	CASH	\N	121	ASC-D	298		0		0	\N	2
380	2	DJ 06 RYA	\N	CONTINENTAL ECOCONT 235/50/19 5mm 2,50 bari (sau montat 4 anvelope)	2026-04-01 09:09:49.040116+00	224.00	f	\N	2026-04-01 13:00:01.332998+00	OP	\N	\N	ASC-D	304		0		0	\N	2
377	2	VJ 16130	\N	HANCOK 255/40/20 4jante client ( ECHILIBRATE)	2026-04-01 08:48:11.909156+00	104.00	f	\N	2026-04-01 13:25:54.368974+00	CASH	\N	\N		0		0		0	\N	2
360	2	DJ97CAA	\N	\N	2026-04-01 06:49:22.865491+00	1440.00	t	2026-04-08 18:07:04.60031+00	2026-04-01 07:24:48.476171+00	OP	\N	\N	ASC-D	268		0		0	\N	2
409	2	DJ 25 ZAH	\N	MICHELIN PA5 205/55/17 6mm dot=1425 (cust.4 anv.,4 jante aliaj,4 huse)\n\nMIHELIN PS5 225/45/18 5mm 2,50 bari (sau montatat 4 roti)	2026-04-01 11:47:56.050145+00	256.00	f	\N	2026-04-01 11:50:09.13957+00	CASH	\N	\N	ASC-D	295		0		0	\N	2
411	2	DJ30AMZ	\N	\N	2026-04-01 12:07:42.63701+00	170.00	f	\N	2026-04-01 12:09:33.144159+00	CARD	\N	\N		0		0		0	\N	2
410	2	MH 81 YOR  IOR TAVI	\N	\N	2026-04-01 12:05:18.899043+00	3760.00	f	\N	2026-04-01 12:10:52.754668+00	OP	\N	\N	ASC-D	297		0		0	\N	2
438	2	DJ 21 TAZ	\N	MICHELIN A7 225/50/18 7mm dot 3125 (cust.4 anv.,4 jante aliaj,4 capace)\n\nDUNLOP SP SPORTMAX 225/50/18 6mm 2.30 bari (sau mont. 4 roti )	2026-04-02 07:19:22.848278+00	240.00	f	\N	2026-04-02 07:36:08.820453+00	CASH	\N	\N	ASC-D	318		0		0	\N	2
420	2	DJ52SPD   SPEEDCENTER	\N	\N	2026-04-01 13:52:33.025301+00	50.00	f	\N	2026-04-01 13:53:49.695575+00	OP	\N	\N	ASC-D	308		0		0	\N	2
405	2	DJ 01 KSV	\N	CUSTODIE NOUA 4ANV HANKOOK WINTER ICEPT 235/35/19 dot 2820 7mm	2026-04-01 11:31:19.539861+00	3906.00	f	\N	2026-04-01 12:18:03.325192+00	OP	\N	119	ASC-D	299		0		0	\N	2
412	2	DJ016268	\N	\N	2026-04-01 12:16:29.262034+00	250.00	f	\N	2026-04-01 12:26:33.640894+00	CASH	\N	\N	ASC-D	300		0		0	\N	2
428	2	DJ07XWG	\N	anv montate barum bravuris  175 65 14 mm 3 3 3 3 anv terminate jante  ne comforme presiune 2,2 fata spate  nm 110 \ncustodie anv jante otel barum polaris  175 65 14 mm 4 4 4 4  dot 2311	2026-04-02 06:17:42.138909+00	210.00	f	\N	2026-04-02 06:23:31.250964+00	CASH	\N	128	ASC-D	311		0		0	\N	2
413	2	B 391 AAB	\N	anv.client 225/65/17 5mm 4 buc.	2026-04-01 12:28:09.271115+00	176.00	f	\N	2026-04-01 12:28:45.83712+00	OP	\N	122	ASC-D	301		0		0	\N	2
422	2	DJ 29 CPO	\N	KUMHO 235/50/17 6mm (sau montat 4 anvelope client)	2026-04-01 14:11:36.746228+00	168.00	f	\N	2026-04-01 14:12:13.618678+00	CARD	\N	\N		0		0		0	\N	2
414	2	DJ03UBT	\N	anv client michelin primaci 5 225 55 17 mm 6 6 presiune 2,4 fata nm 140	2026-04-01 12:28:52.817938+00	84.00	f	\N	2026-04-01 12:29:35.044086+00	CARD	\N	123	ASC-D	302		0		0	\N	2
429	2	OT07BFS	\N	\N	2026-04-02 06:18:38.485236+00	300.00	f	\N	2026-04-02 06:25:14.214706+00	CARD	\N	\N	ASC-D	312		0		0	\N	2
423	2	DJ-36WTW	\N	anv client CONTINENTAL 255/50/19 2buc spate CONTINENTAL 235/55/19 2buc fata (montate)	2026-04-01 14:17:50.846357+00	224.00	f	\N	2026-04-01 14:31:00.852848+00	CASH	\N	\N	ASC-D	309		0		0	\N	2
416	2	DJ32BOD	\N	\N	2026-04-01 12:48:06.436778+00	250.00	f	\N	2026-04-01 12:51:25.615752+00	CASH	\N	\N		0		0		0	\N	2
419	2	DJ14SFF	\N	\N	2026-04-01 13:35:14.444455+00	40.00	f	\N	2026-04-01 14:33:02.734056+00	CASH	\N	\N		0		0		0	\N	2
421	2	DJ10UUU	\N	\N	2026-04-01 14:10:46.385779+00	180.00	t	2026-04-02 05:48:16.139859+00	\N	NEPLATIT	\N	75		0		0		0	\N	2
417	2	DJ-14NXD	\N	anv client FIRESTONE185/65/15 2buc RIKEN185/65/15 2buc (montate)	2026-04-01 13:20:20.928664+00	156.00	f	\N	2026-04-01 13:21:03.729924+00	CASH	\N	\N	ASC-D	305		0		0	\N	2
415	2	B314FLS	\N	MICHELIN PA5SUV 325/40/22 5mm dot3623\nMICHELIN PA5SUV 285/45/22 5mm dot3323 (cust. 4 anv. 4 jante aliaj 4 capace)	2026-04-01 12:37:17.618292+00	8310.00	f	\N	2026-04-01 13:22:04.872755+00	CARD	\N	124	ASC-D	306		0		0	\N	2
430	2	DJ-03-ZKX	\N	jante anv client matador 195/65/15 (echilibrat) 4JANTE ALIAJ	2026-04-02 06:31:31.741449+00	76.00	f	\N	2026-04-02 06:32:01.07545+00	CARD	\N	\N		0		0		0	\N	2
418	2	B104WPO	\N	custodie anv jante capace bridgestone blizzak lm001 265 50 19 mm 7 7 7 7 dot 3823  anv montate pirelli p zero 275 35 22 315 30 22 mm 7 7 7 7 presiune 2,4 fata spate nm 140	2026-04-01 13:30:23.820781+00	360.00	f	\N	2026-04-01 13:31:07.905916+00	CASH	\N	125	ASC-D	307		0		0	\N	2
426	2	GJ04ETA	\N	\N	2026-04-02 06:02:48.940495+00	250.00	f	\N	2026-04-02 06:35:05.712041+00	CASH	\N	\N		0		0		0	\N	2
434	2	DJ66ECA	\N	\N	2026-04-02 07:08:51.447291+00	180.00	f	\N	2026-04-02 07:13:45.036184+00	CASH	\N	\N	ASC-D	315		0		0	\N	2
425	2	DJ-34-ELF	\N	anv client barum185/65/15 1buc vicing185/65/15 1buc riken 185/65/15 2buc (montate) recomand anvelope	2026-04-02 05:53:22.882003+00	132.00	f	\N	2026-04-02 06:02:14.929989+00	OP	\N	\N	ASC-D	310		0		0	\N	2
433	2	DJ 23 NOV	\N	BRIDGESTONE 235/55/19 8mm 2,30 bari (anv.client)	2026-04-02 07:01:21.112156+00	224.00	f	\N	2026-04-02 07:14:02.860956+00	CASH	\N	\N	ASC-D	316		0		0	\N	2
424	2	dj   33  sfc	\N	225 55 19 toio	2026-04-02 05:52:45.308747+00	224.00	f	\N	2026-04-02 06:02:45.108976+00	CASH	\N	127		0		0		0	\N	2
441	2	AB11AUB	\N	\N	2026-04-02 07:32:49.879977+00	180.00	f	\N	2026-04-02 07:45:58.786058+00	OP	\N	\N		0		0		0	\N	2
432	2	DJ89CES	\N	\N	2026-04-02 06:47:18.396153+00	132.00	f	\N	2026-04-02 06:48:14.613036+00	OP	\N	46	ASC-D	313		0		0	\N	2
431	2	dj40eme	\N	\N	2026-04-02 06:45:38.854607+00	250.00	f	\N	2026-04-02 06:53:19.064757+00	CARD	\N	\N		0		0		0	\N	2
435	2	DJ11PTK	\N	custodie anv pirelli scorpion winter 285 40 21 mm 6 6 6 6 dot 4020  \nanv montate  goodyear eagle f1 285 40  21 mm 7 7 7 7  presiune fata spate 2,5 nm 150	2026-04-02 07:09:59.816981+00	374.00	f	\N	2026-04-02 07:25:51.956506+00	CASH	\N	132	ASC-D	317		0		0	\N	2
427	2	DJ 16 TSS	\N	\N	2026-04-02 06:10:03.599287+00	2728.00	f	\N	2026-04-02 06:53:29.532415+00	OP	\N	129	ASC-D	314		0		0	\N	2
445	2	DJ 17 HTF	\N	\N	2026-04-02 07:50:26.006173+00	1356.00	f	\N	2026-04-02 08:24:54.98328+00	CASH	\N	135	ASC-D	324		0		0	\N	2
442	2	DJ 18XZM	\N	\N	2026-04-02 07:41:12.300267+00	168.00	f	\N	2026-04-02 07:42:09.471903+00	OP	\N	46		0		0		0	\N	2
443	2	DJ77SAA	\N	anv client  senturi sumer 245 45 17  mm 6 6 6 6  anvelopele bat presiune fata spate 2,4 nm 120	2026-04-02 07:41:25.194384+00	192.00	f	\N	2026-04-02 07:43:06.240664+00	CASH	\N	134		0		0		0	\N	2
444	2	DJ-05-RBR	\N	MICHELIN  275/35/20 2buc spate 245/40/20 2buc fata ( montate) \nCUSTODIE 4jante aliaj +4anv MICHELIN PA5 275/35/20 2buc 245/40/20 2buc dot 3921 5mm	2026-04-02 07:41:44.620995+00	344.00	f	\N	2026-04-02 07:43:21.8806+00	OP	\N	\N	ASC-D	319		0		0	\N	2
439	2	B 173 DAS	\N	\N	2026-04-02 07:20:10.428938+00	1860.00	f	\N	2026-04-02 07:57:21.93392+00	OP	\N	\N	ASC-D	320		0		0	\N	2
446	2	DJ10MXC	\N	\N	2026-04-02 08:03:02.064266+00	180.00	f	\N	2026-04-02 08:07:31.623871+00	CASH	\N	\N	ASC-D	321		0		0	\N	2
447	2	B 551 WSD	\N	MICHELIN PS5 255/40/20 5mm 2,40 bari (sau montat 4 roti client)	2026-04-02 08:09:35.05633+00	112.00	f	\N	2026-04-02 08:10:01.542651+00	CASH	\N	136	ASC-D	322		0		0	\N	2
437	2	DJ 76 XLA	\N	\N	2026-04-02 07:18:52.544868+00	2016.00	f	\N	2026-04-02 08:16:33.049729+00	CASH	\N	137	ASC-D	323		0		0	\N	2
449	2	DJ55ECO	\N	anv client michelin primacy4 205 55 16 mm 7 7 7 7 presiune fata spate 2,4 nm 120	2026-04-02 08:48:06.602069+00	76.00	f	\N	2026-04-02 08:48:54.962779+00	CASH	\N	138		0		0		0	\N	2
451	2	DJ62AGL	\N	anv client michelin pilot  sport 4 suv  225 55 19  mm6 6 6 8 nm 120 presiune 2,5	2026-04-02 09:17:22.140708+00	128.00	f	\N	2026-04-02 09:20:22.719783+00	CARD	\N	139		0		0		0	\N	2
450	2	DJ-22-BXL	\N	anv client BRIDGESTONE 205/55/16 4anv (montate)	2026-04-02 09:14:44.245654+00	160.00	f	\N	2026-04-02 09:17:01.456512+00	CASH	\N	\N	ASC-D	325		0		0	\N	2
454	2	DJ-81-BOR	\N	roti complete client riken 185/65/15 (echilibrat)	2026-04-02 09:48:34.898479+00	72.00	f	\N	2026-04-02 09:48:59.944474+00	CASH	\N	\N		0		0		0	\N	2
448	2	OT08SIV	\N	\N	2026-04-02 08:26:49.162204+00	300.00	f	\N	2026-04-02 09:26:13.991535+00	CASH	\N	\N		0		0		0	\N	2
453	2	DJ22BXL	\N	\N	2026-04-02 09:32:12.057728+00	250.00	f	\N	2026-04-02 09:43:31.001089+00	CASH	\N	\N	ASC-D	327		0		0	\N	2
452	2	DJ36BBI	\N	2buc michelin 315 40 21	2026-04-02 09:26:17.453239+00	3218.00	f	\N	2026-04-02 09:41:39.665876+00	OP	\N	140	ASC-D	326		0		0	\N	2
456	2	DJ02MHH	\N	\N	2026-04-02 10:07:50.779408+00	180.00	f	\N	2026-04-02 10:16:43.385025+00	CARD	\N	\N	ASC-D	329	ASC-F	1		0	\N	2
458	2	TM010458	\N	\N	2026-04-02 10:24:03.892212+00	120.00	f	\N	2026-04-02 10:29:05.031106+00	CARD	\N	\N	ASC-D	332		0		0	\N	2
436	2	dj40eme	\N	\N	2026-04-02 07:14:08.256796+00	72.00	t	2026-04-08 18:07:04.60031+00	2026-04-02 07:16:47.281236+00	CARD	\N	133		0		0		0	\N	2
455	2	dj 25 rhd	\N	montat 275 35 19 2buc 245 40 19 2buc michelin\ncustodie 4anv 4jante aliaj 4capace 4inele ghidaj michelin alpin 7 dot 3824 mm 6 225 55 17	2026-04-02 10:03:30.612271+00	264.00	f	\N	2026-04-02 10:08:28.690901+00	CARD	\N	141	ASC-D	328		0		0	\N	2
457	2	GJ74LIL	\N	\N	2026-04-02 10:22:23.987129+00	300.00	f	\N	2026-04-02 10:25:28.697947+00	CARD	\N	\N	ASC-D	330		0		0	\N	2
440	2	DJ 37 HLY	\N	presiune 2,4 nm 120	2026-04-02 07:32:37.567579+00	1884.00	f	\N	2026-04-02 10:25:35.445542+00	CARD	\N	144	ASC-D	331		0		0	\N	2
459	2	b150ttg	\N	\N	2026-04-02 10:36:58.244961+00	416.00	f	\N	2026-04-02 10:42:55.066751+00	OP	\N	142	ASC-D	333		0		0	\N	2
473	2	DJ54TEA	\N	anv client michelin pilot sport 4 suv zp  2,4 fata spate nm 150 275 40   21 315 35 21	2026-04-02 12:02:28.462194+00	160.00	f	\N	2026-04-02 13:04:53.677299+00	CASH	\N	148	ASC-D	348		0		0	\N	2
462	2	B-113-TKF	\N	anv client PIRELLI 315/35/21 2buc spate 275/40/21 2buc fata	2026-04-02 10:49:43.848022+00	288.00	f	\N	2026-04-02 10:50:36.684796+00	CASH	\N	\N	ASC-D	335		0		0	\N	2
460	2	AG33MXR	\N	\N	2026-04-02 10:45:13.339931+00	800.00	f	\N	2026-04-02 10:54:29.73582+00	OP	\N	\N	ASC-D	334		0		0	\N	2
479	2	DJ-11-TEA	\N	anv client PIRELLI 255/40/18 2buc 225/45/18 2buc	2026-04-02 12:39:40.400029+00	168.00	f	\N	2026-04-02 13:05:16.396307+00	CASH	\N	\N	ASC-D	349		0		0	\N	2
470	2	DJ19TEA	\N	PIULITA 44869F=25 lei\nBULON 01471F=25 lei\nMANOPERA= 50 lei ( modu )\n2x25=50 lei (extensii)\n2x25=50 lei (coturii)	2026-04-02 11:53:24.792207+00	3304.00	f	\N	2026-04-02 13:05:56.765094+00	CARD	\N	152	ASC-D	347		0		0	\N	2
475	2	DJ58KSM	\N	\N	2026-04-02 12:03:17.204775+00	120.00	f	\N	2026-04-02 12:08:06.505259+00	CASH	\N	\N	ASC-D	342		0		0	\N	2
467	2	DJ20FDK	\N	\N	2026-04-02 11:23:29.638531+00	250.00	f	\N	2026-04-02 12:10:12.394805+00	OP	\N	\N		0		0		0	\N	2
461	2	DJ 20 FDK	\N	CONTINENTAL PREMCONT. 245/45/19 7mm 3bari (anv,client)	2026-04-02 10:46:16.261426+00	224.00	f	\N	2026-04-02 10:54:51.031805+00	OP	\N	27	ASC-D	336		0		0	\N	2
474	2	TL06CEO	\N	\N	2026-04-02 12:02:41.779753+00	180.00	f	\N	2026-04-02 14:22:22.551163+00	CARD	\N	\N		0		0		0	\N	2
477	2	dj18yse	\N	\N	2026-04-02 12:03:31.45293+00	150.00	f	\N	2026-04-02 12:14:51.727695+00	CARD	\N	149	ASC-D	343		0		0	\N	2
465	2	DJ24MSV	\N	anv montate kumho escta        ps71 195 55 16 mm 3 3 3 3 presiune 2,4 fata spate  nm 120  \ncustodie anv  jante  otel kumho winter craft 185 65 15 1323 mm 6 6 6 6	2026-04-02 11:13:11.331485+00	192.00	f	\N	2026-04-02 11:15:27.828894+00	CASH	\N	\N	ASC-D	338		0		0	\N	2
466	2	OT16AIR	\N	\N	2026-04-02 11:21:24.765679+00	250.00	f	\N	2026-04-02 11:28:13.001526+00	CASH	\N	\N		0		0		0	\N	2
463	2	B150TTG	\N	\N	2026-04-02 10:57:00.020635+00	250.00	f	\N	2026-04-02 11:34:00.378296+00	OP	\N	\N	ASC-D	339		0		0	\N	2
1338	2	DJ21UKE	\N	\N	2026-04-20 13:37:04.291994+00	940.00	f	\N	2026-04-20 14:24:56.406545+00	CARD	\N	\N		0		0		0	\N	2
468	2	dj 20 dwd	\N	275 40 20 grip max	2026-04-02 11:42:25.71125+00	266.00	f	\N	2026-04-02 11:47:23.706193+00	CASH	\N	147	ASC-D	340		0		0	\N	2
471	2	B-800-XAB	\N	ANV CLIENT PIRELI 275/40/21 1buc 315/35/21 1buc	2026-04-02 11:58:53.938413+00	173.00	f	\N	2026-04-02 11:59:38.292061+00	OP	\N	\N	ASC-D	341		0		0	\N	2
480	2	DJ 73 MSD	\N	custodie anv jante   capace   michelin   alpim 6 215 60  17 dot 3320 mm6 6 5 5\npresiune 2,3 fata 2,1 spate nm 120	2026-04-02 12:42:35.787497+00	2736.00	f	\N	2026-04-02 13:09:26.482954+00	OP	\N	150	ASC-D	350		0		0	\N	2
469	2	DJ 77 CSX	\N	prezon mercedes  25 lei	2026-04-02 11:46:50.473903+00	6066.00	f	\N	2026-04-02 12:48:41.748278+00	CASH	\N	\N	ASC-D	344		0		0	\N	2
486	2	Dj18xxv	\N	\N	2026-04-02 14:21:26.513558+00	300.00	f	\N	2026-04-08 08:53:51.183767+00	CASH	\N	\N		0		0		0	\N	2
484	2	DGF DM 28	\N	ANV CLIENT HANKOOK 275/40/19 2buc 245/45/19 2buc	2026-04-02 13:47:08.684342+00	232.00	f	\N	2026-04-02 13:47:39.859864+00	CASH	\N	154		0		0		0	\N	2
476	2	DJ 67 MJR	\N	custodie 4 anv 4jante aliaj 4capace 215 60 17 dot 3618 mm5 michelin alpin 5	2026-04-02 12:03:31.305083+00	3456.00	f	\N	2026-04-02 12:49:49.448864+00	CARD	\N	151	ASC-D	345		0		0	\N	2
481	2	DJ97AXU	\N	\N	2026-04-02 12:50:43.585553+00	120.00	f	\N	2026-04-02 12:55:29.594188+00	OP	\N	\N	ASC-D	346		0		0	\N	2
472	2	DJ 30 DEM	\N	\N	2026-04-02 12:01:40.652767+00	172.00	f	\N	2026-04-02 13:00:04.538001+00	CARD	\N	\N		0		0		0	\N	2
485	2	dj 96 anc	\N	245 40 20 cu 275 35 20 michelin	2026-04-02 13:48:36.574188+00	204.00	f	\N	2026-04-08 08:54:00.01508+00	CASH	\N	155	ASC-D	351		0		0	\N	2
487	2	B 181 EST RODIAN	\N	\N	2026-04-03 05:25:53.059391+00	22360.00	t	2026-04-03 05:38:00.42993+00	2026-04-03 05:37:04.376368+00	NEPLATIT	\N	\N	ASC-D	354		0		0	\N	2
464	2	hhjf	\N	mivcujfhj 2467 hsezzt5vh\ncu	2026-04-02 11:02:06.896287+00	328.00	t	2026-04-06 05:43:54.147497+00	2026-04-02 11:02:12.831899+00	NEPLATIT	\N	145	ASC-D	337		0		0	\N	2
483	2	DJ81NIS	\N	\N	2026-04-02 13:46:24.071342+00	180.00	f	\N	2026-04-02 14:02:24.105749+00	CARD	\N	153	ASC-D	352		0		0	\N	2
493	2	DJ 99 FSD	\N	ANV.CLIENT= RIKEN UHP 225/45/17 5MM 2,3 FATA, 2,6 SPATE \n\n1X5=5 LEI (CAPACEL PREZON)	2026-04-03 05:55:24.308311+00	168.00	f	\N	2026-04-03 05:56:10.96024+00	CASH	\N	\N		0		0		0	\N	2
482	2	VS CA 888	\N	\N	2026-04-02 13:38:00.250159+00	1484.00	f	\N	2026-04-02 14:09:50.976242+00	CASH	\N	\N	ASC-D	353		0		0	\N	2
499	2	BT38NIS	\N	\N	2026-04-03 06:26:04.209855+00	60.00	f	\N	2026-04-03 15:16:05.953675+00	CARD	\N	163		0		0		0	\N	2
490	2	dj 17 gjd	\N	MONTAT 4 ANV MICHELIN 205 60 16\nCUSTODIE 4 ANV KUMHO WINTERCRAFT 205 60 16 DOT 1123 MM5	2026-04-03 05:41:40.986738+00	256.00	f	\N	2026-04-03 05:42:25.721143+00	CARD	\N	157	ASC-D	357		0		0	\N	2
496	2	DJ14GTJ	\N	ANV MONTATE BRIDGESTONE ALENZA 005 235 50 20 MM 7 7 7 7 PRESIUNE 2,5 FATA SPATE  NM 120	2026-04-03 06:08:04.052106+00	232.00	f	\N	2026-04-03 06:10:58.501703+00	CASH	\N	160	ASC-D	361		0		0	\N	2
495	2	OT14TUD	\N	\N	2026-04-03 06:04:11.977256+00	250.00	f	\N	2026-04-03 06:08:30.658251+00	CASH	\N	159	ASC-D	360		0		0	\N	2
497	2	DJ16MOS	\N	MICHELIN 245/50/18 4JANTE ECHILIBRATE\nCUSTODIE 4 JANTE ALIAJ+4ANVELOPE+4CAPACE CENTRU MICHELIN PA5 225/60/17 DOT3822 6MM	2026-04-03 06:14:16.503271+00	256.00	f	\N	2026-04-03 06:14:51.604499+00	OP	\N	161	ASC-D	362		0		0	\N	2
498	2	DJ 26 GYO	\N	\N	2026-04-03 06:16:31.976089+00	2336.00	f	\N	2026-04-03 06:18:20.923471+00	CARD	\N	158	ASC-D	363		0		0	\N	2
494	2	DJ 15 AWJ	\N	\N	2026-04-03 05:55:47.513567+00	616.00	f	\N	2026-04-03 06:33:38.640543+00	CARD	\N	165	ASC-D	364		0		0	\N	2
488	2	DJ82BON	\N	MICHELIN 235 55 17	2026-04-03 05:32:47.33694+00	2576.00	f	\N	2026-04-03 06:30:13.500729+00	CASH	\N	162	ASC-D	356		0		0	\N	2
500	2	B 121 LGK	\N	ANV CLIENT=KUMHO 175/65/14	2026-04-03 06:36:34.863993+00	104.00	f	\N	2026-04-03 06:37:41.534822+00	CASH	\N	166	ASC-D	365		0		0	\N	2
502	2	dj 16 ena	\N	235 60 18 DUNLOP	2026-04-03 06:42:01.375342+00	131.00	f	\N	2026-04-03 06:42:26.847058+00	CARD	\N	167		0		0		0	\N	2
505	2	CJ 28 UFF	\N	\N	2026-04-03 06:44:12.282347+00	1904.00	f	\N	2026-04-03 07:17:27.940837+00	CARD	\N	168	ASC-D	370		0		0	\N	2
507	2	MAI60382	\N	\N	2026-04-03 06:59:51.719923+00	250.00	f	\N	2026-04-03 09:17:54.107696+00	OP	\N	170	ASC-D	386		0		0	\N	2
492	2	VL74DAM	\N	\N	2026-04-03 05:52:32.889703+00	910.00	f	\N	2026-04-03 08:23:55.627581+00	OP	\N	\N	ASC-D	358		0		0	\N	2
501	2	b759lgk	\N	\N	2026-04-03 06:40:21.224301+00	186.00	f	\N	2026-04-03 06:52:27.947383+00	CASH	\N	\N	ASC-D	366		0		0	\N	2
506	2	DJ74CES	\N	\N	2026-04-03 06:52:11.576135+00	33.00	f	\N	2026-04-03 07:02:40.694478+00	OP	\N	169	ASC-D	367		0		0	\N	2
503	2	DJ09TJH	\N	CUSTODIE ANV KUMHO WINTER CRAFT 165 70 14 DOT  3423 MM6 6 6 6 \nPRESIUNE FATA SPATE 2,2 NM 120	2026-04-03 06:42:35.171117+00	1414.00	f	\N	2026-04-03 07:26:56.213772+00	CARD	\N	173	ASC-D	371		0		0	\N	2
489	2	vl 74 dam	\N	\N	2026-04-03 05:33:44.012396+00	400.00	t	2026-04-06 05:36:44.297588+00	2026-04-03 05:41:40.103092+00	NEPLATIT	\N	156	ASC-D	355		0		0	\N	2
611	2	DJ 78 WID	\N	\N	2026-04-06 09:30:28.830279+00	136.00	f	\N	2026-04-06 09:32:41.477969+00	CARD	\N	252	ASC-D	445		0		0	\N	2
491	2	DJ 26 GYO	\N	\N	2026-04-03 05:46:51.559634+00	2160.00	t	2026-04-07 06:40:41.431124+00	2026-04-03 05:55:39.502117+00	NEPLATIT	\N	\N	ASC-D	359		0		0	\N	2
543	2	B126DIN	\N	ANV CLIENT CONTI ECO CONTACT 185 65 15 MM 4 4 3 3 UZATE JANTE  OVALIZATE PRESIUNE FATA SPATE 2,3  NM 120	2026-04-03 11:44:07.330881+00	132.00	f	\N	2026-04-03 11:51:20.712408+00	OP	\N	200		0		0		0	\N	2
504	2	DJ15XIA	\N	CUSTODIE ANV  JANTE OTEL RIKEN SNOW 195 65 15 DOT 3417 MM 3 3 4 4\nANV MONTATE DUNLOP  SPORT BLURESPONSE 205 55 16   MM5 5 5 5 5 PRESIUNE 2,3 FATASPATE NM 120	2026-04-03 06:43:48.977693+00	226.00	f	\N	2026-04-03 06:59:10.275426+00	CARD	\N	164	ASC-D	368		0		0	\N	2
527	2	DJ 72 MET	\N	ANV CLIENT= 2BUC RIKEN 205/55/16 2,30 BARI 6MM\n                       2BUC GOODYEAR 205/55/16 2,30 BARI 7MM	2026-04-03 09:32:10.008356+00	136.00	f	\N	2026-04-03 09:33:23.68357+00	OP	\N	\N	ASC-D	388		0		0	\N	2
508	2	lamborghini	\N	\N	2026-04-03 07:12:23.82736+00	560.00	f	\N	2026-04-03 07:15:15.515194+00	OP	\N	171	ASC-D	369		0		0	\N	2
509	2	EQG 6005	\N	\N	2026-04-03 07:12:56.490781+00	116.00	f	\N	2026-04-03 07:16:26.893802+00	CASH	\N	\N		0		0		0	\N	2
518	2	tm 28 hfj	\N	195 55 16 HANKOOK	2026-04-03 08:36:18.350966+00	136.00	f	\N	2026-04-03 08:39:20.833792+00	CASH	\N	181	ASC-D	380		0		0	\N	2
510	2	dj77lrd	\N	PIRELLI 205 65 17 4 ANVELOPE 4JANTE ALIAJ 4 CAPACE CENTRU DOT 4522 4522 4522 4522 MM 6	2026-04-03 07:34:19.219213+00	384.00	f	\N	2026-04-03 07:35:40.014391+00	CASH	\N	172	ASC-D	372		0		0	\N	2
537	2	DJ78SFR	\N	ANV MONTATE CONTI ECO CONTACT 6 195 55 16 MM 6 6 6 6\n PRESIUNE FATA SPATE 2,3 NM 120 \nCUSTODIE ANV JANTE OTEL KLEBER WINTER 195 55 16 MM 4 4 4 4 \nDOT 31 21	2026-04-03 10:50:39.799185+00	226.00	f	\N	2026-04-03 10:51:58.257809+00	CARD	\N	197	ASC-D	397		0		0	\N	2
511	2	dj 02 spm	\N	MICHELIN 185 65 15	2026-04-03 07:37:36.997318+00	132.00	f	\N	2026-04-03 07:41:34.007423+00	CARD	\N	174	ASC-D	373		0		0	\N	2
519	2	DJ11YIY	\N	\N	2026-04-03 08:37:51.987756+00	180.00	f	\N	2026-04-03 08:52:05.020526+00	CARD	\N	182	ASC-D	381		0		0	\N	2
520	2	DJ 11 EID	\N	ANV.CLIENT=MICHELIN CROSSCLIM2 215/60/16 8MM 2,50 BARI	2026-04-03 08:51:07.648841+00	136.00	f	\N	2026-04-03 08:52:17.211642+00	CASH	\N	\N		0		0		0	\N	2
512	2	DJ37SAS	\N	CUSTODIE ANV JANTE CAPACE CONTI WINTER CONTACT TS830P 245 45 18 DOT 3418 MM 4 4 5 5 \nANV MONTATE MICHELIN PILOT SPORT 4 ZP 245 45 18 MM 7 7 7 7  PRESIUNE FATA SPATE 2,4 NM140	2026-04-03 07:43:56.930124+00	256.00	f	\N	2026-04-03 07:50:56.847034+00	CASH	\N	175	ASC-D	374		0		0	\N	2
528	2	dj 45 ast	\N	235 50 20 BRIDGESTONE	2026-04-03 09:36:19.679982+00	128.00	f	\N	2026-04-03 09:37:15.814846+00	CARD	\N	190	ASC-D	389		0		0	\N	2
513	2	dj 01 mbk	\N	CUSTODIE NOUA 4ANV 4JANTE ALIAJ 4CAPACE TIGAR WINTER 225 40 18 DOT 3119 MM5\nMONTAT RIKEN SUMMER 3 225 40 18	2026-04-03 07:51:42.863583+00	232.00	f	\N	2026-04-03 07:52:52.121644+00	CASH	\N	176	ASC-D	375		0		0	\N	2
533	2	b201ept	\N	4ANVELOPE MOTRIO DOT 4220 4220 4220 4220	2026-04-03 10:27:58.419301+00	252.00	f	\N	2026-04-03 10:28:59.152656+00	OP	\N	192	ASC-D	394		0		0	\N	2
525	2	b 622 dia	\N	CUSTODIE 4 ANV MICHELIN ALPIN 7 205 55 17 DOT 1324 MM6\nMONTAT PIRELLI 205 55 17	2026-04-03 09:12:35.35886+00	308.00	f	\N	2026-04-03 10:00:15.42797+00	OP	\N	187	ASC-D	390		0		0	\N	2
521	2	DJ21BDG	\N	ANV MONTATE MICHELIN PRIMACY 4 215 65 17 MM 4 4 3 3 PRESIUNE FATA SPATE  2,4 NM 120 \nCUSTODIE ANV  JANTE CAPACE MICHELIN PILOT ALPIN 5 215 65 17 MM 3 3 5 5 DOT3821	2026-04-03 09:00:11.599248+00	256.00	f	\N	2026-04-03 09:05:33.802639+00	CARD	\N	184	ASC-D	382		0		0	\N	2
514	2	B115JUB	\N	\N	2026-04-03 07:54:16.703396+00	250.00	f	\N	2026-04-03 08:02:32.556802+00	CARD	\N	177	ASC-D	376		0		0	\N	2
516	2	DJ02SPM	\N	\N	2026-04-03 08:17:33.564227+00	60.00	f	\N	2026-04-03 08:22:12.699127+00	CARD	\N	179	ASC-D	377		0		0	\N	2
515	2	AG 02 MXR	\N	\N	2026-04-03 07:54:37.439714+00	132.00	f	\N	2026-04-03 08:22:49.215731+00	OP	\N	178	ASC-D	378		0		0	\N	2
529	2	DJ 80 RTW	\N	ŃOKIAN WR 225/60/17 6MM DOT=4218 ( CUST 4 ANV.4 JANTE ALIAJ)\n\nMICHELIN PRIMACY E ZP 245/50/18 7MM 2,30 BARI ( SAU MONTAT)	2026-04-03 10:04:37.520196+00	256.00	f	\N	2026-04-03 10:06:54.223416+00	CARD	\N	\N	ASC-D	391		0		0	\N	2
517	2	DJ42MDS	\N	ANV CLIENT CONTI WINTER CONTACT TS 850P 275 40 18 MM6 P0RESIUNE 2,4 NM 140	2026-04-03 08:30:13.473648+00	67.00	f	\N	2026-04-03 08:31:19.666829+00	OP	\N	180	ASC-D	379		0		0	\N	2
524	2	dj01plu	\N	\N	2026-04-03 09:10:09.14943+00	256.00	f	\N	2026-04-03 09:11:15.248768+00	CARD	\N	183	ASC-D	383		0		0	\N	2
1252	2	DJ16TJE	\N	\N	2026-04-20 06:16:53.604018+00	176.00	f	\N	2026-04-20 06:17:37.688946+00	CARD	\N	819		0		0		0	\N	2
522	2	DJ77FXI	\N	\N	2026-04-03 09:03:37.928219+00	180.00	f	\N	2026-04-03 09:16:02.974644+00	CASH	\N	185	ASC-D	385		0		0	\N	2
523	2	DJ15REI	\N	\N	2026-04-03 09:09:12.964831+00	96.00	f	\N	2026-04-03 09:19:08.492691+00	CARD	\N	186	ASC-D	384		0		0	\N	2
531	2	DJ22APR	\N	\N	2026-04-03 10:11:16.681015+00	120.00	f	\N	2026-04-03 10:15:14.602503+00	CARD	\N	191	ASC-D	392		0		0	\N	2
526	2	b 171 tei	\N	325 40 22 CONTINENTAL\n285 45 22  CONTINENTAL	2026-04-03 09:26:23.707797+00	608.00	f	\N	2026-04-03 09:28:46.506438+00	OP	\N	188	ASC-D	387		0		0	\N	2
540	2	dj19lud	\N	\N	2026-04-03 11:07:34.442509+00	136.00	f	\N	2026-04-03 11:09:04.932708+00	CARD	\N	195	ASC-D	399		0		0	\N	2
544	2	DJ03DYA	\N	BRIDGESTONE 225/65/16C (MONTAT)\nCUSTODIE 4JANTE OTEL+4ANVELOPE SEBRING VANWINTER 225/65/16C DOT3822 6MM	2026-04-03 11:45:31.341739+00	337.00	f	\N	2026-04-03 11:46:50.056271+00	CASH	\N	201	ASC-D	401		0		0	\N	2
532	2	dj 08 ddd	\N	CUSTODIE 4 ANV MICHELIN PIL ALP 5SUV 275 50 20 DOT 2025 MM6\nMONTAT PIRELLI 275 50 20	2026-04-03 10:19:52.732296+00	374.00	f	\N	2026-04-03 10:20:29.252947+00	OP	\N	193	ASC-D	393		0		0	\N	2
539	2	DJ 64 PAM	\N	LAUFEN 205/60/15 8MM 2,30BARI (SAU MONTAT 4 ANV CLIENT )\n\nBARUM POLARIS3 195/65/15 6MM DOT=4816 ( CUSTODIE NOUA= 4 ANVELOPE,4 JANTE ALIAJ, 4 CAPACE )	2026-04-03 11:03:57.886653+00	286.00	f	\N	2026-04-03 11:04:48.285915+00	CARD	\N	\N	ASC-D	398		0		0	\N	2
534	2	DJ26KZY	\N	\N	2026-04-03 10:39:44.935363+00	180.00	f	\N	2026-04-03 10:43:17.840706+00	CASH	\N	194		0		0		0	\N	2
536	2	B245FRT	\N	MICHELIN 235/60/18 4ANV (MONTATE)\nCUSTODIE HANKOOK WINTERICEPT 235/60/18 SE SCHIMBA NUMARU DE LA MASINA B093738 CU B245FRT	2026-04-03 10:42:35.36086+00	580.00	f	\N	2026-04-03 10:44:25.945966+00	OP	\N	196	ASC-D	396		0		0	\N	2
546	2	DJ56KLN	\N	\N	2026-04-03 11:59:36.453163+00	136.00	f	\N	2026-04-03 12:00:53.069488+00	CARD	\N	\N	ASC-D	403		0		0	\N	2
542	2	DJ64PAM	\N	\N	2026-04-03 11:36:01.99939+00	180.00	f	\N	2026-04-03 11:39:37.599234+00	CARD	\N	199	ASC-D	400		0		0	\N	2
535	2	DJ77LIT	\N	\N	2026-04-03 10:39:52.97903+00	500.00	t	2026-04-03 11:40:58.553687+00	2026-04-03 10:41:30.243498+00	NEPLATIT	\N	75	ASC-D	395		0		0	\N	2
541	2	DJ 16 MDV	\N	\N	2026-04-03 11:12:51.363135+00	1960.00	f	\N	2026-04-03 11:48:34.617858+00	CASH	\N	198	ASC-D	402		0		0	\N	2
545	2	DJ79LRD	\N	ANV SH 235 65 16 C MICHELIN AGILIS  2X200	2026-04-03 11:54:48.18744+00	496.00	f	\N	2026-04-03 12:00:25.999609+00	CASH	\N	202		0		0		0	\N	2
547	2	OT95AXP	\N	\N	2026-04-03 12:06:12.380475+00	250.00	f	\N	2026-04-03 12:09:50.789809+00	CARD	\N	203	ASC-D	404		0		0	\N	2
548	2	DJ 16 KLN	\N	ANV.CLIENT BRIDGESTONE 225/55/18	2026-04-03 12:08:47.194513+00	176.00	f	\N	2026-04-03 12:10:14.221175+00	CARD	\N	\N		0		0		0	\N	2
550	2	dj 10 mwx	\N	CUSTODIE 4 ANV 4 JANTE OTEL BRIDGESTONE BLIZAK 205 55 16 DOT 3412 MM5\nMONTAT RIKEN 215 55 16\n6PIULITE FORD X15LEI BUC 07176F	2026-04-03 12:21:54.46202+00	226.00	f	\N	2026-04-03 12:23:30.790778+00	CARD	\N	205	ASC-D	405		0		0	\N	2
551	2	dj 99 rxf	\N	4 ANVELOPE MICHELIN DOT 3024 3024 3024 3024	2026-04-03 12:22:25.733964+00	508.00	f	\N	2026-04-03 12:33:18.95084+00	CARD	\N	206	ASC-D	406		0		0	\N	2
549	2	ot15pmc	\N	\N	2026-04-03 12:10:55.019715+00	180.00	f	\N	2026-04-03 13:35:06.169305+00	CASH	\N	\N		0		0		0	\N	2
530	2	vl20ayc	\N	\N	2026-04-03 10:09:50.844494+00	250.00	f	\N	2026-04-03 13:35:46.883139+00	CASH	\N	\N		0		0		0	\N	2
701	2	dj18ndl	\N	\N	2026-04-07 09:03:04.840573+00	224.00	f	\N	2026-04-07 09:05:55.053887+00	CARD	\N	\N		0		0		0	\N	2
1282	2	OT93RMS	\N	\N	2026-04-20 09:29:18.212684+00	100.00	f	\N	2026-04-20 09:33:06.809782+00	CARD	\N	847		0		0		0	\N	2
1284	2	DJ21XSX	\N	\N	2026-04-20 09:32:39.52767+00	300.00	f	\N	2026-04-20 09:35:05.477815+00	CARD	\N	849		0		0		0	\N	2
552	2	DJ24JRY	\N	CUSTODIE ANV JANTE CAPACE KUMHO WINTER KRAFT 235 45 18 MM 7 7 7 7 DOT 3423 \nANV MONTATE  KUMHO ECSTS PS71 245 40 20 MM 6 6 7 7 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-03 12:24:26.398508+00	289.00	f	\N	2026-04-03 12:29:54.333097+00	CASH	\N	204	ASC-D	407		0		0	\N	2
554	2	dj 28 rzs	\N	CUSTODIE 4 ANV MICHELIN ALP 5 DOT 4218 MM4\nMONTAT GOODIEAR 225 55 16	2026-04-03 12:52:08.448754+00	256.00	f	\N	2026-04-03 12:52:42.382993+00	CARD	\N	207	ASC-D	408		0		0	\N	2
577	2	DJ 16 EKN	\N	\N	2026-04-06 06:54:09.171947+00	1066.00	f	\N	2026-04-06 07:26:43.838588+00	CASH	\N	225	ASC-D	426		0		0	\N	2
566	2	B 221 SEI	\N	\N	2026-04-06 06:08:20.630459+00	4716.00	f	\N	2026-04-06 06:53:27.809605+00	CARD	\N	\N	ASC-D	418		0		0	\N	2
555	2	OT10AZK	\N	\N	2026-04-03 12:53:10.284425+00	120.00	f	\N	2026-04-03 12:57:30.936964+00	CARD	\N	208		0		0		0	\N	2
564	2	B128APC	\N	ANV CLIENT MEZZELAR 175 60 17 MM 6  PRESIUNE 2,8	2026-04-06 05:59:28.575289+00	65.00	f	\N	2026-04-06 06:00:26.782583+00	CARD	\N	216	ASC-D	414		0		0	\N	2
556	2	dj 87 rzw	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4 CAPACE GOODRIDE SNOW 245 45 18 DOT 2723 MM 6\nMONTAT PIRELLI 255 35 20	2026-04-03 13:02:49.727711+00	264.00	f	\N	2026-04-03 13:03:33.747677+00	CARD	\N	210	ASC-D	409		0		0	\N	2
589	2	DJ 28 ELR	\N	\N	2026-04-06 07:47:20.835555+00	1020.00	f	\N	2026-04-06 08:09:11.002128+00	CARD	\N	235	ASC-D	434		0		0	\N	2
557	2	DS 693 GT	\N	\N	2026-04-03 13:03:12.236651+00	2056.00	f	\N	2026-04-03 13:15:28.749154+00	CASH	\N	209	ASC-D	410		0		0	\N	2
553	2	DJ10SXT	\N	\N	2026-04-03 12:50:52.785523+00	3000.00	f	\N	2026-04-03 13:24:16.995151+00	OP	\N	\N		0		0		0	\N	2
558	2	dj 88 vsg	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4CAPACE CONTINENTAL WINTER 145 45 18 DOT 2624 MM 7\nMONTAT GOODIEAR 245 45 18	2026-04-03 13:57:55.084577+00	256.00	f	\N	2026-04-03 14:03:54.780435+00	CARD	\N	211	ASC-D	411		0		0	\N	2
580	2	CJ24BTT	\N	ANV MONTATE CONTI ECO CONTACT 5 205 55 16 MM 6 6 6 6  PRESIUNE FATA SPATE 2,3 NM 120 \nCUSTODIE ANV  JANTE OTEL CONTINENTAL WINTER CONTACTTS870 MM 6 6 5 5 DOT 2625	2026-04-06 07:14:16.558245+00	226.00	f	\N	2026-04-06 07:15:18.457385+00	OP	\N	229	ASC-D	423		0		0	\N	2
565	2	DJ45BLN	\N	\N	2026-04-06 06:06:14.219187+00	180.00	f	\N	2026-04-06 06:10:19.48343+00	CASH	\N	218		0		0		0	\N	2
559	2	DJ10VUT	\N	ANV MONTATE BRIDGESTONE POTENZA 275 35 21 325 30 21 MM 5 5 5 5 PRESIUNE FATA SPATE 2,5 2,7 NM 160 \nCUSTODIE ANV GOODYEAR ULTRA GRIP 275 35 21 325 30 21 MM8 8 8 8 DOT 1925 3625	2026-04-03 14:08:10.217346+00	694.00	f	\N	2026-04-03 14:08:54.458091+00	CARD	\N	212	ASC-D	412		0		0	\N	2
561	2	dj 50 anp	\N	CUSTODIE 4 ANV 4JANTE ALIAJ 4CAPACE BRIDGESTONE BLIZZAK 225 65 17 DOT 2321 MM5\nMONTAT BRIDGESTONE 225 65 17	2026-04-06 05:30:36.270909+00	256.00	f	\N	2026-04-06 05:32:47.398547+00	CARD	\N	213	ASC-D	413		0		0	\N	2
569	2	VL36KTY	\N	\N	2026-04-06 06:08:25.472863+00	250.00	f	\N	2026-04-06 06:12:01.255439+00	CARD	\N	219	ASC-D	415		0		0	\N	2
562	2	B173DNC	\N	ANV REPARATA KUMHO WINTER KRAFT 225 60 18 MM 6 PRESIUNE 2,2 NM 120	2026-04-06 05:41:53.353472+00	84.00	f	\N	2026-04-06 05:44:35.211155+00	CASH	\N	215		0		0		0	\N	2
560	2	dj 09tac	\N	\N	2026-04-06 05:28:36.832594+00	100.00	f	\N	2026-04-06 05:57:46.358478+00	CASH	\N	\N		0		0		0	\N	2
567	2	DJ18YPF	\N	MOTATVMICHELIN 225/45/18 NOU\n\nCUSTODIE\nVREDESTEIN WINTRAC PRO \n195/50/18  7MM\n3724	2026-04-06 06:08:21.7962+00	160.00	f	\N	2026-04-06 06:15:45.095544+00	CASH	\N	\N		0		0		0	\N	2
570	2	DJ 21 PEC	\N	\N	2026-04-06 06:15:22.491488+00	868.00	f	\N	2026-04-06 06:56:26.995332+00	CASH	\N	222	ASC-D	419		0		0	\N	2
581	2	DJ 15 LAL	\N	BRIDGESTONE 245/45/19 7MM 2,4 BARI (SAU MONTAT )\n\nHANKOOK WINTER ICEPT 245/45/19 5MM DOT 3520 ( CUST NOUA=4 ANVELOPE)	2026-04-06 07:17:02.977457+00	562.00	f	\N	2026-04-06 07:17:32.099853+00	CARD	\N	230	ASC-D	424		0		0	\N	2
575	2	DJ76NIT	\N	\N	2026-04-06 06:37:43.801473+00	300.00	f	\N	2026-04-06 06:59:44.123969+00	OP	\N	\N		0		0		0	\N	2
576	2	DJ11MUS	\N	ANV CLIENT BRIDGESTONE TURANZA 255 40 20 MM 6 6 6 6PRESIUNE 2,3 NM 140	2026-04-06 06:47:51.50718+00	320.00	f	\N	2026-04-06 06:59:58.404028+00	CASH	\N	224	ASC-D	420		0		0	\N	2
571	2	dj75rau	\N	\N	2026-04-06 06:16:59.175222+00	136.00	f	\N	2026-04-06 06:19:00.347471+00	CASH	\N	217	ASC-D	416		0		0	\N	2
583	2	DJ44BOL	\N	\N	2026-04-06 07:24:05.938024+00	136.00	f	\N	2026-04-06 07:30:39.796626+00	CASH	\N	\N	ASC-D	427		0		0	\N	2
572	2	DJ79NLY	\N	\N	2026-04-06 06:18:39.13866+00	60.00	f	\N	2026-04-06 06:24:22.310808+00	CASH	\N	220		0		0		0	\N	2
582	2	dj71dnd	\N	\N	2026-04-06 07:22:13.684879+00	144.00	f	\N	2026-04-06 07:23:05.860463+00	CASH	\N	226	ASC-D	425		0		0	\N	2
573	2	dj30ptl	\N	\N	2026-04-06 06:21:02.08129+00	500.00	f	\N	2026-04-06 07:01:32.545213+00	CARD	\N	221	ASC-D	421		0		0	\N	2
563	2	DJ 01 PWL	\N	\N	2026-04-06 05:57:20.135233+00	2888.00	f	\N	2026-04-06 06:28:26.785515+00	CASH	\N	223	ASC-D	417		0		0	\N	2
574	2	DJ20CCK	\N	\N	2026-04-06 06:37:11.542526+00	250.00	f	\N	2026-04-06 06:42:51.889839+00	CARD	\N	\N		0		0		0	\N	2
568	2	DJ 26 PYM	\N	NORDMAN WR 215/55/17 6MM DOT=4318 ( CUST. 4 ANV.,4 JANTE OTEL )\n\nPIRELLI PZERO 215/55/17 5MM 2,3 BARI ( SAU MONTAT )	2026-04-06 06:08:22.672093+00	256.00	f	\N	2026-04-06 07:01:45.336272+00	CARD	\N	\N		0		0		0	\N	2
578	2	dj 98 jnx	\N	215 45 18 TOIO	2026-04-06 07:08:27.771878+00	168.00	f	\N	2026-04-06 07:09:07.681839+00	CARD	\N	227		0		0		0	\N	2
592	2	dj64wxw	\N	\N	2026-04-06 08:00:30.06132+00	100.00	f	\N	2026-04-06 08:03:57.625123+00	CASH	\N	\N	ASC-D	433		0		0	\N	2
579	2	DJ89FMX	\N	\N	2026-04-06 07:09:32.658204+00	180.00	f	\N	2026-04-06 07:12:21.137811+00	CARD	\N	228	ASC-D	422		0		0	\N	2
590	2	b341frt	\N	\N	2026-04-06 07:49:06.677723+00	256.00	f	\N	2026-04-06 07:52:02.925259+00	OP	\N	231	ASC-D	430		0		0	\N	2
584	2	DJ30PTL	\N	\N	2026-04-06 07:30:34.39293+00	180.00	f	\N	2026-04-06 07:39:25.712731+00	CARD	\N	232	ASC-D	428		0		0	\N	2
587	2	dj 08 mlp	\N	CONTINENTAL 205 60 16	2026-04-06 07:40:01.315285+00	136.00	f	\N	2026-04-06 07:40:26.640677+00	CARD	\N	234		0		0		0	\N	2
593	2	dj 22 ash	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4CAPACE BARUM POLARIS5 224 45 17 DOT 2519 MM5\nMONTAT KUMHO 245 45 18	2026-04-06 08:02:04.243677+00	256.00	f	\N	2026-04-06 08:02:40.772107+00	CASH	\N	237	ASC-D	432		0		0	\N	2
585	2	DJ78MRX	\N	ANV MONTATE HANKOOK VENTUS 4 PRIME 235 45 18 MM 8 8 8 8 PRESIUNE 2.4NM 120\n ROTILE DE  IARNA SE CASEAZA	2026-04-06 07:36:50.475142+00	96.00	f	\N	2026-04-06 07:41:32.702166+00	CARD	\N	233	ASC-D	429		0		0	\N	2
1249	2	DJ68FRT	\N	4 ANVELOPE KUMHO 205 65 16 DOT 15 23 MM 6	2026-04-20 06:06:50.921389+00	268.00	f	\N	2026-04-20 06:22:55.033768+00	OP	\N	813	ASC-D	931		0		0	\N	2
595	2	DJ 12 LYU	\N	BRIDGESTONE BLIZAK 195/65/15 3MM DOT2922 ( CUST 4ANVELOPE,4 JANTE OTEL, 4CAPACE)\n\nGOODYEAR 195/65/15 7MM 2,5 BARI ( SAU MONTAT 4ROTI )	2026-04-06 08:11:12.614464+00	226.00	f	\N	2026-04-06 08:14:46.565285+00	CARD	\N	240	ASC-D	435		0		0	\N	2
591	2	VL22DAN	\N	\N	2026-04-06 07:54:32.737656+00	180.00	f	\N	2026-04-06 07:59:50.709441+00	CASH	\N	236	ASC-D	431		0		0	\N	2
596	2	dj 84 wpo	\N	CUSTODIE 4ANV 4JANTE ALIAJ MICHELIN ALP7 205 55 17 DOT 1024 MM7\nMONTAT GOODIEAR 205 55 17	2026-04-06 08:18:29.514211+00	256.00	f	\N	2026-04-06 08:26:25.989129+00	CASH	\N	241	ASC-D	436		0		0	\N	2
594	2	dj28gie	\N	\N	2026-04-06 08:10:31.444416+00	48.00	f	\N	2026-04-06 08:14:34.950494+00	CARD	\N	239		0		0		0	\N	2
597	2	DJ87LNA	\N	ANV MONTATE BRIDGESTONE ALENZA 001 235 50 20 MM 8 8 8 8PRESIUNE FATA SPATE 2,4 NM 130\nCUSTODIE ANV GOODYEAR ULTRA GRIP235 50 20 MM 7 7 7 7 DOT 4424	2026-04-06 08:18:53.434796+00	374.00	f	\N	2026-04-06 08:21:12.168603+00	CARD	\N	243		0		0		0	\N	2
588	2	DJ 11 JRB	\N	MICHELIN A6 195/65/15 6MM DOT 1923 ( CUST 4 ANVELOPE )\n\nKUMHO 195/65/15 5MM 2,4 BARI (SAU MONTAT 4 ANVELOPE )	2026-04-06 07:45:50.347177+00	252.00	f	\N	2026-04-06 08:46:02.60078+00	CASH	\N	\N	ASC-D	437		0		0	\N	2
599	2	dj26eam	\N	\N	2026-04-06 08:38:23.313881+00	224.00	f	\N	2026-04-06 08:42:46.091913+00	CARD	\N	242		0		0		0	\N	2
586	2	DJ35KMY	\N	\N	2026-04-06 07:38:19.612471+00	250.00	f	\N	2026-04-06 11:38:11.428466+00	CASH	\N	\N		0		0		0	\N	2
800	2	DJ08JFC	\N	\N	2026-04-08 11:42:09.261054+00	1092.00	f	\N	2026-04-08 12:09:28.57807+00	CASH	\N	399	ASC-D	600		0		0	\N	2
616	2	DJ 27 LIR	\N	5X10 PIULITE ( TOYOTA 11939F ) =50 LEI	2026-04-06 10:00:18.602205+00	68.00	f	\N	2026-04-06 10:00:52.319042+00	CARD	\N	\N		0		0		0	\N	2
644	2	DJ84ZHO	\N	\N	2026-04-06 12:24:39.423006+00	180.00	f	\N	2026-04-06 12:29:13.784093+00	CARD	\N	276		0		0		0	\N	2
600	2	B 23 VSS	\N	MICHELIN PRIMACY3 225/50/18 ( ANVELOPE CLIENT)	2026-04-06 08:53:49.362139+00	176.00	f	\N	2026-04-06 08:54:44.459759+00	CARD	\N	245	ASC-D	438		0		0	\N	2
601	2	b 513 brb	\N	275 40 18 2BUC\n245 45 18 2 BUC	2026-04-06 08:54:11.978507+00	168.00	f	\N	2026-04-06 08:55:02.495771+00	CARD	\N	246	ASC-D	439		0		0	\N	2
617	2	DJ86STI	\N	\N	2026-04-06 10:01:12.659136+00	250.00	f	\N	2026-04-06 10:04:04.208572+00	CASH	\N	\N		0		0		0	\N	2
602	2	DJ98ECA	\N	\N	2026-04-06 08:57:07.065089+00	216.00	f	\N	2026-04-06 08:58:31.838799+00	CARD	\N	\N	ASC-D	440		0		0	\N	2
640	2	DJ57PTC	\N	\N	2026-04-06 11:57:39.202831+00	180.00	f	\N	2026-04-06 12:03:40.562472+00	CASH	\N	273		0		0		0	\N	2
636	2	DJ 77 GMD	\N	ANVELOPE CLIENT CONTINENTAL 235/60/28 S SI KUMHO 235/60/18 FATAPATE	2026-04-06 11:31:57.395163+00	176.00	f	\N	2026-04-06 11:32:54.360346+00	CASH	\N	\N	ASC-D	466		0		0	\N	2
603	2	dj44mty	\N	4ANVELOPE 4CAPACE CENTRU 4JANTE ALIAJ GOODYEAR 2316 MM5	2026-04-06 09:00:27.69431+00	256.00	f	\N	2026-04-06 09:02:33.762741+00	CARD	\N	244	ASC-D	441		0		0	\N	2
618	2	B50MHX	\N	\N	2026-04-06 10:03:14.892959+00	300.00	f	\N	2026-04-06 10:08:15.550474+00	OP	\N	256	ASC-D	450		0		0	\N	2
605	2	DJ20GXM	\N	\N	2026-04-06 09:10:23.93317+00	250.00	f	\N	2026-04-06 09:15:59.990971+00	CASH	\N	247	ASC-D	442		0		0	\N	2
624	2	DJ10GTZ	\N	\N	2026-04-06 10:35:33.894108+00	250.00	f	\N	2026-04-06 10:43:28.920012+00	CASH	\N	\N	ASC-D	457		0		0	\N	2
630	2	GJ60SND	\N	ANV MONTATE  MICHELIN PILOT SPORT 4S 265 35 21 295 30 21 MM 7 7 7 7 PRESIUNE 2,8 FATA SPATE NM 175 \nANV CUSTODIE 265 35 21 295 30 2`1  MICHELIN PILOT ALPIN 5 MM 8 8 8 8 DOT 4425	2026-04-06 11:02:14.217992+00	654.00	f	\N	2026-04-06 11:03:04.244489+00	CARD	\N	266	ASC-D	462		0		0	\N	2
608	2	dj 86 aud	\N	TAURUS 225 55 16	2026-04-06 09:25:18.233716+00	148.00	f	\N	2026-04-06 09:26:36.621179+00	CARD	\N	249	ASC-D	443		0		0	\N	2
610	2	dj89cip	\N	\N	2026-04-06 09:28:44.477394+00	96.00	f	\N	2026-04-06 09:29:47.305636+00	CASH	\N	248		0		0		0	\N	2
620	2	dj66myc	\N	\N	2026-04-06 10:12:28.258935+00	176.00	f	\N	2026-04-06 10:15:07.726818+00	CASH	\N	254		0		0		0	\N	2
626	2	OT 11 XKY	\N	MICHELIN PS5 255/45/19 6MM DOT3925 2,5 BARI (SAU MONTAT)\n\nΜICHELIN PA5 255/45/19 6MM (CUSTODIE 4 ANVELOPE)	2026-04-06 10:43:03.93708+00	346.00	f	\N	2026-04-06 10:45:43.847989+00	CARD	\N	262	ASC-D	458		0		0	\N	2
619	2	OT02MZN	\N	\N	2026-04-06 10:08:30.903005+00	180.00	f	\N	2026-04-06 10:15:16.889146+00	CARD	\N	257	ASC-D	451		0		0	\N	2
609	2	DJ09CFC	\N	\N	2026-04-06 09:26:49.538152+00	300.00	f	\N	2026-04-06 09:31:02.51376+00	CASH	\N	250	ASC-D	444		0		0	\N	2
612	2	B955TIO	\N	ANV MONTATE 185 65 15 BRIDGESTONE ECOPIA MM 8 8 8 8 PRESIUNE 2. FATA SPATE NM 110	2026-04-06 09:30:48.32172+00	136.00	f	\N	2026-04-06 09:32:51.1993+00	OP	\N	251	ASC-D	446		0		0	\N	2
613	2	DJ31WPO	\N	\N	2026-04-06 09:31:44.486147+00	300.00	f	\N	2026-04-06 09:36:31.160274+00	CARD	\N	\N		0		0		0	\N	2
607	2	B834AUT	\N	\N	2026-04-06 09:21:38.372083+00	734.00	f	\N	2026-04-06 09:47:11.453143+00	CASH	\N	\N	ASC-D	447		0		0	\N	2
622	2	DJ09EMI	\N	\N	2026-04-06 10:22:19.992184+00	806.00	f	\N	2026-04-06 10:52:14.284983+00	OP	\N	\N	ASC-D	459		0		0	\N	2
633	2	dj85wks	\N	285 45 22 PIRELLI SCORPION 4 JANTE ALIAJ 4 CAPACE CENTRU 4 ANVELOPE DOT 09 24 MM 6	2026-04-06 11:06:19.521137+00	538.00	f	\N	2026-04-06 11:07:27.861563+00	CARD	\N	263	ASC-D	463		0		0	\N	2
627	2	DJ22GMM	\N	\N	2026-04-06 10:50:12.900781+00	360.00	f	\N	2026-04-06 10:55:07.652035+00	CARD	\N	265	ASC-D	460		0		0	\N	2
615	2	dj 11 dyz	\N	225 60 18 CONTINENTAL	2026-04-06 09:59:24.500676+00	176.00	f	\N	2026-04-06 10:00:09.126737+00	CARD	\N	255	ASC-D	448		0		0	\N	2
621	2	dj 85 acm	\N	205 55 16 DUNLOP	2026-04-06 10:20:13.112541+00	76.00	f	\N	2026-04-06 10:21:07.556073+00	CARD	\N	259	ASC-D	453		0		0	\N	2
628	2	DJ82MOD	\N	\N	2026-04-06 10:50:13.197625+00	120.00	f	\N	2026-04-06 10:55:47.902556+00	CARD	\N	264		0		0		0	\N	2
614	2	GJ55YRA	\N	PRESIUNE 2,3 FATA SPATE NM 140	2026-04-06 09:34:37.375243+00	7868.00	f	\N	2026-04-06 10:38:26.330763+00	CARD	\N	258	ASC-D	452		0		0	\N	2
637	2	dj84zho	\N	\N	2026-04-06 11:34:13.121541+00	104.00	f	\N	2026-04-06 11:35:31.703694+00	CARD	\N	269	ASC-D	467		0		0	\N	2
629	2	dj 96 xax	\N	315 35 20 2BUC\n275 40 20 2BUC LINGLONG	2026-04-06 10:59:55.106952+00	248.00	f	\N	2026-04-06 11:02:00.389442+00	CASH	\N	216	ASC-D	461		0		0	\N	2
623	2	OT08MIF	\N	\N	2026-04-06 10:33:07.128717+00	120.00	f	\N	2026-04-06 10:39:34.110916+00	CASH	\N	261	ASC-D	454		0		0	\N	2
598	2	DJ  115  CWO	\N	ANV MONTATE 185  65 15 CONTINENTAL  ECOCONTACT  6 ANV CUSTODIE  185  65  15  HANKOOK  WINER  I CEPT RS E	2026-04-06 08:36:57.364466+00	252.00	f	\N	2026-04-06 11:37:22.60575+00	CARD	\N	\N		0		0		0	\N	2
625	2	dj 81clc	\N	4 JANTE ALIAJ 4CAPACE CENTRU 4 ANVELOPE DOT2421 MM6 GOODYEAR 255 40 19	2026-04-06 10:37:30.944648+00	296.00	f	\N	2026-04-06 10:41:54.665139+00	CASH	\N	260	ASC-D	456		0		0	\N	2
634	2	GJ55YRA	\N	\N	2026-04-06 11:08:47.42045+00	120.00	f	\N	2026-04-06 11:12:51.922488+00	CARD	\N	\N		0		0		0	\N	2
632	2	DJ14DZY	\N	\N	2026-04-06 11:05:04.618412+00	180.00	f	\N	2026-04-06 11:14:15.838678+00	CARD	\N	268	ASC-D	464		0		0	\N	2
641	2	DJ24XTX	\N	ANV MONTATE MICHELIN PILOT SPORT 4 SUV 275 45 20 305 40 20 MM 4 4 5 5 PRESIUNE FATA SPATE 2,4 NM 140 \nCUSTODIE ANV PIRELLI WINTER 275 45 20 305 40 20 MM 4 4 5 5 DOT 3421	2026-04-06 11:57:41.64055+00	1374.00	f	\N	2026-04-06 12:04:19.656294+00	CASH	\N	274	ASC-D	470		0		0	\N	2
635	2	OT07HAZ	\N	\N	2026-04-06 11:22:26.020409+00	250.00	f	\N	2026-04-06 11:27:34.976308+00	CASH	\N	\N	ASC-D	465		0		0	\N	2
643	2	DJ 82 CRD	\N	\N	2026-04-06 12:07:21.150562+00	180.00	f	\N	2026-04-06 12:08:59.232053+00	CARD	\N	\N	ASC-D	472		0		0	\N	2
631	2	DJ81DMN	\N	\N	2026-04-06 11:03:19.227531+00	3736.00	f	\N	2026-04-06 11:58:31.827034+00	CARD	\N	\N	ASC-D	468		0		0	\N	2
638	2	dj18cnf	\N	\N	2026-04-06 11:41:08.349675+00	400.00	f	\N	2026-04-06 11:43:26.060324+00	CASH	\N	270	ASC-D	469		0		0	\N	2
639	2	dj 61 blc	\N	VIKING 225 40 18	2026-04-06 11:49:45.761563+00	216.00	f	\N	2026-04-06 11:50:32.81577+00	CASH	\N	272		0		0		0	\N	2
646	2	DJ96WID	\N	\N	2026-04-06 12:30:22.518331+00	132.00	f	\N	2026-04-06 12:31:30.241945+00	CARD	\N	275	ASC-D	473		0		0	\N	2
642	2	dj12car	\N	4 ANVELOPE 195 55 16 SAILUN DOT 16 20 MM6	2026-04-06 12:02:05.354357+00	256.00	f	\N	2026-04-06 12:06:12.253598+00	CARD	\N	271	ASC-D	471		0		0	\N	2
606	2	GJ03MEG	\N	\N	2026-04-06 09:15:02.470937+00	1250.00	f	\N	2026-04-06 12:30:40.336972+00	CASH	\N	277	ASC-D	449		0		0	\N	2
649	2	dj 31 sfe	\N	GOODIEAR 215 65 16	2026-04-06 12:34:30.617824+00	76.00	f	\N	2026-04-06 12:35:32.90572+00	CASH	\N	279	ASC-D	474		0		0	\N	2
647	2	VL85DMG	\N	\N	2026-04-06 12:30:38.495747+00	708.00	f	\N	2026-04-06 13:03:20.0807+00	CARD	\N	278	ASC-D	481		0		0	\N	2
650	2	DJ50MUS	\N	ANV MONTATE  265 40 21 295  35 21 MM 5 5 5  5 PRESIUNE FATA SPATE 2,3 2,5 NM CONTI SPORT CONTACT 7 NM140	2026-04-06 12:39:35.788409+00	568.00	f	\N	2026-04-06 12:40:41.641145+00	CASH	\N	280	ASC-D	476		0		0	\N	2
648	2	DJ30MBE	\N	\N	2026-04-06 12:33:45.781776+00	180.00	f	\N	2026-04-06 12:38:36.949096+00	CARD	\N	\N	ASC-D	475		0		0	\N	2
645	2	CB9772XO	\N	\N	2026-04-06 12:27:06.968895+00	350.00	f	\N	2026-04-06 12:44:19.010895+00	CASH	\N	\N	ASC-D	477		0		0	\N	2
651	2	VL 62 DML	\N	ANV CLIENT DEBICA 195/65/15 MONT.4 ANVELOPE	2026-04-06 12:44:47.499188+00	136.00	f	\N	2026-04-06 12:45:33.658358+00	OP	\N	\N	ASC-D	478		0		0	\N	2
652	2	b 827 flx	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4 CAPACE KUMHO 215 55 18DOT 1625 MM7\nMONTAT 215 55 18	2026-04-06 12:55:07.031941+00	256.00	f	\N	2026-04-06 12:57:46.643612+00	CARD	\N	282	ASC-D	479		0		0	\N	2
662	2	DJ01WTE	\N	\N	2026-04-06 13:48:06.711969+00	3824.00	f	\N	2026-04-06 14:31:32.074321+00	CASH	\N	295	ASC-D	491		0		0	\N	2
604	2	OT08MIF	\N	\N	2026-04-06 09:09:05.110632+00	824.00	f	\N	2026-04-07 13:04:23.832499+00	CASH	\N	253	ASC-D	455		0		0	\N	2
1467	2	DJ17RCG	\N	\N	2026-04-22 07:11:36.425027+00	1822.00	f	\N	2026-04-22 08:10:45.195655+00	CASH	\N	1015	ASC-D	1090		0		0	\N	2
653	2	B816DVR	\N	CONTINENTAL 255 50 20 4 ANVELOPE 4 JANTE ALIAJ 4 CAPACE CENTRU DOT47 23 MM6	2026-04-06 12:57:18.172248+00	320.00	f	\N	2026-04-06 13:03:01.175947+00	CARD	\N	281	ASC-D	480		0		0	\N	2
1253	2	DJ82BLU	\N	\N	2026-04-20 06:26:28.687815+00	88.00	f	\N	2026-04-20 06:29:51.300851+00	CARD	\N	820		0		0		0	\N	2
1283	2	DJ88ADB	\N	\N	2026-04-20 09:30:34.387228+00	128.00	f	\N	2026-04-20 09:34:20.191828+00	CASH	\N	848		0		0		0	\N	2
1423	2	DJ70NIS	\N	\N	2026-04-21 11:45:45.909115+00	2176.00	f	\N	2026-04-21 12:20:19.834341+00	CARD	\N	981	ASC-D	1057		0		0	\N	2
654	2	DJ98LRI	\N	\N	2026-04-06 13:27:56.299739+00	250.00	f	\N	2026-04-06 13:33:10.205315+00	CASH	\N	284	ASC-D	484		0		0	\N	2
1287	2	DJ64HAR	\N	4 ANVELOPE 4 JANTE OTEL RIKEN DOT 29 23 MM 7	2026-04-20 09:38:55.815295+00	226.00	f	\N	2026-04-20 09:40:09.068205+00	CARD	\N	846	ASC-D	949		0		0	\N	2
659	2	DJ16HSD	\N	ANV MONTATE BRIDGESTONE ECOPIA 205 55 16 MM 5 5 4 4 PRESIUNE FATA SPATE 2,4 NM 120  ANV DE IARNA SE CASEAZA	2026-04-06 13:38:20.058551+00	136.00	f	\N	2026-04-06 13:40:03.205544+00	CARD	\N	287	ASC-D	485		0		0	\N	2
1286	2	DJ90LDO	\N	\N	2026-04-20 09:36:51.540937+00	1496.00	f	\N	2026-04-20 10:21:38.60246+00	CASH	\N	853	ASC-D	952		0		0	\N	2
663	2	B 550 BAW	\N	PIRELLI WINTER 275/35/21 DOT 0316 4MM\nPIRELLI WINTER 315/30/21 DOT4117 4MM (CUST 4 ANVELOPE )\n\nPIRELLI PZERO 27/35/21 5MM 2,40 BARI\nPIRELLI PZERO 315/30/21 6MM 2,40 BARI	2026-04-06 13:53:25.739938+00	694.00	f	\N	2026-04-06 13:54:29.450405+00	CARD	\N	289		0		0		0	\N	2
655	2	VL85DMG	\N	\N	2026-04-06 13:28:46.460304+00	180.00	t	2026-04-08 18:07:04.60031+00	2026-04-06 13:32:17.509288+00	CARD	\N	278	ASC-D	483		0		0	\N	2
1308	2	SB53CCI	\N	\N	2026-04-20 11:34:56.350391+00	180.00	f	\N	2026-04-20 11:38:12.763476+00	CARD	\N	868		0		0		0	\N	2
1314	2	B188FRT	\N	4ANV 205\\60\\16 DOT3424 6MM KUMHO	2026-04-20 12:12:17.460761+00	252.00	f	\N	2026-04-20 12:15:38.502261+00	OP	\N	871	ASC-D	968		0		0	\N	2
1317	2	DJ19SRY	\N	\N	2026-04-20 12:19:25.730497+00	250.00	f	\N	2026-04-20 12:22:29.132476+00	CASH	\N	877		0		0		0	\N	2
1639	2	DJ89NOY	\N	ONCICA A MONTAT ROATA	2026-04-24 08:39:46.023122+00	187.00	f	\N	2026-04-24 11:39:43.8758+00	OP	\N	1179	ASC-D	1239		0		0	\N	2
1444	2	OT12MSM	\N	\N	2026-04-21 13:37:55.744034+00	250.00	f	\N	2026-04-21 13:41:54.027784+00	CASH	\N	994		0		0		0	\N	2
1315	2	B555SPY	\N	\N	2026-04-20 12:12:49.160528+00	1304.00	f	\N	2026-04-20 14:09:10.364388+00	OP	\N	896	ASC-D	983		0		0	\N	2
1483	2	DJ07XGK	\N	\N	2026-04-22 08:51:39.350812+00	72.00	f	\N	2026-04-22 08:52:30.449318+00	CASH	\N	1028	ASC-D	1099		0		0	\N	2
1340	2	DJ82SYB	\N	\N	2026-04-20 13:51:41.068195+00	156.00	f	\N	2026-04-20 14:29:40.686693+00	CASH	\N	900	ASC-D	988		0		0	\N	2
1375	2	DJ94LMS	\N	\N	2026-04-21 07:28:17.332939+00	2560.00	f	\N	2026-04-21 08:33:16.254806+00	OP	\N	\N		0		0		0	\N	2
1446	2	DJ83DRC	\N	ANV CLIENT BRIDGESTONE TURANZA 195 5516 MM 5 5 5 5NM 110 PRESIUNE FATA SPATE 2,2	2026-04-21 13:42:44.264012+00	136.00	f	\N	2026-04-21 13:44:05.691032+00	CASH	\N	996	ASC-D	1065		0		0	\N	2
1435	2	OT23YTJ	\N	\N	2026-04-21 12:29:37.709032+00	250.00	f	\N	2026-04-21 13:56:29.923487+00	CASH	\N	984		0		0		0	\N	2
1401	2	DJ20SEA	\N	\N	2026-04-21 09:34:10.151918+00	1560.00	t	2026-04-21 10:37:09.40709+00	\N	NEPLATIT	\N	955		0		0		0	\N	2
1403	2	B882KWG	\N	\N	2026-04-21 09:40:55.765274+00	148.00	f	\N	2026-04-21 11:02:14.043138+00	OP	\N	\N	ASC-D	1031		0		0	\N	2
1424	2	DJ44HZI	\N	4 ANVELOPE NOKIAN 245 35 20 MM 6 DOT 31 19	2026-04-21 11:48:45.132283+00	366.00	f	\N	2026-04-21 11:49:36.949618+00	CARD	\N	972	ASC-D	1050		0		0	\N	2
1581	2	DJ78LVY	\N	MICHELIN 205 45 17	2026-04-23 11:17:31.498397+00	168.00	f	\N	2026-04-23 11:18:09.47233+00	CASH	\N	1126	ASC-D	1182		0		0	\N	2
1378	2	B103WSW	\N	\N	2026-04-21 07:59:59.216463+00	304.00	f	\N	2026-04-21 12:04:41.027523+00	CARD	\N	\N	ASC-D	1030		0		0	\N	2
1462	2	DJ09SMC	\N	\N	2026-04-22 06:37:37.442086+00	580.00	f	\N	2026-04-22 06:41:52.910764+00	CASH	\N	1011	ASC-D	1080		0		0	\N	2
1427	2	OT67ACD	\N	\N	2026-04-21 12:00:10.899392+00	250.00	f	\N	2026-04-21 12:06:57.613041+00	CASH	\N	975	ASC-D	1053		0		0	\N	2
1505	2	B410DEM	\N	2 ANVELOPE CUSTODIE 275 45 21 DOT 34 24 2 ANVELOPE CUSTODIE 315 40 21 DOT 33 24	2026-04-22 11:00:17.955643+00	6608.00	f	\N	2026-04-22 12:05:49.37317+00	CARD	\N	1057	ASC-D	1123		0		0	\N	2
1431	2	DJ48TEH	\N	\N	2026-04-21 12:13:02.916402+00	96.00	f	\N	2026-04-21 12:15:40.153627+00	CASH	\N	979		0		0		0	\N	2
1464	2	DJ61CMM	\N	ANV CLIENT DAVANTI DX740 235 6018 MM 7 7 7 7 ANVELOPELE AU BATAIE RADIALA PRESIUNE FATA SPATE 2,3 NM 120	2026-04-22 06:45:26.692927+00	96.00	f	\N	2026-04-22 06:47:23.753992+00	CASH	\N	1012	ASC-D	1082		0		0	\N	2
1562	2	OT77BIV	\N	\N	2026-04-23 08:39:27.694764+00	120.00	f	\N	2026-04-23 08:44:30.703845+00	CASH	\N	1109		0		0		0	\N	2
1524	2	OT60AGM	\N	ROTI COMPLETE PIRELLI 275/50/20 4BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU CONTINENTAL WINTERCONTACT 275/50/20 DOT1923 6MM 4BUC	2026-04-22 13:23:28.936218+00	360.00	f	\N	2026-04-22 13:24:08.793113+00	CASH	\N	1072	ASC-D	1136		0		0	\N	2
1465	2	OT01WHL	\N	PRESIUNE 2,4 FATA SPATE NM 130	2026-04-22 07:04:06.863956+00	3592.00	f	\N	2026-04-22 07:33:48.436879+00	CARD	\N	1016	ASC-D	1085		0		0	\N	2
1617	2	DJ33BBE	\N	\N	2026-04-24 06:41:41.141791+00	480.00	f	\N	2026-04-24 06:53:54.837774+00	CASH	\N	\N	ASC-D	1212		0		0	\N	2
1564	2	B196SYS	\N	4 ANVELOPE CUSTODIE HANKOK 195 55 16 DOT 25 25 MM 6	2026-04-23 08:42:12.233057+00	252.00	f	\N	2026-04-23 08:45:14.521732+00	CARD	\N	1111	ASC-D	1167		0		0	\N	2
1596	2	MOTO	\N	\N	2026-04-23 12:48:40.292279+00	110.00	f	\N	2026-04-23 12:50:41.366371+00	CASH	\N	1142		0		0		0	\N	2
1544	2	DJ09LRY	\N	4ANV KUMHO 205\\55\\17DOT 1824 6MM	2026-04-23 06:11:20.738341+00	1368.00	f	\N	2026-04-23 08:32:56.619929+00	CASH	\N	1095	ASC-D	1158		0		0	\N	2
1561	2	DJ01NSA	\N	\N	2026-04-23 08:37:39.529+00	5310.00	f	\N	2026-04-23 10:00:53.823812+00	CARD	\N	1108	ASC-D	1174		0		0	\N	2
1626	2	DJ07XRM	\N	\N	2026-04-24 07:23:34.099431+00	1100.00	f	\N	2026-04-24 08:18:30.416684+00	CARD	\N	1173	ASC-D	1219		0		0	\N	2
1579	2	B125SXE	\N	ANV MONTATE GOODYEAR EAGLE F1 215   5517 MM 7 7 6 6 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-23 10:53:27.201127+00	176.00	f	\N	2026-04-23 10:54:57.102841+00	OP	\N	\N	ASC-D	1179		0		0	\N	2
1599	2	DJ91MOD	\N	ANVELOPE CLIENT\n\nHANKOOK VENTUS 215/55/17 6MM 2,6 BARI	2026-04-23 13:21:10.626556+00	176.00	f	\N	2026-04-23 13:22:23.055824+00	CARD	\N	1144	ASC-D	1198		0		0	\N	2
1653	2	DJ18HWW	\N	ANV CLIENT KUMHO 205/60/16 4BUC SAU MONTAT	2026-04-24 10:02:08.655372+00	136.00	f	\N	2026-04-24 10:05:09.631425+00	CARD	\N	1194		0		0		0	\N	2
1616	2	DJ67GRS	\N	\N	2026-04-24 06:40:53.269383+00	556.00	f	\N	2026-04-24 07:27:22.508784+00	OP	\N	1159	ASC-D	1222		0		0	\N	2
1621	2	DJ27ROZ	\N	4ANV MICHELIN ALPIN 215\\60\\17 DOT 3124 6MM 4 JANTE ALIAJ 4CAPACE LA CENTRU	2026-04-24 07:07:47.789642+00	256.00	f	\N	2026-04-24 07:08:54.961262+00	CASH	\N	1160	ASC-D	1214		0		0	\N	2
1636	2	DJ30PPM	\N	\N	2026-04-24 08:25:52.115146+00	120.00	f	\N	2026-04-24 08:28:54.49284+00	CASH	\N	1176		0		0		0	\N	2
1657	2	DJ02MSB	\N	CUSTODIE 4 ANV 4JANTE OTEL HANKOOK WINTER 215 65 16 DOT 2321 MM 6\nMONTAT 225 45 19 GOODIEAR	2026-04-24 10:31:15.670809+00	254.00	f	\N	2026-04-24 10:32:18.176714+00	CASH	\N	1198	ASC-D	1240		0		0	\N	2
1656	2	OT54DRS	\N	\N	2026-04-24 10:15:26.794839+00	300.00	f	\N	2026-04-24 10:19:06.426705+00	CASH	\N	1197		0		0		0	\N	2
1659	2	DJ17HNT	\N	4 ANVELOPE HANKOK WINTER 215 55 17 DOT 37 17 MM 4 CUSTODIE NOUA	2026-04-24 10:33:35.128721+00	316.00	f	\N	2026-04-24 10:36:08.291314+00	CASH	\N	1200	ASC-D	1241		0		0	\N	2
1675	2	MH01DEU	\N	\N	2026-04-24 12:12:20.289363+00	120.00	f	\N	2026-04-24 12:13:40.574243+00	CARD	\N	1214	ASC-D	1252		0		0	\N	2
1670	2	DJ67HMT	\N	INDREPTAT JANTA ALIN	2026-04-24 11:55:27.152949+00	1928.00	f	\N	2026-04-24 12:30:12.642281+00	OP	\N	1210	ASC-D	1254		0		0	\N	2
1690	2	DJ13MSI	\N	\N	2026-04-24 13:39:13.965485+00	76.00	f	\N	2026-04-24 13:42:12.221191+00	CASH	\N	1229		0		0		0	\N	2
1684	2	DJ97AME	\N	205 55 16 RIKEN	2026-04-24 13:12:12.462248+00	76.00	f	\N	2026-04-24 13:14:24.321369+00	CASH	\N	1223	ASC-D	1262		0		0	\N	2
673	2	dj 55 rss	\N	PIRELLI 285 30 22	2026-04-07 06:14:41.432381+00	272.00	f	\N	\N	NEPLATIT	\N	298		0		0		0	\N	2
656	2	ot 10 giv	\N	CUSTODIE 4 ANV MICHELIN ALPIN 6 205 45 17 DOT 2723 MM6\nMONTAT MICHELIN 205 45 17	2026-04-06 13:31:04.680652+00	308.00	f	\N	2026-04-06 13:35:09.071863+00	CARD	\N	285	ASC-D	482		0		0	\N	2
672	2	DJ99KWE	\N	\N	2026-04-07 06:12:50.035521+00	120.00	f	\N	2026-04-07 06:16:23.581634+00	CARD	\N	299	ASC-D	495		0		0	\N	2
660	2	DJ08SVT	\N	\N	2026-04-06 13:40:10.016333+00	224.00	f	\N	2026-04-06 13:41:51.194592+00	CASH	\N	283	ASC-D	486		0		0	\N	2
661	2	dj 16 fpf	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE RIKEN SNOW 175 65 15 DOT 3219 MM 6\nMONTAT BRIDGESTONE 175 65 15	2026-04-06 13:47:00.736463+00	226.00	f	\N	2026-04-06 13:49:21.232352+00	CASH	\N	288		0		0		0	\N	2
680	2	DJ87DRO	\N	PIRELLI SCORPION 315 35 21 2BUCATI 275 40 21 4 ANVELOPE 4 JANTE ALIAJ 4 CAPACE CENTRU DOT  37 23 MM 6	2026-04-07 07:07:05.276947+00	360.00	f	\N	2026-04-07 07:14:40.604776+00	CASH	\N	302	ASC-D	502		0		0	\N	2
674	2	DJ88AAE	\N	ANV CLIENT CONTI ECO CONTACT 6 255 50 19 235 55 19 MM 7 7 7 7 PRESIUNE FATA SPATE 2,5 NM 140 \nCUSTODIE ANV MICHELIN PILOT ALPIN 5 SUV 235 55 19 MM 8  8 8 8 DOT 3625	2026-04-07 06:30:56.134216+00	374.00	f	\N	2026-04-07 06:31:44.376518+00	CASH	\N	300	ASC-D	496		0		0	\N	2
665	2	DJ 20 FIR	\N	4 JANTE 4 ANVEPOPE 4 CAPACE CUSTODIEE 225 24 17 MICHELIN A 6 49 19 DOT MM 5	2026-04-06 14:02:14.982916+00	1572.00	f	\N	2026-04-06 14:04:05.836654+00	CARD	\N	\N	ASC-D	487		0		0	\N	2
681	2	DJ 87 STY	\N	CONTINENTAL WINTCONT 195/60/16 5MM DOT 2119 (CUSTODIE 4 ANV, 4 JANTE ALIAJ,4 CAPACE )\n\nMICHELIN PRIMACY 5 205/55/16 6MM 2,4 BARI	2026-04-07 07:14:07.347804+00	226.00	f	\N	2026-04-07 07:15:02.429603+00	CASH	\N	\N		0		0		0	\N	2
666	2	DJ12AIC	\N	\N	2026-04-06 14:03:10.461241+00	250.00	f	\N	2026-04-06 14:07:55.128443+00	CASH	\N	291	ASC-D	488		0		0	\N	2
664	2	DJ17HRL	\N	4 ANVELOPE 4 JANTE ALIAJ 4 CAPACE CENTRU HANKOOK 225 65 17 DO 29 23 MM6	2026-04-06 13:54:36.674689+00	280.00	f	\N	2026-04-06 14:15:54.070056+00	CARD	\N	290	ASC-D	489		0		0	\N	2
675	2	DJ66BBU	\N	4 ANVELOPE DOT 36 17 MM5 285 30 21  PIRELLI SOTOZERO DUNLOP 2 ANVELOPE 2 PIRELLI	2026-04-07 06:34:08.586802+00	382.00	f	\N	2026-04-07 06:35:31.770789+00	CASH	\N	297	ASC-D	497		0		0	\N	2
667	2	nr rosu	\N	MONTAT ANV CLIENT PIRELLI DIABLO 3  120 70 17 180 55 17 MM 7 7 PRESIUNE FATA 2,5 SPATE 2,9	2026-04-06 14:18:38.436392+00	130.00	f	\N	2026-04-06 14:19:20.66956+00	CASH	\N	292		0		0		0	\N	2
668	2	dj 92 wew	\N	CUSTODIE 4 ANV NOKIAN WR4 225 45 17 DOT 2420 MM 5\nMONTAT MICHELIN 225 45 17	2026-04-06 14:21:09.357008+00	308.00	f	\N	2026-04-06 14:25:22.79189+00	OP	\N	293	ASC-D	490		0		0	\N	2
657	2	DJ10MIC	\N	\N	2026-04-06 13:34:58.499971+00	300.00	f	\N	2026-04-06 15:45:13.790158+00	OP	\N	286	ASC-D	492		0		0	\N	2
676	2	DJ27KIO	\N	\N	2026-04-07 06:36:49.008702+00	180.00	f	\N	2026-04-07 06:40:12.736931+00	CASH	\N	301	ASC-D	498		0		0	\N	2
669	2	DJ78MLS	\N	ANV CLIENT 195 55 16 CONTI ECO CONTACT 5 MM 5 5 6 6   PRESIUNE FATA SPATE 2,3 NM 120	2026-04-07 05:45:18.006628+00	132.00	f	\N	2026-04-07 05:45:57.382785+00	OP	\N	296		0		0		0	\N	2
538	2	DJ 64 PAM	\N	LAUFEN 205/60/15 8MM 2,30BARI (SAU MONTAT 4 ANV CLIENT )\n\nBARUM POLARIS3 195/65/15 6MM DOT=4816 ( CUSTODIE NOUA= 4 ANVELOPE,4 JANTE ALIAJ, 4 CAPACE )	2026-04-03 11:03:33.725481+00	136.00	t	2026-04-07 06:40:58.648539+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
670	2	DJ 20 BMW	\N	ANVELOPE CLIENT MICHELIN LATT.SPORT3 ZP 255/55/18 8MM	2026-04-07 05:57:18.048614+00	176.00	f	\N	2026-04-07 05:58:09.498812+00	CARD	\N	\N	ASC-D	493		0		0	\N	2
671	2	DJ45ECO	\N	\N	2026-04-07 06:07:41.133458+00	200.00	f	\N	2026-04-07 06:09:57.235+00	OP	\N	\N	ASC-D	494		0		0	\N	2
677	2	DJ 07 XRP	\N	HANKOOK WINTER 245/45/19 6MM DOT3024\nHANKOOK WINTER 275/40/19 6MM DOT1524 (CUST 4 ANVELOPE )\n\nPIRELI PZERO245/45/19 5MM 2,5 BARI\nPIRELI PZERO 275/40/19 5MM 2,5 BARI	2026-04-07 06:46:55.029742+00	346.00	f	\N	2026-04-07 06:47:47.842077+00	CASH	\N	\N	ASC-D	499		0		0	\N	2
682	2	dj 60 aph	\N	MICHELIN 205 55 16	2026-04-07 07:15:30.367088+00	132.00	f	\N	2026-04-07 07:16:47.250976+00	CARD	\N	305		0		0		0	\N	2
687	2	DJ 12 SVT	\N	\N	2026-04-07 07:45:55.696445+00	168.00	f	\N	2026-04-07 07:47:04.021496+00	CASH	\N	308	ASC-D	504		0		0	\N	2
679	2	B119DWW	\N	JANTE ANV CLIENT CONTINENTAL 195/55/16	2026-04-07 07:01:57.610578+00	76.00	f	\N	2026-04-07 07:02:37.731498+00	CASH	\N	304	ASC-D	500		0		0	\N	2
683	2	GJ64NKY	\N	ANV CLIENT CONTI ECO CONTACT 275 45 21 315 40 21  MM 7 7 77 PRESIUNE FATA SPATE 2,3 NM 140 \nCUSTODIE ANV  MICHELIN PILOT APLIN 5 SUV 275 45 21 315 40 21 MM 7 7 7 7D 3624OT	2026-04-07 07:15:39.032079+00	754.00	f	\N	2026-04-07 07:23:55.041829+00	CASH	\N	306	ASC-D	503		0		0	\N	2
678	2	DJ83BRN	\N	\N	2026-04-07 07:01:02.254966+00	250.00	f	\N	2026-04-07 07:06:47.250284+00	CARD	\N	303	ASC-D	501		0		0	\N	2
685	2	DJ 19 DCB	\N	ANV CLIENT HANKOOK 165/70/14 2,2 BARI	2026-04-07 07:38:31.162652+00	52.00	f	\N	2026-04-07 07:39:17.535484+00	CARD	\N	\N		0		0		0	\N	2
684	2	DJ52ELF	\N	PRESIUNE 2,3 FATA SPATE NM 120	2026-04-07 07:21:16.413421+00	864.00	f	\N	2026-04-07 08:00:42.752949+00	OP	\N	311	ASC-D	507		0		0	\N	2
690	2	DJ19DCB	\N	\N	2026-04-07 07:58:01.182788+00	180.00	f	\N	2026-04-07 08:02:42.410528+00	CARD	\N	313	ASC-D	508		0		0	\N	2
686	2	ESNT8601	\N	\N	2026-04-07 07:45:23.115815+00	250.00	f	\N	2026-04-07 07:49:35.61254+00	CASH	\N	309	ASC-D	505		0		0	\N	2
688	2	dj 55 xzx	\N	CUSTODIE 4 ANV MICHELIN ALPIN 6 225 50 17 DOT 4221 MM5\nMONTAT MICHELIN 225 50 17	2026-04-07 07:49:26.195002+00	308.00	f	\N	2026-04-07 07:50:19.049982+00	CARD	\N	310	ASC-D	506		0		0	\N	2
695	2	DJ57XDM	\N	\N	2026-04-07 08:20:48.411577+00	176.00	f	\N	2026-04-07 08:22:19.744353+00	CASH	\N	\N		0		0		0	\N	2
689	2	DJ 44 WMR	\N	CUSTODIE NOU 4 ANV PIRELLI SCORPION WINTER RSC 275 40 21 2BUC DOT 3721 MM5\n315 35 21 DOT 3721 MM5	2026-04-07 07:51:28.649004+00	8058.00	f	\N	2026-04-07 08:38:37.353243+00	CARD	\N	316	ASC-D	511		0		0	\N	2
694	2	DJ77PAX	\N	4 JANTE 4 ANVELOPE 4 CAPACE CENTRU MICHELIN DIMENSIUNE 215 65 17 DOT 43 24 MM 7	2026-04-07 08:20:30.005361+00	260.00	f	\N	2026-04-07 08:22:00.260275+00	CARD	\N	315	ASC-D	510		0		0	\N	2
691	2	DJ18CZU	\N	\N	2026-04-07 08:05:39.446806+00	64.00	f	\N	2026-04-07 08:09:13.595848+00	CASH	\N	312	ASC-D	509		0		0	\N	2
692	2	DJ 24 LXS	\N	ANVELOPE CLIENT BRIDGESTONE 235/60/18 4BUC. 6MM	2026-04-07 08:13:36.703241+00	176.00	f	\N	2026-04-07 08:13:59.156975+00	CASH	\N	\N		0		0		0	\N	2
696	2	DJ75RSC	\N	JANTE ANV CLIENT GOODYEAR 205/55/16 4(ECHILIBRARI)	2026-04-07 08:39:57.676896+00	76.00	f	\N	2026-04-07 08:41:16.789192+00	CASH	\N	317		0		0		0	\N	2
698	2	DJ77TLX	\N	ANV MONTATE RIKEN UHP 205 60 16 MM 6 6 6 6 PRESIUNE 2,5 FATA SPATE  NM 120 \nCUSTODIE ANV  PIRELLI WINTER 205 55 16 MM 6 6 6 6 DOT 2416	2026-04-07 08:51:08.193335+00	636.00	f	\N	2026-04-07 08:57:26.634607+00	CASH	\N	320	ASC-D	516		0		0	\N	2
697	2	DJ48SFI	\N	\N	2026-04-07 08:47:20.414414+00	180.00	f	\N	2026-04-07 08:50:02.881511+00	CARD	\N	319	ASC-D	512		0		0	\N	2
699	2	DJ 99 DXT	\N	KUMHO 205/50/17 7MM 2,4 BARI\n\nCONTINENTAL WINTCONT. 205/50/17 6MM DOT 3120\nRIKEN SNOW 205/50/17 6MM DOT 3623 (CUST.4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )	2026-04-07 08:51:13.311684+00	256.00	f	\N	2026-04-07 08:55:37.022472+00	CARD	\N	\N	ASC-D	514		0		0	\N	2
700	2	DJ33VRY	\N	4 JANTE OTEL 4 ANVELOPE 4 CAPACE DEBICA205 55 16 DOT21 22 MM6	2026-04-07 08:52:54.300727+00	246.00	f	\N	2026-04-07 08:56:40.051391+00	CARD	\N	318	ASC-D	513		0		0	\N	2
693	2	DJ73SAS	\N	ANV MONTATE MICHELIN E PRYMACI 195 60 18 MM 7 7 7 7 PRESIUNE 2,5 FATA SPATE NM 120 \nCUSTODIE ANVC JANTE CAPACE  RIKEN SNOW 215 60 17 DOT 3520MM  7 7 7 7	2026-04-07 08:14:14.640108+00	256.00	f	\N	2026-04-07 08:56:45.881759+00	CASH	\N	314	ASC-D	515		0		0	\N	2
658	2	DJ 20 FIR	\N	\N	2026-04-06 13:36:20.181595+00	1160.00	t	2026-04-08 18:07:04.60031+00	2026-04-06 15:44:39.109077+00	CARD	\N	\N		0		0		0	\N	2
702	2	DJ26ELF	\N	\N	2026-04-07 09:20:21.782956+00	2704.00	f	\N	2026-04-07 09:22:43.400162+00	OP	\N	322	ASC-D	517		0		0	\N	2
703	2	DJ42MAS	\N	JANTE ANV CLIENT DEBICA205/55/16 4(ECHILIBRARI)	2026-04-07 09:20:30.395798+00	76.00	f	\N	2026-04-07 09:21:12.387219+00	CASH	\N	321		0		0		0	\N	2
705	2	DJ 14 JJU	\N	ANV CLIENT RIKEN ROAD 185/65/15 6MM 2,3 BARI	2026-04-07 09:29:20.417647+00	136.00	f	\N	2026-04-07 09:31:35.938222+00	CARD	\N	\N	ASC-D	518		0		0	\N	2
724	2	WP63RLY	\N	\N	2026-04-07 11:34:08.345451+00	120.00	f	\N	2026-04-07 11:35:10.43688+00	CASH	\N	336	ASC-D	531		0		0	\N	2
716	2	DJ 88 DPR	\N	CONTINENTAL WINTCONT. 215/45/18 7MM DOT 2625 ( CUSTODIE 4 ANVELOPE )\n\nBRIDGESTONE 215/45/18 6MM 2,50 BARI	2026-04-07 10:45:24.750751+00	308.00	f	\N	2026-04-07 10:46:01.48556+00	CARD	\N	\N	ASC-D	525		0		0	\N	2
714	2	DJ13GLM	\N	CUSTODIE ANV JANTE CAPACE 245 45 18 CONTI WINTER CONTACT MM 4 4 4 4 DOT 2317 \nANV MONTATE MICHELIN PILOT SPORT 4   245 45 18 MM 3 3  3 3 PRESIUNE 2,4 FATA SPATE NM 140	2026-04-07 10:41:14.685089+00	256.00	f	\N	2026-04-07 10:49:04.725336+00	CARD	\N	329	ASC-D	526		0		0	\N	2
737	2	DJ43DEY	\N	\N	2026-04-07 13:31:52.812304+00	250.00	f	\N	2026-04-07 13:36:08.980754+00	CASH	\N	347	ASC-D	543		0		0	\N	2
708	2	B660SND	\N	ANV MONTATE NEXEN 285 45 21    305 40 21  MM 8 8 8 8 PRESIUNE FATA SPATE 2.7 NM 160 \nCUSTODIE ANV MICHELIN PILOT ALPIN 5 SUV 285 45 21 305 40 21 MM 7 7 7 7 DOT4725	2026-04-07 09:58:15.911084+00	758.00	f	\N	2026-04-07 10:05:49.678588+00	CARD	\N	324	ASC-D	520		0		0	\N	2
717	2	DJ13ZAZ	\N	\N	2026-04-07 10:48:23.673501+00	180.00	f	\N	2026-04-07 10:53:31.061601+00	CASH	\N	332		0		0		0	\N	2
706	2	B803PRM	\N	4 ANVELOPE 215 55 17 RIKEN DOT 21 24	2026-04-07 09:37:45.377566+00	346.00	f	\N	2026-04-07 10:06:11.985805+00	CARD	\N	323	ASC-D	519		0		0	\N	2
726	2	ot 31 mtf	\N	225 45 18\n245 40 18MINERVA	2026-04-07 11:55:29.206386+00	768.00	f	\N	2026-04-07 11:56:57.66182+00	CARD	\N	339	ASC-D	532		0		0	\N	2
710	2	TR07ALM	\N	KUMHO 235/55/18 (ECHILIBRATE)\nCUSTODIE 4JANTE ALIJ+4ANVELOPE+4CAPACE CENTRU KUMHO WINTERCRAFT 235/55/18 DOT1824 MM6	2026-04-07 10:08:05.161283+00	256.00	f	\N	2026-04-07 10:11:18.035893+00	CARD	\N	326	ASC-D	521		0		0	\N	2
709	2	DJ 26 LYA	\N	VIKING 205/60/16 5MM DOT 2418 ( CUST 4 ANVELOPE,4 JANTE OTEL )\n\nCONTINENTAL 205/60/16 6MM 2,30 BARI	2026-04-07 10:03:47.292756+00	222.00	f	\N	2026-04-07 10:12:07.228137+00	CARD	\N	325	ASC-D	522		0		0	\N	2
735	2	DJ 03 PRO	\N	\N	2026-04-07 13:21:56.936041+00	1236.00	f	\N	2026-04-07 13:56:28.471728+00	CASH	\N	349	ASC-D	545		0		0	\N	2
704	2	B802SND	\N	ANV MONTATE PIRELLI P ZERO R  245 35 20 315 30 21  MM 8 8 8 8 PRESIUNE FATA SPATE 2,3 2,7 NM 600\nCUSTODIE ANV MICHELIN PILOT ALPIN 5 245 35 20 305 30 21DOT 40 25 MM 7 7 7 7	2026-04-07 09:20:40.928241+00	934.00	f	\N	2026-04-07 13:12:36.982763+00	OP	\N	324	ASC-D	541		0		0	\N	2
718	2	DJ39NXT	\N	ANV CLIENT RIKEN205/55/16 (MONTATE) RECOMAND ANVELOPE	2026-04-07 10:54:46.85497+00	168.00	f	\N	2026-04-07 10:56:02.296659+00	CARD	\N	333	ASC-D	527		0		0	\N	2
713	2	dj 74 ptY	\N	CUSTODIE NOUA 4 ANV BRIDGESTONE BLIZAK 215 45 18 DOT 1325 MM7\nMONTAT BRIDGESTONE	2026-04-07 10:34:15.657945+00	308.00	f	\N	2026-04-07 10:36:28.737731+00	CARD	\N	328	ASC-D	524		0		0	\N	2
712	2	DJ30LMI	\N	\N	2026-04-07 10:34:09.135426+00	250.00	f	\N	2026-04-07 10:39:32.655005+00	CASH	\N	327		0		0		0	\N	2
1254	2	GJ79AXB	\N	\N	2026-04-20 06:38:47.577906+00	300.00	f	\N	2026-04-20 06:42:32.512328+00	CASH	\N	822		0		0		0	\N	2
722	2	DJ 21 RDV	\N	\N	2026-04-07 11:23:30.400975+00	2588.00	f	\N	2026-04-07 12:00:43.281825+00	CARD	\N	\N	ASC-D	533		0		0	\N	2
719	2	DJ70CHR	\N	\N	2026-04-07 11:03:55.640189+00	176.00	f	\N	2026-04-07 11:06:02.033177+00	CASH	\N	334	ASC-D	528		0		0	\N	2
731	2	dj 35 hhh	\N	CUSTODIE 4 ANV 4 JANTE OTEL 4 CAPACE MICHELIN ALP 5 205 55 16DOT 3119\nMONTAT MICHELI 205 55 16	2026-04-07 12:47:15.231092+00	226.00	f	\N	2026-04-07 12:48:25.390664+00	CASH	\N	344	ASC-D	536		0		0	\N	2
747	2	B882CCR	\N	\N	2026-04-08 06:02:22.601062+00	835.00	f	\N	2026-04-09 10:21:46.649537+00	CARD	\N	\N	ASC-D	553		0		0	\N	2
720	2	DJ93GMA	\N	\N	2026-04-07 11:09:10.001044+00	120.00	f	\N	2026-04-07 11:15:41.475995+00	CARD	\N	335	ASC-D	529		0		0	\N	2
711	2	DJ98MLS	\N	\N	2026-04-07 10:23:48.504133+00	1000.00	f	\N	2026-04-07 11:17:34.295108+00	OP	\N	\N		0		0		0	\N	2
707	2	dj 69 kxx	\N	CUSTODIE 4ANV 4JANTEALIAJ 4CAPACE 285 40 22 DOT 4021 MM5 PIRELLI SCORPION WINTER 2BUC 325 35 22 DOT 4021 MM5 2BUC\nMONTAT 285 35 23 PIRELLI 325 30 23 PIRELLI	2026-04-07 09:56:03.973633+00	350.00	f	\N	2026-04-07 13:43:02.959576+00	CASH	\N	\N	ASC-D	523		0		0	\N	2
733	2	WD66EOL	\N	\N	2026-04-07 13:08:06.454811+00	2250.00	f	\N	2026-04-07 13:15:06.192654+00	CASH	\N	337	ASC-D	539		0		0	\N	2
727	2	OT25WAG	\N	\N	2026-04-07 12:06:28.123587+00	180.00	f	\N	2026-04-07 12:10:55.010778+00	CASH	\N	340	ASC-D	534		0		0	\N	2
723	2	DJ01HUM	\N	\N	2026-04-07 11:25:22.251276+00	3220.00	f	\N	2026-04-07 11:26:08.817625+00	CARD	\N	330	ASC-D	530		0		0	\N	2
729	2	DJ49DGE	\N	PRESIUNE FATA SPATE 2,4 NM 120	2026-04-07 12:22:03.578042+00	1120.00	f	\N	2026-04-07 13:01:20.992313+00	CASH	\N	343	ASC-D	537		0		0	\N	2
728	2	DJ 98 LKW	\N	ANVELOPE CLIENT PIRELI 225/45/18 8MM 2,4 BARI	2026-04-07 12:11:33.899215+00	180.00	f	\N	2026-04-07 12:12:09.462564+00	CASH	\N	341	ASC-D	535		0		0	\N	2
732	2	DJ29DVY	\N	\N	2026-04-07 13:04:53.130356+00	300.00	f	\N	2026-04-07 13:06:41.900659+00	CASH	\N	345	ASC-D	538		0		0	\N	2
730	2	dj 05 mfc	\N	315 35 21 HANKOOK\n275 40 21	2026-04-07 12:24:20.348551+00	160.00	f	\N	2026-04-07 12:25:41.619416+00	CARD	\N	342		0		0		0	\N	2
1256	2	DJ35MBZ	\N	\N	2026-04-20 06:42:39.799809+00	49.00	f	\N	2026-04-20 07:06:50.416782+00	OP	\N	\N	ASC-D	934		0		0	\N	2
741	2	DJ 55 EVA	\N	RIKEN SNOW 235/55/17 6MM DOT 2823 ( CUSTODIE 4 ANV,4 JANTE ALIAJ,4 CAPACE,4 INELE GHIDARE )\n\nMICHELIN PRIMACY 4 235/50/18 6MM 2,4 BARI	2026-04-07 14:18:28.291184+00	256.00	f	\N	2026-04-07 14:29:01.038022+00	CARD	\N	352	ASC-D	550		0		0	\N	2
736	2	dj14euy	\N	\N	2026-04-07 13:23:51.081881+00	224.00	f	\N	2026-04-07 13:29:34.390329+00	CASH	\N	\N	ASC-D	542		0		0	\N	2
738	2	DJ16WKW	\N	\N	2026-04-07 13:34:34.819658+00	2168.00	f	\N	2026-04-07 13:56:40.430103+00	CARD	\N	348	ASC-D	544		0		0	\N	2
739	2	DJ06SDL	\N	ANV CLIENT MICHELIN 205/55/16	2026-04-07 14:08:27.572802+00	136.00	f	\N	2026-04-07 14:10:07.986478+00	CARD	\N	350	ASC-D	547		0		0	\N	2
734	2	cj 72 trv	\N	CUSTODIE 4ANV 4JANTEOTELBARUM POLARIS 5 DOT 4118 MM 5 185 60 15\nMONTAT NEXEN 185 60 15	2026-04-07 13:14:52.096349+00	226.00	f	\N	2026-04-07 13:57:09.041852+00	OP	\N	346	ASC-D	546		0		0	\N	2
725	2	VL25HSN	\N	\N	2026-04-07 11:53:00.090439+00	300.00	f	\N	2026-04-07 13:57:30.104936+00	CARD	\N	\N	ASC-D	540		0		0	\N	2
740	2	DJ03PRO	\N	\N	2026-04-07 14:09:02.391327+00	180.00	f	\N	2026-04-07 14:11:44.945878+00	CASH	\N	351	ASC-D	548		0		0	\N	2
742	2	2HOR857	\N	ANV UNYROAL 245 45 18	2026-04-07 14:19:42.414053+00	320.00	f	\N	2026-04-07 14:27:45.876748+00	CARD	\N	353	ASC-D	549		0		0	\N	2
743	2	TM11ETY	\N	\N	2026-04-07 22:25:03.225436+00	60.00	t	2026-04-07 22:39:01.527643+00	2026-04-07 22:27:08.724652+00	NEPLATIT	\N	354	ASC-D	551		0		0	\N	2
744	2	DJ90ALE	\N	ANV MONTATE FALKEN SI KLEBER 205 55 16 MM 5 5 4 4PRESIUNE 2,3 NM 120	2026-04-08 05:49:39.084204+00	406.00	f	\N	2026-04-08 05:51:06.428269+00	CASH	\N	355	ASC-D	552		0		0	\N	2
745	2	DJ99MAY	\N	MICHELIN 205 50 17	2026-04-08 05:51:39.037074+00	96.00	f	\N	2026-04-08 05:52:34.826554+00	CARD	\N	357		0		0		0	\N	2
749	2	DJ16MDV	\N	\N	2026-04-08 06:12:47.123408+00	910.00	f	\N	2026-04-08 15:01:45.043959+00	CASH	\N	\N	ASC-D	554		0		0	\N	2
721	2	WD66EOL	\N	\N	2026-04-07 11:22:26.117265+00	2100.00	t	2026-04-08 08:17:47.706155+00	2026-04-07 12:48:38.41597+00	NEPLATIT	\N	337		0		0		0	\N	2
748	2	MH92ALA	\N	\N	2026-04-08 06:11:49.536257+00	350.00	f	\N	2026-04-08 06:19:40.643825+00	CASH	\N	\N	ASC-D	556		0		0	\N	2
750	2	DJ19DMN	\N	JANTE ANV CLIENT FIRESTONE245/45/18	2026-04-08 06:13:42.271359+00	618.00	f	\N	2026-04-08 06:17:33.876821+00	CASH	\N	358	ASC-D	555		0		0	\N	2
478	2	DJ 73 MSD	\N	\N	2026-04-02 12:21:14.320137+00	2540.00	t	2026-04-08 18:07:04.60031+00	2026-04-08 08:48:10.131983+00	CASH	\N	\N		0		0		0	\N	2
715	2	DJ01HUM	\N	\N	2026-04-07 10:42:17.009764+00	3040.00	t	2026-04-08 18:07:04.60031+00	\N	NEPLATIT	\N	330		0		0		0	\N	2
773	2	DJ17MRV	\N	ANV CLIENT GOODYEAR 225/55/17 2BUC RECOMAND ANVELOPE SPATE	2026-04-08 08:21:19.851224+00	1444.00	f	\N	2026-04-08 08:22:27.844625+00	CARD	\N	372	ASC-D	574		0		0	\N	2
782	2	DJ05ZHD	\N	\N	2026-04-08 09:22:47.952152+00	136.00	f	\N	2026-04-08 09:24:14.978819+00	CARD	\N	\N	ASC-D	583		0		0	\N	2
751	2	OT70AME	\N	ANV CLIENT BRIDGESTONE TURANZA 225 50 19 MM7 7 7 7 PRESIUNE FATA SPATE  2,5 NM 120	2026-04-08 06:24:57.839338+00	224.00	f	\N	2026-04-08 06:27:04.572265+00	CASH	\N	359	ASC-D	557		0		0	\N	2
762	2	DJ16UHL	\N	ANV CLIENT PIRELLI 215/55/18 4BUC	2026-04-08 07:32:03.004652+00	326.00	f	\N	2026-04-08 07:36:27.165659+00	CARD	\N	368	ASC-D	567		0		0	\N	2
752	2	B126CPX	\N	235 50 19 ATTLAS	2026-04-08 06:27:03.975518+00	120.00	f	\N	2026-04-08 06:27:42.80167+00	OP	\N	361	ASC-D	558		0		0	\N	2
774	2	DJ66DMC	\N	ANV CLIENT   CONTI   ECO CONTACT 6 195 55 16 MM 7 7 7 7  PRWESIUNE FATA SPATE 2,4 NM 110	2026-04-08 08:31:56.880082+00	136.00	f	\N	2026-04-08 08:33:53.352269+00	OP	\N	374	ASC-D	575		0		0	\N	2
760	2	DJ41MLS	\N	PRESIUNE FATA SPATE 2,4 NM 120	2026-04-08 07:14:04.55083+00	2028.00	f	\N	2026-04-08 07:39:01.892729+00	OP	\N	369	ASC-D	568		0		0	\N	2
754	2	DJ26DRL	\N	ANVELOPE CLIENT WESTLIKE 225/50/17 5MM 2,4 BARI	2026-04-08 06:30:16.789193+00	168.00	f	\N	2026-04-08 06:30:49.813625+00	CARD	\N	362	ASC-D	559		0		0	\N	2
746	2	IS06PHA	\N	ANV CLIENT KUMHO 185/65/15 6MM 2,3 BARI	2026-04-08 05:53:23.904736+00	132.00	f	\N	2026-04-08 06:52:34.394663+00	OP	\N	356	ASC-D	560		0		0	\N	2
755	2	CJ62THT	\N	JANTE ANV CLIENT BRIDGESTONE 205/55/16 4BUC	2026-04-08 06:41:05.807079+00	136.00	f	\N	2026-04-08 06:52:58.900872+00	OP	\N	363	ASC-D	561		0		0	\N	2
763	2	DJ14ARG	\N	\N	2026-04-08 07:44:30.603545+00	96.00	f	\N	2026-04-08 07:45:42.017779+00	CARD	\N	370		0		0		0	\N	2
757	2	DJ43YVS	\N	ANV CLIENT CONTI ECO CONTACT 5 215 55 17 MM 7 7 7 7 PRESIUNE FATA SPATE 2,4 NM120	2026-04-08 06:59:58.829451+00	168.00	f	\N	2026-04-08 07:00:45.220887+00	CASH	\N	365	ASC-D	563		0		0	\N	2
778	2	DJ07SPW	\N	ANV MONTATE  MICHELIN PRIMACY4 195 65 15 MM 5 5 4 4 PRESIUNE FATA 2,3 SPATE 2,8 NM 120      \nCUSTODIE ANV JANTE OTEL MICHELIN  ALPIN 6  195 65  15 MM 4 4 6 6 DOT 4718	2026-04-08 09:06:18.520187+00	222.00	f	\N	2026-04-08 09:07:20.676229+00	CARD	\N	379	ASC-D	580		0		0	\N	2
759	2	DJ08WRR	\N	4 ANVELOPE DOT 3423 PIRELLI 205 55 16	2026-04-08 07:10:03.979011+00	252.00	f	\N	2026-04-08 07:11:03.004676+00	CARD	\N	364	ASC-D	564		0		0	\N	2
764	2	DJ66DWD	\N	\N	2026-04-08 07:45:01.940025+00	100.00	f	\N	2026-04-08 07:46:13.860072+00	CARD	\N	\N	ASC-D	569		0		0	\N	2
1255	2	DJ99BDM	\N	205 55 16 HANKOOK	2026-04-20 06:39:59.917624+00	76.00	f	\N	2026-04-20 06:41:45.692868+00	CARD	\N	823	ASC-D	932		0		0	\N	2
761	2	DJ01DVR	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4CAPACE HANKOOK WINTER 236 65 17  DOT 3522 MM6\nMONTAT MICHELIN 235 60 18	2026-04-08 07:16:16.354292+00	296.00	f	\N	2026-04-08 07:17:04.446257+00	CARD	\N	366	ASC-D	565		0		0	\N	2
771	2	OT66LUX	\N	\N	2026-04-08 07:57:41.048224+00	200.00	f	\N	2026-04-09 07:37:36.691825+00	CASH	\N	\N		0		0		0	\N	2
753	2	B160GBV	\N	2 ANVELOPE FORTUNA 245 40 19 DOT 42 21 MM 5 2 ANVELOPE MICHELIN A 5 275 35 19 DOT 24 22 MM 5	2026-04-08 06:28:35.956448+00	2906.00	f	\N	2026-04-08 07:18:15.048335+00	CARD	\N	360	ASC-D	562		0		0	\N	2
775	2	DJ11EXV	\N	\N	2026-04-08 08:40:29.556094+00	360.00	f	\N	2026-04-08 08:42:08.528779+00	CARD	\N	375	ASC-D	576		0		0	\N	2
758	2	DJ06ABT	\N	\N	2026-04-08 07:08:15.198816+00	864.00	f	\N	2026-04-08 07:27:01.530423+00	CASH	\N	367	ASC-D	566		0		0	\N	2
766	2	DJ96GNZ	\N	CUSTODIE 4 ANV 4JANTE ALIAJ CONTINENTAL WINTER 275 50 20 DOT 17 24  MM6\nMONTAT MICHELIN 275 50 20	2026-04-08 07:46:12.819976+00	320.00	f	\N	2026-04-08 07:48:15.983079+00	CASH	\N	371	ASC-D	570		0		0	\N	2
779	2	DJ87TCD	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4CAPACE 4HUSE MICHELIN ALP 7 DOT 1424 MM 6\nMONTAT MICHELIN 235 50 19	2026-04-08 09:08:41.309975+00	320.00	f	\N	2026-04-08 09:09:42.341389+00	CARD	\N	380	ASC-D	581		0		0	\N	2
769	2	Dj93AYA	\N	\N	2026-04-08 07:53:05.712743+00	300.00	f	\N	2026-04-08 07:56:04.747231+00	CASH	\N	\N	ASC-D	571		0		0	\N	2
772	2	DJ22BOZ	\N	\N	2026-04-08 08:01:32.609779+00	5824.00	f	\N	2026-04-08 08:45:31.244555+00	OP	\N	376	ASC-D	577		0		0	\N	2
770	2	DJ70ALF	\N	\N	2026-04-08 07:56:06.680058+00	1088.00	f	\N	2026-04-08 08:03:08.535761+00	CARD	\N	373	ASC-D	573		0		0	\N	2
783	2	DJ03AXH	\N	JANTE ANV CLIENT FALKEN 205/65/16	2026-04-08 09:27:43.833397+00	76.00	f	\N	2026-04-08 09:28:16.653899+00	CARD	\N	383	ASC-D	584		0		0	\N	2
776	2	ECKKM4	\N	\N	2026-04-08 08:56:38.730194+00	168.00	f	\N	2026-04-08 08:57:36.325584+00	CASH	\N	377	ASC-D	578		0		0	\N	2
780	2	DJ92TBN	\N	ANVELOPE CLIENT GOODYEAR 215/55/17 6MM 2,4 BARI	2026-04-08 09:12:30.970291+00	168.00	f	\N	2026-04-08 09:17:30.73519+00	CARD	\N	381	ASC-D	582		0		0	\N	2
777	2	DJ03AIB	\N	ANV CLIENT HANKOOK 225/45/18 4ANV	2026-04-08 08:57:31.264213+00	176.00	f	\N	2026-04-08 08:58:52.990176+00	CARD	\N	378	ASC-D	579		0		0	\N	2
786	2	DJ17FIY	\N	ANV MONTATE MICHELIN LATITUDE SPORT 3 265 40 21 295 53 21 MM 6 6 6 6  PRESIUNE FATA    SPATE 2,3 2,5 NM 160 \nCUSTODIE ANV MICHELIN PILOT ALPIN 265 45 20 295 40 20 MM 7 7 7 7 DOT 3623	2026-04-08 10:00:00.213034+00	360.00	f	\N	2026-04-08 10:06:04.508092+00	CARD	\N	386	ASC-D	588		0		0	\N	2
756	2	DJ06CDE	\N	\N	2026-04-08 06:55:37.901115+00	244.00	f	\N	2026-04-08 09:00:44.006899+00	CASH	\N	\N	ASC-D	572		0		0	\N	2
768	2	DJ77LIT	\N	\N	2026-04-08 07:49:50.04769+00	60.00	t	2026-04-09 09:21:36.000785+00	\N	NEPLATIT	\N	75		0		0		0	\N	2
781	2	B102DLV	\N	BRIDGESTONE BLIZZAK 205/65/16 C  5MM  DOT=1423 ( CUSTODIE NOUA 4 ANVELOPE )	2026-04-08 09:18:03.796404+00	3468.00	f	\N	2026-04-08 09:55:48.692572+00	CASH	\N	385	ASC-D	587		0		0	\N	2
785	2	DJ50XPT	\N	ANV CLIENT 235 55 19 KUMHO CRUGER MM 8 8 8 8 PRESIUNE      2,4         FATA SPATE  NM 120	2026-04-08 09:35:29.232573+00	233.00	f	\N	2026-04-08 09:42:14.831869+00	CARD	\N	384	ASC-D	585		0		0	\N	2
784	2	CS06066	\N	\N	2026-04-08 09:27:50.144711+00	870.00	f	\N	2026-04-08 09:47:20.447223+00	CARD	\N	382	ASC-D	586		0		0	\N	2
787	2	DJ14YTD	\N	\N	2026-04-08 10:03:58.318955+00	412.00	f	\N	2026-04-08 10:09:59.019142+00	CASH	\N	\N	ASC-D	589		0		0	\N	2
789	2	DJ03VXX	\N	\N	2026-04-08 10:16:28.053457+00	196.00	f	\N	2026-04-08 10:17:10.77971+00	CARD	\N	387	ASC-D	590		0		0	\N	2
790	2	DJ19DYS	\N	ANVELOPE CLIENT CONTINENTAL 245/50/18 6MM 2,4 BARI	2026-04-08 10:34:50.56163+00	176.00	f	\N	2026-04-08 10:36:37.845022+00	CARD	\N	388	ASC-D	591		0		0	\N	2
788	2	DJ14GCM	\N	PRESIUNE 2,3 NM  140\nCUSTODIE ANV MICHELIN 225 50 17 MM 7 7 7 7 DOT3025	2026-04-08 10:09:52.90715+00	2148.00	f	\N	2026-04-08 10:40:12.300092+00	CARD	\N	389	ASC-D	592		0		0	\N	2
793	2	DJ66FRT	\N	4 ANVELOPE KUMHO 205 65 16 DOT 15 23 MM 5	2026-04-08 11:10:38.125248+00	252.00	f	\N	2026-04-08 11:11:34.188298+00	OP	\N	390	ASC-D	593		0		0	\N	2
794	2	DJ27RAC	\N	CUSTODIE NOUA 4 ANV 4 JANTE ALIAJ CONTINENTAL WINTER 215 60 18 DOT 1625 MM7\nMONTAT CONTINENTAL 235 5518	2026-04-08 11:11:19.843616+00	256.00	f	\N	2026-04-08 11:13:41.840272+00	CARD	\N	392	ASC-D	594		0		0	\N	2
795	2	B100VXS	\N	ANV CLIENT RIKEN 205/55/16 2BUC	2026-04-08 11:16:14.50819+00	68.00	f	\N	2026-04-08 11:16:56.824982+00	CASH	\N	393		0		0		0	\N	2
796	2	DJ52DRV	\N	CUSTODIE 4 ANV 4JANTE ALIAJ MICHELIN ALP6 205 55 17  DOT 2223 M M5\nMONTAT CONTINENTAL 205 55 17	2026-04-08 11:22:05.313323+00	256.00	f	\N	2026-04-08 11:23:57.523939+00	CARD	\N	394	ASC-D	595		0		0	\N	2
792	2	DJ97KON	\N	\N	2026-04-08 11:07:38.85956+00	50.00	f	\N	2026-04-08 14:18:07.449018+00	CASH	\N	\N		0		0		0	\N	2
767	2	DJ17MRV	\N	\N	2026-04-08 07:46:22.552783+00	1300.00	t	2026-04-08 18:07:04.60031+00	\N	NEPLATIT	\N	372		0		0		0	\N	2
799	2	DJ18JYE	\N	\N	2026-04-08 11:40:27.279692+00	136.00	f	\N	2026-04-08 11:41:48.672972+00	CARD	\N	396	ASC-D	596		0		0	\N	2
791	2	DJ84DVM	\N	\N	2026-04-08 10:43:45.983197+00	2044.00	f	\N	2026-04-08 11:48:53.238367+00	CARD	\N	391	ASC-D	597		0		0	\N	2
797	2	OT06FOC	\N	\N	2026-04-08 11:29:04.139807+00	1436.00	f	\N	2026-04-08 12:01:02.90392+00	CASH	\N	398	ASC-D	599		0		0	\N	2
1409	2	DJ58MAI	\N	\N	2026-04-21 10:15:40.097937+00	528.00	f	\N	2026-04-21 11:38:36.879836+00	CARD	\N	971	ASC-D	1049		0		0	\N	2
801	2	OT26PPE	\N	NOKIAN WR 255/35/19 5MM DOT=4721 \nNOKIAN WR 225/40/19 6MM DOT=3823 (CUSTODIE 4 ANVELOPE )\n\nMICHELIN PS5 225/40/19 6MM 2,5 BARI\nMICHELIN PS5 255/35/19 6MM 2,5 BARI ( SAU MONTAT )	2026-04-08 11:44:01.067147+00	986.00	f	\N	2026-04-08 11:53:53.091564+00	OP	\N	397	ASC-D	598		0		0	\N	2
1257	2	DJ28ATT	\N	MICHELIN 235 50 19 DOT 43 23 MM 6 4 ANVELOPE	2026-04-20 06:46:30.992335+00	374.00	f	\N	2026-04-20 06:47:05.187385+00	CARD	\N	821	ASC-D	933		0		0	\N	2
804	2	DJ03MAP	\N	ANV CLIENT CONTINENTAL 185/55/15 3BUC VEDESTEIN 185/55/16 1BUC MONTATE\nANV DE IARNA NU MAI RAMAN AN CUSTODIE	2026-04-08 12:17:40.123281+00	142.00	f	\N	2026-04-08 12:18:25.231105+00	CARD	\N	400	ASC-D	601		0		0	\N	2
1285	2	DJ07WRM	\N	\N	2026-04-20 09:33:51.408257+00	136.00	f	\N	2026-04-20 09:36:19.025927+00	CASH	\N	850		0		0		0	\N	2
808	2	DJ92NOI	\N	ANV CLIENT PIRELLI 215 45 18 MM 7 7 7 7 PRESIUNE 2,3 NM 110	2026-04-08 12:57:07.738698+00	108.00	f	\N	2026-04-08 13:00:36.114608+00	CARD	\N	403	ASC-D	605		0		0	\N	2
1380	2	DJ20HSD	\N	DUNLOP 225/50/18 4BUC SAU MNTAT\nCUSTODIE 4ANV SUPERIA BLUEWIN UHP3  225/50/18 DOT3525 7MM	2026-04-21 08:03:47.019869+00	316.00	f	\N	2026-04-21 08:05:29.999077+00	CARD	\N	937	ASC-D	1014		0		0	\N	2
803	2	DJ17CTM	\N	\N	2026-04-08 12:06:43.920595+00	1092.00	f	\N	2026-04-08 13:22:15.688651+00	OP	\N	\N	ASC-D	606		0		0	\N	2
1445	2	DJ25CHE	\N	CUSTODIE 4ANV 4JANTE OTEL HANKOOK WINTER 215 70 16 DOT 4323 MM 6\nMONTAT CONTINENTAL 215 60 18	2026-04-21 13:38:08.456105+00	246.00	f	\N	2026-04-21 13:39:06.43671+00	CARD	\N	995	ASC-D	1064		0		0	\N	2
1309	2	DJ79CCC	\N	GOODYEAR ULTRAGRIP 225/60/18 7MM DOT=3425 ( CUSTODIE 4 ANVELOPE )\n\nCONTINENTAL 205/60/18 6MM	2026-04-20 11:42:52.722589+00	316.00	f	\N	2026-04-20 11:43:58.638168+00	CARD	\N	869	ASC-D	965		0		0	\N	2
802	2	DJ69KXX	\N	\N	2026-04-08 11:58:35.521997+00	7900.00	f	\N	2026-04-09 12:14:03.323632+00	CASH	\N	\N	ASC-D	676		0		0	\N	2
1379	2	DJ77HXX	\N	\N	2026-04-21 08:03:09.646293+00	120.00	f	\N	2026-04-21 08:06:34.012575+00	CASH	\N	936	ASC-D	1015		0		0	\N	2
1343	2	B971RMA	\N	255 45 20 BRIDGESTONE	2026-04-20 14:03:31.279435+00	236.00	f	\N	2026-04-20 14:04:12.43262+00	CARD	\N	903		0		0		0	\N	2
1341	2	B151EBP	\N	4 ANV KLEBER 185\\65\\15 5MM DOT2423  CUSTODIE NOUA	2026-04-20 13:58:23.540669+00	252.00	f	\N	2026-04-20 14:08:31.05395+00	OP	\N	898	ASC-D	982		0		0	\N	2
1386	2	DJ57ALP	\N	\N	2026-04-21 08:28:47.575659+00	188.00	f	\N	2026-04-21 08:31:18.863374+00	CARD	\N	940	ASC-D	1020		0		0	\N	2
1347	2	DJ83KIK	\N	CUSTODIE ANV MICHELIN ALPIN 6 185 65 15 MM 7 7 7 7 DOT 2223 \nANV MONTATE MICHELIN PRIMACY 4 185 65 15 MM 5 5 5 5 PRESIUNE FATA SPTE 2,3 NM 120	2026-04-20 14:24:17.099972+00	256.00	f	\N	2026-04-20 14:28:35.74902+00	CASH	\N	906	ASC-D	987		0		0	\N	2
1356	2	CS61ART	\N	\N	2026-04-21 06:15:05.270546+00	852.00	f	\N	2026-04-21 08:33:38.389759+00	CASH	\N	915	ASC-D	1003		0		0	\N	2
1351	2	DJ23TMO	\N	CUSTODIE  ANV JANTE CAPACE BRIDGESTONE BLIZZAK LM 001          20560 16 MM 7 7  7 7 DOT 2524\nANV MONTATE BRIDGESTONE TURANZA 205 60 16 MM 7 7 7 7 PRESIUNE FATA SPATE 2,3 NM 110	2026-04-21 05:50:14.983717+00	226.00	f	\N	2026-04-21 05:51:09.290907+00	CARD	\N	909	ASC-D	992		0		0	\N	2
1487	2	DJ97DRB	\N	BRIDGESTONE 205/55/16 4BUC SAU MONTAT\nCUSTODIE 4ANV MICHELIN ALPIN7 205/55/16 DOT4425 7MM 4BUC	2026-04-22 09:09:34.989232+00	252.00	f	\N	2026-04-22 09:10:13.488031+00	CASH	\N	1035	ASC-D	1104		0		0	\N	2
1426	2	DJ08XML	\N	4 ANVELOPE CLIENT 235 55 18 BRIGESTONE	2026-04-21 11:51:56.906037+00	188.00	f	\N	2026-04-21 12:00:01.248953+00	CARD	\N	974	ASC-D	1051		0		0	\N	2
1404	2	DB17FAL	\N	ANV CLIENT KUMHO 215 65 16C MM 7 7  5 5 PRESIUNE FATA SPATE 3,0 NM 160	2026-04-21 09:46:13.845846+00	304.00	f	\N	2026-04-21 09:48:38.199908+00	CASH	\N	957	ASC-D	1034		0		0	\N	2
1349	2	B08DFX	\N	\N	2026-04-21 05:35:24.103126+00	2242.00	f	\N	2026-04-21 06:30:23.147257+00	CARD	\N	913	ASC-D	997		0		0	\N	2
1545	2	DJ74WBC	\N	ANVELOPE CLIENT\n\nHANKOOK 285/45/21 5MM 2,6 BARI	2026-04-23 06:28:45.784066+00	276.00	f	\N	2026-04-23 07:24:56.877406+00	OP	\N	\N		0		0		0	\N	2
1425	2	DJ05ATG	\N	\N	2026-04-21 11:50:56.407901+00	2898.00	f	\N	2026-04-21 12:24:56.32135+00	CARD	\N	973	ASC-D	1058		0		0	\N	2
1408	2	DJ20RIX	\N	ROTILE DE IARNA NU MAI RAMAN IN CUSTODIE\nMONTAT MICHELIN 225 45 18	2026-04-21 10:10:43.421836+00	108.00	f	\N	2026-04-21 10:11:42.553184+00	CARD	\N	962	ASC-D	1037		0		0	\N	2
1448	2	DJ51GED	\N	\N	2026-04-21 14:01:11.867321+00	150.00	f	\N	2026-04-21 14:02:23.540806+00	CASH	\N	997	ASC-D	1067		0		0	\N	2
1413	2	B600BKT	\N	\N	2026-04-21 10:33:27.433704+00	136.00	f	\N	2026-04-21 10:40:25.443716+00	CARD	\N	961		0		0		0	\N	2
1438	2	B325MGA	\N	205 60 16 HANKOOK	2026-04-21 12:40:12.057269+00	132.00	f	\N	2026-04-21 12:41:27.469824+00	OP	\N	988	ASC-D	1061		0		0	\N	2
1411	2	DJ55PDM	\N	\N	2026-04-21 10:21:24.130633+00	0.00	f	\N	2026-04-21 11:01:42.759616+00	OP	\N	\N		0		0		0	\N	2
1412	2	GJ66CCA	\N	\N	2026-04-21 10:32:52.500176+00	250.00	f	\N	2026-04-21 11:01:58.846042+00	CARD	\N	963	ASC-D	1039		0		0	\N	2
1440	2	DJ03VRD	\N	ANV MONTATE GRIPMAX SURER GRIP 285 40 21  MM 88  8 8 \nA\nNV CUSTODIE  GRIPMAX WINTER 285 45 20 MM 5 5 5 5 DOT 3023	2026-04-21 12:47:24.719771+00	200.00	f	\N	2026-04-21 15:03:49.670204+00	CARD	\N	989	ASC-D	1071		0		0	\N	2
1509	2	DJ45CSA	\N	205 65 16C MICHELIN	2026-04-22 11:46:03.189319+00	192.00	f	\N	2026-04-22 11:49:45.276673+00	OP	\N	1058	ASC-D	1125		0		0	\N	2
1439	2	DJ31LCC	\N	4ANV CONTINENTAL 225\\50\\17  DOT2320 6MM 4JANTE ALIAJ 4CAPACE LA CENTRU	2026-04-21 12:46:22.83553+00	256.00	f	\N	2026-04-21 12:56:17.403065+00	CARD	\N	987		0		0		0	\N	2
1506	2	B206VVV	\N	PIRELLI 285/45/20 4ANV SAU MONTAT\nCUSTODIE MICHELIN PILOT ALPIN5 285/45/20 DOT3224 7MM 4ANV	2026-04-22 11:20:07.644304+00	374.00	f	\N	2026-04-22 11:22:59.403031+00	CARD	\N	1054	ASC-D	1120		0		0	\N	2
1463	2	DJ67TGP	\N	ANV CLIENT CONTINENTAL 185/65/15 4BUC SAU MONTAT	2026-04-22 06:44:56.217128+00	132.00	f	\N	2026-04-22 06:47:06.459536+00	OP	\N	1013	ASC-D	1081		0		0	\N	2
1550	2	DJ15VMZ	\N	PIRELI PZERO 275/45/21 5MM\nPIRELI PZERO 315/40/21 4MM\n\n\nNOKIAN WR 275/45/21 7MM DOT=4621\nNOKIAN WR 315/40/21 7MM DOT=1322 ( CUSTODIE 4ANV,4 JANTE ALIAJ,4 CAPACE)	2026-04-23 07:19:22.052951+00	360.00	f	\N	2026-04-23 07:20:09.190002+00	CARD	\N	1097	ASC-D	1159		0		0	\N	2
1508	2	DJ88DDD	\N	\N	2026-04-22 11:30:51.649598+00	412.00	f	\N	2026-04-22 11:31:35.179575+00	OP	\N	1056	ASC-D	1121		0		0	\N	2
1563	2	B300GHM	\N	ANV MONTATE BRIDSGESTONE               TURANZA          225 55 17	2026-04-23 08:40:38.33848+00	180.00	f	\N	2026-04-23 08:41:16.273925+00	CARD	\N	1110		0		0		0	\N	2
1526	2	DJ24NMA	\N	\N	2026-04-22 13:25:50.46537+00	1720.00	f	\N	2026-04-22 14:00:09.032129+00	CARD	\N	1079	ASC-D	1142		0		0	\N	2
1580	2	DJ46WTK	\N	PIRELLI CINTURATO 225 50 18 MM 5 5 5 5  PRESIUNE 2,3 N,M 140	2026-04-23 11:06:55.624832+00	96.00	f	\N	2026-04-23 11:14:16.558918+00	CASH	\N	1125	ASC-D	1181		0		0	\N	2
1565	2	DJ77BIB	\N	4ANV 255\\40\\20 KUMHO 6MM DOT1523 4JANTE ALIAJ 4CAPACE LA CENTRU	2026-04-23 08:49:13.051303+00	912.00	f	\N	2026-04-23 09:09:14.65386+00	CASH	\N	1106	ASC-D	1168		0		0	\N	2
1598	2	MASTER	\N	\N	2026-04-23 13:18:00.426884+00	1240.00	f	\N	2026-04-23 13:25:34.607993+00	CARD	\N	\N	ASC-D	1197		0		0	\N	2
1618	2	DJ77AFA	\N	\N	2026-04-24 06:45:26.759243+00	176.00	f	\N	2026-04-24 06:48:01.773369+00	CARD	\N	1156	ASC-D	1211		0		0	\N	2
1625	2	DJ67MOV	\N	225/50/18 TORQE TQ HP ANV MONTATE	2026-04-24 07:23:00.930148+00	176.00	f	\N	2026-04-24 07:25:25.982068+00	CARD	\N	1166	ASC-D	1221		0		0	\N	2
1638	2	CJ70GFT	\N	ANV CUSTODIE 205/55/16 SEMPERIT  SPEED  GRIP 5 MM7  DOT  3824   4 BUC.	2026-04-24 08:34:00.869044+00	256.00	f	\N	2026-04-24 08:35:18.337891+00	OP	\N	1178	ASC-D	1229		0		0	\N	2
1654	2	B666KMG	\N	\N	2026-04-24 10:10:05.959149+00	2812.00	f	\N	2026-04-24 10:40:42.656703+00	CARD	\N	1195	ASC-D	1242		0		0	\N	2
1671	2	DJ55AED	\N	ANVELOPE CLIENT \nCONTINENTAL 205/60/16 5MM	2026-04-24 11:58:58.310995+00	132.00	f	\N	2026-04-24 12:05:36.782833+00	CASH	\N	1211	ASC-D	1251		0		0	\N	2
45	2	DJ 53 AGA BMW G30 GALCA ADRIAN 0765178726 KM	\N	\N	2026-03-25 10:23:43.983143+00	100.00	t	2026-04-08 18:07:04.60031+00	2026-03-25 14:15:46.259903+00	CARD	\N	\N		0		0		0	\N	\N
798	2	DJ56DEY	\N	JANTE TERMINATE	2026-04-08 11:35:26.967956+00	1988.00	f	\N	2026-04-08 12:21:43.523014+00	CARD	\N	395	ASC-D	602		0		0	\N	2
176	2	DJ12FHL	\N	\N	2026-03-27 09:33:50.074677+00	132.00	t	2026-04-08 18:07:04.60031+00	2026-03-27 09:37:02.404651+00	OP	\N	\N	AS26D	138		0		0	\N	\N
816	2	DJ43COM	\N	KUMHO WINTER 205/60/16 6MM DOT=1924 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )\n\nKUMHO ECSTA 215/55/17 2,4 BARI ( SAU MONTAT)	2026-04-08 14:09:39.375293+00	96.00	t	2026-04-08 18:07:04.60031+00	2026-04-08 14:17:21.685861+00	CASH	\N	411	ASC-D	611		0		0	\N	2
806	2	DJ38RXA	\N	CUSTODIE 4 ANV HANKOOK WINTER 225 60 17 DOT 3222 MM 6\nMONTAT IOKOHAMA 225 60 17	2026-04-08 12:41:18.908836+00	316.00	f	\N	2026-04-08 12:42:12.093638+00	OP	\N	402	ASC-D	604		0		0	\N	2
805	2	DJ18ECU	\N	\N	2026-04-08 12:39:52.744838+00	148.00	f	\N	2026-04-08 12:42:43.610258+00	CARD	\N	401	ASC-D	603		0		0	\N	2
807	2	DJ55CSI	\N	\N	2026-04-08 12:51:10.369293+00	40.00	f	\N	2026-04-08 12:52:00.082711+00	CASH	\N	\N		0		0		0	\N	2
809	2	DJ24PAB	\N	ANV CLIENT DEBICA 205/60/16 4BUC	2026-04-08 13:02:07.561056+00	136.00	f	\N	2026-04-08 13:04:44.805673+00	CASH	\N	404		0		0		0	\N	2
845	2	DJ02CVS	\N	ANV CLIENT MICHELIN PRIMACY3  225 50 18 MM 6 6 6 6 PRESIUNE FATA SPATE 2,3N M 110  \nCUSTODIE  ANV  MICHELIN PILOT ALPIN 5 225 50 18 MM 6 6 6 6                   2519	2026-04-09 07:48:48.514895+00	316.00	f	\N	2026-04-09 07:49:35.261738+00	CARD	\N	437	ASC-D	631		0		0	\N	2
810	2	DJ93THY	\N	\N	2026-04-08 13:20:03.07412+00	108.00	f	\N	2026-04-08 13:24:17.249682+00	CARD	\N	405		0		0		0	\N	2
826	2	SB76KON	\N	JANTE ANV CLIENT FIRESTONE 215/65/16 4BUC RECOMAND ANVELOPE	2026-04-09 06:14:02.420313+00	76.00	f	\N	2026-04-09 06:16:47.747706+00	CARD	\N	420	ASC-D	618		0		0	\N	2
818	2	DJ16CCR	\N	\N	2026-04-09 05:37:46.132204+00	60.00	f	\N	2026-04-09 05:39:39.90529+00	CARD	\N	413	ASC-D	612		0		0	\N	2
840	2	DJ08ROW	\N	ANVELOPE CLIENT ROADX 205/55/16 8MM	2026-04-09 07:21:19.387692+00	156.00	f	\N	2026-04-09 07:28:19.872976+00	CASH	\N	433	ASC-D	627		0		0	\N	2
812	2	DJ01CEC	\N	ANV CLIENT FORTUNE 205/60/16 3BUC	2026-04-08 13:35:49.704239+00	102.00	f	\N	2026-04-08 13:36:21.499808+00	CARD	\N	408		0		0		0	\N	2
813	2	DJ14GWJ	\N	ANVELOPELE DE IARNA SE RIDICA	2026-04-08 13:35:58.572758+00	236.00	f	\N	2026-04-08 13:37:10.379675+00	CASH	\N	406	ASC-D	607		0		0	\N	2
811	2	DJ07YMG	\N	\N	2026-04-08 13:33:33.534777+00	48.00	f	\N	2026-04-08 13:38:23.22216+00	CASH	\N	407	ASC-D	608		0		0	\N	2
833	2	DJ92XCE	\N	\N	2026-04-09 06:50:58.21341+00	300.00	f	\N	2026-04-09 06:54:09.012038+00	OP	\N	427	ASC-D	622		0		0	\N	2
827	2	TM59AHC	\N	MONTAT HANKOOK 205 55 16	2026-04-09 06:18:56.321757+00	88.00	f	\N	2026-04-09 06:19:23.462227+00	OP	\N	422	ASC-D	619		0		0	\N	2
821	2	DJ25ASK	\N	ANV CLIENT MICHELIN 225/50/17 4BUC	2026-04-09 05:45:34.773453+00	168.00	f	\N	2026-04-09 05:46:41.350698+00	CARD	\N	415	ASC-D	613		0		0	\N	2
814	2	DJ78DRC	\N	MICHELIN PS4 225/60/18 5MM 2,5 BARI ( ANVELOPE CLIENT )	2026-04-08 13:52:41.044158+00	108.00	f	\N	2026-04-08 13:54:19.53684+00	CARD	\N	409	ASC-D	609		0		0	\N	2
819	2	B958ALM	\N	\N	2026-04-09 05:38:05.418873+00	108.00	f	\N	2026-04-09 05:46:57.75685+00	CARD	\N	412	ASC-D	614		0		0	\N	2
815	2	DJ22NPG	\N	\N	2026-04-08 13:54:53.105002+00	108.00	f	\N	2026-04-08 13:56:19.13692+00	CASH	\N	410		0		0		0	\N	2
817	2	DJ43COM	\N	KUMHO WINTER 205/60/16 6MM DOT=1924 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )\n\nKUMHO ECSTA 215/55/17 2,4 BARI ( SAU MONTAT)	2026-04-08 14:10:01.106496+00	246.00	f	\N	2026-04-08 14:10:34.197523+00	CARD	\N	411	ASC-D	610		0		0	\N	2
823	2	DJ60ALE	\N	MICHELIN 245 45 18	2026-04-09 05:49:09.06499+00	168.00	f	\N	2026-04-09 05:50:36.745892+00	CARD	\N	417		0		0		0	\N	2
828	2	DJ18ABY	\N	ANV CLIENT SH 120 70 17 MICHELIN	2026-04-09 06:22:36.637976+00	55.00	f	\N	2026-04-09 06:23:11.934273+00	CASH	\N	423		0		0		0	\N	2
824	2	DJ26PTX	\N	ANVELOPE CLIENT MICHELIN 235/60/18 4MM	2026-04-09 05:50:47.770359+00	176.00	f	\N	2026-04-09 05:51:31.262497+00	CASH	\N	418		0		0		0	\N	2
838	2	DJ74XAM	\N	\N	2026-04-09 07:05:31.481051+00	300.00	f	\N	2026-04-09 07:08:20.691017+00	CARD	\N	430	ASC-D	625		0		0	\N	2
820	2	DJ12BEC	\N	ANV CLIENT  CONTI  SPORT CONTACT 7 255 35 20 MM 8 8  GOODYEAR EAGLE F1  255 35 20 MM5 5 PRESIUNE 2,4 FATA  SPATE NM 120\nCUSTODIE ANV    JANTE CAPACE HANKOOK   WINTER  ICEPT  EVO  3 255 40 19 M 6 6 6 6	2026-04-09 05:44:31.515549+00	350.00	f	\N	2026-04-09 06:04:17.753605+00	CARD	\N	414	ASC-D	615		0		0	\N	2
834	2	DJ07EGN	\N	JANTE ANV CLIENT KELLI 205/55/16 2BUC TAURUS 205/55/16 2BUC SAU MONTAT\nCUSTODIE 4JANTE OTEL+4ANVELOPE+4CAPACE PLASTIC TOURADOR WINTER PRO 205/55/16 DOT2824 6MM 2BUC TAURUS WINTER 205/55/16 DOT2319 6MM	2026-04-09 06:54:45.706412+00	226.00	f	\N	2026-04-09 06:56:03.84576+00	CASH	\N	\N	ASC-D	623		0		0	\N	2
829	2	DJ82FRT	\N	4 ANVELOPE KUMHO DOT 15 23 MM 5 205 65 16	2026-04-09 06:33:36.402355+00	252.00	f	\N	2026-04-09 06:35:04.601896+00	OP	\N	421	ASC-D	620		0		0	\N	2
822	2	DJ10KMR	\N	\N	2026-04-09 05:48:17.148928+00	1656.00	f	\N	2026-04-09 06:07:37.423324+00	CARD	\N	416	ASC-D	616		0		0	\N	2
825	2	DJ19KEY	\N	\N	2026-04-09 06:06:41.166208+00	300.00	f	\N	2026-04-09 06:12:00.092897+00	CARD	\N	419	ASC-D	617		0		0	\N	2
830	2	OT92CRT	\N	\N	2026-04-09 06:38:03.030658+00	120.00	f	\N	2026-04-09 06:44:12.583554+00	CARD	\N	424		0		0		0	\N	2
835	2	DJ98ARG	\N	NOKIAN 205 50 17	2026-04-09 06:56:27.383914+00	96.00	f	\N	2026-04-09 06:56:55.081865+00	CARD	\N	428		0		0		0	\N	2
831	2	DJ99BAS	\N	MICHELIN PA5 305/40/20 5MM DOT=3822\nMICHELIN PA5 275/45/20 6MM DOT=4322 ( CUST. 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE)\n\nCONTINENTAL 315/30/22 6MM\nCONTINENTAL PREMIUMCONT. 275/35/22 6MM ( SAU MONTAT )	2026-04-09 06:42:23.288182+00	400.00	f	\N	2026-04-09 06:45:03.743555+00	CASH	\N	425	ASC-D	621		0		0	\N	2
836	2	DJ21UBT	\N	\N	2026-04-09 06:59:01.829614+00	1108.00	f	\N	2026-04-09 11:08:31.172939+00	CASH	\N	429		0		0		0	\N	2
839	2	DJ24EDS	\N	ANV MONTATE MICHELIN PRI MACY 4 205 55 16 MM 6 6 6 6PRESIUNE FATA  SPATE 2,3  NM 120 \nCUSTODIE ANV  TIGAR WINTER 205 55 16  MM 6 6 6 6 DOT 4519	2026-04-09 07:14:06.03627+00	256.00	f	\N	2026-04-09 07:15:00.837966+00	CARD	\N	431	ASC-D	626		0		0	\N	2
837	2	DJ24DME	\N	\N	2026-04-09 07:02:43.120565+00	224.00	f	\N	2026-04-09 07:04:23.790007+00	CARD	\N	426	ASC-D	624		0		0	\N	2
832	2	DJ20AWD	\N	\N	2026-04-09 06:45:59.531349+00	3244.00	f	\N	2026-04-09 07:44:24.50676+00	CARD	\N	436	ASC-D	630		0		0	\N	2
842	2	DJ81MLS	\N	ANV CLIENT MICHELIN 205/55/16	2026-04-09 07:35:12.658876+00	148.00	f	\N	2026-04-09 07:36:59.282155+00	OP	\N	434	ASC-D	629		0		0	\N	2
841	2	VL28KOA	\N	4 JANTE OTEL 4 ANVELOPE 4 CAPACE NOKIAN 215 65 16 DOT42 24 MM 5	2026-04-09 07:28:25.950867+00	270.00	f	\N	2026-04-09 07:31:30.42184+00	CARD	\N	432	ASC-D	628		0		0	\N	2
846	2	B53CPR	\N	\N	2026-04-09 07:56:55.436309+00	72.00	f	\N	2026-04-09 07:57:44.23784+00	CARD	\N	438		0		0		0	\N	2
847	2	B200DUK	\N	\N	2026-04-09 07:57:49.554493+00	1000.00	f	\N	2026-04-09 07:59:46.893686+00	CARD	\N	\N	ASC-D	632		0		0	\N	2
848	2	MH16AXA	\N	\N	2026-04-09 08:07:20.663777+00	360.00	f	\N	2026-04-09 08:08:12.989829+00	CARD	\N	440	ASC-D	633		0		0	\N	2
849	2	VL25SOS	\N	\N	2026-04-09 08:08:32.8823+00	250.00	f	\N	2026-04-09 08:14:03.524094+00	CASH	\N	441	ASC-D	635		0		0	\N	2
851	2	DJ22SFV	\N	ANV CLIENT CONTINENTAL 235/65/17 4BUC	2026-04-09 08:15:35.560818+00	200.00	f	\N	2026-04-09 08:16:48.461449+00	CARD	\N	443	ASC-D	636		0		0	\N	2
850	2	DJ18SNE	\N	CUSTODIE NOUA 4 ANV SAILUN ICE BLAYER 215 50 17 DOT 2724 MM 6	2026-04-09 08:11:45.007684+00	308.00	f	\N	2026-04-09 08:16:45.237304+00	CARD	\N	442	ASC-D	634		0		0	\N	2
852	2	DJ16FNA	\N	\N	2026-04-09 08:20:39.887641+00	132.00	f	\N	2026-04-09 08:22:37.11116+00	CASH	\N	439		0		0		0	\N	2
843	2	DJ07NYE	\N	\N	2026-04-09 07:40:32.933248+00	1120.00	t	2026-04-09 10:57:06.437313+00	\N	NEPLATIT	\N	435		0		0		0	\N	2
857	2	DJ66VDMKM135000	\N	\N	2026-04-09 08:38:44.15934+00	3208.00	f	\N	2026-04-09 10:05:51.80215+00	CASH	\N	448	ASC-D	658		0		0	\N	2
1259	2	B55PXS	\N	\N	2026-04-20 06:57:05.866191+00	192.00	f	\N	2026-04-20 06:57:32.757303+00	CARD	\N	825		0		0		0	\N	2
853	2	DJ24SCI	\N	ANV CLIENT PIRELLI 215/55/17 6MM	2026-04-09 08:24:47.706628+00	180.00	f	\N	2026-04-09 08:26:14.725153+00	CASH	\N	444	ASC-D	637		0		0	\N	2
872	2	B300REH	\N	\N	2026-04-09 09:33:25.050876+00	1060.00	f	\N	2026-04-09 10:54:33.470102+00	OP	\N	462	ASC-D	663		0		0	\N	2
855	2	DJ50XSX	\N	\N	2026-04-09 08:26:55.542189+00	150.00	f	\N	2026-04-09 08:27:35.244166+00	CARD	\N	446	ASC-D	638		0		0	\N	2
1350	2	DJ07MXO	\N	ANVELOPE CLIENT\nTAURUS 215/45/16 8MM	2026-04-21 05:49:38.073922+00	160.00	f	\N	2026-04-21 05:50:21.592318+00	CASH	\N	910		0		0		0	\N	2
1258	2	DJ02HDV	\N	\N	2026-04-20 06:53:42.231751+00	598.00	f	\N	2026-04-20 07:10:35.713529+00	CARD	\N	824	ASC-D	935		0		0	\N	2
854	2	DJ21UBT	\N	\N	2026-04-09 08:25:10.659177+00	300.00	f	\N	2026-04-09 11:08:29.880461+00	CASH	\N	445	ASC-D	639		0		0	\N	2
858	2	DJ36WLW	\N	4 JANTE ALIAJ 4 ANVELOPE 215 55 17 CONTINENTAL DOT 03 25 MM 6	2026-04-09 08:40:50.979601+00	256.00	f	\N	2026-04-09 08:42:09.893483+00	CARD	\N	447	ASC-D	641		0		0	\N	2
1430	2	DJ03STM	\N	MICHELIN235/65/16C 4BUC SAU MONTAT\nCUSTODIE 4ANV MICHELIN AGILIS ALPIN 215/75/16C DOT3824 5MM 4BUC	2026-04-21 12:07:58.811441+00	312.00	f	\N	2026-04-21 12:11:06.733837+00	CARD	\N	978	ASC-D	1055		0		0	\N	2
856	2	DJ11PCP	\N	\N	2026-04-09 08:32:27.90804+00	1150.00	f	\N	2026-04-09 08:47:00.643917+00	OP	\N	\N	ASC-D	642		0		0	\N	2
1262	2	DJ28KID	\N	PRESIUNE FATA SPATE 2,3 NM 120	2026-04-20 07:21:41.724047+00	784.00	f	\N	2026-04-20 07:43:59.150294+00	CARD	\N	828	ASC-D	939		0		0	\N	2
1357	2	GJ90YOR	\N	\N	2026-04-21 06:24:36.245131+00	60.00	f	\N	2026-04-21 06:33:16.113822+00	CASH	\N	917	ASC-D	998		0		0	\N	2
1288	2	DJ04RMM	\N	\N	2026-04-20 09:46:32.289767+00	60.00	f	\N	2026-04-20 09:49:32.241729+00	CARD	\N	851		0		0		0	\N	2
860	2	DJ04DFT	\N	ANV CLIENT PIRELLI P  ZERO 275 35 21 MM  5 5	2026-04-09 08:43:45.746133+00	116.00	f	\N	2026-04-09 08:51:14.265992+00	CARD	\N	450	ASC-D	644		0		0	\N	2
863	2	DJ32DIF	\N	\N	2026-04-09 08:50:38.841582+00	180.00	f	\N	2026-04-09 08:55:57.987731+00	CASH	\N	452	ASC-D	645		0		0	\N	2
864	2	DJ1LLL	\N	\N	2026-04-09 08:58:10.670561+00	300.00	f	\N	\N	NEPLATIT	\N	24		0		0		0	\N	2
862	2	DJ07NYE	\N	4 ANVELOPE VIKING 205 60 16 4 JANTE ALIAJ 4 CAPACE CUSTODIE	2026-04-09 08:48:32.737234+00	1406.00	f	\N	2026-04-09 09:00:49.962209+00	CARD	\N	435	ASC-D	646		0		0	\N	2
1290	2	DJ01ACV	\N	ROTI CLIENT MICHELIN 205/55/16 6MM	2026-04-20 10:13:21.69565+00	116.00	f	\N	2026-04-20 10:14:44.831175+00	CASH	\N	854		0		0		0	\N	2
865	2	DJ69ACR	\N	ANV CLIENT HANKOOK 225/50/17 4BUC	2026-04-09 09:06:19.42111+00	208.00	f	\N	2026-04-09 09:10:02.057353+00	CASH	\N	454	ASC-D	647		0		0	\N	2
1546	2	DJ96CCC	\N	\N	2026-04-23 06:38:30.16957+00	1020.00	f	\N	2026-04-23 06:59:56.221037+00	CARD	\N	1092	ASC-D	1156		0		0	\N	2
866	2	DJ10ROL	\N	\N	2026-04-09 09:11:51.556353+00	72.00	f	\N	2026-04-09 09:17:21.501948+00	CARD	\N	455	ASC-D	648		0		0	\N	2
765	2	DJ77LIT	\N	CUSTODIE 225/45/17 MI PS5  3621  - 7 7 7 7\nMONTAT 225/45/1 7 RIKJEN \n\nPREZONE LIPSA	2026-04-08 07:45:58.528562+00	2430.00	t	2026-04-09 09:21:32.49752+00	2026-04-09 08:47:34.223146+00	NEPLATIT	\N	75	ASC-D	640		0		0	\N	2
1381	2	DJ29PEL	\N	ANV CLIENR BRIDGESTONE TURANZA 205 65 15 MM 6 6 6 6 PRESIUNE  FATA SPATE 2,3 NM 110	2026-04-21 08:06:31.969698+00	136.00	f	\N	2026-04-21 08:08:19.173561+00	CASH	\N	938	ASC-D	1016		0		0	\N	2
1311	2	B123JWF	\N	215 70 16 HANKOOK VENTUSE	2026-04-20 11:49:46.735247+00	164.00	f	\N	2026-04-20 11:53:04.616917+00	CARD	\N	870		0		0		0	\N	2
1342	2	DJ83DRO	\N	\N	2026-04-20 14:00:49.523645+00	180.00	f	\N	2026-04-20 14:05:32.169147+00	CARD	\N	902		0		0		0	\N	2
870	2	E0884JSG	\N	\N	2026-04-09 09:28:10.15384+00	964.00	f	\N	2026-04-09 09:39:07.101665+00	CASH	\N	460	ASC-D	652		0		0	\N	2
1488	2	DJ17UZR	\N	4 ANVELOPE GT RADIAL WINTER PRO 225 65 17 M 7 DOT 17 25 4 ANVELOPE 4 JANTE 4 CAPACE CUSOTDIE	2026-04-22 09:21:16.040877+00	240.00	f	\N	2026-04-22 09:25:46.199554+00	CARD	\N	1037	ASC-D	1105		0		0	\N	2
1344	2	OT25MCT	\N	\N	2026-04-20 14:18:29.430303+00	250.00	f	\N	2026-04-20 14:21:58.311985+00	CARD	\N	904	ASC-D	985		0		0	\N	2
1447	2	OT08DSD	\N	\N	2026-04-21 13:49:58.731591+00	132.00	f	\N	2026-04-21 13:56:00.33705+00	CARD	\N	998	ASC-D	1066		0		0	\N	2
1348	2	DJ88SBA	\N	ANV JANTE CUSTODIE VICLETI WINTER 255 55 18 DOT5219 MM 5 5 5 5 \nANV MONTATE GOODYEAR EAGLE F1 245 40 20              315 35 20  MM 8 8 5 5	2026-04-20 14:29:11.186793+00	472.00	f	\N	2026-04-20 14:30:29.269338+00	CASH	\N	907	ASC-D	989		0		0	\N	2
1405	2	DJ19BTW	\N	ANV CLIENT GOODYEAR 215/55/17 4BUC SAU MONTAT	2026-04-21 09:54:56.757775+00	168.00	f	\N	2026-04-21 09:58:26.248369+00	CARD	\N	958	ASC-D	1035		0		0	\N	2
1407	2	DJ03TEH	\N	ANVELOPE FATA UZATE	2026-04-21 09:56:56.837996+00	180.00	f	\N	2026-04-21 10:01:32.041826+00	CASH	\N	960		0		0		0	\N	2
1346	2	B100WBC	\N	\N	2026-04-20 14:22:50.572826+00	596.00	f	\N	2026-04-20 14:39:29.96046+00	CASH	\N	908	ASC-D	991		0		0	\N	2
1567	2	OT30ABD	\N	\N	2026-04-23 09:01:52.009125+00	3028.00	f	\N	2026-04-23 09:43:23.161848+00	CARD	\N	1117	ASC-D	1171		0		0	\N	2
1450	2	B124SRY	\N	\N	2026-04-21 14:17:47.539386+00	208.00	f	\N	2026-04-21 14:18:34.283656+00	CARD	\N	1000	ASC-D	1069		0		0	\N	2
1428	2	DJ98RRR	\N	ANVELOPE CLIENT\n  MICHELIN PRIMACY3 225/50/18 6MM	2026-04-21 12:01:23.825754+00	176.00	f	\N	2026-04-21 12:03:01.056907+00	CASH	\N	976	ASC-D	1052		0		0	\N	2
1530	2	DJ45ELF	\N	\N	2026-04-22 13:46:15.743679+00	300.00	f	\N	2026-04-22 13:48:55.43087+00	OP	\N	1076	ASC-D	1140		0		0	\N	2
1510	2	DJ19WSC	\N	\N	2026-04-22 11:51:03.020571+00	120.00	f	\N	2026-04-22 12:24:27.49239+00	CARD	\N	1059	ASC-D	1132		0		0	\N	2
1468	2	DJ95DRT	\N	4ANVGRENLANDER 5MM 215\\60\\17 DOT 3024	2026-04-22 07:21:35.00315+00	316.00	f	\N	2026-04-22 07:22:40.780004+00	CARD	\N	1014	ASC-D	1083		0		0	\N	2
1474	2	DJ18WLK	\N	\N	2026-04-22 08:05:01.809789+00	250.00	f	\N	2026-04-22 09:20:01.343995+00	CASH	\N	1023	ASC-D	1089		0		0	\N	2
1566	2	DJ77MTO	\N	DEBICA 205 55 16	2026-04-23 08:56:15.506287+00	148.00	f	\N	2026-04-23 08:57:55.264176+00	CASH	\N	1112	ASC-D	1169		0		0	\N	2
1529	2	DJ91DAL	\N	CUSTODIE 3ANV 3JANTE ALIAJ 3CAPACE KELLI WINTER 205 55 16 DOT 3022 MM 5\nMONTAT KUMHO 205 55 16	2026-04-22 13:37:30.72293+00	226.00	f	\N	2026-04-22 13:40:19.492399+00	CASH	\N	1075	ASC-D	1139		0		0	\N	2
1531	2	DJ23SMD	\N	ANV CLIENT BRIDGESTONE ECOPIA 205 55 16 MM 6 6 7 7 PRESIUNE FATA SPATE 2,3  NM 110	2026-04-22 13:57:06.558831+00	138.00	f	\N	2026-04-22 13:58:37.863978+00	CARD	\N	1078		0		0		0	\N	2
1548	2	B118GPJ	\N	\N	2026-04-23 06:48:38.269584+00	2856.00	f	\N	2026-04-23 07:18:20.472216+00	OP	\N	1096	ASC-D	1157		0		0	\N	2
1622	2	DJ17FBF	\N	ORIUM ALL SEASION 185 65 15	2026-04-24 07:09:03.673752+00	495.00	f	\N	2026-04-24 07:11:59.829777+00	CARD	\N	1162	ASC-D	1216		0		0	\N	2
1582	2	DJ36TEH	\N	\N	2026-04-23 11:19:44.671095+00	146.00	f	\N	2026-04-23 11:20:27.770318+00	CASH	\N	1127	ASC-D	1183		0		0	\N	2
1583	2	DJ73GMC	\N	\N	2026-04-23 11:20:31.327745+00	250.00	f	\N	2026-04-23 11:25:12.364045+00	CASH	\N	1128	ASC-D	1184		0		0	\N	2
1602	2	DJ91MOD	\N	\N	2026-04-23 13:42:43.102314+00	180.00	f	\N	2026-04-23 13:45:18.151263+00	CARD	\N	1147	ASC-D	1201		0		0	\N	2
1623	2	DJ11WOG	\N	MICHELIN 235/55/17 ROTI COMPLETE 4BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV MICHELIN PILOT ALPIN5 DOT4325 7MM 4BUC	2026-04-24 07:10:44.086896+00	256.00	f	\N	2026-04-24 07:11:47.688737+00	CARD	\N	1163	ASC-D	1215		0		0	\N	2
1624	2	DJ85AZS	\N	\N	2026-04-24 07:13:13.771201+00	250.00	f	\N	2026-04-24 07:17:38.202099+00	CASH	\N	1164	ASC-D	1218		0		0	\N	2
1640	2	B807RSH	\N	ANV CLIENT RIKEN 215/60/17 4BUC SAU MONTAT	2026-04-24 08:41:45.578217+00	160.00	f	\N	2026-04-24 08:43:28.914737+00	OP	\N	1181	ASC-D	1230		0		0	\N	2
1655	2	DJ50SYF	\N	\N	2026-04-24 10:13:59.859661+00	1240.00	t	2026-04-24 10:53:37.351458+00	\N	NEPLATIT	\N	1196		0		0		0	\N	2
1685	2	OT86MXA	\N	\N	2026-04-24 13:20:05.421069+00	180.00	f	\N	2026-04-24 13:24:52.855906+00	CASH	\N	1225		0		0		0	\N	2
882	2	B228WGT	\N	ANVELOPE CLIENT GOODYEAR 205/55/16	2026-04-09 10:23:02.527116+00	132.00	f	\N	2026-04-09 10:23:32.335635+00	CARD	\N	470		0		0		0	\N	2
859	2	DJ13YXW	\N	CLIENTUL REFUZA VALVE	2026-04-09 08:42:42.998052+00	176.00	f	\N	2026-04-09 08:46:13.200161+00	CASH	\N	449		0		0		0	\N	2
861	2	GJ92TRM	\N	\N	2026-04-09 08:44:26.517978+00	80.00	f	\N	2026-04-09 08:50:29.314989+00	OP	\N	451	ASC-D	643		0		0	\N	2
867	2	B809MST	\N	ANV BRIDGESTONE ALENZA 275 40 20 245  45 20	2026-04-09 09:18:48.944825+00	104.00	f	\N	2026-04-09 09:21:16.732916+00	CARD	\N	456		0		0		0	\N	2
900	2	OT17LVK	\N	\N	2026-04-09 12:21:18.384469+00	268.00	f	\N	2026-04-09 12:24:32.45118+00	CASH	\N	487	ASC-D	677		0		0	\N	2
868	2	DJ34CNC	\N	\N	2026-04-09 09:21:49.312944+00	168.00	f	\N	2026-04-09 09:27:00.97259+00	OP	\N	458	ASC-D	649		0		0	\N	2
889	2	DJ72NYS	\N	ANV CLIENT PIRELLI 215/55/17 4BUC	2026-04-09 11:16:57.496056+00	168.00	f	\N	2026-04-09 11:18:57.6939+00	CARD	\N	478	ASC-D	667		0		0	\N	2
844	2	DJ08DOX	\N	\N	2026-04-09 07:48:10.07178+00	4168.00	f	\N	2026-04-09 09:28:34.58639+00	CASH	\N	459	ASC-D	651		0		0	\N	2
869	2	HR03MAF	\N	\N	2026-04-09 09:24:48.944134+00	76.00	f	\N	2026-04-09 09:29:15.719363+00	CARD	\N	\N	ASC-D	650		0		0	\N	2
883	2	DJ92LFB	\N	205 45 18 DUNLOP	2026-04-09 10:26:25.175832+00	168.00	f	\N	2026-04-09 10:33:14.361505+00	CARD	\N	471		0		0		0	\N	2
884	2	DJ89MKE	\N	ANV  CLIENT HANKOOK VENTUS  PRIMER  225 50 17  MM 6 6 4 4PRESIUNE 2,4 FATA   SPATE NM 120	2026-04-09 10:31:52.736628+00	76.00	f	\N	2026-04-09 10:33:16.608826+00	CARD	\N	472	ASC-D	660		0		0	\N	2
874	2	DJ17DWH	\N	CUSTODIE 4 ANV HANKOOK WINTER 185 65 15 DOT 4524 MM 6\nMONTAT HANKOOK KINERGI 185 65 15	2026-04-09 09:48:28.861864+00	156.00	f	\N	2026-04-09 09:49:16.46905+00	NEPLATIT	\N	\N	ASC-D	653		0		0	\N	2
885	2	DJ93FRT	\N	4 ANVELOPE 2 VIKING DOT 44 25 MM 6 2 KUMHO MM4 DOT 15 23 205 65 16	2026-04-09 10:37:45.727744+00	268.00	f	\N	2026-04-09 10:38:56.169468+00	OP	\N	468	ASC-D	661		0		0	\N	2
875	2	DJ17DWH	\N	CUSTODIE 4ANV HANOOK WINTER 185 65 15 DOT 4524 MM6\nMONTAT HANKOOK KINERGI 185 65 15	2026-04-09 09:52:18.344305+00	276.00	f	\N	2026-04-09 09:53:41.664454+00	CARD	\N	464	ASC-D	654		0		0	\N	2
877	2	DJ21MCY	\N	MICHELIN215/60/17 SAU MONTAT\nCUSTODIE MICHELIN ALPIN6 215/60/17 DOT2523 6MM 4BUC	2026-04-09 09:53:44.537129+00	336.00	f	\N	2026-04-09 09:54:27.732012+00	CARD	\N	465	ASC-D	655		0		0	\N	2
908	2	DJ59RAF	\N	MICHELIN PS4 235/65/17 5MM 2,5 BARI\n\nMICHELIN LATITUDIN ALPIN 235/65/17 5MMVDOT=0617 ( CUST 4 ANVELOPE,4 JANTE ALIAJ )	2026-04-09 13:09:45.287156+00	256.00	f	\N	2026-04-09 13:10:40.793807+00	CASH	\N	495	ASC-D	681		0		0	\N	2
891	2	DJ79SAG	\N	225 45 17 MICHELIN	2026-04-09 11:20:25.497809+00	168.00	f	\N	2026-04-09 11:21:28.404863+00	CARD	\N	480		0		0		0	\N	2
878	2	DJ77AVL	\N	ANV CLIENT BRIDGESTONE ALL  SEASON 215 55 16 MM 8 8 8 8PRESIUNE FATA SPATE  2,3	2026-04-09 09:59:48.164673+00	172.00	f	\N	2026-04-09 10:00:39.985135+00	CARD	\N	466	ASC-D	656		0		0	\N	2
871	2	DJ96AFC	\N	\N	2026-04-09 09:31:48.687854+00	1008.00	f	\N	2026-04-09 10:41:45.89351+00	CARD	\N	461	ASC-D	662		0		0	\N	2
876	2	OT96DRB	\N	4 JANTE ALIAJ 4 ANVELOPE 4 CAPACE CENTRU MICHELIN 205 55 16 DOT 22 24 MM 6	2026-04-09 09:52:37.649241+00	286.00	f	\N	2026-04-09 10:01:39.659261+00	CASH	\N	463	ASC-D	657		0		0	\N	2
896	2	DJ11GES	\N	\N	2026-04-09 12:00:46.573199+00	224.00	f	\N	2026-04-09 12:02:13.73991+00	CARD	\N	483	ASC-D	673		0		0	\N	2
879	2	OT41PXP	\N	\N	2026-04-09 10:07:00.725591+00	180.00	f	\N	2026-04-09 10:13:04.942648+00	CASH	\N	467	ASC-D	659		0		0	\N	2
907	2	VL70MAR	\N	\N	2026-04-09 12:53:47.629283+00	250.00	f	\N	2026-04-09 12:57:33.867799+00	CARD	\N	494	ASC-D	680		0		0	\N	2
873	2	DJ77HXH	\N	\N	2026-04-09 09:46:50.487515+00	1500.00	f	\N	2026-04-09 10:22:28.496899+00	CASH	\N	\N		0		0		0	\N	2
887	2	DJ70SYF	\N	PRESIUNE FATA SPATE 2,3 NM 120	2026-04-09 10:54:42.558971+00	1240.00	f	\N	2026-04-09 13:36:34.780313+00	CARD	\N	474	ASC-D	674		0		0	\N	2
901	2	B972MEN	\N	BRIDGESTONE 215/55/18 SAU MONTAT\nCUSTODIE 4ANV PIRELLI WINTER2 215/55/18 DOT2523 6MM	2026-04-09 12:30:30.326062+00	316.00	f	\N	2026-04-09 12:32:37.505584+00	CASH	\N	488	ASC-D	678		0		0	\N	2
892	2	B189PPE	\N	ANV  CLIENT MICHELIN PRIMACY5 225 55 17  MM 7 7 6 6 PRESIUNE 2,5 FATA SPATE NM  120\nCUSTODIEA    ANV MICHELIN ALPIN 7 225 55 17 MM 7 7 7 7 DOT 2325	2026-04-09 11:21:33.189706+00	540.00	f	\N	2026-04-09 11:35:25.065004+00	OP	\N	479	ASC-D	670		0		0	\N	2
890	2	DJ74MAN	\N	MICHELIN 205 60 16 4 ANVELOPE DOT 22 17 MM 4	2026-04-09 11:19:30.650362+00	356.00	f	\N	2026-04-09 11:35:41.568758+00	CARD	\N	475	ASC-D	669		0		0	\N	2
881	2	DJ96ROT	\N	\N	2026-04-09 10:22:19.750872+00	2012.00	f	\N	2026-04-09 10:58:30.817168+00	CARD	\N	476	ASC-D	664		0		0	\N	2
886	2	B41VTM	\N	\N	2026-04-09 10:40:16.245032+00	2236.00	f	\N	2026-04-09 10:59:12.722164+00	CARD	\N	473	ASC-D	665		0		0	\N	2
880	2	DJ14RKW	\N	\N	2026-04-09 10:21:52.557968+00	1952.00	f	\N	2026-04-09 11:48:37.022384+00	CARD	\N	469	ASC-D	671		0		0	\N	2
893	2	DJ07CER	\N	BRIDGESTONE BLIZZAC LM 005   285/40/21    DOT 2425   MM7              CUSTODIE 1X150              4ANV	2026-04-09 11:25:23.134606+00	382.00	f	\N	2026-04-09 11:29:04.37535+00	CARD	\N	481	ASC-D	668		0		0	\N	2
888	2	DJ08GFL	\N	MICHELIN 235/50/19 6MM 2,4 BARI\n\nSEBRING SNOW 235/55/18 6MM DOT=4621 ( CUSTODIE 4ANVELOPE,4 JANTE ALIAJ, 4 CAPACE )	2026-04-09 11:04:36.382952+00	280.00	f	\N	2026-04-09 11:05:52.937337+00	CASH	\N	477	ASC-D	666		0		0	\N	2
904	2	DJ02DEV	\N	ANV CLIENT BF GOODRICI 215 60 16 MM 4 4 4 4 PRESIUNE FATA SPATE 2,4 NM 120 ANV DREAPTA SPATE  DEFORMATA	2026-04-09 12:38:48.888396+00	76.00	f	\N	2026-04-09 12:40:56.956955+00	CARD	\N	491		0		0		0	\N	2
895	2	DJ01KEL	\N	MICHELIN 275/35/20 2BUC 245/40/20 2BUC\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU PIRELI P ZERO 275/40/19 2BUC DOT2523 6MM 245/40/19 2BUC DOT4822 5MM	2026-04-09 11:49:26.275728+00	304.00	f	\N	2026-04-09 11:51:32.167195+00	CARD	\N	482	ASC-D	672		0		0	\N	2
897	2	B272YUS	\N	ANVELOPE CLIENT GOODYEAR 235/50/20 7MM	2026-04-09 12:07:56.093043+00	504.00	f	\N	2026-04-09 12:09:49.158894+00	CARD	\N	484	ASC-D	675		0		0	\N	2
902	2	CJ27WTC	\N	ANV CLIENT BRIDGESTONE 225/65/17 5MM	2026-04-09 12:35:57.794335+00	176.00	f	\N	2026-04-09 12:37:18.319267+00	CASH	\N	489		0		0		0	\N	2
903	2	DJ28JOK	\N	\N	2026-04-09 12:35:58.405611+00	180.00	f	\N	2026-04-09 12:38:28.417409+00	CARD	\N	490		0		0		0	\N	2
905	2	DJ18YXW	\N	\N	2026-04-09 12:42:42.488975+00	192.00	f	\N	2026-04-09 12:44:20.670137+00	CASH	\N	492		0		0		0	\N	2
906	2	DJ33AKI	\N	245 45 18 PIRELLI	2026-04-09 12:46:21.674965+00	168.00	f	\N	2026-04-09 12:47:10.709945+00	CASH	\N	493	ASC-D	679		0		0	\N	2
898	2	DJ30DDR	\N	275 30 20 BUC 2 245 35 20 BUC 2 ROADX	2026-04-09 12:09:27.697073+00	336.00	f	\N	2026-04-09 13:11:13.526619+00	CARD	\N	485	ASC-D	682		0		0	\N	2
909	2	DJ22ADL	\N	\N	2026-04-09 13:11:09.524682+00	180.00	f	\N	2026-04-09 13:14:53.162265+00	CARD	\N	496	ASC-D	684		0		0	\N	2
910	2	DJ17WSD	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4CAPACE 225 50 17 DOT 2124 MM6 MICHELIN PIL ALP 5 ŽP\nMONTAT 255 40 18 225 45 18 MICHELIN	2026-04-09 13:11:38.030192+00	232.00	f	\N	2026-04-09 13:15:09.968441+00	CARD	\N	497	ASC-D	683		0		0	\N	2
894	2	DJ30DDR	\N	\N	2026-04-09 11:32:12.918992+00	100.00	f	\N	2026-04-09 13:22:39.068165+00	CASH	\N	\N		0		0		0	\N	2
911	2	DL17VWM	\N	MICHELIN 235/60/18 SU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU GOODYEAR ULTRA GRIP 235/60/18	2026-04-09 13:17:47.08804+00	336.00	f	\N	2026-04-09 13:18:44.925348+00	CASH	\N	498	ASC-D	685		0		0	\N	2
899	2	DJ30TOB	\N	\N	2026-04-09 12:18:07.071804+00	1748.00	f	\N	2026-04-09 13:27:50.414317+00	CARD	\N	486	ASC-D	686		0		0	\N	2
912	2	B71RMA	\N	ANV CLIENT MICHELIN PRIMACY  4 215 60 17 MM 7 7 7 7PRESIUNE FATA SPATE 2,4 NM 120	2026-04-09 13:26:06.850431+00	176.00	f	\N	2026-04-09 13:30:21.41006+00	CASH	\N	500		0		0		0	\N	2
913	2	OT61AVS	\N	\N	2026-04-09 13:30:24.039172+00	270.00	f	\N	2026-04-09 13:36:09.1592+00	CASH	\N	499	ASC-D	687		0		0	\N	2
914	2	DJ66RUT	\N	\N	2026-04-09 13:48:18.446645+00	180.00	f	\N	2026-04-09 14:51:36.833122+00	CASH	\N	501	ASC-D	691		0		0	\N	2
1391	2	DJ70TIN	\N	\N	2026-04-21 09:00:29.919961+00	1196.00	f	\N	2026-04-21 09:43:15.923603+00	CARD	\N	948	ASC-D	1032		0		0	\N	2
915	2	DJ28BYM	\N	CONTINENTAL 275/35/20 2BUC 245/40/20 2BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV CONTINENTAL WINTERCONTACT 275/40/19 2BUC 245/40/19/2BUC SE SCHIMBA NUMARU DE MASINA DJ08890CU DJ28BYM	2026-04-09 13:58:51.334929+00	344.00	f	\N	2026-04-09 14:01:33.425976+00	CARD	\N	502	ASC-D	688		0		0	\N	2
1260	2	DJ33GPC	\N	ANV CLIENT CONTI SPORT CONTACT 5 235 50 18 MM 7 7 6 6 PRESIUNE FATA SPATE 2,4 NM 120 ANVELOPE  VECHI DOT 2018 BATAIE RADIALA AXA SPATE	2026-04-20 07:10:08.081562+00	96.00	f	\N	2026-04-20 07:13:59.782475+00	OP	\N	826	ASC-D	936		0		0	\N	2
1352	2	OT10KPY	\N	\N	2026-04-21 05:52:09.074681+00	180.00	f	\N	2026-04-21 05:59:34.444714+00	CASH	\N	911	ASC-D	993		0		0	\N	2
1511	2	B121PEV	\N	\N	2026-04-22 11:52:43.034944+00	132.00	f	\N	2026-04-22 11:53:45.533143+00	OP	\N	1060	ASC-D	1126		0		0	\N	2
1353	2	DJ07UNF	\N	\N	2026-04-21 05:59:25.373323+00	136.00	f	\N	2026-04-21 06:01:53.804019+00	CASH	\N	912	ASC-D	994		0		0	\N	2
1261	2	B108RTT	\N	ANVELOPE CLIENT GOODYEAR EFICI. 205/60/16 6MM	2026-04-20 07:19:40.750967+00	156.00	f	\N	2026-04-20 07:20:45.621085+00	CARD	\N	827	ASC-D	937		0		0	\N	2
1289	2	DJ88MYH	\N	ANV CLIENT RIKEN ROAD 175 65 14 MM 88	2026-04-20 09:53:18.212515+00	58.00	f	\N	2026-04-20 09:54:02.800875+00	CASH	\N	852		0		0		0	\N	2
1587	2	B06TFR	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ  4 CAPACE MICHELIN PIL ALP 5 SUV 235 50 20 DOT 4225 MM 6	2026-04-23 11:41:45.142791+00	320.00	f	\N	2026-04-23 11:42:27.595229+00	CARD	\N	1132	ASC-D	1186		0		0	\N	2
1406	2	DJ97NAT	\N	4 ANVELOPE MICHELIN 205 50 17 DOT 34 18 MM4	2026-04-21 09:56:37.408034+00	316.00	f	\N	2026-04-21 09:58:50.295267+00	CARD	\N	959	ASC-D	1036		0		0	\N	2
1291	2	DJ54SEA	\N	CUSTODIE 4 ANV HANKOOK WINTER 255 45 20 DOT 2422 MM 5\nMONTAT KUMHO 255 45 20	2026-04-20 10:16:30.149364+00	434.00	f	\N	2026-04-20 10:17:12.680201+00	CASH	\N	855	ASC-D	951		0		0	\N	2
1354	2	DJ97BAU	\N	CUSTODIE 4 ANV PIRELLI SNOW 205 55 16 DOT 4219 MM5\nMONTAT MICHELIN 205 55 16	2026-04-21 06:01:56.725912+00	256.00	f	\N	2026-04-21 06:02:23.804808+00	CASH	\N	914	ASC-D	995		0		0	\N	2
1294	2	B707FRT	\N	\N	2026-04-20 10:30:11.04273+00	316.00	f	\N	2026-04-20 10:31:06.293091+00	OP	\N	858	ASC-D	953		0		0	\N	2
1312	2	DJ23ZLG	\N	\N	2026-04-20 11:55:24.582028+00	120.00	f	\N	2026-04-20 12:02:04.091819+00	CASH	\N	872		0		0		0	\N	2
1313	2	DJ06AVZ	\N	\N	2026-04-20 11:58:53.586602+00	1076.00	f	\N	2026-04-20 12:03:37.314431+00	CARD	\N	874	ASC-D	966		0		0	\N	2
1469	2	DJ22FKJ	\N	\N	2026-04-22 07:24:40.869226+00	392.00	f	\N	2026-04-22 07:29:03.95972+00	CARD	\N	1017	ASC-D	1084		0		0	\N	2
1355	2	DJ07MXO	\N	\N	2026-04-21 06:14:50.072901+00	180.00	f	\N	2026-04-21 06:18:56.460329+00	CASH	\N	916		0		0		0	\N	2
1316	2	DJ65AGM	\N	TIGAR WINTER 215/60/16 4MM DOT=3416 ( CUSTODIE 4 ANVELOPE,4JANTE ALIAJ,4 CAPACE)\n\nVIKING 215/55/17 6MM	2026-04-20 12:15:49.760485+00	286.00	f	\N	2026-04-20 12:17:09.072537+00	CARD	\N	876	ASC-D	969		0		0	\N	2
1392	2	B716DAB	\N	\N	2026-04-21 09:01:19.139208+00	268.00	f	\N	2026-04-21 11:23:40.857392+00	OP	\N	946	ASC-D	1043		0		0	\N	2
1303	2	DJ17ASL	\N	\N	2026-04-20 11:02:54.712971+00	3052.00	f	\N	2026-04-20 12:27:57.875189+00	CARD	\N	875	ASC-D	971		0		0	\N	2
1383	2	B881WTW	\N	ANVELOPE CLIENT \nYOKOHAMA 235/55/19 6MM	2026-04-21 08:26:42.85447+00	132.00	f	\N	2026-04-21 08:27:16.617867+00	CASH	\N	941	ASC-D	1018		0		0	\N	2
1322	2	DJ25CSN	\N	\N	2026-04-20 12:47:27.575539+00	374.00	f	\N	2026-04-20 12:52:17.845842+00	OP	\N	881	ASC-D	972		0		0	\N	2
1396	2	DJ22FAG	\N	ANV CLIENT MICHELIN PRIMACY 5 215 60 17 MM 7 7 7 7 PRESIUNE FATA SPATE 2,3 NM 120	2026-04-21 09:10:51.901888+00	188.00	f	\N	2026-04-21 11:33:56.129281+00	CASH	\N	952	ASC-D	1025		0		0	\N	2
1387	2	DJ06XOJ	\N	ROTI COMPLETE CLIENT TIGAR 195/65/15 4BUC SAU MONTAT	2026-04-21 08:33:22.199552+00	76.00	f	\N	2026-04-21 08:33:52.704798+00	CARD	\N	944		0		0		0	\N	2
1345	2	DJ04TNX	\N	\N	2026-04-20 14:21:00.51933+00	96.00	f	\N	2026-04-20 14:32:17.601477+00	CASH	\N	905	ASC-D	990		0		0	\N	2
1292	2	DJ90LDO	\N	\N	2026-04-20 10:16:51.235983+00	120.00	f	\N	2026-04-20 14:48:05.527719+00	CASH	\N	856		0		0		0	\N	2
1585	2	DJ59LNA	\N	GOODYEAR 235/55/18 4ANV SAU MONTAT\nCUSTODIE RIKEN SUV SNOW 235/55/18 DOT3525 7MM 4ANV	2026-04-23 11:34:38.357865+00	316.00	f	\N	2026-04-23 11:35:11.723719+00	CARD	\N	1130	ASC-D	1185		0		0	\N	2
1388	2	IF14VWZ	\N	ANV CLIENT DEBICA PRESTTO 185 65 15 MM 7 7 5 5 PRESIUNE FATA SPATE 2,4 NM 110	2026-04-21 08:42:52.23165+00	132.00	f	\N	2026-04-21 08:44:49.676698+00	CASH	\N	945	ASC-D	1021		0		0	\N	2
1512	2	B477KRS	\N	CUSTODIE ANV NOKIAN WR SNOWPROOF 225 50 18   MM 6 6 5 5 DOT 3024\nANV MONTATE CONTI PREMIUM CONTACT 225 50 18 MM 5 5 6 6 PRESIUNE FATA SPATE  2,4 NM 140	2026-04-22 11:53:36.183995+00	308.00	f	\N	2026-04-22 11:58:04.761822+00	CARD	\N	\N	ASC-D	1127		0		0	\N	2
1489	2	GJ37MRC	\N	\N	2026-04-22 09:26:19.403355+00	410.00	f	\N	2026-04-22 09:29:30.545448+00	CARD	\N	1038		0		0		0	\N	2
1422	2	DJ89KIM	\N	\N	2026-04-21 11:44:19.035939+00	2084.00	f	\N	2026-04-21 12:08:47.76723+00	OP	\N	977	ASC-D	1054		0		0	\N	2
1549	2	DJ05AZA	\N	ANV  CLIENT MICHELIN PILOT SPORT 265 35 21 PIRELLI PZ4 265 35 21 MM                                  4 4 7 7 PRESIUNE FATA BSPATE   2,9 NM 160	2026-04-23 06:51:18.554788+00	544.00	f	\N	2026-04-23 06:53:23.146329+00	CARD	\N	1094	ASC-D	1155		0		0	\N	2
1490	2	DJ66ECO	\N	205 75 16C MICHELIN	2026-04-22 09:30:25.22744+00	192.00	f	\N	2026-04-22 09:31:20.775093+00	OP	\N	1039	ASC-D	1106		0		0	\N	2
1434	2	B2275ELM	\N	\N	2026-04-21 12:18:58.888725+00	136.00	f	\N	2026-04-21 12:22:04.869092+00	OP	\N	983		0		0		0	\N	2
1532	2	B313NPC	\N	\N	2026-04-22 14:04:03.781294+00	224.00	f	\N	2026-04-22 14:04:55.546761+00	CARD	\N	1080		0		0		0	\N	2
1497	2	DJ38ECL	\N	ANV MONTATE  CONTI ECO CONTACT 6    205 60 16 MM 7 7 7 7 PRESIUNE FATA SPATE 3,0 N,M 120\nCUSTODIE ANV MICHELIN ALPIN 7 205 60 16 MM 7 7 7 7   DOT 3124	2026-04-22 10:14:14.477616+00	256.00	f	\N	2026-04-22 10:17:27.457955+00	CARD	\N	1046	ASC-D	1112		0		0	\N	2
1429	2	OT12MSM	\N	\N	2026-04-21 12:01:55.076066+00	2664.00	f	\N	2026-04-21 13:15:03.611189+00	CASH	\N	993	ASC-D	1063		0		0	\N	2
1449	2	DJ14ALV	\N	\N	2026-04-21 14:06:31.912862+00	136.00	f	\N	2026-04-21 14:08:38.438234+00	CASH	\N	999	ASC-D	1068		0		0	\N	2
1568	2	DJ88UMF	\N	\N	2026-04-23 09:26:14.767412+00	96.00	f	\N	2026-04-23 09:26:53.632367+00	CARD	\N	1113		0		0		0	\N	2
1547	2	OT75NMA	\N	\N	2026-04-23 06:43:23.303705+00	250.00	f	\N	2026-04-23 06:47:10.945396+00	CARD	\N	1093	ASC-D	1154		0		0	\N	2
1592	2	DJ67WFX	\N	ANVELOPE CLIENT \nTIGAR SUMMER 235/45/18 8MM 2,3 BARI	2026-04-23 12:26:00.683336+00	216.00	f	\N	2026-04-23 12:32:02.037429+00	CASH	\N	1138	ASC-D	1190		0		0	\N	2
1603	2	DJ99NRM	\N	235 40 18 KUMHO	2026-04-23 13:59:06.624528+00	312.00	f	\N	2026-04-23 13:59:59.160048+00	CARD	\N	1148	ASC-D	1202		0		0	\N	2
1584	2	B24ZKK	\N	\N	2026-04-23 11:34:12.802406+00	696.00	f	\N	2026-04-23 13:14:46.501637+00	OP	\N	1134	ASC-D	1196		0		0	\N	2
1641	2	DJ66AEA	\N	ANVELOPE CLIENT\nGOODYEAR 205/60/16 4-6 MM	2026-04-24 08:42:01.684982+00	144.00	f	\N	2026-04-24 08:44:07.109131+00	CASH	\N	1180		0		0		0	\N	2
1642	2	DJ85DES	\N	4 ANVELOPE 4 JANTE  ALIAJ 4 CAPACE NOKIAN 175\\65\\15 DOT 45 14 MM 3	2026-04-24 08:44:17.55093+00	214.00	f	\N	2026-04-24 08:50:05.242137+00	CASH	\N	1182	ASC-D	1232		0		0	\N	2
1648	2	DJ33AMT	\N	4 JANTE ALIAJ 4 ANVELOPE MICHELIN 255\\50\\19 MM 4 DOT 20 18	2026-04-24 09:30:15.203737+00	320.00	f	\N	2026-04-24 10:05:50.63046+00	CARD	\N	1188	ASC-D	1238		0		0	\N	2
1627	2	DJ10SPO	\N	\N	2026-04-24 07:24:43.345681+00	500.00	f	\N	2026-04-24 09:57:06.986461+00	CARD	\N	1193	ASC-D	1220		0		0	\N	2
1649	2	B110BUI	\N	\N	2026-04-24 09:31:34.040791+00	2040.00	f	\N	2026-04-24 10:46:51.61344+00	CARD	\N	1189	ASC-D	1243		0		0	\N	2
1658	2	DJ89NBA	\N	\N	2026-04-24 10:31:35.242106+00	250.00	f	\N	2026-04-24 10:39:20.568191+00	CARD	\N	1199		0		0		0	\N	2
1673	2	B72DIA	\N	CUSTODIE 4 ANV NOKIAN TIRES SNOW 205 65 16 DOT 1923 MM 6	2026-04-24 12:10:44.782286+00	268.00	f	\N	2026-04-24 12:45:57.101247+00	CARD	\N	1212		0		0		0	\N	2
916	2	PH25CCZ	\N	\N	2026-04-09 14:01:51.288091+00	72.00	f	\N	2026-04-09 14:03:40.140722+00	OP	\N	503	ASC-D	689		0		0	\N	2
935	2	DJ97MSA	\N	CONTINENTAL 235/55/18 4BUC\nCUSTODIE KUMHO WINTERCRAFT 235/55/18 DOT1923 5MM 4BUC	2026-04-14 09:50:56.481245+00	316.00	f	\N	2026-04-14 09:54:15.908213+00	CARD	\N	521	ASC-D	704		0		0	\N	2
917	2	DJ13XEN	\N	ANV CUSTODIE MICHELIN ALPIN 7  215 55 17 MM 6 6 6 6  DOT 3324\nANV MONTATE 215 55 17 MICHELIN PRIMACY 5 MM 7 7 7 7 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-09 14:03:09.504061+00	308.00	f	\N	2026-04-09 14:11:07.561779+00	OP	\N	504	ASC-D	690		0		0	\N	2
954	2	DJ11SVM	\N	4 ANVELOPE DOT 3323 BRIGERSTONE MM6	2026-04-14 11:39:46.17433+00	374.00	f	\N	2026-04-14 11:41:39.059535+00	CARD	\N	540	ASC-D	721		0		0	\N	2
928	2	DJ27GMG	\N	ANV MONTATE CONTI ECO CONTACT 6 MM 6 6 7 7PRESIUNE FATA SPATE 2,4 NM 120 \nCUSTODIE  ANV PIRELLI SCORPION WINTER 215 65  17 DOT 2623 MM 7 7 7 7	2026-04-14 08:40:20.957444+00	316.00	f	\N	2026-04-14 08:41:40.704645+00	CARD	\N	515	ASC-D	699		0		0	\N	2
920	2	DJ13MBT	\N	ANVELOPE CLIENT BRIDGESTONE 205/55/16 2,5 BARI 7MM	2026-04-14 07:06:48.711965+00	136.00	f	\N	2026-04-14 07:08:02.324552+00	CASH	\N	506	ASC-D	692		0		0	\N	2
940	2	DJ54BIL	\N	CUSTODIE NOUA 4 ANV TIGAR WINTER 205 55 16 DOT 4219 MM 5	2026-04-14 10:15:41.887099+00	256.00	f	\N	2026-04-14 10:37:23.15715+00	CARD	\N	525	ASC-D	710		0		0	\N	2
929	2	DJ60XBX	\N	ANVELOPE CLIENT HANKOOK 245/45/18 6MM	2026-04-14 08:40:43.147002+00	528.00	f	\N	2026-04-14 08:44:02.387896+00	CARD	\N	516	ASC-D	700		0		0	\N	2
918	2	DJ77HKZ	\N	\N	2026-04-14 05:49:35.05387+00	300.00	f	\N	2026-04-14 07:08:51.428054+00	CARD	\N	505	ASC-D	693		0		0	\N	2
949	2	B10POM	\N	\N	2026-04-14 11:11:25.96108+00	84.00	f	\N	2026-04-14 11:13:25.713048+00	CASH	\N	535	ASC-D	715		0		0	\N	2
938	2	B15PBP	\N	\N	2026-04-14 09:54:49.171256+00	584.00	f	\N	2026-04-14 09:57:03.19048+00	CARD	\N	523	ASC-D	705		0		0	\N	2
919	2	DJ07UAU	\N	\N	2026-04-14 06:33:07.646365+00	1096.00	f	\N	2026-04-14 07:16:37.415573+00	CARD	\N	507	ASC-D	694		0		0	\N	2
951	2	DJ24VFE	\N	ROTI COMPLETE CLIENT MICHELIN 235/55/19	2026-04-14 11:35:04.769243+00	120.00	f	\N	2026-04-14 11:37:57.133884+00	CARD	\N	537	ASC-D	719		0		0	\N	2
930	2	DJ81RNY	\N	\N	2026-04-14 09:03:15.674177+00	188.00	f	\N	2026-04-14 09:04:22.082051+00	CASH	\N	517	ASC-D	701		0		0	\N	2
922	2	DJ22JUS	\N	CONTINENTAL 205/55/16 6MM 2,3 BARI \n\nMICHELIN CROSSCLIMATE 205/60/16 6MM DOT=2724 ( CUSTODIE 4 ANVELOPE,4 JANTE OTEL )	2026-04-14 07:52:00.510085+00	346.00	f	\N	2026-04-14 07:54:09.515502+00	CARD	\N	509	ASC-D	695		0		0	\N	2
923	2	DJ19ABS	\N	\N	2026-04-14 07:59:36.625636+00	96.00	f	\N	2026-04-15 06:03:25.497782+00	CASH	\N	510	ASC-D	696		0		0	\N	2
946	2	DJ33WBX	\N	ANV  CLIENT HANKOOK VENTUS 225 35 19 255  30 19 MM 7 7 7 7 PRESIUNE FATA SPATE 2,5  NM 140 JANTE OVALIZATE NU SE INDREAPTA NU VREA  CLIENTUL	2026-04-14 10:53:51.247271+00	104.00	f	\N	2026-04-14 10:54:23.539867+00	CARD	\N	531		0		0		0	\N	2
924	2	DJ92BTY	\N	CUSTODIE ANV RIKEN SNOE 205 65 16 MM 7 7 7 7 DOT 3225 \nANV MONTATE FALKEN ZIEX 205 65 16 PRESIUNE FATA SPATE  2,4 NM 110	2026-04-14 08:00:53.891235+00	256.00	f	\N	2026-04-14 08:02:03.234756+00	CARD	\N	511	ASC-D	697		0		0	\N	2
925	2	DJ23MDG	\N	NOKIAN 245 45 18	2026-04-14 08:05:43.668285+00	96.00	f	\N	2026-04-14 08:07:15.622397+00	CASH	\N	512		0		0		0	\N	2
943	2	DJ06XDA	\N	CUSTODIE NOUA 4 ANV 4 JANTE OTEL MICHELIN ALP 5 195 55 16 DOT 4918 MM 5	2026-04-14 10:36:43.294555+00	226.00	f	\N	2026-04-14 10:38:17.015785+00	CARD	\N	528	ASC-D	711		0		0	\N	2
939	2	DJ19AAL	\N	ANV CLIENT MICHELIN PRIMACY4 225/55/18 5MM	2026-04-14 10:13:28.355407+00	188.00	f	\N	2026-04-14 10:15:01.142771+00	CARD	\N	524	ASC-D	706		0		0	\N	2
926	2	DJ77CNW	\N	\N	2026-04-14 08:08:09.098648+00	1068.00	f	\N	2026-04-14 08:33:09.475992+00	OP	\N	513	ASC-D	698		0		0	\N	2
933	2	DJ03CSS	\N	ANVELOPE CLIENT PIRELI PZERO 275/35/19 2BUC\n  PIRELI PZERO 245/40/19 2BUC 2,4 BARI	2026-04-14 09:38:36.063958+00	236.00	f	\N	2026-04-14 09:39:17.736802+00	CARD	\N	519	ASC-D	702		0		0	\N	2
927	2	DJ70AXG	\N	\N	2026-04-14 08:33:40.086336+00	176.00	f	\N	2026-04-14 08:35:33.898178+00	CARD	\N	514		0		0		0	\N	2
948	2	DJ27KRA	\N	\N	2026-04-14 11:10:44.996127+00	60.00	f	\N	2026-04-14 11:14:34.420609+00	CASH	\N	534	ASC-D	716		0		0	\N	2
962	2	B127VGL	\N	4 ANVELOPE 245 45 19 DOT 33 25 MM 7 KUMHO 275 40 19 DOT 21 24 MM 7	2026-04-14 13:07:32.504731+00	346.00	f	\N	2026-04-14 13:11:58.754527+00	CARD	\N	547	ASC-D	732		0		0	\N	2
932	2	B283MTH	\N	CUSTODIE 4 ANV 4JANTEALIAJ MICHELIN PIL ALP 5 245 50 19 DOT 4322 MM 5	2026-04-14 09:27:48.416232+00	360.00	f	\N	2026-04-14 10:16:15.546493+00	CARD	\N	518	ASC-D	707		0		0	\N	2
931	2	DJ96FLX	\N	PRESIUNE FTAT SPATE 2,5 NM 120	2026-04-14 09:19:10.160709+00	2880.00	f	\N	2026-04-14 09:51:09.03647+00	OP	\N	520	ASC-D	703		0		0	\N	2
947	2	DJ88HIT	\N	CUSTODIE 4 ANV 4JANTE OTEL RIKEN SNOW 205 55 16 DOT 3524 MM6	2026-04-14 10:59:13.179656+00	226.00	f	\N	2026-04-14 10:59:49.487179+00	CASH	\N	532	ASC-D	714		0		0	\N	2
934	2	DJ10XSA	\N	NOKIAN 4 JANTE ALIAJ DOT 43 19 MM 4 205 50 17  4 ANVELOPE	2026-04-14 09:40:41.054831+00	310.00	f	\N	2026-04-14 11:26:01.61809+00	CASH	\N	\N	ASC-D	717		0		0	\N	2
942	2	B969VDA	\N	ANV  CLIENT 234 45 18  PIRELLI POWERGRYN  MM 8 8 8 8 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-14 10:21:27.169291+00	168.00	f	\N	2026-04-14 10:35:00.813122+00	CASH	\N	527	ASC-D	708		0		0	\N	2
921	2	OT50WOU	\N	\N	2026-04-14 07:27:25.514735+00	0.00	f	\N	2026-04-14 11:01:01.166394+00	OP	\N	508		0		0		0	\N	2
937	2	VL14XCX	\N	\N	2026-04-14 09:52:22.068699+00	1400.00	f	\N	2026-04-14 11:06:53.27912+00	OP	\N	522	ASC-D	709		0		0	\N	2
953	2	B234JCB	\N	ANV CLIENT GITI SYNERGY 225 55 17 MM 7 7 7 7 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-14 11:38:49.253467+00	176.00	f	\N	2026-04-14 11:46:01.347831+00	CARD	\N	538	ASC-D	720		0		0	\N	2
944	2	B233MIK	\N	MICHELIN 225/50/19 4BUC\nCUSTODIE 4ANV GOODYEAR ULTRAGRIP 225/50/19 DOT4324 6MM	2026-04-14 10:40:18.280596+00	374.00	f	\N	2026-04-14 10:50:20.632176+00	CARD	\N	529	ASC-D	712		0		0	\N	2
945	2	DJ98XMI	\N	\N	2026-04-14 10:45:16.907333+00	76.00	f	\N	2026-04-14 10:50:32.761583+00	CARD	\N	530	ASC-D	713		0		0	\N	2
950	2	B403EEA	\N	\N	2026-04-14 11:26:59.398941+00	160.00	f	\N	2026-04-14 12:40:32.402071+00	OP	\N	536	ASC-D	729		0		0	\N	2
958	2	DJ50DDM	\N	ANV CLIENT BRIDGESTONE 225/65/17 4BUC	2026-04-14 12:08:14.433557+00	176.00	f	\N	2026-04-14 12:23:34.292202+00	CARD	\N	543	ASC-D	726		0		0	\N	2
936	2	DJ55GRS	\N	\N	2026-04-14 09:52:19.162177+00	2152.00	f	\N	2026-04-14 11:36:00.994332+00	OP	\N	533	ASC-D	718		0		0	\N	2
956	2	DJ30DIA	\N	\N	2026-04-14 11:52:28.33961+00	168.00	f	\N	2026-04-14 11:53:50.084181+00	CARD	\N	542	ASC-D	723		0		0	\N	2
960	2	DJ81FRT	\N	FALKEN 205/65/16 4BUC\nCUSTODIE 4ANV KUMHO WINTERCRAFT 205/65/16 DOT1523 5MM 4BUC	2026-04-14 12:31:08.55335+00	268.00	f	\N	2026-04-14 12:31:56.038914+00	OP	\N	546	ASC-D	728		0		0	\N	2
955	2	B222DGE	\N	\N	2026-04-14 11:51:06.495295+00	200.00	f	\N	2026-04-14 11:52:23.247321+00	CARD	\N	541	ASC-D	722		0		0	\N	2
952	2	DJ99JSS	\N	PRESIUNE 2.3 FATA SPATE NM 120	2026-04-14 11:38:45.591804+00	1216.00	f	\N	2026-04-14 12:48:45.481592+00	CARD	\N	539	ASC-D	730		0		0	\N	2
941	2	DJ83DME	\N	\N	2026-04-14 10:20:39.879169+00	2886.00	f	\N	2026-04-14 12:48:09.917483+00	CARD	\N	526	ASC-D	724		0		0	\N	2
959	2	DJ45CPD	\N	\N	2026-04-14 12:19:16.617807+00	72.00	f	\N	2026-04-14 12:22:14.411064+00	CASH	\N	545	ASC-D	727		0		0	\N	2
957	2	B311JJJ	\N	255 50 19 MICHELIN	2026-04-14 12:08:00.705924+00	264.00	f	\N	2026-04-14 12:24:03.952105+00	CARD	\N	544	ASC-D	725		0		0	\N	2
961	2	DJ09EWY	\N	ANV CLIENT MICHELIN PRIMACY 5 215/60/17 8MM	2026-04-14 12:52:09.165223+00	240.00	f	\N	2026-04-14 12:54:13.111777+00	CASH	\N	548	ASC-D	731		0		0	\N	2
1263	2	DJ44GBX	\N	\N	2026-04-20 07:24:02.396811+00	1480.00	f	\N	2026-04-20 08:48:46.328686+00	CASH	\N	841	ASC-D	944		0		0	\N	2
964	2	DJ09SID	\N	ANV CLIENT MOTRIO 205/55/16	2026-04-14 13:18:16.664907+00	76.00	f	\N	2026-04-14 13:20:36.320128+00	CARD	\N	549		0		0		0	\N	2
965	2	DJ24MXT	\N	ANV CLIENT HANKOOK 255/45/20 4BUC	2026-04-14 13:20:08.769321+00	224.00	f	\N	2026-04-14 13:21:30.926888+00	CARD	\N	550	ASC-D	733		0		0	\N	2
987	2	OT10POP	\N	ANV MONTATE MICHELIN PILOT SPORT 4 SUV 235 55 20 MM 7 7 7 7 PRESIUNE FATA SPATE 2,5 MN 120 \nCUSTODIE ANV JANTE CAPACE  MICHELIN  PILOT ALPIN  5 SUV MM 7 7 7 7 235 55 20	2026-04-15 07:07:50.313212+00	1320.00	f	\N	2026-04-15 07:13:39.207806+00	OP	\N	572	ASC-D	751		0		0	\N	2
967	2	DJ86GBR	\N	225 45 17 KUMHO	2026-04-14 13:48:00.16123+00	168.00	f	\N	2026-04-14 13:51:48.081174+00	CARD	\N	552	ASC-D	735		0		0	\N	2
963	2	DJ21UBU	\N	\N	2026-04-14 13:12:47.195708+00	1076.00	f	\N	2026-04-14 13:55:58.731739+00	CASH	\N	551	ASC-D	734		0		0	\N	2
966	2	OT95TOY	\N	\N	2026-04-14 13:24:27.052989+00	196.00	f	\N	2026-04-14 13:57:42.209865+00	CARD	\N	553		0		0		0	\N	2
978	2	DJ44LDE	\N	CONTINENTAL 215/65/16 4BUC\nCUSTODIE 4JANTE OTEL+4ANV BRIDGESTONE BLIZZAK 215/65/16 DOT4520 6MM	2026-04-15 06:14:02.919672+00	222.00	f	\N	2026-04-15 06:14:51.537481+00	CARD	\N	564	ASC-D	744		0		0	\N	2
969	2	DJ98APM	\N	ANV MONTATE CLIENT 255 45 20 PIRELI WINTER	2026-04-14 13:59:48.042047+00	172.00	f	\N	2026-04-14 14:00:22.088017+00	CARD	\N	554	ASC-D	736		0		0	\N	2
968	2	OT23PWG	\N	ANV CLIENT SAILUN 275 40 18 MM 8 8 PRESIUNE FATA SPATE 2,5 NM 140	2026-04-14 13:53:30.372296+00	1088.00	f	\N	2026-04-14 14:04:16.256239+00	CARD	\N	555	ASC-D	737		0		0	\N	2
1000	2	DJ96KAM	\N	\N	2026-04-15 08:17:26.842194+00	136.00	f	\N	2026-04-15 08:21:38.544644+00	CARD	\N	582	ASC-D	764		0		0	\N	2
977	2	DJ73MLS	\N	\N	2026-04-15 06:10:38.783108+00	1036.00	f	\N	2026-04-15 07:19:58.186516+00	OP	\N	573	ASC-D	752		0		0	\N	2
971	2	DJ20NMN	\N	PIRELI 225/50/17 MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU PIRELLI WINTER 2 205/60/16 DOT 3923 6MM	2026-04-15 05:45:21.065384+00	246.00	f	\N	2026-04-15 05:46:05.135845+00	CARD	\N	558	ASC-D	738		0		0	\N	2
979	2	DJ69WSW	\N	4 ANVELOPE 26 20 MM 6 205 60 16 KUMHO	2026-04-15 06:15:48.402319+00	256.00	f	\N	2026-04-15 06:18:05.65535+00	CARD	\N	562	ASC-D	745		0		0	\N	2
972	2	DJ98AUM	\N	\N	2026-04-15 05:46:35.282807+00	168.00	f	\N	2026-04-15 05:49:36.413112+00	CARD	\N	556		0		0		0	\N	2
980	2	DJ42ERY	\N	\N	2026-04-15 06:16:35.014609+00	340.00	f	\N	2026-04-15 06:23:22.821302+00	CASH	\N	565	ASC-D	746		0		0	\N	2
973	2	DJ99MRC	\N	MIC ALPIN5 205/60/16 MM5 DOT2217  2BUC     MIC ALPIN6  205/60/16  MM6  DOT 2522   2 BUC	2026-04-15 05:49:13.528452+00	256.00	f	\N	2026-04-15 05:50:49.230947+00	CASH	\N	559	ASC-D	739		0		0	\N	2
993	2	DJ09FPE	\N	CUSTODIE 4 ANV 4 JANTE OTEL 4 CAPACE KUMHO WINTER 195 65 15 DOT 2423 MM 6\nMONTAT RIKEN 205 55 16	2026-04-15 07:40:16.173834+00	226.00	f	\N	2026-04-15 07:41:48.671082+00	CARD	\N	579	ASC-D	757		0		0	\N	2
974	2	DJ66BAU	\N	ANV CLIENT MICHELIN AGILIS 235 65 16C MM 7 7 7 7 PRESIUNE FATA SPATE 4,5 NM 180	2026-04-15 05:53:54.336847+00	216.00	f	\N	2026-04-15 05:55:22.784077+00	CARD	\N	560	ASC-D	740		0		0	\N	2
970	2	DJ79GYC	\N	\N	2026-04-15 05:42:09.923559+00	418.00	f	\N	2026-04-15 06:00:07.325943+00	CASH	\N	557	ASC-D	741		0		0	\N	2
981	2	B98RPE	\N	HANKOOK 205 60 16	2026-04-15 06:28:01.586553+00	76.00	f	\N	2026-04-15 06:28:47.603118+00	CARD	\N	566	ASC-D	747		0		0	\N	2
975	2	DJ17AIP	\N	ANVEPOPELE NU MAI RAMAN IN CUSTODIE	2026-04-15 05:59:12.304673+00	176.00	f	\N	2026-04-15 06:03:46.839472+00	CASH	\N	561	ASC-D	742		0		0	\N	2
982	2	DJ08TCM	\N	\N	2026-04-15 06:28:41.053281+00	120.00	f	\N	2026-04-15 06:29:59.17936+00	OP	\N	567	ASC-D	748		0		0	\N	2
976	2	DJ32MDE	\N	CUSTODIE NOUA 4 ANV PIRELLI SCORPION WINTER RSC 315 35 21 BUC 2 275 40 21 BUC 2 DOT 4125 MM 6	2026-04-15 06:04:21.448893+00	438.00	f	\N	2026-04-15 06:05:12.428554+00	CASH	\N	563	ASC-D	743		0		0	\N	2
997	2	B266MTC	\N	\N	2026-04-15 07:54:25.930925+00	136.00	f	\N	2026-04-15 08:00:16.889217+00	CARD	\N	577	ASC-D	761		0		0	\N	2
988	2	DJ70ABM	\N	\N	2026-04-15 07:22:50.266719+00	176.00	f	\N	2026-04-15 07:28:38.492695+00	CARD	\N	570	ASC-D	753		0		0	\N	2
1004	2	OT77AXY	\N	\N	2026-04-15 09:00:53.017694+00	320.00	f	\N	2026-04-15 09:04:28.936516+00	OP	\N	588	ASC-D	767		0		0	\N	2
984	2	DJ45DGM	\N	\N	2026-04-15 06:34:29.458572+00	120.00	f	\N	2026-04-15 06:35:17.365879+00	CARD	\N	569	ASC-D	749		0		0	\N	2
989	2	DJ86CCS	\N	\N	2026-04-15 07:26:32.886341+00	150.00	f	\N	2026-04-15 07:29:03.7999+00	CASH	\N	574	ASC-D	754		0		0	\N	2
985	2	DJ23LTZ	\N	\N	2026-04-15 06:59:27.260275+00	168.00	f	\N	2026-04-15 07:02:44.950872+00	CARD	\N	571	ASC-D	750		0		0	\N	2
994	2	B246SCH	\N	\N	2026-04-15 07:43:52.868046+00	7400.00	f	\N	2026-04-15 09:04:57.181491+00	OP	\N	\N	ASC-D	768		0		0	\N	2
992	2	DJ07AMK	\N	\N	2026-04-15 07:38:33.204293+00	104.00	f	\N	2026-04-15 07:46:23.762424+00	CARD	\N	578	ASC-D	758		0		0	\N	2
990	2	DJ21WKS	\N	DUNLOP 225/60/18 MONTATE\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU KUMHO WINTERCRAFT DOT1925 6MM	2026-04-15 07:29:49.018219+00	256.00	f	\N	2026-04-15 07:30:38.816713+00	CARD	\N	575	ASC-D	755		0		0	\N	2
1001	2	HPKL2004	\N	\N	2026-04-15 08:19:12.549142+00	2590.00	f	\N	2026-04-15 08:53:12.342112+00	CASH	\N	586	ASC-D	766		0		0	\N	2
983	2	DJ10NBI	\N	ANV CLIENT MICHELIN PRIMACY3 225 50 18 MM 4 4 4 4 PRESIUNE FATA SPATE 2,3 NM 120	2026-04-15 06:32:30.527465+00	188.00	f	\N	2026-04-15 07:49:56.704729+00	CARD	\N	568	ASC-D	759		0		0	\N	2
998	2	DJ15NSD	\N	ANV CLIENT CONTI ECO CONTACT 6 225 60  17 MM 4 4  44 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-15 08:12:35.650252+00	96.00	f	\N	2026-04-15 08:14:38.742877+00	CASH	\N	581	ASC-D	762		0		0	\N	2
991	2	DJ62SOF	\N	ANV CUSTODIE JANTE OTEL CAPACE RIKEN SNOW 215 60 16 4322 MM 6 6 6 6 \nANV MONTATE TIGAR UHP 235 45 18 MM 6 6 6 6 PRESIUNE FATA SPATE 2,4 NM  120	2026-04-15 07:37:37.901453+00	246.00	f	\N	2026-04-15 07:39:07.865558+00	CARD	\N	576	ASC-D	756		0		0	\N	2
996	2	DJ20DDV	\N	205/55/26 SEBRING SNOW MM4 DOT4019    4  ANV	2026-04-15 07:53:05.25678+00	256.00	f	\N	2026-04-15 07:53:58.380545+00	CASH	\N	580	ASC-D	760		0		0	\N	2
999	2	DJ44AAX	\N	\N	2026-04-15 08:17:23.91902+00	504.00	f	\N	2026-04-15 08:18:07.295211+00	CARD	\N	583	ASC-D	763		0		0	\N	2
986	2	DJ01VAE	\N	\N	2026-04-15 07:02:00.424464+00	1976.00	f	\N	2026-04-15 08:26:58.892341+00	CASH	\N	584	ASC-D	765		0		0	\N	2
1008	2	GJ66SND	\N	CUSTODIE ANV MICHELIN PILOT ALPIN 5 265 35 21 2 BUC MM 6 6 \nANV MONTATE MICHELIN PILOT SPORT 4S 265 35 21 MM 6 6 4 4 PRESIUNE FATA 2,8 SPATE 2,5 NM 150	2026-04-15 09:24:37.365679+00	924.00	f	\N	2026-04-15 09:47:18.520639+00	CARD	\N	592	ASC-D	774		0		0	\N	2
1003	2	DJ16ABC	\N	\N	2026-04-15 08:48:47.460191+00	176.00	f	\N	2026-04-15 08:51:06.62947+00	CARD	\N	585		0		0		0	\N	2
995	2	DJ09KTB	\N	\N	2026-04-15 07:44:26.3626+00	938.00	f	\N	2026-04-15 09:15:40.149226+00	CASH	\N	591	ASC-D	770		0		0	\N	2
1006	2	DJ68DRC	\N	235 60 18 PIRELLI	2026-04-15 09:12:12.014648+00	176.00	f	\N	2026-04-15 09:12:50.901413+00	CARD	\N	590	ASC-D	769		0		0	\N	2
1009	2	DJ05WMO	\N	PIRELLI 245 45 18	2026-04-15 09:34:01.860152+00	96.00	f	\N	2026-04-15 09:35:28.568692+00	CARD	\N	594	ASC-D	772		0		0	\N	2
1010	2	VL99AZG	\N	ANV CLIENT BRIDGESTONE 255/35/19 2BUC 225/40/19 2BUC	2026-04-15 09:34:53.931714+00	412.00	f	\N	2026-04-15 09:37:08.147682+00	CARD	\N	595	ASC-D	773		0		0	\N	2
1005	2	DJ22TAT	\N	\N	2026-04-15 09:02:10.665051+00	246.00	f	\N	2026-04-15 09:48:06.611046+00	CARD	\N	589	ASC-D	775		0		0	\N	2
1011	2	OT14CCP	\N	ANV MONTATE MICHELIN PILOT SPORT 5 245 45 19 MM 7 7 7 7  PRESIUNE FATA SPATE 2,8 NM 160 \\\nCUSTODIE ANV MICHELIN PILOT ALPIN 5 245 45 19 MM 4 4 5 5 DOT 3721	2026-04-15 09:50:39.522089+00	370.00	f	\N	2026-04-15 10:01:08.924696+00	OP	\N	596	ASC-D	777		0		0	\N	2
1002	2	DJ76NAT	\N	\N	2026-04-15 08:19:44.694217+00	2028.00	f	\N	2026-04-15 09:59:10.393323+00	CARD	\N	593	ASC-D	776		0		0	\N	2
1013	2	DJ90SCH	\N	245 45 19 CONTINENTAL	2026-04-15 10:11:43.876272+00	120.00	f	\N	2026-04-15 10:12:25.015971+00	CASH	\N	598	ASC-D	779		0		0	\N	2
1007	2	DJ18VLZ	\N	4 ANV MICHELIN 225 65 17 29 21 MM 5 4 JANTE ALIAJ 4 CAPACE	2026-04-15 09:16:34.721586+00	256.00	f	\N	2026-04-15 12:11:35.085316+00	CARD	\N	587	ASC-D	771		0		0	\N	2
1491	2	DJ16SJP	\N	\N	2026-04-22 09:33:41.596088+00	2980.00	f	\N	2026-04-22 10:20:43.252342+00	CARD	\N	1040	ASC-D	1113		0		0	\N	2
1012	2	DJ10RXA	\N	ROTI COMPLETE CLIENT MICHELIN 225/45/18 4BUC	2026-04-15 10:04:04.2695+00	96.00	f	\N	2026-04-15 10:04:43.657134+00	CARD	\N	597	ASC-D	778		0		0	\N	2
1026	2	DJ28CBS	\N	\N	2026-04-15 11:45:12.048144+00	136.00	f	\N	2026-04-15 11:45:57.814154+00	CASH	\N	607		0		0		0	\N	2
1014	2	B135RNV	\N	\N	2026-04-15 10:19:02.746521+00	104.00	f	\N	2026-04-15 10:19:58.39033+00	CARD	\N	599	ASC-D	780		0		0	\N	2
1057	2	B85CZS	\N	\N	2026-04-16 06:45:36.213394+00	132.00	f	\N	2026-04-16 06:53:29.474031+00	OP	\N	632	ASC-D	810		0		0	\N	2
1027	2	OT05BOR	\N	ANV CLIENT GOODYEAR 195/65/15	2026-04-15 11:53:50.368304+00	76.00	f	\N	2026-04-15 11:55:31.686006+00	CASH	\N	610		0		0		0	\N	2
1017	2	DJ91ANB	\N	ANV CLIENT CONTINENTAL CONTI PREMIUM CONTACT C 235 50 19       MM 8 8 8 8 PRESIUNE FATA SPATE 2,5 NM 130	2026-04-15 10:49:49.188464+00	260.00	f	\N	2026-04-15 10:51:15.826291+00	CASH	\N	600	ASC-D	781		0		0	\N	2
1015	2	B510MXB	\N	4 JANTE ALIAJ 4 ANVELOPE 225 45 18 BRIGESTONE DOT 01 24 MM 6	2026-04-15 10:42:22.658188+00	256.00	f	\N	2026-04-15 10:52:31.409427+00	OP	\N	\N	ASC-D	782		0		0	\N	2
1018	2	DJ04AKM	\N	\N	2026-04-15 10:51:13.025216+00	224.00	f	\N	2026-04-15 10:53:46.341909+00	CARD	\N	602	ASC-D	783		0		0	\N	2
1040	2	DJ84BNC	\N	\N	2026-04-15 13:35:24.933216+00	96.00	f	\N	2026-04-15 13:36:18.768785+00	CASH	\N	619		0		0		0	\N	2
1016	2	DJ77XZZ	\N	\N	2026-04-15 10:48:54.505103+00	3960.00	f	\N	2026-04-21 06:46:02.562193+00	CARD	\N	\N	ASC-D	784		0		0	\N	2
1019	2	B881RBL	\N	CUSTODIE 4 ANV MICH ALP 7 205 55 16 DOT 2924   MM7	2026-04-15 10:58:35.670707+00	256.00	f	\N	2026-04-15 11:00:29.807915+00	OP	\N	603	ASC-D	785		0		0	\N	2
1029	2	DJ79KKK	\N	\N	2026-04-15 12:14:00.281092+00	108.00	f	\N	2026-04-15 12:17:06.774317+00	CASH	\N	611	ASC-D	790		0		0	\N	2
1020	2	DJ60SHO	\N	HANKOOK 255/45/19 4BUC SAU MONTAT\nCUSTODIE 4ANV PIRELLI SOTTOZERO 3 255/45/19 DOT2723 6MM	2026-04-15 10:58:50.55795+00	374.00	f	\N	2026-04-15 11:01:12.861243+00	CARD	\N	604	ASC-D	786		0		0	\N	2
1050	2	DJ01CPK	\N	ANV CLIENT MICHELIN 245/50/19 4BUC	2026-04-16 06:00:51.530866+00	224.00	f	\N	2026-04-16 06:01:33.183176+00	CARD	\N	628		0		0		0	\N	2
1030	2	DJ72YDA	\N	\N	2026-04-15 12:16:23.540061+00	60.00	f	\N	2026-04-15 12:20:15.76515+00	CASH	\N	\N	ASC-D	791		0		0	\N	2
1021	2	DJ64JWH	\N	MICHELIN ALPIN 5 MM 4  DOT 3715  3 BUC 2216  1 BUC     4 ANV 4JANTE ALIAJ 4CAPACE CENTRU	2026-04-15 11:04:15.036243+00	226.00	f	\N	2026-04-15 11:05:38.104052+00	CARD	\N	605	ASC-D	787		0		0	\N	2
1053	2	DJ11DBZ	\N	ANVELOPE CLIENT BRIDGESTONE 225/45/17 6MM 2BUC\n   DUNLOP 225/45/17 5MM 2BUC	2026-04-16 06:08:22.654247+00	108.00	f	\N	2026-04-16 06:11:53.448783+00	CARD	\N	631	ASC-D	805		0		0	\N	2
1031	2	DJ28GIL	\N	\N	2026-04-15 12:22:42.695968+00	72.00	f	\N	2026-04-15 12:24:13.13833+00	CARD	\N	612		0		0		0	\N	2
1043	2	MH07XAO	\N	\N	2026-04-16 05:26:35.748213+00	740.00	f	\N	2026-04-16 05:38:41.151251+00	CASH	\N	623	ASC-D	801		0		0	\N	2
1023	2	DJ10NLE	\N	\N	2026-04-15 11:15:14.651619+00	160.00	f	\N	2026-04-15 11:17:59.413574+00	CARD	\N	601	ASC-D	788		0		0	\N	2
1032	2	DJ09UZT	\N	\N	2026-04-15 12:35:48.335866+00	1196.00	f	\N	2026-04-15 13:42:26.631182+00	CASH	\N	617	ASC-D	797		0		0	\N	2
1022	2	DJ37RDI	\N	\N	2026-04-15 11:10:00.320063+00	820.00	f	\N	2026-04-15 11:22:05.069665+00	CASH	\N	606	ASC-D	789		0		0	\N	2
1024	2	VL33TER	\N	ANV CLIENT DUNLOP GRANDTREC 265 60 18 MM 4 4  6 6 PRESIUNE 2,4 FATA SPATE NM 130	2026-04-15 11:27:27.378064+00	96.00	f	\N	2026-04-15 11:31:21.123361+00	CASH	\N	608		0		0		0	\N	2
1055	2	DJ82UMG	\N	\N	2026-04-16 06:28:04.171527+00	120.00	f	\N	2026-04-16 07:01:46.582594+00	CASH	\N	\N		0		0		0	\N	2
1034	2	DJ14TAT	\N	\N	2026-04-15 12:52:50.900613+00	76.00	f	\N	2026-04-15 12:53:41.216862+00	CASH	\N	614	ASC-D	793		0		0	\N	2
1039	2	DJ73KKK	\N	\N	2026-04-15 13:25:21.378135+00	520.00	f	\N	2026-04-15 13:48:54.424268+00	CASH	\N	\N	ASC-D	798		0		0	\N	2
1052	2	B121LRB	\N	\N	2026-04-16 06:04:40.58028+00	132.00	f	\N	2026-04-16 06:15:38.087582+00	CARD	\N	627	ASC-D	806		0		0	\N	2
1028	2	DJ01XEI	\N	HANKOOK 285 45 21	2026-04-15 11:58:16.105918+00	288.00	f	\N	2026-04-15 13:02:02.822238+00	CARD	\N	615	ASC-D	794		0		0	\N	2
1035	2	DJ77SFP	\N	\N	2026-04-15 13:01:17.597988+00	104.00	f	\N	2026-04-15 13:03:29.676888+00	CARD	\N	616		0		0		0	\N	2
1036	2	B201XLA	\N	\N	2026-04-15 13:05:01.698469+00	1060.00	f	\N	2026-04-15 13:14:15.929207+00	CARD	\N	\N	ASC-D	795		0		0	\N	2
1049	2	DJ29KIR	\N	\N	2026-04-16 05:57:51.306667+00	120.00	f	\N	2026-04-16 06:15:48.179381+00	CARD	\N	\N		0		0		0	\N	2
1037	2	DJ017189	\N	\N	2026-04-15 13:09:03.725422+00	5544.00	f	\N	2026-04-15 14:02:57.132589+00	CARD	\N	621	ASC-D	799		0		0	\N	2
1025	2	B456BTC	\N	ANV CLIENT VERDESTEIN ULTRA PRO 295 30 24  MM 6 6 6 6 PRESIUNE 2,6 FATA SPATE NM 160 \nCUSTODIE ANV JANTE CAPACE PIRELLI SCORPION WINTER 295 35 22 MM   6 6 6 6 DOT 2820	2026-04-15 11:35:01.960347+00	950.00	f	\N	2026-04-15 14:04:42.191741+00	OP	\N	609	ASC-D	792		0		0	\N	2
1033	2	IF99GRK	\N	\N	2026-04-15 12:45:44.240216+00	1256.00	f	\N	2026-04-15 13:24:37.36014+00	CASH	\N	613	ASC-D	796		0		0	\N	2
1046	2	DJ98YBD	\N	\N	2026-04-16 05:43:09.472822+00	300.00	f	\N	2026-04-16 05:45:43.735997+00	CASH	\N	\N		0		0		0	\N	2
1045	2	DJW29KIR	\N	ANVELOPE CLIENT MICHELIN PRIMACY4 235/50/18 5MM	2026-04-16 05:41:19.549679+00	96.00	f	\N	2026-04-16 05:45:49.732484+00	CARD	\N	624	ASC-D	802		0		0	\N	2
1038	2	DJ70XAS	\N	\N	2026-04-15 13:14:25.457914+00	1256.00	f	\N	2026-04-15 14:11:00.884318+00	CARD	\N	618	ASC-D	800		0		0	\N	2
1041	2	DJ12FSM	\N	\N	2026-04-15 14:17:22.635913+00	176.00	f	\N	2026-04-15 14:18:37.467229+00	CASH	\N	620		0		0		0	\N	2
1048	2	DJ29RDB	\N	\N	2026-04-16 05:47:28.573808+00	120.00	f	\N	2026-04-16 05:51:28.17899+00	CARD	\N	626		0		0		0	\N	2
1047	2	DJ52AMV	\N	4 JANTE ALIAJ 4 ANVELOPE DOT 06 23 MM 6 235 55 19	2026-04-16 05:45:35.834091+00	320.00	f	\N	2026-04-16 05:57:34.856334+00	CARD	\N	625	ASC-D	803		0		0	\N	2
1051	2	MH07XAO	\N	\N	2026-04-16 06:03:56.931684+00	180.00	f	\N	2026-04-16 06:05:57.876774+00	CASH	\N	630		0		0		0	\N	2
1044	2	DJ77XZZ	\N	PRESIUNE FATA SPATE 2,4 NM 150-	2026-04-16 05:35:35.103096+00	168.00	f	\N	2026-04-16 06:06:05.461796+00	CASH	\N	629	ASC-D	804		0		0	\N	2
1061	2	DJ73YGI	\N	ANV CLIENT 205 5516 CONTI WINTER MM 8  8 88	2026-04-16 06:57:49.739816+00	160.00	f	\N	2026-04-16 07:00:06.876681+00	CARD	\N	637	ASC-D	812		0		0	\N	2
1054	2	DJ77XZZ	\N	\N	2026-04-16 06:17:27.265036+00	120.00	f	\N	2026-04-16 06:20:51.364249+00	CASH	\N	629	ASC-D	807		0		0	\N	2
1058	2	DJ74RIC	\N	ANVELOPE CLIENT HANKOOK 205/60/16 8MM	2026-04-16 06:47:03.517998+00	136.00	f	\N	2026-04-16 06:47:53.046503+00	CARD	\N	634	ASC-D	809		0		0	\N	2
1059	2	DJ26KLS	\N	\N	2026-04-16 06:51:26.940199+00	136.00	f	\N	2026-04-16 06:55:54.245119+00	CARD	\N	635	ASC-D	811		0		0	\N	2
1060	2	DJ63XRX	\N	\N	2026-04-16 06:55:37.112696+00	50.00	f	\N	2026-04-16 06:56:47.964832+00	CASH	\N	636		0		0		0	\N	2
1056	2	DJ25ADU	\N	ANV CLIENT CONTI CONTACT  7 245 45 18 MM 2 2 2 2 ANVELOPE TERMI NATE  JANTE OVALIZATE PRESIUNE FATA SPATE 2,4 NM 140	2026-04-16 06:32:46.12184+00	168.00	f	\N	2026-04-16 07:01:35.922226+00	CARD	\N	633	ASC-D	808		0		0	\N	2
1063	2	DJ29AEA	\N	\N	2026-04-16 07:13:03.995742+00	176.00	f	\N	2026-04-16 07:48:12.544752+00	CARD	\N	638	ASC-D	815		0		0	\N	2
1062	2	DJ67XDK	\N	\N	2026-04-16 07:06:36.423931+00	696.00	f	\N	2026-04-16 08:01:49.54392+00	CARD	\N	643		0		0		0	\N	2
1065	2	DJ96TAD	\N	\N	2026-04-16 07:19:48.591816+00	76.00	f	\N	2026-04-16 07:20:35.381004+00	CARD	\N	640	ASC-D	813		0		0	\N	2
1042	2	DJ02DST	\N	CUSTODIE ANV SEBRING VAN WINTER 205 65 16C DOT4420 MM 4455 \nANV MONTATE RIKEN CARGO SPEDD 205 65 16C MM 7 7 7 7	2026-04-15 14:20:17.152935+00	312.00	f	\N	2026-04-16 08:40:26.177613+00	OP	\N	622		0		0		0	\N	2
1067	2	DJ17WKW	\N	ANVELOPE CLIENT RIKEN 215/55/17 6MM	2026-04-16 07:25:11.322035+00	176.00	f	\N	2026-04-16 07:25:40.915138+00	CARD	\N	642		0		0		0	\N	2
1233	2	DJ55BMD	\N	\N	2026-04-17 13:40:28.9883+00	76.00	f	\N	2026-04-17 13:43:00.165124+00	CARD	\N	797		0		0		0	\N	2
1492	2	DJ29KWG	\N	ANV MONTATE PIRELLI SCORPION  VERDE 235 55 19 PRESIUNE FATA SPATE 2,4  NM 120 \nCUSTODIE ANV JANTE CAPACE RADBURG ALL  TEREIN  235 60 18 MM 9 9 9 9  DOT 1724	2026-04-22 09:37:15.450623+00	280.00	f	\N	2026-04-22 09:37:50.420193+00	CASH	\N	1041	ASC-D	1107		0		0	\N	2
1066	2	DJ15MWM	\N	ROTI COMPLETE CLIENT SAILUN 195/55/16 SAU MONTAT\nCUSTODIE 4JANTE OTEL+4ANV+4CAPACE RIKEN SNOW 195/55/16 DOT3422 6MM	2026-04-16 07:20:45.942357+00	226.00	f	\N	2026-04-16 07:21:51.802206+00	CARD	\N	641	ASC-D	814		0		0	\N	2
1264	2	OT41ULI	\N	245 40 20 2BUC 275 35 20 2BUC HANKOOK	2026-04-20 07:31:20.858288+00	532.00	f	\N	2026-04-20 07:32:01.977807+00	CASH	\N	829		0		0		0	\N	2
1394	2	GJ66CCA	\N	\N	2026-04-21 09:09:46.197562+00	2608.00	f	\N	2026-04-21 10:42:33.682193+00	CARD	\N	950	ASC-D	1040		0		0	\N	2
1071	2	DJ27PCO	\N	\N	2026-04-16 08:05:15.576344+00	224.00	f	\N	2026-04-16 08:07:49.252577+00	CARD	\N	647	ASC-D	818		0		0	\N	2
1265	2	DJ33GPC	\N	\N	2026-04-20 07:31:42.868912+00	250.00	f	\N	2026-04-20 07:33:31.282174+00	OP	\N	830	ASC-D	938		0		0	\N	2
1295	2	DJ21EPK	\N	ANV CLIENT MICHELIN PRIMACY 4 205 55 16 MM  6 6 6 6 PRESIUNE FATA SPATE 2,3 NM 120	2026-04-20 10:30:38.915021+00	136.00	f	\N	2026-04-20 10:33:02.786219+00	CASH	\N	857	ASC-D	954		0		0	\N	2
1307	2	B701DEE	\N	CUSTODIE ANV MICHELIN ALPIN 7 205 55 16 MM 7 7 7 7 DOT 1225 \nPRESIUNE FATA SPATE 2,3 NM 120	2026-04-20 11:28:49.106542+00	2136.00	f	\N	2026-04-20 12:03:56.961011+00	OP	\N	873	ASC-D	967		0		0	\N	2
1607	2	DJ52LDP	\N	\N	2026-04-24 05:33:53.747705+00	3020.00	f	\N	2026-04-24 06:15:13.882634+00	OP	\N	1152	ASC-D	1206		0		0	\N	2
1325	2	SB40GUH	\N	CUSTODIE 4 ANV RIKEN SNOW 205 55 16 DOT 2123 MM 6\nMONTAT RIKEN 205 55 16	2026-04-20 12:57:50.759267+00	260.00	f	\N	2026-04-20 12:58:27.045616+00	CARD	\N	884	ASC-D	974		0		0	\N	2
1493	2	DJ59SAS	\N	\N	2026-04-22 09:37:54.723936+00	168.00	f	\N	2026-04-22 09:39:05.150778+00	CARD	\N	1042	ASC-D	1108		0		0	\N	2
1432	2	DJ69NIS	\N	ANV CLIENT VREDESTEI 315 35 21 275 40 21 MM  6 6 6 6 NM 160	2026-04-21 12:14:04.993953+00	288.00	f	\N	2026-04-21 12:19:33.075829+00	CARD	\N	980	ASC-D	1056		0		0	\N	2
1358	2	DJ10PDZ	\N	ANV CLIENT 195 75 16C RIKEN CARGO SPEED  MM 5 5 5 5 4 4 PRESIUNE FATA SPATE 4.5 NM 180	2026-04-21 06:25:51.472943+00	188.00	f	\N	2026-04-21 06:27:31.770133+00	OP	\N	918	ASC-D	996		0		0	\N	2
1433	2	DJ84NIS	\N	ANV CLIENT CONTI ECO CONTACT 6 315 35 21 275 40 21 MM 4 4 4 4 NM 160	2026-04-21 12:16:10.681646+00	288.00	f	\N	2026-04-21 12:20:05.173991+00	CARD	\N	982		0		0		0	\N	2
1360	2	DJ32HER	\N	ROTI COMPLETE PIRELI 255/35/19 2BUC225/40/19 2BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU HANKOOK WINTER ICEPT 225/50/17 DOT2224 6MM 4BUC	2026-04-21 06:33:10.980402+00	264.00	f	\N	2026-04-21 06:36:01.893651+00	CASH	\N	920	ASC-D	999		0		0	\N	2
1135	2	B717PXZ	\N	ANV MONTATE PIRELLI PZ4 275 35 19 285 30 20 \nCUSTODIE ANV 275 3519 285 30 20 MICHELIN PILOT ALPIN 5	2026-04-16 13:12:19.056168+00	386.00	f	\N	2026-04-21 14:28:19.242025+00	OP	\N	707	ASC-D	1070		0		0	\N	2
1367	2	DJ63HLW	\N	ANV MONTATE 245 50 18 MICHELIN PILOT SPORT 5 MM 6 6 6 6 PRESIUNE FATA  SPATE 2,4 NM 140 \nCUSTODIE ANV JANTE CAPACE MICHELIN PILOT ALPIN 245 5018 MM 7 7 7 7 DOT 3422	2026-04-21 06:53:30.507128+00	256.00	f	\N	2026-04-21 06:54:37.255415+00	CARD	\N	926	ASC-D	1004		0		0	\N	2
1533	2	DJ10KOD	\N	NEXEN 225 55 16	2026-04-22 14:07:42.185545+00	136.00	f	\N	2026-04-22 14:12:47.042111+00	CARD	\N	1081	ASC-D	1144		0		0	\N	2
1385	2	DJ08RXY	\N	195 65 15 HANKOOK VENTUS PRIME 3	2026-04-21 08:28:05.674252+00	160.00	f	\N	2026-04-21 08:31:00.602757+00	CASH	\N	943	ASC-D	1019		0		0	\N	2
1470	2	DJ77AVG	\N	ROTI COMPLETE CLIENT HANKOOK 315/35/21 2BUC 275/40/21 2BUC SAU MONTAT	2026-04-22 07:35:02.138376+00	160.00	f	\N	2026-04-22 07:37:30.753463+00	CARD	\N	1019	ASC-D	1086		0		0	\N	2
1410	2	DJ19VTA	\N	KELLY 185/65/15 6MM 2,2 BARI\n\nNOKIAN WR 185/60/15 4MM DOT=3616 ( CUSTODIE 4 ANVELOPE )	2026-04-21 10:18:02.951702+00	252.00	f	\N	2026-04-21 10:19:51.359337+00	CARD	\N	\N	ASC-D	1038		0		0	\N	2
1494	2	DJ67FRT	\N	FALKEN 205/65/16 4BUC SAU MONTAT\nCUSTODIE 4ANV KUMHO WINTERCRAFT 205/65/16 DOT1423 6MM 4BUC	2026-04-22 09:43:31.770001+00	256.00	f	\N	2026-04-22 09:46:06.3069+00	OP	\N	1043	ASC-D	1109		0		0	\N	2
1471	2	B122TYA	\N	\N	2026-04-22 07:50:13.521248+00	132.00	f	\N	2026-04-22 07:51:08.658445+00	OP	\N	1018	ASC-D	1087		0		0	\N	2
1475	2	B06EJO	\N	\N	2026-04-22 08:09:01.047621+00	250.00	f	\N	2026-04-22 08:15:36.192128+00	CARD	\N	1024	ASC-D	1092		0		0	\N	2
1515	2	IF12JCB	\N	\N	2026-04-22 12:09:25.798867+00	192.00	f	\N	2026-04-22 12:14:35.847464+00	CARD	\N	1063	ASC-D	1128		0		0	\N	2
1477	2	CJ74BSR	\N	\N	2026-04-22 08:14:16.940157+00	3890.00	f	\N	2026-04-22 08:58:48.267765+00	OP	\N	1032	ASC-D	1101		0		0	\N	2
1551	2	DJ73SYC	\N	\N	2026-04-23 07:24:18.58899+00	383.00	f	\N	2026-04-23 07:26:34.810837+00	CARD	\N	1098	ASC-D	1160		0		0	\N	2
1516	2	CJ77TRV	\N	NEXEN 185 60 15	2026-04-22 12:14:42.480953+00	160.00	f	\N	2026-04-22 12:15:51.487098+00	OP	\N	1064	ASC-D	1129		0		0	\N	2
1611	2	B618FRT	\N	MICHELIN 235/55/19 4ANV SAU MONTAT\nCUSTODIE NOKIAN TIRES 235/55/19 DOT5225 7MM 4ANV SE SCHIMBA NUMARU DE LA MASINA IF07341 CU B618FRT	2026-04-24 06:19:24.241226+00	374.00	f	\N	2026-04-24 06:20:10.908002+00	OP	\N	1154	ASC-D	1207		0		0	\N	2
1569	2	DJ28ECO	\N	\N	2026-04-23 09:29:00.266448+00	288.00	f	\N	2026-04-23 09:32:19.094745+00	OP	\N	1114	ASC-D	1170		0		0	\N	2
1517	2	B126EDS	\N	\N	2026-04-22 12:14:44.697552+00	534.00	f	\N	2026-04-22 12:26:16.036406+00	CASH	\N	1066	ASC-D	1133		0		0	\N	2
1513	2	DJ05ELF	\N	\N	2026-04-22 12:00:34.743836+00	2100.00	f	\N	2026-04-22 12:37:21.348624+00	OP	\N	1061	ASC-D	1135		0		0	\N	2
1609	2	DJ08JKX	\N	\N	2026-04-24 06:04:03.399534+00	1840.00	f	\N	2026-04-24 06:57:28.878654+00	OP	\N	1161	ASC-D	1213		0		0	\N	2
1604	2	OT82CXP	\N	CUSTODIE 4ANV 4JANTE OTEL 4CAPACE KUMHO WINTER CRAFT 175 65 14 DOT 1624 MM 6\n185 55 15 KUMHO MONTAT	2026-04-24 05:28:04.996163+00	226.00	f	\N	2026-04-24 05:38:04.732986+00	CARD	\N	1149	ASC-D	1203		0		0	\N	2
1572	2	DJ88GBL	\N	ANV CLIENT MICHELIN 275/45/20 4BUC\nANLOCUIT VALVA SENZOR TPMS 1X60 LE	2026-04-23 09:57:18.405246+00	384.00	f	\N	2026-04-23 09:58:03.067058+00	CARD	\N	1118	ASC-D	1172		0		0	\N	2
1586	2	OT14SXG	\N	\N	2026-04-23 11:39:03.32128+00	250.00	f	\N	2026-04-23 11:49:41.491547+00	CASH	\N	1131	ASC-D	1187		0		0	\N	2
1605	2	DJ90MHN	\N	\N	2026-04-24 05:30:47.07797+00	3132.00	f	\N	2026-04-24 06:41:30.987869+00	CASH	\N	1150	ASC-D	1209		0		0	\N	2
1629	2	DJ17FBF	\N	\N	2026-04-24 07:30:54.972809+00	180.00	f	\N	2026-04-24 07:34:16.659966+00	CARD	\N	1168		0		0		0	\N	2
1628	2	DJ71DEA	\N	ANVELOPE CLIENT\n MISCHELIN 225/40/18 5MM	2026-04-24 07:27:24.949148+00	286.00	f	\N	2026-04-24 07:28:48.931022+00	CARD	\N	1167	ASC-D	1223		0		0	\N	2
1643	2	DJ23SPM	\N	\N	2026-04-24 08:50:24.478159+00	120.00	f	\N	2026-04-24 08:53:23.731984+00	CASH	\N	1183		0		0		0	\N	2
1612	2	DJ78FRT	\N	\N	2026-04-24 06:29:08.40473+00	11400.00	f	\N	2026-04-24 10:54:14.544539+00	OP	\N	\N		0		0		0	\N	2
1664	2	AG35MXR	\N	\N	2026-04-24 11:17:42.223953+00	600.00	f	\N	2026-04-24 11:20:25.392007+00	OP	\N	1204		0		0		0	\N	2
1660	2	DJ70AAN	\N	KUMHO 255/45/20 4BUC SAU MONTAT\nCUSTODIE KUMHO WINTERCRAFT 255/45/20 DOT1921 6MM 2BUC	2026-04-24 10:52:10.70306+00	374.00	f	\N	2026-04-24 11:25:40.524037+00	OP	\N	\N	ASC-D	1249		0		0	\N	2
1674	2	TR85LAV	\N	\N	2026-04-24 12:11:07.422378+00	120.00	f	\N	2026-04-24 12:16:40.906932+00	CASH	\N	1213	ASC-D	1253		0		0	\N	2
1672	2	IS27RBK	\N	\N	2026-04-24 12:09:52.006784+00	4112.00	f	\N	2026-04-24 13:23:59.002868+00	OP	\N	\N		0		0		0	\N	2
1687	2	B180TEX	\N	DUNLOP 225/60/18 4ANV SAU MONTAT\nCUSTODIE MICHELIN PILOT ALPIN5 225/60/18 DOT3724 6MM 4ANV	2026-04-24 13:26:54.031747+00	316.00	f	\N	2026-04-24 13:27:23.597866+00	CARD	\N	1227	ASC-D	1264		0		0	\N	2
1692	2	DJ14LDP	\N	CUSTODIE 4 ANV RIKEN SNOW 235 60 18 DOT 35 23 MM 6	2026-04-24 13:50:03.276217+00	316.00	f	\N	2026-04-24 13:50:59.22481+00	CARD	\N	1232	ASC-D	1266		0		0	\N	2
1695	2	DJ44TRI	\N	\N	2026-04-24 14:20:56.481121+00	68.00	f	\N	2026-04-24 14:22:08.504778+00	CARD	\N	1234	ASC-D	1270		0		0	\N	2
1698	2	OT13SXS	\N	\N	2026-04-27 05:50:44.943153+00	148.00	f	\N	2026-04-27 05:53:13.683311+00	CASH	\N	1238	ASC-D	1273		0		0	\N	2
1064	2	DJ55BAS	\N	CUSTODIE ANV JANTE CAPACE  CONTI WINTER CONTACT 235 65 17 MM 4 4 3 3 DOT 1916  \nANV MONTATE HANKOOK VENTUS PRIMER SUV 3 235 65 17 MM 6 6 6 6  PRESIUNE FATA SPATE 2,4 NM 140	2026-04-16 07:15:34.36094+00	296.00	f	\N	2026-04-16 07:25:50.596967+00	CASH	\N	639		0		0		0	\N	2
1069	2	DJ05DSS	\N	\N	2026-04-16 07:31:13.234494+00	136.00	f	\N	2026-04-16 07:33:47.404749+00	CARD	\N	644		0		0		0	\N	2
1084	2	DJ51MRG	\N	\N	2026-04-16 09:03:27.33521+00	168.00	f	\N	2026-04-16 09:04:48.228116+00	CASH	\N	652		0		0		0	\N	2
1093	2	DJ73DYN	\N	ANVELOPE CLIENT MICHELIN PS4 235/60/18 6MM	2026-04-16 09:44:22.054528+00	96.00	f	\N	2026-04-16 09:45:12.517205+00	CASH	\N	667		0		0		0	\N	2
1068	2	MH29DEI	\N	\N	2026-04-16 07:27:55.077251+00	56.00	f	\N	2026-04-16 07:43:49.569388+00	CARD	\N	645	ASC-D	816		0		0	\N	2
1082	2	DJ88VAP	\N	ANV CLIENT PIRELLI 274/40/22 4BUC	2026-04-16 09:02:00.109406+00	328.00	f	\N	2026-04-16 09:05:01.922714+00	OP	\N	659	ASC-D	824		0		0	\N	2
1099	2	DJ65SEK	\N	CONTINENTAL 195 55 16	2026-04-16 10:22:43.002975+00	64.00	f	\N	2026-04-16 10:23:24.163537+00	CASH	\N	674	ASC-D	835		0		0	\N	2
1070	2	DJ19AZV	\N	ROTI COMPLETE HANKOOK 225/55/18 SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU RIKEN SNOW 215/60/17 DOT2923 6MM	2026-04-16 08:03:01.547581+00	256.00	f	\N	2026-04-16 08:04:02.501429+00	CARD	\N	646	ASC-D	817		0		0	\N	2
1081	2	DJ80MET	\N	\N	2026-04-16 08:57:50.27242+00	192.00	f	\N	2026-04-16 09:05:20.725304+00	OP	\N	657	ASC-D	825		0		0	\N	2
1072	2	DJ82GMM	\N	\N	2026-04-16 08:05:40.650855+00	120.00	f	\N	2026-04-16 08:09:45.205993+00	CARD	\N	648		0		0		0	\N	2
1090	2	TM86MNX	\N	215 65 16 FIRESTONE	2026-04-16 09:29:15.089429+00	132.00	f	\N	2026-04-16 09:46:04.039364+00	OP	\N	665	ASC-D	832		0		0	\N	2
1073	2	B444ANJ	\N	ANV CLIENT YOCOHAMA ADVI 235 55 19 MM 7 7 7 7 PRESIUNE FATA SPATE 2,3 NM 120	2026-04-16 08:09:41.806454+00	224.00	f	\N	2026-04-16 08:10:38.954497+00	CARD	\N	649	ASC-D	819		0		0	\N	2
1085	2	B17TCM	\N	\N	2026-04-16 09:13:04.760801+00	160.00	f	\N	2026-04-16 09:16:01.284336+00	CARD	\N	660		0		0		0	\N	2
1074	2	DJ11BGB	\N	4 JANTE ALIAJ 4 ANVELOPE 4 CAPACE RIKEN 195 55 16 DOT 28 23 MM 6	2026-04-16 08:21:59.44987+00	246.00	f	\N	2026-04-16 08:23:23.362417+00	CASH	\N	650	ASC-D	820		0		0	\N	2
1080	2	DJ17VAX	\N	\N	2026-04-16 08:48:50.284597+00	800.00	f	\N	2026-04-16 10:56:10.22474+00	CASH	\N	656	ASC-D	827		0		0	\N	2
1087	2	OT99SMC	\N	\N	2026-04-16 09:18:06.911442+00	188.00	f	\N	2026-04-16 09:21:12.314638+00	CASH	\N	661	ASC-D	826		0		0	\N	2
1078	2	DJ66SEA	\N	ANVELOPE CLIENT HANKOOK VENTUS 235/55/20 6MM	2026-04-16 08:43:34.88341+00	216.00	f	\N	2026-04-16 08:44:12.590451+00	OP	\N	654	ASC-D	821		0		0	\N	2
1075	2	DJ10RIM	\N	\N	2026-04-16 08:29:42.136723+00	68.00	f	\N	2026-04-16 08:44:32.557036+00	CASH	\N	651		0		0		0	\N	2
1094	2	DJ63HSD	\N	215 55 17 CONTINENTAL	2026-04-16 10:01:40.247813+00	168.00	f	\N	2026-04-16 10:03:12.64815+00	CARD	\N	668		0		0		0	\N	2
1079	2	WESDY586	\N	ANV CLIENT 225 40 18 MICHELIN  PILOT SPORT 4 MM 6 7 7 6 PRESIUNE FATA SPATE 2,5 NM 140	2026-04-16 08:47:31.972781+00	352.00	f	\N	2026-04-16 08:50:42.412825+00	CARD	\N	655	ASC-D	822		0		0	\N	2
1077	2	NT55KBE	\N	\N	2026-04-16 08:39:50.021456+00	136.00	f	\N	2026-04-16 08:58:41.455244+00	OP	\N	653	ASC-D	823		0		0	\N	2
1114	2	DJ38ETC	\N	225 50 18 DUNLOP	2026-04-16 11:30:09.05896+00	176.00	f	\N	2026-04-16 11:30:54.861335+00	CARD	\N	687	ASC-D	845		0		0	\N	2
1095	2	DJ14SZU	\N	\N	2026-04-16 10:10:12.114086+00	76.00	f	\N	2026-04-16 10:12:44.715155+00	CARD	\N	669		0		0		0	\N	2
1097	2	DJ39ADO	\N	ANV CLIENT BRIDGESTONE 195/55/16 4BUC	2026-04-16 10:12:21.59022+00	134.00	f	\N	2026-04-16 10:13:54.916805+00	CARD	\N	670		0		0		0	\N	2
1089	2	DJ22WTF	\N	ANV CLIENT VERDESTEIN ULTRA PRO 235 35 19 MM  7 7 5 5 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-16 09:27:16.429081+00	556.00	f	\N	2026-04-16 09:28:01.041491+00	CASH	\N	664	ASC-D	829		0		0	\N	2
1088	2	DJ18JJB	\N	\N	2026-04-16 09:23:53.430851+00	300.00	f	\N	2026-04-16 09:28:48.732502+00	CASH	\N	663	ASC-D	830		0		0	\N	2
1101	2	B81WGT	\N	\N	2026-04-16 10:35:45.351028+00	132.00	f	\N	2026-04-16 10:36:25.113665+00	CASH	\N	673		0		0		0	\N	2
1083	2	DJ10KAN	\N	\N	2026-04-16 09:02:47.331018+00	3746.00	f	\N	2026-04-16 09:38:21.213804+00	CARD	\N	658	ASC-D	828		0		0	\N	2
1091	2	DJ17HFO	\N	FIRESTONE 4 ANVELOPE 255 45 19 MM 6 DOT 38 23	2026-04-16 09:38:03.424812+00	374.00	f	\N	2026-04-16 09:41:27.539749+00	CARD	\N	662		0		0		0	\N	2
1105	2	DJ28DXC	\N	\N	2026-04-16 10:46:52.97449+00	2016.00	f	\N	2026-04-16 11:08:00.235963+00	CARD	\N	679	ASC-D	839		0		0	\N	2
1092	2	B221RDW	\N	ANV CLIENT DUNLOP 225/60/18 4BUC	2026-04-16 09:39:59.68554+00	176.00	f	\N	2026-04-16 09:42:54.621898+00	OP	\N	666	ASC-D	831		0		0	\N	2
1096	2	DJ56XWX	\N	\N	2026-04-16 10:12:09.532017+00	250.00	f	\N	2026-04-16 10:15:28.543008+00	CARD	\N	671	ASC-D	833		0		0	\N	2
1098	2	B335AMI	\N	ANV MONTATE MICHELIN LATITUDE SPORT 3 235 55 19 MM 6 6 5 5 \nCUSTODIE ANV PIRELLI WINTER 235 55 19 MM 8 8 8 8 2825	2026-04-16 10:15:06.50174+00	150.00	f	\N	2026-04-16 10:16:57.884424+00	CASH	\N	672	ASC-D	834		0		0	\N	2
1106	2	DJ55WET	\N	\N	2026-04-16 10:48:10.069117+00	132.00	f	\N	2026-04-16 10:49:24.391478+00	CARD	\N	681		0		0		0	\N	2
1102	2	IS08PHA	\N	\N	2026-04-16 10:37:16.538615+00	192.00	f	\N	2026-04-16 10:38:26.085259+00	OP	\N	676	ASC-D	837		0		0	\N	2
1107	2	B05WGT	\N	ANV CLIENT GOODYEAR 205/60/16 4BUC	2026-04-16 10:49:48.340808+00	136.00	f	\N	2026-04-16 10:51:03.893823+00	CASH	\N	682		0		0		0	\N	2
1100	2	DJ93DYN	\N	ANVELOPE CLIENT MICHELIN PS4 245/45/20 6MM	2026-04-16 10:35:39.093419+00	220.00	f	\N	2026-04-16 10:39:40.715312+00	CASH	\N	675	ASC-D	838		0		0	\N	2
1104	2	FX21DK	\N	\N	2026-04-16 10:38:36.417553+00	76.00	f	\N	2026-04-16 10:41:10.567465+00	CASH	\N	678		0		0		0	\N	2
1103	2	OT28ARH	\N	\N	2026-04-16 10:37:48.746444+00	120.00	f	\N	2026-04-16 10:45:48.293354+00	CARD	\N	677		0		0		0	\N	2
1109	2	B102PPE	\N	\N	2026-04-16 11:00:16.978597+00	660.00	f	\N	2026-04-16 11:17:48.342963+00	OP	\N	\N	ASC-D	842		0		0	\N	2
1112	2	DJ11NWN	\N	RIKEN ROAD 215/55/16 6MM\n\nRIKEN SNOW 215/55/16 5MM DOT=3322 ( CUSTODIE 4 ANVELOPE,4JANTE ALIAJ,4 CAPACE)	2026-04-16 11:16:53.459299+00	226.00	f	\N	2026-04-16 11:19:27.007341+00	CASH	\N	684	ASC-D	843		0		0	\N	2
1108	2	DJ16VDD	\N	\N	2026-04-16 10:54:37.749587+00	64.00	f	\N	2026-04-16 10:55:32.752177+00	CARD	\N	680	ASC-D	840		0		0	\N	2
1076	2	OT28ARH	\N	\N	2026-04-16 08:38:25.426327+00	2400.00	f	\N	2026-04-16 10:55:58.132771+00	CARD	\N	\N	ASC-D	836		0		0	\N	2
1111	2	DJ09BAV	\N	\N	2026-04-16 11:14:14.538349+00	96.00	f	\N	2026-04-16 11:14:54.215269+00	CARD	\N	683	ASC-D	841		0		0	\N	2
1086	2	DJ30CCD	\N	\N	2026-04-16 09:16:29.468618+00	850.00	f	\N	2026-04-16 11:35:58.248571+00	OP	\N	\N	ASC-D	846		0		0	\N	2
1113	2	AB95LAC	\N	\N	2026-04-16 11:23:35.010237+00	300.00	f	\N	2026-04-16 11:30:16.917508+00	OP	\N	685	ASC-D	844		0		0	\N	2
1118	2	DJ84YAB	\N	MICHELIN 205 55 16 MM 7 DOT 15 25  4 ANVELOPE 4 JANTE ALIAJ 4 CAPACE	2026-04-16 11:49:24.668855+00	246.00	f	\N	2026-04-16 11:50:37.977803+00	CASH	\N	686	ASC-D	848		0		0	\N	2
1116	2	DJ07YSN	\N	\N	2026-04-16 11:44:25.885908+00	60.00	f	\N	2026-04-16 11:45:29.93974+00	CARD	\N	690		0		0		0	\N	2
1110	2	DJ10KYM	\N	\N	2026-04-16 11:11:50.387863+00	2016.00	f	\N	2026-04-16 11:48:38.604934+00	CASH	\N	689	ASC-D	847		0		0	\N	2
1115	2	B145ELC	\N	\N	2026-04-16 11:37:56.545991+00	886.00	f	\N	2026-04-16 13:37:44.479462+00	OP	\N	688	ASC-D	860		0		0	\N	2
1119	2	DJ69AAM	\N	\N	2026-04-16 11:58:18.948401+00	246.00	f	\N	2026-04-16 11:59:08.752261+00	CARD	\N	691		0		0		0	\N	2
1120	2	OT34CIA	\N	235 65 16C KLEBER	2026-04-16 12:05:36.48682+00	100.00	f	\N	2026-04-16 12:11:10.220484+00	CASH	\N	693	ASC-D	851		0		0	\N	2
1125	2	DJ77TYR	\N	\N	2026-04-16 12:24:50.99927+00	104.00	f	\N	2026-04-16 12:25:33.681101+00	CASH	\N	698	ASC-D	853		0		0	\N	2
1117	2	DJ18JTC	\N	ANV CLIENT MICHELIN  PRIMACY4 225 55 19 MM 8 8 8 8 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-16 11:48:59.058891+00	224.00	f	\N	2026-04-16 13:05:55.871411+00	CARD	\N	\N	ASC-D	849		0		0	\N	2
1121	2	DJ22DLC	\N	4ANV 4JANTE ALIAJ 4CAPACE  MICHELIN215/65 17 5MM DOT 3618	2026-04-16 12:07:48.255234+00	232.00	f	\N	2026-04-16 12:09:13.08355+00	CARD	\N	692	ASC-D	850		0		0	\N	2
1454	2	B650PHA	\N	205 75 16C BRIDGESTONE	2026-04-22 05:45:58.069403+00	192.00	f	\N	2026-04-22 05:46:36.74648+00	OP	\N	1002	ASC-D	1074		0		0	\N	2
1266	2	DJ55CNE	\N	ANVELOPE CLIENT GOODYEAR 205/55/16 5MM	2026-04-20 07:44:47.694811+00	76.00	f	\N	2026-04-20 07:46:48.115334+00	CARD	\N	832		0		0		0	\N	2
1123	2	DJ51SKY	\N	\N	2026-04-16 12:12:45.063709+00	222.00	f	\N	2026-04-16 12:16:26.378716+00	CARD	\N	695	ASC-D	852		0		0	\N	2
1126	2	DJ65KAM	\N	ANV CLIENT BRIDGESTONE 225/60/18 4BUC	2026-04-16 12:24:58.704869+00	176.00	f	\N	2026-04-16 12:26:07.713354+00	CARD	\N	699		0		0		0	\N	2
1273	2	DJ28RMN	\N	\N	2026-04-20 08:30:47.865109+00	132.00	f	\N	2026-04-20 08:32:55.438964+00	CARD	\N	837		0		0		0	\N	2
1128	2	DJ77TYR	\N	\N	2026-04-16 12:26:42.154884+00	120.00	f	\N	2026-04-16 12:31:44.219052+00	CASH	\N	698		0		0		0	\N	2
1514	2	B410DEM	\N	\N	2026-04-22 12:00:53.217008+00	300.00	f	\N	2026-04-22 12:23:58.002933+00	CARD	\N	1062	ASC-D	1131		0		0	\N	2
1124	2	DJ01PFY	\N	\N	2026-04-16 12:23:07.09347+00	3596.00	f	\N	2026-04-16 13:27:07.582519+00	CARD	\N	696	ASC-D	858		0		0	\N	2
1122	2	DJ18RCY	\N	\N	2026-04-16 12:11:15.210333+00	3588.00	f	\N	2026-04-16 14:15:11.413968+00	OP	\N	694		0		0		0	\N	2
1274	2	DJ55JAM	\N	CUSTODIE 4 ANV CONTINENTAL WINTER 285 40 22 BUC 2 325 35 22 BUC 2 DOT 4623 MM 6\nMONTAT MICHELIN 325 35 22 285 40 22	2026-04-20 08:34:03.580937+00	508.00	f	\N	2026-04-20 08:36:16.588031+00	CARD	\N	839	ASC-D	943		0		0	\N	2
1556	2	DJ28WUW	\N	ANV  MONTATE PIRELLI CINTURATO 245 45 18 275 40 18 MM 4 4 3 3  PRESIUNE FATA SPATE 2,4  NM 140 \nCUSTODIE ANV JANTE CAPACE CONTI WINTER TS 850 DOT 1918 MM 4 4 5 5 225 55 17	2026-04-23 08:07:17.823251+00	256.00	f	\N	2026-04-23 08:14:48.734257+00	CASH	\N	1101	ASC-D	1165		0		0	\N	2
1296	2	DJ76MUN	\N	\N	2026-04-20 10:32:50.497977+00	120.00	f	\N	2026-04-20 10:35:51.739325+00	CASH	\N	859	ASC-D	955		0		0	\N	2
1456	2	DJ18WEG	\N	SAILUN ALPINE EVO 215/70/16 7MM DOT 1125 4BUC ,4ANV+4JANTE ALIAJ+ 4CAPACE CENTRU	2026-04-22 05:49:26.490569+00	1926.00	f	\N	2026-04-22 06:03:55.984791+00	CARD	\N	1006		0		0		0	\N	2
1457	2	B139BOL	\N	ANV MONTATE PIRELLI SCORPION VERDE  295 40 22   MM 4 4 5 5 PRESIUNE FATA SPATE 2,4 NM 160 \nCUSTODIE ANV CONTI WINTER CONTACT TS860 295 40 22  DOT 5022	2026-04-22 05:51:38.908237+00	508.00	f	\N	2026-04-22 06:36:50.625683+00	OP	\N	1004	ASC-D	1076		0		0	\N	2
1299	2	DJ21LED	\N	CUSTODIE 4 ANV 235 55 18 HANKOOK WINTER DOT 1924 MM 7\nMONTAT PIRELLI 235 55 18	2026-04-20 10:52:54.792336+00	316.00	f	\N	2026-04-20 10:53:49.590297+00	CARD	\N	862	ASC-D	956		0		0	\N	2
1318	2	B615FRT	\N	CUSTODIE 4 ANV NOKIAN SNOW 235 55 19 DOT 4825 MM 7\nMONTAT MICHELIN 235 55 19	2026-04-20 12:25:03.971066+00	374.00	f	\N	2026-04-20 12:27:18.93472+00	OP	\N	879	ASC-D	970		0		0	\N	2
1520	2	OT23BXA	\N	\N	2026-04-22 12:32:58.958199+00	88.00	f	\N	2026-04-22 12:34:02.404264+00	CARD	\N	1067	ASC-D	1134		0		0	\N	2
1359	2	B577LGK	\N	\N	2026-04-21 06:29:50.742191+00	156.00	f	\N	2026-04-21 06:34:13.814758+00	CASH	\N	919		0		0		0	\N	2
1361	2	DJ43FBY	\N	\N	2026-04-21 06:34:33.934832+00	120.00	f	\N	2026-04-21 06:38:02.942568+00	CARD	\N	921	ASC-D	1000		0		0	\N	2
1389	2	B121DJW	\N	\N	2026-04-21 08:43:42.58915+00	132.00	f	\N	2026-04-21 08:46:27.56643+00	OP	\N	\N	ASC-D	1022		0		0	\N	2
1472	2	OT80MAF	\N	\N	2026-04-22 07:52:46.03227+00	1982.00	f	\N	2026-04-22 08:26:52.825579+00	CASH	\N	1021	ASC-D	1094		0		0	\N	2
1414	2	DJ76COX	\N	ANV CLIENT MICHELIN PILOT SPORT 4 ZP 225 45 18 255 40 18 MM 6 6 5 5  PRESIUNE FATA SPATE 2,3 NM 140	2026-04-21 10:40:19.631262+00	392.00	f	\N	2026-04-21 10:44:16.087154+00	CARD	\N	964		0		0		0	\N	2
1534	2	DJ19DDG	\N	\N	2026-04-22 14:11:24.522977+00	300.00	f	\N	2026-04-22 14:11:58.029838+00	CASH	\N	1082		0		0		0	\N	2
1478	2	DJ69YVO	\N	4ANV MICHELIN 185\\65\\15 DOT4525  7MM	2026-04-22 08:22:40.464064+00	256.00	f	\N	2026-04-22 08:29:35.449632+00	CARD	\N	1026	ASC-D	1095		0		0	\N	2
1436	2	B89JBD	\N	\N	2026-04-21 12:32:06.086655+00	117.00	f	\N	2026-04-21 12:33:56.912996+00	OP	\N	985	ASC-D	1059		0		0	\N	2
1650	2	DJ47ALM	\N	\N	2026-04-24 09:32:29.120289+00	1880.00	f	\N	2026-04-24 10:53:56.089427+00	CASH	\N	1190	ASC-D	1244		0		0	\N	2
1495	2	DJ85AXA	\N	\N	2026-04-22 09:57:47.020869+00	250.00	f	\N	2026-04-22 10:01:16.428771+00	CASH	\N	1044		0		0		0	\N	2
1500	2	DJ58DNZ	\N	\N	2026-04-22 10:33:53.165887+00	100.00	f	\N	2026-04-22 10:37:33.570932+00	CARD	\N	1049		0		0		0	\N	2
1451	2	OT33SSA	\N	\N	2026-04-22 05:24:52.394885+00	9200.00	f	\N	2026-04-22 11:40:04.242681+00	OP	\N	\N	ASC-D	1072		0		0	\N	2
1560	2	DJ28BRA	\N	ANVELOPE FATTA UZATE	2026-04-23 08:21:11.751357+00	250.00	f	\N	2026-04-23 08:26:06.307917+00	CASH	\N	1105		0		0		0	\N	2
1518	2	DJ19WSC	\N	2356018GRENDLANDER 4 BUC	2026-04-22 12:20:49.673259+00	100.00	f	\N	2026-04-22 12:23:38.482572+00	CASH	\N	1065	ASC-D	1130		0		0	\N	2
1645	2	DJ72MAX	\N	CUSTODIE 4 ANV KUMHO WINTER 245 40 18 DOT 1923 MM 6	2026-04-24 09:08:50.460477+00	308.00	f	\N	2026-04-24 09:09:58.84382+00	CASH	\N	1185	ASC-D	1234		0		0	\N	2
1535	2	DJ29ALI	\N	\N	2026-04-22 14:12:51.878715+00	598.00	f	\N	2026-04-22 14:21:12.606253+00	CARD	\N	1083	ASC-D	1145		0		0	\N	2
1570	2	DJ37PER	\N	ANV MONTATE PIRELLI PZ4 RFT 275 45 20 305 40 20 MM 5 5 6 6 PRESIUNE FATA SPATE 2,4 NM 140              \nCUSTODIE ANV JANTE CAPACE BRIDGESTONE BLIZZAK LM 001 MM 77 7  7 DOT 0-324	2026-04-23 09:32:34.328974+00	420.00	f	\N	2026-04-23 09:35:39.876235+00	CARD	\N	1115		0		0		0	\N	2
1536	2	DJ093150	\N	\N	2026-04-22 14:13:11.342186+00	42.00	f	\N	2026-04-23 05:29:17.627175+00	CASH	\N	1084	ASC-D	1147		0		0	\N	2
1644	2	DJ09LNA	\N	BARUM 195/65/15 5MM 2,3 BARI\n\n\nKUMHO WINTER. 195/65/15 7MM DOT=1821 ( CUSTODIE 4 ANVELOPE,4 JANTE OTEL )	2026-04-24 09:05:42.409087+00	222.00	f	\N	2026-04-24 09:07:01.934616+00	CARD	\N	1184	ASC-D	1233		0		0	\N	2
1588	2	DJ87AMA	\N	\N	2026-04-23 11:42:50.709998+00	400.00	f	\N	2026-04-23 12:52:10.87012+00	CARD	\N	1133	ASC-D	1191		0		0	\N	2
1552	2	DJ23XMG	\N	4 ANVELOPE CUSTODIE HANKOK IARNA 205 55 17 DOT 44 22 MM 5	2026-04-23 07:32:22.655861+00	308.00	f	\N	2026-04-23 07:35:31.799939+00	CASH	\N	1099	ASC-D	1161		0		0	\N	2
1606	2	B115VJW	\N	\N	2026-04-24 05:32:38.214672+00	1834.00	f	\N	2026-04-24 06:19:33.21267+00	OP	\N	1151	ASC-D	1204		0		0	\N	2
1661	2	OT25TAX	\N	\N	2026-04-24 11:02:40.582325+00	300.00	f	\N	2026-04-24 11:04:29.057767+00	CASH	\N	1201		0		0		0	\N	2
1646	2	DJ016127	\N	\N	2026-04-24 09:09:14.884552+00	250.00	f	\N	2026-04-24 09:13:14.050428+00	CARD	\N	1186		0		0		0	\N	2
1630	2	DJ14RSH	\N	\N	2026-04-24 07:31:05.590065+00	2032.00	f	\N	2026-04-24 08:22:35.842077+00	OP	\N	1175	ASC-D	1228		0		0	\N	2
1665	2	DJ15TAV	\N	\N	2026-04-24 11:17:56.229714+00	250.00	f	\N	2026-04-24 11:23:30.888342+00	CASH	\N	1205	ASC-D	1248		0		0	\N	2
1663	2	DJ19DVP	\N	4 ANVELOPE CUSTODIE BRIGESTONE 225 55 17 DE IARNA SI 4 JANTE ALIAJ FARA CAPACE DOT 43 18 RECOMAND SCHIMBAREA ANVELOPELOR	2026-04-24 11:15:37.818299+00	256.00	f	\N	2026-04-24 11:20:14.617357+00	CASH	\N	1203	ASC-D	1246		0		0	\N	2
1666	2	DJ83LKA	\N	MICHELIN 225/50/18 5MM\n\nNOKIAN WR 225/50/18 6MM DOT=4321 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )	2026-04-24 11:19:31.239586+00	256.00	f	\N	2026-04-24 11:21:27.556198+00	CARD	\N	1206	ASC-D	1247		0		0	\N	2
1676	2	DJ09LNG	\N	ANVELOPE CLIENT\n\nKUMHO 205/60/16	2026-04-24 12:35:13.499847+00	136.00	f	\N	2026-04-24 12:36:41.883332+00	CASH	\N	1215	ASC-D	1255		0		0	\N	2
1677	2	B777PXZ	\N	MICHELIN  285/45/21 4ANV SAU MONTAT\nCUSTODIE MICHELIN PILOT ALPIN5 SUV 285/45/21 DOT2024 6MM 4BUC	2026-04-24 12:40:55.072488+00	758.00	f	\N	2026-04-24 12:42:35.464304+00	OP	\N	1216	ASC-D	1256		0		0	\N	2
1678	2	DJ55CHR	\N	\N	2026-04-24 12:46:46.195653+00	168.00	f	\N	2026-04-24 12:48:49.680646+00	CASH	\N	1218	ASC-D	1258		0		0	\N	2
1680	2	AB67LAC	\N	EXTENSIE FIER 1 25 LEI	2026-04-24 12:55:47.952568+00	188.00	f	\N	2026-04-24 13:21:40.979065+00	OP	\N	1220	ASC-D	1260		0		0	\N	2
1686	2	DJ29PYP	\N	\N	2026-04-24 13:26:39.849435+00	0.00	t	2026-04-24 13:56:10.003184+00	\N	NEPLATIT	\N	1226		0		0		0	\N	2
1157	2	DJ70CSN	\N	\N	2026-04-17 06:33:25.879936+00	136.00	f	\N	2026-04-17 06:35:06.262647+00	OP	\N	722	ASC-D	872		0		0	\N	2
1139	2	DJ20MVM	\N	235 55 19 PIRELLI	2026-04-16 14:00:21.880709+00	224.00	f	\N	2026-04-16 14:01:37.331964+00	CARD	\N	710	ASC-D	862		0		0	\N	2
1129	2	DJ77SET	\N	MICHELIN 225/55/18 6MM 2BUC\nDUNLOP 225/55/18 5MM 2BUC ( ANVELOPE CLIENT )	2026-04-16 12:34:40.13264+00	168.00	f	\N	2026-04-16 12:35:37.480489+00	CASH	\N	700	ASC-D	854		0		0	\N	2
1130	2	DJ52ACD	\N	225 65 17 MICHELIN	2026-04-16 12:35:26.687267+00	96.00	f	\N	2026-04-16 12:36:56.279125+00	CARD	\N	701		0		0		0	\N	2
1143	2	DJ23TGO	\N	\N	2026-04-17 05:29:06.732191+00	3108.00	f	\N	2026-04-17 06:05:17.119773+00	CASH	\N	715	ASC-D	869		0		0	\N	2
1127	2	DJ66RBC	\N	4ANV 4JANTE ALIAJ 4CAPACE  KUMHO 245\\45\\18  DOT 2625 6MM	2026-04-16 12:25:37.71259+00	264.00	f	\N	2026-04-16 12:39:49.830474+00	OP	\N	697	ASC-D	855		0		0	\N	2
1141	2	DJ31JUL	\N	\N	2026-04-16 14:11:34.459739+00	148.00	f	\N	2026-04-16 14:13:56.508142+00	CASH	\N	712	ASC-D	863		0		0	\N	2
1131	2	DJ18FJD	\N	ROTI COMPETE CLIENT GOODYEAR 245/45/18 MONTATE\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU CONTINENTAL WINTERCONTACT 225/55/17	2026-04-16 12:54:56.168253+00	232.00	f	\N	2026-04-16 12:56:07.805866+00	CARD	\N	702	ASC-D	856		0		0	\N	2
1140	2	AB21AUA	\N	\N	2026-04-16 14:09:06.078395+00	168.00	f	\N	2026-04-16 14:15:54.732964+00	OP	\N	711	ASC-D	864		0		0	\N	2
1132	2	MH12PRV	\N	\N	2026-04-16 12:56:12.984994+00	404.00	f	\N	2026-04-16 12:58:52.260127+00	CASH	\N	703	ASC-D	857		0		0	\N	2
1152	2	DJ73MGO	\N	ANV MONTATE BRIDGESTONE TURANZA T005  225 50 17 MM 5 5 5 5 PRESIUNE FATA SPATE 2,4 NM 140 \nCUSTODIE  ANV KUMHO WINTERCRAFT 225 50 17 MM 7 7 6 6 DOT 2023 TRANSFER NUMAR DJ17RDF	2026-04-17 06:12:40.083769+00	308.00	f	\N	2026-04-17 06:49:36.801343+00	CARD	\N	\N	ASC-D	873		0		0	\N	2
1134	2	DJ02DBI	\N	CONTINENTAL CONTIWINTWRCONTACT 225/50/17 6MM DOT=2323 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )\n\n\nHANKOOK VENTUS 255/40/19 6MM 2,2 BARI\nHANKOOK VENTUS 245/40/19 6MM 2,2 BARI	2026-04-16 13:08:17.238083+00	264.00	f	\N	2026-04-16 13:10:10.045561+00	CARD	\N	706		0		0		0	\N	2
1151	2	DJ88SET	\N	FALKEN 205 55 16	2026-04-17 06:10:34.236716+00	136.00	f	\N	2026-04-17 06:11:51.088045+00	CASH	\N	720		0		0		0	\N	2
1136	2	B486MXM	\N	275 45 21 CONTINENTAL DOT 11 25 MM 7 315 40 21 DOT 11 25 4 ANVELOPE	2026-04-16 13:24:02.766495+00	438.00	f	\N	2026-04-16 13:27:08.383318+00	CASH	\N	705	ASC-D	859		0		0	\N	2
1133	2	B33CPW	\N	\N	2026-04-16 13:01:09.465201+00	168.00	f	\N	2026-04-16 14:20:10.325925+00	CASH	\N	704	ASC-D	865		0		0	\N	2
1142	2	DJ57MLA	\N	ANV CLIENT PIRELLI CINTURATO 195 65 15 MM 3 3 6 6 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-16 14:20:07.106795+00	127.00	f	\N	2026-04-16 14:20:35.576681+00	CARD	\N	713		0		0		0	\N	2
1137	2	IF17LSN	\N	ANV CLIENT MICHELIN 205/55/16 4BUC MONTATE	2026-04-16 13:40:14.615261+00	136.00	f	\N	2026-04-16 13:41:02.851171+00	CASH	\N	709		0		0		0	\N	2
1138	2	DJ01ATG	\N	ANV MONTATE MICHELIN PILOT SPORT 4 245 45 18 MM 6 6 5 5 PRESIUNE 2,,4\nCUSTODIE ANV JANTE CAPACE MICHELIN ALPIN 7 225 55 17 MM 7 7  7 7DOT2824	2026-04-16 13:40:57.804199+00	256.00	f	\N	2026-04-16 13:42:36.917648+00	CARD	\N	708	ASC-D	861		0		0	\N	2
1158	2	DJ10RRC	\N	CUSTODIE 4 ANV 4JANTE ALIAJ 4 CAPACE 20 PIULITE HANKOOK WINTER 205 55 16 DOT 2121 MM 5\nMONTAT FALKEN 205 55 16	2026-04-17 06:38:28.172552+00	226.00	f	\N	2026-04-17 06:39:02.889989+00	CARD	\N	726	ASC-D	874		0		0	\N	2
1153	2	OT09YGY	\N	\N	2026-04-17 06:14:47.505197+00	180.00	f	\N	2026-04-17 06:19:44.219266+00	CASH	\N	721	ASC-D	870		0		0	\N	2
1144	2	DJ08EMY	\N	ANV CLIENT PIRELLI PZ4 245 45 18 MM 6 6  5 5 PRESIUNE 2,4 FATA SPATE NM 120	2026-04-17 05:31:04.519162+00	96.00	f	\N	2026-04-17 05:41:18.39003+00	CARD	\N	716		0		0		0	\N	2
1145	2	DJ14UPE	\N	175 65 15 HANKOOK	2026-04-17 05:40:33.131649+00	136.00	f	\N	2026-04-17 05:48:41.948835+00	CARD	\N	717	ASC-D	866		0		0	\N	2
1147	2	DJ29MRM	\N	ANV CLIENT CONTINENTAL 215/65/17 4BUC SAU MONTAT	2026-04-17 05:49:53.875913+00	176.00	f	\N	2026-04-17 05:51:07.148621+00	CASH	\N	718	ASC-D	867		0		0	\N	2
1154	2	DJ85SFD	\N	MICHELIN 235/50/19 4BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV BRIDGESTONE BLIZZAK 235/50/19 DOT3421 6MM	2026-04-17 06:22:51.863275+00	320.00	f	\N	2026-04-17 06:23:59.012504+00	CARD	\N	723	ASC-D	871		0		0	\N	2
1149	2	DJ50CSN	\N	MICHELIN 225/65/16C 4,5 BARI 6MM\n\nMATADOR 225/65/16C 6MM DOT=3024 ( CUSTODIE 4 ANVELOPE )	2026-04-17 05:55:23.046918+00	312.00	f	\N	2026-04-17 05:56:47.455003+00	OP	\N	719	ASC-D	868		0		0	\N	2
1159	2	DJ64MCA	\N	ANV MONTATE KUMHO PS71 215 50 18 MM 7 7 6 6 PRESIUNE FATA SPATE 2,4 NM 120 \nCUSTODIE  ANV MICHELIN  PILOT ALPIN 5 215 50 18 MM 7 7 7 7 DOT 3520	2026-04-17 06:46:11.729844+00	388.00	f	\N	2026-04-17 06:47:03.530581+00	CARD	\N	728	ASC-D	875		0		0	\N	2
1165	2	IS10PHA	\N	ANV CLIENT HANKOOK 195/55/16 2BUC CONTINENTAL 195/55/16 2BUC SAU MONTAT	2026-04-17 07:03:43.279292+00	136.00	f	\N	2026-04-17 07:05:32.840943+00	OP	\N	734	ASC-D	880		0		0	\N	2
1155	2	DJ09WYO	\N	ANVELOPE CLIENT HANKOOK 265/65/17 5MM	2026-04-17 06:28:24.995711+00	96.00	f	\N	2026-04-17 06:29:42.283654+00	CASH	\N	724		0		0		0	\N	2
1156	2	DJ68AAN	\N	\N	2026-04-17 06:29:33.175591+00	168.00	f	\N	2026-04-17 06:31:26.638517+00	CARD	\N	725		0		0		0	\N	2
1161	2	DJ44MET	\N	\N	2026-04-17 06:56:32.724159+00	136.00	f	\N	2026-04-17 06:57:21.585452+00	OP	\N	727	ASC-D	876		0		0	\N	2
1167	2	DJ22MKV	\N	\N	2026-04-17 07:11:35.831472+00	306.00	f	\N	2026-04-17 07:14:45.30532+00	CASH	\N	736	ASC-D	883		0		0	\N	2
1160	2	DJ98KNA	\N	\N	2026-04-17 06:56:26.289806+00	100.00	f	\N	2026-04-17 06:57:45.565324+00	CASH	\N	729	ASC-D	877		0		0	\N	2
1148	2	DJ96FDS	\N	\N	2026-04-17 05:51:28.699792+00	1060.00	f	\N	2026-04-17 07:56:44.31136+00	CARD	\N	\N	ASC-D	884		0		0	\N	2
1164	2	B889HAF	\N	ANVELOPE CLIENT GOODYEAR 195/75/16C 5MM	2026-04-17 07:02:26.089146+00	96.00	f	\N	2026-04-17 07:03:44.425533+00	CARD	\N	733		0		0		0	\N	2
1169	2	B889HAF	\N	\N	2026-04-17 07:26:14.353698+00	300.00	f	\N	2026-04-17 07:30:02.029923+00	CARD	\N	738		0		0		0	\N	2
1150	2	DJ22CZR	\N	\N	2026-04-17 06:07:23.401572+00	1320.00	f	\N	2026-04-17 07:56:18.783356+00	CARD	\N	\N	ASC-D	878		0		0	\N	2
1166	2	DJ85SPY	\N	CUSTODIE 4 ANV 225 50 18 NOKIAN TIRES SNOW DOT 4620 MM 6\nMONTAT MICHELIN 225 50 18	2026-04-17 07:11:24.450332+00	316.00	f	\N	2026-04-17 07:12:20.744698+00	CARD	\N	735	ASC-D	882		0		0	\N	2
1146	2	DJ18HOB	\N	\N	2026-04-17 05:49:46.099662+00	756.00	f	\N	2026-04-17 07:06:09.662253+00	CASH	\N	730	ASC-D	881		0		0	\N	2
1163	2	DJ76CES	\N	\N	2026-04-17 07:02:25.48261+00	33.00	f	\N	2026-04-17 07:04:12.057212+00	OP	\N	732	ASC-D	879		0		0	\N	2
1172	2	CHERVOLETCRUZE	\N	\N	2026-04-17 07:39:21.674895+00	800.00	f	\N	2026-04-17 09:01:02.478337+00	CASH	\N	\N	ASC-D	893		0		0	\N	2
1171	2	DJ02BVN	\N	215/65/17 HANKOOK WINTER EVO3   MM6   DOT 2625  4ANV  4JANTE ALIAJ   4CAPACE CENTRU	2026-04-17 07:32:34.509393+00	256.00	f	\N	2026-04-17 07:34:01.093413+00	CARD	\N	739	ASC-D	886		0		0	\N	2
1170	2	DJ06CTI	\N	\N	2026-04-17 07:30:10.047085+00	168.00	f	\N	2026-04-17 07:31:35.244899+00	CASH	\N	737	ASC-D	885		0		0	\N	2
1174	2	DJ16LSA	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE GOODIEAR ULTRA GRIP 2BUC 205 60 16 DOT 1825 MM 7 MIC ALP 5 205 60 16 2BUC DOT 2217 MM 5\nMONTAT MICHELIN 245 40 18	2026-04-17 07:42:11.622893+00	246.00	f	\N	2026-04-17 07:43:24.390433+00	CARD	\N	741	ASC-D	888		0		0	\N	2
1173	2	DJ17JOJ	\N	\N	2026-04-17 07:40:27.409175+00	64.00	f	\N	2026-04-17 07:43:01.565567+00	CASH	\N	740	ASC-D	887		0		0	\N	2
1162	2	DJ25DAO	\N	\N	2026-04-17 07:02:15.08147+00	250.00	f	\N	2026-04-17 07:55:57.809776+00	CASH	\N	731		0		0		0	\N	2
1267	2	DJ22BEC	\N	\N	2026-04-20 07:45:18.728416+00	120.00	f	\N	2026-04-20 07:50:19.277793+00	CARD	\N	833		0		0		0	\N	2
1269	2	DJ22LXA	\N	\N	2026-04-20 07:50:57.523983+00	580.00	f	\N	2026-04-20 08:53:04.222748+00	CARD	\N	835	ASC-D	945		0		0	\N	2
1175	2	SB88KON	\N	ANVELOPE CLIENT CONTINENTAL 205/75/16C 8MM 4BARI	2026-04-17 07:54:05.625773+00	192.00	f	\N	2026-04-17 07:55:24.596425+00	CARD	\N	742	ASC-D	889		0		0	\N	2
1419	2	B126REB	\N	CONTINENTAL 205/70/17C 6BUC SAU MONTAT\nCUSTODIE 6ANV GOODYEAR VECTOR 4SEASONS 205/70/17C DOT1524 7MM 6BUC SE SCHIMBA NUMARU DE LA MASINA DJ010357 CU B126REB	2026-04-21 11:23:00.777258+00	348.00	f	\N	2026-04-21 11:24:10.183064+00	CARD	\N	968	ASC-D	1044		0		0	\N	2
1268	2	DJ80DAV	\N	\N	2026-04-20 07:48:14.376487+00	176.00	f	\N	2026-04-20 07:49:11.444122+00	CARD	\N	834		0		0		0	\N	2
1176	2	B22FBT	\N	ANV CLIENT BRIDGESTONE ECOPIA 205 55 16 MM 7 7 7 7 PRESIUNE FATA SPATE 2,3 NM 120	2026-04-17 07:58:13.92777+00	236.00	f	\N	2026-04-17 07:59:59.365666+00	CARD	\N	743	ASC-D	890		0		0	\N	2
1177	2	DJ11YTG	\N	\N	2026-04-17 08:00:15.887463+00	70.00	f	\N	2026-04-17 08:03:03.531148+00	CASH	\N	744		0		0		0	\N	2
1178	2	DJ97REG	\N	265 35 19 245 35 19 CONTINENTAL	2026-04-17 08:06:34.756905+00	118.00	f	\N	2026-04-17 08:07:44.855977+00	CARD	\N	746		0		0		0	\N	2
1418	2	DJ18LMS	\N	\N	2026-04-21 11:23:00.546605+00	180.00	f	\N	2026-04-21 11:26:38.215422+00	OP	\N	969	ASC-D	1045		0		0	\N	2
1180	2	DJ17UYU	\N	\N	2026-04-17 08:16:56.493868+00	148.00	f	\N	2026-04-17 08:20:19.169743+00	CASH	\N	749		0		0		0	\N	2
1270	2	DJ22BNC	\N	4 ANVELOPE 285 40 22 DOT 03 25 MM 6 325 35 22 DOT 16 24 MM 6 MICHELIN	2026-04-20 08:03:10.024074+00	468.00	f	\N	2026-04-20 08:04:31.523294+00	CARD	\N	831	ASC-D	940		0		0	\N	2
1553	2	DJ23MLS	\N	\N	2026-04-23 07:37:23.877678+00	4892.00	f	\N	2026-04-23 08:26:53.983582+00	OP	\N	1107	ASC-D	1162		0		0	\N	2
1298	2	DJ98FDS	\N	\N	2026-04-20 10:52:16.047545+00	180.00	f	\N	2026-04-20 10:56:23.341583+00	CARD	\N	861	ASC-D	957		0		0	\N	2
1437	2	OT24RSM	\N	\N	2026-04-21 12:32:45.007277+00	120.00	f	\N	2026-04-21 12:35:14.322409+00	CASH	\N	986	ASC-D	1060		0		0	\N	2
1304	2	DJ18XDS	\N	4 ANVELOPE 235 50 19 HANKOOK DOT 25 25 MM 6	2026-04-20 11:04:49.079478+00	374.00	f	\N	2026-04-20 11:05:49.696965+00	CARD	\N	860	ASC-D	960		0		0	\N	2
1320	2	DJ01BOM	\N	\N	2026-04-20 12:35:56.776277+00	120.00	f	\N	2026-04-20 12:37:00.472022+00	CARD	\N	878		0		0		0	\N	2
1310	2	DJ31SFA	\N	\N	2026-04-20 11:48:54.209955+00	1720.00	t	2026-04-20 13:21:55.018288+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
1543	2	OT10FAB	\N	ANV MONTATE  PIRELLI PZ4 285 40 22 315 35 22  MM 6 6 4  4 PRESIUNE FATA SPATE  2,3 NM 160  \nCUSTODIE AN  V CONTI WINTER CONTACT   TS 860 285 40  22 315 35 22 DOT 35 25 MM  8 8 8 8	2026-04-23 06:08:41.737151+00	508.00	f	\N	2026-04-23 06:09:39.54342+00	CASH	\N	1091	ASC-D	1152		0		0	\N	2
1333	2	TM14MEW	\N	\N	2026-04-20 13:27:47.939641+00	132.00	f	\N	2026-04-20 13:30:26.775351+00	OP	\N	886	ASC-D	977		0		0	\N	2
1302	2	DJ03VRD	\N	\N	2026-04-20 11:00:59.816327+00	3488.00	f	\N	2026-04-20 14:47:57.226619+00	OP	\N	\N	ASC-D	959		0		0	\N	2
1452	2	DJ11MTY	\N	CUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU MICHELIN ALPIN A4 185/60/15 DOT3416 5MM 4BUC	2026-04-22 05:34:58.902968+00	2266.00	f	\N	2026-04-22 06:05:46.187252+00	CARD	\N	1008	ASC-D	1077		0		0	\N	2
1362	2	B125SXV	\N	\N	2026-04-21 06:37:44.768435+00	208.00	f	\N	2026-04-21 06:42:11.874271+00	OP	\N	922	ASC-D	1001		0		0	\N	2
1459	2	GJ23BRD	\N	\N	2026-04-22 05:58:54.750596+00	46.00	f	\N	2026-04-22 06:36:37.691149+00	CASH	\N	1007	ASC-D	1079		0		0	\N	2
1370	2	B135RNV	\N	\N	2026-04-21 07:11:49.791144+00	116.00	f	\N	2026-04-21 07:17:37.304101+00	CARD	\N	599		0		0		0	\N	2
1610	2	DJ86ERH	\N	CONTINENTAL 215 65 17	2026-04-24 06:09:46.257441+00	176.00	f	\N	2026-04-24 06:10:25.653819+00	CARD	\N	1153	ASC-D	1205		0		0	\N	2
1390	2	DJ67MAJ	\N	\N	2026-04-21 08:57:17.06827+00	150.00	f	\N	2026-04-21 08:59:23.918009+00	CASH	\N	947	ASC-D	1023		0		0	\N	2
1473	2	DJ18FEG	\N	\N	2026-04-22 08:01:37.437984+00	160.00	f	\N	2026-04-22 08:03:30.401571+00	CARD	\N	1022	ASC-D	1088		0		0	\N	2
1415	2	DJ18DWV	\N	\N	2026-04-21 11:01:41.847066+00	96.00	f	\N	2026-04-21 11:03:51.154014+00	CASH	\N	965		0		0		0	\N	2
1416	2	IS36ACG	\N	\N	2026-04-21 11:03:33.211136+00	136.00	f	\N	2026-04-21 11:04:48.237776+00	CASH	\N	966	ASC-D	1041		0		0	\N	2
1571	2	DJ01LCC	\N	CUSTODIE 4 ANV MICHELIN PIL ALP 5 SUV 235 55 19 DOT 2921 MM 6	2026-04-23 09:57:07.181386+00	2734.00	f	\N	2026-04-23 10:35:26.158701+00	CARD	\N	1121	ASC-D	1176		0		0	\N	2
1554	2	DJ89MLS	\N	\N	2026-04-23 07:43:45.578379+00	188.00	f	\N	2026-04-23 07:59:19.905837+00	OP	\N	1100		0		0		0	\N	2
1496	2	DJ03BDS	\N	\N	2026-04-22 10:07:19.28005+00	200.00	f	\N	2026-04-22 10:08:50.221295+00	CARD	\N	1045	ASC-D	1111		0		0	\N	2
1519	2	DJ45ELF	\N	\N	2026-04-22 12:26:17.182095+00	2288.00	f	\N	2026-04-22 13:48:48.732349+00	OP	\N	\N		0		0		0	\N	2
1647	2	VL58SKY	\N	ROTI COMPLETE CONTINENTAL 215/60/16 4BUC SAU MONTAT\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU KUMHO WINTERCRAFT 215/60/17 DOT2525 7MM 4BUC	2026-04-24 09:24:25.831439+00	226.00	f	\N	2026-04-24 09:26:13.146735+00	CASH	\N	1187	ASC-D	1235		0		0	\N	2
1555	2	DJ12GDB	\N	2X25=50 LEI  (2 COTURI )\n1X25=25 LEI  (1 ESTENSIE )	2026-04-23 07:55:31.357971+00	2030.00	f	\N	2026-04-23 08:08:42.654189+00	OP	\N	1102	ASC-D	1163		0		0	\N	2
1633	2	DJ17CCE	\N	ANVELOPE CLIENT\nCONTINENTAL 185/65/15 6MM	2026-04-24 08:04:32.338292+00	76.00	f	\N	2026-04-24 08:06:09.502235+00	CARD	\N	\N		0		0		0	\N	2
1540	2	DJ12TDT	\N	\N	2026-04-23 05:50:49.599991+00	3796.00	f	\N	2026-04-23 08:12:51.842225+00	CARD	\N	1089	ASC-D	1153		0		0	\N	2
1539	2	DJ75PTC	\N	\N	2026-04-23 05:45:33.699295+00	180.00	f	\N	2026-04-23 05:50:11.662966+00	CASH	\N	1088	ASC-D	1149		0		0	\N	2
1632	2	DJ12MWK	\N	\N	2026-04-24 08:03:37.589312+00	56.00	f	\N	2026-04-24 08:06:24.097969+00	CASH	\N	1171	ASC-D	1226		0		0	\N	2
1537	2	DJ26SHA	\N	\N	2026-04-23 05:26:03.173457+00	2142.00	f	\N	2026-04-23 08:13:15.998338+00	CASH	\N	1087	ASC-D	1148		0		0	\N	2
1608	2	DJ05SHY	\N	4 ANVELOPE HANKOK WINTER DOT 3325 MM 7	2026-04-24 05:59:19.959178+00	2268.00	f	\N	2026-04-24 06:43:13.854859+00	CARD	\N	1155	ASC-D	1210		0		0	\N	2
1589	2	DJ17HJD	\N	\N	2026-04-23 11:57:40.176245+00	264.00	f	\N	2026-04-23 12:23:58.24791+00	CASH	\N	1135	ASC-D	1189		0		0	\N	2
1593	2	DJ14YUY	\N	\N	2026-04-23 12:37:29.296272+00	132.00	f	\N	2026-04-23 12:47:01.337823+00	CASH	\N	1139		0		0		0	\N	2
1590	2	DJ01NNN	\N	CUSTODIE ANV JANTE MICHELIN PILOT ALPIN 5 SUV 275 50 20 MM 7 7 7 7 DOT 3025	2026-04-23 12:04:31.912696+00	200.00	f	\N	2026-04-23 13:14:19.748442+00	CASH	\N	1136	ASC-D	1195		0		0	\N	2
1668	2	DJ11DAX	\N	275 40 19 BUC 2 HANKOOK 245 45 19 BUC 2	2026-04-24 11:36:01.285302+00	208.00	f	\N	2026-04-24 12:05:09.904249+00	CASH	\N	1208	ASC-D	1250		0		0	\N	2
1631	2	OT41CCP	\N	CUSTODIE 4 ANV MICHELIN LATITUDE 255 50 20 DOT 2620 MM 5	2026-04-24 07:52:22.380404+00	374.00	f	\N	2026-04-24 07:57:14.565989+00	OP	\N	1170	ASC-D	1225		0		0	\N	2
1662	2	DJ08WOW	\N	DUNLOP 205 55 16	2026-04-24 11:04:37.843724+00	136.00	f	\N	2026-04-24 12:46:15.943581+00	CARD	\N	1202	ASC-D	1245		0		0	\N	2
1679	2	DJ54DRC	\N	315 35 21 PIRELI 2BUC 275 40 21 PIRELLI 2BUC	2026-04-24 12:47:42.934434+00	160.00	f	\N	2026-04-24 12:49:12.9933+00	CARD	\N	1219	ASC-D	1259		0		0	\N	2
1682	2	DJ47DNI	\N	\N	2026-04-24 12:59:16.10411+00	96.00	f	\N	2026-04-24 13:00:17.411774+00	CASH	\N	1222		0		0		0	\N	2
1688	2	DJ51TAB	\N	\N	2026-04-24 13:29:07.459358+00	176.00	f	\N	2026-04-24 13:32:07.27628+00	CARD	\N	1224		0		0		0	\N	2
1693	2	DJ89ABO	\N	HANKOOK VENTUS 225 55 18	2026-04-24 14:08:35.860899+00	168.00	f	\N	2026-04-24 14:09:04.601556+00	CASH	\N	1233	ASC-D	1268		0		0	\N	2
1696	2	DJ20WAA	\N	CUSTODIE 4 ANV MICHELIN ALP 7 225 45 17 DOT 28 25 MM 7\nMONTAT MICHELIN 225 45 17	2026-04-27 05:36:43.118992+00	308.00	f	\N	2026-04-27 05:52:57.10403+00	CASH	\N	1235	ASC-D	1271		0		0	\N	2
1699	2	B134ELC	\N	RIKEN 205 60 16	2026-04-27 05:59:47.789155+00	76.00	f	\N	2026-04-27 06:05:04.964241+00	OP	\N	1239	ASC-D	1274		0		0	\N	2
1715	2	DJ04EDJ	\N	CONTINENTAL 185 65 15	2026-04-27 07:36:25.752608+00	136.00	f	\N	2026-04-27 07:39:58.758009+00	CARD	\N	1251	ASC-D	1284		0		0	\N	2
1720	2	B740KWR	\N	\N	2026-04-27 08:03:01.921195+00	136.00	f	\N	2026-04-27 08:52:28.063947+00	OP	\N	1256	ASC-D	1295		0		0	\N	2
1723	2	GJ03LWX	\N	\N	2026-04-27 08:23:00.529829+00	76.00	f	\N	2026-04-27 08:46:37.019061+00	CARD	\N	1259	ASC-D	1294		0		0	\N	2
1195	2	DJ55ARU	\N	\N	2026-04-17 09:43:12.439007+00	980.00	f	\N	2026-04-17 10:47:34.150655+00	CARD	\N	763	ASC-D	900		0		0	\N	2
1192	2	DJ29EGE	\N	225 50 18 PIRELLI	2026-04-17 09:36:52.344613+00	96.00	f	\N	2026-04-17 09:38:31.335742+00	CARD	\N	760		0		0		0	\N	2
1168	2	DJ58PMD	\N	CUSTODTE 4ANV MICHELIN PILOT ALPIN 5 275/45/21 4MM DOT2721 2BUC 315/40/21 DOT3421 6MM 2BUC SE SCHIMBA NUMARU DE LA MASINA B999PMD CU DJ58PMD	2026-04-17 07:16:12.414773+00	6900.00	f	\N	2026-04-17 08:05:15.379332+00	CARD	\N	745	ASC-D	891		0		0	\N	2
1219	2	DJ06DFX	\N	275 40 21 MICHELIN	2026-04-17 12:08:10.995598+00	160.00	f	\N	2026-04-17 12:13:46.061347+00	CARD	\N	784		0		0		0	\N	2
1201	2	DJ76MIR	\N	\N	2026-04-17 10:04:32.078117+00	180.00	f	\N	2026-04-17 10:11:16.718895+00	CASH	\N	769	ASC-D	904		0		0	\N	2
1179	2	DJ01TTB	\N	\N	2026-04-17 08:13:48.963822+00	180.00	f	\N	2026-04-17 08:20:08.919068+00	CASH	\N	748		0		0		0	\N	2
1181	2	DJ93NCT	\N	ANV MONTATE HANKOOK VENTUS 205 60 16 MM 6 6 6 6 PRESIUNE FATA SPATE 2,3	2026-04-17 08:23:00.609234+00	132.00	f	\N	2026-04-17 08:24:12.789136+00	CARD	\N	750		0		0		0	\N	2
1183	2	DJ74ELF	\N	\N	2026-04-17 08:33:37.882238+00	192.00	f	\N	2026-04-17 08:38:19.336014+00	OP	\N	751		0		0		0	\N	2
1194	2	DJ09ZAM	\N	MICHELIN LATITUDE ALPIN 255/50/19 5MM DOT=4417 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )\n\nMICHELIN LATITUDE SPORT 255/50/19 6MM 2,4 BARI	2026-04-17 09:41:41.518684+00	320.00	f	\N	2026-04-17 09:44:00.403452+00	CARD	\N	762	ASC-D	896		0		0	\N	2
1182	2	B76YND	\N	\N	2026-04-17 08:26:35.887851+00	196.00	f	\N	2026-04-17 08:40:07.300617+00	CASH	\N	747	ASC-D	892		0		0	\N	2
1197	2	DJ15ZWZ	\N	\N	2026-04-17 09:45:44.567948+00	1168.00	f	\N	2026-04-17 11:50:15.764362+00	CARD	\N	765	ASC-D	901		0		0	\N	2
1204	2	DJ14VNK	\N	ANVELOPE CLIENT  KUMHO 225/55/18 6MM	2026-04-17 10:25:51.06885+00	176.00	f	\N	2026-04-17 10:27:23.323498+00	CASH	\N	773	ASC-D	905		0		0	\N	2
1184	2	DJ20CHR	\N	BFGOODRICH 225/50/17 SAU MONTAT 4BUC\nCUSTODIE 4JANTE OTEL+4ANV+4CAPACE DIPLOMAT WINTER205/55/16 DOT2920 6MM1BUC GISLAVED EURO FROST 205/55/16DOT4418MM6 3BUC	2026-04-17 08:46:06.431848+00	246.00	f	\N	2026-04-17 08:48:59.196915+00	CARD	\N	753		0		0		0	\N	2
1185	2	DJ15JFV	\N	\N	2026-04-17 08:46:21.362235+00	180.00	f	\N	2026-04-17 08:52:05.549301+00	OP	\N	754		0		0		0	\N	2
1209	2	DJ08VSE	\N	ANV CLIENT BRIDGESTONE 235/60/18 4BUC MONTATE	2026-04-17 10:49:07.764919+00	176.00	f	\N	2026-04-17 10:49:30.982179+00	CASH	\N	778		0		0		0	\N	2
1187	2	B76YND	\N	\N	2026-04-17 08:56:09.527974+00	120.00	f	\N	2026-04-17 08:58:05.424097+00	CASH	\N	747		0		0		0	\N	2
1188	2	DJ96DCL	\N	ANV CLIENT MICHELIN PRIMACY 3 215 60 17MM 6 6 5  5PRESIUNE FATA SPATE NM 120	2026-04-17 08:57:12.767836+00	176.00	f	\N	2026-04-17 08:59:46.538727+00	CARD	\N	756		0		0		0	\N	2
1186	2	DJ66GMI	\N	\N	2026-04-17 08:54:38.966107+00	168.00	f	\N	2026-04-17 09:46:22.858596+00	CARD	\N	752	ASC-D	897		0		0	\N	2
1189	2	DJ93REI	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE 20 PREZOANE MICH ALP 6 205 55 16 DOT 2119 MM 5\nMONTAT MICHELIN 205 55 16	2026-04-17 09:09:47.718218+00	226.00	f	\N	2026-04-17 09:13:02.313368+00	CARD	\N	758	ASC-D	894		0		0	\N	2
1193	2	DJ66GMI	\N	\N	2026-04-17 09:39:38.455987+00	60.00	f	\N	2026-04-17 09:46:44.838875+00	CARD	\N	761	ASC-D	898		0		0	\N	2
1190	2	DJ28AEB	\N	ANV CLIENT  MICHELIN PRIMACY4 205 55 16 MM 8 8 8 8 PRESIUNE FATA SPATE 2,3 NM 111	2026-04-17 09:18:25.57436+00	72.00	f	\N	2026-04-17 09:19:06.707615+00	CASH	\N	759		0		0		0	\N	2
1205	2	DJ20HIM	\N	ANV MONTATE MICHELIN PILOT SPORT 4 ZP 245 40 19 275 35 19 MM 8 8  8 8 PRESIUNE 2,4 FATA SPATE NM 140 \nCUSTODIE ANV MICHELIN PILOT ALPIN 245 45 18 4319 MM 3 3 3 3	2026-04-17 10:30:58.026199+00	653.00	f	\N	2026-04-17 10:31:47.869448+00	CARD	\N	774	ASC-D	906		0		0	\N	2
1191	2	B444NDN	\N	\N	2026-04-17 09:30:17.477659+00	136.00	f	\N	2026-04-17 09:35:33.488792+00	CASH	\N	757	ASC-D	895		0		0	\N	2
1198	2	DJ13BMW	\N	\N	2026-04-17 09:50:39.282124+00	568.00	f	\N	2026-04-17 09:55:15.216601+00	CASH	\N	766	ASC-D	899		0		0	\N	2
1199	2	DJ83DRO	\N	\N	2026-04-17 09:55:08.785131+00	96.00	f	\N	2026-04-17 09:55:58.864736+00	CARD	\N	767		0		0		0	\N	2
1203	2	DJ96LAM	\N	\N	2026-04-17 10:09:52.828326+00	1176.00	f	\N	2026-04-17 11:59:24.641565+00	CASH	\N	771	ASC-D	913		0		0	\N	2
1200	2	DJ16YJO	\N	215 55 18 CONTINENTAL	2026-04-17 10:04:05.576798+00	176.00	f	\N	2026-04-17 10:04:44.568154+00	CASH	\N	768		0		0		0	\N	2
1206	2	DJ76FLA	\N	205 60 16 CONTINENTAL	2026-04-17 10:32:53.361206+00	136.00	f	\N	2026-04-17 10:35:04.959228+00	CARD	\N	775		0		0		0	\N	2
1202	2	DJ08GLD	\N	MICHLIN 225/60/18 4BUC SAU MONTAT\nCUSTODIE 4ANV MICHELIN ALPIN 7 DOT 3225 7MM	2026-04-17 10:06:18.429536+00	316.00	f	\N	2026-04-17 10:07:08.500641+00	CARD	\N	770	ASC-D	903		0		0	\N	2
1211	2	SB53CCI	\N	\N	2026-04-17 11:01:00.848295+00	136.00	f	\N	2026-04-17 11:03:20.271036+00	CARD	\N	742	ASC-D	909		0		0	\N	2
1216	2	DJ82AUG	\N	CUSTODIE 4 ANV MOTRIO WINTER 185 65 15 DOT 4318 MM 5\nMONTAT 205 60 15 HANKOOK	2026-04-17 11:43:06.220428+00	256.00	f	\N	2026-04-17 11:43:52.64074+00	CASH	\N	781	ASC-D	910		0		0	\N	2
1207	2	DJ15HGW	\N	\N	2026-04-17 10:33:03.601627+00	98.00	f	\N	2026-04-17 10:37:28.731737+00	OP	\N	772	ASC-D	907		0		0	\N	2
1212	2	SB64CCI	\N	HANKOOK 205 60 16	2026-04-17 11:12:11.53391+00	136.00	f	\N	2026-04-17 11:14:02.735408+00	CARD	\N	779		0		0		0	\N	2
1208	2	DJ35NOA	\N	\N	2026-04-17 10:36:17.457467+00	168.00	f	\N	2026-04-17 10:47:04.169841+00	CASH	\N	776	ASC-D	908		0		0	\N	2
1221	2	DJ01ELM	\N	\N	2026-04-17 12:16:07.326272+00	132.00	f	\N	2026-04-17 12:16:54.515919+00	OP	\N	786		0		0		0	\N	2
1213	2	DJ82MDL	\N	4ANV CONTINENTAL195/60\\15 5MM DOT1823	2026-04-17 11:16:06.654873+00	252.00	f	\N	2026-04-17 11:19:26.399006+00	CASH	\N	777		0		0		0	\N	2
1210	2	DJ66BKS	\N	MICHE PILOT ALPIN 4 225/55/17 MM7 DOT 3524 4 BUC (4JANTE+4ANV FARA CAPACE)	2026-04-17 10:56:44.131006+00	2032.00	f	\N	2026-04-17 11:48:33.022856+00	CARD	\N	782	ASC-D	911		0		0	\N	2
1215	2	DJ77MYM	\N	ANV CLIENT MICHELIN 225/55/17 4BUC MONTATE	2026-04-17 11:29:49.139806+00	168.00	f	\N	2026-04-17 11:30:23.554543+00	CARD	\N	780		0		0		0	\N	2
1196	2	DJ16SUI	\N	\N	2026-04-17 09:44:10.496442+00	2708.00	f	\N	2026-04-17 12:07:22.454168+00	CARD	\N	764	ASC-D	902		0		0	\N	2
1218	2	B09DXC	\N	ANV MONTATE CONTI PREMIUM CONTACT 6 325 40 22 285 45 22 MM  4 4 5 5  \nCUSTODIE ANV MICHELIN PILOT ALPIN 5 SUV 325 40 2 285 45 22 MM 6 6 6 6 DOT 3623  MASINA E FACUTA CU CATALIN	2026-04-17 11:55:16.08802+00	748.00	f	\N	2026-04-17 11:57:35.569137+00	OP	\N	783	ASC-D	912		0		0	\N	2
1222	2	DJ07LWR	\N	ANV CLIENT PETLAS 195/60/16C  2BUC	2026-04-17 12:26:39.877559+00	96.00	f	\N	2026-04-17 12:27:10.549942+00	CASH	\N	787		0		0		0	\N	2
1214	2	DJ08AXG	\N	\N	2026-04-17 11:23:59.93883+00	3416.00	f	\N	2026-04-17 13:27:25.671545+00	CARD	\N	795	ASC-D	915		0		0	\N	2
1220	2	DJ18XOV	\N	4ANVKUMHO 175\\65\\14  4MM   DOT2425	2026-04-17 12:13:24.137134+00	224.00	f	\N	2026-04-17 12:22:44.168523+00	CASH	\N	785	ASC-D	914		0		0	\N	2
1223	2	SB21KON	\N	\N	2026-04-17 12:49:03.516272+00	132.00	f	\N	2026-04-17 12:51:34.589468+00	CARD	\N	789		0		0		0	\N	2
1224	2	DJ03PSA	\N	\N	2026-04-17 12:59:17.737086+00	180.00	f	\N	2026-04-17 13:02:15.315609+00	CASH	\N	790		0		0		0	\N	2
1225	2	DJ08KOD	\N	235 40 18 MICHELIN	2026-04-17 13:04:09.102428+00	208.00	f	\N	2026-04-17 13:05:23.452862+00	CASH	\N	791		0		0		0	\N	2
1226	2	VL78MWM	\N	CUSTODIE ANV JANTE CAPACE KUMHO WINTER CRAFT 225 50 18   MM8 8 8 8 8 DOT 34 25	2026-04-17 13:07:39.489843+00	2912.00	f	\N	2026-04-17 13:13:31.521738+00	CARD	\N	792	ASC-D	916		0		0	\N	2
1300	2	DJ93ASC	\N	\N	2026-04-20 10:53:26.388901+00	3600.00	t	2026-04-20 10:54:36.310133+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
1228	2	CJ62TLW	\N	BARUM 4ANV 205\\55\\16 6MM DOT 3922	2026-04-17 13:12:59.743864+00	256.00	f	\N	2026-04-17 13:19:55.673584+00	OP	\N	788	ASC-D	917		0		0	\N	2
1227	2	DJ32RDA	\N	\N	2026-04-17 13:12:15.012942+00	120.00	f	\N	2026-04-17 13:14:41.329633+00	CARD	\N	793		0		0		0	\N	2
1230	2	DJ70SML	\N	\N	2026-04-17 13:28:15.937756+00	120.00	f	\N	2026-04-17 13:31:57.429939+00	CASH	\N	796		0		0		0	\N	2
1229	2	DJ05CXX	\N	4JANTE ALIAJ 4ANV 4CAPACE CENTRU MICHELIN 225 65 17 7MM DOT 2721	2026-04-17 13:20:17.770924+00	256.00	f	\N	2026-04-17 13:21:02.830777+00	CARD	\N	794	ASC-D	918		0		0	\N	2
1369	2	DJ02ABM	\N	\N	2026-04-21 07:01:23.021279+00	176.00	f	\N	2026-04-21 07:02:20.709897+00	CASH	\N	924	ASC-D	1005		0		0	\N	2
1231	2	DJ71NKY	\N	ANVELOPE CLIENT MICHELIN E-PRIMACY 195/55/16 8MM 2,4 BARI	2026-04-17 13:32:02.722792+00	256.00	f	\N	2026-04-17 13:32:48.516055+00	CASH	\N	798		0		0		0	\N	2
1241	2	TC233224	\N	ANV MONTATE BRIDGESTONE TURANZA 225 65 17 MM 7 7 7 7 PRESIUNE FATA SPATE 2,4 NM 130 \nCUSTODIE ANV NOKIAN SNOWPPOF 2 SUV 225 65 17 MM 7 7 7 7 DOT 3025	2026-04-17 14:40:48.008365+00	316.00	f	\N	2026-04-17 14:41:05.375385+00	CARD	\N	808	ASC-D	924		0		0	\N	2
1239	2	DJ18WIB	\N	\N	2026-04-17 14:15:56.373456+00	64.00	f	\N	2026-04-17 15:51:19.603997+00	CASH	\N	806		0		0		0	\N	2
1232	2	DJ09LPX	\N	CUSTODIE NOUA 4 ANV LANDSAIL WINTER 205 55 16 DOT 2120 MM 6\nMONTAT LANDSAIL 205 55 16	2026-04-17 13:39:01.48681+00	280.00	f	\N	2026-04-17 13:41:15.255055+00	CASH	\N	799	ASC-D	919		0		0	\N	2
1244	2	DJ55KLS	\N	ANV MONTATE MICHELIN PILOT SPORT 5 215 45 18 MM 7 77 8 PRESIUNE FATA SPATE 2,5 NM 120 \nCUSTODIE ANV JANTE CAPACE MICHELIN  PILOT ALPIN  205 60 16 MM 7 7 7 7 DOT3025	2026-04-20 05:42:15.743913+00	1044.00	f	\N	2026-04-20 05:54:19.338791+00	CARD	\N	812	ASC-D	928		0		0	\N	2
1217	2	DJ94RNO	\N	ANV CUSTODIE ANV MICHELIN PILOT ALPIN 5 SUV 225 50 18 MM 5 5 5 5 DOT 4222	2026-04-17 11:52:18.18023+00	3340.00	f	\N	2026-04-17 13:48:21.469866+00	CARD	\N	800	ASC-D	920		0		0	\N	2
1323	2	OT91AXG	\N	ANVELOPE CLIENT\nLAUFEN 205/55/16 8MM\n\n\n\n1X10 LEI   ( 1 PREZON=09801F)	2026-04-20 12:53:17.177168+00	106.00	f	\N	2026-04-20 12:54:01.881186+00	CARD	\N	882		0		0		0	\N	2
1243	2	DJ10DCO	\N	225 55 19 GOODIEAR	2026-04-20 05:39:32.664287+00	120.00	f	\N	2026-04-20 05:40:50.044756+00	CASH	\N	811	ASC-D	925		0		0	\N	2
1242	2	DJ43NTA	\N	\N	2026-04-20 05:34:45.37004+00	300.00	f	\N	2026-04-20 05:41:26.282358+00	OP	\N	810	ASC-D	926		0		0	\N	2
1237	2	DJ22XAS	\N	ANV CLIENT GITI 215 60 16 MM 7 7 7 7 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-17 14:04:17.447479+00	88.00	f	\N	2026-04-17 14:05:41.159624+00	CASH	\N	804		0		0		0	\N	2
1234	2	DJ26GHF	\N	BRIDGESTONE 245/50/19 6MM DOT=2922 ( CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE )\n\nPIRELI PZERO 275/40/20 5MM\nPIRELI PZERO 245/45/20 5MM	2026-04-17 13:59:50.137291+00	320.00	f	\N	2026-04-17 14:06:25.760235+00	CARD	\N	803	ASC-D	921		0		0	\N	2
1235	2	JOK	\N	\N	2026-04-17 13:59:55.365005+00	756.00	f	\N	2026-04-17 14:07:40.398189+00	PARTIAL	500.00	802		0		0		0	\N	2
1236	2	DJ16CDV	\N	\N	2026-04-17 14:02:55.560602+00	160.00	f	\N	2026-04-17 14:08:16.48043+00	CASH	\N	801		0		0		0	\N	2
1336	2	DJ85SBM	\N	\N	2026-04-20 13:31:10.82802+00	176.00	f	\N	2026-04-20 13:33:34.036643+00	CARD	\N	894		0		0		0	\N	2
1271	2	DJ21ASI	\N	ANV MONTATE BRIDGESTONE DUELAR HP SPORT 235 45 19 MM 6 6 6 6 DOT VECHI 2018   NM 140 \nCUSTODIE ANV  PIRELLI SOTTO ZERO WINTER 235 45 19 MM 7 7 6 6 DOT 3520	2026-04-20 08:18:03.835426+00	366.00	f	\N	2026-04-20 08:18:49.891794+00	CARD	\N	836	ASC-D	941		0		0	\N	2
1238	2	DJ31PES	\N	ROTI COMPLETE CONTINENTAL 255/40/20 4BUC MONTATE\nCUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU MICHELIN ALPIN7 DOT2825 7MM  4BUC	2026-04-17 14:10:12.961625+00	260.00	f	\N	2026-04-17 14:12:23.238139+00	CARD	\N	805	ASC-D	922		0		0	\N	2
1373	2	B121JSC	\N	\N	2026-04-21 07:23:32.799749+00	136.00	f	\N	2026-04-21 07:25:42.275184+00	OP	\N	930	ASC-D	1008		0		0	\N	2
1240	2	DJ29EXV	\N	CUSTODIE 4ANV HANKOOK WINTER 225 60 18 DOT 1923 MM 6\nHANKOOK 225 60 18	2026-04-17 14:19:29.713322+00	316.00	f	\N	2026-04-17 14:23:12.013859+00	CARD	\N	807	ASC-D	923		0		0	\N	2
1272	2	OT41ULI	\N	\N	2026-04-20 08:19:47.112932+00	120.00	f	\N	2026-04-20 08:25:53.63402+00	CASH	\N	838	ASC-D	942		0		0	\N	2
1337	2	DJ88MTZ	\N	\N	2026-04-20 13:35:23.65424+00	300.00	f	\N	2026-04-20 13:39:55.522203+00	CASH	\N	895	ASC-D	978		0		0	\N	2
1301	2	DJ23DKU	\N	ANVELOPE CLIENT\nHANKOOK 275/40/20 5MM 2BUC\nHANKOOK 315/35/20 5MM 2BUC	2026-04-20 10:57:05.773167+00	216.00	f	\N	2026-04-20 10:58:01.224585+00	CASH	\N	864	ASC-D	958		0		0	\N	2
1293	2	OT92DRE	\N	\N	2026-04-20 10:20:52.766973+00	1820.00	f	\N	2026-04-20 11:08:03.330975+00	CASH	\N	863	ASC-D	961		0		0	\N	2
1393	2	DJ01MSW	\N	FALKEN 205/65/16 6MM 2,5 BARI\n\nKUMHO WINTER. 205/65/16 6MM DOT=2524 ( CUSTODIE.. 4 ANVELOPE )	2026-04-21 09:04:09.660248+00	268.00	f	\N	2026-04-21 09:08:37.197857+00	CASH	\N	949	ASC-D	1024		0		0	\N	2
1305	2	DJ73MCR	\N	ANV CLIENT E PRIMACY 225 50 19 MM 8 8 8 8  PRESIUNE FATA SPATE 2,4 NM 120	2026-04-20 11:09:49.159171+00	256.00	f	\N	2026-04-20 11:11:47.456227+00	CASH	\N	865	ASC-D	962		0		0	\N	2
1329	2	DJ30BEK	\N	\N	2026-04-20 13:23:04.546923+00	1586.00	f	\N	2026-04-20 13:43:52.025514+00	OP	\N	897	ASC-D	980		0		0	\N	2
1366	2	DJ01KJW	\N	\N	2026-04-21 06:52:22.958312+00	2620.00	f	\N	2026-04-21 07:35:26.691767+00	CASH	\N	928	ASC-D	1009		0		0	\N	2
1476	2	OT11RLK	\N	ANV MONTATE KUMHO PS71 225 40 18 MM 7 7 7 7PRESIUNE FATA SPATE 2,5 NM 120 \nCUSTODIE ANV  MICHELIN PILOT ALPIN 5 225 40 18 MM 5 5 4 4 DOT2821	2026-04-22 08:10:06.98568+00	308.00	f	\N	2026-04-22 08:12:46.870577+00	CASH	\N	1025	ASC-D	1091		0		0	\N	2
1441	2	DJ14YKS	\N	\N	2026-04-21 13:04:26.215925+00	250.00	f	\N	2026-04-21 13:09:02.336358+00	CARD	\N	990		0		0		0	\N	2
1363	2	DJ92HER	\N	CUSTODIE 4 ANV MICH ALP 6 205 60 16 DOT 1523 MM 6\nMONTAT FALKEN 215 60 16	2026-04-21 06:40:48.506804+00	268.00	f	\N	2026-04-21 06:42:40.002721+00	CARD	\N	923	ASC-D	1002		0		0	\N	2
1364	2	DJ88DNY	\N	\N	2026-04-21 06:41:41.713464+00	132.00	f	\N	2026-04-21 06:44:49.564728+00	CASH	\N	925		0		0		0	\N	2
1455	2	DJ13ZKN	\N	MICHELIN 225/60/17 6MM\n\n\nANVELOPELE NU MAI RAMAN IN CUSTODIE	2026-04-22 05:48:56.769355+00	176.00	f	\N	2026-04-22 05:50:08.240732+00	CARD	\N	1003	ASC-D	1075		0		0	\N	2
1365	2	DJ77EZN	\N	PRESIUNE FATA SPATE2,5 NM 160	2026-04-21 06:47:27.378031+00	5088.00	f	\N	2026-04-21 07:41:59.965111+00	OP	\N	932	ASC-D	1010		0		0	\N	2
1395	2	DJ23VOT	\N	\N	2026-04-21 09:10:37.396157+00	3246.00	f	\N	2026-04-21 09:47:24.780041+00	CASH	\N	951	ASC-D	1033		0		0	\N	2
1368	2	DJ94DDP	\N	\N	2026-04-21 06:54:13.728838+00	1276.00	f	\N	2026-04-21 07:44:59.688354+00	OP	\N	933	ASC-D	1011		0		0	\N	2
1453	2	DJ77SHM	\N	4ANVBRIGESTONE 205\\55\\16 6MM DOT4220 4JANTE ALIAJ 4CAPACE LA CENTRU	2026-04-22 05:41:28.50183+00	226.00	f	\N	2026-04-22 05:42:34.093407+00	CARD	\N	1001	ASC-D	1073		0		0	\N	2
1417	2	DJ11DDD	\N	CUSTODIE 4 ANV MICHELIN PIL ALP 5SUV 275 50 20 DOT 3625 MM7\nMONTAT PIRELLI 275 50 20	2026-04-21 11:15:43.419824+00	374.00	f	\N	2026-04-21 11:16:24.337486+00	OP	\N	967	ASC-D	1042		0		0	\N	2
1521	2	DJ55TAV	\N	\N	2026-04-22 13:15:58.712239+00	300.00	f	\N	2026-04-22 13:18:53.692888+00	CASH	\N	1069		0		0		0	\N	2
1499	2	DJ08MW	\N	DEBICA 185/60/15 4ANV SAU MONTAT\nCUSTODIE TRAZANO SNOWMASTER 185/60/15 DOT2225 7MM 4ANV	2026-04-22 10:32:37.807725+00	256.00	f	\N	2026-04-22 10:35:02.6524+00	CARD	\N	1048	ASC-D	1115		0		0	\N	2
1498	2	DJ03BDS	\N	REGLAJE SPATE BLOCATE	2026-04-22 10:30:37.186165+00	180.00	f	\N	2026-04-22 10:33:14.990291+00	CARD	\N	1047	ASC-D	1114		0		0	\N	2
1538	2	DJ17TWW	\N	225 45 17 DUNLOP	2026-04-23 05:26:42.81989+00	96.00	f	\N	2026-04-23 05:28:39.042232+00	CASH	\N	1085	ASC-D	1146		0		0	\N	2
1557	2	FJ95FRT	\N	4 ANVELOPE KHUMO DE IARNA 13 23 DOT MM2 RECOMANDAM SCHIMBAREA ANVELOPELOR	2026-04-23 08:10:58.848912+00	250.00	f	\N	2026-04-23 08:12:11.950864+00	OP	\N	1103	ASC-D	1164		0		0	\N	2
1573	2	DJ67AMN	\N	4 ANVELOPE SEBRING 195\\55\\16 MM 7 DOT 39 22	2026-04-23 09:57:56.970904+00	256.00	f	\N	2026-04-23 09:59:25.955616+00	CARD	\N	1116	ASC-D	1173		0		0	\N	2
1576	2	DJ15GRJ	\N	\N	2026-04-23 10:22:12.333537+00	219.00	f	\N	2026-04-23 10:26:21.764557+00	CASH	\N	1120	ASC-D	1175		0		0	\N	2
1591	2	DJ17HJD	\N	\N	2026-04-23 12:19:23.641862+00	180.00	f	\N	2026-04-23 12:23:42.98142+00	CASH	\N	1137	ASC-D	1188		0		0	\N	2
1681	2	DJ55AIC	\N	\N	2026-04-24 12:58:17.369704+00	1660.00	t	2026-04-24 13:42:08.105404+00	2026-04-24 13:21:16.127842+00	NEPLATIT	\N	1221	ASC-D	1263		0		0	\N	2
1713	2	DJ04MVR	\N	CUSTODIE 4JANTE ALIAJ+4ANV+4CAPACE CENTRU MICHELIN PILOT ALPIN5 235/50/19 DOT2420 MM6\nMONTAT CONTINENTAL 235/50/19 4BUC	2026-04-27 07:27:07.563213+00	320.00	f	\N	2026-04-27 07:27:47.764129+00	CARD	\N	1249	ASC-D	1283		0		0	\N	2
1714	2	DJ01WPM	\N	\N	2026-04-27 07:33:32.915892+00	96.00	f	\N	2026-04-27 07:34:35.837932+00	CARD	\N	1250		0		0		0	\N	2
1718	2	DJ28MEM	\N	ANV CLIENT RIKEN 185/65/14 2BUC	2026-04-27 07:44:24.300155+00	616.00	f	\N	2026-04-27 08:27:32.817768+00	CARD	\N	1260	ASC-D	1290		0		0	\N	2
1722	2	OT54TTS	\N	\N	2026-04-27 08:08:45.077159+00	7360.00	f	\N	2026-04-27 09:24:01.436528+00	OP	\N	\N		0		0		0	\N	2
1716	2	DJ54SMD	\N	4 JANTE OTEL 4 CAPACE CENTRU 4 ANVELOPE RIKEN 205 60 16 MM 6 DOT 2717	2026-04-27 07:43:49.526322+00	214.00	f	\N	2026-04-27 07:45:44.822068+00	CARD	\N	1252	ASC-D	1285		0		0	\N	2
1721	2	DJ77WLN	\N	\N	2026-04-27 08:06:56.250207+00	104.00	f	\N	2026-04-27 08:08:30.144567+00	CASH	\N	1257		0		0		0	\N	2
1717	2	DJ68DCS	\N	ANV CLIENT CONTI VAN215 75 16C TALOANE RUPTE PRESIUNE FATA SPATE 4,5 NM 170	2026-04-27 07:44:09.717549+00	192.00	f	\N	2026-04-27 07:56:50.072127+00	OP	\N	1253	ASC-D	1287		0		0	\N	2
1719	2	B15DAL	\N	\N	2026-04-27 07:59:30.314594+00	192.00	f	\N	2026-04-27 08:02:42.244655+00	OP	\N	1255	ASC-D	1288		0		0	\N	2
1702	2	DJ86FDL	\N	CUSTODIE 4ANV 4JANTE ALIAJ 4 CAPACE KUMHO WINTER 225 55 17 DOT 1925 MM 6\nMONTAT MICHELIN 245 40 19	2026-04-27 06:33:14.582201+00	264.00	f	\N	2026-04-27 08:16:23.381266+00	CASH	\N	1242	ASC-D	1289		0		0	\N	2
1701	2	DJ72MLA	\N	ANV BRIDGESTONE ALENZA LM 001 225 65 17 MM 7 7 7 7PRESIUNE FATA  SPATE 2,3 NM 120	2026-04-27 06:26:30.224859+00	96.00	f	\N	2026-04-27 08:16:35.938133+00	CASH	\N	1241	ASC-D	1276		0		0	\N	2
1724	2	DJ03DLA	\N	\N	2026-04-27 08:30:16.433321+00	96.00	f	\N	2026-04-27 08:34:12.624099+00	CASH	\N	1258	ASC-D	1292		0		0	\N	2
1725	2	DJ30SDA	\N	\N	2026-04-27 08:35:22.940363+00	250.00	f	\N	2026-04-27 08:39:39.299272+00	CARD	\N	1262	ASC-D	1293		0		0	\N	2
1729	2	B987MIV	\N	ANV CLIENT CONTINENTAL 215/60/17 4BUC	2026-04-27 09:01:13.932039+00	176.00	f	\N	2026-04-27 09:02:14.867193+00	CARD	\N	1267	ASC-D	1296		0		0	\N	2
1728	2	DJ52WSW	\N	CUSTODIE 4 ANV. 275/45/21  315/40/21 MM 6 DOT 2424/2424/2424/2424	2026-04-27 08:57:06.985113+00	438.00	f	\N	2026-04-27 09:03:42.999679+00	CARD	\N	1266		0		0		0	\N	2
1726	2	DJ75AFR	\N	\N	2026-04-27 08:39:47.281704+00	1556.00	f	\N	2026-04-27 09:08:11.830458+00	CASH	\N	1263	ASC-D	1297		0		0	\N	2
1731	2	DJ21FCJ	\N	\N	2026-04-27 09:03:57.640105+00	156.00	f	\N	2026-04-27 09:11:27.32169+00	CARD	\N	1268		0		0		0	\N	2
1727	2	B55WSM	\N	\N	2026-04-27 08:42:55.626855+00	3083.00	f	\N	2026-04-27 10:07:55.630558+00	CARD	\N	1265	ASC-D	1302		0		0	\N	2
1730	2	DJ11EGC	\N	\N	2026-04-27 09:03:50.740903+00	694.00	f	\N	2026-04-27 11:56:20.710756+00	OP	\N	1269	ASC-D	1323		0		0	\N	2
1732	2	B265CPK	\N	\N	2026-04-27 09:12:34.276945+00	288.00	f	\N	2026-04-27 09:15:21.864147+00	CARD	\N	1264	ASC-D	1298		0		0	\N	2
1733	2	DJ01DNI	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE PIRELLI WINTER 245 45 18 DOT 4719 MM 5 BUC 2 275 40 18 BUC 2\nMONTAT 275 40 18 CU 245 45 18	2026-04-27 09:18:42.59641+00	256.00	f	\N	2026-04-27 09:19:15.776108+00	CARD	\N	1270	ASC-D	1299		0		0	\N	2
1746	2	DJ08XTZ	\N	\N	2026-04-27 10:46:51.354466+00	96.00	f	\N	2026-04-27 10:49:43.392585+00	CARD	\N	1282		0		0		0	\N	2
1734	2	DJ74KLA	\N	\N	2026-04-27 09:36:00.87863+00	120.00	f	\N	2026-04-27 09:40:36.77701+00	CASH	\N	1271		0		0		0	\N	2
1760	2	DJ08YWO	\N	\N	2026-04-27 11:54:42.80178+00	66.00	f	\N	2026-04-27 12:00:55.656896+00	CASH	\N	1296	ASC-D	1324		0		0	\N	2
1747	2	DJ18FOE	\N	ANV CLIENT BRIDGESTONE 225/45/17 4BUC SAU MONTAT	2026-04-27 10:47:30.932864+00	168.00	f	\N	2026-04-27 10:53:57.566667+00	CASH	\N	1283	ASC-D	1309		0		0	\N	2
1735	2	DJ68PPZ	\N	\N	2026-04-27 09:41:41.761597+00	328.00	f	\N	2026-04-27 09:44:40.353209+00	CARD	\N	1272	ASC-D	1300		0		0	\N	2
1738	2	B164AUA	\N	ANV CLIENT KORMORAN CARGO  225 65 16C MM 7 7 6 6 PRESIUNE FATA SPATE 4,5  NM 170	2026-04-27 10:01:07.791333+00	192.00	f	\N	2026-04-27 10:01:45.275678+00	OP	\N	1274	ASC-D	1301		0		0	\N	2
1773	2	DJ77CLR	\N	\N	2026-04-27 13:32:46.711608+00	2112.00	f	\N	2026-04-27 13:48:16.035541+00	CASH	\N	1309	ASC-D	1337		0		0	\N	2
1739	2	DJ01KWH	\N	CUSTODIE 4ANV FALKEN EUROWINTER 215/45/20 DOT3923 6MM\nMONTAT 4ANV GOODYEAR 215/35/20	2026-04-27 10:08:10.20768+00	346.00	f	\N	2026-04-27 10:08:38.468999+00	CARD	\N	1275	ASC-D	1303		0		0	\N	2
1755	2	DJ66SEM	\N	MICHELIN 255/55/18 4BUC SAU MONTAT \nANV DE IARNA NU MAI RAMAN AN CUSTODIE	2026-04-27 11:39:15.253913+00	96.00	f	\N	2026-04-27 11:40:38.21391+00	CASH	\N	1291	ASC-D	1318		0		0	\N	2
1740	2	B84SRO	\N	\N	2026-04-27 10:18:33.206945+00	318.00	f	\N	2026-04-27 10:19:20.467402+00	CARD	\N	1276	ASC-D	1304		0		0	\N	2
1767	2	CJ99HBT	\N	4 ANVELOPE CUSTODIE SEMPERIT IARNA 205 55 16 DOT 2022 MM 5	2026-04-27 12:41:29.41359+00	256.00	f	\N	2026-04-27 12:45:21.251368+00	OP	\N	1303	ASC-D	1330		0		0	\N	2
1756	2	B40ELN	\N	215 55 17 GOODIEAR	2026-04-27 11:41:04.941152+00	168.00	f	\N	2026-04-27 11:46:30.323086+00	OP	\N	1292	ASC-D	1319		0		0	\N	2
1742	2	DJ15AAN	\N	CUSTODIE NOUA 4 ANV PIRELLI SOTTOZERO 3 RSC 225 45 18 DOT 2818 MM 5\nMONTAT 225 45 18 KUMHO	2026-04-27 10:29:00.451481+00	308.00	f	\N	2026-04-27 10:30:14.625314+00	OP	\N	1279	ASC-D	1305		0		0	\N	2
1741	2	B38CBM	\N	\N	2026-04-27 10:27:41.386974+00	1048.00	f	\N	2026-04-27 11:02:32.161798+00	OP	\N	1278	ASC-D	1310		0		0	\N	2
1744	2	DJ42DAL	\N	ANV CLIENT RIKEN ROAD 185 65 15 MM 7 7 7 7 PRESIUNE FATA SPATE 2,3 NM 110	2026-04-27 10:33:35.241144+00	132.00	f	\N	2026-04-27 10:34:35.150751+00	OP	\N	1281	ASC-D	1306		0		0	\N	2
1743	2	DJ72YDA	\N	\N	2026-04-27 10:31:39.37186+00	180.00	f	\N	2026-04-27 10:37:39.821738+00	CASH	\N	1280	ASC-D	1307		0		0	\N	2
1748	2	DJ08WHO	\N	\N	2026-04-27 10:58:21.547757+00	300.00	f	\N	2026-04-27 11:03:14.839044+00	CASH	\N	1284	ASC-D	1311		0		0	\N	2
1745	2	B55WSM	\N	\N	2026-04-27 10:42:03.157991+00	250.00	f	\N	2026-04-27 10:44:24.115933+00	CARD	\N	1265	ASC-D	1308		0		0	\N	2
1750	2	DJ77DDD	\N	285 40 22 PIRELLI	2026-04-27 11:01:39.868104+00	480.00	f	\N	2026-04-27 11:03:49.243621+00	OP	\N	1286	ASC-D	1312		0		0	\N	2
1736	2	DJ42MDS	\N	\N	2026-04-27 09:47:35.112979+00	4140.00	f	\N	2026-04-27 11:05:27.490928+00	CARD	\N	1277	ASC-D	1313		0		0	\N	2
1749	2	DJ08XTZ	\N	\N	2026-04-27 11:00:17.712743+00	120.00	f	\N	2026-04-27 11:06:08.083339+00	CARD	\N	1285	ASC-D	1314		0		0	\N	2
1763	2	DJ19STM	\N	4 ANVELOPE CUSTODIE 2 275 40 20 315 315 20 CONTINENTAL WINTER DOT 2020 M 5	2026-04-27 12:10:27.793436+00	374.00	f	\N	2026-04-27 12:12:08.812335+00	CARD	\N	1298	ASC-D	1325		0		0	\N	2
1757	2	DJ04DIL	\N	ANV MONTATE DUNLOP SP SPORT MAXX 225 50 18 MM 5 5 5 5PRESIUNE FATA SPATE 2,3 NM 110     \nCUSTODIE ANV MICHELIN PILOT ALPIN 5 225 50 18       M M 6 6 6 6DOT2123	2026-04-27 11:49:31.622363+00	308.00	f	\N	2026-04-27 11:51:34.305372+00	CARD	\N	1293	ASC-D	1320		0		0	\N	2
1752	2	DJ59AAB	\N	ANV CLIENT RIKEN CARGO 235 65 16C MM 5 5 4 4 PRESIUNE FATA SPATE 4,5 NM 170	2026-04-27 11:11:22.490647+00	221.00	f	\N	2026-04-27 11:12:14.451117+00	OP	\N	1288	ASC-D	1315		0		0	\N	2
1759	2	DJ40AMB	\N	\N	2026-04-27 11:50:30.86658+00	96.00	f	\N	2026-04-27 11:51:42.488621+00	CASH	\N	1295	ASC-D	1321		0		0	\N	2
1751	2	DJ20CRK	\N	ANV. CUSTODIE  225/55/19 MICHELIN PILOT ALPIN 5 SUV MM R DOT  2921 4 BUC.	2026-04-27 11:09:40.936979+00	374.00	f	\N	2026-04-27 11:13:04.368681+00	CASH	\N	1287	ASC-D	1316		0		0	\N	2
1768	2	DJ36SMN	\N	RIKEN 205/55/16 1BUC	2026-04-27 12:52:16.083377+00	707.00	f	\N	2026-04-27 13:19:33.959136+00	CASH	\N	1306	ASC-D	1333		0		0	\N	2
1753	2	DJ03AES	\N	\N	2026-04-27 11:19:09.567628+00	96.00	f	\N	2026-04-27 11:21:26.657558+00	CARD	\N	1290		0		0		0	\N	2
1758	2	DJ90WLF	\N	\N	2026-04-27 11:49:45.41068+00	180.00	f	\N	2026-04-27 11:55:43.658367+00	CASH	\N	1294	ASC-D	1322		0		0	\N	2
1737	2	B19GRN	\N	275 30 20 GOODIEAR	2026-04-27 09:53:58.819274+00	134.00	f	\N	2026-04-27 11:57:40.291689+00	OP	\N	1273		0		0		0	\N	2
1766	2	DJ70MXM	\N	CUSTODIE ANV JANTE CAPACE YOKOHAMA WINTER 275 40 21   D    \nDOT 2020 315  35 21 2120 MM 4 4 4 4\nANV MONTATE CONTI PREMIUM CONTACT 6 275 35  22 315 30  22	2026-04-27 12:40:31.455427+00	424.00	f	\N	2026-04-27 12:41:33.745339+00	CARD	\N	1301	ASC-D	1328		0		0	\N	2
1761	2	DJ70DCI	\N	\N	2026-04-27 12:02:19.718637+00	2012.00	f	\N	2026-04-27 12:43:06.253181+00	CASH	\N	1302	ASC-D	1329		0		0	\N	2
1762	2	DJ72KOA	\N	\N	2026-04-27 12:06:48.876374+00	1368.00	f	\N	2026-04-27 12:31:10.878854+00	CASH	\N	1297	ASC-D	1326		0		0	\N	2
1769	2	DJ26AAC	\N	\N	2026-04-27 13:09:07.688795+00	132.00	f	\N	2026-04-27 13:11:30.115342+00	CARD	\N	1304	ASC-D	1331		0		0	\N	2
1765	2	DJ55DIR	\N	\N	2026-04-27 12:28:45.640914+00	300.00	f	\N	2026-04-27 12:33:26.076737+00	CARD	\N	1300	ASC-D	1327		0		0	\N	2
1754	2	DJ55DIR	\N	\N	2026-04-27 11:19:11.266056+00	2588.00	f	\N	2026-04-27 12:33:45.213175+00	CASH	\N	1289	ASC-D	1317		0		0	\N	2
1772	2	VL25BDP	\N	\N	2026-04-27 13:25:33.687126+00	180.00	f	\N	2026-04-27 13:29:38.704261+00	CASH	\N	1308	ASC-D	1335		0		0	\N	2
1764	2	DJ88TTG	\N	ANV CLIENT HANKOOK VANTRA LT 215 65 16C MM 7 7 7  7 JANTE AXA SPATE OVALIZATE PRESIUNE FATA SPATE 3,7  3,5 NM 160	2026-04-27 12:19:53.581202+00	350.00	f	\N	2026-04-27 13:23:55.372348+00	OP	\N	1299	ASC-D	1334		0		0	\N	2
1770	2	DJ42SOF	\N	225 40 18 MICHELIN	2026-04-27 13:15:59.313837+00	168.00	f	\N	2026-04-27 13:17:04.971648+00	CASH	\N	1305	ASC-D	1332		0		0	\N	2
1771	2	DJ10SMG	\N	\N	2026-04-27 13:22:05.199671+00	96.00	f	\N	2026-04-27 13:25:18.141536+00	CARD	\N	1307		0		0		0	\N	2
1774	2	DJ17YDB	\N	225 50 18 MICHELIN	2026-04-27 13:46:04.955114+00	188.00	f	\N	2026-04-27 13:47:17.037182+00	CARD	\N	1310	ASC-D	1336		0		0	\N	2
1778	2	DJ22WXS	\N	\N	2026-04-27 14:03:22.922702+00	112.00	f	\N	2026-04-27 14:04:40.952162+00	CARD	\N	1313		0		0		0	\N	2
1777	2	DJ41DAV	\N	CUSTODIE 4JANTE OTEL+4ANV+4CAPACE MICHELIN ALPIN6 195/65/15 DOT2921 6MM \nMO\nMONTAT TAURUS 195/65/15	2026-04-27 13:56:57.31264+00	226.00	f	\N	2026-04-27 13:58:47.161769+00	CARD	\N	1312	ASC-D	1338		0		0	\N	2
1775	2	B145TTG	\N	ANV CLIENT HANKOOK VANTRA LT 215 65 16C PRESIUNE FATA SPATE 3,7 3,5 NM 169	2026-04-27 13:49:39.616877+00	442.00	f	\N	2026-04-27 14:10:03.072171+00	OP	\N	1311	ASC-D	1339		0		0	\N	2
1779	2	DJ98YRD	\N	\N	2026-04-27 14:06:08.137238+00	300.00	f	\N	2026-04-27 14:14:40.378768+00	CASH	\N	1314	ASC-D	1340		0		0	\N	2
1781	2	DJ89SMI	\N	\N	2026-04-27 14:11:55.796242+00	196.00	f	\N	2026-04-27 14:13:06.620559+00	CARD	\N	1315		0		0		0	\N	2
1780	2	DJ01WIB	\N	ANV CLIENT PIRELLI ALL 225 55 17 MM 6 6 PRESIUNE FATA SPATE 2,4 NM 140	2026-04-27 14:09:04.150307+00	1672.00	f	\N	2026-04-27 14:20:03.526962+00	CARD	\N	1316	ASC-D	1341		0		0	\N	2
1776	2	DJ03GTC	\N	\N	2026-04-27 13:55:12.789406+00	1068.00	f	\N	2026-04-27 14:27:19.300091+00	OP	\N	1317	ASC-D	1342		0		0	\N	2
1782	2	DJ37KIS	\N	\N	2026-04-28 05:22:23.161604+00	64.00	f	\N	2026-04-28 05:26:26.563329+00	CARD	\N	1318		0		0		0	\N	2
1783	2	DJ25GRS	\N	\N	2026-04-28 05:30:11.227271+00	456.00	f	\N	2026-04-28 05:46:08.980106+00	OP	\N	1319	ASC-D	1344		0		0	\N	2
1799	2	B911PHA	\N	205 65 16C HANKOOK	2026-04-28 07:00:13.875308+00	192.00	f	\N	2026-04-28 07:02:53.831937+00	OP	\N	1334	ASC-D	1355		0		0	\N	2
1784	2	DJ57LXA	\N	CUSTODIE 4 ANV MICHELIN ALP7 215 60 17 DOT 3124 MM 6\nMONTAT CONTINENTAL 215 60 17	2026-04-28 05:31:12.522308+00	316.00	f	\N	2026-04-28 05:43:41.133555+00	CARD	\N	1320	ASC-D	1343		0		0	\N	2
1807	2	DJ66DPM	\N	\N	2026-04-28 07:30:46.417744+00	180.00	f	\N	2026-04-28 07:37:02.592843+00	CASH	\N	1343	ASC-D	1361		0		0	\N	2
1801	2	DJ25CCD	\N	ANV CLIENT MICHELIN E PRIMACY  234 5 45 20             M M 6 6 6          6 PRESIUNE FATA SAPTE  2,3 NM  120	2026-04-28 07:11:01.480631+00	248.00	f	\N	2026-04-28 10:52:09.543263+00	CARD	\N	1336	ASC-D	1366		0		0	\N	2
1786	2	DJ16CCR	\N	\N	2026-04-28 05:45:28.272077+00	180.00	f	\N	2026-04-28 05:47:31.930065+00	CARD	\N	1322	ASC-D	1345		0		0	\N	2
1809	2	IS80PHA	\N	ANV CLIENT PIRELLI  225 55 17 HANKOOK 225 55 17 MM 6 6 8 8 PRESIUNE FATA SPATE 2,4 NM 120  ANV  AU BATAIE RADIAL SE RECOMANDA RE ECHILIBRARE DUPA 3.000 KM	2026-04-28 07:35:44.879139+00	132.00	f	\N	2026-04-28 07:37:56.367609+00	OP	\N	1344	ASC-D	1362		0		0	\N	2
1800	2	DJ17VRJ	\N	\N	2026-04-28 07:04:35.762958+00	397.00	f	\N	2026-04-28 07:05:45.518322+00	CARD	\N	1335	ASC-D	1356		0		0	\N	2
1787	2	B100HPY	\N	\N	2026-04-28 05:46:24.267272+00	120.00	f	\N	2026-04-28 05:50:12.339245+00	CARD	\N	1323	ASC-D	1346		0		0	\N	2
1790	2	DJ40EME	\N	\N	2026-04-28 05:52:14.050303+00	96.00	f	\N	2026-04-28 05:56:31.598115+00	CARD	\N	1321		0		0		0	\N	2
1821	2	B342NOM	\N	\N	2026-04-28 08:39:36.621208+00	50.00	f	\N	2026-04-28 08:40:44.359386+00	OP	\N	1353	ASC-D	1371		0		0	\N	2
1796	2	DJ42NIK	\N	\N	2026-04-28 06:49:13.939647+00	216.00	f	\N	2026-04-28 07:12:22.428687+00	CASH	\N	1333	ASC-D	1357		0		0	\N	2
1792	2	DJ13KLC	\N	195/55/16 BRIDGESTONE LM005  MM6 DOT 4321    4ANV   4JANTE ALIAJ   4CAPACE CENTRU	2026-04-28 06:05:36.331358+00	214.00	f	\N	2026-04-28 06:10:22.470968+00	CARD	\N	1326	ASC-D	1349		0		0	\N	2
1833	2	DJ13WDX	\N	\N	2026-04-28 09:59:41.269341+00	1212.00	f	\N	2026-04-28 11:46:42.760248+00	OP	\N	1381	ASC-D	1393		0		0	\N	2
1793	2	B444VPV	\N	\N	2026-04-28 06:19:10.956736+00	100.00	f	\N	2026-04-28 06:21:35.449054+00	OP	\N	1328	ASC-D	1351		0		0	\N	2
1791	2	DJ74MGO	\N	CUSTODIE 4 ANVELOPE KUMHO WINTER. 225/55/18 7MM DOT=1625	2026-04-28 05:57:54.431645+00	356.00	f	\N	2026-04-28 06:21:56.017168+00	CARD	\N	\N	ASC-D	1350		0		0	\N	2
1785	2	DJ83BAF	\N	\N	2026-04-28 05:36:41.900164+00	6992.00	f	\N	2026-04-28 06:22:24.635291+00	CARD	\N	1325	ASC-D	1348		0		0	\N	2
1795	2	DJ11BGX	\N	\N	2026-04-28 06:42:26.564807+00	160.00	f	\N	2026-04-28 07:15:16.511867+00	CASH	\N	1330	ASC-D	1354		0		0	\N	2
1810	2	DJ98RED	\N	4 ANVELOPE CUSTODIE 4 JANTE ALIAJ 4 CAPACE CENTRU KLEBER 195 55 16 DOT 42 19 MM 5	2026-04-28 07:38:59.634279+00	214.00	f	\N	2026-04-28 07:43:13.745793+00	CASH	\N	1345	ASC-D	1363		0		0	\N	2
1804	2	B700XWB	\N	\N	2026-04-28 07:18:52.755337+00	176.00	f	\N	2026-04-28 07:20:25.620538+00	CARD	\N	1339	ASC-D	1358		0		0	\N	2
1794	2	DJ83BAF	\N	\N	2026-04-28 06:42:26.276326+00	250.00	f	\N	2026-04-28 06:48:48.604403+00	CARD	\N	1329		0		0		0	\N	2
1811	2	DJ66RMN	\N	215 60 17 VIKING	2026-04-28 07:42:16.089777+00	188.00	f	\N	2026-04-28 07:45:20.682225+00	CARD	\N	1346		0		0		0	\N	2
1802	2	B17NSL	\N	\N	2026-04-28 07:13:33.909049+00	250.00	f	\N	2026-04-28 07:21:03.972684+00	CASH	\N	1337	ASC-D	1359		0		0	\N	2
1797	2	DJ35MXR	\N	\N	2026-04-28 06:52:33.191396+00	224.00	f	\N	2026-04-28 06:53:09.65479+00	CARD	\N	1331	ASC-D	1353		0		0	\N	2
1789	2	DJ90BLD	\N	PRESIUNE FATA SPATE 2,3 NM 120	2026-04-28 05:50:08.19109+00	176.00	f	\N	2026-04-28 06:53:24.01845+00	CARD	\N	1327	ASC-D	1352		0		0	\N	2
1788	2	B118AWH	\N	\N	2026-04-28 05:47:52.889866+00	132.00	f	\N	2026-04-28 06:54:43.104861+00	OP	\N	1324	ASC-D	1347		0		0	\N	2
1826	2	DJ55RDW	\N	\N	2026-04-28 08:55:27.754785+00	196.00	f	\N	2026-04-28 08:56:56.622049+00	CASH	\N	1352	ASC-D	1376		0		0	\N	2
1803	2	DJ13ESR	\N	325 35 21 CONTINENTAL 285 35 21 CONTINENTAL	2026-04-28 07:14:02.766989+00	850.00	f	\N	2026-04-28 07:57:45.59428+00	CARD	\N	1338	ASC-D	1364		0		0	\N	2
1798	2	DJ37KIS	\N	\N	2026-04-28 06:57:59.292535+00	180.00	f	\N	2026-04-28 07:02:07.558862+00	CARD	\N	1332		0		0		0	\N	2
1825	2	DJ38AID	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE MICHELIN PIL ALP 5 225 60 17 DOT 1118 MM 5\nMONTAT 225 60 17 MICHELIN	2026-04-28 08:50:40.727268+00	256.00	f	\N	2026-04-28 08:51:19.844234+00	CARD	\N	1358	ASC-D	1375		0		0	\N	2
1805	2	DJ016782	\N	\N	2026-04-28 07:27:08.267412+00	64.00	f	\N	2026-04-28 07:31:28.543251+00	CARD	\N	1340		0		0		0	\N	2
1806	2	DJ89KXN	\N	\N	2026-04-28 07:28:01.033784+00	64.00	f	\N	2026-04-28 07:31:34.167757+00	CARD	\N	1342		0		0		0	\N	2
1812	2	DJ48ELC	\N	\N	2026-04-28 07:46:37.443958+00	1208.00	f	\N	2026-04-28 08:42:57.866213+00	OP	\N	1347	ASC-D	1372		0		0	\N	2
1808	2	DJ09UIN	\N	4JANTE OTEL 4ANV HANKOOK 185\\60\\15 5MM DOT2424	2026-04-28 07:33:46.356967+00	222.00	f	\N	2026-04-28 07:34:36.125261+00	CARD	\N	1341	ASC-D	1360		0		0	\N	2
1817	2	DJ33JES	\N	215 75 16C	2026-04-28 08:20:57.011206+00	100.00	f	\N	2026-04-28 08:23:09.251277+00	CARD	\N	1350	ASC-D	1368		0		0	\N	2
1823	2	GJ37MRC	\N	\N	2026-04-28 08:43:47.878742+00	2186.00	f	\N	2026-04-28 09:55:45.167841+00	CARD	\N	1354	ASC-D	1381		0		0	\N	2
1814	2	DJ32LMD	\N	\N	2026-04-28 08:02:53.75756+00	250.00	f	\N	2026-04-28 08:06:41.399331+00	CARD	\N	1348	ASC-D	1365		0		0	\N	2
1813	2	DJ19STM	\N	PRESIUNE FATA SPATE 2,4 NM   140	2026-04-28 07:58:19.605571+00	2472.00	f	\N	2026-04-28 08:24:10.785797+00	CARD	\N	1298	ASC-D	1369		0		0	\N	2
1829	2	DJ24WSS	\N	2 ANVELOPE KLEBER 205 55 16 2 ANCELOPE CONTINENTAL 205 55 16	2026-04-28 09:42:28.938325+00	316.00	f	\N	2026-04-28 10:09:35.148112+00	CASH	\N	1363	ASC-D	1382		0		0	\N	2
1818	2	DJ20NOV	\N	\N	2026-04-28 08:28:33.011778+00	250.00	f	\N	2026-04-28 08:35:13.982788+00	CARD	\N	1351	ASC-D	1370		0		0	\N	2
1822	2	DJ89LHU	\N	\N	2026-04-28 08:42:44.705025+00	176.00	f	\N	2026-04-28 08:46:04.405252+00	CARD	\N	1355	ASC-D	1373		0		0	\N	2
1819	2	DJ10WYT	\N	PRESIUNE FATA SPATE 2,3 NM 120	2026-04-28 08:33:24.148928+00	1240.00	f	\N	2026-04-28 09:03:09.616191+00	CARD	\N	1360	ASC-D	1379		0		0	\N	2
1824	2	B994BSC	\N	ANV CLIENT 205/60/16 4BUC SAU MONTAT	2026-04-28 08:48:17.345524+00	148.00	f	\N	2026-04-28 08:48:58.618142+00	OP	\N	1357	ASC-D	1374		0		0	\N	2
1837	2	BV011049	\N	\N	2026-04-28 10:29:07.464997+00	250.00	f	\N	2026-04-28 10:34:18.755124+00	CARD	\N	1370	ASC-D	1385		0		0	\N	2
1827	2	DJ17UTU	\N	4 ANVELOPE CUSTODIE 225 50 18 KHUMO WINTER AFT DOT22 24 M 6	2026-04-28 08:55:28.131666+00	316.00	f	\N	2026-04-28 08:57:52.112283+00	CARD	\N	1359	ASC-D	1377		0		0	\N	2
1816	2	DJ06EDJ	\N	\N	2026-04-28 08:09:32.632011+00	2126.00	f	\N	2026-04-28 09:00:48.615621+00	CARD	\N	1356	ASC-D	1378		0		0	\N	2
1830	2	B707AMX	\N	ANV CLIENT 245 40 19 275 35 19 MM 8 8 8 8 PRESIUNE FATA SPATE 2,4 NM 140 YOKOHAMA C DRIVE	2026-04-28 09:46:48.527846+00	196.00	f	\N	2026-04-28 09:50:18.933975+00	CARD	\N	1364	ASC-D	1380		0		0	\N	2
1835	2	DJ59DMK	\N	\N	2026-04-28 10:10:31.496668+00	180.00	f	\N	2026-04-28 10:16:33.572801+00	CASH	\N	1366		0		0		0	\N	2
1834	2	DJ33ACV	\N	225 60 18 DUNLOP	2026-04-28 10:10:19.753291+00	96.00	f	\N	2026-04-28 10:10:53.288153+00	CARD	\N	1367		0		0		0	\N	2
1828	2	DJ92WIO	\N	\N	2026-04-28 09:04:21.25665+00	2289.00	f	\N	2026-04-28 10:28:58.118236+00	CASH	\N	1361	ASC-D	1384		0		0	\N	2
1836	2	IS25PHD	\N	ANV CLIENT 195 55 16 HANKOOK VENTUS MM 8 8 8 8 PRESIUNE 2,3 FATA SPATE NM 110	2026-04-28 10:11:17.769954+00	132.00	f	\N	2026-04-28 10:12:18.755172+00	OP	\N	1368	ASC-D	1383		0		0	\N	2
1831	2	DJ79LEX	\N	\N	2026-04-28 09:49:49.106653+00	2576.00	f	\N	2026-04-28 10:59:35.184794+00	OP	\N	1369	ASC-D	1388		0		0	\N	2
1815	2	DJ20CDO	\N	2 ANVELOPE CUSTODIE GESTAR 225 55 17 2 ANVELOPE MICHELIN A 5 225 55 17 4 JANTE 4 CAPACE DOT 21 20 35 17	2026-04-28 08:06:26.398267+00	428.00	f	\N	2026-04-28 10:46:09.810554+00	CARD	\N	1349	ASC-D	1367		0		0	\N	2
1832	2	DJ90KHY	\N	\N	2026-04-28 09:58:28.395875+00	1976.00	f	\N	2026-04-28 10:51:30.36471+00	CARD	\N	1372	ASC-D	1386		0		0	\N	2
1820	2	B125EEA	\N	\N	2026-04-28 08:34:50.947732+00	208.00	f	\N	2026-04-28 11:54:22.181231+00	CARD	\N	\N		0		0		0	\N	2
1838	2	B263SPA	\N	ANV CLIENT KUMHO ECSTA 215 55 18 MM 7 7 7 7 PRESIUNE FATA SPATE  2,5 NM 120	2026-04-28 10:38:20.989387+00	176.00	f	\N	2026-04-28 10:39:05.256422+00	CASH	\N	1371		0		0		0	\N	2
1858	2	DJ01YAY	\N	4 ANVELOPE 4 JANTE ALIAJ 245\\45\\18 DOT 17\\21 MICHELIN PILOT ALPIN 4 CAPACE MM 6	2026-04-28 12:50:39.313583+00	264.00	f	\N	2026-04-28 12:52:27.1884+00	CASH	\N	1390	ASC-D	1400		0		0	\N	2
1841	2	DJ017371	\N	\N	2026-04-28 10:58:41.616217+00	250.00	f	\N	2026-04-28 11:01:36.847593+00	CASH	\N	1374		0		0		0	\N	2
1839	2	DJ29ASZ	\N	CUSTODIE 4JANTE OTEL+4ANV+4CAPACE CLEBER CRISALP 205/55/16 DOT3220 6MM 2BUC SEBRING SNOW 205/55/16 DOT3217 5MM 2BUC\nMONTAT CONTINENTAL 235/45/17 4BUC	2026-04-28 10:51:10.295003+00	246.00	f	\N	2026-04-28 11:03:36.998337+00	CARD	\N	1373	ASC-D	1387		0		0	\N	2
1851	2	DJ74AWD	\N	MONTAT ANVELOPE= MICHELIN PRIMACY4 215/50/18 4MM ( ANVELOPE DANTURATE )\n\nCUSTODIE 4 ANVELOPE= KUMHO WINTERKRAFT 215/50/18 5MM DOT=2224	2026-04-28 11:53:49.313194+00	316.00	f	\N	2026-04-28 11:58:12.971129+00	CASH	\N	1385	ASC-D	1396		0		0	\N	2
1860	2	DJ16FHZ	\N	\N	2026-04-28 13:01:29.147193+00	76.00	f	\N	2026-04-28 13:03:19.61221+00	CARD	\N	1394		0		0		0	\N	2
1845	2	DJ31SUA	\N	CONTI ECO CONTACT 6 275 45 21 315 40 21  MM 7 7 7 7  PRESIUNE FATA SPATE 2,3 NM 150	2026-04-28 11:06:57.884885+00	172.00	f	\N	2026-04-28 11:08:10.621821+00	CASH	\N	1376		0		0		0	\N	2
1852	2	DJ01ECD	\N	225 50 18 MICHELIN	2026-04-28 12:06:00.125002+00	176.00	f	\N	2026-04-28 12:06:39.786121+00	CARD	\N	1386		0		0		0	\N	2
1883	2	DJ22CFC	\N	4ANV KUMHO 225\\55\\17 6MM DOT1925	2026-04-29 06:38:55.485936+00	308.00	f	\N	2026-04-29 06:41:57.345177+00	CARD	\N	1415	ASC-D	1419		0		0	\N	2
1847	2	DJ90KHY	\N	\N	2026-04-28 11:09:20.513632+00	120.00	f	\N	2026-04-28 11:14:29.213216+00	CARD	\N	1379	ASC-D	1389		0		0	\N	2
1859	2	DJ14JJP	\N	\N	2026-04-28 13:00:44.426395+00	250.00	f	\N	2026-04-28 13:04:17.329636+00	CASH	\N	1393		0		0		0	\N	2
1842	2	DJ10EPS	\N	\N	2026-04-28 11:02:16.578594+00	2016.00	f	\N	2026-04-28 12:07:32.104888+00	CARD	\N	1375	ASC-D	1395		0		0	\N	2
1848	2	DJ13FHM	\N	\N	2026-04-28 11:20:20.831096+00	96.00	f	\N	2026-04-28 11:25:31.742782+00	CARD	\N	1380	ASC-D	1390		0		0	\N	2
1849	2	DJ45EDI	\N	CONTINENTAL 205 55 16	2026-04-28 11:25:06.627379+00	136.00	f	\N	2026-04-28 11:27:35.694577+00	CASH	\N	1382		0		0		0	\N	2
1867	2	DJ36STI	\N	\N	2026-04-28 13:41:00.489344+00	2967.00	f	\N	2026-04-28 14:09:22.494998+00	CASH	\N	1403	ASC-D	1408		0		0	\N	2
1853	2	DJ18RYN	\N	225/55/18  UNIROYAL WINTER EXPERT  MM6   DOT4123     4 ANV	2026-04-28 12:12:44.288906+00	308.00	f	\N	2026-04-28 12:13:26.796456+00	CARD	\N	1388	ASC-D	1397		0		0	\N	2
1844	2	DJ10WAD	\N	\N	2026-04-28 11:06:55.731584+00	406.00	f	\N	2026-04-28 11:28:42.86377+00	CARD	\N	1377	ASC-D	1391		0		0	\N	2
1840	2	DJ21MBK	\N	PRESIUNE 2,5 FATA SPATE NM 120	2026-04-28 10:58:28.950895+00	3358.00	f	\N	2026-04-28 11:33:12.181587+00	CARD	\N	1383	ASC-D	1392		0		0	\N	2
1843	2	OT03WLP	\N	\N	2026-04-28 11:04:50.714894+00	860.00	t	2026-04-28 11:43:36.752952+00	\N	NEPLATIT	\N	\N		0		0		0	\N	2
1846	2	B129TTA	\N	\N	2026-04-28 11:07:37.272008+00	442.00	f	\N	2026-04-28 11:44:44.652429+00	OP	\N	1378		0		0		0	\N	2
1866	2	DJ21XCN	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ 4 CAPACE MICH ALP 5 255 50 19 DOT 4121 MM 5	2026-04-28 13:33:23.286831+00	400.00	f	\N	2026-04-28 13:34:16.526219+00	CASH	\N	1400	ASC-D	1405		0		0	\N	2
1855	2	DJ12SWY	\N	NU MAI RAMAN IN CUSTODIE	2026-04-28 12:16:55.324323+00	76.00	f	\N	2026-04-28 12:18:00.347186+00	CASH	\N	1387		0		0		0	\N	2
1850	2	DJ18AKD	\N	ANV CLIENT BRIDGESTONE 225/65/17 4BUC	2026-04-28 11:50:16.366249+00	176.00	f	\N	2026-04-28 11:50:52.599651+00	CARD	\N	1384	ASC-D	1394		0		0	\N	2
1865	2	DJ22VVV	\N	4JANTE ALIAJ 4ANV DUNLOP 255\\50\\19 6MM DOT 1525 4CAPACE LA CENTRU	2026-04-28 13:32:56.025214+00	320.00	f	\N	2026-04-28 13:37:41.50002+00	CARD	\N	1399	ASC-D	1404		0		0	\N	2
1862	2	DJ77WND	\N	CUSTODIE NOUA 4 ANV NOKIAN TIRES SNOW 275 50 20 DOT 0825 MM 7	2026-04-28 13:07:55.669226+00	424.00	f	\N	2026-04-28 13:10:56.486702+00	CASH	\N	1396	ASC-D	1402		0		0	\N	2
1857	2	DJ38BOL	\N	ANV CLIENT 225 60 17 DUNLOP SP SPORT  MM 7 7 7 7 PRESIUNE FATA SPATE 2,4 NM 140	2026-04-28 12:36:03.930481+00	176.00	f	\N	2026-04-28 12:37:08.373132+00	CASH	\N	1392	ASC-D	1398		0		0	\N	2
1856	2	DJ75SRJ	\N	\N	2026-04-28 12:34:38.869015+00	250.00	f	\N	2026-04-28 12:38:02.749756+00	CASH	\N	1391	ASC-D	1399		0		0	\N	2
1854	2	DJ82DAL	\N	\N	2026-04-28 12:16:16.188539+00	500.00	t	2026-04-28 12:41:49.193812+00	\N	NEPLATIT	\N	1389		0		0		0	\N	2
1864	2	DJ01SMS	\N	CUSTODIE 4 ANVELOPE\nMICHELIN PA5 305/30 R21 7MM DOT 3325 2 BUC\nMICHELIN PA5 245/35 R20 7MM DOT 2725 2 BUC	2026-04-28 13:21:45.588441+00	752.00	f	\N	2026-04-28 14:13:22.210656+00	CASH	\N	1398	ASC-D	1409		0		0	\N	2
1869	2	GJ06XHA	\N	\N	2026-04-28 13:48:18.177251+00	120.00	f	\N	2026-04-28 13:50:58.584785+00	CARD	\N	1401	ASC-D	1406		0		0	\N	2
1863	2	DJ95ADP	\N	\N	2026-04-28 13:18:53.461962+00	180.00	f	\N	2026-04-28 13:24:29.788478+00	CASH	\N	1397	ASC-D	1403		0		0	\N	2
1861	2	DJ37DYM	\N	4JANTE ALIAJ 4ANV MICHELIN 205\\55\\16 6MM  4CAPACE LA CENTRU	2026-04-28 13:07:19.304232+00	274.00	f	\N	2026-04-28 13:25:47.074902+00	CARD	\N	1395	ASC-D	1401		0		0	\N	2
1871	2	DJ99AXM	\N	\N	2026-04-28 14:18:43.95268+00	236.00	f	\N	2026-04-28 14:21:43.111989+00	CARD	\N	1404	ASC-D	1410		0		0	\N	2
1878	2	DJ88NET	\N	MICHELIN 245 40 19 275 35 19	2026-04-29 05:52:37.29456+00	196.00	f	\N	2026-04-29 05:58:12.077086+00	CARD	\N	1410		0		0		0	\N	2
1870	2	OT05BTA	\N	315 35 21 CONTINENTAL	2026-04-28 14:01:19.853041+00	180.00	f	\N	2026-04-28 14:03:32.055173+00	OP	\N	1402	ASC-D	1407		0		0	\N	2
1868	2	DJ05HSD	\N	CUSTODIE DUNLOP WINTER SPORT5 215/55/17 DOT1522 6MM 4ANV\nMONTAT CONTINENTAL 215/55/17 4BUC	2026-04-28 13:43:45.890201+00	316.00	f	\N	2026-04-28 14:04:20.218363+00	OP	\N	\N		0		0		0	\N	2
1712	2	DJ16MWL	\N	\N	2026-04-27 07:24:49.273908+00	250.00	f	\N	2026-04-29 06:29:46.421129+00	CASH	\N	\N		0		0		0	\N	2
1877	2	DJ04CSN	\N	225/65/16C  MATADOR NORDICA VAN    MM8    DOT3624    4ANV	2026-04-29 05:45:26.128645+00	342.00	f	\N	2026-04-29 05:46:22.511835+00	OP	\N	1408	ASC-D	1411		0		0	\N	2
1873	2	DJ98EWA	\N	ROTI COMPLTE CLIENT MICHELIN215/55/17 4BUC	2026-04-29 05:33:35.641071+00	96.00	f	\N	2026-04-29 05:34:26.141974+00	CASH	\N	1406		0		0		0	\N	2
1881	2	DJ22TSN	\N	ANV. CUSTODIE MIC. P.A.5 SUV 235/60/18 MM4 DOT 2722 4 JANTE ALIAJ 4 CAPACE	2026-04-29 06:19:09.298681+00	280.00	f	\N	2026-04-29 06:22:05.405764+00	CARD	\N	1413	ASC-D	1416		0		0	\N	2
1876	2	DJ17UMZ	\N	\N	2026-04-29 05:44:33.886284+00	250.00	f	\N	2026-04-29 05:48:44.772469+00	CASH	\N	1409	ASC-D	1412		0		0	\N	2
1872	2	DJ17CMU	\N	\N	2026-04-29 05:26:19.546065+00	1112.00	f	\N	2026-04-29 06:08:33.495729+00	CARD	\N	1405	ASC-D	1414		0		0	\N	2
1879	2	DJ39MLI	\N	CONTI WINTER 235 50 19 MM 6 6 5 5 PRESIUNE 2,4 FATA SPATE NM 120'	2026-04-29 05:55:59.5168+00	120.00	f	\N	2026-04-29 05:59:24.887609+00	CASH	\N	1411	ASC-D	1413		0		0	\N	2
1874	2	B115NLB	\N	\N	2026-04-29 05:40:57.112843+00	6600.00	f	\N	2026-04-29 06:34:19.840795+00	OP	\N	\N		0		0		0	\N	2
1882	2	B882ZRO	\N	ANV CLIENT MICHELIN205/55/16 4BUC	2026-04-29 06:19:56.031872+00	156.00	f	\N	2026-04-29 06:20:38.192079+00	CARD	\N	1414	ASC-D	1415		0		0	\N	2
1880	2	B232PHA	\N	\N	2026-04-29 06:15:08.358693+00	216.00	f	\N	2026-04-29 06:29:17.109776+00	OP	\N	1412	ASC-D	1417		0		0	\N	2
1884	2	CL25ADM	\N	\N	2026-04-29 06:39:52.784618+00	300.00	f	\N	2026-04-29 06:42:18.071647+00	CARD	\N	1416	ASC-D	1420		0		0	\N	2
1875	2	DJ09GCB	\N	\N	2026-04-29 05:42:12.498736+00	3160.00	f	\N	2026-04-29 06:42:57.38837+00	CARD	\N	1407	ASC-D	1418		0		0	\N	2
1885	2	B329AXA	\N	ANV MONTATE PIRELLI PZ4  245 45  20   275 40 20 MM 6 6  6 6 PRESIUNE FATA SPATE  2,3 NM140 \nCUSTODIE  ANV JANTE  MICHELIN PILOT ALPIN 245 50 19  MM 7  7 7 7 DOT2424	2026-04-29 06:43:22.727691+00	520.00	f	\N	2026-04-29 06:44:53.967341+00	CARD	\N	1417	ASC-D	1421		0		0	\N	2
1886	2	IS29PHA	\N	\N	2026-04-29 07:04:36.918334+00	192.00	f	\N	2026-04-29 07:07:24.298269+00	OP	\N	676	ASC-D	1422		0		0	\N	2
1888	2	DJ38RDM	\N	\N	2026-04-29 07:11:53.191442+00	250.00	f	\N	2026-04-29 07:15:24.113606+00	CARD	\N	1419		0		0		0	\N	2
1890	2	DJ21TYI	\N	245 50 19 GOODIEAR	2026-04-29 07:14:53.246762+00	224.00	f	\N	2026-04-29 07:16:25.117163+00	CARD	\N	1421		0		0		0	\N	2
1889	2	DJ39LUX	\N	ANV CLIENT KUMHO 225/45/17 4BUC	2026-04-29 07:13:23.618705+00	186.00	f	\N	2026-04-29 07:16:42.960888+00	CARD	\N	1420		0		0		0	\N	2
1887	2	DJ01FAU	\N	CUSTODIE ANV   JANTE  CAPACE  205 55 16 MM 6 6 7 7 DOT 3925\nMICHELIN    ALPIN  6 205 55  16 2223 PREZOANE 19 BUC LIPSA 1   BUC	2026-04-29 07:05:57.734937+00	246.00	f	\N	2026-04-29 07:21:46.014647+00	CASH	\N	1418	ASC-D	1424		0		0	\N	2
1893	2	NT52KBE	\N	\N	2026-04-29 07:36:34.898315+00	213.00	f	\N	2026-04-29 07:37:21.770703+00	OP	\N	1424	ASC-D	1425		0		0	\N	2
1898	2	DJ65AAB	\N	\N	2026-04-29 07:52:31.548127+00	874.00	f	\N	2026-04-29 08:14:38.192947+00	OP	\N	1429	ASC-D	1430		0		0	\N	2
1899	2	DJ32LAC	\N	\N	2026-04-29 07:53:21.498581+00	6075.00	f	\N	2026-04-29 10:20:55.141129+00	CARD	\N	1447	ASC-D	1448		0		0	\N	2
1891	2	DJ28SPA	\N	205/60/16   GENERAL ALTIMAXWINTER3   MM6   DOT2721   4 ANV   4 JANTE ALIAJ   4 CAPACE CENTRU	2026-04-29 07:19:45.667215+00	226.00	f	\N	2026-04-29 07:21:30.694868+00	CARD	\N	1422	ASC-D	1423		0		0	\N	2
1892	2	DJ58ADT	\N	\N	2026-04-29 07:22:30.702708+00	250.00	f	\N	2026-04-29 07:25:43.2129+00	CASH	\N	1423		0		0		0	\N	2
1927	2	DJ26JTM	\N	235 45 17 NEXEN	2026-04-29 10:33:08.662543+00	96.00	f	\N	2026-04-29 10:34:15.575189+00	CARD	\N	1456	ASC-D	1453		0		0	\N	2
1894	2	DJ97WWW	\N	CUSTODIE 4 ANV 4 JANTE ALIAJ MICH PIL ALP 5 245 45 17 DOT 3421 MM 6\nMONTAT PIRELLI 245 45 17	2026-04-29 07:38:38.498819+00	256.00	f	\N	2026-04-29 07:39:13.73946+00	CARD	\N	1426	ASC-D	1426		0		0	\N	2
1909	2	DJ94CAR	\N	PIRELLI 245 45 18	2026-04-29 08:39:00.109924+00	88.00	f	\N	2026-04-29 08:39:32.450048+00	CASH	\N	1438	ASC-D	1435		0		0	\N	2
1896	2	DJ09XGN	\N	\N	2026-04-29 07:44:59.969756+00	180.00	f	\N	2026-04-29 07:47:27.875797+00	CARD	\N	1427		0		0		0	\N	2
1917	2	DJ45CNG	\N	\N	2026-04-29 09:26:22.380405+00	96.00	f	\N	2026-04-29 09:28:34.962787+00	CARD	\N	1446	ASC-D	1442		0		0	\N	2
1897	2	DJ04DAL	\N	\N	2026-04-29 07:48:37.066589+00	132.00	f	\N	2026-04-29 07:49:37.444806+00	OP	\N	1428	ASC-D	1427		0		0	\N	2
1914	2	DJ12XYL	\N	\N	2026-04-29 09:01:50.606464+00	100.00	f	\N	2026-04-29 09:31:18.394793+00	OP	\N	1443	ASC-D	1439		0		0	\N	2
1908	2	DJ01VAD	\N	\N	2026-04-29 08:38:31.713684+00	250.00	f	\N	2026-04-29 08:43:34.540453+00	CASH	\N	1437	ASC-D	1436		0		0	\N	2
1895	2	GJ08CRN	\N	\N	2026-04-29 07:38:50.652375+00	288.00	f	\N	2026-04-29 07:59:43.568762+00	CASH	\N	1425	ASC-D	1428		0		0	\N	2
1910	2	DJ26BUD	\N	JOC CAP BARA STANGA	2026-04-29 08:41:48.417466+00	60.00	f	\N	2026-04-29 08:44:29.480546+00	CASH	\N	1439		0		0		0	\N	2
1923	2	DJ12EXZ	\N	\N	2026-04-29 10:15:30.0401+00	180.00	f	\N	2026-04-29 10:21:25.481634+00	OP	\N	1452	ASC-D	1449		0		0	\N	2
1900	2	DJ77NRO	\N	ANV CLIENT CONTI ECO CONTACT 6 255 40 20 MM 6 6 5 5 PRESIUNE FATA SPATE  2,5 NM 140	2026-04-29 08:03:23.878948+00	452.00	f	\N	2026-04-29 08:05:52.410663+00	CARD	\N	1430		0		0		0	\N	2
1902	2	DJ99NMM	\N	ANV CLIENT MICHELIN PRIMACY 5 205 55 16 MM 7 7 7 7 PRESIUNE FATA SPATE 2,5 NM 120	2026-04-29 08:05:11.279763+00	136.00	f	\N	2026-04-29 08:07:15.297061+00	CARD	\N	1431	ASC-D	1429		0		0	\N	2
1904	2	GJ18CSM	\N	\N	2026-04-29 08:12:43.280927+00	300.00	f	\N	2026-04-29 08:16:00.615942+00	OP	\N	1433	ASC-D	1431		0		0	\N	2
1911	2	DJ15NUC	\N	\N	2026-04-29 08:47:44.651629+00	224.00	f	\N	2026-04-29 09:31:49.444476+00	OP	\N	1440	ASC-D	1443		0		0	\N	2
1903	2	B41LUB	\N	ANVELOPELE NU MAI RAMAN IN CUSTODIE	2026-04-29 08:11:35.634361+00	168.00	f	\N	2026-04-29 08:17:46.749365+00	OP	\N	1432	ASC-D	1432		0		0	\N	2
1937	2	DJ10ASC	\N	ROTI COMPLETE CLIENT MICHELIN 245/45/18 SAU MONTAT	2026-04-29 11:31:39.176067+00	72.00	f	\N	2026-04-29 11:32:14.359895+00	CARD	\N	1466		0		0		0	\N	2
1913	2	DJ66KIK	\N	ANV CLIENT GOODYEAR EAGLE F 1  215 55 17 MM 6 6 6 6 PRESIUNE FATA SPATE 2,4 NM 120	2026-04-29 08:53:25.633876+00	176.00	f	\N	2026-04-29 08:55:58.212267+00	CARD	\N	1441	ASC-D	1437		0		0	\N	2
1905	2	B216ELM	\N	\N	2026-04-29 08:17:49.506064+00	192.00	f	\N	2026-04-29 08:19:57.415414+00	OP	\N	1434		0		0		0	\N	2
1906	2	DJ62AAB	\N	\N	2026-04-29 08:19:35.815411+00	168.00	f	\N	2026-04-29 08:20:47.203556+00	OP	\N	1435	ASC-D	1433		0		0	\N	2
1907	2	DJ33WAA	\N	CUSTODIE 4JANTE OTEL+4ANV DEBICA FRIGO 205/55/16 DOT3024 6MM 4BUC\nMONTAT MICHELIN 205/55/16 4BUC	2026-04-29 08:28:44.419044+00	226.00	f	\N	2026-04-29 08:29:17.41856+00	CASH	\N	1436	ASC-D	1434		0		0	\N	2
1912	2	DJ44WRW	\N	\N	2026-04-29 08:49:19.272147+00	1556.00	f	\N	2026-04-29 08:59:03.549844+00	CARD	\N	1442	ASC-D	1438		0		0	\N	2
1924	2	DJ99MCM	\N	CUSTODIE 4 ANVELOPE,4 JANTE ALIAJ,4 CAPACE\nMICHELIN PA5 235/55/19 6MM DOT=2124	2026-04-29 10:23:15.955324+00	320.00	f	\N	2026-04-29 10:24:16.98184+00	CASH	\N	1453	ASC-D	1450		0		0	\N	2
1928	2	OT04JUS	\N	\N	2026-04-29 10:35:55.210589+00	170.00	f	\N	2026-04-29 10:37:03.597129+00	CARD	\N	1457	ASC-D	1454		0		0	\N	2
1901	2	DJ17UMZ	\N	SAU MONTAT JANTE DE 5X120 PE MASINA DE 5X118 , LA CEREREA CLIENTULUI	2026-04-29 08:03:41.176792+00	540.00	f	\N	2026-04-29 09:12:18.284705+00	CARD	\N	1409	ASC-D	1440		0		0	\N	2
1919	2	DJ37KRY	\N	\N	2026-04-29 09:42:20.743451+00	136.00	f	\N	2026-04-29 09:43:12.665141+00	CARD	\N	1448	ASC-D	1445		0		0	\N	2
1918	2	OT04RMI	\N	\N	2026-04-29 09:39:39.90547+00	180.00	f	\N	2026-04-29 09:44:00.125535+00	CASH	\N	\N		0		0		0	\N	2
1915	2	B102VPV	\N	ANV CLIENT MICHELIN 275/50/20 4BUC	2026-04-29 09:23:42.8207+00	264.00	f	\N	2026-04-29 09:24:28.201235+00	OP	\N	1444	ASC-D	1441		0		0	\N	2
1925	2	DJ31GAE	\N	\N	2026-04-29 10:29:12.682716+00	96.00	f	\N	2026-04-29 10:31:12.532608+00	CASH	\N	1454	ASC-D	1451		0		0	\N	2
1920	2	DJ09TAN	\N	PIRELI 205 55 16	2026-04-29 10:01:52.55787+00	136.00	f	\N	2026-04-29 10:02:40.603603+00	CARD	\N	1450	ASC-D	1446		0		0	\N	2
1930	2	DJ15AZA	\N	\N	2026-04-29 11:06:13.098211+00	180.00	f	\N	2026-04-29 11:18:30.82595+00	OP	\N	1459	ASC-D	1456		0		0	\N	2
1921	2	DJ57MRU	\N	\N	2026-04-29 10:02:44.39332+00	180.00	f	\N	2026-04-29 10:07:30.371673+00	CASH	\N	1451	ASC-D	1447		0		0	\N	2
1922	2	DJ18MJP	\N	\N	2026-04-29 10:14:17.496586+00	136.00	f	\N	2026-04-29 10:47:13.037598+00	CARD	\N	1449		0		0		0	\N	2
1926	2	DJ11LLL	\N	ANV CLIENT RIKEN ROAD 205 55 16  MM  6 6      \nMATADOR  HECTORA 5 205 55 16 MM 7 7 \nPRESIUNE FATA SPATE 2,3  NM 120	2026-04-29 10:32:01.214962+00	136.00	f	\N	2026-04-29 10:33:15.744965+00	CARD	\N	1455	ASC-D	1452		0		0	\N	2
1936	2	B300MTR	\N	\N	2026-04-29 11:31:25.050873+00	300.00	f	\N	2026-04-29 11:33:47.299736+00	CASH	\N	1465		0		0		0	\N	2
1929	2	DJ37STY	\N	\N	2026-04-29 10:41:03.661357+00	300.00	f	\N	2026-04-29 10:47:52.355097+00	OP	\N	1458	ASC-D	1455		0		0	\N	2
1935	2	DJ64LKY	\N	\N	2026-04-29 11:24:28.944573+00	72.00	f	\N	2026-04-29 11:25:58.323213+00	CARD	\N	1463		0		0		0	\N	2
1931	2	DJ71REY	\N	\N	2026-04-29 11:07:34.709722+00	268.00	f	\N	2026-04-29 11:08:41.313003+00	CASH	\N	1460		0		0		0	\N	2
1933	2	DJ21STK	\N	CUSTODIE ANV JANTE CAPACE PIRELLI WINTER 275 45 20 305  40 20 MM 4 4 6 6 ANV MONTATE 275 35 22 315 30 22 MM 7 7 7 7 NM 140	2026-04-29 11:17:35.567347+00	360.00	f	\N	2026-04-29 11:21:11.231037+00	CARD	\N	1462	ASC-D	1457		0		0	\N	2
1932	2	DJ03NXT	\N	185 65 15 ORIUM	2026-04-29 11:14:28.085364+00	132.00	f	\N	2026-04-29 11:14:56.565903+00	OP	\N	1461		0		0		0	\N	2
1934	2	DJ39EMC	\N	\N	2026-04-29 11:19:16.817439+00	378.00	f	\N	2026-04-29 11:27:33.25082+00	OP	\N	1464	ASC-D	1458		0		0	\N	2
1941	2	DJ77LYE	\N	\N	2026-04-29 11:46:59.331097+00	250.00	f	\N	2026-04-29 11:56:35.740867+00	CASH	\N	1469	ASC-D	1461		0		0	\N	2
1942	2	DJ84TUR	\N	CUSTODIE 4 ANV MICHELIN PIL ALP 5SUV 275 45 21 CU 315 40 21 DOT 4224 MM 5	2026-04-29 11:50:09.643915+00	438.00	f	\N	2026-04-29 11:51:07.916645+00	CARD	\N	1470	ASC-D	1459		0		0	\N	2
1940	2	DJ72PAT	\N	\N	2026-04-29 11:46:38.3536+00	168.00	f	\N	2026-04-29 11:50:29.802717+00	CARD	\N	1467		0		0		0	\N	2
1943	2	DJ60WSL	\N	ANV MONTATE MICHELIN PILOT SPORT 4 255 45 20 MM 8 8 8 8 PRESIUNE FATA SPATE NM 140 \nCUSTODIE ANV   JANTE 235 55  19 WINTER CRAFT 1825 DOT MM 7 7 7 7	2026-04-29 11:52:22.719653+00	300.00	f	\N	2026-04-29 11:55:27.251917+00	CARD	\N	1471	ASC-D	1460		0		0	\N	2
1939	2	DJ67MIL	\N	\N	2026-04-29 11:45:07.325764+00	1912.00	f	\N	2026-04-29 12:14:45.175212+00	CASH	\N	1468	ASC-D	1464		0		0	\N	2
1938	2	DJ11CYR	\N	\N	2026-04-29 11:40:38.626879+00	1101.00	f	\N	2026-04-29 12:04:15.641172+00	OP	\N	1473	ASC-D	1462		0		0	\N	2
1946	2	DJ12XVI	\N	ROTI COMPLETE CLIENT DUNLOP 225/45/17 4BUC	2026-04-29 12:04:44.730709+00	121.00	f	\N	2026-04-29 12:05:54.40716+00	CASH	\N	1474		0		0		0	\N	2
1945	2	TR41LUP	\N	\N	2026-04-29 12:00:04.762433+00	300.00	f	\N	2026-04-29 12:18:20.489867+00	CASH	\N	1476	ASC-D	1465		0		0	\N	2
1948	2	DJ37POE	\N	\N	2026-04-29 12:11:58.932026+00	3356.00	f	\N	2026-04-29 13:07:31.67517+00	CASH	\N	1475	ASC-D	1467		0		0	\N	2
1944	2	DJ30AVV	\N	\N	2026-04-29 11:52:56.68181+00	224.00	f	\N	2026-04-29 12:13:59.850237+00	CASH	\N	1472	ASC-D	1463		0		0	\N	2
1947	2	B611MXS	\N	ANV CLIENT CONTI PREMIUM CONTACT 2 205 55 16 MM 3  3  5 5 PRESIUNE FATA SPATE  2,3 NM 120	2026-04-29 12:06:56.893295+00	376.00	f	\N	2026-04-29 12:24:16.942634+00	CASH	\N	1477	ASC-D	1466		0		0	\N	2
1958	2	MS38HLD	\N	215 55 17 HANKOOK	2026-04-29 13:50:30.908331+00	200.00	f	\N	2026-04-29 13:54:58.578688+00	CASH	\N	1485		0		0		0	\N	2
1949	2	DJ60WSL	\N	\N	2026-04-29 12:28:12.973363+00	300.00	f	\N	2026-04-29 12:34:04.848597+00	CARD	\N	1471	ASC-D	1468		0		0	\N	2
1950	2	B611MXS	\N	\N	2026-04-29 12:45:02.858991+00	120.00	f	\N	2026-04-29 12:49:25.710786+00	CASH	\N	1477	ASC-D	1469		0		0	\N	2
1960	2	DJ28CJU	\N	CUSTODIE TROCMOK X-PRIVILO 205/60/16 DOT2424 6MM 4BUC\nMONTAT KUMHO 205/60/16 4BUC	2026-04-29 14:01:01.563684+00	274.00	f	\N	2026-04-29 14:01:44.476126+00	CARD	\N	1487	ASC-D	1475		0		0	\N	2
1951	2	DJ67DMS	\N	\N	2026-04-29 13:06:05.611114+00	76.00	f	\N	2026-04-29 13:07:20.90934+00	CARD	\N	1478		0		0		0	\N	2
1952	2	DJ65MYK	\N	CUSTODIE 4JANTE OTEL+4ANV KUMHO WINTERCRAFT 205/65/16 DOT1725 7MM 4BUC\nMO\nMONTAT FALKEN 205/65/16	2026-04-29 13:12:27.487759+00	302.00	f	\N	2026-04-29 13:13:38.114584+00	CARD	\N	1479	ASC-D	1470		0		0	\N	2
1953	2	VL88WOW	\N	\N	2026-04-29 13:15:54.019186+00	250.00	f	\N	2026-04-29 13:20:26.720303+00	CASH	\N	1480	ASC-D	1471		0		0	\N	2
1916	2	DJ20VTC	\N	CUSTODIE ANV MICHELIN PILOT ALPIN 5\n255 45 20 MM 8 8 DOT 2025\n285 40 10 MM 8 8 DOT 2425\nANV  MONTATE  CONTI ECO CONTACT 6Q \n255 45 20 MM 8 8\n285 40 20 MM 8 8 \nPRESIUNE  FATA SPATE 2,4  NM 140	2026-04-29 09:23:59.999339+00	392.00	f	\N	2026-04-29 13:21:36.029411+00	NEPLATIT	\N	1445	ASC-D	1444		0		0	\N	2
1961	2	MS38HLD	\N	\N	2026-04-29 14:06:13.075822+00	180.00	f	\N	2026-04-29 14:10:01.274099+00	CARD	\N	1485		0		0		0	\N	2
1959	2	DJ94WBW	\N	4 ANVELOPE PIRELI 275 45 21 315 40 21 CLIENT	2026-04-29 13:50:33.989295+00	588.00	f	\N	2026-04-29 14:10:02.342277+00	CARD	\N	1486		0		0		0	\N	2
1955	2	DJ26TIS	\N	\N	2026-04-29 13:23:53.71867+00	136.00	f	\N	2026-04-29 13:24:56.972724+00	CASH	\N	1482	ASC-D	1472		0		0	\N	2
1954	2	VL91ADR	\N	\N	2026-04-29 13:22:41.230833+00	120.00	f	\N	2026-04-29 13:27:56.197355+00	CASH	\N	1481		0		0		0	\N	2
1956	2	B125HSX	\N	ANV. CLIENT MON.215/55/17 4 BUC GOODYEAR EFFCIENT GRIP	2026-04-29 13:41:59.075707+00	168.00	f	\N	2026-04-29 13:44:18.418296+00	OP	\N	1483	ASC-D	1473		0		0	\N	2
1957	2	B707XDD	\N	CUSTODIE 4 ANVELOPE\nMICHELIN PA5 275/45/21 6MM DOT=4225\nMICHELIN PA5 315/40/21 6MM DOT=1825	2026-04-29 13:48:30.778596+00	438.00	f	\N	2026-04-29 13:49:09.772346+00	CASH	\N	1484	ASC-D	1474		0		0	\N	2
\.


--
-- Data for Name: registers; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.registers (id, account_id, name, deviz_serie, deviz_numar, factura_serie, factura_numar, chitanta_serie, chitanta_numar, aviz_serie, aviz_numar, created_at, updated_at, is_deleted, deleted_at, company_id) FROM stdin;
1	2	Registru 2026	ASC-D	1475	ASC-F	1	ASC-C	0	ASC-A	0	2026-03-23 21:19:34.163908+00	2026-03-31 06:02:22.000353+00	f	\N	2
\.


--
-- Data for Name: vehicole; Type: TABLE DATA; Schema: public; Owner: berlinstar
--

COPY public.vehicole (id, account_id, receipt_id, numar_masina, marca, model, numar_kilometrii, vin, observatii, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
1	2	345	TM88TYH	Range Rover	EVO	190876	RANGEVIN324526234	Testare	2026-03-31 22:42:12.488418+00	\N	f	\N
2	2	346	b 856 mth	ford focus	\N	\N	\N	\N	2026-04-01 05:35:52.427168+00	\N	f	\N
3	2	348	dj 45 mth	ford	\N	125000	\N	\N	2026-04-01 05:47:50.663604+00	\N	f	\N
4	2	349	DJ35MTH	ford 	focus 	151199	\N	\N	2026-04-01 05:48:03.893068+00	\N	f	\N
5	2	352	dj 94 bgv	bid seal	\N	6200	\N	\N	2026-04-01 06:01:50.986568+00	\N	f	\N
6	2	347	DJ67SIM	vw 	passat	210000	\N	\N	2026-04-01 06:05:53.056312+00	\N	f	\N
7	2	354	DJ17ION	AUDI 	A3	500	\N	\N	2026-04-01 06:09:39.657272+00	\N	f	\N
8	2	355	dj 01 mth	bmw	x5	164000	\N	\N	2026-04-01 06:11:30.535807+00	\N	f	\N
9	2	356	DJ30MTH	dacia 	logan 	248000	\N	\N	2026-04-01 06:14:04.944609+00	\N	f	\N
10	2	361	dj 12 zbz	reno talisman	\N	150000	\N	\N	2026-04-01 06:59:57.44399+00	\N	f	\N
11	2	364	B315 RAL	toyota 	corola cross 	28000	0766415778	anv client  dunlop sport 225 50 18 mm 7 7 7 7 presiune 2,4 fata spate nm 120 	2026-04-01 07:18:40.415081+00	\N	f	\N
62	2	452	DJ36BBE	MERCEDES 	GLE	170000	\N	\N	2026-04-02 09:26:17.580041+00	2026-04-02 09:39:05.868657+00	f	\N
13	2	368	DJ97CAA	bmw	\N	242753	\N	\N	2026-04-01 07:30:11.9574+00	2026-04-01 07:37:05.527144+00	f	\N
63	2	454	DJ-81-BOR	DACIA	LOGAN	294000	\N	\N	2026-04-02 09:48:35.091793+00	\N	f	\N
15	2	370	dj 40 mea	bmw	\N	123000	\N	\N	2026-04-01 07:38:31.37395+00	\N	f	\N
16	2	362	OT11WAX	SKODA	\N	220000	\N	\N	2026-04-01 08:06:42.412013+00	\N	f	\N
17	2	375	DJ 07 SHH	SKODA	OCTAVIA	78000	\N	\N	2026-04-01 08:32:12.012106+00	\N	f	\N
14	2	369	DJ01KXN	OPEL	\N	152485	\N	\N	2026-04-01 07:32:59.815867+00	2026-04-01 08:47:08.539949+00	f	\N
18	2	376	DJ75WMT	FORD	\N	108000	\N	\N	2026-04-01 08:48:04.288352+00	\N	f	\N
19	2	377	VJ 16130	AUDI	\N	167500	\N	\N	2026-04-01 08:48:12.035981+00	\N	f	\N
20	2	378	dj 60 ctm	reno master	\N	330000	\N	\N	2026-04-01 08:50:56.911212+00	\N	f	\N
22	2	380	DJ 06 RYA	MERCEDES	GLA 250 e	30105	\N	\N	2026-04-01 09:09:49.185071+00	\N	f	\N
21	2	379	DJ09DRC	OMODA 5 	\N	1000	\N	custodie anv  kumho winter kraft  215 55 18 mm 7 7 7 7dot 1625  anv montate  kumho escta ps71 mm7 7 7 7 presiune fata spate 2,5 nm 140 lipsa capac prezon st spate transfer nr rosu	2026-04-01 09:05:00.617232+00	2026-04-01 09:10:13.343166+00	f	\N
23	2	389	TM-66-EWI	DACIA	\N	44869	\N	\N	2026-04-01 09:38:32.660433+00	\N	f	\N
24	2	392	DJ 01 YBJ	phaeton	\N	260000	\N	\N	2026-04-01 10:01:24.964181+00	\N	f	\N
25	2	387	DJ17KZX	MERCEDES	\N	126000	\N	\N	2026-04-01 10:07:03.047745+00	\N	f	\N
26	2	393	DJ 76 WID	peugeout	BOXER	537111	\N	\N	2026-04-01 10:09:59.67964+00	\N	f	\N
27	2	394	DJ 10 WMA	\N	seria5	184000	\N	\N	2026-04-01 10:21:29.229167+00	\N	f	\N
64	2	455	dj 25 rhd	mercedes 	\N	308000	\N	\N	2026-04-02 10:03:30.873138+00	\N	f	\N
12	2	366	DJ 10 JOL	FORD	\N	\N	\N	\N	2026-04-01 07:25:59.46718+00	2026-04-01 10:25:15.282871+00	f	\N
28	2	395	DJ13EON	opel	corsa	31000	\N	\N	2026-04-01 10:34:04.188051+00	\N	f	\N
29	2	398	DJ 10 JOL	FORD	\N	110000	\N	\N	2026-04-01 10:59:39.886033+00	\N	f	\N
30	2	396	DJ 24 MNN	AUDI	A4	154000	\N	\N	2026-04-01 11:16:56.095562+00	\N	f	\N
31	2	399	DJ95TOP	vw 	touareg 	155000	\N	\N	2026-04-01 11:18:24.898234+00	\N	f	\N
32	2	400	BH 29 TEH	iveco	\N	234000	\N	\N	2026-04-01 11:20:08.162405+00	\N	f	\N
33	2	401	DJ15JDW	LOGAN	\N	102000	\N	\N	2026-04-01 11:20:30.703912+00	\N	f	\N
34	2	404	DJ-44-GRB	MERCEDES	\N	224934	\N	\N	2026-04-01 11:24:01.566658+00	\N	f	\N
35	2	408	DJ19EYE	SCODA	\N	275000	\N	\N	2026-04-01 11:47:06.137813+00	\N	f	\N
36	2	409	DJ 25 ZAH	MERCEDES	A180	82150	\N	\N	2026-04-01 11:47:56.171243+00	\N	f	\N
37	2	406	MOTOR	yamaha 	r6	45000	\N	\N	2026-04-01 12:07:25.194199+00	\N	f	\N
38	2	405	DJ 01 KSV	FORD	\N	32000	\N	\N	2026-04-01 12:16:04.52042+00	\N	f	\N
39	2	413	B 391 AAB	FORD	KUGA	63000	\N	\N	2026-04-01 12:28:09.522186+00	\N	f	\N
40	2	414	DJ03UBT	MERCEDES 	E CLASS	464000	\N	\N	2026-04-01 12:28:53.078268+00	\N	f	\N
65	2	459	b150ttg	ford	\N	22000	\N	\N	2026-04-02 10:36:58.48602+00	\N	f	\N
41	2	415	B314FLS	MERCEDES	GLS	99000	\N	\N	2026-04-01 12:47:49.119406+00	2026-04-01 13:07:09.314178+00	f	\N
42	2	417	DJ-14NXD	DACIA	LOGAN	223616	\N	\N	2026-04-01 13:20:21.068227+00	\N	f	\N
43	2	418	B104WPO	bmw 	x5	98000	\N	\N	2026-04-01 13:30:24.085695+00	\N	f	\N
44	2	422	DJ 29 CPO	FORD	MONDEO	255000	\N	\N	2026-04-01 14:11:36.889264+00	\N	f	\N
45	2	423	DJ-36WTW	Mercedes	\N	15000	\N	\N	2026-04-01 14:17:50.990144+00	\N	f	\N
46	2	425	DJ-34-ELF	DACIA	DOKKER	410000	\N	\N	2026-04-02 05:53:23.06207+00	\N	f	\N
47	2	428	DJ07XWG	ford 	fiesta	138000	\N	\N	2026-04-02 06:17:42.468176+00	2026-04-02 06:18:08.298982+00	f	\N
48	2	430	DJ-03-ZKX	GOLF	\N	238000	\N	\N	2026-04-02 06:31:31.935305+00	\N	f	\N
49	2	427	DJ 16 TSS	reno megan	\N	84270	\N	\N	2026-04-02 06:42:14.747523+00	\N	f	\N
50	2	433	DJ 23 NOV	MERCEDES	GLC	78000	\N	\N	2026-04-02 07:01:21.267124+00	\N	f	\N
51	2	435	DJ11PTK	AUDI	Q7	200000	\N	\N	2026-04-02 07:10:00.153265+00	\N	f	\N
52	2	436	dj40eme	scoda	\N	201000	\N	\N	2026-04-02 07:14:08.605072+00	\N	f	\N
53	2	438	DJ 21 TAZ	TOYOTA	COROLLA	16813	\N	\N	2026-04-02 07:19:23.008577+00	2026-04-02 07:31:35.814934+00	f	\N
54	2	443	DJ77SAA	AUDI	A4	255000	\N	\N	2026-04-02 07:41:25.518309+00	\N	f	\N
55	2	444	DJ-05-RBR	MERCEDES	\N	127211	\N	\N	2026-04-02 07:41:44.790998+00	\N	f	\N
56	2	447	B 551 WSD	MERCEDES	S500	107000	\N	\N	2026-04-02 08:09:35.381578+00	2026-04-02 08:09:47.235623+00	f	\N
57	2	437	DJ 77 XLA	bmw 	s3	300000	\N	\N	2026-04-02 08:14:21.339154+00	\N	f	\N
58	2	445	DJ 17 HTF	RENOULT	CLIO	314000	\N	\N	2026-04-02 08:22:27.613432+00	\N	f	\N
59	2	449	DJ55ECO	vw	golf	81540	\N	\N	2026-04-02 08:48:06.901083+00	\N	f	\N
60	2	450	DJ-22-BXL	GOLF	\N	185000	\N	\N	2026-04-02 09:14:44.418209+00	\N	f	\N
61	2	451	DJ62AGL	MAZDA	CX5	52000	\N	\N	2026-04-02 09:17:22.421121+00	2026-04-02 09:18:03.208537+00	f	\N
77	2	470	DJ19TEA	MERCEDES	SPRINTER	380000	\N	\N	2026-04-02 13:03:57.180922+00	\N	f	\N
66	2	461	DJ 20 FDK	MERCEDES	V300	5888	\N	\N	2026-04-02 10:46:16.525309+00	\N	f	\N
67	2	462	B-113-TKF	BMW	X6	4200	\N	\N	2026-04-02 10:49:44.046657+00	\N	f	\N
68	2	464	JJ	n,mni	\N	\N	\N	\N	2026-04-02 11:02:07.152656+00	\N	f	\N
69	2	465	DJ24MSV	dacia	dokker 	204800	\N	\N	2026-04-02 11:13:11.458553+00	\N	f	\N
70	2	468	dj 20 dwd	bmw x6	\N	371000	\N	\N	2026-04-02 11:42:25.959972+00	\N	f	\N
71	2	471	B-800-XAB	BMW	X5	36036	\N	\N	2026-04-02 11:58:54.075254+00	\N	f	\N
72	2	473	DJ54TEA 	bmw 	x6	75000	\N	\N	2026-04-02 12:02:28.71971+00	\N	f	\N
73	2	477	dj18yse	toyota	\N	175000	\N	\N	2026-04-02 12:03:31.715217+00	\N	f	\N
74	2	479	DJ-11-TEA	BMW	\N	70000	\N	\N	2026-04-02 12:39:40.5284+00	\N	f	\N
75	2	480	DJ 73 MSD	nissan 	qashqai	245000	\N	\N	2026-04-02 12:42:36.053159+00	\N	f	\N
76	2	476	DJ 67 MJR	nissan qashqai	\N	75000	\N	\N	2026-04-02 12:49:06.106396+00	\N	f	\N
78	2	484	DGF DM 28	BMW	X4	230000	\N	\N	2026-04-02 13:47:08.937088+00	\N	f	\N
79	2	485	dj 96 anc	mercedes	\N	33000	\N	\N	2026-04-02 13:48:36.837458+00	\N	f	\N
80	2	489	vl 74 dam	vw tiroc	\N	136000	\N	\N	2026-04-03 05:33:44.279883+00	\N	f	\N
81	2	490	DJ 17 GJD	\N	\N	\N	\N	\N	2026-04-03 05:41:41.233019+00	\N	f	\N
83	2	493	DJ 99 FSD	SEAT	LEON	190000	\N	\N	2026-04-03 05:55:24.435287+00	\N	f	\N
82	2	492	VL74DAM	W	T-ROC	\N	\N	\N	2026-04-03 05:52:33.023817+00	2026-04-03 05:56:30.239811+00	f	\N
84	2	496	DJ14GTJ	lexus	nx350h	19417	\N	\N	2026-04-03 06:08:04.314057+00	\N	f	\N
85	2	497	DJ16MOS	BMW	\N	190000	\N	\N	2026-04-03 06:14:16.758398+00	\N	f	\N
86	2	498	DJ 26 GYO	opel	\N	51000	\N	\N	2026-04-03 06:16:32.215189+00	\N	f	\N
87	2	488	DJ82BON	w tiguan	\N	311000	\N	\N	2026-04-03 06:25:17.823667+00	2026-04-03 06:29:24.428528+00	f	\N
88	2	500	B 121 LGK	HYUNDAI	I10	234000	\N	\N	2026-04-03 06:36:35.145241+00	\N	f	\N
89	2	502	dj 16 ena	honda 	\N	\N	\N	\N	2026-04-03 06:42:01.631911+00	\N	f	\N
90	2	504	DJ15XIA	kia	ceed	20000	\N	\N	2026-04-03 06:43:49.239501+00	\N	f	\N
92	2	509	EQ 6005	BMW	\N	\N	\N	\N	2026-04-03 07:12:56.632306+00	2026-04-03 07:14:10.286384+00	f	\N
91	2	505	CJ 28 UFF	NISSAN	\N	\N	\N	\N	2026-04-03 06:44:12.526489+00	2026-04-03 07:14:58.28692+00	f	\N
93	2	503	DJ09TJH	vw 	polo 	197720	\N	\N	2026-04-03 07:23:58.145277+00	\N	f	\N
94	2	510	dj77lrd	bmw	\N	50000	\N	\N	2026-04-03 07:34:19.463616+00	\N	f	\N
95	2	511	dj 02 spm	dacia doker	\N	\N	\N	\N	2026-04-03 07:37:37.259428+00	\N	f	\N
96	2	512	DJ37SAS	BMW	S5	200000	\N	\N	2026-04-03 07:43:57.183043+00	\N	f	\N
97	2	513	dj 01 mbk	mercedes cl 220	\N	\N	\N	\N	2026-04-03 07:51:43.133941+00	\N	f	\N
98	2	515	AG 02 MXR	ford	tourneo	98000	\N	\N	2026-04-03 07:54:37.695694+00	\N	f	\N
99	2	517	DJ42MDS	BMW	S5	164229	\N	\N	2026-04-03 08:30:13.770191+00	\N	f	\N
100	2	518	tm 28 hfj	\N	logan	\N	\N	\N	2026-04-03 08:36:18.608875+00	\N	f	\N
101	2	520	DJ 11 EID	VW	PASSAT	144700	\N	\N	2026-04-03 08:51:07.767928+00	\N	f	\N
102	2	521	DJ21BDG	HYUNDAI 	TUCSON 	101000	\N	\N	2026-04-03 09:00:11.930153+00	\N	f	\N
103	2	524	dj01plu	ford	\N	15000	\N	\N	2026-04-03 09:10:09.408613+00	\N	f	\N
104	2	526	b 171 tei	mercedes gls 450	\N	14738	\N	\N	2026-04-03 09:26:23.956433+00	\N	f	\N
105	2	527	DJ 72 MET	skoda	Octavia	175000	\N	\N	2026-04-03 09:32:10.154445+00	\N	f	\N
106	2	528	DJ 45 AST	\N	\N	53000	\N	\N	2026-04-03 09:36:19.935033+00	\N	f	\N
107	2	529	DJ 80 RTW	BMW	X3	139000	\N	\N	2026-04-03 10:04:37.662632+00	\N	f	\N
108	2	530	vl20ayc	nissan	\N	234000	\N	JOC CASETA DIRECTIE\nBUCSI BRATE CRAPATE	2026-04-03 10:09:50.96847+00	\N	f	\N
109	2	532	dj 08 ddd	mercedes	\N	\N	\N	\N	2026-04-03 10:19:53.006446+00	\N	f	\N
110	2	533	b201ept	logan	\N	67000	\N	\N	2026-04-03 10:27:58.686092+00	\N	f	\N
111	2	536	B245FRT	MERCEDES	\N	10000	\N	\N	2026-04-03 10:42:35.635448+00	\N	f	\N
112	2	537	DJ78SFR 	dacia 	logan 	13250	\N	\N	2026-04-03 10:50:40.071475+00	\N	f	\N
113	2	538	DJ 64 PAM	SKODA	OCTAVIA	219300	\N	\N	2026-04-03 11:03:33.868339+00	\N	f	\N
114	2	539	DJ 64 PAM	SKODA	OCTAVIA	219300	\N	\N	2026-04-03 11:03:58.029497+00	\N	f	\N
115	2	540	dj19lud	ford	\N	120000	\N	\N	2026-04-03 11:07:34.710327+00	\N	f	\N
117	2	543	B126DIN	DACIA 	LOGAN	85537	\N	\N	2026-04-03 11:44:07.588832+00	\N	f	\N
118	2	544	DJ03DYA	RENOULT	MASTER	14000	\N	\N	2026-04-03 11:45:31.586023+00	\N	f	\N
116	2	541	DJ 16 MDV	PEUGEOT	\N	22000	\N	\N	2026-04-03 11:12:51.605816+00	2026-04-03 11:46:18.403213+00	f	\N
119	2	545	DJ79LRD	MERCEDES	SPRINTER 	200000	\N	\N	2026-04-03 11:54:48.448139+00	\N	f	\N
120	2	548	DJ 16 KLN	TOYOTA	CHR	24000	\N	\N	2026-04-03 12:08:47.332338+00	\N	f	\N
121	2	550	dj 10 mwx	ford focus	\N	142000	\N	\N	2026-04-03 12:21:54.700756+00	\N	f	\N
122	2	551	dj 99 rxf	mercedes	\N	85000	\N	\N	2026-04-03 12:22:26.017747+00	\N	f	\N
123	2	552	DJ24JRY 	OPEL 	INSIGNIA 	230000	\N	\N	2026-04-03 12:24:26.656704+00	\N	f	\N
124	2	554	dj 28 rzs	bmw	\N	\N	\N	\N	2026-04-03 12:52:08.713634+00	\N	f	\N
125	2	556	DJ 87 RZW	\N	\N	290000	\N	\N	2026-04-03 13:02:49.981013+00	\N	f	\N
126	2	557	DS 693 GT	Renault	master	450000	\N	\N	2026-04-03 13:14:18.184103+00	\N	f	\N
127	2	558	DJ 88 VSG	\N	bmw	\N	\N	\N	2026-04-03 13:57:55.405789+00	\N	f	\N
128	2	559	DJ10VUT	PORSCHE	PANAMERA4	22000	\N	\N	2026-04-03 14:08:10.529189+00	\N	f	\N
129	2	560	dj 09tac	bmv,	\N	240000	\N	CAPETE BARA  MAN 1OO LEI	2026-04-06 05:28:37.016348+00	\N	f	\N
130	2	561	dj 50 anp	toiota rav 4	\N	74378	\N	\N	2026-04-06 05:30:36.568871+00	\N	f	\N
131	2	562	B173DNC	TOYOTA 	RAV 4 	151000	\N	\N	2026-04-06 05:41:53.633182+00	\N	f	\N
132	2	564	MOTO	BMW 	gs1300	12000	\N	\N	2026-04-06 05:59:28.832583+00	\N	f	\N
134	2	568	DJ 26 PYM	SKODA	SUPERB	61000	\N	\N	2026-04-06 06:08:22.795307+00	\N	f	\N
133	2	567	DJ18YPF	bmw 1	seria 1	\N	\N	\N	2026-04-06 06:08:21.922337+00	2026-04-06 06:08:53.233106+00	f	\N
135	2	571	dj75rau	renault	\N	97000	\N	\N	2026-04-06 06:16:59.419521+00	\N	f	\N
136	2	573	dj30ptl	vw	\N	127000	\N	\N	2026-04-06 06:21:02.338971+00	\N	f	\N
137	2	563	DJ 01 PWL	audii a4	\N	173000	\N	\N	2026-04-06 06:27:08.092843+00	\N	f	\N
138	2	576	DJ11MUS	mercedes	s class	52391	\N	\N	2026-04-06 06:47:51.870691+00	\N	f	\N
139	2	570	DJ 21 PEC	vw golf	\N	214000	\N	\N	2026-04-06 06:54:44.634768+00	\N	f	\N
140	2	578	DJ 98 JNX	mayda 3	\N	9244	\N	\N	2026-04-06 07:08:28.029834+00	\N	f	\N
141	2	580	CJ24BTT	SKODA 	OCTAVIA 	133000	\N	\N	2026-04-06 07:14:16.807955+00	\N	f	\N
142	2	581	DJ 15 LAL	audi	\N	70000	\N	\N	2026-04-06 07:17:03.238761+00	\N	f	\N
143	2	582	dj71dnd	\N	\N	6000	\N	\N	2026-04-06 07:22:13.952864+00	\N	f	\N
144	2	585	DJ78MRX	vw	PASSAT 	202500	\N	\N	2026-04-06 07:36:50.740668+00	\N	f	\N
145	2	587	dj 08 mlp	ford	\N	58000	\N	\N	2026-04-06 07:40:01.548773+00	\N	f	\N
146	2	588	DJ 11 JRB	Vw	golf	\N	\N	\N	2026-04-06 07:45:50.479355+00	\N	f	\N
147	2	590	b341frt	sckoda	\N	2500	\N	4 ANVELOPE KHUMO 205 55 16 DOT 2524 MM 6	2026-04-06 07:49:06.921833+00	\N	f	\N
148	2	594	dj28gie	golf	\N	78000	\N	\N	2026-04-06 08:10:31.687512+00	\N	f	\N
149	2	595	DJ 12 LYU	MAZDA	3	203000	\N	\N	2026-04-06 08:11:12.869627+00	\N	f	\N
150	2	596	dj 84 wpo	mercedes 	\N	51000	\N	\N	2026-04-06 08:18:29.77599+00	\N	f	\N
151	2	597	DJ87LNA	lexus	nx35	8000	\N	\N	2026-04-06 08:18:53.687938+00	\N	f	\N
152	2	599	dj26eam	mazda	\N	9000	\N	\N	2026-04-06 08:38:23.630443+00	\N	f	\N
153	2	600	B 23 VSS	TOYOTA	CHR	18400	\N	\N	2026-04-06 08:53:49.639747+00	\N	f	\N
154	2	603	dj44mty	lexsus	\N	170000	\N	\N	2026-04-06 09:00:27.963501+00	\N	f	\N
155	2	610	dj89cip	vw	\N	265000	\N	\N	2026-04-06 09:28:44.722298+00	\N	f	\N
157	2	612	B955TIO	TOYOTA 	yaris 	8700	\N	\N	2026-04-06 09:30:48.622653+00	\N	f	\N
156	2	611	DJ 78 WID	peugeot	\N	\N	\N	\N	2026-04-06 09:30:29.061189+00	2026-04-06 09:31:30.383509+00	f	\N
158	2	604	OT08MIF	vw	passat	400000	\N	\N	2026-04-06 09:46:18.150951+00	\N	f	\N
159	2	615	dj 11 dyz	ford kuga	\N	\N	\N	\N	2026-04-06 09:59:24.84874+00	\N	f	\N
160	2	616	DJ 27 LIR	TOYOTA	\N	280000	\N	\N	2026-04-06 10:00:18.751982+00	\N	f	\N
161	2	620	dj66myc	toyota	\N	50000	\N	\N	2026-04-06 10:12:28.501762+00	\N	f	\N
162	2	621	dj 85 acm	\N	w golf 7	325000	\N	\N	2026-04-06 10:20:13.403322+00	\N	f	\N
163	2	614	GJ55YRA	BMW 	x5 	211000	\N	\N	2026-04-06 10:20:16.702065+00	2026-04-06 10:23:31.951445+00	f	\N
164	2	625	dj 81clc	audi	\N	177000	\N	\N	2026-04-06 10:37:31.187572+00	\N	f	\N
165	2	626	OT 11 XKY	MERCEDES	\N	67000	\N	\N	2026-04-06 10:43:04.194202+00	2026-04-06 10:44:08.635056+00	f	\N
166	2	629	dj 96 xax	bmw	\N	\N	\N	\N	2026-04-06 10:59:55.348968+00	\N	f	\N
167	2	630	GJ60SND	TESLA 	model s 	20000	\N	\N	2026-04-06 11:02:14.458318+00	\N	f	\N
168	2	633	dj85wks	range rover	\N	150000	\N	\N	2026-04-06 11:06:19.798139+00	\N	f	\N
169	2	636	DJ 77 GMD	VOLVO	XC60	210000	\N	\N	2026-04-06 11:31:57.517502+00	\N	f	\N
170	2	637	dj84zho	audi a6	\N	229568	\N	\N	2026-04-06 11:34:13.409404+00	\N	f	\N
171	2	638	dj18cnf	bmw	\N	370000	\N	\N	2026-04-06 11:41:08.598268+00	\N	f	\N
172	2	639	dj 61 blc	bmw	\N	\N	\N	\N	2026-04-06 11:49:46.080364+00	\N	f	\N
173	2	641	DJ24XTX	bmw 	x5	151786	\N	\N	2026-04-06 11:57:41.893066+00	\N	f	\N
174	2	642	dj12car	hyundai	\N	23000	\N	\N	2026-04-06 12:02:05.616597+00	\N	f	\N
175	2	643	DJ 82 CRD	TOYOTA	CHR	43754	\N	\N	2026-04-06 12:07:21.293429+00	\N	f	\N
176	2	606	GJ03MEG	volvo	\N	310000	\N	\N	2026-04-06 12:29:01.288319+00	\N	f	\N
177	2	646	DJ96WID	PEUGEOT	\N	35000	\N	\N	2026-04-06 12:30:22.77515+00	2026-04-06 12:30:58.729237+00	f	\N
178	2	649	dj 31 sfe	audiiq3	\N	\N	\N	\N	2026-04-06 12:34:30.85484+00	\N	f	\N
179	2	650	DJ50MUS	MERCEDES 	glc	16900	\N	\N	2026-04-06 12:39:36.029045+00	\N	f	\N
180	2	651	VL 62 DML	VW	GOLF	236300	\N	\N	2026-04-06 12:44:47.628466+00	\N	f	\N
181	2	652	b 827 flx	hiundai kona 	\N	\N	\N	\N	2026-04-06 12:55:07.304101+00	\N	f	\N
182	2	653	B816DVR	AUDI	\N	27000	\N	\N	2026-04-06 12:57:18.484669+00	\N	f	\N
183	2	656	ot 10 giv	peugeot 208	\N	2500	\N	\N	2026-04-06 13:31:04.928805+00	\N	f	\N
184	2	659	DJ16HSD	TOYOTA 	COROLLA	197000	\N	\N	2026-04-06 13:38:20.342811+00	\N	f	\N
185	2	660	DJ08SVT	HYUNDAI	\N	22000	\N	\N	2026-04-06 13:40:10.268663+00	\N	f	\N
186	2	661	dj 16 fpf	toiota iaris	\N	\N	\N	\N	2026-04-06 13:47:01.003208+00	\N	f	\N
187	2	663	B 550 BAW	PORSHE	\N	130000	\N	\N	2026-04-06 13:53:25.991713+00	\N	f	\N
188	2	664	DJ17HRL	MAZDA	\N	112000	\N	\N	2026-04-06 13:54:36.953329+00	\N	f	\N
189	2	665	DJ 20 FIR	hunday	\N	100000	\N	\N	2026-04-06 14:02:15.125026+00	\N	f	\N
190	2	667	nr rosu	moto	\N	28000	\N	\N	2026-04-06 14:18:38.719397+00	\N	f	\N
191	2	668	dj 92 wew	toiota corrola	\N	\N	\N	\N	2026-04-06 14:21:09.611551+00	\N	f	\N
192	2	662	DJ01WTE	mercedes	glc	22000	\N	\N	2026-04-06 14:30:55.723349+00	\N	f	\N
193	2	669	DJ78MLS	DACIA	LOGAN	29300	\N	\N	2026-04-07 05:45:18.664694+00	\N	f	\N
194	2	670	DJ 20 BMW	BMW	X5	176000	\N	\N	2026-04-07 05:57:18.208699+00	\N	f	\N
195	2	673	dj 55 rss	audii	\N	135000	\N	\N	2026-04-07 06:14:41.687568+00	\N	f	\N
196	2	674	DJ88AAE	MERCEDES	GLC	22518	\N	\N	2026-04-07 06:30:56.411583+00	\N	f	\N
197	2	675	DJ66BBU	AUDI A7	\N	180000	\N	\N	2026-04-07 06:34:08.948743+00	\N	f	\N
198	2	677	DJ 07 XRP	MERCEDES	\N	5159	\N	\N	2026-04-07 06:46:55.194628+00	\N	f	\N
199	2	679	B119DWW	DACA	LGAN	40000	\N	\N	2026-04-07 07:01:57.872839+00	\N	f	\N
200	2	680	DJ87DRO	BMW	\N	58000	\N	\N	2026-04-07 07:07:05.568594+00	\N	f	\N
201	2	681	DJ 87 STY	BMW	\N	100000	\N	\N	2026-04-07 07:14:07.480412+00	\N	f	\N
202	2	682	dj 60 aph	\N	reno	\N	\N	\N	2026-04-07 07:15:30.619949+00	\N	f	\N
203	2	683	GJ64NKY	MERCEDES 	GLE 	20000	\N	\N	2026-04-07 07:15:39.300085+00	\N	f	\N
204	2	685	DJ 19 DCB	dacia	spring	88000	\N	\N	2026-04-07 07:38:31.348082+00	\N	f	\N
205	2	687	DJ 12 SVT	FIAT	\N	13000	\N	\N	2026-04-07 07:45:55.98145+00	\N	f	\N
206	2	688	dj 55 xzx	\N	volvo	\N	\N	\N	2026-04-07 07:49:26.458389+00	\N	f	\N
207	2	684	DJ52ELF	DACIA	LOGAN	232000	\N	\N	2026-04-07 07:52:41.393791+00	2026-04-07 07:53:10.654599+00	f	\N
208	2	692	DJ 24 LXS	lexus	\N	29000	\N	\N	2026-04-07 08:13:36.835342+00	\N	f	\N
209	2	693	DJ73SAS	citroen 	\N	80000	\N	\N	2026-04-07 08:14:14.911283+00	\N	f	\N
210	2	694	DJ77PAX	HYUNDAI 	\N	50000	\N	\N	2026-04-07 08:20:30.289453+00	\N	f	\N
211	2	689	DJ 44 WMR	\N	bmw x5	60000	\N	\N	2026-04-07 08:37:39.335646+00	\N	f	\N
212	2	696	DJ75RSC	ALFA ROMEO	\N	300000	\N	\N	2026-04-07 08:39:57.974155+00	\N	f	\N
213	2	698	DJ77TLX	FORD	MONDEO 	210000	\N	\N	2026-04-07 08:51:08.503901+00	\N	f	\N
214	2	699	DJ 99 DXT	VW	PASSAT CC	136469	\N	\N	2026-04-07 08:51:13.439739+00	\N	f	\N
215	2	700	DJ33VRY	PASSAT	\N	264000	\N	\N	2026-04-07 08:52:54.572113+00	\N	f	\N
216	2	703	DJ42MAS	SKODA	\N	240000	\N	\N	2026-04-07 09:20:30.744581+00	\N	f	\N
217	2	702	DJ26ELF	bid	\N	\N	\N	\N	2026-04-07 09:21:32.174586+00	\N	f	\N
218	2	705	DJ 14 JJU	dacia	Sandero	105000	\N	\N	2026-04-07 09:29:20.563515+00	\N	f	\N
251	2	751	OT70AME	TOYOTA 	CHR 	25000	\N	\N	2026-04-08 06:24:58.090837+00	\N	f	\N
219	2	706	B803PRM	SKODA	\N	179000	\N	\N	2026-04-07 09:37:45.618991+00	2026-04-07 09:55:50.16562+00	f	\N
220	2	707	dj 69 kxx	\N	lamborghini	\N	\N	\N	2026-04-07 09:56:04.153853+00	\N	f	\N
221	2	708	B660SND	PORSCHE	\N	15000	\N	\N	2026-04-07 09:58:16.2156+00	\N	f	\N
222	2	709	DJ 26 LYA	ford	\N	48700	\N	\N	2026-04-07 10:03:47.539828+00	\N	f	\N
223	2	710	TR07ALM	SSANGYONG	\N	35000	\N	\N	2026-04-07 10:08:05.42388+00	\N	f	\N
224	2	713	dj 74 ptY	mazda 3	\N	13300	\N	\N	2026-04-07 10:34:15.927702+00	\N	f	\N
225	2	714	DJ13GLM	BMW	S5	180000	\N	\N	2026-04-07 10:41:14.96334+00	\N	f	\N
226	2	716	DJ 88 DPR	MAZDA	3	3500	\N	\N	2026-04-07 10:45:24.875993+00	\N	f	\N
227	2	718	DJ39NXT	JETTA	\N	253000	\N	\N	2026-04-07 10:54:47.175534+00	\N	f	\N
228	2	719	DJ77CHR	AUDI	\N	110000	\N	\N	2026-04-07 11:03:55.901263+00	\N	f	\N
229	2	723	DJ01HUM	vw	atreto	194000	\N	\N	2026-04-07 11:25:22.509385+00	2026-04-07 11:25:31.870835+00	f	\N
230	2	724	WP63RLY	BMW	\N	160000	\N	\N	2026-04-07 11:34:08.583333+00	\N	f	\N
231	2	726	ot 31 mtf	bmw	\N	\N	\N	\N	2026-04-07 11:55:29.505501+00	\N	f	\N
232	2	704	B802SND	PORSCHE	991	6300	\N	\N	2026-04-07 12:08:27.278615+00	\N	f	\N
233	2	728	DJ 98 LKW	mercedes	\N	64216	\N	\N	2026-04-07 12:11:34.17004+00	\N	f	\N
234	2	730	dj 05 mfc	bmw	\N	\N	\N	\N	2026-04-07 12:24:20.635648+00	\N	f	\N
235	2	729	DJ 49 DGE	TOYOTA	corolla 	84000	\N	\N	2026-04-07 12:38:30.137449+00	\N	f	\N
236	2	731	dj 35 hhh	toiota	\N	\N	\N	\N	2026-04-07 12:47:15.473239+00	\N	f	\N
237	2	733	WD66EOL	mercedes	\N	\N	\N	\N	2026-04-07 13:08:06.716629+00	\N	f	\N
238	2	734	cj 72 trv	scoda	\N	\N	\N	\N	2026-04-07 13:14:52.371666+00	\N	f	\N
239	2	735	DJ 03 PRO	toiota	\N	\N	\N	\N	2026-04-07 13:52:01.51462+00	\N	f	\N
240	2	738	DJ16WKW	\N	\N	35000	\N	\N	2026-04-07 13:52:08.521348+00	2026-04-07 13:56:30.054933+00	f	\N
241	2	739	DJ06SDL	MERCEDES	\N	320000	\N	\N	2026-04-07 14:08:27.879993+00	\N	f	\N
242	2	741	DJ 55 EVA	ford	kuga	183000	\N	\N	2026-04-07 14:18:28.556463+00	\N	f	\N
243	2	743	TM11ETY	Citroen	C4	270954	\N	\N	2026-04-07 22:26:05.889737+00	\N	f	\N
244	2	744	DJ90ALE	vw	golf	215000	\N	\N	2026-04-08 05:49:39.378969+00	\N	f	\N
245	2	745	DJ99MAY	reno	\N	\N	\N	\N	2026-04-08 05:51:39.283853+00	\N	f	\N
246	2	746	IS06PHA	skoda	fabia	\N	\N	\N	2026-04-08 05:53:24.176007+00	2026-04-08 05:53:34.845968+00	f	\N
248	2	748	MH92ALA	DACIA 	DUSTER	\N	\N	\N	2026-04-08 06:11:49.655038+00	2026-04-08 06:14:37.958548+00	f	\N
250	2	750	DJ19DMN	BMW	\N	260000	\N	\N	2026-04-08 06:13:42.513217+00	2026-04-08 06:15:32.897412+00	f	\N
252	2	752	B126CPX	geely	\N	\N	\N	\N	2026-04-08 06:27:04.21563+00	\N	f	\N
253	2	754	DJ26DRL	Bmw	\N	300000	\N	\N	2026-04-08 06:30:17.084673+00	\N	f	\N
254	2	755	CJ62THT	TOYOTA	\N	49176	\N	\N	2026-04-08 06:41:06.123976+00	\N	f	\N
255	2	757	DJ43YVS	TOYOTA 	yaris	6400	\N	\N	2026-04-08 06:59:59.074897+00	\N	f	\N
256	2	759	DJ08WRR	VW	\N	220000	\N	\N	2026-04-08 07:10:04.341645+00	\N	f	\N
247	2	747	B882CCR	FORD	\N	\N	\N	\N	2026-04-08 06:02:22.721663+00	2026-04-09 10:21:46.763438+00	f	\N
257	2	761	DJ01DVR	\N	volvo	\N	\N	\N	2026-04-08 07:16:16.643898+00	\N	f	\N
258	2	762	DJ16UHL	NISSAN	\N	178898	\N	\N	2026-04-08 07:32:03.256891+00	2026-04-08 07:32:34.08727+00	f	\N
259	2	760	DJ41MLS	vw	golf	130000	\N	\N	2026-04-08 07:34:34.270978+00	\N	f	\N
260	2	763	DJ14ARG	VW 	\N	250000	\N	\N	2026-04-08 07:44:30.870179+00	\N	f	\N
262	2	766	DJ96GNZ	\N	mercedes gle	\N	\N	\N	2026-04-08 07:46:13.062907+00	\N	f	\N
249	2	749	DJ16MDV	PEUGEOUT	\N	\N	VF3CUBHY6FY111970	\N	2026-04-08 06:12:47.244648+00	2026-04-08 12:45:19.825148+00	f	\N
263	2	768	DJ77LIT	VW	PASSAT 	\N	ADS A	\N	2026-04-08 07:49:50.271319+00	\N	f	\N
264	2	773	DJ17MRV	MERCEDES	\N	179000	\N	\N	2026-04-08 08:21:20.121849+00	\N	f	\N
265	2	774	DJ66DMC	dacia	logan	88570	\N	\N	2026-04-08 08:31:57.102183+00	\N	f	\N
266	2	772	DJ22BOZCEREALCOM	jeep	\N	\N	\N	\N	2026-04-08 08:42:39.319638+00	\N	f	\N
267	2	776	ECKKM4	bmw	\N	60000	\N	\N	2026-04-08 08:56:39.000778+00	\N	f	\N
268	2	777	DJ03AIB	BMW	\N	232000	\N	\N	2026-04-08 08:57:31.528536+00	\N	f	\N
269	2	778	DJ07SPW	vw	golf	316000	\N	\N	2026-04-08 09:06:18.785003+00	\N	f	\N
270	2	779	DJ87TCD	hiundai 	\N	\N	\N	\N	2026-04-08 09:08:41.566434+00	\N	f	\N
271	2	780	DJ92TBN	ford	puma	22000	\N	\N	2026-04-08 09:12:31.201597+00	\N	f	\N
272	2	783	DJ03AXH	TOYOTA	\N	71000	\N	\N	2026-04-08 09:27:44.110449+00	\N	f	\N
273	2	785	DJ50XPT	land rover	evog	166000	\N	\N	2026-04-08 09:35:29.525667+00	\N	f	\N
339	2	885	DJ93FRT	toyota	\N	30000	\N	\N	2026-04-09 10:37:46.012924+00	\N	f	\N
274	2	781	B102DLV	ford	transit couries	22243	\N	\N	2026-04-08 09:53:46.117021+00	2026-04-08 09:55:39.231677+00	f	\N
275	2	786	DJ17FIY	porsche	\N	40600	\N	\N	2026-04-08 10:00:00.486155+00	\N	f	\N
276	2	789	DJ03VXX	bmw	\N	150000	\N	\N	2026-04-08 10:16:28.29317+00	\N	f	\N
277	2	790	DJ19DYS	bmw	x3	162000	\N	\N	2026-04-08 10:34:50.831319+00	\N	f	\N
278	2	788	DJ14GCM	BMW	X1	270000	\N	\N	2026-04-08 10:39:19.925972+00	2026-04-08 10:40:12.56451+00	f	\N
279	2	793	DJ66FRT	toyota	\N	65000	\N	\N	2026-04-08 11:10:38.386539+00	\N	f	\N
280	2	794	DJ27RAC	\N	mercedes	\N	\N	\N	2026-04-08 11:11:20.133241+00	\N	f	\N
281	2	795	B100VXS	FORD	\N	187000	\N	\N	2026-04-08 11:16:14.756112+00	\N	f	\N
282	2	796	DJ52DRV	\N	mercedes	\N	\N	\N	2026-04-08 11:22:05.578078+00	\N	f	\N
283	2	799	DJ18JYE	peugeot	\N	16000	\N	\N	2026-04-08 11:40:27.55548+00	\N	f	\N
284	2	801	OT26PPE	mercedes	\N	180000	\N	\N	2026-04-08 11:48:21.00777+00	2026-04-08 11:48:56.642338+00	f	\N
285	2	797	OT06FOC	mercedes	\N	\N	\N	\N	2026-04-08 11:59:53.755497+00	\N	f	\N
286	2	804	DJ03MAP	FIAT	\N	129017	\N	\N	2026-04-08 12:17:40.384523+00	\N	f	\N
287	2	798	DJ56DEY	BMW	S3	223000	\N	\N	2026-04-08 12:20:40.4717+00	\N	f	\N
288	2	806	DJ38RXA	\N	bmw	\N	\N	\N	2026-04-08 12:41:19.170148+00	\N	f	\N
289	2	808	DJ92NOI	FORD 	eco sport 	43000	\N	\N	2026-04-08 12:57:07.983757+00	\N	f	\N
290	2	809	DJ24PAB	RENOULT	KANGOO	432076	\N	\N	2026-04-08 13:02:07.830276+00	\N	f	\N
291	2	802	DJ69KXX	lamborghini	\N	\N	\N	\N	2026-04-08 13:23:30.187478+00	2026-04-08 13:23:42.081942+00	f	\N
292	2	811	DJ07YMG	peugeot	\N	240000	\N	\N	2026-04-08 13:33:33.796921+00	\N	f	\N
293	2	812	DJ01CEC	RENOULT	\N	150000	\N	\N	2026-04-08 13:35:49.946848+00	\N	f	\N
294	2	813	DJ14GWJ	BMW	X5	398000	\N	\N	2026-04-08 13:35:58.840536+00	\N	f	\N
295	2	814	DJ78DRC	lexus	nx	\N	\N	\N	2026-04-08 13:52:41.2976+00	\N	f	\N
296	2	816	DJ43COM	vw	pasat	146000	\N	\N	2026-04-08 14:09:39.673696+00	\N	f	\N
297	2	817	DJ43COM	vw	pasat	146000	\N	\N	2026-04-08 14:10:01.40231+00	\N	f	\N
298	2	819	B 958 ALM 	audi	\N	75000	\N	\N	2026-04-09 05:38:05.67531+00	\N	f	\N
299	2	820	DJ12BEC	AUDI	A6	110000	\N	\N	2026-04-09 05:44:31.789674+00	\N	f	\N
300	2	821	DJ25ASK	AUDI	\N	258700	\N	\N	2026-04-09 05:45:35.040743+00	\N	f	\N
301	2	823	DJ60ALE	audii	\N	154410	\N	\N	2026-04-09 05:49:09.322147+00	\N	f	\N
302	2	824	DJ26PTX	mazda	\N	260000	\N	\N	2026-04-09 05:50:48.018525+00	\N	f	\N
303	2	822	DJ10KMR	vw	\N	88000	\N	\N	2026-04-09 06:06:39.388713+00	\N	f	\N
304	2	826	SB76KON	DACIA	DUSTER	243006	\N	\N	2026-04-09 06:14:02.711687+00	\N	f	\N
305	2	827	TM59AHC	\N	w pasat	\N	\N	\N	2026-04-09 06:18:56.60414+00	\N	f	\N
306	2	828	DJ18ABY	YAMAHA	\N	30000	\N	\N	2026-04-09 06:22:36.92279+00	\N	f	\N
307	2	829	DJ82FRT	toyota	\N	34000	\N	\N	2026-04-09 06:33:36.665114+00	\N	f	\N
308	2	831	DJ99BAS	bmw	\N	\N	\N	\N	2026-04-09 06:42:23.5354+00	\N	f	\N
309	2	834	DJ07EGN	PASSAT	\N	303914	\N	\N	2026-04-09 06:54:45.840799+00	\N	f	\N
310	2	835	DJ98ARG	reno	\N	225000	\N	\N	2026-04-09 06:56:27.637017+00	\N	f	\N
311	2	837	DJ25DME	mustamg	\N	65000	\N	\N	2026-04-09 07:02:43.378576+00	2026-04-09 07:04:14.605752+00	f	\N
312	2	839	DJ24EDS	AUDI 	A3	210000	\N	\N	2026-04-09 07:14:06.341738+00	\N	f	\N
313	2	840	DJ08ROW	vw	caddy	338000	\N	\N	2026-04-09 07:21:19.649548+00	\N	f	\N
314	2	841	VL28KOA	nissan	\N	283000	\N	\N	2026-04-09 07:28:26.21392+00	\N	f	\N
315	2	842	DJ81MLS	GOLF	\N	88000	\N	\N	2026-04-09 07:35:12.97575+00	\N	f	\N
316	2	832	DJ20AWD	audii	\N	\N	\N	\N	2026-04-09 07:43:28.668868+00	\N	f	\N
317	2	845	DJ02CVS	TOYOTA 	CHR  	47000	\N	\N	2026-04-09 07:48:48.778185+00	\N	f	\N
318	2	846	B53CPR	ford 	\N	96000	\N	\N	2026-04-09 07:56:55.702136+00	\N	f	\N
319	2	850	DJ18SNE	ford	\N	\N	\N	\N	2026-04-09 08:11:45.302658+00	\N	f	\N
320	2	851	DJ22SFV	AUDI	Q5	300000	\N	\N	2026-04-09 08:15:35.806952+00	\N	f	\N
321	2	852	DJ16FNA	\N	\N	68000	\N	\N	2026-04-09 08:20:40.135541+00	\N	f	\N
322	2	853	DJ24SCI	vw	passat	97000	\N	\N	2026-04-09 08:24:47.968121+00	2026-04-09 08:25:09.760224+00	f	\N
323	2	858	DJ36WLW	toyota 	\N	28000	\N	\N	2026-04-09 08:40:51.227038+00	\N	f	\N
340	2	871	DJ96AFC	polo	\N	325226	\N	\N	2026-04-09 10:39:16.011549+00	2026-04-09 10:40:21.197254+00	f	\N
341	2	881	DJ96ROT	sandero	\N	44000	\N	\N	2026-04-09 10:55:55.982144+00	\N	f	\N
324	2	860	DJ04DFT	AUDI 	A8	\N	\N	\N	2026-04-09 08:43:46.035968+00	\N	f	\N
325	2	861	GJ92TRM	bmw	\N	\N	\N	\N	2026-04-09 08:44:26.808521+00	\N	f	\N
261	2	765	DJ77LIT	BMW	1	20000	\N	OBS DE  LA MASINA 	2026-04-08 07:45:58.675915+00	2026-04-09 08:47:34.462877+00	f	\N
326	2	864	DJ1LLL	BMW 	1	150000	\N	VERDE	2026-04-09 08:58:10.938409+00	\N	f	\N
327	2	865	DJ69ACR	MERCEDES	\N	66000	\N	\N	2026-04-09 09:06:19.676178+00	\N	f	\N
328	2	867	B809MST	BMW 	\N	50000	\N	\N	2026-04-09 09:18:49.177958+00	\N	f	\N
329	2	868	DJ34CNC	mercedes	\N	490000	\N	\N	2026-04-09 09:21:49.559009+00	\N	f	\N
330	2	844	DJ08DOX	volvo	\N	102000	\N	\N	2026-04-09 09:23:38.943295+00	\N	f	\N
331	2	874	DJ17DWH	kia	\N	258000	\N	\N	2026-04-09 09:48:28.984738+00	\N	f	\N
332	2	875	DJ17DWH	kia rio 	\N	258863	\N	\N	2026-04-09 09:52:18.592352+00	\N	f	\N
333	2	876	OT96DRB	bmw 	\N	230000	\N	\N	2026-04-09 09:52:37.935266+00	\N	f	\N
334	2	877	DJ21MCY	TOYOTA	\N	60000	\N	\N	2026-04-09 09:53:44.78923+00	\N	f	\N
335	2	878	DJ77AVL	VW 	passat	176000	\N	\N	2026-04-09 09:59:48.442709+00	\N	f	\N
336	2	882	B228WGT	skoda	scala	\N	\N	\N	2026-04-09 10:23:02.847+00	\N	f	\N
337	2	883	DJ92LFB	\N	bmw	\N	\N	\N	2026-04-09 10:26:25.404808+00	\N	f	\N
338	2	884	DJ89MKE	AUDI	A4 	47000	\N	\N	2026-04-09 10:31:53.038339+00	\N	f	\N
342	2	888	DJ08GFL	hyundai	tucson	\N	\N	\N	2026-04-09 11:04:36.638211+00	\N	f	\N
343	2	889	DJ72NYS	FORD	\N	139241	\N	\N	2026-04-09 11:16:57.74159+00	\N	f	\N
345	2	891	DJ79SAG	hiundai 	\N	\N	\N	\N	2026-04-09 11:20:25.756249+00	\N	f	\N
346	2	892	B189PPE	SKODA 	KAROQ	141147	\N	\N	2026-04-09 11:21:33.465401+00	\N	f	\N
349	2	897	B272YUS	mazda	cx80	6500	\N	\N	2026-04-09 12:07:56.35225+00	\N	f	\N
344	2	890	DJ74MAN	bmw	\N	200000	\N	\N	2026-04-09 11:19:30.925086+00	2026-04-09 11:35:13.997673+00	f	\N
347	2	895	DJ01KEL	BMW	\N	180000	\N	\N	2026-04-09 11:49:26.539525+00	\N	f	\N
348	2	887	DJ70SYF	HYUNDAI	TUCSON 	186000	\N	\N	2026-04-09 12:05:22.11158+00	\N	f	\N
350	2	898	DJ30DDR	bmw	\N	\N	\N	\N	2026-04-09 12:09:27.952021+00	\N	f	\N
351	2	900	OT17LVK	ford	\N	214000	\N	\N	2026-04-09 12:21:18.649762+00	\N	f	\N
352	2	901	B972MEN	MAZDA	\N	27500	\N	\N	2026-04-09 12:30:30.573175+00	\N	f	\N
353	2	902	CJ27WTC	ford	kuga	74000	\N	\N	2026-04-09 12:35:58.087414+00	\N	f	\N
354	2	904	DJ02DEV	FORD 	MONDEO	225000	\N	\N	2026-04-09 12:38:49.147662+00	\N	f	\N
355	2	906	DJ33AKI	reno	\N	254000	\N	\N	2026-04-09 12:46:21.954175+00	\N	f	\N
356	2	908	DJ59RAF	mercedes	\N	104962	\N	\N	2026-04-09 13:09:45.58149+00	\N	f	\N
357	2	910	DJ17WSD	bmw	\N	135000	\N	\N	2026-04-09 13:11:38.290395+00	\N	f	\N
358	2	911	DJ17VWM	AUDI	Q5	164000	\N	\N	2026-04-09 13:17:47.343097+00	\N	f	\N
359	2	899	DJ30TOB	tigoan	\N	69696	\N	\N	2026-04-09 13:23:49.200552+00	\N	f	\N
360	2	912	B71RMA	PEUGEOT 	2008	42174	\N	\N	2026-04-09 13:26:07.117669+00	\N	f	\N
361	2	913	OT61AVS	sckoda	\N	250000	\N	\N	2026-04-09 13:30:24.315715+00	\N	f	\N
362	2	915	DJ28BYM	MERCEDES	\N	9000	\N	\N	2026-04-09 13:58:51.616735+00	\N	f	\N
363	2	917	DJ13XEN	vw	PASSAT	449000	\N	\N	2026-04-09 14:03:09.786403+00	\N	f	\N
364	2	920	DJ13MBT	TOYOTA	COROLLA	6500	\N	\N	2026-04-14 07:06:48.95611+00	\N	f	\N
365	2	919	DJ07UAU	mercedes	\N	92000	\N	\N	2026-04-14 07:15:42.195718+00	\N	f	\N
366	2	922	DJ22JUS	dacia	sandero	28000	\N	\N	2026-04-14 07:52:00.801463+00	\N	f	\N
367	2	923	DJ19ABS	bmw	\N	212000	\N	\N	2026-04-14 07:59:36.881032+00	\N	f	\N
368	2	924	DJ92BTY	TOYOTA	YARIS	\N	16000	\N	2026-04-14 08:00:54.151626+00	\N	f	\N
369	2	925	DJ23MDG	audii	\N	\N	\N	\N	2026-04-14 08:05:43.959747+00	\N	f	\N
370	2	927	DJ70AXG	hyundai	\N	27000	\N	\N	2026-04-14 08:33:40.332711+00	\N	f	\N
371	2	928	DJ27GMG	HYUNDAI 	TUCSON 	18000	\N	\N	2026-04-14 08:40:21.209921+00	\N	f	\N
372	2	929	DJ60XBX	mercedes	\N	191000	\N	\N	2026-04-14 08:40:43.451504+00	2026-04-14 08:41:16.946566+00	f	\N
373	2	921	OT50WOU	mercedes	\N	20000	\N	\N	2026-04-14 08:58:13.570434+00	\N	f	\N
374	2	930	DJ81RNY	nissan	\N	87000	\N	\N	2026-04-14 09:03:21.841285+00	\N	f	\N
375	2	932	B283MTH	bmw	\N	82000	\N	\N	2026-04-14 09:27:48.692127+00	\N	f	\N
376	2	933	DJ03CSS	bmw	\N	192000	\N	\N	2026-04-14 09:38:36.299783+00	2026-04-14 09:38:48.248354+00	f	\N
378	2	931	DJ96FLX	LEXUS	RX	227500	\N	\N	2026-04-14 09:41:35.350019+00	\N	f	\N
379	2	935	DJ97MSA	kia	\N	53112	\N	\N	2026-04-14 09:50:56.733985+00	\N	f	\N
380	2	937	VL14XCX	vw tiguan	\N	275000	\N	\N	2026-04-14 09:53:19.367297+00	\N	f	\N
377	2	934	DJ10XSA	vw 	\N	240000	\N	\N	2026-04-14 09:40:41.177628+00	2026-04-14 09:57:26.694945+00	f	\N
381	2	939	DJ19AAL	peugeot	3008	70000	\N	\N	2026-04-14 10:13:28.6196+00	\N	f	\N
382	2	940	DJ54BIL	opel	\N	220000	\N	\N	2026-04-14 10:15:42.141806+00	\N	f	\N
383	2	942	B969VDA	LEXUS 	ES30 	\N	\N	\N	2026-04-14 10:21:27.419788+00	\N	f	\N
384	2	943	DJ06XDA	reno	\N	78500	\N	\N	2026-04-14 10:36:43.555312+00	\N	f	\N
386	2	945	DJ98XMI	vw	passat	280000	\N	\N	2026-04-14 10:45:17.197277+00	\N	f	\N
385	2	944	B223MIK	toyota	\N	9675	\N	\N	2026-04-14 10:40:18.562202+00	2026-04-14 10:50:07.050875+00	f	\N
387	2	946	DJ33WBX	BMW 	S2	105000	\N	\N	2026-04-14 10:53:51.503021+00	\N	f	\N
388	2	947	DJ88HIT	scoda	\N	150000	\N	\N	2026-04-14 10:59:13.4461+00	\N	f	\N
389	2	948	DJ27KRA	vw	\N	300000	\N	\N	2026-04-14 11:10:45.237658+00	\N	f	\N
390	2	949	B10POM	bmw	\N	240000	\N	\N	2026-04-14 11:11:26.197935+00	\N	f	\N
391	2	950	B403EEA	mercedes	\N	\N	\N	\N	2026-04-14 11:26:59.646712+00	\N	f	\N
392	2	951	DJ24VFE	hyundai	\N	31137	\N	\N	2026-04-14 11:35:05.070212+00	\N	f	\N
393	2	953	B234JCB	SKODA	KAROQ	28604	\N	\N	2026-04-14 11:38:49.533607+00	\N	f	\N
394	2	954	DJ11SVM	kia	\N	30000	\N	\N	2026-04-14 11:39:46.418922+00	\N	f	\N
395	2	956	DJ30DIA	toiota	\N	30000	\N	\N	2026-04-14 11:52:28.594741+00	\N	f	\N
396	2	941	DJ83DME	dacia	duster	93700	\N	\N	2026-04-14 12:06:11.63363+00	\N	f	\N
397	2	957	B311JJJ	mercedes glc	\N	71000	\N	\N	2026-04-14 12:08:00.952208+00	\N	f	\N
398	2	958	DJ50DDM	TOYOTA	\N	24000	\N	\N	2026-04-14 12:08:14.696646+00	\N	f	\N
399	2	959	DJ45CPD	kia	\N	12000	\N	\N	2026-04-14 12:19:16.873164+00	\N	f	\N
400	2	960	DJ81FRT	toyota	\N	41000	\N	\N	2026-04-14 12:31:08.802367+00	\N	f	\N
401	2	952	DJ99JSS	OPEL	CORSA	216000	\N	\N	2026-04-14 12:47:01.628956+00	\N	f	\N
402	2	961	DJ09EWY	daia	duster	98000	\N	\N	2026-04-14 12:52:09.426248+00	2026-04-14 12:52:27.381563+00	f	\N
403	2	962	B127VGL	mercedes 	\N	19000	\N	\N	2026-04-14 13:07:32.873584+00	\N	f	\N
404	2	964	DJ09SID	audi	\N	263045	\N	\N	2026-04-14 13:18:16.922474+00	\N	f	\N
405	2	965	DJ24MXT	AUDI	\N	184000	\N	\N	2026-04-14 13:20:09.02368+00	\N	f	\N
406	2	963	DJ21UBU	toyota	\N	100000	\N	\N	2026-04-14 13:36:46.390337+00	\N	f	\N
407	2	967	DJ86GBR	hiundai	\N	50000	\N	\N	2026-04-14 13:48:00.397827+00	\N	f	\N
408	2	966	OT95TOY	bmw	\N	360000	\N	\N	2026-04-14 13:56:51.181753+00	\N	f	\N
409	2	969	DJ98APM	volvo 	xc 60	59000	\N	\N	2026-04-14 13:59:48.33532+00	\N	f	\N
410	2	968	OT23PWG	BMW 	S5 	330000	\N	\N	2026-04-14 14:03:39.665269+00	\N	f	\N
411	2	971	DJ20NMN	AUDI	\N	171500	\N	\N	2026-04-15 05:45:21.343078+00	\N	f	\N
412	2	972	DJ98AUM	skoda	\N	21000	\N	\N	2026-04-15 05:46:35.559289+00	\N	f	\N
413	2	974	DJ66BAU	MERCEDES 	SPRINTER	280000	\N	\N	2026-04-15 05:53:54.594462+00	\N	f	\N
414	2	975	DJ17AIP	ford puma	\N	43000	\N	\N	2026-04-15 05:59:12.585464+00	\N	f	\N
415	2	976	DJ32MDE	bmw x5	\N	\N	\N	\N	2026-04-15 06:04:21.707713+00	\N	f	\N
416	2	978	DJ44LDE	RENOULT	\N	23800	\N	\N	2026-04-15 06:14:03.198983+00	\N	f	\N
417	2	979	DJ69WSW	hyundai	\N	67400	\N	\N	2026-04-15 06:15:48.7179+00	\N	f	\N
418	2	981	B98RPE	opel	\N	80000	\N	\N	2026-04-15 06:28:01.856116+00	\N	f	\N
419	2	983	DJ10NBI	TOYOTA	CHR	68000	\N	\N	2026-04-15 06:32:30.797507+00	\N	f	\N
420	2	984	DJ45DGM	kia	\N	151000	\N	\N	2026-04-15 06:34:29.703164+00	\N	f	\N
421	2	987	OT10POP	LEXUS 	rx	260000	\N	\N	2026-04-15 07:07:50.642452+00	2026-04-15 07:08:13.662532+00	f	\N
422	2	977	DJ73MLS	wv	golf	161550	\N	ANV MONTATE CLIENT 2 BUC 2055516 	2026-04-15 07:19:14.868594+00	\N	f	\N
423	2	988	DJ70ABM	bmw	\N	132000	\N	\N	2026-04-15 07:22:50.522753+00	\N	f	\N
424	2	990	DJ21WKS	toyota	\N	14000	\N	\N	2026-04-15 07:29:49.267473+00	\N	f	\N
425	2	991	DJ62SOF	OPEL	astra j	259100	\N	\N	2026-04-15 07:37:38.239598+00	\N	f	\N
426	2	993	DJ09FPE	opel astra	\N	310000	\N	\N	2026-04-15 07:40:16.432999+00	\N	f	\N
427	2	997	B266MTC	skoda	\N	\N	26000	\N	2026-04-15 07:54:26.181146+00	\N	f	\N
428	2	998	DJ15NSD	HYUNDAI 	TUCSON 	70000	\N	\N	2026-04-15 08:12:35.970931+00	\N	f	\N
429	2	999	DJ44AAX	AUDI	QU	100000	\N	ANV CLIENT MONTATE 285 45 20 GOODYEAR EAGLE FQ	2026-04-15 08:17:24.241164+00	\N	f	\N
430	2	1000	DJ96KAM	skoda	\N	210000	\N	\N	2026-04-15 08:17:27.129141+00	\N	f	\N
431	2	986	DJ01VAE	tiguan	\N	260000	\N	\N	2026-04-15 08:25:59.495571+00	2026-04-15 08:26:23.869139+00	f	\N
433	2	1001	HPKL2004	bmw	\N	280000	\N	\N	2026-04-15 08:51:22.074397+00	\N	f	\N
434	2	1005	DJ22TAT	wv	TIGUAN	60000	\N	ANV CLIENT MONTATE 215 65 17 HNKOOK VENTUS PRIME 3              ANV CUSTODIE 215 65 16 BFGOOGRICH G FORCE WINTER 4 BUC 4 JANTE ALIAJ 4CAPACE CENTRU 	2026-04-15 09:02:10.956335+00	\N	f	\N
432	2	994	B246SCH	bmw x6	\N	66000	\N	\N	2026-04-15 08:36:44.729667+00	2026-04-15 09:04:08.388662+00	f	\N
435	2	1006	DJ68DRC	mercedes 	\N	\N	\N	\N	2026-04-15 09:12:12.310713+00	\N	f	\N
436	2	1007	DJ18VLZ	\N	\N	70000	\N	\N	2026-04-15 09:16:34.989472+00	\N	f	\N
437	2	1008	GJ66SND	AUDI	S8	100000	\N	\N	2026-04-15 09:24:37.683611+00	\N	f	\N
438	2	1009	DJ05WMO	mercedes	\N	\N	\N	\N	2026-04-15 09:34:02.127329+00	\N	f	\N
439	2	1010	VL99AZG	bmw	\N	18000	\N	\N	2026-04-15 09:34:54.203906+00	\N	f	\N
440	2	1011	OT14CCP	MERCEDES 	vito	139000	\N	\N	2026-04-15 09:50:39.802586+00	\N	f	\N
441	2	1002	DJ76NAT	mg	\N	30000	\N	\N	2026-04-15 09:55:09.298235+00	\N	f	\N
442	2	1012	DJ10RXA	mercedes	\N	150000	\N	\N	2026-04-15 10:04:04.518126+00	\N	f	\N
443	2	1013	DJ90SCH	mercedes v300	\N	172686	\N	\N	2026-04-15 10:11:44.119984+00	\N	f	\N
444	2	1014	B135RNV	wv 	ID3	83524	\N	ANV MONTATE 215 45 20 GOODYEAR EFFCIENTGRIP ANV MEN MAI SUS AU FOST MONTATE LA CEREA CLIENTULUI PREZINTA UZURA AVANSATA FLANC INTERIOR	2026-04-15 10:19:03.072524+00	\N	f	\N
445	2	1015	B510MXB	mercedes	\N	150000	\N	\N	2026-04-15 10:42:22.779686+00	\N	f	\N
446	2	1017	DJ91ANB	BYD	sealu	3700	\N	\N	2026-04-15 10:49:49.44222+00	\N	f	\N
447	2	1018	DJ04AKM	mercedes	\N	22000	\N	\N	2026-04-15 10:51:13.356229+00	\N	f	\N
448	2	1019	B881RBL	seat	\N	12500	\N	\N	2026-04-15 10:58:35.920305+00	\N	f	\N
449	2	1020	DJ60SHO	tesla	\N	71684	\N	\N	2026-04-15 10:58:50.816906+00	\N	f	\N
450	2	1023	DJ10NLE	logan	\N	150000	\N	\N	2026-04-15 11:15:14.913351+00	\N	f	\N
451	2	1022	DJ37RDI	toyota	\N	190000	\N	\N	2026-04-15 11:20:52.422568+00	\N	f	\N
452	2	1024	VL33TER	ISUZU	LS	52730	\N	\N	2026-04-15 11:27:27.643913+00	\N	f	\N
454	2	1026	DJ28CBS	passat	\N	272000	\N	\N	2026-04-15 11:45:12.372744+00	\N	f	\N
455	2	1027	OT05BOR	Scoda	\N	485000	\N	\N	2026-04-15 11:53:50.646279+00	\N	f	\N
456	2	1028	DJ01XEI	audii	\N	\N	\N	\N	2026-04-15 11:58:16.234748+00	\N	f	\N
457	2	1031	DJ28GIL	nissan	\N	45000	\N	\N	2026-04-15 12:22:42.947191+00	\N	f	\N
458	2	1034	DJ14TAT	golf	\N	\N	215000	\N	2026-04-15 12:52:51.161479+00	\N	f	\N
459	2	1035	DJ77SFP	audi	\N	49500	\N	\N	2026-04-15 13:01:17.888984+00	\N	f	\N
460	2	1033	IF99GRK	opel	\N	248000	\N	\N	2026-04-15 13:20:11.164781+00	\N	f	\N
461	2	1040	DJ84BNC	BMW 	E91	280000	\N	ANV MONTATE CLIENT 2254517  2554517 BRIDGESTONE POTENZA  NEXEN N FERA 	2026-04-15 13:35:25.292696+00	\N	f	\N
462	2	1032	DJ09UZT	seat	\N	150000	\N	\N	2026-04-15 13:39:36.00205+00	\N	f	\N
463	2	1037	DJ017189	\N	tesla	86000	\N	\N	2026-04-15 14:01:32.272938+00	\N	f	\N
453	2	1025	B456BTC 	MERCEDES 	G CLASS	72000	\N	\N	2026-04-15 11:35:02.224075+00	2026-04-15 14:01:37.079894+00	f	\N
464	2	1038	DJ70XAS	TOYOTA	COROLLA 	126000	\N	\N	2026-04-15 14:08:36.323664+00	\N	f	\N
465	2	1041	DJ12FSM	hyundai	\N	\N	20000	\N	2026-04-15 14:17:22.913055+00	\N	f	\N
466	2	1042	DJ02DST	MERCEDES 	VITO	175700	\N	\N	2026-04-15 14:20:17.425667+00	\N	f	\N
467	2	1045	DJW29KIR	vw	tiguan	224007	\N	\N	2026-04-16 05:41:19.809556+00	2026-04-16 05:41:40.546398+00	f	\N
468	2	1047	DJ52AMV	mercedes	\N	65000	\N	\N	2026-04-16 05:45:36.130291+00	\N	f	\N
469	2	1050	DJ01CPK	bmw	\N	65000	\N	\N	2026-04-16 06:00:51.781544+00	\N	f	\N
470	2	1044	DJ77XZZ	BMW	G30 	160000	\N	\N	2026-04-16 06:02:48.793238+00	\N	f	\N
471	2	1052	B121LRB	renault	\N	98000	\N	\N	2026-04-16 06:04:40.822065+00	\N	f	\N
472	2	1053	DJ11DBZ	honda	\N	216000	\N	\N	2026-04-16 06:08:22.914815+00	\N	f	\N
473	2	1054	DJ77XZZ	BMW	G30 	\N	\N	\N	2026-04-16 06:17:27.516991+00	\N	f	\N
474	2	1056	DJ25ADU	MERCEDES	E CLASS	178000	\N	\N	2026-04-16 06:32:46.374768+00	\N	f	\N
475	2	1057	B85CZS	sandero	\N	238000	\N	\N	2026-04-16 06:45:36.463964+00	\N	f	\N
476	2	1058	DJ74RIC	opel	astra	82000	\N	\N	2026-04-16 06:47:03.766971+00	\N	f	\N
477	2	1061	DJ73YGI	BMW	S3	245217	\N	\N	2026-04-16 06:57:49.999162+00	\N	f	\N
478	2	1063	DJ29AEA	seat	\N	178000	\N	\N	2026-04-16 07:13:04.246034+00	\N	f	\N
479	2	1064	DJ55BAS	MERCEDES 	glc	140000	\N	\N	2026-04-16 07:15:34.611469+00	\N	f	\N
480	2	1065	DJ96TAD	\N	passat	178000	\N	\N	2026-04-16 07:19:48.865438+00	\N	f	\N
481	2	1066	DJ15MWM	mercedes	\N	195000	\N	\N	2026-04-16 07:20:46.181908+00	\N	f	\N
482	2	1067	DJ17WKW	Suzuki	vitara	99000	\N	\N	2026-04-16 07:25:11.568781+00	\N	f	\N
483	2	1069	DJ05DSS	toyota	\N	7000	\N	\N	2026-04-16 07:31:13.512609+00	\N	f	\N
484	2	1068	MH29DEI	MERCEDES 	gle 	72700	\N	\N	2026-04-16 07:36:37.724513+00	\N	f	\N
485	2	1062	DJ67XDK	renault	\N	53000	\N	\N	2026-04-16 07:51:36.640547+00	\N	f	\N
486	2	1070	DJ19AZV	Mitsubishi	\N	114000	\N	\N	2026-04-16 08:03:01.821851+00	\N	f	\N
487	2	1071	DJ27PCO	pejout	\N	78000	\N	\N	2026-04-16 08:05:15.817169+00	\N	f	\N
488	2	1072	DJ82GMM	BMW 	X1	200000	\N	ANV MONTATE 2254519   2553519  HANKOOK S1 EVO 3    RECOMAND ILOC ANV PARTEA SPATE UZURA AVANSATA LA LIMITA SI FLANC INTR AU FOST MONTATE PE RASPUNDEREA CLIENTULUI	2026-04-16 08:05:40.96312+00	\N	f	\N
489	2	1073	B444ANJ	TOYOTA	RAV4	20000	\N	\N	2026-04-16 08:09:42.060482+00	\N	f	\N
490	2	1074	DJ11BGB	bmw	\N	270000	\N	\N	2026-04-16 08:21:59.696392+00	\N	f	\N
491	2	1075	DJ10RIM	logan	\N	200000	\N	\N	2026-04-16 08:29:42.431036+00	\N	f	\N
492	2	1078	DJ66SEA	lexus	rx450	193000	\N	\N	2026-04-16 08:43:35.141178+00	\N	f	\N
493	2	1079	WESDY586	MERCEDES 	cla	119000	\N	\N	2026-04-16 08:47:32.114797+00	2026-04-16 08:47:55.986472+00	f	\N
494	2	1081	DJ80MET	wv 	TRANSPORTER	220000	\N	ANV MONTATE 205 65 16C MIC AGILIS 5	2026-04-16 08:57:50.58643+00	\N	f	\N
495	2	1082	DJ88VAP	range rover	\N	160000	\N	\N	2026-04-16 09:02:00.377634+00	\N	f	\N
496	2	1084	DJ51MRG	bmw	\N	371000	\N	\N	2026-04-16 09:03:27.573695+00	\N	f	\N
497	2	1085	B17TCM	mercedes	gls	54000	\N	\N	2026-04-16 09:13:05.080328+00	\N	f	\N
498	2	1089	DJ22WTF	RENAULT 	megan 	100000	\N	\N	2026-04-16 09:27:16.753368+00	\N	f	\N
499	2	1090	TM86MNX	duster	\N	\N	\N	\N	2026-04-16 09:29:15.349027+00	\N	f	\N
500	2	1091	DJ17HFO	tesla	\N	60000	\N	\N	2026-04-16 09:38:03.698402+00	\N	f	\N
501	2	1092	B221RDW	toyota	\N	2556	\N	\N	2026-04-16 09:39:59.961586+00	\N	f	\N
502	2	1093	DJ73DYN	audi	q5	173000	\N	\N	2026-04-16 09:44:22.337318+00	\N	f	\N
503	2	1094	DJ63HSD	toiota	\N	\N	\N	\N	2026-04-16 10:01:40.501817+00	\N	f	\N
504	2	1095	DJ14SZU	skoda	\N	275000	\N	\N	2026-04-16 10:10:12.357823+00	\N	f	\N
505	2	1097	DJ39ADO	renoult	\N	85000	\N	\N	2026-04-16 10:12:21.853801+00	\N	f	\N
506	2	1098	B335AMI	AUDI	Q5	99500	\N	\N	2026-04-16 10:15:06.748711+00	\N	f	\N
507	2	1099	DJ65SEK	logan	\N	\N	\N	\N	2026-04-16 10:22:43.25879+00	\N	f	\N
508	2	1100	DJ93DYN	audi	a6	40000	\N	\N	2026-04-16 10:35:39.375412+00	\N	f	\N
509	2	1101	B81WGT	skoda	\N	55000	\N	\N	2026-04-16 10:35:45.588887+00	\N	f	\N
510	2	1106	DJ55WET	doker	\N	\N	\N	\N	2026-04-16 10:48:10.312048+00	\N	f	\N
511	2	1107	B05WGT	Skoda	\N	78000	\N	\N	2026-04-16 10:49:48.585902+00	\N	f	\N
512	2	1108	DJ16VDD	hyundai	\N	207000	\N	\N	2026-04-16 10:54:38.071177+00	\N	f	\N
513	2	1111	DJ09BAV	bmw	\N	240000	\N	\N	2026-04-16 11:14:14.789594+00	\N	f	\N
514	2	1112	DJ11NWN	vw	passat	218000	\N	\N	2026-04-16 11:16:53.718005+00	\N	f	\N
515	2	1114	DJ38ETC	toiota corrola	\N	\N	\N	\N	2026-04-16 11:30:09.370858+00	\N	f	\N
516	2	1110	DJ10KYM	passat	\N	600000	\N	\N	2026-04-16 11:43:00.212745+00	\N	f	\N
517	2	1116	DJ07YSN	vw	polo	180000	\N	\N	2026-04-16 11:44:26.132542+00	\N	f	\N
518	2	1117	DJ18JTC	opwel	GRANDLAND 	10400	\N	\N	2026-04-16 11:48:59.190087+00	\N	f	\N
519	2	1118	DJ84YAB	mercedes 	\N	267000	\N	\N	2026-04-16 11:49:24.907827+00	\N	f	\N
520	2	1119	DJ69AAM	bmw	\N	290000	\N	\N	2026-04-16 11:58:19.220786+00	\N	f	\N
521	2	1120	OT34CIA	\N	ford	\N	\N	\N	2026-04-16 12:05:36.788258+00	\N	f	\N
522	2	1121	DJ22DLC	skoda	\N	35000	\N	\N	2026-04-16 12:07:48.516264+00	\N	f	\N
523	2	1123	DJ51SKY	bmw	x1	11000	\N	\N	2026-04-16 12:12:45.310136+00	\N	f	\N
524	2	1125	DJ77TYR	BMW	X5	159000	\N	\N	2026-04-16 12:24:51.250096+00	\N	f	\N
525	2	1126	DJ65KAM	toyota	\N	26000	\N	\N	2026-04-16 12:24:58.95535+00	\N	f	\N
526	2	1127	DJ66RBC	mercedes	\N	27000	\N	\N	2026-04-16 12:25:37.964721+00	\N	f	\N
527	2	1128	DJ77TYR	BMW	X5	\N	\N	\N	2026-04-16 12:26:42.496805+00	\N	f	\N
528	2	1129	DJ77SET	audi	a6	157900	\N	\N	2026-04-16 12:34:40.45525+00	\N	f	\N
529	2	1130	DJ52ACD	nissan	\N	\N	\N	\N	2026-04-16 12:35:26.989845+00	\N	f	\N
530	2	1131	DJ18FJD	bmw	\N	30448	\N	\N	2026-04-16 12:54:56.4277+00	\N	f	\N
531	2	1132	MH12PRV	bmw	\N	320000	\N	\N	2026-04-16 12:56:13.474555+00	\N	f	\N
532	2	1134	DJ02DBI	bmw	\N	20000	\N	\N	2026-04-16 13:08:17.479965+00	\N	f	\N
533	2	1135	B717PXZ	BMW	M2	21800	\N	\N	2026-04-16 13:12:19.339907+00	\N	f	\N
534	2	1136	B486MXM	mercedes	\N	50000	\N	\N	2026-04-16 13:24:03.037805+00	\N	f	\N
535	2	1124	DJ01PFY	mercedes	\N	116000	\N	\N	2026-04-16 13:24:20.287848+00	\N	f	\N
536	2	1115	B145ELC	jogeer	\N	145000	\N	\N	2026-04-16 13:36:35.845132+00	\N	f	\N
537	2	1137	IF17LSN	skoda	\N	282657	\N	\N	2026-04-16 13:40:14.860118+00	\N	f	\N
538	2	1138	DJ01ATG	BMW	G30	108000	\N	\N	2026-04-16 13:40:58.066333+00	\N	f	\N
539	2	1139	DJ20MVM	range rover	\N	\N	\N	\N	2026-04-16 14:00:22.171328+00	\N	f	\N
540	2	1122	DJ18RCY	FORD	\N	\N	\N	\N	2026-04-16 14:07:09.108181+00	\N	f	\N
541	2	1140	AB21AUA	Dacia	\N	\N	\N	\N	2026-04-16 14:09:06.341156+00	\N	f	\N
542	2	1142	DJ57MLA	vw 	CADDY	196689	\N	\N	2026-04-16 14:20:07.395355+00	\N	f	\N
543	2	1144	DJ08EMY	AUDI	A5	284000	\N	\N	2026-04-17 05:31:04.780788+00	\N	f	\N
544	2	1145	DJ14UPE	toiota iaris	\N	54000	\N	\N	2026-04-17 05:40:33.383323+00	\N	f	\N
545	2	1147	DJ29MRM	kia	\N	11400	\N	\N	2026-04-17 05:49:54.110154+00	\N	f	\N
547	2	1149	DJ50CSN	iveco	\N	22500	\N	\N	2026-04-17 05:55:23.289501+00	\N	f	\N
546	2	1143	DJ23TGO	toiota	\N	56000	\N	\N	2026-04-17 05:53:39.092703+00	2026-04-17 05:58:46.681975+00	f	\N
548	2	1151	DJ88SET	volvo	\N	\N	\N	\N	2026-04-17 06:10:34.503266+00	\N	f	\N
549	2	1152	DJ73MGO	MERCEDES 	e class	56600	\N	\N	2026-04-17 06:12:40.214626+00	\N	f	\N
550	2	1154	DJ85SFD	mercedes	\N	68000	\N	\N	2026-04-17 06:22:52.120437+00	\N	f	\N
551	2	1155	DJ09WYO	toyota	land cruser	300000	\N	\N	2026-04-17 06:28:25.254675+00	\N	f	\N
552	2	1157	DJ70CSN	toyota	\N	222000	\N	\N	2026-04-17 06:33:26.112717+00	\N	f	\N
553	2	1158	DJ10RRC	toiota	\N	40000	\N	\N	2026-04-17 06:38:28.447911+00	\N	f	\N
554	2	1159	DJ64MCA	FORD	FOCUS	72900	\N	\N	2026-04-17 06:46:11.985719+00	\N	f	\N
555	2	1161	DJ44MET	vw	\N	167000	\N	\N	2026-04-17 06:56:32.951872+00	\N	f	\N
556	2	1146	DJ18HOB	OPEL	ASTR	150000	\N	ANV MON 2156016 BRIDGESTONE TURANZA 4 BUC.    ANV CUSTODIE. 2156016 BFGOOGRICH G FORCE WINTER MM6 DOT 421I	2026-04-17 07:01:40.02085+00	\N	f	\N
557	2	1164	B889HAF	ford	\N	\N	\N	\N	2026-04-17 07:02:26.345895+00	\N	f	\N
558	2	1165	IS10PHA	opel	\N	59000	\N	\N	2026-04-17 07:03:43.543079+00	\N	f	\N
559	2	1166	DJ85SPY	toiota c hr	\N	52000	\N	\N	2026-04-17 07:11:24.699975+00	\N	f	\N
560	2	1167	DJ22MKV	GOF 	\N	220000	\N	\N	2026-04-17 07:11:36.076178+00	\N	f	\N
561	2	1169	B889HAF	ford	\N	\N	\N	\N	2026-04-17 07:26:14.620873+00	\N	f	\N
562	2	1170	DJ06CTI	vw	\N	291000	\N	\N	2026-04-17 07:30:10.313658+00	\N	f	\N
563	2	1173	DJ17JOJ	logan	\N	100000	\N	\N	2026-04-17 07:40:27.651197+00	\N	f	\N
564	2	1174	DJ16LSA	mercedes	\N	\N	\N	\N	2026-04-17 07:42:11.874001+00	\N	f	\N
565	2	1175	SB88KON	crafter	\N	343000	\N	\N	2026-04-17 07:54:05.872819+00	\N	f	\N
566	2	1176	B22FBT	TOYOTA	COROLLA	38000	\N	\N	2026-04-17 07:58:14.181723+00	\N	f	\N
567	2	1177	DJ11YTG	opel	\N	217000	\N	\N	2026-04-17 08:00:16.671533+00	\N	f	\N
568	2	1168	DJ58PMD	mercedes	\N	240000	\N	\N	2026-04-17 08:02:50.076748+00	2026-04-17 08:04:01.978559+00	f	\N
569	2	1178	DJ97REG	bmw	\N	\N	\N	\N	2026-04-17 08:06:35.014753+00	\N	f	\N
570	2	1181	DJ93NCT	DACIA	sandero	57000	\N	\N	2026-04-17 08:23:00.876996+00	\N	f	\N
571	2	1182	B76YND	audi	\N	90000	\N	\N	2026-04-17 08:26:36.124715+00	\N	f	\N
572	2	1183	DJ74ELF	fiat	ducato	\N	\N	\N	2026-04-17 08:33:38.192349+00	\N	f	\N
573	2	1184	DJ20CHR	opel	\N	190000	\N	\N	2026-04-17 08:46:06.728678+00	\N	f	\N
574	2	1186	DJ66GMI	bmw	\N	185000	\N	\N	2026-04-17 08:54:39.208678+00	\N	f	\N
575	2	1187	B76YND	audi	\N	\N	\N	\N	2026-04-17 08:56:09.769129+00	\N	f	\N
576	2	1188	DJ96DCL	TOYOTA 	CHR	28614	\N	\N	2026-04-17 08:57:13.01739+00	\N	f	\N
577	2	1189	DJ93REI	w golf	\N	\N	\N	\N	2026-04-17 09:09:47.961581+00	\N	f	\N
578	2	1190	DJ28AEB	TOYOTA	AURIS	67000	\N	\N	2026-04-17 09:18:25.80568+00	\N	f	\N
579	2	1191	B44NDN	peugeot	\N	\N	120000	\N	2026-04-17 09:30:17.715226+00	\N	f	\N
580	2	1192	DJ29EGE	bmw	\N	133000	\N	\N	2026-04-17 09:36:52.621321+00	\N	f	\N
581	2	1193	DJ66GMI	bmw	\N	\N	\N	\N	2026-04-17 09:39:38.687817+00	\N	f	\N
582	2	1194	DJ09ZAM	bmw	x6	119700	\N	\N	2026-04-17 09:41:41.789715+00	\N	f	\N
583	2	1198	DJ13BMW	BMW 	S3	100000	\N	\N	2026-04-17 09:50:39.546038+00	\N	f	\N
584	2	1199	DJ83DRO	bmw	\N	150000	\N	\N	2026-04-17 09:55:09.039097+00	\N	f	\N
585	2	1200	DJ16YJO	reno	\N	\N	\N	\N	2026-04-17 10:04:05.934427+00	\N	f	\N
586	2	1202	DJ08GLD	toyota	\N	80000	\N	\N	2026-04-17 10:06:18.700798+00	\N	f	\N
587	2	1204	DJ14VNK	mitsubishi	\N	194261	\N	\N	2026-04-17 10:25:51.321172+00	\N	f	\N
588	2	1205	DJ20HIM	BMW	s6	207000	\N	\N	2026-04-17 10:30:58.289523+00	\N	f	\N
589	2	1206	DJ76FLA	dacia	\N	\N	\N	\N	2026-04-17 10:32:53.610632+00	\N	f	\N
590	2	1207	DJ15HGW	dokeer	\N	395000	\N	\N	2026-04-17 10:33:03.880226+00	\N	f	\N
591	2	1209	DJ08VSE	hyundai	\N	120000	\N	\N	2026-04-17 10:49:08.023561+00	\N	f	\N
592	2	1211	SB53CCI	dacia	jogger	23625	\N	\N	2026-04-17 11:01:01.09719+00	\N	f	\N
593	2	1212	SB64CCI	dacia	\N	\N	\N	\N	2026-04-17 11:12:11.882576+00	\N	f	\N
594	2	1213	DJ82MDL	ford	\N	130000	\N	\N	2026-04-17 11:16:06.885863+00	\N	f	\N
595	2	1215	DJ77MYM	bmw	\N	130263	\N	\N	2026-04-17 11:29:49.425767+00	\N	f	\N
596	2	1216	DJ82AUG	w golf	\N	\N	\N	\N	2026-04-17 11:43:06.489028+00	\N	f	\N
597	2	1203	DJ96LAM	ford	\N	300000	\N	\N	2026-04-17 11:54:48.426062+00	\N	f	\N
598	2	1218	B09DXC	MERCEDES 	\N	59000	\N	\N	2026-04-17 11:55:16.349189+00	\N	f	\N
599	2	1196	DJ13SUI	vw	\N	\N	\N	\N	2026-04-17 12:05:09.798634+00	\N	f	\N
600	2	1219	DJ06DFX	volvo	\N	\N	\N	\N	2026-04-17 12:08:11.227319+00	\N	f	\N
601	2	1220	DJ18XOV	renault	\N	243000	\N	\N	2026-04-17 12:13:24.446257+00	\N	f	\N
602	2	1221	DJ01ELM	loghy	\N	280000	\N	\N	2026-04-17 12:16:07.59986+00	\N	f	\N
603	2	1222	DJ07LWR	fiat	doblo	300500	\N	\N	2026-04-17 12:26:40.19411+00	\N	f	\N
604	2	1225	DJ08KOD	honda civic	\N	16000	\N	\N	2026-04-17 13:04:09.376509+00	2026-04-17 13:04:21.403801+00	f	\N
605	2	1226	VL78MWM	TOYOTA 	CHR	60000	\N	\N	2026-04-17 13:12:14.78078+00	\N	f	\N
606	2	1228	CJ62TLW	skoda	\N	39000	\N	\N	2026-04-17 13:12:59.981326+00	\N	f	\N
607	2	1229	DJ05CXX	mazda	\N	33000	\N	\N	2026-04-17 13:20:18.024226+00	\N	f	\N
608	2	1214	DJ08AXG	toyota	\N	85000	\N	\N	2026-04-17 13:23:53.45007+00	\N	f	\N
609	2	1231	DJ71NKY	dacia	dokker	105450	\N	\N	2026-04-17 13:32:02.974399+00	2026-04-17 13:32:19.239257+00	f	\N
610	2	1232	DJ09LPX	ford focus	\N	\N	\N	\N	2026-04-17 13:39:01.829845+00	\N	f	\N
611	2	1233	DJ55BMD	vw	\N	170000	\N	\N	2026-04-17 13:40:29.24434+00	\N	f	\N
612	2	1217	DJ94RNO	TOYOTA 	CHR	70000	\N	\N	2026-04-17 13:47:02.71288+00	\N	f	\N
613	2	1234	DJ26GHF	bmw	x3	\N	\N	\N	2026-04-17 13:59:50.423668+00	\N	f	\N
614	2	1235	DJ28JOK	MERCEDES 	\N	350000	\N	\N	2026-04-17 13:59:55.623676+00	\N	f	\N
615	2	1236	DJ16CDV	vw	\N	275000	\N	\N	2026-04-17 14:02:55.824428+00	\N	f	\N
616	2	1237	DJ22XAS	vw	taigo	7627	\N	\N	2026-04-17 14:04:17.696902+00	\N	f	\N
617	2	1238	DJ31PES	tiguan	\N	11100	\N	\N	2026-04-17 14:10:13.212562+00	\N	f	\N
618	2	1239	DJ18WIB	mazda	\N	6000	\N	\N	2026-04-17 14:15:56.628265+00	\N	f	\N
619	2	1240	DJ29EXV	reno koleos	\N	150000	\N	\N	2026-04-17 14:19:29.955978+00	\N	f	\N
620	2	1241	TC233224	FORD	kuga	153000	\N	\N	2026-04-17 14:40:48.308148+00	\N	f	\N
621	2	1243	DJ10DCO	nissan x trail	\N	287000	\N	\N	2026-04-20 05:39:32.944811+00	\N	f	\N
622	2	1245	B953BCE	hyundai	\N	55000	\N	\N	2026-04-20 05:46:18.824024+00	\N	f	\N
623	2	1244	DJ55KLS	MAZDA	6	125000	\N	\N	2026-04-20 05:50:51.150433+00	\N	f	\N
624	2	1246	SB57CCI	toyta	\N	\N	\N	\N	2026-04-20 05:55:03.431572+00	\N	f	\N
625	2	1247	DJ90VFM	DACIA 	DUSTER	120000	\N	ANV MONTATE BRIDGESTONE 2156017 4 BUC	2026-04-20 06:01:35.090952+00	\N	f	\N
626	2	1249	DJ68FRT	toyota	\N	40000	\N	\N	2026-04-20 06:06:51.201675+00	\N	f	\N
627	2	1250	DJ08ZAM	audii q3	\N	49000	\N	\N	2026-04-20 06:07:47.749157+00	\N	f	\N
628	2	1251	DJ82MOM	RENAULT 	SIMBOL	220000	\N	\N	2026-04-20 06:10:35.515833+00	\N	f	\N
629	2	1253	DJ82BLU	toyota	\N	75000	\N	\N	2026-04-20 06:26:28.942212+00	\N	f	\N
630	2	1255	DJ99BDM	audii	\N	\N	\N	\N	2026-04-20 06:40:00.170227+00	\N	f	\N
631	2	1256	DJ35MBZ	mercedes	\N	\N	\N	\N	2026-04-20 06:43:26.013326+00	\N	f	\N
632	2	1257	DJ28ATT	hyundai	\N	37000	\N	\N	2026-04-20 06:46:31.23321+00	\N	f	\N
633	2	1259	B55PXS	wv	CRAFTER	100000	\N	ANV MONTATE 2057516C4 BUC HANKOOK	2026-04-20 06:57:06.206384+00	\N	f	\N
634	2	1260	DJ33GPC	FORD 	KUGA	126500	\N	\N	2026-04-20 07:10:08.340173+00	\N	f	\N
635	2	1261	B108RTT	vw	taigo	52325	\N	\N	2026-04-20 07:19:41.001683+00	\N	f	\N
636	2	1264	OT41ULI	bmw	\N	210000	\N	\N	2026-04-20 07:31:21.136319+00	\N	f	\N
637	2	1265	DJ33GPC	FORD 	KUGA	\N	\N	\N	2026-04-20 07:31:43.106178+00	\N	f	\N
638	2	1262	DJ28KID	RENAULT 	MEGANE 	49560	\N	\N	2026-04-20 07:41:41.378012+00	\N	f	\N
639	2	1266	DJ55CNE	renault	megane	90000	\N	\N	2026-04-20 07:44:47.926487+00	\N	f	\N
640	2	1270	DJ22BNC	mercedes	\N	87000	\N	\N	2026-04-20 08:03:10.256745+00	\N	f	\N
641	2	1271	DJ21ASI	MERCEDES	GLA	43000	\N	\N	2026-04-20 08:18:04.199441+00	2026-04-20 08:18:49.193466+00	f	\N
642	2	1272	OT41ULI	bmw	\N	\N	\N	\N	2026-04-20 08:19:47.345546+00	\N	f	\N
643	2	1273	DJ28RMN	ford	\N	15000	\N	\N	2026-04-20 08:30:48.164076+00	\N	f	\N
644	2	1274	DJ55JAM	mercedes gle	\N	35000	\N	\N	2026-04-20 08:34:03.840507+00	\N	f	\N
645	2	1263	DJ44GBX	PEUGEOT 	5008	240000	\N	DIMENSIUNEA 2155516	2026-04-20 08:47:07.744451+00	\N	f	\N
646	2	1269	DJ22LXA	golf	\N	65000	\N	\N	2026-04-20 08:52:26.65653+00	\N	f	\N
647	2	1278	DJ13CLP	skoda	octavia	150000	\N	\N	2026-04-20 08:59:13.315913+00	\N	f	\N
648	2	1279	SB74CON	BMW 	X4	50000	\N	\N	2026-04-20 09:02:11.272399+00	\N	f	\N
649	2	1281	DJ28NNN	mazda 	\N	38000	\N	\N	2026-04-20 09:20:00.55641+00	\N	f	\N
650	2	1282	OT93RMS	RENAULT	MASTER	128000	\N	2256516C BRIDGESTONE RBUC	2026-04-20 09:29:18.590637+00	\N	f	\N
651	2	1285	DJ07WRM	toyota	corolla	7000	\N	\N	2026-04-20 09:33:51.6554+00	\N	f	\N
652	2	1287	DJ64HAR	opel	\N	40000	\N	\N	2026-04-20 09:38:56.068469+00	\N	f	\N
653	2	1289	DJ88MYH	RENAULT 	KANGOO	252000	\N	\N	2026-04-20 09:53:18.475039+00	\N	f	\N
654	2	1286	DJ90LDO	iveco	\N	32000	\N	\N	2026-04-20 09:54:10.765162+00	\N	f	\N
655	2	1290	DJ01ACV	vw	jetta	340000	\N	\N	2026-04-20 10:13:21.816355+00	2026-04-20 10:13:45.379266+00	f	\N
656	2	1291	DJ54SEA	ford edge	\N	133000	\N	\N	2026-04-20 10:16:30.411043+00	\N	f	\N
657	2	1292	DJ90LDO	iveco	\N	\N	\N	\N	2026-04-20 10:16:51.487691+00	\N	f	\N
658	2	1294	B707FRT	MERCEDES	GLC 	2000	\N	ANV MONTATE 2356018 GOODYEAR EAGLE F1 4 BUC    ANV CUSTODIE 2356018 HANKOOK  WINTER  I CEPT EVO 3 MM7 DOT 1725 4BUC	2026-04-20 10:30:11.404476+00	\N	f	\N
659	2	1295	DJ21EPK	HYUNDAI 	i30	67000	\N	\N	2026-04-20 10:30:39.164808+00	\N	f	\N
660	2	1299	DJ21LED	skoda kodiac	\N	200000	\N	\N	2026-04-20 10:52:55.045481+00	\N	f	\N
661	2	1293	OT92DRE	mercedes	cla220	22000	\N	\N	2026-04-20 10:53:48.833285+00	\N	f	\N
662	2	1301	DJ23DKU	bmw	x5	350000	\N	\N	2026-04-20 10:57:06.030531+00	\N	f	\N
663	2	1304	DJ18XDS	byd	\N	52000	\N	\N	2026-04-20 11:04:49.328255+00	\N	f	\N
664	2	1305	DJ73MCR	TOYOTA	CHR	8700	\N	\N	2026-04-20 11:09:49.419148+00	\N	f	\N
665	2	1297	DJ65NTY	DACIA 	JOGGER	4000	\N	\N	2026-04-20 11:34:06.598286+00	\N	f	\N
666	2	1308	SB53CCI	dacia	jogger	\N	\N	\N	2026-04-20 11:34:56.652283+00	\N	f	\N
667	2	1309	DJ79CCC	ford	kuga	137000	\N	\N	2026-04-20 11:42:52.965793+00	\N	f	\N
668	2	1311	B123JWF	duster	\N	\N	\N	\N	2026-04-20 11:49:46.979525+00	\N	f	\N
669	2	1307	B701DEE	SKODA	OCTAVIA 	156000	\N	\N	2026-04-20 12:01:01.311438+00	\N	f	\N
670	2	1313	DJ06AVZ	MERCEDES 	SPRINTER	287934	\N	\N	2026-04-20 12:01:43.504255+00	\N	f	\N
671	2	1303	DJ17ASL	volvo	xc60	46824	\N	\N	2026-04-20 12:07:04.916503+00	\N	f	\N
672	2	1314	B188FRT	jogeer	\N	14500	\N	\N	2026-04-20 12:12:17.699861+00	\N	f	\N
673	2	1316	DJ65AGM	peugeot	508	336000	\N	\N	2026-04-20 12:15:50.011843+00	\N	f	\N
674	2	1318	B615FRT	audii	\N	\N	\N	\N	2026-04-20 12:25:04.222159+00	\N	f	\N
675	2	1320	DJ01BOM	mercedes	\N	130000	\N	\N	2026-04-20 12:35:57.050029+00	\N	f	\N
676	2	1322	DJ25CSN	MERCEDES	VITO	28000	\N	ANV MON 2454519 CONTINENTAL PREM CON 6 4 BUC      ANV CUSTODIE 2454519 KUMHO WINTERCRAFT  MM7 DOT 22234BUC	2026-04-20 12:47:27.935722+00	\N	f	\N
677	2	1323	OT91AXG	vw	golf	290000	\N	\N	2026-04-20 12:53:17.321527+00	2026-04-20 12:53:42.981858+00	f	\N
678	2	1324	DJ95MUS	MERCEDES 	 G CLASS	14000	\N	\N	2026-04-20 12:55:13.685499+00	\N	f	\N
679	2	1325	SB40GUH	ford focus	\N	\N	\N	\N	2026-04-20 12:57:51.001529+00	\N	f	\N
680	2	1327	DJ18DKS	logan	\N	80000	\N	\N	2026-04-20 13:05:13.088997+00	\N	f	\N
681	2	1330	DJ08WRM	TOYOTA	COROLLA	9600	\N	\N	2026-04-20 13:24:00.82104+00	\N	f	\N
683	2	1332	B993AXC	toiota	\N	\N	\N	\N	2026-04-20 13:26:20.998942+00	\N	f	\N
685	2	1335	DJ11AIV	peugeot	206	\N	\N	\N	2026-04-20 13:29:31.731951+00	\N	f	\N
684	2	1333	TM14MEV	remault	\N	80000	\N	\N	2026-04-20 13:27:48.187435+00	2026-04-20 13:30:17.677233+00	f	\N
686	2	1336	DJ85SBM	NISAN	QASHQAI	59100	\N	ANV MON 2155518 MIC PRIM 4	2026-04-20 13:31:11.189149+00	\N	f	\N
687	2	1339	DJ83ARG	FORD	KUGA	196500	\N	\N	2026-04-20 13:50:28.864286+00	\N	f	\N
688	2	1340	DJ82SYB	dacia 	doker	242650	\N	\N	2026-04-20 13:51:41.317098+00	\N	f	\N
689	2	1341	B151EBP	logan	\N	71000	\N	\N	2026-04-20 13:58:23.8238+00	\N	f	\N
690	2	1342	DJ83DRO	bmw	\N	\N	\N	\N	2026-04-20 14:00:49.763785+00	\N	f	\N
691	2	1343	B971RMA	mitsubishi outlender	\N	12000	\N	\N	2026-04-20 14:03:31.530405+00	\N	f	\N
692	2	1345	DJ04TNX	toyota	\N	\N	\N	\N	2026-04-20 14:21:00.75779+00	\N	f	\N
693	2	1347	DJ83KIK	vw	POLO	89100	\N	\N	2026-04-20 14:24:17.36659+00	\N	f	\N
682	2	1319	DJ06GTB	opel	\N	40000	\N	\N	2026-04-20 13:24:51.711206+00	2026-04-20 14:25:58.679337+00	f	\N
694	2	1348	DJ88SBA	BMW 	X5 	236000	\N	\N	2026-04-20 14:29:11.579046+00	\N	f	\N
695	2	1346	B100WBC	metcedes	\N	\N	\N	\N	2026-04-20 14:38:41.738429+00	\N	f	\N
704	2	1362	B125SXV	ford	puma	7500	\N	\N	2026-04-21 06:37:45.060064+00	\N	f	\N
697	2	1350	DJ07MXO	vw	golf	177000	\N	\N	2026-04-21 05:49:38.402198+00	2026-04-21 05:49:45.400811+00	f	\N
698	2	1351	DJ23TMO	OPEL 	 CROSSLAND X	35181	\N	\N	2026-04-21 05:50:15.278547+00	\N	f	\N
696	2	1349	B08DFX	ford 	\N	\N	\N	\N	2026-04-21 05:35:24.298196+00	2026-04-21 06:01:32.592876+00	f	\N
699	2	1354	DJ97BAU	kia	\N	156500	\N	\N	2026-04-21 06:01:57.171689+00	\N	f	\N
700	2	1355	DJ07MXO	vw	golf	\N	\N	\N	2026-04-21 06:14:50.500047+00	\N	f	\N
701	2	1358	DJ10PDZ	FORD	TRANZIT	237393	\N	\N	2026-04-21 06:25:51.782619+00	\N	f	\N
702	2	1359	B577LGK	toiota	\N	71000	\N	\N	2026-04-21 06:29:51.090382+00	\N	f	\N
703	2	1360	DJ32HER	bmw	\N	92000	\N	\N	2026-04-21 06:33:11.265927+00	\N	f	\N
705	2	1363	DJ92HER	w t roc	\N	\N	\N	\N	2026-04-21 06:40:48.887696+00	\N	f	\N
706	2	1367	DJ63HLW	BMW	X3	180000	\N	\N	2026-04-21 06:53:30.977276+00	\N	f	\N
707	2	1369	DJ02ABM	toyota	\N	65000	\N	\N	2026-04-21 07:01:23.293316+00	\N	f	\N
710	2	1372	DJ03GON	skoda	\N	72000	\N	\N	2026-04-21 07:17:36.752822+00	\N	f	\N
708	2	1370	B135RNV	vw	id3	83000	\N	\N	2026-04-21 07:11:50.063178+00	2026-04-21 07:13:08.909871+00	f	\N
709	2	1371	B124RUI	ford kuga	\N	\N	\N	\N	2026-04-21 07:15:19.087407+00	\N	f	\N
711	2	1366	DJ01KJW	mercedes	\N	110000	\N	\N	2026-04-21 07:32:18.931186+00	\N	f	\N
712	2	1365	DJ77EZN	RANGE ROVER 	VELAR 	80000	\N	\N	2026-04-21 07:36:22.563914+00	\N	f	\N
713	2	1376	DJ21MXM	toiota rav 4	\N	\N	\N	\N	2026-04-21 07:49:18.373741+00	\N	f	\N
714	2	1377	DJ02NYH	logan	\N	180000	\N	\N	2026-04-21 07:59:40.886991+00	\N	f	\N
715	2	1378	B103WSW	mercedes	\N	\N	\N	\N	2026-04-21 07:59:59.364788+00	\N	f	\N
716	2	1380	DJ20HSD	toyota	\N	15000	\N	\N	2026-04-21 08:03:47.300907+00	\N	f	\N
717	2	1381	DJ29PEL	RENAULT 	FLUENCE	82000	\N	\N	2026-04-21 08:06:32.240164+00	\N	f	\N
718	2	1383	B881WTW	toyota	rav4	58000	\N	\N	2026-04-21 08:26:43.144719+00	\N	f	\N
719	2	1385	DJ08RXY	golf 5	\N	\N	\N	\N	2026-04-21 08:28:05.959886+00	\N	f	\N
720	2	1386	DJ57ALP	ford	\N	5000	\N	\N	2026-04-21 08:28:47.947075+00	\N	f	\N
721	2	1387	DJ06XOJ	renoult	\N	120000	\N	\N	2026-04-21 08:33:22.480769+00	\N	f	\N
722	2	1388	IF14VWZ	DACIA 	LOGAN	213717	\N	\N	2026-04-21 08:42:52.524141+00	\N	f	\N
723	2	1392	B716DAB	mrrcedes	\N	\N	120000	\N	2026-04-21 09:01:19.601622+00	\N	f	\N
724	2	1393	DJ01MSW	toyota	yariscross	8500	\N	\N	2026-04-21 09:04:10.041641+00	\N	f	\N
725	2	1396	DJ22FAG	NISSAN 	\N	80000	\N	\N	2026-04-21 09:10:52.357301+00	\N	f	\N
726	2	1399	DJ91MXC	audii a6	\N	\N	\N	\N	2026-04-21 09:14:25.706668+00	\N	f	\N
727	2	1400	B611BKT	dacia	jogger	53000	\N	\N	2026-04-21 09:17:50.286619+00	\N	f	\N
728	2	1403	B882KWG	toyota	yariscross	\N	\N	\N	2026-04-21 09:40:56.103702+00	\N	f	\N
729	2	1391	DJ70TIN	scoda	\N	472000	\N	\N	2026-04-21 09:41:44.015926+00	2026-04-21 09:42:26.449355+00	f	\N
730	2	1404	DB17FAL	VW	TRANSPORTER 	600000	\N	\N	2026-04-21 09:46:14.23516+00	\N	f	\N
731	2	1405	DJ19BTW	ford	\N	28400	\N	\N	2026-04-21 09:54:57.259412+00	\N	f	\N
732	2	1406	DJ97NAT	ford	\N	87000	\N	\N	2026-04-21 09:56:37.703319+00	\N	f	\N
733	2	1408	DJ20RIX	mercedes	\N	\N	\N	\N	2026-04-21 10:10:43.693387+00	\N	f	\N
734	2	1394	GJ66CCA	bmw	\N	1750000	\N	\N	2026-04-21 10:12:16.063651+00	\N	f	\N
735	2	1410	DJ19VTA	opel	corsa	34628	\N	\N	2026-04-21 10:18:03.105172+00	\N	f	\N
736	2	1412	GJ66CCA	bmw	\N	\N	\N	\N	2026-04-21 10:32:52.948095+00	\N	f	\N
737	2	1413	B600BKT	ford	\N	75000	\N	\N	2026-04-21 10:33:27.882805+00	\N	f	\N
738	2	1414	DJ76COX	BMW	S3	51000	\N	\N	2026-04-21 10:40:19.933987+00	\N	f	\N
739	2	1415	DJ18DWV	volvo	\N	180000	\N	\N	2026-04-21 11:01:42.141792+00	\N	f	\N
740	2	1416	IS36ACG	skoda	octavia	109000	\N	\N	2026-04-21 11:03:33.505101+00	\N	f	\N
741	2	1417	DJ11DDD	mercedes gle	\N	\N	\N	\N	2026-04-21 11:15:43.707801+00	\N	f	\N
742	2	1419	B126REB	wolcswaghen	crafter	10000	\N	\N	2026-04-21 11:23:01.062094+00	\N	f	\N
743	2	1420	DJ22FAG	NISSAN 	\N	\N	\N	\N	2026-04-21 11:29:41.776793+00	\N	f	\N
744	2	1424	DJ44HZI	opel 	\N	43000	\N	\N	2026-04-21 11:48:45.495808+00	\N	f	\N
745	2	1426	DJ08XML	skoda	\N	10000	\N	\N	2026-04-21 11:51:57.174487+00	\N	f	\N
746	2	1428	DJ88MHN	\N	\N	24450	\N	\N	2026-04-21 12:01:24.230837+00	\N	f	\N
747	2	1422	DJ89KIM	reno megane	\N	\N	\N	\N	2026-04-21 12:05:57.706032+00	\N	f	\N
748	2	1430	DJ03STM	mercedes	spintaer	263574	\N	\N	2026-04-21 12:07:59.096837+00	\N	f	\N
749	2	1432	DJ69NIS	BMW	X5	80000	\N	\N	2026-04-21 12:14:05.297389+00	2026-04-21 12:14:13.978972+00	f	\N
750	2	1423	DJ70NIS	AUDI	Q5	80000	\N	\N	2026-04-21 12:14:58.320073+00	\N	f	\N
751	2	1433	DJ84NIS	BMW 	X6	80000	\N	\N	2026-04-21 12:16:10.957532+00	\N	f	\N
752	2	1434	B2275ELM	jogger	\N	106000	\N	\N	2026-04-21 12:18:59.18623+00	\N	f	\N
753	2	1436	B89JBD	vw	caddy	227000	\N	\N	2026-04-21 12:32:06.380881+00	\N	f	\N
754	2	1438	B325MGA	w chedi	\N	\N	\N	\N	2026-04-21 12:40:12.349185+00	\N	f	\N
755	2	1439	DJ31LCC	bmw	\N	240000	\N	\N	2026-04-21 12:46:23.180401+00	\N	f	\N
756	2	1440	DJ03VRD	AUDI	Q7	216000	\N	\N	2026-04-21 12:47:24.991325+00	\N	f	\N
757	2	1442	DJ77RKK	TOYOTA	CHR 	120000	\N	\N	2026-04-21 13:11:26.812037+00	\N	f	\N
758	2	1443	DJ20CDE	w tiguan	\N	\N	\N	\N	2026-04-21 13:12:26.138967+00	\N	f	\N
759	2	1429	OT12MSM	Vw	tiguan	530000	\N	\N	2026-04-21 13:13:57.275046+00	2026-04-21 13:14:06.379022+00	f	\N
760	2	1444	OT12MSM	Vw	tiguan	\N	\N	\N	2026-04-21 13:37:56.025105+00	\N	f	\N
761	2	1445	DJ25CHE	duster 	\N	18000	\N	\N	2026-04-21 13:38:08.755335+00	\N	f	\N
762	2	1446	DJ83DRC	TOYOTA	YARIS 	30000	\N	\N	2026-04-21 13:42:44.544659+00	\N	f	\N
763	2	1447	OT08DSD	dacia	logan	117000	\N	\N	2026-04-21 13:49:59.223617+00	\N	f	\N
764	2	1448	DJ51GED	mercedes	\N	70000	\N	\N	2026-04-21 14:01:12.150242+00	\N	f	\N
765	2	1450	B124SRY	bmw	745e	46000	\N	\N	2026-04-21 14:17:47.819863+00	\N	f	\N
766	2	1453	DJ77SHM	bmw	\N	80000	\N	\N	2026-04-22 05:41:28.788544+00	\N	f	\N
767	2	1454	B650PHA	w crafter	\N	47000	\N	\N	2026-04-22 05:45:58.352576+00	\N	f	\N
768	2	1455	DJ13ZKN	kia	sportage	65600	\N	\N	2026-04-22 05:48:57.064933+00	\N	f	\N
769	2	1457	B139BOL	MERCEDES 	g class	60000	\N	\N	2026-04-22 05:51:39.403232+00	\N	f	\N
770	2	1458	DJ21BAO	toyota	corola	65000	\N	\N	2026-04-22 05:54:16.415405+00	\N	f	\N
771	2	1452	DJ11MTY	toyota	\N	145000	\N	\N	2026-04-22 06:03:20.237599+00	2026-04-22 06:04:52.562024+00	f	\N
772	2	1461	MH07SRZ	dacia	duster	\N	\N	\N	2026-04-22 06:29:19.876526+00	2026-04-22 06:31:00.529819+00	f	\N
773	2	1462	DJ09SMC	mercedes	\N	122000	\N	\N	2026-04-22 06:37:37.706914+00	\N	f	\N
774	2	1460	DJ11DOZ	opel	\N	240000	\N	\N	2026-04-22 06:41:56.548675+00	\N	f	\N
775	2	1463	DJ67TGP	dacia	logan	50768	\N	\N	2026-04-22 06:44:56.526752+00	\N	f	\N
776	2	1464	DJ61CMM	VOLVO	XC60	184860	\N	\N	2026-04-22 06:45:26.98512+00	\N	f	\N
777	2	1465	OT01WHL	VOLVO	xc60	116000	\N	\N	2026-04-22 07:20:03.299828+00	\N	f	\N
778	2	1468	DJ95DRT	nissan	\N	228000	\N	\N	2026-04-22 07:21:35.335219+00	\N	f	\N
779	2	1469	DJ22FKJ	mercedes vito	\N	410000	\N	\N	2026-04-22 07:24:41.153075+00	\N	f	\N
780	2	1470	DJ77AVG	bmw	\N	91000	\N	\N	2026-04-22 07:35:02.437438+00	\N	f	\N
781	2	1466	B06EJO	toyota	rav4	220000	\N	\N	2026-04-22 07:45:47.711009+00	\N	f	\N
782	2	1471	B122TYA	skoda	\N	50000	\N	\N	2026-04-22 07:50:14.156164+00	\N	f	\N
783	2	1475	B06EJO	toyota	rav4	\N	\N	\N	2026-04-22 08:09:01.506451+00	\N	f	\N
784	2	1467	DJ17RCG	MERCEDES	SPRINTER	320000	\N	\N	2026-04-22 08:09:16.3394+00	\N	f	\N
785	2	1476	OT11RLK	AUDI	A3	118000	\N	\N	2026-04-22 08:10:07.275825+00	\N	f	\N
786	2	1472	OT80MAF	dacia	duster	253000	\N	\N	2026-04-22 08:22:03.81181+00	\N	f	\N
787	2	1478	DJ69YVO	toyota	\N	\N	1200	\N	2026-04-22 08:22:40.792796+00	\N	f	\N
788	2	1479	B118SVV	renout	\N	\N	\N	\N	2026-04-22 08:40:56.433481+00	\N	f	\N
789	2	1481	DJ12DAN	MAZDA 	CX3P	94000	\N	\N	2026-04-22 08:45:22.708968+00	\N	f	\N
790	2	1483	DJ07XGK	logan	\N	130000	\N	\N	2026-04-22 08:51:39.631665+00	\N	f	\N
791	2	1485	DJ18AZV	BMW	S3	284000	\N	\N	2026-04-22 08:59:45.089031+00	\N	f	\N
792	2	1487	DJ97DRB	toyota	\N	21200	\N	\N	2026-04-22 09:09:35.286216+00	\N	f	\N
793	2	1488	DJ17UZR	ford 	kuga	26000	\N	\N	2026-04-22 09:21:16.51593+00	\N	f	\N
794	2	1489	GJ37MRC	mercedes	\N	\N	\N	\N	2026-04-22 09:26:19.948394+00	2026-04-22 09:26:35.610887+00	f	\N
795	2	1490	DJ66ECO	w crafter	\N	230000	\N	\N	2026-04-22 09:30:25.531098+00	\N	f	\N
796	2	1492	DJ29KWG	LAND  ROVER	\N	238000	\N	\N	2026-04-22 09:37:15.739401+00	\N	f	\N
797	2	1494	DJ67FRT	toyota	\N	29166	\N	\N	2026-04-22 09:43:32.060276+00	\N	f	\N
798	2	1496	DJ03BDS	mazda	cx5	268000	\N	\N	2026-04-22 10:07:19.610565+00	\N	f	\N
799	2	1497	DJ38ECL	MERCEDES	CITAN	13700	\N	\N	2026-04-22 10:14:14.750244+00	\N	f	\N
800	2	1491	DJ16SJP	bmw	\N	205000	\N	\N	2026-04-22 10:14:57.027048+00	\N	f	\N
801	2	1498	DJ03BDS	mazda	cx5	\N	\N	\N	2026-04-22 10:30:37.545352+00	\N	f	\N
802	2	1499	DJ08MW	toyota	\N	106000	\N	\N	2026-04-22 10:32:38.103834+00	\N	f	\N
803	2	1501	DJ48EKO	crafter	\N	62000	\N	\N	2026-04-22 10:41:19.825746+00	\N	f	\N
804	2	1502	DJ88BUM	MERCEDES 	glk	135000	\N	\N	2026-04-22 10:43:54.31327+00	\N	f	\N
805	2	1503	DJ09STM	iveco	\N	\N	\N	\N	2026-04-22 10:46:37.229269+00	\N	f	\N
806	2	1504	DJ07XYA	mercedes 	\N	1110000	\N	\N	2026-04-22 10:55:05.437375+00	\N	f	\N
807	2	1506	B206VVV	touareg	\N	31000	\N	\N	2026-04-22 11:20:07.941824+00	2026-04-22 11:21:21.925308+00	f	\N
808	2	1508	DJ88DDD	bentley	\N	9400	\N	\N	2026-04-22 11:30:51.931551+00	\N	f	\N
809	2	1505	B410DEM	mercedes	\N	92000	\N	\N	2026-04-22 11:31:43.128573+00	\N	f	\N
810	2	1509	DJ45CSA	mercedes vito	\N	\N	\N	\N	2026-04-22 11:46:03.457585+00	\N	f	\N
811	2	1511	B121PEV	dacia	\N	57000	\N	\N	2026-04-22 11:52:43.309001+00	\N	f	\N
814	2	1516	CJ77TRV	scoda rapid	\N	\N	\N	\N	2026-04-22 12:14:42.770635+00	\N	f	\N
812	2	1512	B477KRS	BMW 	X2	100000	\N	\N	2026-04-22 11:53:36.339442+00	2026-04-22 11:57:46.36387+00	f	\N
813	2	1514	B410DEM	mercedes	\N	\N	\N	\N	2026-04-22 12:00:53.627091+00	\N	f	\N
815	2	1518	DJ19WSC	RANGE ROVER 	\N	210000	\N	\N	2026-04-22 12:20:50.136869+00	\N	f	\N
816	2	1520	OT23BXA	vw	passat	281789	\N	\N	2026-04-22 12:32:59.219815+00	\N	f	\N
817	2	1522	OT75FAR	SKODA	KODIAQ	66000	\N	\N	2026-04-22 13:20:41.405841+00	\N	f	\N
818	2	1523	DJ76ZEN	toiota	\N	215000	\N	\N	2026-04-22 13:22:08.341116+00	\N	f	\N
819	2	1524	OT60AGM	mercedes	\N	54000	\N	\N	2026-04-22 13:23:29.256568+00	\N	f	\N
820	2	1519	DJ45ELF	opel	\N	\N	\N	\N	2026-04-22 13:24:41.927412+00	\N	f	\N
821	2	1528	DJ12GPX	VOLVO	\N	240000	\N	\N	2026-04-22 13:27:43.406348+00	\N	f	\N
822	2	1529	DJ91DAL	w golf	\N	330000	\N	\N	2026-04-22 13:37:31.061668+00	\N	f	\N
823	2	1527	DJ21MUM	hundai	i20	133318	\N	\N	2026-04-22 13:51:02.667348+00	\N	f	\N
824	2	1531	DJ23SMD	TOYOTA	AURIS	91000	\N	\N	2026-04-22 13:57:06.856807+00	\N	f	\N
825	2	1526	DJ24NMA	hiundai kona	\N	85300	\N	\N	2026-04-22 13:59:05.338709+00	\N	f	\N
826	2	1533	DJ10KOD	audi	\N	235000	\N	\N	2026-04-22 14:07:42.475244+00	\N	f	\N
827	2	1535	DJ29ALI	ford	focus	65000	\N	\N	2026-04-22 14:17:27.2008+00	\N	f	\N
828	2	1538	DJ17TWW	toiota	\N	19000	\N	\N	2026-04-23 05:26:47.862808+00	\N	f	\N
829	2	1541	DJ23AEI	suzuchi	\N	25000	\N	\N	2026-04-23 05:51:12.160979+00	\N	f	\N
830	2	1542	DJ21HER	toiota c hr	\N	\N	\N	\N	2026-04-23 05:51:16.548874+00	\N	f	\N
831	2	1543	OT10FAB	PORSCHE	\N	23000	\N	\N	2026-04-23 06:08:42.03262+00	\N	f	\N
832	2	1540	DJ12TDT	bmw	x3	80000	\N	\N	2026-04-23 06:12:26.508444+00	\N	f	\N
833	2	1545	DJ74WBC	audi	q8	\N	\N	\N	2026-04-23 06:28:46.022945+00	2026-04-23 06:28:54.058106+00	f	\N
834	2	1549	DJ05AZA	MERCEDES	 S MAYBAC 	28800	\N	\N	2026-04-23 06:51:18.837724+00	\N	f	\N
835	2	1544	DJ09LRY	taigo	\N	50000	\N	\N	2026-04-23 06:58:04.825783+00	\N	f	\N
836	2	1548	B118GPJ	ford puma	\N	73000	\N	\N	2026-04-23 07:11:17.191353+00	\N	f	\N
837	2	1550	DJ15VMZ	mercedes	gle	78000	\N	\N	2026-04-23 07:19:22.344001+00	\N	f	\N
838	2	1552	DJ23XMG	mercedes	\N	78812	\N	\N	2026-04-23 07:32:22.997131+00	\N	f	\N
839	2	1554	DJ89MLS	audi	\N	30000	\N	\N	2026-04-23 07:43:45.865963+00	2026-04-23 07:58:36.044834+00	f	\N
840	2	1556	DJ28WUW	BMW	G30	180000	\N	\N	2026-04-23 08:07:18.102748+00	\N	f	\N
841	2	1555	DJ12GDB	iveco	\N	\N	\N	\N	2026-04-23 08:08:19.728233+00	\N	f	\N
842	2	1558	DJ27DEB	bmw 	\N	\N	\N	\N	2026-04-23 08:19:51.623004+00	\N	f	\N
843	2	1559	DJ64YVA	bmw	\N	298000	\N	\N	2026-04-23 08:19:59.449083+00	\N	f	\N
844	2	1560	DJ28BRA	opel	vivaro	380000	\N	\N	2026-04-23 08:21:12.023484+00	\N	f	\N
845	2	1553	DJ23MLS	mercedes	\N	50000	\N	\N	2026-04-23 08:25:40.286749+00	\N	f	\N
846	2	1562	OT77BIV	vw	passat b7	451000	\N	\N	2026-04-23 08:39:27.96476+00	\N	f	\N
847	2	1563	B300GHM	MERCEDES 	\N	113000	\N	\N	2026-04-23 08:40:38.631883+00	\N	f	\N
848	2	1564	B196SYS	opel	corsa	\N	\N	\N	2026-04-23 08:42:12.500131+00	\N	f	\N
849	2	1565	DJ77BIB	audi	\N	173000	\N	\N	2026-04-23 08:49:13.355349+00	\N	f	\N
850	2	1566	DJ77MTO	\N	opel	280000	\N	\N	2026-04-23 08:56:15.788726+00	2026-04-23 08:56:29.630764+00	f	\N
851	2	1568	DJ88UMF	ford	\N	\N	60000	\N	2026-04-23 09:26:15.052153+00	\N	f	\N
852	2	1569	DJ28ECO	WV 	CRAFTER	165000	\N	205 75 16 CMIC AGILIS 3	2026-04-23 09:29:00.807344+00	\N	f	\N
853	2	1570	DJ37PER	BMW	X5	95000	\N	\N	2026-04-23 09:32:34.671662+00	2026-04-23 09:33:02.609795+00	f	\N
854	2	1567	OT30ABD	bmw	\N	260000	\N	\N	2026-04-23 09:42:26.200219+00	\N	f	\N
855	2	1572	DJ88GBL	toareg	\N	360000	\N	\N	2026-04-23 09:57:18.700883+00	\N	f	\N
856	2	1573	DJ67AMN	toyota	\N	40000	\N	\N	2026-04-23 09:57:57.243601+00	\N	f	\N
857	2	1561	DJ01NSA	hiunday	santafee	132000	\N	\N	2026-04-23 09:59:37.119326+00	\N	f	\N
858	2	1575	DJ88GBL	toareg	\N	360000	\N	\N	2026-04-23 10:17:05.21124+00	\N	f	\N
859	2	1576	DJ15GRJ	IVECO	DAYLI	861000	\N	1957516C	2026-04-23 10:22:12.811818+00	\N	f	\N
860	2	1571	DJ01LCC	mercedes glc	\N	224791	\N	\N	2026-04-23 10:34:29.106249+00	\N	f	\N
861	2	1577	DJ73GMC	bmw	\N	275000	\N	\N	2026-04-23 10:44:00.383409+00	\N	f	\N
862	2	1579	B125SXE	FORD 	PUMA	43000	\N	\N	2026-04-23 10:53:27.367785+00	\N	f	\N
863	2	1574	DJ15LMS	lodgi	\N	383000	\N	\N	2026-04-23 10:59:40.744484+00	\N	f	\N
864	2	1580	DJ46WTK	BMW	S3GT	244000	\N	\N	2026-04-23 11:06:55.921167+00	\N	f	\N
865	2	1581	DJ78LVY	mini cooper	\N	57358	\N	\N	2026-04-23 11:17:31.784409+00	\N	f	\N
866	2	1582	DJ36TEH	\N	ducato	205000	\N	\N	2026-04-23 11:19:44.961836+00	\N	f	\N
867	2	1583	DJ73GMC	bmw	f10	275000	\N	\N	2026-04-23 11:20:31.585537+00	\N	f	\N
868	2	1585	DJ59LNA	nissan	\N	39000	\N	\N	2026-04-23 11:34:38.648756+00	\N	f	\N
869	2	1586	OT14SXG	mercedes	vito	290000	\N	\N	2026-04-23 11:39:03.694326+00	\N	f	\N
870	2	1587	B06TFR	mazda cx 60	\N	\N	\N	\N	2026-04-23 11:41:45.437112+00	\N	f	\N
871	2	1584	B24ZKK	skoda	\N	350000	\N	\N	2026-04-23 11:43:31.682249+00	\N	f	\N
872	2	1590	DJ01NNN	MERCEDES	G CLASS	60000	\N	\N	2026-04-23 12:04:32.195407+00	\N	f	\N
873	2	1588	DJ87AMA	seat	\N	110000	\N	\N	2026-04-23 12:14:18.033933+00	\N	f	\N
874	2	1591	DJ17HJD	opel	astra-j	140000	\N	\N	2026-04-23 12:19:24.084876+00	\N	f	\N
890	2	1614	DJ27VVV	BMW	SER5	170000	\N	245/35/20    275/30 /20	2026-04-24 06:31:20.010805+00	\N	f	\N
875	2	1592	DJ67WFX	vw	passat	\N	\N	\N	2026-04-23 12:26:00.983917+00	2026-04-23 12:29:22.254557+00	f	\N
876	2	1595	DJ12JLI	mercedes gle	\N	190000	\N	\N	2026-04-23 12:48:14.421297+00	\N	f	\N
877	2	1597	DJ08KVG	opel	\N	370000	\N	\N	2026-04-23 13:05:36.293897+00	\N	f	\N
878	2	1599	DJ91MOD	vw	tiguan	138000	\N	\N	2026-04-23 13:21:10.908146+00	\N	f	\N
879	2	1600	DJ37DRC	mercedes	\N	170000	\N	\N	2026-04-23 13:23:03.642625+00	\N	f	\N
880	2	1601	DJ02EXL	WV	TIGUAN	252000	\N	ANV MON CLIENT 2355517 TIGAR SUMMER 3	2026-04-23 13:29:32.952965+00	\N	f	\N
881	2	1602	DJ91MOD	vw	tiguan	\N	\N	\N	2026-04-23 13:42:43.374811+00	\N	f	\N
882	2	1603	DJ99NRM	w cc	\N	\N	\N	\N	2026-04-23 13:59:06.927868+00	\N	f	\N
883	2	1604	OT82CXP	hiundai i10	\N	14000	\N	\N	2026-04-24 05:28:05.29707+00	\N	f	\N
884	2	1606	B115VJW	logan	\N	104000	\N	\N	2026-04-24 05:54:50.206235+00	\N	f	\N
885	2	1605	DJ90MHN	skoda	kodiaq	\N	\N	\N	2026-04-24 06:00:16.927282+00	\N	f	\N
886	2	1610	DJ86ERH	hiundai tucton	\N	33354	\N	\N	2026-04-24 06:09:46.539229+00	\N	f	\N
887	2	1611	B618FRT	audi	\N	1500	\N	\N	2026-04-24 06:19:24.535142+00	\N	f	\N
888	2	1608	DJ05SHY	opel	igsinia	61700	\N	\N	2026-04-24 06:23:08.785383+00	\N	f	\N
889	2	1613	DJ04ELP	audi	\N	\N	\N	\N	2026-04-24 06:30:09.588585+00	\N	f	\N
891	2	1615	DJ05SHY	opel	igsinia	\N	\N	\N	2026-04-24 06:39:00.031831+00	\N	f	\N
892	2	1618	DJ77AFA	ford	\N	55000	\N	\N	2026-04-24 06:45:27.02644+00	\N	f	\N
893	2	1621	DJ27ROZ	opel 	\N	236000	\N	\N	2026-04-24 07:07:48.08346+00	\N	f	\N
894	2	1622	DJ17FBF	dacia doker	\N	\N	\N	\N	2026-04-24 07:09:03.964865+00	\N	f	\N
895	2	1623	DJ11WOG	tiguoan	\N	260000	\N	\N	2026-04-24 07:10:44.377245+00	\N	f	\N
896	2	1624	DJ85AZS	bmw	x1	300000	\N	ANVELOPE SPATE UZATE	2026-04-24 07:13:14.034777+00	\N	f	\N
897	2	1619	MHA DJ 99	ford	\N	152000	\N	\N	2026-04-24 07:19:48.801667+00	\N	f	\N
898	2	1625	DJ67MOV	HONDA	CR  V	187000	\N	\N	2026-04-24 07:23:01.460179+00	\N	f	\N
899	2	1616	DJ67GRS	skoda	\N	220000	\N	\N	2026-04-24 07:24:46.22223+00	\N	f	\N
900	2	1628	DJ71DEA	vw	golf	\N	\N	\N	2026-04-24 07:27:25.247821+00	2026-04-24 07:27:39.374918+00	f	\N
901	2	1629	DJ17FBF	dacia doker	\N	\N	\N	\N	2026-04-24 07:30:55.258853+00	\N	f	\N
902	2	1620	DJ90GRB	iveco	\N	34954985	\N	\N	2026-04-24 07:40:38.500946+00	\N	f	\N
903	2	1631	OT41CCP	range rover	\N	\N	\N	\N	2026-04-24 07:52:22.670721+00	\N	f	\N
904	2	1632	DJ12 MWK	LADA 	III8	116000	\N	ANV MON 175/65/14 MIC. ENERGY SAVER 4BUC.	2026-04-24 08:03:38.102657+00	\N	f	\N
905	2	1633	DJ17CCE	opel	corsa	44656	\N	\N	2026-04-24 08:04:32.496337+00	\N	f	\N
906	2	1634	DJ15KTM	ram	\N	50000	\N	\N	2026-04-24 08:08:40.504797+00	\N	f	\N
907	2	1626	DJ07XRM	audi a5	\N	176000	\N	\N	2026-04-24 08:17:32.387135+00	\N	f	\N
908	2	1636	DJ30PPM	vw	golf7	220000	\N	\N	2026-04-24 08:25:52.378108+00	\N	f	\N
909	2	1638	CJ70GFT	SKODA	SCALA	30000	\N	ANV MON 205/55/16 GOODYEAR EFFCIENT  GRIP	2026-04-24 08:34:01.409441+00	\N	f	\N
911	2	1640	B807RSH	renoult	\N	85000	\N	\N	2026-04-24 08:41:45.873842+00	\N	f	\N
912	2	1641	DJ66AEA	ford	focus	172000	\N	\N	2026-04-24 08:42:01.980027+00	\N	f	\N
913	2	1642	DJ 85 DES	mini couper	\N	110000	\N	\N	2026-04-24 08:44:17.822206+00	2026-04-24 08:47:34.340637+00	f	\N
914	2	1643	DJ23SPM	bmw	x1	\N	26000	\N	2026-04-24 08:50:24.75037+00	\N	f	\N
915	2	1644	DJ09LNA	skoda	octavia	98713	\N	\N	2026-04-24 09:05:42.705293+00	\N	f	\N
916	2	1645	DJ72MAX	audii a4	\N	102000	\N	\N	2026-04-24 09:08:50.735999+00	\N	f	\N
917	2	1646	DJ016127	dacia	duster	70005	\N	\N	2026-04-24 09:09:15.152235+00	\N	f	\N
918	2	1647	VL58SKY	skoda	\N	11744	\N	\N	2026-04-24 09:24:26.128169+00	\N	f	\N
919	2	1648	DJ33AMT	mercedes 	\N	80000	\N	\N	2026-04-24 09:30:15.498144+00	\N	f	\N
920	2	1651	DJ50HPY	vw	tiguan	159000	\N	\N	2026-04-24 09:55:39.054687+00	\N	f	\N
921	2	1627	DJ10SPO	renault	\N	210000	\N	\N	2026-04-24 09:56:00.81323+00	\N	f	\N
922	2	1652	OT25TAX	bmw	\N	310000	\N	\N	2026-04-24 09:57:54.822821+00	\N	f	\N
923	2	1653	DJ18HWW	renoult	\N	27000	\N	\N	2026-04-24 10:02:08.943652+00	\N	f	\N
924	2	1656	OT54DRS	mercedes	sprinter	350000	\N	\N	2026-04-24 10:15:27.059331+00	\N	f	\N
925	2	1657	DJ02MSB	mazda	\N	150000	\N	\N	2026-04-24 10:31:16.215089+00	\N	f	\N
926	2	1654	B666KMG	BMW	\N	54000	\N	\N	2026-04-24 10:35:07.026013+00	\N	f	\N
927	2	1649	B110BUI	ford	focus	250000	\N	\N	2026-04-24 10:46:11.069271+00	\N	f	\N
928	2	1660	DJ70AAN	mercedes	\N	140392	\N	\N	2026-04-24 10:52:10.863938+00	\N	f	\N
929	2	1661	OT25TAX	bmw	\N	\N	\N	\N	2026-04-24 11:02:40.827009+00	\N	f	\N
930	2	1662	DJ08WOW	opel	\N	\N	\N	\N	2026-04-24 11:04:38.142791+00	\N	f	\N
931	2	1665	DJ15TAV	dacia	duster	\N	\N	\N	2026-04-24 11:17:56.495702+00	\N	f	\N
932	2	1666	DJ83LKA	hiunday	hrv	58500	\N	\N	2026-04-24 11:19:31.639787+00	2026-04-24 11:19:58.525898+00	f	\N
933	2	1667	DJ54KTL	wolkswagen	\N	360000	\N	\N	2026-04-24 11:32:21.458846+00	\N	f	\N
910	2	1639	DJ89NOY	mayda	3	\N	\N	\N	2026-04-24 08:39:46.299541+00	2026-04-24 11:35:41.261883+00	f	\N
934	2	1668	DJ11DAX	mercedes	\N	\N	\N	\N	2026-04-24 11:36:01.561163+00	\N	f	\N
935	2	1669	B580DEM	volvo	xc40	140501	\N	\N	2026-04-24 11:47:25.361443+00	\N	f	\N
936	2	1671	DJ55AED	ford	ecosport	\N	\N	\N	2026-04-24 11:58:58.601269+00	\N	f	\N
937	2	1673	B72DIA	bmw	\N	\N	\N	\N	2026-04-24 12:10:45.070477+00	\N	f	\N
938	2	1674	TR85LAV	scoda	octavia	\N	\N	\N	2026-04-24 12:11:07.690237+00	\N	f	\N
939	2	1670	DJ67HMT	TOYOTA	COROLLA	155000	\N	\N	2026-04-24 12:26:59.564167+00	\N	f	\N
940	2	1676	DJ09LNG	skoda	octavia	20000	\N	\N	2026-04-24 12:35:14.053723+00	\N	f	\N
941	2	1677	B777PXZ	bmw	\N	70000	\N	\N	2026-04-24 12:40:55.378542+00	\N	f	\N
942	2	1679	DJ54DRC	bmw	\N	\N	\N	\N	2026-04-24 12:47:43.23357+00	\N	f	\N
943	2	1682	DJ47DNI	bmw	\N	156000	\N	\N	2026-04-24 12:59:16.375045+00	\N	f	\N
944	2	1683	DJ22TXR	TOYOTA	\N	10000	\N	\N	2026-04-24 13:01:41.424072+00	\N	f	\N
945	2	1684	DJ97AME	peugeot 307	\N	120000	\N	\N	2026-04-24 13:12:12.795366+00	\N	f	\N
946	2	1685	OT86MXA	vw	passat b8	270000	\N	\N	2026-04-24 13:20:05.697926+00	\N	f	\N
947	2	1687	B180TEX	toyota	\N	39000	\N	\N	2026-04-24 13:26:54.324677+00	\N	f	\N
948	2	1688	DJ51TAB	TORES  SANG YONG	\N	21000	\N	\N	2026-04-24 13:29:07.74656+00	\N	f	\N
949	2	1689	B223RAX	nissan	qashqai	\N	\N	\N	2026-04-24 13:33:21.363223+00	\N	f	\N
950	2	1690	DJ13MSI	DACIA	LOGAN	88000	\N	ANV MON 185/65/15 BFGOODRICH  G  GRIP 4 BUC.	2026-04-24 13:39:14.613407+00	\N	f	\N
951	2	1691	AG27PPA	skoda 	octavia	233752	\N	\N	2026-04-24 13:46:22.163031+00	\N	f	\N
952	2	1692	DJ14LDP	audii q5	\N	392500	\N	\N	2026-04-24 13:50:03.555849+00	\N	f	\N
953	2	1693	DJ89ABO	hiundai ioniq6	\N	21000	\N	\N	2026-04-24 14:08:36.445413+00	\N	f	\N
954	2	1694	DJ17XWA	BMW	\N	118000	\N	\N	2026-04-24 14:09:31.004814+00	2026-04-24 14:13:18.472928+00	f	\N
955	2	1695	DJ44TRI	DACIA 	LOGAN	170000	\N	\N	2026-04-24 14:20:57.022286+00	\N	f	\N
956	2	1696	DJ20WAA	golf 	\N	70000	\N	\N	2026-04-27 05:36:43.491571+00	\N	f	\N
957	2	1697	OT73AWA	golf 5	\N	180000	\N	\N	2026-04-27 05:47:27.778169+00	\N	f	\N
958	2	1698	OT13SXS	nisan	\N	\N	\N	\N	2026-04-27 05:50:45.273803+00	\N	f	\N
959	2	1699	B134ELC	dacia	\N	\N	\N	\N	2026-04-27 05:59:48.080788+00	\N	f	\N
960	2	1700	DJ10FGH	renault	\N	303000	\N	\N	2026-04-27 06:08:20.08758+00	\N	f	\N
961	2	1701	DJ72MLA	TOYOTA	RAV4	17300	\N	\N	2026-04-27 06:26:30.822719+00	\N	f	\N
962	2	1702	DJ86FDL	reno talisman	\N	\N	\N	\N	2026-04-27 06:33:14.859481+00	\N	f	\N
963	2	1704	DJ15DGR	passat	\N	2126000	\N	\N	2026-04-27 06:36:03.596376+00	\N	f	\N
964	2	1705	DJ52DAL	renoult	\N	60000	\N	\N	2026-04-27 06:40:51.582379+00	\N	f	\N
965	2	1706	B111NDF	mercedes	gle	25620	\N	\N	2026-04-27 07:00:46.372357+00	\N	f	\N
966	2	1707	DJ99WZV	toiota c hr	\N	\N	\N	\N	2026-04-27 07:01:25.900196+00	\N	f	\N
967	2	1708	DJ33DKW	clio	\N	\N	3000	\N	2026-04-27 07:02:24.902807+00	\N	f	\N
968	2	1709	B234DAL	FORD	PUMA	49000	\N	\N	2026-04-27 07:02:44.386421+00	\N	f	\N
969	2	1713	DJ04MVR	volvo	\N	76000	\N	\N	2026-04-27 07:27:07.948395+00	\N	f	\N
970	2	1714	DJ01WPM	vw	\N	271382	\N	\N	2026-04-27 07:33:33.203362+00	\N	f	\N
971	2	1715	DJ04EDJ	logan	\N	\N	\N	\N	2026-04-27 07:36:26.065878+00	\N	f	\N
972	2	1716	DJ54SMD	renault	\N	30000	\N	\N	2026-04-27 07:43:49.8344+00	\N	f	\N
973	2	1717	DJ68DCA	PEUGEOT	BOXER	64000	\N	\N	2026-04-27 07:44:09.993744+00	2026-04-27 07:45:17.766319+00	f	\N
974	2	1711	DJ017538	nisan	\N	102000	\N	\N	2026-04-27 07:46:58.043377+00	\N	f	\N
975	2	1719	B15 DAL	FORD	TRANSIT	72000	\N	215/65 /16/C GOODYEAR EFFCIENTGRIP	2026-04-27 07:59:30.856588+00	\N	f	\N
976	2	1720	B740KWR	toyota	\N	36000	\N	\N	2026-04-27 08:03:02.527354+00	\N	f	\N
977	2	1721	DJ77WLN	vw	\N	325000	\N	\N	2026-04-27 08:06:56.536016+00	\N	f	\N
978	2	1723	GJ03LWX	wolsvagen	golf	308000	\N	\N	2026-04-27 08:23:00.81018+00	\N	f	\N
979	2	1718	DJ28MEM	nubira	\N	480000	\N	\N	2026-04-27 08:26:55.481705+00	\N	f	\N
980	2	1710	DJ28KIK	audii a4	\N	170000	\N	\N	2026-04-27 08:29:17.133193+00	2026-04-27 08:29:35.638388+00	f	\N
981	2	1724	DJ03DLA	mazda	\N	150000	\N	\N	2026-04-27 08:30:16.702338+00	\N	f	\N
982	2	1725	DJ30SDA	vw	touran	31200	\N	\N	2026-04-27 08:35:23.265235+00	\N	f	\N
983	2	1728	DJ52WSW	MERCEDES 	GLE	300000	\N	ANV.MON.275/45/21   315/40/21	2026-04-27 08:57:07.583728+00	\N	f	\N
984	2	1729	B987MIV	toyota	\N	92000	\N	\N	2026-04-27 09:01:14.274577+00	\N	f	\N
986	2	1731	DJ21FCJ	peugot boxer	\N	\N	\N	\N	2026-04-27 09:03:57.919425+00	\N	f	\N
988	2	1732	B265CPK	lexus	\N	54000	\N	\N	2026-04-27 09:12:34.536307+00	\N	f	\N
987	2	1726	DJ75AFR	MERCEDES 	vito	400000	\N	\N	2026-04-27 09:06:45.915364+00	\N	f	\N
985	2	1730	DJ11EGC	porshe	\N	30000	\N	\N	2026-04-27 09:03:51.023856+00	2026-04-27 09:08:54.510403+00	f	\N
989	2	1733	DJ01DNI	mercedes e300	\N	\N	\N	\N	2026-04-27 09:18:42.883852+00	\N	f	\N
990	2	1734	DJ74 KLA	BMW	X4	130000	\N	245/55/19 PIRELI SCORPION ANV MON.4 BUC	2026-04-27 09:36:01.412846+00	\N	f	\N
991	2	1735	DJ68PPZ	mercedes	gls	55000	\N	\N	2026-04-27 09:41:42.046632+00	\N	f	\N
992	2	1737	B19GRN	bmw	\N	\N	\N	\N	2026-04-27 09:53:59.160608+00	\N	f	\N
993	2	1738	B164AUA	IVECO	DAILY	243000	\N	\N	2026-04-27 10:01:08.089534+00	\N	f	\N
994	2	1727	B55WSM	vw	touareg	220000	\N	\N	2026-04-27 10:06:56.129693+00	2026-04-27 10:07:05.600644+00	f	\N
995	2	1739	DJ01KWH	renoult	\N	32992	\N	\N	2026-04-27 10:08:10.524631+00	\N	f	\N
1002	2	1747	DJ18FOE	skoda	\N	190000	\N	\N	2026-04-27 10:47:31.220577+00	\N	f	\N
996	2	1740	B84SRO	bmw	\N	\N	79000	\N	2026-04-27 10:18:33.536797+00	\N	f	\N
997	2	1742	DJ15AAN	mercedes	\N	135000	\N	\N	2026-04-27 10:29:00.751732+00	\N	f	\N
998	2	1743	DJ72YDA	dacia 	doker	217000	\N	\N	2026-04-27 10:31:39.643793+00	\N	f	\N
999	2	1744	DJ42DAL	DACIA	LOGAN	332150	\N	\N	2026-04-27 10:33:35.533964+00	\N	f	\N
1000	2	1745	B55WSM	vw	touareg	\N	\N	\N	2026-04-27 10:42:03.451409+00	\N	f	\N
1001	2	1746	DJ08XTZ	skoda	\N	\N	\N	\N	2026-04-27 10:46:51.639037+00	\N	f	\N
1003	2	1748	DJ08WHO	vw	toareg	270000	\N	\N	2026-04-27 10:58:21.825813+00	\N	f	\N
1004	2	1749	DJ08XTZ	skoda	\N	\N	\N	\N	2026-04-27 11:00:17.977582+00	\N	f	\N
1005	2	1750	DJ77DDD	bentlei	\N	\N	\N	\N	2026-04-27 11:01:40.149181+00	\N	f	\N
1006	2	1736	DJ42MDS	bmw	\N	164000	\N	\N	2026-04-27 11:01:55.913194+00	\N	f	\N
1007	2	1751	DJ20CRK	TOYOTA	RAV 4	86000	\N	ANV.MON.225/55/19 TOYO PROXES4 BUC.	2026-04-27 11:09:41.486656+00	\N	f	\N
1008	2	1752	DJ59AAB	FORD 	TRANSIT	163000	\N	\N	2026-04-27 11:11:22.778728+00	\N	f	\N
1009	2	1753	DJ03AES	bmw	\N	99931	\N	\N	2026-04-27 11:19:09.842964+00	\N	f	\N
1010	2	1754	DJ55DIR	VW	CRAFTER	1000000	\N	\N	2026-04-27 11:32:52.145604+00	\N	f	\N
1011	2	1755	DJ66SEM	toareg	\N	153000	\N	\N	2026-04-27 11:39:15.590311+00	\N	f	\N
1012	2	1756	B40ELN	ford puma	\N	\N	\N	\N	2026-04-27 11:41:05.219079+00	\N	f	\N
1013	2	1757	DJ04DIL	TOYOTA	COROLLA	48500	\N	\N	2026-04-27 11:49:31.918195+00	\N	f	\N
1014	2	1758	DJ90WLF	bmw	s6	\N	\N	BIELETA DREAPTA FATA STRAMBA NU SE OFERA GARANTIE	2026-04-27 11:49:45.685922+00	\N	f	\N
1015	2	1759	DJ40AMB	skoda	\N	230000	\N	\N	2026-04-27 11:50:31.152651+00	\N	f	\N
1016	2	1760	DJ08YWO	loganm	\N	205000	\N	\N	2026-04-27 11:54:43.094946+00	\N	f	\N
1017	2	1763	DJ19STM	bmw	x5	229000	\N	\N	2026-04-27 12:10:28.313026+00	\N	f	\N
1019	2	1765	DJ55DIR	VW	CRAFTER	\N	\N	\N	2026-04-27 12:28:45.968744+00	\N	f	\N
1020	2	1762	DJ72KOA	bmw	\N	455000	\N	\N	2026-04-27 12:30:40.782992+00	\N	f	\N
1018	2	1764	DJ88TTG	FORD	TRANSIT CUSTOM 	288531	\N	\N	2026-04-27 12:19:53.913525+00	2026-04-27 12:35:43.112544+00	f	\N
1021	2	1766	DJ70MXM	BMW	X5	125000	\N	\N	2026-04-27 12:40:31.733928+00	\N	f	\N
1022	2	1761	DJ70DCI	renoult	\N	71000	\N	\N	2026-04-27 12:41:11.853687+00	\N	f	\N
1023	2	1767	CJ99HBT	skoda	\N	\N	\N	\N	2026-04-27 12:41:29.687385+00	\N	f	\N
1024	2	1769	DJ26AAC	opel	\N	\N	\N	\N	2026-04-27 13:09:07.959411+00	\N	f	\N
1025	2	1770	DJ42SOF	golf	\N	\N	\N	\N	2026-04-27 13:15:59.598942+00	\N	f	\N
1026	2	1768	DJ36SMN	opel	\N	407000	\N	\N	2026-04-27 13:19:02.606855+00	\N	f	\N
1027	2	1771	DJ10SMG	TOYOTA	AYGO X	28721	\N	175/65/17 MIC. E PRIM	2026-04-27 13:22:05.777805+00	\N	f	\N
1028	2	1772	VL25BDP	nissan	\N	254000	\N	\N	2026-04-27 13:25:33.956477+00	\N	f	\N
1029	2	1773	DJ77CLR	mercedes 	sprinter	671000	\N	\N	2026-04-27 13:44:51.685108+00	\N	f	\N
1030	2	1774	DJ17ZDB	toiota	\N	50000	\N	\N	2026-04-27 13:46:05.299244+00	2026-04-27 13:47:02.791385+00	f	\N
1032	2	1777	DJ41DAV	renoult	\N	134000	\N	\N	2026-04-27 13:56:57.595256+00	\N	f	\N
1033	2	1778	DJ22WXS	vw	tiguan	175600	\N	\N	2026-04-27 14:03:23.208326+00	\N	f	\N
1074	2	1825	DJ38AID	kia sportage	\N	104652	\N	\N	2026-04-28 08:50:41.02343+00	\N	f	\N
1031	2	1775	B145TTG	FORD	transit custom 	48499	\N	\N	2026-04-27 13:49:39.91088+00	2026-04-27 14:04:43.794396+00	f	\N
1034	2	1779	DJ98YRD	bmw	x5	291000	\N	\N	2026-04-27 14:06:08.39896+00	\N	f	\N
1035	2	1781	DJ89SMI	bmw	\N	240000	\N	\N	2026-04-27 14:11:56.071218+00	\N	f	\N
1036	2	1780	DJ01WIB	BMW	x1	246000	\N	\N	2026-04-27 14:19:38.265248+00	\N	f	\N
1037	2	1782	DJ37KIS	skoda	\N	\N	365000	\N	2026-04-28 05:22:23.540949+00	\N	f	\N
1038	2	1784	DJ57LXA	reno captur	\N	8700	\N	\N	2026-04-28 05:31:12.89623+00	\N	f	\N
1039	2	1783	DJ25GRS	vw	up	249000	\N	\N	2026-04-28 05:40:46.791352+00	\N	f	\N
1040	2	1787	B100HPZ	tesla	3	70000	\N	\N	2026-04-28 05:46:24.562449+00	\N	f	\N
1041	2	1790	DJ40EME	skoda	\N	203000	\N	\N	2026-04-28 05:52:14.322356+00	\N	f	\N
1042	2	1791	DJ74MGO	toyota	chr	\N	\N	\N	2026-04-28 05:57:54.584693+00	\N	f	\N
1043	2	1785	DJ83BAF	skoda super	\N	65200	\N	\N	2026-04-28 06:00:25.547371+00	\N	f	\N
1044	2	1793	B444VPV	PORSCHE	MACAN	25000	\N	ANV CLIENT MON 265/40/21. 295/35/21 4BUC PIRELI P ZERO	2026-04-28 06:19:11.512422+00	\N	f	\N
1045	2	1789	DJ90BLD	NISSAN 	QASHQAI	142000	\N	\N	2026-04-28 06:32:42.628656+00	\N	f	\N
1046	2	1794	DJ83BAF	skoda super	\N	65000	\N	\N	2026-04-28 06:42:26.67501+00	\N	f	\N
1047	2	1795	DJ11BGX	\N	\N	120000	\N	\N	2026-04-28 06:42:26.85728+00	\N	f	\N
1048	2	1797	DJ35MXR	volvo	\N	55000	\N	\N	2026-04-28 06:52:33.483525+00	\N	f	\N
1049	2	1798	DJ37KIS	skoda	\N	\N	365000	\N	2026-04-28 06:57:59.570875+00	\N	f	\N
1050	2	1796	DJ42NIK	bmw	5	224200	\N	\N	2026-04-28 06:59:24.005948+00	\N	f	\N
1051	2	1799	B911PHA	w transporter	\N	\N	\N	\N	2026-04-28 07:00:14.15807+00	\N	f	\N
1052	2	1800	DJ17VRJ	vw	golf	\N	\N	\N	2026-04-28 07:04:36.058758+00	2026-04-28 07:04:48.042248+00	f	\N
1053	2	1801	DJ25CCD	RENAULT 	\N	41000	\N	\N	2026-04-28 07:11:01.773215+00	2026-04-28 07:11:12.651994+00	f	\N
1054	2	1802	B17NSL	mercedes	\N	220000	\N	\N	2026-04-28 07:13:34.166322+00	\N	f	\N
1055	2	1803	DJ13ESR	bmw x5	\N	400000	\N	\N	2026-04-28 07:14:03.05958+00	\N	f	\N
1056	2	1804	B700XWB	DACIA	DUSTER	51000	\N	ANV. MON.CLIENT 215/60 /18 CONTINENTAL ECOCONTACT 6	2026-04-28 07:18:53.304017+00	\N	f	\N
1057	2	1805	DJ016782	toyota	corolla	\N	\N	\N	2026-04-28 07:27:08.665767+00	\N	f	\N
1058	2	1806	DJ89KXN	toyota 	corolla	\N	\N	\N	2026-04-28 07:28:01.31284+00	\N	f	\N
1059	2	1807	DJ66DPM	Chevrolet 	aveo	160000	\N	\N	2026-04-28 07:30:46.702414+00	\N	f	\N
1060	2	1808	DJ09UIN	toyota	\N	116000	\N	\N	2026-04-28 07:33:46.826545+00	\N	f	\N
1061	2	1809	IS80PHA	OPEL 	INSIGNIA	75854	\N	\N	2026-04-28 07:35:45.178754+00	\N	f	\N
1062	2	1810	DJ98RED	opel	corsa	\N	\N	\N	2026-04-28 07:38:59.917606+00	\N	f	\N
1063	2	1811	DJ66RMN	nissan	\N	120000	\N	\N	2026-04-28 07:42:16.382395+00	\N	f	\N
1065	2	1814	DJ32LMD	lexus 	nx300h	122000	\N	\N	2026-04-28 08:02:54.026775+00	\N	f	\N
1066	2	1815	DJ20CDO	bmw	520	240000	\N	\N	2026-04-28 08:06:26.667627+00	\N	f	\N
1067	2	1812	DJ48ELC	dacia	\N	60000	\N	\N	2026-04-28 08:09:22.407792+00	\N	f	\N
1068	2	1817	DJ33JES	mercedes sprinter	\N	445000	\N	\N	2026-04-28 08:20:57.304634+00	\N	f	\N
1064	2	1813	DJ19STM	bmw	x5	\N	\N	\N	2026-04-28 07:58:19.866471+00	2026-04-28 08:22:35.826237+00	f	\N
1069	2	1818	DJ20NOV	Hyundai 	santa fe	198000	\N	\N	2026-04-28 08:28:33.309571+00	\N	f	\N
1070	2	1822	DJ89LHU	mazda	cx30	6500	\N	\N	2026-04-28 08:42:44.98043+00	\N	f	\N
1073	2	1824	B994BSC	ssangyong	\N	74000	\N	\N	2026-04-28 08:48:17.678994+00	\N	f	\N
1075	2	1826	DJ55RDW	bmw	\N	142000	\N	\N	2026-04-28 08:55:28.040869+00	\N	f	\N
1076	2	1827	DJ17UTU	toyota	corola cros	2200	\N	\N	2026-04-28 08:55:28.705016+00	\N	f	\N
1072	2	1816	DJ06EDJ	dacia	logan	\N	\N	\N	2026-04-28 08:45:34.129134+00	2026-04-28 08:56:53.36911+00	f	\N
1077	2	1819	DJ10WYT	VW	GOLF	48220	\N	\N	2026-04-28 09:01:25.937396+00	\N	f	\N
1078	2	1830	B707AMX	MERCEDES	E CLASS	130000	\N	\N	2026-04-28 09:46:48.862615+00	\N	f	\N
1071	2	1823	GJ37MRC	mercedes	\N	228000	\N	\N	2026-04-28 08:43:48.483806+00	2026-04-28 09:55:04.172012+00	f	\N
1079	2	1834	DJ33ACV	toiota rav 4	\N	75980	\N	\N	2026-04-28 10:10:20.015542+00	\N	f	\N
1080	2	1835	DJ59DMK	Peugeot 	407	240000	\N	\N	2026-04-28 10:10:31.764698+00	\N	f	\N
1081	2	1836	IS25PHA	OPEL	CORSA	185167	\N	\N	2026-04-28 10:11:18.057681+00	2026-04-28 10:11:42.363713+00	f	\N
1082	2	1831	DJ79LEX	mercedes	gleA	158000	\N	\N	2026-04-28 10:28:28.689825+00	\N	f	\N
1083	2	1838	B263SPA	HYUNDAI	KONA	20000	\N	\N	2026-04-28 10:38:21.262741+00	\N	f	\N
1084	2	1832	DJ90KHY	reno katjar	\N	211000	\N	\N	2026-04-28 10:50:48.731783+00	\N	f	\N
1085	2	1839	DJ29ASZ	passat	\N	237065	\N	\N	2026-04-28 10:51:10.861001+00	\N	f	\N
1086	2	1841	DJ017371	vw	golf	\N	\N	\N	2026-04-28 10:58:41.89797+00	\N	f	\N
1088	2	1845	DJ31SUA	MERCEDES	gle	13000	\N	\N	2026-04-28 11:06:58.176356+00	2026-04-28 11:07:14.635913+00	f	\N
1090	2	1847	DJ90KHY	reno katjar	\N	211000	\N	\N	2026-04-28 11:09:20.792569+00	\N	f	\N
1089	2	1833	DJ13WDX	vw	caddy	\N	\N	\N	2026-04-28 11:09:00.415271+00	2026-04-28 11:10:56.688833+00	f	\N
1091	2	1848	DJ13FHM	bmv	\N	160000	\N	\N	2026-04-28 11:20:21.121177+00	\N	f	\N
1087	2	1844	DJ10WAD	AUDI	A 4	232000	\N	ANV. MON. 195/65/15 HANKOOK KINERGI 4 S  4 BUC	2026-04-28 11:06:56.316598+00	2026-04-28 11:20:37.391659+00	f	\N
1092	2	1849	DJ45EDI	opel	\N	286000	\N	\N	2026-04-28 11:25:06.930418+00	\N	f	\N
1093	2	1846	B129TTG	\N	ford	71110	\N	\N	2026-04-28 11:27:56.625564+00	\N	f	\N
1094	2	1840	DJ21MBK	SKODA	OCTAVIA 	210700	\N	\N	2026-04-28 11:31:56.936418+00	\N	f	\N
1095	2	1850	DJ18AKD	Ford	kuga	80000	\N	\N	2026-04-28 11:50:16.678298+00	\N	f	\N
1096	2	1851	DJ74AWD	mazda	cx3	208000	\N	\N	2026-04-28 11:53:49.611227+00	2026-04-28 11:56:46.263388+00	f	\N
1098	2	1852	DJ01ECD	toiota c hr	\N	\N	\N	\N	2026-04-28 12:06:00.424398+00	\N	f	\N
1097	2	1842	DJ10EPS	toyota	\N	240000	\N	\N	2026-04-28 11:55:16.308564+00	2026-04-28 12:07:26.011859+00	f	\N
1099	2	1855	DJ12SWY	logan	\N	79000	\N	\N	2026-04-28 12:16:55.588307+00	\N	f	\N
1100	2	1856	DJ75SRJ	vw	touran	\N	195000	\N	2026-04-28 12:34:39.134178+00	\N	f	\N
1101	2	1857	DJ38BOL	BMW	X3	202000	\N	\N	2026-04-28 12:36:04.490926+00	\N	f	\N
1102	2	1858	DJ01YAY	mercedes	\N	71000	\N	\N	2026-04-28 12:50:39.862605+00	\N	f	\N
1103	2	1859	DJ14JJP	vw	tiguan	290000	\N	BUCSI BRATE SPATE UZATE	2026-04-28 13:00:44.781681+00	\N	f	\N
1104	2	1860	DJ16FHZ	dacia	logan	45000	\N	\N	2026-04-28 13:01:29.436754+00	\N	f	\N
1106	2	1862	DJ77WND	mercedes gle	\N	100000	\N	\N	2026-04-28 13:10:22.879145+00	\N	f	\N
1107	2	1863	DJ95ADP	vw	taigo	33000	\N	\N	2026-04-28 13:18:53.729954+00	\N	f	\N
1105	2	1861	DJ37DYM	volvo	\N	54000	\N	\N	2026-04-28 13:07:19.675109+00	2026-04-28 13:25:38.885814+00	f	\N
1109	2	1865	DJ22VVV	bmw	\N	220000	\N	\N	2026-04-28 13:32:56.312584+00	\N	f	\N
1110	2	1866	DJ21XCN	porsche	\N	\N	\N	\N	2026-04-28 13:33:23.57695+00	\N	f	\N
1111	2	1868	DJ05HSD	toyota	\N	\N	\N	\N	2026-04-28 13:43:46.041045+00	\N	f	\N
1112	2	1870	OT05BTA	bmw x   5	\N	\N	\N	\N	2026-04-28 14:01:20.141042+00	\N	f	\N
1108	2	1864	DJ01SMS	PORSCHE	\N	113000	\N	\N	2026-04-28 13:21:45.875183+00	2026-04-28 14:09:18.817977+00	f	\N
1113	2	1871	DJ99AXM	BNW	X6	78000	\N	ANV. CLIENT MON.245/50/19 PIRELI CINTURATO P 7 4 BUC.	2026-04-28 14:18:44.504414+00	\N	f	\N
1114	2	1873	DJ98EWA	skoda	\N	160000	\N	\N	2026-04-29 05:33:35.926918+00	\N	f	\N
1115	2	1876	DJ17UMZ	renault	trafic	350000	\N	ANVELOPE UZATE FATA	2026-04-29 05:44:34.194333+00	\N	f	\N
1116	2	1878	DJ88NET	mercedes	\N	165000	\N	\N	2026-04-29 05:52:37.571073+00	\N	f	\N
1117	2	1879	DJ39MLI	HYUNDAI 	tucson 	183000	\N	\N	2026-04-29 05:55:59.769685+00	\N	f	\N
1119	2	1872	DJ17CMU	boxer	\N	320000	\N	\N	2026-04-29 06:07:39.139692+00	\N	f	\N
1120	2	1880	B232PHA	\N	\N	\N	\N	\N	2026-04-29 06:15:08.723217+00	\N	f	\N
1121	2	1881	DJ22TSN	VOLVO	XC60	90000	\N	ANV. MON.CONTINENTAL ECOCONTACT 6235/55 19 4BUC	2026-04-29 06:19:09.878687+00	\N	f	\N
1122	2	1882	B882ZRO	hyundai	\N	147050	\N	\N	2026-04-29 06:19:56.323642+00	\N	f	\N
1118	2	1875	DJ09GCB	mercedes	clas e	261000	\N	\N	2026-04-29 06:00:22.862479+00	2026-04-29 06:28:14.819458+00	f	\N
1123	2	1883	DJ22CFC	mercedes	\N	155000	\N	\N	2026-04-29 06:38:55.781113+00	\N	f	\N
1124	2	1884	CL25ADM	renault	master	450000	\N	\N	2026-04-29 06:39:53.053444+00	\N	f	\N
1125	2	1885	B329AXA	BMW	x4	88000	\N	\N	2026-04-29 06:43:23.010367+00	\N	f	\N
1126	2	1887	DJ01FAU	MERCEDES	GLA	159000	\N	\N	2026-04-29 07:05:58.033181+00	\N	f	\N
1127	2	1888	DJ38RDM	mercedes	vito	170000	\N	\N	2026-04-29 07:11:53.467861+00	\N	f	\N
1128	2	1889	DJ39LUX	opel	\N	250000	\N	\N	2026-04-29 07:13:24.060838+00	\N	f	\N
1129	2	1890	DJ21TYI	bmw x3	\N	\N	\N	\N	2026-04-29 07:14:53.543231+00	\N	f	\N
1130	2	1892	DJ58ADT	vw	gofl	350000	\N	\N	2026-04-29 07:22:30.984915+00	\N	f	\N
1131	2	1893	NT52KBE	iveco	\N	87181	\N	\N	2026-04-29 07:36:35.222059+00	\N	f	\N
1132	2	1894	DJ97WWW	mercedes	\N	121000	\N	\N	2026-04-29 07:38:39.113+00	\N	f	\N
1134	2	1896	DJ09XGN	dacia	logan	360000	\N	\N	2026-04-29 07:45:00.247693+00	\N	f	\N
1133	2	1895	GJ08CRN	mercedes	\N	26000	\N	\N	2026-04-29 07:38:50.918146+00	2026-04-29 07:55:58.291944+00	f	\N
1135	2	1900	DJ77NRO	AUDI 	A6 	15000	\N	\N	2026-04-29 08:03:24.16529+00	\N	f	\N
1137	2	1902	DJ99NMM	VW	GOLF	63800	\N	\N	2026-04-29 08:05:11.576747+00	\N	f	\N
1138	2	1903	B41LUB	renout	megan	106000	\N	\N	2026-04-29 08:11:35.916338+00	\N	f	\N
1139	2	1904	GJ18CSM	bmw	7	33900	\N	\N	2026-04-29 08:12:43.562471+00	\N	f	\N
1140	2	1898	DJ65AAB	ford puma	\N	\N	\N	\N	2026-04-29 08:13:54.968135+00	\N	f	\N
1141	2	1905	B216ELM	ford	transit	6455	\N	\N	2026-04-29 08:17:49.816567+00	\N	f	\N
1142	2	1907	DJ33WAA	toyota	\N	68000	\N	\N	2026-04-29 08:28:44.73862+00	\N	f	\N
1143	2	1908	DJ01VAD	toyota	gt86	50000	\N	\N	2026-04-29 08:38:31.984865+00	\N	f	\N
1144	2	1909	DJ94CAR	mercedes	\N	97456	\N	\N	2026-04-29 08:39:00.391958+00	\N	f	\N
1136	2	1901	DJ17UMZ	renault	trafic	\N	\N	\N	2026-04-29 08:03:41.435641+00	2026-04-29 08:46:54.693609+00	f	\N
1145	2	1913	DJ66KIK	FORD	PUMA	70000	\N	\N	2026-04-29 08:53:26.194418+00	\N	f	\N
1146	2	1912	DJ44WRW	mercedes glc	\N	170000	\N	\N	2026-04-29 08:56:51.782155+00	\N	f	\N
1147	2	1915	B102VPV	mercedes	\N	140000	\N	\N	2026-04-29 09:23:43.191144+00	\N	f	\N
1149	2	1917	DJ45CNG	ford	\N	6000	\N	\N	2026-04-29 09:26:22.706973+00	\N	f	\N
1150	2	1918	OT04RMI	renault 	kadjar	50000	\N	\N	2026-04-29 09:39:40.148948+00	\N	f	\N
1151	2	1899	DJ32LAC	toyota	\N	170000	\N	\N	2026-04-29 09:40:07.134182+00	\N	f	\N
1152	2	1920	DJ09TAN	toiota corolla	\N	\N	\N	\N	2026-04-29 10:01:52.83839+00	\N	f	\N
1153	2	1921	DJ57MRU	dacia 	logan	340000	\N	ANVELOPE FATA UZATE INTERIOR	2026-04-29 10:02:44.673262+00	\N	f	\N
1154	2	1922	DJ18MJP	opel	\N	220000	\N	\N	2026-04-29 10:14:18.037341+00	\N	f	\N
1155	2	1923	DJ12EXZ	toyota	yaris	\N	\N	\N	2026-04-29 10:15:30.331015+00	\N	f	\N
1156	2	1924	DJ99MCM	volvo	xc60	28000	\N	\N	2026-04-29 10:23:16.241686+00	\N	f	\N
1157	2	1926	DJ11LLL	SEAT	LEON	98500	\N	\N	2026-04-29 10:32:01.502241+00	\N	f	\N
1158	2	1927	DJ26JTM	audii	\N	\N	\N	\N	2026-04-29 10:33:08.958038+00	\N	f	\N
1159	2	1929	DJ30STY	volvo	xc40	\N	\N	\N	2026-04-29 10:41:03.943176+00	\N	f	\N
1160	2	1930	DJ15AZA	skoda	octavia	78000	\N	\N	2026-04-29 11:06:13.363917+00	\N	f	\N
1161	2	1931	DJ71REY	bmw	\N	160000	\N	\N	2026-04-29 11:07:34.987129+00	\N	f	\N
1162	2	1932	DJ03NXT	dacia	\N	\N	\N	\N	2026-04-29 11:14:28.381094+00	\N	f	\N
1163	2	1933	DJ21STK	BMW	X5	94000	\N	\N	2026-04-29 11:17:35.912098+00	\N	f	\N
1164	2	1934	DJ39EMC	NISAN	NAVARA	300000	\N	ANV. CLINT MON. 235/70/16 YOKOHAMA GEOLANDAR	2026-04-29 11:19:17.429092+00	2026-04-29 11:23:58.491095+00	f	\N
1165	2	1935	DJ64LKY	bmw	\N	50000	\N	\N	2026-04-29 11:24:29.228899+00	\N	f	\N
1166	2	1936	B300MTR	renault	\N	88000	\N	\N	2026-04-29 11:31:25.382074+00	\N	f	\N
1167	2	1937	DJ10ASC	bmw	\N	246000	\N	\N	2026-04-29 11:31:39.467771+00	\N	f	\N
1168	2	1940	DJ72PAT	mercedes	\N	74000	\N	\N	2026-04-29 11:46:38.646486+00	\N	f	\N
1169	2	1941	DJ77LYE	vw	passat	345000	\N	\N	2026-04-29 11:46:59.611615+00	\N	f	\N
1170	2	1942	DJ84TUR	mercedes gle	\N	108000	\N	\N	2026-04-29 11:50:09.921208+00	\N	f	\N
1171	2	1943	DJ60WSL	VOLVO	XC60	73000	\N	\N	2026-04-29 11:52:23.008309+00	2026-04-29 11:52:56.297939+00	f	\N
1172	2	1944	DJ30AVV	mercedes	\N	\N	\N	\N	2026-04-29 11:52:56.846243+00	2026-04-29 11:54:57.986031+00	f	\N
1173	2	1946	DJ12XVI	audi	\N	133000	\N	\N	2026-04-29 12:04:45.019221+00	\N	f	\N
1174	2	1945	TR41LUP	ford	\N	\N	240000	\N	2026-04-29 12:14:47.886719+00	2026-04-29 12:18:04.917818+00	f	\N
1175	2	1947	B611MXS	FORD	FOCUS	185000	\N	\N	2026-04-29 12:23:02.589845+00	\N	f	\N
1176	2	1949	DJ60WSL	VOLVO	XC60	\N	\N	\N	2026-04-29 12:28:13.298926+00	\N	f	\N
1177	2	1950	B611MXS	FORD	FOCUS	\N	\N	\N	2026-04-29 12:45:03.143526+00	\N	f	\N
1178	2	1948	DJ37POE	bmw g12	\N	130000	\N	\N	2026-04-29 13:06:05.951932+00	\N	f	\N
1179	2	1951	DJ67DMS	KIA	CEED	43000	\N	ANV.CLIENT MON 205/55/16 HANKOOK KYNERGI ECO 4 BUC	2026-04-29 13:06:06.247429+00	\N	f	\N
1180	2	1952	DJ65MYK	toyota	\N	2700	\N	\N	2026-04-29 13:12:27.794134+00	\N	f	\N
1148	2	1916	DJ20VTC	MERCEDES	GLC	14000	\N	\N	2026-04-29 09:24:00.364682+00	2026-04-29 13:21:36.309744+00	f	\N
1181	2	1954	VL91ADR	seat	\N	\N	\N	\N	2026-04-29 13:22:41.565197+00	\N	f	\N
1182	2	1955	DJ26TIS	hyundai	\N	20000	\N	\N	2026-04-29 13:23:54.042273+00	\N	f	\N
1183	2	1956	B125HSX	FORD	PUMA	31000	\N	\N	2026-04-29 13:41:59.690838+00	\N	f	\N
1184	2	1957	B707XDD	mercedes	gle	169000	\N	\N	2026-04-29 13:48:31.104649+00	\N	f	\N
1185	2	1958	MS38HLD	skoda	\N	84400	\N	\N	2026-04-29 13:50:31.20105+00	\N	f	\N
1187	2	1960	DJ28CJU	skoda	\N	50000	\N	\N	2026-04-29 14:01:01.873615+00	\N	f	\N
1186	2	1959	DJ94WBW	mercedes	gle	700000	\N	\N	2026-04-29 13:50:34.26678+00	2026-04-29 14:04:41.660567+00	f	\N
1188	2	1961	MS38HLD	skoda	\N	\N	\N	\N	2026-04-29 14:06:13.398968+00	\N	f	\N
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.accounts_id_seq', 3, true);


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
-- Name: client_vehicole_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.client_vehicole_id_seq', 905, true);


--
-- Name: clienti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.clienti_id_seq', 1487, true);


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.companies_id_seq', 2, true);


--
-- Name: devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.devices_id_seq', 43, true);


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
-- Name: general_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.general_settings_id_seq', 2, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.items_id_seq', 112, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.locations_id_seq', 3, true);


--
-- Name: locuri_cazare_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.locuri_cazare_id_seq', 1, true);


--
-- Name: marci_anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.marci_anvelope_id_seq', 3, true);


--
-- Name: profiluri_anvelope_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.profiluri_anvelope_id_seq', 1, false);


--
-- Name: programari_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.programari_id_seq', 2, true);


--
-- Name: receipt_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.receipt_items_id_seq', 5483, true);


--
-- Name: receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.receipts_id_seq', 1961, true);


--
-- Name: registers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.registers_id_seq', 1, true);


--
-- Name: themes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.themes_id_seq', 4, true);


--
-- Name: vehicole_id_seq; Type: SEQUENCE SET; Schema: public; Owner: berlinstar
--

SELECT pg_catalog.setval('public.vehicole_id_seq', 1188, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: client_vehicole client_vehicole_pkey; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.client_vehicole
    ADD CONSTRAINT client_vehicole_pkey PRIMARY KEY (id);


--
-- Name: general_settings general_settings_account_id_key; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT general_settings_account_id_key UNIQUE (account_id);


--
-- Name: general_settings general_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT general_settings_pkey PRIMARY KEY (id);


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
-- Name: profiluri_anvelope profiluri_anvelope_pkey; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.profiluri_anvelope
    ADD CONSTRAINT profiluri_anvelope_pkey PRIMARY KEY (id);


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
-- Name: vehicole vehicole_pkey; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.vehicole
    ADD CONSTRAINT vehicole_pkey PRIMARY KEY (id);


--
-- Name: vehicole vehicole_receipt_id_key; Type: CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.vehicole
    ADD CONSTRAINT vehicole_receipt_id_key UNIQUE (receipt_id);


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
-- Name: ix_client_vehicole_account_client; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_client_vehicole_account_client ON public.client_vehicole USING btree (account_id, client_id, is_deleted);


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
-- Name: ix_profiluri_anvelope_account_id_is_deleted_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_profiluri_anvelope_account_id_is_deleted_id ON public.profiluri_anvelope USING btree (account_id, is_deleted, id);


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
-- Name: ix_vehicole_account_id; Type: INDEX; Schema: public; Owner: berlinstar
--

CREATE INDEX ix_vehicole_account_id ON public.vehicole USING btree (account_id);


--
-- Name: anvelope anvelope_profil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.anvelope
    ADD CONSTRAINT anvelope_profil_id_fkey FOREIGN KEY (profil_id) REFERENCES public.profiluri_anvelope(id) ON DELETE SET NULL;


--
-- Name: client_vehicole client_vehicole_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.client_vehicole
    ADD CONSTRAINT client_vehicole_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: client_vehicole client_vehicole_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.client_vehicole
    ADD CONSTRAINT client_vehicole_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE CASCADE;


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
-- Name: general_settings general_settings_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT general_settings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: profiluri_anvelope profiluri_anvelope_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.profiluri_anvelope
    ADD CONSTRAINT profiluri_anvelope_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


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
-- Name: vehicole vehicole_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.vehicole
    ADD CONSTRAINT vehicole_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: vehicole vehicole_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: berlinstar
--

ALTER TABLE ONLY public.vehicole
    ADD CONSTRAINT vehicole_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ciQBokvjA6MIiVasPhYLWUbKx61M0EIhZRaqapko1zJMaQtAAtNFAwJQmJguMJl

