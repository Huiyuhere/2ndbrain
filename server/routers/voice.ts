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

const CLEANUP_SYSTEM_PROMPT = `You are a journaling assistant. The user has dictated a journal entry using voice.
Clean it up: remove filler words (um, uh, like, you know, sort of, kind of, basically, literally, right, okay so), fix obvious grammar mistakes, break run-on sentences into clean readable sentences, and preserve the user's original meaning and tone.
Do not add new content, do not summarise, do not change the intent or facts. Do not add any commentary or explanation.
Return only the cleaned text, nothing else.`;

export const voiceRouter = router({
  /**
   * Transcribe an audio file and clean up the transcript.
   * The frontend uploads the audio blob first (/api/voice/upload) to get a URL,
   * then calls this procedure with that URL.
   */
  transcribeAndClean: workspaceProcedure
    .input(
      z.object({
        audioUrl: z.string().url(),
        /** Optional hint about which field this is for — helps LLM context */
        fieldHint: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Step 1: Transcribe via Whisper
      const transcription = await transcribeAudio({
        audioUrl: input.audioUrl,
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
});
