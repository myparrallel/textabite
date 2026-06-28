import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ── Types ─────────────────────────────────────────────────────────────────────

export type Intent =
  | 'log_meal'
  | 'should_i_eat'
  | 'goal_setting'
  | 'reminder_reply'
  | 'help'
  | 'unknown';

export interface NutritionResult {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  description: string;
}

export interface UserGoals {
  preset?: string;
  calorie_goal?: number;
  protein_goal_g?: number;
  carbs_goal_g?: number;
  fat_goal_g?: number;
}

export interface DayTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ── Intent detection ──────────────────────────────────────────────────────────

export async function detectIntent(text: string): Promise<Intent> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 20,
    system: `Classify the user's SMS message into exactly one of these intents. Reply with only the intent key, nothing else.

Intents:
- log_meal: user is logging food they ate or are currently eating
- should_i_eat: user is asking whether they should eat something, if it fits their goals, or what they have left for the day
- goal_setting: user wants to set or update their nutrition goals
- reminder_reply: user is replying to a meal reminder (e.g. "yeah I had a salad", "nope skipped lunch")
- help: user needs help or is asking what the service does
- unknown: anything else`,
    messages: [{ role: 'user', content: text }],
  });

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
  const valid: Intent[] = ['log_meal', 'should_i_eat', 'goal_setting', 'reminder_reply', 'help', 'unknown'];
  return valid.includes(raw as Intent) ? (raw as Intent) : 'unknown';
}

// ── Meal parsing ──────────────────────────────────────────────────────────────

export class NeedsDescriptionError extends Error {}

export async function parseMeal(rawText: string, imageUrl?: string): Promise<NutritionResult> {
  const content: Anthropic.MessageParam['content'] = imageUrl
    ? [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: rawText || 'What is this food? Estimate the nutrition.' },
      ]
    : rawText;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `You are a nutrition parser. Given a meal description or photo, respond with ONLY a JSON object (no markdown) with:
- calories (integer)
- protein_g (number, one decimal)
- carbs_g (number, one decimal)
- fat_g (number, one decimal)
- description (short cleaned-up meal name)

Use best estimates based on typical serving sizes.
If the image is unclear, blurry, or the food cannot be identified with reasonable confidence, respond with exactly: {"needs_description": true}`,
    messages: [{ role: 'user', content }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = JSON.parse(text);

  if (parsed.needs_description) throw new NeedsDescriptionError();

  return parsed as NutritionResult;
}

// ── Meal confirmation replies ─────────────────────────────────────────────────

export async function mealConfirmationReply(
  nutrition: NutritionResult,
  style: 'detailed' | 'simple',
  goals?: UserGoals,
  todayTotals?: DayTotals
): Promise<string> {
  const goalsContext = goals?.calorie_goal
    ? `User's daily calorie goal: ${goals.calorie_goal} cal. Today so far (before this meal): ${todayTotals?.calories ?? 0} cal.`
    : '';

  const styleGuide = style === 'simple'
    ? 'Send a short, casual confirmation that their meal was logged. One sentence max. Sound like a friend.'
    : 'Share the nutrition breakdown in a casual, friendly way. Keep it brief and encouraging.';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 160,
    system: `You are Textabite, a friendly nutrition buddy who texts like a real friend — casual, warm, no corporate speak. ${styleGuide} ${goalsContext} Never use bullet points or markdown. Plain text only. Under 160 chars.`,
    messages: [{
      role: 'user',
      content: `Meal logged: ${nutrition.description} — ${nutrition.calories} cal, ${nutrition.protein_g}g protein, ${nutrition.carbs_g}g carbs, ${nutrition.fat_g}g fat`,
    }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── Should I eat this ─────────────────────────────────────────────────────────

export async function shouldIEatThis(
  query: string,
  goals: UserGoals,
  todayTotals: DayTotals,
  imageUrl?: string
): Promise<string> {
  const remainingCal = (goals.calorie_goal ?? 0) - todayTotals.calories;
  const remainingProtein = (goals.protein_goal_g ?? 0) - todayTotals.protein_g;

  const content: Anthropic.MessageParam['content'] = imageUrl
    ? [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: query || 'Should I eat this?' },
      ]
    : query;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: `You are Textabite, a friendly nutrition buddy who texts like a real friend — casual, warm, honest.
The user is asking if they should eat something. Give them a real answer based on their goals.
Calories remaining today: ${remainingCal} cal. Protein remaining: ${remainingProtein}g.
Goals: ${JSON.stringify(goals)}.
Be honest but supportive. If it fits, say so. If it doesn't quite fit, suggest a tweak. Plain text only, no markdown. Under 200 chars.`,
    messages: [{ role: 'user', content }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── Reminder reply ────────────────────────────────────────────────────────────

export async function handleReminderReply(
  reply: string,
  reminderLabel: string
): Promise<{ shouldLog: boolean; mealText: string; response: string }> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `You are Textabite. The user just replied to a ${reminderLabel} reminder.
Figure out if they described food they ate. If yes, extract the food description so we can log it.
Reply with JSON only:
{
  "shouldLog": true/false,
  "mealText": "food description or empty string",
  "response": "your casual friendly reply as Textabite (under 140 chars, plain text)"
}`,
    messages: [{ role: 'user', content: reply }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
  return JSON.parse(text);
}

// ── Daily summary ─────────────────────────────────────────────────────────────

interface DailySummaryInput {
  meals: { description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[];
  totals: DayTotals;
  goals?: UserGoals;
}

export async function formatDailySummary(data: DailySummaryInput): Promise<string> {
  const goalsContext = data.goals?.calorie_goal
    ? `Their daily calorie goal is ${data.goals.calorie_goal} cal.`
    : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 320,
    system: `You are Textabite, a friendly nutrition buddy who texts like a real friend. Write a casual morning summary SMS. ${goalsContext}
Keep it upbeat and personal. Mention total calories and one thing they did well or could improve. Plain text only, no markdown, under 300 chars.`,
    messages: [{
      role: 'user',
      content: `Yesterday's meals:\n${data.meals.map(m => `- ${m.description} (${m.calories} cal)`).join('\n')}\n\nTotals: ${data.totals.calories} cal, ${data.totals.protein_g}g protein, ${data.totals.carbs_g}g carbs, ${data.totals.fat_g}g fat`,
    }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── Goal onboarding ───────────────────────────────────────────────────────────

export async function goalOnboardingReply(
  userMessage: string,
  currentStep: string | null
): Promise<{ reply: string; nextStep: string | null; goals?: Partial<UserGoals> }> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 320,
    system: `You are Textabite helping a user set up their nutrition goals via text. Be casual and friendly like a friend walking them through it.
Current onboarding step: ${currentStep ?? 'start'}.

Steps: start → ask_preset (lose weight / maintain / build muscle / custom) → if custom: ask_calories → ask_protein → ask_carbs → ask_fat → done
If preset chosen, infer sensible calorie/macro defaults.

Reply with JSON only:
{
  "reply": "your casual text reply (plain text, under 160 chars)",
  "nextStep": "next step name or null if done",
  "goals": { optional partial UserGoals object if values were captured }
}`,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
  return JSON.parse(text);
}

// ── Casual reminder message ───────────────────────────────────────────────────

export async function generateReminder(label: string, userName?: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 80,
    system: `You are Textabite, texting a friend a casual ${label} check-in. Ask if they ate in a natural, friendly way — like a real friend would text. No corporate speak. Vary your phrasing each time. Plain text only, under 80 chars.`,
    messages: [{ role: 'user', content: `Send a ${label} reminder${userName ? ` to ${userName}` : ''}.` }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : `Hey! How was ${label}? 🍽️`;
}

// ── Help reply ────────────────────────────────────────────────────────────────

export async function helpReply(): Promise<string> {
  return `Hey! Just text me what you eat and I'll track the nutrition 🥗 Snap a photo too if you want. Reply "goals" to set targets. Text STOP to unsubscribe.`;
}
