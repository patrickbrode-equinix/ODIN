import db from '../db.js';
import { config } from '../config/index.js';
import { formatShiftMonthLabel } from '../lib/shiftplanMonth.js';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBooleanSetting(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderTemplate(template, data) {
  return String(template || '')
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
      const value = data[key];
      return value == null ? '' : String(value);
    })
    .trim();
}

function getShiftWindowLabel(referenceDate = new Date()) {
  const hour = referenceDate.getHours();
  if (hour >= 22 || hour < 6) return 'N';
  if (hour >= 14) return 'L1';
  return 'E1';
}

function toRemainingMinutes(ticket) {
  const raw = ticket?.remainingMinutes ?? ticket?.remaining_minutes ?? null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;

  const dueAt = ticket?.dueAt || ticket?.commitAt || ticket?.revisedCommitDate || null;
  if (!dueAt) return undefined;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return undefined;
  return Math.max(Math.round((due.getTime() - Date.now()) / 60000), 0);
}

async function loadTeamsSettings(keys = []) {
  const useFilter = Array.isArray(keys) && keys.length > 0;
  const query = useFilter
    ? 'SELECT key, value FROM teams_settings WHERE key = ANY($1::text[]) ORDER BY key'
    : 'SELECT key, value FROM teams_settings ORDER BY key';
  const params = useFilter ? [keys] : [];
  const { rows } = await db.query(query, params);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function resolveRecipients(recipientTokens, shiftFilter = [], referenceDate = new Date()) {
  const normalizedRecipients = [...new Set(recipientTokens.map((entry) => entry.trim()).filter(Boolean))];
  if (normalizedRecipients.length === 0) return [];

  const monthLabel = formatShiftMonthLabel(referenceDate.getFullYear(), referenceDate.getMonth() + 1);
  const day = referenceDate.getDate();

  const { rows } = await db.query(
    `SELECT ec.employee_name, ec.email, ec.is_active, s.shift_code
     FROM employee_contacts ec
     LEFT JOIN shifts s
       ON s.employee_name = ec.employee_name
      AND s.month = $2
      AND s.day = $3
     WHERE LOWER(ec.employee_name) = ANY($1::text[])
        OR LOWER(ec.email) = ANY($1::text[])
     ORDER BY ec.employee_name`,
    [normalizedRecipients.map((entry) => entry.toLowerCase()), monthLabel, day]
  );

  const lookup = new Map();
  for (const row of rows) {
    lookup.set(String(row.employee_name || '').toLowerCase(), row);
    if (row.email) lookup.set(String(row.email || '').toLowerCase(), row);
  }

  const resolved = normalizedRecipients.map((token) => {
    const row = lookup.get(token.toLowerCase());
    if (row) {
      return {
        employeeName: row.employee_name,
        email: row.email,
        shiftCode: row.shift_code || null,
        isActive: row.is_active !== false,
      };
    }
    return {
      employeeName: token.includes('@') ? null : token,
      email: token.includes('@') ? token : null,
      shiftCode: null,
      isActive: true,
    };
  });

  if (shiftFilter.length === 0) return resolved;

  return resolved.filter((recipient) => recipient.shiftCode && shiftFilter.includes(String(recipient.shiftCode).toUpperCase()));
}

async function sendBotTicketNotification(baseUrl, apiKey, payload) {
  if (!baseUrl || !apiKey) {
    return { success: false, skipped: true, reason: 'Bot internal API not configured' };
  }

  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/api/internal/notify/ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-internal-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.reason || `Bot notification failed (${response.status})`);
  }

  return data;
}

export async function sendTeamsMessage(webhookUrl, title, body) {
  // Check communication mode — respect disabled setting
  try {
    const modeSettings = await loadTeamsSettings(['teams.communicationMode']);
    const commMode = modeSettings['teams.communicationMode'] || 'webhook';
    if (commMode === 'disabled') {
      console.warn('[Teams] Communication mode is disabled – message skipped.');
      return { skipped: true, reason: 'disabled' };
    }
  } catch (e) {
    // If settings lookup fails, proceed with send attempt
  }

  if (!webhookUrl) {
    console.warn('[Teams] No webhook URL configured – message skipped.');
    return { skipped: true };
  }

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          body: [
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: title },
            { type: 'TextBlock', text: body, wrap: true },
            {
              type: 'TextBlock',
              text: `ODIN · ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
              isSubtle: true,
              size: 'Small',
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Teams webhook returned ${response.status}: ${text}`);
  }

  return { sent: true };
}

export async function logTeamsMessage(type, recipient, channel, content, status, errorMsg) {
  await db.query(
    `INSERT INTO teams_message_log (message_type, recipient, channel, content, status, error_msg)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [type, recipient || null, channel || null, content, status, errorMsg || null]
  );
}

export async function notifyDispatcherManualReview({ ticket, reason, category, mode = 'shadow' }) {
  // Check communication mode — if disabled, skip all notifications
  const modeSettings = await loadTeamsSettings(['teams.communicationMode']);
  const commMode = modeSettings['teams.communicationMode'] || 'webhook';
  if (commMode === 'disabled') {
    return { skipped: true, reason: 'Teams communication is disabled' };
  }

  const settings = await loadTeamsSettings([
    'dispatcher_manual_review_notify_systems',
    'dispatcher_manual_review_notify_subtypes',
    'dispatcher_manual_review_live_only',
    'dispatcher_manual_review_recipients',
    'dispatcher_manual_review_shift_filter',
    'dispatcher_manual_review_group_targets',
    'dispatcher_manual_review_channel_fallback',
    'dispatcher_manual_review_title',
    'dispatcher_manual_review_body',
    'fallback_recipient',
    'bot_internal_base_url',
  ]);

  const systemEnabled = parseBooleanSetting(settings.dispatcher_manual_review_notify_systems, false);
  const subtypeEnabled = parseBooleanSetting(settings.dispatcher_manual_review_notify_subtypes, false);
  const liveOnly = parseBooleanSetting(settings.dispatcher_manual_review_live_only, true);
  const channelFallback = parseBooleanSetting(settings.dispatcher_manual_review_channel_fallback, true);

  if (category === 'system_exclusion' && !systemEnabled) {
    return { skipped: true, reason: 'System exclusion notifications disabled' };
  }
  if (category === 'subtype_exclusion' && !subtypeEnabled) {
    return { skipped: true, reason: 'Subtype exclusion notifications disabled' };
  }
  if (liveOnly && mode !== 'live') {
    return { skipped: true, reason: 'Notification restricted to live mode' };
  }

  const referenceDate = new Date();
  const shiftFilter = parseCsv(settings.dispatcher_manual_review_shift_filter).map((entry) => entry.toUpperCase());
  const configuredRecipients = parseCsv(settings.dispatcher_manual_review_recipients);
  const fallbackRecipients = configuredRecipients.length > 0
    ? configuredRecipients
    : parseCsv(settings.fallback_recipient);
  const recipients = await resolveRecipients(fallbackRecipients, shiftFilter, referenceDate);
  const groupTargets = [
    ...parseCsv(settings.dispatcher_manual_review_group_targets),
    ...parseJsonArray(settings.dispatcher_manual_review_group_targets),
  ];

  const context = {
    ticketId: ticket?.externalId || ticket?.id || 'unbekannt',
    internalTicketId: ticket?.id || '',
    systemName: ticket?.systemName || ticket?.raw?.system_name || 'ohne Systemname',
    subtype: ticket?.customerTroubleType || ticket?.raw?.customer_trouble_type || ticket?.raw?.subtype || 'ohne Subtype',
    queue: ticket?.queue || ticket?.raw?.queue_type || 'unbekannt',
    priority: ticket?.priority || 'unknown',
    ticketType: ticket?.type || 'Unknown',
    category: category === 'system_exclusion' ? 'System-Ausnahme' : 'Subtype-Ausnahme',
    reason,
    mode,
    currentShiftWindow: getShiftWindowLabel(referenceDate),
  };

  const title = renderTemplate(
    settings.dispatcher_manual_review_title || 'Dispatcher Review · {{ticketId}} · {{category}}',
    context
  );
  const body = renderTemplate(
    settings.dispatcher_manual_review_body || [
      'Ticket {{ticketId}} wurde nicht automatisch zugewiesen.',
      'Kategorie: {{category}}',
      'System: {{systemName}}',
      'Subtype: {{subtype}}',
      'Queue: {{queue}}',
      'Grund: {{reason}}',
      'Modus: {{mode}}',
    ].join('\n'),
    context
  );

  const botBaseUrl = settings.bot_internal_base_url || process.env.TEAMS_BOT_INTERNAL_URL || '';
  const botApiKey = process.env.BOT_INTERNAL_API_KEY || '';

  const results = [];
  const recipientLabels = recipients.map((recipient) => recipient.employeeName || recipient.email).filter(Boolean);

  if (botBaseUrl && botApiKey && recipients.length > 0) {
    for (const recipient of recipients) {
      if (!recipient.email) continue;
      const payload = {
        email: recipient.email,
        ticketId: String(context.ticketId),
        ticketType: context.ticketType,
        priority: context.priority,
        systemName: context.systemName,
        accountName: ticket?.accountName || ticket?.raw?.account_name || undefined,
        remainingMinutes: toRemainingMinutes(ticket),
        commitAt: ticket?.dueAt || ticket?.revisedCommitDate || ticket?.raw?.commit_date || undefined,
        ownerSuggestion: ticket?.owner || ticket?.raw?.owner || undefined,
        reason,
      };

      try {
        await sendBotTicketNotification(botBaseUrl, botApiKey, payload);
        await logTeamsMessage('DISPATCHER_MANUAL_REVIEW', recipient.employeeName || recipient.email, 'personal-bot', `${title}: ${body}`, 'sent', null);
        results.push({ recipient: recipient.employeeName || recipient.email, channel: 'personal-bot', success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logTeamsMessage('DISPATCHER_MANUAL_REVIEW', recipient.employeeName || recipient.email, 'personal-bot', `${title}: ${body}`, 'failed', message);
        results.push({ recipient: recipient.employeeName || recipient.email, channel: 'personal-bot', success: false, error: message });
      }
    }
  }

  const hasDeliveredBotMessages = results.some((entry) => entry.success);
  if (!hasDeliveredBotMessages && channelFallback) {
    const fallbackBody = [
      body,
      recipientLabels.length > 0 ? `\nAdressaten: ${recipientLabels.join(', ')}` : '',
      groupTargets.length > 0 ? `\nGruppen: ${groupTargets.join(', ')}` : '',
      shiftFilter.length > 0 ? `\nSchichtfilter: ${shiftFilter.join(', ')}` : '',
    ].join('').trim();

    const webhookUrl = config.TEAMS_CHANNEL_WEBHOOK || config.TEAMS_PERSONAL_WEBHOOK;
    const recipientLabel = [
      ...recipientLabels,
      ...groupTargets,
    ].filter(Boolean).join(', ') || 'dispatcher-fallback';

    try {
      await sendTeamsMessage(webhookUrl, title, fallbackBody);
      await logTeamsMessage('DISPATCHER_MANUAL_REVIEW', recipientLabel, webhookUrl === config.TEAMS_CHANNEL_WEBHOOK ? 'channel' : 'personal', `${title}: ${fallbackBody}`, 'sent', null);
      results.push({ recipient: recipientLabel, channel: webhookUrl === config.TEAMS_CHANNEL_WEBHOOK ? 'channel' : 'personal', success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logTeamsMessage('DISPATCHER_MANUAL_REVIEW', recipientLabel, webhookUrl === config.TEAMS_CHANNEL_WEBHOOK ? 'channel' : 'personal', `${title}: ${fallbackBody}`, 'failed', message);
      results.push({ recipient: recipientLabel, channel: webhookUrl === config.TEAMS_CHANNEL_WEBHOOK ? 'channel' : 'personal', success: false, error: message });
    }
  }

  return {
    skipped: results.length === 0,
    results,
  };
}