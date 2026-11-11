export type ErrorCode =
  | 'validation_failed'
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'too_many_login_attempts'
  | 'email_already_exists'
  | 'person_not_found'
  | 'conversation_not_found'
  | 'channel_name_taken'
  | 'members_not_editable'
  | 'message_not_found'
  | 'message_not_owned'
  | 'forbidden'
  | 'quoted_message_not_found'
  | 'not_found'
  | 'payload_too_large'
  | 'request_rejected'
  | 'internal_error';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  invalid_credentials: 401,
  unauthenticated: 401,
  too_many_login_attempts: 429,
  email_already_exists: 409,
  person_not_found: 404,
  conversation_not_found: 404,
  channel_name_taken: 409,
  members_not_editable: 409,
  message_not_found: 404,
  message_not_owned: 403,
  forbidden: 403,
  quoted_message_not_found: 404,
  not_found: 404,
  payload_too_large: 413,
  request_rejected: 400,
  internal_error: 500,
};
