-- Add provider column to documents table for Jotform/DocuSign selection

ALTER TABLE documents ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'docusign';
