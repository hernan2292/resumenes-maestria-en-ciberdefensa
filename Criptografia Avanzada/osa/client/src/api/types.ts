// Tipos que reflejan las respuestas JSON del backend Go (ver
// server/internal/transport/http/handlers_*.go). Todo lo cifrado viaja
// como base64/hex; este cliente jamás asume que el servidor entiende el
// contenido de esos campos.

export interface RegisterResponse {
  user_id: string;
  public_code: string;
}

export interface LoginResponse {
  access_token: string;
  expires_at: string;
  user_id: string;
  role: 'patient' | 'doctor' | 'clinic_admin';
  public_code: string;
  kdf_salt_base64: string;
  totp_enabled: boolean;
}

export interface MeResponse {
  user_id: string;
  email: string;
  role: 'patient' | 'doctor' | 'clinic_admin';
  public_code: string;
  totp_enabled: boolean;
}

export interface PublicUserResponse {
  user_id: string;
  role: 'patient' | 'doctor' | 'clinic_admin';
  public_code: string;
  public_key_base64: string;
  signing_public_key_base64: string;
}

export interface DocumentResponse {
  document_id: string;
  uploaded_by_id: string;
  title_encrypted_base64: string;
  doc_type_encrypted_base64: string;
  encrypted_blob_base64: string;
  encrypted_key_envelope_base64: string;
  /** Presente sólo si quien subió tenía K_enc en ese momento (adenda punto 16). */
  encrypted_key_envelope_symmetric_base64?: string;
  created_at: string;
}

export interface PendingIndexItemResponse {
  document_id: string;
  uploaded_by_id: string;
  created_at: string;
}

export interface DelegationResponse {
  id: string;
  doctor_id: string;
  scope: string;
  valid_from: string;
  valid_until: string;
  is_revoked: boolean;
}

export interface ActiveDelegationForDoctorResponse extends DelegationResponse {
  encrypted_keys_for_doctor_base64: string;
}

export interface LabelResultResponse {
  label_hex: string;
  has_match: boolean;
  encrypted_posting_list_base64?: string;
}

export interface ApiErrorBody {
  error: string;
}
