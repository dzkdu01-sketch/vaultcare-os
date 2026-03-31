/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WhatsApp number: country code + national number, no + prefix (e.g. 971501234567) */
  readonly VITE_WHATSAPP_E164?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
