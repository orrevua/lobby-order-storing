-- ============================================
-- Lobby Order Tracking System — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Apartamentos (Apartments)
CREATE TABLE apartamentos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(10) NOT NULL,
    bloco VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_ap_bloco UNIQUE (numero, bloco)
);

-- 2. Moradores (Residents)
CREATE TABLE moradores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    contato VARCHAR(50),
    apartamento_id INT REFERENCES apartamentos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Encomendas (Packages)
CREATE TABLE encomendas (
    id SERIAL PRIMARY KEY,
    codigo_rastreio VARCHAR(100),
    descricao TEXT,
    status VARCHAR(20) DEFAULT 'pendente',
    data_chegada TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_retirada TIMESTAMP WITH TIME ZONE,
    morador_id INT REFERENCES moradores(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query optimization
CREATE INDEX idx_encomendas_status ON encomendas(status);
CREATE INDEX idx_encomendas_morador ON encomendas(morador_id);
CREATE INDEX idx_moradores_nome ON moradores(nome);

-- 4. Withdrawal Sessions (Sessoes de Retirada)
-- NOTE: Enable Realtime replication for this table in Supabase Dashboard > Database > Replication
CREATE TABLE withdrawal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartamento_id INT NOT NULL REFERENCES apartamentos(id),
    encomenda_ids INT[] NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status values: 'pending', 'confirmed', 'expired', 'cancelled'
    confirmation_method VARCHAR(20),
    -- 'qr_scan' | 'manual'
    manual_reason VARCHAR(50),
    -- reason code for manual confirmation (null when qr_scan)
    doorman_note TEXT,
    -- optional free-text note from doorman
    created_by TEXT,
    -- doorman identifier (future: auth user ID; for now: name/badge string)
    confirmed_by TEXT,
    -- who confirmed: 'resident' for QR, doorman identifier for manual
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_encomenda_ids CHECK (array_length(encomenda_ids, 1) > 0)
);

-- Indexes for withdrawal session queries
CREATE INDEX idx_ws_status ON withdrawal_sessions(status);
CREATE INDEX idx_ws_apartamento ON withdrawal_sessions(apartamento_id);
CREATE INDEX idx_ws_expires ON withdrawal_sessions(expires_at) WHERE status = 'pending';

-- Row Level Security for withdrawal sessions
ALTER TABLE withdrawal_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read sessions (needed for Realtime + public confirmation page)
CREATE POLICY "Public read withdrawal sessions"
    ON withdrawal_sessions FOR SELECT
    USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role manages withdrawal sessions"
    ON withdrawal_sessions FOR ALL
    USING (auth.role() = 'service_role');

-- 5. Schema additions for CPF & Signature Capture
ALTER TABLE encomendas ADD COLUMN received_by TEXT;
ALTER TABLE moradores ADD COLUMN cpf VARCHAR(11);
ALTER TABLE withdrawal_sessions ADD COLUMN cpf_confirmacao VARCHAR(11);
ALTER TABLE withdrawal_sessions ADD COLUMN signature_url TEXT;
ALTER TABLE moradores ADD COLUMN signature_url TEXT;

-- 6. Track which user created each resident
ALTER TABLE moradores ADD COLUMN created_by UUID;

-- 7. Multi-tenancy: Condominiums & Invites
CREATE TABLE condominios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INT,
    use_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE apartamentos ADD COLUMN condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE;
ALTER TABLE moradores ADD COLUMN condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE;

ALTER TABLE apartamentos DROP CONSTRAINT unique_ap_bloco;
ALTER TABLE apartamentos ADD CONSTRAINT unique_condo_ap_bloco UNIQUE (condominio_id, numero, bloco);

CREATE INDEX idx_apartamentos_condominio ON apartamentos(condominio_id);
CREATE INDEX idx_moradores_condominio ON moradores(condominio_id);
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX idx_invite_tokens_condominio ON invite_tokens(condominio_id);

-- NOTE: Create a private storage bucket named 'signatures' in Supabase Dashboard > Storage.
-- No public access. All uploads/reads go through API routes using the service role client.
