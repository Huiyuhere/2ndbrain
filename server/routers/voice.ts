/**
 * tRPC router for AI voice input.
 *
 * Procedures:
 *  - transcribeAndClean: takes an audio URL, transcribes via Whisper,
 *    then cleans filler words / polishes via LLM, returns both raw and cleaned text.
 */

import { z } from "zod";
import { workspaceProcedure, router } from "../_core/trpc";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";
import { storageGetSignedUrl } from "../storage";

/**
 * Resolve an audioUrl to a direct S3 signed URL that the server can fetch.
 * The upload endpoint returns /manus-storage/voice/... which is a relative path
 * that only works via the browser (307 redirect). Server-side fetch needs the
 * actual S3 presigned URL.
 */
async function resolveAudioUrl(audioUrl: string): Promise<string> {
  // If it's a /manus-storage/ path, extract the key and get a signed URL
  const manusPrefix = '/manus-storage/';
  if (audioUrl.includes(manusPrefix)) {
    const idx = audioUrl.indexOf(manusPrefix);
    const key = audioUrl.slice(idx + manusPrefix.length);
    return storageGetSignedUrl(key);
  }
  // Already a full URL (e.g. https://...)
  return audioUrl;
}

const CLEANUP_SYSTEM_PROMPT = `You are a journaling assistant. The user has dictated a journal entry using voice.
Clean it up: remove filler words (um, uh, like, you know, sort of, kind of, basically, literally, right, okay so), fix obvious grammar mistakes, break run-on sentences into clean readable sentences, and preserve the user's original meaning and tone.
Do not add new content, do not summarise, do not change the intent or facts. Do not add any commentary or explanation.
Return only the cleaned text, nothing else.`;

const REFLECTION_DUMP_SYSTEM_PROMPT = `You are a journaling assistant helping a user fill in their reflection journal.

The user spoke freely about their week/month/quarter. Your job is to distribute their words into the correct prompt fields.

CRITICAL RULES:
- Use the user's EXACT words and phrasing. Do NOT paraphrase, summarize, or polish.
- Only remove filler words (um, uh, like, you know, basically, right, okay so).
- If the user mentioned something that fits a prompt, put those exact sentences under that prompt key.
- If something doesn't clearly fit any prompt, put it under the closest match.
- If a prompt has no relevant content from the user, leave it as an empty string.
- Return ONLY valid JSON, no explanation, no markdown code blocks.

You will receive:
1. The list of prompt keys and their questions
2. The user's full transcript

Return a JSON object where each key matches a prompt key and the value is the user's words that answer that prompt.`;

const EVENING_DUMP_SYSTEM_PROMPT = `You are a journaling assistant helping a user fill in their evening journal from a single voice brain dump.

Extract and classify the content into the following JSON structure:
{
  "title": "A short poetic title or quote that captures the essence of the day (1 sentence max, optional)",
  "highlights": [
    { "type": "+", "text": "A positive highlight, win, or good moment" },
    { "type": "-", "text": "Something that didn't go well, a lesson, or a low point" }
  ],
  "freeWrite": "Anything that doesn't fit neatly into highlights — reflections, feelings, observations, plans (optional)"
}

Rules:
- Classify each point as + (good/win/highlight) or - (bad/lesson/low) based on the user's tone and words.
- If the user explicitly says something like 'good thing', 'win', 'highlight', 'I'm proud', classify as +.
- If the user says 'didn't go well', 'struggled', 'frustrated', 'lesson', classify as -.
- If ambiguous or reflective, put it in freeWrite.
- Remove all filler words (um, uh, like, you know, basically, right, okay so).
- Keep the user's voice and tone — don't over-polish.
- Return ONLY valid JSON, no explanation, no markdown code blocks.`;

export const voiceRouter = router({
  /**
   * Transcribe an audio file and clean up the transcript.
   * The frontend uploads the audio blob first (/api/voice/upload) to get a URL,
   * then calls this procedure with that URL.
   */
  transcribeAndClean: workspaceProcedure
    .input(
      z.object({
        audioUrl: z.string().min(1),
        /** Optional hint about which field this is for — helps LLM context */
        fieldHint: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Step 1: Resolve the storage URL to a direct S3 signed URL
      const resolvedUrl = await resolveAudioUrl(input.audioUrl);

      // Step 2: Transcribe via Whisper
      const transcription = await transcribeAudio({
        audioUrl: resolvedUrl,
        language: "en",
        prompt: input.fieldHint
          ? `Journal entry for: ${input.fieldHint}`
          : "Personal journal entry",
      });

      // Check for transcription error
      if ("error" in transcription) {
        throw new Error(
          `Transcription failed: ${transcription.error}${transcription.details ? ` (${transcription.details})` : ""}`
        );
      }

      const rawText = transcription.text?.trim() ?? "";

      if (!rawText) {
        return { rawText: "", cleanedText: "" };
      }

      // Step 2: LLM cleanup — remove filler words, polish sentences
      let cleanedText = rawText;
      try {
        const messages: Array<{ role: "system" | "user"; content: string }> = [
          { role: "system", content: CLEANUP_SYSTEM_PROMPT },
          {
            role: "user",
            content: input.fieldHint
              ? `Journal field: "${input.fieldHint}"\n\nDictated text:\n${rawText}`
              : rawText,
          },
        ];

        const llmResponse = await invokeLLM({ messages });
        const content = llmResponse?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          cleanedText = content.trim();
        }
      } catch (llmErr) {
        // If LLM cleanup fails, fall back to raw transcript — don't block the user
        console.error("[voice] LLM cleanup failed, using raw transcript:", llmErr);
        cleanedText = rawText;
      }

      return { rawText, cleanedText };
    }),

  /**
   * Transcribe a single voice brain dump and use AI to distribute the content
   * across evening journal fields: title, highlights (+/-), and free write.
   */
  parseEveningDump: workspaceProcedure
    .input(
      z.object({
        audioUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      let rawText = "";

      // Check if this is a text:// protocol (pre-transcribed text from conversational flow)
      if (input.audioUrl.startsWith('text://')) {
        rawText = decodeURIComponent(input.audioUrl.slice('text://'.length)).trim();
      } else {
        // Normal audio flow: resolve URL and transcribe
        const resolvedUrl = await resolveAudioUrl(input.audioUrl);
        const transcription = await transcribeAudio({
          audioUrl: resolvedUrl,
          language: "en",
          prompt: "Evening journal brain dump \u2014 highlights, wins, lessons, reflections",
        });

        if ("error" in transcription) {
          throw new Error(
            `Transcription failed: ${transcription.error}${transcription.details ? ` (${transcription.details})` : ""}`
          );
        }
        rawText = transcription.text?.trim() ?? "";
      }

      if (!rawText) {
        return {
          rawText: "",
          title: "",
          highlights: [] as Array<{ type: "+" | "-"; text: string }>,
          freeWrite: "",
        };
      }

      // LLM structured extraction
      let title = "";
      let highlights: Array<{ type: "+" | "-"; text: string }> = [];
      let freeWrite = "";

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: EVENING_DUMP_SYSTEM_PROMPT },
            { role: "user", content: rawText },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "evening_journal",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  highlights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["+", "-"] },
                        text: { type: "string" },
                      },
                      required: ["type", "text"],
                      additionalProperties: false,
                    },
                  },
                  freeWrite: { type: "string" },
                },
                required: ["title", "highlights", "freeWrite"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmResponse?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          const parsed = JSON.parse(content);
          title = parsed.title ?? "";
          highlights = (parsed.highlights ?? []).map((h: { type: string; text: string }) => ({
            type: (h.type === "-" ? "-" : "+") as "+" | "-",
            text: h.text ?? "",
          }));
          freeWrite = parsed.freeWrite ?? "";
        }
      } catch (err) {
        // Fallback: put everything in freeWrite
        console.error("[voice] Evening dump parsing failed, falling back to freeWrite:", err);
        freeWrite = rawText;
      }

      return { rawText, title, highlights, freeWrite };
    }),

  /**
   * Parse a reflection brain dump: takes pre-transcribed text + the prompt keys/questions,
   * distributes the user's words into the correct prompt fields.
   */
  parseReflectionDump: workspaceProcedure
    .input(
      z.object({
        text: z.string().min(1),
        prompts: z.array(z.object({
          key: z.string(),
          question: z.string(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const { text, prompts } = input;

      // Build the schema dynamically based on prompts
      const properties: Record<string, { type: string }> = {};
      for (const p of prompts) {
        properties[p.key] = { type: "string" };
      }

      const promptList = prompts.map(p => `- "${p.key}": ${p.question}`).join('\n');

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: REFLECTION_DUMP_SYSTEM_PROMPT },
            {
              role: "user",
              content: `PROMPTS:\n${promptList}\n\nUSER'S TRANSCRIPT:\n${text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "reflection_answers",
              strict: true,
              schema: {
                type: "object",
                properties,
                required: prompts.map(p => p.key),
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmResponse?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          const parsed = JSON.parse(content) as Record<string, string>;
          const result: Record<string, string> = {};
          for (const p of prompts) {
            result[p.key] = parsed[p.key] ?? "";
          }
          return { answers: result };
        }
      } catch (err) {
        console.error("[voice] Reflection dump parsing failed:", err);
      }

      // Fallback: put everything in the first prompt
      const fallback: Record<string, string> = {};
      for (const p of prompts) {
        fallback[p.key] = "";
      }
      if (prompts.length > 0) {
        fallback[prompts[0].key] = text;
      }
      return { answers: fallback };
    }),
});
