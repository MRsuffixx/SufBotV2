import { auditLogRepository, type RecordAuditLogInput } from '@bot/database';

export const auditService = {
  record(input: RecordAuditLogInput) {
    return auditLogRepository.record({ ...input, source: input.source ?? 'bot' });
  },
};
